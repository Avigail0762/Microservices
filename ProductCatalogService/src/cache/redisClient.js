const { createClient } = require('redis');

let client;
let connected = false;

function getRedisClient() {
  if (!client) {
    const host = process.env.REDIS_HOST || 'redis';
    const port = Number(process.env.REDIS_PORT || 6379);
    client = createClient({
      socket: { host, port }
    });

    client.on('ready', () => {
      connected = true;
      console.log(`Redis ready at ${host}:${port}`);
    });

    client.on('end', () => {
      connected = false;
      console.warn('Redis connection closed');
    });

    client.on('error', err => {
      connected = false;
      console.error('Redis error:', err.message);
    });

    client.on('reconnecting', () => {
      console.warn('Redis reconnecting...');
    });
  }

  return client;
}

async function connectRedis() {
  const redis = getRedisClient();
  if (!redis.isOpen) {
    try {
      await redis.connect();
    } catch (err) {
      connected = false;
      console.error('Redis connect failed; continuing without cache:', err.message);
    }
  }
}

function isRedisConnected() {
  return connected;
}

module.exports = {
  getRedisClient,
  connectRedis,
  isRedisConnected
};
