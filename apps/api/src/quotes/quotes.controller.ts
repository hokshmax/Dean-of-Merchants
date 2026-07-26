import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ChatService } from "../chat/chat.service";

@Controller("quotes")
export class QuotesController {
  constructor(private readonly chatService: ChatService) {}

  /** Returns the most recent offer quotes surfaced for a chat session. */
  @Get(":sessionId")
  getBySession(@Param("sessionId") sessionId: string) {
    const offers = this.chatService.getLastOffers(sessionId);
    if (offers.length === 0) {
      throw new NotFoundException(`No quotes found for session "${sessionId}"`);
    }
    return { sessionId, offers };
  }
}
