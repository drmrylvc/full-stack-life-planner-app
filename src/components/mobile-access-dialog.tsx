"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Download, Share2, Smartphone } from "lucide-react";
import { Modal } from "./ui";

export function MobileAccessDialog({ onClose, onInstall }: { onClose: () => void; onInstall: () => Promise<void> }) {
  const [link] = useState(() => typeof window !== "undefined" ? new URL("/", window.location.href).href : "");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setMessage("Link copied. Send it to your phone and open it in your browser.");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setMessage("The link is selected. Copy it and send it to your phone.");
    }
  }

  async function share() {
    if (!navigator.share) { await copy(); return; }
    try {
      await navigator.share({ title: "ezlife26 — your life planner", text: "Open your planner on Android or iPhone.", url: link });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) await copy();
    }
  }

  async function install() {
    setBusy(true);
    try { await onInstall(); }
    catch { setMessage("Use your browser menu to add ezlife26 to your home screen."); }
    finally { setBusy(false); }
  }

  return <Modal title="Your planner, on your phone" eyebrow="ANDROID & IPHONE" onClose={onClose} className="mobile-access-modal" disableClose={busy}>
    <div className="mobile-access-intro"><span><Smartphone size={28}/></span><p>Open this link in Chrome on Android or Safari on iPhone. No app-store download needed.</p></div>
    <label className="form-field mobile-link-field"><span>Your mobile app link</span><input ref={linkRef} readOnly type="url" aria-label="Mobile app link" value={link} onFocus={(event) => event.currentTarget.select()}/></label>
    <div className="mobile-link-actions">
      <button className="button primary" onClick={() => void copy()}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy link"}</button>
      <button className="button secondary" onClick={() => void share()}><Share2 size={16}/>Share link</button>
      <a className="button secondary" href={link} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={16}/>Open app</a>
    </div>
    {message && <p className="mobile-access-message" role="status">{message}</p>}
    <div className="mobile-install-guides">
      <section><span aria-hidden="true">🤖</span><div><h3>Android</h3><p>Open the link in <strong>Chrome</strong>. Tap <strong>⋮</strong>, then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p></div></section>
      <section><span aria-hidden="true">🍎</span><div><h3>iPhone</h3><p>Open the link in <strong>Safari</strong>. Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> → <strong>Add</strong>.</p></div></section>
    </div>
    <p className="mobile-sync-hint">Sign in with the same account on each device to keep your tasks, targets, habits and files together. A connection is needed to sync changes.</p>
    <div className="modal-footer"><button className="button secondary" onClick={onClose} disabled={busy}>Done</button><button className="button primary" onClick={() => void install()} disabled={busy}><Download size={16}/>{busy ? "Please wait…" : "Install on this device"}</button></div>
  </Modal>;
}
