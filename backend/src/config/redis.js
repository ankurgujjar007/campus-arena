const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  if (redisClient?.isOpen) return redisClient;

  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('connect', () => console.log('Redis connected'));
    redisClient.on('error', (error) => console.error('Redis error:', error.message));
  }

  try {
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Redis connection failed:', error.message);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient?.isOpen) {
    throw new Error('Redis is not connected');
  }

  return redisClient;
};

module.exports = { connectRedis, getRedisClient };
