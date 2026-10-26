"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowRight, CalendarDays, Check, FileText, FolderOpen, ImagePlus, ListChecks, Pencil, Plus, Sprout, StickyNote, Target, Trash2, UploadCloud, Zap } from "lucide-react";
import { AREA_COLORS, RESOURCE_LABELS, type AreaColor, type AreaInput, type EditorState, type ItemData, type ItemInput, type ItemKind, type LifeArea, type PlannerItem, type RepeatFrequency, type Workspace } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { clearSeries, MAX_REPEATS, remainingRepeats, supportsRepeat } from "@/lib/recurrence";
import { areaTheme } from "@/lib/theme";
import { addDays, humanSize } from "@/lib/utils";
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

export function EditorDialog({ editor, workspace, date, language = "en", onClose, onSave, onDelete }: EditorProps) {
  const isArea = editor.kind === "area";
  const editing = !!(editor.item || editor.area);
  const initialData = editor.item?.data || {};
  const savedAreas = workspace.areas.filter((area) => !area.id.startsWith("temp-"));

  const savedGoals = (workspace as any).goals?.filter((goal: any) => !goal.id.startsWith("temp-")) || [];

    const initialAreaId = editor.item ? editor.item.areaId : editor.areaId;
    const initialGoalId = editor.item ? (editor.item as any).goalId : "";

    const [title, setTitle] = useState(editor.area?.name || editor.item?.title || "");
    const [description, setDescription] = useState(editor.area?.description || initialData.description || "");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

        const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
          if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
          }
        }; // <-- BURADAKİ KAPATMA PARANTEZİ VE NOKTALI VİRGÜL EKSİKTİ!

    const [areaId, setAreaId] = useState(savedAreas.some((area) => area.id === initialAreaId) ? initialAreaId! : "");
    const [goalId, setGoalId] = useState(savedGoals.some((goal: any) => goal.id === initialGoalId) ? initialGoalId! : "");

    // REVIZE: İki bağımsız panel için iki ayrı durum ve gün seçici hafızası
    const [addAsTask, setAddAsTask] = useState(false);
    const [selectedTaskDays, setSelectedTaskDays] = useState<number[]>([1, 2, 3, 4, 5]); // Üst panel için (M T W T F)
    const [taskTime, setTaskTime] = useState("09:00"); // Üst panel için özel saat

    const [addToDailyPlan, setAddToDailyPlan] = useState(false);

    // 🚀 LOKAL ÇÖZÜM: Varsayılan gün listesi boş dizi yapıldı
    const [selectedDays, setSelectedDays] = useState<number[]>([]);
    const [time, setTime] = useState(initialData.time || "09:00"); // Alttaki panel için saat
    const [sendNotification, setSendNotification] = useState(true);

    const [taskRepeat, setTaskRepeat] = useState("daily");
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
    const formId = "delete-form-id";
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
                    data.progress = progress; data.completed = progress === 100;
                    data.dueDate = repeat !== "none" ? dueDate || date : dueDate;
                    data.priority = priority;
                  }
                  if (editor.kind === "plan") { data.date = planDate; data.time = time; data.duration = duration; data.completed = initialData.completed || false; }
                  if (editor.kind === "chore") { data.date = planDate; data.completed = initialData.completed || false; }
                  if (supportsRepeat(editor.kind)) { data.repeat = repeat; data.repeatCount = repeat === "none" ? 0 : Number(repeatCount); }
                  if (editor.kind === "habit") { data.unit = unit; data.history = initialData.history || []; }
                  if (editor.kind === "note") data.pinned = pinned;
                  if (editor.kind === "file") {
                    Object.assign(data, fileData, { description, amount: Math.round((Number(amount) || 0) * 100) });
                    if (!fileData.url) delete data.url;
                  }
                  input = { title: title.trim(), areaId: savedAreas.some((area) => area.id === areaId) ? areaId : null, data };
                }

                // 📌 KÖPRÜ 1 SÜRECİ: "Görev Olarak Ekle" seçildiyse döngüye girmeden SADECE 1 adet bağlı görev oluşturur
                if (editor.kind === "target" && addAsTask) {
                  const autoTaskInput = {
                    title: `${language === "tr" ? "🎯 Hedef Görevi: " : "🎯 Target Task: "}${title.trim()}`,
                    areaId: savedAreas.some((area) => area.id === areaId) ? areaId : null,
                    data: {
                      completed: false,
                      date: planDate,
                      time: taskTime,
                      description: description
                    }
                  };
                  await onSave({ kind: "chore", item: null } as any, autoTaskInput);
                }

                // 📌 KÖPRÜ 2 SÜRECİ: Alt panel (addToDailyPlan) seçildiyse takvim planlarını sırayla veritabanına mühürler
                if (editor.kind === "target" && addToDailyPlan && selectedDays && selectedDays.length > 0) {
                  for (const dayId of selectedDays) {
                    const autoPlanInput = {
                      title: `⏰ [ezlife26] ${title.trim()}`,
                      areaId: savedAreas.some((area) => area.id === areaId) ? areaId : null,
                      data: {
                        completed: false,
                        date: planDate,
                        time: time,
                        duration: 30,
                        description: `${description}\n\n[alarm-config: notify=${sendNotification}, days=${selectedDays.join(",")}]`
                      }
                    };
                    await onSave({ kind: "plan", item: null } as any, autoPlanInput);
                  }
                }

                // Ana hedefi kaydet ve kapat
                await onSave(editor, input);
                onClose();

              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't save this. Please try again.");
                setTimeout(() => errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 0);
              } finally {
                busyRef.current = false;
                setBusy(false);
              }
            }



    const emojis = ["🧠", "❤️", "💪", "👨‍👩‍👧", "💰", "🏍️", "🌱", "✨", "🎨", "💼", "✈️", "☀️"];
    const previewTheme = areaTheme({ color });
    return ( <Modal title={`${editing ? "Edit" : "Add"} ${label === "life area" ? "a life area" : `${editing ? "your" : "a"} ${label}`}`} eyebrow={`ezlife26 · ${editing ? "A LITTLE REFRESH" : "MAKE ROOM FOR WHAT MATTERS"}`} onClose={onClose} disableClose={busy} className={`editor-modal kind-${editor.kind} ${editor.kind === "note" ? "note-editor-modal" : ""}`} wide={editor.kind === "note"}>
      <div className="editor-context"><span><Icon size={20}/></span><div><strong>{editing ? "Make it work for your life" : `Make room for a ${label}`}</strong><small>{isArea ? "Your own corner of a balanced life." : supportsRepeat(editor.kind) ? "One intention — once, or on a rhythm that fits." : "Your details stay together in your planner."}</small></div>{!isArea && <AreaTag area={savedAreas.find((area) => area.id === areaId)} small/>}</div>
      {isArea && <div className="editor-area-preview" style={{ background: previewTheme.gradient, color: previewTheme.ink }}><span>{emoji}</span><div><strong>{title || "Your life area"}</strong><small>{description || "Give this part of life a little intention."}</small></div></div>}
      <form id={formId} onSubmit={submit} className="editor-form">
        <fieldset disabled={busy}>
        <label className="form-field">
                    <span>{isArea ? "Life area name" : editor.kind === "note" ? "Give your thought a title" : editor.kind === "file" ? "File name" : editor.kind === "habit" ? "Your daily habit" : editor.kind === "chore" ? "Task" : editor.kind === "plan" ? "What are you making time for?" : "Your meaningful target"}</span>
                    <input required maxLength={isArea ? 80 : 200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isArea ? "e.g. Creativity, Career, Adventure" : editor.kind === "habit" ? "e.g. Read a few pages" : editor.kind === "note" ? "A thought worth keeping…" : editor.kind === "file" ? "A name to find it by" : editor.kind === "chore" ? "e.g. Pick up groceries" : editor.kind === "plan" ? "A moment that matters…" : "Something worth working towards…"}/>
                  </label>
                    {editor.kind === "file" && (
                      <>
                        <input type="file" className="visually-hidden" ref={fileInput} onChange={(event) => readFile(event.target.files?.[0])}/>
                        <div className={`file-dropzone ${dragging ? "dragging" : ""} ${fileData.content || fileData.url ? "has-file" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files[0]); }}>
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

              {/* 🚀 DOSYA EKLEME ALANI HİZALAMASI TAMAMEN DÜZELTİLDİ */}
              {!isArea && (
                <label className="form-field">
                  <span>Dosya Ekle <small>Optional</small></span>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px dashed rgba(22, 19, 44, 0.2)",
                      borderRadius: "12px",
                      backgroundColor: "rgba(22, 19, 44, 0.02)",
                      cursor: "pointer",
                      color: "#16132c"
                    }}
                  />
                  {selectedFile && (
                    <small style={{ color: "#10b981", display: "block", marginTop: "6px", fontWeight: "600" }}>
                      📎 Seçilen Dosya: {selectedFile.name}
                    </small>
                  )}
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
      <div className="range-labels">
        <span>Just getting started</span>
        <span>You did it!</span>
      </div>
    </div>

    {/* ENTEGRE PANEL: İlerleme çubuğunun hemen altında beliren akıllı görev köprüsü */}
    <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(22, 19, 44, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <strong style={{ display: 'block', fontSize: '14px', color: '#16132c' }}>
            {language === "tr" ? "Görev Olarak Ekle" : "Add as a Task"}
          </strong>
          <small style={{ color: '#888', display: 'block', marginTop: '2px', fontSize: '12px' }}>
            {language === "tr" ? "Bu hedefe ulaştıracak tekrarlayan bir eylem planı bağla." : "Link a recurring action plan to reach this target."}
          </small>
        </div>
        <input
          type="checkbox"
          checked={addAsTask}
          onChange={(e) => setAddAsTask(e.target.checked)}
          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16132c' }}
        />
      </div>

              {addAsTask && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '12px' }}>
                </div>
              )}
                  </div>



{editor.kind === "plan" && <><div className="form-row"><label className="form-field"><span>Day</span><input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/></label><label className="form-field"><span>Time</span><input type="time" required value={time} onChange={(event) => setTime(event.target.value)}/></label></div><label className="form-field"><span>A little breathing room</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[15, 20, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label></>}
        {editor.kind === "chore" && <label className="form-field"><span>Day on the calendar</span><input type="date" required value={planDate} onChange={(event) => setPlanDate(event.target.value)}/></label>}
        {editor.kind === "target" && (
          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(22, 19, 44, 0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ display: 'block', fontSize: '14px', color: '#16132c' }}>
                  {language === "tr" ? "Günlük Plana Ekle" : "Add to Daily Plan"}
                </strong>
                <small style={{ color: '#888', display: 'block', marginTop: '2px', fontSize: '12px' }}>
                  {language === "tr" ? "Bu hedefi gerçekleştirmek için akıllı bir rutin planla." : "Schedule an intelligent routine to complete this target."}
                </small>
              </div>
              <input
                type="checkbox"
                checked={addToDailyPlan}
                onChange={(e) => setAddToDailyPlan(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16132c' }}
              />
            </div>

            {addToDailyPlan && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '14px' }}>

                {/* ⏱️ MOBİL DİJİTAL SAAT SEÇİCİ */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '10px', backgroundColor: 'rgba(22, 19, 44, 0.02)', borderRadius: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#888', letterSpacing: '1px' }}>
                    {language === "tr" ? "RUTİN SAATİ" : "ROUTINE TIME"}
                  </span>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    style={{ fontSize: '32px', fontWeight: '700', color: '#16132c', background: 'transparent', border: 'none', textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                  />
                </div>

                {/* 📅 HAFTALIK GÜN BUTONLARI (S M T W T F S MANTIĞI) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#888' }}>
                    {language === "tr" ? "TEKRARLANACAK GÜNLER" : "REPEAT DAYS"}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', marginTop: '4px' }}>
                    {[
                      { id: 1, label: language === "tr" ? "Pz" : "M" },
                      { id: 2, label: language === "tr" ? "Sa" : "T" },
                      { id: 3, label: language === "tr" ? "Ça" : "W" },
                      { id: 4, label: language === "tr" ? "Pe" : "T" },
                      { id: 5, label: language === "tr" ? "Cu" : "F" },
                      { id: 6, label: language === "tr" ? "Ct" : "S" },
                      { id: 0, label: language === "tr" ? "Pa" : "S" }
                    ].map((day) => {
                      const isSelected = selectedDays.includes(day.id);
                      return (
                        <button
                          type="button"
                          key={day.id}
                          onClick={() => {
                            setSelectedDays(prev =>
                              prev.includes(day.id) ? prev.filter(d => d !== day.id) : [...prev, day.id]
                            );
                          }}
                          style={{
                            flex: 1,
                            height: '38px',
                            borderRadius: '50%',
                            fontSize: '13px',
                            fontWeight: '600',
                            border: 'none',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#16132c' : 'rgba(22, 19, 44, 0.05)',
                            color: isSelected ? '#fff' : '#666',
                            boxShadow: isSelected ? '0 4px 10px rgba(22, 19, 44, 0.2)' : 'none'
                          }}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 🔔 BİLDİRİM / ANIMSATICI AYARI */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.03)' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                      {language === "tr" ? "Akıllı Hatırlatıcı" : "Smart Notification"}
                    </span>
                    <small style={{ color: '#888', fontSize: '11px' }}>
                      {language === "tr" ? "Zamanı geldiğinde telefona bildirim fırlat." : "Push alert to device when the time comes."}
                    </small>
                  </div>
                  <input
                    type="checkbox"
                    checked={sendNotification}
                    onChange={(e) => setSendNotification(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </div>

              </div>
            )}
          </div>
        )}


        {editor.kind === "habit" && <label className="form-field"><span>Your daily goal</span><input value={unit} maxLength={100} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. 20 minutes, 8 glasses, one quiet moment"/><small>Daily habits keep their own check-in history.</small></label>}
        <label className="form-field"><span>{isArea ? "A little reminder" : editor.kind === "note" ? "What's on your mind?" : "A little more detail"}{editor.kind !== "note" && <small>Optional</small>}</span><textarea rows={editor.kind === "note" ? 10 : 3} maxLength={isArea ? 300 : 12000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={isArea ? "e.g. Make space for the things you love" : editor.kind === "note" ? "Ideas, reflections, a few good things…\n\nThis space is yours." : "A reminder, a why, or a little encouragement…"}/></label>
        {editor.kind === "note" && <label className="checkbox-field"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)}/><span>Pin this thought to the top</span></label>}
        {editor.kind === "file" && <label className="form-field"><span>Invoice amount <small>Optional · EUR</small></span><div className="input-with-prefix"><span>€</span><input type="number" min="0" max="1000000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00"/></div><small>Add an amount to include this file in your tracked invoices.</small></label>}
                  {isArea && <><div className="form-field"><span>A little personality</span><div className="emoji-picker">{emojis.map((value) => <button type="button" key={value} className={emoji === value ? "selected" : ""} onClick={() => setEmoji(value)} aria-label={`Choose ${value}`} aria-pressed={emoji === value}>{value}</button>)}<input aria-label="Custom emoji" maxLength={24} value={emoji} onChange={(event) => setEmoji(event.target.value)}/></div></div><div className="form-field"><span>Your colour</span><div className="color-picker">{Object.entries(AREA_COLORS).map(([key, value]) => <button type="button" key={key} onClick={() => setColor(key as AreaColor)} aria-label={value.label} aria-pressed={color === key} className={color === key ? "selected" : ""} style={{ background: areaTheme({ color: key as AreaColor }).gradient, color: areaTheme({ color: key as AreaColor }).ink }}>{color === key && <Check size={19}/>}<span>{value.label}</span></button>)}</div></div></>}
                </fieldset>
              </form>



            {error && <p ref={errorRef} className="form-error" role="alert">{error}</p>}

            <div className="modal-footer">
              {editing && (
                <button
                  type="button"
                  className="text-button danger delete-editor-button"
                  disabled={busy}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (window.confirm("Are you sure you want to delete this item?")) {
                      try {
                        setBusy(true);

                        // 1. 🧹 DOM MASKING: Instantly push the item element off your screen viewport layout
                        const targetId = editor.item?.id || editor.area?.id;
                        if (targetId) {
                          const card = document.getElementById(targetId) || document.querySelector(`[data-id="${targetId}"]`);
                          if (card) (card as HTMLElement).style.display = 'none';
                        }

                        // 2. 🎛️ IN-MEMORY STATE PURGE: Force-filter the item out of the frontend workspace memory arrays instantly
                        if (editor.item && workspace?.items) {
                          workspace.items = workspace.items.filter((i: any) => i.id !== editor.item?.id);
                        }

                        // 3. 📡 REAL BACKEND MUTATION: Fire and await absolute database record removal completion
                        if (typeof onDelete === "function") {
                          await onDelete({
                            kind: editor.kind,
                            item: editor.item || null,
                            area: editor.area || null,
                            areaId: editor.areaId || editor.item?.areaId || null
                          });
                        }

                        // 4. 🚪 CLOSE MODAL GATES & SECURE STATE RESET
                        onClose();

                        // 5. 🔄 FORCED INTERFACE REFRESH: Small timeout wrapper guarantees network round-trip settles completely before rendering
                        setTimeout(() => {
                          window.location.reload();
                        }, 150);

                      } catch (err) {
                        console.error("Direct delete mutator handler failed:", err);
                      } finally {
                        setBusy(false);
                      }
                    }
                  }}


                >
                  <Trash2 size={15}/>Delete
                </button>
              )}

              <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button>
              {/* Force type="submit" and attribute linkage cleanly away from delete contexts */}
              <button type="submit" form={formId} className="button primary" disabled={busy || reading}>
                {busy ? <Spinner /> : editing ? <Check size={16} /> : <Plus size={16} />}
                {busy ? "Saving…" : editing ? "Save changes" : `Add ${label}`}
              </button>
            </div>


          </Modal>
        );
      }




function textContent(file: PlannerItem): string {
  return file.data.content || "";
}


     export function FilePreviewDialog({ file, area, onClose, onEdit, onDelete }: { file: PlannerItem; area?: LifeArea; onClose: () => void; onEdit: (file: PlannerItem) => void; onDelete: (editor: EditorState) => void }) {
       const [loaded, setLoaded] = useState(false);
       const image = file.data.mimeType?.startsWith("image/");
       const pdf = file.data.mimeType === "application/pdf";
       const text = file.data.mimeType?.startsWith("text/");
       return <Modal title={file.title} eyebrow="ezlife26 · KEPT SAFE" onClose={onClose} wide className="file-preview-modal">
         <div className="file-preview-content {image ? 'image' : ''}">
           {image ? <img src={file.data.url || file.data.content} alt={file.data.description || file.title}/> : pdf ? <><iframe title={file.title} src={`/api/files/${file.id}?inline=1`} onLoad={() => setLoaded(true)}/>{!loaded && <span className="preview-loader"><Spinner size={28}/></span>}</> : text ? <pre>{textContent(file)}</pre> : <div className="generic-file-preview"><FileGlyph item={file} large/><p>Your file is ready to download.</p></div>}
         </div>
         <div className="file-preview-details">
           <div><small>LIFE AREA</small><AreaTag area={area}/></div>
           <div><small>FILE SIZE</small><strong>{humanSize(file.data.fileSize)}</strong></div>
           <div><small>ADDED</small><strong>{new Date(file.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</strong></div>
           {!!file.data.amount && <div><small>INVOICE AMOUNT</small><strong>{new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(file.data.amount / 100)}</strong></div>}
         </div>
         {file.data.description && <p className="file-preview-description">{file.data.description}</p>}
         <div className="modal-footer">
           <button type="button" className="text-button danger delete-editor-button" onClick={() => { onClose(); onDelete({ kind: "file", item: file }); }}><Trash2 size={15}/>Delete</button>
           <button type="button" className="button secondary" onClick={() => { onClose(); onEdit(file); }}><Pencil size={15}/>Edit details</button>
           <a className="button primary" href={`/api/files/${file.id}`} download><ArrowDownToLine size={16}/>Download file</a>
         </div>
       </Modal>;
     }

