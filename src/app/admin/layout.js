'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './admin.module.css';
import Logo from '@/components/layout/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import { useTranslation } from '@/lib/store/languageStore';
import { LayoutDashboard, Users, ClipboardCheck, ScrollText, LogOut, Wallet, ArrowDownToLine, MoreVertical, ShieldCheck, Shield } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { logoutUser } from '@/lib/supabase/auth';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'İstifadəçilər', icon: Users },
  { href: '/admin/kyc', label: 'KYC Sorğuları', icon: ShieldCheck },
  { href: '/admin/claims', label: 'Level Claims', icon: ClipboardCheck },
  { href: '/admin/deposits', label: 'Depozitlər', icon: Wallet },
  { href: '/admin/withdrawals', label: 'Çıxarışlar', icon: ArrowDownToLine },
  { href: '/admin/logs', label: 'Loglar', icon: ScrollText },
  { href: '/admin/admins', label: 'Adminlər', icon: Shield },
];

function hasPermission(user, path) {
  if (!user || user.role !== 'admin') return false;
  const perms = user.permissions || {};
  if (perms.superadmin) return true;

  if (path.startsWith('/admin/users')) return perms.users;
  if (path.startsWith('/admin/kyc')) return perms.kyc;
  if (path.startsWith('/admin/claims')) return perms.claims;
  if (path.startsWith('/admin/deposits') || path.startsWith('/admin/withdrawals')) return perms.finance;
  if (path.startsWith('/admin/logs')) return perms.logs;
  if (path.startsWith('/admin/admins')) return perms.superadmin;
  if (path === '/admin') {
    return !!(perms.users || perms.kyc || perms.claims || perms.finance || perms.logs);
  }
  return false;
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, loading: authLoading, setUser, setLoading } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch { /* ignore */ }
    setUser(null);
    setLoading(false);
    router.push('/login');
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'admin') {
        router.push('/dashboard');
      } else if (!hasPermission(user, pathname)) {
        // Redirect to the first route they have permission for
        const fallback = NAV_ITEMS.find((item) => hasPermission(user, item.href));
        if (fallback) {
          router.push(fallback.href);
        } else {
          router.push('/dashboard');
        }
      }
    }
  }, [user, authLoading, router, pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: '#060a13', color: 'var(--text-secondary)'
      }}>
        <span>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  const filteredNavItems = NAV_ITEMS.filter((item) => hasPermission(user, item.href));

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <header className={styles.mobileHeader}>
        <div className={styles.mobileHeaderLeft}>
          <Logo size={28} />
          <span className={styles.adminBadge}>{t('admin_panel', 'ADMIN')}</span>
        </div>
        <div className={styles.mobileHeaderRight}>
          <LanguageToggle size={15} />
          <ThemeToggle size={18} />
          <div className={styles.mobileMenuWrapper} ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={styles.mobileMenuBtn}
              title="Menyu"
              aria-label="Menyu"
            >
              <MoreVertical size={22} />
            </button>
          {menuOpen && (
            <div className={styles.mobileDropdown}>
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const translationKey = item.href === '/admin' ? 'dashboard' : item.href.split('/').pop();
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`${styles.dropdownItem} ${isActive ? styles.dropdownActive : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{t(translationKey, item.label)}</span>
                  </Link>
                );
              })}
              <div className={styles.dropdownDivider} />
              <button
                onClick={handleLogout}
                className={`${styles.dropdownItem} ${styles.dropdownLogout}`}
              >
                <LogOut size={18} />
                <span>{t('logout', 'Çıxış')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

      {/* Sidebar (Desktop only) */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <Logo size={36} />
          <span className={styles.adminBadge}>{t('admin_panel', 'ADMIN')}</span>
        </div>

        <nav className={styles.nav}>
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const translationKey = item.href === '/admin' ? 'dashboard' : item.href.split('/').pop();
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navActive : ''}`}
              >
                <Icon size={20} />
                <span>{t(translationKey, item.label)}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.footerButtons}>
            <LanguageToggle size={15} />
            <ThemeToggle size={18} />
            <button onClick={handleLogout} className={styles.navItem} style={{ background: 'none', border: 'none', cursor: 'pointer', flex: 1 }}>
              <LogOut size={20} />
              <span>{t('logout', 'Çıxış')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
