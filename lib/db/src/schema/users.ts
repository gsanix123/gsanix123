import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    city: varchar("city", { length: 120 }).notNull().default(""),
    address: text("address").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("customer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
