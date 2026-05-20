import { readFileSync } from "node:fs";
import { validateProjectPath } from "./path-safety.js";

type ProjectShape = {
  firstLayout?: string;
  layouts: Array<{
    name: string;
    objects: Array<{
      name: string;
      type: string;
      behaviors?: Array<{ type: string }>;
    }>;
    instances: unknown[];
    events?: unknown[];
  }>;
  objects: Array<{
    name: string;
    type: string;
    behaviors?: Array<{ type: string }>;
  }>;
  resources: {
    resources: Array<{ name?: string; file?: string; kind?: string }>;
  };
  eventsFunctionsExtensions?: Array<{ name?: string }>;
};

// ============================================================================
// find_in_events — grep across events trees (and instructions inside them)
// ============================================================================

export type FindInEventsHit = {
  scene: string;
  path: number[];
  /**
   * Where in the event the match was found.
   */
  location:
    | "comment"
    | "condition.type"
    | "condition.parameter"
    | "action.type"
    | "action.parameter"
    | "jsCode"
    | "link.target"
    | "group.name";
  text: string;
};

export type FindInEventsResult = {
  scenesScanned: number;
  totalHits: number;
  truncated: boolean;
  hits: FindInEventsHit[];
};

type Instruction = {
  type?: { value?: string };
  parameters?: unknown[];
  subInstructions?: Instruction[];
};

type EventNode = Record<string, unknown> & { type?: string };

function visitInstructions(
  instructions: Instruction[] | undefined,
  kind: "condition" | "action",
  hit: (loc: FindInEventsHit["location"], text: string) => void,
  re: RegExp,
): void {
  if (!Array.isArray(instructions)) return;
  for (const inst of instructions) {
    const typeValue = inst.type?.value ?? "";
    if (re.test(typeValue)) {
      hit(`${kind}.type` as FindInEventsHit["location"], typeValue);
    }
    if (Array.isArray(inst.parameters)) {
      for (const param of inst.parameters) {
        if (typeof param === "string" && re.test(param)) {
          hit(`${kind}.parameter` as FindInEventsHit["location"], param);
        }
      }
    }
    visitInstructions(inst.subInstructions, kind, hit, re);
  }
}

function visitEvents(
  events: unknown[] | undefined,
  parentPath: number[],
  re: RegExp,
  hits: FindInEventsHit[],
  scene: string,
  limit: number,
): boolean {
  if (!Array.isArray(events)) return false;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i] as EventNode;
    const path = [...parentPath, i];
    const addHit = (
      location: FindInEventsHit["location"],
      text: string,
    ): void => {
      if (hits.length >= limit) return;
      hits.push({ scene, path, location, text });
    };

    const type = ev.type ?? "";
    if (
      type === "BuiltinCommonInstructions::Comment" &&
      typeof ev.comment === "string" &&
      re.test(ev.comment)
    ) {
      addHit("comment", ev.comment);
    }
    if (
      type === "BuiltinCommonInstructions::Group" &&
      typeof ev.name === "string" &&
      re.test(ev.name)
    ) {
      addHit("group.name", ev.name as string);
    }
    if (
      type === "BuiltinCommonInstructions::JsCode" &&
      typeof ev.inlineCode === "string" &&
      re.test(ev.inlineCode)
    ) {
      addHit("jsCode", ev.inlineCode);
    }
    if (
      type === "BuiltinCommonInstructions::Link" &&
      typeof ev.target === "string" &&
      re.test(ev.target)
    ) {
      addHit("link.target", ev.target);
    }

    visitInstructions(
      ev.conditions as Instruction[] | undefined,
      "condition",
      addHit,
      re,
    );
    visitInstructions(
      ev.actions as Instruction[] | undefined,
      "action",
      addHit,
      re,
    );

    if (Array.isArray((ev as { events?: unknown[] }).events)) {
      visitEvents(
        (ev as { events?: unknown[] }).events,
        path,
        re,
        hits,
        scene,
        limit,
      );
    }
    if (hits.length >= limit) return true;
  }
  return hits.length >= limit;
}

