export default function Spinner({ size = 14, stroke = 2, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         style={{ animation: 'spin 0.8s linear infinite', verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth={stroke} opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  );
}
