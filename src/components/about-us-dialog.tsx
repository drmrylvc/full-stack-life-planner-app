"use client";

import { CheckCircle2, Cloud, Layers3, LockKeyhole, Smartphone, Sparkles } from "lucide-react";
import { translate, type Lang } from "@/lib/i18n";
import { Modal } from "./ui";

export function AboutUsDialog({ language, onClose }: { language: Lang; onClose: () => void }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  return <Modal title={t("aboutTitle")} eyebrow={t("aboutUs")} onClose={onClose} className="about-modal">
    <p className="about-lead">{t("aboutBody")}</p>
    <div className="about-grid">
      <article><span><Sparkles size={19}/></span><div><h3>{t("aboutSeamlessTitle")}</h3><p>{t("aboutSeamless")}</p></div></article>
      <article><span><Layers3 size={19}/></span><div><h3>{t("aboutFlexibleTitle")}</h3><p>{t("aboutFlexible")}</p></div></article>
      <article><span><Cloud size={19}/></span><div><h3>{t("aboutSyncTitle")}</h3><p>{t("aboutSync")}</p></div></article>
      <article><span><LockKeyhole size={19}/></span><div><h3>{t("aboutPrivateTitle")}</h3><p>{t("aboutPrivate")}</p></div></article>
    </div>
    <div className="about-use-card">
      <Smartphone size={19}/>
      <div><strong>{t("aboutUseTitle")}</strong><p>{t("aboutUse")}</p></div>
      <CheckCircle2 size={19}/>
    </div>
    <div className="modal-footer"><button className="button primary" onClick={onClose}>{t("aboutClose")}</button></div>
  </Modal>;
}
