import { supabase } from './config';
import { PACKAGES, REFERRAL_BONUS, LEVELS } from '../utils/constants';

// ============================================
// USERS & PROFILES
// ============================================

export async function getUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getUserByUid(uid) {
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows returned
    throw new Error(error.message);
  }
  return data;
}

export async function getUserByLogin(login) {
  if (!login) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('display_login', login)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data;
}

export async function getUserByReferralCode(code) {
  if (!code) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_login')
    .eq('referral_code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data;
}

export async function blockUser(uid, reason, days) {
  const updateData = {
    is_blocked: true,
    block_reason: reason || 'Qaydaları pozma',
  };

  if (days) {
    const until = new Date();
    until.setDate(until.getDate() + Number(days));
    updateData.blocked_until = until.toISOString();
  } else {
    updateData.blocked_until = null; // permanent
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function unblockUser(uid) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_blocked: false, block_reason: '', blocked_until: null })
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateUserRole(uid, role) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateProfileLogin(uid, newLogin) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_login: newLogin })
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateUserProfile(uid, data) {
  const allowedFields = ['full_name', 'country', 'city', 'phone', 'display_login', 'email'];
  const updateData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateUserBalance(uid, amount, type = 'admin_adjust') {
  const user = await getUserByUid(uid);
  if (!user) throw new Error('İstifadəçi tapılmadı');

  const parsedAmount = Number(amount);
  const newBalance = user.balance + parsedAmount;
  if (newBalance < 0) throw new Error('Balans mənfi ola bilməz');

  const { error } = await supabase
    .from('profiles')
    .update({ balance: newBalance })
    .eq('id', uid);

  if (error) throw new Error(error.message);

  // Log transaction
  await supabase.from('transactions').insert({
    type,
    from_uid: null,
    from_login: 'Admin',
    to_uid: uid,
    to_login: user.display_login,
    amount: parsedAmount,
  });

  return { success: true };
}

export async function updateUserPoints(uid, points) {
  const user = await getUserByUid(uid);
  if (!user) throw new Error('İstifadəçi tapılmadı');

  const newPoints = Number(user.total_points) + Number(points);
  if (newPoints < 0) throw new Error('Points mənfi ola bilməz');

  const { error } = await supabase
    .from('profiles')
    .update({ total_points: newPoints })
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

// ============================================
// TRANSACTIONS
// ============================================

export async function getTransactions(uid) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (uid) {
    query = query.or(`from_uid.eq.${uid},to_uid.eq.${uid}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function transferFunds(fromUid, toLogin, amount) {
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Məbləğ düzgün deyil');
  }

  const { data, error } = await supabase.rpc('transfer_funds', {
    to_login: toLogin,
    amount: parsedAmount,
  });

  if (error) throw new Error(error.message);
  if (data && data.success === false) {
    throw new Error(data.error || 'Köçürmə baş tutmadı');
  }

  return { success: true };
}

// ============================================
// PACKAGES (HOT BED) WITH REFERRAL BONUSES
// ============================================

export async function buyPackage(uid, pkgId, price) {
  const { data, error } = await supabase.rpc('buy_package', {
    pkg_id: pkgId,
  });

  if (error) throw new Error(error.message);
  if (data && data.success === false) {
    throw new Error(data.error || 'Paket alınması baş tutmadı');
  }

  return { success: true };
}

export async function deactivatePackage(pkgId) {
  const { data, error } = await supabase.rpc('deactivate_package', {
    pkg_id: pkgId,
  });

  if (error) throw new Error(error.message);
  if (data && data.success === false) {
    throw new Error(data.error || 'Paket deaktiv edilə bilmədi');
  }

  return data;
}

// ============================================
// REFERRALS (5-line tree)
// ============================================

export async function getReferrals(uid) {
  if (!uid) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('referred_by', uid)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((p) => ({
    uid: p.id,
    displayLogin: p.display_login,
    fullName: p.full_name,
    line: 1,
    totalPoints: p.total_points,
    currentLevel: p.current_level,
    joinedAt: p.created_at,
    activePackages: p.active_packages,
  }));
}

/**
 * Get referral tree up to 5 levels deep
 */
export async function getReferralTree(uid, maxDepth = 5) {
  if (!uid) return {};

  const tree = {};
  let currentLevelUids = [uid];

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (currentLevelUids.length === 0) break;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_login, full_name, total_points, current_level, created_at, active_packages, referred_by')
      .in('referred_by', currentLevelUids)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching line ${depth}: `, error.message);
      break;
    }

    tree[depth] = (data || []).map((p) => ({
      uid: p.id,
      displayLogin: p.display_login,
      fullName: p.full_name,
      line: depth,
      totalPoints: p.total_points,
      currentLevel: p.current_level,
      joinedAt: p.created_at,
      activePackages: p.active_packages,
    }));

    currentLevelUids = (data || []).map((p) => p.id);
  }

  return tree;
}

