import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery } from '../database/connection.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /flows:
 *   get:
 *     summary: Get all flows for the current user
 *     tags: [Flows]
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
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of flows retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get flows with pagination
    const flows = executeQuery(`
      SELECT id, name, description, is_active, is_public, version, created_at, updated_at
      FROM flows ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Get total count
    const countResult = executeQuery(`
      SELECT COUNT(*) as total FROM flows ${whereClause}
    `, params);

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      flows,
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
    logger.error('Get flows error:', error);
    res.status(500).json({
      error: 'Failed to get flows',
      message: 'An error occurred while retrieving flows'
    });
  }
});

/**
 * @swagger
 * /flows/{id}:
 *   get:
 *     summary: Get a specific flow by ID
 *     tags: [Flows]
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
 *         description: Flow retrieved successfully
 *       404:
 *         description: Flow not found
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const flowId = req.params.id;

    const flows = executeQuery(`
      SELECT id, name, description, flow_data, is_active, is_public, version, created_at, updated_at
      FROM flows WHERE id = ? AND user_id = ?
    `, [flowId, userId]);

    if (flows.length === 0) {
      return res.status(404).json({
        error: 'Flow not found',
        message: 'Flow not found or access denied'
      });
    }

    const flow = flows[0];
    flow.flow_data = JSON.parse(flow.flow_data);

    res.json({ flow });

  } catch (error) {
    logger.error('Get flow error:', error);
    res.status(500).json({
      error: 'Failed to get flow',
      message: 'An error occurred while retrieving flow'
    });
  }
});

/**
 * @swagger
 * /flows:
 *   post:
 *     summary: Create a new flow
 *     tags: [Flows]
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
 *               - flowData
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               flowData:
 *                 type: object
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Flow created successfully
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, flowData, isPublic = false } = req.body;

    if (!name || !flowData) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name and flowData are required'
      });
    }

    const result = executeQuery(`
      INSERT INTO flows (user_id, name, description, flow_data, is_public, is_active, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, name, description || '', JSON.stringify(flowData), isPublic ? 1 : 0, 1, '1.0.0']);

    const flowId = result.lastInsertRowid;

    // Get created flow
    const flows = executeQuery(`
      SELECT id, name, description, flow_data, is_active, is_public, version, created_at, updated_at
      FROM flows WHERE id = ?
    `, [flowId]);

    const flow = flows[0];
    flow.flow_data = JSON.parse(flow.flow_data);

    res.status(201).json({
      message: 'Flow created successfully',
      flow
    });

  } catch (error) {
    logger.error('Create flow error:', error);
    res.status(500).json({
      error: 'Failed to create flow',
      message: 'An error occurred while creating flow'
    });
  }
});

/**
 * @swagger
 * /flows/{id}:
 *   put:
 *     summary: Update a flow
 *     tags: [Flows]
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
 *               flowData:
 *                 type: object
 *               isPublic:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Flow updated successfully
 *       404:
 *         description: Flow not found
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const flowId = req.params.id;
    const { name, description, flowData, isPublic, isActive } = req.body;

    // Check if flow exists and user owns it
    const existingFlows = executeQuery('SELECT id FROM flows WHERE id = ? AND user_id = ?', [flowId, userId]);
    if (existingFlows.length === 0) {
      return res.status(404).json({
        error: 'Flow not found',
        message: 'Flow not found or access denied'
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

    if (flowData !== undefined) {
      updateFields.push('flow_data = ?');
      params.push(JSON.stringify(flowData));
    }

    if (isPublic !== undefined) {
      updateFields.push('is_public = ?');
      params.push(isPublic ? 1 : 0);
    }

    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(flowId);

    // Update flow
    executeQuery(`
      UPDATE flows 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, params);

    // Get updated flow
    const flows = executeQuery(`
      SELECT id, name, description, flow_data, is_active, is_public, version, created_at, updated_at
      FROM flows WHERE id = ?
    `, [flowId]);

    const flow = flows[0];
    flow.flow_data = JSON.parse(flow.flow_data);

    res.json({
      message: 'Flow updated successfully',
      flow
    });

  } catch (error) {
    logger.error('Update flow error:', error);
    res.status(500).json({
      error: 'Failed to update flow',
      message: 'An error occurred while updating flow'
    });
  }
});

/**
 * @swagger
 * /flows/{id}:
 *   delete:
 *     summary: Delete a flow
 *     tags: [Flows]
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
 *         description: Flow deleted successfully
 *       404:
 *         description: Flow not found
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const flowId = req.params.id;

    // Check if flow exists and user owns it
    const existingFlows = executeQuery('SELECT id FROM flows WHERE id = ? AND user_id = ?', [flowId, userId]);
    if (existingFlows.length === 0) {
      return res.status(404).json({
        error: 'Flow not found',
        message: 'Flow not found or access denied'
      });
    }

    // Delete flow
    executeQuery('DELETE FROM flows WHERE id = ?', [flowId]);

    res.json({
      message: 'Flow deleted successfully'
    });

  } catch (error) {
    logger.error('Delete flow error:', error);
    res.status(500).json({
      error: 'Failed to delete flow',
      message: 'An error occurred while deleting flow'
    });
  }
});

/**
 * @swagger
 * /flows/{id}/execute:
 *   post:
 *     summary: Execute a flow
 *     tags: [Flows]
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
 *               inputData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Flow execution started successfully
 *       404:
 *         description: Flow not found
 */
router.post('/:id/execute', async (req, res) => {
  try {
    const userId = req.user.userId;
    const flowId = req.params.id;
    const { inputData = {} } = req.body;

    // Check if flow exists and user owns it
    const flows = executeQuery('SELECT id, name, flow_data FROM flows WHERE id = ? AND user_id = ?', [flowId, userId]);
    if (flows.length === 0) {
      return res.status(404).json({
        error: 'Flow not found',
        message: 'Flow not found or access denied'
      });
    }

    const flow = flows[0];

    // Create execution record
    const executionResult = executeQuery(`
      INSERT INTO executions (user_id, flow_id, status, input_data, started_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [userId, flowId, 'running', JSON.stringify(inputData)]);

    const executionId = executionResult.lastInsertRowid;

    // TODO: Implement actual flow execution logic
    // For now, just simulate execution
    setTimeout(async () => {
      try {
        const outputData = {
          result: 'Flow executed successfully',
          executionId,
          timestamp: new Date().toISOString()
        };

        executeQuery(`
          UPDATE executions 
          SET status = ?, output_data = ?, completed_at = CURRENT_TIMESTAMP, duration_ms = ?
          WHERE id = ?
        `, ['completed', JSON.stringify(outputData), 5000, executionId]);

        // Add execution log
        executeQuery(`
          INSERT INTO execution_logs (execution_id, level, message)
          VALUES (?, ?, ?)
        `, [executionId, 'info', 'Flow execution completed successfully']);

      } catch (error) {
        logger.error('Flow execution error:', error);
        
        executeQuery(`
          UPDATE executions 
          SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, ['failed', error.message, executionId]);

        executeQuery(`
          INSERT INTO execution_logs (execution_id, level, message)
          VALUES (?, ?, ?)
        `, [executionId, 'error', `Execution failed: ${error.message}`]);
      }
    }, 1000);

    res.json({
      message: 'Flow execution started',
      executionId,
      status: 'running'
    });

  } catch (error) {
    logger.error('Start flow execution error:', error);
    res.status(500).json({
      error: 'Failed to start flow execution',
      message: 'An error occurred while starting flow execution'
    });
  }
});

export default router; 