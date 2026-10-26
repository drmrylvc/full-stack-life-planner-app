"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AreaInput, EditorState, ItemInput, ItemSaveResult, LifeArea, PlannerItem, PlannerUser, Workspace } from "@/lib/types";
import { dateISO, streakFromHistory } from "@/lib/utils";

export async function apiRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  // Retain the existing embedded-session protocol so saved accounts remain accessible.
  if (typeof window !== "undefined" && window.self !== window.top) headers["X-Daywell-Embedded"] = "1";
  let response: Response;
  try {
    response = await fetch(url, { method, credentials: "same-origin", cache: "no-store", headers, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error("Unable to connect. Reconnect and try again; your form has not been cleared."); }
  const result = await response.json().catch(() => ({ error: "Unable to connect. Please try again." }));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result as T;
}

export interface ToastMessage { id: number; message: string; type: "success" | "error" }
let temporarySequence = 0;
// Only used in the optimistic UI, never for authorization or database identities.
// This works in Safari and insecure/local preview contexts without randomUUID().
const temporaryId = () => `temp-${Date.now().toString(36)}-${++temporarySequence}`;

function reconcileItem(state: Workspace, saved: ItemSaveResult, temporary?: string): Workspace {
  const { occurrences, removedIds, ...primary } = saved;
  const records = occurrences || [primary];
  const replaced = new Set([...(removedIds || []), ...records.map((entry) => entry.id), ...(temporary ? [temporary] : [])]);
  return { ...state, items: [...records, ...state.items.filter((entry) => !replaced.has(entry.id))] };
}
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateWorkspace = useCallback((update: Workspace | null | ((current: Workspace) => Workspace)) => {
    const next = typeof update === "function" ? (workspaceRef.current ? update(workspaceRef.current) : null) : update;
    workspaceRef.current = next;
    setWorkspace(next);
  }, []);

  const notify = useCallback((message: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { updateWorkspace(await apiRequest<Workspace>("/api/workspace")); setLoggedOut(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load your workspace."); }
    finally { setLoading(false); }
  }, [updateWorkspace]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const markPending = (id: string, value: boolean) => setPending((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; });

  async function saveEditor(editor: EditorState, input: ItemInput | AreaInput) {
    const current = workspaceRef.current;
    if (!current) throw new Error("Please sign in to continue.");
    const id = editor.area?.id || editor.item?.id;
    if (id?.startsWith("temp-")) throw new Error("This item is still saving. Please try again in a moment.");
    const optimisticId = id || temporaryId();
    const isArea = editor.kind === "area";
    const now = new Date().toISOString();
    const optimisticArea: LifeArea | null = isArea ? { ...(editor.area || { id: optimisticId, sortOrder: current.areas.length }), ...(input as AreaInput) } : null;
    const optimisticItem: PlannerItem | null = !isArea ? { ...(editor.item || { id: optimisticId, kind: editor.kind as PlannerItem["kind"], createdAt: now, updatedAt: now }), ...(input as ItemInput) } : null;
    updateWorkspace((state) => ({ ...state,
      areas: optimisticArea ? (id ? state.areas.map((area) => area.id === id ? optimisticArea : area) : [...state.areas, optimisticArea]) : state.areas,
      items: optimisticItem ? (id ? state.items.map((item) => item.id === id ? optimisticItem : item) : [optimisticItem, ...state.items]) : state.items,
    }));
    markPending(optimisticId, true);
    try {
      const result = await apiRequest<LifeArea | ItemSaveResult>(`/api/items/${editor.kind}${id ? `/${id}` : ""}`, id ? "PATCH" : "POST", input);
      updateWorkspace((state) => isArea
        ? { ...state, areas: state.areas.map((area) => area.id === optimisticId ? result as LifeArea : area) }
        : reconcileItem(state, result as ItemSaveResult, optimisticId));
      const count = !isArea ? (result as ItemSaveResult).occurrences?.length || 1 : 1;
      notify(count > 1 ? `Saved ${count} scheduled occurrences.` : id ? "Changes saved." : "Added to your planner.");
      return result;
    } catch (err) {
      updateWorkspace((state) => ({ ...state,
        areas: isArea ? (id ? state.areas.map((area) => area.id === id ? editor.area! : area) : state.areas.filter((area) => area.id !== optimisticId)) : state.areas,
        items: !isArea ? (id ? state.items.map((item) => item.id === id ? editor.item! : item) : state.items.filter((item) => item.id !== optimisticId)) : state.items,
      }));
      notify(err instanceof Error ? err.message : "Couldn't save your changes.", "error");
      throw err;
    } finally { markPending(optimisticId, false); }
  }

  async function updateItem(item: PlannerItem, patch: Partial<ItemInput>, message?: string) {
    if (pending.has(item.id) || item.id.startsWith("temp-")) return;
    const original = workspaceRef.current?.items.find((entry) => entry.id === item.id) || item;
    const optimistic = { ...original, ...patch, data: { ...original.data, ...patch.data } };
    updateWorkspace((state) => ({ ...state, items: state.items.map((entry) => entry.id === item.id ? optimistic : entry) }));
    markPending(item.id, true);
    try {
      const saved = await apiRequest<ItemSaveResult>(`/api/items/${item.kind}/${item.id}`, "PATCH", patch);
      updateWorkspace((state) => reconcileItem(state, saved));
      if (message) notify(message);
    } catch (err) {
      updateWorkspace((state) => ({ ...state, items: state.items.map((entry) => entry.id === item.id ? original : entry) }));
      notify(err instanceof Error ? err.message : "Couldn't save your update.", "error");
    } finally { markPending(item.id, false); }
  }

  // 103. satırdaki updateItem bittikten hemen sonra gelen boşluğa yapıştırın:
  async function toggleItem(item: PlannerItem) {
    if (item.kind === "habit") {
      const today = dateISO();
      const wasDone = item.data.history?.includes(today);
      const history = wasDone ? (item.data.history || []).filter((day) => day !== today) : [...(item.data.history || []), today];
      await updateItem(item, { data: { history, streak: streakFromHistory(history) } }, wasDone ? "Habit check-in undone." : "A small win. You're showing up for yourself!");
    } else if (item.kind === "target") {
      const completed = (item.data.progress || 0) === 100;
      await updateItem(item, { data: { progress: completed ? 0 : 100, completed: !completed } }, completed ? "Target reopened." : "Target complete. Look how far you've come!");
    } else {
      await updateItem(item, { data: { completed: !item.data.completed } });
    }
  }


  async function remove(editor: EditorState) {
    const current = workspaceRef.current;
    const id = editor.area?.id || editor.item?.id;
    if (!current || !id) return;

    const affectedItems = current.items.filter((item) => item.areaId === id);
    const removedItems = current.items.filter((item) => item.id === id || (editor.deleteSeries && editor.item?.data.seriesId && item.kind === editor.kind && item.data.seriesId === editor.item.data.seriesId));
    const removedSet = new Set(removedItems.map((item) => item.id));

    updateWorkspace((state) => ({ ...state,
      areas: editor.kind === "area" ? state.areas.filter((area) => area.id !== id) : state.areas,
      items: editor.kind === "area" ? state.items.map((item) => item.areaId === id ? { ...item, areaId: null } : item) : state.items.filter((item) => !removedSet.has(item.id)),
    }));

    try {
      // Orijinal tekil yönlendirmeyi koruyoruz
      const result = await apiRequest<{ ok: boolean; removedIds?: string[] }>(
        `/api/items/${editor.kind}/${id}${editor.deleteSeries ? "?series=1" : ""}`,
        "DELETE"
      );

      if (editor.kind !== "area" && result.removedIds) {
        updateWorkspace((state) => ({ ...state, items: state.items.filter((item) => !result.removedIds!.includes(item.id)) }));
      }

      notify(editor.kind === "area" ? "Life area removed. Your items are kept in All areas." : editor.deleteSeries ? "Repeating series removed." : "Item removed from your planner.");
    } catch (err) {
      updateWorkspace((state) => ({ ...state,
        areas: editor.kind === "area" ? [...state.areas, editor.area!].sort((a, b) => a.sortOrder - b.sortOrder) : state.areas,
        items: editor.kind === "area" ? state.items.map((item) => affectedItems.some((affected) => affected.id === item.id) ? { ...item, areaId: id } : item) : [...state.items, ...removedItems],
      }));
      notify(err instanceof Error ? err.message : "Couldn't remove this item.", "error");
      throw err;
    }
  }

  // Bu satırdan sonra doğrudan "async function authenticate" gelmelidir.


  async function authenticate(input: { action: "signin" | "signup" | "demo"; name?: string; email?: string; password?: string }) {
    const result = await apiRequest<Workspace>("/api/auth", "POST", input);
    updateWorkspace(result);
    setLoggedOut(false);
    setError(null);
    notify(input.action === "signup" ? "Your account is ready. Your planner is right here." : "Welcome to ezlife26.");
  }

  async function logout() {
    await apiRequest("/api/auth", "DELETE");
    updateWorkspace(null);
    setLoggedOut(true);
    notify("You're signed out. See you soon!");
  }

  async function saveProfile(input: { name: string; timezone: string; dailyGoal: number }) {
    const user = await apiRequest<PlannerUser>("/api/profile", "PATCH", input);
    updateWorkspace((state) => ({ ...state, user }));
    notify("Your preferences are saved.");
  }

  return { workspace, loading: false, error, loggedOut, pending, toast, setToast, notify, reload, saveEditor, updateItem, toggleItem, remove, authenticate, logout, saveProfile };
}
