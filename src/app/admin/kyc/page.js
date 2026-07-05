'use client';

import { useState, useEffect } from 'react';
import styles from './kyc.module.css';
import { 
  Search, SlidersHorizontal, Hourglass, CheckCircle, XCircle, X, 
  ShieldCheck, Headphones, Eye, Check, Info, ArrowUpDown
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { getUsers, updateKYCStatus, addAdminLog } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

export default function AdminKYCRequestsPage() {
  const { user: adminUser } = useAuthStore();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest
  const [rejectModal, setRejectModal] = useState({ open: false, user: null });
  const [rejectReason, setRejectReason] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [signedUrls, setSignedUrls] = useState({});

  function timeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const diffMs = now - new Date(dateString);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('time_ago.now', 'İndi');
    if (diffMins < 60) return t('time_ago.mins', '{{num}} dəq. əvvəl').replace('{{num}}', diffMins);
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('time_ago.hours', '{{num}} saat əvvəl').replace('{{num}}', diffHours);
    const diffDays = Math.floor(diffHours / 24);
    return t('time_ago.days', '{{num}} gün əvvəl').replace('{{num}}', diffDays);
  }

  const DOC_TYPE_LABELS = {
    passport: t('doc_types.passport', 'Xarici Pasport'),
    id_card: t('doc_types.id_card', 'Şəxsiyyət Vəsiqəsi'),
    driving_license: t('doc_types.driving_license', 'Sürücülük Vəsiqəsi'),
  };

  async function loadData() {
    try {
      const data = await getUsers();
      setUsers(data);

      // KYC belgeleri private bucket'ta — imzalı URL üret (aksi halde <img> kırık gelir)
      const docPaths = [];
      data.forEach((u) => {
        if (u.kyc_status === 'pending' || u.kyc_status === 'rejected') {
          [u.kyc_document_url, u.kyc_document_back_url, u.kyc_selfie_url].forEach((p) => { if (p) docPaths.push(p); });
        }
      });
      if (docPaths.length > 0) {
        const { data: signed } = await supabase.storage.from('kyc-documents').createSignedUrls(docPaths, 3600);
        if (signed) {
          const map = {};
          signed.forEach((s) => { if (s.signedUrl) map[s.path] = s.signedUrl; });
          setSignedUrls(map);
        }
      }

      // Calculate stats
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      data.forEach((u) => {
        if (u.kyc_status === 'pending') pendingCount++;
        else if (u.kyc_status === 'approved') approvedCount++;
        else if (u.kyc_status === 'rejected') rejectedCount++;
      });

      setStats({ pending: pendingCount, approved: approvedCount, rejected: rejectedCount });

      // Fetch kyc reject reasons from admin_logs
      const { data: logs, error } = await supabase
        .from('admin_logs')
        .select('target_uid, details')
        .eq('action', 'kyc_rejected')
        .order('created_at', { ascending: false });

      if (!error && logs) {
        const reasonsMap = {};
        logs.forEach((log) => {
          // Keep the latest reject reason for each target user
          if (log.target_uid && !reasonsMap[log.target_uid]) {
            reasonsMap[log.target_uid] = log.details;
          }
        });
        setRejectReasons(reasonsMap);
      }
    } catch (err) {
      console.error('Failed to load KYC data:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (user) => {
    if (!user) return;
    try {
      await updateKYCStatus(user.id, 'approved');
      await addAdminLog(adminUser?.uid, 'kyc_approved', user.id, 'KYC Verification Approved');
      await loadData();
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleOpenReject = (user) => {
    setRejectReason('');
    setRejectModal({ open: true, user });
  };

  const handleConfirmReject = async () => {
    const { user } = rejectModal;
    if (!user || !rejectReason.trim()) return;

    try {
      await updateKYCStatus(user.id, 'rejected');
      await addAdminLog(adminUser?.uid, 'kyc_rejected', user.id, rejectReason);
      setRejectModal({ open: false, user: null });
      setRejectReason('');
      await loadData();
    } catch (err) {
      alert(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  // Filter & Sort requests
  const filteredUsers = users
    .filter((u) => u.kyc_status === 'pending' || u.kyc_status === 'rejected')
    .filter((u) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const nameMatch = u.full_name?.toLowerCase().includes(query);
      const codeMatch = u.user_code?.toLowerCase().includes(query);
      return nameMatch || codeMatch;
    });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <span>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  const successRate = stats.approved + stats.rejected > 0
    ? Math.round((stats.approved / (stats.approved + stats.rejected)) * 100)
    : 100;

  return (
    <div className={styles.page}>
      {/* Header Row */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('kyc_verification_title', 'KYC Təsdiqləməsi')}</h1>
        <div className={styles.headerSearch}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={t('search_users_placeholder', 'İstifadəçi axtar...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.pendingCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>{t('pending', 'GÖZLƏYƏN')}</span>
            <Hourglass size={18} className={styles.pendingIcon} />
          </div>
          <div className={styles.metricValueBlock}>
            <span className={styles.metricValue}>{stats.pending}</span>
          </div>
        </div>

        <div className={`${styles.metricCard} ${styles.approvedCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>{t('approved', 'TƏSDİQLƏNİB')}</span>
            <CheckCircle size={18} className={styles.approvedIcon} />
          </div>
          <div className={styles.metricValueBlock}>
            <span className={styles.metricValue}>{stats.approved.toLocaleString()}</span>
            <span className={styles.metricBadge}>{t('approved_with_rate', '{{rate}}% müvəffəqiyyət').replace('{{rate}}', successRate)}</span>
          </div>
        </div>

        <div className={`${styles.metricCard} ${styles.rejectedCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>{t('rejected', 'RƏDD EDİLİB')}</span>
            <XCircle size={18} className={styles.rejectedIcon} />
          </div>
          <div className={styles.metricValueBlock}>
            <span className={styles.metricValue}>{stats.rejected}</span>
            <span className={styles.metricBadge}>{t('accuracy_rate', 'Dəqiqlik dərəcəsi')}</span>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className={styles.filterRow}>
        <div className={styles.leftFilters}>
          <button className={styles.filterBtn}>
            <SlidersHorizontal size={14} />
            {t('filter', 'Filtr')}
          </button>
          
          <div className={styles.sortWrapper}>
            <ArrowUpDown size={14} className={styles.sortIcon} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="newest">{t('sort_newest', 'Tarixə görə (Yeni)')}</option>
              <option value="oldest">{t('sort_oldest', 'Tarixə görə (Köhnə)')}</option>
            </select>
          </div>
        </div>

        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} />
          {t('live_update_active', 'Canlı Yeniləmə Aktivdir')}
        </div>
      </div>

      {/* Requests Grid */}
      {sortedUsers.length === 0 ? (
        <div className={styles.emptyState}>
          <ShieldCheck size={48} color="var(--text-muted)" />
          <p>{t('no_pending_kyc', 'Heç bir aktiv KYC sorğusu tapılmadı')}</p>
        </div>
      ) : (
        <div className={styles.requestsGrid}>
          {sortedUsers.map((user) => {
            const isPending = user.kyc_status === 'pending';
            const initials = (user.full_name || user.user_code || 'U').slice(0, 2).toUpperCase();
            const rejectReasonText = rejectReasons[user.id] || t('kyc_rejected_default', 'Sənəd məlumatları oxunmur.');

            return (
              <div key={user.id} className={styles.requestCard}>
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.avatarWrapper}>
                    <div className={styles.avatar}>{initials}</div>
                    <span className={`${styles.statusDot} ${isPending ? styles.dotPending : styles.dotRejected}`} />
                  </div>

                  <div className={styles.userInfo}>
                    <h4 className={styles.userFullName}>{user.full_name || user.user_code}</h4>
                    <span className={styles.userId}>ID: {user.user_code || '—'}</span>
                  </div>

                  <div className={styles.headerRight}>
                    <span className={`${styles.statusBadge} ${isPending ? styles.badgePending : styles.badgeRejected}`}>
                      {isPending ? t('pending', 'Gözləyir') : t('rejected', 'İmtina Edilib')}
                    </span>
                    <span className={styles.timeLabel}>{timeAgo(user.created_at)}</span>
                  </div>
                </div>

                {/* KYC Metadata */}
                <div style={{ padding: '12px 24px 0', display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{t('doc_type_label', 'Sənəd Növü')}:</strong> {DOC_TYPE_LABELS[user.kyc_document_type] || user.kyc_document_type || '—'}
                  </span>
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{t('identity_number_label', 'Kimlik Nömrəsi')}:</strong> <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace' }}>{user.kyc_document_number || '—'}</code>
                  </span>
                </div>

                {/* Document Previews */}
                {isPending ? (
                  <div className={styles.documentsRow}>
                    {/* Front side */}
                    <div
                      className={styles.documentBox}
                      onClick={() => setPreviewImage(signedUrls[user.kyc_document_url])}
                      title={t('doc_front_zoom', 'Zoom document front')}
                    >
                      {signedUrls[user.kyc_document_url] ? (
                        <img src={signedUrls[user.kyc_document_url]} alt={t('doc_front', 'Document Front')} className={styles.docImage} />
                      ) : (
                        <div className={styles.docPlaceholder}>{t('doc_front_missing', 'No Front Image')}</div>
                      )}
                      <span className={styles.docLabel}>{t('doc_front_label', 'Ön Üz')} ({DOC_TYPE_LABELS[user.kyc_document_type] || t('document', 'Document')})</span>
                    </div>

                    {/* Back side */}
                    <div
                      className={styles.documentBox}
                      onClick={() => setPreviewImage(signedUrls[user.kyc_document_back_url])}
                      title={t('doc_back_zoom', 'Zoom document back')}
                    >
                      {signedUrls[user.kyc_document_back_url] ? (
                        <img src={signedUrls[user.kyc_document_back_url]} alt={t('doc_back', 'Document Back')} className={styles.docImage} />
                      ) : (
                        <div className={styles.docPlaceholder}>{t('doc_back_missing', 'No Back Image')}</div>
                      )}
                      <span className={styles.docLabel}>{t('doc_back_label', 'Arxa Üz')} ({DOC_TYPE_LABELS[user.kyc_document_type] || t('document', 'Document')})</span>
                    </div>

                    {/* Selfie side */}
                    <div
                      className={styles.documentBox}
                      onClick={() => setPreviewImage(signedUrls[user.kyc_selfie_url])}
                      title={t('selfie_zoom', 'Zoom selfie')}
                    >
                      {signedUrls[user.kyc_selfie_url] ? (
                        <img src={signedUrls[user.kyc_selfie_url]} alt={t('selfie', 'Selfie')} className={styles.docImage} />
                      ) : (
                        <div className={styles.docPlaceholder}>{t('selfie_missing', 'No Selfie Image')}</div>
                      )}
                      <span className={styles.docLabel}>{t('selfie_doc_label', 'Sənədlə Selfi')}</span>
                    </div>
                  </div>
                ) : (
                  /* Rejection Banner for Rejected status */
                  <div className={styles.rejectionBanner}>
                    <Info size={18} className={styles.infoIcon} />
                    <div className={styles.rejectionContent}>
                      <span className={styles.rejectionLabel}>{t('rejection_reason_label', 'Rədd Səbəbi:')}</span>
                      <p className={styles.rejectionText}>{rejectReasonText}</p>
                    </div>
                  </div>
                )}

                {/* Card Actions */}
                <div className={styles.cardActions}>
                  {isPending ? (
                    <>
                      <button 
                        onClick={() => handleApprove(user)}
                        className={styles.approveBtn}
                      >
                        <Check size={16} />
                        {t('approve_btn_title', 'Təsdiqlə')}
                      </button>
                      <button 
                        onClick={() => handleOpenReject(user)}
                        className={styles.rejectBtn}
                      >
                        <X size={16} />
                        {t('reject_btn_title', 'Rədd et')}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => alert(t('kyc_reject_log_detail', 'Log detail: KYC rejected. Reason: {{reason}}').replace('{{reason}}', rejectReasonText))}
                      className={styles.historyBtn}
                    >
                      <Eye size={16} />
                      {t('view_history_btn', 'Tarixçəyə Bax')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className={styles.imageOverlay} onClick={() => setPreviewImage(null)}>
          <button className={styles.closeOverlayBtn} onClick={() => setPreviewImage(null)}>
            <X size={24} />
          </button>
          <div className={styles.overlayContent} onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="KYC Zoom" className={styles.overlayImage} />
          </div>
        </div>
      )}

      {/* Rejection Reason Input Modal */}
      {rejectModal.open && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{t('reject_kyc_title', 'KYC Sorğusunu Rədd Et')}</h3>
              <button onClick={() => setRejectModal({ open: false, user: null })} className={styles.closeModalBtn}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                {t('reject_kyc_desc', 'İstifadəçi {{user}} üçün rədd etmə səbəbini daxil edin:')
                  .replace('{{user}}', rejectModal.user?.full_name || rejectModal.user?.display_login)}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('reject_kyc_placeholder', 'Məsələn: Şəxsiyyət vəsiqəsinin şəkli bulanıqdır...')}
                className={styles.modalTextarea}
                rows={4}
              />
            </div>
            <div className={styles.modalFooter}>
              <button 
                onClick={() => setRejectModal({ open: false, user: null })}
                className={styles.modalCancelBtn}
              >
                {t('cancel', 'Ləğv et')}
              </button>
              <button 
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className={styles.modalConfirmBtn}
              >
                {t('kyc_reject', 'Rədd Et')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
