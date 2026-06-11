'use client';

import styles from './page.module.css';
import Logo from '@/components/layout/Logo';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Users, Shield, Leaf } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className={styles.page}>
      {/* Animated Background Grid */}
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <Logo size={64} showText={false} className={styles.heroLogo} />

          <h1 className={styles.title}>
            MAKE WORLD{' '}
            <span className="text-gradient">GREEN</span>{' '}
            AGAIN
          </h1>

          <p className={styles.subtitle}>
            Investisiya edin, referallar cəlb edin, gündəlik qazanc əldə edin.
            <br />
            USDT ilə ödəniş alın.
          </p>

          <div className={styles.heroActions}>
            <Link href="/register">
              <Button size="lg" iconRight={<ArrowRight size={20} />}>
                Hesab Yarat
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="ghost">
                Giriş
              </Button>
            </Link>
          </div>
        </div>

        {/* Floating Stats */}
        <div className={styles.floatingStats}>
          <div className={`${styles.statCard} animate-fade-in-up stagger-1`}>
            <TrendingUp size={20} className={styles.statIcon} />
            <span className={styles.statValue}>$6.5</span>
            <span className={styles.statLabel}>Gündəlik qazanc</span>
          </div>
          <div className={`${styles.statCard} animate-fade-in-up stagger-2`}>
            <Users size={20} className={styles.statIcon} />
            <span className={styles.statValue}>10%</span>
            <span className={styles.statLabel}>Referal bonus</span>
          </div>
          <div className={`${styles.statCard} animate-fade-in-up stagger-3`}>
            <Shield size={20} className={styles.statIcon} />
            <span className={styles.statValue}>1 il</span>
            <span className={styles.statLabel}>Qarantiya</span>
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
            <h3>Hot Bed Paketləri</h3>
            <p>$19-dan $799-a qədər paketlər. Xal toplayın, level yüksəldin, bonus qazanın.</p>
          </div>
          <div className={`${styles.featureCard} glass-card`}>
            <div className={styles.featureIcon} style={{ background: 'rgba(0,229,255,0.1)' }}>
              <Users size={24} color="var(--color-secondary)" />
            </div>
            <h3>5 Xətt Referal</h3>
            <p>Birbaşa referaldan 10%, 5-ci xəttə qədər hər yatırımdan 1% qazanın.</p>
          </div>
          <div className={`${styles.featureCard} glass-card`}>
            <div className={styles.featureIcon} style={{ background: 'rgba(124,77,255,0.1)' }}>
              <TrendingUp size={24} color="var(--color-accent)" />
            </div>
            <h3>10 Level Bonus</h3>
            <p>30 pointdən 43,321 pointə qədər toplayın. 99 USDT-dən 72,999 USDT-ə qədər bonus.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <Logo size={28} />
        <p className={styles.footerText}>© 2026 3bucaq. Bütün hüquqlar qorunur.</p>
      </footer>
    </div>
  );
}
