"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import type { LifeArea } from "@/lib/types";

export function AreaSelect({ areas, areaId, onChange }: { areas: LifeArea[]; areaId: string | null; onChange: (id: string | null) => void }) {
  return <label className="area-filter"><SlidersHorizontal size={15}/><select aria-label="Filter by life area" value={areaId || "all"} onChange={(event) => onChange(event.target.value === "all" ? null : event.target.value)}><option value="all">All life areas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>;
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="view-search"><Search size={16}/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder}/></label>;
}
