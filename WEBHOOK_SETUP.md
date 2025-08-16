# Telegram Webhook Setup Guide

This guide will help you set up Telegram webhooks for AgentPad's interactive approval workflows.

## Prerequisites

1. **Telegram Bot** - Created with @BotFather
2. **Bot Token** - From BotFather
3. **Chat ID** - Your personal or group chat ID
4. **Public URL** - For webhook (ngrok, VPS, or cloud service)

## Option 1: Development Setup (ngrok)

### Step 1: Install ngrok
```bash
# Download from https://ngrok.com/
# Or install via npm
npm install -g ngrok
```

### Step 2: Set Environment Variables
```powershell
# In PowerShell (backend directory)
$env:TELEGRAM_BOT_TOKEN="your_bot_token_here"
$env:TELEGRAM_CHAT_ID="your_chat_id_here"
```

### Step 3: Start ngrok Tunnel
```bash
# In a new terminal
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 4: Set Up Webhook
```bash
# In backend directory
node setup-webhook.js https://abc123.ngrok.io
```

## Option 2: Production Setup (VPS/Cloud)

### Step 1: Deploy to VPS
1. Upload AgentPad backend to your VPS
2. Install dependencies: `npm install`
3. Set environment variables
4. Start webhook server: `node setup-webhook.js`

### Step 2: Configure Domain
1. Point your domain to your VPS
2. Set up SSL certificate (Let's Encrypt)
3. Configure reverse proxy (nginx)

### Step 3: Set Webhook URL
```bash
# Replace with your domain
node setup-webhook.js https://yourdomain.com
```

## Option 3: Cloud Services

### Heroku
1. Deploy to Heroku
2. Set environment variables in Heroku dashboard
3. Use Heroku URL: `https://your-app.herokuapp.com`

### Railway
1. Deploy to Railway
2. Set environment variables
3. Use Railway URL: `https://your-app.railway.app`

### Vercel
1. Deploy to Vercel
2. Set environment variables
3. Use Vercel URL: `https://your-app.vercel.app`

## Testing Your Webhook

### Step 1: Start Webhook Server
```bash
node setup-webhook.js
```

### Step 2: Test Basic Functionality
1. Send a message to your bot
2. Check server logs for webhook receipt
3. Verify bot responds

### Step 3: Test Interactive Buttons
1. Create a flow with Telegram + User Approval nodes
2. Configure interactive buttons
3. Run the flow
4. Press buttons in Telegram
5. Verify approval workflow

## Webhook Endpoints

### Health Check
```
GET /health
```
Returns server status

### Telegram Webhook
```
POST /webhook/telegram
```
Receives Telegram updates

### Webhook Setup
```
POST /webhook/setup
Body: {"webhookUrl": "https://your-domain.com"}
```
Configures Telegram webhook

## Troubleshooting

### Common Issues

**❌ "Webhook URL must be HTTPS"**
- Use HTTPS URL (ngrok provides this)
- Ensure SSL certificate is valid

**❌ "Webhook URL must be publicly accessible"**
- Use ngrok for development
- Use VPS/cloud for production
- Check firewall settings

**❌ "Invalid webhook URL"**
- Ensure URL is accessible
- Check for typos
- Verify port forwarding

**❌ "Webhook already set"**
- Delete existing webhook first:
  ```
  https://api.telegram.org/bot<TOKEN>/deleteWebhook
  ```

### Debug Commands

**Check Current Webhook**
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

**Delete Webhook**
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook
```

**Test Webhook URL**
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/webhook/telegram"}'
```

## Security Considerations

### Environment Variables
- Never commit bot tokens to git
- Use `.env` files for local development
- Use secure environment variables in production

### Webhook Security
- Use HTTPS only
- Consider webhook secret validation
- Rate limit webhook endpoints
- Monitor for abuse

### Access Control
- Limit who can approve actions
- Log all approval activities
- Set reasonable timeouts

## Integration with AgentPad

### Flow Configuration
1. Add Telegram node with interactive buttons
2. Add User Approval node
3. Configure approval timeout
4. Set up conditional routing

### Example Flow
```
Start → LLM Analysis → Conditional → Telegram (Interactive) → User Approval → Conditional → Blockchain
```

### Variables
- `telegramChatId` - Chat ID for notifications
- `approvalResult` - Result from approval node
- `userResponse` - User's response message

## Monitoring

### Logs
- Webhook server logs all activities
- Check for failed webhook deliveries
- Monitor approval timeouts

### Metrics
- Track approval response times
- Monitor webhook success rate
- Log user interaction patterns

## Support

If you encounter issues:
1. Check server logs
2. Verify webhook configuration
3. Test with simple messages first
4. Ensure all environment variables are set 