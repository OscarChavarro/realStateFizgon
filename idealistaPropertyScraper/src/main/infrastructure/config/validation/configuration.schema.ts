import { z } from 'zod';
import {
  EnvironmentChromeSchema,
  EnvironmentChromeTimeoutSchema,
  SecretsChromeSchema,
  SecretsGeolocationSchema,
  SecretsProxySchema
} from 'infrastructure/config/validation/chrome.schema';
import { SecretsMongoSchema } from 'infrastructure/config/validation/mongo.schema';
import { EnvironmentRabbitSchema, SecretsRabbitSchema } from 'infrastructure/config/validation/rabbit.schema';
import {
  EnvironmentApiSchema,
  EnvironmentFilterTimeoutSchema,
  EnvironmentFiltersSchema,
  EnvironmentImagesSchema,
  EnvironmentMainPageTimeoutSchema,
  EnvironmentPaginationTimeoutSchema,
  EnvironmentPropertyDetailPageTimeoutSchema,
  EnvironmentSchedulerSchema,
  EnvironmentScraperSchema,
  SecretsEndpointsSchema
} from 'infrastructure/config/validation/scraper.schema';

const EnvironmentTimeoutsSchema = z.object({
  chrome: EnvironmentChromeTimeoutSchema,
  mainpage: EnvironmentMainPageTimeoutSchema,
  filter: EnvironmentFilterTimeoutSchema,
  pagination: EnvironmentPaginationTimeoutSchema,
  propertydetailpage: EnvironmentPropertyDetailPageTimeoutSchema.optional()
}).strict();

export const EnvironmentSchema = z.object({
  initialState: z.string().optional(),
  api: EnvironmentApiSchema.optional(),
  chrome: EnvironmentChromeSchema,
  rabbitmq: EnvironmentRabbitSchema,
  images: EnvironmentImagesSchema.optional(),
  timeouts: EnvironmentTimeoutsSchema,
  scheduler: EnvironmentSchedulerSchema.optional(),
  scraper: EnvironmentScraperSchema,
  filters: EnvironmentFiltersSchema.optional()
}).strict();

export const SecretsSchema = z.object({
  rabbitmq: SecretsRabbitSchema.optional(),
  mongodb: SecretsMongoSchema.optional(),
  proxy: SecretsProxySchema.optional(),
  chrome: SecretsChromeSchema.optional(),
  geolocation: SecretsGeolocationSchema.optional(),
  endpoints: SecretsEndpointsSchema
}).passthrough();

export type Environment = z.infer<typeof EnvironmentSchema>;
export type Secrets = z.infer<typeof SecretsSchema>;
