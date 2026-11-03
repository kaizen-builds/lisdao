"use client";
import { useState } from "react";
import QRCode from "qrcode";
const S = { page: { minHeight: "100vh", background: "#F2F7FB", fontFamily: "system-ui", color: "#0B2540" },
  head: { background: "#0B5CAD", color: "#fff", padding: "14px 18px", fontWeight: 700 }, box: { background: "#fff", margin: 16, padding: 20, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,.1)" },
  in: { width: "100%", padding: 12, border: "1px solid #B8C7D6", borderRadius: 6, fontSize: 16, margin: "6px 0 16px", boxSizing: "border-box" },
  btn: { width: "100%", padding: 14, background: "#F5A623", border: "none", borderRadius: 6, fontSize: 16, fontWeight: 700, color: "#0B2540", cursor: "pointer" } };
export default function Charity() {
  const [step, setStep] = useState(1); const [asset, setAsset] = useState("BTC"); const [amount, setAmount] = useState("25");
  const [addr, setAddr] = useState(null); const [qr, setQr] = useState(null);
  async function finish() {
    const r = await (await fetch("/api/charity", { method: "POST", body: JSON.stringify({ asset, amount }) })).json();
    setAddr(r.address); setQr(await QRCode.toDataURL(r.address, { margin: 1, width: 200 })); setStep(3);
  }
  return <div style={S.page}>
    <div style={S.head}>💧 The Water Project <span style={{ fontWeight: 400, fontSize: 12, background: "#FFD54F", color: "#000", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>DEMO — not a real charity</span></div>
    <div style={S.box}>
      <h2 style={{ marginTop: 0 }}>Donate Crypto</h2>
      <p style={{ fontSize: 13, color: "#4A6178" }}>Step {step} of 3 · Every donation gets a one-time deposit address.</p>
      {step === 1 && <>
        <label htmlFor="asset"><b>Select Cryptocurrency</b></label>
        <select id="asset" name="asset" aria-label="Select Cryptocurrency" style={S.in} value={asset} onChange={e => setAsset(e.target.value)}>
          <option value="BTC">Bitcoin (BTC)</option><option value="ETH">Ethereum (ETH)</option><option value="USDC">USD Coin (USDC)</option><option value="NEAR">NEAR Protocol (NEAR)</option></select>
        <label htmlFor="amount"><b>Donation Amount</b></label>
        <input id="amount" name="amount" aria-label="Donation Amount" style={S.in} value={amount} onChange={e => setAmount(e.target.value)} />
        <button style={S.btn} onClick={() => setStep(2)}>Next Step</button></>}
      {step === 2 && <>
        <h3>Would you like a tax receipt?</h3>
        <p style={{ fontSize: 13 }}>Optional. Leave blank to donate anonymously.</p>
        <input aria-label="Email for tax receipt (optional)" placeholder="Email (optional)" style={S.in} />
        <button style={S.btn} onClick={finish}>Next Step</button></>}
      {step === 3 && addr && <>
        <h3>Send {amount} {asset}</h3>
        <p>Send exactly <b>{amount} {asset}</b> (NEAR testnet) to this one-time address:</p>
        <code id="deposit-address" style={{ display: "block", wordBreak: "break-all", fontSize: 15, padding: 12, background: "#EEF4FA", borderRadius: 6 }}>{addr}</code>
        {qr && <img src={qr} alt="QR" style={{ display: "block", margin: "16px auto" }} />}
        <p style={{ fontSize: 12, color: "#4A6178" }}>This address is valid for this donation only.</p></>}
    </div></div>;
}
