import { readFileSync } from "node:fs";

type RawProject = {
  properties: { name: string; version: string };
  gdVersion: { major: number; minor: number; build: number };
  firstLayout: string;
  layouts: Array<{
    name: string;
    objects: Array<{ name: string; type: string; behaviors?: Array<{ name: string; type: string }> }>;
    instances: unknown[];
    events: unknown[];
  }>;
  objects: Array<{ name: string; type: string }>;
  resources: { resources: Array<{ name?: string }> };
};

export type ObjectDiff = {
  name: string;
  before: { type: string; behaviorCount: number };
  after: { type: string; behaviorCount: number };
  changes: string[];
};

export type LayoutDiff = {
  name: string;
  objectsAdded: string[];
  objectsRemoved: string[];
  objectsModified: ObjectDiff[];
  instancesBefore: number;
  instancesAfter: number;
  eventsBefore: number;
  eventsAfter: number;
};

export type ProjectDiff = {
  identical: boolean;
  topLevelChanges: string[];
  layoutsAdded: string[];
  layoutsRemoved: string[];
  layoutsModified: LayoutDiff[];
  globalObjectsAdded: string[];
  globalObjectsRemoved: string[];
  resourcesBefore: number;
  resourcesAfter: number;
};

function compareObjects(
  before: RawProject["layouts"][number]["objects"][number],
  after: RawProject["layouts"][number]["objects"][number],
): ObjectDiff | null {
  const changes: string[] = [];
  if (before.type !== after.type) {
    changes.push(`type: ${before.type} → ${after.type}`);
  }
  const bBeh = (before.behaviors ?? []).map((b) => b.name).sort();
  const aBeh = (after.behaviors ?? []).map((b) => b.name).sort();
  const addedBeh = aBeh.filter((n) => !bBeh.includes(n));
  const removedBeh = bBeh.filter((n) => !aBeh.includes(n));
  if (addedBeh.length) changes.push(`behaviors added: ${addedBeh.join(", ")}`);
  if (removedBeh.length) changes.push(`behaviors removed: ${removedBeh.join(", ")}`);
  if (changes.length === 0) return null;
  return {
    name: before.name,
    before: { type: before.type, behaviorCount: bBeh.length },
    after: { type: after.type, behaviorCount: aBeh.length },
    changes,
  };
}

function compareLayout(
  before: RawProject["layouts"][number],
  after: RawProject["layouts"][number],
): LayoutDiff | null {
  const beforeObjMap = new Map(before.objects.map((o) => [o.name, o]));
  const afterObjMap = new Map(after.objects.map((o) => [o.name, o]));

  const objectsAdded = [...afterObjMap.keys()].filter((n) => !beforeObjMap.has(n));
  const objectsRemoved = [...beforeObjMap.keys()].filter((n) => !afterObjMap.has(n));
  const objectsModified: ObjectDiff[] = [];

  for (const [name, bObj] of beforeObjMap) {
    const aObj = afterObjMap.get(name);
    if (!aObj) continue;
    const diff = compareObjects(bObj, aObj);
    if (diff) objectsModified.push(diff);
  }

  const noChange =
    objectsAdded.length === 0 &&
    objectsRemoved.length === 0 &&
    objectsModified.length === 0 &&
    before.instances.length === after.instances.length &&
    before.events.length === after.events.length;

  if (noChange) return null;

  return {
    name: before.name,
    objectsAdded,
    objectsRemoved,
    objectsModified,
    instancesBefore: before.instances.length,
    instancesAfter: after.instances.length,
    eventsBefore: before.events.length,
    eventsAfter: after.events.length,
  };
}

export function diffProjects(pathA: string, pathB: string): ProjectDiff {
  const before = JSON.parse(readFileSync(pathA, "utf-8")) as RawProject;
  const after = JSON.parse(readFileSync(pathB, "utf-8")) as RawProject;

  const topLevelChanges: string[] = [];
  if (before.properties.name !== after.properties.name) {
    topLevelChanges.push(`name: ${before.properties.name} → ${after.properties.name}`);
  }
  if (before.properties.version !== after.properties.version) {
    topLevelChanges.push(
      `version: ${before.properties.version} → ${after.properties.version}`,
    );
  }
  if (before.firstLayout !== after.firstLayout) {
    topLevelChanges.push(
      `firstLayout: ${before.firstLayout} → ${after.firstLayout}`,
    );
  }

  const beforeLayoutMap = new Map(before.layouts.map((l) => [l.name, l]));
  const afterLayoutMap = new Map(after.layouts.map((l) => [l.name, l]));

  const layoutsAdded = [...afterLayoutMap.keys()].filter(
    (n) => !beforeLayoutMap.has(n),
  );
  const layoutsRemoved = [...beforeLayoutMap.keys()].filter(
    (n) => !afterLayoutMap.has(n),
  );
  const layoutsModified: LayoutDiff[] = [];

  for (const [name, bLayout] of beforeLayoutMap) {
    const aLayout = afterLayoutMap.get(name);
    if (!aLayout) continue;
    const diff = compareLayout(bLayout, aLayout);
    if (diff) layoutsModified.push(diff);
  }

  const beforeGlobal = new Map(before.objects.map((o) => [o.name, o.type]));
  const afterGlobal = new Map(after.objects.map((o) => [o.name, o.type]));
  const globalObjectsAdded = [...afterGlobal.keys()].filter((n) => !beforeGlobal.has(n));
  const globalObjectsRemoved = [...beforeGlobal.keys()].filter(
    (n) => !afterGlobal.has(n),
  );

  const identical =
    topLevelChanges.length === 0 &&
    layoutsAdded.length === 0 &&
    layoutsRemoved.length === 0 &&
    layoutsModified.length === 0 &&
    globalObjectsAdded.length === 0 &&
    globalObjectsRemoved.length === 0 &&
    before.resources.resources.length === after.resources.resources.length;

  return {
    identical,
    topLevelChanges,
    layoutsAdded,
    layoutsRemoved,
    layoutsModified,
    globalObjectsAdded,
    globalObjectsRemoved,
    resourcesBefore: before.resources.resources.length,
    resourcesAfter: after.resources.resources.length,
  };
}
