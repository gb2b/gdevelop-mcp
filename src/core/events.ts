import { z } from "zod";

// ============================================================================
// INSTRUCTIONS (conditions and actions inside events)
// ============================================================================

export type Instruction = {
  type: { value: string; inverted?: boolean };
  parameters: string[];
  subInstructions?: Instruction[];
};

const InstructionTypeSchema = z.object({
  value: z.string(),
  inverted: z.boolean().optional(),
});

export const InstructionSchema: z.ZodType<Instruction> = z.lazy(() =>
  z.object({
    type: InstructionTypeSchema,
    parameters: z.array(z.string()),
    subInstructions: z.array(InstructionSchema).optional(),
  }),
);

// ============================================================================
// EVENTS — discriminated union of all 7 built-in event types
// ============================================================================

export type EventNode = z.infer<typeof EventSchema>;

const _EventSchemaRef: z.ZodType<unknown> = z.lazy(() => EventSchema);

const StandardEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::Standard"),
  conditions: z.array(InstructionSchema).optional(),
  actions: z.array(InstructionSchema).optional(),
  events: z.array(_EventSchemaRef).optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

const CommentEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::Comment"),
  comment: z.string(),
  textR: z.number().int().min(0).max(255).optional(),
  textG: z.number().int().min(0).max(255).optional(),
  textB: z.number().int().min(0).max(255).optional(),
  color: z
    .object({
      r: z.number().int().min(0).max(255),
      g: z.number().int().min(0).max(255),
      b: z.number().int().min(0).max(255),
    })
    .optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

const GroupEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::Group"),
  name: z.string(),
  events: z.array(_EventSchemaRef).optional(),
  color: z
    .object({
      r: z.number().int().min(0).max(255),
      g: z.number().int().min(0).max(255),
      b: z.number().int().min(0).max(255),
    })
    .optional(),
  source: z.string().optional(),
  creationTime: z.number().optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

const ForEachEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::ForEach"),
  objectsToPick: z.string(),
  conditions: z.array(InstructionSchema).optional(),
  actions: z.array(InstructionSchema).optional(),
  events: z.array(_EventSchemaRef).optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

const RepeatEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::Repeat"),
  repeatExpression: z.string(),
  conditions: z.array(InstructionSchema).optional(),
  actions: z.array(InstructionSchema).optional(),
  events: z.array(_EventSchemaRef).optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

const WhileEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::While"),
  whileConditions: z.array(InstructionSchema).optional(),
  conditions: z.array(InstructionSchema).optional(),
  actions: z.array(InstructionSchema).optional(),
  events: z.array(_EventSchemaRef).optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

const LinkEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::Link"),
  target: z.string(),
  include: z
    .object({
      start: z.number().int().optional(),
      end: z.number().int().optional(),
    })
    .optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

const JsCodeEventSchema = z.object({
  type: z.literal("BuiltinCommonInstructions::JsCode"),
  inlineCode: z.string(),
  parameterObjects: z.string().optional(),
  useStrict: z.boolean().optional(),
  eventsSheetExpanded: z.boolean().optional(),
  disabled: z.boolean().optional(),
  folded: z.boolean().optional(),
});

export const EventSchema = z.discriminatedUnion("type", [
  StandardEventSchema,
  CommentEventSchema,
  GroupEventSchema,
  ForEachEventSchema,
  RepeatEventSchema,
  WhileEventSchema,
  LinkEventSchema,
  JsCodeEventSchema,
]);

// Event types that can contain sub-events
const EVENTS_WITH_SUB_EVENTS = new Set([
  "BuiltinCommonInstructions::Standard",
  "BuiltinCommonInstructions::Group",
  "BuiltinCommonInstructions::ForEach",
  "BuiltinCommonInstructions::Repeat",
  "BuiltinCommonInstructions::While",
]);

// ============================================================================
// EVENT OPERATIONS — for inclusion in edit_project
// ============================================================================

export const AddEventOpSchema = z.object({
  op: z.literal("add_event"),
  scene: z.string().describe("Name of the scene to add the event to"),
  parentPath: z
    .array(z.number().int().nonnegative())
    .optional()
    .describe(
      "Array of indices to descend into nested events, e.g. [0, 2] = events[0].events[2]. Empty/undefined = scene root events.",
    ),
  position: z
    .union([z.number().int().nonnegative(), z.enum(["append", "prepend"])])
    .optional()
    .describe(
      "Where to insert (default: 'append'). A number is the index where the event lands.",
    ),
  event: EventSchema,
});

export const RemoveEventOpSchema = z.object({
  op: z.literal("remove_event"),
  scene: z.string(),
  path: z
    .array(z.number().int().nonnegative())
    .min(1)
    .describe(
      "Indices pointing to the event to remove. Last index is the position in its parent's events array.",
    ),
});

