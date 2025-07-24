import express from 'express';
import { executeQuery } from '../database/connection.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics for the current user
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
 */
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get flow statistics
    const flowStats = executeQuery(`
      SELECT 
        COUNT(*) as total_flows,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_flows,
        COUNT(CASE WHEN is_public = 1 THEN 1 END) as public_flows
      FROM flows WHERE user_id = ?
    `, [userId]);

    // Get agent statistics
    const agentStats = executeQuery(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_agents,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_agents
      FROM agents WHERE user_id = ?
    `, [userId]);

    // Get execution statistics
    const executionStats = executeQuery(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
        AVG(duration_ms) as avg_duration
      FROM executions WHERE user_id = ?
    `, [userId]);

    // Get recent activity
    const recentActivity = executeQuery(`
      SELECT 
        'flow' as type,
        name,
        updated_at as timestamp
      FROM flows 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 5
      
      UNION ALL
      
      SELECT 
        'execution' as type,
        'Flow Execution' as name,
        started_at as timestamp
      FROM executions 
      WHERE user_id = ? 
      ORDER BY started_at DESC 
      LIMIT 5
      
      ORDER BY timestamp DESC 
      LIMIT 10
    `, [userId, userId]);

    res.json({
      stats: {
        flows: flowStats[0],
        agents: agentStats[0],
        executions: executionStats[0]
      },
      recentActivity
    });

  } catch (error) {
    logger.error('Get dashboard analytics error:', error);
    res.status(500).json({
      error: 'Failed to get dashboard analytics',
      message: 'An error occurred while retrieving dashboard analytics'
    });
  }
});

/**
 * @swagger
 * /analytics/flows/{flowId}:
 *   get:
 *     summary: Get analytics for a specific flow
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Flow analytics retrieved successfully
 */
router.get('/flows/:flowId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const flowId = req.params.flowId;

    // Check if flow belongs to user
    const flows = executeQuery('SELECT id, name FROM flows WHERE id = ? AND user_id = ?', [flowId, userId]);
    if (flows.length === 0) {
      return res.status(404).json({
        error: 'Flow not found',
        message: 'Flow not found or access denied'
      });
    }

    // Get flow execution statistics
    const executionStats = executeQuery(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
        AVG(duration_ms) as avg_duration,
        MIN(started_at) as first_execution,
        MAX(started_at) as last_execution
      FROM executions WHERE flow_id = ?
    `, [flowId]);

    // Get execution history
    const executionHistory = executeQuery(`
      SELECT status, started_at, completed_at, duration_ms
      FROM executions 
      WHERE flow_id = ?
      ORDER BY started_at DESC
      LIMIT 20
    `, [flowId]);

    res.json({
      flow: flows[0],
      stats: executionStats[0],
      executionHistory
    });

  } catch (error) {
    logger.error('Get flow analytics error:', error);
    res.status(500).json({
      error: 'Failed to get flow analytics',
      message: 'An error occurred while retrieving flow analytics'
    });
  }
});

/**
 * @swagger
 * /analytics/agents/{agentId}:
 *   get:
 *     summary: Get analytics for a specific agent
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Agent analytics retrieved successfully
 */
router.get('/agents/:agentId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.params.agentId;

    // Check if agent belongs to user
    const agents = executeQuery('SELECT id, name, status, created_at FROM agents WHERE id = ? AND user_id = ?', [agentId, userId]);
    if (agents.length === 0) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'Agent not found or access denied'
      });
    }

    // Get agent execution statistics
    const executionStats = executeQuery(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
        AVG(duration_ms) as avg_duration
      FROM executions e
      JOIN flows f ON e.flow_id = f.id
      WHERE f.id IN (SELECT flow_id FROM agents WHERE id = ?)
    `, [agentId]);

    res.json({
      agent: agents[0],
      stats: executionStats[0]
    });

  } catch (error) {
    logger.error('Get agent analytics error:', error);
    res.status(500).json({
      error: 'Failed to get agent analytics',
      message: 'An error occurred while retrieving agent analytics'
    });
  }
});

/**
 * @swagger
 * /analytics/executions:
 *   get:
 *     summary: Get execution analytics with filters
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: week
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [completed, failed, cancelled]
 *     responses:
 *       200:
 *         description: Execution analytics retrieved successfully
 */
router.get('/executions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const period = req.query.period || 'week';
    const status = req.query.status;

    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    let whereClause = 'WHERE e.user_id = ? AND e.started_at >= ?';
    let params = [userId, startDate.toISOString()];

    if (status) {
      whereClause += ' AND e.status = ?';
      params.push(status);
    }

    // Get execution statistics for the period
    const executionStats = executeQuery(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_executions,
        AVG(duration_ms) as avg_duration,
        SUM(duration_ms) as total_duration
      FROM executions e ${whereClause}
    `, params);

    // Get daily execution counts
    const dailyStats = executeQuery(`
      SELECT 
        DATE(e.started_at) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failed
      FROM executions e ${whereClause}
      GROUP BY DATE(e.started_at)
      ORDER BY date DESC
      LIMIT 30
    `, params);

    res.json({
      period,
      stats: executionStats[0],
      dailyStats
    });

  } catch (error) {
    logger.error('Get execution analytics error:', error);
    res.status(500).json({
      error: 'Failed to get execution analytics',
      message: 'An error occurred while retrieving execution analytics'
    });
  }
});

export default router; 