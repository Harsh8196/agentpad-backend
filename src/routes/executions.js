import express from 'express';
import { executeQuery } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import BackendFlowExecutor from '../services/flowExecutor.js';

const router = express.Router();

// Store active executions (in production, use Redis or database)
const activeExecutions = new Map();

/**
 * @swagger
 * /executions:
 *   get:
 *     summary: Get execution history for the current user
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed, cancelled]
 *     responses:
 *       200:
 *         description: List of executions retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let whereClause = 'WHERE e.user_id = ?';
    let params = [userId];

    if (status) {
      whereClause += ' AND e.status = ?';
      params.push(status);
    }

    // Get executions with pagination
    const executions = executeQuery(`
      SELECT e.id, e.status, e.started_at, e.completed_at, e.duration_ms,
             f.name as flow_name, f.id as flow_id
      FROM executions e
      LEFT JOIN flows f ON e.flow_id = f.id
      ${whereClause}
      ORDER BY e.started_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Get total count
    const countResult = executeQuery(`
      SELECT COUNT(*) as total FROM executions e ${whereClause}
    `, params);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      executions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    logger.error('Get executions error:', error);
    res.status(500).json({
      error: 'Failed to get executions',
      message: 'An error occurred while retrieving executions'
    });
  }
});

/**
 * @swagger
 * /executions/{id}:
 *   get:
 *     summary: Get a specific execution by ID
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Execution retrieved successfully
 *       404:
 *         description: Execution not found
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const executionId = req.params.id;

    const executions = executeQuery(`
      SELECT e.*, f.name as flow_name
      FROM executions e
      LEFT JOIN flows f ON e.flow_id = f.id
      WHERE e.id = ? AND e.user_id = ?
    `, [executionId, userId]);

    if (executions.length === 0) {
      return res.status(404).json({
        error: 'Execution not found',
        message: 'Execution not found or access denied'
      });
    }

    const execution = executions[0];
    if (execution.input_data) {
      execution.input_data = JSON.parse(execution.input_data);
    }
    if (execution.output_data) {
      execution.output_data = JSON.parse(execution.output_data);
    }

    res.json({ execution });

  } catch (error) {
    logger.error('Get execution error:', error);
    res.status(500).json({
      error: 'Failed to get execution',
      message: 'An error occurred while retrieving execution'
    });
  }
});

/**
 * @swagger
 * /executions/{id}/logs:
 *   get:
 *     summary: Get execution logs
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Execution logs retrieved successfully
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const userId = req.user.userId;
    const executionId = req.params.id;

    // Check if execution belongs to user
    const executions = executeQuery('SELECT id FROM executions WHERE id = ? AND user_id = ?', [executionId, userId]);
    if (executions.length === 0) {
      return res.status(404).json({
        error: 'Execution not found',
        message: 'Execution not found or access denied'
      });
    }

    // Get execution logs
    const logs = executeQuery(`
      SELECT level, message, timestamp
      FROM execution_logs
      WHERE execution_id = ?
      ORDER BY timestamp ASC
    `, [executionId]);

    res.json({ logs });

  } catch (error) {
    logger.error('Get execution logs error:', error);
    res.status(500).json({
      error: 'Failed to get execution logs',
      message: 'An error occurred while retrieving execution logs'
    });
  }
});

/**
 * @swagger
 * /executions/{id}/cancel:
 *   post:
 *     summary: Cancel a running execution
 *     tags: [Executions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Execution cancelled successfully
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const userId = req.user.userId;
    const executionId = req.params.id;

    // Check if execution exists and belongs to user
    const executions = executeQuery('SELECT id, status FROM executions WHERE id = ? AND user_id = ?', [executionId, userId]);
    if (executions.length === 0) {
      return res.status(404).json({
        error: 'Execution not found',
        message: 'Execution not found or access denied'
      });
    }

    const execution = executions[0];
    if (execution.status !== 'running') {
      return res.status(400).json({
        error: 'Cannot cancel execution',
        message: 'Only running executions can be cancelled'
      });
    }

    // Cancel execution
    executeQuery(`
      UPDATE executions 
      SET status = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, ['cancelled', executionId]);

    // Add cancellation log
    executeQuery(`
      INSERT INTO execution_logs (execution_id, level, message)
      VALUES (?, ?, ?)
    `, [executionId, 'info', 'Execution cancelled by user']);

    res.json({
      message: 'Execution cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel execution error:', error);
    res.status(500).json({
      error: 'Failed to cancel execution',
      message: 'An error occurred while cancelling execution'
    });
  }
});

// === FLOW EXECUTION ROUTES ===

// Initialize blockchain
router.post('/flow/initialize-blockchain', async (req, res) => {
  try {
    const { privateKey, provider } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Private key is required' 
      });
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const executor = new BackendFlowExecutor();
    
    const result = await executor.initializeBlockchain(privateKey, provider);
    
    // Store executor for this session
    activeExecutions.set(executionId, executor);
    
    logger.info(`Blockchain initialized for execution: ${executionId}`);
    
    res.json({
      success: true,
      executionId,
      walletAddress: result.walletAddress
    });
    
  } catch (error) {
    logger.error('Failed to initialize blockchain:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute a single node
router.post('/flow/execute-node', async (req, res) => {
  try {
    const { executionId, node, frontendVariables } = req.body;
    
    if (!executionId || !node) {
      return res.status(400).json({
        success: false,
        error: 'Execution ID and node are required'
      });
    }

    const executor = activeExecutions.get(executionId);
    if (!executor) {
      return res.status(404).json({
        success: false,
        error: 'Execution session not found'
      });
    }

    logger.info(`Executing node ${node.id} (${node.type}) for execution ${executionId}`);
    
    const result = await executor.executeNode(node, frontendVariables || {});
    
    res.json(result);
    
  } catch (error) {
    logger.error('Node execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute multiple nodes (batch execution)
router.post('/flow/execute-nodes', async (req, res) => {
  try {
    const { executionId, nodes, frontendVariables } = req.body;
    
    if (!executionId || !nodes || !Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: 'Execution ID and nodes array are required'
      });
    }

    const executor = activeExecutions.get(executionId);
    if (!executor) {
      return res.status(404).json({
        success: false,
        error: 'Execution session not found'
      });
    }

    logger.info(`Executing ${nodes.length} nodes for execution ${executionId}`);
    
    const results = [];
    let currentVariables = frontendVariables || {};
    
    for (const node of nodes) {
      const result = await executor.executeNode(node, currentVariables);
      results.push(result);
      
      // Update variables for next node
      if (result.success && result.variables) {
        currentVariables = { ...currentVariables, ...result.variables };
      }
      
      // If node failed, we can choose to continue or stop
      if (!result.success) {
        logger.warn(`Node ${node.id} failed, continuing with next node`);
      }
    }
    
    res.json({
      success: true,
      results,
      finalVariables: currentVariables
    });
    
  } catch (error) {
    logger.error('Batch execution failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get execution context
router.get('/flow/execution/:executionId/context', (req, res) => {
  try {
    const { executionId } = req.params;
    
    const executor = activeExecutions.get(executionId);
    if (!executor) {
      return res.status(404).json({
        success: false,
        error: 'Execution session not found'
      });
    }

    const context = executor.getExecutionContext();
    res.json({
      success: true,
      context
    });
    
  } catch (error) {
    logger.error('Failed to get execution context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear execution context
router.delete('/flow/execution/:executionId', (req, res) => {
  try {
    const { executionId } = req.params;
    
    const executor = activeExecutions.get(executionId);
    if (!executor) {
      return res.status(404).json({
        success: false,
        error: 'Execution session not found'
      });
    }

    executor.clearContext();
    activeExecutions.delete(executionId);
    
    logger.info(`Execution session ${executionId} cleared`);
    
    res.json({
      success: true,
      message: 'Execution session cleared'
    });
    
  } catch (error) {
    logger.error('Failed to clear execution session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check for execution service
router.get('/flow/health', (req, res) => {
  res.json({
    success: true,
    message: 'Flow execution service is running',
    activeExecutions: activeExecutions.size,
    timestamp: new Date().toISOString()
  });
});

export default router; 