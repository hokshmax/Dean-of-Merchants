import { describe, expect, it } from "vitest";
import { fromOllamaMessage, toOllamaMessages, toOpenAITool } from "./ollama-provider";
import type { NeutralMessage } from "./types";
import { searchProductsToolDefinition } from "../tools/search-products";

describe("toOpenAITool", () => {
  it("maps the neutral tool definition to OpenAI's function-tool shape", () => {
    const tool = toOpenAITool(searchProductsToolDefinition);
    expect(tool.type).toBe("function");
    expect(tool.function.name).toBe("search_products");
    expect(tool.function.parameters).toEqual(searchProductsToolDefinition.parameters);
  });
});

describe("toOllamaMessages", () => {
  it("prepends a system message and maps plain text turns", () => {
    const history: NeutralMessage[] = [
      { role: "user", content: [{ type: "text", text: "find a mouse" }] },
      { role: "assistant", content: [{ type: "text", text: "Let me search." }] },
    ];

    const messages = toOllamaMessages(history, "system prompt");

    expect(messages[0]).toEqual({ role: "system", content: "system prompt" });
    expect(messages[1]).toEqual({ role: "user", content: "find a mouse" });
    expect(messages[2]).toEqual({ role: "assistant", content: "Let me search." });
  });

  it("converts a tool_use block into an assistant message with tool_calls", () => {
    const history: NeutralMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "call_1", name: "search_products", input: { rawQuery: "mouse" } }],
      },
    ];

    const messages = toOllamaMessages(history, "sys");

    expect(messages[1]).toEqual({
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "search_products", arguments: '{"rawQuery":"mouse"}' } },
      ],
    });
  });

  it("expands each tool_result block into its own separate tool-role message", () => {
    const history: NeutralMessage[] = [
      {
        role: "user",
        content: [
          { type: "tool_result", toolUseId: "call_1", name: "search_products", content: "{}", isError: false },
        ],
      },
    ];

    expect(toOllamaMessages(history, "sys")[1]).toEqual({
      role: "tool",
      tool_call_id: "call_1",
      content: "{}",
    });
  });
});

describe("fromOllamaMessage", () => {
  it("converts text content and tool_calls to neutral blocks", () => {
    const result = fromOllamaMessage({
      content: "Searching now.",
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "search_products", arguments: '{"rawQuery":"mouse"}' } },
      ],
    });

    expect(result).toEqual([
      { type: "text", text: "Searching now." },
      { type: "tool_use", id: "call_1", name: "search_products", input: { rawQuery: "mouse" } },
    ]);
  });

  it("falls back to an empty object when tool_call arguments are malformed JSON", () => {
    const result = fromOllamaMessage({
      content: null,
      tool_calls: [{ id: "call_1", type: "function", function: { name: "search_products", arguments: "{not json" } }],
    });

    expect(result).toEqual([{ type: "tool_use", id: "call_1", name: "search_products", input: {} }]);
  });

  it("returns no text block when content is null", () => {
    expect(fromOllamaMessage({ content: null })).toEqual([]);
  });
});
