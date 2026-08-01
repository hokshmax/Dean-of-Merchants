import { Injectable } from "@nestjs/common";
import { createAIProvider, type AIProvider, type ExecuteSearch, type NeutralMessage } from "@dean/ai-orchestration";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { OfferQuote } from "@dean/shared-types";
import { SearchService, type SearchDestination } from "../search/search.service";

const logger = createLogger("api:chat");

interface SessionState {
  history: NeutralMessage[];
  lastOffers: OfferQuote[];
}

@Injectable()
export class ChatService {
  private readonly provider: AIProvider;
  // In-memory session store for Phase 1. Chat/offer persistence to Postgres
  // (ChatSession/RetailerOffer/Quote, already modeled in packages/db/prisma/schema.prisma)
  // lands alongside order persistence in Phase 2, once there's a real user/auth flow to key it to.
  private readonly sessions = new Map<string, SessionState>();

  constructor(private readonly searchService: SearchService) {
    const env = loadEnv();

    const apiKey = env.AI_PROVIDER === "gemini" ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY;
    const model = env.AI_PROVIDER === "gemini" ? env.GEMINI_MODEL : env.ANTHROPIC_MODEL;
    if (!apiKey) {
      const keyName = env.AI_PROVIDER === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
      logger.warn({ provider: env.AI_PROVIDER }, `${keyName} is not set; chat requests will fail until it's configured`);
    }

    this.provider = createAIProvider(env.AI_PROVIDER, { apiKey: apiKey ?? "", model });
  }

  async handleTurn(
    sessionId: string,
    userMessage: string,
    destination: SearchDestination,
  ): Promise<{ assistantText: string; offers: OfferQuote[] }> {
    const existing = this.sessions.get(sessionId);
    const history = existing?.history ?? [];

    const executeSearch: ExecuteSearch = (input) => this.searchService.search(input, destination);

    const result = await this.provider.runChatTurn({ history, userMessage, executeSearch });

    this.sessions.set(sessionId, { history: result.history, lastOffers: result.offers });

    return { assistantText: result.assistantText, offers: result.offers };
  }

  getLastOffers(sessionId: string): OfferQuote[] {
    return this.sessions.get(sessionId)?.lastOffers ?? [];
  }
}
