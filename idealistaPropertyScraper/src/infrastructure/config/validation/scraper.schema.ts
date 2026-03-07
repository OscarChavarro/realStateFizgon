import { z } from 'zod';

export const EnvironmentApiSchema = z.object({
  httpPort: z.number().int().positive().optional()
}).strict();

export const EnvironmentImagesSchema = z.object({
  downloadFolder: z.string().min(1).optional()
}).strict();

export const EnvironmentMainPageTimeoutSchema = z.object({
  expressiontimeout: z.number().int().nonnegative(),
  expressionpollinterval: z.number().int().nonnegative(),
  firstloaddeviceverificationwaitms: z.number().int().nonnegative().optional(),
  searchclickwaitms: z.number().int().nonnegative().optional()
}).strict();

export const EnvironmentFilterTimeoutSchema = z.object({
  stateclickwait: z.number().int().nonnegative(),
  listingloadingtimeout: z.number().int().nonnegative(),
  listingloadingpollinterval: z.number().int().nonnegative()
}).strict();

export const EnvironmentPaginationTimeoutSchema = z.object({
  clickwait: z.number().int().nonnegative()
}).strict();

export const EnvironmentPropertyDetailPageTimeoutSchema = z.object({
  scrollintervalms: z.number().int().nonnegative().optional(),
  scrollevents: z.number().int().nonnegative().optional(),
  imagesloadwaitms: z.number().int().nonnegative().optional(),
  morephotosclickwaitms: z.number().int().nonnegative().optional(),
  premediaexpansionwaitms: z.number().int().nonnegative().optional(),
  cookieapprovaldialogwaitms: z.number().int().nonnegative().optional(),
  cookieaprovaldialogwaitms: z.number().int().nonnegative().optional()
}).strict();

export const EnvironmentScraperSchema = z.object({
  home: z.object({
    url: z.string().url('scraper.home.url must be a valid URL.'),
    mainSearchArea: z.string().min(1, 'scraper.home.mainSearchArea is required.')
  }).strict()
}).strict();

export const FilterDefinitionValueSchema = z.object({
  plainOptions: z.array(z.string()).optional(),
  minOptions: z.array(z.string()).optional(),
  maxOptions: z.array(z.string()).optional(),
  selectedPlainOptions: z.array(z.string()).optional(),
  selectedMin: z.union([z.string(), z.null()]).optional(),
  selectedMax: z.union([z.string(), z.null()]).optional()
}).strict();

export const FilterDefinitionEntrySchema = z.record(z.string(), FilterDefinitionValueSchema).refine(
  (entry) => Object.keys(entry).length === 1,
  { message: 'Each filters.definitions entry must contain exactly one key.' }
);

export const EnvironmentFiltersSchema = z.object({
  definitions: z.array(FilterDefinitionEntrySchema).optional()
}).strict();

export type EnvironmentFilterDefinitionValue = z.infer<typeof FilterDefinitionValueSchema>;
