import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSession, createDemoUser, getUser, hashPassword, rateLimitAuth, setSession, verifyPassword } from "@/lib/auth";
import { ApiError, assertSameOrigin, errorResponse } from "@/lib/api";
import { createSeededUser } from "@/lib/seed";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const authSchema = z.object({
  action: z.enum(["signin", "signup", "demo"]),
  name: z.string().trim().min(2, "Please enter your name.").max(100).optional(),
  email: z.string().trim().email("Please enter a valid email address.").max(254).transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(128).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimitAuth(request);
    const input = authSchema.parse(await request.json());
    let user;
    if (input.action === "demo") user = await createDemoUser();
    else {
      if (!input.email || !input.password) throw new ApiError("Please enter your email and password.");
      const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (input.action === "signin") {
        if (!existing?.passwordHash || !(await verifyPassword(input.password, existing.passwordHash))) throw new ApiError("That email and password don't match. Please try again.", 401);
        user = existing;
      } else {
        if (!input.name) throw new ApiError("Please enter your name.");
        if (existing) throw new ApiError("An account already exists with that email. Try signing in.", 409);
        const passwordHash = await hashPassword(input.password);
        const current = await getUser();
        if (current?.isDemo) {
          [user] = await db.update(users).set({ name: input.name, email: input.email, passwordHash, isDemo: false }).where(eq(users.id, current.id)).returning();
        } else user = await createSeededUser(input.name, input.email, passwordHash, false);
      }
    }
    await setSession(user.id, request);
    return Response.json(await getWorkspace(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession(request);
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
