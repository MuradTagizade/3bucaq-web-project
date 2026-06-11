'use client';

import { useState, useEffect } from 'react';
import styles from './kyc.module.css';
import { 
  Search, SlidersHorizontal, Hourglass, CheckCircle, XCircle, X, 
  ShieldCheck, Headphones, Eye, Check, Info, ArrowUpDown
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import { getUsers, updateKYCStatus, addAdminLog } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const diffMs = now - new Date(dateString);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'İndi';
  if (diffMins < 60) return `${diffMins} dəq. əvvəl`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} saat əvvəl`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} gün əvvəl`;
}

const DOC_TYPE_LABELS = {
  passport: 'Xarici Pasport',
  id_card: 'Şəxsiyyət Vəsiqəsi (Ön)',
  driving_license: 'Sürücülük Vəsiqəsi',
};

export default function AdminKYCRequestsPage() {
  const { user: adminUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest
  const [rejectModal, setRejectModal] = useState({ open: false, user: null });
  const [rejectReason, setRejectReason] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  async function loadData() {
    try {
      const data = await getUsers();
      setUsers(data);

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
      alert('Təsdiqləmə xətası: ' + err.message);
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
      alert('Rədd etmə xətası: ' + err.message);
    }
  };

  // Filter & Sort requests
  const filteredUsers = users
    .filter((u) => u.kyc_status === 'pending' || u.kyc_status === 'rejected')
    .filter((u) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const nameMatch = u.full_name?.toLowerCase().includes(query);
      const loginMatch = u.display_login?.toLowerCase().includes(query);
      const idMatch = `hb-${u.id.slice(0, 4).toLowerCase()}-az`.includes(query);
      return nameMatch || loginMatch || idMatch;
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
        <span>KYC Məlumatları Yüklənir...</span>
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
        <h1 className={styles.pageTitle}>KYC Təsdiqləməsi</h1>
        <div className={styles.headerSearch}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="İstifadəçi axtar..."
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
            <span className={styles.metricLabel}>GÖZLƏYƏN</span>
            <Hourglass size={18} className={styles.pendingIcon} />
          </div>
          <div className={styles.metricValueBlock}>
            <span className={styles.metricValue}>{stats.pending}</span>
            {stats.pending > 0 && <span className={styles.metricBadge}>+5 bu gün</span>}
          </div>
        </div>

        <div className={`${styles.metricCard} ${styles.approvedCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>TƏSDİQLƏNİB</span>
            <CheckCircle size={18} className={styles.approvedIcon} />
          </div>
          <div className={styles.metricValueBlock}>
            <span className={styles.metricValue}>{stats.approved.toLocaleString()}</span>
            <span className={styles.metricBadge}>{successRate}% müvəffəqiyyət</span>
          </div>
        </div>

        <div className={`${styles.metricCard} ${styles.rejectedCard}`}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>RƏDD EDİLİB</span>
            <XCircle size={18} className={styles.rejectedIcon} />
          </div>
          <div className={styles.metricValueBlock}>
            <span className={styles.metricValue}>{stats.rejected}</span>
            <span className={styles.metricBadge}>Dəqiqlik dərəcəsi</span>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className={styles.filterRow}>
        <div className={styles.leftFilters}>
          <button className={styles.filterBtn}>
            <SlidersHorizontal size={14} />
            Filtr
          </button>
          
          <div className={styles.sortWrapper}>
            <ArrowUpDown size={14} className={styles.sortIcon} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="newest">Tarixə görə (Yeni)</option>
              <option value="oldest">Tarixə görə (Köhnə)</option>
            </select>
          </div>
        </div>

        <div className={styles.liveIndicator}>
          <span className={styles.liveDot} />
          Canlı Yeniləmə Aktivdir
        </div>
      </div>

      {/* Requests Grid */}
      {sortedUsers.length === 0 ? (
        <div className={styles.emptyState}>
          <ShieldCheck size={48} color="var(--text-muted)" />
          <p>Heç bir aktiv KYC sorğusu tapılmadı</p>
        </div>
      ) : (
        <div className={styles.requestsGrid}>
          {sortedUsers.map((user) => {
            const isPending = user.kyc_status === 'pending';
            const initials = (user.display_login || 'U').slice(0, 2).toUpperCase();
            const rejectReasonText = rejectReasons[user.id] || 'Sənəd məlumatları oxunmur.';

            return (
              <div key={user.id} className={styles.requestCard}>
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.avatarWrapper}>
                    <div className={styles.avatar}>{initials}</div>
                    <span className={`${styles.statusDot} ${isPending ? styles.dotPending : styles.dotRejected}`} />
                  </div>

                  <div className={styles.userInfo}>
                    <h4 className={styles.userFullName}>{user.full_name || user.display_login}</h4>
                    <span className={styles.userId}>ID: HB-{user.id.slice(0, 4).toUpperCase()}-AZ</span>
                  </div>

                  <div className={styles.headerRight}>
                    <span className={`${styles.statusBadge} ${isPending ? styles.badgePending : styles.badgeRejected}`}>
                      {isPending ? 'Gözləyir' : 'İmtina Edilib'}
                    </span>
                    <span className={styles.timeLabel}>{timeAgo(user.created_at)}</span>
                  </div>
                </div>

                {/* Document Previews (Only for Pending, or display anyway if URLs exist) */}
                {isPending ? (
                  <div className={styles.documentsRow}>
                    {/* Front side */}
                    <div 
                      className={styles.documentBox}
                      onClick={() => setPreviewImage(user.kyc_document_url)}
                      title="Sənəd Ön Üzünü böyüt"
                    >
                      {user.kyc_document_url ? (
                        <img src={user.kyc_document_url} alt="Sənəd Ön" className={styles.docImage} />
                      ) : (
                        <div className={styles.docPlaceholder}>Sənəd Ön Şəkli Yoxdur</div>
                      )}
                      <span className={styles.docLabel}>Ön Üz ({DOC_TYPE_LABELS[user.kyc_document_type] || 'Sənəd'})</span>
                    </div>

                    {/* Back side */}
                    <div 
                      className={styles.documentBox}
                      onClick={() => setPreviewImage(user.kyc_document_back_url)}
                      title="Sənəd Arxa Üzünü böyüt"
                    >
                      {user.kyc_document_back_url ? (
                        <img src={user.kyc_document_back_url} alt="Sənəd Arxa" className={styles.docImage} />
                      ) : (
                        <div className={styles.docPlaceholder}>Sənəd Arxa Şəkli Yoxdur</div>
                      )}
                      <span className={styles.docLabel}>Arxa Üz ({DOC_TYPE_LABELS[user.kyc_document_type] || 'Sənəd'})</span>
                    </div>

                    {/* Selfie side */}
                    <div 
                      className={styles.documentBox}
                      onClick={() => setPreviewImage(user.kyc_selfie_url)}
                      title="Selfini böyüt"
                    >
                      {user.kyc_selfie_url ? (
                        <img src={user.kyc_selfie_url} alt="Selfi" className={styles.docImage} />
                      ) : (
                        <div className={styles.docPlaceholder}>Selfi Şəkli Yoxdur</div>
                      )}
                      <span className={styles.docLabel}>Sənədlə Selfi</span>
                    </div>
                  </div>
                ) : (
                  /* Rejection Banner for Rejected status */
                  <div className={styles.rejectionBanner}>
                    <Info size={18} className={styles.infoIcon} />
                    <div className={styles.rejectionContent}>
                      <span className={styles.rejectionLabel}>Rədd Səbəbi:</span>
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
                        Təsdiqlə
                      </button>
                      <button 
                        onClick={() => handleOpenReject(user)}
                        className={styles.rejectBtn}
                      >
                        <X size={16} />
                        Rədd et
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => alert(`Log detal: KYC Rədd edilib. Səbəb: ${rejectReasonText}`)}
                      className={styles.historyBtn}
                    >
                      <Eye size={16} />
                      Tarixçəyə Bax
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
              <h3>KYC Sorğusunu Rədd Et</h3>
              <button onClick={() => setRejectModal({ open: false, user: null })} className={styles.closeModalBtn}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                İstifadəçi <strong>{rejectModal.user?.full_name || rejectModal.user?.display_login}</strong> üçün rədd etmə səbəbini daxil edin:
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Məsələn: Şəxsiyyət vəsiqəsinin şəkli bulanıqdır və məlumatlar oxunmur. Yenidən yükləmə tələb olunur."
                className={styles.modalTextarea}
                rows={4}
              />
            </div>
            <div className={styles.modalFooter}>
              <button 
                onClick={() => setRejectModal({ open: false, user: null })}
                className={styles.modalCancelBtn}
              >
                Ləğv et
              </button>
              <button 
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className={styles.modalConfirmBtn}
              >
                Rədd Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
