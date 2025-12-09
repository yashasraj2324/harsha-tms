"""
Simple HTTP Server for RailGuard Dashboard
Serves the static HTML/CSS/JS files
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        SimpleHTTPRequestHandler.end_headers(self)

if __name__ == '__main__':
    os.chdir(os.path.dirname(__file__))
    server = HTTPServer(('0.0.0.0', 3001), CORSRequestHandler)
    print('=' * 60)
    print('🚂 RailGuard V2 Dashboard Server')
    print('=' * 60)
    print(f'Server running at: http://localhost:3001')
    print(f'Dashboard URL: http://localhost:3001/index.html')
    print('=' * 60)
    print('Press Ctrl+C to stop the server')
    print('=' * 60)
    server.serve_forever()
