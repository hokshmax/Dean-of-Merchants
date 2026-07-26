import { randomUUID } from "node:crypto";
import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { ChatService } from "./chat.service";

const chatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
  destinationCountryCode: z.string().length(2).default("US"),
  currency: z.string().length(3).default("USD"),
});

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async postMessage(@Body() body: unknown) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const sessionId = parsed.data.sessionId ?? randomUUID();
    const { assistantText, offers } = await this.chatService.handleTurn(
      sessionId,
      parsed.data.message,
      { countryCode: parsed.data.destinationCountryCode, currency: parsed.data.currency },
    );

    return { sessionId, assistantText, offers };
  }
}
