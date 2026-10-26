import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { areas, items } from "@/db/schema";
import type { AuthUser } from "@/lib/auth";
import type { LifeArea, PlannerItem, PlannerUser, Workspace } from "@/lib/types";
import { addDays, dateISO } from "@/lib/utils";

const freshCopy: Record<string, [string, string]> = {
  Mind: ["Feed your curiosity", "Feed your mind"],
  Heart: ["Make space for joy", "Feed your soul"],
  Body: ["Feel your best", "Stay fit"],
  Family: ["Your people, your priority", "Kids & spouse"],
  Finance: ["Build a little freedom", "Save, invest, stay free"],
  "Car & Moto": ["Enjoy the journey", "Vehicle care & rides"],
};

async function alignDemoWorkspace(userId: string) {
  const userAreas = await db.select().from(areas).where(eq(areas.userId, userId));
  for (const area of userAreas) {
    const update = freshCopy[area.name];
    if (update && area.description === update[0]) await db.update(areas).set({ description: update[1] }).where(eq(areas.id, area.id));
  }
  const [existing] = await db.select({ id: items.id }).from(items).where(and(eq(items.userId, userId), eq(items.kind, "chore"))).limit(1);
  if (existing) return;
  const today = dateISO();
  const areaId = (name: string) => userAreas.find((area) => area.name === name)?.id ?? null;
  await db.insert(items).values([
    { userId, kind: "chore", title: "Take out the recycling", areaId: areaId("Family"), data: { date: today, completed: false, description: "Bins go out before the evening collection." } },
    { userId, kind: "chore", title: "Water the houseplants", areaId: areaId("Heart"), data: { date: today, completed: true, description: "The kitchen fern and the living-room pilea." } },
    { userId, kind: "chore", title: "Wipe the kitchen counters", areaId: areaId("Body"), data: { date: today, completed: false, description: "A two-minute reset after breakfast." } },
    { userId, kind: "chore", title: "Change the bed linen", areaId: areaId("Family"), data: { date: addDays(today, 1), completed: false, description: "Fresh sheets for the weekend." } },
  ]);
}

export function publicUser(user: AuthUser): PlannerUser {
  return { id: user.id, name: user.name, email: user.isDemo ? "Your personal demo workspace" : user.email, isDemo: user.isDemo, timezone: user.timezone, dailyGoal: user.dailyGoal };
}

export function serializeItem(item: typeof items.$inferSelect): PlannerItem {
  return { id: item.id, kind: item.kind, title: item.title, areaId: item.areaId, data: item.data, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

export function serializeArea(area: typeof areas.$inferSelect): LifeArea {
  return { id: area.id, name: area.name, description: area.description, emoji: area.emoji, color: area.color, sortOrder: area.sortOrder };
}

export async function getWorkspace(user: AuthUser): Promise<Workspace> {
  if (user.isDemo) await alignDemoWorkspace(user.id);
  const [userAreas, userItems] = await Promise.all([
    db.select().from(areas).where(eq(areas.userId, user.id)).orderBy(asc(areas.sortOrder)),
    db.select().from(items).where(eq(items.userId, user.id)).orderBy(desc(items.createdAt)),
  ]);
  return { user: publicUser(user), areas: userAreas.map(serializeArea), items: userItems.map(serializeItem) };
}
