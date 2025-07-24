import { getDatabase, tableExists, executeQuery } from './connection.js';
import { logger } from '../utils/logger.js';

const createTables = async () => {
  const database = getDatabase();

  try {
    // Users table
    if (!tableExists('users')) {
      logger.info('Creating users table...');
      executeQuery(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          username TEXT UNIQUE,
          role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
          is_active BOOLEAN DEFAULT 1,
          email_verified BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      logger.info('✅ Users table created');
    }

    // Refresh tokens table
    if (!tableExists('refresh_tokens')) {
      logger.info('Creating refresh_tokens table...');
      executeQuery(`
        CREATE TABLE refresh_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);
      logger.info('✅ Refresh tokens table created');
    }

    // Flows table
    if (!tableExists('flows')) {
      logger.info('Creating flows table...');
      executeQuery(`
        CREATE TABLE flows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          flow_data TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          is_public BOOLEAN DEFAULT 0,
          version TEXT DEFAULT '1.0.0',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);
      logger.info('✅ Flows table created');
    }

    // Agents table
    if (!tableExists('agents')) {
      logger.info('Creating agents table...');
      executeQuery(`
        CREATE TABLE agents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          flow_id INTEGER,
          name TEXT NOT NULL,
          description TEXT,
          agent_type TEXT NOT NULL,
          configuration TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'stopped', 'error')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (flow_id) REFERENCES flows (id) ON DELETE SET NULL
        )
      `);
      logger.info('✅ Agents table created');
    }

    // Templates table
    if (!tableExists('templates')) {
      logger.info('Creating templates table...');
      executeQuery(`
        CREATE TABLE templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          flow_data TEXT NOT NULL,
          is_public BOOLEAN DEFAULT 1,
          created_by INTEGER,
          usage_count INTEGER DEFAULT 0,
          rating REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
        )
      `);
      logger.info('✅ Templates table created');
    }

    // Executions table
    if (!tableExists('executions')) {
      logger.info('Creating executions table...');
      executeQuery(`
        CREATE TABLE executions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          flow_id INTEGER NOT NULL,
          agent_id INTEGER,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          input_data TEXT,
          output_data TEXT,
          error_message TEXT,
          started_at DATETIME,
          completed_at DATETIME,
          duration_ms INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (flow_id) REFERENCES flows (id) ON DELETE CASCADE,
          FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE SET NULL
        )
      `);
      logger.info('✅ Executions table created');
    }

    // Execution logs table
    if (!tableExists('execution_logs')) {
      logger.info('Creating execution_logs table...');
      executeQuery(`
        CREATE TABLE execution_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (execution_id) REFERENCES executions (id) ON DELETE CASCADE
        )
      `);
      logger.info('✅ Execution logs table created');
    }

    // API keys table
    if (!tableExists('api_keys')) {
      logger.info('Creating api_keys table...');
      executeQuery(`
        CREATE TABLE api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          key_hash TEXT UNIQUE NOT NULL,
          permissions TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          last_used DATETIME,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);
      logger.info('✅ API keys table created');
    }

    // Webhooks table
    if (!tableExists('webhooks')) {
      logger.info('Creating webhooks table...');
      executeQuery(`
        CREATE TABLE webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          url TEXT NOT NULL,
          events TEXT NOT NULL,
          secret TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);
      logger.info('✅ Webhooks table created');
    }

    // Create indexes for better performance
    logger.info('Creating indexes...');
    
    // Users indexes
    executeQuery('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)');
    
    // Flows indexes
    executeQuery('CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows (user_id)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_flows_is_public ON flows (is_public)');
    
    // Agents indexes
    executeQuery('CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents (user_id)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status)');
    
    // Executions indexes
    executeQuery('CREATE INDEX IF NOT EXISTS idx_executions_user_id ON executions (user_id)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_executions_flow_id ON executions (flow_id)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_executions_status ON executions (status)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_executions_created_at ON executions (created_at)');
    
    // Execution logs indexes
    executeQuery('CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_id ON execution_logs (execution_id)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs (timestamp)');
    
    // Refresh tokens indexes
    executeQuery('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id)');
    executeQuery('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token)');
    
    logger.info('✅ All indexes created');

    logger.info('🎉 Database migration completed successfully!');
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTables()
    .then(() => {
      logger.info('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default createTables; 