# How to Configure Email Receiving - Quick Start Guide

## Understanding Email Receiving Options

There are two types of email receiving you can set up:

1. **Email Events** (via Resend Webhooks) - Notifications about emails you send (opened, clicked, bounced, etc.)
2. **Incoming Emails** (via another service) - Actual emails sent TO your domain

---

## Part 1: Set Up Resend Webhooks (Email Events)

This lets you track what happens to emails you send (opened, clicked, bounced, etc.)

### Step-by-Step:

#### Step 1: Make Your Server Publicly Accessible

**For Development/Testing (Use ngrok):**

1. Install ngrok:
   ```bash
   brew install ngrok
   # Or download from: https://ngrok.com/download
   ```

2. In a new terminal, run:
   ```bash
   ngrok http 3000
   ```

3. Copy the HTTPS URL (looks like: `https://abc123-def456.ngrok.io`)
   - Keep this terminal running!

**For Production:**
- Deploy your server to a hosting service
- Use your production URL (e.g., `https://yourdomain.com`)

#### Step 2: Configure Webhook in Resend

1. **Go to Resend Dashboard:**
   - Visit https://resend.com
   - Log in

2. **Navigate to Webhooks:**
   - Click "Settings" (left sidebar)
   - Click "Webhooks"
   - Click "Add Webhook" or "Create Webhook"

3. **Fill in the Webhook Form:**
   - **Description:** `Red Diamond Bank Events`
   - **Endpoint URL:** 
     - Development: `https://your-ngrok-url.ngrok.io/api/webhooks/resend`
     - Production: `https://yourdomain.com/api/webhooks/resend`
   
4. **Select Events:**
   Check these boxes:
   - ✅ Email sent
   - ✅ Email delivered
   - ✅ Email bounced
   - ✅ Email opened
   - ✅ Email clicked
   - ✅ Email complained

5. **Save the Webhook**

6. **Copy the Signing Secret:**
   - After saving, you'll see a "Signing Secret"
   - Copy it

#### Step 3: Add Signing Secret to Your .env File

Edit your `.env` file and add:
```
RESEND_WEBHOOK_SECRET=paste_your_signing_secret_here
```

#### Step 4: Test It

1. Send a password reset email through your app
2. Check your server logs - you should see webhook events
3. In Resend dashboard, check the webhook - you should see recent events

---

## Part 2: Set Up Actual Incoming Email Receiving

To receive actual emails sent TO your domain (not just events), use Mailgun:

### Step-by-Step:

#### Step 1: Sign Up for Mailgun

1. Go to https://www.mailgun.com
2. Sign up for a free account (5,000 emails/month free)
3. Verify your email address

#### Step 2: Add Your Domain in Mailgun

1. In Mailgun dashboard, go to "Sending" > "Domains"
2. Click "Add New Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Choose "For Receiving" or "For Sending and Receiving"
5. Click "Add Domain"

#### Step 3: Verify Your Domain

Mailgun will show DNS records you need to add:

1. Go to your GoDaddy DNS settings
2. Add the DNS records Mailgun shows you (MX, TXT, CNAME)
3. Wait for DNS to propagate (usually 5-30 minutes)
4. Click "Verify DNS Settings" in Mailgun

#### Step 4: Set Up Inbound Route (Forward Emails to Your Server)

1. In Mailgun dashboard, go to "Receiving" > "Routes"
2. Click "Create Route"
3. Configure the route:
   - **Route Name:** `Forward to Bank App`
   - **Expression:** 
     ```
     match_recipient(".*@yourdomain.com")
     ```
   - **Action:** Click "Add Action" > "Forward"
   - **Forward to:** Your webhook URL:
     - Development: `https://your-ngrok-url.ngrok.io/api/webhooks/incoming-email`
     - Production: `https://yourdomain.com/api/webhooks/incoming-email`
4. Click "Create Route"

#### Step 5: Test Incoming Emails

1. Send an email to `test@yourdomain.com` (or any email at your domain)
2. Check your server logs - you should see the email received
3. Check the database:
   ```bash
   curl http://localhost:3000/api/incoming-emails
   ```

---

## Quick Reference

### Your Webhook Endpoints:

- **Resend Events:** `https://your-url/api/webhooks/resend`
- **Incoming Emails:** `https://your-url/api/webhooks/incoming-email`
- **View Received:** `https://your-url/api/incoming-emails`

### Testing Commands:

**Test incoming email endpoint:**
```bash
curl -X POST http://localhost:3000/api/webhooks/incoming-email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "to": "support@yourdomain.com",
    "subject": "Test Email",
    "text": "Hello, this is a test!"
  }'
```

**View received emails:**
```bash
curl http://localhost:3000/api/incoming-emails
```

---

## Troubleshooting

**Webhooks not working?**
- ✅ Make sure ngrok is running (if testing locally)
- ✅ Check the URL in Resend matches exactly
- ✅ Check server logs for errors
- ✅ Make sure your server is running

**Incoming emails not working?**
- ✅ Verify DNS records are added correctly
- ✅ Wait for DNS propagation (can take up to 48 hours, usually 5-30 min)
- ✅ Check Mailgun route is configured correctly
- ✅ Check server logs when you send a test email

**Need help?**
- Check server logs: `tail -f server.log`
- Check Resend dashboard for webhook delivery status
- Check Mailgun dashboard for route logs

