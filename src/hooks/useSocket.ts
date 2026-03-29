"use client";

import { useEffect } from "react";
import { connectSocket, getSocket } from "../lib/socket";
import { Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "../types/socket";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket(): TypedSocket {
  useEffect(() => {
    // Connect once, keep alive across page navigations
    connectSocket();
  }, []);

  return getSocket();
}
