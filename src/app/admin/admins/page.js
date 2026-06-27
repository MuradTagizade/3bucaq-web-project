'use client';

import { useState, useEffect } from 'react';
import styles from './admins.module.css';
import uStyles from '@/app/admin/users/users.module.css';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Toggle from '@/components/ui/Toggle';
import Spinner from '@/components/ui/Spinner';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { 
  getAdmins, 
  getUsers, 
  updateUserRole, 
  updateAdminPermissions, 
  addAdminLog 
} from '@/lib/supabase/database';
import { Shield, Plus, ShieldCheck, Search, X, Check, Edit2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/config';
import { 
  validateEmail, 
  validatePassword, 
  validateFullName, 
  validateLogin, 
  validatePhone, 
  validateCountry, 
  validateCity 
} from '@/lib/utils/validators';

const PERMISSION_LABELS = {
  superadmin: 'Super Admin (Bütün səlahiyyətlər + Admin idarəetməsi)',
  users: 'İstifadəçiləri İdarə Et (Bloklama, Balans/Points dəyişmə)',
  kyc: 'KYC Sorğularını İdarə Et (Təsdiq/Rədd)',
  claims: 'Level Claims İdarə Et (Təsdiq/Rədd)',
  finance: 'Maliyyə İdarə Et (Depozit/Çıxarış Təsdiq/Rədd)',
  logs: 'Sistem Loglarını İzlə',
};

export default function AdminsPage() {
  const { user: superAdminUser } = useAuthStore();
  const { t } = useTranslation();
  const [admins, setAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Search & Filters
  const [search, setSearch] = useState('');

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  
  // Selected admin / user states
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [adminPerms, setAdminPerms] = useState({
    superadmin: false,
    users: false,
    kyc: false,
    claims: false,
    finance: false,
    logs: false,
  });

  // Adding new admin states
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'select'
  const [newAdminForm, setNewAdminForm] = useState({
    fullName: '',
    login: '',
    email: '',
    password: '',
    phone: '',
    country: 'Azərbaycan',
    city: 'Bakı',
  });
  const [formErrors, setFormErrors] = useState({});
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUserPerms, setNewUserPerms] = useState({
    superadmin: false,
    users: false,
    kyc: false,
    claims: false,
    finance: false,
    logs: false,
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [adminList, userList] = await Promise.all([getAdmins(), getUsers()]);
      setAdmins(adminList);
      setAllUsers(userList);
    } catch (err) {
      showToast(t('loading_error', 'Yükləmə xətası: ') + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePerm = (type, val, isNew = false) => {
    const setter = isNew ? setNewUserPerms : setAdminPerms;
    setter((prev) => {
      const next = { ...prev, [type]: val };
      // If superadmin is toggled on, auto-enable all or vice versa
      if (type === 'superadmin' && val) {
        return {
          superadmin: true,
          users: true,
          kyc: true,
          claims: true,
          finance: true,
          logs: true,
        };
      }
      return next;
    });
  };

  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (activeTab === 'create') {
        const nameErr = validateFullName(newAdminForm.fullName);
        const loginErr = validateLogin(newAdminForm.login);
        const emailErr = validateEmail(newAdminForm.email);
        const passErr = validatePassword(newAdminForm.password);
        const phoneErr = validatePhone(newAdminForm.phone);
        const countryErr = validateCountry(newAdminForm.country);
        const cityErr = validateCity(newAdminForm.city);

        const newErrors = {};
        if (nameErr) newErrors.fullName = nameErr;
        if (loginErr) newErrors.login = loginErr;
        if (emailErr) newErrors.email = emailErr;
        if (passErr) newErrors.password = passErr;
        if (phoneErr) newErrors.phone = phoneErr;
        if (countryErr) newErrors.country = countryErr;
        if (cityErr) newErrors.city = cityErr;

        if (Object.keys(newErrors).length > 0) {
          setFormErrors(newErrors);
          setActionLoading(false);
          return;
        }

        setFormErrors({});

        // Fetch user token securely
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        const res = await fetch('/api/admin/create-subadmin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: newAdminForm.email,
            password: newAdminForm.password,
            login: newAdminForm.login,
            fullName: newAdminForm.fullName,
            phone: newAdminForm.phone,
            country: newAdminForm.country,
            city: newAdminForm.city,
            permissions: newUserPerms,
          })
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || t('subadmin_create_err', 'Sub-admin yaradılarkən xəta baş verdi'));
        }

        showToast(t('subadmin_created_success', 'Yeni sub-admin uğurla yaradıldı'));
        setNewAdminForm({
          fullName: '',
          login: '',
          email: '',
          password: '',
          phone: '',
          country: 'Azərbaycan',
          city: 'Bakı',
        });
      } else {
        if (!selectedUser) {
          showToast(t('select_user_please', 'Zəhmət olmasa istifadəçi seçin'));
          setActionLoading(false);
          return;
        }
        
        // 1. Update role in profiles to admin
        await updateUserRole(selectedUser.id, 'admin');
        
        // 2. Set permissions
        await updateAdminPermissions(selectedUser.id, newUserPerms);
        
        // 3. Log action
        await addAdminLog(
          superAdminUser?.uid, 
          'add_admin', 
          selectedUser.id, 
          `Promoted user to admin. Permissions: ${JSON.stringify(newUserPerms)}`
        );
        
        showToast(t('promoted_to_admin_msg', 'Admin uğurla əlavə edildi'));
        setSelectedUser(null);
        setUserSearch('');
      }

      setAddModal(false);
      setNewUserPerms({
        superadmin: false,
        users: false,
        kyc: false,
        claims: false,
        finance: false,
        logs: false,
      });
      await loadData();
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditAdminSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    setActionLoading(true);
    try {
      // Update permissions
      await updateAdminPermissions(selectedAdmin.id, adminPerms);
      
      // Log action
      await addAdminLog(
        superAdminUser?.uid, 
        'update_admin_permissions', 
        selectedAdmin.id, 
        `Updated admin permissions to: ${JSON.stringify(adminPerms)}`
      );

      showToast(t('admin_perms_updated', 'Admin icazələri yeniləndi'));
      setEditModal(false);
      setSelectedAdmin(null);
      await loadData();
    } catch (err) {
      showToast(t('error_prefix', 'Xəta: ') + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!selectedAdmin) return;
    if (selectedAdmin.email === 'admin@3bucaq.com') {
      showToast(t('cannot_demote_main_admin', 'Əsas adminin səlahiyyətlərini almaq olmaz!'));
      return;
    }
    if (confirm(t('demote_confirm_msg', 'Bu admini ({{user}}) normal istifadəçi statusuna qaytarmaq istədiyinizdən əminsiniz?').replace('{{user}}', selectedAdmin.display_login))) {
      setActionLoading(true);
      try {
        // Demote role to user
        await updateUserRole(selectedAdmin.id, 'user');
        
        // Reset permissions
        await updateAdminPermissions(selectedAdmin.id, {});
        
        // Log action
        await addAdminLog(
          superAdminUser?.uid, 
          'remove_admin', 
          selectedAdmin.id, 
          `Demoted admin ${selectedAdmin.display_login} back to regular user.`
        );

        showToast(t('demoted_success_msg', 'Admin silindi'));
        setEditModal(false);
        setSelectedAdmin(null);
        await loadData();
      } catch (err) {
        showToast(t('error_prefix', 'Xəta: ') + err.message);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    const perms = admin.admin_permissions || {};
    setAdminPerms({
      superadmin: !!perms.superadmin,
      users: !!perms.users,
      kyc: !!perms.kyc,
      claims: !!perms.claims,
      finance: !!perms.finance,
      logs: !!perms.logs,
    });
    setEditModal(true);
  };

  const filteredAdmins = admins.filter(
    (a) =>
      (a.display_login || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const searchableUsers = allUsers.filter(
    (u) =>
      u.role !== 'admin' &&
      ((u.display_login || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(userSearch.toLowerCase()))
  );

  const getPermissionLabel = (key) => {
    const trans = t('permission_labels', {});
    return trans[key] || PERMISSION_LABELS[key] || key;
  };

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner size="lg" />
        <span>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  const tableHeader = t('admins_table_header', {});

  return (
    <div className={styles.adminsPage}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={uStyles.topRow}>
        <h1 className={styles.pageTitle}>{t('admin_staff_title', 'Admin Heyəti')}</h1>
        <Button onClick={() => setAddModal(true)} size="sm">
          <Plus size={16} /> {t('add_admin_btn', 'Admin Əlavə Et')}
        </Button>
      </div>

      <div className={uStyles.searchBar}>
        <Input
          placeholder={t('search_admins_placeholder', 'Admin axtar (Login və ya Email)...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={18} />}
        />
      </div>

      {/* Admin List */}
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>{tableHeader.name || 'Login / Ad'}</span>
          <span>{tableHeader.perms || 'Səlahiyyətlər'}</span>
          <span>{tableHeader.status || 'Status'}</span>
          <span style={{ textAlign: 'right' }}>{tableHeader.edit || 'Düzəliş'}</span>
        </div>
        {filteredAdmins.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('no_admins_found', 'Admin tapılmadı')}
          </div>
        ) : (
          filteredAdmins.map((admin) => {
            const perms = admin.admin_permissions || {};
            const isSuper = !!perms.superadmin;
            return (
              <div key={admin.id} className={styles.tableRow}>
                <div>
                  <span className={styles.bold}>{admin.display_login}</span>
                  <span className={styles.subtext}>{admin.full_name || admin.email}</span>
                </div>
                <div className={styles.permsList}>
                  {isSuper ? (
                    <Badge variant="gold" size="sm">{t('superadmin_role', 'Full SuperAdmin')}</Badge>
                  ) : (
                    <>
                      {perms.users && <Badge variant="info" size="sm">{t('users', 'İstifadəçilər')}</Badge>}
                      {perms.kyc && <Badge variant="success" size="sm">{t('kyc', 'KYC')}</Badge>}
                      {perms.claims && <Badge variant="warning" size="sm">{t('claims', 'Claims')}</Badge>}
                      {perms.finance && <Badge variant="primary" size="sm">{t('finance', 'Maliyyə')}</Badge>}
                      {perms.logs && <Badge variant="neutral" size="sm">{t('logs', 'Loglar')}</Badge>}
                    </>
                  )}
                  {Object.keys(perms).filter(k => perms[k] === true).length === 0 && (
                    <Badge variant="error" size="sm">{t('no_permissions', 'Səlahiyyətsiz')}</Badge>
                  )}
                </div>
                <div>
                  <Badge variant={admin.is_blocked ? 'error' : 'success'} size="sm">
                    {admin.is_blocked ? t('blocked', 'Blok') : t('active', 'Aktiv')}
                  </Badge>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button 
                    onClick={() => openEditModal(admin)} 
                    className={styles.actionBtn}
                    title={t('edit_permissions', 'İcazələri redaktə et')}
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD ADMIN */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title={t('add_admin_title', 'Yeni Admin Təyin Et')} size="xl">
        <form onSubmit={handleAddAdminSubmit} className={styles.modalForm}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'create' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('create')}
            >
              {t('new_account_tab', 'Yeni Hesab Yarat')}
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'select' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('select')}
            >
              {t('select_existing_tab', 'Mövcud İstifadəçini Seç')}
            </button>
          </div>

          {activeTab === 'create' ? (
            <div className={styles.createFormContainer}>
              <div className={styles.formGrid}>
                <Input
                  label={t('fullname', 'Ad Soyad')}
                  placeholder={t('fullname_placeholder', 'Ad Soyad daxil edin...')}
                  value={newAdminForm.fullName}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, fullName: e.target.value }))}
                  error={formErrors.fullName}
                />
                <Input
                  label={t('login_label', 'Login (İstifadəçi adı)')}
                  placeholder={t('login_placeholder', 'Login...')}
                  value={newAdminForm.login}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, login: e.target.value }))}
                  error={formErrors.login}
                />
                <Input
                  label={t('email', 'Email')}
                  placeholder={t('email_placeholder', 'Email...')}
                  type="email"
                  value={newAdminForm.email}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, email: e.target.value }))}
                  error={formErrors.email}
                />
                <Input
                  label={t('password', 'Şifrə')}
                  placeholder={t('password_placeholder', 'Şifrə...')}
                  type="password"
                  value={newAdminForm.password}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, password: e.target.value }))}
                  error={formErrors.password}
                />
                <Input
                  label={t('phone', 'Telefon')}
                  placeholder={t('phone_placeholder', '+994...')}
                  value={newAdminForm.phone}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, phone: e.target.value }))}
                  error={formErrors.phone}
                />
                <Input
                  label={t('country', 'Ölkə')}
                  placeholder={t('country_placeholder', 'Azərbaycan')}
                  value={newAdminForm.country}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, country: e.target.value }))}
                  error={formErrors.country}
                />
                <Input
                  label={t('city', 'Şəhər')}
                  placeholder={t('city_placeholder', 'Bakı')}
                  value={newAdminForm.city}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, city: e.target.value }))}
                  error={formErrors.city}
                />
              </div>

              <div className={styles.permissionsGrid} style={{ marginTop: 'var(--space-md)' }}>
                <h3 className={styles.modalSubtitle}>{tableHeader.perms || 'Səlahiyyətlər'}</h3>
                {Object.keys(PERMISSION_LABELS).map((key) => (
                  <div key={key} className={styles.permRow}>
                    <span className={styles.permLabel}>{getPermissionLabel(key)}</span>
                    <Toggle
                      checked={newUserPerms[key]}
                      onChange={(e) => handleTogglePerm(key, e.target.checked, true)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {!selectedUser ? (
                <div className={styles.searchSection}>
                  <Input
                    label={t('search_users_btn', 'İstifadəçi Axtar')}
                    placeholder={t('search_users_placeholder', 'Login və ya email ilə axtar...')}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    icon={<Search size={18} />}
                  />
                  <div className={styles.userListDropdown}>
                    {userSearch.length >= 2 ? (
                      searchableUsers.length === 0 ? (
                        <div className={styles.dropdownInfo}>{t('no_users_found', 'Uyğun istifadəçi tapılmadı')}</div>
                      ) : (
                        searchableUsers.slice(0, 5).map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSelectedUser(u)}
                            className={styles.userSearchItem}
                          >
                            <span className={styles.bold}>{u.display_login}</span>
                            <span className={styles.subtext}>{u.email}</span>
                          </button>
                        ))
                      )
                    ) : (
                      <div className={styles.dropdownInfo}>{t('user_search_min_chars', 'Axtarmaq üçün ən azı 2 hərf yazın')}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.selectedUserCard}>
                  <div className={styles.selectedUserInfo}>
                    <ShieldCheck size={20} color="var(--color-primary)" />
                    <div>
                      <span className={styles.bold}>{selectedUser.display_login}</span>
                      <span className={styles.subtext}>{selectedUser.email}</span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedUser(null)} 
                    className={styles.removeUserBtn}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {selectedUser && (
                <div className={styles.permissionsGrid}>
                  <h3 className={styles.modalSubtitle}>{tableHeader.perms || 'Səlahiyyətlər'}</h3>
                  {Object.keys(PERMISSION_LABELS).map((key) => (
                    <div key={key} className={styles.permRow}>
                      <span className={styles.permLabel}>{getPermissionLabel(key)}</span>
                      <Toggle
                        checked={newUserPerms[key]}
                        onChange={(e) => handleTogglePerm(key, e.target.checked, true)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setAddModal(false)}>
              {t('cancel', 'İmtina')}
            </Button>
            <Button type="submit" loading={actionLoading} disabled={activeTab === 'select' && !selectedUser}>
              {activeTab === 'create' ? t('create_and_make_admin', 'Yeni Hesab Yarat və Admin Et') : t('make_admin', 'Admin Et')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EDIT ADMIN PERMISSIONS */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={t('edit_perms_title', 'Admin Səlahiyyətləri Redaktə')} size="md">
        {selectedAdmin && (
          <form onSubmit={handleEditAdminSubmit} className={styles.modalForm}>
            <div className={styles.selectedUserCard}>
              <div className={styles.selectedUserInfo}>
                <Shield size={20} color="var(--color-warning)" />
                <div>
                  <span className={styles.bold}>{selectedAdmin.display_login}</span>
                  <span className={styles.subtext}>{selectedAdmin.email}</span>
                </div>
              </div>
              {selectedAdmin.email === 'admin@3bucaq.com' && (
                <Badge variant="gold">{t('main_super_admin', 'Əsas Super Admin')}</Badge>
              )}
            </div>

            <div className={styles.permissionsGrid}>
              <h3 className={styles.modalSubtitle}>{tableHeader.perms || 'Səlahiyyətlər'}</h3>
              {Object.keys(PERMISSION_LABELS).map((key) => (
                <div key={key} className={styles.permRow}>
                  <span className={styles.permLabel}>{getPermissionLabel(key)}</span>
                  <Toggle
                    checked={adminPerms[key]}
                    onChange={(e) => handleTogglePerm(key, e.target.checked, false)}
                    disabled={selectedAdmin.email === 'admin@3bucaq.com'}
                  />
                </div>
              ))}
            </div>

            <div className={styles.modalActionsBetween}>
              {selectedAdmin.email !== 'admin@3bucaq.com' ? (
                <Button type="button" variant="danger" onClick={handleRemoveAdmin} loading={actionLoading}>
                  {t('demote_admin_btn', 'Adminlikdən Çıxar')}
                </Button>
              ) : (
                <div />
              )}
              <div className={styles.rightButtons}>
                <Button type="button" variant="secondary" onClick={() => setEditModal(false)}>
                  {t('cancel', 'İmtina')}
                </Button>
                <Button type="submit" loading={actionLoading} disabled={selectedAdmin.email === 'admin@3bucaq.com'}>
                  {t('save_btn', 'Yadda Saxla')}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
