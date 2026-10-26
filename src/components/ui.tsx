"use client";

import { useLayoutEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, File, FileText, LoaderCircle, Sprout, X, type LucideIcon } from "lucide-react";
import { AREA_COLORS, type LifeArea, type PlannerItem } from "@/lib/types";
import { areaTheme } from "@/lib/theme";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? "compact" : ""}`}>
    <span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M15 15H7a6 6 0 0 1 0-12h2a6 6 0 0 1 6 6v6Z" fill="currentColor"/><path d="M17 15V7a6 6 0 0 1 12 0v2a6 6 0 0 1-6 6h-6Z" fill="currentColor" opacity=".7"/><path d="M17 17h8a6 6 0 0 1 0 12h-2a6 6 0 0 1-6-6v-6Z" fill="currentColor"/><path d="M15 17v8a6 6 0 0 1-12 0v-2a6 6 0 0 1 6-6h6Z" fill="currentColor" opacity=".7"/></svg></span>
    {!compact && <span className="brand-word">ezlife<span>26</span></span>}
  </span>;
}

export function ProgressRing({ progress, size = 116, label = "TODAY", dark = false, tone = "green" }: { progress: number; size?: number; label?: string; dark?: boolean; tone?: "green" | "purple" }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return <div className={`progress-ring ${dark ? "dark" : ""} ${tone}`} style={{ width: size, height: size }}>
    <svg viewBox="0 0 108 108" aria-label={`${progress}% ${label.toLowerCase()}`} role="img">
      <circle cx="54" cy="54" r={radius} className="ring-track" fill="none" strokeWidth="7" />
      <circle cx="54" cy="54" r={radius} className="ring-value" fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} transform="rotate(-90 54 54)" />
    </svg><div className="ring-label"><strong>{progress}<span>%</span></strong><small>{label}</small></div>
  </div>;
}

export function AreaTag({ area, small = false }: { area?: LifeArea; small?: boolean }) {
  const color = area ? AREA_COLORS[area.color] : null;
  return <span className={`area-tag ${small ? "small" : ""}`} style={color ? { background: color.background, color: color.text } : undefined}>
    <span className="tag-dot" style={{ background: color?.accent }} />{area?.name || "Personal"}
  </span>;
}

export function FileGlyph({ item, large = false }: { item: PlannerItem; large?: boolean }) {
  const image = item.data.mimeType?.startsWith("image/");
  const pdf = item.data.mimeType === "application/pdf";
  return <span className={`file-glyph ${image ? "image" : pdf ? "pdf" : "document"} ${large ? "large" : ""}`}>
    {image && (item.data.url || item.data.content) ? <img src={item.data.url || item.data.content} alt="" /> : <>{pdf ? <FileText size={large ? 30 : 21}/> : item.data.mimeType?.startsWith("text/") ? <FileText size={large ? 30 : 21}/> : <File size={large ? 30 : 21}/>}{large && <small>{pdf ? "PDF" : item.title.split(".").pop()?.toUpperCase()}</small>}</>}
  </span>;
}

export function EmptyState({ icon: Icon = Sprout, title, description, action, onAction }: { icon?: LucideIcon; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={30}/></span><h3>{title}</h3><p>{description}</p>{action && <button className="button primary" onClick={onAction}>{action}<ArrowRight size={16}/></button>}</div>;
}

export function CheckButton({ checked, onClick, disabled = false, label }: { checked?: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return <button className={`check-button ${checked ? "checked" : ""}`} aria-label={label} aria-pressed={!!checked} disabled={disabled} onClick={onClick}>{checked && <Check size={13} strokeWidth={3}/>}</button>;
}

export function Spinner({ size = 16 }: { size?: number }) { return <LoaderCircle size={size} className="spinner"/>; }

export function Modal({ title, eyebrow, children, onClose, wide = false, className = "", disableClose = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string; disableClose?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  const disableCloseRef = useRef(disableClose);
  onCloseRef.current = onClose;
  disableCloseRef.current = disableClose;
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Safari and Android can shrink the visual viewport without changing 100vh
    // when the keyboard opens. Size the overlay to the actual visible screen.
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const overlay = ref.current?.parentElement;
      overlay?.style.setProperty("--modal-viewport-height", `${viewport?.height || window.innerHeight}px`);
      overlay?.style.setProperty("--modal-viewport-top", `${viewport?.offsetTop || 0}px`);
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    if (!ref.current?.contains(document.activeElement)) {
      ref.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not(.modal-close):not([disabled])')?.focus();
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !disableCloseRef.current) onCloseRef.current();
      if (event.key === "Tab") {
        const elements = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]');
        if (!elements?.length) { event.preventDefault(); return; }
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      previous?.focus();
    };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !disableClose) onClose(); }}>
    <div ref={ref} className={`modal ${wide ? "wide" : ""} ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={titleId}>{title}</h2></div><button className="icon-button modal-close" aria-label="Close dialog" disabled={disableClose} onClick={onClose}><X size={20}/></button></div>
      {children}
    </div>
  </div>, document.body);
}

export function colorStyle(area: LifeArea): CSSProperties {
  const colors = AREA_COLORS[area.color];
  const theme = areaTheme(area);
  return { "--area-bg": colors.background, "--area-accent": colors.accent, "--area-text": colors.text, "--area-gradient": theme.gradient, "--area-ink": theme.ink, "--area-soft": theme.soft } as CSSProperties;
}
