"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { ArrowRight, BarChart3, CalendarDays, ChevronDown, FolderOpen, Image as ImageIcon, Plus, Zap } from "lucide-react";
import { localeFor, translate } from "@/lib/i18n";
import { dateISO, formatTime, humanSize, progressForArea } from "@/lib/utils";
import ItemMenu from "./item-menu";
import { areaTheme } from "@/lib/theme";
import { CheckButton, FileGlyph, ProgressRing } from "./ui";

export default function Dashboard({ workspace, pending, date, onView, onCreate, onEdit, onToggle, onArea, onFile, onDelete, onQuickAdd, language }: any) {


  // VERİTABANI BAĞLANTI GÜVENCESİ: Tünelde veya ağda Docker verisi gecikirse telefonların beyaz ekrana düşmesini engeller
  if (!workspace) {
    return (
      <div className="loading-fallback" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', background: '#0b0a12', fontFamily: 'sans-serif' }}>
        <p>{language === "tr" ? "Çalışma alanı yükleniyor..." : "Loading workspace..."}</p>
      </div>
    );
  }

  const { items, areas } = workspace;
  const t = (key: any, vars?: any) => translate(language, key, vars);

  const [planView, setPlanView] = useState<"daily" | "weekly" | "monthly">("daily");

  const habits = items.filter((item: any) => item.kind === "habit");
  const doneHabits = habits.filter((item: any) => item.kind === "habit" && item.data.history?.includes(dateISO())).length;
  const progress = habits.length ? Math.round((doneHabits / habits.length) * 100) : 0;
  const plans = items.filter((item: any) => item.kind === "plan" && item.data.date === date).sort((a: any, b: any) => (a.data.time || "23:59").localeCompare(b.data.time || "23:59"));
  const chores = items.filter((item: any) => item.kind === "chore" && item.data.date === date);
  const doneChores = chores.filter((item: any) => item.data.completed).length;
  const files = items.filter((item: any) => item.kind === "file");
  const invoices = files.reduce((sum: number, item: any) => sum + (item.data.amount || 0), 0);
  const areaProgress = areas.length ? Math.round(areas.reduce((sum: number, area: any) => sum + progressForArea(area, items), 0) / areas.length) : 0;
  const areaFor = (item: any) => areas.find((area: any) => area.id === item.areaId);
  const money = new Intl.NumberFormat(localeFor(language), { style: "currency", currency: "EUR" }).format(invoices / 100);
  const habitLine = !habits.length ? t("noHabitsYet") : doneHabits === habits.length ? t("habitsDone") : habits.length - doneHabits === 1 ? t("habitOpenOne") : t("habitOpenMany", { n: habits.length - doneHabits });
  const firstOpenPlan = plans.find((item: any) => !item.data.completed);
  const nextPlanSubtitle = plans.length ? (firstOpenPlan ? firstOpenPlan.title : plans[0]?.title || "") : t("noPlanToday");
  const [open, setOpen] = useState({ plan: true, chores: true, habits: true, files: false, areas: false });
  const toggle = (key: keyof typeof open) => setOpen((current: any) => ({ ...current, [key]: !current[key] }));

  const dailyHours = Array.from({ length: 21 }, (_, i) => 4 + i);
  const monthlyDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const weeklyDays = Array.from({ length: 7 }, (_, i) => i);

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
              return (
                <button key={area.id} className={`snap-area ${theme.dark ? "dark-ink" : ""}`} style={{ background: theme.gradient, color: theme.ink }} onClick={() => onArea(area)}>
                  <span className="snap-watermark" aria-hidden="true">{area.emoji}</span>
                  <span className="snap-area-emoji">{area.emoji}</span>
                  <strong style={{ display: "block", fontSize: "16px", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>
                    {t(area.name as any) || area.name}
                  </strong>
                  <small style={{ color: theme.soft }}>{translate(language, area.description as any) || area.description}</small>
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
        <Accordion icon={<CalendarDays size={18}/>} iconClass="calendar" title={t("dailyPlan")} subtitle={nextPlanSubtitle} open={open.plan} onToggle={() => toggle("plan")} onAdd={() => onCreate("plan")}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px", borderBottom: "1px solid rgba(0,0,0,0.05)", paddingBottom: "10px" }}>
            {["daily", "weekly", "monthly"].map((mode) => (
              <button
                key={mode}
                onClick={(e: any) => {
                  e.stopPropagation();
                  setPlanView(mode as any);
                }}
                style={{
                  padding: "5px 14px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "600",
                  backgroundColor: planView === mode ? "#16132c" : "transparent",
                  color: planView === mode ? "#fff" : "#666",
                  border: planView === mode ? "1px solid #16132c" : "1px solid #e2e8f0"
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
                              {weeklyDays.map((dayIndex) => {
                                const baseDate = new Date(2026, 9, 5 + dayIndex);
                                const localizedDayName = baseDate.toLocaleDateString(language === "tr" ? "tr-TR" : "en-US", { weekday: "long" });

                                const itemsForThisDay = items.filter((item: any) => {
                                  if (item.kind !== "plan" || !item.data.date) return false;
                                  const planDate = new Date(item.data.date);
                                  return planDate.getDay() === (dayIndex === 6 ? 0 : dayIndex + 1);
                                });
                  return (
                                    <div key={dayIndex} style={{ backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "8px", borderLeft: "4px solid #16132c" }}>
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

                            {/* GERİ GETİRİLEN AYLIK (MONTHLY) GÖRÜNÜM */}
                            {planView === "monthly" && (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", textAlign: "center", padding: "10px 0" }}>
                                {monthlyDays.map((dayNum) => (
                                  <div key={dayNum} style={{ padding: "8px 0", backgroundColor: "#f8fafc", borderRadius: "6px", fontSize: "12px" }}>
                                    {dayNum}
                                  </div>
                                ))}
                              </div>
                            )}
                  </Accordion>

        <Accordion icon={<span aria-hidden="true">✅</span>} iconClass="tasks" title={t("tasks")} subtitle={t("tasksHint")} badge={`${doneChores}/${chores.length}`} open={open.chores} onToggle={() => toggle("chores")} addLabel={t("addTask")} onAdd={() => { setOpen((current: any) => ({ ...current, chores: true })); onCreate("chore"); }}>
          {chores.length ? chores.map((item: any) => (
            <Row key={item.id} item={item} pending={pending} meta={areaFor(item)?.name || t("tasks")} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} language={language}/>
          )) : <Empty text={t("noTasks")} action={t("addTask")} onAction={() => onCreate("chore")}/>}
        </Accordion>

        <Accordion icon="⚡" iconClass="bolt" title={t("quickLog")} subtitle={t("quickLogHint")} badge={`${doneHabits}/${habits.length}`} open={open.habits} onToggle={() => toggle("habits")} onAdd={() => onCreate("habit")}>
          {habits.map((habit: any) => {
            const done = !!habit.data.history?.includes(dateISO());
            return (
              <div className={`snap-row ${done ? "is-done" : ""}`} key={habit.id}>
                <span className="snap-row-emoji">{areaFor(habit)?.emoji || "✨"}</span>
                <button className="snap-row-copy" onClick={() => onEdit(habit)}><strong>{habit.title}</strong><small>{habit.data.unit}</small></button>
                <CheckButton checked={done} disabled={pending.has(habit.id)} label={`${done ? "Undo" : "Log"} ${habit.title}`} onClick={() => onToggle(habit)}/>
              </div>
            );
          })}
        </Accordion>

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

             function Accordion({ icon, iconClass, title, subtitle, badge, open, onToggle, addLabel, onAdd, children }: any) {
            return (
              <div className={`snap-accordion ${open ? "is-open" : ""}`}>
                <button className="snap-accordion-head" onClick={onToggle}>
                  <span className={`snap-accordion-icon ${iconClass}`}>{icon}</span>
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
            const done = item.data.completed;
            return (
              <div className={`snap-row ${done ? "is-done" : ""}`}>
                <CheckButton checked={done} disabled={pending.has(item.id)} label={`${done ? "Undo" : "Complete"} ${item.title}`} onClick={() => onToggle(item)}/>
                <button className="snap-row-copy" onClick={() => onEdit(item)}>
                  <strong>{item.title}</strong>
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


