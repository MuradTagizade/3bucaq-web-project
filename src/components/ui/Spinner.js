'use client';

import styles from './Spinner.module.css';

export default function Spinner({ size = 24, className = '' }) {
  return (
    <div
      className={`${styles.spinner} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function PageSpinner() {
  return (
    <div className={styles.pageSpinner}>
      <Spinner size={40} />
    </div>
  );
}
