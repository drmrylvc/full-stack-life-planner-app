import { randomUUID } from "node:crypto";
import { and, eq, ne, sql, or, like } from "drizzle-orm";
import { db } from "@/db";
import { areas, items } from "@/db/schema";
import { ApiError, normalizeData } from "@/lib/api";
import { buildOccurrences, clearSeries, remainingRepeats, supportsRepeat } from "@/lib/recurrence";
import type { ItemData, ItemInput, ItemKind, ItemSaveResult } from "@/lib/types";
import { serializeItem } from "@/lib/workspace";

export async function createPlannerItem(userId: string, kind: ItemKind, input: ItemInput): Promise<ItemSaveResult> {
  return db.transaction(async (tx) => {
    if (input.areaId) {
      const [area] = await tx.select({ id: areas.id }).from(areas).where(and(eq(areas.id, input.areaId), eq(areas.userId, userId))).limit(1);
      if (!area) throw new ApiError("Please choose an existing life area, or select Personal.");
    }
    const data = normalizeData(kind, clearSeries(input.data));
    const dates = buildOccurrences(kind, data, randomUUID());
    const rows = await tx.insert(items).values(dates.map((entry) => ({ userId, kind, title: input.title, areaId: input.areaId, data: entry }))).returning();
    const occurrences = rows.map(serializeItem);
    return { ...occurrences[0], occurrences, removedIds: [] };
  });
}

export async function updatePlannerItem(userId: string, kind: ItemKind, id: string, input: Partial<ItemInput>): Promise<ItemSaveResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(items).where(and(eq(items.id, id), eq(items.userId, userId), eq(items.kind, kind))).limit(1).for("update");
    if (!existing) throw new ApiError("This item could not be found.", 404);
    if (input.areaId) {
      const [area] = await tx.select({ id: areas.id }).from(areas).where(and(eq(areas.id, input.areaId), eq(areas.userId, userId))).limit(1);
      if (!area) throw new ApiError("Please choose an existing life area, or select Personal.");
    }

    const supplied = input.data || {};
    // Series identifiers belong to the server, never to a client-submitted ID.
    const merged: ItemData = { ...existing.data, ...clearSeries(supplied) };
    const dateField = kind === "target" ? "dueDate" : "date";
    const oldRepeat = existing.data.repeat || "none";
    const newRepeat = supplied.repeat ?? oldRepeat;
    const newCount = newRepeat === "none" ? 0 : supplied.repeatCount ?? (oldRepeat === "none" ? 1 : remainingRepeats(existing.data));
    const dateChanged = Object.hasOwn(supplied, dateField) && supplied[dateField] !== existing.data[dateField];
    const recurrenceChanged = supportsRepeat(kind) && (
      newRepeat !== oldRepeat ||
      (supplied.repeatCount !== undefined && newCount !== remainingRepeats(existing.data)) ||
      (oldRepeat !== "none" && dateChanged)
    );
    if (kind === "file" && supplied.content && !supplied.url) delete merged.url;

    const removedIds: string[] = [];
    const title = input.title ?? existing.title;
    const areaId = input.areaId === undefined ? existing.areaId : input.areaId;
    let data: ItemData;
    let futureData: ItemData[] = [];

    if (recurrenceChanged) {
      if (existing.data.seriesId) {
        const deleted = await tx.delete(items).where(and(
          eq(items.userId, userId), eq(items.kind, kind), ne(items.id, id),
          sql`${items.data}->>'seriesId' = ${existing.data.seriesId}`,
          sql`COALESCE((${items.data}->>'repeatIndex')::int, 0) > ${existing.data.repeatIndex || 0}`,
        )).returning({ id: items.id });
        removedIds.push(...deleted.map((entry) => entry.id));
      }
      const occurrences = buildOccurrences(kind, normalizeData(kind, { ...clearSeries(merged), repeat: newRepeat, repeatCount: newCount }), randomUUID());
      [data, ...futureData] = occurrences;
    } else {
      data = normalizeData(kind, { ...merged, repeatCount: existing.data.repeatCount ?? merged.repeatCount });
      if (existing.data.seriesId) {
        data.seriesId = existing.data.seriesId;
        data.repeatIndex = existing.data.repeatIndex;
        data.repeatStartDate = existing.data.repeatStartDate;
      }
    }

    const [updated] = await tx.update(items).set({ title, areaId, data, updatedAt: new Date() }).where(and(eq(items.id, id), eq(items.userId, userId))).returning();
    const future = futureData.length ? await tx.insert(items).values(futureData.map((entry) => ({ userId, kind, title, areaId, data: entry }))).returning() : [];
    const occurrences = [updated, ...future].map(serializeItem);
    return { ...occurrences[0], occurrences, removedIds };
  });
}

export async function deletePlannerItem(userId: string, kind: ItemKind, id: string, wholeSeries = false): Promise<string[]> {
  return db.transaction(async (tx) => {
    // 1. Önce silinmek istenen asıl elemanı korumalı olarak çekiyoruz
    const [existing] = await tx.select().from(items).where(and(eq(items.userId, userId), eq(items.id, id), eq(items.kind, kind))).limit(1).for("update");
    if (!existing) throw new ApiError("This item could not be found.", 404);

    // 2. 🧹 KESİN TEMİZLİK MOTORU: Eğer bir hedef (target) siliniyorsa, yabancı anahtar (Foreign Key) kilidine takılmamak için
    // önce ona bağlı üretilmiş tüm [ezlife26] takvim planlarını ve hedef görevlerini (chore) SQL düzeyinde önceden kazıyoruz.
    // src/lib/item-mutations.ts (Line 90)
            if (kind === "target") {
              // 1. Fetch the target item using bulletproof core Drizzle select mapping syntax
              const existingRows = await tx
                .select()
                .from(items)
                .where(and(eq(items.id, id), eq(items.userId, userId)))
                .limit(1);

              const targetTitle = existingRows[0]?.title || "";

              // 2. Cascade delete all matching scheduler actions safely
              await tx.delete(items).where(
                and(
                  eq(items.userId, userId),
                  or(
                    like(items.title, `%${targetTitle}%`),
                    like(items.title, `%[ezlife26]%`),
                    like(items.title, `%Hedef Görevi:%`)
                  )
                )
              );
            }




    // 3. Arka plandaki tüm bağımlı alt elemanlar sıfırlandığı için artık ana hedefi hiçbir engele takılmadan uçuruyoruz
    const match = wholeSeries && existing.data.seriesId
      ? sql`${items.data}->>'seriesId' = ${existing.data.seriesId}`
      : eq(items.id, id);

    const deleted = await tx.delete(items).where(and(eq(items.userId, userId), eq(items.kind, kind), match)).returning({ id: items.id });
    return deleted.map((entry) => entry.id);
  });
}


