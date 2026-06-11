'use client';

import styles from './Header.module.css';
import Logo from './Logo';
import { Menu } from 'lucide-react';
import { useUIStore } from '@/lib/store/uiStore';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function Header({ userName }) {
  const openMenu = useUIStore((s) => s.openMenu);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo size={32} showText={false} />
        <div className={styles.greeting}>
          Hi: <span className={styles.name}>{userName || 'User'}</span>
        </div>
        <div className={styles.actions}>
          <ThemeToggle size={18} />
          <button className={styles.menuBtn} onClick={openMenu} aria-label="Menyu">
            <Menu size={22} />
          </button>
        </div>
      </div>
    </header>
  );
}
