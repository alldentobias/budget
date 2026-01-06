import { Hono } from "hono";
import { z } from "zod";
import { db, categories } from "../db/index.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const categoriesRoutes = new Hono();
categoriesRoutes.use("*", authMiddleware);

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

// Get all categories for the current user
categoriesRoutes.get("/", async (c) => {
  const user = c.get("user");
  
  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
    orderBy: (categories, { asc }) => [asc(categories.name)],
  });

  return c.json(userCategories);
});

// Create a new category
categoriesRoutes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = categorySchema.parse(body);

    const [newCategory] = await db
      .insert(categories)
      .values({
        userId: user.id,
        name: data.name,
        color: data.color,
        isDefault: false,
      })
      .returning();

    return c.json(newCategory, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Create category error:", error);
    return c.json({ message: "Failed to create category" }, 500);
  }
});

// Update a category
categoriesRoutes.put("/:id", async (c) => {
  try {
    const user = c.get("user");
    const categoryId = c.req.param("id");
    const body = await c.req.json();
    const data = categorySchema.partial().parse(body);

    const [updated] = await db
      .update(categories)
      .set(data)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)))
      .returning();

    if (!updated) {
      return c.json({ message: "Category not found" }, 404);
    }

    return c.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Update category error:", error);
    return c.json({ message: "Failed to update category" }, 500);
  }
});

// Delete a category
categoriesRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const categoryId = c.req.param("id");

  // Check if it's a default category
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.userId, user.id)),
  });

  if (!category) {
    return c.json({ message: "Category not found" }, 404);
  }

  if (category.isDefault) {
    return c.json({ message: "Cannot delete default categories" }, 400);
  }

  await db
    .delete(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, user.id)));

  return c.body(null, 204);
});

export { categoriesRoutes };


