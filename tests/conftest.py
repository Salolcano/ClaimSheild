"""Minimal in-memory stand-in for the `genlayer` runtime so the contract's state machine
and ledger invariants can be unit-tested without a node. Consensus itself is NOT simulated."""
import importlib.util, pathlib, sys, types

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Address:
    def __init__(self, v): self.as_hex = str(v).lower()
    def __eq__(self, o): return isinstance(o, Address) and o.as_hex == self.as_hex
    def __hash__(self): return hash(self.as_hex)

class UserError(Exception): pass
class TreeMap(dict):
    def __class_getitem__(cls, item): return cls

class _Write:
    def __call__(self, f): return f
    def payable(self, f): return f

T = types.SimpleNamespace(msg=types.SimpleNamespace(sender_address=Address("0xowner"), value=0),
                          transfers=[], llm=lambda prompt: '{"verdict":"INCONCLUSIVE","reason":"x"}',
                          page="evidence")

class Contract:
    def __new__(cls, *a, **k):
        o = super().__new__(cls)
        for c in cls.__mro__:
            for n, t in getattr(c, "__annotations__", {}).items():
                if n in o.__dict__: continue
                o.__dict__[n] = TreeMap() if t is TreeMap else (0 if t is int else (Address("0x0") if t is Address else ""))
        return o

def _iface(cls):
    class R:
        def __init__(self, addr): self.addr = addr
        def emit_transfer(self, value): T.transfers.append((self.addr.as_hex, int(value)))
    return R

gl = types.ModuleType("genlayer")
gl.contract = types.SimpleNamespace(Contract=Contract)
gl.public = types.SimpleNamespace(view=lambda f: f, write=_Write())
gl.storage = types.SimpleNamespace(TreeMap=TreeMap)
gl.vm = types.SimpleNamespace(UserError=UserError)
gl.evm = types.SimpleNamespace(contract_interface=_iface)
gl.message = T.msg
gl.nondet = types.SimpleNamespace(web=types.SimpleNamespace(render=lambda url, mode="text": T.page),
                                  exec_prompt=lambda p: T.llm(p))
gl.eq_principle = types.SimpleNamespace(prompt_comparative=lambda fn, crit: fn())
gt = types.ModuleType("genlayer.types")
gt.Address, gt.u256 = Address, int
gl.types = gt
sys.modules["genlayer"], sys.modules["genlayer.types"] = gl, gt


def load(rel, cls):
    spec = importlib.util.spec_from_file_location(pathlib.Path(rel).stem, ROOT / rel)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return getattr(m, cls)

def as_(addr, value=0):
    T.msg.sender_address, T.msg.value = Address(addr), value

import pytest

@pytest.fixture
def t():
    T.transfers.clear(); T.page = "evidence"
    return T
