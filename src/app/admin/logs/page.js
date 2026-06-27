'use client';

import { useState, useEffect } from 'react';
import styles from '../admin-dashboard.module.css';
import lStyles from './logs.module.css';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import { ScrollText, Search, Calendar, User, Eye, X, Filter } from 'lucide-react';
import { getAdminLogs } from '@/lib/supabase/database';
import { formatDateTime } from '@/lib/utils/formatters';
import { useTranslation } from '@/lib/store/languageStore';

const ACTION_LABELS = {
  approve_withdrawal: { label: 'Çıxarış Təsdiq', variant: 'success' },
  reject_withdrawal: { label: 'Çıxarış Rədd', variant: 'error' },
  approve_deposit: { label: 'Mədaxil Təsdiq', variant: 'success' },
  reject_deposit: { label: 'Mədaxil Rədd', variant: 'error' },
  update_role: { label: 'Rol Yeniləndi', variant: 'gold' },
  unblock_user: { label: 'Blok Açıldı', variant: 'info' },
  block_user: { label: 'Bloklandı', variant: 'error' },
  update_balance: { label: 'Balans Dəyişdi', variant: 'accent' },
  update_points: { label: 'Xal Dəyişdi', variant: 'accent' },
  update_package: { label: 'Paket Yeniləndi', variant: 'info' },
  kyc_approved: { label: 'KYC Təsdiq', variant: 'success' },
  kyc_rejected: { label: 'KYC Rədd', variant: 'error' },
  add_admin: { label: 'Admin Əlavə Edildi', variant: 'gold' },
  update_admin_permissions: { label: 'Səlahiyyət Yeniləndi', variant: 'info' },
  remove_admin: { label: 'Admin Silindi', variant: 'error' },
  create_subadmin: { label: 'Alt-Admin Yaradıldı', variant: 'gold' },
  approve_claim: { label: 'Səviyyə Təsdiq', variant: 'success' },
  reject_claim: { label: 'Səviyyə Rədd', variant: 'error' },
};

const PER_PAGE = 15;

