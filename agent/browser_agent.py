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
AGENT = E("AGENT_ID", "lisdao-agent-1793741346.testnet")
WEB = E("WEB_URL", "http://localhost:3000")
CHARITY = E("CHARITY_URL", WEB + "/demo-charity")
FEED = E("FEED_URL", WEB + "/api/agent")
RPC = E("NEAR_RPC", "https://rpc.testnet.near.org")
LLM_URL = E("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai")
LLM_KEY = E("LLM_API_KEY") or E("NEAR_AI_API_KEY") or E("GEMINI_API_KEY")
LLM_MODEL = E("LLM_MODEL", "gemini-3-flash-preview")
HERE = os.path.dirname(os.path.abspath(__file__))
ACCOUNT_RE = re.compile(r"\b([0-9a-f]{64}|(?:[a-z0-9_-]+\.)+(?:testnet|near))\b")

def post(url, body, headers={}, timeout=60):
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", **headers})
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read() or b"null")

def view(method, args):
    r = post(RPC, {"jsonrpc": "2.0", "id": 1, "method": "query", "params": {"request_type": "call_function", "finality": "optimistic",
        "account_id": CONTRACT, "method_name": method, "args_base64": base64.b64encode(json.dumps(args).encode()).decode()}})
    return json.loads(bytes(r["result"]["result"]))

def feed(dao, pid, text, shot=None, **kw):
    print(f"[{dao}/{pid}] {text}", flush=True)
    try: post(FEED, {"dao_id": dao, "proposal_id": pid, "text": text, "shot": shot, **kw}, {"x-agent-token": E("AGENT_FEED_TOKEN", "")}, 10)
    except Exception as e: print("  feed error:", e)

def call(method, args):
    out = subprocess.run(["near", "contract", "call-function", "as-transaction", CONTRACT, method, "json-args", json.dumps(args),
        "prepaid-gas", "100 Tgas", "attached-deposit", "0 NEAR", "sign-as", AGENT, "network-config", "testnet",
        "sign-with-legacy-keychain", "send"], capture_output=True, text=True)
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
    return base64.b64encode(page.screenshot(type="jpeg", quality=55)).decode()

def llm(goal, history, img, elements):
    prompt = f"""You control a web browser for a DAO. Goal: {goal}
You see the CURRENT screenshot. First verify whether the previous action worked (compare with history), then choose ONE next action.
Interactive elements (id, tag, label, value, options): {json.dumps(elements)}
History: {json.dumps(history[-6:])}
Rules: if a textbox already has a default value (e.g. 25) you must use "type" which clears it first. Choose the cryptocurrency in dropdowns with "select".
Skip optional tax receipt pages by clicking Next Step. When the one-time deposit address is visible, use "extract" and copy the address exactly.
Reply ONLY JSON: {{"verify":"ok|off_track|start","thought":"...","action":"click|type|select|extract|fail","id":<element id>,"value":"<text or option value>","address":"<only for extract>"}}"""
    body = {"model": LLM_MODEL, "temperature": 0, "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": [
        {"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + img}}]}]}
    for attempt in range(3):
        try:
            r = post(LLM_URL.rstrip("/") + "/chat/completions", body, {"Authorization": "Bearer " + LLM_KEY}, 90)
            c = r["choices"][0]["message"]["content"]; return json.loads(c[c.find("{"): c.rfind("}") + 1])
        except Exception as e:
            print("  llm error:", str(e)[:200]); time.sleep(2 + attempt * 3)
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

def run_task(dao, prop):
    pid = prop["id"]; task = prop["action"]["AgentTask"]; goal = task["instructions"]
    cap = int(task["max_spend"]); m = re.search(r"([\d.]+)\s*NEAR", goal, re.I)
    amount_near = m.group(1) if m else str(cap / 1e24)
    yocto = int(round(float(amount_near) * 1e6)) * 10**18
    feed(dao, pid, f"Proposal passed. Task: “{goal}”", reset=True, phase="start")
    if yocto > cap: feed(dao, pid, "Refused: amount exceeds the proposal's spending cap", phase="failed"); call("report_result", {"dao_id": dao, "proposal_id": pid, "success": False, "report": "over cap"}); return
    use_llm = bool(LLM_KEY)
    feed(dao, pid, f"Opening browser · planner: {'vision LLM ' + LLM_MODEL if use_llm else 'scripted fallback (no vision key)'}")
    with sync_playwright() as p:
        b = p.chromium.launch(headless=E("HEADLESS", "1") == "1")
        ctx = b.new_context(viewport={"width": 420, "height": 760}, device_scale_factor=2, record_video_dir=E("RECORD_DIR") or None, record_video_size={"width": 420, "height": 760})
        page = ctx.new_page(); page.goto(CHARITY, wait_until="networkidle")
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
            page.evaluate(HIGHLIGHT_JS, [a["id"], 0, 0]); page.wait_for_timeout(700)
            label = next((e["label"] for e in els if e["id"] == a["id"]), "")
            desc = {"click": f"Click “{label}”", "type": f"Clear “{label}” and type {a.get('value')}", "select": f"Select {a.get('value')} in “{label}”", "extract": "Read one-time deposit address"}[a["action"]]
            feed(dao, pid, f"{desc} · {a.get('thought','')} [{src}]", shot(page))
            page.evaluate("() => document.querySelectorAll('.lis-hl').forEach(e => e.remove())")
            if a["action"] == "click": page.click(sel)
            elif a["action"] == "type": page.click(sel); page.keyboard.press("Control+A"); page.keyboard.press("Delete"); page.type(sel, str(a["value"]), delay=60)
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
            page.wait_for_load_state("networkidle"); page.wait_for_timeout(500)
            history.append({"step": step, "action": a["action"], "id": a.get("id"), "value": a.get("value"), "label": label})
        ctx.close(); b.close()
    if not address:
        call("report_result", {"dao_id": dao, "proposal_id": pid, "success": False, "report": "agent failed to reach deposit address"}); return
    feed(dao, pid, f"Reporting address on-chain; contract pays {amount_near} NEAR from treasury…")
    tx = call("report_payout", {"dao_id": dao, "proposal_id": pid, "receiver_id": address, "amount": str(yocto),
        "report": f"Donated via {CHARITY} one-time address"})
    feed(dao, pid, f"Done. {amount_near} NEAR sent to {address}", phase="done", tx=tx, address=address)

def main():
    print(f"LisDao agent {AGENT} watching {CONTRACT}", flush=True)
    while True:
        try:
            for dao, prop in view("pending_tasks", {"agent": AGENT}): run_task(dao, prop)
        except Exception as e: print("tick error:", e, flush=True)
        if E("ONCE"): break
        time.sleep(3)

if __name__ == "__main__": main()
