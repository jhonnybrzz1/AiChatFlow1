
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
-   **Inteligência Artificial**: OpenAI
-   **Banco de Dados**: SQLite (via Drizzle ORM)
-   **Integrações**: GitHub API, PDF-lib

## Núcleo Cognitivo do AICHATflow

O **Núcleo Cognitivo do AICHATflow** é um sistema automatizado que otimiza o processamento de demandas através de dois módulos principais:

### 1. Classificador Inteligente de Demanda

Analisa e categoriza demandas com base em critérios como:

-   **Ambiguidade**: Medida de quão vaga ou clara é a demanda
-   **Risco de Interpretação**: Potencial para mal-entendidos
-   **Profundidade Necessária**: Nível de análise requerido
-   **Complexidade**: Escopo técnico e desafios
-   **Urgência**: Prioridade e sensibilidade temporal

**Categorias Suportadas**:
-   Técnica (API, banco de dados, integração)
-   Jurídica (contratos, conformidade, regulamentações)
-   Criativa (design, UX, branding)
-   Negócios (estratégia, mercado, vendas)
-   Analítica (dados, métricas, insights)
-   Suporte (ajuda, bugs, resolução de problemas)
-   Pesquisa (estudos, exploração, investigação)

### 2. Orquestrador de Agentes

Define a ordem ótima de execução dos agentes especializados e aplica validação cruzada em casos críticos:

-   **Sequenciamento Inteligente**: Ordena agentes com base nos requisitos da demanda
-   **Validação Cruzada**: Valida resultados para demandas de alto risco
-   **Estimativa de Tempo**: Prediz tempo de conclusão baseado na complexidade
-   **Monitoramento em Tempo Real**: Acompanha progresso e fornece atualizações

### Benefícios

1.  **Precisão Aprimorada**: Classificação inteligente reduz erros de roteamento
2.  **Fluxo de Trabalho Otimizado**: Agentes executam na ordem ideal
3.  **Redução de Riscos**: Validação cruzada para demandas críticas
4.  **Eficiência Temporal**: Melhor alocação de recursos e sequenciamento
5.  **Adaptabilidade**: Ajusta-se a diferentes tipos e complexidades de demanda
6.  **Transparência**: Notas claras de classificação e orquestração

### Endpoints da API

-   **POST** `/api/demands/cognitive` - Cria demanda com processamento cognitivo
-   **GET** `/api/demands/:id/classification` - Obtém classificação da demanda
-   **GET** `/api/demands/:id/orchestration` - Obtém plano de orquestração

Para mais detalhes, consulte a [documentação completa do Núcleo Cognitivo](COGNITIVE_CORE.md).

## Frameworks de Gestão de Demandas

O AICHATflow inclui um **Framework Manager** com 6 frameworks especializados para diferentes tipos de demandas:

### 1. Jobs-to-be-Done (JTBD)

**Melhor para:** Novas funcionalidades, desenvolvimento centrado no cliente

**Descrição:** Framework para entender os "trabalhos" que os clientes precisam realizar e projetar soluções que atendam às necessidades reais.

**Métricas de Sucesso:**
-   Taxa de conclusão de trabalhos
-   Satisfação do cliente
-   Tempo para conclusão

**Integrações:** SurveyMonkey, Typeform, ferramentas de pesquisa

### 2. HEART Framework

**Melhor para:** Melhorias de UX, métricas de experiência do usuário

**Descrição:** Framework de métricas de UX focado em Felicidade, Engajamento, Adoção, Retenção e Sucesso de Tarefas.

**Métricas de Sucesso:**
-   Pontuações de usabilidade
-   Conformidade de acessibilidade
-   Sentimento de feedback do usuário

**Integrações:** Google Analytics, Hotjar, Mixpanel

### 3. Matriz de Severidade x Prioridade

**Melhor para:** Triagem de bugs, priorização de issues

**Descrição:** Matriz para priorizar bugs com base em severidade (impacto) e prioridade (urgência) com SLAs claros.

**Métricas de Sucesso:**
-   Tempo de resolução
-   Taxa de reabertura
-   Redução de impacto no cliente

**Integrações:** Jira, Bugzilla, Sentry

### 4. Double Diamond

**Melhor para:** Discovery, design thinking, inovação

**Descrição:** Framework de design thinking com fases de Descoberta, Definição, Desenvolvimento e Entrega.

**Métricas de Sucesso:**
-   Insights gerados
-   Entrevistas com usuários
-   Profundidade de pesquisa
-   Taxa de validação de protótipos

**Integrações:** Miro, Figma, UserTesting

### 5. CRISP-DM

**Melhor para:** Análise de dados, machine learning, analytics exploratório

**Descrição:** Metodologia para projetos de ciência de dados com fases de Compreensão de Negócios, Dados, Preparação, Modelagem, Avaliação e Implantação.

**Métricas de Sucesso:**
-   Precisão do modelo
-   Cobertura de dados
-   Valor dos insights
-   Impacto nos negócios

**Integrações:** Snowflake, BigQuery, TensorFlow, Tableau

### 6. Sugestão Automática de Frameworks (Transversal)

**Melhor para:** Todos os tipos de demanda, recomendação inteligente

**Descrição:** Framework com IA que analisa características da demanda e recomenda o framework mais adequado com pontuação de confiança.

**Métricas de Sucesso:**
-   Precisão da recomendação
-   Taxa de adoção
-   Satisfação do usuário com sugestões

**Integrações:** OpenAI, bases de conhecimento

### Seleção de Frameworks

| Tipo de Demanda | Framework Primário | Opções Secundárias | Racional |
|-----------------|-------------------|--------------------|----------|
| Nova Funcionalidade | JTBD | Double Diamond, HEART | Abordagem centrada no cliente |
| Melhoria | HEART | JTBD, CRISP-DM | Métricas focadas em UX |
| Bug | Severity-Priority | JTBD, HEART | Priorização clara de issues |
| Discovery | Double Diamond | JTBD, HEART | Pesquisa exploratória |
| Análise | CRISP-DM | Double Diamond, JTBD | Abordagem orientada por dados |

### Endpoints da API

-   **GET** `/api/frameworks` - Lista todos os frameworks disponíveis
-   **GET** `/api/frameworks/:id` - Obtém detalhes de um framework específico
-   **GET** `/api/demands/:id/framework-recommendation` - Recomendação de framework com IA
-   **POST** `/api/demands/:id/frameworks/:frameworkId/execute` - Executa um framework para uma demanda
-   **GET** `/api/demands/:id/framework-executions` - Histórico de execuções de frameworks
-   **GET** `/api/frameworks/metrics` - Métricas de desempenho dos frameworks

Para mais detalhes, consulte a [documentação completa dos Frameworks](FRAMEWORKS.md).

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
    - Preencha as variáveis obrigatórias, como `OPENAI_API_KEY`.

    ```env
    # .env
    OPENAI_API_KEY="sua_chave_da_openai"
    PORT=5000
    # Outras variáveis...
    ```

4.  **Execute o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

    Com `PORT=5000`, a aplicação estará disponível em `http://localhost:5000`. Se `PORT` não for definido, o servidor escolhe uma porta livre e imprime a URL no log.

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
-   [ ] Adicionar suporte a mais modelos de IA (Anthropic, Mistral, etc.).
-   [ ] Criar um sistema de notificações para os usuários.
-   [ ] Documentar a API pública para integrações externas.
-   [ ] Integrar com outras ferramentas de gerenciamento de projetos (Jira, Asana).

## Licença

Este projeto está licenciado sob a Licença MIT.
