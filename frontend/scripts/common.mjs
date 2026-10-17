import { createClient, createAccount } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import fs from "node:fs";

export const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-next.genlayer.com/api";
const base = chains.studioDevnet ?? chains.studionext ?? chains.studioNext ?? chains.studionet;
export const chain = { ...base, id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 61997), name: "GenLayer Studio Next", rpcUrls: { default: { http: [RPC] } } };

export function loadEnv() {
  if (fs.existsSync(".env")) for (const l of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("Set DEPLOYER_PRIVATE_KEY in frontend/.env");
  const account = createAccount(process.env.DEPLOYER_PRIVATE_KEY);
  return { account, client: createClient({ chain, endpoint: RPC, account }) };
}
export async function wait(client, hash) {
  const r = await client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED, retries: 120, interval: 3000 });
  const res = r?.txExecutionResultName ?? r?.result_name;
  if (res && String(res).includes("ERROR")) throw new Error(`tx ${hash} failed: ${res}`);
  return r;
}

const MSG = BigInt(process.env.NEXT_PUBLIC_MESSAGE_FEES || "1000000000");
const LIGHT = { leaderTimeunitsAllocation: 100n, validatorTimeunitsAllocation: 200n, totalMessageFees: 0n };
const HEAVY = { leaderTimeunitsAllocation: 400n, validatorTimeunitsAllocation: 800n, totalMessageFees: MSG };
const POLICY = { evaluate_claim: HEAVY, appeal_claim: HEAVY, withdraw_free: { ...LIGHT, totalMessageFees: MSG } };
// Consensus v0.6: price the fee against live network policy, then submit distribution + feeValue unchanged.
export async function feesFor(client, fn) {
  const est = await client.estimateTransactionFees({ ...(POLICY[fn] ?? LIGHT), appealRounds: 1n, rotations: [1n, 1n] });
  return { distribution: est.distribution, feeValue: est.feeValue };
}
