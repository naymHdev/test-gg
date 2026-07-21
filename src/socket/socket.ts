import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { authUtils } from "../app/modules/auth/auth.utils";
import { prisma } from "../shared/prisma";
import { redis } from "../shared/redis";
import config from "../app/config";
import { getFriendIds } from "../app/modules/friend/friend.service";

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    role: string;
  };
}

let io: SocketIOServer;
const userSockets = new Map<string, Set<string>>();

export const initSocket = (server: HTTPServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => callback(null, origin || true),
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) return next(new Error("Unauthorized"));

      const decoded = authUtils.verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, status: true },
      });

      if (!user) return next(new Error("Unauthorized"));
      if (user.status === "Banned" || user.status === "Suspended") {
        return next(new Error("Account is not active"));
      }

      (socket as AuthedSocket).data.userId = user.id;
      (socket as AuthedSocket).data.role = user.role;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => onConnection(socket as AuthedSocket));

  return io;
};

const onConnection = async (socket: AuthedSocket) => {
  const { userId } = socket.data;
  console.log(`🔌 Socket connected: ${socket.id} (user: ${userId})`);

  socket.join(`user:${userId}`);

  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socket.id);

  if (userSockets.get(userId)!.size === 1) {
    await redis.set(
      `presence:${userId}`,
      "online",
      "EX",
      config.redis.presence_ttl_seconds,
    );
    const friendIds = await getFriendIds(userId);
    friendIds.forEach((fid) =>
      io
        .to(`user:${fid}`)
        .emit("presence:update", { userId, status: "online" }),
    );
  }

  socket.on("typing:start", ({ receiverId }: { receiverId: string }) => {
    if (!receiverId) return;
    io.to(`user:${receiverId}`).emit("typing:start", { userId });
  });

  socket.on("typing:stop", ({ receiverId }: { receiverId: string }) => {
    if (!receiverId) return;
    io.to(`user:${receiverId}`).emit("typing:stop", { userId });
  });

  socket.on("message:read", ({ senderId }: { senderId: string }) => {
    if (!senderId) return;
    io.to(`user:${senderId}`).emit("message:read", { by: userId });
  });

  // ---- Voice channel real-time room ----
  // Client calls this right after a successful /join REST call (once it has
  // a streamToken) so it starts receiving channel-scoped broadcasts
  // (user joined/left, muted, kicked, chat messages, etc).
  socket.on("channel:join", ({ channelId }: { channelId: string }) => {
    if (!channelId) return;
    socket.join(`channel:${channelId}`);
    socket
      .to(`channel:${channelId}`)
      .emit("channel:user_joined", { channelId, userId });
  });

  socket.on("channel:leave", ({ channelId }: { channelId: string }) => {
    if (!channelId) return;
    socket.leave(`channel:${channelId}`);
    socket
      .to(`channel:${channelId}`)
      .emit("channel:user_left", { channelId, userId });
  });

  socket.on("disconnect", async () => {
    console.log(`🔌 Socket disconnected: ${socket.id} (user: ${userId})`);

    const sockets = userSockets.get(userId);
    if (!sockets) return;
    sockets.delete(socket.id);

    if (sockets.size === 0) {
      userSockets.delete(userId);
      await redis.set(
        `presence:${userId}`,
        "offline",
        "EX",
        config.redis.presence_ttl_seconds,
      );
      const friendIds = await getFriendIds(userId);
      friendIds.forEach((fid) =>
        io
          .to(`user:${fid}`)
          .emit("presence:update", { userId, status: "offline" }),
      );
    }
  });
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io has not been initialized yet");
  return io;
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};

export const emitToChannel = (
  channelId: string,
  event: string,
  payload: unknown,
) => {
  if (!io) return;
  io.to(`channel:${channelId}`).emit(event, payload);
};

export const isUserOnline = (userId: string) => userSockets.has(userId);
