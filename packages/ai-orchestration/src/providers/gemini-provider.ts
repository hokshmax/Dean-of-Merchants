// @google/genai ships ESM-only. Everything in this monorepo compiles to CommonJS, and
// TypeScript's CommonJS output rewrites even `await import(...)` into a synchronous
// `require()` call (wrapped in a resolved promise) -- which still crashes on a pure-ESM
// package. Type-only imports below are erased at compile time (safe). The runtime class is
// loaded through `dynamicImport`, which hides the specifier from TS's static rewriting so it
// stays a genuine ESM dynamic import at runtime -- the standard escape hatch for this.
import type { Content, FunctionDeclaration, GoogleGenAI as GoogleGenAIClient, Part } from "@google/genai";
import { createLogger } from "@dean/logger";
import { SYSTEM_PROMPT } from "../system-prompt";
import {
  GENERATE_DESIGN_TOOL_NAME,
  generateDesignInputSchema,
  generateDesignToolDefinition,
  type ToolDefinition,
} from "../tools/generate-design";
import type { AIProvider, ChatTurnInput, ChatTurnResult, NeutralContentBlock, NeutralMessage } from "./types";

const logger = createLogger("ai-orchestration:gemini");

const MAX_TOOL_ROUNDS = 3;

// eslint-disable-next-line @typescript-eslint/no-implied-eval -- intentional: forces a real
// runtime `import()`, not TS's CommonJS-transpiled `require()`.
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<typeof import("@google/genai")>;

export function toGeminiFunctionDeclaration(def: ToolDefinition): FunctionDeclaration {
  return {
    name: def.name,
    description: def.description,
    parameters: def.parameters as FunctionDeclaration["parameters"],
  };
}

export function toGeminiContents(history: NeutralMessage[]): Content[] {
  return history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: message.content.map((block): Part => {
      switch (block.type) {
        case "text":
          return { text: block.text };
        case "tool_use":
          return {
            functionCall: { name: block.name, args: block.input as Record<string, unknown> },
            // Newer "thinking" models reject a follow-up request that's missing this on a
            // function call the model itself made in a prior turn -- must round-trip verbatim.
            ...(block.thoughtSignature ? { thoughtSignature: block.thoughtSignature } : {}),
          };
        case "tool_result":
          return {
            functionResponse: {
              name: block.name,
              // Per the SDK's docs: "output" key for success, "error" key for failure.
              response: block.isError ? { error: block.content } : { output: block.content },
            },
          };
      }
    }),
  }));
}

export function fromGeminiParts(parts: Part[]): NeutralContentBlock[] {
  let callIndex = 0;
  return parts
    .map((part): NeutralContentBlock | null => {
      if (part.text) return { type: "text", text: part.text };
      if (part.functionCall) {
        callIndex += 1;
        // Gemini function calls don't carry a stable call-id the way Anthropic's do; synthesize
        // one so tool_result blocks still have something unique to reference (Gemini itself
        // matches the response back by `name`, not this id -- see toGeminiContents above).
        return {
          type: "tool_use",
          id: `${part.functionCall.name ?? "call"}-${callIndex}`,
          name: part.functionCall.name ?? "",
          input: part.functionCall.args ?? {},
          ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
        };
      }
      return null;
    })
    .filter((block): block is NeutralContentBlock => block !== null);
}

export function createGeminiProvider(apiKey: string, model: string): AIProvider {
  let clientPromise: Promise<GoogleGenAIClient> | undefined;
  const getClient = (): Promise<GoogleGenAIClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("@google/genai").then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey }));
    }
    return clientPromise;
  };

  return {
    id: "gemini",

    async runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
      const client = await getClient();
      const { generateDesign } = input;
      let history: NeutralMessage[] = [
        ...input.history,
        { role: "user", content: [{ type: "text", text: input.userMessage }] },
      ];
      let design: ChatTurnResult["design"];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await client.models.generateContent({
          model,
          contents: toGeminiContents(history),
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: [toGeminiFunctionDeclaration(generateDesignToolDefinition)] }],
          },
        });

        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const assistantBlocks = fromGeminiParts(parts);
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
          return { history, assistantText, design };
        }

        const toolResults: NeutralContentBlock[] = [];
        for (const toolUse of toolUses) {
          if (toolUse.name !== GENERATE_DESIGN_TOOL_NAME) {
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: `Unknown tool "${toolUse.name}"`,
              isError: true,
            });
            continue;
          }

          const parsed = generateDesignInputSchema.safeParse(toolUse.input);
          if (!parsed.success) {
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: `Invalid generate_design input: ${parsed.error.message}`,
              isError: true,
            });
            continue;
          }

          try {
            const result = await generateDesign(parsed.data);
            design = result.design;
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: JSON.stringify(result),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error({ err: message }, "generate_design execution failed");
            toolResults.push({
              type: "tool_result",
              toolUseId: toolUse.id,
              name: toolUse.name,
              content: `Design generation failed: ${message}`,
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
          "I generated something but I'm having trouble finishing my answer -- could you try rephrasing your request?",
        design,
      };
    },
  };
}
