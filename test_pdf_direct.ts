


import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function testPDFGeneration() {
  try {
    // Create a new PDFDocument
    const pdfDoc = await PDFDocument.create();

    // Embed the Helvetica font
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add a page to the document
    const page = pdfDoc.addPage([612, 792]); // Letter size: 8.5" x 11" (612 x 792 points)

    const { width, height } = page.getSize();
    const margin = 50;

    // Draw header
    page.drawRectangle({
      x: 50,
      y: height - 100,
      width: 60,
      height: 60,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });

    page.drawText('AICHATflow', {
      x: 120,
      y: height - 60,
      size: 24,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText('Test PRD Document', {
      x: 50,
      y: height - 120,
      size: 18,
      font: helveticaBoldFont,
      color: rgb(0.2, 0.4, 0.6),
    });

    page.drawText('Demand ID: 999', {
      x: 50,
      y: height - 140,
      size: 12,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: height - 160,
      size: 12,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Draw separator line
    page.drawLine({
      start: { x: 50, y: height - 180 },
      end: { x: width - 50, y: height - 180 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Draw content
    const content = `
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

    const lines = content.split('\n');
    let yPosition = height - 200;

    for (const line of lines) {
      if (line.trim() === '') continue;

      if (line.trim().startsWith('##')) {
        const headingText = line.replace(/^#+\s*/, '').trim();
        page.drawText(headingText, {
          x: margin,
          y: yPosition,
          size: 16,
          font: helveticaBoldFont,
          color: rgb(0.2, 0.4, 0.6),
        });
        yPosition -= 20;
      } else if (line.trim().startsWith('-')) {
        const taskText = line.trim();
        page.drawText('• ' + taskText, {
          x: margin,
          y: yPosition,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 14;
      } else {
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 14;
      }

      if (yPosition < margin) break;
    }

    // Draw footer
    page.drawLine({
      start: { x: 50, y: 50 },
      end: { x: width - 50, y: 50 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText('AICHATflow - Confidential Document', {
      x: 50,
      y: 30,
      size: 10,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText('Page 1', {
      x: width - 100,
      y: 30,
      size: 10,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Serialize the PDFDocument to bytes
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Save to file
    const documentsDir = path.join(process.cwd(), 'documents');
    if (!fs.existsSync(documentsDir)) {
      fs.mkdirSync(documentsDir, { recursive: true });
    }

    const outputPath = path.join(documentsDir, 'test_direct.pdf');
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log(`PDF generated successfully at: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

testPDFGeneration().then(() => {
  console.log('PDF generation test completed!');
}).catch(error => {
  console.error('Test failed:', error);
});

