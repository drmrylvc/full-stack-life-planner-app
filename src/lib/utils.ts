import type { LifeArea, PlannerItem } from "./types";

export function dateISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function addDays(value: string, amount: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return dateISO(date);
}

export function headlineDate(value: string, locale = "en-GB"): string {
  if (locale.startsWith("en")) {
    const parts = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).formatToParts(parseDate(value));
    const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
    return `${part("weekday")} ${part("day")} ${part("month")}`;
  }
  return parseDate(value).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }, locale = "en-US"): string {
  return parseDate(value).toLocaleDateString(locale, options);
}

export function dateLabel(value: string): string {
  if (value === dateISO()) return "Today";
  if (value === addDays(dateISO(), 1)) return "Tomorrow";
  if (value === addDays(dateISO(), -1)) return "Yesterday";
  return formatDate(value);
}

export function formatTime(value?: string): string {
  if (!value) return "Anytime";
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function humanSize(bytes = 0): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function progressForArea(area: LifeArea, items: PlannerItem[]): number {
  const targets = items.filter((item) => item.kind === "target" && item.areaId === area.id);
  if (!targets.length) return 0;
  return Math.round(targets.reduce((sum, item) => sum + (item.data.progress || 0), 0) / targets.length);
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function streakFromHistory(history: string[]): number {
  const completed = new Set(history);
  let day = completed.has(dateISO()) ? dateISO() : addDays(dateISO(), -1);
  let streak = 0;
  while (completed.has(day) && streak < 366) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

export function itemSubtitle(item: PlannerItem): string {
  if (item.kind === "target") return `${item.data.progress || 0}% complete`;
  if (item.kind === "habit") return item.data.unit || "Daily habit";
  if (item.kind === "plan") return `${item.data.date ? dateLabel(item.data.date) : "Today"} · ${formatTime(item.data.time)}`;
  if (item.kind === "chore") return item.data.completed ? "Done" : "Still to do";
  if (item.kind === "file") return humanSize(item.data.fileSize);
  return item.data.description?.slice(0, 70) || "Your thoughts, kept safe";
}
