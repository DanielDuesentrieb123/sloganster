import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./src/server/socketServer";
import { ClientToServerEvents, ServerToClientEvents } from "./src/types/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: dev ? "*" : false,
    },
  });

  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Sloganster ready on http://${hostname}:${port}`);
  });
});
