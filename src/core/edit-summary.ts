/**
 * EditSummary type + emptySummary() + recordOp(). Extracted from
 * edit.ts to respect the 500-line per-file rule.
 */
import type { EditOp } from "./edit.js";

export type EditSummary = {
  layoutsAdded: string[];
  objectsAdded: Array<{
    scope: "scene" | "global";
    scene?: string;
    name: string;
    type: string;
  }>;
  instancesAdded: Array<{
    scene: string;
    objectName: string;
    x: number;
    y: number;
  }>;
  behaviorsAttached: Array<{ objectName: string; type: string; name: string }>;
  eventsAdded: Array<{ scene: string; type: string }>;
  eventsRemoved: number;
  eventsMoved: number;
  extensionsAdded: string[];
  eventsBasedObjectsAdded: Array<{ extension: string; name: string }>;
  eventsBasedBehaviorsAdded: Array<{ extension: string; name: string }>;
  extensionFunctionsAdded: Array<{
    extension: string;
    parent: string;
    parentName?: string;
    name: string;
  }>;
  extensionPropertiesAdded: Array<{
    extension: string;
    parent: string;
    parentName: string;
    name: string;
  }>;
  layoutsRemoved: string[];
  objectsRemoved: Array<{
    scope: "scene" | "global";
    scene?: string;
    name: string;
  }>;
  instancesRemoved: number;
  objectsRenamed: Array<{
    scope: "scene" | "global";
    scene?: string;
    oldName: string;
    newName: string;
  }>;
  propertiesSet: Array<{
    scope: "scene" | "global";
    scene?: string;
    objectName: string;
    path: string;
  }>;
  variablesSet: Array<{ scope: string; name: string }>;
  variablesRemoved: Array<{ scope: string; name: string }>;
  groupsAdded: Array<{
    scope: "scene" | "global";
    scene?: string;
    name: string;
  }>;
  groupsRemoved: Array<{
    scope: "scene" | "global";
    scene?: string;
    name: string;
  }>;
  groupMembersAdded: Array<{
    scope: "scene" | "global";
    scene?: string;
    group: string;
    objectName: string;
  }>;
  resourcesAdded: Array<{ name: string; kind: string; file: string }>;
  externalEventsAdded: string[];
  externalLayoutsAdded: string[];
};

export function emptySummary(): EditSummary {
  return {
    layoutsAdded: [],
    objectsAdded: [],
    instancesAdded: [],
    behaviorsAttached: [],
    eventsAdded: [],
    eventsRemoved: 0,
    eventsMoved: 0,
    extensionsAdded: [],
    eventsBasedObjectsAdded: [],
    eventsBasedBehaviorsAdded: [],
    extensionFunctionsAdded: [],
    extensionPropertiesAdded: [],
    layoutsRemoved: [],
    objectsRemoved: [],
    instancesRemoved: 0,
    objectsRenamed: [],
    propertiesSet: [],
    variablesSet: [],
    variablesRemoved: [],
    groupsAdded: [],
    groupsRemoved: [],
    groupMembersAdded: [],
    resourcesAdded: [],
    externalEventsAdded: [],
    externalLayoutsAdded: [],
  };
}

export function recordOp(summary: EditSummary, op: EditOp): void {
  switch (op.op) {
    case "add_layout":
      summary.layoutsAdded.push(op.name);
      break;
    case "add_object":
      summary.objectsAdded.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        name: op.name,
        type: op.type,
      });
      break;
    case "add_instance":
      summary.instancesAdded.push({
        scene: op.scene,
        objectName: op.objectName,
        x: op.x,
        y: op.y,
      });
      break;
    case "attach_behavior":
      summary.behaviorsAttached.push({
        objectName: op.objectName,
        type: op.type,
        name: op.name ?? op.type.split("::").pop() ?? op.type,
      });
      break;
    case "add_event":
      summary.eventsAdded.push({
        scene: op.scene,
        type: (op.event as { type: string }).type,
      });
      break;
    case "remove_event":
      summary.eventsRemoved++;
      break;
    case "move_event":
      summary.eventsMoved++;
      break;
    case "add_extension":
      summary.extensionsAdded.push(op.name);
      break;
    case "add_events_based_object":
      summary.eventsBasedObjectsAdded.push({
        extension: op.extension,
        name: op.name,
      });
      break;
    case "add_events_based_behavior":
      summary.eventsBasedBehaviorsAdded.push({
        extension: op.extension,
        name: op.name,
      });
      break;
    case "add_extension_function":
      summary.extensionFunctionsAdded.push({
        extension: op.extension,
        parent: op.parent ?? "extension",
        parentName: op.parentName,
        name: op.name,
      });
      break;
    case "add_extension_property":
      summary.extensionPropertiesAdded.push({
        extension: op.extension,
        parent: op.parent,
        parentName: op.parentName,
        name: op.property.name,
      });
      break;
    case "remove_layout":
      summary.layoutsRemoved.push(op.name);
      break;
    case "remove_object":
      summary.objectsRemoved.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        name: op.name,
      });
      break;
    case "remove_instance":
      summary.instancesRemoved++;
      break;
    case "rename_object":
      summary.objectsRenamed.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        oldName: op.oldName,
        newName: op.newName,
      });
      break;
    case "set_object_property":
      summary.propertiesSet.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        objectName: op.objectName,
        path: op.path,
      });
      break;
    case "set_variable":
      summary.variablesSet.push({ scope: op.scope, name: op.name });
      break;
    case "remove_variable":
      summary.variablesRemoved.push({ scope: op.scope, name: op.name });
      break;
    case "add_object_group":
      summary.groupsAdded.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        name: op.name,
      });
      break;
    case "remove_object_group":
      summary.groupsRemoved.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        name: op.name,
      });
      break;
    case "add_object_to_group":
      summary.groupMembersAdded.push({
        scope: op.scope ?? "scene",
        scene: op.scene,
        group: op.group,
        objectName: op.objectName,
      });
      break;
    case "add_resource":
      summary.resourcesAdded.push({
        name: op.name,
        kind: op.kind,
        file: op.file,
      });
      break;
    case "add_external_events":
      summary.externalEventsAdded.push(op.name);
      break;
    case "add_external_layout":
      summary.externalLayoutsAdded.push(op.name);
      break;
  }
}
