# Telegram Webhook Setup Guide

This guide explains how Telegram webhooks work with AgentPad's interactive approval workflows.

## ⚠️ Important Note

**Manual webhook setup is NOT required!** The AgentPad workflow executor automatically starts and manages the webhook server when needed. You only need to configure your environment variables.

## Prerequisites

1. **Telegram Bot** - Created with @BotFather
2. **Bot Token** - From BotFather  
3. **Chat ID** - Your personal or group chat ID
4. **Environment Variables** - Set in your `.env` file

## Automatic Webhook Management

### How It Works

1. **Automatic Start**: When you run a flow that contains Telegram or User Approval nodes, the workflow executor automatically:
   - Starts a webhook server on port 3001 (or next available port)
   - Registers the webhook with Telegram
   - Handles incoming webhook requests

2. **Automatic Cleanup**: When all flows stop, the webhook server is automatically stopped

3. **Port Management**: If port 3001 is busy, the system automatically tries the next available port

### Environment Variables

Set these in your `.env` file:

```bash
# Required for Telegram functionality
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Optional: Custom webhook port (default: 3001)
WEBHOOK_PORT=3001
```

## Development Setup

### Step 1: Create Telegram Bot
1. Message @BotFather on Telegram
2. Use `/newbot` command
3. Follow instructions to create bot
4. Save the bot token

### Step 2: Get Chat ID
1. Start a chat with your bot
2. Send a message to the bot
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find your chat ID in the response

### Step 3: Set Environment Variables
```bash
# In your .env file
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
```

### Step 4: Test with a Flow
1. Create a flow with Telegram or User Approval nodes
2. Run the flow: `npm run agentpad start your_flow`
3. The webhook server will start automatically
4. Check logs for webhook server status

## Production Setup

### Option 1: VPS/Cloud Server

1. **Deploy AgentPad backend** to your server
2. **Set environment variables**:
   ```bash
   export TELEGRAM_BOT_TOKEN="your_bot_token"
   export TELEGRAM_CHAT_ID="your_chat_id"
   ```
3. **Run flows normally** - webhook server starts automatically
4. **Configure firewall** to allow incoming connections on webhook port

### Option 2: Cloud Services (Heroku, Railway, etc.)

1. **Deploy to cloud service**
2. **Set environment variables** in service dashboard
3. **Run flows** - webhook server starts automatically
4. **Use service URL** for webhook (cloud services handle this)

## Testing Your Setup

### Step 1: Create Test Flow
Create a simple flow with:
- Start node
- Telegram node (with interactive buttons)
- User Approval node

### Step 2: Run the Flow
```bash
npm run agentpad start your_test_flow
```

### Step 3: Check Logs
Look for these messages:
```
✅ Webhook server started for Telegram approvals on port 3001
[WEBHOOK] Webhook server started on port 3001
```

### Step 4: Test Interaction
1. Send message to your bot
2. Press interactive buttons
3. Verify approval workflow works

## Webhook Endpoints (Automatic)

The workflow executor automatically creates these endpoints:

### Health Check
```
GET /health
```
Returns server status

### Telegram Webhook
```
POST /webhook/telegram
```
Receives Telegram updates (handled automatically)

## Troubleshooting

### Common Issues

**❌ "Port 3001 already in use"**
- The system automatically tries the next available port
- Check logs for the actual port being used
- If all ports are busy, stop other applications

**❌ "Webhook URL must be HTTPS"**
- For development: Use ngrok or similar tunnel service
- For production: Ensure your server has SSL certificate

**❌ "Webhook URL must be publicly accessible"**
- For development: Use ngrok tunnel
- For production: Ensure server is publicly accessible
- Check firewall settings

**❌ "Invalid bot token"**
- Verify your bot token is correct
- Ensure bot is not deleted or disabled

### Debug Commands

**Check Current Webhook**
```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

**Delete Webhook (if needed)**
```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook
```

**Check Flow Status**
```bash
npm run agentpad status
```

## Security Considerations

### Environment Variables
- Never commit bot tokens to git
- Use `.env` files for local development
- Use secure environment variables in production

### Webhook Security
- Use HTTPS only in production
- Monitor webhook endpoints for abuse
- Set reasonable approval timeouts

### Access Control
- Limit who can approve actions
- Log all approval activities
- Use secure chat IDs

## Integration with AgentPad

### Flow Configuration
1. Add Telegram node with interactive buttons
2. Add User Approval node
3. Configure approval timeout
4. Set up conditional routing based on approval result

### Example Flow
```
Start → LLM Analysis → Conditional → Telegram (Interactive) → User Approval → Conditional → Blockchain Action
```

### Variables
- `approvalResult` - Result from approval node (`approved`, `rejected`, `timeout`)
- `userResponse` - User's response message
- `approvalId` - Unique ID for the approval request

## Monitoring

### Logs
- Webhook server logs all activities automatically
- Check for failed webhook deliveries
- Monitor approval timeouts

### Flow Status
```bash
# Check running flows
npm run agentpad status

# Check specific flow
npm run agentpad status flow_name
```

## Support

If you encounter issues:
1. Check flow execution logs
2. Verify environment variables are set correctly
3. Test with simple Telegram messages first
4. Ensure bot token and chat ID are correct
5. Check if webhook server started successfully in logs

## Migration from Manual Setup

If you previously used manual webhook setup:

1. **Stop manual webhook server** (if running)
2. **Remove manual webhook setup** - no longer needed
3. **Set environment variables** in `.env` file
4. **Run flows normally** - webhook server starts automatically

The automatic webhook management is more reliable and easier to use than manual setup. 