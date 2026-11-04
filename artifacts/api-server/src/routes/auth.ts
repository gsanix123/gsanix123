import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  GetCurrentUserResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegisterBody,
  RegisterResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSessionCookie,
  hashPassword,
  isUniqueViolation,
  optionalAuth,
  requireAuth,
  setSessionCookie,
  toPublicUser,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        name: parsed.data.name.trim(),
        email,
        phone: parsed.data.phone?.trim() ?? "",
        passwordHash,
        role: "customer",
      })
      .returning();

    setSessionCookie(res, user.id);
    res.status(201).json(RegisterResponse.parse({ user: toPublicUser(user) }));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Аккаунт с этой почтой уже существует." });
      return;
    }
    throw error;
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Неверная почта или пароль." });
    return;
  }

  setSessionCookie(res, user.id);
  res.json(LoginResponse.parse({ user: toPublicUser(user) }));
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
