import crypto from "node:crypto";
import { cookies } from "next/headers";
import { requireServerEnv } from "@/lib/env";

const COOKIE_NAME = "fk_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sessionToken(): string {
  const secret = requireServerEnv("SESSION_SECRET");
  return crypto.createHmac("sha256", secret).update("admin-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  const expected = requireServerEnv("ADMIN_PASSWORD");
  return safeEqual(input, expected);
}

export async function createSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return false;
  return safeEqual(value, sessionToken());
}
