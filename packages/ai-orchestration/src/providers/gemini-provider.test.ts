import { describe, expect, it } from "vitest";
import { fromGeminiParts, toGeminiContents, toGeminiFunctionDeclaration } from "./gemini-provider";
import type { NeutralMessage } from "./types";
import { searchProductsToolDefinition } from "../tools/search-products";

describe("toGeminiFunctionDeclaration", () => {
  it("maps the neutral tool definition to Gemini's FunctionDeclaration shape", () => {
    const decl = toGeminiFunctionDeclaration(searchProductsToolDefinition);
    expect(decl.name).toBe("search_products");
    expect(decl.parameters).toEqual(searchProductsToolDefinition.parameters);
  });
});

describe("toGeminiContents", () => {
  it("maps neutral roles to Gemini's user/model roles", () => {
    const history: NeutralMessage[] = [
      { role: "user", content: [{ type: "text", text: "find a mouse" }] },
      { role: "assistant", content: [{ type: "text", text: "Let me search." }] },
    ];

    const contents = toGeminiContents(history);

    expect(contents[0].role).toBe("user");
    expect(contents[1].role).toBe("model");
  });

  it("converts tool_use to functionCall and tool_result to functionResponse", () => {
    const history: NeutralMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "search_products-1", name: "search_products", input: { rawQuery: "mouse" } }],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", toolUseId: "search_products-1", name: "search_products", content: "{}", isError: false },
        ],
      },
    ];

    const contents = toGeminiContents(history);

    expect(contents[0].parts).toEqual([
      { functionCall: { name: "search_products", args: { rawQuery: "mouse" } } },
    ]);
    expect(contents[1].parts).toEqual([
      { functionResponse: { name: "search_products", response: { result: "{}" } } },
    ]);
  });

  it("wraps a failed tool_result as an error response", () => {
    const history: NeutralMessage[] = [
      {
        role: "user",
        content: [
          { type: "tool_result", toolUseId: "search_products-1", name: "search_products", content: "boom", isError: true },
        ],
      },
    ];

    expect(toGeminiContents(history)[0].parts).toEqual([
      { functionResponse: { name: "search_products", response: { error: "boom" } } },
    ]);
  });
});

describe("fromGeminiParts", () => {
  it("converts text and functionCall parts to neutral blocks", () => {
    const result = fromGeminiParts([
      { text: "Searching now." },
      { functionCall: { name: "search_products", args: { rawQuery: "mouse" } } },
    ]);

    expect(result).toEqual([
      { type: "text", text: "Searching now." },
      { type: "tool_use", id: "search_products-1", name: "search_products", input: { rawQuery: "mouse" } },
    ]);
  });

  it("returns an empty array for parts with no text or functionCall", () => {
    expect(fromGeminiParts([{ inlineData: { data: "x", mimeType: "image/png" } } as never])).toEqual([]);
  });
});
