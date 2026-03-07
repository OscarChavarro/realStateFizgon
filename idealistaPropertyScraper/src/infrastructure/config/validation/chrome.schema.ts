import { z } from 'zod';

export const EnvironmentChromeSchema = z.object({
  binary: z.string().min(1, 'chrome.binary is required.'),
  chromiumOptions: z.array(z.string()).optional()
}).strict();

export const EnvironmentChromeTimeoutSchema = z.object({
  cdpreadytimeout: z.number().int().nonnegative(),
  cdprequesttimeout: z.number().int().nonnegative(),
  cdppollinterval: z.number().int().nonnegative(),
  originerrorreloadwait: z.number().int().nonnegative(),
  expressiontimeout: z.number().int().nonnegative(),
  expressionpollinterval: z.number().int().nonnegative(),
  browserlaunchretrywaitms: z.number().int().nonnegative().optional()
}).strict();

export const SecretsProxySchema = z.object({
  enable: z.boolean().optional(),
  host: z.string().optional(),
  port: z.union([z.string().min(1), z.number().int().positive()]).optional(),
  user: z.string().optional(),
  password: z.string().optional()
}).strict();

export const SecretsChromeSchema = z.object({
  path: z.string().optional(),
  userAgent: z.string().optional(),
  acceptLanguage: z.string().optional(),
  extraHeaders: z.record(z.string(), z.string()).optional()
}).strict();

export const SecretsGeolocationSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().positive().optional(),
  allowlist: z.array(z.string().url()).optional()
}).strict().superRefine((value, context) => {
  const hasLatitude = value.latitude !== undefined;
  const hasLongitude = value.longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'geolocation.latitude and geolocation.longitude must be provided together.'
    });
  }
});
