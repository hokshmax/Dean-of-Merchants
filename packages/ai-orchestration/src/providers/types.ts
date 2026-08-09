import type { Design } from "@dean/shared-types";
import type { GenerateDesignInput, GenerateDesignToolResult } from "../tools/generate-design";

/**
 * Provider-agnostic transcript format. Every AIProvider converts to/from its own SDK's
 * message shape at its own boundary; nothing outside packages/ai-orchestration/src/providers
 * ever sees an Anthropic- or Gemini-specific type.
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

export type ExecuteGenerateDesign = (input: GenerateDesignInput) => Promise<GenerateDesignToolResult>;

export interface ChatTurnInput {
  history: NeutralMessage[];
  userMessage: string;
  generateDesign: ExecuteGenerateDesign;
}

export interface ChatTurnResult {
  history: NeutralMessage[];
  assistantText: string;
  design?: Design;
}

export type AIProviderId = "claude" | "gemini";

export interface AIProvider {
  readonly id: AIProviderId;
  runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult>;
}
