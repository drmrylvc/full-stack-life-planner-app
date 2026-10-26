import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { createSeededUser } from "@/lib/seed";
import { ApiError } from "@/lib/api";

const scryptAsync = promisify(scrypt);
const COOKIE = "daywell_session";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export type AuthUser = typeof users.$inferSelect;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function getUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [session] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  return session?.user || null;
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) throw new ApiError("Your session has expired. Please sign in again.", 401);
  return user;
}

function isSecureRequest(request?: Request): boolean {
  if (!request) return false;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const host = (request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host).toLowerCase().replace(/:\d+$/, "");
  const loopback = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"].includes(host) || host.endsWith(".localhost");
  // Some TLS-terminating production proxies omit x-forwarded-proto.
  // Public production sessions remain Secure; local HTTP development still works.
  return url.protocol === "https:" || proto === "https" || (process.env.NODE_ENV === "production" && !loopback);
}

export async function clearSession(request?: Request) {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  const embedded = isSecureRequest(request) && request?.headers.get("x-daywell-embedded") === "1";
  if (embedded) store.set(COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/", maxAge: 0 });
  else store.delete(COOKIE);
}

export async function setSession(userId: string, request: Request) {
  await clearSession(request);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  const secure = isSecureRequest(request);
  const embedded = secure && request.headers.get("x-daywell-embedded") === "1";
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure, sameSite: embedded ? "none" : "lax", partitioned: embedded, path: "/", expires: expiresAt });
}

export async function createDemoUser() {
  return createSeededUser("Alex Morgan", `demo-${randomUUID()}@daywell.local`, null, true);
}

const attempts = new Map<string, { count: number; reset: number }>();
export function rateLimitAuth(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const existing = attempts.get(key);
  if (existing && existing.reset > now && existing.count >= 20) throw new ApiError("A few too many attempts. Please try again in 15 minutes.", 429);
  if (!existing || existing.reset <= now) attempts.set(key, { count: 1, reset: now + 15 * 60 * 1000 });
  else existing.count += 1;
  if (attempts.size > 1000) for (const [ip, value] of attempts) if (value.reset <= now) attempts.delete(ip);
}
