import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { compare, hash } from "bcrypt";
import { db, users } from "../db/index.ts";
import { eq } from "drizzle-orm";
import { authMiddleware, createToken } from "../middleware/auth.ts";

const authRoutes = new Hono();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Registration is disabled by default. Set ALLOW_REGISTRATION=true to enable.
const allowRegistration = Deno.env.get("ALLOW_REGISTRATION") === "true";

authRoutes.post("/register", async (c) => {
  // Check if registration is allowed
  if (!allowRegistration) {
    return c.json({ 
      message: "Registration is disabled. Contact the administrator." 
    }, 403);
  }

  try {
    const body = await c.req.json();
    const { email, password } = authSchema.parse(body);

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return c.json({ message: "Email already registered" }, 400);
    }

    // Hash password and create user
    const passwordHash = await hash(password);
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      });

    // Create token
    const token = await createToken(newUser.id);

    // Set cookie
    setCookie(c, "auth_token", token, {
      httpOnly: true,
      secure: false, // Set to true in production
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return c.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Register error:", error);
    return c.json({ message: "Registration failed" }, 500);
  }
});

// Check if registration is enabled (for frontend)
authRoutes.get("/registration-status", (c) => {
  return c.json({ registrationEnabled: allowRegistration });
});

authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = authSchema.parse(body);

    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      return c.json({ message: "Invalid credentials" }, 401);
    }

    // Verify password
    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return c.json({ message: "Invalid credentials" }, 401);
    }

    // Create token
    const token = await createToken(user.id);

    // Set cookie
    setCookie(c, "auth_token", token, {
      httpOnly: true,
      secure: false, // Set to true in production
      sameSite: "Lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Login error:", error);
    return c.json({ message: "Login failed" }, 500);
  }
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, "auth_token", { path: "/" });
  return c.json({ message: "Logged out" });
});

authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");

  const fullUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
  });

  if (!fullUser) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json({
    id: fullUser.id,
    email: fullUser.email,
    createdAt: fullUser.createdAt,
  });
});

export { authRoutes };
