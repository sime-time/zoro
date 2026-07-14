import { z } from "zod";
import { getMeals } from "../../db/queries/meals";

export const viewMealSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      "Start date for the meal log lookup, inclusive, in YYYY-MM-DD format.",
    ),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe(
      "End date for the meal log lookup, inclusive, in YYYY-MM-DD format.",
    ),
});

export async function viewMeals({
  userId,
  from,
  to,
}: {
  userId: string;
  from: string;
  to: string;
}) {
  const meals = await getMeals({
    userId,
    from,
    to,
  });

  const totals = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein_g: acc.protein_g + meal.protein_g,
      carbs_g: acc.carbs_g + meal.carbs_g,
      fat_g: acc.fat_g + meal.fat_g,
    }),
    {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    },
  );

  return {
    success: true,
    dateRange: { from, to },
    totals,
    mealCount: meals.length,
    meals: meals.map((meal) => ({
      logDate: meal.log_date,
      description: meal.description,
      calories: meal.calories,
      protein_g: meal.protein_g,
      carbs_g: meal.carbs_g,
      fat_g: meal.fat_g,
    })),
  };
}
