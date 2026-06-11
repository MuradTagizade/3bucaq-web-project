'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import Logo from '@/components/layout/Logo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Mail, Lock } from 'lucide-react';
import { validateEmail } from '@/lib/utils/validators';
import { loginUser } from '@/lib/supabase/auth';
import { getUserByUid } from '@/lib/supabase/database';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;
    if (!password) newErrors.password = 'Parol tələb olunur';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const authUser = await loginUser(email, password);
      // Check role and redirect accordingly
      const profile = await getUserByUid(authUser.id);
      if (profile?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgGrid} />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={48} />
          </Link>

          <h1 className={styles.title}>Xoş gəldiniz</h1>
          <p className={styles.subtitle}>Hesabınıza daxil olun</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={<Mail size={18} />}
            />

            <Input
              label="Parol"
              type="password"
              placeholder="Parolunuzu daxil edin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={<Lock size={18} />}
            />

            {errors.general && (
              <div className={styles.errorBox}>
                <span>WRONG</span> — {errors.general}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              Giriş
            </Button>
          </form>

          <div className={styles.links}>
            <Link href="/forgot-password" className={styles.link}>
              Parolu unutmuşam
            </Link>
            <span className={styles.divider}>•</span>
            <Link href="/register" className={styles.link}>
              Hesab yarat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
