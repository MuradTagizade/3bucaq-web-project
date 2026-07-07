import { supabase } from './config';

// Ham Postgres/PostgREST (İngilizce) hatalarını UI'a sızdırma — kendi
// trigger/RPC mesajlarımız Azericedir, onları olduğu gibi geçir.
const friendlyError = (error) => {
  const msg = error?.message || '';
  if (/[çəğıöşü]|İcaz|icaz|Balans|kifay|tapilmadi|tapılmadı|bloklan/i.test(msg)) return msg;
  console.error('[db]', error);
  return 'Əməliyyat alınmadı. Bir az sonra yenidən cəhd edin.';
};

// ============================================
// USERS & PROFILES
// ============================================

export async function getUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(friendlyError(error));
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
    throw new Error(friendlyError(error));
  }
  return data;
}

// Güvenli lookup RPC'leri — profiles cross-user okunamaz (K2); kimlik artık user_code.
export async function verifyReferralCode(code) {
  if (!code) return { valid: false };
  const { data, error } = await supabase.rpc('check_referral_code', { p_code: code });
  if (error) throw new Error(friendlyError(error));
  return data || { valid: false };
}

// Transfer alıcısını user_code VƏ ya username ile doğrula (büyük/küçük harf duyarsız).
export async function lookupUserCode(code) {
  if (!code) return { exists: false };
  const { data, error } = await supabase.rpc('lookup_user_code', { p_code: code });
  if (error) throw new Error(friendlyError(error));
  return data || { exists: false };
}

// Qeydiyyatda istifadəçi adının müsaitliyini canlı yoxla (anon+auth RPC).
// { available: bool, reason?: 'empty'|'invalid'|'taken' } qaytarır.
export async function checkUsernameAvailable(username) {
  if (!username) return { available: false, reason: 'empty' };
  const { data, error } = await supabase.rpc('check_username_available', { p_username: username });
  if (error) throw new Error(friendlyError(error));
  return data || { available: false };
}

// Verilən user_code massivi üçün { user_code: username } xəritəsi
// (tarixçədə qarşı tərəfi ID + username ilə göstərmək üçün). RLS profiles-i
// bağladığından toplu definer RPC ilə həll olunur.
export async function usernamesForCodes(codes) {
  const list = [...new Set((codes || []).filter(Boolean))];
  if (list.length === 0) return {};
  const { data, error } = await supabase.rpc('usernames_for_codes', { p_codes: list });
  if (error) throw new Error(friendlyError(error));
  return data || {};
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

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

export async function unblockUser(uid) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_blocked: false, block_reason: '', blocked_until: null })
    .eq('id', uid);

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

export async function updateUserRole(uid, role) {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', uid);

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

export async function updateUserProfile(uid, data) {
  // email/display_login buradan çıkarıldı (Y2) — trigger da bunları engeller.
  const allowedFields = ['full_name', 'country', 'city', 'phone'];
  const updateData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', uid);

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

export async function updateUserBalance(uid, amount, type = 'admin_adjust') {
  const { data, error } = await supabase.rpc('admin_adjust_balance', {
    p_uid: uid,
    p_amount: Number(amount),
    p_type: type,
  });
  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) throw new Error(data.error || 'Balans yenilənmədi');
  return { success: true };
}

export async function updateUserPoints(uid, points) {
  const { data, error } = await supabase.rpc('admin_adjust_points', {
    p_uid: uid,
    p_points: Number(points),
  });
  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) throw new Error(data.error || 'Xal yenilənmədi');
  return { success: true };
}

// ============================================
// TRANSACTIONS
// ============================================

