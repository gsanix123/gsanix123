import { createHmac, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, usersTable, type User } from "@workspace/db";

const SESSION_COOKIE = "china_buy_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 14;

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
    }
  }
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured for authentication.");
  }
  return secret;
}

export type TelegramWebAppUser = {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
};

export function verifyTelegramInitData(
  initData: string,
): TelegramWebAppUser | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    return null;
  }

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const received = Buffer.from(receivedHash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");

  if (
    received.length !== calculated.length ||
    !timingSafeEqual(received, calculated)
  ) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));

  if (
    !Number.isFinite(authDate) ||
    authDate > Math.floor(Date.now() / 1000) + 60 ||
    Math.floor(Date.now() / 1000) - authDate > 86400
  ) {
    return null;
  }

  try {
    const userData = params.get("user");

    if (!userData) return null;

    const user = JSON.parse(userData);

    if (
      (typeof user.id !== "number" && typeof user.id !== "string") ||
      !user.first_name ||
      typeof user.first_name !== "string"
    ) {
      return null;
    }
    return {
      id: String(user.id),
      first_name: user.first_name,
      last_name:
        typeof user.last_name === "string" ? user.last_name : undefined,
      username: typeof user.username === "string" ? user.username : undefined,
    };
  } catch {
    return null;
  }
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function verifySessionToken(token: string): { userId: string } | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;

  const expected = Buffer.from(signPayload(payload), "base64url");
  const received = Buffer.from(signature, "base64url");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      userId?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

function getCookie(req: Request, name: string): string | undefined {
  const prefix = `${name}=`;
  return req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookie(res: Response, userId: string): void {
  res.cookie(SESSION_COOKIE, createSessionToken(userId), {
    ...cookieOptions(),
    maxAge: SESSION_LIFETIME_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getCookie(req, SESSION_COOKIE);
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    res.status(401).json({ error: "Требуется войти в аккаунт." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Сессия недействительна. Войдите снова." });
    return;
  }

  req.authUser = user;
  next();
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getCookie(req, SESSION_COOKIE);
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    next();
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);

  if (user) req.authUser = user;
  else clearSessionCookie(res);
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (
    req.authUser?.role !== "admin" &&
    req.authUser?.role !== "owner"
  ) {
    res.status(403).json({ error: "Недостаточно прав для этого действия." });
    return;
  }
  next();
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    city: user.city,
    address: user.address,
    role: user.role,
    createdAt: user.createdAt,
  };
}
