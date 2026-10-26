"use client";

import { Repeat2 } from "lucide-react";
import { repetitionLabel } from "@/lib/recurrence";
import type { ItemData } from "@/lib/types";

export function RepeatBadge({ data }: { data: ItemData }) {
  const label = repetitionLabel(data);
  if (!label) return null;
  return <span className="repeat-badge" title={`${data.repeatCount || 0} repeats after the first occurrence`}><Repeat2 size={12}/>{label}</span>;
}
