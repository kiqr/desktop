interface MeterProps {
  label: string;
  /** 0..1 fraction driving the bar fill. */
  value: number;
  /** Text shown on the right, e.g. "12.34%" or "128MiB / 512MiB". */
  display: string;
  /** Visual accent variant. */
  tone?: 'cpu' | 'mem';
}

/** A labelled, animated progress bar. */
export function Meter({label, value, display, tone = 'cpu'}: MeterProps): JSX.Element {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="meter">
      <div className="meter-top">
        <span className="meter-label">{label}</span>
        <span className="meter-value">{display}</span>
      </div>
      <div className="meter-track">
        <div
          className={`meter-fill meter-${tone}`}
          style={{width: `${pct.toFixed(1)}%`}}
        />
      </div>
    </div>
  );
}
