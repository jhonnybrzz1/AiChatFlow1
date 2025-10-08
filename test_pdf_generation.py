

import os
import time

# Simple PDF generation test
def generate_pdf_content(content, doc_type):
    """Generate a simple PDF content structure"""
    pdf_header = b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length 0 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n'

    pdf_footer = b'\nET\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000010 00000 n\n0000000059 00000 n\n0000000118 00000 n\n0000000200 00000 n\n0000000300 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF'

    # Simple text content
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    text_content = f"({doc_type} - {timestamp})".encode('utf-8') + b'\nTj\n100 680 Td\n'

    # Split content into lines and add to PDF
    content_lines = content.split('\n')
    content_buffer = b''

    y_position = 660
    for line in content_lines:
        if line.strip():
            line = line.replace('(', '\\(').replace(')', '\\)').replace('\\', '\\\\')
            line_buffer = f"100 {y_position} Td\n({line}) Tj\n".encode('utf-8')
            content_buffer += line_buffer
            y_position -= 14  # Move down for next line
            if y_position < 50:
                break  # Prevent overflow

    return pdf_header + text_content + content_buffer + pdf_footer

# Test content
test_content = """
# Test PRD Document

## 1. Visão Geral

**Funcionalidade:** Test PDF Generation
**Tipo:** Test
**Prioridade:** High

This is a test document to verify PDF generation works correctly.
"""

# Create documents directory if it doesn't exist
documents_dir = os.path.join(os.getcwd(), 'documents')
if not os.path.exists(documents_dir):
    os.makedirs(documents_dir)

# Generate test PDF
filename = f"test_pdf_{int(time.time())}.pdf"
filepath = os.path.join(documents_dir, filename)

try:
    pdf_content = generate_pdf_content(test_content, 'PRD')
    with open(filepath, 'wb') as f:
        f.write(pdf_content)
    print(f"PDF generated successfully: {filepath}")
except Exception as e:
    print(f"Error generating PDF: {e}")