export async function getTransactions(uid) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (uid) {
    query = query.or(`from_uid.eq.${uid},to_uid.eq.${uid}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data || [];
}

export async function transferFunds(fromUid, toCode, amount) {
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Məbləğ düzgün deyil');
  }

  const sender = await getUserByUid(fromUid);
  if (!sender) throw new Error('Göndərən istifadəçi tapılmadı');
  if (sender.role !== 'admin' && sender.kyc_status !== 'approved') {
    throw new Error('Köçürmə etmək üçün KYC doğrulaması tələb olunur.');
  }

  const { data, error } = await supabase.rpc('transfer_funds', {
    to_code: toCode,
    amount: parsedAmount,
  });

  if (error) throw new Error(friendlyError(error));
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

  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) {
    throw new Error(data.error || 'Paket alınması baş tutmadı');
  }

  return { success: true };
}

// ============================================
// REFERRALS (5-line tree)
// ============================================

export async function getReferrals(uid) {
  const tree = await getReferralTree(uid, 1);
  return tree[1] || [];
}

/**
 * Get referral tree up to 5 levels deep — kendi downline'ı (K2 RPC).
 */
export async function getReferralTree(uid, maxDepth = 5) {
  const { data, error } = await supabase.rpc('get_my_referral_tree', { max_depth: maxDepth });
  if (error) throw new Error(friendlyError(error));

  const tree = {};
  for (const row of data || []) {
    const line = row.line;
    if (!tree[line]) tree[line] = [];
    tree[line].push(row);
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
    .order('created_at', { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data || [];
}

export async function getUserClaimedLevels(uid) {
  if (!uid) return [];
  const { data, error } = await supabase
    .from('level_claims')
    .select('level, status')
    .eq('uid', uid)
    .in('status', ['pending', 'done']);

  if (error) throw new Error(friendlyError(error));
  return (data || []).map((c) => c.level);
}

export async function createLevelClaim(uid, level, bonusAmount, claimType, usdtAddress, network) {
  const { data, error } = await supabase.rpc('create_level_claim', {
    claim_level: Number(level),
  });

  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) {
    throw new Error(data.error || 'Səviyyə bonusu tələbi baş tutmadı');
  }

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
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(friendlyError(error));
  return data || [];
}

// ============================================
// DEPOSITS
// ============================================

export async function getDeposits(uid) {
  let query = supabase
    .from('deposits')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (uid) {
    query = query.eq('uid', uid);
  }

  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data || [];
}

export async function createDeposit(uid, amount, txHash, network = 'TRC20', paymentMethod = 'usdt', cardNumber = null, receiptUrl = null) {
  const user = await getUserByUid(uid);
  if (!user) throw new Error('İstifadəçi tapılmadı');

  const { error } = await supabase.from('deposits').insert({
    uid,
    login: user.user_code,
    amount: Number(amount),
    tx_hash: txHash || null,
    network: network || null,
    payment_method: paymentMethod,
    card_number: cardNumber,
    receipt_url: receiptUrl,
    status: 'pending',
  });

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

export async function approveDeposit(depositId, adminUid) {
  const { data, error } = await supabase.rpc('admin_approve_deposit', {
    p_deposit_id: depositId,
  });
  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) throw new Error(data.error || 'Depozit təsdiqlənmədi');
  return { success: true };
}

export async function rejectDeposit(depositId) {
  const { data, error } = await supabase.rpc('admin_reject_deposit', {
    p_deposit_id: depositId,
  });
  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) throw new Error(data.error || 'Depozit rədd edilmədi');
  return { success: true };
}

// ============================================
// WITHDRAWALS
// ============================================

export async function getWithdrawals(uid) {
  let query = supabase
    .from('withdrawals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (uid) {
    query = query.eq('uid', uid);
  }

  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error));
  return data || [];
}

export async function createWithdrawal(uid, amount, cryptoAddress, network = 'TRC20', paymentMethod = 'usdt', cardNumber = null) {
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Məbləğ müsbət olmalıdır');
  }

  const user = await getUserByUid(uid);
  if (!user) throw new Error('İstifadəçi tapılmadı');
  if (user.role !== 'admin' && user.kyc_status !== 'approved') {
    throw new Error('Çıxarış etmək üçün KYC doğrulaması tələb olunur.');
  }

  const { data, error } = await supabase.rpc('create_withdrawal', {
    amount: parsedAmount,
    crypto_address: cryptoAddress || null,
    network: network || null,
    payment_method: paymentMethod,
    card_number: cardNumber || null,
  });

  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) {
    throw new Error(data.error || 'Məxaric tələbi baş tutmadı');
  }

  return { success: true };
}

export async function approveWithdrawal(withdrawalId, txHash, adminUid, receiptUrl = null) {
  const { data, error } = await supabase.rpc('admin_approve_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_tx_hash: txHash || null,
    p_receipt_url: receiptUrl,
  });
  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) throw new Error(data.error || 'Çıxarış təsdiqlənmədi');
  return { success: true };
}

export async function rejectWithdrawal(withdrawalId) {
  const { data, error } = await supabase.rpc('admin_reject_withdrawal', {
    p_withdrawal_id: withdrawalId,
  });
  if (error) throw new Error(friendlyError(error));
  if (data && data.success === false) throw new Error(data.error || 'Çıxarış rədd edilmədi');
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

  if (error) throw new Error(friendlyError(error));
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

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

export async function checkIdentityNumberExists(uid, num) {
  if (!num) return false;
  // Parametreli RPC (enjeksiyon O4 giderildi; profiles cross-user okunmaz).
  const { data, error } = await supabase.rpc('check_identity_exists', { p_num: num });
  if (error) {
    console.error('Error checking identity number:', error.message);
    return false;
  }
  return !!data;
}

// ============================================
// DAILY EARNINGS / PACKAGE EXPIRY
// Bu işler artık güvenli service_role RPC'leri ile yapılır:
//   run_daily_maintenance() -> process_package_expiry() + process_daily_earnings()
// Supabase pg_cron veya Edge Function ile GÜNLÜK çağırın. Client'tan çağrılmaz.
// (Eski client versiyonları ölü + güvensizdi + kaldırılmış transfer_balance'a yazıyordu.)
// ============================================

// ============================================
// ADMIN STATS
// ============================================

export async function getAdminStats() {
  // 8 ayrı sorgu yerine tek RPC — tüm istatistikler DB tarafında hesaplanır.
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new Error(friendlyError(error));
  if (!data || data.success === false) {
    throw new Error(data?.error || 'Statistika yüklənmədi');
  }

  return {
    totalUsers: Number(data.totalUsers || 0),
    totalBalance: Number(data.totalBalance || 0),
    dailyGrowth: Number(data.dailyGrowth || 0),
    pendingClaims: Number(data.pendingClaims || 0),
    pendingDeposits: Number(data.pendingDeposits || 0),
    pendingWithdrawals: Number(data.pendingWithdrawals || 0),
    pendingKYC: Number(data.pendingKYC || 0),
    recentUsers: data.recentUsers || [],
  };
}

export async function getAdminChartData(range = '30d') {
  const { data, error } = await supabase.rpc('get_admin_chart_data', { p_range: range });
  if (error) throw new Error(friendlyError(error));
  if (!data || data.error) throw new Error(data?.error || 'Qrafik dataları yüklənmədi');
  return data;
}

export async function getMyFinanceStats() {
  const { data, error } = await supabase.rpc('get_my_finance_stats');
  if (error) throw new Error(friendlyError(error));
  if (!data || data.error) throw new Error(data?.error || 'Statistika yüklənmədi');
  return {
    net: Number(data.net || 0),
    incoming: Number(data.incoming || 0),
    outgoing: Number(data.outgoing || 0),
    pending: Number(data.pending || 0),
  };
}

export async function getMyTransfers(uid, limit = 20) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'transfer')
    .or(`from_uid.eq.${uid},to_uid.eq.${uid}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(friendlyError(error));
  return data || [];
}

export async function getTreasury() {
  const { data, error } = await supabase.rpc('get_treasury');
  if (error) throw new Error(friendlyError(error));
  if (!data || data.error) throw new Error(data?.error || 'Xəzinə məlumatı yüklənmədi');
  return data;
}

export async function getReferralStats(range = '30d') {
  const { data, error } = await supabase.rpc('get_referral_stats', { p_range: range });
  if (error) throw new Error(friendlyError(error));
  if (!data || data.error) throw new Error(data?.error || 'Statistika yüklənmədi');
  return data;
}

export async function getUserActivity(limit = 300, search = null, action = null) {
  const { data, error } = await supabase.rpc('get_user_activity', {
    p_limit: limit,
    p_search: search || null,
    p_action: action || null,
  });
  if (error) throw new Error(friendlyError(error));
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
  return Array.isArray(data) ? data : [];
}

// ============================================
// ADMIN LOGS
// ============================================

export async function getAdminLogs() {
  const { data, error } = await supabase
    .from('admin_logs')
    .select(`
      *,
      admin:profiles!admin_uid(display_login, user_code, email),
      target:profiles!target_uid(display_login, user_code, email)
    `)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw new Error(friendlyError(error));
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

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

export async function getAdmins() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  if (error) throw new Error(friendlyError(error));
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
    throw new Error(friendlyError(error));
  }
  return data?.value || null;
}

// Birden çok ayarı TEK sorguda getir — { key: value } haritası döner
// (olmayan key haritada yer almaz).
export async function getSystemSettings(keys) {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', keys);

  if (error) throw new Error(friendlyError(error));

  const map = {};
  for (const row of data || []) {
    map[row.key] = row.value;
  }
  return map;
}

export async function updateSystemSetting(key, value) {
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw new Error(friendlyError(error));
  return { success: true };
}

