#!/usr/bin/env node

import { Command } from 'commander';
import { logger } from './src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('manage-webhook')
  .description('Manage Telegram webhook for AgentPad')
  .version('1.0.0');

// Set webhook command
program
  .command('set')
  .description('Set webhook URL')
  .argument('<url>', 'Webhook URL (e.g., https://abc123.ngrok.io)')
  .option('-p, --port <port>', 'Local port for webhook server', '3001')
  .action(async (url, options) => {
    await setWebhook(url, options.port);
  });

// Delete webhook command
program
  .command('delete')
  .description('Delete current webhook')
  .action(async () => {
    await deleteWebhook();
  });

// Info command
program
  .command('info')
  .description('Get current webhook information')
  .action(async () => {
    await getWebhookInfo();
  });

// Test command
program
  .command('test')
  .description('Test webhook with a simple message')
  .option('-p, --port <port>', 'Local port for webhook server', '3001')
  .action(async (options) => {
    await testWebhook(options.port);
  });

// Interactive setup command
program
  .command('setup')
  .description('Interactive webhook setup')
  .option('-p, --port <port>', 'Local port for webhook server', '3001')
  .action(async (options) => {
    await interactiveSetup(options.port);
  });

async function setWebhook(url, port) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  const webhookUrl = `${url}/webhook/telegram`;
  
  try {
    logger.info(`🔗 Setting webhook to: ${webhookUrl}`);
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const result = await response.json();

    if (result.ok) {
      logger.info('✅ Webhook set successfully!');
      logger.info(`📡 Webhook URL: ${webhookUrl}`);
      
      // Show webhook info
      await getWebhookInfo();
    } else {
      logger.error(`❌ Failed to set webhook: ${result.description}`);
      if (result.description.includes('already set')) {
        logger.info('💡 Try deleting the existing webhook first:');
        logger.info('node manage-webhook.js delete');
      }
    }
  } catch (error) {
    logger.error(`❌ Error setting webhook: ${error.message}`);
  }
}

async function deleteWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  try {
    logger.info('🗑️  Deleting webhook...');
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
    const result = await response.json();

    if (result.ok) {
      logger.info('✅ Webhook deleted successfully!');
    } else {
      logger.error(`❌ Failed to delete webhook: ${result.description}`);
    }
  } catch (error) {
    logger.error(`❌ Error deleting webhook: ${error.message}`);
  }
}

async function getWebhookInfo() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  try {
    logger.info('📊 Getting webhook information...');
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const result = await response.json();

    if (result.ok) {
      logger.info('📋 Webhook Information:');
      logger.info(`  URL: ${result.result.url || 'Not set'}`);
      logger.info(`  Has custom certificate: ${result.result.has_custom_certificate || false}`);
      logger.info(`  Pending update count: ${result.result.pending_update_count || 0}`);
      logger.info(`  Last error date: ${result.result.last_error_date || 'None'}`);
      logger.info(`  Last error message: ${result.result.last_error_message || 'None'}`);
      logger.info(`  Max connections: ${result.result.max_connections || 'Default'}`);
      logger.info(`  Allowed updates: ${JSON.stringify(result.result.allowed_updates) || 'All'}`);
    } else {
      logger.error(`❌ Failed to get webhook info: ${result.description}`);
    }
  } catch (error) {
    logger.error(`❌ Error getting webhook info: ${error.message}`);
  }
}

async function testWebhook(port) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken) {
    logger.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!chatId) {
    logger.error('❌ TELEGRAM_CHAT_ID environment variable is required for testing');
    process.exit(1);
  }

  try {
    logger.info('🧪 Testing webhook with a simple message...');
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🧪 Webhook test message from AgentPad!'
      })
    });

    const result = await response.json();

    if (result.ok) {
      logger.info('✅ Test message sent successfully!');
      logger.info('📱 Check your Telegram for the test message');
      logger.info('📊 If webhook is working, you should see webhook logs in your server');
    } else {
      logger.error(`❌ Failed to send test message: ${result.description}`);
    }
  } catch (error) {
    logger.error(`❌ Error sending test message: ${error.message}`);
  }
}

async function interactiveSetup(port) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    logger.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
    logger.info('💡 Set it with: $env:TELEGRAM_BOT_TOKEN="your_bot_token"');
    process.exit(1);
  }

  logger.info('🚀 Interactive Webhook Setup');
  logger.info('============================');
  
  // Check current webhook
  logger.info('📊 Checking current webhook status...');
  await getWebhookInfo();
  
  logger.info('');
  logger.info('📋 Setup Options:');
  logger.info('1. Use ngrok (recommended for development)');
  logger.info('2. Use custom domain/VPS');
  logger.info('3. Use cloud service (Heroku, Railway, etc.)');
  logger.info('4. Manual setup');
  
  logger.info('');
  logger.info('💡 For development with ngrok:');
  logger.info('1. Start ngrok: ngrok http 3000');
  logger.info('2. Copy the HTTPS URL');
  logger.info('3. Run: node manage-webhook.js set <ngrok-url>');
  
  logger.info('');
  logger.info('💡 For production:');
  logger.info('1. Deploy to VPS/cloud with HTTPS');
  logger.info('2. Run: node manage-webhook.js set https://yourdomain.com');
  
  logger.info('');
  logger.info('🔧 Available commands:');
  logger.info('  node manage-webhook.js set <url>     - Set webhook URL');
  logger.info('  node manage-webhook.js delete        - Delete webhook');
  logger.info('  node manage-webhook.js info          - Show webhook info');
  logger.info('  node manage-webhook.js test          - Test webhook');
}

// Check environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
  logger.info('💡 Set it with: $env:TELEGRAM_BOT_TOKEN="your_bot_token"');
  process.exit(1);
}

program.parse(); 