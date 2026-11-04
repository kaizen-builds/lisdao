import sys, json, base64
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]; D="lisdao-demo.sputnikv2.testnet"; X="exec.lisdao-v2-1793741346.testnet"
def ok(name, cond, note=""): res.append((name, "PASS" if cond else "FAIL", note)); print(("PASS " if cond else "FAIL ")+name, note, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(q):
        m=b.new_page(viewport={"width":390,"height":844}); m.on("pageerror",lambda e:errs.append(str(e)[:150])); m.on("dialog",lambda d:d.accept("1"))
        m.goto(B+q); m.wait_for_timeout(2500); return m
    txs=lambda m: m.evaluate("window.__txs||[]")
    def older(m):  # proposals after the newest 5 sit in a collapsed <details class="older">
        for s in m.locator("details.older:not([open]) > summary").all(): s.click()
        m.wait_for_timeout(200)
    last=lambda m: (txs(m) or [{}])[-1]
    # ---- landing + wallet ----
    m=page("?e2e=out")
    btns=[x.inner_text() for x in m.locator(".lhero button").all()]; ok("Landing buttons", btns==["Try the demo","Advanced ▾"], str(btns))
    ok("Landing says built on Sputnik DAO", "Built on: NEAR · Sputnik DAO · NEAR AI Cloud" in m.inner_text("body"))
    m.click("text=Connect wallet"); m.wait_for_timeout(300); ok("Connect wallet", m.evaluate("!!window.__connectClicked") and "e2e-user" in m.inner_text(".navw"))
    m.click(".navw .btn"); m.click("text=Sign out"); m.wait_for_timeout(300); ok("Sign out", "Connect wallet" in m.inner_text(".navw"))
    # ---- create Sputnik DAO ----
    m=page("?e2e=1"); m.click("text=Advanced"); m.click("text=Create New DAO"); m.fill("input >> nth=0","test-club"); m.fill("input >> nth=1","a.testnet"); m.click("text=Create Sputnik DAO"); m.wait_for_timeout(500)
    t=last(m); a=t.get("actions",[{}])[0].get("params",{}); pol=json.loads(base64.b64decode(a.get("args",{}).get("args","e30="))).get("policy",{}) if a else {}
    ok("Create New DAO -> Sputnik factory create tx", t.get("receiverId")=="sputnikv2.testnet" and a.get("methodName")=="create" and a["args"]["name"]=="test-club" and "e2e-user.testnet" in pol["roles"][0]["kind"]["Group"], str(t)[:140])
    m=page("?e2e=1"); m.click("text=Advanced"); m.click("text=Create New DAO"); m.fill("input >> nth=0","my-club"); m.wait_for_timeout(300); tx=m.inner_text("body"); ok("Create DAO helper text + balance + low-balance warning", "my-club.sputnikv2.testnet" in tx and "You are added automatically" in tx and "Your wallet balance: 3.00 NEAR" in tx and "faucet" in tx and "Any one member can approve" in tx)
    m.click("text=Majority must approve"); ok("Votes needed explains Majority", "More than half" in m.inner_text("body"))
    m=page("?e2e=1"); m.click("text=Advanced"); m.click("text=Create New DAO"); m.click("text=← Back"); m.wait_for_timeout(300); ok("Create DAO Back", m.locator("text=Try the demo").count()>0)
    # ---- Sputnik demo DAO ----
    m.click("text=Try the demo"); m.wait_for_selector("text=Votes needed", timeout=15000); m.wait_for_timeout(1500)
    body=m.inner_text("body"); ok("Demo DAO opens Sputnik dashboard", D in body and "kaitrades.testnet" in body and "AI executor" in body, body[:0])
    ok("Shows auto-approve tier", "Your auto-approve tier" in body and "reputation" in body)
    m.click("text=Fund treasury"); m.wait_for_timeout(400); t=last(m); a=t["actions"][0]
    ok("Deposit = plain transfer to Sputnik DAO", t["receiverId"]==D and a["type"]=="Transfer" and a["params"]["deposit"]=="1000000000000000000000000")
    ok("Removed buttons gone", m.locator("button[title='Edit votes']").count()==0 and m.locator("button:text-is('Create proposal')").count()==0)
    m.click("text=Create New Proposal"); ok("Create form prefilled, no Send NEAR toggle", m.input_value("input >> nth=0")=="Donate to the water project" and "0.1 NEAR" in m.input_value("textarea") and m.locator("button:text-is('Send NEAR')").count()==0)
    m.fill("textarea",""); m.click("button:has-text('Submit proposal')"); m.wait_for_timeout(400); ok("Empty task blocked with inline error", "Describe the task" in m.inner_text("body"))
    m.fill("input >> nth=0","Donate to the water project"); m.fill("textarea","Donate 0.1 NEAR to the water project"); m.click("button:has-text('Submit proposal')"); m.wait_for_timeout(1200)
    t=last(m); a=t["actions"][0]["params"]; k=a["args"]["proposal"]["kind"].get("FunctionCall",{}); inner=json.loads(base64.b64decode(k["actions"][0]["args"])) if k else {}
    ok("AI task -> Sputnik add_proposal FunctionCall to executor", t["receiverId"]==D and a["methodName"]=="add_proposal" and k["receiver_id"]==X and k["actions"][0]["method_name"]=="dispatch_task" and k["actions"][0]["deposit"]=="100000000000000000000000" and inner["proposer"]=="e2e-user.testnet" and a["deposit"]=="10000000000000000000000", json.dumps(inner)[:120])
    ok("After create -> Vote Yes screen", m.locator("button:has-text('Vote Yes')").count()>0)
    m.click("button:has-text('Vote Yes')"); m.wait_for_timeout(600); t=last(m); a=t["actions"][0]["params"]
    ok("Vote Yes -> act_proposal VoteApprove (300 Tgas)", t["receiverId"]==D and a["methodName"]=="act_proposal" and a["args"]["action"]=="VoteApprove" and a["gas"]=="300000000000000" and "FunctionCall" in a["args"]["proposal"])
    m.wait_for_timeout(800); ok("Vote does not fake a Passed state", "Agent executing" not in m.inner_text("body"))
    m.click("text=DAO summary"); m.wait_for_timeout(300); m.click("text=Create New Proposal"); m.click("button:has-text('Submit proposal')"); m.wait_for_timeout(1200)
    m.click("text=Vote No"); m.wait_for_timeout(600); a=last(m)["actions"][0]["params"]; ok("Vote No -> VoteReject", a["methodName"]=="act_proposal" and a["args"]["action"]=="VoteReject")
    # ---- finished real tasks ----
    m=page(f"?e2e=1&dao={D}"); m.wait_for_timeout(4000)
    if m.locator("details.older").count(): ok("Older proposals collapsed by default", m.locator("details.older[open]").count()==0 and "Older proposals (" in m.inner_text("details.older > summary"))
    older(m); m.wait_for_selector(".card >> text=Donate 0.1", timeout=15000)
    m.locator(".card", has_text="Donate 0.1").first.click(); m.wait_for_timeout(1500); ok("Open passed Sputnik proposal", "Progress:" in m.inner_text("body"))
    m.click("text=View Agent Execution"); m.wait_for_timeout(7000); ok("Agent panel shows live steps + receipt", m.locator(".agent").count()==1 and "paid by the LisDao executor" in m.inner_text(".agent") and ("Loaded" in m.inner_text(".agent") or "agent offline" in m.inner_text(".agent")), m.inner_text(".agent")[:300] if m.locator(".agent").count() else "no panel")
    m.click(".agent >> text=Close"); m.wait_for_timeout(2500); ok("Agent panel close stays closed", m.locator(".agent").count()==0)
    m.click("text=DAO summary"); m.wait_for_timeout(300); older(m)
    m.locator(".card", has_text="Donate 0.5").first.click(); m.wait_for_timeout(1500); ok("Escalated task explained", "Above the auto-approve tier" in m.inner_text("body"))
    m.click("text=DAO summary"); m.wait_for_timeout(300); older(m); m.locator(".card", has_text="LisDao task #1").first.click(); m.wait_for_timeout(1000)
    ok("Escalated Transfer proposal visible for council", "Escalated by the AI executor" in m.inner_text("body"))
    m.click("text=← Home"); m.wait_for_timeout(500); ok("Home link", m.locator("text=Try the demo").count()>0)
    c=b.new_page(viewport={"width":390,"height":844}); c.goto(B.rstrip("/")+"/demo-charity"); c.select_option("#asset","NEAR"); c.click("text=Next Step"); c.click("text=Next Step"); c.wait_for_selector("#deposit-address", timeout=15000); ok("Demo charity flow", len(c.inner_text("#deposit-address"))==64)
    m=page(f"?e2e=1&dao={D}"); m.wait_for_timeout(3000); older(m); m.wait_for_selector(".card >> text=Donate 0.1", timeout=15000); n0=len(txs(m))
    m.route("**/*", lambda r: r.abort() if r.request.method=="POST" and "rpc" in r.request.url else r.continue_())
    m.click("text=Create New Proposal"); m.click("button:has-text('Submit proposal')"); m.wait_for_timeout(15000)
    ok("Submit reaches wallet call even if RPC read fails", len(txs(m))==n0+1 and "Could not reach" not in m.inner_text("body"), m.inner_text(".grid")[-200:])
    m=page(f"?e2e=dead&dao={D}"); m.wait_for_timeout(3000); older(m); m.wait_for_selector(".card >> text=Donate 0.1", timeout=15000)
    m.click("text=Create New Proposal"); m.click("button:has-text('Submit proposal')"); m.wait_for_timeout(2000)
    ok("Dead wallet session -> reconnect message", "Reconnect wallet" in m.inner_text("body") and m.evaluate("!!window.__connectClicked"))
    ext=[]; m=b.new_page(); m.on("request", lambda r: ext.append(r.url) if ("rpc.testnet.near.org" in r.url or "fastnear" in r.url) else None); m.goto(B+f"?e2e=1&dao={D}"); m.wait_for_timeout(6000)
    ok("Browser makes no direct public-RPC calls (uses /api/rpc)", not ext, str(ext[:2]))
    ok("No page errors", not errs, "; ".join(errs)[:300])
    print(f"\n{sum(r[1]=='PASS' for r in res)}/{len(res)} passed")
json.dump(res, open("/tmp/btn_res.json","w"))
