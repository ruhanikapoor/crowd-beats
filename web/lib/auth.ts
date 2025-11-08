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
      access_type: "offline",
      prompt: "select_account consent",
      display: "popup"
    },
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  logger: {
    disabled: false,
    disableColors: false,
    level: "info",
    log: (level, message, ...args) => {
      console.log(`[${level}] ${message}`, ...args);
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24 * 10, // 10 day
    freshAge: 0,
  },
  plugins: [nextCookies()],
});
