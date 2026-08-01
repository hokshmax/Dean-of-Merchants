import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@dean/logger";
import { SYSTEM_PROMPT } from "../system-prompt";
import {
  SEARCH_PRODUCTS_TOOL_NAME,
  searchProductsInputSchema,
  searchProductsToolDefinition,
  type ToolDefinition,
} from "../tools/search-products";
import type { AIProvider, ChatTurnInput, ChatTurnResult, NeutralContentBlock, NeutralMessage } from "./types";

const logger = createLogger("ai-orchestration:claude");

const MAX_TOOL_ROUNDS = 3;

export function toAnthropicTool(def: ToolDefinition): Anthropic.Tool {
  return { name: def.name, description: def.description, input_schema: def.parameters as Anthropic.Tool["input_schema"] };
}

type AnthropicContentBlockParam = Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam;

export function toAnthropicMessages(history: NeutralMessage[]): Anthropic.MessageParam[] {
  return history.map((message) => ({
    role: message.role,
    content: message.content.map((block): AnthropicContentBlockParam => {
      switch (block.type) {
        case "text":
          return { type: "text", text: block.text };
        case "tool_use":
          return { type: "tool_use", id: block.id, name: block.name, input: block.input };
        case "tool_result":
          // Anthropic's tool_result param has no "name" field -- it matches by tool_use_id only.
          return {
            type: "tool_result",
            tool_use_id: block.toolUseId,
            content: block.content,
            is_error: block.isError,
          };
      }
    }),
  }));
}

export function fromAnthropicContent(content: Anthropic.ContentBlock[]): NeutralContentBlock[] {
  return content
    .map((block): NeutralContentBlock | null => {
      if (block.type === "text") return { type: "text", text: block.text };
      if (block.type === "tool_use") return { type: "tool_use", id: block.id, name: block.name, input: block.input };
      return null;
    })
    .filter((block): block is NeutralContentBlock => block !== null);
}

export function createClaudeProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    id: "claude",

    async runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
      const { executeSearch } = input;
      let history: NeutralMessage[] = [
        ...input.history,
        { role: "user", content: [{ type: "text", text: input.userMessage }] },
      ];
      let offers: ChatTurnResult["offers"] = [];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await client.messages.create({
          model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: [toAnthropicTool(searchProductsToolDefinition)],
          messages: toAnthropicMessages(history),
        });

        const assistantBlocks = fromAnthropicContent(response.content);
        history = [...history, { role: "assistant", content: assistantBlocks }];

        const toolUses = assistantBlocks.filter(
          (block): block is Extract<NeutralContentBlock, { type: "tool_use" }> => block.type === "tool_use",
        );

        if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
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
