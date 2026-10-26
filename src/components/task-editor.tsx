"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, ListChecks, Plus, Trash2 } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import type { AreaInput, EditorState, ItemInput, RepeatFrequency, Workspace } from "@/lib/types";
import { MAX_REPEATS, remainingRepeats } from "@/lib/recurrence";
import { dateISO, parseDate } from "@/lib/utils";
import { RepeatControls } from "./repeat-controls";
import { Modal, Spinner } from "./ui";

const text = {
  en: { newTitle: "Add a task", editTitle: "Edit your task", title: "Task", titleHint: "What would you like to get done?", intro: "Just a name is enough. Everything else is optional.", date: "Day on the calendar", dateHint: "Leave empty to use the selected day.", options: "Options & repeats", area: "Life area", personal: "Personal · No life area", notes: "A little more detail", optional: "Optional", save: "Add task", edit: "Save changes", busy: "Saving…", cancel: "Cancel", delete: "Delete", titleError: "Please give your task a name.", dateError: "Choose a valid date, or leave it empty to use the selected day.", countError: "Number of repeats must be a whole number from 0 to 365.", savedFor: "Scheduled for", placeholder: "e.g. Pick up groceries", notesHint: "Any details you want to remember", retry: "Your task has not been lost. You can try saving again.", addFile: "Attach file" },
  tr: { newTitle: "Görev ekle", editTitle: "Görevi düzenle", title: "Görev", titleHint: "Ne yapmak istersin?", intro: "Yalnızca bir ad yeterli. Diğer alanlar isteğe bağlı.", date: "Takvimdeki gün", dateHint: "Seçili gün için boş bırakın.", options: "Seçenekler ve tekrarlar", area: "Yaşam alanı", personal: "Kişisel · Alan yok", notes: "Biraz daha ayrıntı", optional: "İsteğe bağlı", save: "Görev ekle", edit: "Değişiklikleri kaydet", busy: "Kaydediliyor…", cancel: "İptal", delete: "Sil", titleError: "Lütfen göreve bir ad verin.", dateError: "Geçerli bir tarih seçin veya seçili gün için boş bırakın.", countError: "Tekrar sayısı 0 ile 365 arasında tam sayı olmalıdır.", savedFor: "Planlanan gün", placeholder: "Örn. Alışveriş yap", notesHint: "Hatırlamak istediğiniz ayrıntılar", retry: "Göreviniz kaybolmadı. Tekrar kaydedebilirsiniz.", addFile: "Dosya ekle" },
  fr: { newTitle: "Ajouter une tâche", editTitle: "Modifier la tâche", title: "Tâche", titleHint: "Que souhaitez-vous faire ?", intro: "Un nom suffit. Tout le reste est facultatif.", date: "Jour du calendrier", dateHint: "Laissez vide pour utiliser le jour ausgewählt.", options: "Options et répétitions", area: "Domaine de vie", personal: "Personnel · Aucun domaine", notes: "Un peu plus de détails", optional: "Facultatif", save: "Ajouter la tâche", edit: "Enregistrer", busy: "Enregistrement…", cancel: "Annuler", delete: "Supprimer", titleError: "Donnez un nom à votre tâche.", dateError: "Choisissez une date valide ou laissez vide pour le jour sélectionné.", countError: "Le nombre de répétitions doit être un entier de 0 à 365.", savedFor: "Prévue pour", placeholder: "Ex. Faire les courses", notesHint: "Les détails à retenir", retry: "Votre tâche est conservée. Essayez à nouveau.", addFile: "Joindre un fichier" },
  de: { newTitle: "Aufgabe hinzufügen", editTitle: "Aufgabe bearbeiten", title: "Aufgabe", titleHint: "Was möchtest du erledigen?", intro: "Ein Name genügt. Alles andere ist optional.", date: "Tag im Kalender", dateHint: "Für den ausgewählten Tag leer lassen.", options: "Optionen und Wiederholungen", area: "Lebensbereich", personal: "Persönlich · Kein Bereich", notes: "Weitere Details", optional: "Optional", save: "Aufgabe hinzufügen", edit: "Speichern", busy: "Wird gespeichert…", cancel: "Abbrechen", delete: "Löschen", titleError: "Bitte gib der Aufgabe einen Namen.", dateError: "Wähle ein gültiges Datum oder lasse es für den ausgewählten Tag leer.", countError: "Die Anzahl der Wiederholungen muss eine ganze Zahl von 0 bis 365 sein.", savedFor: "Geplant für", placeholder: "Z. B. Lebensmittel einkaufen", notesHint: "Details, die du behalten möchtest", retry: "Deine Aufgabe ist nicht verloren. Versuche erneut zu speichern.", addFile: "Datei anhängen" },
  zh: { newTitle: "添加任务", editTitle: "编辑任务", title: "任务", titleHint: "你想完成什么？", intro: "只需要一个名称。其他内容均为可选。", date: "日历日期", dateHint: "留空则使用当前选定日期。", options: "选项和重复", area: "生活领域", personal: "个人 · 无领域", notes: "更多详情", optional: "可选", save: "添加任务", edit: "保存更改", busy: "保存中…", cancel: "取消", delete: "删除", titleError: "请为任务填写名称。", dateError: "请选择有效日期，或留空以使用选定日期。", countError: "重复次数必须是 0 到 365 的整数。", savedFor: "计划日期", placeholder: "例如：购买食品", notesHint: "需要记住的详情", retry: "任务内容已保留，可以再次保存。", addFile: "添加附件" },
  es: { newTitle: "Añadir tarea", editTitle: "Editar tarea", title: "Tarea", titleHint: "¿Qué te gustaría hacer?", intro: "Solo hace falta un nombre. Todo lo demás es opcional.", date: "Día del calendario", dateHint: "Déjalo vacío para usar el día seleccionado.", options: "Opciones y repeticiones", area: "Área de vida", personal: "Personal · Sin área", notes: "Un poco más de detail", optional: "Opcional", save: "Añadir tarea", edit: "Guardar cambios", busy: "Guardando…", cancel: "Cancelar", delete: "Eliminar", titleError: "Ponle un nombre a tu tarea.", dateError: "Elige una fecha válida o deja el campo vacío para el día seleccionado.", countError: "Le número de repeticiones debe ser un entero entre 0 y 365.", savedFor: "Programada para", placeholder: "P. ej. Comprar alimentos", notesHint: "Los detalles que quieras recordar", retry: "Tu tarea no se ha perdido. Puedes intentar guardarla de nuevo.", addFile: "Adjuntar archivo" }
};


