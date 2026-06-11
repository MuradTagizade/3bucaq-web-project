'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './verify.module.css';
import Logo from '@/components/layout/Logo';
import Button from '@/components/ui/Button';
import { supabase } from '@/lib/supabase/config';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    text.split('').forEach((char, i) => {
      if (i < 6) newCode[i] = char;
    });
    setCode(newCode);
    if (text.length >= 6) inputRefs.current[5]?.focus();
  };

  const handleSubmit = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('6 rəqəmli kodu daxil edin');
      return;
    }

    if (!email) {
      setError('Email ünvanı tapılmadı. Zəhmət olmasa yenidən qeydiyyatdan keçin.');
      return;
    }

    setLoading(true);
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: fullCode,
        type: 'signup',
      });
      if (verifyErr) throw new Error(verifyErr.message);

      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Email ünvanı tapılmadı.');
      return;
    }
    setError('');
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendErr) throw new Error(resendErr.message);
      alert('Təsdiq emaili yenidən göndərildi!');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.logoWrap}>
            <Logo size={48} showText={false} />
          </div>

          <h1 className={styles.title}>Email Təsdiqi</h1>
          <p className={styles.subtitle}>
            {email ? <strong>{email}</strong> : 'Email'} ünvanına göndərilən 6 rəqəmli kodu daxil edin
          </p>

          <div className={styles.codeInputs} onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`${styles.codeInput} ${digit ? styles.filled : ''}`}
              />
            ))}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <Button fullWidth size="lg" onClick={handleSubmit} loading={loading}>
            İrəli
          </Button>

          <button className={styles.resend} onClick={handleResend} disabled={!email}>
            Kodu yenidən göndər
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.card} style={{ textAlign: 'center', padding: '40px 0' }}>
              <span>Yüklənir...</span>
            </div>
          </div>
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
