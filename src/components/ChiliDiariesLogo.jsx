/**
 * Full wordmark logo — bold condensed "CHILI" (red) + pepper accent + "DIARIES"
 * (cream), with a distressed/grunge texture cut into the letters via an SVG
 * feTurbulence filter, echoing the weathered stencil look of the brand banner.
 * Pure vector, so it scales cleanly from a small header lockup up to a big
 * hero/banner size just by changing `height`.
 */
export default function ChiliDiariesLogo({ height = 30, className }) {
  return (
    <svg
      viewBox="0 0 470 84"
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <filter id="cdGrain" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="11" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 20 -12" result="grain" />
          <feComposite in="grain" in2="SourceGraphic" operator="in" result="grainClip" />
          <feComposite in="SourceGraphic" in2="grainClip" operator="out" />
        </filter>
      </defs>

      <text
        x="0" y="60"
        fontFamily="'Anton', Impact, 'Arial Narrow', sans-serif"
        fontWeight="900"
        fontSize="60"
        letterSpacing="0.5"
        fill="#E6402C"
        filter="url(#cdGrain)"
      >
        CHILI
      </text>

      <g transform="translate(172,2) rotate(18)">
        <path d="M13.8 2.6c1.7-1.1 3.8-1.2 5.1-.2-1.1 1.5-2.8 2.6-4.3 3.8-.5-1.2-.8-2.4-.8-3.6Z" fill="#4CAE50" stroke="#20160E" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M10.2 7.6c1.7-1.5 3.9-1.8 5.6-.7 1.5 1 2.2 2.7 1.9 4.4-3-.9-6.1-.8-9 .4-.3-1.5.1-2.9 1.5-4.1Z" fill="#3D9A46" stroke="#20160E" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M8.6 11.3c3.3-1.4 6.8-1.3 9.6.2 2.4 4 1.9 10-1.8 15.1-1.9 2.6-4.4 4-6.5 3.5-2.4-.6-3.7-3.2-3.4-6.6.4-4.5.8-8.6 2.1-12.2Z" fill="#E6402C" stroke="#20160E" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M11.3 14.2c-.7 3.6-1 8.1-.3 12.6" stroke="#FFFDF9" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
      </g>

      <text
        x="207" y="60"
        fontFamily="'Anton', Impact, 'Arial Narrow', sans-serif"
        fontWeight="900"
        fontSize="60"
        letterSpacing="0.5"
        fill="#FBF7F0"
        filter="url(#cdGrain)"
      >
        DIARIES
      </text>
    </svg>
  );
}
