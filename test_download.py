


import os
import http.server
import socketserver
import webbrowser
import time
import threading

# Simple HTTP server to test document download
PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/documents/'):
            # Extract filename from path
            filename = self.path.split('/')[-1]
            documents_dir = os.path.join(os.getcwd(), 'documents')
            filepath = os.path.join(documents_dir, filename)

            if os.path.exists(filepath):
                # Determine content type based on file extension
                if filepath.endswith('.pdf'):
                    content_type = 'application/pdf'
                elif filepath.endswith('.docx'):
                    content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                else:
                    content_type = 'text/plain'

                # Send headers
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()

                # Send file content
                with open(filepath, 'rb') as file:
                    self.wfile.write(file.read())
            else:
                self.send_error(404, "File not found")
        else:
            self.send_error(404, "Not found")

def run_server():
    """Run a simple HTTP server to test document downloads"""
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

def test_download():
    """Test document download functionality"""
    # Start server in a separate thread
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()

    # Wait for server to start
    time.sleep(1)

    # List available PDF documents
    documents_dir = os.path.join(os.getcwd(), 'documents')
    pdf_files = [f for f in os.listdir(documents_dir) if f.endswith('.pdf')]

    if not pdf_files:
        print("No PDF files found to test download")
        return

    print("Available PDF documents for testing:")
    for i, filename in enumerate(pdf_files[:5], 1):  # Show first 5 files
        print(f"{i}. {filename}")

    # Test download of first PDF file
    if pdf_files:
        test_file = pdf_files[0]
        print(f"\nTesting download of: {test_file}")
        print(f"Open this URL in your browser: http://localhost:{PORT}/api/documents/{test_file}")

        # Open browser automatically (if available)
        try:
            webbrowser.open(f"http://localhost:{PORT}/api/documents/{test_file}")
        except:
            print("Could not open browser automatically. Please copy the URL above to test manually.")

    # Keep server running for a while
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nServer stopped")

if __name__ == "__main__":
    test_download()


