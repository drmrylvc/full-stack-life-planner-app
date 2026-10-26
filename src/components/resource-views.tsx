"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, Clock3, Flame, LayoutGrid, List, ListChecks, Plus, Sprout, Target, TrendingUp } from "lucide-react";
import type { View } from "@/lib/types";
import { translate } from "@/lib/i18n";
import { addDays, dateISO, dateLabel, formatDate, formatTime, parseDate } from "@/lib/utils";
import type { ResourceProps } from "./resource-types";
import { AreaTag, CheckButton, EmptyState, ProgressRing } from "./ui";
import { AreaSelect, SearchField } from "./filters";
import ItemMenu from "./item-menu";
import { RepeatBadge } from "./repeat-badge";
import { FilesView, NotesView } from "./library-views";
import * as LibraryViews from "./library-views";

export default function ResourceViews(props: ResourceProps & { view: View }) {
  if (props.view === "targets") return <TargetsView {...props}/>;
  if (props.view === "plan") return <PlanView {...props}/>;
  if (props.view === "habits") return <HabitsView {...props}/>;
  if (props.view === "files") return <FilesView {...props}/>;
  if (props.view === "notes") return <NotesView {...props}/>;
  return <LibraryViews.AreasView {...props} language={props.language}/>;
}

function TargetsView({ workspace, pending, areaId, onAreaFilter, onCreate, onEdit, onDelete, onToggle, language }: ResourceProps) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState("grid");
  const targets = workspace.items.filter((item) => item.kind === "target");
  const completed = targets.filter((item) => item.data.progress === 100).length;
  const progress = targets.length ? Math.round(targets.reduce((sum, item) => sum + (item.data.progress || 0), 0) / targets.length) : 0;
  const filtered = targets.filter((item) => (!areaId || item.areaId === areaId) && (status === "all" || (status === "completed" ? item.data.progress === 100 : item.data.progress !== 100)) && `${item.title} ${item.data.description || ""}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="resource-page">
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-icon green"><Target size={20}/></span>
        <div>
          <span>{language === "tr" ? "Devam eden" : language === "fr" ? "En cours" : "In progress"}</span>
          <strong>{targets.length - completed}<small>{translate(language, "targetsShort") || "targets"}</small></strong>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-icon lavender"><CircleCheck size={20}/></span>
        <div>
          <span>{language === "tr" ? "Tamamlanan" : language === "fr" ? "Déjà terminé" : "Already complete"}</span>
          <strong>{completed}<small>{language === "tr" ? "iyi hissetmek için sebep" : "reasons to feel good"}</small></strong>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-icon peach"><TrendingUp size={20}/></span>
        <div>
          <span>{language === "tr" ? "Genel ilerleme" : language === "fr" ? "Progression globale" : "Overall progress"}</span>
          <strong>{progress}%<small>{language === "tr" ? "adım adım" : "one step at a time"}</small></strong>
        </div>
      </div>
    </div>

    <div className="resource-toolbar">
      <div className="filter-tabs">
        {[
          ["all", language === "tr" ? "Tüm hedefler" : language === "fr" ? "Tous les objectifs" : "All targets", targets.length],
          ["active", language === "tr" ? "Devam eden" : language === "fr" ? "En cours" : "In progress", targets.length - completed],
          ["completed", language === "tr" ? "Tamamlanan" : language === "fr" ? "Terminé" : "Completed", completed]
        ].map(([value, label, count]) => (
          <button key={String(value)} className={status === value ? "selected" : ""} onClick={() => setStatus(String(value))}>
            {String(label)}<span>{Number(count)}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-right">
        <AreaSelect areas={workspace.areas} areaId={areaId} onChange={onAreaFilter}/>
        <div className="layout-switch">
          <button className={layout === "grid" ? "selected" : ""} aria-label="Grid view" onClick={() => setLayout("grid")}><LayoutGrid size={16}/></button>
          <button className={layout === "list" ? "selected" : ""} aria-label="List view" onClick={() => setLayout("list")}><List size={16}/></button>
        </div>
      </div>
    </div>

    <div className="resource-search-row">
      <SearchField value={query} onChange={setQuery} placeholder={language === "tr" ? "Hedef bul..." : language === "fr" ? "Trouver un objectif..." : "Find a target…"}/>
      <span>{filtered.length} {language === "tr" ? "hedef" : "target"}</span>
    </div>

    {filtered.length ? (
      <div className={`target-grid ${layout === "list" ? "list-layout" : ""}`}>
        {filtered.map((item) => (
          <article key={item.id} className={`target-card ${item.data.progress === 100 ? "complete" : ""}`}>
            <div className="resource-card-top">
              <AreaTag area={workspace.areas.find((area) => area.id === item.areaId)}/>
              <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete({ kind: "target", item })}/>
            </div>
            <button className="target-title-button" onClick={() => onEdit(item)}><h3>{item.title}</h3></button>
            <p className="target-description">{item.data.description || "..."}</p>
            <RepeatBadge data={item.data}/>
            <div className="target-progress">
              <div>
                <span>{item.data.progress === 100 ? (language === "tr" ? "Başardın!" : "You did it!") : (language === "tr" ? "İlerleme kaydediliyor" : "Making progress")}</span>
                <strong>{item.data.progress || 0}%</strong>
              </div>
              <div className="progress-track"><span style={{ width: `${item.data.progress || 0}%` }}/></div>
            </div>
            <div className="target-card-footer">
              <span><CalendarDays size={13}/>{item.data.dueDate ? formatDate(item.data.dueDate) : (language === "tr" ? "Süre sınırı yok" : "No deadline")}</span>
              <CheckButton checked={item.data.progress === 100} label="Complete" disabled={pending.has(item.id)} onClick={() => onToggle(item)}/>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <EmptyState icon={Target} title="A little intention goes a long way" description="Make room for a new target." action="Add a target" onAction={() => onCreate("target", areaId || undefined)}/>
    )}
  </div>;
}

function PlanView({ workspace, pending, date, onDate, onCreate, onEdit, onDelete, onToggle, language }: ResourceProps) {
  const [showCompleted, setShowCompleted] = useState(true);
  const weekday = parseDate(date).getDay();
  const start = addDays(date, -(weekday === 0 ? 6 : weekday - 1));
  const week = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const plans = workspace.items.filter((item) => item.kind === "plan" && item.data.date === date).sort((a, b) => (a.data.time || "23:59").localeCompare(b.data.time || "23:59"));
  const completed = plans.filter((item) => item.data.completed).length;
  const filtered = plans.filter((item) => showCompleted || !item.data.completed);

  return <div className="resource-page plan-page">
    <section className="week-calendar panel">
      <div className="week-calendar-top">
        <h2>{formatDate(date, { month: "long", year: "numeric" })}</h2>
        <div>
          <button className="text-button" onClick={() => onDate(dateISO())}>
            {language === "tr" ? "Bugüne dön" : language === "fr" ? "Retour à aujourd'hui" : "Back to today"}
          </button>
          <button className="icon-button" aria-label="Previous week" onClick={() => onDate(addDays(date, -7))}><ChevronLeft size={18}/></button>
          <button className="icon-button" aria-label="Next week" onClick={() => onDate(addDays(date, 7))}><ChevronRight size={18}/></button>
          <label className="calendar-date-input"><CalendarDays size={17}/><input type="date" aria-label="Choose a day" value={date} onChange={(event) => { if (event.target.value) onDate(event.target.value); }}/></label>
        </div>
      </div>
      <div className="week-days">
        {week.map((day) => (
          <button key={day} className={`week-day ${day === date ? "selected" : ""} ${day === dateISO() ? "is-today" : ""}`} onClick={() => onDate(day)}>
            <span>{formatDate(day, { weekday: "short" })}</span>
            <strong>{parseDate(day).getDate()}</strong>
            <span className={`week-day-dot ${workspace.items.some((item) => (item.kind === "plan" || item.kind === "chore") && item.data.date === day) ? "has-events" : ""}`}/></button>
        ))}
      </div>
    </section>

    <TasksUnderCalendar {...{ workspace, pending, date, onCreate, onEdit, onDelete, onToggle, language }}/>

    <div className="day-plan-heading">
      <div>
        <h2>{dateLabel(date)}<span>{formatDate(date, { weekday: "long", month: "long", day: "numeric" })}</span></h2>
        <p>{plans.length ? `${completed} / ${plans.length} ${language === "tr" ? "tamamlandı." : "complete."}` : (language === "tr" ? "Temiz bir sayfa. Önemli şeyler için zaman ayırın." : "A fresh page. Make a little time for what matters.")}</p>
      </div>
      <label className="switch-label">
        <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)}/>
        <span/>
        {language === "tr" ? "Tamamlananları göster" : language === "fr" ? "Afficher les terminés" : "Show completed"}
      </label>
    </div>

        {filtered.length ? (
          <section className="schedule-list panel">
            {filtered.map((item) => (
              <article className={`schedule-item ${item.data.completed ? "is-done" : ""}`} key={item.id}>
                <span className="schedule-time">{formatTime(item.data.time).split(" ")[0]}<small>{formatTime(item.data.time).split(" ")[1]}</small></span>
                <span className="schedule-node"><span/></span>
                <button className="schedule-copy" onClick={() => onEdit(item)}>
                  <h3>{item.title}</h3>
                  <p>{item.data.description || "..."}</p>
                  <RepeatBadge data={item.data}/>
                  <span><Clock3 size={12}/>{item.data.duration || 30} min<AreaTag area={workspace.areas.find((area) => area.id === item.areaId)} small/></span>
                </button>
                <CheckButton checked={item.data.completed} label="Complete" disabled={pending.has(item.id)} onClick={() => onToggle(item)}/>
                <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete({ kind: "plan", item })}/>
              </article>
            ))}
            <button className="schedule-add" onClick={() => onCreate("plan")}><Plus size={17}/>{language === "tr" ? "Yeni plan ögesi ekle" : "Make room for another moment"}</button>
          </section>
        ) : (
          <EmptyState icon={CalendarDays} title="Your day, your pace" description="Add a plan item." action="Add to my plan" onAction={() => onCreate("plan")}/>
        )}
      </div>;
    }

    function TasksUnderCalendar({ workspace, pending, date, onCreate, onEdit, onDelete, onToggle, language }: Pick<ResourceProps, "workspace" | "pending" | "date" | "onCreate" | "onEdit" | "onDelete" | "onToggle" | "language">) {
      const tasks = workspace.items.filter((item) => item.kind === "chore" && item.data.date === date);
      const done = tasks.filter((item) => item.data.completed).length;
      return <section className="tasks-under-calendar panel">
        <div className="tasks-under-head">
          <div>
            <h2><ListChecks size={18}/>{translate(language, "tasks")}</h2>
            <p>{done}/{tasks.length} · {translate(language, "tasksHint")}</p>
          </div>
          <button className="button secondary small" onClick={() => onCreate("chore")}><Plus size={15}/>{translate(language, "addTask")}</button>
        </div>
        {tasks.length ? (
          <div className="task-list">
            {tasks.map((item) => (
              <article key={item.id} className={item.data.completed ? "is-done" : ""}>
                <CheckButton checked={!!item.data.completed} disabled={pending.has(item.id)} label="Complete" onClick={() => onToggle(item)}/>
                <button onClick={() => onEdit(item)}>
                  <strong>{item.title}</strong>
                  <small>{item.data.description || workspace.areas.find((area) => area.id === item.areaId)?.name || translate(language, "tasks")}</small>
                  <RepeatBadge data={item.data}/></button>
                <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete({ kind: "chore", item })}/>
              </article>
            ))}
          </div>
        ) : (
          <div className="task-empty">
            <p>{translate(language, "noTasks")}</p>
            <button className="schedule-add" onClick={() => onCreate("chore")}><Plus size={17}/>{translate(language, "addTask")}</button>
          </div>
        )}
      </section>;
    }

    function HabitsView({ workspace, pending, areaId, onAreaFilter, onCreate, onEdit, onDelete, onToggle, language }: ResourceProps) {
      const habits = workspace.items.filter((item) => item.kind === "habit");
      const today = dateISO();
      const completed = habits.filter((item) => item.data.history?.includes(today)).length;
      const filtered = habits.filter((item) => !areaId || item.areaId === areaId);
      const progress = habits.length ? Math.round(completed / habits.length * 100) : 0;

      return <div className="resource-page">
        <section className="habit-summary">
          <ProgressRing size={92} progress={progress}/>
          <div>
            <p className="eyebrow">{language === "tr" ? "KÜÇÜK BİR SÖZ, TUTULDU" : "A SMALL PROMISE, KEPT"}</p>
            <h2>{completed === habits.length && habits.length ? (language === "tr" ? "Kendiniz için buradasınız." : "You've shown up for yourself.") : (language === "tr" ? "İstikrar size yakışıyor." : "Consistency looks good on you.")}</h2>
          </div>
          <div className="habit-best-streak"><Flame size={27}/><strong>{Math.max(0, ...habits.map((habit) => habit.data.streak || 0))}</strong><span>{language === "tr" ? "en iyi seri" : "best streak"}</span></div>
        </section>
        {filtered.length ? (
          <div className="habit-card-grid">
            {filtered.map((habit) => {
              const done = !!habit.data.history?.includes(today);
              const area = workspace.areas.find((entry) => entry.id === habit.areaId);
              return (
                <article className={`habit-card ${done ? "done" : ""}`} key={habit.id}>
                  <div className="resource-card-top"><span className="habit-large-emoji">{area?.emoji || "🌱"}</span><ItemMenu onEdit={() => onEdit(habit)} onDelete={() => onDelete({ kind: "habit", item: habit })}/></div>
                  <AreaTag area={area} small/>
                  <h3>{habit.title}</h3>
                  <p>{habit.data.unit || "Ritual"}</p>
                  <button className={`habit-check-in ${done ? "checked" : ""}`} disabled={pending.has(habit.id)} onClick={() => onToggle(habit)}>{done ? "Done" : "Check in"}</button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Sprout} title="Start small." description="Make your first daily habit yours." action="Add a daily habit" onAction={() => onCreate("habit", areaId || undefined)}/>
        )}
      </div>;
    }

