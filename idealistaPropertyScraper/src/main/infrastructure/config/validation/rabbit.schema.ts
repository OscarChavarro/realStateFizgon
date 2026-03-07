import { z } from 'zod';

export const EnvironmentRabbitSchema = z.object({
  host: z.string().min(1, 'rabbitmq.host is required.'),
  port: z.number().int().positive('rabbitmq.port must be a positive integer.')
}).strict();

export const SecretsRabbitSchema = z.object({
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  vhost: z.string().optional(),
  queue: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional()
}).strict();
