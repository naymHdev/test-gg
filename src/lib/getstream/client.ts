import { StreamClient } from "@stream-io/node-sdk";
import config from "../../app/config";

if (
  !config.getStream.get_stream_api_key ||
  !config.getStream.get_stream_api_secret
) {
  // fail fast at boot instead of a confusing 401 from Stream later
  throw new Error("GETSTREAM_API_KEY / GETSTREAM_API_SECRET is missing in env");
}

export const streamClient = new StreamClient(
  config.getStream.get_stream_api_key,
  config.getStream.get_stream_api_secret,
);

/**
 * Ensures the user exists on Stream's side (id/name/image sync) before we
 * issue a token or add them as a call member. Cheap upsert — safe to call
 * on every join.
 */
export const upsertStreamUser = async (user: {
  id: string;
  username: string;
  avatarUrl?: string | null;
}) => {
  await streamClient.upsertUsers([
    {
      id: user.id,
      name: user.username,
      image: user.avatarUrl ?? undefined,
    },
  ]);
};

export const generateStreamUserToken = (userId: string) => {
  const iat = Math.floor(Date.now() / 1000) - 60;
  const validitySeconds =
    Number(config.getStream.get_stream_token_expiry_seconds) || 3600;
  const exp = iat + validitySeconds;

  return streamClient.generateUserToken({ user_id: userId, iat, exp });
};
