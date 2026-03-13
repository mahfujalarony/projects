const { createClient } = require("redis");

let client = null; 
let connectPromise = null;
let connectAttempted = false;

const redisUrl = String(process.env.REDIS_URL || "").trim();

const canUseRedis = () => !!redisUrl;

const getClient = async () => {
  if (!canUseRedis()) return null;
  if (client?.isReady) return client;
  if (connectPromise) return connectPromise;
  if (connectAttempted && !client?.isOpen) return null;

  connectAttempted = true;
  client = createClient({ url: redisUrl });

  client.on("error", () => {
    // Keep silent to avoid log spam in request path.
  });

  connectPromise = client
    .connect()
    .then(() => client)
    .catch(() => null)
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

const redisGetJson = async (key) => {
  try {
    const c = await getClient();
    if (!c?.isReady) return null;
    const raw = await c.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const redisSetJson = async (key, value, ttlSeconds = 120) => {
  try {
    const c = await getClient();
    if (!c?.isReady) return false;
    const ttl = Math.max(1, Math.round(Number(ttlSeconds || 120)));
    await c.set(key, JSON.stringify(value), { EX: ttl });
    return true;
  } catch {
    return false;
  }
};

module.exports = {
  canUseRedis,
  redisGetJson,
  redisSetJson,
};

