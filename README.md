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