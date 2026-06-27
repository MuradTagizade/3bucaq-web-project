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
import { useTranslation } from '@/lib/store/languageStore';
import { Mail, Lock, User, Globe, MapPin, Phone, Link2 } from 'lucide-react';
import {
  validateEmail, validatePassword, validateFullName,
  validateLogin, validatePhone, validateCountry, validateCity,
} from '@/lib/utils/validators';
import { registerUser } from '@/lib/supabase/auth';
import { getUserByLogin, getUserByReferralCode } from '@/lib/supabase/database';
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
    fullName: '',
    login: '',
    email: '',
    password: '',
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
      const existing = await getUserByLogin(login);
      setLoginAvailable(!existing);
    } catch {
      setLoginAvailable(null);
    }
  };

  const checkReferralCode = async (code) => {
    if (!code || code.length < 3) { setRefValid(undefined); return; }
    try {
      const user = await getUserByReferralCode(code);
      setRefValid(!!user);
    } catch {
      setRefValid(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    const nameErr = validateFullName(form.fullName);
    if (nameErr) newErrors.fullName = nameErr;

    const loginErr = validateLogin(form.login);
    if (loginErr) newErrors.login = loginErr;
    else if (loginAvailable === false) newErrors.login = t('login_available', 'Bu login artıq istifadə olunur');

    const emailErr = validateEmail(form.email);
    if (emailErr) newErrors.email = emailErr;

    const passErr = validatePassword(form.password);
    if (passErr) newErrors.password = passErr;

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
      await registerUser(form.email, form.password, {
        fullName: form.fullName,
        login: form.login,
        country: form.country,
        city: form.city,
        phone: fullPhone,
        referralCode: form.referralCode || null,
      });
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
        <LanguageToggle />
      </div>
      <div className={styles.bgGrid} />
      <div className={styles.container}>
        <div className={styles.card}>
          <Link href="/" className={styles.logoLink}>
            <Logo size={48} />
          </Link>

          <h1 className={styles.title}>{t('register_title', 'Hesab Yaradın')}</h1>
          <p className={styles.subtitle}>{t('register_subtitle', 'Platformaya qoşulun və qazanmağa başlayın')}</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label={t('fullname', 'Ad Soyad')}
              placeholder={t('fullname', 'Ad Soyad')}
              value={form.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              error={errors.fullName}
              icon={<User size={18} />}
            />

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

            <Input
              label={t('password', 'Şifrə')}
              type="password"
              placeholder="Min 10 simvol, 1 böyük hərf, 1 rəqəm"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              error={errors.password}
              icon={<Lock size={18} />}
            />

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
                  {c.name} ({c.phoneCode})
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
