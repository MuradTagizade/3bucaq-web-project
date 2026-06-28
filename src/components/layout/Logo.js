'use client';

import Image from 'next/image';
import styles from './Logo.module.css';

export default function Logo({ size = 60, showText = true, className = '' }) {
  const fontSize = `${size * 0.45}px`;
  const gap = `${size * 0.2}px`;

  return (
    <div className={`${styles.logo} ${className}`} style={{ gap }}>
      <Image
        src="/3bucaq-logo.png"
        alt="Level Up Logo"
        width={size}
        height={size}
        className={styles.icon}
        priority
      />
      {showText && (
        <span className={styles.text} style={{ fontSize }}>
          LEVEL <span className={styles.highlight}>UP</span>
        </span>
      )}
    </div>
  );
}

