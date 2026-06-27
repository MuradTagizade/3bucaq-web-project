'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './FooterNav.module.css';
import { Triangle, ArrowLeftRight, Flame, Users } from 'lucide-react';
import { NAV_ITEMS } from '@/lib/utils/constants';
import { formatCompactNumber } from '@/lib/utils/formatters';
import { useTranslation } from '@/lib/store/languageStore';

const iconMap = {
  triangle: Triangle,
  arrowLeftRight: ArrowLeftRight,
  flame: Flame,
  users: Users,
};

export default function FooterNav({ transferBalance = 0 }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = pathname === item.href;
          const showBalance = item.id === 'transfer' && transferBalance > 0;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
            >
              <div className={styles.iconWrap}>
                {item.id === 'home' ? (
                  <img
                    src="/3bucaq-logo.png"
                    alt="Logo"
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <Icon size={20} />
                )}
                {isActive && <span className={styles.glow} />}
                {showBalance && (
                  <span className={styles.badge}>
                    {formatCompactNumber(transferBalance)}
                  </span>
                )}
              </div>
              <span className={styles.label}>{t(item.id, item.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
