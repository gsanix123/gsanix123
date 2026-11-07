import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const orderPlatformEnum = pgEnum("order_platform", ["POIZON", "1688", "Taobao"]);

export const orderStatusEnum = pgEnum("order_status", [
  "Новый",
  "На выкупе",
  "Выкуплен",
  "В пути",
  "На складе",
  "Доставлен",
]);

export const ordersTable = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: serial("order_number").notNull(),
    title: varchar("title", { length: 200 }).notNull().default(""),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    platform: orderPlatformEnum("platform").notNull(),
    url: text("url").notNull(),
    size: varchar("size", { length: 100 }).notNull().default(""),
    color: varchar("color", { length: 100 }).notNull().default(""),
    quantity: integer("quantity").notNull(),
    comment: text("comment").notNull().default(""),
    status: orderStatusEnum("status").notNull().default("Новый"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    index("orders_user_id_idx").on(table.userId),
    index("orders_created_at_idx").on(table.createdAt),
  ],
);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
