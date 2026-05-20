import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { validateProjectPath } from "./path-safety.js";

export type ProjectGenre = "blank" | "platformer" | "topdown" | "shmup";

export type QuickStartOptions = {
  targetPath: string;
  name: string;
  genre: ProjectGenre;
  windowWidth?: number;
  windowHeight?: number;
  /** If false (default), refuse to overwrite an existing file. */
  overwrite?: boolean;
};

export type QuickStartResult = {
  targetPath: string;
  name: string;
  genre: ProjectGenre;
  scene: string;
  objects: string[];
  bytesWritten: number;
};

function defaultLayer(): Record<string, unknown> {
  return {
    ambientLightColorB: 32,
    ambientLightColorG: 32,
    ambientLightColorR: 32,
    camera3DFarPlaneDistance: 10000,
    camera3DFieldOfView: 45,
    camera3DNearPlaneDistance: 0.1,
    followBaseLayerCamera: false,
    isLightingLayer: false,
    isLocked: false,
    name: "",
    renderingType: "",
    visibility: true,
    cameras: [
      {
        defaultSize: true,
        defaultViewport: true,
        height: 0,
        viewportBottom: 1,
        viewportLeft: 0,
        viewportRight: 1,
        viewportTop: 0,
        width: 0,
      },
    ],
    effects: [],
  };
}

function emptyLayout(name: string): Record<string, unknown> {
  return {
    b: 209,
    disableInputWhenNotFocused: true,
    mangledName: name,
    name,
    r: 209,
    standardSortMethod: true,
    stopSoundsOnStartup: true,
    title: "",
    v: 209,
    uiSettings: {},
    variables: [],
    instances: [],
    objects: [],
    objectsFolderStructure: { folderName: "__ROOT" },
    events: [],
    layers: [defaultLayer()],
    behaviorsSharedData: [],
    usedResources: [],
  };
}

function spriteObject(
  name: string,
  behaviors: Array<Record<string, unknown>> = [],
): Record<string, unknown> {
  return {
    name,
    type: "Sprite",
    tags: "",
    variables: [],
    behaviors,
    effects: [],
    adaptCollisionMaskAutomatically: true,
    animations: [],
    updateIfNotVisible: false,
  };
}

function instance(
  name: string,
  x: number,
  y: number,
  zOrder = 1,
): Record<string, unknown> {
  return {
    angle: 0,
    customSize: false,
    height: 0,
    layer: "",
    locked: false,
    name,
    persistentUuid: randomUUID(),
    width: 0,
    x,
    y,
    zOrder,
    numberProperties: [],
    stringProperties: [],
    initialVariables: [],
  };
}

function platformerScene(): {
  layout: Record<string, unknown>;
  objectNames: string[];
} {
  const layout = emptyLayout("Level1");
  (layout.objects as unknown[]).push(
    spriteObject("Player", [
      {
        name: "PlatformerObject",
        type: "PlatformBehavior::PlatformerObjectBehavior",
        gravity: 1500,
        jumpSpeed: 600,
        acceleration: 1500,
        deceleration: 1500,
        maxSpeed: 250,
        maxFallingSpeed: 1500,
        canGrabPlatforms: false,
      },
    ]),
    spriteObject("Ground", [
      {
        name: "Platform",
        type: "PlatformBehavior::PlatformBehavior",
        platformType: "Platform",
      },
    ]),
  );
  (layout.instances as unknown[]).push(
    instance("Ground", 0, 600),
    instance("Player", 100, 400, 2),
  );
  return { layout, objectNames: ["Player", "Ground"] };
}

function topdownScene(): {
  layout: Record<string, unknown>;
  objectNames: string[];
} {
  const layout = emptyLayout("MainScene");
  (layout.objects as unknown[]).push(
    spriteObject("Player", [
      {
        name: "TopDownMovement",
        type: "TopDownMovementBehavior::TopDownMovementBehavior",
        acceleration: 400,
        deceleration: 800,
        maxSpeed: 200,
        angularMaxSpeed: 180,
        rotateObject: true,
        angleOffset: 0,
        ignoreDefaultControls: false,
        allowDiagonals: true,
      },
    ]),
  );
  (layout.instances as unknown[]).push(instance("Player", 640, 360));
  return { layout, objectNames: ["Player"] };
}