// ============================================
// LEVEL CLAIMS
// ============================================

export async function getLevelClaims(status) {
  let query = supabase
    .from('level_claims')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getUserClaimedLevels(uid) {
  if (!uid) return [];
  const { data, error } = await supabase
    .from('level_claims')
    .select('level, status')
    .eq('uid', uid)
    .in('status', ['pending', 'done']);

  if (error) throw new Error(error.message);
  return (data || []).map((c) => c.level);
}

export async function createLevelClaim(uid, level, bonusAmount, claimType, usdtAddress, network) {
  const { data, error } = await supabase.rpc('create_level_claim', {
    claim_level: Number(level),
  });

  if (error) throw new Error(error.message);
  if (data && data.success === false) {
    throw new Error(data.error || 'Səviyyə bonusu tələbi baş tutmadı');
  }

  return { success: true };
}

export async function approveClaim(claimId, txHash, adminUid) {
  const { data: claim, error: fetchErr } = await supabase
    .from('level_claims')
    .select('*')
    .eq('id', claimId)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);

  // Update claim status
  const { error: updateErr } = await supabase
    .from('level_claims')
    .update({
      status: 'done',
      tx_hash: txHash,
      approved_at: new Date().toISOString(),
    })
    .eq('id', claimId);

  if (updateErr) throw new Error(updateErr.message);

  // Add level_bonus transaction and update current_level if needed
  const targetUser = await getUserByUid(claim.uid);
  if (targetUser) {
    if (Number(claim.level) > Number(targetUser.current_level || 0)) {
      await supabase
        .from('profiles')
        .update({ current_level: Number(claim.level) })
        .eq('id', claim.uid);
    }

    await supabase.from('transactions').insert({
      type: 'level_bonus',
      from_uid: adminUid || null,
      from_login: 'Admin',
      to_uid: claim.uid,
      to_login: claim.login,
      amount: claim.bonus_amount,
    });
  }

  return { success: true };
}

export async function rejectClaim(claimId) {
  // Get claim to restore level and refund points
  const { data: claim } = await supabase
    .from('level_claims')
    .select('uid, level, status')
    .eq('id', claimId)
    .single();

  if (claim && claim.status === 'pending') {
    const user = await getUserByUid(claim.uid);
    if (user) {
      const claimedLevels = (user.claimed_levels || []).filter((l) => l !== claim.level);
      
      const levelData = LEVELS.find((l) => l.level === Number(claim.level));
      const refundPoints = levelData ? Number(levelData.points) : 0;
      const newPoints = Number(user.total_points || 0) + refundPoints;

      await supabase
        .from('profiles')
        .update({ 
          claimed_levels: claimedLevels,
          total_points: newPoints,
        })
        .eq('id', claim.uid);

      if (refundPoints > 0) {
        const { error: historyErr } = await supabase
          .from('points_history')
          .insert({
            uid: claim.uid,
            points: refundPoints,
            from_uid: null,
            from_login: 'Claim Rejected',
            package_id: 'level_' + claim.level,
            line_number: 0,
          });

        if (historyErr) {
          console.error('Points history refund log error:', historyErr.message);
        }
      }
    }
  }

  const { error } = await supabase
    .from('level_claims')
    .update({ status: 'rejected' })
    .eq('id', claimId);

  if (error) throw new Error(error.message);
  return { success: true };
}

