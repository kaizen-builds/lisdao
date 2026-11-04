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
    last=lambda m: (txs(m) or [{}])[-1]
    # ---- landing + wallet ----
    m=page("?e2e=out")
    btns=[x.inner_text() for x in m.locator(".center button").all()]; ok("Landing buttons", btns[:3]==["Demo DAO","Create New DAO","Open my Sputnik DAO"] and "Classic" in btns[3], str(btns))
    ok("Landing says built on Sputnik DAO", "Built on Sputnik DAO" in m.inner_text("body"))
    m.click("text=Connect wallet"); m.wait_for_timeout(300); ok("Connect wallet", m.evaluate("!!window.__connectClicked") and "e2e-user" in m.inner_text(".nav"))
    m.click(".nav .btn"); m.click("text=Sign out"); m.wait_for_timeout(300); ok("Sign out", "Connect wallet" in m.inner_text(".nav"))
    # ---- create Sputnik DAO ----
    m=page("?e2e=1"); m.click("text=Create New DAO"); m.fill("input >> nth=0","test-club"); m.fill("input >> nth=1","a.testnet"); m.click("text=Create Sputnik DAO"); m.wait_for_timeout(500)
    t=last(m); a=t.get("actions",[{}])[0].get("params",{}); pol=json.loads(base64.b64decode(a.get("args",{}).get("args","e30="))).get("policy",{}) if a else {}
    ok("Create New DAO -> Sputnik factory create tx", t.get("receiverId")=="sputnikv2.testnet" and a.get("methodName")=="create" and a["args"]["name"]=="test-club" and "e2e-user.testnet" in pol["roles"][0]["kind"]["Group"], str(t)[:140])
    m=page("?e2e=1"); m.click("text=Create New DAO"); m.click("text=Classic DAO"); m.fill("details input >> nth=0","Test DAO"); m.fill("details input >> nth=1","a.testnet:2"); m.click("text=Create classic DAO"); m.wait_for_timeout(500)
    a=last(m)["actions"][0]["params"]; ok("Classic create_dao still works", a.get("methodName")=="create_dao")
    m=page("?e2e=1"); m.click("text=Create New DAO"); m.click("text=← Back"); m.wait_for_timeout(300); ok("Create DAO Back", m.locator("text=Demo DAO").count()>0)
    # ---- Sputnik demo DAO ----
    m.click("text=Demo DAO"); m.wait_for_selector("text=Votes needed", timeout=15000); m.wait_for_timeout(1500)
    body=m.inner_text("body"); ok("Demo DAO opens Sputnik dashboard", D in body and "kaitrades.testnet" in body and "AI executor" in body, body[:0])
    ok("Shows auto-approve tier", "Your auto-approve tier" in body and "reputation" in body)
    m.click("text=+ Deposit NEAR"); m.wait_for_timeout(400); t=last(m); a=t["actions"][0]
    ok("Deposit = plain transfer to Sputnik DAO", t["receiverId"]==D and a["type"]=="Transfer" and a["params"]["deposit"]=="1000000000000000000000000")
    m.click("button[title='Edit votes'] >> nth=0"); m.wait_for_timeout(300); ok("Council edit explains Sputnik proposal", "Sputnik proposal" in m.inner_text("body"))
    m.click("text=Create New Proposal"); m.fill("input >> nth=0","Donate to the water project"); m.fill("textarea","Donate 0.1 NEAR to the water project"); m.click("button:has-text('Create Proposal')"); m.wait_for_timeout(1200)
    t=last(m); a=t["actions"][0]["params"]; k=a["args"]["proposal"]["kind"].get("FunctionCall",{}); inner=json.loads(base64.b64decode(k["actions"][0]["args"])) if k else {}
    ok("AI task -> Sputnik add_proposal FunctionCall to executor", t["receiverId"]==D and a["methodName"]=="add_proposal" and k["receiver_id"]==X and k["actions"][0]["method_name"]=="dispatch_task" and k["actions"][0]["deposit"]=="100000000000000000000000" and inner["proposer"]=="e2e-user.testnet" and a["deposit"]=="10000000000000000000000", json.dumps(inner)[:120])
    ok("After create -> Vote Yes screen", m.locator("button:has-text('Vote Yes')").count()>0)
    m.click("button:has-text('Vote Yes')"); m.wait_for_timeout(600); t=last(m); a=t["actions"][0]["params"]
    ok("Vote Yes -> act_proposal VoteApprove (300 Tgas)", t["receiverId"]==D and a["methodName"]=="act_proposal" and a["args"]["action"]=="VoteApprove" and a["gas"]=="300000000000000" and "FunctionCall" in a["args"]["proposal"])
    m.wait_for_timeout(800); ok("Passing vote opens live agent panel", m.locator(".agent").count()==1)
    if m.locator(".agent").count(): m.click(".agent >> text=Close"); m.wait_for_timeout(300)
    m.click("text=← Back"); m.wait_for_timeout(300); m.click("text=Create New Proposal"); m.click("text=Send NEAR"); m.fill("input >> nth=0","Pay helper")
    m.fill("input[placeholder='friend.testnet']","amara.testnet"); m.fill("input[placeholder='0.1']","0.2"); m.click("button:has-text('Create Proposal')"); m.wait_for_timeout(1200)
    a=last(m)["actions"][0]["params"]; ok("Send NEAR -> Sputnik Transfer proposal", a["args"]["proposal"]["kind"].get("Transfer",{}).get("amount")=="200000000000000000000000")
    m.click("text=Vote No"); m.wait_for_timeout(600); a=last(m)["actions"][0]["params"]; ok("Vote No -> VoteReject", a["methodName"]=="act_proposal" and a["args"]["action"]=="VoteReject")
    # ---- finished real tasks ----
    m=page(f"?e2e=1&dao={D}"); m.wait_for_selector(".card >> text=Donate 0.1", timeout=15000)
    m.locator(".card", has_text="Donate 0.1").first.click(); m.wait_for_timeout(1500); ok("Open passed Sputnik proposal", "Progress:" in m.inner_text("body"))
    m.click("text=Watch the agent"); m.wait_for_timeout(7000); ok("Agent panel shows live steps + receipt", m.locator(".agent").count()==1 and "paid by the LisDao executor" in m.inner_text(".agent") and "Loaded" in m.inner_text(".agent"), m.inner_text(".agent")[:300] if m.locator(".agent").count() else "no panel")
    m.click(".agent >> text=Close"); m.wait_for_timeout(2500); ok("Agent panel close stays closed", m.locator(".agent").count()==0)
    m.click("text=← Back"); m.wait_for_timeout(300)
    m.locator(".card", has_text="Donate 0.5").first.click(); m.wait_for_timeout(1500); ok("Escalated task explained", "Above the auto-approve tier" in m.inner_text("body"))
    m.click("text=← Back"); m.wait_for_timeout(300); m.locator(".card", has_text="LisDao task #1").first.click(); m.wait_for_timeout(1000)
    ok("Escalated Transfer proposal visible for council", "Escalated by the AI executor" in m.inner_text("body"))
    m.select_option("select[aria-label='Switch DAO']","0"); m.wait_for_timeout(2500); ok("Switch -> classic Demo DAO", "Demo DAO" in m.inner_text("h2") and "Members" in m.inner_text("body"))
    m.click("button[title='Edit votes'] >> nth=0"); m.wait_for_timeout(300); ok("Classic edit votes blocked for non-owner", "Only the DAO owner" in m.inner_text("body"))
    m.click("text=Create New Proposal"); m.fill("input >> nth=0","x"); m.fill("textarea","Donate 0.1 NEAR"); m.click("button:has-text('Create Proposal')"); m.wait_for_timeout(600)
    a=last(m)["actions"][0]["params"]; ok("Classic propose still works", a["methodName"]=="propose")
    m.select_option("select[aria-label='Switch DAO']","home"); m.wait_for_timeout(500); ok("Switch -> Home", m.locator("text=Create New DAO").count()>0)
    m=page("?e2e=1"); m.click("text=Classic demo"); m.wait_for_timeout(2500); ok("Classic demo link", "Members" in m.inner_text("body"))
    c=b.new_page(viewport={"width":390,"height":844}); c.goto(B.rstrip("/")+"/demo-charity"); c.select_option("#asset","NEAR"); c.click("text=Next Step"); c.click("text=Next Step"); c.wait_for_selector("#deposit-address", timeout=15000); ok("Demo charity flow", len(c.inner_text("#deposit-address"))==64)
    ok("No page errors", not errs, "; ".join(errs)[:300])
    print(f"\n{sum(r[1]=='PASS' for r in res)}/{len(res)} passed")
json.dump(res, open("/tmp/btn_res.json","w"))
