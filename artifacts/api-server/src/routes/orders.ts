import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderParams,
  GetOrderResponse,
  ListOrdersResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import { db, ordersTable, usersTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth";

const router: IRouter = Router();

function orderSelection() {
  return {
    id: ordersTable.id,
    userId: ordersTable.userId,
    customerName: usersTable.name,
    platform: ordersTable.platform,
    url: ordersTable.url,
    size: ordersTable.size,
    color: ordersTable.color,
    quantity: ordersTable.quantity,
    comment: ordersTable.comment,
    status: ordersTable.status,
    createdAt: ordersTable.createdAt,
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const baseQuery = db
    .select(orderSelection())
    .from(ordersTable)
    .innerJoin(usersTable, eq(ordersTable.userId, usersTable.id));

  const orders =
    req.authUser!.role === "admin"
      ? await baseQuery.orderBy(desc(ordersTable.createdAt))
      : await baseQuery
          .where(eq(ordersTable.userId, req.authUser!.id))
          .orderBy(desc(ordersTable.createdAt));

  res.json(ListOrdersResponse.parse(orders));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  if (req.authUser!.role !== "customer") {
    res.status(403).json({ error: "Создавать заявки может только клиент." });
    return;
  }

  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let productUrl: URL;
  try {
    productUrl = new URL(parsed.data.url);
  } catch {
    res.status(400).json({ error: "Укажите корректную ссылку на товар." });
    return;
  }
  if (!["http:", "https:"].includes(productUrl.protocol)) {
    res.status(400).json({ error: "Ссылка должна начинаться с http:// или https://." });
    return;
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId: req.authUser!.id,
      platform: parsed.data.platform,
      url: productUrl.toString(),
      size: parsed.data.size?.trim() ?? "",
      color: parsed.data.color?.trim() ?? "",
      quantity: parsed.data.quantity,
      comment: parsed.data.comment?.trim() ?? "",
    })
    .returning();

  const response = { ...order, customerName: req.authUser!.name };
  res.status(201).json(CreateOrderResponse.parse(response));
});

router.get("/orders/:orderId", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const accessFilter =
    req.authUser!.role === "admin"
      ? eq(ordersTable.id, parsed.data.orderId)
      : and(eq(ordersTable.id, parsed.data.orderId), eq(ordersTable.userId, req.authUser!.id));

  const [order] = await db
    .select(orderSelection())
    .from(ordersTable)
    .innerJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(accessFilter)
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Заявка не найдена." });
    return;
  }

  res.json(GetOrderResponse.parse(order));
});

router.patch(
  "/orders/:orderId/status",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateOrderStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const body = UpdateOrderStatusBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [updated] = await db
      .update(ordersTable)
      .set({ status: body.data.status })
      .where(eq(ordersTable.id, params.data.orderId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Заявка не найдена." });
      return;
    }

    const [order] = await db
      .select(orderSelection())
      .from(ordersTable)
      .innerJoin(usersTable, eq(ordersTable.userId, usersTable.id))
      .where(eq(ordersTable.id, updated.id))
      .limit(1);

    res.json(UpdateOrderStatusResponse.parse(order));
  },
);

export default router;
