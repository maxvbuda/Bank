# How to Configure Resend Webhooks - Step by Step Guide

## Step 1: Set Up Resend Webhooks (Email Events)

Resend webhooks let you receive notifications about email events (sent, delivered, opened, bounced, etc.).

### 1.1 Get Your Public URL

First, you need to make your server accessible from the internet. You have two options:

#### Option A: Using ngrok (for testing/development)

1. **Install ngrok:**
   ```bash
   # On Mac
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000
   ```

3. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)
   - You'll use this URL in Resend webhook configuration

#### Option B: Deploy to a server (for production)

- Deploy your server to a hosting service (Heroku, Railway, DigitalOcean, etc.)
- Use your production URL (e.g., `https://yourdomain.com`)

### 1.2 Configure Webhook in Resend Dashboard

1. **Log into Resend:**
   - Go to https://resend.com
   - Sign in to your account

2. **Navigate to Webhooks:**
   - Click on "Settings" in the left sidebar
   - Click on "Webhooks"
   - Click "Add Webhook" button

3. **Configure the Webhook:**
   - **Description:** Enter "Red Diamond Bank Email Events"
   - **Endpoint URL:** Enter your public URL + `/api/webhooks/resend`
     - Example: `https://abc123.ngrok.io/api/webhooks/resend`
     - Or: `https://yourdomain.com/api/webhooks/resend`
   
4. **Select Events to Receive:**
   - ✅ `email.sent` - When an email is sent
   - ✅ `email.delivered` - When email is successfully delivered
   - ✅ `email.delivery_delayed` - When delivery is delayed
   - ✅ `email.complained` - When email is marked as spam
   - ✅ `email.bounced` - When email bounces
   - ✅ `email.opened` - When email is opened
   - ✅ `email.clicked` - When links in email are clicked

5. **Click "Save" or "Create Webhook"**

6. **Copy the Signing Secret:**
   - After creating, you'll see a "Signing Secret"
   - Add this to your `.env` file as `RESEND_WEBHOOK_SECRET`

### 1.3 Update Your .env File

Add this line to your `.env` file:
```
RESEND_WEBHOOK_SECRET=your_signing_secret_here
```

### 1.4 Verify Webhook is Working

1. Send a test email through your application
2. Check your server logs - you should see webhook events being logged
3. Go back to Resend dashboard > Webhooks > Your webhook
4. You should see recent events being delivered

---

## Step 2: Set Up Actual Email Receiving (Optional)

If you want to receive actual incoming emails (not just events), you'll need a service that supports email receiving.

### Option A: Mailgun (Recommended)

1. **Sign up at Mailgun:**
   - Go to https://www.mailgun.com
   - Create a free account (includes 5,000 emails/month)

2. **Verify Your Domain:**
   - Add your domain in Mailgun dashboard
   - Add the DNS records they provide to your domain

3. **Set Up Inbound Routing:**
   - Go to "Receiving" > "Routes" in Mailgun dashboard
   - Click "Create Route"
   - **Expression:** `match_recipient(".*@yourdomain.com")`
   - **Actions:** Forward to webhook: `https://yourdomain.com/api/webhooks/incoming-email`

4. **Test it:**
   - Send an email to `anything@yourdomain.com`
   - It will be forwarded to your webhook endpoint

### Option B: Use Your GoDaddy Email

If you have GoDaddy email already set up, you can:

1. Set up email forwarding in GoDaddy to forward to a service that supports webhooks
2. Or use IMAP to periodically check for new emails

---

## Step 3: Test Your Setup

### Test Resend Webhooks:

```bash
# Send a test email through your app (forgot password)
# Check server logs for webhook events
tail -f server.log | grep "Resend webhook"
```

### Test Incoming Email:

```bash
curl -X POST http://localhost:3000/api/webhooks/incoming-email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "to": "support@yourdomain.com",
    "subject": "Test Email",
    "text": "This is a test email"
  }'
```

Then check:
```bash
curl http://localhost:3000/api/incoming-emails
```

---

## Troubleshooting

**Webhooks not working?**
- Make sure your server is publicly accessible (using ngrok or deployed)
- Check that the URL in Resend matches exactly (including `/api/webhooks/resend`)
- Check server logs for errors

**Incoming emails not working?**
- Make sure your email receiving service (Mailgun, etc.) is configured correctly
- Check that DNS records are properly set up
- Verify the webhook URL is accessible

---

## Current Status

Your server is ready to receive:
- ✅ Resend webhooks at: `/api/webhooks/resend`
- ✅ Incoming emails at: `/api/webhooks/incoming-email`
- ✅ View emails at: `/api/incoming-emails`

Just need to configure the webhook in Resend dashboard!

