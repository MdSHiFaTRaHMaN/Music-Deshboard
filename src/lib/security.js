import redis from "./redis";

export async function verifyTurnstile(token) {
  if (!process.env.TURNSTILE_SECRET_KEY) {
    console.warn("[Security] TURNSTILE_SECRET_KEY is not set. Skipping Turnstile validation.");
    return true; // Skip if not configured in dev
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });

  const data = await response.json();
  return data.success;
}

export async function checkRateLimit(ip, visitorId, limit = 5, windowInSeconds = 3600) {
  if (limit === 0) return true; // 0 means unlimited
  
  const key = `ratelimit:${visitorId || ip}`;
  
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowInSeconds);
    }
    
    if (current > limit) {
      return false; // Rate limit exceeded
    }
    return true;
  } catch (err) {
    console.error("[RateLimit Error]:", err);
    return true; // Fallback to allowing if Redis fails
  }
}

export async function checkDailyGenerationLimit(email, limit = 10) {
  if (limit === 0) return true;
  
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const key = `dailylimit:${email}:${today}`;
  
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 24 * 60 * 60); // 24 hours
    }
    
    if (current > limit) {
      return false; // Limit exceeded
    }
    return true;
  } catch (err) {
    console.error("[DailyLimit Error]:", err);
    return true;
  }
}

/**
 * Checks all granular user limits (minute, hour, day, month).
 * A limit of 0 means unlimited.
 * Returns true if allowed, false if rejected.
 */
export async function checkUserRateLimits(email, limits) {
  if (!email) return true; // Can't limit what we can't identify

  const {
    rateLimitPerMinute = 0,
    rateLimitPerHour = 0,
    rateLimitPerDay = 10,
    rateLimitPerMonth = 0
  } = limits;

  const now = new Date();
  const minuteKey = `limit:${email}:min:${now.toISOString().substring(0, 16)}`; // YYYY-MM-DDTHH:mm
  const hourKey = `limit:${email}:hr:${now.toISOString().substring(0, 13)}`; // YYYY-MM-DDTHH
  const dayKey = `limit:${email}:day:${now.toISOString().substring(0, 10)}`; // YYYY-MM-DD
  const monthKey = `limit:${email}:month:${now.toISOString().substring(0, 7)}`; // YYYY-MM

  try {
    const pipeline = redis.pipeline();

    if (rateLimitPerMinute > 0) pipeline.incr(minuteKey);
    if (rateLimitPerHour > 0) pipeline.incr(hourKey);
    if (rateLimitPerDay > 0) pipeline.incr(dayKey);
    if (rateLimitPerMonth > 0) pipeline.incr(monthKey);

    const results = await pipeline.exec();
    let resultIdx = 0;

    // Helper to check and set expiry on first increment
    const processResult = async (key, limit, expiry) => {
      if (limit > 0) {
        const [err, current] = results[resultIdx++];
        if (!err && current === 1) {
          await redis.expire(key, expiry);
        }
        if (!err && current > limit) {
          return false;
        }
      }
      return true;
    };

    const minOk = await processResult(minuteKey, rateLimitPerMinute, 60);
    const hrOk = await processResult(hourKey, rateLimitPerHour, 3600);
    const dayOk = await processResult(dayKey, rateLimitPerDay, 86400);
    const monthOk = await processResult(monthKey, rateLimitPerMonth, 30 * 86400);

    return minOk && hrOk && dayOk && monthOk;
  } catch (err) {
    console.error("[checkUserRateLimits Error]:", err);
    return true; // fail open
  }
}
