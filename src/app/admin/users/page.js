'use client';

import { useState, useEffect } from 'react';
import styles from '../admin-dashboard.module.css';
import uStyles from './users.module.css';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import { Search, Shield, Ban, Eye, DollarSign, Star, Package, UserCog, ShieldCheck } from 'lucide-react';
import { useTranslation } from '@/lib/store/languageStore';
import {
  getUsers, blockUser, unblockUser, updateUserRole, updateAdminPermissions,
  updateUserBalance, updateUserPoints,
  updateUserProfile, updateKYCStatus, addAdminLog,
} from '@/lib/supabase/database';
import { PACKAGES, BLOCK_DURATIONS } from '@/lib/utils/constants';
import { formatCurrency, getKYCStatusLabel, getKYCStatusVariant, formatDateTime } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import { supabase } from '@/lib/supabase/config';
import UsersCharts from '@/components/charts/UsersCharts';

const PER_PAGE = 15;

export default function AdminUsersPage() {
  const { user: adminUser } = useAuthStore();
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sortField, setSortField] = useState(null); // 'balance' | 'current_level' | 'total_points'
  const [sortDir, setSortDir] = useState('desc');

  // Modals
  const [blockModal, setBlockModal] = useState(false);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [blockDuration, setBlockDuration] = useState(30);
  const [balanceModal, setBalanceModal] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [pointsModal, setPointsModal] = useState(false);
  const [pointsAmount, setPointsAmount] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [toast, setToast] = useState(null);

  async function loadUsers() {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users: ', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- Actions ---
  const handleToggleAdmin = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRole(targetUser.id, newRole);
      if (newRole === 'admin') {
        // Yeni admin'e varsayılan izinler ata — aksi halde yetkisiz kalıp erişim döngüsüne girer (#6).
        await updateAdminPermissions(targetUser.id, {
          users: true, kyc: true, claims: true, finance: true, logs: true,
        });
      }
      await addAdminLog(adminUser?.uid, 'update_role', targetUser.id, `Role: ${newRole}`);
      await loadUsers();
      setSelectedUser(null);
      showToast(t('role_updated', 'Rol dəyişdirildi: {{role}}').replace('{{role}}', newRole));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleBlockToggle = async (targetUser) => {
    if (targetUser.is_blocked) {
      try {
        await unblockUser(targetUser.id);
        await addAdminLog(adminUser?.uid, 'unblock_user', targetUser.id, 'User unblocked');
        await loadUsers();
        setSelectedUser(null);
        showToast(t('unblocked', 'Blok açıldı'));
      } catch (err) {
        showToast(t('error_prefix', 'Xəta: ') + err.message);
      }
    } else {
      setBlockReasonInput('');
      setBlockDuration(30);
      setBlockModal(true);
    }
  };

  const handleConfirmBlock = async () => {
    if (!selectedUser) return;
    try {
      await blockUser(selectedUser.id, blockReasonInput || 'Violating rules', blockDuration);
      await addAdminLog(adminUser?.uid, 'block_user', selectedUser.id,
        `Blocked ${blockDuration} days. Reason: ${blockReasonInput || 'Violating rules'}`);
      await loadUsers();
      setBlockModal(false);
      setSelectedUser(null);
      showToast(t('user_blocked_msg', 'İstifadəçi {{days}} günlük bloklandı').replace('{{days}}', blockDuration));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleBalanceUpdate = async () => {
    if (!selectedUser || !balanceAmount) return;
    try {
      await updateUserBalance(selectedUser.id, balanceAmount);
      await addAdminLog(adminUser?.uid, 'update_balance', selectedUser.id, `Amount: ${balanceAmount}`);
      await loadUsers();
      setBalanceModal(false);
      setBalanceAmount('');
      showToast(t('balance_updated', 'Balans yeniləndi'));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handlePointsUpdate = async () => {
    if (!selectedUser || !pointsAmount) return;
    try {
      await updateUserPoints(selectedUser.id, pointsAmount);
      await addAdminLog(adminUser?.uid, 'update_points', selectedUser.id, `Points: ${pointsAmount}`);
      await loadUsers();
      setPointsModal(false);
      setPointsAmount('');
      showToast(t('points_updated', 'Points yeniləndi'));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleKYCAction = async (status) => {
    if (!selectedUser) return;
    try {
      await updateKYCStatus(selectedUser.id, status);
      await addAdminLog(adminUser?.uid, `kyc_${status}`, selectedUser.id, `KYC: ${status}`);
      await loadUsers();
      setSelectedUser(null);
      const statusText = status === 'approved' ? t('approved', 'təsdiqləndi') : t('rejected', 'rədd edildi');
      showToast(t('kyc_status_action', 'KYC {{status}}').replace('{{status}}', statusText));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleEditProfile = async () => {
    if (!selectedUser) return;
    try {
      await updateUserProfile(selectedUser.id, editForm);
      await addAdminLog(adminUser?.uid, 'edit_profile', selectedUser.id, JSON.stringify(editForm));
      await loadUsers();
      setEditModal(false);
      setSelectedUser(null);
      showToast(t('profile_updated', 'Profil yeniləndi'));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await addAdminLog(adminUser?.uid, 'reset_password', selectedUser.id, 'Password reset email sent');
      showToast(t('pwd_reset_sent', 'Şifrə sıfırlama emaili göndərildi'));
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    }
  };

  const openEditModal = () => {
    setEditForm({
      full_name: selectedUser.full_name || '',
      display_login: selectedUser.display_login || '',
      email: selectedUser.email || '',
      country: selectedUser.country || '',
      city: selectedUser.city || '',
      phone: selectedUser.phone || '',
    });
    setEditModal(true);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setCurrentPage(1);
  };

  // Filtering, sorting & pagination
  const filtered = users.filter(
    (u) =>
      (u.user_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.display_login || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const sorted = sortField
    ? [...filtered].sort((a, b) => {
        const av = Number(a[sortField]) || 0;
        const bv = Number(b[sortField]) || 0;
        return sortDir === 'desc' ? bv - av : av - bv;
      })
    : filtered;
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const start = (currentPage - 1) * PER_PAGE;
  const pageData = sorted.slice(start, start + PER_PAGE);

  const SortHeader = ({ field, label }) => (
    <button
      type="button"
      className={`${uStyles.sortBtn} ${sortField === field ? uStyles.sortActive : ''}`}
      onClick={() => handleSort(field)}
      title={t('sort_tooltip', 'Sıralamaq üçün klikləyin')}
    >
      {label} {sortField === field ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
    </button>
  );

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0' }}><span>{t('loading', 'Yüklənir...')}</span></div>;
  }

  return (
    <div>
      <div className={uStyles.topRow}>
        <h1 className={styles.pageTitle}>{t('admin_users_title', 'İstifadəçilər')}</h1>
        <Badge variant="info">{t('user_count', '{{count}} nəfər').replace('{{count}}', filtered.length)}</Badge>
      </div>

      <UsersCharts />

      <div className={uStyles.searchBar}>
        <Input
          placeholder={t('search_users_placeholder', 'Kod və ya email ilə axtar...')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          icon={<Search size={18} />}
        />
      </div>

      <div className={styles.table}>
        <div className={uStyles.userHeader}>
          <span>{t('user_code_col', 'Kod')}</span>
          <SortHeader field="balance" label={t('balance', 'Balans')} />
          <SortHeader field="current_level" label={t('level', 'Level')} />
          <SortHeader field="total_points" label={t('points_col', 'Xallar')} />
          <span>{t('packages_col', 'Paket')}</span>
          <span>KYC</span>
          <span>{t('status', 'Status')}</span>
          <span></span>
        </div>
        {pageData.map((u) => {
          const activePkgs = PACKAGES.filter((p) => u.active_packages?.[p.id]);
          return (
            <div key={u.id} className={uStyles.userRow}>
              <div>
                <span className={styles.bold}>{u.user_code}</span>
                <span className={uStyles.email}>{u.full_name || u.email}</span>
              </div>
              <span>${Number(u.balance).toFixed(2)}</span>
              <span>LVL {u.current_level}</span>
              <span>{Number(u.total_points || 0).toFixed(1)}</span>
              <span className={activePkgs.length ? uStyles.pkgCell : uStyles.pkgEmpty}>
                {activePkgs.length ? activePkgs.map((p) => p.displayName).join(', ') : '—'}
              </span>
              <span>
                <Badge variant={getKYCStatusVariant(u.kyc_status || 'none')} size="sm">
                  {getKYCStatusLabel(u.kyc_status || 'none')}
                </Badge>
              </span>
              <span>
                {u.is_blocked ? (
                  <Badge variant="error" size="sm">{t('blocked_badge', 'Blok')}</Badge>
                ) : u.role === 'admin' ? (
                  <Badge variant="gold" size="sm">{t('admin_panel', 'Admin')}</Badge>
                ) : (
                  <Badge variant="success" size="sm">{t('active', 'Aktiv')}</Badge>
                )}
              </span>
              <button className={uStyles.viewBtn} onClick={() => setSelectedUser(u)}>
                <Eye size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* User Detail Modal */}
      <Modal isOpen={!!selectedUser && !blockModal && !balanceModal && !pointsModal && !editModal}
        onClose={() => setSelectedUser(null)} title={t('user_management', 'İstifadəçi İdarəetmə')} size="lg">
        {selectedUser && (
          <div className={uStyles.detail}>
            <div className={uStyles.detailGrid}>
              <div className={uStyles.detailItem}><span>{t('user_code_col', 'Kod')}</span><strong>{selectedUser.user_code}</strong></div>
              <div className={uStyles.detailItem}><span>{t('fullname', 'Ad Soyad')}</span><strong>{selectedUser.full_name}</strong></div>
              <div className={uStyles.detailItem}><span>{t('email', 'Email')}</span><strong>{selectedUser.email}</strong></div>
              <div className={uStyles.detailItem}><span>{t('balance', 'Balans')}</span><strong>{formatCurrency(selectedUser.balance)}</strong></div>
              <div className={uStyles.detailItem}><span>{t('points', 'Points')}</span><strong>{Number(selectedUser.total_points).toFixed(1)}</strong></div>
              <div className={uStyles.detailItem}><span>{t('country', 'Ölkə')}</span><strong>{selectedUser.country || '—'}</strong></div>
              <div className={uStyles.detailItem}><span>{t('city', 'Şəhər')}</span><strong>{selectedUser.city || '—'}</strong></div>
              <div className={uStyles.detailItem}><span>{t('phone', 'Telefon')}</span><strong>{selectedUser.phone || '—'}</strong></div>
              <div className={uStyles.detailItem}>
                <span>KYC</span>
                <Badge variant={getKYCStatusVariant(selectedUser.kyc_status || 'none')} size="sm">
                  {getKYCStatusLabel(selectedUser.kyc_status || 'none')}
                </Badge>
              </div>
            </div>

            {/* Packages */}
            <div className={uStyles.packageSection}>
              <h4 className={uStyles.sectionLabel}>{t('active_packages', 'Aktiv Paketlər')}</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {PACKAGES.map((pkg) => {
                  const isActive = selectedUser.active_packages?.[pkg.id] || false;
                  if (!isActive) return null;
                  return (
                    <Badge key={pkg.id} variant="info" style={{ borderColor: pkg.color, color: pkg.color }}>
                      {pkg.displayName}
                    </Badge>
                  );
                })}
                {Object.values(selectedUser.active_packages || {}).filter(Boolean).length === 0 && (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('no_active_packages', 'Aktiv paket yoxdur')}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className={uStyles.detailActions}>
              <Button variant="ghost" size="sm" onClick={openEditModal}>
                <UserCog size={14} /> {t('edit_profile_btn', 'Profil Dəyiş')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setBalanceAmount(''); setBalanceModal(true); }}>
                <DollarSign size={14} /> {t('balance', 'Balans')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setPointsAmount(''); setPointsModal(true); }}>
                <Star size={14} /> {t('points', 'Points')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetPassword}>
                {t('reset_pwd_btn', 'Şifrə Sıfırla')}
              </Button>
              {/* Rol dəyişikliyinə DB trigger yalnız superadmin üçün icazə verir */}
              {adminUser?.permissions?.superadmin && (
                <Button variant="ghost" size="sm" onClick={() => handleToggleAdmin(selectedUser)}>
                  <Shield size={14} /> {selectedUser.role === 'admin' ? t('demote_admin', 'Admin sil') : t('promote_admin', 'Admin et')}
                </Button>
              )}
              {/* KYC dəyişikliyi DB tərəfdə 'kyc' icazəsi tələb edir */}
              {selectedUser.kyc_status === 'pending' && (adminUser?.permissions?.kyc || adminUser?.permissions?.superadmin) && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleKYCAction('approved')}>
                    <ShieldCheck size={14} /> {t('kyc_approve', 'KYC Təsdiq')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleKYCAction('rejected')}>
                    {t('kyc_reject', 'KYC Rədd')}
                  </Button>
                </>
              )}
              <Button
                variant={selectedUser.is_blocked ? 'primary' : 'danger'}
                size="sm"
                onClick={() => handleBlockToggle(selectedUser)}
              >
                <Ban size={14} /> {selectedUser.is_blocked ? t('unblock_btn', 'Bloku aç') : t('block_btn', 'Blokla')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Block Modal */}
      <Modal isOpen={blockModal} onClose={() => setBlockModal(false)} title={t('block_user_title', 'İstifadəçini Blokla')} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label={t('block_reason', 'Bloklama səbəbi')} placeholder={t('block_reason_placeholder', 'Məs: Qaydaları pozma')} value={blockReasonInput}
            onChange={(e) => setBlockReasonInput(e.target.value)} />
          <div>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t('duration', 'Müddət')}</label>
            <select value={blockDuration} onChange={(e) => setBlockDuration(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-default)', fontSize: 14 }}>
              {BLOCK_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.value} {t('days_left', 'gün')}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setBlockModal(false)}>{t('cancel', 'Ləğv et')}</Button>
            <Button variant="danger" onClick={handleConfirmBlock}>{t('confirm', 'Təsdiqlə')}</Button>
          </div>
        </div>
      </Modal>

      {/* Balance Modal */}
      <Modal isOpen={balanceModal} onClose={() => setBalanceModal(false)} title={t('change_balance_title', 'Balans Dəyiş')} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('balance_change_desc', 'Müsbət: əlavə et, Mənfi: çıxar')}</p>
          <Input label={t('amount', 'Məbləğ')} type="number" placeholder="50 və ya -20" value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setBalanceModal(false)}>{t('cancel', 'Ləğv et')}</Button>
            <Button onClick={handleBalanceUpdate}>{t('confirm', 'Təsdiqlə')}</Button>
          </div>
        </div>
      </Modal>

      {/* Points Modal */}
      <Modal isOpen={pointsModal} onClose={() => setPointsModal(false)} title={t('change_points_title', 'Points Dəyiş')} size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label={t('points_amount_label', 'Points Məbləği')} type="number" placeholder="10" value={pointsAmount}
            onChange={(e) => setPointsAmount(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setPointsModal(false)}>{t('cancel', 'Ləğv et')}</Button>
            <Button onClick={handlePointsUpdate}>{t('confirm', 'Təsdiqlə')}</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={t('edit_profile_title', 'Profil Redaktə Et')} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label={t('fullname', 'Ad Soyad')} value={editForm.full_name || ''}
            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          <Input label={t('country', 'Ölkə')} value={editForm.country || ''}
            onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
          <Input label={t('city', 'Şəhər')} value={editForm.city || ''}
            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
          <Input label={t('phone', 'Telefon')} value={editForm.phone || ''}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setEditModal(false)}>{t('cancel', 'Ləğv et')}</Button>
            <Button onClick={handleEditProfile}>{t('save_btn', 'Yadda Saxla')}</Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--border-default)',
          color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 12,
          fontSize: 14, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
