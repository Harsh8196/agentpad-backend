import express from 'express';
import { logger } from './utils/logger.js';

class WebhookHandler {
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.pendingApprovals = new Map();
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Telegram webhook endpoint
    this.app.post('/webhook/telegram', (req, res) => {
      this.handleTelegramWebhook(req, res);
    });

    // Set webhook endpoint (for setting up the webhook)
    this.app.post('/webhook/setup', (req, res) => {
      this.setupTelegramWebhook(req, res);
    });
  }

  async handleTelegramWebhook(req, res) {
    try {
      const { callback_query, message } = req.body;
      
      if (callback_query) {
        // Handle button press
        await this.handleCallbackQuery(callback_query);
      } else if (message) {
        // Handle regular message
        logger.info(`[WEBHOOK] Received message: ${message.text}`);
      }

      res.json({ ok: true });
    } catch (error) {
      logger.error(`[WEBHOOK] Error handling webhook: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  async handleCallbackQuery(callbackQuery) {
    const { data, message, from } = callbackQuery;
    const chatId = message.chat.id;
    const userId = from.id;
    const username = from.username || from.first_name;

    logger.info(`[WEBHOOK] Button pressed: ${data} by ${username} (${userId}) in chat ${chatId}`);
    logger.info(`[WEBHOOK] Full callback data: ${JSON.stringify(callbackQuery, null, 2)}`);

    // Find pending approval for this chat
    const approval = this.findPendingApproval(chatId);
    if (approval) {
      // Update approval status
      approval.status = 'completed';
      approval.action = data;
      approval.userResponse = `Approved by ${username}`;
      approval.timestamp = Date.now();

      logger.info(`[WEBHOOK] Approval completed: ${approval.approvalId} - ${data}`);

      // Send confirmation message
      await this.sendConfirmationMessage(chatId, data);
    } else {
      logger.warn(`[WEBHOOK] No pending approval found for chat ${chatId}`);
      logger.info(`[WEBHOOK] Current pending approvals: ${this.pendingApprovals.size}`);
      for (const [id, approval] of this.pendingApprovals) {
        logger.info(`[WEBHOOK] - ${id}: chat ${approval.chatId}, status ${approval.status}`);
      }
    }
  }

  findPendingApproval(chatId) {
    logger.info(`[WEBHOOK] Looking for pending approval in chat ${chatId} (type: ${typeof chatId})`);
    for (const [approvalId, approval] of this.pendingApprovals) {
      logger.info(`[WEBHOOK] Checking approval ${approvalId}: chat ${approval.chatId} (type: ${typeof approval.chatId}), status ${approval.status}`);
      
      // Convert both to strings for comparison to handle any type mismatches
      const approvalChatId = String(approval.chatId);
      const searchChatId = String(chatId);
      
      if (approvalChatId === searchChatId && approval.status === 'pending') {
        logger.info(`[WEBHOOK] Found pending approval: ${approvalId}`);
        return approval;
      }
    }
    logger.info(`[WEBHOOK] No pending approval found for chat ${chatId}`);
    return null;
  }

  async sendConfirmationMessage(chatId, action) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    let message;
    if (action === 'success') {
      message = '✅ **Action Approved!**\n\nYour approval has been received and the action will now proceed.';
    } else if (action === 'failure') {
      message = '❌ **Action Rejected**\n\nYour rejection has been received and the action has been cancelled.';
    } else if (action === 'approve') {
      message = '✅ **Action Approved!**\n\nYour approval has been received and the action will now proceed.';
    } else {
      message = `🔄 **Action ${action}**\n\nYour response "${action}" has been received.`;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      if (!response.ok) {
        logger.error(`[WEBHOOK] Failed to send confirmation: ${response.statusText}`);
      } else {
        logger.info(`[WEBHOOK] Confirmation message sent: ${action}`);
      }
    } catch (error) {
      logger.error(`[WEBHOOK] Error sending confirmation: ${error.message}`);
    }
  }

  async setupTelegramWebhook(req, res) {
    try {
      const { webhookUrl } = req.body;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!botToken) {
        return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
      }

      if (!webhookUrl) {
        return res.status(400).json({ error: 'webhookUrl is required' });
      }

      // Set webhook URL
      const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${webhookUrl}/webhook/telegram`
        })
      });

      const result = await response.json();

      if (result.ok) {
        logger.info(`[WEBHOOK] Webhook set successfully: ${webhookUrl}/webhook/telegram`);
        res.json({ success: true, webhookUrl: `${webhookUrl}/webhook/telegram` });
      } else {
        logger.error(`[WEBHOOK] Failed to set webhook: ${result.description}`);
        res.status(400).json({ error: result.description });
      }
    } catch (error) {
      logger.error(`[WEBHOOK] Error setting webhook: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  // Method to register pending approval
  registerPendingApproval(approvalId, chatId, timeout = 3600) {
    this.pendingApprovals.set(approvalId, {
      approvalId,
      chatId,
      status: 'pending',
      timestamp: Date.now(),
      timeout: timeout * 1000
    });

    // Clean up expired approvals
    this.cleanupExpiredApprovals();
  }

  // Method to get approval result
  getApprovalResult(approvalId) {
    const approval = this.pendingApprovals.get(approvalId);
    if (approval && approval.status === 'completed') {
      this.pendingApprovals.delete(approvalId);
      return approval;
    }
    return null;
  }

  // Method to check if approval is pending
  isApprovalPending(approvalId) {
    const approval = this.pendingApprovals.get(approvalId);
    if (!approval) return false;

    const elapsed = Date.now() - approval.timestamp;
    return approval.status === 'pending' && elapsed < approval.timeout;
  }

  // Clean up expired approvals
  cleanupExpiredApprovals() {
    const now = Date.now();
    for (const [approvalId, approval] of this.pendingApprovals) {
      const elapsed = now - approval.timestamp;
      if (elapsed > approval.timeout) {
        this.pendingApprovals.delete(approvalId);
        logger.info(`[WEBHOOK] Expired approval removed: ${approvalId}`);
      }
    }
  }

  // Start the webhook server
  start(port = 3000) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        logger.info(`[WEBHOOK] Webhook server started on port ${port}`);
        resolve();
      });
    });
  }

  // Stop the webhook server
  stop() {
    if (this.server) {
      this.server.close();
      logger.info('[WEBHOOK] Webhook server stopped');
    }
  }
}

export { WebhookHandler }; 