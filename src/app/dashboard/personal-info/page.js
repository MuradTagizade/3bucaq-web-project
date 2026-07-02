'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './personal-info.module.css';
import { User, Lock, MapPin, ShieldCheck, Star, Headphones, Check } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { formatDate } from '@/lib/utils/formatters';
import { updateUserProfile } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

export default function PersonalInfoPage() {
  const { user: authUser, setUser, setLoading } = useAuthStore();
  const { t } = useTranslation();

  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // OTP Verification modal states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const otpRefs = useRef([]);

  const DOC_TYPE_LABELS = t('doc_types', {
    passport: 'Pasport',
    id_card: 'Şəxsiyyət Vəsiqəsi',
    driving_license: 'Sürücülük Vəsiqəsi',
  });

  const KYC_STATUS_LABELS = {
    approved: t('approved', 'TƏSDİQLƏNİB'),
    pending: t('pending', 'GÖZLƏYİR'),
    rejected: t('rejected', 'RƏDD EDİLİB'),
    none: t('not_submitted', 'GÖNDƏRİLMƏYİB'),
  };

  function maskPhone(phone) {
    if (!phone || phone === '—') return t('not_set', 'Təyin edilməyib');
    const clean = phone.replace(/\s+/g, '');
    if (clean.startsWith('+994')) {
      const code = clean.slice(4, 6);
      const last = clean.slice(-2);
      return `+994 ${code} *** ** ${last}`;
    }
    if (clean.length > 6) {
      return `${clean.slice(0, 4)} *** ** ${clean.slice(-2)}`;
    }
    return clean;
  }

  const getHighestActivePackage = (pkgs) => {
    const labels = t('highest_package_labels', {
      no_pkg: 'Paket yoxdur',
      pkg799: 'VIP Səviyyə',
      pkg399: 'Whale Səviyyə',
      pkg199: 'Elite Səviyyə',
      pkg99: 'Pro Səviyyə',
      pkg49: 'Basic Səviyyə',
      pkg19: 'Starter Səviyyə',
    });
    
    if (!pkgs) return labels.no_pkg;
    if (pkgs.pkg799) return labels.pkg799;
    if (pkgs.pkg399) return labels.pkg399;
    if (pkgs.pkg199) return labels.pkg199;
    if (pkgs.pkg99) return labels.pkg99;
    if (pkgs.pkg49) return labels.pkg49;
    if (pkgs.pkg19) return labels.pkg19;
    return labels.no_pkg;
  };

  useEffect(() => {
    if (authUser) {
      setFullName(authUser.fullName || '');
      setCountry(authUser.country || '');
      setCity(authUser.city || '');
      setEmail(authUser.email || '');
    }
  }, [authUser]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    setOtpError('');

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    setOtpError('');
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'email_change',
        email,
      });
      if (resendErr) throw new Error(resendErr.message);
      alert(t('otp_resent', 'Təsdiq kodu yenidən göndərildi!'));
    } catch (err) {
      setOtpError(err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!authUser?.uid) return;
    setSaving(true);
    setStatusMsg({ type: '', text: '' });
    try {
      // If email has changed, trigger verification email / OTP change
      if (email !== authUser.email) {
        const { error: authErr } = await supabase.auth.updateUser({ email });
        if (authErr) throw new Error(t('email_update_err', 'E-poçt yenilənərkən xəta: ') + authErr.message);
        
        setShowOtpModal(true);
        setSaving(false);
        setTimeout(() => {
          otpRefs.current[0]?.focus();
        }, 100);
        return;
      }

      // If email didn't change, update other info directly
      await updateUserProfile(authUser.uid, {
        full_name: fullName,
        country: country,
        city: city,
      });

      setUser({
        ...authUser,
        fullName: fullName,
        country: country,
        city: city,
      });

      setStatusMsg({ type: 'success', text: t('update_success', 'Məlumatlar uğurla yeniləndi!') });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: t('error_occurred', 'Xəta baş verdi') + ': ' + err.message });
    } finally {
      // OTP moduna geçildiyse zaten yukarıda false yapıldı; her durumda kilidi kaldır (#14).
      setSaving(false);
    }
  };

  const handleVerifyOtp = async () => {
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setOtpError(t('enter_6_digits', '6 rəqəmli təsdiq kodunu daxil edin'));
      return;
    }

    setVerifying(true);
    setOtpError('');
    try {
      // Verify OTP with type 'email_change'
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: fullCode,
        type: 'email_change',
      });
      if (verifyErr) throw new Error(verifyErr.message);

      // Doğrulama başarılı: auth e-postası değişti → profiles.email'i güvenli RPC ile eşitle
      await supabase.rpc('sync_my_email');
      await updateUserProfile(authUser.uid, {
        full_name: fullName,
        country: country,
        city: city,
      });

      setUser({
        ...authUser,
        fullName: fullName,
        country: country,
        city: city,
        email: email,
      });

      setShowOtpModal(false);
      setOtpDigits(['', '', '', '', '', '']);
      setStatusMsg({ type: 'success', text: t('profile_update_success', 'E-poçt və digər məlumatlar uğurla yeniləndi!') });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const currentPkgLabel = authUser ? getHighestActivePackage(authUser.activePackages) : t('no_packages', 'Paket yoxdur');
  const isKycApproved = authUser?.kycStatus === 'approved';

  return (
    <div className={styles.page}>
      <div className={styles.gridContainer}>
        {/* Left Column (Forms) */}
        <form onSubmit={handleUpdate} className={styles.leftColumn}>
          {/* Account Details Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <User size={18} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('account_info', 'Hesab Məlumatları')}</h3>
            </div>

            <div className={styles.inputsGrid}>
              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>{t('fullname_label', 'AD VƏ SOYAD')}</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={styles.textInput}
                  placeholder={t('enter_info_placeholder', 'Məlumat daxil edin')}
                />
              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>{t('login_label', 'İSTİFADƏÇİ ADI (LOGİN)')}</label>
                <div className={styles.disabledInputContainer}>
                  <input
                    type="text"
                    value={authUser?.displayLogin || ''}
                    disabled
                    className={styles.disabledInput}
                  />
                  <Lock size={14} className={styles.lockIcon} />
                </div>
              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>{t('email_label', 'E-POÇT')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.textInput}
                  placeholder={t('enter_email_placeholder', 'E-poçt daxil edin')}
                />
              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>{t('phone_label', 'TELEFON NÖMRƏSİ')}</label>
                <div className={styles.disabledInputContainer}>
                  <input
                    type="text"
                    value={maskPhone(authUser?.phone)}
                    disabled
                    className={styles.disabledInput}
                  />
                  <Lock size={14} className={styles.lockIcon} />
                </div>
              </div>

              {isKycApproved && (
                <div className={styles.inputWrapper}>
                  <label className={styles.inputLabel}>{t('identity_number_label', 'KİMLİK NÖMRƏSİ')}</label>
                  <div className={styles.disabledInputContainer}>
                    <input
                      type="text"
                      value={authUser?.identityNumber || ''}
                      disabled
                      className={styles.disabledInput}
                    />
                    <Lock size={14} className={styles.lockIcon} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Location Card */}
          <div className={`${styles.card} ${styles.locationCard}`}>
            {/* Globe Background Decal SVG */}
            <svg viewBox="0 0 100 100" className={styles.globeWatermark}>
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <path d="M10,50 Q50,25 90,50 Q50,75 10,50" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <path d="M50,10 Q25,50 50,90 Q75,50 50,10" stroke="currentColor" strokeWidth="0.8" fill="none" />
              <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="0.8" />
              <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="0.8" />
            </svg>

            <div className={styles.cardHeader}>
              <MapPin size={18} className={styles.cardIcon} />
              <h3 className={styles.cardTitle}>{t('location', 'Məkan')}</h3>
            </div>

            <div className={styles.inputsGrid}>
              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>{t('country_label', 'ÖLKƏ')}</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={styles.textInput}
                  placeholder={t('enter_country_placeholder', 'Ölkə daxil edin')}
                />
              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.inputLabel}>{t('city_label', 'ŞƏHƏR')}</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={styles.textInput}
                  placeholder={t('enter_city_placeholder', 'Şəhər daxil edin')}
                />
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className={styles.formFooter}>
            {statusMsg.text && (
              <div className={`${styles.statusAlert} ${statusMsg.type === 'success' ? styles.alertSuccess : styles.alertError}`}>
                {statusMsg.text}
              </div>
            )}

            <div className={styles.footerButtons}>
              <button
                type="submit"
                disabled={saving}
                className={styles.saveBtn}
              >
                {saving ? t('please_wait', 'Gözləyin...') : t('update_btn', 'Yenilə')}
              </button>
            </div>
          </div>
        </form>

        {/* Right Column (Widgets) */}
        <div className={styles.rightColumn}>
          {/* KYC Status Card */}
          <div className={styles.card}>
            <div className={styles.kycHeaderBlock}>
              {/* Concentric check emblem */}
              <div className={styles.emblemOuter}>
                <div className={styles.emblemInner}>
                  <ShieldCheck size={28} className={styles.shieldIcon} />
                </div>
              </div>
              <h3 className={styles.kycTitle}>{t('kyc_status_label', 'KYC Statusu')}</h3>
              <span className={`${styles.kycPill} ${
                authUser?.kycStatus === 'approved' 
                  ? styles.kycApproved 
                  : authUser?.kycStatus === 'pending' 
                  ? styles.kycPending 
                  : authUser?.kycStatus === 'rejected' 
                  ? styles.kycRejected 
                  : styles.kycNone
              }`}>
                <span className={styles.kycDot} />
                {KYC_STATUS_LABELS[authUser?.kycStatus || 'none']}
              </span>
            </div>

            <div className={styles.kycDetailsList}>
              <div className={styles.kycDetailRow}>
                <span>{t('doc_type_label', 'Sənəd Növü')}</span>
                <span>{DOC_TYPE_LABELS[authUser?.kycDocumentType] || '—'}</span>
              </div>
              <div className={styles.kycDetailRow}>
                <span>{t('approval_date', 'Təsdiq Tarixi')}</span>
                <span>{isKycApproved && authUser?.createdAt ? formatDate(authUser?.createdAt) : '—'}</span>
              </div>
              <div className={styles.kycDetailRow}>
                <span>{t('risk_level', 'Risk Səviyyəsi')}</span>
                <span className={isKycApproved ? styles.riskLow : styles.riskDefault}>
                  {isKycApproved ? t('low', 'Aşağı') : '—'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.open('mailto:support@levelup.com')}
              className={styles.supportBtn}
            >
              <Headphones size={16} />
              {t('contact_support', 'Dəstək ilə Əlaqə')}
            </button>
          </div>

          {/* Current Package Card */}
          <div className={`${styles.card} ${styles.packageCard}`}>
            <div className={styles.packageIconBox}>
              <Star size={20} className={styles.starIcon} />
            </div>
            <div className={styles.packageInfo}>
              <span className={styles.packageLabel}>{t('current_package', 'Cari Paket')}</span>
              <span className={styles.packageValue}>{currentPkgLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {showOtpModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>{t('email_verification', 'E-poçt Təsdiqi')}</h3>
            <p className={styles.modalSubtitle}>
              {t('otp_desc', 'Yeni e-poçt {{email}} ünvanına göndərilən 6 rəqəmli təsdiq kodunu daxil edin.')
                .replace('{{email}}', email)}
            </p>

            <div className={styles.otpInputs}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`${styles.otpInput} ${digit ? styles.filled : ''}`}
                />
              ))}
            </div>

            {otpError && <div className={styles.otpError}>{otpError}</div>}

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifying}
                className={styles.confirmBtn}
              >
                {verifying ? t('please_wait', 'Gözləyin...') : t('confirm', 'Təsdiqlə')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOtpModal(false);
                  setOtpError('');
                  setOtpDigits(['', '', '', '', '', '']);
                }}
                className={styles.cancelBtn}
              >
                {t('cancel', 'Ləğv et')}
              </button>
            </div>
            <button
              type="button"
              className={styles.resendBtn}
              onClick={handleResendOtp}
            >
              {t('resend_code', 'Kodu yenidən göndər')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
