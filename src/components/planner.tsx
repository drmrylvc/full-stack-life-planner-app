"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, ChevronDown, CircleCheck, CircleHelp, FolderOpen, Home, Plus, Search, Settings, Smartphone, Sprout, StickyNote, Target, X, Zap } from "lucide-react";
import { isLang, localeFor, translate, type Lang, type TranslationKey } from "@/lib/i18n";
import type { EditorState, ItemKind, LifeArea, PlannerItem, View } from "@/lib/types";
import { dateISO, formatDate, headlineDate } from "@/lib/utils";
import { AuthDialog, AuthLanding, HelpDialog, SettingsDialog } from "./account-dialogs";
import { AboutUsDialog } from "./about-us-dialog";
import Dashboard from "./dashboard";
import { LanguageMenu } from "./language-menu";
import { MobileAccessDialog } from "./mobile-access-dialog";
import { SearchDialog } from "./search-dialog";
import { AddAnythingDialog, EditorDialog, FilePreviewDialog } from "./editor-dialogs";
import ResourceViews from "./resource-views";
import { Brand, EmptyState, Spinner } from "./ui";
import { useWorkspace } from "./use-workspace";
import { TaskEditor } from "./task-editor";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Planner() {
  const { workspace, loading, error, loggedOut, pending, toast, setToast, notify, reload, saveEditor, updateItem, toggleItem, remove, authenticate, logout, saveProfile } = useWorkspace();
  const [view, setView] = useState<View>("today");
  const [areaId, setAreaId] = useState<string | null>(null);
  const [date, setDate] = useState(dateISO);
  const [language, setLanguage] = useState<Lang>("en");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [previewFile, setPreviewFile] = useState<PlannerItem | null>(null);
  // Add this line back right under your other state triggers (like const [editor, setEditor]...):
    const [deleteEditor, setDeleteEditor] = useState<EditorState | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileAccessOpen, setMobileAccessOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const installPrompt = useRef<InstallPrompt | null>(null);
  const tr = (key: TranslationKey, vars?: Record<string, string | number>) => translate(language, key, vars);
  const anyDialog = !!(editor || quickAdd || previewFile || authMode || settingsOpen || helpOpen || aboutOpen || mobileAccessOpen || searchOpen);

  function chooseLanguage(next: Lang) {
    setLanguage(next);
    localStorage.setItem("ezlife26-language", next);
    setLanguageOpen(false);
    document.documentElement.lang = localeFor(next).slice(0, 2);
    window.location.reload();
  }

  function closePopovers() { setLanguageOpen(false); setDateOpen(false); }

  function navigate(next: View, selectedArea: string | null = null) {
    setView(next);
    setAreaId(selectedArea);
    closePopovers();
    const url = new URL(window.location.href);
    if (next === "today") url.searchParams.delete("view"); else url.searchParams.set("view", next);
    if (selectedArea) url.searchParams.set("area", selectedArea); else url.searchParams.delete("area");
    window.history.pushState({}, "", `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function create(kind: ItemKind | "area", selectedArea?: string) {
    closePopovers();
    setQuickAdd(false);
    setEditor({ kind, areaId: selectedArea || areaId });
  }
  function edit(item: PlannerItem) { closePopovers(); setEditor({ kind: item.kind, item }); }
  function openArea(area: LifeArea) { navigate("areas", area.id); }

  useEffect(() => {
    const readLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("view") || "today";
      if (["today", "targets", "plan", "habits", "files", "notes", "areas"].includes(next)) setView(next as View);
      setAreaId(params.get("area"));
    };
    readLocation();
    window.addEventListener("popstate", readLocation);
    const savedLanguage = (localStorage.getItem("ezlife26-language") || localStorage.getItem("daywell-language"));
    if (isLang(savedLanguage)) { setLanguage(savedLanguage); document.documentElement.lang = localeFor(savedLanguage).slice(0, 2); }
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    const beforeInstall = (event: Event) => { event.preventDefault(); installPrompt.current = event as InstallPrompt; };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("popstate", readLocation);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!anyDialog) setSearchOpen(true);
      }
      const target = event.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (event.key.toLowerCase() === "n" && !typing && !anyDialog && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setQuickAdd(true);
      }
      if (event.key === "Escape") { setLanguageOpen(false); setDateOpen(false); }
    };
    const clickOutside = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-popover]")) { setLanguageOpen(false); setDateOpen(false); }
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("mousedown", clickOutside);
    return () => { document.removeEventListener("keydown", keydown); document.removeEventListener("mousedown", clickOutside); };
  }, [anyDialog]);

  async function handleAuth(input: Parameters<typeof authenticate>[0]) { await authenticate(input); navigate("today"); }
  async function handleLogout() { await logout(); setAuthMode("signin"); closePopovers(); }
  async function handleDelete(value: EditorState) { await remove(value); if (value.area?.id === areaId) setAreaId(null); }

  async function handleEditorSave(value: EditorState, input: Parameters<typeof saveEditor>[1]) {
    const saved = await saveEditor(value, input);
    if (value.kind === "chore" && "data" in saved && saved.data.date) setDate(saved.data.date);
    return saved;
  }

  function exportData() {
    if (!workspace) return;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: "ezlife26", ...workspace }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ezlife26-${dateISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Your planner archive has been downloaded.");
  }

  async function installApp() {
    const prompt = installPrompt.current;
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") notify("Your planner has been added to your home screen.");
      installPrompt.current = null;
    } else notify("Android: Chrome menu → Install app. iPhone: Safari Share → Add to Home Screen.");
  }

  const toastElement = toast && <div className={`toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"} key={toast.id}>
    {toast.type === "success" ? <CircleCheck size={20}/> : <AlertCircle size={20}/>}
    <span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={16}/></button>
  </div>;

  if (!workspace) {
    if (loading) return <LoadingPlanner/>;
    if (loggedOut) return <><AuthLanding/><AuthDialog initialMode={authMode || "signin"} onClose={() => setAuthMode(null)} onSubmit={handleAuth} dismissable={false}/>{toastElement}</>;
    return <div className="workspace-error"><Brand/><EmptyState title="A little connection hiccup" description={error || "We couldn't load your workspace. Let's give it another go."} action="Try again" onAction={() => void reload()}/></div>;
  }

  const user = workspace.user;
  const targets = workspace.items.filter((item) => item.kind === "target");
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: user.timezone }).format(new Date()));
  const greeting = hour < 12 ? tr("goodMorning") : hour < 18 ? tr("goodAfternoon") : tr("goodEvening");
  const completedTargets = targets.filter((item) => item.data.progress === 100).length;

  const viewHeadings: Record<Exclude<View, "today">, { title: string; subtitle: string; action: string; kind: ItemKind | "area" }> = {
    targets: { title: tr("targetsShort" as any) || "Targets", subtitle: "Steps", action: "Add", kind: "target" },
    plan: { title: tr("dailyPlan"), subtitle: tr("tasksHint"), action: tr("openPlan"), kind: "plan" },
    habits: { title: tr("quickLog"), subtitle: tr("quickLogHint"), action: tr("addAnything"), kind: "habit" },
    files: { title: tr("recentFiles"), subtitle: tr("filesHint"), action: tr("filesBadge" as any), kind: "file" },
    notes: { title: "Notes", subtitle: "Thoughts", action: "Write", kind: "note" },
    areas: { title: tr("lifeAreas"), subtitle: tr("tapArea"), action: tr("manage"), kind: "area" },
  };
  const heading = view !== "today" ? viewHeadings[view] : null;
  const activeArea = areaId ? workspace.areas.find((a) => a.id === areaId) : null;

  return <div className="app-shell planner-only">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="workspace-content">
      {offline && <div className="offline-banner"><AlertCircle size={15}/>You're offline. Reconnect to save your next change.</div>}
      <main className="main-content" id="main-content" tabIndex={-1}>
        <div className={`page-heading ${view === "today" ? "is-today" : ""}`}>
          {view === "today" ? <>
            <div className="snap-hero-top"><div className="hero-greeting-group"><span className="app-wordmark">ezlife<span>26</span></span><p className="snap-greet">{greeting} <span aria-hidden="true">👋</span></p></div><div className="language-about-stack"><LanguageMenu language={language} open={languageOpen} variant="hero" onToggle={() => { const next = !languageOpen; closePopovers(); setLanguageOpen(next); }} onChange={chooseLanguage}/><button className="about-link" onClick={() => setAboutOpen(true)}>{tr("aboutUs")}</button></div></div>
            <h1 className="snap-date">{headlineDate(date, localeFor(language))}<span className="visually-hidden"> {user.name.split(" ")[0]}</span></h1>
            <p className="snap-hero-meta">{tr("liveTargets", { n: targets.length })} <span>·</span> {tr("alreadyComplete", { n: completedTargets })}</p>
          </> : <>
            <div><h1>{heading?.title}</h1><p>{heading?.subtitle}</p></div>
            <div className="page-heading-actions">
              <div className="date-container" data-popover><button className="date-button" aria-label="Choose your planner date" aria-expanded={dateOpen} onClick={() => { const next = !dateOpen; closePopovers(); setDateOpen(next); }}><CalendarDays size={15}/><span>{formatDate(date, { weekday: "short", month: "short", day: "numeric" }, localeFor(language))}</span><ChevronDown size={11}/></button>
                {dateOpen && <div className="dropdown-menu date-dropdown"><label className="form-field"><span>A little time to plan</span><input type="date" value={date} onChange={(event) => { if (event.target.value) { setDate(event.target.value); setDateOpen(false); if (view !== "plan") navigate("plan"); } }}/></label><button onClick={() => { setDate(dateISO()); setDateOpen(false); }}>Back to today<ArrowRight size={14}/></button></div>}
              </div>
              <button className="button primary add-main-button" onClick={() => create(heading!.kind, areaId || undefined)}><Plus size={17}/><span>{heading?.action}</span></button>
            </div>
          </>}
        </div>

        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="error-state"><AlertCircle size={24}/><p>{error}</p><button onClick={reload}>Retry</button></div>
        ) : view === "today" ? (
          <Dashboard
            workspace={workspace}
            pending={pending}
            date={date}
            onView={(v: any) => navigate(v)}
            onCreate={create}
            onEdit={edit}
            onToggle={toggleItem}
            onArea={openArea}
            onFile={setPreviewFile}
            onDelete={(incoming: any) => {
              // 🧠 AKILLI ADAPTÖR: Alt bileşenden gelen veri formatı ne olursa olsun EditorState yapısına dönüştürür
              if (!incoming) return;

              const resolvedItem = incoming.item ? incoming.item : (incoming.id ? incoming : null);
              const resolvedKind = incoming.kind ? incoming.kind : (resolvedItem?.kind || "chore");

              setEditor({
                kind: resolvedKind,
                item: resolvedItem,
                areaId: resolvedItem?.areaId || null
              });
            }}
            onQuickAdd={() => setQuickAdd(true)}
            language={language}
          />
        ) : (
          <ResourceViews
            view={view}
            workspace={workspace}
            pending={pending}
            areaId={areaId}
            onAreaFilter={setAreaId}
            date={date}
            activeArea={activeArea}
            onBack={() => navigate("today")}
            onCreate={create}
            onEdit={edit}
            onToggle={toggleItem}
            onDelete={(incoming: any) => {
              // 🧠 AKILLI ADAPTÖR: ResourceViews içindeki tıklamaları da güvenli formata tamir eder
              if (!incoming) return;

              const resolvedItem = incoming.item ? incoming.item : (incoming.id ? incoming : null);
              const resolvedKind = incoming.kind ? incoming.kind : (resolvedItem?.kind || "chore");

              setEditor({
                kind: resolvedKind,
                item: resolvedItem,
                areaId: resolvedItem?.areaId || null
              });
            }}
            onFile={setPreviewFile}
            language={language}
          />
        )}




        <footer className="planner-tools" aria-label="Planner tools">
          <button onClick={() => navigate("plan")}><CalendarDays size={15}/>{tr("planNav")}</button>
          <button onClick={() => navigate("habits")}><Zap size={15}/>{tr("habitsNav")}</button>
          <button onClick={() => navigate("notes")}><StickyNote size={15}/>{tr("notes")}</button>
          <button onClick={() => setSearchOpen(true)}><Search size={15}/>Search</button>
          <button onClick={() => setSettingsOpen(true)}><Settings size={15}/>{tr("settings")}</button>
          <button onClick={() => setHelpOpen(true)}><CircleHelp size={15}/>Help</button>
          {view !== "today" && <div className="language-about-stack tools-language"><LanguageMenu language={language} open={languageOpen} onToggle={() => { const next = !languageOpen; closePopovers(); setLanguageOpen(next); }} onChange={chooseLanguage}/><button className="about-link" onClick={() => setAboutOpen(true)}>{tr("aboutUs")}</button></div>}
          <button className="planner-phone-link" onClick={() => setMobileAccessOpen(true)}><Smartphone size={15}/>Use on phone</button>
        </footer>
      </main>
    </div>

    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <button className={view === "today" ? "active" : ""} aria-current={view === "today" ? "page" : undefined} onClick={() => navigate("today")}><Home size={22}/><span>{tr("glanceTitle" as any) || "Today"}</span></button>
      <button className={view === "plan" ? "active" : ""} aria-current={view === "plan" ? "page" : undefined} onClick={() => navigate("plan")}><CalendarDays size={22}/><span>{tr("dailyPlan")}</span></button>
      <button className="mobile-add-button" aria-label="Add anything" onClick={() => setQuickAdd(true)}><Plus size={30}/></button>
      <button className={view === "files" ? "active" : ""} aria-current={view === "files" ? "page" : undefined} onClick={() => navigate("files")}><FolderOpen size={22}/><span>{tr("recentFiles")}</span></button>
      <button className={view === "areas" ? "active" : ""} aria-current={view === "areas" ? "page" : undefined} onClick={() => navigate("areas")}><Sprout size={22}/><span>{tr("lifeAreas")}</span></button>
    </nav>

    {quickAdd && <AddAnythingDialog onClose={() => setQuickAdd(false)} onChoose={create}/>}

    {/* 🚀 THE FIXED INLINE WORKSPACE ROUTING LINKING CARD TRIGGERS TO SYSTEM REMOVE ACTIONS */}
    {quickAdd && <AddAnythingDialog onClose={() => setQuickAdd(false)} onChoose={create}/>}

    {/* 🚀 THE ARCHITECTURAL PLUG: CORRECTLY ROUTING CHORES INTO THE TASK EDITOR ENGINE */}
    {editor && (editor.kind === "chore"
      ? <TaskEditor
          key={editor.item?.id || "new-task"}
          editor={editor}
          workspace={workspace}
          date={date}
          language={language}
          onClose={() => setEditor(null)}
          onSave={handleEditorSave}
          onDelete={async (val) => {
            try {
              // 1. Fire removal action straight to custom store hook safely
              await remove(val || editor);
              // 2. Clear out view context instantly
              setEditor(null);
              // 3. Smooth sync state refresh
              window.location.reload();
            } catch (err) {
              console.error("Task editor removal execution pipeline crashed:", err);
            }
          }}
        />
      : <EditorDialog
          key={editor.item?.id || editor.area?.id || editor.kind}
          editor={editor}
          workspace={workspace}
          date={date}
          language={language}
          onClose={() => setEditor(null)}
          onSave={handleEditorSave}
          onDelete={async (targetEditor) => {
            try {
              await remove(targetEditor || editor);
              setEditor(null);
              window.location.reload();
            } catch (err) {
              console.error("Core resource manager rejected object deletion request:", err);
            }
          }}
        />
    )}

    {/* 📥 PRESERVE ACCOUNTS, SCREEN SETTINGS, AND MANIFEST FILES SECURELY BELOW */}
    {previewFile && <FilePreviewDialog file={workspace.items.find((item) => item.id === previewFile.id) || previewFile} area={workspace.areas.find((area) => area.id === previewFile.areaId)} onClose={() => setPreviewFile(null)} onEdit={edit} onDelete={async (val) => { await remove({ kind: "file", item: val.item } as any); setPreviewFile(null); window.location.reload(); }}/>}
    {authMode && <AuthDialog initialMode={authMode} isDemo={user.isDemo} onClose={() => setAuthMode(null)} onSubmit={handleAuth}/>}
    {settingsOpen && <SettingsDialog workspace={workspace} onClose={() => setSettingsOpen(false)} onSave={saveProfile} onLogout={handleLogout} onSignUp={() => setAuthMode("signup")} onExport={exportData} onInstall={() => { setSettingsOpen(false); setMobileAccessOpen(true); }}/>}
    {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)}/>}
    {aboutOpen && <AboutUsDialog language={language} onClose={() => setAboutOpen(false)}/>}
    {mobileAccessOpen && <MobileAccessDialog onClose={() => setMobileAccessOpen(false)} onInstall={installApp}/>}
    {searchOpen && <SearchDialog workspace={workspace} language={language} onClose={() => setSearchOpen(false)} onView={navigate} onEdit={edit} onFile={setPreviewFile} onArea={openArea}/>}
    {toastElement}



  </div>;
}


function LoadingPlanner() {
  return <div className="app-shell planner-only"><main className="planner-loading" aria-busy="true" aria-label="Loading your planner">
    <div className="loading-hero skeleton"/><div className="loading-glance skeleton"/><div className="loading-area-title skeleton"/>
    <div className="loading-areas">{Array.from({ length: 6 }, (_, index) => <div key={index} className="skeleton"/>)}</div>
    <div className="loading-stack">{Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton"/>)}</div>
    <span className="loading-caption"><Spinner size={16}/>Making a little room for your day…</span>
  </main></div>;
}
