

import fs from 'fs';
import path from 'path';

function generatePdfContent(content: string, type: string): Buffer {
  // Simple PDF generation - this is a basic approach that creates a minimal PDF structure
  // This is a minimal PDF header and content structure
  const pdfHeader = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 0 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n');

  const pdfFooter = Buffer.from('\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000010 00000 n\n0000000059 00000 n\n0000000118 00000 n\n0000000200 00000 n\n0000000300 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF');

  // Simple text content - in a real implementation, this would be properly formatted
  const textContent = Buffer.from(`(${type} - ${new Date().toISOString()})\nTj\n100 680 Td\n`);

  // Split content into lines and add to PDF
  const contentLines = content.split('\n');
  let contentBuffer = Buffer.alloc(0);

  let yPosition = 660;
  for (const line of contentLines) {
    if (line.trim()) {
      const lineBuffer = Buffer.from(`100 ${yPosition} Td\n(${escapePdfString(line)}) Tj\n`);
      contentBuffer = Buffer.concat([contentBuffer, lineBuffer]);
      yPosition -= 14; // Move down for next line
      if (yPosition < 50) break; // Prevent overflow
    }
  }

  return Buffer.concat([pdfHeader, textContent, contentBuffer, pdfFooter]);
}

function escapePdfString(str: string): string {
  // Escape special characters for PDF
  return str.replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\\/g, '\\\\');
}

// Test the PDF generation
const testContent = `
# Test PRD Document

## 1. Visão Geral

**Funcionalidade:** Test PDF Generation
**Tipo:** Test
**Prioridade:** High

This is a test document to verify PDF generation works correctly.
`;

const documentsDir = path.join(process.cwd(), 'documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

const filename = `test_pdf_${Date.now()}.pdf`;
const filepath = path.join(documentsDir, filename);

try {
  const pdfContent = generatePdfContent(testContent, 'PRD');
  fs.writeFileSync(filepath, pdfContent);
  console.log(`PDF generated successfully: ${filepath}`);
} catch (error) {
  console.error('Error generating PDF:', error);
}

