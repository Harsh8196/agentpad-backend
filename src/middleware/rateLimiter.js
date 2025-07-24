import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger.js';

// Create rate limiter instances
const generalRateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => {
    // Use IP address as key, or user ID if authenticated
    return req.user ? req.user.id : req.ip;
  },
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // Number of requests
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // Per 15 minutes
  blockDuration: 60 * 15, // Block for 15 minutes
});

// Strict rate limiter for authentication endpoints
const authRateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 5, // 5 attempts
  duration: 60 * 15, // Per 15 minutes
  blockDuration: 60 * 60, // Block for 1 hour
});

// API rate limiter for different endpoints
const apiRateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => {
    return req.user ? req.user.id : req.ip;
  },
  points: 1000, // 1000 requests
  duration: 60 * 60, // Per hour
  blockDuration: 60 * 30, // Block for 30 minutes
});

export const rateLimiter = async (req, res, next) => {
  try {
    await generalRateLimiter.consume(req.user ? req.user.id : req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: secs
    });
  }
};

export const authRateLimit = async (req, res, next) => {
  try {
    await authRateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'Too Many Authentication Attempts',
      message: 'Too many failed authentication attempts. Please try again later.',
      retryAfter: secs
    });
    
    logger.warn('Rate limit exceeded for authentication', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      retryAfter: secs
    });
  }
};

export const apiRateLimit = async (req, res, next) => {
  try {
    await apiRateLimiter.consume(req.user ? req.user.id : req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      error: 'API Rate Limit Exceeded',
      message: 'API rate limit exceeded. Please try again later.',
      retryAfter: secs
    });
    
    logger.warn('API rate limit exceeded', {
      userId: req.user?.id,
      ip: req.ip,
      endpoint: req.originalUrl,
      retryAfter: secs
    });
  }
};

// Reset rate limit for successful authentication
export const resetAuthRateLimit = async (req, res, next) => {
  try {
    await authRateLimiter.delete(req.ip);
    next();
  } catch (error) {
    logger.error('Failed to reset auth rate limit:', error);
    next();
  }
}; 