import type { EditorState, ItemInput, ItemKind, LifeArea, PlannerItem, Workspace } from "@/lib/types";
import type { Lang } from "@/lib/i18n";

export interface ResourceProps {
  workspace: Workspace;
  language: Lang;
  pending: Set<string>;
  areaId: string | null;
  onAreaFilter: (id: string | null) => void;
  date: string;
  onDate: (date: string) => void;
  onCreate: (kind: ItemKind | "area", areaId?: string) => void;
  onEdit: (item: PlannerItem) => void;
  onEditArea: (area: LifeArea) => void;
  onDelete: (editor: EditorState) => void;
  onToggle: (item: PlannerItem) => void;
  onUpdate: (item: PlannerItem, patch: Partial<ItemInput>, message?: string) => void;
  onFile: (file: PlannerItem) => void;
}
