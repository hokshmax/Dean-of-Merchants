import { Injectable } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient, runChatTurn, type ExecuteSearch } from "@dean/ai-orchestration";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { OfferQuote } from "@dean/shared-types";
import { SearchService, type SearchDestination } from "../search/search.service";

const logger = createLogger("api:chat");

interface SessionState {
  history: Anthropic.MessageParam[];
  lastOffers: OfferQuote[];
}

@Injectable()
export class ChatService {
  private readonly client: Anthropic;
  private readonly model: string;
  // In-memory session store for Phase 1. Chat/offer persistence to Postgres
  // (ChatSession/RetailerOffer/Quote, already modeled in packages/db/prisma/schema.prisma)
  // lands alongside order persistence in Phase 2, once there's a real user/auth flow to key it to.
  private readonly sessions = new Map<string, SessionState>();

  constructor(private readonly searchService: SearchService) {
    const env = loadEnv();
    if (!env.ANTHROPIC_API_KEY) {
      logger.warn("ANTHROPIC_API_KEY is not set; chat requests will fail until it's configured");
    }
    this.model = env.ANTHROPIC_MODEL;
    this.client = createAnthropicClient(env.ANTHROPIC_API_KEY ?? "");
  }

  async handleTurn(
    sessionId: string,
    userMessage: string,
    destination: SearchDestination,
  ): Promise<{ assistantText: string; offers: OfferQuote[] }> {
    const existing = this.sessions.get(sessionId);
    const history = existing?.history ?? [];

    const executeSearch: ExecuteSearch = (input) => this.searchService.search(input, destination);

    const result = await runChatTurn({
      client: this.client,
      model: this.model,
      history,
      userMessage,
      executeSearch,
    });

    this.sessions.set(sessionId, { history: result.history, lastOffers: result.offers });

    return { assistantText: result.assistantText, offers: result.offers };
  }

  getLastOffers(sessionId: string): OfferQuote[] {
    return this.sessions.get(sessionId)?.lastOffers ?? [];
  }
}
