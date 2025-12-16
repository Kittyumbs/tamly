#!/usr/bin/env python3
"""
Script để lấy Google Refresh Token cho Google Drive API
Chỉ hiển thị token, không tự động lưu
Run: python get_refresh_token.py
"""

import os
import webbrowser
import http.server
import socketserver
from urllib.parse import parse_qs, urlparse
import requests

# Configuration
CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '1095185262237-qucee3m9nr0l0o7nge77nn36uv7676op.apps.googleusercontent.com')
CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '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')
REDIRECT_PORT = 8080
REDIRECT_URI = f'http://localhost:{REDIRECT_PORT}'

class OAuthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

        # Parse authorization code from URL
        query = urlparse(self.path).query
        params = parse_qs(query)

        if 'code' in params:
            auth_code = params['code'][0]
            print(f"\n✅ Nhận được authorization code: {auth_code[:20]}...")

            # Exchange for tokens
            tokens = exchange_code_for_tokens(auth_code)

            if tokens:
                refresh_token = tokens.get('refresh_token')
                if refresh_token:
                    print(f"\n🎉 GOOGLE REFRESH TOKEN:")
                    print(f"🔑 {refresh_token}")
                    print(f"\n📝 Copy token này vào file .env:")
                    print(f"GOOGLE_REFRESH_TOKEN={refresh_token}")
                    # Display success page
                    html_response = f'''<html>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    <h1 style="color: #4CAF50;">✅ Thành công!</h1>
    <p>Refresh token đã được tạo</p>
    <p><strong>Token:</strong> {refresh_token[:20]}...</p>
    <p>Kiểm tra console để copy full token</p>
    <p>Bạn có thể đóng cửa sổ này.</p>
</body>
</html>'''
                    self.wfile.write(html_response.encode('utf-8'))
                else:
                    error_html = '''<html>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    <h1 style="color: #f44336;">❌ Lỗi</h1>
    <p>Không nhận được refresh token. Vui lòng thử lại.</p>
</body>
</html>'''
                    self.wfile.write(error_html.encode('utf-8'))
            else:
                self.wfile.write('<h1>Lỗi khi exchange tokens</h1>'.encode('utf-8'))
        else:
            self.wfile.write('<h1>Không tìm thấy authorization code</h1>'.encode('utf-8'))

def exchange_code_for_tokens(auth_code):
    """Exchange authorization code for access and refresh tokens"""
    token_url = 'https://oauth2.googleapis.com/token'

    data = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code': auth_code,
        'grant_type': 'authorization_code',
        'redirect_uri': REDIRECT_URI
    }

    try:
        response = requests.post(token_url, data=data)
        response.raise_for_status()

        tokens = response.json()
        print("✅ Token exchange successful!")
        return tokens

    except requests.exceptions.RequestException as e:
        print(f"❌ Token exchange failed: {e}")
        return None

def main():
    print("🚀 Google OAuth Refresh Token Generator")
    print("=" * 50)

    # Check if credentials are set
    if CLIENT_ID == 'YOUR_GOOGLE_CLIENT_ID' or CLIENT_SECRET == 'YOUR_GOOGLE_CLIENT_SECRET':
        print("❌ Vui lòng set GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET")
        print("\nCách set:")
        print("export GOOGLE_CLIENT_ID=your_client_id")
        print("export GOOGLE_CLIENT_SECRET=your_client_secret")
        print("python get_refresh_token.py")
        return

    print(f"📋 Client ID: {CLIENT_ID[:20]}...")
    print(f"🌐 Redirect URI: {REDIRECT_URI}")

    # Create authorization URL
    auth_url = (
        'https://accounts.google.com/o/oauth2/auth?'
        f'client_id={CLIENT_ID}&'
        'redirect_uri=http://localhost:8080&'
        'scope=https://www.googleapis.com/auth/drive.file&'
        'response_type=code&'
        'access_type=offline&'
        'prompt=consent'
    )

    print(f"\n🔗 Authorization URL: {auth_url}")
    print("\n📝 Hướng dẫn:")
    print("1. Click vào URL trên hoặc copy vào browser")
    print("2. Đăng nhập Google account")
    print("3. Cho phép quyền truy cập Google Drive")
    print("4. Bạn sẽ được redirect về localhost:8080")
    print("5. Refresh token sẽ được hiển thị trong console")

    # Open browser
    try:
        webbrowser.open(auth_url)
        print("\n🌐 Đã mở browser. Nếu không mở được, copy URL vào browser thủ công.")
    except:
        print("\n🌐 Không thể mở browser tự động. Vui lòng copy URL vào browser.")

    # Start local server
    print(f"\n🖥️  Đang chạy local server trên port {REDIRECT_PORT}...")
    print("Chờ authorization code...")

    try:
        with socketserver.TCPServer(("", REDIRECT_PORT), OAuthHandler) as httpd:
            httpd.timeout = 300  # 5 minutes timeout
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️  Server stopped")
    except Exception as e:
        print(f"\n❌ Server error: {e}")

if __name__ == '__main__':
    main()
