export type ItemKind = "target" | "habit" | "plan" | "chore" | "file" | "note";
export type View = "today" | "targets" | "plan" | "habits" | "files" | "notes" | "areas";
export type AreaColor = "lavender" | "rose" | "mint" | "peach" | "blue" | "sand";

export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface ItemData {
  repeat?: RepeatFrequency;
  /** Additional occurrences after the first one. */
  repeatCount?: number;
  repeatStartDate?: string;
  seriesId?: string;
  repeatIndex?: number;
  description?: string;
  progress?: number;
  completed?: boolean;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  date?: string;
  time?: string;
  duration?: number;
  unit?: string;
  history?: string[];
  streak?: number;
  mimeType?: string;
  fileSize?: number;
  content?: string;
  url?: string;
  amount?: number;
  pinned?: boolean;
}

export interface PlannerItem {
  id: string;
  kind: ItemKind;
  title: string;
  areaId: string | null;
  data: ItemData;
  createdAt: string;
  updatedAt: string;
}

export interface LifeArea {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: AreaColor;
  sortOrder: number;
}

export interface PlannerUser {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
  timezone: string;
  dailyGoal: number;
}

export interface Workspace {
  user: PlannerUser;
  areas: LifeArea[];
  items: PlannerItem[];
}

export interface EditorState {
  kind: ItemKind | "area";
  item?: PlannerItem;
  area?: LifeArea;
  areaId?: string | null;
  deleteSeries?: boolean;
}

/** Save responses keep the primary item shape for compatibility and include
 * the complete set of created/changed occurrences for optimistic reconciliation. */
export interface ItemSaveResult extends PlannerItem {
  occurrences?: PlannerItem[];
  removedIds?: string[];
}

export interface ItemInput {
  title: string;
  areaId: string | null;
  data: ItemData;
}

export interface AreaInput {
  name: string;
  description: string;
  emoji: string;
  color: AreaColor;
}

export const AREA_COLORS: Record<AreaColor, { background: string; accent: string; text: string; label: string }> = {
  lavender: { background: "#f0ebfb", accent: "#9574cf", text: "#6f51a6", label: "Lavender" },
  rose: { background: "#fcebee", accent: "#d8879c", text: "#b66b82", label: "Rose" },
  mint: { background: "#e6f2ed", accent: "#60a487", text: "#347c60", label: "Mint" },
  peach: { background: "#fcf0df", accent: "#d5a25e", text: "#a97934", label: "Apricot" },
  blue: { background: "#e8f0fa", accent: "#7c9fcb", text: "#5279ab", label: "Sky" },
  sand: { background: "#eeeae5", accent: "#a39a8d", text: "#786f62", label: "Sand" },
};

export const RESOURCE_LABELS: Record<ItemKind | "area", string> = {
  target: "target", habit: "habit", plan: "plan item", chore: "task", file: "file", note: "note", area: "life area",
};
