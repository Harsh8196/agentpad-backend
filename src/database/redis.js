import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

let redisClient = null;
let redisEnabled = false;

export const connectRedis = async () => {
  // Check if Redis is enabled via environment variable
  if (process.env.REDIS_ENABLED === 'false' || !process.env.REDIS_HOST) {
    logger.info('Redis disabled or not configured, skipping Redis connection');
    return null;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD || undefined,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.warn('Redis server refused connection, continuing without Redis');
          return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.warn('Redis retry time exhausted, continuing without Redis');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.warn('Redis max retry attempts reached, continuing without Redis');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      logger.warn('Redis Client Error:', err);
      redisEnabled = false;
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis client connected');
      redisEnabled = true;
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready');
      redisEnabled = true;
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
      redisEnabled = false;
    });

    await redisClient.connect();
    redisEnabled = true;
    return redisClient;
  } catch (error) {
    logger.warn('❌ Failed to connect to Redis, continuing without Redis:', error.message);
    redisEnabled = false;
    return null;
  }
};

export const getRedisClient = () => {
  if (!redisClient || !redisEnabled) {
    return null;
  }
  return redisClient;
};

export const isRedisEnabled = () => {
  return redisEnabled && redisClient !== null;
};

// Cache helper functions
export const setCache = async (key, value, ttl = 3600) => {
  if (!isRedisEnabled()) {
    return; // Silently skip if Redis is not available
  }
  
  try {
    const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value;
    await redisClient.setEx(key, ttl, serializedValue);
    logger.debug(`Cache set: ${key}`);
  } catch (error) {
    logger.warn('Cache set error:', error.message);
  }
};

export const getCache = async (key) => {
  if (!isRedisEnabled()) {
    return null; // Return null if Redis is not available
  }
  
  try {
    const value = await redisClient.get(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  } catch (error) {
    logger.warn('Cache get error:', error.message);
    return null;
  }
};

export const deleteCache = async (key) => {
  if (!isRedisEnabled()) {
    return; // Silently skip if Redis is not available
  }
  
  try {
    await redisClient.del(key);
    logger.debug(`Cache deleted: ${key}`);
  } catch (error) {
    logger.warn('Cache delete error:', error.message);
  }
};

export const clearCache = async (pattern = '*') => {
  if (!isRedisEnabled()) {
    return; // Silently skip if Redis is not available
  }
  
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.debug(`Cache cleared: ${keys.length} keys`);
    }
  } catch (error) {
    logger.warn('Cache clear error:', error.message);
  }
};

export const closeRedis = async () => {
  if (redisClient && redisEnabled) {
    await redisClient.quit();
    logger.info('Redis connection closed');
    redisEnabled = false;
  }
}; 