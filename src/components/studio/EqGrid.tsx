/** Shared logarithmic frequency/dB markings; response geometry stays in each EQ. */
export function EqGrid({ range }: { range: number }) {
  return <div className="eq-grid pointer-events-none absolute inset-0" aria-hidden="true">
    {[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map((f) =>
      <div key={f} className="eq-grid-frequency" style={{ left: `${Math.log(f / 20) / Math.log(1000) * 100}%` }}>
        <span>{f >= 1000 ? `${f / 1000}k` : f}</span>
      </div>)}
    {[-24, -18, -12, -6, 0, 6, 12, 18, 24].filter(db => Math.abs(db) < range).map(db =>
      <div key={db} className="eq-grid-gain" data-zero={db === 0} style={{ top: `${50 - db / range * 50}%` }}>
        <span>{db > 0 ? `+${db}` : db}</span>
      </div>)}
  </div>;
}