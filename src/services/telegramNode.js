import { logger } from '../utils/logger.js';

class TelegramNode {
  constructor(config, context) {
    this.config = config;
    this.context = context;
    this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = config.chatId || process.env.TELEGRAM_CHAT_ID;
    this.interactive = config.interactive || false;
    this.buttons = config.buttons || [];
    this.message = config.message || '';
  }

  async execute() {
    try {
      if (!this.botToken) {
        throw new Error('Telegram bot token is required');
      }

      if (!this.chatId) {
        throw new Error('Telegram chat ID is required');
      }

      // Resolve variables in message
      const resolvedMessage = this.resolveVariablesInMessage(this.message);
      
      if (this.interactive && this.buttons.length > 0) {
        return await this.sendInteractiveMessage(resolvedMessage);
      } else {
        return await this.sendSimpleMessage(resolvedMessage);
      }
    } catch (error) {
      logger.error(`[TELEGRAM] Error executing telegram node: ${error.message}`);
      throw error;
    }
  }

  async sendSimpleMessage(message) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API error: ${errorData.description}`);
    }

    const result = await response.json();
    logger.info(`[TELEGRAM] Message sent successfully to chat ${this.chatId}`);
    
    return {
      success: true,
      messageId: result.result.message_id,
      chatId: this.chatId
    };
  }

  async sendInteractiveMessage(message) {
    const inlineKeyboard = this.buildInlineKeyboard();
    
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API error: ${errorData.description}`);
    }

    const result = await response.json();
    logger.info(`[TELEGRAM] Interactive message sent successfully to chat ${this.chatId}`);
    
    return {
      success: true,
      messageId: result.result.message_id,
      chatId: this.chatId,
      interactive: true,
      approvalId: this.generateApprovalId()
    };
  }

  buildInlineKeyboard() {
    const keyboard = [];
    let currentRow = [];
    
    for (const button of this.buttons) {
      currentRow.push({
        text: button.text,
        callback_data: button.value || button.text.toLowerCase()
      });
      
      // Start new row every 2 buttons for better layout
      if (currentRow.length === 2) {
        keyboard.push(currentRow);
        currentRow = [];
      }
    }
    
    // Add remaining buttons
    if (currentRow.length > 0) {
      keyboard.push(currentRow);
    }
    
    return keyboard;
  }

  generateApprovalId() {
    return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  resolveVariablesInMessage(message) {
    if (!message) return '';
    let resolved = String(message);
    const pattern = /\{([^}]+)\}/g;
    // Resolve repeatedly in case variables contain other placeholders
    for (let i = 0; i < 3; i += 1) {
      let changed = false;
      resolved = resolved.replace(pattern, (match, variableName) => {
        const value = this.context.variables?.[variableName];
        if (value !== undefined) {
          changed = true;
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return match; // leave unresolved for next pass / logging
      });
      if (!changed) break;
    }
    return resolved;
  }
}

export { TelegramNode }; 