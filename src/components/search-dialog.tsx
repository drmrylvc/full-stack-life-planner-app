"use client";

import { useState } from "react";
import { CalendarDays, ChevronRight, FolderOpen, Home, ListChecks, Search, Sprout, StickyNote, Target, Zap, type LucideIcon } from "lucide-react";
import { translate, type Lang, type TranslationKey } from "@/lib/i18n";
import type { LifeArea, PlannerItem, View, Workspace } from "@/lib/types";
import { itemSubtitle } from "@/lib/utils";
import { Modal } from "./ui";

const destinations: { view: View; label: TranslationKey; icon: LucideIcon }[] = [
  { view: "today", label: "today", icon: Home },
  { view: "targets", label: "navTargets", icon: Target },
  { view: "plan", label: "planNav", icon: CalendarDays },
  { view: "habits", label: "habitsNav", icon: Zap },
  { view: "files", label: "files", icon: FolderOpen },
  { view: "notes", label: "notes", icon: StickyNote },
  { view: "areas", label: "areas", icon: Sprout },
];

export function SearchDialog({ workspace, language, onClose, onView, onEdit, onFile, onArea }: {
  workspace: Workspace;
  language: Lang;
  onClose: () => void;
  onView: (view: View) => void;
  onEdit: (item: PlannerItem) => void;
  onFile: (item: PlannerItem) => void;
  onArea: (area: LifeArea) => void;
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLocaleLowerCase();
  const matches = workspace.items.filter((item) => `${item.title} ${item.data.description || ""}`.toLocaleLowerCase().includes(term)).slice(0, 12);
  const areas = workspace.areas.filter((area) => area.name.toLocaleLowerCase().includes(term)).slice(0, 6);

  function chooseItem(item: PlannerItem) {
    onClose();
    if (item.kind === "file") { onView("files"); onFile(item); }
    else {
      onView(item.kind === "target" ? "targets" : item.kind === "habit" ? "habits" : item.kind === "note" ? "notes" : "plan");
      onEdit(item);
    }
  }

  return <Modal title="Search your planner" onClose={onClose} className="planner-search-modal">
    <label className="planner-search-input"><Search size={18}/><input type="search" autoComplete="off" aria-label="Search your workspace" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Targets, tasks, notes, files…"/></label>
    <div className="planner-search-results">
      {!term ? destinations.map(({ view, label, icon: Icon }) => <button className="search-result" key={view} onClick={() => { onClose(); onView(view); }}><span className="search-result-icon"><Icon size={18}/></span><span><strong>{translate(language, label)}</strong></span><ChevronRight size={16}/></button>) : <>
        {matches.map((item) => {
          const Icon = item.kind === "target" ? Target : item.kind === "habit" ? Zap : item.kind === "note" ? StickyNote : item.kind === "file" ? FolderOpen : item.kind === "chore" ? ListChecks : CalendarDays;
          return <button key={item.id} className="search-result" onClick={() => chooseItem(item)}><span className="search-result-icon"><Icon size={18}/></span><span><strong>{item.title}</strong><small>{itemSubtitle(item)}</small></span><ChevronRight size={16}/></button>;
        })}
        {areas.map((area) => <button key={area.id} className="search-result" onClick={() => { onClose(); onArea(area); }}><span className="search-result-icon">{area.emoji}</span><span><strong>{area.name}</strong><small>{area.description}</small></span><ChevronRight size={16}/></button>)}
        {!matches.length && !areas.length && <p className="planner-search-empty">Nothing matches yet. Try another word.</p>}
      </>}
    </div>
  </Modal>;
}
