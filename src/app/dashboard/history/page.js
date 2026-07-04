'use client';

import { useState, useEffect } from 'react';
import styles from './history.module.css';
import Modal from '@/components/ui/Modal';
import { 
  ArrowDown, ArrowUp, ArrowLeftRight, Users, Gift, Award, TrendingUp, ShoppingBag, Sliders,
  Calendar, ChevronDown, ChevronLeft, ChevronRight, Info 
} from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/lib/utils/formatters';
import { useAuthStore } from '@/lib/store/authStore';
import { useTranslation } from '@/lib/store/languageStore';
import { getTransactions, getDeposits, getWithdrawals } from '@/lib/supabase/database';

const PER_PAGE = 10;

const getTxTypeStyle = (type, amount) => {
  const stylesMap = {
    deposit: { bg: 'rgba(0, 230, 118, 0.1)', color: '#00E676', icon: ArrowDown },
    withdrawal: { bg: 'rgba(255, 82, 82, 0.1)', color: '#FF5252', icon: ArrowUp },
    transfer: { bg: 'rgba(68, 138, 255, 0.1)', color: '#448AFF', icon: ArrowLeftRight },
    referral_bonus: { bg: 'rgba(255, 214, 0, 0.1)', color: '#FFD600', icon: Gift },
    depth_bonus: { bg: 'rgba(255, 214, 0, 0.1)', color: '#FFD600', icon: Gift },
    daily_earning: { bg: 'rgba(255, 145, 0, 0.1)', color: '#FF9100', icon: TrendingUp },
    level_bonus: { bg: 'rgba(124, 77, 255, 0.1)', color: '#7C4DFF', icon: Award },
    package_purchase: { bg: 'rgba(255, 82, 82, 0.1)', color: '#FF5252', icon: ShoppingBag },
    admin_adjust: { bg: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', icon: Sliders },
  };

  return stylesMap[type] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', icon: Info };
};

const getAmountColorClass = (type, amt) => {
  if (amt > 0) {
    if (type === 'deposit') return styles.amountGreen;
    return styles.amountGold;
  }
  return styles.amountNormal;
};

export default function HistoryPage() {
  const { user: authUser } = useAuthStore();
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [stats, setStats] = useState({ incoming: 0, outgoing: 0, pending: 0 });

  const TX_TYPE_LABELS = t('tx_type_labels', {
    deposit: 'Depozit',
    withdrawal: 'Çıxarış',
    transfer: 'Daxili Köçürmə',
    referral_bonus: 'Referal Bonusu',
    depth_bonus: 'Dərinlik Bonusu',
    daily_earning: 'Gündəlik Qazanc',
    package_purchase: 'Paket Alışı',
    level_bonus: 'Səviyyə Bonusu',
    admin_adjust: 'Admin Düzəlişi',
  });

  const STATUS_LABELS = t('status_labels', {
    completed: 'Tamamlanıb',
    pending: 'Gözləyir',
    rejected: 'Rədd edilib',
  });

  const MONTHS = t('months', ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyun', 'İyul', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek']);

  function formatRowDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatRowTime(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  useEffect(() => {
    async function loadData() {
      if (!authUser?.uid) return;
      try {
        const [txs, deps, withs] = await Promise.all([
          getTransactions(authUser.uid),
          getDeposits(authUser.uid),
          getWithdrawals(authUser.uid)
        ]);

        const unifiedList = [];

        // Add non-deposit, non-withdrawal transactions
        txs.forEach((tx) => {
          if (tx.type === 'deposit' || tx.type === 'withdrawal') return;

          let calculatedAmount = Number(tx.amount);
          if (tx.type === 'package_purchase') {
            calculatedAmount = -Math.abs(calculatedAmount);
          } else if (tx.type === 'transfer') {
            if (tx.from_uid === authUser.uid) {
              calculatedAmount = -Math.abs(calculatedAmount);
            } else {
              calculatedAmount = Math.abs(calculatedAmount);
            }
          } else if (tx.type === 'admin_adjust') {
            calculatedAmount = Number(tx.amount);
          } else {
            if (tx.to_uid === authUser.uid) {
              calculatedAmount = Math.abs(calculatedAmount);
            } else {
              calculatedAmount = -Math.abs(calculatedAmount);
            }
          }

          // Detail formatting
          let detail = 'Sistem';
          if (tx.type === 'transfer') {
            detail = tx.from_uid === authUser.uid 
              ? `${t('user', 'İstifadəçi')}: @${tx.to_login}` 
              : `${t('user', 'İstifadəçi')}: @${tx.from_login}`;
          } else if (tx.type === 'referral_bonus' || tx.type === 'depth_bonus') {
            detail = `Referral: @${tx.from_login}`;
          } else if (tx.type === 'level_bonus') {
            detail = t('level_bonus', 'Level Bonusu');
          } else if (tx.type === 'daily_earning') {
            detail = t('daily_revenue', 'Gündəlik Qazanc');
          } else if (tx.type === 'admin_adjust') {
            detail = t('admin_adjust', 'Admin Düzəlişi');
          }

          unifiedList.push({
            id: tx.id,
            type: tx.type,
            amount: calculatedAmount,
            status: tx.status || 'completed',
            created_at: tx.created_at,
            from_login: tx.from_login,
            to_login: tx.to_login,
            detail: detail,
          });
        });

        // Metod etiketi payment_method-dan törədilir (USDC depoziti "USDT" kimi görünməsin)
        const cryptoAssetLabel = (item) =>
          `${item.payment_method === 'usdc' ? 'USDC' : 'USDT'} ${(item.network || 'TRC20').replace(/^(USDT|USDC)\s+/i, '')}`;

        // Add deposits
        deps.forEach((d) => {
          unifiedList.push({
            id: d.id,
            type: 'deposit',
            amount: Number(d.amount),
            status: d.status === 'approved' ? 'completed' : d.status,
            created_at: d.created_at,
            detail: d.payment_method === 'card'
              ? `${t('bank_card_manual', 'Bank Kartı')}${d.card_number ? ` (**** ${String(d.card_number).slice(-4)})` : ''}`
              : d.tx_hash
                ? `${t('external_wallet', 'Xarici Pulqabı')} (${d.tx_hash.slice(0, 6)}...${d.tx_hash.slice(-4)})`
                : `${t('external_wallet', 'Xarici Pulqabı')} (${cryptoAssetLabel(d)})`,
            network: d.network,
          });
        });

        // Add withdrawals
        withs.forEach((w) => {
          unifiedList.push({
            id: w.id,
            type: 'withdrawal',
            amount: -Number(w.amount),
            status: (w.status === 'done' || w.status === 'approved') ? 'completed' : w.status,
            created_at: w.created_at,
            detail: w.payment_method === 'card'
              ? `${t('bank_card_manual', 'Bank Kartı')}${w.card_number ? ` (**** ${String(w.card_number).slice(-4)})` : ''}`
              : w.crypto_address
                ? `${t('external_wallet', 'Xarici Pulqabı')} (${w.crypto_address.slice(0, 6)}...${w.crypto_address.slice(-4)})`
                : t('external_wallet', 'Xarici Pulqabı'),
            network: w.network,
          });
        });

        // Sort by date descending
        unifiedList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setTransactions(unifiedList);

        // Calculate stats
        let incomingSum = 0;
        let outgoingSum = 0;
        let pendingSum = 0;

        unifiedList.forEach((item) => {
          const amt = Number(item.amount);
          if (item.status === 'pending') {
            pendingSum += Math.abs(amt);
          } else if (item.status === 'completed') {
            if (amt > 0) {
              incomingSum += amt;
            } else {
              outgoingSum += Math.abs(amt);
            }
          }
        });

        setStats({ incoming: incomingSum, outgoing: outgoingSum, pending: pendingSum });

      } catch (err) {
        console.error('Failed to load transactions: ', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [authUser]);

  const handleTypeSelect = (type) => {
    setFilterType(type);
    setCurrentPage(1);
    setTypeDropdownOpen(false);
  };

  const handleDateChange = (e) => {
    setFilterDate(e.target.value);
    setCurrentPage(1);
  };

  // Filter list
  const filteredTxs = transactions.filter((tx) => {
    // Type Filter
    if (filterType !== 'all') {
      if (filterType === 'deposit' && tx.type !== 'deposit') return false;
      if (filterType === 'withdrawal' && tx.type !== 'withdrawal') return false;
      if (filterType === 'transfer' && tx.type !== 'transfer') return false;
      if (filterType === 'bonus' && tx.type !== 'referral_bonus' && tx.type !== 'depth_bonus' && tx.type !== 'level_bonus') return false;
    }

    // Date Filter
    if (filterDate) {
      const itemDate = new Date(tx.created_at);
      const fDate = new Date(filterDate);
      const sameDay = itemDate.getFullYear() === fDate.getFullYear() &&
                      itemDate.getMonth() === fDate.getMonth() &&
                      itemDate.getDate() === fDate.getDate();
      if (!sameDay) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredTxs.length / PER_PAGE);
  const start = (currentPage - 1) * PER_PAGE;
  const pageData = filteredTxs.slice(start, start + PER_PAGE);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <span>{t('loading', 'Yüklənir...')}</span>
      </div>
    );
  }

  const renderPaginationButtons = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }

    return pages.map((p, idx) => {
      if (p === '...') {
        return <span key={`dots-${idx}`} className={styles.paginationDots}>...</span>;
      }
      return (
        <button
          key={`page-${p}`}
          className={`${styles.pageBtn} ${currentPage === p ? styles.pageBtnActive : ''}`}
          onClick={() => setCurrentPage(p)}
        >
          {p}
        </button>
      );
    });
  };

  const getFilterTypeLabel = (val) => {
    const labels = t('filter_types', {
      all: 'Bütün Növlər',
      deposit: 'Depozit',
      withdrawal: 'Çıxarış',
      transfer: 'Daxili Köçürmə',
      bonus: 'Referal Bonusu',
    });
    return labels[val] || val;
  };

  const netBalance = stats.incoming - stats.outgoing;

  return (
    <div className={styles.history}>
      {/* Title */}
      <div className={styles.pageHeader}>
        <div className={styles.headerTitleRow}>
          <div>
            <h1 className={styles.pageTitle}>{t('tx_history_title', 'USDT Tarixçəsi')}</h1>
            <p className={styles.pageSubtitle}>{t('tx_history_subtitle', 'Bütün maliyyə əməliyyatlarının detallı siyahısı.')}</p>
          </div>
          
          {/* Top Filters */}
          <div className={styles.topFilters}>
            <div className={styles.filterDropdownWrapper}>
              <button 
                className={styles.filterDropdownBtn}
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              >
                {getFilterTypeLabel(filterType)}
                <ChevronDown size={16} />
              </button>
              {typeDropdownOpen && (
                <div className={styles.filterMenu}>
                  {['all', 'deposit', 'withdrawal', 'transfer', 'bonus'].map((t) => (
                    <button 
                      key={t}
                      className={`${styles.filterMenuItem} ${filterType === t ? styles.filterMenuItemActive : ''}`}
                      onClick={() => handleTypeSelect(t)}
                    >
                      {getFilterTypeLabel(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.datePickerWrapper}>
              <input 
                type="date" 
                value={filterDate}
                onChange={handleDateChange}
                className={styles.datePickerInput}
                placeholder="gg.aa.yyyy"
              />
              <Calendar size={16} className={styles.calendarIcon} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('incoming_sum', 'Ümumi Mədaxil')}</span>
          <div className={`${styles.statValue} ${styles.valIncoming}`}>
            +{stats.incoming.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className={styles.currency}>USDT</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('outgoing_sum', 'Ümumi Məxaric')}</span>
          <div className={`${styles.statValue} ${styles.valOutgoing}`}>
            -{stats.outgoing.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className={styles.currency}>USDT</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('pending', 'Gözləmədə')}</span>
          <div className={`${styles.statValue} ${styles.valPending}`}>
            {stats.pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className={styles.currency}>USDT</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>{t('net_balance', 'Net Balans')}</span>
          <div className={styles.statValue}>
            {netBalance >= 0 ? '+' : ''}
            {netBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className={styles.currency}>USDT</span>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('tx_date', 'TARİX')}</th>
                <th>{t('tx_type', 'ƏMƏLİYYAT NÖVÜ')}</th>
                <th>{t('tx_amount', 'MƏBLƏĞ')}</th>
                <th>{t('tx_status', 'STATUS')}</th>
                <th>{t('tx_detail', 'DETAL (GÖNDƏRƏN/ALAN)')}</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    {t('no_data_found', 'Məlumat tapılmadı')}
                  </td>
                </tr>
              ) : (
                pageData.map((item) => {
                  const typeStyle = getTxTypeStyle(item.type, item.amount);
                  const Icon = typeStyle.icon;
                  const amtColor = getAmountColorClass(item.type, item.amount);
                  const statusClass = item.status === 'completed' 
                    ? styles.statusCompleted 
                    : item.status === 'pending' 
                    ? styles.statusPending 
                    : styles.statusRejected;
                  
                  const displayStatus = STATUS_LABELS[item.status] || item.status;

                  return (
                    <tr key={item.id} className={styles.clickableRow} onClick={() => setSelectedTx(item)}>
                      <td>
                        <div className={styles.dateCol}>
                          <span className={styles.dateStr}>{formatRowDate(item.created_at)}</span>
                          <span className={styles.timeStr}>{formatRowTime(item.created_at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.typeCol}>
                          <div 
                            className={styles.typeIconContainer}
                            style={{ backgroundColor: typeStyle.bg, color: typeStyle.color }}
                          >
                            <Icon size={16} />
                          </div>
                          <span className={styles.typeLabel}>{TX_TYPE_LABELS[item.type] || item.type}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.amountText} ${amtColor}`}>
                          {item.amount > 0 ? '+' : ''}
                          {Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${statusClass}`}>
                          <span className={styles.statusDot} />
                          {displayStatus}
                        </span>
                      </td>
                      <td className={styles.detailCell}>{item.detail}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Custom Pagination Footer */}
        <div className={styles.tableFooter}>
          <div className={styles.tableFooterInfo}>
            {t('showing_rows', 'Göstərilir {{start}}-{{end}} / {{total}}')
              .replace('{{start}}', filteredTxs.length > 0 ? start + 1 : 0)
              .replace('{{end}}', Math.min(start + PER_PAGE, filteredTxs.length))
              .replace('{{total}}', filteredTxs.length)}
          </div>
          <div className={styles.paginationButtons}>
            <button
              className={styles.pageArrowBtn}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            {renderPaginationButtons()}
            <button
              className={styles.pageArrowBtn}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Details Modal */}
      <Modal isOpen={!!selectedTx} onClose={() => setSelectedTx(null)} title={t('tx_details', 'Əməliyyat Detalları')} size="sm">
        {selectedTx && (
          <div className={styles.detailModal}>
            <div className={styles.detailRow}>
              <span>{t('tx_id', 'Əməliyyat ID')}</span>
              <span className={styles.monoText}>{selectedTx.id}</span>
            </div>
            <div className={styles.detailRow}>
              <span>{t('type', 'Növ')}</span>
              <span>{TX_TYPE_LABELS[selectedTx.type] || selectedTx.type}</span>
            </div>
            <div className={styles.detailRow}>
              <span>{t('amount', 'Məbləğ')}</span>
              <span className={selectedTx.amount > 0 ? styles.amountGreen : styles.amountRed}>
                {selectedTx.amount > 0 ? '+' : ''}{formatCurrency(selectedTx.amount)}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span>{t('status', 'Status')}</span>
              <span style={{ fontWeight: 600, color: selectedTx.status === 'completed' ? '#00E676' : selectedTx.status === 'pending' ? '#FFD600' : '#FF5252' }}>
                {STATUS_LABELS[selectedTx.status] || selectedTx.status}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span>{t('date', 'Tarix')}</span>
              <span>{formatDateTime(selectedTx.created_at)}</span>
            </div>
            <div className={styles.detailRow}>
              <span>{t('details', 'Detal')}</span>
              <span>{selectedTx.detail}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
