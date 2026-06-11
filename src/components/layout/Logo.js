'use client';

import styles from './Logo.module.css';

export default function Logo({ size = 40, showText = true, className = '' }) {
  return (
    <div className={`${styles.logo} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.icon}
      >
        {/* Triangle */}
        <path
          d="M30 6L54 50H6L30 6Z"
          fill="url(#logoGrad)"
          stroke="url(#logoStroke)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Inner tree / upward arrow */}
        <path
          d="M30 18L38 36H22L30 18Z"
          fill="rgba(0,0,0,0.3)"
          stroke="rgba(0,230,118,0.6)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* Trunk */}
        <rect
          x="28"
          y="36"
          width="4"
          height="8"
          rx="1"
          fill="rgba(0,230,118,0.4)"
        />
        {/* Glow dot */}
        <circle cx="30" cy="18" r="2" fill="#00E676" opacity="0.8">
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
        <defs>
          <linearGradient id="logoGrad" x1="6" y1="50" x2="54" y2="6">
            <stop offset="0%" stopColor="rgba(0,230,118,0.15)" />
            <stop offset="100%" stopColor="rgba(0,229,255,0.08)" />
          </linearGradient>
          <linearGradient id="logoStroke" x1="6" y1="50" x2="54" y2="6">
            <stop offset="0%" stopColor="#00E676" />
            <stop offset="100%" stopColor="#00E5FF" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className={styles.text}>
          3<span className={styles.highlight}>bucaq</span>
        </span>
      )}
    </div>
  );
}
