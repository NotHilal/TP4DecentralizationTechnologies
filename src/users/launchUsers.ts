// src/launchUsers.ts
import { startUser } from "./users/user";
import type { Server } from "http";

export async function launchUsers(n: number): Promise<Server[]> {
  const servers: Server[] = [];
  for (let i = 0; i < n; i++) {
    const srv = startUser(i);
    servers.push(srv);
  }
  return servers;
}
