import { randomUUID } from "node:crypto";
import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { ChatService } from "./chat.service";

const chatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
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
    const { assistantText, design } = await this.chatService.handleTurn(sessionId, parsed.data.message);

    return { sessionId, assistantText, design };
  }
}
