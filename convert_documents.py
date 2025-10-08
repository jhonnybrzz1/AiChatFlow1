


import os
import time

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

def convert_txt_to_pdf():
    """Convert all .txt documents in the documents directory to .pdf format"""
    documents_dir = os.path.join(os.getcwd(), 'documents')

    # Get all .txt files in the documents directory
    txt_files = [f for f in os.listdir(documents_dir) if f.endswith('.txt')]

    if not txt_files:
        print("No .txt files found to convert")
        return

    print(f"Found {len(txt_files)} .txt files to convert")

    for txt_file in txt_files:
        txt_filepath = os.path.join(documents_dir, txt_file)

        try:
            # Read the content of the .txt file
            with open(txt_filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Determine the document type (PRD or Tasks)
            doc_type = 'PRD' if 'PRD' in txt_file else 'Tasks'

            # Generate PDF filename
            pdf_filename = txt_file.replace('.txt', '.pdf')
            pdf_filepath = os.path.join(documents_dir, pdf_filename)

            # Generate PDF content
            pdf_content = generate_pdf_content(content, doc_type)

            # Write PDF file
            with open(pdf_filepath, 'wb') as pdf_f:
                pdf_f.write(pdf_content)

            print(f"Converted: {txt_file} -> {pdf_filename}")

        except Exception as e:
            print(f"Error converting {txt_file}: {e}")

    print("Conversion complete!")

if __name__ == "__main__":
    convert_txt_to_pdf()


