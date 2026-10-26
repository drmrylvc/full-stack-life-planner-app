"use client";

import { CalendarDays, Repeat2 } from "lucide-react";
import { localeFor, type Lang } from "@/lib/i18n";
import { MAX_REPEATS, occurrenceDate } from "@/lib/recurrence";
import type { RepeatFrequency } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const text = {
  en: { repeat: "Repeat", none: "Does not repeat", daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly", count: "Number of repeats", countHint: "Additional repeats after this occurrence (0–365).", dates: "Scheduled dates", once: "This will save one occurrence.", edit: "Details and progress apply to this occurrence. Changing the repeat schedule reschedules this and following occurrences; earlier entries stay.", total: "occurrences", last: "Last date", next: "Next" },
  tr: { repeat: "Tekrar", none: "Tekrarlanmaz", daily: "Günlük", weekly: "Haftalık", monthly: "Aylık", yearly: "Yıllık", count: "Tekrar sayısı", countHint: "Bu kayıttan sonraki ek tekrarlar (0–365).", dates: "Planlanan tarihler", once: "Tek bir kayıt kaydedilir.", edit: "Ayrıntılar ve ilerleme bu kayıt içindir. Tekrar planını değiştirmek bu ve sonraki kayıtları yeniden planlar; önceki kayıtlar korunur.", total: "kayıt", last: "Son tarih", next: "Sonraki" },
  fr: { repeat: "Répéter", none: "Ne se répète pas", daily: "Chaque jour", weekly: "Chaque semaine", monthly: "Chaque mois", yearly: "Chaque année", count: "Nombre de répétitions", countHint: "Répétitions supplémentaires après cette occurrence (0–365).", dates: "Dates prévues", once: "Une seule occurrence sera enregistrée.", edit: "Les détails concernent cette occurrence. Un changement du calendrier reprogramme celle-ci et les suivantes ; les précédentes restent.", total: "occurrences", last: "Dernière date", next: "Suivante" },
  de: { repeat: "Wiederholen", none: "Keine Wiederholung", daily: "Täglich", weekly: "Wöchentlich", monthly: "Monatlich", yearly: "Jährlich", count: "Anzahl der Wiederholungen", countHint: "Weitere Wiederholungen nach diesem Termin (0–365).", dates: "Geplante Termine", once: "Ein einzelner Termin wird gespeichert.", edit: "Details gelten für diesen Termin. Eine Änderung des Plans verschiebt diesen und folgende Termine; frühere bleiben erhalten.", total: "Termine", last: "Letztes Datum", next: "Nächster" },
  zh: { repeat: "重复", none: "不重复", daily: "每天", weekly: "每周", monthly: "每月", yearly: "每年", count: "重复次数", countHint: "本次之后的额外重复次数（0–365）。", dates: "计划日期", once: "将保存一个记录。", edit: "详情和进度仅适用于本次。更改重复计划会重新安排本次及之后的记录；之前的记录保留。", total: "个记录", last: "最后日期", next: "下一次" },
  es: { repeat: "Repetir", none: "No se repite", daily: "Diariamente", weekly: "Semanalmente", monthly: "Mensualmente", yearly: "Anualmente", count: "Número de repeticiones", countHint: "Repeticiones adicionales después de esta (0–365).", dates: "Fechas previstas", once: "Se guardará una sola fecha.", edit: "Los detalles se aplican a esta fecha. Cambiar el calendario reprograma esta y las siguientes; las anteriores se conservan.", total: "fechas", last: "Última fecha", next: "Siguiente" },
};

export function RepeatControls({ repeat, count, start, language = "en", editingSeries, onRepeat, onCount }: {
  repeat: RepeatFrequency;
  count: string;
  start: string;
  language?: Lang;
  editingSeries?: boolean;
  onRepeat: (repeat: RepeatFrequency) => void;
  onCount: (count: string) => void;
}) {
  const copy = text[language];
  const number = Math.min(MAX_REPEATS, Math.max(0, Number(count) || 0));
  const active = repeat !== "none";
  let dates: string[] = [];
  let last = "";
  try {
    dates = Array.from({ length: active ? Math.min(3, number + 1) : 1 }, (_, index) => occurrenceDate(start, repeat, index));
    last = occurrenceDate(start, repeat, active ? number : 0);
  } catch { /* The date input's own validation will give a clear message on submit. */ }

  return <section className="repeat-settings" aria-label={copy.repeat}>
    <div className="repeat-settings-heading"><span><Repeat2 size={18}/></span><div><strong>{copy.repeat}</strong><small>{active ? `${number + 1} ${copy.total}` : copy.once}</small></div></div>
    <div className="form-row">
      <label className="form-field"><span>{copy.repeat}</span><select aria-label={copy.repeat} value={repeat} onChange={(event) => onRepeat(event.target.value as RepeatFrequency)}>
        {(["none", "daily", "weekly", "monthly", "yearly"] as RepeatFrequency[]).map((option) => <option value={option} key={option}>{copy[option]}</option>)}
      </select></label>
      <label className="form-field"><span>{copy.count}</span><input type="number" inputMode="numeric" min={0} max={MAX_REPEATS} step={1} required={active} disabled={!active} aria-label={copy.count} value={active ? count : "0"} onChange={(event) => onCount(event.target.value)}/></label>
    </div>
    <p className="repeat-count-hint">{copy.countHint}</p>
    {active && dates.length > 0 && <div className="repeat-date-preview"><span className="repeat-preview-label"><CalendarDays size={13}/>{copy.dates}</span><div>{dates.map((day) => <time key={day} dateTime={day}>{formatDate(day, { day: "numeric", month: "short", year: "numeric" }, localeFor(language))}</time>)}{number > 2 && <span>…</span>}</div><p>{copy.last}: <time dateTime={last}>{formatDate(last, { day: "numeric", month: "short", year: "numeric" }, localeFor(language))}</time></p></div>}
    {editingSeries && <p className="repeat-edit-hint">{copy.edit}</p>}
  </section>;
}
