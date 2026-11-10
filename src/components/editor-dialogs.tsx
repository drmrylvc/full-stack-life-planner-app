"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowRight, CalendarDays, Check, FileText, FolderOpen, ImagePlus, ListChecks, Pencil, Plus, Sprout, StickyNote, Target, Trash2, UploadCloud, Zap } from "lucide-react";
import { AREA_COLORS, RESOURCE_LABELS, type AreaColor, type AreaInput, type EditorState, type ItemData, type ItemInput, type ItemKind, type LifeArea, type PlannerItem, type RepeatFrequency, type Workspace } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { clearSeries, MAX_REPEATS, remainingRepeats, supportsRepeat } from "@/lib/recurrence";
import { areaTheme } from "@/lib/theme";
import { addDays, humanSize, parseDate, dateISO } from "@/lib/utils";
import { RepeatControls } from "./repeat-controls";
import { AreaTag, FileGlyph, Modal, Spinner } from "./ui";
import { requestNotificationPermission, scheduleTaskReminder } from "@/lib/notifications";

const EMOJIS = ["🌱", "❤️", "🧠", "👨‍👩‍👧‍👦", "💼", "🏋️", "🎨", "✨", "🧘", "📚", "✈️", "☀️"];

function calculateSelectedDates(baseDateStr: string, days: number[]): string[] {
  if (!days || days.length === 0) return [baseDateStr || dateISO()];
  const [year, month, dayStr] = (baseDateStr || dateISO()).split("-").map(Number);
  const baseDate = new Date(year, month - 1, dayStr);
  const currentDayIndex = baseDate.getDay(); // 0 (Sun) - 6 (Sat)

  return days.map((targetDay) => {
    const diff = targetDay - currentDayIndex;
    const targetDate = new Date(year, month - 1, dayStr + diff);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
}

export function AddAnythingDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (kind: ItemKind | "area") => void }) {
  const choices = [
    { kind: "target" as const, icon: Target, title: "A meaningful target", text: "Something to work towards", color: "lavender" },
    { kind: "plan" as const, icon: CalendarDays, title: "A planned moment", text: "Make a little time for it", color: "blue" },
    { kind: "chore" as const, icon: ListChecks, title: "A task", text: "A to-do under your calendar", color: "peach" },
    { kind: "habit" as const, icon: Zap, title: "A daily habit", text: "Small steps, every day", color: "peach" },
    { kind: "note" as const, icon: StickyNote, title: "A little thought", text: "Give your ideas a home", color: "rose" },
    { kind: "file" as const, icon: FolderOpen, title: "An important file", text: "Keep the good things close", color: "mint" },
    { kind: "area" as const, icon: Sprout, title: "A new life area", text: "Room for another part of you", color: "sand" },
  ];
  return <Modal title="Make a little room." eyebrow="ezlife26 · ADD ANYTHING" onClose={onClose}><p className="modal-description">A thought, a goal, a moment. What would you like to add?</p><div className="quick-add-grid">{choices.map((choice) => <button key={choice.kind} onClick={() => onChoose(choice.kind)}><span style={{ background: AREA_COLORS[choice.color as AreaColor].background, color: AREA_COLORS[choice.color as AreaColor].text }}><choice.icon size={23}/></span><strong>{choice.title}</strong><small>{choice.text}</small><ArrowRight size={15}/></button>)}</div><p className="dialog-footnote"><Sprout size={14}/>You don't need a perfect plan. Just a place to start.</p></Modal>;
}

interface EditorProps {
  editor: EditorState;
  workspace: Workspace;
  date: string;
  language?: Lang;
  onClose: () => void;
  onSave: (editor: EditorState, input: ItemInput | AreaInput) => Promise<unknown>;
  onDelete: (editor: EditorState) => void;
}

