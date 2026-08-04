import { z } from "zod";
import { RIOT_PLATFORMS } from "../../../lib/riot/regions";

const startLinkValidation = z.object({
  riotId: z
    .string({ message: "riotId is required" })
    .regex(/^.+#.+$/, "Riot ID must be in the form Name#Tag, e.g. Awakero#EUW"),
  platform: z.enum(RIOT_PLATFORMS, { message: "Invalid Riot platform" }),
});

export const riotValidation = { startLinkValidation };
