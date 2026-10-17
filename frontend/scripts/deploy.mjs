// Usage: npm run deploy:contract [path]   (defaults to ../contracts/policy_pool.py)
import fs from "node:fs";
import { loadEnv, wait, feesFor } from "./common.mjs";

const file = process.argv[2] || "../contracts/policy_pool.py";
const { account, client } = loadEnv();
console.log("Deployer:", account.address, "\nDeploying", file);
const hash = await client.deployContract({ code: fs.readFileSync(file, "utf8"), args: [], leaderOnly: false, fees: await feesFor(client, "__deploy__") });
console.log("Deploy tx:", hash);
const r = await wait(client, hash);
const addr = r?.data?.contract_address ?? r?.txDataDecoded?.contractAddress ?? r?.to_address;
if (!addr) { console.log("Receipt (address not found automatically, read it from the explorer):", JSON.stringify(r, (_, v) => typeof v === "bigint" ? v.toString() : v, 2)); process.exit(1); }
console.log("\nCONTRACT ADDRESS:", addr, "\nPut it in frontend/.env as NEXT_PUBLIC_POOL_ADDRESS");
