import { z, ZodError } from "zod";
import type { ItemData, ItemKind } from "@/lib/types";
import { dateISO, parseDate, streakFromHistory } from "@/lib/utils";
import { MAX_REPEATS, supportsRepeat } from "@/lib/recurrence";

export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const urlHost = new URL(request.url).host.toLowerCase();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  const host = request.headers.get("host")?.toLowerCase();
  const allowedHosts = new Set([urlHost, forwardedHost, host].filter(Boolean));
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && !allowedHosts.has(new URL(origin).host.toLowerCase()))) throw new ApiError("This request is not allowed.", 403);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".");
    return Response.json({ error: issue ? `${field ? `${field}: ` : ""}${issue.message}` : "Please check your details." }, { status: 400 });
  }
  if (error instanceof SyntaxError) return Response.json({ error: "Please send valid JSON." }, { status: 400 });
  console.error("ezlife26 API error:", error);
  return Response.json({ error: "We couldn't save this right now. Please try again; your form is kept open." }, { status: 500 });
}

export const kindSchema = z.enum(["target", "habit", "plan", "chore", "file", "note"]);
export const idSchema = z.string().uuid("That record could not be found.");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a valid date.").refine((value) => !Number.isNaN(parseDate(value).getTime()) && dateISO(parseDate(value)) === value, "Please select a valid date.");
const optionalDate = z.preprocess((value) => value === "" || value === null ? undefined : value, dateSchema.optional());
const areaIdSchema = z.preprocess((value) => value === "" ? null : value, z.string().uuid("Please choose a saved life area, or select Personal.").nullable());

export const dataSchema = z.object({
  description: z.string().max(12000).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  completed: z.boolean().optional(),
  dueDate: optionalDate,
  priority: z.enum(["low", "medium", "high"]).optional(),
  date: optionalDate,
  time: z.preprocess((value) => value === "" ? undefined : value, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please select a valid time.").optional()),
  duration: z.number().int().min(5).max(1440).optional(),
  unit: z.string().max(100).optional(),
  history: z.array(dateSchema).max(366).optional(),
  streak: z.number().int().min(0).max(366).optional(),
  mimeType: z.string().max(100).optional(),
  fileSize: z.number().int().min(0).max(2 * 1024 * 1024).optional(),
  content: z.string().max(2900000).regex(/^data:[a-zA-Z0-9.+\-/]*;base64,[A-Za-z0-9+/=\r\n]*$/, "Please upload a valid file.").optional(),
  url: z.string().max(1000).refine((value) => value.startsWith("/images/") || /^https:\/\//.test(value), "Please use a secure file URL.").optional(),
  amount: z.number().int().min(0).max(100000000).optional(),
  pinned: z.boolean().optional(),
  repeat: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).optional(),
  repeatCount: z.number().int("Number of repeats must be a whole number.").min(0).max(MAX_REPEATS, `Choose up to ${MAX_REPEATS} repeats.`).optional(),
  seriesId: z.string().uuid().optional(),
  repeatStartDate: dateSchema.optional(),
  repeatIndex: z.number().int().min(0).max(MAX_REPEATS).optional(),
}).strict();

export const itemInputSchema = z.object({
  title: z.string().trim().min(1, "Give this a name first.").max(200),
  areaId: areaIdSchema.default(null),
  data: dataSchema.default({}),
}).strict();

export const itemPatchSchema = z.object({
  title: z.string().trim().min(1, "Give this a name first.").max(200).optional(),
  areaId: areaIdSchema.optional(),
  data: dataSchema.optional(),
}).strict();

export const areaInputSchema = z.object({
  name: z.string().trim().min(1, "Give your life area a name.").max(80),
  description: z.string().max(300).default(""),
  emoji: z.string().min(1).max(24).default("🌱"),
  color: z.enum(["lavender", "rose", "mint", "peach", "blue", "sand"]).default("mint"),
}).strict();

export function normalizeData(kind: ItemKind, input: ItemData): ItemData {
  const data = { ...input };
  if (kind === "target") {
    data.progress = data.progress ?? (data.completed ? 100 : 0);
    data.completed = data.progress === 100;
    data.priority = data.priority || "medium";
    if (!data.dueDate) delete data.dueDate;
  }
  if (kind === "habit") {
    data.history = Array.from(new Set(data.history || [])).sort();
    data.streak = streakFromHistory(data.history);
  }
  if (kind === "plan" || kind === "chore") {
    data.date = data.date || dateISO();
    data.completed = data.completed || false;
  }
  if (supportsRepeat(kind)) {
    data.repeat = data.repeat || "none";
    data.repeatCount = data.repeat === "none" ? 0 : data.repeatCount ?? 1;
  } else if (data.repeat && data.repeat !== "none") throw new ApiError("Repeats are available for targets, tasks, and daily-plan items.");
  if (kind === "file" && !data.content && !data.url) throw new ApiError("Choose a file to upload first.");
  return data;
}
