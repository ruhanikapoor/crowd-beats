import { PrismaClient } from "@/prisma/generated/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

const prisma = new PrismaClient();
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      display: "popup",
      prompt: "select_account",
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  rateLimit: {
    enabled: true,
    max: 10,
    window: 60 * 60,
    modelName: "ratelimit",
    storage: "database",
  },
  logger: {
    disabled: false,
    disableColors: false,
    level: "info",
    log: (level, message, ...args) => {
      console.log(`[${level}] ${message}`, ...args);
    },
  },
  plugins: [nextCookies()],
});
