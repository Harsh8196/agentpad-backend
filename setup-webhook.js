#!/usr/bin/env node

import { WebhookHandler } from './src/webhookHandler.js';
import { logger } from './src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupWebhook() {
  const webhookHandler = new WebhookHandler();
  
  try {
    // Start webhook server
    await webhookHandler.start(3001);
    logger.info('✅ Webhook server started on port 3001');
    
    // Check if ngrok URL is provided
    const ngrokUrl = process.argv[2];
    if (ngrokUrl) {
      logger.info(`🔗 Setting up webhook with ngrok URL: ${ngrokUrl}`);
      
      // Directly call the webhook setup method
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const webhookUrl = `${ngrokUrl}/webhook/telegram`;
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        });

        const result = await response.json();

        if (result.ok) {
          logger.info('✅ Webhook configured successfully!');
          logger.info(`📡 Webhook URL: ${webhookUrl}`);
          
          // Test the webhook
          const testResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
          const testResult = await testResponse.json();
          logger.info(`📊 Webhook Info: ${JSON.stringify(testResult, null, 2)}`);
        } else {
          logger.error(`❌ Failed to set webhook: ${result.description}`);
          logger.info('💡 Try deleting existing webhook first:');
          logger.info(`curl -X POST https://api.telegram.org/bot${botToken}/deleteWebhook`);
        }
      } catch (error) {
        logger.error(`❌ Error setting webhook: ${error.message}`);
      }
    } else {
      logger.info('📋 Manual setup instructions:');
      logger.info('1. Start ngrok: ngrok http 3000');
      logger.info('2. Copy the ngrok URL (e.g., https://abc123.ngrok.io)');
      logger.info('3. Run: node setup-webhook.js <ngrok-url>');
      logger.info('');
      logger.info('🔗 Or set up webhook manually:');
      logger.info(`POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook`);
      logger.info(`Body: {"url": "https://your-ngrok-url.ngrok.io/webhook/telegram"}`);
    }
    
    logger.info('');
    logger.info('🚀 Webhook server is running!');
    logger.info('📱 Send messages to your bot to test');
    logger.info('⏹️  Press Ctrl+C to stop');
    
    // Keep server running
    process.on('SIGINT', () => {
      logger.info('🛑 Stopping webhook server...');
      webhookHandler.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`❌ Error setting up webhook: ${error.message}`);
    process.exit(1);
  }
}

// Check environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
  logger.info('💡 Set it with: $env:TELEGRAM_BOT_TOKEN="your_bot_token"');
  process.exit(1);
}

if (!process.env.TELEGRAM_CHAT_ID) {
  logger.warn('⚠️  TELEGRAM_CHAT_ID not set - some features may not work');
}

setupWebhook(); 