import { Injectable } from "@nestjs/common";
import { createAIProvider, type AIProvider, type ExecuteGenerateDesign, type NeutralMessage } from "@dean/ai-orchestration";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { Design } from "@dean/shared-types";
import { DesignService } from "../design/design.service";

const logger = createLogger("api:chat");

interface SessionState {
  history: NeutralMessage[];
  lastDesign?: Design;
}

@Injectable()
export class ChatService {
  private readonly provider: AIProvider;
  // In-memory session store. Chat history persistence to Postgres lands alongside a real
  // user/auth flow, once there's an account to key it to.
  private readonly sessions = new Map<string, SessionState>();

  constructor(private readonly designService: DesignService) {
    const env = loadEnv();

    const apiKey = env.AI_PROVIDER === "gemini" ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY;
    const model = env.AI_PROVIDER === "gemini" ? env.GEMINI_MODEL : env.ANTHROPIC_MODEL;
    if (!apiKey) {
      const keyName = env.AI_PROVIDER === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
      logger.warn({ provider: env.AI_PROVIDER }, `${keyName} is not set; chat requests will fail until it's configured`);
    }
    this.provider = createAIProvider(env.AI_PROVIDER, { apiKey: apiKey ?? "", model });
  }

  async handleTurn(sessionId: string, userMessage: string): Promise<{ assistantText: string; design?: Design }> {
    const existing = this.sessions.get(sessionId);
    const history = existing?.history ?? [];

    const generateDesign: ExecuteGenerateDesign = (input) => this.designService.generate(input);

    const result = await this.provider.runChatTurn({ history, userMessage, generateDesign });

    this.sessions.set(sessionId, { history: result.history, lastDesign: result.design });

    return { assistantText: result.assistantText, design: result.design };
  }

  getLastDesign(sessionId: string): Design | undefined {
    return this.sessions.get(sessionId)?.lastDesign;
  }
}
