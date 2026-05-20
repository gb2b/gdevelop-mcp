import { describe, it, expect } from "vitest";
import { parseExtensionSource } from "../src/core/catalog-parsers.js";

describe("parseExtensionSource — C++", () => {
  it("captures extension.AddAction with i18n strings + parameters", () => {
    const src = `
extension.AddAction("MyAction", _("My action"), _("Does a thing."),
                    _("Do it on _PARAM0_"), _("Group"), "icon.png", "small.png")
    .AddParameter("object", _("Target object"))
    .AddParameter("expression", _("Force"), "", true)
    .SetFunctionName("doIt");
    `;
    const out = parseExtensionSource(src, { language: "cpp" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "MyAction",
      fullName: "My action",
      description: "Does a thing.",
      kind: "action",
      receiver: "extension",
    });
    expect(out[0].parameters).toEqual([
      {
        type: "object",
        description: "Target object",
        extraInfo: undefined,
        optional: false,
      },
      {
        type: "expression",
        description: "Force",
        extraInfo: "",
        optional: true,
      },
    ]);
  });

  it("distinguishes object/behavior receivers", () => {
    const src = `
obj.AddAction("Resize", _("Resize"), _("Resize the object."),
              _("the size of _PARAM0_"), _(""), "", "");
behaviorObj.AddCondition("IsMoving", _("Is moving"), _("Whether the obj moves."),
                          _(""), _(""), "", "");
    `;
    const out = parseExtensionSource(src, { language: "cpp" });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      type: "Resize",
      kind: "action",
      receiver: "obj",
    });
    expect(out[1]).toMatchObject({
      type: "IsMoving",
      kind: "condition",
      receiver: "behaviorObj",
    });
  });

  it("handles AddExpressionAndCondition (emits both kinds with shared params)", () => {
    const src = `
obj.AddExpressionAndConditionForObject("number", "Speed",
                                       _("Speed"), _("Object speed"),
                                       _("the speed"), _(""), "icon.png")
    .AddParameter("object", _("Object"))
    .UseStandardParameters("number");
    `;
    const out = parseExtensionSource(src, { language: "cpp" });
    expect(out).toHaveLength(2);
    const expr = out.find((i) => i.kind === "expression")!;
    const cond = out.find((i) => i.kind === "condition")!;
    expect(expr.type).toBe("Speed");
    expect(cond.type).toBe("Speed");
    expect(expr.parameters).toEqual(cond.parameters);
    expect(expr.parameters[0]).toMatchObject({ type: "object" });
  });
});

describe("parseExtensionSource — JS", () => {
  it("captures extension.addAction with chained addParameter", () => {
    const src = `
extension
    .addAction(
      "Foo",
      _("Foo"),
      _("Does foo."),
      _("Foo on _PARAM0_"),
      "",
      "res/foo.png",
      "res/foo.png"
    )
    .addParameter("objectList", _("Object"), "", false)
    .addParameter("string", _("Message"))
    .getCodeExtraInformation()
    .setFunctionName("foo");
    `;
    const out = parseExtensionSource(src, { language: "js" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      type: "Foo",
      kind: "action",
      receiver: "extension",
    });
    expect(out[0].parameters.map((p) => p.type)).toEqual([
      "objectList",
      "string",
    ]);
  });

  it("supports single-quoted string literals", () => {
    const src = `extension.addCondition('Bar', _('Bar'), _('does bar.'), '', '', '', '');`;
    const out = parseExtensionSource(src, { language: "js" });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("Bar");
  });
});
