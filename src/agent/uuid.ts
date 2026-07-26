import { z } from "zod";

export function optionalUuid(description: string) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.uuid().optional().describe(description),
  );
}
