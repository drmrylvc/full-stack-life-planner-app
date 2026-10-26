"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { LANGUAGES, translate, type Lang } from "@/lib/i18n";

export function LanguageMenu({ language, open, onToggle, onChange, variant = "bar" }: { language: Lang; open: boolean; onToggle: () => void; onChange: (language: Lang) => void; variant?: "bar" | "hero" }) {
  const current = LANGUAGES.find((item) => item.code === language) || LANGUAGES[0];
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      setBox({ top: rect.bottom + 8, left: Math.max(12, Math.min(rect.right - 236, window.innerWidth - 248)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  return <div className={`language-container ${variant}`} data-popover>
    <button ref={buttonRef} className={`language-pill ${variant}`} aria-label="Change language" aria-expanded={open} aria-haspopup="listbox" onClick={onToggle}>
      <span className="language-flag" aria-hidden="true">{current.flag}</span>
      <span>{current.short}</span>
      <ChevronDown size={12}/>
    </button>
    {open && createPortal(<div className="dropdown-menu language-dropdown language-portal" data-popover role="listbox" aria-label={translate(language, "chooseLanguage")} style={{ top: box.top, left: box.left }}>
      <p className="dropdown-eyebrow">{translate(language, "chooseLanguage")}</p>
      {LANGUAGES.map((item) => <button key={item.code} role="option" aria-selected={item.code === language} onClick={() => onChange(item.code)}>
        <span className="language-flag" aria-hidden="true">{item.flag}</span>
        <span>{item.label}</span>
        <small>{item.short}</small>
        {item.code === language && <Check size={14}/>}
      </button>)}
    </div>, document.body)}
  </div>;
}
