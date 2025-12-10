# AICHATflow

AICHATflow é uma plataforma modular construída com Node.js, Express e React, que utiliza IA para processamento de demandas e geração de documentação.

## Configuração do Ambiente

1. Clone o repositório
2. Instale as dependências:
   ```
   npm install
   ```
3. Crie um arquivo `.env` baseado no `.env.example` e configure as variáveis de ambiente necessárias
4. Execute o servidor de desenvolvimento:
   ```
   npm run dev
   ```

## Gestão de Dependências

### Resolução de Conflitos Vite 7.x + Tailwind CSS

O projeto utiliza **Vite 7.2.7** como build tool. Durante a atualização de dependências, foi identificado um conflito de peer dependencies com `@tailwindcss/vite`.

**Problema Identificado:**
```
@tailwindcss/vite@4.1.3 requer Vite ^5.2.0 || ^6
Projeto usa Vite 7.2.7
```

**Solução Implementada:**

Atualização do `@tailwindcss/vite` para a versão 4.1.17, que adiciona suporte para Vite 7.x:

```json
{
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.17",
    "@types/node": "^22.12.0",
    "vite": "^7.2.7"
  }
}
```

**Comandos de Resolução:**
```bash
# Verificar versões disponíveis
npm view @tailwindcss/vite versions --json

# Verificar compatibilidade
npm view @tailwindcss/vite@4.1.17 peerDependencies

# Instalar dependências atualizadas
npm install
```

**Observação Importante:**
- A versão 4.1.17 do `@tailwindcss/vite` suporta Vite `^5.2.0 || ^6 || ^7`
- `@types/node` foi atualizado para `^22.12.0` para compatibilidade com Vite 7.x
- O build foi testado e está funcionando corretamente

### Ordem de @import no CSS

O PostCSS requer que diretivas `@import` precedam todas as outras declarações (exceto `@charset`).

Em `client/src/index.css`, a importação customizada deve vir antes das diretivas Tailwind:

```css
@import './components/refinement-dialog.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Variáveis de Ambiente

- `MISTRAL_API_KEY`: Chave de API da Mistral AI (obrigatório)
- `PORT`: Porta em que o servidor será executado (padrão: 5000)
- `NODE_ENV`: Ambiente de execução (development, production)
- `DATABASE_URL`: URL de conexão com o banco de dados
- `SESSION_SECRET`: Segredo para criptografia das sessões

## Integração com Mistral AI

A plataforma utiliza a API da Mistral AI para processamento de linguagem natural. Para configurar:

1. Crie uma conta na [Mistral AI](https://console.mistral.ai/)
2. Obtenha sua chave de API
3. Configure a chave no arquivo `.env`:
   ```
   MISTRAL_API_KEY=sua_chave_aqui
   ```

## Estrutura do Projeto

- `/client`: Frontend React
- `/server`: Backend Express
- `/shared`: Código compartilhado entre frontend e backend
- `/documents`: Documentos gerados pela plataforma

## Desenvolvimento

Para contribuir com o projeto:

1. Crie um branch para sua feature
2. Implemente suas mudanças
3. Envie um pull request

## Licença

MIT