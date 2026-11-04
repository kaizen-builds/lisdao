const S = { stroke: "#141A33", strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
const Man = ({ x, up }) => <g {...S}><circle cx={x} cy="34" r="6" /><path d={`M${x} 40v18M${x} 58l-6 12M${x} 58l6 12M${x} 46l-8 6`} />{up ? <path d={`M${x} 46l8-14`} /> : <path d={`M${x} 46l8 6`} />}</g>;
export function VoteArt() { return <svg className="lart" viewBox="0 0 160 80" aria-hidden="true">
  <rect x="58" y="6" width="44" height="18" rx="3" fill="#FFF1E6" stroke="#F47A1F" strokeWidth="2" /><path d="M65 13h30M65 18h20" stroke="#F47A1F" strokeWidth="2" strokeLinecap="round" />
  <Man x={34} up /><Man x={80} up /><Man x={126} /></svg>; }
export function WorkArt() { return <svg className="lart" viewBox="0 0 160 80" aria-hidden="true">
  <rect x="66" y="10" width="80" height="54" rx="4" {...S} /><path d="M66 20h80" {...S} /><circle cx="72" cy="15" r="1.5" fill="#F47A1F" /><circle cx="78" cy="15" r="1.5" fill="#F47A1F" />
  <path d="M76 30h40M76 38h56M76 46h30" stroke="#F47A1F" strokeWidth="2" strokeLinecap="round" /><path d="M122 44l4 10 2-4 4 2z" fill="#F47A1F" />
  <g {...S}><circle cx="34" cy="34" r="6" /><path d="M34 40v18M34 58l-6 12M34 58l6 12M34 46l20 -4M34 46l20 4" /></g></svg>; }
export function PayArt() { return <svg className="lart" viewBox="0 0 160 80" aria-hidden="true">
  <rect x="22" y="30" width="40" height="34" rx="4" {...S} /><path d="M22 42h40" {...S} /><path d="M66 40q18-18 36-6" stroke="#F47A1F" strokeWidth="2" fill="none" strokeDasharray="3 4" />
  <circle cx="104" cy="30" r="8" fill="#FFF1E6" stroke="#F47A1F" strokeWidth="2" /><text x="104" y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="#C2580E">N</text>
  <g {...S}><circle cx="124" cy="34" r="6" /><path d="M124 40v18M124 58l-6 12M124 58l6 12M124 46l-12-8M124 46l8 6" /></g></svg>; }
