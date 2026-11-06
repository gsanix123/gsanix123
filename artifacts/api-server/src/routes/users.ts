import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  ListUsersResponse,
  UpdateCurrentUserBody,
  UpdateCurrentUserResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { requireAdmin, requireAuth, toPublicUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListUsersResponse.parse(users.map(toPublicUser)));
});

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateCurrentUserBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = parsed.data;

  const [user] = await db
    .update(usersTable)
    .set({
      name: profile.name.trim(),
      phone: profile.phone.trim(),
      city: profile.city.trim(),
      address: profile.address.trim(),
    })
    .where(eq(usersTable.id, req.authUser!.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Пользователь не найден." });
    return;
  }

  res.json(UpdateCurrentUserResponse.parse({ user: toPublicUser(user) }));
});

export default router;