export const MoveEventOpSchema = z.object({
  op: z.literal("move_event"),
  scene: z.string(),
  fromPath: z
    .array(z.number().int().nonnegative())
    .min(1)
    .describe("Current location of the event (indices)"),
  toParentPath: z
    .array(z.number().int().nonnegative())
    .optional()
    .describe("Destination parent (omit for scene root)"),
  toPosition: z
    .union([z.number().int().nonnegative(), z.enum(["append", "prepend"])])
    .optional(),
});

export type AddEventOp = z.infer<typeof AddEventOpSchema>;
export type RemoveEventOp = z.infer<typeof RemoveEventOpSchema>;
export type MoveEventOp = z.infer<typeof MoveEventOpSchema>;

// ============================================================================
// APPLY HELPERS
// ============================================================================

type EventWithChildren = { events?: unknown[]; type: string };

function getEventChildren(event: EventWithChildren): unknown[] | undefined {
  if (!EVENTS_WITH_SUB_EVENTS.has(event.type)) return undefined;
  if (!event.events) event.events = [];
  return event.events;
}

function navigateToList(
  rootEvents: unknown[],
  path: number[] | undefined,
): unknown[] {
  if (!path || path.length === 0) return rootEvents;
  let current: unknown[] = rootEvents;
  for (let i = 0; i < path.length; i++) {
    const idx = path[i];
    if (idx >= current.length) {
      throw new Error(
        `Path index ${idx} out of range (current array has ${current.length} items) at depth ${i}`,
      );
    }
    const child = current[idx] as EventWithChildren;
    const children = getEventChildren(child);
    if (!children) {
      throw new Error(
        `Event at path [${path.slice(0, i + 1).join(",")}] has type "${child.type}" which cannot contain sub-events`,
      );
    }
    current = children;
  }
  return current;
}

function navigateToParentAndIndex(
  rootEvents: unknown[],
  path: number[],
): { parent: unknown[]; index: number } {
  if (path.length === 0) {
    throw new Error("Path must contain at least one index");
  }
  const parentPath = path.slice(0, -1);
  const lastIdx = path[path.length - 1];
  const parent = navigateToList(rootEvents, parentPath);
  if (lastIdx >= parent.length) {
    throw new Error(
      `Index ${lastIdx} out of range (parent array has ${parent.length} items)`,
    );
  }
  return { parent, index: lastIdx };
}

function findLayoutEvents(
  project: { layouts: Array<{ name: string; events: unknown[] }> },
  sceneName: string,
): unknown[] {
  const layout = project.layouts.find((l) => l.name === sceneName);
  if (!layout) throw new Error(`Layout "${sceneName}" not found`);
  if (!Array.isArray(layout.events)) layout.events = [];
  return layout.events;
}

export function applyAddEvent(
  project: { layouts: Array<{ name: string; events: unknown[] }> },
  op: AddEventOp,
): void {
  const events = findLayoutEvents(project, op.scene);
  const target = navigateToList(events, op.parentPath);
  const position = op.position ?? "append";
  if (position === "append") {
    target.push(op.event);
  } else if (position === "prepend") {
    target.unshift(op.event);
  } else {
    target.splice(position, 0, op.event);
  }
}

export function applyRemoveEvent(
  project: { layouts: Array<{ name: string; events: unknown[] }> },
  op: RemoveEventOp,
): void {
  const events = findLayoutEvents(project, op.scene);
  const { parent, index } = navigateToParentAndIndex(events, op.path);
  parent.splice(index, 1);
}

export function applyMoveEvent(
  project: { layouts: Array<{ name: string; events: unknown[] }> },
  op: MoveEventOp,
): void {
  const events = findLayoutEvents(project, op.scene);
  const { parent: srcParent, index: srcIndex } = navigateToParentAndIndex(
    events,
    op.fromPath,
  );
  const [eventNode] = srcParent.splice(srcIndex, 1);
  try {
    const dst = navigateToList(events, op.toParentPath);
    const pos = op.toPosition ?? "append";
    if (pos === "append") dst.push(eventNode);
    else if (pos === "prepend") dst.unshift(eventNode);
    else dst.splice(pos, 0, eventNode);
  } catch (err) {
    // restore source position if destination navigation failed
    srcParent.splice(srcIndex, 0, eventNode);
    throw err;
  }
}

// ============================================================================
// READ HELPERS
// ============================================================================

export function summarizeEvents(events: unknown[]): {
  total: number;
  byType: Record<string, number>;
  maxDepth: number;
} {
  const byType: Record<string, number> = {};
  let total = 0;
  let maxDepth = 0;

  function visit(list: unknown[], depth: number): void {
    if (depth > maxDepth) maxDepth = depth;
    for (const e of list) {
      total++;
      const t = (e as { type?: string }).type ?? "?";
      byType[t] = (byType[t] ?? 0) + 1;
      const children = (e as { events?: unknown[] }).events;
      if (Array.isArray(children)) visit(children, depth + 1);
    }
  }

  visit(events, 1);
  return { total, byType, maxDepth };
}
