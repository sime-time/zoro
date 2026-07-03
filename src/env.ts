import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string(),
  BLOOIO_API_KEY: z.string(),
  BLOOIO_BASE_URL: z.string(),
  BLOOIO_WEBHOOK_SECRET: z.string(),
  OPENAI_API_KEY: z.string(),
});

export type EnvSchema = z.infer<typeof EnvSchema>;

export default EnvSchema.parse(process.env);
