import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on("error", (err) => {
  console.error("[Redis Error]:", err);
});

export default redis;
