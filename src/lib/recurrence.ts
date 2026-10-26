import type { ItemData, ItemKind, RepeatFrequency } from "@/lib/types";
import { dateISO } from "@/lib/utils";

export const REPEAT_OPTIONS: { value: RepeatFrequency; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
export const MAX_REPEATS = 365;

export function supportsRepeat(kind: ItemKind | "area"): boolean {
  return kind === "target" || kind === "plan" || kind === "chore";
}

export function repeatStart(kind: ItemKind, data: ItemData): string {
  return (kind === "target" ? data.dueDate : data.date) || dateISO();
}

/** Every date is calculated from the original anchor, not the last occurrence.
 * Jan 31 -> Feb 28 -> Mar 31; Feb 29 -> Feb 28 -> Feb 29 in a leap year.
 * UTC arithmetic avoids daylight-saving jumps.
 */
export function occurrenceDate(start: string, frequency: RepeatFrequency, index: number): string {
  const [year, month, day] = start.split("-").map(Number);
  if (!year || !month || !day || !Number.isInteger(index) || index < 0) throw new Error("Please select a valid repeat start date.");
  let date: Date;
  if (frequency === "daily" || frequency === "weekly") {
    date = new Date(Date.UTC(year, month - 1, day + index * (frequency === "weekly" ? 7 : 1)));
  } else if (frequency === "monthly" || frequency === "yearly") {
    const monthIndex = month - 1 + (frequency === "monthly" ? index : 0);
    const nextYear = year + (frequency === "yearly" ? index : 0) + Math.floor(monthIndex / 12);
    const nextMonth = monthIndex % 12;
    const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    date = new Date(Date.UTC(nextYear, nextMonth, Math.min(day, lastDay)));
  } else date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10);
}

export function remainingRepeats(data: ItemData): number {
  return Math.max(0, (data.repeatCount || 0) - (data.repeatIndex || 0));
}

export function repetitionLabel(data: ItemData): string {
  if (!data.repeat || data.repeat === "none") return "";
  const label = REPEAT_OPTIONS.find((entry) => entry.value === data.repeat)?.label || "Repeat";
  return `${label} · ${(data.repeatIndex || 0) + 1}/${(data.repeatCount || 0) + 1}`;
}

export function clearSeries(data: ItemData): ItemData {
  const clean = { ...data };
  delete clean.seriesId;
  delete clean.repeatStartDate;
  delete clean.repeatIndex;
  return clean;
}

export function buildOccurrences(kind: ItemKind, input: ItemData, seriesId: string): ItemData[] {
  const clean = clearSeries(input);
  const repeat = clean.repeat || "none";
  const count = repeat === "none" ? 0 : clean.repeatCount ?? 1;
  if (!supportsRepeat(kind) || repeat === "none" || count === 0) return [{ ...clean, repeat: "none", repeatCount: 0 }];
  const start = repeatStart(kind, clean);
  return Array.from({ length: count + 1 }, (_, index) => ({
    ...clean,
    repeat,
    repeatCount: count,
    seriesId,
    repeatStartDate: start,
    repeatIndex: index,
    ...(kind === "target" ? { dueDate: occurrenceDate(start, repeat, index), progress: index ? 0 : clean.progress || 0 } : { date: occurrenceDate(start, repeat, index) }),
    completed: index ? false : Boolean(clean.completed),
  }));
}
