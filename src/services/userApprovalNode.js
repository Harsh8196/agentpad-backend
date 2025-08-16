import { logger } from '../utils/logger.js';

class UserApprovalNode {
  constructor(config, context) {
    this.config = config;
    this.context = context;
    this.approvalType = config.approvalType || 'telegram';
    this.timeout = config.timeout || 3600; // 1 hour default
    this.approvalId = config.approvalId || this.generateApprovalId();
    this.message = config.message || 'Please approve this action';
    this.approvalActions = config.approvalActions || ['approve', 'reject'];
  }

  async execute() {
    try {
      logger.info(`[USER_APPROVAL] Starting approval process: ${this.approvalId}`);
      
      // Store approval request in context for tracking
      this.context.pendingApprovals = this.context.pendingApprovals || {};
      this.context.pendingApprovals[this.approvalId] = {
        status: 'pending',
        timestamp: Date.now(),
        timeout: this.timeout,
        actions: this.approvalActions,
        message: this.message
      };

      // For now, we'll simulate approval for testing
      // In production, this would integrate with Telegram webhook or other channels
      const approvalResult = await this.waitForApproval();
      
      logger.info(`[USER_APPROVAL] Approval completed: ${this.approvalId} - ${approvalResult.action}`);
      
      return {
        approved: approvalResult.action === 'approve',
        action: approvalResult.action,
        approvalId: this.approvalId,
        timestamp: Date.now(),
        userResponse: approvalResult.userResponse
      };
    } catch (error) {
      logger.error(`[USER_APPROVAL] Error in approval process: ${error.message}`);
      throw error;
    }
  }

  async waitForApproval() {
    logger.info(`[USER_APPROVAL] Waiting for user approval: ${this.approvalId}`);
    
    // Check if webhook handler is available
    if (this.context.webhookHandler) {
      // Register this approval with webhook handler
      const chatId = this.context.variables.telegramChatId || process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        logger.info(`[USER_APPROVAL] Registering approval ${this.approvalId} for chat ${chatId}`);
        this.context.webhookHandler.registerPendingApproval(this.approvalId, chatId, this.timeout);
        
        // Log all pending approvals for debugging
        logger.info(`[USER_APPROVAL] Current pending approvals: ${this.context.webhookHandler.pendingApprovals.size}`);
        for (const [id, approval] of this.context.webhookHandler.pendingApprovals) {
          logger.info(`[USER_APPROVAL] - ${id}: chat ${approval.chatId}, status ${approval.status}`);
        }
        
        // Poll for approval result
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            const result = this.context.webhookHandler.getApprovalResult(this.approvalId);
            if (result) {
              clearInterval(checkInterval);
              logger.info(`[USER_APPROVAL] Approval result received: ${result.action}`);
              resolve({
                action: result.action,
                userResponse: result.userResponse,
                timestamp: result.timestamp
              });
              return; // Exit early when approval is received
            }
            
            // Check if approval is no longer pending (timed out or completed)
            if (!this.context.webhookHandler.isApprovalPending(this.approvalId)) {
              clearInterval(checkInterval);
              logger.info(`[USER_APPROVAL] Approval no longer pending: ${this.approvalId}`);
              resolve({
                action: 'timeout',
                userResponse: 'Approval timed out',
                timestamp: Date.now()
              });
              return; // Exit early when approval times out
            }
          }, 1000); // Check every second
          
          // Set overall timeout as backup (should rarely be reached)
          const overallTimeout = setTimeout(() => {
            clearInterval(checkInterval);
            logger.info(`[USER_APPROVAL] Overall timeout reached: ${this.approvalId}`);
            resolve({
              action: 'timeout',
              userResponse: 'Approval timed out',
              timestamp: Date.now()
            });
          }, this.timeout * 1000);
          
          // Clean up timeout if approval is received early
          const cleanup = () => {
            clearTimeout(overallTimeout);
          };
          
          // Override resolve to clean up timeout
          const originalResolve = resolve;
          resolve = (result) => {
            cleanup();
            originalResolve(result);
          };
        });
      } else {
        logger.warn(`[USER_APPROVAL] No chat ID found for approval ${this.approvalId}`);
      }
    } else {
      logger.warn(`[USER_APPROVAL] No webhook handler available for approval ${this.approvalId}`);
    }
    
    // Fallback to simulation for testing
    logger.info(`[USER_APPROVAL] Using simulation mode for testing`);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          action: 'approve', // For testing, always approve
          userResponse: 'User approved via Telegram (simulation)',
          timestamp: Date.now()
        });
      }, 2000); // 2 second delay for testing
    });
  }

  generateApprovalId() {
    return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Method to handle approval response (called by webhook)
  handleApprovalResponse(approvalId, action, userResponse) {
    if (this.context.pendingApprovals && this.context.pendingApprovals[approvalId]) {
      this.context.pendingApprovals[approvalId].status = 'completed';
      this.context.pendingApprovals[approvalId].action = action;
      this.context.pendingApprovals[approvalId].userResponse = userResponse;
      
      logger.info(`[USER_APPROVAL] Approval response received: ${approvalId} - ${action}`);
      return true;
    }
    return false;
  }

  // Method to check if approval is still pending
  isApprovalPending(approvalId) {
    if (this.context.pendingApprovals && this.context.pendingApprovals[approvalId]) {
      const approval = this.context.pendingApprovals[approvalId];
      const elapsed = Date.now() - approval.timestamp;
      return approval.status === 'pending' && elapsed < approval.timeout * 1000;
    }
    return false;
  }
}

export { UserApprovalNode }; 