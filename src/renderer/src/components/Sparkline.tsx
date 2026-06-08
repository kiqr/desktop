interface SparklineProps {
  /** Series of 0..1 fractions, oldest first. */
  points: number[];
  width?: number;
  height?: number;
}

/** A tiny SVG area sparkline for recent CPU history. */
export function Sparkline({
  points,
  width = 120,
  height = 32,
}: SparklineProps): JSX.Element {
  if (points.length < 2) {
    return <svg className="sparkline" width={width} height={height} aria-hidden="true" />;
  }

  const max = Math.max(0.05, ...points);
  const step = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - (p / max) * (height - 2) - 1;
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(56,88,233,0.45)" />
          <stop offset="100%" stopColor="rgba(56,88,233,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={line}
        fill="none"
        stroke="#6d8bff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
