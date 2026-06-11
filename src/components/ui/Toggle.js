'use client';

import styles from './Toggle.module.css';

export default function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <label className={`${styles.toggle} ${disabled ? styles.disabled : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={styles.input}
      />
      <span className={`${styles.track} ${checked ? styles.active : ''}`}>
        <span className={styles.thumb} />
      </span>
      {label && (
        <span className={`${styles.label} ${checked ? styles.labelActive : ''}`}>
          {checked ? 'ON' : 'OFF'}
        </span>
      )}
    </label>
  );
}