function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDate(value).getTime()) && dateISO(parseDate(value)) === value;
}

export function TaskEditor({ editor, workspace, date, language = "en", onClose, onSave, onDelete }: {
  editor: EditorState;
  workspace: Workspace;
  date: string;
  language?: Lang;
  onClose: () => void;
  onSave: (editor: EditorState, input: ItemInput | AreaInput) => Promise<unknown>;
  onDelete: (editor: EditorState) => void;
}) {
  const copy = text[language];
  const editing = !!editor.item;
  const initial = editor.item?.data || {};
  const selectedDay = validDay(date) ? date : dateISO();
  const areas = workspace.areas.filter((area) => !area.id.startsWith("temp-"));
  const selectedAreaId = editor.item ? editor.item.areaId : editor.areaId;
  const [title, setTitle] = useState(editor.item?.title || "");
  const [day, setDay] = useState(initial.date && validDay(initial.date) ? initial.date : selectedDay);
  const [areaId, setAreaId] = useState(areas.some((area) => area.id === selectedAreaId) ? selectedAreaId! : "");
    const [notes, setNotes] = useState(initial.description || "");
    const [repeat, setRepeat] = useState<RepeatFrequency>(initial.repeat || "none");
    const [count, setCount] = useState(String(initial.seriesId ? remainingRepeats(initial) : initial.repeatCount ?? 0));
    const [optionsOpen, setOptionsOpen] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
        setSelectedFile(event.target.files[0]);
      }
    };


  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const formId = useId();

    async function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (submitting.current) return;
      setError("");
      const name = title.trim();
      if (!name) { setError(copy.titleError); titleRef.current?.focus(); return; }

      const scheduledDay = day || selectedDay;
      if (!validDay(scheduledDay)) { setError(copy.dateError); return; }
      const repeats = repeat === "none" ? 0 : Number(count);
      if (repeat !== "none" && (!count.trim() || !Number.isInteger(repeats) || repeats < 0 || repeats > MAX_REPEATS)) {
        setOptionsOpen(true);
        setError(copy.countError);
        return;
      }

      submitting.current = true;
      setBusy(true);

      try {
        // Dosya transferi için FormData yapısı oluşturuluyor
        const formData = new FormData();
        formData.append("title", name);
        formData.append("areaId", areas.some((area) => area.id === areaId) ? areaId : "");
        formData.append("date", scheduledDay);
        formData.append("description", notes.trim());
        formData.append("completed", String(!!initial.completed));
        formData.append("repeat", repeat);
        formData.append("repeatCount", String(repeats));

        // Eğer kullanıcı dosya seçtiyse pakete ekle
        if (selectedFile) {
          formData.append("attachment", selectedFile);
        }

        // onSave fonksiyonuna girdi (input) olarak artık formData'yı gönderiyoruz
        await onSave({ ...editor, kind: "chore" }, formData as any);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : copy.retry);
      } finally { submitting.current = false; setBusy(false); }
    }
 return <Modal title={editing ? copy.editTitle : copy.newTitle} eyebrow="ezlife26 · TASKS" onClose={onClose} disableClose={busy} className="task-editor-modal">
    <form id={formId} className="task-editor-form" noValidate onSubmit={(event) => void submit(event)}>
      <div className="task-editor-fields">
        <div className="task-editor-intro"><span><ListChecks size={19}/></span><p>{copy.intro}</p></div>
        {error && <div className="form-error task-save-error" role="alert"><strong>{error}</strong><p>{copy.retry}</p></div>}
        <fieldset disabled={busy}>
          <label className="form-field"><span>{copy.title}</span><input ref={titleRef} name="title" aria-label={copy.title} maxLength={200} enterKeyHint="done" autoComplete="off" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.placeholder} aria-invalid={!title.trim() && !!error}/></label>
          <label className="form-field"><span>{copy.date}<small>{copy.optional}</small></span><input type="date" name="date" aria-label={copy.date} value={day} onChange={(event) => setDay(event.target.value)}/><small>{copy.dateHint}</small></label>
          <button type="button" className="task-options-toggle" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}><span>{copy.options}</span><ChevronDown size={17} className={optionsOpen ? "expanded" : ""}/></button>
          {optionsOpen && <div className="task-options-body">
            <label className="form-field"><span>{copy.area}<small>{copy.optional}</small></span><select aria-label={copy.area} value={areaId} onChange={(event) => setAreaId(event.target.value)}><option value="">{copy.personal}</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.emoji} {area.name}</option>)}</select></label>
            <RepeatControls repeat={repeat} count={count} start={day || selectedDay} language={language} editingSeries={!!initial.seriesId} onRepeat={setRepeat} onCount={setCount}/>
            <label className="form-field"><span>{copy.notes}<small>{copy.optional}</small></span><textarea aria-label={copy.notes} rows={2} maxLength={12000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={copy.notesHint}/></label>
          </div>}
        </fieldset>
      </div>
      <div className="modal-footer task-editor-actions">
        {editing && <button type="button" className="text-button danger delete-editor-button" disabled={busy} onClick={() => { onClose(); onDelete(editor); }}><Trash2 size={15}/>{copy.delete}</button>}
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>{copy.cancel}</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? <Spinner/> : editing ? <Check size={16}/> : <Plus size={16}/>}{busy ? copy.busy : editing ? copy.edit : copy.save}</button>
      </div>
    </form>
  </Modal>;
}
