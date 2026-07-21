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
