import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verify } from "djwt";
import { db, users } from "../db/index.ts";
import { eq } from "drizzle-orm";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-super-secret-jwt-key";

// Create a crypto key from the secret
async function getKey() {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface AuthUser {
  id: string;
  email: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  try {
    // Try to get token from cookie first, then Authorization header
    let token = getCookie(c, "auth_token");

    if (!token) {
      const authHeader = c.req.header("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      return c.json({ message: "Unauthorized" }, 401);
    }

    const key = await getKey();
    const payload = await verify(token, key);

    if (!payload.sub) {
      return c.json({ message: "Invalid token" }, 401);
    }

    // Fetch user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub as string),
    });

    if (!user) {
      return c.json({ message: "User not found" }, 401);
    }

    c.set("user", { id: user.id, email: user.email });
    await next();
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ message: "Unauthorized" }, 401);
  }
}

export async function createToken(userId: string): Promise<string> {
  const key = await getKey();
  const { create } = await import("djwt");

  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
    },
    key,
  );
}
