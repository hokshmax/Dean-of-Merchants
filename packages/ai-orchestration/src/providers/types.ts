import type { OfferQuote } from "@dean/shared-types";
import type { SearchProductsInput, SearchProductsToolResult } from "../tools/search-products";

/**
 * Provider-agnostic transcript format. Every AIProvider converts to/from its own SDK's
 * message shape at its own boundary; nothing outside packages/ai-orchestration/src/providers
 * ever sees an Anthropic- or Gemini-specific type. This mirrors the RetailerAdapter pattern
 * in packages/retailer-adapters: swapping or adding a provider never touches chat/session code.
 */
export type NeutralContentBlock =
  | { type: "text"; text: string }
  // thoughtSignature is Gemini-specific (an opaque, base64 reasoning-state token) and unused by
  // Claude. Gemini's newer "thinking" models reject a follow-up request that omits it on a
  // function call the model previously made, so it has to round-trip through history verbatim.
  | { type: "tool_use"; id: string; name: string; input: unknown; thoughtSignature?: string }
  // `name` duplicates the originating tool_use's name (not just its id) because Gemini's
  // functionResponse matches by tool name, unlike Anthropic's tool_use_id-based matching.
  | { type: "tool_result"; toolUseId: string; name: string; content: string; isError?: boolean };

export interface NeutralMessage {
  role: "user" | "assistant";
  content: NeutralContentBlock[];
}

export type ExecuteSearch = (input: SearchProductsInput) => Promise<SearchProductsToolResult>;

export interface ChatTurnInput {
  history: NeutralMessage[];
  userMessage: string;
  executeSearch: ExecuteSearch;
}

export interface ChatTurnResult {
  history: NeutralMessage[];
  assistantText: string;
  offers: OfferQuote[];
}

export type AIProviderId = "claude" | "gemini" | "ollama";

export interface AIProvider {
  readonly id: AIProviderId;
  runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult>;
}
