import { createClaudeProvider } from "./claude-provider";
import { createGeminiProvider } from "./gemini-provider";
import type { AIProvider, AIProviderId } from "./types";

export interface AIProviderConfig {
  apiKey: string;
  model: string;
}

/**
 * Only one provider is ever used per chat turn (never fanned out like retailer search), so a
 * plain factory is enough here -- no need for a stateful registry class.
 */
export function createAIProvider(id: AIProviderId, config: AIProviderConfig): AIProvider {
  switch (id) {
    case "claude":
      return createClaudeProvider(config.apiKey, config.model);
    case "gemini":
      return createGeminiProvider(config.apiKey, config.model);
  }
}
