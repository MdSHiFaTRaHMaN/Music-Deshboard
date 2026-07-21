import { Queue } from "bullmq";
import redis from "./redis";

export const musicQueue = new Queue("music-generation", { connection: redis });
