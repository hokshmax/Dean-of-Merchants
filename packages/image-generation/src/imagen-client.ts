// @google/genai ships ESM-only; TypeScript's CommonJS output rewrites `await import(...)` into
// a synchronous `require()` that still crashes on a pure-ESM package. This dynamic-import
// escape hatch (same one used in packages/ai-orchestration/src/providers/gemini-provider.ts)
// hides the specifier from TS's static rewriting so it stays a genuine runtime ESM import.
import type { GoogleGenAI as GoogleGenAIClient } from "@google/genai";
import { createLogger } from "@dean/logger";

const logger = createLogger("image-generation:imagen");

// eslint-disable-next-line @typescript-eslint/no-implied-eval -- intentional, see comment above.
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<typeof import("@google/genai")>;

export interface GeneratedImage {
  imageBytes: Buffer;
  mimeType: string;
}

export interface ImagenClient {
  generateDesign(prompt: string): Promise<GeneratedImage>;
}

const DEFAULT_MODEL = "imagen-4.0-generate-001";

export interface RawGenerateImagesResponse {
  generatedImages?: { image?: { imageBytes?: string; mimeType?: string } }[];
}

/** Pulled out of createImagenClient so the base64-decoding/validation logic is unit-testable
 * without a real API key or network call. */
export function parseGenerateImagesResponse(response: RawGenerateImagesResponse, prompt: string): GeneratedImage {
  const generated = response.generatedImages?.[0]?.image;
  if (!generated?.imageBytes) {
    logger.error({ prompt }, "Imagen returned no image data");
    throw new Error("Imagen returned no image data");
  }

  return {
    imageBytes: Buffer.from(generated.imageBytes, "base64"),
    mimeType: generated.mimeType ?? "image/png",
  };
}

/**
 * Wraps Google's Imagen image-generation models behind a minimal interface. Returns raw image
 * bytes rather than a URL -- Imagen's API only returns base64 image data, so whatever calls
 * this is responsible for persisting the bytes somewhere with a publicly reachable URL (needed
 * later to hand the design to Printful's order API, which fetches print files by URL).
 */
export function createImagenClient(apiKey: string, model: string = DEFAULT_MODEL): ImagenClient {
  let clientPromise: Promise<GoogleGenAIClient> | undefined;
  const getClient = (): Promise<GoogleGenAIClient> => {
    if (!clientPromise) {
      clientPromise = dynamicImport("@google/genai").then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey }));
    }
    return clientPromise;
  };

  return {
    async generateDesign(prompt: string): Promise<GeneratedImage> {
      const client = await getClient();
      const response = await client.models.generateImages({
        model,
        prompt,
        config: { numberOfImages: 1 },
      });
      return parseGenerateImagesResponse(response, prompt);
    },
  };
}