export default function AdminLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination & Modal State
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    async function loadLogs() {
      try {
        const data = await getAdminLogs();
        setLogs(data);
      } catch (err) {
        console.error('Failed to load admin logs: ', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  const getActionLabel = (actionKey) => {
    const trans = t('action_labels', {});
    return trans[actionKey] || ACTION_LABELS[actionKey]?.label || actionKey;
  };

  // Compute unique admins and actions from data for filtering
  const uniqueAdmins = Array.from(
    new Set(logs.map((log) => log.admin?.display_login).filter(Boolean))
  ).sort();

  const uniqueActions = Array.from(
    new Set(logs.map((log) => log.action).filter(Boolean))
  ).sort();

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('');
    setSelectedAction('');
    setSelectedAdmin('');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const isFilterActive = search || selectedAction || selectedAdmin || dateFrom || dateTo;

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    if (search) {
      const query = search.toLowerCase();
      const detailsMatch = log.details?.toLowerCase().includes(query);
      const adminLoginMatch = log.admin?.display_login?.toLowerCase().includes(query);
      const adminEmailMatch = log.admin?.email?.toLowerCase().includes(query);
      const targetLoginMatch = log.target?.display_login?.toLowerCase().includes(query);
      const targetEmailMatch = log.target?.email?.toLowerCase().includes(query);
      const actionLabelMatch = getActionLabel(log.action)
        ?.toLowerCase()
        .includes(query);

      if (
        !detailsMatch &&
        !adminLoginMatch &&
        !adminEmailMatch &&
        !targetLoginMatch &&
        !targetEmailMatch &&
        !actionLabelMatch
      ) {
        return false;
      }
    }

    if (selectedAction && log.action !== selectedAction) {
      return false;
    }

    if (selectedAdmin && log.admin?.display_login !== selectedAdmin) {
      return false;
    }

    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      if (new Date(log.created_at) < start) return false;
    }

    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(log.created_at) > end) return false;
    }

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / PER_PAGE);
  const startIdx = (currentPage - 1) * PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIdx, startIdx + PER_PAGE);

  // Helper for JSON styling in details
  const renderLogDetails = (details) => {
    if (!details) return '-';
    try {
      // If it looks like JSON, parse and render formatted
      if (details.startsWith('{') || details.startsWith('[')) {
        const parsed = JSON.parse(details);
        return (
          <pre className={lStyles.jsonDetails}>
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      }
    } catch (e) {
      // Fallback to plain string if parse fails
    }
    return <span className={lStyles.plainDetails}>{details}</span>;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <span className={lStyles.loadingText}>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  const logsTableHeader = t('logs_table_header', {});

  return (
    <div>
      <div className={lStyles.titleRow}>
        <h1 className={styles.pageTitle}>
          <ScrollText size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 10 }} />
          {t('admin_logs_title', 'Admin Logları')}
        </h1>
        <Badge variant="info" size="md">
          {t('logs_found_count', '{{count}} Log tapıldı').replace('{{count}}', filteredLogs.length)}
        </Badge>
      </div>

      {/* Advanced Filters Card */}
      <div className={lStyles.filterCard}>
        <div className={lStyles.filterHeader}>
          <div className={lStyles.filterTitle}>
            <Filter size={16} />
            <span>{t('filter_search_title', 'Filtrləmə və Axtarış')}</span>
          </div>
          {isFilterActive && (
            <button className={lStyles.resetBtn} onClick={handleResetFilters}>
              <X size={14} />
              <span>{t('reset', 'Sıfırla')}</span>
            </button>
          )}
        </div>

        <div className={lStyles.filterGrid}>
          {/* Text Search */}
          <div className={lStyles.filterGroup}>
            <label className={lStyles.filterLabel}>{t('search', 'Axtarış')}</label>
            <div className={lStyles.inputWrapper}>
              <Search size={16} className={lStyles.inputIcon} />
              <input
                type="text"
                placeholder={t('search_placeholder_logs', 'Admin, hədəf və ya detal...')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className={lStyles.filterInput}
              />
            </div>
          </div>

          {/* Action Filter */}
          <div className={lStyles.filterGroup}>
            <label className={lStyles.filterLabel}>{t('tx_type', 'Əməliyyat Növü')}</label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className={lStyles.filterSelect}
            >
              <option value="">{t('all', 'Hamısı')}</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {getActionLabel(act)}
                </option>
              ))}
            </select>
          </div>

          {/* Admin Filter */}
          <div className={lStyles.filterGroup}>
            <label className={lStyles.filterLabel}>{t('admin_filter_label', 'Həyata Keçirən Admin')}</label>
            <select
              value={selectedAdmin}
              onChange={(e) => {
                setSelectedAdmin(e.target.value);
                setCurrentPage(1);
              }}
              className={lStyles.filterSelect}
            >
              <option value="">{t('all', 'Hamısı')}</option>
              {uniqueAdmins.map((adm) => (
                <option key={adm} value={adm}>
                  {adm}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range - From */}
          <div className={lStyles.filterGroup}>
            <label className={lStyles.filterLabel}>{t('date_from_label', 'Başlanğıc Tarixi')}</label>
            <div className={lStyles.inputWrapper}>
              <Calendar size={16} className={lStyles.inputIcon} />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className={lStyles.filterInput}
              />
            </div>
          </div>

          {/* Date Range - To */}
          <div className={lStyles.filterGroup}>
            <label className={lStyles.filterLabel}>{t('date_to_label', 'Bitiş Tarixi')}</label>
            <div className={lStyles.inputWrapper}>
              <Calendar size={16} className={lStyles.inputIcon} />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className={lStyles.filterInput}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table Wrapper */}
      <div className={lStyles.tableContainer}>
        <div className={lStyles.tableWrapper}>
          <table className={lStyles.logsTable}>
            <thead>
              <tr>
                <th>{logsTableHeader.date || 'Tarix'}</th>
                <th>{logsTableHeader.admin || 'Admin'}</th>
                <th>{logsTableHeader.action || 'Əməliyyat'}</th>
                <th>{logsTableHeader.target || 'Hədəf İstifadəçi'}</th>
                <th>{logsTableHeader.details || 'Detallar'}</th>
                <th className={lStyles.centerAlign}>{logsTableHeader.view || 'Bax'}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className={lStyles.noLogs}>
                    {t('no_logs_found', 'Uyğun log tapılmadı')}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const actionLabel = getActionLabel(log.action);
                  const actionVariant = ACTION_LABELS[log.action]?.variant || 'default';
                  return (
                    <tr key={log.id} className={lStyles.tableRow}>
                      <td className={lStyles.dateCell}>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className={lStyles.userCell}>
                        <div className={lStyles.userCard}>
                          <div className={lStyles.avatar}>
                            <User size={14} />
                          </div>
                          <div className={lStyles.userInfo}>
                            <span className={lStyles.userLogin}>
                              {log.admin?.display_login || t('system', 'Sistem')}
                            </span>
                            {log.admin?.email && (
                              <span className={lStyles.userEmail}>
                                {log.admin.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge variant={actionVariant} size="sm">
                          {actionLabel}
                        </Badge>
                      </td>
                      <td className={lStyles.userCell}>
                        {log.target ? (
                          <div className={lStyles.userCard}>
                            <div className={lStyles.avatar}>
                              <User size={14} />
                            </div>
                            <div className={lStyles.userInfo}>
                              <span className={lStyles.userLogin}>
                                {log.target.display_login}
                              </span>
                              {log.target.email && (
                                <span className={lStyles.userEmail}>
                                  {log.target.email}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : log.target_uid ? (
                          <span className={lStyles.truncatedUuid}>
                            {log.target_uid.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className={lStyles.noTarget}>-</span>
                        )}
                      </td>
                      <td className={lStyles.detailsCell}>
                        <span className={lStyles.detailsText}>{log.details}</span>
                      </td>
                      <td className={lStyles.centerAlign}>
                        <button
                          className={lStyles.viewButton}
                          onClick={() => setSelectedLog(log)}
                          title={t('view', 'Bax')}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Detailed Log Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={t('log_details_title', 'Log Əməliyyat Detalları')}
        size="md"
      >
        {selectedLog && (
          <div className={lStyles.modalContent}>
            <div className={lStyles.modalGrid}>
              <div className={lStyles.modalItem}>
                <span className={lStyles.modalLabel}>{t('date', 'Tarix')}:</span>
                <span className={lStyles.modalValue}>
                  {formatDateTime(selectedLog.created_at)}
                </span>
              </div>
              <div className={lStyles.modalItem}>
                <span className={lStyles.modalLabel}>{t('performed_by', 'Həyata keçirən:')}</span>
                <span className={lStyles.modalValue}>
                  {selectedLog.admin?.display_login || t('system', 'Sistem')}{' '}
                  {selectedLog.admin?.email ? `(${selectedLog.admin.email})` : ''}
                </span>
              </div>
              <div className={lStyles.modalItem}>
                <span className={lStyles.modalLabel}>{t('action', 'Əməliyyat')}:</span>
                <span>
                  <Badge
                    variant={
                      ACTION_LABELS[selectedLog.action]?.variant || 'default'
                    }
                    size="sm"
                  >
                    {getActionLabel(selectedLog.action)}
                  </Badge>
                </span>
              </div>
              <div className={lStyles.modalItem}>
                <span className={lStyles.modalLabel}>{(logsTableHeader.target || 'Hədəf istifadəçi')}:</span>
                <span className={lStyles.modalValue}>
                  {selectedLog.target
                    ? `${selectedLog.target.display_login} (${selectedLog.target.email})`
                    : selectedLog.target_uid
                    ? selectedLog.target_uid
                    : '-'}
                </span>
              </div>
            </div>

            <div className={lStyles.modalDetailsWrapper}>
              <span className={lStyles.modalLabel}>{t('description_details', 'Açıqlama / Detallar:')}</span>
              <div className={lStyles.detailsContent}>
                {renderLogDetails(selectedLog.details)}
              </div>
            </div>

            <div className={lStyles.modalActions}>
              <Button onClick={() => setSelectedLog(null)}>{t('close', 'Bağla')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
