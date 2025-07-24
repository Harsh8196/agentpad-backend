import express from 'express';
import bcrypt from 'bcrypt';
import { executeQuery } from '../database/connection.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;

    const users = executeQuery(`
      SELECT id, email, first_name, last_name, username, role, is_active, email_verified, created_at, updated_at
      FROM users WHERE id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    res.json({
      user: users[0]
    });

  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'An error occurred while retrieving profile'
    });
  }
});

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, username } = req.body;

    // Check if username is already taken
    if (username) {
      const existingUser = executeQuery('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (existingUser.length > 0) {
        return res.status(400).json({
          error: 'Username taken',
          message: 'This username is already taken'
        });
      }
    }

    // Update user profile
    executeQuery(`
      UPDATE users 
      SET first_name = ?, last_name = ?, username = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [firstName, lastName, username, userId]);

    // Get updated user data
    const users = executeQuery(`
      SELECT id, email, first_name, last_name, username, role, is_active, email_verified, created_at, updated_at
      FROM users WHERE id = ?
    `, [userId]);

    res.json({
      message: 'Profile updated successfully',
      user: users[0]
    });

  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'An error occurred while updating profile'
    });
  }
});

/**
 * @swagger
 * /users/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 */
router.post('/change-password', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing passwords',
        message: 'Current password and new password are required'
      });
    }

    // Get current user
    const users = executeQuery('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Invalid password',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    executeQuery(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [hashedPassword, userId]);

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
      message: 'An error occurred while changing password'
    });
  }
});

/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user statistics
    const flowStats = executeQuery(`
      SELECT 
        COUNT(*) as total_flows,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_flows,
        COUNT(CASE WHEN is_public = 1 THEN 1 END) as public_flows
      FROM flows WHERE user_id = ?
    `, [userId]);

    const agentStats = executeQuery(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_agents,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_agents
      FROM agents WHERE user_id = ?
    `, [userId]);

    const executionStats = executeQuery(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
        AVG(duration_ms) as avg_duration
      FROM executions WHERE user_id = ?
    `, [userId]);

    res.json({
      flows: flowStats[0],
      agents: agentStats[0],
      executions: executionStats[0]
    });

  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: 'An error occurred while retrieving statistics'
    });
  }
});

export default router; 