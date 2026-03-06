import http.server
import socketserver
import os
import webbrowser
from urllib.parse import urlparse, parse_qs

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def do_GET(self):
        if self.path == '/sw.js' or self.path == '/firebase-messaging-sw.js':
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Service-Worker-Allowed', '/')
            self.end_headers()
            with open(self.path[1:], 'rb') as f:
                self.wfile.write(f.read())
            return
        
        if self.path == '/manifest.json':
            self.send_response(200)
            self.send_header('Content-Type', 'application/manifest+json')
            self.end_headers()
            with open('manifest.json', 'rb') as f:
                self.wfile.write(f.read())
            return
            
        return super().do_GET()

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("✅ AbSgram HD СЕРВЕР ЗАПУЩЕН")
print("=" * 50)
print(f"📱 Открой: http://localhost:{PORT}")
print("=" * 50)
print("🔔 Push-уведомления активированы")
print("=" * 50)

webbrowser.open(f"http://localhost:{PORT}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    httpd.serve_forever()