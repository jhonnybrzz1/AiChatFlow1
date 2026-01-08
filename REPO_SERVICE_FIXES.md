# Correções no RepoService para o problema de briefing

## Problema Original
O sistema estava tentando gerar briefings para o repositório `jhonnybrzz1/InvestAi` em segundo plano, mas estava encontrando os seguintes problemas:

1. **Branch padrão não encontrado**: O código estava tentando usar `defaultBranch` diretamente, mas quando o repositório não era acessível via API do GitHub, o valor não estava sendo definido corretamente.

2. **Chamadas repetidas**: O método `getOrCreateRepo` estava chamando `generateStructuralContext` em segundo plano sem controle, levando a múltiplas chamadas simultâneas e mensagens repetidas.

3. **Falta de verificação de acessibilidade**: O código não verificava se o repositório era acessível antes de tentar buscar a árvore de arquivos.

## Soluções Implementadas

### 1. Verificação de Acessibilidade do Repositório
Adicionamos uma verificação inicial para garantir que o repositório é acessível antes de tentar gerar o contexto estrutural:

```typescript
// Primeiro, verificar se o repositório é acessível
try {
  console.log(`Verificando acessibilidade do repositório ${owner}/${name}`);
  const repoCheck = await this.gitHubService.client.repos.get({ owner, repo: name });
  console.log(`Repositório ${owner}/${name} é acessível`);
} catch (checkError) {
  console.error(`Repositório ${owner}/${name} não é acessível ou não existe:`, checkError);
  // Se o repositório não é acessível, não tente gerar o contexto
  return;
}
```

### 2. Prevenção de Chamadas Duplicadas
Adicionamos um mecanismo para rastrear chamadas em andamento e evitar chamadas duplicadas:

```typescript
// Track ongoing context generation to prevent duplicate calls
private ongoingContextGeneration = new Set<string>();

// No método getOrCreateRepo:
const repoKey = `${owner}/${name}`;
if (!this.ongoingContextGeneration.has(repoKey)) {
  this.ongoingContextGeneration.add(repoKey);
  console.log(`Briefing para ${owner}/${name} está desatualizado ou não existe. Gerando em segundo plano...`);
  this.generateStructuralContext(owner, name).catch(error => {
    console.error(`Erro na geração de contexto em segundo plano para ${owner}/${name}:`, error);
  }).finally(() => {
    this.ongoingContextGeneration.delete(repoKey);
  });
} else {
  console.log(`Geração de contexto já em andamento para ${owner}/${name}. Pulando chamada duplicada.`);
}
```

### 3. Melhoria no Tratamento de Erros
Adicionamos tratamento de erros mais granular para cada etapa do processo:

```typescript
// Buscar a árvore de arquivos completa
try {
  console.log(`Buscando árvore de arquivos para ${owner}/${name} no branch ${defaultBranch}`);
  const treeData = await this.gitHubService.client.git.getTree({
    owner,
    repo: name,
    tree_sha: defaultBranch,
    recursive: 'true',
  });
  // ...
} catch (treeError) {
  console.error(`Erro ao buscar árvore de arquivos para ${owner}/${name}:`, treeError);
  return;
}

// Identificar e ler o conteúdo de arquivos chave
try {
  console.log(`Buscando conteúdo da raiz para identificar arquivos chave`);
  const rootContent = await this.gitHubService.getRepoContent(owner, name);
  // ...
} catch (contentError) {
  console.error(`Erro ao buscar conteúdo da raiz para ${owner}/${name}:`, contentError);
  // Continue mesmo sem os arquivos chave
}
```

## Benefícios das Correções

1. **Eficiência**: Evita chamadas desnecessárias à API do GitHub quando o repositório não é acessível.

2. **Prevenção de Duplicação**: Evita que múltiplas chamadas simultâneas tentem gerar o mesmo briefing, reduzindo a carga no sistema e na API.

3. **Melhor Diagnóstico**: Logs mais detalhados ajudam a identificar onde exatamente os problemas estão ocorrendo.

4. **Resiliência**: O sistema continua funcionando mesmo quando partes do processo falham (como a leitura de arquivos individuais).

## Arquivos Modificados

- `server/services/repo-service.ts`: Arquivo principal com todas as correções implementadas.

## Testes Realizados

Criamos testes simples para verificar que:
1. O mecanismo de prevenção de chamadas duplicadas funciona corretamente
2. O Set `ongoingContextGeneration` é inicializado corretamente
3. Chamadas subsequentes são bloqueadas enquanto uma geração está em andamento
4. Novas chamadas podem ser feitas após a conclusão da geração anterior

## Como Testar

As correções já estão implementadas e testadas. Para verificar o funcionamento:

1. Tente acessar um repositório que não existe ou não é acessível
2. Verifique nos logs que a mensagem "Repositório não é acessível ou não existe" aparece
3. Tente acessar um repositório válido e verifique que a geração de briefing ocorre apenas uma vez
4. Verifique que chamadas subsequentes são bloqueadas com a mensagem "Geração de contexto já em andamento"

## Próximos Passos

- Monitorar os logs para garantir que as correções estão funcionando em produção
- Considerar adicionar métricas para rastrear quantas chamadas duplicadas são evitadas
- Avaliar a possibilidade de adicionar um sistema de retry para repositórios temporariamente inacessíveis