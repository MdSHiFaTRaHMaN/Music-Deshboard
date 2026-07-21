import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // Fallback to .env if something is there

async function start() {
  const { worker } = await import("./src/workers/musicWorker.js");
  
  console.log("Starting background worker for music generation...");
  
  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down worker...");
    await worker.close();
    process.exit(0);
  };
  
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(err => {
  console.error("Worker failed to start:", err);
});