export function findInEvents(
  projectPath: string,
  options: {
    query: string;
    flags?: string;
    scene?: string;
    maxResults?: number;
  },
): FindInEventsResult {
  const safe = validateProjectPath(projectPath);
  const raw = readFileSync(safe, "utf-8");
  const project = JSON.parse(raw) as ProjectShape;
  let re: RegExp;
  try {
    re = new RegExp(options.query, options.flags ?? "i");
  } catch (err) {
    throw new Error(`Invalid regex: ${(err as Error).message}`);
  }
  const maxResults = options.maxResults ?? 50;
  const scenesToScan = options.scene
    ? project.layouts.filter((l) => l.name === options.scene)
    : project.layouts;
  if (options.scene && scenesToScan.length === 0) {
    throw new Error(`Scene "${options.scene}" not found.`);
  }
  const hits: FindInEventsHit[] = [];
  let truncated = false;
  for (const layout of scenesToScan) {
    truncated = visitEvents(
      layout.events,
      [],
      re,
      hits,
      layout.name,
      maxResults,
    );
    if (truncated) break;
  }
  return {
    scenesScanned: scenesToScan.length,
    totalHits: hits.length,
    truncated,
    hits,
  };
}

// ============================================================================
// list_project_dependencies — inventory of what the project uses
// ============================================================================

export type ProjectDependencies = {
  objectTypes: string[];
  behaviorTypes: string[];
  resourceKinds: string[];
  instructionTypes: {
    actions: string[];
    conditions: string[];
  };
  customExtensions: string[];
  scenes: string[];
  globalObjectsCount: number;
};

function collectInstructionTypes(
  events: unknown[] | undefined,
  actions: Set<string>,
  conditions: Set<string>,
): void {
  if (!Array.isArray(events)) return;
  for (const ev of events) {
    const e = ev as {
      type?: string;
      actions?: Array<{ type?: { value?: string } }>;
      conditions?: Array<{ type?: { value?: string } }>;
      events?: unknown[];
    };
    if (Array.isArray(e.actions)) {
      for (const a of e.actions) {
        if (a.type?.value) actions.add(a.type.value);
      }
    }
    if (Array.isArray(e.conditions)) {
      for (const c of e.conditions) {
        if (c.type?.value) conditions.add(c.type.value);
      }
    }
    collectInstructionTypes(e.events, actions, conditions);
  }
}

export function listProjectDependencies(
  projectPath: string,
): ProjectDependencies {
  const safe = validateProjectPath(projectPath);
  const raw = readFileSync(safe, "utf-8");
  const project = JSON.parse(raw) as ProjectShape;

  const objectTypes = new Set<string>();
  const behaviorTypes = new Set<string>();
  const resourceKinds = new Set<string>();
  const actions = new Set<string>();
  const conditions = new Set<string>();

  for (const obj of project.objects ?? []) {
    objectTypes.add(obj.type);
    for (const b of obj.behaviors ?? []) behaviorTypes.add(b.type);
  }
  for (const layout of project.layouts ?? []) {
    for (const obj of layout.objects ?? []) {
      objectTypes.add(obj.type);
      for (const b of obj.behaviors ?? []) behaviorTypes.add(b.type);
    }
    collectInstructionTypes(layout.events, actions, conditions);
  }
  for (const r of project.resources?.resources ?? []) {
    if (r.kind) resourceKinds.add(r.kind);
  }

  return {
    objectTypes: [...objectTypes].sort(),
    behaviorTypes: [...behaviorTypes].sort(),
    resourceKinds: [...resourceKinds].sort(),
    instructionTypes: {
      actions: [...actions].sort(),
      conditions: [...conditions].sort(),
    },
    customExtensions: (project.eventsFunctionsExtensions ?? [])
      .map((e) => e.name ?? "")
      .filter(Boolean),
    scenes: (project.layouts ?? []).map((l) => l.name),
    globalObjectsCount: (project.objects ?? []).length,
  };
}
