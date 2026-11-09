"use client";
import { useState } from "react";
import QRCode from "qrcode";
import "./charity.css";

export default function Charity() {
  const [step, setStep] = useState(1); const [asset, setAsset] = useState("NEAR"); const [amount, setAmount] = useState("25");
  const [addr, setAddr] = useState(null); const [busy, setBusy] = useState(false); const [qr, setQr] = useState(null);
  async function finish() {
    setBusy(true);
    const r = await (await fetch("/api/charity", { method: "POST", body: JSON.stringify({ asset, amount }) })).json();
    setAddr(r.address); setQr(await QRCode.toDataURL(r.address, { margin: 1, width: 200 })); setStep(3);
  }
  return (
    <div className="wp-page">
      <div className="wp-top">
        <span>Reliable water, one community at a time</span>
        <span className="wp-top-links">
          <span>Find your impact</span>
          <span>For groups</span>
          <span>Contact</span>
        </span>
      </div>

      <header className="wp-nav">
        <span className="wp-mark">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="14" fill="#1f6b45" />
            <path d="M14 6.5c.2 0 6 7.2 6 11.1A6 6 0 0 1 8 17.6C8 13.7 13.8 6.5 14 6.5Z" fill="#fff" />
          </svg>
          <b>the water project</b>
        </span>
        <span className="wp-links">
          <span>Our Work</span>
          <span>Why Water</span>
          <span>Projects</span>
          <span>Stories</span>
          <span>Impact</span>
          <span>About</span>
          <span className="wp-give">Give</span>
        </span>
      </header>

      <section className="wp-hero">
        <div className="wp-hero-in">
          <div className="wp-copy">
            <p className="wp-kicker">Give cryptocurrency</p>
            <h1>A gift that becomes a lasting water source.</h1>
            <p>When a community can rely on clean water nearby, hours once spent walking come back for school, work, and rest.</p>
            <p>Local teams plan the work, build the source, and stay with it so the water keeps flowing years after opening day.</p>
            <div className="wp-pills">
              <span>Wells &amp; boreholes</span>
              <span>Protected springs</span>
              <span>Small dams</span>
            </div>
          </div>
          <div className="wp-card">
            <h2>Donate Crypto</h2>
            <p className="wp-step">Step {step} of 3 · Every donation gets a one-time deposit address.</p>
            {step === 1 && <>
              <label htmlFor="asset"><b>Select Cryptocurrency</b></label>
              <select id="asset" name="asset" aria-label="Select Cryptocurrency" value={asset} onChange={e => setAsset(e.target.value)}>
                <option value="NEAR">NEAR Protocol (NEAR)</option>
              </select>
              <p className="wp-note">This demo accepts NEAR on testnet. The agent types the amount from the proposal.</p>
              <label htmlFor="amount"><b>Donation Amount</b></label>
              <input id="amount" name="amount" aria-label="Donation Amount" value={amount} onChange={e => setAmount(e.target.value)} />
              <button onClick={() => setStep(2)}>Next Step</button>
            </>}
            {step === 2 && <>
              <h3>Would you like a tax receipt?</h3>
              <p className="wp-note">Optional. Leave blank to donate anonymously.</p>
              <input aria-label="Email for tax receipt (optional)" placeholder="Email (optional)" />
              {busy ? <p className="wp-wait"><b>Generating your one-time address…</b></p> : <button onClick={finish}>Next Step</button>}
            </>}
            {step === 3 && addr && <>
              <h3>Send {amount} {asset}</h3>
              <p className="wp-note">Send exactly <b>{amount} {asset}</b> (NEAR testnet) to this one-time address:</p>
              <code id="deposit-address" className="wp-addr">{addr}</code>
              {qr && <img src={qr} alt="QR" />}
              <p className="wp-note">This address is valid for this donation only.</p>
            </>}
          </div>
        </div>
      </section>

      <section className="wp-strip">
        <div>
          <b>1. A community asks</b>
          <p>Neighbors help choose a site they can reach and maintain.</p>
        </div>
        <div>
          <b>2. A source is built</b>
          <p>Wells, protected springs, or small dams — whichever fits the place.</p>
        </div>
        <div>
          <b>3. The water stays on</b>
          <p>Training and follow-up keep the point working after the first week.</p>
        </div>
      </section>

      <section className="wp-story">
        <img src="/charity/well.jpg" alt="A hand pump on a concrete well pad in open country" />
        <div>
          <p className="wp-kicker dark">Why water</p>
          <h2>A reliable source, close to home.</h2>
          <p>Fetching water can take a large part of a day. A working point nearby changes what a household can do with those hours.</p>
          <p>Your support helps fund the work itself, and the upkeep that keeps water flowing long after a new source is opened.</p>
        </div>
      </section>

      <section className="wp-work">
        <div className="wp-work-head">
          <p className="wp-kicker dark">Our work</p>
          <h2>Different places need different water points.</h2>
        </div>
        <div className="wp-cards">
          <div className="wp-type">
            <img src="/charity/well.jpg" alt="A community hand pump" />
            <h3>Wells &amp; boreholes</h3>
            <p>A sealed source with a hand pump, built so the community can keep it in good repair.</p>
          </div>
          <div className="wp-type">
            <img src="/charity/spring.jpg" alt="A protected spring feeding a stone catchment" />
            <h3>Protected springs</h3>
            <p>Where water already rises from the ground, a catchment keeps it clean as people collect it.</p>
          </div>
          <div className="wp-type">
            <img src="/charity/cans.jpg" alt="Jerrycans beside a flowing water pipe" />
            <h3>Shared collection points</h3>
            <p>A pipe and a pad where families fill containers without a long walk to an unprotected source.</p>
          </div>
        </div>
      </section>

      <section className="wp-quote">
        <p>“Seeing water run from a new point is the easy part. The work is making sure it still runs in the dry season.”</p>
        <span>From a field engineer, after a follow-up visit</span>
      </section>

      <section className="wp-ways">
        <h2>Ways people give</h2>
        <div className="wp-cards three">
          <div>
            <h3>Cryptocurrency</h3>
            <p>Use the form on this page. Each gift receives its own one-time deposit address.</p>
          </div>
          <div>
            <h3>Card or transfer</h3>
            <p>A standard donation path for people who would rather not use crypto.</p>
          </div>
          <div>
            <h3>Checks &amp; matching gifts</h3>
            <p>Some donors give by mail or through an employer match.</p>
          </div>
        </div>
      </section>

      <section className="wp-mosaic">
        <img src="/charity/hero.jpg" alt="Water pouring from a pipe in a concrete tank wall" />
        <img src="/charity/cans.jpg" alt="Yellow and green water containers at a collection point" />
        <img src="/charity/spring.jpg" alt="Clear water collected at a protected spring" />
        <img src="/charity/well.jpg" alt="A hand pump standing on red earth" />
      </section>

      <footer className="wp-foot">
        <div className="wp-foot-grid">
          <div>
            <b>the water project</b>
            <p>Unlocking time and health with water people can count on.</p>
          </div>
          <div>
            <b>Explore</b>
            <span>Our Work</span>
            <span>Why Water</span>
            <span>Projects</span>
            <span>Stories</span>
          </div>
          <div>
            <b>Give</b>
            <span>Give crypto</span>
            <span>Give another way</span>
            <span>For groups</span>
          </div>
          <div>
            <b>About</b>
            <span>How we work</span>
            <span>Financials</span>
            <span>Contact</span>
          </div>
        </div>
        <p className="wp-legal">This page is a LisDao testnet demonstration. It is not operated by or affiliated with The Water Project.</p>
      </footer>
    </div>
  );
}
