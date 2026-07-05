'use client';

import { useEffect, useCallback } from 'react';
import styles from './Modal.module.css';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  className = '',
}) {
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles[`modal--${size}`]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showClose) && (
          <div className={styles.header}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {showClose && (
              <button className={styles.close} onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className={styles.body}>
          {children}
        </div>
      </div>
    </div>
  );
}
