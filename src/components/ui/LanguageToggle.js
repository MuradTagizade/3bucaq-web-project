'use client';

import { useTranslation, SUPPORTED_LANGUAGES } from '@/lib/store/languageStore';
import { Globe, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import styles from './LanguageToggle.module.css';

export default function LanguageToggle({ className = '', size = 16 }) {
  const { language, setLanguage } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!mounted) {
    return <div className={`${styles.langBtnPlaceholder} ${className}`} />;
  }

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const choose = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div className={`${styles.wrap} ${className}`} ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={styles.langBtn}
        aria-label="Select language"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Language"
      >
        <Globe size={size} className={styles.globeIcon} />
        <span className={styles.label}>{current.short}</span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox">
          {SUPPORTED_LANGUAGES.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={l.code === language}
                className={`${styles.item} ${l.code === language ? styles.itemActive : ''}`}
                onClick={() => choose(l.code)}
              >
                <span className={styles.itemShort}>{l.short}</span>
                <span className={styles.itemLabel}>{l.label}</span>
                {l.code === language && <Check size={14} className={styles.itemCheck} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
