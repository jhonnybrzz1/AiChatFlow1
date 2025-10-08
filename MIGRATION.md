# Migração de OpenAI para Mistral AI

Este documento descreve o processo de migração da plataforma AICHATflow da API OpenAI para a API Mistral AI.

## Visão Geral

A plataforma AICHATflow foi atualizada para utilizar a API da Mistral AI em substituição à API da OpenAI. Esta migração mantém todas as funcionalidades existentes, mas agora utilizando os modelos de linguagem da Mistral AI.

## Mudanças Realizadas

1. **Dependências**:
   - Removida dependência direta da biblioteca `openai`
   - Adicionada dependência `@mistralai/mistralai`

2. **Configuração**:
   - Substituída a variável de ambiente `OPENAI_API_KEY` por `MISTRAL_API_KEY`
   - Atualizado o arquivo `.env.example` para refletir as novas variáveis de ambiente

3. **Serviços**:
   - Criado novo serviço `mistral-ai.ts` para encapsular a integração com a API da Mistral AI
   - Atualizado o serviço `ai-squad.ts` para utilizar o novo serviço Mistral AI
   - Mantida a mesma interface de serviço para garantir compatibilidade com o restante da aplicação

4. **Modelos**:
   - Substituído o modelo `gpt-4o` da OpenAI pelo modelo `mistral-large-latest` da Mistral AI
   - Ajustados os parâmetros de geração para corresponder às capacidades da Mistral AI

## Mapeamento de Modelos

| OpenAI | Mistral AI | Descrição |
|--------|------------|-----------|
| gpt-4o | mistral-large-latest | Modelo principal para geração de texto |

## Mapeamento de Parâmetros

| OpenAI | Mistral AI | Descrição |
|--------|------------|-----------|
| max_tokens | max_tokens | Número máximo de tokens a serem gerados |
| temperature | temperature | Controla a aleatoriedade da saída |
| messages | messages | Array de mensagens para o chat |

## Testes

Foi criado um script de teste `test-mistral.ts` para verificar a integração com a Mistral AI. Para executar o teste:

```
npm run test:mistral
```

## Próximos Passos

1. Monitorar o desempenho da integração com a Mistral AI
2. Ajustar os prompts conforme necessário para otimizar os resultados
3. Explorar recursos adicionais da API da Mistral AI para melhorar a plataforma