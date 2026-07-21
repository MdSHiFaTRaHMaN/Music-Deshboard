import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Order from "@/models/Order";
import Notification from "@/models/Notification";
import Customer from "@/models/Customer";
import { getSettings } from "@/lib/getSettings";
import { withCORS, handleOptions } from "@/lib/cors";
import { checkAbandonedCart } from "@/lib/abandonedCartChecker";
import { encryptTaskId } from "@/lib/encryption";
import { musicQueue } from "@/lib/queue";
import { verifyTurnstile, checkRateLimit, checkDailyGenerationLimit } from "@/lib/security";

// Preflight — the browser sends this automatically before the real POST.
export async function OPTIONS(request) {
  return handleOptions(request);
}

export async function POST(request) {
  const origin = request.headers.get("origin") || "";
  try {
    // ── Security: Origin / Referer check ──
    const settings = await getSettings();
    const originHeader = request.headers.get("origin") || "";
    const refererHeader = request.headers.get("referer") || "";
    const allowedOrigins = [
      settings.shopUrl1,
      settings.shopUrl2,
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "http://localhost:3001",
    ].filter(Boolean);

    const isAllowed = allowedOrigins.some((allowed) => {
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = originHeader ? new URL(originHeader) : null;
        const refererUrl = refererHeader ? new URL(refererHeader) : null;
        const hostMatch = (url) => url && url.host === allowedUrl.host;
        return hostMatch(originUrl) || hostMatch(refererUrl);
      } catch (e) {
        // Fallback to simple startsWith if parsing fails
        return originHeader.startsWith(allowed) || refererHeader.startsWith(allowed);
      }
    });

    if (!isAllowed) {
      return withCORS(
        NextResponse.json(
          { error: "Unauthorized: Request origin not allowed" },
          { status: 403 }
        ),
        origin
      );
    }

    // ── Use API key from DB (fallback to env) ──
    const apiKey = settings.sunoApiKey;
    if (!apiKey) {
      return withCORS(
        NextResponse.json({ error: "SUNO API Key not configured. Please set it in Settings." }, { status: 500 }),
        origin
      );
    }

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown-ip";

    // Helper to log suspicious behavior and IP
    const flagCustomer = async (email) => {
      if (!email) return;
      try {
        await dbConnect();
        await Customer.findOneAndUpdate(
          { email },
          { 
            $inc: { securityFlags: 1 },
            $addToSet: { knownIps: ip }
          },
          { upsert: true }
        );
      } catch (e) {
        console.error("Failed to flag customer", e);
      }
    };

    // ── Security: Honeypot Check ──
    if (hp_website) {
      console.warn("[Security] Bot detected via honeypot.");
      await flagCustomer(formData?.email);
      return withCORS(NextResponse.json({ error: "Invalid request format." }, { status: 400 }), origin);
    }

    // ── Security: Turnstile Verification ──
    if (!turnstileToken) {
      return withCORS(NextResponse.json({ error: "Please wait a moment for the security check to load, or verify you are human before continuing." }, { status: 400 }), origin);
    }
    const isHuman = await verifyTurnstile(turnstileToken);
    if (!isHuman) {
      await flagCustomer(formData?.email);
      return withCORS(NextResponse.json({ error: "Human verification failed. Please refresh the page and try again." }, { status: 400 }), origin);
    }

    // ── Security: Rate Limiting ──
    const isRateAllowed = await checkRateLimit(ip, visitorId, 5, 3600); // 5 requests per hour
    if (!isRateAllowed) {
      await flagCustomer(formData?.email);
      return withCORS(NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 }), origin);
    }

    if (!lyrics) {
      return withCORS(NextResponse.json({ error: "Lyrics are required" }, { status: 400 }), origin);
    }
    if (!formData || !formData.email) {
      return withCORS(
        NextResponse.json({ error: "Email is required to save the generated order" }, { status: 400 }),
        origin
      );
    }

    // ── Security: Check if Customer is Blocked (by Email or IP) ──
    await dbConnect();
    const customer = await Customer.findOne({
      $or: [
        { email: formData?.email },
        { knownIps: ip }
      ]
    });
    
    if (customer && customer.isBlocked) {
      const reason = customer.blockReason || "Your account has been restricted from generating music.";
      return withCORS(
        NextResponse.json({ error: reason }, { status: 403 }),
        origin
      );
    }

    // ── Security: Daily Generation Limit ──
    const isDailyAllowed = await checkDailyGenerationLimit(formData.email, 10); // 10 generations per day
    if (!isDailyAllowed) {
      await flagCustomer(formData.email);
      return withCORS(NextResponse.json({ error: "Daily generation limit reached for this email." }, { status: 429 }), origin);
    }

    // POST /api/v1/generate — required fields: customMode, instrumental, callBackUrl, model
    // In customMode=true + instrumental=false: style, title, and prompt (lyrics) are all required
    const callBackUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/api/suno/callback`;

    // Truncate to respect V4 limits: prompt max 3000 chars, style max 200 chars, title max 80 chars
    const safeStyle = (style || "Pop").substring(0, 200);
    const safeTitle = (title || "My Custom Song").substring(0, 80);
    const safeLyrics = lyrics.substring(0, 3000);

    const body = {
      prompt: safeLyrics,   // used as exact lyrics in custom mode
      style: safeStyle,
      title: safeTitle,
      customMode: true,     // use our exact lyrics
      instrumental: false,  // we want vocals
      model: "V4_5ALL",          // reliable model
      callBackUrl,          // required by API
    };

    console.log("[generate-music] Enqueuing job for generation:", formData.email);

    // Instead of hitting Suno directly, we enqueue a job.
    // We generate a local taskId since Suno won't give us one until the worker hits it.
    const taskId = crypto.randomUUID();

    // Save pending order to Database FIRST, before pushing to queue, so the worker can find it.
    if (taskId) {
      try {
        await dbConnect();
        const newOrder = await Order.create({
          taskId: taskId,
          email: formData.email,
          occasion: formData.occasion,
          forWho: formData.forWho,
          recipientName: formData.recipientName,
          genre: formData.genre,
          voice: formData.voice,
          mood: formData.mood,
          lyrics: formData.lyrics || lyrics,
          status: "created"
        });

        // Add IP to knownIps for Customer
        await Customer.findOneAndUpdate(
          { email: formData.email },
          { $addToSet: { knownIps: ip } },
          { upsert: true }
        );

        // Create a notification
        await Notification.create({
          title: "Music Generation Started",
          message: `${formData.email} started generating a song`,
          type: "music_started",
          link: `/ordered-musics/${newOrder._id}`
        });
        // Launch background process for abandoned carts
        if (resumeBaseUrl) {
          checkAbandonedCart(newOrder._id, taskId, formData.email, resumeBaseUrl);
        }

        // Add job to BullMQ
        await musicQueue.add("generate-suno", {
          taskId,
          orderId: newOrder._id,
          sunoBody: body,
          apiKey: apiKey,
          apiBase: settings.sunoApiBase,
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false
        });

      } catch (dbErr) {
        console.error("[generate-music] DB Error or Queue Error:", dbErr);
        return withCORS(NextResponse.json({ error: "Failed to process request." }, { status: 500 }), origin);
      }
    }

    return withCORS(NextResponse.json({ taskId: encryptTaskId(taskId) }), origin);
  } catch (error) {
    console.error("[generate-music] Error:", error);
    return withCORS(NextResponse.json({ error: "Internal server error" }, { status: 500 }), origin);
  }
}