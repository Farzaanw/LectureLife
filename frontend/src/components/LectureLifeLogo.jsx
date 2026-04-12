import { useEffect, useRef } from 'react'

export default function LectureLifeLogo({ size = 120 }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', animation: 'float 5s ease-in-out infinite' }}>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes spinr {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        .ll-orbit-1 {
          position: absolute; inset: 0;
          animation: spin 9s linear infinite;
        }
        .ll-orbit-2 {
          position: absolute; inset: 0;
          animation: spinr 7s linear infinite;
        }
        .ll-orbit-3 {
          position: absolute; inset: 0;
          animation: spin 13s linear infinite 2s;
        }
      `}</style>

      {/* Main hexagon SVG */}
      <svg
        viewBox="0 0 120 120"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        {/* Outer hex — light grey */}
        <polygon
          points="60,4 110,31 110,89 60,116 10,89 10,31"
          fill="#EEEEEE"
          stroke="#FF8C32"
          strokeWidth="1.5"
        />
        {/* Middle dashed ring */}
        <polygon
          points="60,16 98,37 98,83 60,104 22,83 22,37"
          fill="none"
          stroke="#F8A56D"
          strokeWidth="0.6"
          strokeDasharray="4 3"
          opacity="0.5"
        />
        {/* Inner hex — orange */}
        <polygon
          points="60,28 88,44 88,76 60,92 32,76 32,44"
          fill="#FF8C32"
        />
        {/* Slide lines inside inner hex */}
        <rect x="46" y="53" width="28" height="3.5" rx="1.75" fill="#fff" />
        <rect x="46" y="60" width="18" height="3.5" rx="1.75" fill="#fff" opacity="0.8" />
        <rect x="46" y="67" width="22" height="3.5" rx="1.75" fill="#fff" opacity="0.8" />
      </svg>

      {/* Orbit dot 1 — top, spins clockwise */}
      <div className="ll-orbit-1">
        <div style={{
          position: 'absolute', top: 0,
          left: '50%', transform: 'translateX(-50%)',
        }}>
          <div style={{
            width: 11, height: 11, borderRadius: '50%',
            background: '#FF8C32', border: '2px solid #EEEEEE',
          }} />
        </div>
      </div>

      {/* Orbit dot 2 — bottom right, spins counter */}
      <div className="ll-orbit-2">
        <div style={{
          position: 'absolute', bottom: 1, right: 18,
        }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: '#F8A56D', border: '1.5px solid #EEEEEE',
          }} />
        </div>
      </div>

      {/* Orbit dot 3 — bottom left, spins slow */}
      <div className="ll-orbit-3">
        <div style={{
          position: 'absolute', bottom: 1, left: 18,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#DDDDDD', border: '1.5px solid #FF8C32',
          }} />
        </div>
      </div>

    </div>
  )
}