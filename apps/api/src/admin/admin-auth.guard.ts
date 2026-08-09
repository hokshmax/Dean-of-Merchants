import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { loadEnv } from "@dean/config";
import { createLogger } from "@dean/logger";
import type { Request } from "express";

const logger = createLogger("api:admin-auth");

/**
 * There's no real staff/account system yet, so the admin dashboard is gated by a single shared
 * bearer token (ADMIN_TOKEN) checked against the "x-admin-token" header on every request. Fails
 * closed: if ADMIN_TOKEN isn't configured, every admin request is rejected rather than left open.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const env = loadEnv();
    if (!env.ADMIN_TOKEN) {
      logger.warn("ADMIN_TOKEN is not set; rejecting admin request");
      throw new UnauthorizedException("Admin dashboard is not configured");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers["x-admin-token"];
    if (provided !== env.ADMIN_TOKEN) {
      throw new UnauthorizedException("Invalid admin token");
    }
    return true;
  }
}
