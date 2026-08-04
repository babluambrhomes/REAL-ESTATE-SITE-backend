import { Server } from "socket.io";
import { AuthenticatedSocket } from "./socket.types";

const registerHandlers = (io: Server, socket: AuthenticatedSocket): void => {
  console.log(`Socket connected: ${socket.id} | User: ${socket.userId}`);

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} | Reason: ${reason}`);
  });
};

export { registerHandlers };
