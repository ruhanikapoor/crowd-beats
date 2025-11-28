import "dotenv/config";

import { Redis } from "ioredis";

const redisURL = process.env.REDIS_URL || "http://localhost:6379";

export const redis = new Redis(redisURL);
