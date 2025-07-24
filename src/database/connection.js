import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create database directory if it doesn't exist
import fs from 'fs';
const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Database file path
const dbPath = path.join(dbDir, 'agentpad.db');

let db = null;

// Initialize database connection
const initializeDatabase = () => {
  try {
    // Create new database connection
    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');

    // Set busy timeout
    db.pragma('busy_timeout = 5000');

    logger.info(`SQLite database connected: ${dbPath}`);
    return db;
  } catch (error) {
    logger.error('Failed to connect to SQLite database:', error);
    throw error;
  }
};

// Get database instance
const getDatabase = () => {
  if (!db) {
    return initializeDatabase();
  }
  return db;
};

// Close database connection
const closeDatabase = () => {
  if (db) {
    db.close();
    db = null;
    logger.info('SQLite database connection closed');
  }
};

// Execute a query with parameters
const executeQuery = (sql, params = []) => {
  try {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(params);
    } else {
      const result = stmt.run(params);
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.changes,
      };
    }
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
};

// Execute a transaction
const executeTransaction = (queries) => {
  const database = getDatabase();
  const transaction = database.transaction((queries) => {
    const results = [];
    for (const query of queries) {
      const stmt = database.prepare(query.sql);
      if (query.sql.trim().toUpperCase().startsWith('SELECT')) {
        results.push(stmt.all(query.params || []));
      } else {
        results.push(stmt.run(query.params || []));
      }
    }
    return results;
  });

  try {
    return transaction(queries);
  } catch (error) {
    logger.error('Database transaction error:', error);
    throw error;
  }
};

// Check if table exists
const tableExists = (tableName) => {
  try {
    const database = getDatabase();
    const result = database.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(tableName);
    return !!result;
  } catch (error) {
    logger.error('Error checking table existence:', error);
    return false;
  }
};

// Get table info
const getTableInfo = (tableName) => {
  try {
    const database = getDatabase();
    return database.pragma(`table_info(${tableName})`);
  } catch (error) {
    logger.error('Error getting table info:', error);
    return [];
  }
};

// Backup database
const backupDatabase = (backupPath) => {
  try {
    const database = getDatabase();
    const backup = new Database(backupPath);
    database.backup(backup);
    backup.close();
    logger.info(`Database backed up to: ${backupPath}`);
  } catch (error) {
    logger.error('Database backup error:', error);
    throw error;
  }
};

export {
  getDatabase,
  initializeDatabase,
  closeDatabase,
  executeQuery,
  executeTransaction,
  tableExists,
  getTableInfo,
  backupDatabase,
  dbPath,
}; 