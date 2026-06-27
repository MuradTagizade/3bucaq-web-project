'use client';

import Image from 'next/image';
import styles from './Logo.module.css';

export default function Logo({ size = 40, showText = true, className = '' }) {
  return (
    <div className={`${styles.logo} ${className}`}>
      <Image
        src="/3bucaq-logo.png"
        alt="Level Up Logo"
        width={size}
        height={size}
        className={styles.icon}
        priority
      />
      {showText && (
        <span className={styles.text}>
          Level <span className={styles.highlight}>Up</span>
        </span>
      )}
    </div>
  );
}
