# AICHATflow

AICHATflow é uma plataforma modular construída com Node.js, Express e React, que utiliza IA para processamento inteligente de demandas, geração de documentação e colaboração multi-agente. O sistema incorpora roteamento inteligente baseado em Machine Learning, interação colaborativa entre agentes especializados e um sistema de plugins extensível.

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
- `GITHUB_TOKEN`: Token de acesso ao GitHub para integração de repositórios
- `ENABLE_ML_ROUTING`: Habilita/desabilita o sistema de roteamento ML (padrão: true)
- `ENABLE_AGENT_INTERACTION`: Habilita/desabilita interação multi-agente (padrão: true)
- `MAX_INTERACTION_ROUNDS`: Número máximo de rodadas de interação entre agentes (padrão: 5)
- `COMPLETENESS_THRESHOLD`: Threshold de completude para finalizar interação (padrão: 85)

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
  - `/routing`: Sistema de roteamento inteligente com ML
  - `/plugins`: Plugins especializados por tipo de demanda
  - `/services`: Serviços de processamento e integração
  - `/ml_models`: Modelos de Machine Learning treinados
- `/shared`: Código compartilhado entre frontend e backend
- `/documents`: Documentos gerados pela plataforma
- `/data`: Dados históricos e métricas do sistema
- `/config`: Configurações e feature flags
- `/agents`: Configurações YAML dos agentes especializados

## Funcionalidades Principais

### Sistema de Roteamento Inteligente (ML Router)

O AICHATflow incorpora um sistema avançado de roteamento baseado em Machine Learning que:

- **Predição Automática**: Analisa demandas e prediz automaticamente o melhor time/squad para tratamento
- **Métricas de Confiança**: Fornece scores de confiança, tempo estimado de resolução e taxa de sucesso esperada
- **Aprendizado Contínuo**: Treina com dados históricos e melhora continuamente as predições
- **Coleta de Dados**: Sistema automatizado de coleta e armazenamento de métricas para treinamento do modelo

**Arquivos principais:**
- `server/routing/ml-router.ts`: Motor de ML para roteamento
- `server/routing/orchestrator.ts`: Orquestrador do sistema de roteamento
- `server/routing/data-collector.ts`: Coleta de dados históricos
- `server/routing/metrics-collector.ts`: Coleta e análise de métricas

### Sistema de Interação Multi-Agente

Sistema de colaboração entre agentes de IA especializados que:

- **Interação Colaborativa**: Agentes debatem e refinam demandas em conjunto
- **Refinamento Baseado em Completude**: Sistema inteligente que detecta quando a informação é suficiente
- **Contribuições Individuais**: Cada agente contribui com sua expertise específica
- **Histórico de Conversação**: Mantém registro completo das interações entre agentes

**Agentes Especializados:**
- **Product Owner (PO)**: Define requisitos e prioridades de negócio
- **Product Manager (PM)**: Gerencia backlog e coordena entregas
- **Tech Lead**: Lidera decisões técnicas e arquiteturais
- **QA**: Garante qualidade e define estratégias de teste

**Arquivo principal:**
- `server/services/agent-interaction.ts`: Serviço de interação multi-agente

### Sistema de Plugins

Arquitetura extensível baseada em plugins que permite processamento especializado por tipo de demanda:

- **Base Plugin**: Interface comum para todos os plugins
- **Improvement Plugin**: Otimização e melhorias de performance
- **Bug Plugin**: Análise e correção de bugs
- **Discovery Plugin**: Exploração e descoberta de requisitos

**Características:**
- Sistema de priorização de plugins
- Ativação/desativação via feature flags
- Métricas de execução por plugin
- Processamento condicional baseado no contexto da demanda

**Arquivos principais:**
- `server/plugins/base-plugin.ts`: Plugin base abstrato
- `server/plugins/improvement-plugin.ts`: Plugin de melhorias
- `server/plugins/bug-plugin.ts`: Plugin de bugs
- `server/plugins/discovery-plugin.ts`: Plugin de discovery

### Sistema de Métricas e Monitoramento

- **Métricas de Demandas**: Taxa de sucesso, tempo de resolução, distribuição por tipo
- **Métricas de Sistema**: Performance, uso de recursos, latência de agentes
- **Métricas de Plugins**: Tempo de execução, taxa de sucesso por plugin
- **Dados Históricos**: Armazenamento de demandas processadas para treinamento do ML

**Arquivos de dados:**
- `data/demand_metrics.json`: Métricas de demandas processadas
- `data/system_metrics.json`: Métricas gerais do sistema
- `data/historical_demands.csv`: Histórico de demandas para ML

### Feature Flags

Sistema de feature flags para controle granular de funcionalidades:

```json
{
  "enableRefactoringFeatures": true,
  "enableNewProductFeatures": true,
  "enableEnhancedValidation": true,
  "enableAdvancedLogging": true,
  "enableUserFeedbackSystem": true
}
```

**Arquivo:** `config/feature-flags.json`

## Como Usar

### Processando uma Demanda com Roteamento Inteligente

1. **Criar uma Demanda**: Use a interface para criar uma nova demanda com título, descrição, tipo e prioridade

