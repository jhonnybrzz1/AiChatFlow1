




import { aiSquadService } from './server/services/ai-squad.ts';
import { pdfGenerator } from './server/services/pdf-generator.ts';
import fs from 'fs';
import path from 'path';

async function testSummarization() {
  try {
    // Create a mock demand
    const mockDemand = {
      id: 123,
      title: 'Test Demand',
      description: 'This is a test demand for verifying summarization functionality',
      type: 'nova_funcionalidade',
      priority: 'alta'
    };

    // Create mock agent messages
    const mockMessages = [
      {
        id: '1',
        agent: 'tech_lead',
        message: 'Analisando a viabilidade técnica da demanda. A solução parece factível com a arquitetura atual.',
        timestamp: new Date().toISOString(),
        type: 'completed'
      },
      {
        id: '2',
        agent: 'ux',
        message: 'Avaliação da experiência do usuário mostra que precisamos melhorar o fluxo de navegação.',
        timestamp: new Date().toISOString(),
        type: 'completed'
      },
      {
        id: '3',
        agent: 'qa',
        message: 'Identificando critérios de aceitação: performance, usabilidade e segurança.',
        timestamp: new Date().toISOString(),
        type: 'completed'
      },
      {
        id: '4',
        agent: 'scrum_master',
        message: 'Definindo incrementos e impacto no processo de desenvolvimento.',
        timestamp: new Date().toISOString(),
        type: 'completed'
      }
    ];

    // Test summarization
    const summary = await aiSquadService.summarizeAgentDiscussions(mockDemand, mockMessages);
    console.log('Generated summary:');
    console.log(summary);

    // Test document generation with summarization
    const { prdContent, tasksContent } = await aiSquadService.generateDocuments(mockDemand, mockMessages);

    console.log('\nGenerated PRD content:');
    console.log(prdContent);

    console.log('\nGenerated Tasks content:');
    console.log(tasksContent);

    // Generate PDFs
    const prdPdf = await pdfGenerator.generatePRDDocument(prdContent, mockDemand.id);
    const tasksPdf = await pdfGenerator.generateTasksDocument(tasksContent, mockDemand.id);

    // Save to documents directory
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const prdPath = path.join(documentsDir, 'summarized_prd.pdf');
    const tasksPath = path.join(documentsDir, 'summarized_tasks.pdf');

    fs.writeFileSync(prdPath, prdPdf);
    fs.writeFileSync(tasksPath, tasksPdf);

    console.log(`\nSummarized PRD generated at: ${prdPath}`);
    console.log(`Summarized Tasks generated at: ${tasksPath}`);
    console.log('Summarization test completed successfully!');
  } catch (error) {
    console.error('Error during summarization test:', error);
  }
}

testSummarization().then(() => {
  console.log('Test completed!');
}).catch(error => {
  console.error('Test failed:', error);
});




