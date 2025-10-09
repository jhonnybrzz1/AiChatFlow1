

import { pdfGenerator } from './server/services/pdf-generator.js';
import fs from 'fs';
import path from 'path';

async function testPDFGeneration() {
  const testContent = `
# Test PRD Document

## 1. Visão Geral

**Funcionalidade:** Test PDF Generation
**Tipo:** Test
**Prioridade:** High

This is a test document to verify PDF generation works correctly.

## 2. Requisitos Funcionais

- Implementar funcionalidade principal
- Criar testes automatizados
- Documentar solução

## 3. Requisitos Não Funcionais

- Performance: < 2s response time
- Security: Data encryption
`;

  const tasksContent = `
# Test Tasks Document

## 🔧 Backend Tasks

- [ ] Implementar API principal
- [ ] Criar testes unitários
- [ ] Configurar banco de dados

## 🎨 Frontend Tasks

- [ ] Criar interface de usuário
- [ ] Implementar validação de formulário
- [ ] Adicionar animações
`;

  try {
    // Test PRD generation
    const prdPdf = await pdfGenerator.generatePRDDocument(testContent, 123);
    const prdPath = path.join(process.cwd(), 'documents', 'test_prd.pdf');
    fs.writeFileSync(prdPath, prdPdf);
    console.log(`PRD PDF generated at: ${prdPath}`);

    // Test Tasks generation
    const tasksPdf = await pdfGenerator.generateTasksDocument(tasksContent, 123);
    const tasksPath = path.join(process.cwd(), 'documents', 'test_tasks.pdf');
    fs.writeFileSync(tasksPath, tasksPdf);
    console.log(`Tasks PDF generated at: ${tasksPath}`);

    console.log('PDF generation test completed successfully!');
  } catch (error) {
    console.error('Error during PDF generation test:', error);
  }
}

testPDFGeneration();

