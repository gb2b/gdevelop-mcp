/**
 * Static catalog of GDevelop object types with their internal JSON identifiers
 * and known content properties. Maintained from the GDJS source.
 */

export type ObjectTypeInfo = {
  type: string;
  displayName: string;
  category: string;
  description: string;
  extension: string;
  contentExample?: Record<string, unknown>;
};

export const OBJECT_TYPES: ObjectTypeInfo[] = [
  {
    type: "Sprite",
    displayName: "Sprite",
    category: "general",
    description: "Animated object for most 2D game elements.",
    extension: "Sprite",
    contentExample: {
      adaptCollisionMaskAutomatically: true,
      animations: [],
      updateIfNotVisible: false,
    },
  },
  {
    type: "TextObject::Text",
    displayName: "Texte",
    category: "text",
    description: "Display text on screen.",
    extension: "TextObject",
    contentExample: {
      content: {
        bold: false,
        italic: false,
        smoothed: true,
        underlined: false,
        text: "Hello",
        font: "",
        characterSize: 30,
        color: "0;0;0",
        textAlignment: "left",
        verticalTextAlignment: "top",
        isOutlineEnabled: false,
        outlineThickness: 2,
        outlineColor: "255;255;255",
        isShadowEnabled: false,
        shadowColor: "0;0;0",
        shadowOpacity: 127,
        shadowDistance: 4,
        shadowAngle: 90,
        shadowBlurRadius: 2,
      },
    },
  },
  {
    type: "TiledSpriteObject::TiledSprite",
    displayName: "Mosaïque",
    category: "general",
    description: "Display a tiled image over a zone.",
    extension: "TiledSpriteObject",
  },
  {
    type: "PanelSpriteObject::PanelSprite",
    displayName: "Sprite panneau (9-patch)",
    category: "general",
    description: "Image with separately stretched borders and corners.",
    extension: "PanelSpriteObject",
  },
  {
    type: "Scene3D::Cube3DObject",
    displayName: "Boîte 3D",
    category: "general",
    description: "A 3D box with images on each face.",
    extension: "3D",
  },
  {
    type: "Scene3D::Model3DObject",
    displayName: "Modèle 3D",
    category: "general",
    description: "Animated 3D model.",
    extension: "3D",
  },
  {
    type: "TileMap::SimpleTileMap",
    displayName: "Tile map",
    category: "general",
    description: "Grid-based map made of reusable tiles.",
    extension: "TileMap",
  },
  {
    type: "BBText::BBText",
    displayName: "BBText",
    category: "text",
    description: "Rich text with BBCode formatting.",
    extension: "BBText",
  },
  {
    type: "BitmapText::BitmapTextObject",
    displayName: "Texte bitmap",
    category: "text",
    description: "Text based on a bitmap font.",
    extension: "BitmapText",
  },
  {
    type: "TextInput::TextInputObject",
    displayName: "Capture de la saisie",
    category: "ui",
    description: "Text field where player can type.",
    extension: "TextInput",
  },
  {
    type: "Video::VideoObject",
    displayName: "Vidéo",
    category: "ui",
    description: "Display a video.",
    extension: "Video",
  },
  {
    type: "ParticleSystem::ParticleEmitter",
    displayName: "Système de particules",
    category: "vfx",
    description: "Emit particles for effects.",
    extension: "ParticleSystem",
  },
  {
    type: "PrimitiveDrawing::Drawer",
    displayName: "Shape painter",
    category: "general",
    description: "Draw primitive shapes (lines, circles, rectangles).",
    extension: "PrimitiveDrawing",
  },
  {
    type: "Spine::SpineObject",
    displayName: "Spine",
    category: "general",
    description: "Animated Spine skeletal animation object.",
    extension: "Spine",
  },
];

export type BehaviorTypeInfo = {
  type: string;
  displayName: string;
  description: string;
  extension: string;
  appliesTo: string[];
};

export const BEHAVIOR_TYPES: BehaviorTypeInfo[] = [
  {
    type: "PlatformBehavior::PlatformerObjectBehavior",
    displayName: "Platformer character",
    description: "Move an object as a platformer character with gravity and jumps.",
    extension: "PlatformBehavior",
    appliesTo: ["Sprite", "Scene3D::Cube3DObject", "Scene3D::Model3DObject"],
  },
  {
    type: "PlatformBehavior::PlatformBehavior",
    displayName: "Platform",
    description: "Make an object behave as a platform for platformer characters.",
    extension: "PlatformBehavior",
    appliesTo: ["Sprite", "TiledSpriteObject::TiledSprite", "PanelSpriteObject::PanelSprite"],
  },
  {
    type: "TopDownMovementBehavior::TopDownMovementBehavior",
    displayName: "Top-down movement",
    description: "Move an object in 4 or 8 directions (top-down).",
    extension: "TopDownMovementBehavior",
    appliesTo: ["Sprite"],
  },
  {
    type: "Physics2::Physics2Behavior",
    displayName: "Physics 2.0",
    description: "Realistic physics simulation (Box2D).",
    extension: "Physics2Behavior",
    appliesTo: ["*"],
  },
  {
    type: "Physics3D::Physics3DBehavior",
    displayName: "Physics 3D",
    description: "3D physics simulation.",
    extension: "Physics3DBehavior",
    appliesTo: ["Scene3D::Cube3DObject", "Scene3D::Model3DObject"],
  },
  {
    type: "Tween::TweenBehavior",
    displayName: "Tween",
    description: "Animate object properties over time with easing.",
    extension: "TweenBehavior",
    appliesTo: ["*"],
  },
  {
    type: "AnchorBehavior::AnchorBehavior",
    displayName: "Anchor",
    description: "Anchor an object to a window edge or position.",
    extension: "AnchorBehavior",
    appliesTo: ["*"],
  },
  {
    type: "DraggableBehavior::Draggable",
    displayName: "Draggable",
    description: "Make an object draggable with mouse/touch.",
    extension: "DraggableBehavior",
    appliesTo: ["*"],
  },
  {
    type: "DestroyOutsideBehavior::DestroyOutside",
    displayName: "Destroy outside screen",
    description: "Destroy object when it leaves the screen.",
    extension: "DestroyOutsideBehavior",
    appliesTo: ["*"],
  },
  {
    type: "PathfindingBehavior::PathfindingBehavior",
    displayName: "Pathfinding",
    description: "Find path through obstacles.",
    extension: "PathfindingBehavior",
    appliesTo: ["*"],
  },
  {
    type: "PathfindingBehavior::PathfindingObstacleBehavior",
    displayName: "Pathfinding obstacle",
    description: "Make object an obstacle for pathfinding.",
    extension: "PathfindingBehavior",
    appliesTo: ["*"],
  },
  {
    type: "Lighting::LightObstacle",
    displayName: "Light obstacle",
    description: "Object blocks light from light objects.",
    extension: "Lighting",
    appliesTo: ["*"],
  },
];

export function findObjectType(type: string): ObjectTypeInfo | undefined {
  return OBJECT_TYPES.find((o) => o.type === type);
}

export function findBehaviorType(type: string): BehaviorTypeInfo | undefined {
  return BEHAVIOR_TYPES.find((b) => b.type === type);
}
