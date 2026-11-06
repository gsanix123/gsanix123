import { Router, type IRouter } from "express";
import {
  AuthenticateTelegramBody,
  AuthenticateTelegramResponse,
  GetCurrentUserResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSessionCookie,
  optionalAuth,
  setSessionCookie,
  toPublicUser,
  verifyTelegramInitData,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/telegram", async (req, res): Promise<void> => {
  const parsed = AuthenticateTelegramBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const telegramUser = verifyTelegramInitData(parsed.data.initData);

  if (!telegramUser) {
    res.status(401).json({ error: "Не удалось подтвердить данные Telegram." });
    return;
  }

  const name = [telegramUser.first_name, telegramUser.last_name]
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);

  const [user] = await db
    .insert(usersTable)
    .values({
      telegramId: telegramUser.id,
      name,
    })
    .onConflictDoUpdate({
      target: usersTable.telegramId,
      set: { name },
    })
    .returning();

  setSessionCookie(res, user.id);

  res.json(AuthenticateTelegramResponse.parse({ user: toPublicUser(user) }));
});

router.post("/auth/logout", (_req, res): void => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/auth/me", optionalAuth, (req, res): void => {
  const user = req.authUser ? toPublicUser(req.authUser) : null;
  res.json(GetCurrentUserResponse.parse({ user }));
});

export default router;
