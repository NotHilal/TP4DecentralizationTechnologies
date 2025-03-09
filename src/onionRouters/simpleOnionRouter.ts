// src/onionRouters/simpleOnionRouter.ts
import express from "express";
import { Server } from "http";
import axios from "axios";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";
import {
  generateRsaKeyPair,
  rsaDecrypt,
  symDecrypt,
  MyCryptoKey,
} from "../crypto";

function bufferToBase64(buf: Buffer): string {
  return buf.toString("base64");
}
function base64ToBuffer(str: string): Buffer {
  return Buffer.from(str, "base64");
}

export function startNode(nodeId: number): Server {
  const app = express();
  app.use(express.json());

  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  const { publicKey, privateKey } = generateRsaKeyPair();

  (async () => {
    try {
      await axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, {
        nodeId,
        pubKey: bufferToBase64(publicKey.data),
      });
    } catch {}
  })();

  app.get("/status", (req, res) => {
    res.send("live");
  });

  app.get("/getPrivateKey", (req, res) => {
    res.json({ result: bufferToBase64(privateKey.data) });
  });

  app.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  app.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  app.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  app.post("/message", async (req, res) => {
    try {
      const { message } = req.body;
      lastReceivedEncryptedMessage = message;

      const dataBuf = base64ToBuffer(message);
      const rsaKeySize = 256;
      const encryptedSymKey = dataBuf.slice(0, rsaKeySize);
      const symEncryptedPayload = dataBuf.slice(rsaKeySize);

      // rsaDecrypt now returns a base64 string
      const rawSymKeyB64 = rsaDecrypt(encryptedSymKey, privateKey);
      // convert it back to raw bytes
      const rawSymKey = Buffer.from(rawSymKeyB64, "base64");

      const symKeyObj: MyCryptoKey = {
        algorithm: { name: "AES-CBC" },
        extractable: true,
        type: "secret",
        data: rawSymKey,
      };

      // symDecrypt => returns a base64 string
      const decryptedPayloadB64 = symDecrypt(symKeyObj, symEncryptedPayload);
      const decryptedPayload = Buffer.from(decryptedPayloadB64, "base64");

      const destinationString = decryptedPayload.slice(0, 10).toString("utf8");
      const nextDestinationPort = parseInt(destinationString, 10);
      lastMessageDestination = nextDestinationPort;

      const remainder = decryptedPayload.slice(10);
      lastReceivedDecryptedMessage = remainder.toString("utf8");

      await axios.post(`http://localhost:${nextDestinationPort}/message`, {
        message: bufferToBase64(remainder),
      });

      res.sendStatus(200);
    } catch (err) {
      console.error(`Node ${nodeId} /message error:`, err);
      res.sendStatus(500);
    }
  });

  const port = BASE_ONION_ROUTER_PORT + nodeId;
  const server = app.listen(port, () => {
    console.log(`Node ${nodeId} listening on port ${port}`);
  });
  return server;
}
