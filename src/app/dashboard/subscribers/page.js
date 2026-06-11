'use client';

import { useState, useEffect } from 'react';
import styles from './subscribers.module.css';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import {
  Users, UserCheck, DollarSign, Copy, Check, Share2,
  Filter, ChevronDown, ChevronUp, Info, Star
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuthStore } from '@/lib/store/authStore';
import { getReferralTree, getPointsHistory } from '@/lib/supabase/database';
import { formatCurrency, getPackageDisplayName } from '@/lib/utils/formatters';

const PER_PAGE = 10;

const PKG_NAMES = {
  pkg19: '#19',
  pkg49: '#49',
  pkg99: '#99',
  pkg199: '#199',
  pkg399: '#399',
  pkg799: '#799',
};

export default function SubscribersPage() {
  const { user: authUser } = useAuthStore();
  const [tree, setTree] = useState({});
  const [loading, setLoading] = useState(true);
  const [pointsMap, setPointsMap] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [filterLine, setFilterLine] = useState(0); // 0 = all
  const [filterOpen, setFilterOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', content: '' });

  // Total Points state
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    async function loadTree() {
      if (!authUser?.uid) return;
      try {
        const [data, pointsHistory] = await Promise.all([
          getReferralTree(authUser.uid, 5),
          getPointsHistory(authUser.uid)
        ]);

        setTree(data);

        // Sum points earned from each referral user and total points
        const map = {};
        let sum = 0;
        pointsHistory.forEach((p) => {
          if (p.from_uid && Number(p.points) > 0) {
            map[p.from_uid] = (map[p.from_uid] || 0) + Number(p.points);
          }
          sum += Number(p.points || 0);
        });
        setPointsMap(map);
        setTotalPoints(sum);
      } catch (err) {
        console.error('Failed to load referral data:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadTree();
  }, [authUser?.uid]);

  // Flatten all referrals
  const allRefs = Object.values(tree).flat();
  const totalRefs = allRefs.length;
  const activeRefs = allRefs.filter((r) => {
    if (!r.activePackages) return false;
    return Object.values(r.activePackages).some(Boolean);
  }).length;
  const conversionRate = totalRefs > 0 ? Math.round((activeRefs / totalRefs) * 100) : 0;

  // Level counts
  const levelCounts = [1, 2, 3, 4, 5].map((l) => (tree[l] || []).length);
  const maxCount = Math.max(...levelCounts, 1);

  // Filtered list for table
  const filteredList = filterLine === 0
    ? allRefs
    : (tree[filterLine] || []);
  const totalPages = Math.ceil(filteredList.length / PER_PAGE);
  const start = (currentPage - 1) * PER_PAGE;
  const pageData = filteredList.slice(start, start + PER_PAGE);

  // Referral link
  const referralLink = authUser?.referralCode
    ? `https://3bucaq.com/register?ref=${authUser.referralCode}`
    : '';

  useEffect(() => {
    if (!referralLink) return;
    QRCode.toDataURL(
      referralLink,
      {
        width: 240,
        margin: 1.5,
        color: {
          dark: '#00e676', // var(--color-primary) pixels, or dark slate for scan compatibility. Let's make it look beautiful! Wait, the brand color is green.
          light: '#ffffff' // White background for scanning
        }
      },
      (err, url) => {
        if (err) {
          console.error('QR code generation error:', err);
          return;
        }
        setQrCodeUrl(url);
      }
    );
  }, [referralLink]);

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '3bucaq - Referal Link',
          text: '3bucaq platformasına qoşulun!',
          url: referralLink,
        });
      } catch { /* user cancelled */ }
    }
  };

  const getActivePkg = (pkgObj) => {
    if (!pkgObj) return null;
    const entries = Object.entries(pkgObj).filter(([, v]) => v);
    if (entries.length === 0) return null;
    // Return the highest active package name
    const last = entries[entries.length - 1][0];
    return PKG_NAMES[last] || last;
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <span>Yüklənir...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Title */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Referallar</h1>
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>
              ÜMUMİ DƏVƏTLƏR
              <button
                className={styles.infoBtn}
                onClick={() => setInfoModal({
                  isOpen: true,
                  title: 'Ümumi Dəvətlər',
                  content: 'Sizin referal linkiniz vasitəsilə platformada qeydiyyatdan keçmiş (hesab yaratmış) bütün istifadəçilərin sayıdır. Bura paket almayan istifadəçilər də daxildir.'
                })}
                aria-label="Məlumat"
              >
                <Info size={13} />
              </button>
            </span>
            <div className={`${styles.statIcon} ${styles.statIconBlue}`}>
              <Users size={18} />
            </div>
          </div>
          <div className={styles.statValue}>{totalRefs.toLocaleString()}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>
              AKTİV REFERALLAR
              <button
                className={styles.infoBtn}
                onClick={() => setInfoModal({
                  isOpen: true,
                  title: 'Aktiv Referallar',
                  content: 'Sizin referal linkinizlə qeydiyyatdan keçmiş və ən azı 1 aktiv investisiya paketi (Hot Bed) olan istifadəçilərin sayıdır.'
                })}
                aria-label="Məlumat"
              >
                <Info size={13} />
              </button>
            </span>
            <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className={styles.statValue}>{activeRefs.toLocaleString()}</div>
          <div className={styles.statSub}>{conversionRate}% Konversiya</div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardHighlight}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>REFERAL BONUSU</span>
            <div className={`${styles.statIcon} ${styles.statIconGold}`}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className={styles.statValue}>
            <span className={styles.currency}>$</span>
            {formatCurrency(authUser?.balance || 0, '').trim()}
          </div>
          <div className={styles.statSub}>USDT Balansında</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>
              TOPLAM XALLAR
              <button
                className={styles.infoBtn}
                onClick={() => setInfoModal({
                  isOpen: true,
                  title: 'Toplam Xallar',
                  content: 'Referallarınızın paket aktivasiyalarından qazandığınız ümumi sistem daxili xalların cəmidir.'
                })}
                aria-label="Məlumat"
              >
                <Info size={13} />
              </button>
            </span>
            <div className={`${styles.statIcon} ${styles.statIconPurple}`}>
              <Star size={18} />
            </div>
          </div>
          <div className={styles.statValue}>{totalPoints.toFixed(1)}</div>
          <div className={styles.statSub}>Qazanılan Ümumi Xal</div>
        </div>
      </div>

      {/* Middle Section: Levels + Referral Link */}
      <div className={styles.middleGrid}>
        {/* Levels Chart */}
        <div className={styles.levelsCard}>
          <h3 className={styles.sectionTitle}>
            <Users size={18} color="var(--color-warning)" />
            Aktiv Referallar (Referat Xətləri üzrə)
          </h3>
          <div className={styles.levelsList}>
            {[1, 2, 3, 4, 5].map((level) => {
              const count = levelCounts[level - 1];
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const colors = ['var(--color-primary)', 'var(--color-warning)', 'var(--color-secondary)', 'var(--color-accent)', 'var(--color-info)'];
              return (
                <div key={level} className={styles.levelRow}>
                  <span className={styles.levelLabel}>
                    Referat Xətti {level}
                    {level === 1 && <span className={styles.levelSublabel}>Birbaşa dəvətlər</span>}
                  </span>
                  <div className={styles.levelBarWrapper}>
                    <div
                      className={styles.levelBar}
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        background: colors[level - 1],
                      }}
                    />
                  </div>
                  <span className={styles.levelCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Referral Link Card */}
        <div className={styles.refCard}>
          <h3 className={styles.sectionTitle}>Referal Linkiniz</h3>
          <p className={styles.refDesc}>
            Dostlarınızı dəvət edin və hər aktivasiyadan bonus qazanın.
          </p>

          {/* QR Code placeholder as styled box */}
          <div className={styles.qrBox}>
            <div className={styles.qrInner}>
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="Referal QR Kod"
                  width="80"
                  height="80"
                  style={{ display: 'block', borderRadius: '6px' }}
                />
              ) : (
                <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className={styles.spinner} style={{ width: '24px', height: '24px', border: '2px solid var(--border-subtle)', borderTopColor: 'var(--color-primary)' }} />
                </div>
              )}
            </div>
            <span className={styles.qrLabel}>Sizin unikal kodunuz</span>
          </div>

          <div className={styles.refLinkBox}>
            <span className={styles.refLinkText}>{referralLink || 'Yüklənir...'}</span>
            <button className={styles.refCopyBtn} onClick={handleCopy} aria-label="Kopyala">
              {copied ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
            </button>
          </div>

          <button className={styles.shareBtn} onClick={handleShare}>
            <Share2 size={16} />
            Paylaş
          </button>
        </div>
      </div>

      {/* Referral List Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.sectionTitle}>
            📋 Referal Siyahısı
          </h3>
          <div className={styles.filterWrapper}>
            <button
              className={styles.filterBtn}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Filter size={14} />
              Filtr
              {filterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {filterOpen && (
              <div className={styles.filterDropdown}>
                <button
                  className={`${styles.filterItem} ${filterLine === 0 ? styles.filterActive : ''}`}
                  onClick={() => { setFilterLine(0); setCurrentPage(1); setFilterOpen(false); }}
                >
                  Hamısı ({totalRefs})
                </button>
                {[1, 2, 3, 4, 5].map((l) => (
                  <button
                    key={l}
                    className={`${styles.filterItem} ${filterLine === l ? styles.filterActive : ''}`}
                    onClick={() => { setFilterLine(l); setCurrentPage(1); setFilterOpen(false); }}
                  >
                    Referat Xətti {l} ({levelCounts[l - 1]})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Table */}
        <div className={styles.tableDesktop}>
          <div className={styles.tableHead}>
            <span>LOGİN</span>
            <span>REFERAL XƏTTİ</span>
            <span>QEYDİYYAT TARİXİ</span>
            <span>AKTİV PAKET</span>
            <span>QAZANILAN XAL</span>
            <span>STATUS</span>
          </div>
          {pageData.length === 0 ? (
            <div className={styles.emptyRow}>Bu filtrdə referal yoxdur</div>
          ) : (
            pageData.map((sub) => {
              const activePkg = getActivePkg(sub.activePackages);
              const isActive = !!activePkg;
              const pointsEarned = pointsMap[sub.uid] || 0;
              return (
                <button
                  key={sub.uid}
                  className={styles.tableRow}
                  onClick={() => setSelectedUser(sub)}
                >
                  <span className={styles.cellLogin}>
                    <span className={styles.rowAvatar}>
                      {sub.displayLogin.charAt(0).toUpperCase()}{sub.displayLogin.charAt(1)?.toUpperCase() || ''}
                    </span>
                    {sub.displayLogin}
                  </span>
                  <span className={styles.cellLevel}>{sub.line}</span>
                  <span className={styles.cellDate}>
                    {new Date(sub.joinedAt).toLocaleDateString('az-AZ', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                    })}{' '}
                    {new Date(sub.joinedAt).toLocaleTimeString('az-AZ', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <span className={styles.cellPkg}>
                    {activePkg ? (
                      <Badge variant="warning" size="sm">{activePkg}</Badge>
                    ) : (
                      <span className={styles.noPkg}>—</span>
                    )}
                  </span>
                  <span className={styles.cellPoints}>
                    {pointsEarned.toFixed(1)} point
                  </span>
                  <span className={styles.cellStatus}>
                    <span className={`${styles.statusDot} ${isActive ? styles.statusActive : styles.statusInactive}`} />
                    {isActive ? 'Aktiv' : 'Qeyri-aktiv'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Mobile Cards (visible on small screens) */}
        <div className={styles.tableMobile}>
          {pageData.length === 0 ? (
            <div className={styles.emptyRow}>Bu filtrdə referal yoxdur</div>
          ) : (
            pageData.map((sub) => {
              const activePkg = getActivePkg(sub.activePackages);
              const isActive = !!activePkg;
              const pointsEarned = pointsMap[sub.uid] || 0;
              return (
                <button
                  key={sub.uid}
                  className={styles.mobileCard}
                  onClick={() => setSelectedUser(sub)}
                >
                  <div className={styles.mobileCardTop}>
                    <span className={styles.rowAvatar}>
                      {sub.displayLogin.charAt(0).toUpperCase()}{sub.displayLogin.charAt(1)?.toUpperCase() || ''}
                    </span>
                    <div className={styles.mobileCardInfo}>
                      <span className={styles.mobileLogin}>{sub.displayLogin}</span>
                      <span className={styles.mobileDate}>
                        {new Date(sub.joinedAt).toLocaleDateString('az-AZ')}
                      </span>
                    </div>
                    <span className={`${styles.statusDot} ${isActive ? styles.statusActive : styles.statusInactive}`} />
                  </div>
                  <div className={styles.mobileCardBottom}>
                    <span>Xətt {sub.line} ({pointsEarned.toFixed(1)} pt)</span>
                    {activePkg && <Badge variant="warning" size="sm">{activePkg}</Badge>}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.paginationWrap}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {filteredList.length > PER_PAGE && (
          <div className={styles.showMore}>
            Daha çox göstər ↓
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Referal Məlumatları"
        size="sm"
      >
        {selectedUser && (
          <div className={styles.detail}>
            <div className={styles.detailAvatar}>
              {(selectedUser.displayLogin || 'U').charAt(0).toUpperCase()}
            </div>
            <div className={styles.detailRow}>
              <span>Login</span>
              <span>@{selectedUser.displayLogin}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Ad Soyad</span>
              <span>{selectedUser.fullName}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Referal Xətti</span>
              <span>{selectedUser.line}-ci xətt</span>
            </div>
            <div className={styles.detailRow}>
              <span>Qeydiyyat</span>
              <span>{new Date(selectedUser.joinedAt).toLocaleDateString('az-AZ')}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Qazanılan Xal</span>
              <span>{(pointsMap[selectedUser.uid] || 0).toFixed(1)} point</span>
            </div>
            <div className={styles.detailRow}>
              <span>Aktiv Paketlər</span>
              <div className={styles.detailPkgs}>
                {(() => {
                  const pkgs = selectedUser.activePackages;
                  if (!pkgs) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paket yoxdur</span>;
                  const active = Object.entries(pkgs).filter(([, v]) => v);
                  if (active.length === 0) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paket yoxdur</span>;
                  return active.map(([k]) => (
                    <Badge key={k} variant="success" size="sm">{PKG_NAMES[k] || k}</Badge>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Info Modal */}
      <Modal
        isOpen={infoModal.isOpen}
        onClose={() => setInfoModal({ ...infoModal, isOpen: false })}
        title={infoModal.title}
        size="sm"
      >
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '8px 0' }}>
          {infoModal.content}
        </p>
      </Modal>
    </div>
  );
}
