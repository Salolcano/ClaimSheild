# ClaimShield — parametric cover settled by GenLayer validators

Buy cover with plain-English terms and a public evidence URL. On a claim, a GenLayer validator ensemble
reads the page, agrees on **PAID / DENIED / INCONCLUSIVE** via `prompt_comparative`, and the contract moves
real native tokens. Denied holders get one reconsideration appeal (ambiguity resolves for the holder).

| Piece | Where |
|---|---|
| Main Intelligent Contract `PolicyPool` | `contracts/policy_pool.py` |
| Standalone `EvidenceOracle` primitive | `standalone/evidence_oracle.py` |
| Next.js dapp + dashboard (genlayer-js) | `frontend/` |
| Unit tests (state machine, ledger invariants) | `tests/` |
| Deploy + live e2e scripts | `frontend/scripts/` |
| Deployment guide incl. Vercel | `docs/deployment.md` |

## Why GenLayer
Whether a web page proves "flight delayed more than 3 hours" is subjective, evidence is messy, and a single
oracle or admin is a trust hole. Here every verdict is validator consensus over live web content, and payouts follow it.

## Claim state machine
`ACTIVE` policy → `file_claim` → `PENDING` → `evaluate_claim` →
`PAID` (transfer, terminal) · `DENIED` (payout stays reserved) · `INCONCLUSIVE` (retry ≤3 or `withdraw_claim`).
`DENIED` → `appeal_claim` → `PAID` or `DENIED_FINAL`; or `finalize_denial` (holder anytime, anyone after 3 more claims).

Invariants (tested): `liquidity >= reserved`, `reserved == Σ payouts of ACTIVE/CLAIMED policies`; a payout can never be
funded from free capacity that is already promised; unparseable model output can never pay.

## Run
```bash
pip install -r requirements.txt && pytest -q      # contracts logic (genlayer runtime stubbed)
cd frontend && cp .env.example .env && npm install && npm run dev
```
Demo: on **Get cover** use *Demo: should pay* / *Demo: should deny* (Wikipedia evidence), file the claim, press **Run validators**.

## Honest limits
Unit tests stub the GenLayer runtime and do **not** simulate consensus; live behaviour is proven by `npm run e2e`.
Web evidence is judged as rendered text; the holder's note is treated as untrusted input.
