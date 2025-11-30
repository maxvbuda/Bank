# HTTPS Setup Instructions

To enable HTTPS for your Red Diamond Bank server, follow these steps:

## Option 1: Let's Encrypt (Free SSL Certificate)

### For Production/Domain:

1. **Install Certbot:**
   ```bash
   # macOS
   brew install certbot
   
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install certbot
   ```

2. **Get Certificate:**
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
   ```

3. **Certificate Location:**
   - Private Key: `/etc/letsencrypt/live/yourdomain.com/privkey.pem`
   - Certificate: `/etc/letsencrypt/live/yourdomain.com/fullchain.pem`

4. **Update .env file:**
   ```
   USE_HTTPS=true
   HTTPS_PORT=443
   SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
   SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
   ```

## Option 2: Self-Signed Certificate (Development/Testing)

### Create Self-Signed Certificate:

1. **Create ssl directory:**
   ```bash
   mkdir ssl
   ```

2. **Generate certificate (macOS/Linux):**
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout ssl/private.key -out ssl/certificate.crt -days 365 -nodes
   ```

3. **When prompted:**
   - Country: (press Enter for default)
   - State: (press Enter for default)
   - City: (press Enter for default)
   - Organization: (press Enter for default)
   - Common Name: `localhost` (or your domain/IP)
   - Email: (optional, press Enter)

4. **Update .env file:**
   ```
   USE_HTTPS=true
   HTTPS_PORT=3443
   SSL_KEY_PATH=./ssl/private.key
   SSL_CERT_PATH=./ssl/certificate.crt
   ```

5. **Important:** Self-signed certificates will show a security warning in browsers. This is normal for development. Click "Advanced" and "Proceed" to continue.

## Option 3: Use Your Own Certificate

If you have SSL certificates from GoDaddy or another provider:

1. **Place your certificate files:**
   - Private key: `ssl/private.key`
   - Certificate: `ssl/certificate.crt`

2. **Update .env file:**
   ```
   USE_HTTPS=true
   HTTPS_PORT=3443
   SSL_KEY_PATH=./ssl/private.key
   SSL_CERT_PATH=./ssl/certificate.crt
   ```

## Configuration

Add to your `.env` file:

```
USE_HTTPS=true
HTTPS_PORT=3443
SSL_KEY_PATH=./ssl/private.key
SSL_CERT_PATH=./ssl/certificate.crt
PORT=3000
```

**Notes:**
- `USE_HTTPS=true` - Enable HTTPS server
- `HTTPS_PORT` - Port for HTTPS (default: 3443, production: 443)
- `SSL_KEY_PATH` - Path to your private key file
- `SSL_CERT_PATH` - Path to your certificate file
- `PORT` - HTTP server still runs on this port (default: 3000)

## After Setup

1. Restart your server
2. Access your app at:
   - HTTP: `http://localhost:3000`
   - HTTPS: `https://localhost:3443` (or your configured port)

## Troubleshooting

- **"Certificate not found"**: Make sure paths in `.env` are correct and files exist
- **"Permission denied"**: Make sure the server has read access to certificate files
- **Browser warning**: Self-signed certificates will always show warnings - this is normal for development
- **Port already in use**: Change `HTTPS_PORT` to a different port (e.g., 3443, 8443)

## Security Notes

- For production, always use certificates from a trusted CA (like Let's Encrypt)
- Keep your private key secure and never commit it to version control
- Add `ssl/` to your `.gitignore` file
- Use port 443 for production HTTPS (requires root/admin access)

