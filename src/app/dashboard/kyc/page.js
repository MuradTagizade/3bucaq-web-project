'use client';

import { useState } from 'react';
import styles from './kyc.module.css';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { ShieldCheck, Upload, Camera, FileText, AlertTriangle } from 'lucide-react';
import { KYC_DOC_TYPES } from '@/lib/utils/constants';
import { getKYCStatusLabel, getKYCStatusVariant } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { submitKYC, checkIdentityNumberExists } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

export default function KYCPage() {
  const { user: authUser, setUser } = useAuthStore();
  const { t } = useTranslation();
  const [docType, setDocType] = useState('id_card');
  const [identityNumber, setIdentityNumber] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [docBackFile, setDocBackFile] = useState(null);
  const [selfieFile, setSelfieFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const kycStatus = authUser?.kycStatus || 'none';
  const canSubmit = kycStatus === 'none' || kycStatus === 'rejected';

  const uploadFile = async (file, path) => {
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return data.path;
  };

  // Client tərəfdə fayl yoxlaması (bucket server tərəfdə də 5MB/şəkil tətbiq edir)
  const validateImageFile = (file) => {
    if (!file.type?.startsWith('image/')) {
      return t('file_must_be_image', 'Yalnız şəkil faylı yükləmək olar.');
    }
    if (file.size > 5 * 1024 * 1024) {
      return t('file_too_large', 'Şəkil faylı maksimum 5MB ola bilər.');
    }
    return null;
  };

  const handleIdentityNumberBlur = async () => {
    if (!identityNumber.trim()) return;
    try {
      const isDuplicate = await checkIdentityNumberExists(authUser.uid, identityNumber);
      if (isDuplicate) {
        setDuplicateWarning(t('identity_already_exists', 'Bu kimlik nömrəsi ilə artıq bir hesab mövcuddur!'));
      } else {
        setDuplicateWarning('');
      }
    } catch (err) {
      console.error('Error checking duplicate ID:', err);
    }
  };

  const handleSubmit = async () => {
    if (!identityNumber.trim()) {
      setToast(t('enter_identity_error', 'Zəhmət olmasa, kimlik nömrəsini daxil edin'));
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!docFile || !docBackFile || !selfieFile) {
      setToast(t('upload_all_docs', 'Sənədin ön, arxa və selfie şəkillərini yükləyin'));
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const fileErr = validateImageFile(docFile) || validateImageFile(docBackFile) || validateImageFile(selfieFile);
    if (fileErr) {
      setToast(fileErr);
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setLoading(true);
    try {
      const uid = authUser.uid;

      // Duplicate check
      const isDuplicate = await checkIdentityNumberExists(uid, identityNumber);
      if (isDuplicate) {
        setDuplicateWarning(t('identity_already_exists', 'Bu kimlik nömrəsi ilə artıq bir hesab mövcuddur!'));
        setToast(t('identity_already_exists', 'Bu kimlik nömrəsi ilə artıq bir hesab mövcuddur!'));
        setLoading(false);
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const docPath = await uploadFile(docFile, `${uid}/document_front_${Date.now()}`);
      const docBackPath = await uploadFile(docBackFile, `${uid}/document_back_${Date.now()}`);
      const selfiePath = await uploadFile(selfieFile, `${uid}/selfie_${Date.now()}`);

      await submitKYC(uid, docType, docPath, selfiePath, docBackPath, identityNumber.trim());

      setUser({ 
        ...authUser, 
        kycStatus: 'pending',
        kycDocumentNumber: identityNumber.trim()
      });
      setToast(t('kyc_sent_success', 'KYC sənədləriniz göndərildi! Admin yoxlayacaq.'));
      setDocFile(null);
      setDocBackFile(null);
      setSelfieFile(null);
      setIdentityNumber('');
      setDuplicateWarning('');
    } catch (err) {
      setToast(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <ShieldCheck size={22} color="var(--color-primary)" />
          {t('kyc_identification', 'KYC Identifikasiya')}
        </h2>
        <Badge variant={getKYCStatusVariant(kycStatus)}>
          {getKYCStatusLabel(kycStatus)}
        </Badge>
      </div>

      {kycStatus === 'approved' && (
        <div className={styles.successCard}>
          <ShieldCheck size={40} color="var(--color-success)" />
          <h3>{t('identity_verified', 'Şəxsiyyətiniz təsdiqlənib')}</h3>
          <p>{t('kyc_approved_msg', 'KYC prosesi uğurla tamamlanmışdır.')}</p>
        </div>
      )}

      {kycStatus === 'pending' && (
        <div className={styles.pendingCard}>
          <AlertTriangle size={40} color="var(--color-warning)" />
          <h3>{t('documents_checking', 'Sənədləriniz yoxlanılır')}</h3>
          <p>{t('kyc_pending_msg', 'Admin sənədlərinizi yoxlayır. Zəhmət olmasa gözləyin.')}</p>
        </div>
      )}

      {canSubmit && (
        <div className={styles.formCard}>
          {kycStatus === 'rejected' && (
            <div className={styles.rejectedNotice}>
              <AlertTriangle size={16} />
              <span>{t('kyc_rejected_notice', 'Əvvəlki sənədləriniz rədd edilib. Yenidən yükləyin.')}</span>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>{t('identity_number_label', 'Kimlik Nömrəsi')}</label>
            <input
              type="text"
              value={identityNumber}
              onChange={(e) => {
                setIdentityNumber(e.target.value);
                if (duplicateWarning) setDuplicateWarning('');
              }}
              onBlur={handleIdentityNumberBlur}
              placeholder={t('enter_identity_placeholder', 'Kimlik nömrəsini daxil edin')}
              className={`${styles.textInput} ${duplicateWarning ? styles.textInputError : ''}`}
            />
            {duplicateWarning && (
              <span className={styles.errorText}>
                {duplicateWarning}
              </span>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('doc_type_label', 'Sənəd Növü')}</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={styles.select}
            >
              {KYC_DOC_TYPES.map((tItem) => (
                <option key={tItem.value} value={tItem.value}>
                  {t('doc_types.' + tItem.value, tItem.label)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.uploadGroup}>
            {/* Front of Document */}
            <div className={styles.uploadBox}>
              <FileText size={24} color="var(--color-primary)" />
              <span style={{ fontWeight: 600 }}>{t('doc_front', 'Sənəd Ön Üzü')}</span>
              <label className={styles.uploadBtn}>
                <Upload size={14} />
                {docFile ? docFile.name : t('select', 'Seçin...')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDocFile(e.target.files[0])}
                  hidden
                />
              </label>
            </div>

            {/* Back of Document */}
            <div className={styles.uploadBox}>
              <FileText size={24} color="var(--color-accent-light)" style={{ color: 'var(--color-info)' }} />
              <span style={{ fontWeight: 600 }}>{t('doc_back', 'Sənəd Arxa Üzü')}</span>
              <label className={styles.uploadBtn}>
                <Upload size={14} />
                {docBackFile ? docBackFile.name : t('select', 'Seçin...')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDocBackFile(e.target.files[0])}
                  hidden
                />
              </label>
            </div>

            {/* Selfie with Document */}
            <div className={styles.uploadBox}>
              <Camera size={24} color="var(--color-warning)" />
              <span style={{ fontWeight: 600 }}>{t('selfie_doc', 'Selfie + Sənəd')}</span>
              <label className={styles.uploadBtn}>
                <Upload size={14} />
                {selfieFile ? selfieFile.name : t('select', 'Seçin...')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelfieFile(e.target.files[0])}
                  hidden
                />
              </label>
            </div>
          </div>

          <Button
            fullWidth
            size="lg"
            onClick={handleSubmit}
            loading={loading}
            disabled={!docFile || !docBackFile || !selfieFile || !identityNumber.trim() || !!duplicateWarning}
          >
            {t('send_documents', 'Sənədləri Göndər')}
          </Button>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
