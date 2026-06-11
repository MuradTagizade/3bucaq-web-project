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
import {
  getUsers, blockUser, unblockUser, updateUserRole,
  updateUserBalance, updateUserPoints,
  updateUserProfile, updateKYCStatus, addAdminLog,
} from '@/lib/supabase/database';
import { PACKAGES, BLOCK_DURATIONS } from '@/lib/utils/constants';
import { formatCurrency, getKYCStatusLabel, getKYCStatusVariant, formatDateTime } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import { supabase } from '@/lib/supabase/config';

const PER_PAGE = 15;

export default function AdminUsersPage() {
  const { user: adminUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);

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
      await addAdminLog(adminUser?.uid, 'update_role', targetUser.id, `Role: ${newRole}`);
      await loadUsers();
      setSelectedUser(null);
      showToast(`Rol dəyişdirildi: ${newRole}`);
    } catch (err) {
      showToast('Xəta: ' + err.message);
    }
  };

  const handleBlockToggle = async (targetUser) => {
    if (targetUser.is_blocked) {
      try {
        await unblockUser(targetUser.id);
        await addAdminLog(adminUser?.uid, 'unblock_user', targetUser.id, 'User unblocked');
        await loadUsers();
        setSelectedUser(null);
        showToast('Blok açıldı');
      } catch (err) {
        showToast('Xəta: ' + err.message);
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
      await blockUser(selectedUser.id, blockReasonInput || 'Qaydaları pozma', blockDuration);
      await addAdminLog(adminUser?.uid, 'block_user', selectedUser.id,
        `Blocked ${blockDuration} days. Reason: ${blockReasonInput || 'Qaydaları pozma'}`);
      await loadUsers();
      setBlockModal(false);
      setSelectedUser(null);
      showToast(`İstifadəçi ${blockDuration} günlük bloklandı`);
    } catch (err) {
      showToast('Xəta: ' + err.message);
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
      showToast('Balans yeniləndi');
    } catch (err) {
      showToast('Xəta: ' + err.message);
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
      showToast('Points yeniləndi');
    } catch (err) {
      showToast('Xəta: ' + err.message);
    }
  };



  const handleKYCAction = async (status) => {
    if (!selectedUser) return;
    try {
      await updateKYCStatus(selectedUser.id, status);
      await addAdminLog(adminUser?.uid, `kyc_${status}`, selectedUser.id, `KYC: ${status}`);
      await loadUsers();
      setSelectedUser(null);
      showToast(`KYC ${status === 'approved' ? 'təsdiqləndi' : 'rədd edildi'}`);
    } catch (err) {
      showToast('Xəta: ' + err.message);
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
      showToast('Profil yeniləndi');
    } catch (err) {
      showToast('Xəta: ' + err.message);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email);
      if (error) throw error;
      await addAdminLog(adminUser?.uid, 'reset_password', selectedUser.id, 'Password reset email sent');
      showToast('Şifrə sıfırlama emaili göndərildi');
    } catch (err) {
      showToast('Xəta: ' + err.message);
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

  // Filtering & pagination
  const filtered = users.filter(
    (u) =>
      (u.display_login || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const start = (currentPage - 1) * PER_PAGE;
  const pageData = filtered.slice(start, start + PER_PAGE);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px 0' }}><span>Yüklənir...</span></div>;
  }

  return (
    <div>
      <div className={uStyles.topRow}>
        <h1 className={styles.pageTitle}>İstifadəçilər</h1>
        <Badge variant="info">{filtered.length} nəfər</Badge>
      </div>

      <div className={uStyles.searchBar}>
        <Input
          placeholder="Login və ya email ilə axtar..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          icon={<Search size={18} />}
        />
      </div>

      <div className={styles.table}>
        <div className={uStyles.userHeader}>
          <span>Login</span><span>Balans</span><span>Level</span><span>Status</span><span></span>
        </div>
        {pageData.map((u) => (
          <div key={u.id} className={uStyles.userRow}>
            <div>
              <span className={styles.bold}>{u.display_login}</span>
              <span className={uStyles.email}>{u.email}</span>
            </div>
            <span>${Number(u.balance).toFixed(2)}</span>
            <span>LVL {u.current_level}</span>
            <span>
              {u.is_blocked ? (
                <Badge variant="error" size="sm">Blok</Badge>
              ) : u.role === 'admin' ? (
                <Badge variant="gold" size="sm">Admin</Badge>
              ) : (
                <Badge variant="success" size="sm">Aktiv</Badge>
              )}
            </span>
            <button className={uStyles.viewBtn} onClick={() => setSelectedUser(u)}>
              <Eye size={16} />
            </button>
          </div>
        ))}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      {/* User Detail Modal */}
      <Modal isOpen={!!selectedUser && !blockModal && !balanceModal && !pointsModal && !editModal}
        onClose={() => setSelectedUser(null)} title="İstifadəçi İdarəetmə" size="lg">
        {selectedUser && (
          <div className={uStyles.detail}>
            <div className={uStyles.detailGrid}>
              <div className={uStyles.detailItem}><span>Login</span><strong>{selectedUser.display_login}</strong></div>
              <div className={uStyles.detailItem}><span>Ad</span><strong>{selectedUser.full_name}</strong></div>
              <div className={uStyles.detailItem}><span>Email</span><strong>{selectedUser.email}</strong></div>
              <div className={uStyles.detailItem}><span>Balans</span><strong>{formatCurrency(selectedUser.balance)}</strong></div>
              <div className={uStyles.detailItem}><span>Transfer</span><strong>{formatCurrency(selectedUser.transfer_balance)}</strong></div>
              <div className={uStyles.detailItem}><span>Points</span><strong>{Number(selectedUser.total_points).toFixed(1)}</strong></div>
              <div className={uStyles.detailItem}><span>Ölkə</span><strong>{selectedUser.country || '—'}</strong></div>
              <div className={uStyles.detailItem}><span>Şəhər</span><strong>{selectedUser.city || '—'}</strong></div>
              <div className={uStyles.detailItem}><span>Telefon</span><strong>{selectedUser.phone || '—'}</strong></div>
              <div className={uStyles.detailItem}>
                <span>KYC</span>
                <Badge variant={getKYCStatusVariant(selectedUser.kyc_status || 'none')} size="sm">
                  {getKYCStatusLabel(selectedUser.kyc_status || 'none')}
                </Badge>
              </div>
            </div>

            {/* Packages */}
            <div className={uStyles.packageSection}>
              <h4 className={uStyles.sectionLabel}>Aktiv Paketlər</h4>
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
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aktiv paket yoxdur</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className={uStyles.detailActions}>
              <Button variant="ghost" size="sm" onClick={openEditModal}>
                <UserCog size={14} /> Profil Dəyiş
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setBalanceAmount(''); setBalanceModal(true); }}>
                <DollarSign size={14} /> Balans
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setPointsAmount(''); setPointsModal(true); }}>
                <Star size={14} /> Points
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetPassword}>
                Şifrə Sıfırla
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleToggleAdmin(selectedUser)}>
                <Shield size={14} /> {selectedUser.role === 'admin' ? 'Admin sil' : 'Admin et'}
              </Button>
              {selectedUser.kyc_status === 'pending' && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleKYCAction('approved')}>
                    <ShieldCheck size={14} /> KYC Təsdiq
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleKYCAction('rejected')}>
                    KYC Rədd
                  </Button>
                </>
              )}
              <Button
                variant={selectedUser.is_blocked ? 'primary' : 'danger'}
                size="sm"
                onClick={() => handleBlockToggle(selectedUser)}
              >
                <Ban size={14} /> {selectedUser.is_blocked ? 'Bloku aç' : 'Blokla'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Block Modal */}
      <Modal isOpen={blockModal} onClose={() => setBlockModal(false)} title="İstifadəçini Blokla" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Bloklama səbəbi" placeholder="Məs: Qaydaları pozma" value={blockReasonInput}
            onChange={(e) => setBlockReasonInput(e.target.value)} />
          <div>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Müddət</label>
            <select value={blockDuration} onChange={(e) => setBlockDuration(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: 14 }}>
              {BLOCK_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setBlockModal(false)}>Ləğv et</Button>
            <Button variant="danger" onClick={handleConfirmBlock}>Təsdiqlə</Button>
          </div>
        </div>
      </Modal>

      {/* Balance Modal */}
      <Modal isOpen={balanceModal} onClose={() => setBalanceModal(false)} title="Balans Dəyiş" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Müsbət: əlavə et, Mənfi: çıxar</p>
          <Input label="Məbləğ" type="number" placeholder="50 və ya -20" value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setBalanceModal(false)}>Ləğv et</Button>
            <Button onClick={handleBalanceUpdate}>Təsdiqlə</Button>
          </div>
        </div>
      </Modal>

      {/* Points Modal */}
      <Modal isOpen={pointsModal} onClose={() => setPointsModal(false)} title="Points Dəyiş" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input label="Points Məbləği" type="number" placeholder="10" value={pointsAmount}
            onChange={(e) => setPointsAmount(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setPointsModal(false)}>Ləğv et</Button>
            <Button onClick={handlePointsUpdate}>Təsdiqlə</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Profil Redaktə Et" size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Ad Soyad" value={editForm.full_name || ''}
            onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          <Input label="Login" value={editForm.display_login || ''}
            onChange={(e) => setEditForm({ ...editForm, display_login: e.target.value })} />
          <Input label="Ölkə" value={editForm.country || ''}
            onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
          <Input label="Şəhər" value={editForm.city || ''}
            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
          <Input label="Telefon" value={editForm.phone || ''}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button variant="ghost" onClick={() => setEditModal(false)}>Ləğv et</Button>
            <Button onClick={handleEditProfile}>Yadda Saxla</Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 12,
          fontSize: 14, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
