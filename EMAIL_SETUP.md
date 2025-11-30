# Email Setup Instructions

To enable email functionality for password resets, follow these steps:

## For Resend (Recommended):

1. **Set up Resend account:**
   - Sign up at https://resend.com
   - Get your API key from the dashboard
   - Add and verify your domain (follow Resend's DNS setup guide)

2. **Create .env file:**
   Create a file named `.env` in the root directory of this project with:

```
EMAIL_SERVICE=resend
EMAIL_USER=your_verified_email@yourdomain.com
EMAIL_PASS=re_your_api_key_here
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=587
```

3. Replace:
   - `your_verified_email@yourdomain.com` with your verified email address from Resend
   - `re_your_api_key_here` with your Resend API key (starts with `re_`)

**Note:** The EMAIL_USER should be an email address from your verified domain in Resend.

## For GoDaddy Email:

1. **Set up your GoDaddy email account:**
   - Log into your GoDaddy account
   - Go to "My Products" > "Email & Office" > "Manage All"
   - Create or use an existing Professional Email account
   - Note your email address and password

2. **Create .env file:**
   Create a file named `.env` in the root directory of this project with:

```
EMAIL_SERVICE=godaddy
EMAIL_HOST=smtpout.secureserver.net
EMAIL_PORT=465
EMAIL_USER=your_email@yourdomain.com
EMAIL_PASS=your_email_password
```

3. Replace:
   - `your_email@yourdomain.com` with your GoDaddy email address
   - `your_email_password` with your GoDaddy email password

**Port Information:**
- **Port 465**: SMTPS (SMTP over SSL/TLS) - Uses SSL encryption, secure connection (recommended for GoDaddy)
- **Port 587**: SMTP with STARTTLS - Uses TLS encryption after connection (also secure, modern standard)
- Port 80 is NOT for email - that's for HTTP web traffic

**Alternative GoDaddy SMTP settings:**
- If port 465 doesn't work, try port 587 (STARTTLS): Set `EMAIL_PORT=587`

## For Gmail:

1. Go to https://myaccount.google.com/apppasswords
2. Sign in with your Google account
3. Select "Mail" as the app and "Other" as the device
4. Enter "Red Diamond Bank" as the custom name
5. Click "Generate"
6. Copy the 16-character app password

**Gmail .env configuration:**
```
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## Testing:

After setting up your `.env` file, restart the server. You should see "Email service configured (GoDaddy SMTP)" or similar message in the console. If you see a warning, check that your `.env` file is in the correct location and has the right variable names.
