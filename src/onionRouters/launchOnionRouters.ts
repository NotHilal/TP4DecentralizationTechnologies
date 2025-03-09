// src/launchOnionRouters.ts
import { startNode } from "./onionRouters/simpleOnionRouter";
import type { Server } from "http";

export async function launchOnionRouters(n: number): Promise<Server[]> {
  const servers: Server[] = [];
  for (let i = 0; i < n; i++) {
    const srv = startNode(i);
    servers.push(srv);
  }
  return servers;
}
