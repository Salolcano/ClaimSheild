import json
import pytest
from conftest import load, as_, UserError

OWNER, ALICE, BOB = "0xowner", "0xa11ce", "0xb0b"
TERMS = "Pay if flight XY123 on 2026-11-01 arrived more than 3 hours late."

def verdict(v): return lambda p: json.dumps({"verdict": v, "reason": "because"})

@pytest.fixture
def pool(t):
    as_(OWNER); c = load("contracts/policy_pool.py", "PolicyPool")()
    as_(OWNER, 10_000); c.fund_pool(); return c

def buy(c, who=ALICE, premium=100, payout=1000):
    as_(who, premium)
    c.buy_policy("FLIGHT_DELAY", "XY123", "https://example.com/flight", TERMS, payout)

def invariants(c):
    locked = sum(int(p["payout"]) for p in map(json.loads, c.policies.values()) if p["status"] in ("ACTIVE", "CLAIMED"))
    assert int(c.liquidity) >= int(c.reserved) == locked

def test_buy_reserves_and_validates(pool):
    buy(pool); assert pool.reserved == 1000 and pool.liquidity == 10_100; invariants(pool)
    with pytest.raises(UserError): buy(pool, premium=10)                    # < 5% of payout
    with pytest.raises(UserError): buy(pool, premium=5000, payout=50_000)   # pool cannot cover

def test_paid_claim_transfers_and_releases(pool, t):
    buy(pool); as_(ALICE); pool.file_claim(1, "late")
    t.llm = verdict("PAID"); pool.evaluate_claim(1)
    assert t.transfers == [(ALICE, 1000)] and pool.paid_total == 1000
    assert pool.reserved == 0 and pool.liquidity == 9_100; invariants(pool)
    assert json.loads(pool.claims[1])["status"] == "PAID"

def test_denied_then_appeal_reversal_pays(pool, t):
    buy(pool); as_(ALICE); pool.file_claim(1, "late")
    t.llm = verdict("DENIED"); pool.evaluate_claim(1)
    assert pool.reserved == 1000 and not t.transfers; invariants(pool)   # reserved during appeal window
    t.llm = verdict("PAID"); pool.appeal_claim(1)
    assert t.transfers == [(ALICE, 1000)] and pool.reserved == 0
    with pytest.raises(UserError): pool.appeal_claim(1)

def test_denied_appeal_upheld_releases_reservation(pool, t):
    buy(pool); as_(ALICE); pool.file_claim(1, "late")
    t.llm = verdict("DENIED"); pool.evaluate_claim(1); pool.appeal_claim(1)
    assert pool.reserved == 0 and pool.liquidity == 10_100 and not t.transfers
    assert json.loads(pool.claims[1])["status"] == "DENIED_FINAL"

def test_finalize_only_holder_or_after_window(pool, t):
    buy(pool); buy(pool, BOB); as_(ALICE); pool.file_claim(1, "late")
    t.llm = verdict("DENIED"); pool.evaluate_claim(1)
    as_(BOB)
    with pytest.raises(UserError): pool.finalize_denial(1)   # window still open
    pool.file_claim(2, "x"); pool.claim_count = 4            # simulate 3 later claims
    pool.finalize_denial(1)
    assert pool.reserved == 1000                              # only Bob's open policy stays locked

def test_inconclusive_retry_budget_and_withdraw(pool, t):
    buy(pool); as_(ALICE); pool.file_claim(1, "late"); t.llm = verdict("INCONCLUSIVE")
    for _ in range(3): pool.evaluate_claim(1)
    with pytest.raises(UserError): pool.evaluate_claim(1)
    pool.withdraw_claim(1); assert json.loads(pool.policies[1])["status"] == "ACTIVE"

def test_access_control_and_garbage_output_never_pays(pool, t):
    buy(pool); as_(BOB)
    with pytest.raises(UserError): pool.file_claim(1, "steal")
    as_(ALICE); pool.file_claim(1, "x"); as_(BOB)
    with pytest.raises(UserError): pool.evaluate_claim(1)
    t.llm = lambda p: "garbage not json"; as_(ALICE); pool.evaluate_claim(1)
    assert json.loads(pool.claims[1])["status"] == "INCONCLUSIVE" and not t.transfers

def test_withdraw_free_cannot_touch_reserved(pool):
    buy(pool); as_(OWNER)
    with pytest.raises(UserError): pool.withdraw_free(10_000)   # free = 9_100
    pool.withdraw_free(9_100); assert pool.liquidity == 1000 == pool.reserved
    as_(ALICE)
    with pytest.raises(UserError): pool.withdraw_free(1)

def test_oracle_attest(t):
    as_(OWNER); o = load("standalone/evidence_oracle.py", "EvidenceOracle")()
    t.llm = lambda p: '{"verdict":"TRUE","reason":"ok"}'
    o.attest("https://example.com", "The sky is blue today"); assert o.get_count() == 1
    assert json.loads(o.get_attestation(1))["verdict"] == "TRUE"
