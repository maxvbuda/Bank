# Stripe Payment Setup Instructions

## Quick Setup

1. **Create a Stripe Account** (if you don't have one)
   - Go to https://stripe.com
   - Sign up for a free account
   - Verify your email

2. **Get Your API Keys**
   - Go to https://dashboard.stripe.com/test/apikeys
   - Make sure you're in "Test mode" (toggle in the top right)
   - You'll see two keys:
     - **Publishable key** (starts with `pk_test_`)
     - **Secret key** (starts with `sk_test_`) - click "Reveal" to see it

3. **Add Keys to .env File**
   - Open the `.env` file in your project
   - Add or update these lines:
     ```
     STRIPE_SECRET_KEY=sk_test_your_secret_key_here
     STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
     ```
   - **Important**: 
     - Copy the ENTIRE key (they're long!)
     - Don't add any spaces or quotes around the keys
     - Don't add any extra characters
     - Each key should be on its own line

4. **Restart the Server**
   - Stop your server (Ctrl+C)
   - Start it again: `node server.js`
   - You should see: "✅ Stripe payment processing enabled"

## Common Issues

### "Invalid API Key provided"
- **Solution**: Your API key is incorrect or incomplete
- Make sure you copied the ENTIRE key from Stripe Dashboard
- Check that there are no extra spaces or characters
- Verify you're using TEST keys (for development) or LIVE keys (for production)
- Make sure both keys are from the same Stripe account

### "Stripe not configured"
- **Solution**: The keys aren't being loaded
- Check your `.env` file exists in the project root
- Verify the variable names are exactly: `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`
- Restart the server after adding/updating keys

### Keys not working
- Make sure you're using TEST keys for testing (starts with `sk_test_` and `pk_test_`)
- For production, you need LIVE keys (starts with `sk_live_` and `pk_live_`)
- Test and Live keys are different - you can't mix them

## Testing with Test Cards

### Successful Payment Test Card
- **Card Number**: `4242 4242 4242 4242`
- **Expiry Date**: Any future date (e.g., `12/25`, `01/26`)
- **CVC**: Any 3 digits (e.g., `123`, `999`)
- **ZIP/Postal Code**: Any valid code (e.g., `12345`, `90210`)

### Other Test Card Scenarios

**Declined Card:**
- Card Number: `4000 0000 0000 0002`
- Always returns "card_declined"

**Requires Authentication (3D Secure):**
- Card Number: `4000 0025 0000 3155`
- Will prompt for authentication

**Insufficient Funds:**
- Card Number: `4000 0000 0000 9995`
- Returns "insufficient_funds"

**Processing Error:**
- Card Number: `4000 0000 0000 0119`
- Returns "processing_error"

### Testing Tips

1. **All test cards work with:**
   - Any future expiry date
   - Any 3-digit CVC
   - Any postal/ZIP code
   - Any name

2. **Check your Stripe Dashboard:**
   - Go to https://dashboard.stripe.com/test/payments
   - You should see all test payments appear there
   - Payment intents will show their status

3. **For full list of test cards:**
   - Visit: https://stripe.com/docs/testing

## Security Notes

- **Never commit your `.env` file** to Git (it's already in `.gitignore`)
- **Never share your Secret Key** publicly
- Use TEST keys for development
- Use LIVE keys only in production (and keep them secure)
