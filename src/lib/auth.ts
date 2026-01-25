import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from 'drizzle-orm/d1';
import * as schema from "@/db/schema";
import { env } from 'cloudflare:workers';

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    socialProviders: {
        google: {
            prompt: "select_account",
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
    database: drizzleAdapter(drizzle(env.meriksirat_d1 as D1Database, { schema }), {
        provider: "sqlite",
    }),
    plugins: [
        tanstackStartCookies(),
    ],
});