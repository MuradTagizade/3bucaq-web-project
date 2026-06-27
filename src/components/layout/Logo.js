'use client';

import Image from 'next/image';
import styles from './Logo.module.css';

export default function Logo({ size = 40, showText = true, className = '' }) {
  return (
    <div className={`${styles.logo} ${className}`}>
      <Image
        src="/3bucaq-logo.png"
        alt="3bucaq Logo"
        width={size}
        height={size}
        className={styles.icon}
        priority
      />
      {showText && (
        <span className={styles.text}>
          3<span className={styles.highlight}>bucaq</span>
        </span>
      )}
    </div>
  );
}
