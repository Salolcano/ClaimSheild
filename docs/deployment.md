# Deployment

## 1. Deploy the contract to Studio Next
Network: Studio Next · RPC `https://studio-next.genlayer.com/api` · chain ID `61997` · explorer https://explorer-studio-dev.genlayer.com

```bash
cd frontend
npm install
cp .env.example .env          # set DEPLOYER_PRIVATE_KEY (a throwaway key funded with GEN on Studio Next)
npm run deploy:contract       # prints CONTRACT ADDRESS
```
Put the printed address in `frontend/.env` as `NEXT_PUBLIC_POOL_ADDRESS`.
Alternative: paste `contracts/policy_pool.py` into the Studio Next UI, deploy with no constructor args, copy the address.

## 2. Prove it live (what a reviewer will check)
```bash
npm run e2e     # funds pool, runs a PAID claim and a DENIED+appeal claim, writes docs/e2e-evidence.json
npm run dev     # http://localhost:3000 ; connect MetaMask (the app adds chain 61997 for you)
```

## 3. Vercel
1. Push this repo to GitHub.
2. vercel.com → Add New → Project → import the repo.
3. **Root Directory:** `frontend` · Framework: Next.js (auto-detected).
4. Environment variables: `NEXT_PUBLIC_POOL_ADDRESS`, `NEXT_PUBLIC_GENLAYER_RPC`, `NEXT_PUBLIC_CHAIN_ID=61997`, `NEXT_PUBLIC_EXPLORER`.
   Do **not** add `DEPLOYER_PRIVATE_KEY` to Vercel.
5. Deploy. Any redeploy of the contract = new address = update the env var and redeploy.
