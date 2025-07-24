import express from 'express';
import { executeQuery } from '../database/connection.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /templates:
 *   get:
 *     summary: Get all public templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates retrieved successfully
 */
router.get('/', async (req, res) => {
  try {
    const templates = executeQuery(`
      SELECT id, name, description, category, is_public, usage_count, rating, created_at
      FROM templates 
      WHERE is_public = 1
      ORDER BY usage_count DESC, rating DESC
    `);

    res.json({ templates });

  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({
      error: 'Failed to get templates',
      message: 'An error occurred while retrieving templates'
    });
  }
});

/**
 * @swagger
 * /templates/{id}:
 *   get:
 *     summary: Get a specific template by ID
 *     tags: [Templates]
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
 *         description: Template retrieved successfully
 *       404:
 *         description: Template not found
 */
router.get('/:id', async (req, res) => {
  try {
    const templateId = req.params.id;

    const templates = executeQuery(`
      SELECT * FROM templates WHERE id = ? AND is_public = 1
    `, [templateId]);

    if (templates.length === 0) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'Template not found or not public'
      });
    }

    const template = templates[0];
    template.flow_data = JSON.parse(template.flow_data);

    res.json({ template });

  } catch (error) {
    logger.error('Get template error:', error);
    res.status(500).json({
      error: 'Failed to get template',
      message: 'An error occurred while retrieving template'
    });
  }
});

/**
 * @swagger
 * /templates/{id}/use:
 *   post:
 *     summary: Use a template to create a new flow
 *     tags: [Templates]
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
 *     responses:
 *       201:
 *         description: Flow created from template successfully
 */
router.post('/:id/use', async (req, res) => {
  try {
    const userId = req.user.userId;
    const templateId = req.params.id;
    const { name, description } = req.body;

    // Get template
    const templates = executeQuery(`
      SELECT * FROM templates WHERE id = ? AND is_public = 1
    `, [templateId]);

    if (templates.length === 0) {
      return res.status(404).json({
        error: 'Template not found',
        message: 'Template not found or not public'
      });
    }

    const template = templates[0];
    const flowData = JSON.parse(template.flow_data);

    // Create new flow from template
    const result = executeQuery(`
      INSERT INTO flows (user_id, name, description, flow_data, is_public, is_active, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      name || `${template.name} Copy`,
      description || template.description,
      JSON.stringify(flowData),
      0, // Private by default
      1,
      '1.0.0'
    ]);

    const flowId = result.lastInsertRowid;

    // Update template usage count
    executeQuery(`
      UPDATE templates 
      SET usage_count = usage_count + 1
      WHERE id = ?
    `, [templateId]);

    // Get created flow
    const flows = executeQuery(`
      SELECT id, name, description, flow_data, is_active, is_public, version, created_at, updated_at
      FROM flows WHERE id = ?
    `, [flowId]);

    const flow = flows[0];
    flow.flow_data = JSON.parse(flow.flow_data);

    res.status(201).json({
      message: 'Flow created from template successfully',
      flow
    });

  } catch (error) {
    logger.error('Use template error:', error);
    res.status(500).json({
      error: 'Failed to use template',
      message: 'An error occurred while using template'
    });
  }
});

export default router; 