import { createLogger } from "@dean/logger";
import { SYSTEM_PROMPT } from "../system-prompt";
import {
  SEARCH_PRODUCTS_TOOL_NAME,
  searchProductsInputSchema,
  searchProductsToolDefinition,
  type ToolDefinition,
} from "../tools/search-products";
import type { AIProvider, ChatTurnInput, ChatTurnResult, NeutralContentBlock, NeutralMessage } from "./types";

const logger = createLogger("ai-orchestration:ollama");

const MAX_TOOL_ROUNDS = 3;

/**
 * Talks to a local Ollama server via its OpenAI-compatible /v1/chat/completions endpoint --
 * plain fetch, no SDK, which sidesteps the ESM/CJS packaging issues @google/genai had. Unlike
 * Anthropic (tool_use_id) or Gemini (name + thoughtSignature), OpenAI-style tool calls are
 * matched by a plain `id` on both the call and its result, which our existing toolUseId field
 * already covers directly -- no extra neutral-format fields needed for this provider.
 */

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export function toOpenAITool(def: ToolDefinition) {
  return {
    type: "function" as const,
    function: { name: def.name, description: def.description, parameters: def.parameters },
  };
}

export function toOllamaMessages(history: NeutralMessage[], systemPrompt: string): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [{ role: "system", content: systemPrompt }];

  for (const message of history) {
    const textParts = message.content.filter(
      (b): b is Extract<NeutralContentBlock, { type: "text" }> => b.type === "text",
    );
    const toolUses = message.content.filter(
      (b): b is Extract<NeutralContentBlock, { type: "tool_use" }> => b.type === "tool_use",
    );
    const toolResults = message.content.filter(
      (b): b is Extract<NeutralContentBlock, { type: "tool_result" }> => b.type === "tool_result",
    );

    if (toolUses.length > 0) {
      messages.push({
        role: "assistant",
        content: textParts.length > 0 ? textParts.map((b) => b.text).join("\n") : null,
        tool_calls: toolUses.map((tu) => ({
          id: tu.id,
          type: "function",
          function: { name: tu.name, arguments: JSON.stringify(tu.input) },
        })),
      });
    } else if (textParts.length > 0) {
      messages.push({ role: message.role, content: textParts.map((b) => b.text).join("\n") });
    }

    // Each tool_result becomes its own separate "tool" message -- OpenAI's format has no
    // concept of bundling multiple tool results into one message the way Anthropic/Gemini do.
    for (const tr of toolResults) {
      messages.push({ role: "tool", tool_call_id: tr.toolUseId, content: tr.content });
    }
  }

  return messages;
}

export function fromOllamaMessage(message: {
  content: string | null;
  tool_calls?: OpenAIToolCall[];
}): NeutralContentBlock[] {
  const blocks: NeutralContentBlock[] = [];
  if (message.content) blocks.push({ type: "text", text: message.content });

  for (const call of message.tool_calls ?? []) {
    let input: unknown = {};
    try {
      input = JSON.parse(call.function.arguments);
    } catch {
      // Small open models occasionally emit malformed JSON arguments; fall back to an empty
      // object so downstream zod validation reports a clean "invalid input" rather than crashing.
      input = {};
    }
    blocks.push({ type: "tool_use", id: call.id, name: call.function.name, input });
  }

  return blocks;
}

export function createOllamaProvider(baseUrl: string, model: string): AIProvider {
  return {
    id: "ollama",

    async runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
      const { executeSearch } = input;
      let history: NeutralMessage[] = [
        ...input.history,
        { role: "user", content: [{ type: "text", text: input.userMessage }] },
      ];
      let offers: ChatTurnResult["offers"] = [];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: toOllamaMessages(history, SYSTEM_PROMPT),
            tools: [toOpenAITool(searchProductsToolDefinition)],
          }),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Ollama request failed: ${response.status} ${text}`);
        }

        const data = (await response.json()) as {
          choices: { message: { content: string | null; tool_calls?: OpenAIToolCall[] } }[];
        };
        const message = data.choices[0]?.message ?? { content: null };
        const assistantBlocks = fromOllamaMessage(message);
        history = [...history, { role: "assistant", content: assistantBlocks }];

        const toolUses = assistantBlocks.filter(
          (block): block is Extract<NeutralContentBlock, { type: "tool_use" }> => block.type === "tool_use",
        );

        if (toolUses.length === 0) {
          const assistantText = assistantBlocks
            .filter((b): b is Extract<NeutralContentBlock, { type: "text" }> => b.type === "text")
            .map((b) => b.text)
            .join("\n")
            .trim();
          return { history, assistantText, offers };
        }

        const toolResults: NeutralContentBlock[] = [];
        for (const toolUse of toolUses) {
          if (toolUse.name !== SEARCH_PRODUCTS_TOOL_NAME) {
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: `Unknown tool "${toolUse.name}"`,
              isError: true,
            });
            continue;
          }

          const parsed = searchProductsInputSchema.safeParse(toolUse.input);
          if (!parsed.success) {
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: `Invalid search_products input: ${parsed.error.message}`,
              isError: true,
            });
            continue;
          }

          try {
            const result = await executeSearch(parsed.data);
            offers = result.offers;
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: JSON.stringify(result),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error({ err: message }, "search_products execution failed");
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: `Search failed: ${message}`,
              isError: true,
            });
          }
        }

        history = [...history, { role: "user", content: toolResults }];
      }

      logger.warn({ maxToolRounds: MAX_TOOL_ROUNDS }, "chat turn hit max tool rounds without a final answer");
      return {
        history,
        assistantText:
          "I found some results but I'm having trouble finishing my answer -- could you try rephrasing your request?",
        offers,
      };
    },
  };
}
