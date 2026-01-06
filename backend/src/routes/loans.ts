import { Hono } from "hono";
import { z } from "zod";
import { db, loans } from "../db/index.ts";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.ts";

const loansRoutes = new Hono();
loansRoutes.use("*", authMiddleware);

// principal and currentBalance are in minor units (øre/cents) - integers
// interestRate and ownershipPct stay as decimals (percentages)
const loanSchema = z.object({
  name: z.string().min(1).max(255),
  principal: z.number().int().positive(), // Integer in minor units
  currentBalance: z.number().int().min(0), // Integer in minor units
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

  // interestRate and ownershipPct are still decimals stored as strings
  return c.json(userLoans.map((loan) => ({
    ...loan,
    interestRate: parseFloat(loan.interestRate),
    ownershipPct: parseFloat(loan.ownershipPct),
    // principal and currentBalance are bigint, come back as numbers
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
        principal: data.principal,
        currentBalance: data.currentBalance,
        interestRate: data.interestRate.toString(),
        ownershipPct: data.ownershipPct.toString(),
        notes: data.notes || null,
      })
      .returning();

    return c.json({
      ...newLoan,
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
        principal: data.principal,
        currentBalance: data.currentBalance,
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