export function EditorDialog({ editor, workspace, date, language = "en", onClose, onSave, onDelete }: EditorProps) {
  const isArea = editor.kind === "area";
  const editing = !!(editor.item || editor.area);
  const initialData = editor.item?.data || {};
  const savedAreas = workspace.areas.filter((area) => !area.id.startsWith("temp-"));
  const tr = (key: string) => translate(language, key as any) || key;

  const initialAreaId = editor.item ? editor.item.areaId : editor.areaId;

  const [title, setTitle] = useState(editor.area?.name || editor.item?.title || "");
  const [description, setDescription] = useState(editor.area?.description || initialData.description || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [areaId, setAreaId] = useState(savedAreas.some((area) => area.id === initialAreaId) ? initialAreaId! : "");
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [time, setTime] = useState(initialData.time || "09:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([parseDate(date || dateISO()).getDay()]);

  const [progress, setProgress] = useState(initialData.progress || 0);
  const [dueDate, setDueDate] = useState(initialData.dueDate ?? (editing ? "" : addDays(date, 14)));
  const [priority, setPriority] = useState<ItemData["priority"]>(initialData.priority || "medium");
  const [planDate, setPlanDate] = useState(initialData.date || date);
  const [duration, setDuration] = useState(initialData.duration || 30);
  const [repeat, setRepeat] = useState<RepeatFrequency>(initialData.repeat || "none");
  const [repeatCount, setRepeatCount] = useState(String(initialData.seriesId ? remainingRepeats(initialData) : initialData.repeatCount || 3));
  const [unit, setUnit] = useState(initialData.unit || "");
  const [pinned, setPinned] = useState(initialData.pinned || false);
  const [remindPhone, setRemindPhone] = useState(initialData.remindPhone || false);
  const [reminderTime, setReminderTime] = useState(initialData.reminderTime || "at_time");
  const [emoji, setEmoji] = useState(editor.area?.emoji || "🌱");
  const [color, setColor] = useState<AreaColor>(editor.area?.color || "lavender");
  const [fileData, setFileData] = useState<ItemData>(initialData);
  const [fileName, setFileName] = useState(editor.item?.title || "");
  const [amount, setAmount] = useState(initialData.amount ? String(initialData.amount / 100) : "");
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const formId = "editor-form-id";
  const label = RESOURCE_LABELS[editor.kind];
  const Icon = editor.kind === "target" ? Target : editor.kind === "plan" ? CalendarDays : editor.kind === "chore" ? ListChecks : editor.kind === "file" ? FolderOpen : editor.kind === "note" ? StickyNote : editor.kind === "habit" ? Zap : Sprout;

  const isJournal = !!(
    editor.isJournal ||
    editor.kind === "note" ||
    editor.journalDate ||
    initialData.isJournal ||
    title?.toLowerCase().includes("journal") ||
    editor.item?.title?.toLowerCase().includes("journal")
  );
  const journalDateStr = editor.journalDate || editor.item?.data?.date || (title?.startsWith("Journal - ") ? title.replace("Journal - ", "") : date);

  function readFile(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError(language === "tr" ? "Lütfen 10 MB'a kadar bir dosya seçin." : "Choose a file up to 10 MB."); return; }
    setReading(true); setError("");
    const reader = new FileReader();
    reader.onload = () => {
      setFileData({ content: reader.result as string, mimeType: file.type || "application/octet-stream", fileSize: file.size });
      setFileName(file.name);
      if (!title || title === fileName) setTitle(file.name);
      setReading(false);
    };
    reader.onerror = () => { setReading(false); setError("We couldn't read that file. Please choose it again."); };
    reader.readAsDataURL(file);
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const f = event.target.files[0];
      setSelectedFile(f);
      readFile(f);
    }
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current || reading) return;
    setError("");
    const inputTitle = isJournal ? `Journal - ${journalDateStr}` : title.trim();
    if (!isJournal && !inputTitle) { setError(`Give your ${label} a name first.`); return; }
    if (supportsRepeat(editor.kind) && repeat !== "none" && (repeatCount.trim() === "" || !Number.isInteger(Number(repeatCount)) || Number(repeatCount) < 0 || Number(repeatCount) > MAX_REPEATS)) {
      setError(`Number of repeats must be a whole number from 0 to ${MAX_REPEATS}.`); return;
    }
    if (editor.kind === "file" && !fileData.content && !fileData.url) { setError("Choose a file to upload first."); return; }

    busyRef.current = true;
    setBusy(true);

    try {
      let input: AreaInput | ItemInput;
      if (isArea) {
        input = { name: title.trim(), description, emoji: emoji || "🌱", color };
      } else {
        const data: ItemData = { ...clearSeries(initialData), description };

        if (editor.kind === "target") {
          data.progress = progress;
          data.completed = progress === 100;
          data.dueDate = dueDate || undefined;
          data.priority = priority;
          data.date = planDate || date;
          if (fileData.content) {
            Object.assign(data, { content: fileData.content, mimeType: fileData.mimeType, fileSize: fileData.fileSize });
          }
        }

        if (editor.kind === "plan") { data.date = planDate; data.time = time; data.duration = duration; data.completed = initialData.completed || false; }
        if (editor.kind === "chore") { data.date = planDate || date; data.completed = initialData.completed || false; }
        if (supportsRepeat(editor.kind) && !addToCalendar) { data.repeat = repeat; data.repeatCount = repeat === "none" ? 0 : Number(repeatCount); }
        if (editor.kind === "habit") { data.unit = unit; data.history = initialData.history || []; }
        if (editor.kind === "note") data.pinned = pinned;
        if (isJournal) {
          data.date = journalDateStr;
          data.isJournal = true;
          data.pinned = true;
        }
        if (remindPhone) {
          data.remindPhone = true;
          data.reminderTime = reminderTime;
          scheduleTaskReminder(inputTitle, planDate || date, time, reminderTime);
        }
        if (editor.kind === "file") {
          Object.assign(data, fileData, { description, amount: Math.round((Number(amount) || 0) * 100) });
          if (!fileData.url) delete data.url;
        }
        input = { title: inputTitle, areaId: isJournal ? null : (savedAreas.some((area) => area.id === areaId) ? areaId : null), data };
      }

      if (editor.kind === "target" && fileData.content && savedAreas.some((a) => a.id === areaId)) {
        try {
          const fileInputObj: ItemInput = {
            title: fileName || `${title.trim()} file`,
            areaId: areaId,
            data: {
              content: fileData.content,
              mimeType: fileData.mimeType,
              fileSize: fileData.fileSize,
              description: description || `Attached to target: ${title.trim()}`
            }
          };
          await onSave({ ...editor, kind: "file", item: null, areaId }, fileInputObj);
        } catch (fileErr) {
          console.error("Attached target file creation error:", fileErr);
        }
      }

      if (editor.kind === "target" && addToCalendar) {
        const targetDates = calculateSelectedDates(planDate || date, selectedDays);

        for (const cDate of targetDates) {
          const calendarPlanInput: ItemInput = {
            title: `🎯 Target: ${title.trim()}`,
            areaId: savedAreas.some((a) => a.id === areaId) ? areaId : null,
            data: {
              completed: false,
              description: description || `Target plan for ${title.trim()}`,
              time: time || "09:00",
              date: cDate,
              duration: 30,
              repeat: "weekly",
              repeatCount: 12
            }
          };

          await onSave(
            {
              ...editor,
              kind: "plan",
              item: null,
              areaId: savedAreas.some((a) => a.id === areaId) ? areaId : null
            },
            calendarPlanInput
          );
        }
      }

      await onSave(editor, input);
      onClose();
    } catch (e) {
      console.error(e);
      setError(language === "tr" ? "Kaydedilirken bir hata oluştu." : "An error occurred while saving.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const previewTheme = areaTheme({ color });

  return (
    <Modal
      title={isJournal ? `📖 Journal · ${formatDate(journalDateStr, { weekday: "long", month: "long", day: "numeric" }, localeFor(language))}` : `${editing ? "Edit" : "Add"} ${label === "life area" ? "a life area" : `${editing ? "your" : "a"} ${label}`}`}
      eyebrow={isJournal ? "ezlife26 · PERSONAL NOTEBOOK" : `ezlife26 · ${editing ? "A LITTLE REFRESH" : "MAKE ROOM FOR WHAT MATTERS"}`}
      onClose={onClose}
      disableClose={busy}
      className={`editor-modal kind-${editor.kind} ${editor.kind === "note" || isJournal ? "note-editor-modal" : ""}`}
      wide={editor.kind === "note" || isJournal}
    >
      <form id={formId} onSubmit={submit} className="editor-form">
        <div className="editor-fields">
          {!isJournal && (
            <div className="editor-context">
              <span><Icon size={20}/></span>
              <div>
                <strong>{editing ? "Make it work for your life" : `Make room for a ${label}`}</strong>
                <small>{isArea ? "Your own corner of a balanced life." : "Your details stay together in your planner."}</small>
              </div>
              {!isArea && <AreaTag area={savedAreas.find((area) => area.id === areaId)} small/>}
            </div>
          )}

          {isArea && (
            <div className="editor-area-preview" style={{ background: previewTheme.gradient, color: previewTheme.ink }}>
              <span>{emoji}</span>
              <div>
                <strong>{title || "Your life area"}</strong>
                <small>{description || "Give this part of life a little intention."}</small>
              </div>
            </div>
          )}

          <fieldset disabled={busy} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {isJournal ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", padding: "4px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #16132c", paddingBottom: "10px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#16132c", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px" }}>📝</span> {formatDate(journalDateStr, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, localeFor(language))}
                  </span>
                  <span style={{ fontSize: "12px", color: "#8b5cf6", fontWeight: "600", backgroundColor: "#f3e8ff", padding: "3px 12px", borderRadius: "12px" }}>
                    {language === "tr" ? "Kişisel Günlük" : "Personal Journal"}
                  </span>
                </div>
                <textarea
                  autoFocus
                  rows={14}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={language === "tr" ? "Bugününüz hakkındaki kişisel notlarınızı ve düşüncelerinizi buraya yazın..." : "Write your personal thoughts, notes, and reflections for today here..."}
                  style={{
                    backgroundColor: "#fdfbf7",
                    backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, #cbd5e1 31px, #cbd5e1 32px)",
                    lineHeight: "32px",
                    fontSize: "15px",
                    fontFamily: "'Manrope', 'DM Sans', sans-serif",
                    color: "#1e293b",
                    padding: "8px 18px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "12px",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.03)",
                    width: "100%",
                    minHeight: "380px",
                    resize: "vertical",
                    outline: "none"
                  }}
                />
              </div>
            ) : (
              <>
                {!isArea && (
                  <label className="form-field">
                    <span>{editor.kind === "note" ? "Give your thought a title" : editor.kind === "file" ? "File name" : editor.kind === "habit" ? "Your daily habit" : editor.kind === "chore" ? "Task" : editor.kind === "plan" ? "What are you making time for?" : "Your meaningful target"}</span>
                    <input required maxLength={isArea ? 80 : 200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isArea ? "e.g. Creativity, Career, Adventure" : editor.kind === "habit" ? "e.g. Read a few pages" : editor.kind === "note" ? "A thought worth keeping…" : editor.kind === "file" ? "A name to find it by" : editor.kind === "chore" ? "e.g. Pick up groceries" : editor.kind === "plan" ? "A moment that matters…" : "Something worth working towards…"}/>
                  </label>
                )}

                {/* Life Area customization */}
                {isArea && (
                  <>
                    <div className="form-field">
                      <span>Choose an emoji</span>
                      <div className="emoji-picker" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {EMOJIS.map((e) => (
                          <button key={e} type="button" className={emoji === e ? "selected" : ""} onClick={() => setEmoji(e)} style={{ fontSize: '20px', padding: '6px 10px', borderRadius: '8px', border: emoji === e ? '2px solid #8b5cf6' : '1px solid #e5dff0', background: emoji === e ? '#eee5ff' : '#f8f5fc', cursor: 'pointer' }}>
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="form-field">
                      <span>Description <small>Optional</small></span>
                      <textarea rows={2} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Give this part of life a little intention…"/>
                    </label>

                    <div className="form-field">
                      <span>Theme color</span>
                      <div className="color-picker" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                        {(["lavender", "blue", "peach", "rose", "mint", "sand"] as AreaColor[]).map((c) => (
                          <button key={c} type="button" className={color === c ? "selected" : ""} onClick={() => setColor(c)} style={{ background: AREA_COLORS[c].background, color: AREA_COLORS[c].text, border: color === c ? '2px solid #8b5cf6' : 'none', borderRadius: '10px', padding: '10px 4px', fontWeight: '600', cursor: 'pointer', textAlign: 'center', fontSize: '11px' }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {!isArea && (
                  <label className="form-field">
                    <span>{editor.kind === "file" ? (language === "tr" ? "Klasör / Yaşam Alanı" : "Folder / Life Area") : "Life area"} <small>Optional</small></span>
                    <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
                      <option value="">Personal · No folder</option>
                      {savedAreas.map((area) => (
                        <option key={area.id} value={area.id}>{area.emoji} {area.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                {!isArea && (
                  <label className="form-field">
                    <span>{editor.kind === "note" ? "Your thought" : "Notes & details"} <small>Optional</small></span>
                    <textarea rows={3} maxLength={12000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={editor.kind === "note" ? "A thought worth keeping…" : "Any details you want to remember…"}/>
                  </label>
                )}

                {editor.kind === "file" && (
                  <>
                    <input type="file" className="visually-hidden" ref={fileInput} onChange={(event) => readFile(event.target.files?.[0])}/>
                    <div className={`file-dropzone ${dragging ? "dragging" : ""} ${fileData.content || fileData.url ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files?.[0]); }}>
                      {fileData.content || fileData.url ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
                          <span className="uploaded-file-icon">
                            {fileData.mimeType?.startsWith("image/") ? (
                              <img
                                src={fileData.content || fileData.url}
                                alt="Preview"
                                style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.1)" }}
                              />
                            ) : (
                              <FileText size={28}/>
                            )}
                          </span>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                            <strong style={{ fontSize: "14px" }}>{fileName}</strong>
                            <small style={{ color: "#64748b" }}>
                              {humanSize(fileData.fileSize)} · 📁 Folder: {savedAreas.find((a) => a.id === areaId)?.emoji || "📂"} {savedAreas.find((a) => a.id === areaId)?.name || "Personal"}
                            </small>
                          </div>
                          <button type="button" className="text-button" onClick={() => fileInput.current?.click()}>
                            Replace
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => fileInput.current?.click()}>
                          {reading ? <Spinner size={28}/> : <UploadCloud size={30}/>}
                          <strong>{reading ? "Getting your file ready…" : "Drop a picture or document here"}</strong>
                          <span>or <u>browse files</u> · Photos, PDFs, Docs up to 10 MB</span>
                        </button>
                      )}
                    </div>
                    <label className="form-field">
                      <span>Amount / Cost <small>Optional</small></span>
                      <input type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00"/>
                    </label>
                  </>
                )}

                {editor.kind === "target" && (
                  <>
                    <label className="form-field">
                      <span>A gentle deadline</span>
                      <input type="date" aria-label="A gentle deadline" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/>
                      <small style={{ color: "#ef4444", fontSize: "12.5px", fontWeight: "600", display: "block", marginTop: "4px" }}>
                        {language === "tr"
                          ? "Haftalık rapor için isteğe bağlı. Bir hedef son tarih olmadan da kaydedilebilir."
                          : "Optional for weekly report. A target can be saved without a deadline."}
                      </small>
                    </label>

                    {!isArea && (
                      <label className="form-field">
                        <span>{tr("addFile")} <small>Optional</small></span>
                        <input type="file" onChange={handleFileChange} style={{ width: "100%", padding: "10px", border: "1px dashed rgba(22, 19, 44, 0.2)", borderRadius: "12px", backgroundColor: "rgba(22, 19, 44, 0.02)", cursor: "pointer", color: "#16132c" }}/>
                        {selectedFile && <small style={{ color: "#10b981", display: "block", marginTop: "6px", fontWeight: "600" }}>📎 Selected File: {selectedFile.name}</small>}
                      </label>
                    )}

                    <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(22, 19, 44, 0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '14px', color: '#16132c' }}>Add to Calendar</strong>
                          <small style={{ color: '#888', display: 'block', marginTop: '2px', fontSize: '12px' }}>Display this item directly on your calendar view.</small>
                        </div>
                        <input type="checkbox" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16132c' }}/>
                      </div>

                      {addToCalendar && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '14px' }}>
                          <div className="form-row">
                            <label className="form-field">
                              <span>Plan Date</span>
                              <input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/>
                            </label>
                            <label className="form-field">
                              <span>Plan Time</span>
                              <input type="time" required value={time} onChange={(event) => setTime(event.target.value)}/>
                            </label>
                          </div>

                          {/* Multi-Day Selector (Pic 2 style) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#888', letterSpacing: '1px' }}>
                              {language === "tr" ? "TEKRARLANACAK GÜNLER" : "REPEAT DAYS OF THE WEEK"}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                              {[
                                { label: language === "tr" ? "Pz" : "S", value: 0 },
                                { label: language === "tr" ? "Pt" : "M", value: 1 },
                                { label: language === "tr" ? "Sa" : "T", value: 2 },
                                { label: language === "tr" ? "Ça" : "W", value: 3 },
                                { label: language === "tr" ? "Pe" : "T", value: 4 },
                                { label: language === "tr" ? "Cu" : "F", value: 5 },
                                { label: language === "tr" ? "Ct" : "S", value: 6 },
                              ].map((day) => {
                                const isSelected = selectedDays.includes(day.value);
                                return (
                                  <button
                                    key={day.value}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (isSelected) {
                                        if (selectedDays.length > 1) {
                                          setSelectedDays(selectedDays.filter((d) => d !== day.value));
                                        }
                                      } else {
                                        setSelectedDays([...selectedDays, day.value].sort());
                                      }
                                    }}
                                    style={{
                                      width: '38px',
                                      height: '38px',
                                      borderRadius: '50%',
                                      border: 'none',
                                      fontSize: '13px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      backgroundColor: isSelected ? '#16132c' : 'rgba(22, 19, 44, 0.05)',
                                      color: isSelected ? '#ffffff' : '#16132c',
                                      boxShadow: isSelected ? '0 4px 10px rgba(22,19,44,0.25)' : 'none'
                                    }}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {editor.kind === "plan" && (
                  <>
                    <div className="form-row">
                      <label className="form-field"><span>Day</span><input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/></label>
                      <label className="form-field"><span>Time</span><input type="time" required value={time} onChange={(event) => setTime(event.target.value)}/></label>
                    </div>
                    <RepeatControls repeat={repeat} count={repeatCount} start={planDate || date} language={language} editingSeries={!!initialData.seriesId} onRepeat={setRepeat} onCount={setRepeatCount}/>
                  </>
                )}

                {(editor.kind === "plan" || editor.kind === "target") && (
                  <div style={{ padding: "12px", backgroundColor: "rgba(139, 92, 246, 0.05)", borderRadius: "12px", border: "1px solid rgba(139, 92, 246, 0.15)", marginTop: "12px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: "600", color: "#16132c", fontSize: "13px" }}>
                      <input
                        type="checkbox"
                        checked={remindPhone}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          setRemindPhone(checked);
                          if (checked) {
                            await requestNotificationPermission();
                          }
                        }}
                        style={{ width: "18px", height: "18px", accentColor: "#8b5cf6" }}
                      />
                      <span>🔔 {language === "tr" ? "Telefondan Bildirim / Hatırlatıcı Al" : "Get Phone Reminder"}</span>
                    </label>

                    {remindPhone && (
                      <div style={{ marginTop: "10px" }}>
                        <label className="form-field">
                          <span>{language === "tr" ? "Hatırlatma Zamanı" : "Reminder Timing"}</span>
                          <select value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}>
                            <option value="at_time">{language === "tr" ? "Etkinlik / Görev zamanında" : "At time of event / task"}</option>
                            <option value="5_min_before">{language === "tr" ? "5 dakika önce" : "5 minutes before"}</option>
                            <option value="10_min_before">{language === "tr" ? "10 dakika önce" : "10 minutes before"}</option>
                            <option value="15_min_before">{language === "tr" ? "15 dakika önce" : "15 minutes before"}</option>
                            <option value="30_min_before">{language === "tr" ? "30 dakika önce" : "30 minutes before"}</option>
                            <option value="1_hour_before">{language === "tr" ? "1 saat önce" : "1 hour before"}</option>
                            <option value="1_day_before">{language === "tr" ? "1 gün önce" : "1 day before"}</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {editor.kind === "habit" && (
                  <>
                    <label className="form-field">
                      <span>Unit / Target <small>Optional</small></span>
                      <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. 20 mins, 5 pages, 8 glasses"/>
                    </label>
                    <RepeatControls repeat={repeat} count={repeatCount} start={planDate || date} language={language} editingSeries={!!initialData.seriesId} onRepeat={setRepeat} onCount={setRepeatCount}/>
                  </>
                )}

                {editor.kind === "note" && (
                  <label className="checkbox-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                    <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)}/>
                    <span>Pin this thought to the top of your notes</span>
                  </label>
                )}
              </>
            )}

            {/* Life Area customization */}
            {isArea && (
              <>
                <div className="form-field">
                  <span>Choose an emoji</span>
                  <div className="emoji-picker" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" className={emoji === e ? "selected" : ""} onClick={() => setEmoji(e)} style={{ fontSize: '20px', padding: '6px 10px', borderRadius: '8px', border: emoji === e ? '2px solid #8b5cf6' : '1px solid #e5dff0', background: emoji === e ? '#eee5ff' : '#f8f5fc', cursor: 'pointer' }}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="form-field">
                  <span>Description <small>Optional</small></span>
                  <textarea rows={2} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Give this part of life a little intention…"/>
                </label>

                <div className="form-field">
                  <span>Theme color</span>
                  <div className="color-picker" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                    {(["lavender", "blue", "peach", "rose", "mint", "sand"] as AreaColor[]).map((c) => (
                      <button key={c} type="button" className={color === c ? "selected" : ""} onClick={() => setColor(c)} style={{ background: AREA_COLORS[c].background, color: AREA_COLORS[c].text, border: color === c ? '2px solid #8b5cf6' : 'none', borderRadius: '10px', padding: '10px 4px', fontWeight: '600', cursor: 'pointer', textAlign: 'center', fontSize: '11px' }}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!isArea && (
              <label className="form-field">
                <span>{editor.kind === "file" ? (language === "tr" ? "Klasör / Yaşam Alanı" : "Folder / Life Area") : "Life area"} <small>Optional</small></span>
                <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
                  <option value="">Personal · No folder</option>
                  {savedAreas.map((area) => (
                    <option key={area.id} value={area.id}>{area.emoji} {area.name}</option>
                  ))}
                </select>
              </label>
            )}

            {!isArea && (
              <label className="form-field">
                <span>{editor.kind === "note" ? "Your thought" : "Notes & details"} <small>Optional</small></span>
                <textarea rows={3} maxLength={12000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={editor.kind === "note" ? "A thought worth keeping…" : "Any details you want to remember…"}/>
              </label>
            )}

            {editor.kind === "file" && (
              <>
                <input type="file" className="visually-hidden" ref={fileInput} onChange={(event) => readFile(event.target.files?.[0])}/>
                <div className={`file-dropzone ${dragging ? "dragging" : ""} ${fileData.content || fileData.url ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files?.[0]); }}>
                  {fileData.content || fileData.url ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%" }}>
                      <span className="uploaded-file-icon">
                        {fileData.mimeType?.startsWith("image/") ? (
                          <img
                            src={fileData.content || fileData.url}
                            alt="Preview"
                            style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.1)" }}
                          />
                        ) : (
                          <FileText size={28}/>
                        )}
                      </span>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <strong style={{ fontSize: "14px" }}>{fileName}</strong>
                        <small style={{ color: "#64748b" }}>
                          {humanSize(fileData.fileSize)} · 📁 Folder: {savedAreas.find((a) => a.id === areaId)?.emoji || "📂"} {savedAreas.find((a) => a.id === areaId)?.name || "Personal"}
                        </small>
                      </div>
                      <button type="button" className="text-button" onClick={() => fileInput.current?.click()}>
                        Replace
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInput.current?.click()}>
                      {reading ? <Spinner size={28}/> : <UploadCloud size={30}/>}
                      <strong>{reading ? "Getting your file ready…" : "Drop a picture or document here"}</strong>
                      <span>or <u>browse files</u> · Photos, PDFs, Docs up to 10 MB</span>
                    </button>
                  )}
                </div>
                <label className="form-field">
                  <span>Amount / Cost <small>Optional</small></span>
                  <input type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00"/>
                </label>
              </>
            )}

            {editor.kind === "target" && (
              <>
                <label className="form-field">
                  <span>A gentle deadline</span>
                  <input type="date" aria-label="A gentle deadline" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/>
                  <small style={{ color: "#ef4444", fontSize: "12.5px", fontWeight: "600", display: "block", marginTop: "4px" }}>
                    {language === "tr"
                      ? "Haftalık rapor için isteğe bağlı. Bir hedef son tarih olmadan da kaydedilebilir."
                      : "Optional for weekly report. A target can be saved without a deadline."}
                  </small>
                </label>

                {!isArea && (
                  <label className="form-field">
                    <span>{tr("addFile")} <small>Optional</small></span>
                    <input type="file" onChange={handleFileChange} style={{ width: "100%", padding: "10px", border: "1px dashed rgba(22, 19, 44, 0.2)", borderRadius: "12px", backgroundColor: "rgba(22, 19, 44, 0.02)", cursor: "pointer", color: "#16132c" }}/>
                    {selectedFile && <small style={{ color: "#10b981", display: "block", marginTop: "6px", fontWeight: "600" }}>📎 Selected File: {selectedFile.name}</small>}
                  </label>
                )}

                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(22, 19, 44, 0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: '#16132c' }}>Add to Calendar</strong>
                      <small style={{ color: '#888', display: 'block', marginTop: '2px', fontSize: '12px' }}>Display this item directly on your calendar view.</small>
                    </div>
                    <input type="checkbox" checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16132c' }}/>
                  </div>

                  {addToCalendar && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '14px' }}>
                      <div className="form-row">
                        <label className="form-field">
                          <span>Plan Date</span>
                          <input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/>
                        </label>
                        <label className="form-field">
                          <span>Plan Time</span>
                          <input type="time" required value={time} onChange={(event) => setTime(event.target.value)}/>
                        </label>
                      </div>

                      {/* Multi-Day Selector (Pic 2 style) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#888', letterSpacing: '1px' }}>
                          {language === "tr" ? "TEKRARLANACAK GÜNLER" : "REPEAT DAYS OF THE WEEK"}
                        </span>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                          {[
                            { label: language === "tr" ? "Pz" : "S", value: 0 },
                            { label: language === "tr" ? "Pt" : "M", value: 1 },
                            { label: language === "tr" ? "Sa" : "T", value: 2 },
                            { label: language === "tr" ? "Ça" : "W", value: 3 },
                            { label: language === "tr" ? "Pe" : "T", value: 4 },
                            { label: language === "tr" ? "Cu" : "F", value: 5 },
                            { label: language === "tr" ? "Ct" : "S", value: 6 },
                          ].map((day) => {
                            const isSelected = selectedDays.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (isSelected) {
                                    if (selectedDays.length > 1) {
                                      setSelectedDays(selectedDays.filter((d) => d !== day.value));
                                    }
                                  } else {
                                    setSelectedDays([...selectedDays, day.value].sort());
                                  }
                                }}
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  backgroundColor: isSelected ? '#16132c' : 'rgba(22, 19, 44, 0.05)',
                                  color: isSelected ? '#ffffff' : '#16132c',
                                  boxShadow: isSelected ? '0 4px 10px rgba(22,19,44,0.25)' : 'none'
                                }}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {editor.kind === "plan" && (
              <>
                <div className="form-row">
                  <label className="form-field"><span>Day</span><input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/></label>
                  <label className="form-field"><span>Time</span><input type="time" required value={time} onChange={(event) => setTime(event.target.value)}/></label>
                </div>
                <RepeatControls repeat={repeat} count={repeatCount} start={planDate || date} language={language} editingSeries={!!initialData.seriesId} onRepeat={setRepeat} onCount={setRepeatCount}/>
              </>
            )}

            {(editor.kind === "plan" || editor.kind === "target") && (
              <div style={{ padding: "12px", backgroundColor: "rgba(139, 92, 246, 0.05)", borderRadius: "12px", border: "1px solid rgba(139, 92, 246, 0.15)", marginTop: "12px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: "600", color: "#16132c", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={remindPhone}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setRemindPhone(checked);
                      if (checked) {
                        await requestNotificationPermission();
                      }
                    }}
                    style={{ width: "18px", height: "18px", accentColor: "#8b5cf6" }}
                  />
                  <span>🔔 {language === "tr" ? "Telefondan Bildirim / Hatırlatıcı Al" : "Get Phone Reminder"}</span>
                </label>

                {remindPhone && (
                  <div style={{ marginTop: "10px" }}>
                    <label className="form-field">
                      <span>{language === "tr" ? "Hatırlatma Zamanı" : "Reminder Timing"}</span>
                      <select value={reminderTime} onChange={(e) => setReminderTime(e.target.value)}>
                        <option value="at_time">{language === "tr" ? "Etkinlik / Görev zamanında" : "At time of event / task"}</option>
                        <option value="5_min_before">{language === "tr" ? "5 dakika önce" : "5 minutes before"}</option>
                        <option value="10_min_before">{language === "tr" ? "10 dakika önce" : "10 minutes before"}</option>
                        <option value="15_min_before">{language === "tr" ? "15 dakika önce" : "15 minutes before"}</option>
                        <option value="30_min_before">{language === "tr" ? "30 dakika önce" : "30 minutes before"}</option>
                        <option value="1_hour_before">{language === "tr" ? "1 saat önce" : "1 hour before"}</option>
                        <option value="1_day_before">{language === "tr" ? "1 gün önce" : "1 day before"}</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}

            {editor.kind === "habit" && (
              <>
                <label className="form-field">
                  <span>Unit / Target <small>Optional</small></span>
                  <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. 20 mins, 5 pages, 8 glasses"/>
                </label>
                <RepeatControls repeat={repeat} count={repeatCount} start={planDate || date} language={language} editingSeries={!!initialData.seriesId} onRepeat={setRepeat} onCount={setRepeatCount}/>
              </>
            )}

            {editor.kind === "note" && (
              <label className="checkbox-field" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)}/>
                <span>Pin this thought to the top of your notes</span>
              </label>
            )}

            {error && <p className="error-message" style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px', fontWeight: '500' }}>{error}</p>}
          </fieldset>
        </div>

        <div className="modal-actions">
          {editing ? (
            <button
              type="button"
              className="delete-button"
              onClick={() => {
                const areaOrItemName = editor.area?.name || editor.item?.title || title || "this item";
                const confirmMsg = language === "tr"
                  ? `"${areaOrItemName}" ${isArea ? "yaşam alanını" : ""} silmek istediğinize emin misiniz?`
                  : `Are you sure you want to delete "${areaOrItemName}"?`;
                if (confirm(confirmMsg)) onDelete(editor);
              }}
              disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '600' }}
            >
              <Trash2 size={16}/> {isArea ? (language === "tr" ? "Yaşam Alanını Sil" : "Delete Life Area") : (language === "tr" ? "Sil" : "Remove")}
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy || reading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {busy ? <Spinner size={16}/> : <Check size={16}/>} Save {label}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
