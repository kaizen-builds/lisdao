"use client";
import { useState } from "react";
import QRCode from "qrcode";
import "./charity.css";

export default function Charity() {
  const [step, setStep] = useState(1); const [asset, setAsset] = useState("BTC"); const [amount, setAmount] = useState("25");
  const [addr, setAddr] = useState(null); const [busy, setBusy] = useState(false); const [qr, setQr] = useState(null);
  async function finish() {
    setBusy(true);
    const r = await (await fetch("/api/charity", { method: "POST", body: JSON.stringify({ asset, amount }) })).json();
    setAddr(r.address); setQr(await QRCode.toDataURL(r.address, { margin: 1, width: 200 })); setStep(3);
  }
  return (
    <div className="wp-page">
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
          <span>Impact</span>
          <span className="wp-give">Give</span>
        </span>
      </header>

      <section className="wp-hero">
        <div className="wp-hero-in">
          <div className="wp-copy">
            <p className="wp-kicker">Give cryptocurrency</p>
            <h1>A gift that becomes a lasting water source.</h1>
            <p>When a community can rely on clean water nearby, hours once spent walking come back for school, work, and rest.</p>
          </div>
          <div className="wp-card">
            <h2>Donate Crypto</h2>
            <p className="wp-step">Step {step} of 3 · Every donation gets a one-time deposit address.</p>
            {step === 1 && <>
              <label htmlFor="asset"><b>Select Cryptocurrency</b></label>
              <select id="asset" name="asset" aria-label="Select Cryptocurrency" value={asset} onChange={e => setAsset(e.target.value)}>
                <option value="BTC">Bitcoin (BTC)</option>
                <option value="ETH">Ethereum (ETH)</option>
                <option value="USDC">USD Coin (USDC)</option>
                <option value="NEAR">NEAR Protocol (NEAR)</option>
              </select>
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

      <section className="wp-story">
        <img src="/charity/well.jpg" alt="A hand pump on a concrete well pad in open country" />
        <div>
          <h2>A reliable source, close to home.</h2>
          <p>Local teams plan and build water points that communities can keep running for years — wells, protected springs, and small dams among them.</p>
          <p>Your support helps fund the work itself, and the upkeep that keeps water flowing long after a new source is opened.</p>
        </div>
      </section>

      <footer className="wp-foot">This page is a LisDao testnet demonstration. It is not operated by or affiliated with The Water Project.</footer>
    </div>
  );
}