function shmupScene(): {
  layout: Record<string, unknown>;
  objectNames: string[];
} {
  const layout = emptyLayout("MainScene");
  (layout.objects as unknown[]).push(
    spriteObject("Player"),
    spriteObject("Bullet", [
      {
        name: "DestroyOutside",
        type: "DestroyOutsideBehavior::DestroyOutside",
        extraBorder: 0,
      },
    ]),
  );
  (layout.instances as unknown[]).push(instance("Player", 640, 600));
  return { layout, objectNames: ["Player", "Bullet"] };
}

function blankScene(): {
  layout: Record<string, unknown>;
  objectNames: string[];
} {
  return { layout: emptyLayout("MainScene"), objectNames: [] };
}

export function buildQuickStartProject(
  options: QuickStartOptions,
): Record<string, unknown> {
  const width = options.windowWidth ?? 1280;
  const height = options.windowHeight ?? 720;
  const built =
    options.genre === "platformer"
      ? platformerScene()
      : options.genre === "topdown"
        ? topdownScene()
        : options.genre === "shmup"
          ? shmupScene()
          : blankScene();
  const firstLayout = (built.layout as { name: string }).name;
  return {
    firstLayout,
    gdVersion: { major: 5, minor: 6, build: 268, revision: 0 },
    properties: {
      adaptGameResolutionAtRuntime: true,
      antialiasingMode: "MSAA",
      antialisingEnabledOnMobile: false,
      folderProject: false,
      orientation: "default",
      packageName: "com.example.gamename",
      pixelsRounding: false,
      projectUuid: randomUUID(),
      scaleMode: "linear",
      sizeOnStartupMode: "adaptWidth",
      templateSlug: "",
      version: "1.0.0",
      name: options.name,
      description: "",
      author: "",
      windowWidth: width,
      windowHeight: height,
      latestCompilationDirectory: "",
      maxFPS: 60,
      minFPS: 20,
      verticalSync: false,
      platformSpecificAssets: {},
      loadingScreen: {
        backgroundColor: 0,
        backgroundFadeInDuration: 0.2,
        backgroundImageResourceName: "",
        gdevelopLogoStyle: "light",
        logoAndProgressFadeInDuration: 0.2,
        logoAndProgressLogoFadeInDelay: 0,
        minDuration: 1.5,
        progressBarColor: 16777215,
        progressBarHeight: 20,
        progressBarMaxWidth: 200,
        progressBarMinWidth: 40,
        progressBarWidthPercent: 30,
        showGDevelopSplash: true,
        showProgressBar: true,
      },
      watermark: { placement: "bottom-left", showWatermark: true },
      authorIds: [],
      authorUsernames: [],
      categories: [],
      playableDevices: [],
      extensionProperties: [],
      platforms: [{ name: "GDevelop JS platform" }],
      currentPlatform: "GDevelop JS platform",
    },
    resources: { resources: [] },
    usedResources: [],
    objects: [],
    objectsFolderStructure: { folderName: "__ROOT" },
    objectsGroups: [],
    variables: [],
    layouts: [built.layout],
    externalEvents: [],
    eventsFunctionsExtensions: [],
    externalLayouts: [],
  };
}

export function quickStartTemplate(
  options: QuickStartOptions,
): QuickStartResult {
  const target = validateProjectPath(options.targetPath);
  if (existsSync(target) && !options.overwrite) {
    throw new Error(
      `Refusing to overwrite ${target} (pass overwrite:true to force).`,
    );
  }
  mkdirSync(dirname(target), { recursive: true });
  const project = buildQuickStartProject(options);
  const built =
    options.genre === "platformer"
      ? platformerScene()
      : options.genre === "topdown"
        ? topdownScene()
        : options.genre === "shmup"
          ? shmupScene()
          : blankScene();
  const json = JSON.stringify(project, null, 2);
  writeFileSync(target, json, "utf-8");
  return {
    targetPath: target,
    name: options.name,
    genre: options.genre,
    scene: (built.layout as { name: string }).name,
    objects: built.objectNames,
    bytesWritten: json.length,
  };
}
