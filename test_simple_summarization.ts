




import { pdfGenerator } from './server/services/pdf-generator.ts';
import fs from 'fs';
import path from 'path';

async function testSimpleSummarization() {
  try {
    // Create test content with summarized information
    const prdContent = `
## 1. Visão Geral

**Nome do Projeto:** Test Project
**Data:** ${new Date().toLocaleDateString()}
**Versão:** 1.0

### 1.1 Objetivos
- Implementar funcionalidade principal
- Criar testes automatizados
- Documentar solução

### 1.2 Escopo
Descrição do escopo do projeto, incluindo o que está dentro e fora do escopo.

## 2. Requisitos Funcionais

### 2.1 Funcionalidades Principais
- **Funcionalidade 1:** Descrição detalhada
- **Funcionalidade 2:** Descrição detalhada
- **Funcionalidade 3:** Descrição detalhada

### 2.2 Fluxos de Usuário
Descrição dos fluxos de usuário principais, incluindo diagramas ou wireframes.

## 3. Requisitos Não Funcionais

### 3.1 Performance
- Tempo de resposta máximo: 2 segundos
- Capacidade de usuários simultâneos: 1000

### 3.2 Segurança
- Autenticação: OAuth 2.0
- Autorização: RBAC
- Criptografia: AES-256

### 3.3 Usabilidade
- Acessibilidade: WCAG 2.1
- Interface de usuário: Responsive design

## 4. Critérios de Aceitação

- Todos os testes unitários devem passar
- Performance deve estar dentro dos limites
- Interface deve ser acessível

## 5. Dependências e Riscos

### 5.1 Dependências
- API de pagamento
- Serviço de autenticação

### 5.2 Riscos
- **Risco 1:** Descrição e mitigação
- **Risco 2:** Descrição e mitigação

## 6. Cronograma

| Fase | Data de Início | Data de Término | Responsável |
|------|----------------|----------------|-------------|
| Planejamento | 2025-10-01 | 2025-10-07 | PM |
| Desenvolvimento | 2025-10-08 | 2025-10-21 | Dev Team |
| Testes | 2025-10-22 | 2025-10-28 | QA Team |
| Implantação | 2025-10-29 | 2025-10-31 | DevOps |

## 7. Aprovações

- **Product Owner:** John Doe
- **Tech Lead:** Jane Smith
- **Stakeholders:** Team Members

## 8. Resumo das Discussões dos Agentes

Resumo das discussões dos agentes:
- **Tech Lead:** A solução é viável com a arquitetura atual
- **UX:** Melhorar fluxo de navegação
- **QA:** Focar em performance, usabilidade e segurança
- **Scrum Master:** Definir incrementos claros

Detalhes dos agentes:
tech_lead: Analisando a viabilidade técnica da demanda. A solução parece factível com a arquitetura atual.
ux: Avaliação da experiência do usuário mostra que precisamos melhorar o fluxo de navegação.
qa: Identificando critérios de aceitação: performance, usabilidade e segurança.
scrum_master: Definindo incrementos e impacto no processo de desenvolvimento.
`;

    const tasksContent = `
## 1. Project Overview

**Project Name:** Test Project
**Date:** ${new Date().toLocaleDateString()}
**Version:** 1.0

## 2. Task Categories

### 2.1 Backend Tasks

- [ ] **Task 1:** Implement main API endpoints
  - **Assigned to:** Developer 1
  - **Due Date:** 2025-10-15
  - **Status:** Not Started

- [ ] **Task 2:** Create database schema
  - **Assigned to:** Developer 2
  - **Due Date:** 2025-10-12
  - **Status:** Not Started

- [ ] **Task 3:** Implement authentication system
  - **Assigned to:** Developer 3
  - **Due Date:** 2025-10-18
  - **Status:** Not Started

### 2.2 Frontend Tasks

- [ ] **Task 1:** Design user interface
  - **Assigned to:** Designer 1
  - **Due Date:** 2025-10-10
  - **Status:** Not Started

- [ ] **Task 2:** Implement form validation
  - **Assigned to:** Developer 4
  - **Due Date:** 2025-10-14
  - **Status:** Not Started

- [ ] **Task 3:** Add animations and transitions
  - **Assigned to:** Developer 5
  - **Due Date:** 2025-10-16
  - **Status:** Not Started

### 2.3 QA Tasks

- [ ] **Task 1:** Create test cases
  - **Assigned to:** QA 1
  - **Due Date:** 2025-10-11
  - **Status:** Not Started

- [ ] **Task 2:** Execute manual testing
  - **Assigned to:** QA 2
  - **Due Date:** 2025-10-19
  - **Status:** Not Started

- [ ] **Task 3:** Write automated tests
  - **Assigned to:** QA 3
  - **Due Date:** 2025-10-21
  - **Status:** Not Started

### 2.4 DevOps Tasks

- [ ] **Task 1:** Set up CI/CD pipeline
  - **Assigned to:** DevOps 1
  - **Due Date:** 2025-10-09
  - **Status:** Not Started

- [ ] **Task 2:** Configure deployment environment
  - **Assigned to:** DevOps 2
  - **Due Date:** 2025-10-13
  - **Status:** Not Started

- [ ] **Task 3:** Implement monitoring
  - **Assigned to:** DevOps 3
  - **Due Date:** 2025-10-20
  - **Status:** Not Started

## 3. Task Priorities

| Task ID | Task Name | Priority | Assigned To | Due Date | Status |
|--------|-----------|----------|-------------|----------|--------|
| T1 | Implement main API | High | Developer 1 | 2025-10-15 | Not Started |
| T2 | Design UI | Medium | Designer 1 | 2025-10-10 | Not Started |
| T3 | Write tests | High | QA 1 | 2025-10-11 | Not Started |

## 4. Dependencies

- **Task 1** depends on: Database schema
- **Task 2** depends on: API endpoints
- **Task 3** depends on: Authentication system

## 5. Approvals

- **Project Manager:** John Doe
- **Tech Lead:** Jane Smith
- **Stakeholders:** Team Members

## 6. Summary of Agent Discussions

Resumo das discussões dos agentes:
- **Tech Lead:** A solução é viável com a arquitetura atual
- **UX:** Melhorar fluxo de navegação
- **QA:** Focar em performance, usabilidade e segurança
- **Scrum Master:** Definir incrementos claros

Detalhes dos agentes:
tech_lead: Analisando a viabilidade técnica da demanda. A solução parece factível com a arquitetura atual.
ux: Avaliação da experiência do usuário mostra que precisamos melhorar o fluxo de navegação.
qa: Identificando critérios de aceitação: performance, usabilidade e segurança.
scrum_master: Definindo incrementos e impacto no processo de desenvolvimento.
`;

    // Generate PDFs
    const prdPdf = await pdfGenerator.generatePRDDocument(prdContent, 999);
    const tasksPdf = await pdfGenerator.generateTasksDocument(tasksContent, 999);

    // Save to documents directory
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const prdPath = path.join(documentsDir, 'summarized_prd.pdf');
    const tasksPath = path.join(documentsDir, 'summarized_tasks.pdf');

    fs.writeFileSync(prdPath, prdPdf);
    fs.writeFileSync(tasksPath, tasksPdf);

    console.log(`Summarized PRD generated at: ${prdPath}`);
    console.log(`Summarized Tasks generated at: ${tasksPath}`);
    console.log('Summarization test completed successfully!');
  } catch (error) {
    console.error('Error during summarization test:', error);
  }
}

testSimpleSummarization().then(() => {
  console.log('Test completed!');
}).catch(error => {
  console.error('Test failed:', error);
});




