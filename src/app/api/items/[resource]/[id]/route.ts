import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { areas, items } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, areaInputSchema, assertSameOrigin, errorResponse, idSchema, itemPatchSchema, kindSchema } from "@/lib/api";
import { deletePlannerItem, updatePlannerItem } from "@/lib/item-mutations";
import { serializeArea, serializeItem } from "@/lib/workspace";

type Context = { params: Promise<{ resource: string; id: string }> };
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { resource, id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    if (resource === "area") {
      const [area] = await db.select().from(areas).where(and(eq(areas.id, id), eq(areas.userId, user.id))).limit(1);
      if (!area) throw new ApiError("This life area could not be found.", 404);
      return Response.json(serializeArea(area));
    }
    const kind = kindSchema.parse(resource);
    const [item] = await db.select().from(items).where(and(eq(items.id, id), eq(items.userId, user.id), eq(items.kind, kind))).limit(1);
    if (!item) throw new ApiError("This item could not be found.", 404);
    return Response.json(serializeItem(item));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { resource, id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    if (resource === "area") {
      const input = areaInputSchema.parse(await request.json());
      const [area] = await db.update(areas).set(input).where(and(eq(areas.id, id), eq(areas.userId, user.id))).returning();
      if (!area) throw new ApiError("This life area could not be found.", 404);
      return Response.json(serializeArea(area));
    }
    const kind = kindSchema.parse(resource);
    const input = itemPatchSchema.parse(await request.json());
    return Response.json(await updatePlannerItem(user.id, kind, id, input));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { resource, id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    if (resource === "area") {
      const [deleted] = await db.delete(areas).where(and(eq(areas.id, id), eq(areas.userId, user.id))).returning({ id: areas.id });
      if (!deleted) throw new ApiError("This life area could not be found.", 404);
      return Response.json({ ok: true, removedIds: [id] });
    }
    const kind = kindSchema.parse(resource);
    const wholeSeries = new URL(request.url).searchParams.get("series") === "1";
    const removedIds = await deletePlannerItem(user.id, kind, id, wholeSeries);
    return Response.json({ ok: true, removedIds });
  } catch (error) { return errorResponse(error); }
}
