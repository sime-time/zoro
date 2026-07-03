import { z } from "zod";
import { createMeal } from "../../db/queries/meals";

export const logMealSchema = z.object({
  logDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      "The user's local calendar date for the meal, in YYYY-MM-DD format. For 'today' or 'yesterday', resolve using the user's timezone.",
    ),
  description: z
    .string()
    .describe(
      "Short description of the meal, like 'chicken burrito bowl with rice, beans, salsa, and guac'.",
    ),
  calories: z
    .number()
    .int()
    .nonnegative()
    .describe("Estimated total calories for the meal, in kcal."),
  proteinG: z
    .number()
    .nonnegative()
    .describe("Estimated total protein for the meal, in grams."),
  carbsG: z
    .number()
    .nonnegative()
    .describe("Estimated total carbohydrates for the meal, in grams."),
  fatG: z
    .number()
    .nonnegative()
    .describe("Estimated total fat for the meal, in grams."),
});

type LogMealInput = z.infer<typeof logMealSchema>;

export async function logMeal(userId: string, input: LogMealInput) {
  if (input.description.trim() === "") {
    return {
      success: false,
      code: "invalid_meal",
      message: "Meal description is required",
    };
  }

  const meal = await createMeal({
    userId,
    logDate: input.logDate,
    description: input.description,
    calories: input.calories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
  });

  return { success: true, meal };
}
