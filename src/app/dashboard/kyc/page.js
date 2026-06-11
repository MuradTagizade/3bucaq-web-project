'use client';

import { useState } from 'react';
import styles from './kyc.module.css';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { ShieldCheck, Upload, Camera, FileText, AlertTriangle } from 'lucide-react';
import { KYC_DOC_TYPES } from '@/lib/utils/constants';
import { getKYCStatusLabel, getKYCStatusVariant } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import { submitKYC } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

export default function KYCPage() {
  const { user: authUser, setUser } = useAuthStore();
  const [docType, setDocType] = useState('id_card');
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

  const handleSubmit = async () => {
    if (!docFile || !docBackFile || !selfieFile) {
      setToast('Sənədin ön, arxa və selfie şəkillərini yükləyin');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setLoading(true);
    try {
      const uid = authUser.uid;
      const docPath = await uploadFile(docFile, `${uid}/document_front_${Date.now()}`);
      const docBackPath = await uploadFile(docBackFile, `${uid}/document_back_${Date.now()}`);
      const selfiePath = await uploadFile(selfieFile, `${uid}/selfie_${Date.now()}`);

      await submitKYC(uid, docType, docPath, selfiePath, docBackPath);

      setUser({ ...authUser, kycStatus: 'pending' });
      setToast('KYC sənədləriniz göndərildi! Admin yoxlayacaq.');
      setDocFile(null);
      setDocBackFile(null);
      setSelfieFile(null);
    } catch (err) {
      setToast('Xəta: ' + err.message);
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
          KYC Identifikasiya
        </h2>
        <Badge variant={getKYCStatusVariant(kycStatus)}>
          {getKYCStatusLabel(kycStatus)}
        </Badge>
      </div>

      {kycStatus === 'approved' && (
        <div className={styles.successCard}>
          <ShieldCheck size={40} color="var(--color-success)" />
          <h3>Şəxsiyyətiniz təsdiqlənib</h3>
          <p>KYC prosesi uğurla tamamlanmışdır.</p>
        </div>
      )}

      {kycStatus === 'pending' && (
        <div className={styles.pendingCard}>
          <AlertTriangle size={40} color="var(--color-warning)" />
          <h3>Sənədləriniz yoxlanılır</h3>
          <p>Admin sənədlərinizi yoxlayır. Zəhmət olmasa gözləyin.</p>
        </div>
      )}

      {canSubmit && (
        <div className={styles.formCard}>
          {kycStatus === 'rejected' && (
            <div className={styles.rejectedNotice}>
              <AlertTriangle size={16} />
              <span>Əvvəlki sənədləriniz rədd edilib. Yenidən yükləyin.</span>
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Sənəd Növü</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className={styles.select}
            >
              {KYC_DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.uploadGroup}>
            {/* Front of Document */}
            <div className={styles.uploadBox}>
              <FileText size={24} color="var(--color-primary)" />
              <span style={{ fontWeight: 600 }}>Sənəd Ön Üzü</span>
              <label className={styles.uploadBtn}>
                <Upload size={14} />
                {docFile ? docFile.name : 'Seçin...'}
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
              <span style={{ fontWeight: 600 }}>Sənəd Arxa Üzü</span>
              <label className={styles.uploadBtn}>
                <Upload size={14} />
                {docBackFile ? docBackFile.name : 'Seçin...'}
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
              <span style={{ fontWeight: 600 }}>Selfie + Sənəd</span>
              <label className={styles.uploadBtn}>
                <Upload size={14} />
                {selfieFile ? selfieFile.name : 'Seçin...'}
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
            disabled={!docFile || !docBackFile || !selfieFile}
          >
            Sənədləri Göndər
          </Button>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
