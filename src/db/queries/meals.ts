import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../client";
import { meals } from "../schema";

export type Meal = typeof meals.$inferSelect;

export async function createMeal({
  userId,
  logDate,
  description,
  calories,
  proteinG,
  carbsG,
  fatG,
}: {
  userId: string;
  logDate: string; // YYYY-MM-DD
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}): Promise<Meal> {
  if (description.trim() === "") {
    throw new Error("Meal description is required");
  }

  if (calories < 0 || proteinG < 0 || carbsG < 0 || fatG < 0) {
    throw new Error("Meal macros cannot be negative");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate)) {
    throw new Error("Meal log date must be YYYY-MM-DD");
  }

  const [meal] = await db
    .insert(meals)
    .values({
      user_id: userId,
      log_date: logDate,
      description: description.trim(),
      calories: Math.round(calories),
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
    })
    .returning();

  if (!meal) throw new Error("Meal was not saved");

  return meal;
}

export async function getMeals({
  userId,
  from,
  to,
}: {
  userId: string;
  from?: string;
  to?: string;
}): Promise<Meal[]> {
  const filters: SQL[] = [eq(meals.user_id, userId)];

  if (from !== undefined) {
    filters.push(gte(meals.log_date, from));
  }

  if (to !== undefined) {
    filters.push(lte(meals.log_date, to));
  }

  const loggedMeals = await db
    .select()
    .from(meals)
    .where(and(...filters))
    .orderBy(asc(meals.log_date), asc(meals.created_at));

  return loggedMeals;
}
