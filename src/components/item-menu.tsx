"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export default function ItemMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", keydown); };
  }, [open]);
  return <div className="item-menu" ref={ref}><button className={`icon-button ${open ? "active" : ""}`} aria-label="Item actions" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal size={19}/></button>{open && <div className="dropdown-menu item-dropdown"><button onClick={() => { setOpen(false); onEdit(); }}><Pencil size={15}/>Edit details</button><button className="danger" onClick={() => { setOpen(false); onDelete(); }}><Trash2 size={15}/>Delete</button></div>}</div>;
}
