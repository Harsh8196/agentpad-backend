import express from 'express';
import { executeQuery } from '../database/connection.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /agents:
 *   get:
 *     summary: Get all agents for the current user
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of agents retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    const agents = executeQuery(`
      SELECT a.id, a.name, a.description, a.agent_type, a.is_active, a.status, 
             a.created_at, a.updated_at, f.name as flow_name
      FROM agents a
      LEFT JOIN flows f ON a.flow_id = f.id
      WHERE a.user_id = ?
      ORDER BY a.updated_at DESC
    `, [userId]);

    res.json({ agents });

  } catch (error) {
    logger.error('Get agents error:', error);
    res.status(500).json({
      error: 'Failed to get agents',
      message: 'An error occurred while retrieving agents'
    });
  }
});

/**
 * @swagger
 * /agents/{id}:
 *   get:
 *     summary: Get a specific agent by ID
 *     tags: [Agents]
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
 *         description: Agent retrieved successfully
 *       404:
 *         description: Agent not found
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.params.id;

    const agents = executeQuery(`
      SELECT a.*, f.name as flow_name
      FROM agents a
      LEFT JOIN flows f ON a.flow_id = f.id
      WHERE a.id = ? AND a.user_id = ?
    `, [agentId, userId]);

    if (agents.length === 0) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'Agent not found or access denied'
      });
    }

    const agent = agents[0];
    agent.configuration = JSON.parse(agent.configuration);

    res.json({ agent });

  } catch (error) {
    logger.error('Get agent error:', error);
    res.status(500).json({
      error: 'Failed to get agent',
      message: 'An error occurred while retrieving agent'
    });
  }
});

/**
 * @swagger
 * /agents:
 *   post:
 *     summary: Create a new agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - agentType
 *               - configuration
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               agentType:
 *                 type: string
 *               configuration:
 *                 type: object
 *               flowId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Agent created successfully
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, agentType, configuration, flowId } = req.body;

    if (!name || !agentType || !configuration) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name, agentType, and configuration are required'
      });
    }

    const result = executeQuery(`
      INSERT INTO agents (user_id, flow_id, name, description, agent_type, configuration, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, flowId || null, name, description || '', agentType, JSON.stringify(configuration), 1, 'idle']);

    const agentId = result.lastInsertRowid;

    // Get created agent
    const agents = executeQuery(`
      SELECT a.*, f.name as flow_name
      FROM agents a
      LEFT JOIN flows f ON a.flow_id = f.id
      WHERE a.id = ?
    `, [agentId]);

    const agent = agents[0];
    agent.configuration = JSON.parse(agent.configuration);

    res.status(201).json({
      message: 'Agent created successfully',
      agent
    });

  } catch (error) {
    logger.error('Create agent error:', error);
    res.status(500).json({
      error: 'Failed to create agent',
      message: 'An error occurred while creating agent'
    });
  }
});

/**
 * @swagger
 * /agents/{id}:
 *   put:
 *     summary: Update an agent
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               configuration:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Agent updated successfully
 *       404:
 *         description: Agent not found
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.params.id;
    const { name, description, configuration, isActive } = req.body;

    // Check if agent exists and user owns it
    const existingAgents = executeQuery('SELECT id FROM agents WHERE id = ? AND user_id = ?', [agentId, userId]);
    if (existingAgents.length === 0) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'Agent not found or access denied'
      });
    }

    // Build update query
    const updateFields = [];
    const params = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      params.push(description);
    }

    if (configuration !== undefined) {
      updateFields.push('configuration = ?');
      params.push(JSON.stringify(configuration));
    }

    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(agentId);

    // Update agent
    executeQuery(`
      UPDATE agents 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, params);

    // Get updated agent
    const agents = executeQuery(`
      SELECT a.*, f.name as flow_name
      FROM agents a
      LEFT JOIN flows f ON a.flow_id = f.id
      WHERE a.id = ?
    `, [agentId]);

    const agent = agents[0];
    agent.configuration = JSON.parse(agent.configuration);

    res.json({
      message: 'Agent updated successfully',
      agent
    });

  } catch (error) {
    logger.error('Update agent error:', error);
    res.status(500).json({
      error: 'Failed to update agent',
      message: 'An error occurred while updating agent'
    });
  }
});

/**
 * @swagger
 * /agents/{id}:
 *   delete:
 *     summary: Delete an agent
 *     tags: [Agents]
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
 *         description: Agent deleted successfully
 *       404:
 *         description: Agent not found
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.params.id;

    // Check if agent exists and user owns it
    const existingAgents = executeQuery('SELECT id FROM agents WHERE id = ? AND user_id = ?', [agentId, userId]);
    if (existingAgents.length === 0) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'Agent not found or access denied'
      });
    }

    // Delete agent
    executeQuery('DELETE FROM agents WHERE id = ?', [agentId]);

    res.json({
      message: 'Agent deleted successfully'
    });

  } catch (error) {
    logger.error('Delete agent error:', error);
    res.status(500).json({
      error: 'Failed to delete agent',
      message: 'An error occurred while deleting agent'
    });
  }
});

/**
 * @swagger
 * /agents/{id}/activate:
 *   post:
 *     summary: Activate an agent
 *     tags: [Agents]
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
 *         description: Agent activated successfully
 */
router.post('/:id/activate', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.params.id;

    const result = executeQuery(`
      UPDATE agents 
      SET is_active = 1, status = 'idle', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [agentId, userId]);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'Agent not found or access denied'
      });
    }

    res.json({
      message: 'Agent activated successfully'
    });

  } catch (error) {
    logger.error('Activate agent error:', error);
    res.status(500).json({
      error: 'Failed to activate agent',
      message: 'An error occurred while activating agent'
    });
  }
});

/**
 * @swagger
 * /agents/{id}/deactivate:
 *   post:
 *     summary: Deactivate an agent
 *     tags: [Agents]
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
 *         description: Agent deactivated successfully
 */
router.post('/:id/deactivate', async (req, res) => {
  try {
    const userId = req.user.userId;
    const agentId = req.params.id;

    const result = executeQuery(`
      UPDATE agents 
      SET is_active = 0, status = 'stopped', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [agentId, userId]);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'Agent not found or access denied'
      });
    }

    res.json({
      message: 'Agent deactivated successfully'
    });

  } catch (error) {
    logger.error('Deactivate agent error:', error);
    res.status(500).json({
      error: 'Failed to deactivate agent',
      message: 'An error occurred while deactivating agent'
    });
  }
});

export default router; 