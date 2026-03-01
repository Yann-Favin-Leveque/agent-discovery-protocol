import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { UserRow } from "./db";

// ─── Constants ──────────────────────────────────────────────────

const COOKIE_NAME = "agentdns_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const REGISTRY_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// ─── Types ──────────────────────────────────────────────────────

export interface SessionPayload extends JWTPayload {
  userId: number;
  email: string;
  provider: string;
}

// ─── JWT helpers ────────────────────────────────────────────────

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: UserRow): Promise<string> {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    provider: user.provider,
  } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .setSubject(String(user.id))
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// Longer-lived token for the gateway MCP
export async function createRegistryToken(user: UserRow): Promise<string> {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    provider: user.provider,
    provider_id: user.provider_id,
    type: "registry_token",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REGISTRY_TOKEN_MAX_AGE}s`)
    .setSubject(String(user.id))
    .sign(getJwtSecret());
}

// ─── Cookie helpers ─────────────────────────────────────────────

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
