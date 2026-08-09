import { join } from "node:path";
import { BadRequestException, Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { DesignService } from "./design.service";

// Filenames are always ones this service itself generated (randomUUID + a fixed extension);
// validating the shape rejects any path-traversal attempt via the URL param rather than
// trusting it.
const SAFE_FILENAME = /^[a-f0-9-]+\.(png|jpg)$/i;

@Controller("designs")
export class DesignController {
  constructor(private readonly designService: DesignService) {}

  @Get()
  async listRecent(@Query("limit") limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    return { designs: await this.designService.listRecent(parsedLimit && !Number.isNaN(parsedLimit) ? parsedLimit : undefined) };
  }

  @Get(":filename")
  getDesignFile(@Param("filename") filename: string, @Res() res: Response) {
    if (!SAFE_FILENAME.test(filename)) {
      throw new BadRequestException("Invalid design filename");
    }
    res.sendFile(join(this.designService.storageDir, filename));
  }
}
