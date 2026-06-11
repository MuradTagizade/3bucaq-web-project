'use client';

import styles from './Input.module.css';

export default function Select({
  label,
  error,
  success,
  icon,
  className = '',
  children,
  ...props
}) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div
        className={`
          ${styles.inputContainer}
          ${error ? styles['inputContainer--error'] : ''}
          ${success ? styles['inputContainer--success'] : ''}
        `}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <select
          className={styles.input}
          style={{
            cursor: 'pointer',
            outline: 'none',
            border: 'none',
            width: '100%',
            background: 'transparent',
            color: 'var(--text-primary)',
            paddingRight: '10px',
          }}
          {...props}
        >
          {children}
        </select>
        {success && !error && (
          <span className={styles.check}>✓</span>
        )}
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
