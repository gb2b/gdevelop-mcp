export function minimalValidProject(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    firstLayout: "MainScene",
    gdVersion: { major: 5, minor: 6, build: 268, revision: 0 },
    properties: {
      name: "test-project",
      version: "1.0.0",
      windowWidth: 1280,
      windowHeight: 720,
      projectUuid: "00000000-0000-0000-0000-000000000000",
      platforms: [{ name: "GDevelop JS platform" }],
      currentPlatform: "GDevelop JS platform",
    },
    resources: { resources: [] },
    objects: [],
    layouts: [
      {
        name: "MainScene",
        objects: [],
        instances: [],
        layers: [{ name: "", visibility: true }],
        events: [],
      },
    ],
    externalEvents: [],
    eventsFunctionsExtensions: [],
    externalLayouts: [],
    ...overrides,
  };
}
