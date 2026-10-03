import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { redis } from "../config/redis";
import { AuthenticatedRequest, TokenPayload, UserRole } from "../types";

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Read token from cookies (DevTinder pattern)
  let token = req.cookies?.token || req.cookies?.accessToken || null;

  // 2. Fallback to Authorization: Bearer <token> header
  if (!token) {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  // 3. Support token from query param for EventSource (SSE) connections
  if (!token && req.query.token) {
    token = String(req.query.token);
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Access denied. Authentication token missing.",
    });
    return;
  }

  try {
    // 1. Check if token is blacklisted in Redis (revoked on logout)
    const isBlacklisted = await redis.get(`bl:${token}`);
    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        message: "Token has been revoked. Please log in again.",
      });
      return;
    }

    // 2. Verify JWT signature (try ACCESS_SECRET first, fallback to JWT_SECRET)
    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, ENV.JWT_ACCESS_SECRET) as TokenPayload;
    } catch {
      decoded = jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
    }

    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token. Please refresh or log in again.",
    });
    return;
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in.",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Requires one of roles: [${allowedRoles.join(", ")}]. Current: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}
