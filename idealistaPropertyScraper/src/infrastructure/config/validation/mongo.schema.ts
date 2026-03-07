import { z } from 'zod';

export const SecretsMongoSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  database: z.string().optional(),
  authSource: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional()
}).strict();
