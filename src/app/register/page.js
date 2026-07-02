'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../login/login.module.css';
import Logo from '@/components/layout/Logo';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import LanguageToggle from '@/components/ui/LanguageToggle';
import ThemeToggle from '@/components/ui/ThemeToggle';
import NeuralBackground from '@/components/ui/flow-field-background';
import { useTranslation } from '@/lib/store/languageStore';
import { Mail, Lock, User, Globe, MapPin, Phone, Link2 } from 'lucide-react';
import {
  validateEmail, validatePassword, validateFirstName, validateLastName,
  validateLogin, validatePhone, validateCountry, validateCity,
} from '@/lib/utils/validators';
import { registerUser } from '@/lib/supabase/auth';
import { checkLoginExists, verifyReferralCode } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';
import { COUNTRIES, CITIES } from '@/lib/utils/countries';
import { Suspense } from 'react';

const uniquePhoneCodes = Array.from(
  new Set(COUNTRIES.map((c) => c.phoneCode))
).sort((a, b) => {
  return parseInt(a.replace('+', ''), 10) - parseInt(b.replace('+', ''), 10);
});

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';
  const { t } = useTranslation();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    login: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: 'Azərbaycan',
    city: 'Bakı',
    phone: '',
    referralCode: refCode,
  });
  const [phonePrefix, setPhonePrefix] = useState('+994');
  const [phoneBody, setPhoneBody] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginAvailable, setLoginAvailable] = useState(null);
  const [refValid, setRefValid] = useState(refCode ? null : undefined);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const checkLoginAvailability = async (login) => {
    if (login.length < 3) { setLoginAvailable(null); return; }
    try {
      const exists = await checkLoginExists(login);
      setLoginAvailable(!exists);
    } catch {
      setLoginAvailable(null);
    }
  };

  const checkReferralCode = async (code) => {
    if (!code || code.length < 3) { setRefValid(undefined); return; }
    try {
      const res = await verifyReferralCode(code);
      setRefValid(!!res.valid);
    } catch {
      setRefValid(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    const firstNameErr = validateFirstName(form.firstName);
    if (firstNameErr) newErrors.firstName = firstNameErr;

    const lastNameErr = validateLastName(form.lastName);
    if (lastNameErr) newErrors.lastName = lastNameErr;

    const loginErr = validateLogin(form.login);
    if (loginErr) newErrors.login = loginErr;
    else if (loginAvailable === false) newErrors.login = t('login_available', 'Bu login artıq istifadə olunur');

    const emailErr = validateEmail(form.email);
    if (emailErr) newErrors.email = emailErr;

    const passErr = validatePassword(form.password);
    if (passErr) newErrors.password = passErr;

    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = t('passwords_mismatch', 'Şifrələr eyni deyil');
    }

    const countryErr = validateCountry(form.country);
    if (countryErr) newErrors.country = countryErr;

    const cityErr = validateCity(form.city);
    if (cityErr) newErrors.city = cityErr;

    const fullPhone = `${phonePrefix} ${phoneBody}`.trim();
    const phoneErr = validatePhone(fullPhone);
    if (phoneErr) newErrors.phone = phoneErr;

    if (form.referralCode && refValid === false) {
      newErrors.referralCode = t('ref_not_found', 'Referal kodu tapılmadı');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      // Clear any existing session to prevent admin session hijacking
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn('Sign out before registration failed:', signOutErr);
      }

      const combinedFullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      await registerUser(form.email, form.password, {
        fullName: combinedFullName,
        login: form.login,
        country: form.country,
        city: form.city,
        phone: fullPhone,
        referralCode: form.referralCode || null,
      });
      // E-posta təsdiqi (OTP). Supabase'də "Confirm email" AÇIQ və e-mail şablonu
      // 6 rəqəmli {{ .Token }} göndərəcək şəkildə qurulmalıdır.
      router.push(`/verify?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.topBarLogo}>
          <Logo size={54} showText={true} />
        </Link>
        <div className={styles.topBarRight}>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className={styles.bgGrid} />
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />
      <div className={styles.bgGlow3} />
      <NeuralBackground color="var(--color-primary)" />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={72} />
          </Link>

          <h1 className={styles.title}>{t('register_title', 'Hesab Yaradın')}</h1>
          <p className={styles.subtitle}>{t('register_subtitle', 'Platformaya qoşulun və qazanmağa başlayın')}</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <Input
                label={t('first_name', 'Ad')}
                placeholder={t('first_name', 'Ad')}
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                error={errors.firstName}
                icon={<User size={18} />}
              />

              <Input
                label={t('last_name', 'Soyad')}
                placeholder={t('last_name', 'Soyad')}
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                error={errors.lastName}
                icon={<User size={18} />}
              />
            </div>

            <div className={styles.formRow}>
              <Input
                label={t('username', 'İstifadəçi adı')}
                placeholder="istifadeci_adi"
                value={form.login}
                onChange={(e) => {
                  updateField('login', e.target.value);
                  checkLoginAvailability(e.target.value);
                }}
                error={errors.login}
                success={loginAvailable === true}
                icon={<User size={18} />}
              />

              <Input
                label={t('email', 'Email')}
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                error={errors.email}
                icon={<Mail size={18} />}
              />
            </div>

            <div className={styles.formRow}>
              <Input
                label={t('password', 'Şifrə')}
                type="password"
                placeholder="Min 10 simvol..."
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                error={errors.password}
                icon={<Lock size={18} />}
              />

              <Input
                label={t('confirm_password', 'Şifrənin Təsdiqi')}
                type="password"
                placeholder={t('confirm_password_placeholder', 'Şifrəni yenidən yazın')}
                value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                error={errors.confirmPassword}
                icon={<Lock size={18} />}
              />
            </div>

            <div className={styles.formRow}>
              <Select
                label={t('country', 'Ölkə')}
                value={form.country}
                onChange={(e) => {
                  const countryName = e.target.value;
                  updateField('country', countryName);
                  updateField('city', '');
                  const selected = COUNTRIES.find((c) => c.name === countryName);
                  if (selected) {
                    setPhonePrefix(selected.phoneCode);
                  }
                }}
                error={errors.country}
                icon={<Globe size={18} />}
              >
                <option value="">{t('select_country', 'Ölkə seçin')}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>

              {['Azərbaycan', 'Türkiyə', 'Rusiya'].includes(form.country) ? (
                <Select
                  label={t('city', 'Şəhər')}
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  error={errors.city}
                  icon={<MapPin size={18} />}
                >
                  <option value="">{t('select_city', 'Şəhər seçin')}</option>
                  {(CITIES[form.country] || []).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  label={t('city', 'Şəhər')}
                  placeholder="Şəhər daxil edin"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  error={errors.city}
                  icon={<MapPin size={18} />}
                />
              )}
            </div>

            <div className={styles.phoneGroup}>
              <Select
                label={t('code', 'Kod')}
                value={phonePrefix}
                onChange={(e) => setPhonePrefix(e.target.value)}
                className={styles.phonePrefixSelect}
              >
                {uniquePhoneCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>

              <Input
                label={t('phone', 'Telefon')}
                placeholder="50 123 45 67"
                value={phoneBody}
                onChange={(e) => setPhoneBody(e.target.value)}
                error={errors.phone}
                icon={<Phone size={18} />}
                className={styles.phoneInput}
              />
            </div>

            <Input
              label={t('referral_code_optional', 'Referal Kodu (ixtiyari)')}
              placeholder="REF12345"
              value={form.referralCode}
              onChange={(e) => {
                updateField('referralCode', e.target.value);
                checkReferralCode(e.target.value);
              }}
              error={errors.referralCode}
              success={refValid === true}
              icon={<Link2 size={18} />}
            />

            {errors.general && (
              <div className={styles.errorBox}>{errors.general}</div>
            )}

            <Button type="submit" fullWidth size="lg" loading={loading}>
              {t('register', 'Qeydiyyat')}
            </Button>
          </form>

          <div className={styles.links}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              {t('already_have_account', 'Artıq hesabınız var?')}
            </span>
            <Link href="/login" className={styles.link}>
              {t('login', 'Giriş')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '40px' }}>{t('loading', 'Yüklənir...')}</div>}>
      <RegisterForm />
    </Suspense>
  );
}
