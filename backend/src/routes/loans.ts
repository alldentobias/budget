import { Hono } from "hono";
import { z } from "zod";
import { db, loans } from "../db/index.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const loansRoutes = new Hono();
loansRoutes.use("*", authMiddleware);

const loanSchema = z.object({
  name: z.string().min(1).max(255),
  principal: z.number().positive(),
  currentBalance: z.number().min(0),
  interestRate: z.number().min(0).max(100),
  ownershipPct: z.number().min(0).max(100).default(100),
  notes: z.string().optional().nullable(),
});

// Get all loans for the current user
loansRoutes.get("/", async (c) => {
  const user = c.get("user");
  
  const userLoans = await db.query.loans.findMany({
    where: eq(loans.userId, user.id),
    orderBy: (loans, { desc }) => [desc(loans.createdAt)],
  });

  return c.json(userLoans.map((loan) => ({
    ...loan,
    principal: parseFloat(loan.principal),
    currentBalance: parseFloat(loan.currentBalance),
    interestRate: parseFloat(loan.interestRate),
    ownershipPct: parseFloat(loan.ownershipPct),
  })));
});

// Create a new loan
loansRoutes.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = loanSchema.parse(body);

    const [newLoan] = await db
      .insert(loans)
      .values({
        userId: user.id,
        name: data.name,
        principal: data.principal.toString(),
        currentBalance: data.currentBalance.toString(),
        interestRate: data.interestRate.toString(),
        ownershipPct: data.ownershipPct.toString(),
        notes: data.notes || null,
      })
      .returning();

    return c.json({
      ...newLoan,
      principal: parseFloat(newLoan.principal),
      currentBalance: parseFloat(newLoan.currentBalance),
      interestRate: parseFloat(newLoan.interestRate),
      ownershipPct: parseFloat(newLoan.ownershipPct),
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Create loan error:", error);
    return c.json({ message: "Failed to create loan" }, 500);
  }
});

// Update a loan
loansRoutes.put("/:id", async (c) => {
  try {
    const user = c.get("user");
    const loanId = c.req.param("id");
    const body = await c.req.json();
    const data = loanSchema.partial().parse(body);

    const [updated] = await db
      .update(loans)
      .set({
        name: data.name,
        principal: data.principal?.toString(),
        currentBalance: data.currentBalance?.toString(),
        interestRate: data.interestRate?.toString(),
        ownershipPct: data.ownershipPct?.toString(),
        notes: data.notes,
      })
      .where(and(eq(loans.id, loanId), eq(loans.userId, user.id)))
      .returning();

    if (!updated) {
      return c.json({ message: "Loan not found" }, 404);
    }

    return c.json({
      ...updated,
      principal: parseFloat(updated.principal),
      currentBalance: parseFloat(updated.currentBalance),
      interestRate: parseFloat(updated.interestRate),
      ownershipPct: parseFloat(updated.ownershipPct),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: "Invalid input", errors: error.errors }, 400);
    }
    console.error("Update loan error:", error);
    return c.json({ message: "Failed to update loan" }, 500);
  }
});

// Delete a loan
loansRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const loanId = c.req.param("id");

  const deleted = await db
    .delete(loans)
    .where(and(eq(loans.id, loanId), eq(loans.userId, user.id)))
    .returning();

  if (deleted.length === 0) {
    return c.json({ message: "Loan not found" }, 404);
  }

  return c.body(null, 204);
});

export { loansRoutes };


