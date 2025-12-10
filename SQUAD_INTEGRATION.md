# Integração AutoGen com Agentes da Squad

## 🎯 Visão Geral

Agora você pode usar o framework AutoGen para criar **debates entre os agentes existentes** do sistema (refinador, qa, tech_lead, ux, etc.)!

## 🆕 Novo: Debates entre Agentes da Squad

### Script Python: `autogen_squad_integration.py`

Este script carrega os agentes configurados em YAML e permite que eles debatam usando AutoGen.

### Uso via CLI

```bash
# Debate entre QA e Tech Lead
python autogen_squad_integration.py \
  --problem "Como garantir qualidade em deploy contínuo?" \
  --agents qa tech_lead \
  --use-ollama

# Debate entre UX, QA e Tech Lead
python autogen_squad_integration.py \
  --problem "Melhor abordagem para formulário complexo?" \
  --agents ux qa tech_lead \
  --max-rounds 5

# Ver agentes disponíveis
python autogen_squad_integration.py \
  --problem "teste" \
  --agents refinador
```

### Uso via Node.js/TypeScript

```typescript
import { autoGenBridge } from './server/services/autogen-bridge';

// Debate entre agentes da squad
const result = await autoGenBridge.runSquadDebate(
  "Como implementar autenticação segura?",
  ['qa', 'tech_lead'],  // Agentes do sistema
  { maxRounds: 5, useOllama: true }
);

console.log(`Consenso: ${result.consensusReached}`);
console.log(`Rodadas: ${result.rounds}`);

// Converter para ChatMessages
const messages = autoGenBridge.convertToChatMessages(result, demandId);
```

## 📊 Exemplos de Debates

### Exemplo 1: QA vs Tech Lead

**Problema:** "Como garantir zero downtime em deploy?"

**Agentes:** `qa`, `tech_lead`

**Resultado esperado:**
- QA questiona estratégias de teste
- Tech Lead propõe blue-green deployment
- Chegam a consenso sobre rollback automático

### Exemplo 2: UX, QA e Tech Lead

**Problema:** "Melhor UX para upload de arquivos grandes?"

**Agentes:** `ux`, `qa`, `tech_lead`

**Resultado esperado:**
- UX propõe interface com progress bar
- QA questiona validação de arquivos
- Tech Lead sugere chunked upload
- Consenso sobre solução híbrida

### Exemplo 3: Squad Completa

**Problema:** "Arquitetura para feature de notificações real-time?"

**Agentes:** `refinador`, `tech_lead`, `qa`, `ux`, `data_analyst`

**Resultado esperado:**
- Refinador clarifica requisitos
- Tech Lead propõe WebSockets
- QA define critérios de teste
- UX desenha interface
- Data Analyst valida estrutura de dados

## 🔧 Agentes Disponíveis

Baseado nos arquivos YAML em `/agents`:

- `refinador` - Refina e clarifica demandas
- `tech_lead` - Arquitetura e viabilidade técnica
- `qa` - Qualidade e testes
- `ux_designer` - Experiência do usuário
- `data_analyst` - Estrutura de dados
- `scrum_master` - Processo e incrementos
- `product_manager` - Visão de produto
- `product_owner` - Priorização

## 🚀 Integração com Sistema Existente

### Adicionar Debate a uma Demand

```typescript
import { autoGenBridge } from './server/services/autogen-bridge';
import { storage } from './storage';

async function addSquadDebateToDemand(
  demandId: number,
  problem: string,
  agents: string[]
) {
  // Executar debate entre agentes da squad
  const result = await autoGenBridge.runSquadDebate(
    problem,
    agents,
    { maxRounds: 5, useOllama: true }
  );
  
  // Converter para ChatMessages com categorias
  const messages = result.messages.map((msg, index) => ({
    id: `${demandId}-squad-debate-${index}`,
    agent: msg.name,
    message: msg.content,
    timestamp: new Date().toISOString(),
    type: 'completed' as const,
    category: 'answer' as const  // Integrado com categorização visual!
  }));
  
  // Salvar no banco
  await storage.updateDemandChat(demandId, messages);
  
  return result;
}
```

### Endpoint API (exemplo)

```typescript
// Em server/routes.ts
app.post('/api/demands/:id/squad-debate', async (req, res) => {
  const { id } = req.params;
  const { problem, agents } = req.body;
  
  try {
    const result = await autoGenBridge.runSquadDebate(
      problem,
      agents,
      { maxRounds: 5, useOllama: true }
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 🎨 Integração com Categorização Visual

Os debates da squad já usam o sistema de categorização:

```typescript
// Mensagens automaticamente categorizadas
const messages = result.messages.map(msg => ({
  ...msg,
  category: getCategoryForAgent(msg.name)
}));

function getCategoryForAgent(agentName: string) {
  if (agentName === 'qa') return 'question';
  if (agentName === 'tech_lead') return 'answer';
  if (agentName === 'refinador') return 'system';
  return 'answer';
}
```

## 📝 Diferenças entre Modos

### Modo Original (autogen_mistral.py)
- Agentes genéricos: critic, resolver, moderator
- Bom para debates gerais
- Não usa configurações YAML

### Modo Squad (autogen_squad_integration.py)
- Usa agentes reais do sistema
- Carrega configurações YAML
- Mantém personalidade de cada agente
- Integrado com fluxo de demands

## 🔍 Troubleshooting

### Erro: "No config found for agent"

Verifique se o agente existe em `/agents`:
```bash
ls agents/
# Deve mostrar: qa.yaml, tech_lead.yaml, etc.
```

### Erro: "Need at least 2 agents"

Forneça pelo menos 2 agentes:
```bash
python autogen_squad_integration.py \
  --problem "teste" \
  --agents qa tech_lead  # Mínimo 2
```

## 📈 Próximos Passos

1. **Testar localmente:**
   ```bash
   pip install pyautogen python-dotenv pyyaml
   ollama pull mistral
   python autogen_squad_integration.py \
     --problem "Teste" \
     --agents qa tech_lead \
     --use-ollama
   ```

2. **Integrar no fluxo de demands**
3. **Criar UI para selecionar agentes**
4. **Adicionar métricas de consenso**

---

**Documentação completa:** Ver `README_MISTRAL.md`