// ============================================
// POINTS HISTORY
// ============================================

export async function getPointsHistory(uid) {
  if (!uid) return [];
  const { data, error } = await supabase
    .from('points_history')
    .select('*')
    .eq('uid', uid)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// DEPOSITS
// ============================================

export async function getDeposits(uid) {
  let query = supabase
    .from('deposits')
    .select('*')
    .order('created_at', { ascending: false });

  if (uid) {
    query = query.eq('uid', uid);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createDeposit(uid, amount, txHash, network = 'TRC20', paymentMethod = 'usdt', cardNumber = null, receiptUrl = null) {
  const user = await getUserByUid(uid);
  if (!user) throw new Error('İstifadəçi tapılmadı');

  const { error } = await supabase.from('deposits').insert({
    uid,
    login: user.display_login,
    amount: Number(amount),
    tx_hash: txHash || null,
    network: network || null,
    payment_method: paymentMethod,
    card_number: cardNumber,
    receipt_url: receiptUrl,
    status: 'pending',
  });

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function approveDeposit(depositId, adminUid) {
  const { data: deposit, error: fetchErr } = await supabase
    .from('deposits')
    .select('*')
    .eq('id', depositId)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);

  // Update deposit status
  const { error: updateErr } = await supabase
    .from('deposits')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', depositId);

  if (updateErr) throw new Error(updateErr.message);

  // Add to user balance
  const user = await getUserByUid(deposit.uid);
  if (user) {
    await supabase
      .from('profiles')
      .update({ balance: Number(user.balance) + Number(deposit.amount) })
      .eq('id', deposit.uid);

    // Log transaction
    await supabase.from('transactions').insert({
      type: 'deposit',
      from_uid: deposit.uid,
      from_login: deposit.login,
      to_uid: deposit.uid,
      to_login: deposit.login,
      amount: deposit.amount,
    });
  }

  return { success: true };
}

export async function rejectDeposit(depositId) {
  const { error } = await supabase
    .from('deposits')
    .update({ status: 'rejected' })
    .eq('id', depositId);

  if (error) throw new Error(error.message);
  return { success: true };
}

// ============================================
// WITHDRAWALS
// ============================================

export async function getWithdrawals(uid) {
  let query = supabase
    .from('withdrawals')
    .select('*')
    .order('created_at', { ascending: false });

  if (uid) {
    query = query.eq('uid', uid);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createWithdrawal(uid, amount, cryptoAddress, network = 'TRC20', paymentMethod = 'usdt', cardNumber = null) {
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Məbləğ müsbət olmalıdır');
  }

  const { data, error } = await supabase.rpc('create_withdrawal', {
    amount: parsedAmount,
    crypto_address: cryptoAddress || null,
    network: network || null,
    payment_method: paymentMethod,
    card_number: cardNumber || null,
  });

  if (error) throw new Error(error.message);
  if (data && data.success === false) {
    throw new Error(data.error || 'Məxaric tələbi baş tutmadı');
  }

  return { success: true };
}

export async function approveWithdrawal(withdrawalId, txHash, adminUid, receiptUrl = null) {
  const { error } = await supabase
    .from('withdrawals')
    .update({
      status: 'done',
      tx_hash: txHash || null,
      receipt_url: receiptUrl,
      approved_at: new Date().toISOString(),
    })
    .eq('id', withdrawalId);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function rejectWithdrawal(withdrawalId) {
  // Get withdrawal to refund
  const { data: withdrawal } = await supabase
    .from('withdrawals')
    .select('uid, amount')
    .eq('id', withdrawalId)
    .single();

  if (withdrawal) {
    const user = await getUserByUid(withdrawal.uid);
    if (user) {
      await supabase
        .from('profiles')
        .update({ balance: Number(user.balance) + Number(withdrawal.amount) })
        .eq('id', withdrawal.uid);
    }
  }

  const { error } = await supabase
    .from('withdrawals')
    .update({ status: 'rejected' })
    .eq('id', withdrawalId);

  if (error) throw new Error(error.message);
  return { success: true };
}

// ============================================
// KYC
// ============================================

export async function submitKYC(uid, documentType, documentUrl, selfieUrl, documentBackUrl = null, identityNumber = null) {
  const { error } = await supabase
    .from('profiles')
    .update({
      kyc_status: 'pending',
      kyc_document_type: documentType,
      kyc_document_url: documentUrl,
      kyc_document_back_url: documentBackUrl,
      kyc_selfie_url: selfieUrl,
      kyc_document_number: identityNumber,
    })
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateKYCStatus(uid, status) {
  const updateData = { kyc_status: status };
  if (status === 'rejected') {
    updateData.kyc_document_url = null;
    updateData.kyc_document_back_url = null;
    updateData.kyc_selfie_url = null;
  } else if (status === 'approved') {
    const { data: profile, error: fetchErr } = await supabase
      .from('profiles')
      .select('kyc_document_number')
      .eq('id', uid)
      .single();
    if (!fetchErr && profile) {
      updateData.identity_number = profile.kyc_document_number;
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function checkIdentityNumberExists(uid, num) {
  if (!num) return false;
  const cleanNum = num.trim();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .neq('id', uid)
    .or(`kyc_document_number.eq.${cleanNum},identity_number.eq.${cleanNum}`);

  if (error) {
    console.error('Error checking identity number:', error);
    return false;
  }
  return data && data.length > 0;
}

// ============================================
// DAILY EARNINGS (Cron helper)
// ============================================

export async function processDailyEarnings() {
  // Get all users with active #399 or #799
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, display_login, transfer_balance, active_packages, package_activated_at, referred_by')
    .eq('is_blocked', false);

  if (error) throw new Error(error.message);

  let processed = 0;

  for (const user of users || []) {
    let dailyTotal = 0;
    const pkgs = user.active_packages || {};

    if (pkgs.pkg399) dailyTotal += 3.3;
    if (pkgs.pkg799) dailyTotal += 6.5;

    if (dailyTotal > 0) {
      // Add to transfer_balance
      await supabase
        .from('profiles')
        .update({ transfer_balance: Number(user.transfer_balance) + dailyTotal })
        .eq('id', user.id);

      // Log transaction
      await supabase.from('transactions').insert({
        type: 'daily_earning',
        from_uid: null,
        from_login: 'System',
        to_uid: user.id,
        to_login: user.display_login,
        amount: dailyTotal,
      });

      processed++;
    }
  }

  return { success: true, processed };
}

/**
 * Check and deactivate packages past their expiry
 * #19/#49/#99/#199 → 180 days, no referrals → refund
 * #399/#799 → 120 days, no referrals → deactivate
 */
export async function processPackageExpiry() {
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, display_login, balance, active_packages, package_activated_at, referred_by');

  if (error) throw new Error(error.message);

  let processed = 0;
  const now = new Date();

  for (const user of users || []) {
    const pkgs = user.active_packages || {};
    const activatedAt = user.package_activated_at || {};
    let updated = false;
    const updatedPkgs = { ...pkgs };
    const updatedActivatedAt = { ...activatedAt };
    let balanceAdd = 0;

    // Check if user has any referrals
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', user.id);

    const hasReferrals = (count || 0) > 0;

    if (!hasReferrals) {
      // Investment packages: 180-day refund
      for (const pkgId of ['pkg19', 'pkg49', 'pkg99', 'pkg199']) {
        if (pkgs[pkgId] && activatedAt[pkgId]) {
          const activatedDate = new Date(activatedAt[pkgId]);
          const daysPassed = (now - activatedDate) / (1000 * 60 * 60 * 24);
          if (daysPassed >= 180) {
            const pkg = PACKAGES.find((p) => p.id === pkgId);
            if (pkg) {
              balanceAdd += pkg.price;
              updatedPkgs[pkgId] = false;
              delete updatedActivatedAt[pkgId];
              updated = true;
            }
          }
        }
      }

      // Earning packages: 120-day deactivation
      for (const pkgId of ['pkg399', 'pkg799']) {
        if (pkgs[pkgId] && activatedAt[pkgId]) {
          const activatedDate = new Date(activatedAt[pkgId]);
          const daysPassed = (now - activatedDate) / (1000 * 60 * 60 * 24);
          if (daysPassed >= 120) {
            updatedPkgs[pkgId] = false;
            delete updatedActivatedAt[pkgId];
            updated = true;
          }
        }
      }
    }

    if (updated) {
      const updateData = {
        active_packages: updatedPkgs,
        package_activated_at: updatedActivatedAt,
      };
      if (balanceAdd > 0) {
        updateData.balance = Number(user.balance) + balanceAdd;
      }
      await supabase.from('profiles').update(updateData).eq('id', user.id);
      processed++;
    }
  }

  return { success: true, processed };
}

// ============================================
// ADMIN STATS
// ============================================

export async function getAdminStats() {
  // 1. Total users
  const { count: totalUsers, error: usersErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  if (usersErr) throw new Error(usersErr.message);

  // 2. Total balance
  const { data: balanceData, error: balanceErr } = await supabase
    .from('profiles')
    .select('balance');
  if (balanceErr) throw new Error(balanceErr.message);
  const totalBalance = (balanceData || []).reduce((sum, p) => sum + Number(p.balance || 0), 0);

  // 3. Daily growth
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  const { count: dailyGrowth, error: growthErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo.toISOString());
  if (growthErr) throw new Error(growthErr.message);

  // 4. Pending claims
  const { count: pendingClaims, error: claimsErr } = await supabase
    .from('level_claims')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (claimsErr) throw new Error(claimsErr.message);

  // 5. Pending deposits
  const { count: pendingDeposits, error: depErr } = await supabase
    .from('deposits')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (depErr) throw new Error(depErr.message);

  // 6. Pending withdrawals
  const { count: pendingWithdrawals, error: wdErr } = await supabase
    .from('withdrawals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (wdErr) throw new Error(wdErr.message);

  // 7. Pending KYC
  const { count: pendingKYC, error: kycErr } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('kyc_status', 'pending');
  if (kycErr) throw new Error(kycErr.message);

  // 8. Recent users
  const { data: recentUsers, error: recentErr } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  if (recentErr) throw new Error(recentErr.message);

  return {
    totalUsers: totalUsers || 0,
    totalBalance,
    dailyGrowth: dailyGrowth || 0,
    pendingClaims: pendingClaims || 0,
    pendingDeposits: pendingDeposits || 0,
    pendingWithdrawals: pendingWithdrawals || 0,
    pendingKYC: pendingKYC || 0,
    recentUsers: recentUsers || [],
  };
}

// ============================================
// ADMIN LOGS
// ============================================

export async function getAdminLogs() {
  const { data, error } = await supabase
    .from('admin_logs')
    .select(`
      *,
      admin:profiles!admin_uid(display_login, email),
      target:profiles!target_uid(display_login, email)
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function addAdminLog(adminUid, action, targetUid, details) {
  const { error } = await supabase
    .from('admin_logs')
    .insert({
      admin_uid: adminUid,
      action,
      target_uid: targetUid,
      details,
    });

  if (error) console.error('Admin log failed: ', error.message);
  return { success: true };
}

// ============================================
// ADMIN PERMISSIONS MANAGEMENT
// ============================================

export async function updateAdminPermissions(uid, permissions) {
  const { error } = await supabase
    .from('profiles')
    .update({ admin_permissions: permissions })
    .eq('id', uid);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getAdmins() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// SYSTEM SETTINGS
// ============================================

export async function getSystemSetting(key) {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data?.value || null;
}

export async function updateSystemSetting(key, value) {
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw new Error(error.message);
  return { success: true };
}

