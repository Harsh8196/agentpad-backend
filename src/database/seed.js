import bcrypt from 'bcrypt';
import { executeQuery } from './connection.js';
import { logger } from '../utils/logger.js';

const seedDatabase = async () => {
  try {
    logger.info('🌱 Starting database seeding...');

    // Check if admin user already exists
    const existingAdmin = executeQuery('SELECT id FROM users WHERE email = ?', ['admin@agentpad.com']);
    
    if (existingAdmin.length > 0) {
      logger.info('✅ Admin user already exists, skipping user creation');
    } else {
      // Create admin user
      logger.info('Creating admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      executeQuery(`
        INSERT INTO users (email, password_hash, first_name, last_name, username, role, is_active, email_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'admin@agentpad.com',
        hashedPassword,
        'Admin',
        'User',
        'admin',
        'admin',
        1,
        1
      ]);
      
      logger.info('✅ Admin user created');
    }

    // Create sample flow
    logger.info('Creating sample flow...');
    const sampleFlowData = JSON.stringify({
      nodes: [
        {
          id: '1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Start' }
        },
        {
          id: '2',
          type: 'ai_agent',
          position: { x: 300, y: 100 },
          data: { 
            label: 'AI Agent',
            model: 'gpt-4',
            prompt: 'Analyze the input and provide insights'
          }
        },
        {
          id: '3',
          type: 'end',
          position: { x: 500, y: 100 },
          data: { label: 'End' }
        }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' }
      ]
    });

    const adminUser = executeQuery('SELECT id FROM users WHERE email = ?', ['admin@agentpad.com']);
    const adminUserId = adminUser[0].id;

    executeQuery(`
      INSERT INTO flows (user_id, name, description, flow_data, is_active, is_public)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      adminUserId,
      'Sample Trading Agent',
      'A sample AI agent for trading analysis',
      sampleFlowData,
      1,
      1
    ]);

    logger.info('✅ Sample flow created');

    // Create sample agent
    logger.info('Creating sample agent...');
    const sampleAgentConfig = JSON.stringify({
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 1000,
      system_prompt: 'You are a helpful AI assistant for trading analysis.'
    });

    const sampleFlow = executeQuery('SELECT id FROM flows WHERE name = ?', ['Sample Trading Agent']);
    const sampleFlowId = sampleFlow[0].id;

    executeQuery(`
      INSERT INTO agents (user_id, flow_id, name, description, agent_type, configuration, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminUserId,
      sampleFlowId,
      'Trading Analysis Agent',
      'AI agent for analyzing trading data',
      'openai',
      sampleAgentConfig,
      1,
      'idle'
    ]);

    logger.info('✅ Sample agent created');

    // Create sample templates
    logger.info('Creating sample templates...');
    
    const template1Data = JSON.stringify({
      nodes: [
        { id: '1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
        { id: '2', type: 'webhook', position: { x: 300, y: 100 }, data: { label: 'Webhook Trigger' } },
        { id: '3', type: 'ai_agent', position: { x: 500, y: 100 }, data: { label: 'Process Data' } },
        { id: '4', type: 'end', position: { x: 700, y: 100 }, data: { label: 'End' } }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' }
      ]
    });

    const template2Data = JSON.stringify({
      nodes: [
        { id: '1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
        { id: '2', type: 'condition', position: { x: 300, y: 100 }, data: { label: 'Check Condition' } },
        { id: '3', type: 'ai_agent', position: { x: 500, y: 50 }, data: { label: 'Path A' } },
        { id: '4', type: 'ai_agent', position: { x: 500, y: 150 }, data: { label: 'Path B' } },
        { id: '5', type: 'end', position: { x: 700, y: 100 }, data: { label: 'End' } }
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e2-4', source: '2', target: '4' },
        { id: 'e3-5', source: '3', target: '5' },
        { id: 'e4-5', source: '4', target: '5' }
      ]
    });

    executeQuery(`
      INSERT INTO templates (name, description, category, flow_data, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'Webhook Processor',
      'Template for processing webhook data with AI',
      'automation',
      template1Data,
      1,
      adminUserId
    ]);

    executeQuery(`
      INSERT INTO templates (name, description, category, flow_data, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'Conditional Flow',
      'Template with conditional logic and branching',
      'logic',
      template2Data,
      1,
      adminUserId
    ]);

    logger.info('✅ Sample templates created');

    // Create sample execution
    logger.info('Creating sample execution...');
    const sampleFlowForExecution = executeQuery('SELECT id FROM flows WHERE name = ?', ['Sample Trading Agent']);
    const sampleFlowIdForExecution = sampleFlowForExecution[0].id;

    executeQuery(`
      INSERT INTO executions (user_id, flow_id, status, input_data, output_data, started_at, completed_at, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminUserId,
      sampleFlowIdForExecution,
      'completed',
      JSON.stringify({ input: 'Sample trading data' }),
      JSON.stringify({ result: 'Analysis completed successfully' }),
      new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      new Date().toISOString(),
      5000 // 5 seconds
    ]);

    logger.info('✅ Sample execution created');

    logger.info('🎉 Database seeding completed successfully!');
    logger.info('📧 Admin email: admin@agentpad.com');
    logger.info('🔑 Admin password: admin123');

  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    throw error;
  }
};

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      logger.info('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export default seedDatabase; 