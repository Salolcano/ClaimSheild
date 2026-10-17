export type Slice = { label: string; value: number; color: string };
export default function Donut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Claims by outcome">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#1B2B45" strokeWidth="16" />
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * C, el = (
            <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />);
          off += len; return el;
        })}
        <text x="70" y="76" textAnchor="middle" className="donut-n">{total}</text>
      </svg>
      <ul>{slices.map((s) => <li key={s.label}><i style={{ background: s.color }} />{s.label}<b>{s.value}</b></li>)}</ul>
    </div>
  );
}
