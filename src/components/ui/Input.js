'use client';

import { useState } from 'react';
import styles from './Input.module.css';
import { Eye, EyeOff } from 'lucide-react';

export default function Input({
  label,
  error,
  success,
  type = 'text',
  icon,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

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
        <input
          className={styles.input}
          type={inputType}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {success && !error && (
          <span className={styles.check}>✓</span>
        )}
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
