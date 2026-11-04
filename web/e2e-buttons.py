import sys, json
from playwright.sync_api import sync_playwright
B=sys.argv[1]; res=[]
def ok(name, cond, note=""): res.append((name, "PASS" if cond else "FAIL", note)); print(("PASS " if cond else "FAIL ")+name, note, flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(q):
        m=b.new_page(viewport={"width":390,"height":844}); m.on("pageerror",lambda e:errs.append(str(e)[:150])); m.on("dialog",lambda d:d.accept("1"))
        m.goto(B+q); m.wait_for_timeout(2500); return m
    txs=lambda m: m.evaluate("window.__txs||[]")
    m=page("?e2e=out")
    btns=[x.inner_text() for x in m.locator(".center button").all()]; ok("Landing shows Demo DAO + Create New DAO", btns==["Demo DAO","Create New DAO"], str(btns))
    m.click("text=Connect wallet"); m.wait_for_timeout(300); ok("Connect wallet", m.evaluate("!!window.__connectClicked") and "e2e-user" in m.inner_text(".nav"))
    m.click(".nav .btn"); m.click("text=Sign out"); m.wait_for_timeout(300); ok("Sign out", "Connect wallet" in m.inner_text(".nav"))
    m=page("?e2e=1")
    m.click("text=Create New DAO"); m.fill("input >> nth=0","Test DAO"); m.fill("input >> nth=1","a.testnet:2"); m.click("text=Create DAO"); m.wait_for_timeout(500)
    t=txs(m); a=t[-1]["actions"][0]["params"] if t else {}
    ok("Create New DAO form -> create_dao tx", a.get("methodName")=="create_dao" and a["args"]["agent"].startswith("lisdao-agent"), json.dumps(a.get("args",{}))[:120])
    m=page("?e2e=1"); m.click("text=Create New DAO"); m.click("text=← Back"); m.wait_for_timeout(300); ok("Create DAO Back", m.locator("text=Demo DAO").count()>0)
    m.click("text=Demo DAO"); m.wait_for_selector("text=Summary", timeout=15000); m.wait_for_timeout(1500)
    ok("Demo DAO opens dashboard", "Demo DAO" in m.inner_text("h2") and "Balance in NEAR" in m.inner_text("body"))
    m.click("text=+ Deposit NEAR"); m.wait_for_timeout(400); a=txs(m)[-1]["actions"][0]["params"]; ok("Deposit", a["methodName"]=="deposit" and a["deposit"]=="1000000000000000000000000")
    m.click("button[title='Edit votes'] >> nth=0"); m.wait_for_timeout(300); ok("Edit votes (non-owner) blocked with message", "Only the DAO owner" in m.inner_text("body"))
    m.select_option("select[aria-label='Switch DAO']","1"); m.wait_for_timeout(2500); ok("Switch dropdown -> other DAO", "Clean Water Collective" in m.inner_text("h2"))
    m.select_option("select[aria-label='Switch DAO']","home"); m.wait_for_timeout(500); ok("Switch -> Home", m.locator("text=Create New DAO").count()>0)
    m.click("text=Demo DAO"); m.wait_for_selector("text=Create New Proposal", timeout=15000); m.wait_for_timeout(800)
    m.click("text=Create New Proposal"); m.fill("input >> nth=0","Donate to the water project"); m.fill("textarea","Donate 0.1 NEAR to the water project"); m.click("button:has-text('Create Proposal')"); m.wait_for_timeout(600)
    a=txs(m)[-1]["actions"][0]["params"]; ok("Create proposal (AI agent task)", a["methodName"]=="propose" and a["args"]["action"]["AgentTask"]["max_spend"]=="100000000000000000000000")
    ok("After create -> proposal screen with Vote Yes", m.locator("button:has-text('Vote Yes')").count()>0)
    m.click("button:has-text('Vote Yes')"); m.wait_for_timeout(600); a=txs(m)[-1]["actions"][0]["params"]; ok("Vote Yes", a["methodName"]=="vote" and a["args"]["approve"]==True)
    m.click("text=← Back"); m.wait_for_timeout(300); m.click("text=Create New Proposal"); m.click("text=Send NEAR"); m.fill("input >> nth=0","Pay helper")
    m.fill("input[placeholder='friend.testnet']","amara.testnet"); m.fill("input[placeholder='0.1']","0.2"); m.click("button:has-text('Create Proposal')"); m.wait_for_timeout(600)
    a=txs(m)[-1]["actions"][0]["params"]; ok("Create proposal (Send NEAR)", a["args"]["action"].get("Transfer",{}).get("amount")=="200000000000000000000000")
    m.click("text=Vote No"); m.wait_for_timeout(600); a=txs(m)[-1]["actions"][0]["params"]; ok("Vote No", a["methodName"]=="vote" and a["args"]["approve"]==False)
    m=page("?e2e=1&dao=0"); m.wait_for_selector(".card >> text=Donate to the water project", timeout=15000)
    m.locator(".card", has_text="Donate to the water project").last.click(); m.wait_for_timeout(1500)
    ok("Open proposal", "Progress:" in m.inner_text("body"))
    m.click("text=Watch the agent"); m.wait_for_timeout(2500); ok("Agent panel opens with steps/receipt", m.locator(".agent").count()==1 and ("Reported on-chain" in m.inner_text(".agent")))
    m.click(".agent >> text=Close"); m.wait_for_timeout(2500); ok("Agent panel close stays closed", m.locator(".agent").count()==0)
    m.click("text=← Back"); m.wait_for_timeout(300); ok("Proposal Back -> Summary", "Balance in NEAR" in m.inner_text("body"))
    m=page("/demo-charity".replace("/","",0) if False else ""); 
    c=b.new_page(viewport={"width":390,"height":844}); c.goto(B.rstrip("/")+"/demo-charity"); c.select_option("#asset","NEAR"); c.click("text=Next Step"); c.click("text=Next Step"); c.wait_for_selector("#deposit-address", timeout=15000); ok("Demo charity flow", len(c.inner_text("#deposit-address"))==64)
    ok("No page errors", not errs, "; ".join(errs[:3]))
json.dump(res, open("/tmp/btn_res.json","w"))
