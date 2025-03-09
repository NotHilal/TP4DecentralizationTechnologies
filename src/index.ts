// src/index.ts
import { startRegistry } from "./registry/registry";
import { startNode } from "./onionRouters/simpleOnionRouter";
import { startUser } from "./users/user";
import type { Server } from "http";

export async function launchNetwork(numRouters: number, numUsers: number): Promise<Server[]> {
  const servers: Server[] = [];

  const registryServer = startRegistry();
  servers.push(registryServer);

  for (let i = 0; i < numRouters; i++) {
    const nodeServer = startNode(i);
    servers.push(nodeServer);
  }

  for (let j = 0; j < numUsers; j++) {
    const userServer = startUser(j);
    servers.push(userServer);
  }

  return servers;
}
