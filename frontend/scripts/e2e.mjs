// Live end-to-end run against Studio Next. Writes evidence to ../docs/e2e-evidence.json
import fs from "node:fs";
import { loadEnv, wait, feesFor } from "./common.mjs";

const { account, client } = loadEnv();
const address = process.env.NEXT_PUBLIC_POOL_ADDRESS; if (!address) throw new Error("Set NEXT_PUBLIC_POOL_ADDRESS");
const GEN = 10n ** 18n, ev = [];
const call = async (fn, args = [], value = 0n) => {
  const hash = await client.writeContract({ address, functionName: fn, args, value, fees: await feesFor(client, fn) });
  await wait(client, hash); ev.push({ fn, args: args.map(String), hash }); console.log("✓", fn, hash); return hash;
};
const read = async (fn, args = []) => JSON.parse(await client.readContract({ address, functionName: fn, args }));
const URL = "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_final";

await call("fund_pool", [], 5n * GEN);
let s = await read("get_stats"); const start = s.policy_count;

// Scenario 1: evidence satisfies terms -> PAID
await call("buy_policy", ["CUSTOM", "Final decided on penalties", URL, "Pay if the page confirms the 2022 FIFA World Cup final was decided by a penalty shoot-out.", GEN], GEN / 10n);
const p1 = start + 1; await call("file_claim", [p1, "e2e"]); const c1 = (await read("get_stats")).claim_count;
await call("evaluate_claim", [c1]); const r1 = (await read("list_claims")).find((c) => c.id === c1);
console.log("Scenario 1 ->", r1.status, r1.reason);

// Scenario 2: evidence contradicts terms -> DENIED, then appeal
await call("buy_policy", ["CUSTOM", "Brazil won", URL, "Pay only if the page states that Brazil won the 2022 FIFA World Cup final.", GEN], GEN / 10n);
await call("file_claim", [p1 + 1, "e2e"]); const c2 = (await read("get_stats")).claim_count;
await call("evaluate_claim", [c2]); let r2 = (await read("list_claims")).find((c) => c.id === c2);
console.log("Scenario 2 first verdict ->", r2.status, r2.reason);
if (r2.status === "DENIED") { await call("appeal_claim", [c2]); r2 = (await read("list_claims")).find((c) => c.id === c2); console.log("After appeal ->", r2.status); }

s = await read("get_stats"); console.log("Final stats", s);
fs.writeFileSync("../docs/e2e-evidence.json", JSON.stringify({ address, network: "studio-next", ev, scenario1: r1, scenario2: r2, stats: s }, null, 2));
