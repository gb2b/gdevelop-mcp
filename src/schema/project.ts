import { z } from "zod";

const GdVersionSchema = z.object({
  major: z.number().int(),
  minor: z.number().int(),
  build: z.number().int(),
  revision: z.number().int(),
});

const PropertiesSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    windowWidth: z.number(),
    windowHeight: z.number(),
    projectUuid: z.string(),
    platforms: z.array(z.object({ name: z.string() })),
    currentPlatform: z.string(),
  })
  .passthrough();

const ObjectSchema = z
  .object({
    name: z.string(),
    type: z.string(),
  })
  .passthrough();

const InstanceSchema = z
  .object({
    name: z.string(),
    x: z.number(),
    y: z.number(),
  })
  .passthrough();

const LayerSchema = z
  .object({
    name: z.string(),
    visibility: z.boolean(),
  })
  .passthrough();

const LayoutSchema = z
  .object({
    name: z.string(),
    objects: z.array(ObjectSchema),
    instances: z.array(InstanceSchema),
    layers: z.array(LayerSchema),
    events: z.array(z.unknown()),
  })
  .passthrough();

export const ProjectSchema = z
  .object({
    firstLayout: z.string(),
    gdVersion: GdVersionSchema,
    properties: PropertiesSchema,
    resources: z.object({ resources: z.array(z.unknown()) }).passthrough(),
    objects: z.array(ObjectSchema),
    layouts: z.array(LayoutSchema),
    externalEvents: z.array(z.unknown()),
    eventsFunctionsExtensions: z.array(z.unknown()),
    externalLayouts: z.array(z.unknown()),
  })
  .passthrough();

export type Project = z.infer<typeof ProjectSchema>;
