import { describe, expect, it } from "vitest";
import { fromAnthropicContent, toAnthropicMessages, toAnthropicTool } from "./claude-provider";
import type { NeutralMessage } from "./types";
import { generateDesignToolDefinition } from "../tools/generate-design";

describe("toAnthropicTool", () => {
  it("maps the neutral tool definition to Anthropic's input_schema shape", () => {
    const tool = toAnthropicTool(generateDesignToolDefinition);
    expect(tool.name).toBe("generate_design");
    expect(tool.input_schema).toEqual(generateDesignToolDefinition.parameters);
  });
});

describe("toAnthropicMessages", () => {
  it("converts neutral text/tool_use/tool_result blocks to Anthropic content block params", () => {
    const history: NeutralMessage[] = [
      { role: "user", content: [{ type: "text", text: "design a mountain shirt" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me generate that." },
          { type: "tool_use", id: "call_1", name: "generate_design", input: { prompt: "mountain line art" } },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", toolUseId: "call_1", name: "generate_design", content: "{}", isError: false }],
      },
    ];

    const anthropic = toAnthropicMessages(history);

    expect(anthropic).toEqual([
      { role: "user", content: [{ type: "text", text: "design a mountain shirt" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me generate that." },
          { type: "tool_use", id: "call_1", name: "generate_design", input: { prompt: "mountain line art" } },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "call_1", content: "{}", is_error: false }],
      },
    ]);
  });
});

describe("fromAnthropicContent", () => {
  it("converts Anthropic text and tool_use blocks to neutral blocks", () => {
    const result = fromAnthropicContent([
      { type: "text", text: "hello", citations: [] } as never,
      { type: "tool_use", id: "call_1", name: "generate_design", input: { prompt: "mountain line art" } } as never,
    ]);

    expect(result).toEqual([
      { type: "text", text: "hello" },
      { type: "tool_use", id: "call_1", name: "generate_design", input: { prompt: "mountain line art" } },
    ]);
  });

  it("drops block types it doesn't recognize rather than throwing", () => {
    const result = fromAnthropicContent([{ type: "thinking", thinking: "..." } as never]);
    expect(result).toEqual([]);
  });
});
