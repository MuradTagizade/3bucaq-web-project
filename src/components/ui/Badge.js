'use client';

import styles from './Badge.module.css';

export default function Badge({ children, variant = 'default', size = 'md' }) {
  return (
    <span className={`${styles.badge} ${styles[`badge--${variant}`]} ${styles[`badge--${size}`]}`}>
      {children}
    </span>
  );
}
