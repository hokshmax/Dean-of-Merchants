import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Injectable } from "@nestjs/common";
import { createImagenClient, type ImagenClient } from "@dean/image-generation";
import { getPrismaClient } from "@dean/db";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { Design } from "@dean/shared-types";
import type { GenerateDesignInput, GenerateDesignToolResult } from "@dean/ai-orchestration";

const logger = createLogger("api:design");

@Injectable()
export class DesignService {
  private readonly imagen: ImagenClient;
  readonly storageDir: string;
  private readonly publicUrl: string;

  constructor() {
    const env = loadEnv();
    if (!env.GEMINI_API_KEY) {
      logger.warn("GEMINI_API_KEY is not set; design generation will fail until it's configured");
    }
    this.imagen = createImagenClient(env.GEMINI_API_KEY ?? "", env.IMAGEN_MODEL);
    this.storageDir = resolve(env.DESIGN_STORAGE_DIR);
    this.publicUrl = env.API_PUBLIC_URL.replace(/\/+$/, "");
  }

  async generate(input: GenerateDesignInput): Promise<GenerateDesignToolResult> {
    const { imageBytes, mimeType } = await this.imagen.generateDesign(input.prompt);

    const id = randomUUID();
    const extension = mimeType === "image/jpeg" ? "jpg" : "png";
    const filename = `${id}.${extension}`;

    await mkdir(this.storageDir, { recursive: true });
    await writeFile(join(this.storageDir, filename), imageBytes);

    const imageUrl = `${this.publicUrl}/designs/${filename}`;
    const createdAt = new Date();

    await getPrismaClient().design.create({ data: { id, prompt: input.prompt, imageUrl, createdAt } });

    const design: Design = { id, prompt: input.prompt, imageUrl, createdAt };
    return { design };
  }
}
