export function ProgressRing({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const color = value === 100 ? "#3B6D11" : value >= 50 ? "#E8590C" : "#A32D2D";
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#F4E7D6" strokeWidth={5} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".35em"
        fontSize={size / 4}
        fontWeight={600}
        fill="#2D1A0E"
      >
        {value}%
      </text>
    </svg>
  );
}
