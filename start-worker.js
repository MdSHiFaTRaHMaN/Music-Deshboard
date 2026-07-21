import "dotenv/config"; // Load .env.local if available
import { worker } from "./src/workers/musicWorker.js";

console.log("Starting background worker for music generation...");

// Handle graceful shutdown
const shutdown = async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
