"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowUpRight, CalendarDays, Check, FileText, FolderOpen, Image as ImageIcon, LayoutGrid, List, Pencil, Pin, Plus, Sprout, StickyNote, Target, Trash2, Zap } from "lucide-react";
import { RESOURCE_LABELS, type ItemKind } from "@/lib/types";
import { dateISO, getTargetReport, getWeeklyAreaReport, humanSize, itemSubtitle, progressForArea } from "@/lib/utils";
import { translate } from "@/lib/i18n";
import type { ResourceProps } from "./resource-types";
import { AreaTag, CheckButton, colorStyle, EmptyState, FileGlyph, ProgressRing } from "./ui";
import { AreaSelect, SearchField } from "./filters";
import ItemMenu from "./item-menu";
import { RepeatBadge } from "./repeat-badge";

export function FilesView({ workspace, areaId, onAreaFilter, onCreate, onEdit, onDelete, onFile }: ResourceProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [layout, setLayout] = useState("grid");
  const files = workspace.items.filter((item) => item.kind === "file");
  const filtered = files.filter((item) => (!areaId || item.areaId === areaId) && item.title.toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (filter === "images" ? item.data.mimeType?.startsWith("image/") : filter === "invoices" ? !!item.data.amount : !item.data.mimeType?.startsWith("image/"))));
  const totalSize = files.reduce((sum, item) => sum + (item.data.fileSize || 0), 0);
  const invoiceTotal = files.reduce((sum, item) => sum + (item.data.amount || 0), 0);
  return <div className="resource-page">
    <div className="file-library-summary"><span className="library-summary-icon"><FolderOpen size={28}/></span><div><h2>Your important little things.</h2><p>Photos, documents, and invoices. Safely stored, easy to find.</p></div><div className="library-summary-stat"><strong>{files.length}</strong><span>files · {humanSize(totalSize)}</span></div><div className="library-summary-stat"><strong>{new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(invoiceTotal / 100)}</strong><span>invoices tracked</span></div></div>
    <div className="resource-toolbar"><div className="filter-tabs">{[["all", "All files"], ["images", "Photos"], ["documents", "Documents"], ["invoices", "Invoices"]].map(([value, label]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="toolbar-right"><AreaSelect areas={workspace.areas} areaId={areaId} onChange={onAreaFilter}/><div className="layout-switch"><button className={layout === "grid" ? "selected" : ""} aria-label="Grid view" onClick={() => setLayout("grid")}><LayoutGrid size={16}/></button><button className={layout === "list" ? "selected" : ""} aria-label="List view" onClick={() => setLayout("list")}><List size={16}/></button></div></div></div>
    <div className="resource-search-row"><SearchField value={query} onChange={setQuery} placeholder="Find a file…"/><span>{filtered.length} file{filtered.length !== 1 ? "s" : ""}</span></div>
    {filtered.length ? <div className={`file-grid ${layout === "list" ? "list-layout" : ""}`}>{filtered.map((file) => <article key={file.id} className="library-file-card"><button className={`library-file-preview ${file.data.mimeType?.startsWith("image/") ? "is-image" : file.data.mimeType === "application/pdf" ? "is-pdf" : "is-text"}`} onClick={() => onFile(file)}>{file.data.mimeType?.startsWith("image/") ? <img src={file.data.url || file.data.content} alt={file.data.description || file.title}/> : <div className="document-preview"><FileText size={38}/><span>{file.data.mimeType === "application/pdf" ? "PDF DOCUMENT" : "PERSONAL DOCUMENT"}</span><span className="document-line"/><span className="document-line short"/><span className="document-line"/></div>}</button><div className="library-file-info"><div><button className="file-title-button" onClick={() => onFile(file)}>{file.title}</button><ItemMenu onEdit={() => onEdit(file)} onDelete={() => onDelete({ kind: "file", item: file })}/></div><AreaTag area={workspace.areas.find((area) => area.id === file.areaId)} small/><div className="library-file-meta"><span>{humanSize(file.data.fileSize)}<span>·</span>{new Date(file.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span><a className="icon-button" href={`/api/files/${file.id}`} aria-label={`Download ${file.title}`} download><ArrowDownToLine size={15}/></a></div>{!!file.data.amount && <span className="file-amount">{new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(file.data.amount / 100)} tracked</span>}</div></article>)}</div> : <EmptyState icon={FolderOpen} title={query || areaId || filter !== "all" ? "No files here, just yet" : "Keep the important things close"} description={query || areaId || filter !== "all" ? "Try a different filter, or upload something new." : "Upload photos, receipts, documents, and more. They'll have a home in your life areas."} action="Upload a file" onAction={() => onCreate("file", areaId || undefined)}/>}
    <p className="library-hint"><Check size={13}/>Your files are private to your workspace.<span>Up to 2 MB per file.</span></p>
  </div>;
}

export function NotesView({ workspace, areaId, onAreaFilter, onCreate, onEdit, onDelete, onUpdate }: ResourceProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const notes = workspace.items.filter((item) => item.kind === "note").sort((a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned));
  const filtered = notes.filter((item) => (!areaId || item.areaId === areaId) && (filter !== "pinned" || item.data.pinned) && `${item.title} ${item.data.description || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="resource-page">
    <div className="resource-toolbar"><div className="filter-tabs"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>All notes<span>{notes.length}</span></button><button className={filter === "pinned" ? "selected" : ""} onClick={() => setFilter("pinned")}><Pin size={13}/>Pinned<span>{notes.filter((note) => note.data.pinned).length}</span></button></div><AreaSelect areas={workspace.areas} areaId={areaId} onChange={onAreaFilter}/></div>
    <div className="resource-search-row"><SearchField value={query} onChange={setQuery} placeholder="Find a thought…"/><span>{filtered.length} note{filtered.length !== 1 ? "s" : ""}</span></div>
    {filtered.length ? <div className="notes-grid">{filtered.map((note) => {
      const area = workspace.areas.find((entry) => entry.id === note.areaId);
      return <article className="note-card" key={note.id} style={area ? colorStyle(area) : undefined}><div className="resource-card-top"><span className="note-icon"><StickyNote size={18}/></span><div className="note-actions"><button className={`icon-button ${note.data.pinned ? "pinned" : ""}`} aria-label={`${note.data.pinned ? "Unpin" : "Pin"} ${note.title}`} onClick={() => onUpdate(note, { data: { pinned: !note.data.pinned } }, note.data.pinned ? "Note unpinned." : "Note pinned to the top.")}><Pin size={15}/></button><ItemMenu onEdit={() => onEdit(note)} onDelete={() => onDelete({ kind: "note", item: note })}/></div></div><button className="note-title-button" onClick={() => onEdit(note)}><h3>{note.title}</h3><p>{note.data.description || "A blank page, full of possibility."}</p></button><div className="note-card-footer"><AreaTag area={area} small/><span>{new Date(note.updatedAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span></div></article>;
    })}</div> : <EmptyState icon={StickyNote} title="A home for your thoughts" description="Ideas, reflections, reminders. Capture the little things you don't want to forget." action="Write a note" onAction={() => onCreate("note", areaId || undefined)}/>}
  </div>;
}

export function AreasView({ workspace, pending, areaId, onAreaFilter, onCreate, onEdit, onEditArea, onDelete, onToggle, onFile, language }: ResourceProps & { language?: any }) {
  const [detailKind, setDetailKind] = useState<ItemKind>("target");
  const selected = workspace.areas.find((area) => area.id === areaId);

  const detailTabs = [
    { kind: "target" as ItemKind, label: language === "tr" ? "Hedefler" : language === "fr" ? "Objectifs" : "Targets" },
    { kind: "habit" as ItemKind, label: language === "tr" ? "Alışkanlıklar" : language === "fr" ? "Habitudes" : "Habits" },
    { kind: "plan" as ItemKind, label: language === "tr" ? "Planlar" : language === "fr" ? "Plans" : "Plans" },
    { kind: "chore" as ItemKind, label: language === "tr" ? "Görevler" : language === "fr" ? "Tâches" : "Tasks" },
    { kind: "note" as ItemKind, label: language === "tr" ? "Notlar" : language === "fr" ? "Notes" : "Notes" },
    { kind: "file" as ItemKind, label: language === "tr" ? "Dosyalar" : language === "fr" ? "Fichiers" : "Files" }
  ];

  if (selected) {
    const areaItems = workspace.items.filter((item) => item.areaId === selected.id);
    const shown = areaItems.filter((item) => item.kind === detailKind);
    const progress = progressForArea(selected, workspace.items);

    return <div className="resource-page area-detail-page">
      <button className="text-button back-button" onClick={() => onAreaFilter(null)}>
        <ArrowLeft size={15}/>{language === "tr" ? "Tüm yaşam alanları" : language === "fr" ? "Toutes les catégories" : "All life areas"}
      </button>

      <section className="area-detail-banner" style={colorStyle(selected)}>
        <span className="area-detail-emoji">{selected.emoji}</span>
        <div>
          <p className="eyebrow">
            {language === "tr" ? "KENDİNİZİN BU PARÇASINA BİRAZ ÖZEN GÖSTERİN" : language === "fr" ? "UN PEU DE SOIN POUR CETTE PARTIE DE VOUS" : "A LITTLE CARE FOR THIS PART OF YOU"}
          </p>
                    <h2>{translate(language, selected.name as any) || selected.name}</h2>
                    <p>{translate(language, selected.description as any) || selected.description}</p>
                  </div>
                  <ProgressRing progress={progress} size={105} label={language === "tr" ? "İLERLEME" : "PROGRESS"}/>
                  <div className="area-detail-actions">
                    <button className="button secondary" onClick={() => onEditArea(selected)}><Pencil size={14}/>{language === "tr" ? "Alanı düzenle" : "Edit area"}</button>
                    <button className="icon-button" aria-label={`Delete ${selected.name}`} onClick={() => onDelete({ kind: "area", area: selected })}><Trash2 size={17}/></button>
                  </div>
                </section>

                {(() => {
                  const report = getWeeklyAreaReport(selected, workspace.items, language);
                  return (
                    <div style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      padding: "16px 20px",
                      margin: "16px 0",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "18px" }}>📊</span>
                          <strong style={{ fontSize: "15px", fontWeight: "700", color: "#16132c" }}>
                            {language === "tr" ? "Ne kadar ilerledin?" : "How far have you come?"}
                          </strong>
                        </div>
                        <span style={{ fontSize: "11px", fontWeight: "600", color: "#8b5cf6", backgroundColor: "#f3e8ff", padding: "4px 10px", borderRadius: "12px" }}>
                          {language === "tr" ? "Haftalık Pazar Raporu" : "Weekly Sunday Report"}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ flex: 1, backgroundColor: "#f1f5f9", height: "10px", borderRadius: "5px", overflow: "hidden" }}>
                          <div style={{ width: `${report.percentage}%`, height: "100%", backgroundColor: report.status === "great" ? "#10b981" : "#8b5cf6", transition: "width 0.3s ease" }} />
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#16132c" }}>
                          {report.completed} / {report.total} {language === "tr" ? "görev tamamlandı" : "tasks completed"} ({report.percentage}%)
                        </span>
                      </div>

                      <div style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        backgroundColor: report.status === "great" ? "#ecfdf5" : report.status === "encouraging" ? "#fff7ed" : "#f8fafc",
                        border: `1px solid ${report.status === "great" ? "#a7f3d0" : report.status === "encouraging" ? "#fed7aa" : "#e2e8f0"}`,
                        color: report.status === "great" ? "#065f46" : report.status === "encouraging" ? "#9a3412" : "#475569",
                        fontSize: "13px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                      }}>
                        <span>{report.status === "great" ? "🎉" : report.status === "encouraging" ? "💪" : "ℹ️"}</span>
                        <span>{report.message}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="resource-toolbar">
                  <div className="filter-tabs">
                    {detailTabs.map((tab) => (
                      <button className={detailKind === tab.kind ? "selected" : ""} key={tab.kind} onClick={() => setDetailKind(tab.kind)}>
                        {tab.label}<span>{areaItems.filter((item) => item.kind === tab.kind).length}</span>
                      </button>
                    ))}
                  </div>
                  <button className="button secondary small" onClick={() => onCreate(detailKind, selected.id)}>
                    <Plus size={15}/>{language === "tr" ? "Ekle" : "Add"} {RESOURCE_LABELS[detailKind]}
                  </button>
                </div>

                {shown.length ? (
                  detailKind === "file" ? (
                    <div className="file-grid">
                      {shown.map((file) => (
                        <article key={file.id} className="library-file-card">
                          <button className={`library-file-preview ${file.data.mimeType?.startsWith("image/") ? "is-image" : file.data.mimeType === "application/pdf" ? "is-pdf" : "is-text"}`} onClick={() => onFile(file)}>
                            {file.data.mimeType?.startsWith("image/") ? (
                              <img src={file.data.url || file.data.content} alt={file.data.description || file.title}/>
                            ) : (
                              <div className="document-preview">
                                <FileText size={38}/>
                                <span>{file.data.mimeType === "application/pdf" ? "PDF DOCUMENT" : "PERSONAL DOCUMENT"}</span>
                                <span className="document-line"/>
                                <span className="document-line short"/>
                                <span className="document-line"/>
                              </div>
                            )}
                          </button>
                          <div className="library-file-info">
                            <div>
                              <button className="file-title-button" onClick={() => onFile(file)}>{file.title}</button>
                              <ItemMenu onEdit={() => onEdit(file)} onDelete={() => onDelete({ kind: "file", item: file })}/>
                            </div>
                            <div className="library-file-meta">
                              <span>{humanSize(file.data.fileSize)}<span>·</span>{new Date(file.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
                              <a className="icon-button" href={`/api/files/${file.id}`} aria-label={`Download ${file.title}`} download><ArrowDownToLine size={15}/></a>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="area-resource-list panel">
                      {shown.map((item) => {
                        const complete = item.kind === "habit" ? item.data.history?.includes(dateISO()) : item.data.completed;
                        const targetReport = item.kind === "target" ? getTargetReport(item, language) : null;
                        return <article key={item.id} className="area-resource-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "10px" }}>
                            <span className="area-resource-icon">{item.kind === "file" ? <FileGlyph item={item}/> : item.kind === "target" ? <Target size={20}/> : item.kind === "habit" ? <Zap size={20}/> : item.kind === "plan" ? <CalendarDays size={20}/> : <StickyNote size={20}/>}</span>
                            <button className="area-resource-copy" onClick={() => item.kind === "file" ? onFile(item) : onEdit(item)}>
                              <strong>{item.title}</strong>
                              <small>{itemSubtitle(item)}</small>
                              <RepeatBadge data={item.data}/>
                            </button>
                            {item.kind === "target" && <div className="area-target-progress"><span>{item.data.progress || 0}%</span><div className="progress-track"><span style={{ width: `${item.data.progress || 0}%` }}/></div></div>}
                            {["target", "habit", "plan", "chore"].includes(item.kind) && <CheckButton checked={complete} disabled={pending.has(item.id)} label="Complete" onClick={() => onToggle(item)}/>}
                            <ItemMenu onEdit={() => onEdit(item)} onDelete={() => onDelete({ kind: item.kind, item })}/>
                          </div>
                          {targetReport && targetReport.hasDeadline && targetReport.message && (
                            <div style={{
                              fontSize: "12px",
                              fontWeight: "600",
                              color: targetReport.status === "great" ? "#065f46" : "#9a3412",
                              backgroundColor: targetReport.status === "great" ? "#ecfdf5" : "#fff7ed",
                              border: `1px solid ${targetReport.status === "great" ? "#a7f3d0" : "#fed7aa"}`,
                              padding: "6px 10px",
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              marginTop: "8px"
                            }}>
                              <span>{targetReport.status === "great" ? "🎉" : "💪"}</span>
                              <span>{targetReport.message}</span>
                              <small style={{ color: "#64748b", marginLeft: "auto", fontWeight: "500" }}>Deadline: {targetReport.deadlineDate}</small>
                            </div>
                          )}
                        </article>;
                      })}
                    </div>
                  )
                ) : (
                  <EmptyState
                    icon={detailKind === "target" ? Target : detailKind === "file" ? FolderOpen : Sprout}
                    title={language === "tr" ? "Burada henüz bir şey yok" : "A little space for you"}
                    description={language === "tr" ? "Bu yaşam alanına fotoğraf veya doküman ekleyebilirsiniz." : "Add photos, receipts, or documents to this life area."}
                    action={language === "tr" ? "Yeni Öge Ekle" : "Add item"}
                    onAction={() => onCreate(detailKind, selected.id)}
                  />
                )}
              </div>;
            }

            return <div className="resource-page">
              <section className="areas-intro">
                <Sprout size={23}/>
                <p>{language === "tr" ? "Hayat yapılacaklar listesinden daha fazlasıdır." : "Life is more than a to-do list."}<span>{language === "tr" ? "Her parçasına büyümesi için biraz alan açın." : "Give every part of it a little space to grow."}</span></p>
                <strong>{workspace.areas.length}<span>{language === "tr" ? "yaşam alanı" : "life areas"}</span></strong>
              </section>

              {workspace.areas.length ? (
                <div className="managed-areas-grid">
                  {workspace.areas.map((area) => {
                    const targets = workspace.items.filter((item) => item.kind === "target" && item.areaId === area.id);
                    const progress = progressForArea(area, workspace.items);
                    const files = workspace.items.filter((item) => item.kind === "file" && item.areaId === area.id).length;
                    const notes = workspace.items.filter((item) => item.kind === "note" && area.id === item.areaId).length;
                    return <article key={area.id} className="managed-area" style={colorStyle(area)}>
                      <button className="managed-area-main" onClick={() => onAreaFilter(area.id)}>
                        <div><span className="area-emoji">{area.emoji}</span><ArrowUpRight size={18}/></div>
                        <h3>{translate(language, area.name as any) || area.name}</h3>
                        <p>{translate(language, area.description as any) || area.description}</p>
                        <div className="area-progress-track"><span style={{ width: `${progress}%` }}/></div>
                        <div className="area-card-bottom"><span>{targets.length} {language === "tr" ? "hedef" : "target"}</span><strong>{progress}%</strong></div>
                      </button>
                      <div className="managed-area-footer">
                        <span><StickyNote size={13}/>{notes}<FolderOpen size={13}/>{files}</span>
                        <div>
                          <button className="icon-button" aria-label={`Edit ${area.name}`} onClick={() => onEditArea(area)}><Pencil size={14}/></button>
                          <button className="icon-button" aria-label={`Delete ${area.name}`} onClick={() => onDelete({ kind: "area", area })}><Trash2 size={14}/></button>
                        </div>
                      </div>
                    </article>;
                  })}
                </div>
              ) : (
                <EmptyState icon={Sprout} title="Make room for your whole life" description="Mind, heart, body, and beyond." action="Create a life area" onAction={() => onCreate("area")}/>
              )}
            </div>;
          }

