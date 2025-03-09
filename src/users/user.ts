// src/users/user.ts
import express from "express";
import axios from "axios";
import { Server } from "http";
import {
  BASE_USER_PORT,
  REGISTRY_PORT,
  BASE_ONION_ROUTER_PORT,
} from "../config";
import {
  rsaEncrypt,
  symEncrypt,
  createRandomSymmetricKey,
  MyCryptoKey,
} from "../crypto";

// Helper to decode base64 if it’s valid; otherwise just return the string as-is.
function decodeMaybeBase64(str: string): string {
  // quick check if str might be base64
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(str)) {
    try {
      return Buffer.from(str, "base64").toString("utf8");
    } catch {
      // if decoding fails, return original
      return str;
    }
  }
  return str;
}

function bufferToBase64(buf: Buffer): string {
  return buf.toString("base64");
}
function base64ToBuffer(str: string): Buffer {
  return Buffer.from(str, "base64");
}

// We store the last random circuit for the /getLastCircuit route
let lastCircuit: number[] | null = null;

export function startUser(userId: number): Server {
  const app = express();
  app.use(express.json());

  let lastReceivedMessage: string | null = null;
  let lastSentMessage: string | null = null;

  lastCircuit = null;

  app.get("/status", (req, res) => {
    res.send("live");
  });

  app.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  app.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  // Some tests call this to see which 3 nodes were chosen
  app.get("/getLastCircuit", (req, res) => {
    res.json({ result: lastCircuit });
  });

  // For direct message POSTs to this user
  app.post("/message", (req, res) => {
    const { message } = req.body;
    // The final onion message arrives in base64, so decode it if possible
    const decoded = decodeMaybeBase64(message);
    lastReceivedMessage = decoded;
    // Some tests expect "success"
    res.send("success");
  });

  app.post("/sendMessage", async (req, res) => {
    try {
      const { message, destinationUserId } = req.body;
      lastSentMessage = message;

      // fetch node registry
      const registryRes = await axios.get(
        `http://localhost:${REGISTRY_PORT}/getNodeRegistry`
      );
      const { nodes } = registryRes.data as { nodes: any[] };

      // need at least 3 nodes
      if (!nodes || nodes.length < 3) {
        return res
          .status(500)
          .send("Not enough nodes registered to form a 3-node circuit");
      }

      // pick 3 distinct nodes
      const selectedNodes = pickRandomUniqueNodes(nodes, 3);
      // store their IDs so /getLastCircuit can show them
      lastCircuit = selectedNodes.map((n) => n.nodeId);

      let nextPort = BASE_USER_PORT + destinationUserId;
      let currentLayer = Buffer.from(message, "utf8");

      // Build 3-layer onion in reverse order
      for (let i = selectedNodes.length - 1; i >= 0; i--) {
        const node = selectedNodes[i];

        const symKey = createRandomSymmetricKey();

        const destString = zeroPadPort(nextPort);
        // plain payload => [destination, currentLayer]
        const plainPayload = Buffer.concat([
          Buffer.from(destString, "utf8"),
          currentLayer,
        ]);

        // Symmetric encrypt
        const symEncrypted = symEncrypt(symKey, plainPayload);

        // RSA-encrypt the raw symmetric key
        const nodePubKeyBuf = base64ToBuffer(node.pubKey);
        const nodePubKeyObject: MyCryptoKey = {
          algorithm: { name: "RSA-OAEP" },
          extractable: true,
          type: "public",
          data: nodePubKeyBuf,
        };
        const encSymKey = rsaEncrypt(symKey.data, nodePubKeyObject);

        // Combine => onion layer
        const onionLayer = Buffer.concat([encSymKey, symEncrypted]);
        currentLayer = onionLayer;
        // next hop => node's port
        nextPort = BASE_ONION_ROUTER_PORT + node.nodeId;
      }

      // Send onion to the first node
      const entryNodePort = BASE_ONION_ROUTER_PORT + selectedNodes[0].nodeId;
      await axios.post(`http://localhost:${entryNodePort}/message`, {
        message: bufferToBase64(currentLayer),
      });

      return res.sendStatus(200);
    } catch (err) {
      console.error(`User ${userId} /sendMessage error:`, err);
      return res.sendStatus(500);
    }
  });

  function pickRandomUniqueNodes(allNodes: any[], count: number) {
    const shuffled = [...allNodes].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  function zeroPadPort(port: number) {
    return port.toString().padStart(10, "0");
  }

  const port = BASE_USER_PORT + userId;
  const server = app.listen(port, () => {
    console.log(`User ${userId} listening on port ${port}`);
  });
  return server;
}
