export function Drop({ size = 56 }) {
  return <svg width={size} height={size * 1.1} viewBox="0 0 110 120" aria-label="LisDao logo">
    <path d="M50 6 C38 32 14 52 14 78 a36 36 0 0 0 72 0 C86 52 62 32 50 6Z" fill="#FF7A1B" />
    <path d="M30 62 C32 52 38 44 42 40 C40 52 36 62 33 72 Z" fill="#FFAF7A" opacity=".9" />
    <ellipse cx="40" cy="78" rx="4.5" ry="6" fill="#171A2B" /><ellipse cx="62" cy="78" rx="4.5" ry="6" fill="#171A2B" />
    <path d="M42 96 Q55 100 66 90" stroke="#171A2B" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M96 22 L99 32 L109 35 L99 38 L96 48 L93 38 L83 35 L93 32Z" fill="#FFAF7A" />
  </svg>;
}
export const Wordmark = ({ size = 18 }) => <span className="wm" style={{ fontSize: size }}><span className="l">Lis</span><span className="d">Dao</span></span>;
