# Email Receiving Setup with Resend

## Important Note

**Resend is a transactional email sending service** - it does NOT support receiving incoming emails directly. However, you can set up email receiving in the following ways:

## Option 1: Resend Webhooks (Email Events)

Resend can send webhooks for email events (bounces, opens, clicks, etc.), but not for receiving actual emails.

### Setup:

1. **In Resend Dashboard:**
   - Go to Settings > Webhooks
   - Add a new webhook endpoint: `https://yourdomain.com/api/webhooks/resend`
   - Select the events you want to receive (bounces, opens, clicks, etc.)

2. **Your server will receive:**
   - `email.sent` - When an email is sent
   - `email.delivered` - When email is delivered
   - `email.bounced` - When email bounces
   - `email.opened` - When email is opened
   - `email.clicked` - When links are clicked
   - `email.complained` - When marked as spam

## Option 2: Receive Incoming Emails (Using Another Service)

To actually receive incoming emails, you'll need to use a service that supports email receiving:

### Option A: Use Mailgun (Recommended for receiving)

1. Sign up at https://www.mailgun.com
2. Verify your domain
3. Set up email forwarding to your webhook endpoint
4. Configure webhook: `https://yourdomain.com/api/webhooks/incoming-email`

### Option B: Use SendGrid Inbound Parse

1. Sign up at https://sendgrid.com
2. Set up Inbound Parse webhook
3. Point to: `https://yourdomain.com/api/webhooks/incoming-email`

### Option C: Use Your Own Email Server

Set up an email server (Postfix, etc.) and forward emails to your webhook endpoint.

## Current Implementation

Your server now has:

1. **Resend Webhook Endpoint:** `/api/webhooks/resend`
   - Receives email events from Resend
   - Logs events to console

2. **Incoming Email Endpoint:** `/api/webhooks/incoming-email`
   - Receives actual incoming emails
   - Stores them in the `incoming_emails` database table
   - Can be called by any email service that supports webhooks

3. **Get Received Emails:** `/api/incoming-emails`
   - Returns the last 50 received emails
   - Useful for viewing received emails

## Testing

To test the incoming email endpoint:

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

## Next Steps

1. Set up Resend webhooks in your Resend dashboard
2. Choose an email receiving service (Mailgun, SendGrid, etc.)
3. Configure that service to forward emails to `/api/webhooks/incoming-email`
4. Make sure your server is publicly accessible (use ngrok or deploy to a server)

