import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import prisma from "./prisma";
import { registerHandlers } from "../socket/socket.handlers";
import { AuthenticatedSocket } from "../socket/socket.types";

let io: Server;

const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as { id: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          memberships: {
            where: { scope: "PLATFORM", status: "ACTIVE" },
            select: {
              role: { select: { roleName: true } },
            },
          },
        },
      });

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.userId = user.id;
      socket.userRole = user.memberships[0]?.role?.roleName ?? "USER";
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    registerHandlers(io, socket);
  });

  return io;
};

const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket first.");
  }
  return io;
};

export { initSocket, getIO };
