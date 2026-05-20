/**
 * Per-type content schemas for GDevelop built-in object types.
 *
 * GDevelop project.json stores built-in object fields at the root of the
 * object record (not under `content`), so each schema is a `.passthrough()`
 * shape that the validator applies to the object directly. We declare
 * the *required* fields plus the most common optional ones — extra fields
 * are tolerated to remain forward-compatible.
 *
 * If a type isn't registered here, the validator skips per-content
 * checking for that object (and the catalog still emits the generic
 * "unknown_object_type" warning when appropriate).
 */
import { z } from "zod";

const SpriteAnimationSchema = z
  .object({
    name: z.string(),
    useMultipleDirections: z.boolean().optional(),
    directions: z.array(z.unknown()).optional(),
  })
  .passthrough();

const SpriteSchema = z
  .object({
    animations: z.array(SpriteAnimationSchema),
    adaptCollisionMaskAutomatically: z.boolean().optional(),
    updateIfNotVisible: z.boolean().optional(),
  })
  .passthrough();

const TextSchema = z
  .object({
    text: z.string(),
    characterSize: z.number().optional(),
    font: z.string().optional(),
    color: z.string().optional(),
    italic: z.boolean().optional(),
    bold: z.boolean().optional(),
    underlined: z.boolean().optional(),
    textAlignment: z.string().optional(),
  })
  .passthrough();

const TiledSpriteSchema = z
  .object({
    texture: z.string(),
    width: z.number(),
    height: z.number(),
  })
  .passthrough();

const PanelSpriteSchema = z
  .object({
    texture: z.string(),
    width: z.number(),
    height: z.number(),
    leftMargin: z.number(),
    topMargin: z.number(),
    rightMargin: z.number(),
    bottomMargin: z.number(),
    tiled: z.boolean().optional(),
  })
  .passthrough();

const ShapePainterSchema = z
  .object({
    fillColor: z.string(),
    outlineColor: z.string(),
    fillOpacity: z.number(),
    outlineOpacity: z.number(),
    outlineSize: z.number(),
    absoluteCoordinates: z.boolean().optional(),
    clearBetweenFrames: z.boolean().optional(),
    antialiasing: z.string().optional(),
  })
  .passthrough();

const BBTextSchema = z
  .object({
    text: z.string(),
    fontSize: z.number().optional(),
    fontResourceName: z.string().optional(),
    color: z.string().optional(),
    opacity: z.number().optional(),
    wordWrap: z.boolean().optional(),
    align: z.string().optional(),
    visible: z.boolean().optional(),
  })
  .passthrough();

const TileMapSchema = z
  .object({
    tilemapJsonFile: z.string(),
    tilesetJsonFile: z.string().optional(),
    displayMode: z.string().optional(),
    layerIndex: z.number().optional(),
    animationSpeedScale: z.number().optional(),
    animationFps: z.number().optional(),
  })
  .passthrough();

const TextEntrySchema = z.object({}).passthrough();

const VideoSchema = z
  .object({
    videoResource: z.string().optional(),
    opacity: z.number().optional(),
    looped: z.boolean().optional(),
    volume: z.number().optional(),
  })
  .passthrough();

export const CONTENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  Sprite: SpriteSchema,
  "TextObject::Text": TextSchema,
  "TextEntryObject::TextEntry": TextEntrySchema,
  "TiledSpriteObject::TiledSprite": TiledSpriteSchema,
  "PanelSpriteObject::PanelSprite": PanelSpriteSchema,
  "PrimitiveDrawing::Drawer": ShapePainterSchema,
  "BBText::BBText": BBTextSchema,
  "TileMap::TileMap": TileMapSchema,
  "Video::VideoObject": VideoSchema,
};

export function hasContentSchema(type: string): boolean {
  return type in CONTENT_SCHEMAS;
}

export function validateObjectContent(
  type: string,
  obj: Record<string, unknown>,
): { ok: true } | { ok: false; missing: string[]; messages: string[] } {
  const schema = CONTENT_SCHEMAS[type];
  if (!schema) return { ok: true };
  // Built-in objects store fields at the root of the object record.
  // Try root first; if that fails AND a `content` sub-object exists,
  // try that (forward-compat with newer events-based formats).
  const rootResult = schema.safeParse(obj);
  if (rootResult.success) return { ok: true };
  if (obj.content && typeof obj.content === "object") {
    const nestedResult = schema.safeParse(obj.content);
    if (nestedResult.success) return { ok: true };
  }
  const result = rootResult;
  const missing: string[] = [];
  const messages: string[] = [];
  for (const issue of result.error.issues) {
    if (issue.code === "invalid_type" && issue.path.length > 0) {
      missing.push(String(issue.path[0]));
    }
    messages.push(`${issue.path.join(".") || "<root>"}: ${issue.message}`);
  }
  return { ok: false, missing, messages };
}
