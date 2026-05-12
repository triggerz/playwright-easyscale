# Test Application

A simple static web application designed for testing Playwright EasyScale distributed testing framework.

## Overview

This is a minimal web application that simulates a login/dashboard flow without requiring a backend. It's specifically designed to work with the example Playwright tests in the `worker/tests/` directory.

## Features

- **Login Page** (`/`) - Accepts any email/password combination
- **Dashboard Page** (`/dashboard.html`) - Protected page that requires "authentication"
- **Client-side Session** - Uses localStorage to simulate authentication
- **No Backend Required** - Pure static HTML/CSS/JavaScript

## How It Works

1. User enters any email/password on the login page
2. JavaScript stores session data in localStorage
3. User is redirected to dashboard
4. Dashboard displays user info from session
5. Logout clears session and redirects to login

## Local Development

### Run with Docker

```bash
# Build the image
docker build -t test-app .

# Run the container
docker run -p 8080:80 test-app

# Open in browser
open http://localhost:8080
```

### Run with any static file server

```bash
# Using Python
python -m http.server 8080

# Using Node.js http-server
npx http-server -p 8080

# Using PHP
php -S localhost:8080
```

## Railway Deployment

This app is designed to be deployed as a separate Railway service:

1. **Create a new service** in your Railway project
2. **Connect this directory** as the source
3. **Railway will auto-detect** the Dockerfile
4. **Get the public URL** from Railway (e.g., `https://test-app-production-xxxx.up.railway.app`)
5. **Use the URL** in your test configurations

### Environment Variables

The app itself doesn't need any environment variables. However, you'll use the Railway-provided `RAILWAY_PUBLIC_DOMAIN` in your test configurations:

```json
{
  "environment": {
    "LOGIN_URL": "https://${RAILWAY_PUBLIC_DOMAIN}",
    "DASHBOARD_URL": "https://${RAILWAY_PUBLIC_DOMAIN}/dashboard.html"
  }
}
```

## Testing Compatibility

This app is compatible with all example tests:

- ✅ `example.spec.js` - Basic login test
- ✅ `complete-example.spec.js` - Full workflow test
- ✅ `example-with-metadata.spec.js` - Parameterized test

### Expected Test Flow

1. Navigate to login URL
2. Fill `input[name="email"]` with test email
3. Fill `input[name="password"]` with any password
4. Click `button[type="submit"]`
5. Wait for redirect to `/dashboard.html`
6. Verify URL matches `/dashboard|home/` pattern

## File Structure

```
test-app/
├── index.html          # Login page
├── dashboard.html      # Dashboard page
├── app.js             # Client-side logic
├── styles.css         # Styling
├── nginx.conf         # Nginx configuration
├── Dockerfile         # Container definition
└── README.md          # This file
```

## Technical Details

- **Server**: Nginx Alpine (minimal footprint)
- **Size**: ~10MB Docker image
- **Port**: 80 (mapped to Railway's public port)
- **Health Check**: `/health` endpoint
- **Session Storage**: Browser localStorage
- **Authentication**: Client-side only (for testing purposes)

## Security Note

⚠️ **This is a test application only!** 

- No real authentication
- No backend validation
- Accepts any credentials
- Not suitable for production use
- Designed solely for Playwright testing

## Cost Estimate

When deployed to Railway:
- **Idle**: ~$0.01/day (minimal resources)
- **During tests**: ~$0.02-0.05 per test run
- **Total**: Very minimal cost for testing purposes

## Support

This app is part of the Playwright EasyScale project. For issues or questions:
- See main [README](../README.md)
- Check [SETUP.md](../docs/SETUP.md)
- Open an issue on GitHub
