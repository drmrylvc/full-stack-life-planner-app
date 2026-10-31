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

function nextOccurrenceISO(weekday: number | number[], hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  const targetDay = Array.isArray(weekday) ? (weekday[0] ?? now.getDay()) : weekday;
  let diff = (targetDay - now.getDay() + 7) % 7;
  if (diff === 0 && d <= now) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export function EditorDialog({ editor, workspace, date, language = "en", onClose, onSave, onDelete }: EditorProps) {
  const isArea = editor.kind === "area";
  const editing = !!(editor.item || editor.area);
  const initialData = editor.item?.data || {};
  const savedAreas = workspace.areas.filter((area) => !area.id.startsWith("temp-"));
  const savedGoals = (workspace as any).goals?.filter((goal: any) => !goal.id.startsWith("temp-")) || [];
  const tr = (key: string) => translate(language, key as any) || key;

  const initialAreaId = editor.item ? editor.item.areaId : editor.areaId;
  const initialGoalId = editor.item ? (editor.item as any).goalId : "";

  const [title, setTitle] = useState(editor.area?.name || editor.item?.title || "");
  const [description, setDescription] = useState(editor.area?.description || initialData.description || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
        setSelectedFile(event.target.files[0]);
      }
    };


  const [areaId, setAreaId] = useState(savedAreas.some((area) => area.id === initialAreaId) ? initialAreaId! : "");
  const [goalId, setGoalId] = useState(savedGoals.some((goal: any) => goal.id === initialGoalId) ? initialGoalId! : "");

  const [addAsTask, setAddAsTask] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [time, setTime] = useState(initialData.time || "09:00");
  const [sendNotification, setSendNotification] = useState(true);

  const [progress, setProgress] = useState(initialData.progress || 0);
  const [dueDate, setDueDate] = useState(initialData.dueDate ?? (editing ? "" : addDays(date, 14)));
  const [priority, setPriority] = useState<ItemData["priority"]>(initialData.priority || "medium");
  const [planDate, setPlanDate] = useState(initialData.date || date);
  const [duration, setDuration] = useState(initialData.duration || 30);
  const [repeat, setRepeat] = useState<RepeatFrequency>(initialData.repeat || "none");
  const [repeatCount, setRepeatCount] = useState(String(initialData.seriesId ? remainingRepeats(initialData) : initialData.repeatCount || 3));
  const [unit, setUnit] = useState(initialData.unit || "");
  const [pinned, setPinned] = useState(initialData.pinned || false);
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
  const errorRef = useRef<HTMLParagraphElement>(null);
const formId = "editor-form-id";
  const label = RESOURCE_LABELS[editor.kind];
  const Icon = editor.kind === "target" ? Target : editor.kind === "plan" ? CalendarDays : editor.kind === "chore" ? ListChecks : editor.kind === "file" ? FolderOpen : editor.kind === "note" ? StickyNote : editor.kind === "habit" ? Zap : Sprout;

  function readFile(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("Choose a file up to 2 MB."); return; }
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current || reading) return;
    setError("");
    if (!title.trim()) { setError(`Give your ${label} a name first.`); return; }
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
                          data.dueDate = repeat !== "none" ? dueDate || date : dueDate;
                          data.priority = priority;
                          data.date = planDate || date; // 👈 Her koşulda gerçek bir tarih taşıyacak, ezilmeyecek
                        }


                                    if (addToCalendar) {
                                      data.time = time;
                                      data.date = selectedDays.length > 0 ? nextOccurrenceISO(selectedDays, time) : (planDate || date);
                                      data.repeat = "weekly";
                                      // Arka yüzün (Zod) tanımadığı ve hata fırlattığı "days" ve "repeatDays" satırları tamamen kaldırıldı.
                                    } else {
                                      data.date = planDate || date;
                                    }




        if (editor.kind === "plan") { data.date = planDate; data.time = time; data.duration = duration; data.completed = initialData.completed || false; }
        if (editor.kind === "chore") { data.date = planDate; data.completed = initialData.completed || false; }
        if (supportsRepeat(editor.kind) && !addToCalendar) { data.repeat = repeat; data.repeatCount = repeat === "none" ? 0 : Number(repeatCount); }
        if (editor.kind === "habit") { data.unit = unit; data.history = initialData.history || []; }
        if (editor.kind === "note") data.pinned = pinned;
        if (editor.kind === "file") {
          Object.assign(data, fileData, { description, amount: Math.round((Number(amount) || 0) * 100) });
          if (!fileData.url) delete data.url;
        }
        input = { title: title.trim(), areaId: savedAreas.some((area) => area.id === areaId) ? areaId : null, data };
      }

      if (editor.kind === "target" && addAsTask) {
          const autoTaskInput = {
              title: `🎯 Target Task: ${title.trim()}`,
              areaId: savedAreas.some((area) => area.id === areaId) ? areaId : null,
              data: { completed: false, date: data.date || planDate || date, time: time, description: description }
                      };


        await onSave({ kind: "chore", item: null } as any, autoTaskInput);
      }

                                             if (editor.kind === "target" && addToCalendar && selectedDays.length > 0) {
                                               for (const day of selectedDays) {
                                                 const routineTaskInput = {
title: `🔄 Routine: ${title.trim()}`,                                                   areaId: savedAreas.some((a) => a.id === areaId) ? areaId : null,
                                                   data: {
                                                     completed: false,
                                                     description: description,
                                                     time: time,
date: day === (date ? new Date(date + "T00:00:00").getDay() : new Date().getDay()) ? date : nextOccurrenceISO(day, time),                                                     repeat: "weekly",

                                                     repeatCount: 52
                                                   }
                                                 };
                           await onSave({ kind: "chore", item: null } as any, routineTaskInput);
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


  // Bileşen (Component) seviyesindeki sabitler fonksiyon dışına, return öncesine alınmalı:
  const emojis = ["🧠", "❤️", "💪", "👨‍👩‍👧", "💰", "🏍️", "🌱", "✨", "🎨", "💼", "✈️", "☀️"];
  const previewTheme = areaTheme({ color });


  
return (
    <Modal
      title={`${editing ? "Edit" : "Add"} ${label === "life area" ? "a life area" : `${editing ? "your" : "a"} ${label}`}`}
      eyebrow={`ezlife26 · ${editing ? "A LITTLE REFRESH" : "MAKE ROOM FOR WHAT MATTERS"}`}
      onClose={onClose}
      disableClose={busy}
      className={`editor-modal kind-${editor.kind} ${editor.kind === "note" ? "note-editor-modal" : ""}`}
      wide={editor.kind === "note"}
    >
      {/* 🔓 DİKEY KAYDIRMA KİLİDİNİ AÇAN ESNEK SARMALAYICI KATMAN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '6px' }}>

        <div className="editor-context">
          <span><Icon size={20}/></span>
          <div>
            <strong>{editing ? "Make it work for your life" : `Make room for a ${label}`}</strong>
            <small>{isArea ? "Your own corner of a balanced life." : supportsRepeat(editor.kind) ? "One intention — once, or on a rhythm that fits." : "Your details stay together in your planner."}</small>
          </div>
          {!isArea && <AreaTag area={savedAreas.find((area) => area.id === areaId)} small/>}
        </div>

        {isArea && (
          <div className="editor-area-preview" style={{ background: previewTheme.gradient, color: previewTheme.ink }}>
            <span>{emoji}</span>
            <div>
              <strong>{title || "Your life area"}</strong>
              <small>{description || "Give this part of life a little intention."}</small>
            </div>
          </div>
        )}

        {/* 🔒 FORM ETİKETİ TÜM SEÇİCİLERİ VE BUTONLARI İÇİNE ALACAK ŞEKİLDE GENİŞLETİLDİ */}
        <form id={formId} onSubmit={submit} className="editor-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <fieldset disabled={busy} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <label className="form-field">
              <span>{isArea ? "Life area name" : editor.kind === "note" ? "Give your thought a title" : editor.kind === "file" ? "File name" : editor.kind === "habit" ? "Your daily habit" : editor.kind === "chore" ? "Task" : editor.kind === "plan" ? "What are you making time for?" : "Your meaningful target"}</span>
              <input required maxLength={isArea ? 80 : 200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isArea ? "e.g. Creativity, Career, Adventure" : editor.kind === "habit" ? "e.g. Read a few pages" : editor.kind === "note" ? "A thought worth keeping…" : editor.kind === "file" ? "A name to find it by" : editor.kind === "chore" ? "e.g. Pick up groceries" : editor.kind === "plan" ? "A moment that matters…" : "Something worth working towards…"}/>
            </label>

            {editor.kind === "file" && (
              <>
                               <input type="file" className="visually-hidden" ref={fileInput} onChange={(event) => readFile(event.target.files?.[0])}/>
<div className={`file-dropzone ${dragging ? "dragging" : ""} ${fileData.content || fileData.url ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files?.[0]); }}>

                  {fileData.content || fileData.url ? <><span className="uploaded-file-icon">{fileData.mimeType?.startsWith("image/") ? <ImagePlus size={26}/> : <FileText size={26}/>}</span><span><strong>{fileName}</strong><small>{humanSize(fileData.fileSize)} · Ready to keep</small></span><button type="button" className="text-button" onClick={() => fileInput.current?.click()}>Replace</button></> : <button type="button" onClick={() => fileInput.current?.click()}>{reading ? <Spinner size={28}/> : <UploadCloud size={30}/>}<strong>{reading ? "Getting your file ready…" : "Drop a little something here"}</strong><span>or <u>browse files</u> · Up to 2 MB</span></button>}
                </div>
              </>
            )}

            <div className="form-row">
              <label className="form-field">
                <span>A gentle deadline</span>
                <input type="date" aria-label="A gentle deadline" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/>
                <small>{repeat === "none" ? "Optional. A target can be saved without a deadline." : "The first occurrence starts on this date."}</small>
              </label>

                            {!isArea && (
                              <label className="form-field">
                                <span>{tr("addFile")} <small>Optional</small></span>
                                <input type="file" onChange={handleFileChange} style={{ width: "100%", padding: "10px", border: "1px dashed rgba(22, 19, 44, 0.2)", borderRadius: "12px", backgroundColor: "rgba(22, 19, 44, 0.02)", cursor: "pointer", color: "#16132c" }}/>
                                {selectedFile && <small style={{ color: "#10b981", display: "block", marginTop: "6px", fontWeight: "600" }}>📎 Selected File: {selectedFile.name}</small>}
                              </label>
                            )}


              <label className="form-field">
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value as ItemData["priority"])}>
                  <option value="low">Low · When there's room</option>
                  <option value="medium">Medium · Worth making time</option>
                  <option value="high">High · A little more focus</option>
                </select>
              </label>
            </div>

            <div className="form-field progress-form-field">
              <span>How far have you come?<strong>{progress}%</strong></span>
              <input type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))}/>
              <div className="range-labels"><span>Just getting started</span><span>You did it!</span></div>
            </div>

            <div style={{ marginTop: '10px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(22, 19, 44, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
<strong style={{ display: 'block', fontSize: '14px', color: '#16132c' }}>{tr("addAsTask")}</strong>
<small style={{ color: '#888', display: 'block', marginTop: '2px', fontSize: '12px' }}>Link a recurring action plan to reach this target.</small>                </div>
                <input type="checkbox" checked={addAsTask} onChange={(e) => setAddAsTask(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16132c' }}/>
              </div>
            </div>

            {editor.kind === "plan" && (
              <div className="form-row">
                <label className="form-field"><span>Day</span><input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/></label>
                <label className="form-field"><span>Time</span><input type="time" required value={time} onChange={(event) => setTime(event.target.value)}/></label>
              </div>
            )}

            {editor.kind === "chore" && <label className="form-field"><span>Day on the calendar</span><input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/></label>}

            {editor.kind === "target" && (
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px', backgroundColor: 'rgba(22, 19, 44, 0.02)', borderRadius: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#888', letterSpacing: '1px' }}>{language === "tr" ? "PLAN SAATİ" : "PLAN TIME"}</span>
                      <input type="time" required value={time} onChange={(event) => setTime(event.target.value)} style={{ fontSize: '32px', fontWeight: '700', color: '#16132c', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none', cursor: 'pointer' }}/>
                    </div>

                    {/* 🗓️ HAFTALIK GÜN SEÇİCİ BUTON GRUBU */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#888', letterSpacing: '1px', textAlign: 'center' }}>
                        {language === "tr" ? "TEKRARLANACAK GÜNLER" : "REPEAT DAYS"}
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
                                                {[
                                                  { label: language === "tr" ? "Pz" : "S", value: 0 }, // Pazar ilk sıraya alındı
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
                                e.preventDefault(); // 👈 Üst katmanlara submit gitmesini engeller
                                e.stopPropagation(); // 👈 Event köpürmesini durdurur
                                if (isSelected) {
                                  setSelectedDays(selectedDays.filter((d) => d !== day.value));
                                } else {
                                  setSelectedDays([...selectedDays, day.value]);
                                }
                              }}
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backgroundColor: isSelected ? '#16132c' : 'rgba(22, 19, 44, 0.05)',
                                color: isSelected ? '#ffffff' : '#16132c',
                                boxShadow: isSelected ? '0 4px 10px rgba(22,19,44,0.2)' : 'none'
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

             {supportsRepeat(editor.kind) && !addToCalendar && (
                          <RepeatControls frequency={repeat} count={repeatCount} onFrequencyChange={setRepeat} onCountChange={setRepeatCount} language={language}/>
                                    )}
                    {error && <p className="error-message" style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px', fontWeight: '500' }}>{error}</p>}

                    <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid rgba(22, 19, 44, 0.1)', paddingTop: '16px' }}>
                      {editing ? (
                        <button type="button" className="delete-button" onClick={() => { if(confirm("Are you sure?")) onDelete(editor); }} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={16}/> Remove
                        </button>
                      ) : <div />}

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
                        <button type="submit" className="primary-button" disabled={busy || reading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {busy ? <Spinner size={16}/> : <Check size={16}/>} Save {label}
                        </button>
                      </div>
                              </div>
                            </div>
                          )}
                         </fieldset>
                    </form>
                  </div>
                </Modal>
            );
          }

