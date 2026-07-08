# LEVEL UP (3bucaq) — Claude Talimatları

## Bağlam
- İşe başlamadan önce `compact.md`'yi oku — iş kuralları, DB şeması ve geçmiş kararlar orada. En güncel bölüm en alttadır; eski bölümlerle çelişirse YENİ olan geçerlidir.
- Stack: Next.js 16 (dev: `npm run dev` → webpack modu), React 19, Supabase (Postgres + Auth + Storage), Zustand, vanilla CSS / CSS Modules.
- Deploy: Vercel — `main`'e push otomatik production deploy'dur. Push etmeden önce kullanıcıya sor.

## Güvenlik Kuralları (ZORUNLU)
1. Secret'lar SADECE `.env`'de. Koda, dokümana, commit'e asla secret/şifre yazma. `SUPABASE_SERVICE_ROLE_KEY` yalnızca server tarafında (API route) kullanılır — asla `NEXT_PUBLIC_` öneki verme, asla client koduna taşıma.
2. Para/puan/paket/rol/level değiştiren HER işlem SECURITY DEFINER RPC üzerinden yapılır (`transfer_funds`, `buy_package`, `create_withdrawal`, `create_level_claim`...). Client'tan `profiles`'ın korumalı sütunlarına doğrudan UPDATE yazma; `check_profile_updates` trigger'ını (INVOKER + whitelist) ve RLS politikalarını GEVŞETME.
3. SQL migration zinciri sıralıdır ve `sql/` klasöründedir: `sql/schema.sql` (yalnız tablolar) → `sql/security_remediation.sql` → `_2_rpcs.sql` → `_3.sql` → ... → `_19.sql` (en güncel). Yeni migration dosyalarını da `sql/` içine ekle. `schema.sql`'deki superseded fonksiyon/policy tanımlarını yeniden uygulama. (Eski security_patch.sql, dual_balance_migration.sql, remove_transfer_balance.sql, fix_referral_and_packages.sql silindi — gerekirse git geçmişinde.)
   - Part 6'dan beri fonksiyonlarda PUBLIC execute YOK (whitelist grant modeli): yeni fonksiyon/RPC eklerken `grant execute ... to authenticated` (veya anon/service_role) AÇIKÇA yaz; RLS policy'lerinde `(select auth.uid())` / `(select public.is_admin())` sarmalamasını kullan (initplan).
4. Girdileri server/DB tarafında doğrula; ham DB hatasını client'a gösterme; dosya yüklemeleri private bucket + signed URL (`kyc-documents`).
5. Test hesapları `TEST_HESABLAR.local.md`'de (gitignore'lu) — dokümanlara credential yazma.

## Diğer
- Kimlik = `user_code` (6 karakterlik kod); login YALNIZCA email ile (`display_login` artık kimlik değil). Ayrıca `profiles.username` var (kayıtta kullanıcı seçer, yalnız harf 5-20, case-insensitive unique, kayıttan sonra kullanıcı DEĞİŞTİREMEZ); transfer hem `user_code` hem `username` ile çalışır (bkz. compact §23). Telefon UI'dan kaldırıldı (DB sütunu duruyor).
- Kullanıcıyla Azerice/Türkçe konuş; commit mesajları da öyle.
- Token tasarrufu: `node_modules`, `.next`, `package-lock.json` vb. okuma — `.claude/settings.json`'daki deny kuralları zaten engeller.
