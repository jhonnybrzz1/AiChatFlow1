
# AiChatFlow

O AiChatFlow é uma plataforma inteligente de orquestração de fluxos de trabalho, projetada para automatizar e otimizar o ciclo de vida de desenvolvimento de software. Utilizando um sistema multi-agente com IA, a plataforma transforma demandas complexas em documentação técnica detalhada, planos de ação e produtos refinados, agilizando a entrega e melhorando a colaboração entre equipes.

## Principais Funcionalidades

- **Sistema Multi-Agente Colaborativo**: Uma equipe de agentes de IA especializados (Product Manager, Tech Lead, QA, etc.) que trabalham em conjunto para refinar, analisar e documentar demandas.
- **Roteamento Inteligente com Machine Learning**: Direciona automaticamente cada demanda para o time ou agente mais adequado, com base em análise de dados históricos.
- **Geração Automática de Documentação**: Cria artefatos essenciais como PRDs (Product Requirement Document) e Documentos de Tarefas, seguindo templates padronizados.
- **Arquitetura Baseada em Plugins**: Um design extensível que permite adicionar novas funcionalidades e lógicas de negócio de forma modular.
- **Integração Contínua**: Conecta-se a ferramentas como GitHub para importar demandas e sincronizar o trabalho.
- **Monitoramento e Métricas**: Coleta dados sobre o desempenho do sistema, dos agentes e das demandas para aprendizado e otimização contínuos.

## Como Funciona

O fluxo de trabalho do AiChatFlow segue um processo estruturado:

1.  **Criação da Demanda**: Um usuário submete uma nova demanda através da interface da plataforma ou ela é importada (ex: de uma issue do GitHub).
2.  **Roteamento Inteligente**: O motor de Machine Learning analisa a demanda e a atribui ao time de agentes mais qualificado.
3.  **Refinamento Multi-Agente**: Os agentes de IA colaboram em um "debate" estruturado para:
    *   Analisar a demanda sob múltiplas perspectivas (negócio, técnico, UX).
    *   Identificar gaps de informação e solicitar esclarecimentos.
    *   Propor soluções e alternativas.
4.  **Geração de Documentos**: Com base no refinamento, o Product Manager Agent gera a documentação técnica (PRD, Tasks Document).
5.  **Finalização e Entrega**: A demanda refinada e a documentação são disponibilizadas para a equipe de desenvolvimento.

## O Esquadrão de Agentes de IA

O AiChatFlow conta com uma equipe de agentes especializados, cada um com um perfil e responsabilidades distintas:

-   **Product Manager**: O planejador estratégico. Garante o alinhamento com os objetivos de negócio, gerencia o backlog e cria a documentação.
-   **Product Owner**: O conector humano. Foca no valor para o usuário, traduzindo necessidades em requisitos claros e mantendo o time engajado.
-   **Tech Lead**: O arquiteto do futuro. Garante a excelência técnica, a escalabilidade das soluções e a inovação.
-   **QA (Quality Assurance)**: O guardião da qualidade. Foca em testes, documentação de bugs e garantia de que os critérios de aceite sejam atendidos.
-   **UX Designer**: O criador de experiências. Garante que a solução seja intuitiva, acessível e encantadora para o usuário final.
-   **Data Analyst**: O estrategista de dados. Analisa dados para extrair insights, identificar padrões e embasar as decisões.
-   **Scrum Master**: O facilitador. Remove impedimentos, otimiza o fluxo de trabalho e garante a aplicação dos princípios ágeis.
-   **Refinador**: O catalisador de ideias. Explora abordagens criativas e inspira soluções inovadoras.

## Tecnologias Utilizadas

-   **Backend**: Node.js, Express, TypeScript
-   **Frontend**: React, Vite, Tailwind CSS
-   **Inteligência Artificial**: Mistral AI
-   **Banco de Dados**: SQLite (via Drizzle ORM)
-   **Integrações**: GitHub API, PDF-lib

## Configuração do Ambiente

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/AiChatFlow.git
    cd AiChatFlow
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as variáveis de ambiente:**
    - Crie um arquivo `.env` na raiz do projeto, utilizando o `.env.example` como modelo.
    - Preencha as variáveis obrigatórias, como `MISTRAL_API_KEY`.

    ```env
    # .env
    MISTRAL_API_KEY="sua_chave_da_mistral_ai"
    PORT=5000
    # Outras variáveis...
    ```

4.  **Execute o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

    A aplicação estará disponível em `http://localhost:5000`.

## Como Usar

A plataforma foi desenhada para ser intuitiva. Após a configuração, você pode:

1.  **Criar uma Nova Demanda**: Acesse a interface web, preencha o formulário com os detalhes da sua necessidade (título, descrição, tipo, etc.).
2.  **Importar do GitHub**: Utilize a funcionalidade de importação para trazer issues de um repositório diretamente para o fluxo de trabalho do AiChatFlow.
3.  **Acompanhar o Refinamento**: Observe o debate entre os agentes de IA na área de chat, vendo a demanda ser analisada e detalhada em tempo real.
4.  **Acessar os Documentos**: Uma vez que o refinamento é concluído, baixe os documentos gerados (PRD, Tasks) para iniciar o desenvolvimento.

## Contribuição

Contribuições são bem-vindas! Se você deseja melhorar o AiChatFlow, siga os passos:

1.  Faça um "fork" do projeto.
2.  Crie um branch para sua nova feature (`git checkout -b feature/minha-feature`).
3.  Implemente suas mudanças.
4.  Faça o commit das suas alterações (`git commit -m 'Adiciona minha feature'`).
5.  Envie para o seu fork (`git push origin feature/minha-feature`).
6.  Abra um Pull Request.

## Roadmap

-   [ ] Implementar testes unitários e de integração abrangentes.
-   [ ] Desenvolver um dashboard de métricas em tempo real.
-   [ ] Adicionar suporte a mais modelos de IA (OpenAI, Anthropic, etc.).
-   [ ] Criar um sistema de notificações para os usuários.
-   [ ] Documentar a API pública para integrações externas.
-   [ ] Integrar com outras ferramentas de gerenciamento de projetos (Jira, Asana).

## Licença

Este projeto está licenciado sob a Licença MIT.
