import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSession, requireUser } from "@/lib/auth";
import { assertSameOrigin, errorResponse } from "@/lib/api";
import { publicUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";
const profileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  dailyGoal: z.number().int().min(1).max(20),
  timezone: z.string().max(80).refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Please select a valid timezone."),
}).strict();

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const input = profileSchema.parse(await request.json());
    const [updated] = await db.update(users).set(input).where(eq(users.id, user.id)).returning();
    return Response.json(publicUser(updated));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await clearSession(request);
    await db.delete(users).where(eq(users.id, user.id));
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
