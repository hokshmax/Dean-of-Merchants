import type Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@dean/logger";
import type { OfferQuote } from "@dean/shared-types";
import { SYSTEM_PROMPT } from "./system-prompt";
import {
  SEARCH_PRODUCTS_TOOL_NAME,
  searchProductsInputSchema,
  searchProductsTool,
  type SearchProductsToolResult,
} from "./tools/search-products";

const logger = createLogger("ai-orchestration");

const MAX_TOOL_ROUNDS = 3;

export type ExecuteSearch = (
  input: ReturnType<typeof searchProductsInputSchema.parse>,
) => Promise<SearchProductsToolResult>;

export interface ChatTurnInput {
  client: Anthropic;
  model: string;
  history: Anthropic.MessageParam[];
  userMessage: string;
  executeSearch: ExecuteSearch;
}

export interface ChatTurnResult {
  history: Anthropic.MessageParam[];
  assistantText: string;
  offers: OfferQuote[];
}

/**
 * Runs one user turn through Claude's manual tool-use loop. This is the only place
 * search_products is ever executed, and it is the only tool exposed to the model --
 * there is no "place_order" or "checkout" tool, by design. Purchasing is a separate,
 * explicit REST call the frontend makes against a locked quote, never something the
 * model can trigger from within a chat message.
 */
export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const { client, model, executeSearch } = input;
  const history: Anthropic.MessageParam[] = [
    ...input.history,
    { role: "user", content: input.userMessage },
  ];

  let offers: OfferQuote[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [searchProductsTool],
      messages: history,
    });

    history.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
      const assistantText = extractText(response.content);
      return { history, assistantText, offers };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      if (toolUse.name !== SEARCH_PRODUCTS_TOOL_NAME) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Unknown tool "${toolUse.name}"`,
          is_error: true,
        });
        continue;
      }

      const parsed = searchProductsInputSchema.safeParse(toolUse.input);
      if (!parsed.success) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Invalid search_products input: ${parsed.error.message}`,
          is_error: true,
        });
        continue;
      }

      try {
        const result = await executeSearch(parsed.data);
        offers = result.offers;
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err: message }, "search_products execution failed");
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Search failed: ${message}`,
          is_error: true,
        });
      }
    }

    history.push({ role: "user", content: toolResults });
  }

  logger.warn({ maxToolRounds: MAX_TOOL_ROUNDS }, "chat turn hit max tool rounds without a final answer");
  return {
    history,
    assistantText:
      "I found some results but I'm having trouble finishing my answer -- could you try rephrasing your request?",
    offers,
  };
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
