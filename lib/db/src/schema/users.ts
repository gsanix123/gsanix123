import { createInsertSchema } from "drizzle-zod";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "admin",
  "owner",
]);

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    telegramId: varchar("telegram_id", { length: 32 }).notNull(),

    name: varchar("name", { length: 120 }).notNull(),

    phone: varchar("phone", { length: 40 }).notNull().default(""),

    city: varchar("city", { length: 120 }).notNull().default(""),

    address: text("address").notNull().default(""),

    role: userRoleEnum("role").notNull().default("customer"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_telegram_id_unique").on(table.telegramId)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
