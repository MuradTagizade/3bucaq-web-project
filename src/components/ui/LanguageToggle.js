'use client';

import { useTranslation } from '@/lib/store/languageStore';
import { Globe } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './LanguageToggle.module.css';

export default function LanguageToggle({ className = '', size = 16 }) {
  const { language, setLanguage } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`${styles.langBtnPlaceholder} ${className}`} />;
  }

  const toggleLanguage = () => {
    setLanguage(language === 'az' ? 'en' : 'az');
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`${styles.langBtn} ${className}`}
      aria-label="Toggle language"
      title={language === 'az' ? 'Switch to English' : 'Azərbaycanca keçid et'}
    >
      <Globe size={size} className={styles.globeIcon} />
      <span className={styles.label}>{language.toUpperCase()}</span>
    </button>
  );
}
