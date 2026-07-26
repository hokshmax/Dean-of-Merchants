import Anthropic from "@anthropic-ai/sdk";

export interface AnthropicClientConfig {
  apiKey: string;
  model: string;
}

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}
