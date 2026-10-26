import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ApiError, errorResponse, idSchema } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    const [file] = await db.select().from(items).where(and(eq(items.id, id), eq(items.userId, user.id), eq(items.kind, "file"))).limit(1);
    if (!file) throw new ApiError("This file could not be found.", 404);
    if (file.data.url) return Response.redirect(new URL(file.data.url, request.url));
    const content = file.data.content;
    if (!content) throw new ApiError("This file has no downloadable content.", 404);
    const buffer = Buffer.from(content.split(",")[1], "base64");
    const mimeType = file.data.mimeType || "application/octet-stream";
    const safeMime = /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(mimeType) ? mimeType : "application/octet-stream";
    const inline = new URL(request.url).searchParams.get("inline") === "1" && (safeMime === "application/pdf" || /^image\/(jpeg|png|webp|gif)$/.test(safeMime));
    const filename = file.title.replace(/[\r\n"\\]/g, "_");
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": safeMime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return errorResponse(error); }
}
