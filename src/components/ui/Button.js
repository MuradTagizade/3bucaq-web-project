'use client';

import styles from './Button.module.css';

/**
 * Button variants: primary, secondary, ghost, danger, success
 * Sizes: sm, md, lg
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  iconRight,
  className = '',
  ...props
}) {
  return (
    <button
      className={`
        ${styles.btn}
        ${styles[`btn--${variant}`]}
        ${styles[`btn--${size}`]}
        ${fullWidth ? styles['btn--full'] : ''}
        ${loading ? styles['btn--loading'] : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {!loading && icon && <span className={styles.icon}>{icon}</span>}
      {children && <span className={styles.label}>{children}</span>}
      {!loading && iconRight && <span className={styles.iconRight}>{iconRight}</span>}
    </button>
  );
}
