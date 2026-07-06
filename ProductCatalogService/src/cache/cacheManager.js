const { getRedisClient, isRedisConnected } = require('./redisClient');

const DEFAULT_TTL_SECONDS = Number(process.env.REDIS_TTL_DEFAULT || 120);

function safeCacheKeyPart(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, '-');
}

async function getOrLoad(key, ttlSeconds, loader, context = 'unknown') {
  if (!isRedisConnected()) {
    console.log(`CACHE_BYPASS context=${context} reason=redis_unavailable key=${key}`);
    return loader();
  }

  const redis = getRedisClient();

  try {
    const cached = await redis.get(key);
    if (cached) {
      console.log(`CACHE_HIT context=${context} key=${key}`);
      return JSON.parse(cached);
    }

    console.log(`CACHE_MISS context=${context} key=${key}`);
    const fresh = await loader();
    if (fresh !== undefined) {
      const ttl = Number(ttlSeconds || DEFAULT_TTL_SECONDS);
      await redis.set(key, JSON.stringify(fresh), { EX: ttl });
      console.log(`CACHE_SET context=${context} key=${key} ttl=${ttl}`);
    }
    return fresh;
  } catch (err) {
    console.error(`CACHE_ERROR context=${context} key=${key} message=${err.message}`);
    return loader();
  }
}

async function del(key, reason = 'unspecified') {
  if (!isRedisConnected()) return;

  try {
    const redis = getRedisClient();
    await redis.del(key);
    console.log(`CACHE_INVALIDATE key=${key} reason=${reason}`);
  } catch (err) {
    console.error(`CACHE_INVALIDATE_ERROR key=${key} reason=${reason} message=${err.message}`);
  }
}

async function delMany(keys, reason = 'unspecified') {
  if (!isRedisConnected() || !keys || keys.length === 0) return;

  try {
    const redis = getRedisClient();
    await redis.del(keys);
    console.log(`CACHE_INVALIDATE_BULK count=${keys.length} reason=${reason}`);
  } catch (err) {
    console.error(`CACHE_INVALIDATE_BULK_ERROR reason=${reason} message=${err.message}`);
  }
}

async function delByPattern(pattern, reason = 'unspecified') {
  if (!isRedisConnected()) return;

  try {
    const redis = getRedisClient();
    const keys = [];
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length > 0) {
      await redis.del(keys);
    }

    console.log(`CACHE_INVALIDATE_PATTERN pattern=${pattern} count=${keys.length} reason=${reason}`);
  } catch (err) {
    console.error(`CACHE_INVALIDATE_PATTERN_ERROR pattern=${pattern} reason=${reason} message=${err.message}`);
  }
}

module.exports = {
  getOrLoad,
  del,
  delMany,
  delByPattern,
  safeCacheKeyPart
};
