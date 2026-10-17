// The pool, drawn as a shield: amber = locked behind live policies, mint = free capacity.
export default function ShieldGauge({ liquidity, reserved, label }: { liquidity: number; reserved: number; label: string }) {
  const H = 226, top = 8;
  const lockedH = liquidity > 0 ? (reserved / liquidity) * H : 0;
  const path = "M100 8 L184 40 V118 C184 175 148 215 100 234 C52 215 16 175 16 118 V40 Z";
  return (
    <svg viewBox="0 0 200 242" className="shield" role="img" aria-label={`Pool holds ${label}`}>
      <defs>
        <clipPath id="sh"><path d={path} /></clipPath>
        <linearGradient id="free" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3DDC97" stopOpacity=".95" /><stop offset="1" stopColor="#1FA672" stopOpacity=".9" /></linearGradient>
        <linearGradient id="lock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F5B544" /><stop offset="1" stopColor="#C9861A" /></linearGradient>
      </defs>
      <path d={path} fill="#0D1829" />
      <g clipPath="url(#sh)">
        {liquidity > 0 && <rect x="0" y={top} width="200" height={H} fill="url(#free)" />}
        {liquidity > 0 && <rect x="0" y={top + H - lockedH} width="200" height={lockedH} fill="url(#lock)" className="rise" />}
        <path d="M0 60 Q50 46 100 60 T200 60" stroke="#fff" strokeOpacity=".06" fill="none" strokeWidth="14" />
      </g>
      <path d={path} fill="none" stroke="#F5B544" strokeWidth="3" />
      <path d="M100 26 L168 51 V118 C168 164 140 198 100 214" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="2" />
      <text x="100" y="122" textAnchor="middle" className="shield-num">{label}</text>
      <text x="100" y="144" textAnchor="middle" className="shield-sub">GEN in pool</text>
    </svg>
  );
}
