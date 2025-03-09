// src/registry/registry.ts
import express from "express";
import { Server } from "http";
import { REGISTRY_PORT } from "../config";

type RegisteredNode = {
  nodeId: number;
  pubKey: string;
};

// Clear each time we start:
const nodes: RegisteredNode[] = [];

export type GetNodeRegistryBody = {
  nodes: RegisteredNode[];
};

export function startRegistry(): Server {
  // Ensure each fresh launch starts with no nodes
  nodes.length = 0;

  const app = express();
  app.use(express.json());

  app.get("/status", (req, res) => {
    res.send("live");
  });

  app.post("/registerNode", (req, res) => {
    const { nodeId, pubKey } = req.body;
    nodes.push({ nodeId, pubKey });
    res.sendStatus(200);
  });

  app.get("/getNodeRegistry", (req, res) => {
    const body: GetNodeRegistryBody = { nodes };
    res.json(body);
  });

  const server = app.listen(REGISTRY_PORT, () => {
    console.log(`Registry listening on port ${REGISTRY_PORT}`);
  });
  return server;
}
