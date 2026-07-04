import { UAParser } from "ua-parser-js";
import { Request } from "express";

export type TDeviceMeta = {
  ipAddress: string;
  userAgent: string;
  deviceName: string;
  deviceType: string;
};

/**
 * Pulls real client IP (respects reverse-proxy/nginx setups — see note below)
 * and parses the User-Agent into a human-readable device label.
 */
export const extractDeviceMeta = (req: Request): TDeviceMeta => {
  const rawUserAgent = req.headers["user-agent"] || "unknown";

  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const parsed = new UAParser(rawUserAgent).getResult();

  const browser = parsed.browser.name || "Unknown browser";
  const os = parsed.os.name || "Unknown OS";
  const deviceName = `${browser} on ${os}`;
  const deviceType = parsed.device.type || "desktop"; // 'mobile' | 'tablet' | undefined→desktop

  return {
    ipAddress,
    userAgent: rawUserAgent as string,
    deviceName,
    deviceType,
  };
};
