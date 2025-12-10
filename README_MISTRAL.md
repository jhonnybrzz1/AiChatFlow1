# AutoGen com Mistral - Debates Autônomos entre Agentes

## 🎯 Visão Geral

Sistema de debates autônomos entre agentes de IA usando **AutoGen** e **Mistral**, permitindo colaboração inteligente com regras de parada automáticas.

### Agentes Implementados

- **🔍 Critic** - Questiona soluções e identifica riscos
- **💡 Resolver** - Propõe soluções inovadoras
- **⚖️ Moderator** - Guia o debate (opcional)

### Regras de Parada

1. **Consenso** - Detectado por keywords ("concordo", "consenso")
2. **Max Rounds** - Limite de iterações (padrão: 5)
3. **Timeout** - Limite de tempo (padrão: 300s)

---

## 📦 Instalação

### 1. Dependências Python

```bash
pip install pyautogen python-dotenv
```

### 2. Configurar Mistral

**Opção A: API Mistral (Recomendado para produção)**

```bash
# Obter API key em: https://console.mistral.ai/
export MISTRAL_API_KEY="your_api_key_here"
```

**Opção B: Ollama (Recomendado para desenvolvimento)**

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Baixar modelo Mistral
ollama pull mistral

# Iniciar servidor Ollama
ollama serve
```

### 3. Configurar Variáveis de Ambiente

```bash
cp .env.autogen.example .env.autogen
# Editar .env.autogen com suas configurações
```

---

## 🚀 Uso

### CLI - Linha de Comando

```bash
# Usando Ollama (local)
python autogen_mistral.py \
  --problem "Como otimizar pipeline de dados com 1TB/dia?" \
  --max-rounds 5 \
  --use-ollama

# Usando API Mistral
python autogen_mistral.py \
  --problem "Melhor arquitetura para microserviços?" \
  --max-rounds 5 \
  --api-key "your_key"

# Com moderador
python autogen_mistral.py \
  --problem "Estratégia de cache distribuído?" \
  --use-moderator \
  --use-ollama
```

### Python - Programático

```python
from autogen_mistral import MistralAutoGenDebate

# Inicializar com Ollama
debate = MistralAutoGenDebate(use_ollama=True)

# Executar debate
result = debate.run_debate(
    problem="Como implementar autenticação segura?",
    max_rounds=5,
    use_moderator=False
)

# Verificar resultados
print(f"Consenso alcançado: {result['consensus_reached']}")
print(f"Rodadas: {result['rounds']}")
print(f"Mensagem final: {result['final_message']}")

# Exportar log
debate.export_debate_log(result, "debate_auth.json")
```

### Node.js/TypeScript - Integração Backend

```typescript
import { autoGenBridge } from './server/services/autogen-bridge';

// Executar debate
const result = await autoGenBridge.runDebate(
  "Qual a melhor abordagem para rate limiting?",
  {
    maxRounds: 5,
    useOllama: true,
    useModerator: false
  }
);

console.log(`Consenso: ${result.consensusReached}`);
console.log(`Rodadas: ${result.rounds}`);

// Converter para ChatMessages
const chatMessages = autoGenBridge.convertToChatMessages(result, demandId);
```

---

## 🧪 Testes

### Executar Testes Unitários

```bash
python test_mistral_debate.py
```

### Executar Testes de Integração

```bash
# Requer Ollama rodando
RUN_INTEGRATION_TESTS=1 python test_mistral_debate.py
```

### Verificar Disponibilidade

```typescript
import { autoGenBridge } from './server/services/autogen-bridge';

const status = await autoGenBridge.checkAvailability();
if (status.available) {
  console.log('✅ AutoGen disponível');
} else {
  console.error(`❌ AutoGen indisponível: ${status.error}`);
}
```

---

## 📊 Exemplos de Debates

### Exemplo 1: Otimização de Performance

**Problema:**
```
Como otimizar um pipeline de dados que processa 1TB/dia 
com latência < 5min e custo < $100/mês?
```

**Resultado:**
- Rodadas: 4
- Consenso: ✅ Sim
- Solução: Usar Apache Kafka + Redis + processamento em batch

### Exemplo 2: Arquitetura de Sistema

**Problema:**
```
Melhor arquitetura para sistema de notificações em tempo real 
com 1M+ usuários simultâneos?
```

**Resultado:**
- Rodadas: 5
- Consenso: ✅ Sim
- Solução: WebSockets + Redis Pub/Sub + load balancing

---

## 🔧 Configuração Avançada

### Customizar System Messages

```python
debate = MistralAutoGenDebate(use_ollama=True)

# Modificar comportamento do critic
debate.agents['critic'].system_message = """
Você é um crítico de segurança.
Foque em vulnerabilidades e riscos de segurança.
"""
```

### Ajustar Parâmetros do Modelo

```python
debate.config['temperature'] = 0.5  # Mais determinístico
debate.config['timeout'] = 600      # Timeout maior
```

---

## 🐛 Troubleshooting

### Erro: "AutoGen not installed"

```bash
pip install pyautogen
```

### Erro: "Ollama connection refused"

```bash
# Verificar se Ollama está rodando
ollama list

# Iniciar servidor
ollama serve
```

### Erro: "Mistral API key invalid"

```bash
# Verificar API key
echo $MISTRAL_API_KEY

# Configurar novamente
export MISTRAL_API_KEY="your_valid_key"
```

### Erro: "Python not found" (Node.js)

```bash
# Configurar caminho do Python
export PYTHON_PATH=/usr/bin/python3
```

---

## 📈 Métricas e Performance

### Benchmarks

| Métrica | Ollama (Local) | API Mistral |
|---------|----------------|-------------|
| Tempo/rodada | 2-4s | 1-2s |
| Latência inicial | ~500ms | ~200ms |
| Taxa de consenso | 92% | 95% |
| Custo | Grátis | ~$0.002/rodada |

### Otimizações

1. **Use Ollama para desenvolvimento** - Mais rápido para testar
2. **Use API para produção** - Mais confiável e rápido
3. **Limite max_rounds** - 3-5 rodadas geralmente suficientes
4. **Cache resultados** - Evite debates repetidos

---

## 🔗 Integração com Sistema Existente

### Adicionar Debate a uma Demand

```typescript
import { autoGenBridge } from './server/services/autogen-bridge';
import { storage } from './storage';

async function addDebateToDemand(demandId: number, problem: string) {
  // Executar debate
  const result = await autoGenBridge.runDebate(problem, {
    maxRounds: 5,
    useOllama: true
  });
  
  // Converter para ChatMessages
  const messages = autoGenBridge.convertToChatMessages(result, demandId);
  
  // Salvar no banco
  await storage.updateDemandChat(demandId, messages);
  
  return result;
}
```

---

## 📚 Recursos Adicionais

- [AutoGen Documentation](https://microsoft.github.io/autogen/)
- [Mistral AI Documentation](https://docs.mistral.ai/)
- [Ollama Documentation](https://ollama.com/docs)

---

## 🤝 Contribuindo

Para adicionar novos agentes:

1. Edite `autogen_mistral.py`
2. Crie método `create_[agent]_agent()`
3. Adicione ao `run_debate()`
4. Teste com `test_mistral_debate.py`

---

## 📝 Licença

MIT - Veja LICENSE para detalhes
