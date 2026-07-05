'use client';

import { useEffect, createContext } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { onAuthStateChange } from '@/lib/supabase/auth';
import { getUserByUid } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    setLoading(true);

    // Köhnəlmiş / etibarsız refresh token (server-side sessiya ləğvi, parol
    // sıfırlama və ya JWT rotasiyasından sonra) SDK-nı hər yükləmədə
    // "AuthApiError: Invalid Refresh Token" verməyə məcbur edir. Aşkarla və yerli
    // sessiyanı bir dəfə təmizlə ki, xəta təkrarlanmasın və istifadəçi təmiz
    // şəkildə login ekranına düşsün. (scope: 'local' server çağırışı etmir.)
    supabase.auth
      .getSession()
      .then(({ error }) => {
        if (error) {
          const msg = String(error.message || '').toLowerCase();
          if (msg.includes('refresh token') || msg.includes('jwt') || msg.includes('invalid')) {
            supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
        }
      })
      .catch(() => {});

    // Profili getir: trigger gecikmesine karşı kısa retry + self-healing RPC.
    const loadProfile = async (authUser) => {
      // Fetch user profile from Supabase Database
      let profile = await getUserByUid(authUser.id);

      // Retry once if profile is null (in case trigger is slightly delayed)
      if (!profile) {
        await new Promise((r) => setTimeout(r, 600));
        profile = await getUserByUid(authUser.id);
      }

      // If still null, call the self-healing RPC function to create it
      if (!profile) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_profile_if_missing');
          if (!rpcError && rpcData?.success) {
            profile = await getUserByUid(authUser.id);
          }
        } catch (rpcErr) {
          console.error('Self-healing profile creation failed:', rpcErr);
        }
      }

      return profile;
    };

    // Profil satırını store'a uygula (admin / normal / profil hâlâ yoksa minimal fallback).
    const applyProfile = (authUser, profile) => {
      if (profile) {
        // Admin gets a simplified profile — no balance, packages, points, KYC
        if (profile.role === 'admin') {
          setUser({
            uid: authUser.id,
            email: authUser.email,
            displayName: profile.full_name,
            fullName: profile.full_name,
            displayLogin: profile.display_login,
            userCode: profile.user_code,
            role: 'admin',
            permissions: profile.admin_permissions || {},
            country: profile.country || '',
            city: profile.city || '',
            phone: profile.phone || '',
            createdAt: profile.created_at,
          });
        } else {
          // Regular user — full profile
          // Check block status
          const isBlocked = profile.is_blocked;
          let blockActive = isBlocked;

          if (isBlocked && profile.blocked_until) {
            const blockEnd = new Date(profile.blocked_until);
            if (blockEnd <= new Date()) {
              blockActive = false;
            }
          }

          setUser({
            uid: authUser.id,
            email: authUser.email,
            displayName: profile.full_name,
            fullName: profile.full_name,
            displayLogin: profile.display_login,
            userCode: profile.user_code,
            balance: Number(profile.balance),
            totalPoints: Number(profile.total_points),
            currentLevel: Number(profile.current_level),
            referralCode: profile.referral_code,
            referredBy: profile.referred_by,
            activePackages: {
              pkg19: profile.active_packages?.pkg19 || false,
              pkg49: profile.active_packages?.pkg49 || false,
              pkg99: profile.active_packages?.pkg99 || false,
              pkg199: profile.active_packages?.pkg199 || false,
              pkg399: profile.active_packages?.pkg399 || false,
              pkg799: profile.active_packages?.pkg799 || false,
            },
            packageActivatedAt: profile.package_activated_at || {},
            claimedLevels: profile.claimed_levels || [],
            isBlocked: blockActive,
            blockReason: profile.block_reason || '',
            blockedUntil: profile.blocked_until,
            role: profile.role || 'user',
            country: profile.country || '',
            city: profile.city || '',
            phone: profile.phone || '',
            kycStatus: profile.kyc_status || 'none',
            kycDocumentType: profile.kyc_document_type,
            kycDocumentUrl: profile.kyc_document_url,
            kycSelfieUrl: profile.kyc_selfie_url,
            kycDocumentNumber: profile.kyc_document_number,
            identityNumber: profile.identity_number,
            createdAt: profile.created_at,
          });
        }
      } else {
        // Profil satırı self-heal denemesinden sonra da yok — minimal fallback.
        setUser({
          uid: authUser.id,
          email: authUser.email,
          displayName: authUser.email.split('@')[0],
          role: 'user',
        });
      }
    };

    const unsubscribe = onAuthStateChange(async (authUser, event) => {
      if (authUser) {
        const storeUser = useAuthStore.getState().user;
        const sameUserLoaded = !!(storeUser && storeUser.uid === authUser.id);

        // TOKEN_REFRESHED saatte bir / sekme fokusunda tetiklenir — gerçek profil
        // (userCode'lu) zaten yüklüyse gereksiz profiles okuması yapma.
        // SIGNED_IN, USER_UPDATED, INITIAL_SESSION veya profil yüklü değilse refetch.
        if (event === 'TOKEN_REFRESHED' && sameUserLoaded && storeUser.userCode) {
          setLoading(false);
          return;
        }

        try {
          applyProfile(authUser, await loadProfile(authUser));
        } catch (err) {
          // Geçici fetch/ağ hatası — canlı session'ı logout'a çevirme:
          // önceden yüklü kullanıcı varsa onu koru; hiç yoksa 1.5 sn sonra
          // bir kez daha dene, o da olmazsa pes et.
          console.error('Error loading user profile: ', err);
          if (!sameUserLoaded) {
            await new Promise((r) => setTimeout(r, 1500));
            try {
              applyProfile(authUser, await loadProfile(authUser));
            } catch (retryErr) {
              console.error('Profile retry failed: ', retryErr);
              setUser(null);
            }
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return <AuthContext.Provider value={null}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