2. **Roteamento Automático**: O sistema automaticamente:
   - Analisa o conteúdo da demanda
   - Prediz o melhor time para tratamento
   - Fornece métricas de confiança e tempo estimado
   - Aplica plugins relevantes baseados no tipo

3. **Interação Multi-Agente**: Os agentes especializados colaboram para:
   - Refinar os requisitos
   - Identificar gaps de informação
   - Gerar documentação detalhada (PRD, tasks, etc.)
   - Avaliar completude da informação

### Criando um Plugin Personalizado

```typescript
import { BasePlugin, PluginResult, DemandContext } from './base-plugin';

export class CustomPlugin extends BasePlugin {
  readonly name = 'CustomPlugin';
  readonly description = 'Descrição do seu plugin';
  readonly type = ['seu-tipo-de-demanda'];

  canProcess(context: DemandContext): boolean {
    return this.isEnabled() &&
           this.getSupportedTypes().includes(context.demand.type);
  }

  async process(context: DemandContext): Promise<PluginResult> {
    // Sua lógica de processamento aqui
    return {
      success: true,
      message: 'Processamento concluído',
      data: { /* seus dados */ }
    };
  }
}
```

### Registrando um Plugin

No arquivo `server/routing/orchestrator.ts`:

```typescript
import { CustomPlugin } from '../plugins/custom-plugin';

// No método de inicialização
const customPlugin = new CustomPlugin();
demandRoutingOrchestrator.registerPlugin(customPlugin);
```

### Consultando Métricas

As métricas são automaticamente coletadas e podem ser consultadas em:

- **Via API**: Endpoint `/api/metrics` para métricas em tempo real
- **Arquivos JSON**: Consulte `data/demand_metrics.json` e `data/system_metrics.json`
- **Histórico**: Dados históricos em `data/historical_demands.csv`

### Treinando o Modelo ML

O modelo é treinado automaticamente ao inicializar o sistema. Para retreinar manualmente:

```typescript
import { demandRoutingOrchestrator } from './routing/orchestrator';

// Retreinar com novos dados
await demandRoutingOrchestrator.initialize();
```

## Tecnologias Utilizadas

### Backend
- **Node.js** + **Express**: Framework web para servidor
- **TypeScript**: Tipagem estática para melhor qualidade de código
- **Mistral AI API**: Modelos de IA para processamento de linguagem natural
- **Machine Learning**: Sistema próprio de ML para roteamento inteligente
- **SQLite**: Banco de dados para armazenamento de demandas e usuários

### Frontend
- **React 19**: Framework UI moderna
- **Vite 7.2.7**: Build tool de alta performance
- **Tailwind CSS 4.x**: Framework CSS utilitário
- **TypeScript**: Tipagem estática
- **Radix UI**: Componentes acessíveis e customizáveis

### Integrações
- **GitHub API**: Importação de issues e integração com repositórios
- **PDF Generator**: Geração automática de documentação em PDF
- **WebSocket**: Comunicação em tempo real para atualizações de chat

## Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Chat UI      │  │ Demand Form  │  │ Metrics View │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                    Backend (Express)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Demand Routing Orchestrator                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ ML Router  │  │ Plugins    │  │ Metrics    │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │         Agent Interaction Service                     │  │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐            │  │
│  │  │  PO  │  │  PM  │  │ Tech │  │  QA  │            │  │
│  │  │      │◄─┤      │◄─┤ Lead │◄─┤      │            │  │
│  │  └──────┘  └──────┘  └──────┘  └──────┘            │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │              Mistral AI Service                       │  │
│  │      (devstral-2512 + mistral-large-latest)          │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Armazenamento                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   SQLite     │  │ JSON Metrics │  │  CSV History │      │
│  │   Database   │  │    Files     │  │    Files     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Fluxo de Processamento de Demanda

1. **Recepção**: Demanda criada via UI ou importada do GitHub
2. **Roteamento ML**: Sistema ML analisa e prediz melhor tratamento
3. **Aplicação de Plugins**: Plugins especializados processam a demanda
4. **Interação Multi-Agente**: Agentes colaboram para refinar requisitos
5. **Avaliação de Completude**: Sistema verifica se informação é suficiente
6. **Geração de Documentação**: PRD, tasks e outros documentos gerados
7. **Coleta de Métricas**: Dados armazenados para treinamento futuro

## Desenvolvimento

Para contribuir com o projeto:

1. Crie um branch para sua feature
2. Implemente suas mudanças
3. Execute os testes (quando disponíveis)
4. Envie um pull request

### Guia de Contribuição

- Siga os padrões de código TypeScript
- Mantenha a cobertura de testes
- Documente novas funcionalidades
- Atualize o README quando necessário

## Roadmap

- [ ] Implementar testes unitários e de integração
- [ ] Dashboard de métricas em tempo real
- [ ] Suporte a mais modelos de IA (OpenAI, Anthropic, etc.)
- [ ] Sistema de notificações
- [ ] API pública documentada
- [ ] Integração com Jira e outras ferramentas
- [ ] Exportação de métricas para BI tools

## Licença

MIT