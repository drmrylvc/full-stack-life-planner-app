import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import type { AreaColor, ItemData } from "@/lib/types";

export const itemKind = pgEnum("planner_item_kind", ["target", "habit", "plan", "chore", "file", "note"]);

export const users = pgTable("planner_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: text("password_hash"),
  isDemo: boolean("is_demo").default(false).notNull(),
  timezone: varchar("timezone", { length: 80 }).default("UTC").notNull(),
  dailyGoal: integer("daily_goal").default(4).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("planner_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [index("planner_session_user_idx").on(table.userId)]);

export const areas = pgTable("planner_areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  description: varchar("description", { length: 300 }).default("").notNull(),
  emoji: varchar("emoji", { length: 24 }).default("🌱").notNull(),
  color: varchar("color", { length: 20 }).$type<AreaColor>().default("mint").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [index("planner_area_user_idx").on(table.userId)]);

export const items = pgTable("planner_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  areaId: uuid("area_id").references(() => areas.id, { onDelete: "set null" }),
  kind: itemKind("kind").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  data: jsonb("data").$type<ItemData>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("planner_item_user_idx").on(table.userId), index("planner_item_area_idx").on(table.areaId)]);
