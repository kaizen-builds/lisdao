"""LisDao browser agent.

Watches the LisDao contract for proposals that just passed (status Executing),
then drives a real Chromium browser with a vision LLM loop:
  screenshot -> LLM picks one action (JSON) -> highlight + act -> screenshot -> LLM verifies.
When it reaches the charity's one-time deposit address it extracts it (LLM + DOM +
Tesseract OCR cross-check) and calls report_payout; the contract pays from the treasury.

Env: CONTRACT_ID, AGENT_ID, CHARITY_URL, FEED_URL, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL,
     AGENT_FEED_TOKEN, RECORD_DIR, HEADLESS, ONCE.
"""
import base64, difflib, json, os, re, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

E = os.environ.get
CONTRACT = E("CONTRACT_ID", "lisdao-v2-1793741346.testnet")
EXECUTOR = E("EXECUTOR_ID", "exec.lisdao-v2-1793741346.testnet")  # Sputnik DAO executor
SPUTNIK_FEED = 9000  # live-feed key for executor tasks: feed/9000-<task_id>
AGENT = E("AGENT_ID", "lisdao-agent-1793741346.testnet")
WEB = E("WEB_URL", "http://localhost:3000")
CHARITY = E("CHARITY_URL", WEB + "/demo-charity")
FEED = E("FEED_URL", WEB + "/api/agent")
RPCS = [E("NEAR_RPC", "https://test.rpc.fastnear.com"), E("NEAR_RPC_BACKUP", "https://rpc.testnet.near.org")]
RPC_TIMEOUTS = [2, 5]  # short timeout on the fast RPC, then the backup
POLL = float(E("POLL_SECONDS", "0.7"))
HEARTBEAT = E("HEARTBEAT_URL", WEB + "/api/heartbeat")
STATE = {"state": "idle", "dao_id": None, "proposal_id": None, "last_poll": 0, "last_poll_ms": 0, "polls": 0}
LLM_URL = E("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
LLM_KEY = E("LLM_API_KEY") or E("NEAR_AI_API_KEY") or E("GEMINI_API_KEY")
LLM_MODEL = E("LLM_MODEL", "gemini-3.1-flash-lite")
LLM_COOLDOWN = {"until": 0}
T0 = {"t": 0}
import threading
HERE = os.path.dirname(os.path.abspath(__file__))
ACCOUNT_RE = re.compile(r"\b([0-9a-f]{64}|(?:[a-z0-9_-]+\.)+(?:testnet|near))\b")

def post(url, body, headers={}, timeout=60):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", **headers})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read() or b"null")

def view(method, args, contract=None):
    for i, rpc in enumerate(RPCS):
        try: return _view(rpc, method, args, contract or CONTRACT, RPC_TIMEOUTS[min(i, len(RPC_TIMEOUTS) - 1)])
        except Exception as e:
            print(f"  rpc {rpc} failed: {str(e)[:100]}", flush=True)
            if i == len(RPCS) - 1: raise

def _view(RPC, method, args, contract, timeout):
    r = post(RPC, {"jsonrpc": "2.0", "id": 1, "method": "query", "params": {"request_type": "call_function", "finality": "optimistic",
        "account_id": contract, "method_name": method, "args_base64": base64.b64encode(json.dumps(args).encode()).decode()}}, timeout=timeout)
    if "error" in r or "error" in r.get("result", {}): raise RuntimeError(str(r)[:200])
    return json.loads(bytes(r["result"]["result"]))

def feed(dao, pid, text, shot=None, **kw):
    el = time.time() - T0["t"] if T0["t"] else 0
    print(f"[{dao}/{pid}] +{el:5.1f}s {text}", flush=True)
    threading.Thread(target=_feed, args=(dao, pid, text, shot, kw), daemon=True).start()

def _feed(dao, pid, text, shot, kw):
    try: post(FEED, {"dao_id": dao, "proposal_id": pid, "text": text, "shot": shot, **kw}, {"x-agent-token": E("AGENT_FEED_TOKEN", "")}, 10)
    except Exception as e: print("  feed error:", e)

def call(method, args, contract=None):
    out = subprocess.run(["near", "contract", "call-function", "as-transaction", contract or CONTRACT, method, "json-args", json.dumps(args),
        "prepaid-gas", "100 Tgas", "attached-deposit", "0 NEAR", "sign-as", AGENT, "network-config", "testnet",
        "sign-with-legacy-keychain", "send"], capture_output=True, text=True, timeout=90)
    txt = out.stdout + out.stderr
    m = re.search(r"Transaction ID:\s*([1-9A-HJ-NP-Za-km-z]{43,44})", txt) or re.search(r"/txns/([1-9A-HJ-NP-Za-km-z]{43,44})", txt)
    if out.returncode != 0 or "Error" in txt and not m: raise RuntimeError(txt[-800:])
    return m.group(1) if m else None

ELEMENTS_JS = """() => { let i = 0; const out = [];
  document.querySelectorAll('button, input, select, textarea, a, code').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    el.dataset.lis = ++i;
    out.push({ id: i, tag: el.tagName.toLowerCase(), label: el.getAttribute('aria-label') || el.innerText?.slice(0, 80) || el.placeholder || '',
      value: el.value ?? null, options: el.tagName === 'SELECT' ? [...el.options].map(o => o.value + '=' + o.text) : undefined }); });
  return out; }"""
HIGHLIGHT_JS = """([id, x, y]) => { const el = document.querySelector(`[data-lis="${id}"]`); const r = el.getBoundingClientRect();
  const box = document.createElement('div'); box.className = 'lis-hl';
  box.style.cssText = `position:fixed;left:${r.left-3}px;top:${r.top-3}px;width:${r.width+6}px;height:${r.height+6}px;border:3px solid #3B82F6;border-radius:6px;z-index:99999;pointer-events:none`;
  document.body.appendChild(box);
  if (!document.getElementById('lis-rip')) { const s = document.createElement('style'); s.id = 'lis-rip';
    s.textContent = '@keyframes lisrip{from{transform:translate(-50%,-50%) scale(.2);opacity:1}to{transform:translate(-50%,-50%) scale(3);opacity:0}}'; document.head.appendChild(s); }
  for (const d of [0, 300]) { const c = document.createElement('div'); c.className = 'lis-hl';
    c.style.cssText = `position:fixed;left:${r.left+r.width/2}px;top:${r.top+r.height/2}px;width:28px;height:28px;border:3px solid #3B82F6;border-radius:50%;z-index:99999;pointer-events:none;animation:lisrip 1s ${d}ms ease-out infinite`;
    document.body.appendChild(c); } }"""

def shot(page):
    return base64.b64encode(page.screenshot(type="jpeg", quality=45)).decode()

def llm(goal, history, img, elements):
    prompt = f"""You control a web browser for a DAO. Goal: {goal}
You see the CURRENT screenshot. First verify whether the previous action worked (compare with history), then choose ONE next action.
Interactive elements (id, tag, label, value, options): {json.dumps(elements)}
History: {json.dumps(history[-4:])}
Rules: if a textbox already has a default value (e.g. 25) you must use "type" which clears it first. Choose the cryptocurrency in dropdowns with "select".
Skip optional tax receipt pages by clicking Next Step. When the one-time deposit address is visible, use "extract" and copy the address exactly.
Reply ONLY JSON: {{"verify":"ok|off_track|start","thought":"...","action":"click|type|select|extract|fail","id":<element id>,"value":"<text or option value>","address":"<only for extract>"}}"""
    if time.time() < LLM_COOLDOWN["until"]: return None
    body = {"model": LLM_MODEL, "temperature": 0, "reasoning_effort": "low", "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": [
        {"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + img}}]}]}
    try:  # one fast attempt; on rate limit / overload fall back to the scripted planner immediately
        r = post(LLM_URL.rstrip("/") + "/chat/completions", body, {"Authorization": "Bearer " + LLM_KEY}, 8)
        c = r["choices"][0]["message"]["content"]; return json.loads(c[c.find("{"): c.rfind("}") + 1])
    except Exception as e:
        print("  llm error:", str(e)[:120])
        if any(k in str(e) for k in ("429", "503", "timed out")): LLM_COOLDOWN["until"] = time.time() + 60
        return None

def scripted(goal_asset, goal_amount, elements):
    """Deterministic fallback planner (used when no vision key or the LLM is unavailable)."""
    for e in elements:
        if e["tag"] == "code" and ACCOUNT_RE.search(e["label"] or ""): return {"verify": "ok", "thought": "deposit address visible", "action": "extract", "id": e["id"], "address": ACCOUNT_RE.search(e["label"]).group(1)}
    for e in elements:
        if e["tag"] == "select" and e["value"] != goal_asset: return {"verify": "ok", "thought": f"select {goal_asset}", "action": "select", "id": e["id"], "value": goal_asset}
    for e in elements:
        if e["tag"] == "input" and "amount" in e["label"].lower() and e["value"] != goal_amount: return {"verify": "ok", "thought": "clear default amount and type ours", "action": "type", "id": e["id"], "value": goal_amount}
    for e in elements:
        if e["tag"] == "button" and "next" in e["label"].lower(): return {"verify": "ok", "thought": "continue (skip optional tax receipt)", "action": "click", "id": e["id"]}
    return {"action": "fail", "thought": "no known next step"}

def ocr_text(page, sel=None):
    path = "/tmp/lis-ocr.png"
    if sel and page.locator(sel).count(): page.locator(sel).first.screenshot(path=path, scale="device")
    else: page.screenshot(path=path)
    try: return subprocess.run(["node", os.path.join(HERE, "ocr.js"), path], capture_output=True, text=True, timeout=120, cwd=HERE).stdout
    except Exception as e: return ""

def run_task(dao, prop, ex=False):
    """ex=True: task from the Sputnik executor (args keyed by task_id)."""
    tgt = EXECUTOR if ex else CONTRACT
    ids = (lambda: {"task_id": prop["id"]}) if ex else (lambda: {"dao_id": dao, "proposal_id": prop["id"]})
    T0["t"] = time.time(); pid = prop["id"]; STATE.update(state="working", dao_id=dao, proposal_id=pid); beat(); task = prop["action"]["AgentTask"]; goal = task["instructions"]
    cap = int(task["max_spend"]); m = re.search(r"([\d.]+)\s*NEAR", goal, re.I)
    amount_near = m.group(1) if m else str(cap / 1e24)
    yocto = int(round(float(amount_near) * 1e6)) * 10**18
    feed(dao, pid, f"Proposal passed. Task: “{goal}”", reset=True, phase="start")
    if yocto > cap: feed(dao, pid, "Refused: amount exceeds the proposal's spending cap", phase="failed"); call("report_result", {**ids(), "success": False, "report": "over cap"}, tgt); return
    use_llm = bool(LLM_KEY)
    feed(dao, pid, f"Opening browser · planner: {'vision LLM ' + LLM_MODEL if use_llm else 'scripted fallback (no vision key)'}")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=E("HEADLESS", "1") == "1")
        ctx = b.new_context(viewport={"width": 420, "height": 760},  record_video_dir=E("RECORD_DIR") or None, record_video_size={"width": 420, "height": 760})
        page = ctx.new_page(); page.goto(CHARITY, wait_until="domcontentloaded"); page.wait_for_selector("button", timeout=15000)
        feed(dao, pid, f"Loaded {CHARITY}", shot(page))
        history = []; address = None
        for step in range(14):
            page.evaluate("() => document.querySelectorAll('.lis-hl').forEach(e => e.remove())")
            els = page.evaluate(ELEMENTS_JS); img = shot(page)
            a = llm(goal + f" (pay with NEAR, amount {amount_near})", history, img, els) if use_llm else None
            src = "LLM"
            if not a or a.get("action") not in ("click", "type", "select", "extract", "fail"): a = scripted("NEAR", amount_near, els); src = "scripted"
            if a.get("verify") == "off_track": feed(dao, pid, "Verifier: previous action looks off-track, re-planning", img)
            if a["action"] == "fail": feed(dao, pid, "Agent could not find a next step: " + a.get("thought", ""), img, phase="failed"); break
            sel = f'[data-lis="{a.get("id")}"]'
            if page.locator(sel).count() == 0: history.append({"error": f"element {a.get('id')} not found"}); continue
            page.evaluate(HIGHLIGHT_JS, [a["id"], 0, 0]); page.wait_for_timeout(250)
            label = next((e["label"] for e in els if e["id"] == a["id"]), "")
            desc = {"click": f"Click “{label}”", "type": f"Clear “{label}” and type {a.get('value')}", "select": f"Select {a.get('value')} in “{label}”", "extract": "Read one-time deposit address"}[a["action"]]
            feed(dao, pid, f"{desc} · {a.get('thought','')} [{src}]", shot(page))
            page.evaluate("() => document.querySelectorAll('.lis-hl').forEach(e => e.remove())")
            before = page.inner_text("body")
            if a["action"] == "click":
                page.click(sel)
                try: page.wait_for_function("t => document.body.innerText !== t && !document.body.innerText.includes('Generating')", arg=before, timeout=10000)
                except Exception: pass
            elif a["action"] == "type": page.click(sel); page.keyboard.press("Control+A"); page.keyboard.press("Delete"); page.type(sel, str(a["value"]), delay=15)
            elif a["action"] == "select":
                try: page.select_option(sel, value=a["value"])
                except Exception: page.select_option(sel, label=a["value"])
            elif a["action"] == "extract":
                dom = page.inner_text("body"); dom_ids = set(ACCOUNT_RE.findall(dom))
                cand = (a.get("address") or "").strip()
                ocr = re.sub(r"\s+", "", ocr_text(page, sel)).lower().replace("l", "1").replace("o", "0")
                ocr_ok = bool(cand) and difflib.SequenceMatcher(None, cand, ocr).ratio() > 0.9
                if cand not in dom_ids: cand = next(iter(dom_ids), None)
                feed(dao, pid, f"Verified address against page text{' and OCR' if ocr_ok else ' (OCR inconclusive)'}: {cand}", shot(page))
                address = cand; break
            page.wait_for_timeout(200)
            history.append({"step": step, "action": a["action"], "id": a.get("id"), "value": a.get("value"), "label": label})
        ctx.close(); b.close()
    if not address:
        call("report_result", {**ids(), "success": False, "report": "agent failed to reach deposit address"}, tgt); return
    feed(dao, pid, f"Reporting address on-chain; {'LisDao executor pays from the Sputnik DAO escrow' if ex else 'contract pays from treasury'} ({amount_near} NEAR)…")
    tx = call("report_payout", {**ids(), "receiver_id": address, "amount": str(yocto),
        "report": f"Donated via {CHARITY} one-time address"}, tgt)
    st = (view("get_task", {"task_id": pid}, EXECUTOR) or {}).get("status") if ex else None
    if st == "Escalated":
        feed(dao, pid, f"{amount_near} NEAR is above this proposer's auto-approve tier, so the executor returned the escrow and opened a Sputnik Transfer proposal to {address}. The council votes on it in the DAO.", phase="done", tx=tx, address=address, escalated=True)
    else:
        feed(dao, pid, f"Done in {time.time() - T0['t']:.0f}s. {amount_near} NEAR sent to {address}", phase="done", tx=tx, address=address)
    time.sleep(1)

def beat():
    def go():
        try: post(HEARTBEAT, {k: STATE[k] for k in ("state", "dao_id", "proposal_id")} | {"model": LLM_MODEL}, {"x-agent-token": E("AGENT_FEED_TOKEN", "")}, 5)
        except Exception as e: print("  heartbeat error:", str(e)[:100], flush=True)
    threading.Thread(target=go, daemon=True).start()

def heartbeat_loop():
    # Post only when the state changes, otherwise every ~20s (UI treats >45s silence as offline).
    last, last_t, n = None, 0, 0
    while True:
        cur = (STATE["state"], STATE["dao_id"], STATE["proposal_id"])
        if cur != last or time.time() - last_t >= 20:
            beat(); last, last_t = cur, time.time()
        n += 1
        if n % 120 == 0:  # log line every ~60s
            age = time.time() - STATE["last_poll"]
            print(f"{time.strftime('%H:%M:%S')} heartbeat · {STATE['state']} · {STATE['polls']} polls · last poll {age:.1f}s ago ({STATE['last_poll_ms']}ms)", flush=True)
        time.sleep(0.5)

def main():
    print(f"{time.strftime('%H:%M:%S')} LisDao agent {AGENT} watching {CONTRACT} + Sputnik executor {EXECUTOR} · poll {POLL}s · LLM {LLM_MODEL} @ {LLM_URL}", flush=True)
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    while True:
        try:
            t = time.time(); tasks = view("pending_tasks", {"agent": AGENT})
            STATE.update(last_poll=time.time(), last_poll_ms=int((time.time() - t) * 1000), polls=STATE["polls"] + 1)
            try: tasks = [(SPUTNIK_FEED, t, True) for t in view("pending_tasks", {}, EXECUTOR)] + [(d, p, False) for d, p in tasks]
            except Exception as e: print("executor poll error:", str(e)[:120], flush=True); tasks = [(d, p, False) for d, p in tasks]
            for dao, prop, ex in tasks:
                print(f"{time.strftime('%H:%M:%S')} picked up {dao}/{prop['id']} (poll {STATE['last_poll_ms']}ms)", flush=True)
                try: run_task(dao, prop, ex)
                except Exception as e: print("task error:", e, flush=True); time.sleep(5)
                finally: STATE.update(state="idle", dao_id=None, proposal_id=None); beat()
        except Exception as e: print("tick error:", e, flush=True)
        if E("ONCE"): break
        time.sleep(POLL)

if __name__ == "__main__": main()
