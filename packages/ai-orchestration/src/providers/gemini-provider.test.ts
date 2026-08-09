import { describe, expect, it } from "vitest";
import { fromGeminiParts, toGeminiContents, toGeminiFunctionDeclaration } from "./gemini-provider";
import type { NeutralMessage } from "./types";
import { generateDesignToolDefinition } from "../tools/generate-design";

describe("toGeminiFunctionDeclaration", () => {
  it("maps the neutral tool definition to Gemini's FunctionDeclaration shape", () => {
    const decl = toGeminiFunctionDeclaration(generateDesignToolDefinition);
    expect(decl.name).toBe("generate_design");
    expect(decl.parameters).toEqual(generateDesignToolDefinition.parameters);
  });
});

describe("toGeminiContents", () => {
  it("maps neutral roles to Gemini's user/model roles", () => {
    const history: NeutralMessage[] = [
      { role: "user", content: [{ type: "text", text: "design a mountain shirt" }] },
      { role: "assistant", content: [{ type: "text", text: "Let me generate that." }] },
    ];

    const contents = toGeminiContents(history);

    expect(contents[0].role).toBe("user");
    expect(contents[1].role).toBe("model");
  });

  it("converts tool_use to functionCall and tool_result to functionResponse", () => {
    const history: NeutralMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "generate_design-1", name: "generate_design", input: { prompt: "mountain line art" } }],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", toolUseId: "generate_design-1", name: "generate_design", content: "{}", isError: false },
        ],
      },
    ];

    const contents = toGeminiContents(history);

    expect(contents[0].parts).toEqual([
      { functionCall: { name: "generate_design", args: { prompt: "mountain line art" } } },
    ]);
    expect(contents[1].parts).toEqual([
      { functionResponse: { name: "generate_design", response: { output: "{}" } } },
    ]);
  });

  it("round-trips thoughtSignature onto the functionCall part when present", () => {
    const history: NeutralMessage[] = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "generate_design-1",
            name: "generate_design",
            input: { prompt: "mountain line art" },
            thoughtSignature: "opaque-signature-abc",
          },
        ],
      },
    ];

    expect(toGeminiContents(history)[0].parts).toEqual([
      {
        functionCall: { name: "generate_design", args: { prompt: "mountain line art" } },
        thoughtSignature: "opaque-signature-abc",
      },
    ]);
  });

  it("omits thoughtSignature from the functionCall part when absent", () => {
    const history: NeutralMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "generate_design-1", name: "generate_design", input: {} }],
      },
    ];

    const part = toGeminiContents(history)[0].parts?.[0];
    expect(part).not.toHaveProperty("thoughtSignature");
  });

  it("wraps a failed tool_result as an error response", () => {
    const history: NeutralMessage[] = [
      {
        role: "user",
        content: [
          { type: "tool_result", toolUseId: "generate_design-1", name: "generate_design", content: "boom", isError: true },
        ],
      },
    ];

    expect(toGeminiContents(history)[0].parts).toEqual([
      { functionResponse: { name: "generate_design", response: { error: "boom" } } },
    ]);
  });
});

describe("fromGeminiParts", () => {
  it("converts text and functionCall parts to neutral blocks", () => {
    const result = fromGeminiParts([
      { text: "Generating now." },
      { functionCall: { name: "generate_design", args: { prompt: "mountain line art" } } },
    ]);

    expect(result).toEqual([
      { type: "text", text: "Generating now." },
      { type: "tool_use", id: "generate_design-1", name: "generate_design", input: { prompt: "mountain line art" } },
    ]);
  });

  it("returns an empty array for parts with no text or functionCall", () => {
    expect(fromGeminiParts([{ inlineData: { data: "x", mimeType: "image/png" } } as never])).toEqual([]);
  });

  it("captures thoughtSignature from a functionCall part when present", () => {
    const result = fromGeminiParts([
      {
        functionCall: { name: "generate_design", args: { prompt: "mountain line art" } },
        thoughtSignature: "opaque-signature-abc",
      },
    ]);

    expect(result).toEqual([
      {
        type: "tool_use",
        id: "generate_design-1",
        name: "generate_design",
        input: { prompt: "mountain line art" },
        thoughtSignature: "opaque-signature-abc",
      },
    ]);
  });
});
