'use client';

import styles from './page.module.css';
import Logo from '@/components/layout/Logo';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Users, Shield, Leaf } from 'lucide-react';
import LanguageToggle from '@/components/ui/LanguageToggle';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NeuralBackground from '@/components/ui/flow-field-background';
import { useTranslation } from '@/lib/store/languageStore';

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      {/* Animated Background Grid */}
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />
      <NeuralBackground color="var(--color-primary)" />

      <div className={styles.topBar}>
        <LanguageToggle size={15} />
        <ThemeToggle size={18} />
      </div>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <Logo size={64} showText={false} className={styles.heroLogo} />

          <h1 className={styles.title}>
            {t('landing.title_make', 'MAKE WORLD')}{' '}
            <span className="text-gradient">{t('landing.title_green', 'GREEN')}</span>{' '}
            {t('landing.title_again', 'AGAIN')}
          </h1>

          <p className={styles.subtitle}>
            {t('landing.subtitle', 'Investisiya edin, referallar cəlb edin, gündəlik qazanc əldə edin. USDT ilə ödəniş alın.')}
          </p>

          <div className={styles.heroActions}>
            <Link href="/register">
              <Button size="lg" iconRight={<ArrowRight size={20} />}>
                {t('landing.create_account_btn', 'Hesab Yarat')}
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="ghost">
                {t('login', 'Giriş')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Floating Stats */}
        <div className={styles.floatingStats}>
          <div className={`${styles.statCard} animate-fade-in-up stagger-1`}>
            <TrendingUp size={20} className={styles.statIcon} />
            <span className={styles.statValue}>$6.5</span>
            <span className={styles.statLabel}>{t('landing.daily_earning_label', 'Gündəlik qazanc')}</span>
          </div>
          <div className={`${styles.statCard} animate-fade-in-up stagger-2`}>
            <Users size={20} className={styles.statIcon} />
            <span className={styles.statValue}>10%</span>
            <span className={styles.statLabel}>{t('landing.referral_bonus_label', 'Referal bonus')}</span>
          </div>
          <div className={`${styles.statCard} animate-fade-in-up stagger-3`}>
            <Shield size={20} className={styles.statIcon} />
            <span className={styles.statValue}>{t('landing.guarantee_value', '1 il')}</span>
            <span className={styles.statLabel}>{t('landing.guarantee_label', 'Qarantiya')}</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.featureGrid}>
          <div className={`${styles.featureCard} glass-card`}>
            <div className={styles.featureIcon} style={{ background: 'rgba(0,230,118,0.1)' }}>
              <Leaf size={24} color="var(--color-primary)" />
            </div>
            <h3>{t('landing.hotbed_packages_title', 'Hot Bed Paketləri')}</h3>
            <p>{t('landing.hotbed_packages_desc', '$19-dan $799-a qədər paketlər. Xal toplayın, level yüksəldin, bonus qazanın.')}</p>
          </div>
          <div className={`${styles.featureCard} glass-card`}>
            <div className={styles.featureIcon} style={{ background: 'rgba(0,229,255,0.1)' }}>
              <Users size={24} color="var(--color-secondary)" />
            </div>
            <h3>{t('landing.referral_5_lines_title', '5 Xətt Referal')}</h3>
            <p>{t('landing.referral_5_lines_desc', 'Birbaşa referaldan 10%, 5-ci xəttə qədər hər yatırımdan 1% qazanın.')}</p>
          </div>
          <div className={`${styles.featureCard} glass-card`}>
            <div className={styles.featureIcon} style={{ background: 'rgba(124,77,255,0.1)' }}>
              <TrendingUp size={24} color="var(--color-accent)" />
            </div>
            <h3>{t('landing.level_10_bonus_title', '10 Level Bonus')}</h3>
            <p>{t('landing.level_10_bonus_desc', '30 pointdən 43,321 pointə qədər toplayın. 99 USDT-dən 72,999 USDT-ə qədər bonus.')}</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <Logo size={28} />
        <p className={styles.footerText}>© 2026 3bucaq. {t('landing.all_rights_reserved', 'Bütün hüquqlar qorunur.')}</p>
      </footer>
    </div>
  );
}
