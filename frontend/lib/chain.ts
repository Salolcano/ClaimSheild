import { createClient } from "genlayer-js";
import * as chains from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-next.genlayer.com/api";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 61997);
export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER || "https://explorer-studio-dev.genlayer.com";
export const CONTRACT = (process.env.NEXT_PUBLIC_POOL_ADDRESS || "") as `0x${string}`;

// Start from whichever Studio chain preset this genlayer-js build ships, then pin id + RPC to Studio Next.
const base: any = (chains as any).studioDevnet ?? (chains as any).studionext ?? (chains as any).studioNext ?? (chains as any).studionet;
export const chain: any = {
  ...base, id: CHAIN_ID, name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [RPC] } },
};

const client = (account?: string) => createClient({ chain, endpoint: RPC, account: account as any });
export const eth = () => (typeof window !== "undefined" ? (window as any).ethereum : undefined);

export async function connectWallet(): Promise<string> {
  if (!eth()) throw new Error("No wallet found. Install MetaMask, then reload.");
  const hex = "0x" + CHAIN_ID.toString(16);
  try {
    await eth().request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch {
    await eth().request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: hex, chainName: "GenLayer Studio Next", rpcUrls: [RPC],
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 }, blockExplorerUrls: [EXPLORER] }],
    });
  }
  const [a] = await eth().request({ method: "eth_requestAccounts" });
  return a as string;
}

export async function readJson<T = any>(fn: string, args: any[] = []): Promise<T> {
  const out: any = await client().readContract({ address: CONTRACT, functionName: fn, args });
  return JSON.parse(typeof out === "string" ? out : String(out));
}

// Consensus v0.6: every deploy/write must carry a fee quote. We size it per method, ask the SDK
// to price it against live network policy, and submit the returned distribution + feeValue unchanged.
// Unused budget is refunded at finalization. Regenerate/tune with a `gltest --fee-profile` run.
const MSG = BigInt(process.env.NEXT_PUBLIC_MESSAGE_FEES || "1000000000"); // budget for emitted payout transfers
const LIGHT = { leaderTimeunitsAllocation: 100n, validatorTimeunitsAllocation: 200n, totalMessageFees: 0n };
const HEAVY = { leaderTimeunitsAllocation: 400n, validatorTimeunitsAllocation: 800n, totalMessageFees: MSG }; // LLM + web + payout
const POLICY: Record<string, typeof LIGHT> = {
  evaluate_claim: HEAVY, appeal_claim: HEAVY, withdraw_free: { ...LIGHT, totalMessageFees: MSG },
};
export async function feesFor(c: any, fn: string) {
  const base = POLICY[fn] ?? LIGHT;
  const est = await c.estimateTransactionFees({ ...base, appealRounds: 1n, rotations: [1n, 1n] });
  return { distribution: est.distribution, feeValue: est.feeValue };
}

export async function send(account: string, fn: string, args: any[] = [], value: bigint = 0n) {
  const c: any = client(account);
  const fees = await feesFor(c, fn);
  const hash = await c.writeContract({ address: CONTRACT, functionName: fn, args, value, fees });
  const receipt: any = await c.waitForTransactionReceipt({
    hash, status: TransactionStatus.ACCEPTED, retries: 120, interval: 3000,
  });
  const res = receipt?.txExecutionResultName ?? receipt?.result_name;
  if (res && String(res).includes("ERROR")) throw new Error(`Transaction reverted (${res}). Open it in the explorer for details.`);
  return { hash: hash as string, receipt };
}

const ONE = 10n ** 18n;
export const toWei = (s: string): bigint => {
  const [w, f = ""] = s.trim().split(".");
  if (!/^\d+$/.test(w || "0") || !/^\d*$/.test(f)) throw new Error("Enter a valid amount, e.g. 0.5");
  return BigInt(w || "0") * ONE + BigInt((f + "0".repeat(18)).slice(0, 18));
};
export const fmt = (v: string | bigint | undefined): string => {
  const n = BigInt(v ?? 0);
  const frac = (n % ONE).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${n / ONE}.${frac}` : `${n / ONE}`;
};
export const short = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
