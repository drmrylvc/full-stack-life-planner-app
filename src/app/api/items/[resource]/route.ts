import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { areas, items } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, areaInputSchema, assertSameOrigin, errorResponse, itemInputSchema, kindSchema } from "@/lib/api";
import { createPlannerItem } from "@/lib/item-mutations";
import { serializeArea, serializeItem } from "@/lib/workspace";

type Context = { params: Promise<{ resource: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { resource } = await context.params;
    if (resource === "area") return Response.json((await db.select().from(areas).where(eq(areas.userId, user.id)).orderBy(asc(areas.sortOrder))).map(serializeArea));
    const kind = kindSchema.parse(resource);
    return Response.json((await db.select().from(items).where(and(eq(items.userId, user.id), eq(items.kind, kind)))).map(serializeItem));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { resource } = await context.params;
    if (resource === "area") {
      const input = areaInputSchema.parse(await request.json());
      const current = await db.select({ sortOrder: areas.sortOrder }).from(areas).where(eq(areas.userId, user.id));
      if (current.length >= 24) throw new ApiError("You can have up to 24 life areas.");
      const sortOrder = Math.max(-1, ...current.map((area) => area.sortOrder)) + 1;
      const [area] = await db.insert(areas).values({ ...input, userId: user.id, sortOrder }).returning();
      return Response.json(serializeArea(area), { status: 201 });
    }
    const kind = kindSchema.parse(resource);
    const input = itemInputSchema.parse(await request.json());
    return Response.json(await createPlannerItem(user.id, kind, input), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
