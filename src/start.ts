// src/start.ts
import { launchNetwork } from "./index";

async function main() {
  await launchNetwork(2, 2);
}

main();
