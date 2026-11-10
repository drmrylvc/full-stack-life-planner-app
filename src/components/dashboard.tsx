"use client";

import { useState } from "react";
import { BarChart3, BookOpen, CalendarDays, ChevronDown, FolderOpen, Image as ImageIcon, ListChecks, Palette, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { localeFor, translate } from "@/lib/i18n";
import { addDays, dateISO, formatDate, getWeeklyAreaReport, humanSize, parseDate, progressForArea } from "@/lib/utils";
import ItemMenu from "./item-menu";
import { AREA_THEMES, areaTheme } from "@/lib/theme";
import type { AreaColor } from "@/lib/types";
import { CheckButton, FileGlyph } from "./ui";

const COLOR_OPTIONS: { name: AreaColor; label: string; bg: string }[] = [
  { name: "lavender", label: "Lavender / Purple", bg: "#8b5cf6" },
  { name: "mint", label: "Mint / Emerald", bg: "#10b981" },
  { name: "rose", label: "Rose / Pink", bg: "#f43f5e" },
  { name: "blue", label: "Blue / Azure", bg: "#3b82f6" },
  { name: "peach", label: "Peach / Coral", bg: "#f97316" },
  { name: "sand", label: "Slate / Dark", bg: "#243044" }
];

function SectionColorPicker({ current, onChange, language }: { current: AreaColor; onChange: (c: AreaColor) => void; language?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        title={language === "tr" ? "Bölüm Rengini Değiştir" : "Change Section Color"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        style={{
          background: "rgba(0,0,0,0.05)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "50%",
          width: "28px",
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "#64748b",
          transition: "all 0.2s ease"
        }}
      >
        <Palette size={14} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "34px",
            right: 0,
            zIndex: 20,
            backgroundColor: "#ffffff",
            padding: "8px",
            borderRadius: "14px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            border: "1px solid #e2e8f0",
            display: "flex",
            gap: "6px"
          }}
        >
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.name}
              type="button"
              title={c.label}
              onClick={(e) => {
                e.stopPropagation();
                onChange(c.name);
                setOpen(false);
              }}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                backgroundColor: c.bg,
                border: current === c.name ? "2px solid #16132c" : "none",
                cursor: "pointer",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ workspace, pending, date, onView, onCreate, onEdit, onEditArea, onToggle, onArea, onFile, onDelete, onQuickAdd, language }: any) {

  if (!workspace) {
    return (
      <div className="loading-fallback" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', background: '#0b0a12', fontFamily: 'sans-serif' }}>
        <p>{language === "tr" ? "Çalışma alanı yükleniyor..." : "Loading workspace..."}</p>
      </div>
    );
  }

  const { items, areas } = workspace;
  const t = (key: any, vars?: any) => translate(language, key, vars);

  const [planView, setPlanView] = useState<"daily" | "weekly" | "monthly" | null>(null);
  const [selectedMonthlyDate, setSelectedMonthlyDate] = useState<string>(date || dateISO());

  const [sectionColors, setSectionColors] = useState<Record<string, AreaColor>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("ezlife26-section-colors");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return { calendar: "lavender", tasks: "mint", journal: "rose" };
  });

  const changeSectionColor = (sectionKey: string, color: AreaColor) => {
    setSectionColors((prev) => {
      const next = { ...prev, [sectionKey]: color };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("ezlife26-section-colors", JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
      }
      return next;
    });
  };

  const calTheme = AREA_THEMES[sectionColors.calendar || "lavender"];
  const tasksTheme = AREA_THEMES[sectionColors.tasks || "mint"];
  const journalTheme = AREA_THEMES[sectionColors.journal || "rose"];

  const habits = items.filter((item: any) => item.kind === "habit");
  const doneHabits = habits.filter((item: any) => item.kind === "habit" && item.data.history?.includes(dateISO())).length;
  const plans = items.filter((item: any) => item.kind === "plan" && item.data.date === date).sort((a: any, b: any) => (a.data.time || "23:59").localeCompare(b.data.time || "23:59"));
  const chores = items.filter((item: any) => item.kind === "chore");
  const doneChores = chores.filter((item: any) => item.data.completed).length;
  const files = items.filter((item: any) => item.kind === "file");
  const areaProgress = areas.length ? Math.round(areas.reduce((sum: number, area: any) => sum + progressForArea(area, items), 0) / areas.length) : 0;
  const areaFor = (item: any) => areas.find((area: any) => area.id === item.areaId);
  const firstOpenPlan = plans.find((item: any) => !item.data.completed);
  const nextPlanSubtitle = plans.length ? (firstOpenPlan ? firstOpenPlan.title : plans[0]?.title || "") : t("noPlanToday");
  const [open, setOpen] = useState({ plan: true, chores: true, habits: true, files: false, areas: false });
  const toggle = (key: keyof typeof open) => setOpen((current: any) => ({ ...current, [key]: !current[key] }));

  const dailyHours = Array.from({ length: 21 }, (_, i) => 4 + i);

  // Compute exact 7 dates for current selected week
  const refDateObj = parseDate(date || dateISO());
  const refDayOfWeek = refDateObj.getDay();
  const mondayOffset = refDayOfWeek === 0 ? -6 : 1 - refDayOfWeek;
  const weekStartStr = addDays(date || dateISO(), mondayOffset);
  const weekDaysList = Array.from({ length: 7 }, (_, i) => addDays(weekStartStr, i));

  // Compute exact dates for current month
  const currentYear = refDateObj.getFullYear();
  const currentMonth = refDateObj.getMonth();
  const totalMonthDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthDaysList = Array.from({ length: totalMonthDays }, (_, i) => {
    const dNum = i + 1;
    const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
    const dayPlans = items.filter((item: any) => {
      const isPlanOrTarget = item.kind === "plan" || item.kind === "target";
      const matchesDate = item.data.date === dStr || item.data.dueDate === dStr;
      return isPlanOrTarget && matchesDate;
    });
    return { dNum, dStr, dayPlans };
  });

  const activeMonthlyDate = selectedMonthlyDate || date || dateISO();
  const selectedDayData = monthDaysList.find((entry) => entry.dStr === activeMonthlyDate) || {
    dNum: parseDate(activeMonthlyDate).getDate(),
    dStr: activeMonthlyDate,
    dayPlans: items.filter((item: any) => {
      const isPlanOrTarget = item.kind === "plan" || item.kind === "target";
      const matchesDate = item.data.date === activeMonthlyDate || item.data.dueDate === activeMonthlyDate;
      return isPlanOrTarget && matchesDate;
    })
  };

  return (
    <div className="snap-board">
      <section className="snap-areas">
        <div className="snap-section-head"><div><h2>{t("lifeAreas")}</h2><p>{t("tapArea")}</p></div><button onClick={() => onView("areas")}>{t("manage")}</button></div>
        <div className="snap-area-grid">
          {areas
            .filter((area: any) => area && area.name && area.name.trim().toLowerCase() !== "car & moto" && area.name.trim().toLowerCase() !== "car and moto")
            .map((area: any) => {
              const theme = areaTheme(area);
              const count = items.filter((item: any) => item.kind === "target" && item.areaId === area.id).length;
              const filesInArea = items.filter((item: any) => item.kind === "file" && item.areaId === area.id).length;
              const value = progressForArea(area, items);
              const report = getWeeklyAreaReport(area, items, language);
              return (
                <button key={area.id} className={`snap-area ${theme.dark ? "dark-ink" : ""}`} style={{ background: theme.gradient, color: theme.ink, position: "relative" }} onClick={() => onArea(area)}>
                  <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "4px", zIndex: 2 }}>
                    <span
                      role="button"
                      tabIndex={0}
                      title={language === "tr" ? "Alanı Düzenle" : "Edit Life Area"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditArea) onEditArea(area);
                      }}
                      style={{
                        background: "rgba(0, 0, 0, 0.25)",
                        borderRadius: "50%",
                        width: "28px",
                        height: "28px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#fff",
                        backdropFilter: "blur(4px)"
                      }}
                    >
                      <Pencil size={13} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title={language === "tr" ? "Alanı Sil" : "Delete Life Area"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(language === "tr" ? `"${area.name}" yaşam alanını silmek istediğinize emin misiniz?` : `Are you sure you want to delete "${area.name}"?`)) {
                          onDelete({ kind: "area", area });
                        }
                      }}
                      style={{
                        background: "rgba(220, 38, 38, 0.6)",
                        borderRadius: "50%",
                        width: "28px",
                        height: "28px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#fff",
                        backdropFilter: "blur(4px)"
                      }}
                    >
                      <Trash2 size={13} />
                    </span>
                  </div>
                  <span className="snap-watermark" aria-hidden="true">{area.emoji}</span>
                  <span className="snap-area-emoji">{area.emoji}</span>
                  <strong style={{ display: "block", fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>
                    {t(area.name as any) || area.name}
                  </strong>
                  <small style={{ color: theme.soft }}>{translate(language, area.description as any) || area.description}</small>
                  {report.total > 0 && (
                    <small style={{ color: "#ffffff", display: "block", marginTop: "4px", fontSize: "10.5px", fontWeight: "600", opacity: 0.95 }}>
                      {report.status === "great" ? "🎉 " : report.status === "encouraging" ? "💪 " : ""}{report.message}
                    </small>
                  )}
                  <span className="snap-area-bar"><span style={{ width: `${value}%` }}/></span>
                  <span className="snap-area-meta"><span>{t("targetsShort", { n: count })} · {value}%</span><span className="snap-file-count"><ImageIcon size={11}/>{filesInArea}</span></span>
                </button>
              );
            })}

          <button
            className="snap-area"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.03))",
              border: "2px dashed rgba(22, 19, 44, 0.2)",
              color: "#16132c",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "140px",
              gap: "8px",
              borderRadius: "16px",
              cursor: "pointer",
              gridColumn: "auto",
              width: "100%"
            }}
            onClick={() => onCreate("area")}
          >
            <div style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              backgroundColor: "rgba(22, 19, 44, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Plus size={22} color="#16132c" />
            </div>
            <strong style={{ fontSize: "14px", fontWeight: "600" }}>
              {language === "tr" ? "Yeni Alan Ekle" : language === "fr" ? "Ajouter un domaine" : "Add New Area"}
            </strong>
            <small style={{ color: "#888", textAlign: "center", padding: "0 8px" }}>
              {language === "tr" ? "Hayatına yeni bir niyet kat." : language === "fr" ? "Donnez une nouvelle intention." : "Give a new intention."}
            </small>
          </button>
        </div>
      </section>

      <div className="snap-stack">
        <div className="snap-section-head" style={{ marginTop: "12px", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2>{language === "tr" ? "TAKVİM" : "CALENDAR"}</h2>
            <p>{language === "tr" ? "Gününüz ve takviminiz" : "Your daily, weekly & monthly schedule"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SectionColorPicker
              current={sectionColors.calendar || "lavender"}
              onChange={(color) => changeSectionColor("calendar", color)}
              language={language}
            />
            <button onClick={() => onCreate("plan")}>+ {language === "tr" ? "Plan Ekle" : "Add Plan"}</button>
          </div>
        </div>

        <Accordion icon={<CalendarDays size={20} color="#ffffff"/>} iconClass="calendar" iconBg={calTheme.gradient} title={t("dailyPlan")} subtitle={language === "tr" ? "Gününüz ve takviminiz" : "Your daily, weekly & monthly schedule"} open={open.plan} onToggle={() => toggle("plan")} addLabel={language === "tr" ? "Plan Ekle" : "Add Plan"} onAdd={() => onCreate("plan")}>
          <div style={{ display: "flex", gap: "6px", marginBottom: planView ? "16px" : "4px", borderBottom: planView ? "1px solid rgba(0,0,0,0.05)" : "none", paddingBottom: "10px" }}>
            {["daily", "weekly", "monthly"].map((mode) => (
              <button
                key={mode}
                onClick={(e: any) => {
                  e.stopPropagation();
                  setPlanView((prev) => (prev === mode ? null : (mode as any)));
                }}
                style={{
                  padding: "6px 16px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "600",
                  backgroundColor: planView === mode ? "#16132c" : "transparent",
                  color: planView === mode ? "#ffffff" : "#16132c",
                  border: planView === mode ? "1px solid #16132c" : "1px solid #cbd5e1",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {mode === "daily" ? (language === "tr" ? "Günlük" : "Daily") : mode === "weekly" ? (language === "tr" ? "Haftalık" : "Weekly") : (language === "tr" ? "Aylık" : "Monthly")}
              </button>
            ))}
          </div>

          {planView === "daily" && (
            <div className="daily-schedule-timeline" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {dailyHours.map((hourNum) => {
                const hourString = `${hourNum.toString().padStart(2, "0")}:00`;
                const itemsInThisHour = plans.filter((plan: any) => {
                  if (!plan.data.time) return false;
                  const [pHour] = plan.data.time.split(":");
                  return parseInt(pHour, 10) === hourNum;
                });

                return (
                  <div style={{ display: "flex", alignItems: "flex-start", borderBottom: "1px solid rgba(0,0,0,0.03)", padding: "6px 0" }} key={hourString}>
                    <span style={{ width: "55px", fontSize: "12px", color: "#888", fontWeight: "500" }}>{hourString}</span>
                    <div style={{ flex: 1, minHeight: "28px", paddingLeft: "8px", borderLeft: "2px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {itemsInThisHour.length ? (
                        itemsInThisHour.map((item: any) => (
                          <Row key={item.id} item={item} pending={pending} meta={item.data.time} area={areaFor(item)?.name} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} language={language} />
                        ))
                      ) : (
                        <span style={{ fontSize: "12px", color: "#cbd5e1", fontStyle: "italic" }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {planView === "weekly" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "4px 0" }}>
              {weekDaysList.map((dayISOStr) => {
                const localizedDayName = formatDate(dayISOStr, { weekday: "long", month: "short", day: "numeric" }, localeFor(language));
                const itemsForThisDay = items.filter((item: any) => item.kind === "plan" && item.data.date === dayISOStr);

                return (
                  <div key={dayISOStr} style={{ backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "8px", borderLeft: "4px solid #16132c" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#16132c", marginBottom: "6px" }}>{localizedDayName}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {itemsForThisDay.length ? (
                        itemsForThisDay.map((item: any) => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid rgba(0,0,0,0.02)" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: "13px", fontWeight: "500", color: item.data.completed ? "#94a3b8" : "#334155", textDecoration: item.data.completed ? "line-through" : "none" }}>
                                {item.title}
                              </span>
                              <span style={{ fontSize: "11px", color: "#888" }}>
                                {item.data.time ? `${item.data.time}` : (language === "tr" ? "Tüm gün" : "All day")} {areaFor(item)?.name ? `· ${translate(language, areaFor(item).name as any) || areaFor(item).name}` : ""}
                              </span>
                            </div>
                            <CheckButton checked={!!item.data.completed} disabled={pending.has(item.id)} label="Complete" onClick={() => onToggle(item)}/>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: "12px", color: "#cbd5e1", fontStyle: "italic" }}>
                          {language === "tr" ? "Bu gün için plan yok" : "No plans for this day"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {planView === "monthly" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", textAlign: "center" }}>
                {monthDaysList.map(({ dNum, dStr, dayPlans }) => {
                  const isToday = dStr === dateISO();
                  const isSelected = dStr === activeMonthlyDate;
                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMonthlyDate(dStr);
                      }}
                      style={{
                        padding: "8px 4px",
                        backgroundColor: isSelected ? "#16132c" : isToday ? "#eee5ff" : "#f8fafc",
                        color: isSelected ? "#ffffff" : isToday ? "#694bb1" : "#16132c",
                        border: isSelected ? "2px solid #8b5cf6" : "1px solid rgba(0,0,0,0.05)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "3px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        boxShadow: isSelected ? "0 4px 12px rgba(139, 92, 246, 0.2)" : "none"
                      }}
                    >
                      <strong style={{ fontSize: "13px" }}>{dNum}</strong>
                      {dayPlans.length > 0 && (
                        <span
                          style={{
                            fontSize: "9.5px",
                            background: isSelected ? "#8b5cf6" : "#e2e8f0",
                            color: isSelected ? "#ffffff" : "#334155",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            fontWeight: "700"
                          }}
                        >
                          🎯 {dayPlans.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ backgroundColor: "#f8fafc", borderRadius: "12px", padding: "14px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
                  <div>
                    <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#16132c" }}>
                      📅 {formatDate(activeMonthlyDate, { weekday: "long", month: "short", day: "numeric" }, localeFor(language))}
                    </h3>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0 0" }}>
                      {selectedDayData.dayPlans.length
                        ? `${selectedDayData.dayPlans.length} ${language === "tr" ? "hedef & plan mevcut" : "targets & plans scheduled"}`
                        : (language === "tr" ? "Bu tarih için henüz hedef veya plan yok" : "No targets or plans scheduled for this date")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanView("daily");
                    }}
                    style={{
                      fontSize: "12px",
                      color: "#694bb1",
                      background: "#eee5ff",
                      border: "1px solid #d8cdf4",
                      padding: "5px 12px",
                      borderRadius: "16px",
                      cursor: "pointer",
                      fontWeight: "600"
                    }}
                  >
                    {language === "tr" ? "Günlük Görünüme Geç" : "Open Daily View"}
                  </button>
                </div>

                {selectedDayData.dayPlans.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedDayData.dayPlans.map((item: any) => {
                      const done = item.kind === "target" ? item.data.progress === 100 : !!item.data.completed;
                      const isTarget = item.kind === "target";
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            backgroundColor: "#ffffff",
                            borderRadius: "8px",
                            border: "1px solid rgba(0,0,0,0.05)",
                            gap: "10px"
                          }}
                        >
                          <CheckButton checked={done} disabled={pending.has(item.id)} label={`${done ? "Undo" : "Complete"} ${item.title}`} onClick={() => onToggle(item)}/>
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "13px" }}>{isTarget ? "🎯" : "📅"}</span>
                              <strong style={{ fontSize: "13px", fontWeight: "600", color: done ? "#94a3b8" : "#1e293b", textDecoration: done ? "line-through" : "none" }}>
                                {item.title}
                              </strong>
                            </div>
                            <small style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px" }}>
                              {item.data.time ? `${item.data.time}` : (language === "tr" ? "Tüm gün" : "All day")}
                              {areaFor(item)?.name ? ` · ${translate(language, areaFor(item).name as any) || areaFor(item).name}` : ""}
                              {isTarget && item.data.progress !== undefined ? ` · ${item.data.progress}%` : ""}
                            </small>
                          </button>
                          <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete(item)}/>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                    <button
                      type="button"
                      onClick={() => onCreate("plan")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        backgroundColor: "#16132c",
                        color: "#ffffff",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "600",
                        border: "none",
                        cursor: "pointer"
                      }}
                    >
                      <Plus size={14} />
                      {language === "tr" ? "Bu Güne Hedef / Plan Ekle" : "Add Target / Plan to This Date"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Accordion>

        <div className="snap-section-head" style={{ marginTop: "16px", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2>{language === "tr" ? "GÖREVLER" : "TASKS"}</h2>
            <p>{t("tasksHint")}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SectionColorPicker
              current={sectionColors.tasks || "mint"}
              onChange={(color) => changeSectionColor("tasks", color)}
              language={language}
            />
            <button onClick={() => { setOpen((current: any) => ({ ...current, chores: true })); onCreate("chore"); }}>+ {t("addTask")}</button>
          </div>
        </div>

        <Accordion icon={<ListChecks size={20} color="#ffffff"/>} iconClass="tasks" iconBg={tasksTheme.gradient} title={t("tasks")} subtitle={t("tasksHint")} badge={`${doneChores}/${chores.length}`} open={open.chores} onToggle={() => toggle("chores")} addLabel={t("addTask")} onAdd={() => { setOpen((current: any) => ({ ...current, chores: true })); onCreate("chore"); }}>
          {chores.length ? chores.map((item: any) => (
            <Row key={item.id} item={item} pending={pending} meta={areaFor(item)?.name || t("tasks")} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} language={language}/>
          )) : <Empty text={t("noTasks")} action={t("addTask")} onAction={() => onCreate("chore")}/>}
        </Accordion>

        {/* Personal Journal Section under Tasks */}
        {(() => {
          const selectedDateStr = date || dateISO();
          const existingJournal = items.find((item: any) => item.kind === "note" && (item.title?.includes(selectedDateStr) || item.data.date === selectedDateStr || item.data.isJournal));

          const handleOpenJournal = () => {
            if (existingJournal) {
              onEdit({ ...existingJournal, isJournal: true, journalDate: selectedDateStr } as any);
            } else {
              onEdit({
                kind: "note",
                isJournal: true,
                journalDate: selectedDateStr,
                item: null
              } as any);
            }
          };

          return (
            <div>
              <div className="snap-section-head" style={{ marginTop: "16px", marginBottom: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2>{language === "tr" ? "KİŞİSEL GÜNLÜK" : "PERSONAL JOURNAL"}</h2>
                  <p>{formatDate(selectedDateStr, { weekday: "long", month: "long", day: "numeric" }, localeFor(language))}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <SectionColorPicker
                    current={sectionColors.journal || "rose"}
                    onChange={(color) => changeSectionColor("journal", color)}
                    language={language}
                  />
                  <button onClick={handleOpenJournal}>
                    {existingJournal ? (language === "tr" ? "Günlüğü Aç" : "Open Journal") : (language === "tr" ? "Günlük Yaz" : "Write Journal")}
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(32, 28, 64, 0.05)", marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ width: "42px", height: "42px", borderRadius: "14px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: journalTheme.gradient, color: "#ffffff", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
                      <BookOpen size={20} color="#ffffff"/>
                    </span>
                    <div>
                      <strong style={{ fontSize: "16px", fontWeight: "750", color: "#16132c", display: "block" }}>
                        {language === "tr" ? "Kişisel Günlük Sayfası" : "Personal Journal Notebook"}
                      </strong>
                      <small style={{ color: "#8b93a7", fontSize: "13px" }}>
                        {formatDate(selectedDateStr, { weekday: "long", month: "long", day: "numeric" }, localeFor(language))}
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenJournal}
                    style={{
                      padding: "7px 16px",
                      backgroundColor: "#16132c",
                      color: "#ffffff",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: "700",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Pencil size={13} />
                    {existingJournal ? (language === "tr" ? "Günlüğü Aç" : "Open Journal") : (language === "tr" ? "Not / Günlük Yaz" : "Write Journal")}
                  </button>
                </div>

                <div
                  onClick={handleOpenJournal}
                  style={{
                    padding: "14px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "14px",
                    border: existingJournal ? "1px solid #e2e8f0" : "1px dashed #cbd5e1",
                    cursor: "pointer"
                  }}
                >
                  {existingJournal ? (
                    <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                      "{existingJournal.data.description?.slice(0, 180) || (language === "tr" ? "Boş günlük sayfası..." : "Blank journal page...")}"
                    </p>
                  ) : (
                    <div style={{ textAlign: "center", padding: "6px 0" }}>
                      <p style={{ fontSize: "13px", color: "#64748b", margin: 0, fontWeight: "500" }}>
                        {language === "tr"
                          ? `Dokunarak ${formatDate(selectedDateStr)} tarihi için boş bir sayfa açın ve kişisel günlüğünüzü yazın...`
                          : `Tap to open a blank page and write your personal journal for ${formatDate(selectedDateStr)}...`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <Accordion icon={<FolderOpen size={18}/>} iconClass="files" title={t("recentFiles")} subtitle={t("filesHint")} badge={t("filesBadge", { n: files.length })} open={open.files} onToggle={() => toggle("files")} onAdd={() => onCreate("file")}>
          {files.slice(0, 4).map((file: any) => <button className="snap-file" key={file.id} onClick={() => onFile(file)}><FileGlyph item={file}/><span><strong>{file.title}</strong><small>{humanSize(file.data.fileSize)}</small></span></button>)}
        </Accordion>

        <Accordion icon={<BarChart3 size={18}/>} iconClass="chart" title={t("areasDetail")} subtitle={t("areasDetailHint")} badge={`${areaProgress}%`} open={open.areas} onToggle={() => toggle("areas")}>
          {areas.map((area: any) => {
            const value = progressForArea(area, items);
            return (
              <button className="snap-detail" key={area.id} onClick={() => onArea(area)}>
                <span>{area.emoji}</span><strong>{translate(language, area.name as any) || area.name}</strong><em>{value}%</em>
                <span className="snap-detail-bar"><span style={{ width: `${value}%` }}/></span>
              </button>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}

function Accordion({ icon, iconClass, iconBg, title, subtitle, badge, open, onToggle, addLabel, onAdd, children }: any) {
  return (
    <div className={`snap-accordion ${open ? "is-open" : ""}`}>
      <button className="snap-accordion-head" onClick={onToggle}>
        <span className={`snap-accordion-icon ${iconClass}`} style={iconBg ? { background: iconBg, color: "#ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" } : undefined}>{icon}</span>
        <div className="snap-accordion-copy">
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </div>
        {badge && <span className="snap-accordion-badge">{badge}</span>}
        <ChevronDown size={16} className="snap-accordion-arrow"/>
      </button>
      {open && (
        <div className="snap-accordion-body">
          {children}
          {onAdd && addLabel && (
            <button className="snap-inline-add" onClick={onAdd}>
              <Plus size={15}/>{addLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ item, pending, meta, area, onEdit, onToggle, onDelete, language }: any) {
  const done = !!item.data.completed;
  const hasReminder = !!item.data.remindPhone;
  return (
    <div className={`snap-row ${done ? "is-done" : ""}`} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <CheckButton checked={done} disabled={pending.has(item.id)} label={`${done ? "Undo" : "Complete"} ${item.title}`} onClick={() => onToggle(item)}/>
      <button className="snap-row-copy" onClick={() => onEdit(item)} style={{ flex: 1, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <strong style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>{item.title}</strong>
          {hasReminder && <span title="Phone Reminder Set" style={{ fontSize: "12px" }}>🔔</span>}
        </div>
        <small>{meta}{area ? ` · ${translate(language, area as any) || area}` : ""}</small>
      </button>
      <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete(item)}/>
    </div>
  );
}

function Empty({ text, action, onAction }: any) {
  return (
    <div className="snap-empty">
      <p>{text}</p>
      <button onClick={onAction}>{action}</button>
    </div>
  );
}
