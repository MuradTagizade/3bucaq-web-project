# 3bucaq — Layihə Konteksti (Compact Context)

Bu sənəd "3bucaq" layihəsinin əsas biznes məntiqini, texnologiya yığınını, verilənlər bazası strukturunu və memarlığını əks etdirir. Yeni sessiyada işə başlayarkən bu faylı oxuyaraq bütün konteksti dərhal anlaya bilərsiniz.

---

## 1. Layihənin Məqsədi və Biznes Məntiqi (MLM & Yatırım)
"3bucaq" istifadəçilərin paketlər alaraq və referallar cəlb edərək qazanc əldə etdiyi çoxsəviyyəli marketinq (MLM) və investisiya platformasıdır.

### 1.1 Qazanc və Referal Sistemi
*   **1-ci Xətt (Direct Referral):** Birbaşa referalın yatırımından dərhal **10%** balans yüklənir.
*   **Dərinlik Bonusu (2-ci xətdən 5-ci xəttə qədər):** Alt referalların hər bir yatırımından **1%** dərhal balansa yüklənir.
*   **Aktivlik Şərti:** İstifadəçinin qazanc əldə edə bilməsi üçün minimum 1 aktiv yatırımı (paketi) olmalıdır.

### 1.2 "Hot Bed" Paketləri (İstixanalar)
*   **Yatırım Paketləri (Gündəlik qazanc vermir, xal/point qazandırır):**
    *   `#19` ($19) -> 0.6 point
    *   `#49` ($49) -> 1.5 point
    *   `#99` ($99) -> 3.0 point
    *   `#199` ($199) -> 6.0 point
*   **Gündəlik Qazanc Paketləri (Həm point, həm gündəlik dollar qazandırır):**
    *   `#399` ($399) -> Gündəlik $3.3 qazanc + 12 point (Transfer balansına toplanır).
    *   `#799` ($799) -> Gündəlik $6.5 qazanc + 24 point (Transfer balansına toplanır).

### 1.3 Point (Xal) və Səviyyə (Level) Sistemi
Referallardan yığılan xallar müəyyən həddə çatdıqda istifadəçi Level yüksəlir və Coinbase Wallet-ə çıxarıla bilən **USDT** bonusu qazanır:
*   **LVL 1:** 30 point -> 99 USDT bonus (Şərt yoxdur)
*   **LVL 2:** 109 point -> 299 USDT bonus (Şərt: `#19` və `#49` paketləri ON olmalıdır)
*   **LVL 3:** 268 point -> 499 USDT bonus (Şərt: `#19` və `#49` paketləri ON olmalıdır)
*   ... (5-ci xəttə qədər toplanır, ətraflı şərtlər `Layihə_Sənədi.md` daxilindədir).

---

## 2. Texnologiya Yığını (Tech Stack)
*   **Frontend:** React 19, Next.js 16 (Webpack rejimi, Turbopack qovluq adındakı boşluq simvolu ilə bağlı xəta verdiyi üçün dev rejimdə `--webpack` ilə işləyir).
*   **Styling:** Vanilla CSS & CSS Modules.
*   **Baza & Auth:** Supabase (PostgreSQL) — Firebase tamamilə layihədən təmizlənmişdir.
*   **Dövlət İdarəetməsi (State):** Zustand.

---

## 3. Verilənlər Bazası Sxemi (Supabase / PostgreSQL)

### 3.1 Cədvəllər
*   **`profiles` cədvəli:**
    *   `id` (uuid, primary key -> auth.users)
    *   `email` (text), `display_login` (text unique), `full_name` (text)
    *   `balance` (numeric), `transfer_balance` (numeric), `total_points` (numeric)
    *   `current_level` (integer)
    *   `referral_code` (text unique)
    *   `referred_by` (uuid -> profiles.id)
    *   `active_packages` (jsonb -> `{pkg19: boolean, ...}`)
    *   `is_blocked` (boolean), `block_reason` (text)
    *   `role` (text -> 'user' / 'admin')
    *   `created_at` (timestamp)
*   **`transactions` cədvəli:** `id` (uuid), `type` (text), `from_uid` (uuid), `from_login` (text), `to_uid` (uuid), `to_login` (text), `amount` (numeric), `created_at` (timestamp).
*   **`level_claims` cədvəli:** `id` (uuid), `uid` (uuid), `login` (text), `level` (int), `bonus_amount` (numeric), `usdt_address` (text), `status` (text -> 'pending', 'done', 'rejected'), `tx_hash` (text), `created_at` (timestamp), `approved_at` (timestamp).
*   **`admin_logs` cədvəli:** `id` (uuid), `admin_uid` (uuid), `action` (text), `target_uid` (uuid), `details` (text), `created_at` (timestamp).

### 3.2 Avtomatik Profil Yaradılması (Trigger)
Supabase Auth-da yeni istifadəçi yarananda avtomatik `profiles` cədvəlinə məlumat yazılması üçün yazılmış trigger:
```sql
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text;
begin
  ref_code := 'REF' || lpad(floor(random() * 10000)::text, 4, '0');
  insert into public.profiles (id, email, display_login, full_name, role, referral_code)
  values (new.id, new.email, split_part(new.email, '@', 1), coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'user', ref_code);
  return new;
end;
$$ language plpgsql;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 4. Memarlıq və Əsas Fayllar
*   **Konfiqurasiya:** [config.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/lib/supabase/config.js) (Supabase client-i yaradır).
*   **Auth Helper:** [auth.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/lib/supabase/auth.js) (`loginUser`, `registerUser`, `logoutUser`).
*   **Baza Helper:** [database.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/lib/supabase/database.js) (bütün SQL/cədvəl oxuma-yazma məntiqləri).
*   **Global Provider:** [AuthProvider.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/components/providers/AuthProvider.js) (Supabase auth-u dinləyir və profil məlumatlarını Zustand store-a yazır).
*   **Responziv layout shell:** [layout.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/app/dashboard/layout.js) (masaüstündə [Sidebar.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/components/layout/Sidebar.js) və geniş kontent, mobil telefonda isə mobile Header/FooterNav göstərir).

---

## 5. Lokal İşə Salınma
1.  **Ətraf mühit nizamlaması:** `.env` faylında Supabase URL və Anon Key dəyişənləri qurulur.
2.  **Serveri başlatmaq:** `npm run dev` (bu skript Webpack rejimi ilə `next dev --webpack` icra edir).

### 5.1 Test Hesabları (Supabase Auth)
Test hesablarının giriş məlumatları TƏHLÜKƏSİZLİK səbəbi ilə artıq repo-da saxlanılmır:
*   Hesab siyahısı və şifrələr lokal, git-ə düşməyən **`TEST_HESABLAR.local.md`** faylındadır (`.gitignore` → `*.local.md`).
*   ⚠️ **KRİTİK:** köhnə şifrələr bu faylın git TARİXÇƏSİNDƏ qalıb və GitHub-a push edilib — `admin@levelup.com`, `mockadmin@levelup.com`, `user@levelup.com`, `testmock@levelup.com` hesablarının şifrələri production Supabase-də MÜTLƏQ dəyişdirilməlidir.
*   Qeyd: §12.3-ə əsasən giriş artıq YALNIZ email ilədir (username ilə giriş ləğv edilib).

---

## 6. Bu Sessiyada Görülən Əsas Təkmilləşdirmələr
*   **Admin Panel Mobil Uyğunlaşdırılması (Mobile Layout):** Sol menu (Sidebar) mobil cihazlarda gizlədildi. Əvəzində yuxarıda yapışqan başlıq (Logo + Panelə Qayıt düyməsi) və aşağıda 4 bölmənin (Dashboard, İstifadəçilər, Claims, Loglar) ikonlu alt menyusu yerləşdirildi. Cədvəllər (`.table`) mobil ekranlarda daşmaması üçün horizontal sürüşdürmə (`overflow-x: auto`) xüsusiyyətinə gətirildi.
*   **Real Data İnteqrasiyası (Demo Təmizlənməsi):**
    *   Forgot Password səhifəsi real Supabase `resetPassword(email)` metoduna qoşuldu.
    *   Verify (OTP) səhifəsi real `supabase.auth.verifyOtp` və `supabase.auth.resend` metodları ilə işlək vəziyyətə gətirildi və `Suspense` boundary-yə salındı.
    *   Qeydiyyatdan (Register) sonra istifadəçi email ünvanı avtomatik Verify səhifəsinə ötürülür.
    *   Admin Dashboard-dakı demo STATS və RECENT_USERS silinərək Supabase-dən real datanı çəkən `getAdminStats()` bazaya qoşulma helper-i yazıldı və tətbiq edildi.
*   **Hot Bed Paketlərində Point Güncəllənməsi:** `#399` paketi üçün **12 point**, `#799` paketi üçün isə **24 point** qiymətləndirilməsi constants və sənədlərdə təyin edilərək tətbiq olundu.
*   **Verilənlər Bazası Sxemi Skripti (`schema.sql`):** Supabase tərəfdə cədvəllərin (profiles, transactions, level_claims, admin_logs), triggerlərin, is_admin köməkçi funksiyasının və infinite recursion-dan qorunan RLS qaydalarının asanlıqla qurulması üçün layihənin kök qovluğunda [schema.sql](file:///Users/manis85/Documents/3bucaq-web%20project/schema.sql) faylı tərtib olundu.
*   **Lokal Server Xətasının Həlli:** Next.js Turbopack-in qovluq adındakı boşluq simvolundan (`3bucaq-web project`) qaynaqlanan xətası `package.json` faylındakı `dev` skripti Webpack (`next dev --webpack`) rejiminə keçirilməklə həll edildi.
*   **Hydration (Server-Client Mismatch) Həlli:** `formatUSDT` funksiyasında `toLocaleString('en-US')` təyin edilərək server və brauzer lokal render fərqləri (nöqtə/vergül) aradan qaldırıldı.
*   **404 İkonlar:** `manifest.json` üçün axtarılan, lakin layihədə olmayan PWA app ikonları generasiya edilərək `public/icons/` qovluğuna yerləşdirildi.
*   **Firebase Təmizlənməsi:** Firebase-ə aid bütün cədvəl rules, configurations, dependency və cloud functions layihədən tamamilə silindi.
*   **Dark/Light Mövzu Təkmilləşdirməsi:** Zustand store (`themeStore.js`), `localStorage` və FOUC (mövzu yanıb-sönməsi) qarşısını alan head script ilə qaranlıq və aydın mövzular arasında keçid tətbiq edildi. İki rejim dəstəklənir və bütün tətbiqdə CSS dəyişənləri vasitəsilə keçirilir.
*   **Referallar Səhifəsinin Yenidən Dizaynı:** Şəkildəki premium dizayna uyğun olaraq yenidən yığıldı: 3 ədəd yuxarı stat kartı (Ümumi Dəvətlər, Aktiv Referallar, Referal Bonusu), 5 Səviyyəli Aktiv Referal progress bar diaqramı, QR kodlu və Kopyala/Paylaş düyməli Referal Link kartı, həmçinin səviyyə üzrə filtrləmə imkanı olan genişləndirilmiş referal cədvəli (mobil üçün kart, masaüstü üçün sətir formatlı) tətbiq olundu.
*   **Xal Tarixçəsi Səhifəsinin Yenidən Dizaynı:** Cari aya və dünənə aid qazanılmış xalları dinamik hesablayan stat kartı yerləşdirildi. Login, xətt və paket üzrə filtrləmə/axtarış, responsive premium cədvəl, xüsusi rəngli paket badge-ləri və dinamik footer səhifələməsi əlavə olundu.
*   **USDT Tarixçəsi Səhifəsinin Yenidən Dizaynı:** `transactions`, `deposits` və `withdrawals` cədvəllərinin məlumatları birləşdirilərək dinamik Ümumi Mədaxil, Ümumi Məxaric, Gözləmədə və Net Balans kartları yaradıldı. Növ və təqvim filtrləri, iki sətirli tarix-saat düzümü, status nöqtələri (`Completed`, `Pending`, `Rejected`) və rəqəmsal səhifələmə quruldu.
*   **Şəxsi Məlumatlar Səhifəsinin Yenidən Dizaynı:** Ad-soyad, ölkə və şəhəri redaktə edib birbaşa bazada (`updateUserProfile`) və Zustand store-da yeniləyən forma düzəldildi. Email və telefon üçün maskalama (`elvin.m*****@mail.com`), Lock ikonları, arxa planda yer kürəsi SVG dekoru, dynamic KYC status emblem kartı (sənəd növü, təsdiq tarixi və aşağı risk dərəcəsi ilə) və Cari Paketi göstərən dinamik widget əlavə olundu.
*   **Admin KYC Təsdiqləmə Səhifəsi (Yeni):** Adminlər üçün dedicated `/admin/kyc` marşrutu və səhifəsi yaradıldı. Gözləyən, təsdiqlənən (uğur faizi ilə) və rədd edilən KYC sorğularının stat kartları, axtarış/sıralama barı və müraciət kartları grid-i quruldu. Sənəd və selfi şəkillərinin klikləndikdə açılan blur arxa planlı zoom modalları, Təsdiqlə/Rədd et (səbəb pəncərəsi ilə) funksiyaları və rədd edilmiş kartlar üçün admin loglarından reject səbəbini çəkən xəbərdarlıq bannerləri əlavə olundu.
*   **Sub-Admin (Alt-Admin) Səlahiyyətləndirmə və İdarəetmə Paneli (Yeni):** `profiles` cədvəlinə fərdi admin səlahiyyətlərini idarə edən `admin_permissions` JSONB sütunu daxil edildi. Sol menyu naviqasiyası və bütün marşrutlar səlahiyyət yoxlanışına (`hasPermission`) salınaraq qorundu. Superadminlərin digər adminlərin icazələrini təyin edə biləcəyi, yeni alt-admin təyin edə biləcəyi və ya adminlikdən çıxara biləcəyi dedicated `/admin/admins` idarəetmə paneli yaradıldı.
*   **USDT Tarixçəsində Azərbaycan Dili Tərcümələri:** `/dashboard/history` marşrutundakı bütün əməliyyat növləri (Deposit, Withdrawal, Internal Transfer və s.) və əməliyyat statusları (Completed, Pending, Rejected) tam olaraq Azərbaycan dilinə (Depozit, Çıxarış, Daxili Köçürmə, Gözləyir, Rədd edilib və s.) tərcümə edildi.
*   **Xal Tarixçəsinə "Bugün" və "Bu Həftə" Statistikaları:** `/dashboard/points-history` marşrutunda mövcud "Bu Ay" və "Dünən" kartlarına əlavə olaraq cari gün və cari həftə üzrə xalları dinamik toplayan "Bugün" və "Bu Həftə" kartları yerləşdirildi və mobil responsive dizaynı (2x2 grid) təmin olundu.
*   **Manuel Bank Kartı Mədaxil və Məxarici Sistemi:**
    *   İstifadəçilərin bank kartı ilə depozit edərkən 16 rəqəmli kart nömrəsini daxil etməsi, ödənişin qəbzi şəklini Supabase Storage-a (`kyc-documents` bucket) yükləməsi, həmçinin bank kartı ilə çıxarış zamanı öz kart nömrələrini daxil edə bilməsi təmin olundu.
    *   Adminin çıxarışı təsdiqləyərkən bank çıxarışı (ekstrası) şəklini yükləməsi və bunun istifadəçiyə göstərilməsi tətbiq edildi.
*   **Kart Ödəniş Sisteminin İdarə Edilməsi (Toggle & Admin Card Configuration):**
    *   Verilənlər bazasında `system_settings` cədvəlinə `card_payment_active` ayarı əlavə edildi (susmaya görə `false`).
    *   Admin paneldə (`/admin/deposits`) **"Kart ilə Ödəniş Sistemi (Aktiv/Deaktiv Et)"** idarəetmə düyməsi yerləşdirildi. Düymə vasitəsilə admin kart ödənişlərini aktivləşdirə və ya söndürə bilər.
    *   İstifadəçi tərəfdə (`deposit` və `transfer` səhifələrində) bu ayar yoxlanılır; əgər deaktivdirsə, "Bank Kartı" tabı tamamilə gizlədilir.
    *   Admin eyni zamanda sistem üzrə mədaxil üçün nəzərdə tutulan admin kart nömrəsini dinamik olaraq redaktə edib yadda saxlaya bilər.
*   **KYC Ön/Arxa Sənəd və Selfie İnteqrasiyası:**
    *   İstifadəçinin KYC göndərərkən sənədin ön üzü, sənədin arxa üzü və selfi şəklini daxil etməsi üçün 3 fərqli fayl yükləmə sahəsi əlavə edildi.
    *   Admin tərəfdən bu 3 şəkilin yoxlanılması və modal vasitəsilə böyüdülməsi təmin olundu.
*   **Referral Səhifəsi Xallar Birləşdirilməsi və Səviyyə Adlarının Dəyişdirilməsi:**
    *   Xal tarixçəsi (Points History) tam olaraq referallar səhifəsinə (`/dashboard/subscribers`) tab keçidi ilə birləşdirildi.
    *   Səhifənin yuxarı hissəsinə **"Toplam Xallar"** (Purple Star Icon) stat kartı yerləşdirildi və masaüstü üçün 4 sütunlu düzüm yaradıldı.
    *   Cədvəldə, diaqramda və detallar modalında "Səviyyə" sözləri **"Referal Xətti"** / **"Referat Xətti"** (Xətt 1-5) olaraq dəyişdirildi.
*   **Layihənin Təhlükəsizliyinin Gücləndirilməsi (Security Hardening):**
    *   İstifadəçi balansına, paket aktivliyinə və məxaric tələbinə birbaşa brauzerdən edilən təsir imkanları tamamilə ləğv edildi. Bütün bu yazma əməliyyatları verilənlər bazasında təhlükəsiz funksiyalar (RPC) səviyyəsinə köçürüldü (`transfer_funds`, `buy_package`, `create_level_claim`, `create_withdrawal`).
    *   İstifadəçilərin brauzer üzərindən maliyyə və icazə sütunlarını (`balance`, `total_points`, `active_packages`, `role` və s.) birbaşa dəyişməsini əngəlləyən baza səviyyəsində `tr_check_profile_updates` triggeri yaradıldı (yalnız adminlərə və daxili serverə icazə verilir).
    *   Bazadakı bütün 8 cədvəldə (`profiles`, `transactions`, `points_history`, `level_claims`, `deposits`, `withdrawals`, `system_settings`, `admin_logs`) **Row Level Security (RLS)** siyasətləri və icazə qaydaları aktivləşdirilərək bazanın tam qorunması təmin olundu.
    *   [security_patch.sql](file:///Users/manis85/Documents/3bucaq-web%20project/security_patch.sql) faylı bu tənzimləmələrin remote bazaya tətbiq edilməsi üçün hazırlandı.
*   **Şəxsi Məlumatlar Təmizləməsi və E-poçt OTP Doğrulaması:**
    *   `/dashboard/personal-info` səhifəsindəki lazımsız "Çıxış" düyməsi, handlerləri və importları təmizləndi (artıq ümumi menyudan idarə olunur).
    *   E-poçt ünvanı dəyişdirilə bilən edildi. Təhlükəsizliyi təmin etmək üçün, e-poçt dəyişən zaman yeni ünvana 6 rəqəmli doğrulama kodu (OTP) göndərilməsi və yalnız kod pəncərədə təsdiqləndikdən sonra email-in bazada dəyişdirilməsi axını (`supabase.auth.updateUser` və `verifyOtp` ilə `type: 'email_change'`) tətbiq olundu.
*   **Hərtərəfli İkidilli (i18n) Dəstək və Tərcümə Sistemi (Yeni):**
    *   Bütün tətbiq (giriş, qeydiyyat, şifrə sıfırlama, istifadəçi paneli, idarəetmə alt səhifələri və admin panelləri) ikidilli (Azərbaycan və İngilis dillərində) tam tərcümə edildi.
    *   [languageStore.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/lib/store/languageStore.js) və [formatters.js](file:///Users/manis85/Documents/3bucaq-web%20project/src/lib/utils/formatters.js) fayllarındakı `t()` və `getTranslation()` funksiyaları təkmilləşdirilərək dot-notation (nöqtə ilə ayrılmış nested obyekt açarları, məsələn `doc_types.passport`, `time_ago.now`) dəstəyi əlavə olundu. Bu sayədə əvvəllər tərcümə olunmayan bütün sənəd növləri və vaxt-tarix sözləri dil dəyişəndə brauzerdə dərhal İngilis dilinə çevrilir.
    *   Landing (ana təqdimat) səhifəsinin (`src/app/page.js`) bütün mətnləri i18n sisteminə köçürüldü, yuxarı sağ küncdə premium görünüşlü dil və mövzu tənzimləmə düymələri (`LanguageToggle` və `ThemeToggle`) yerləşdirildi.
    *   Admin logları (`/admin/logs`) və admin heyəti (`/admin/admins`) səhifələri tam tərcümə edildi, log filtrləri və modal məlumatları aktiv dilə uyğunlaşdırıldı.
    *   `hotbed/page.js` faylına server/client component Turbopack build xətasının qarşısını almaq üçün `"use client";` əlavə edildi.
*   **"Ultra Protocol" Apple Glassmorphism + Digital Neon Dizayn Sistemi:** Bütün idarəetmə panelinin (`dashboard`, `deposit`, `transfer`, `history`, `hotbed`, `subscribers`) görünüşü yeniləndi. Koyu fonda laser-border parıltıları və yarım-şəffaf buzlu cam effekti birləşdirildi.
*   **CSS Sınıfı Eşləşməsi və Sinxronizasiyası:** Layihədəki mühüm UI hissələrində (`Sidebar.js`, `Header.js`, `FooterNav.js`, `SlideUpMenu.js`, `Input.js`, `Modal.js`, `Toggle.js`, `Spinner.js`) olan Next.js CSS Modul sinif uyuşmazlıqları müvafiq `.module.css` fayllarının yenidən yazılması ilə aradan qaldırıldı; arayüzdəki stilsiz düz mətndən qaynaqlanan bütün vizual qüsurlar tamamilə düzəldildi.
*   **Mobil və Masaüstü Layout Tənzimləmələri (Responsiveness):** 
    *   Masaüstündə (`min-width: 769px`) sabit sol Sidebar-ın kontent sahəsinin üstünə minməsini əngəlləmək üçün `.app-content-wrapper` sinfinə `margin-left` əlavə edildi.
    *   Ana səhifədəki xal statistika kartları (`Toplam Xallar` / `Aktiv Paketlər`), bakiye sahələri (`Əsas Balans` / `Transfer Balansı`) və referal kodu sətiri mobil cihazlarda da şaquli yığılmaq (stack) əvəzinə masaüstü kimi yan-yana (2 sütunlu grid) dizayn edildi.
*   **Aydınlıq Rejiminin Təkmilləşdirilməsi:**
    *   Aydınlıq rejimində (Light Mode) ağ fon üzərində oxunmayan parlaq neon rənglər kontrastlığı yüksək olan zümrüd yaşılı (`#008F5A`) və göy-sian tona keçirildi. Arxa plan tam ağ əvəzinə Apple dizaynlarına uyğun platin-boz (`#F0F2F6`) tona çəkildi.

---

## 7. Son Sessiyada Görülən Təkmilləşdirmələr (Buzlu Şüşə & Animasiyalar)
*   **Animasiyalı OTP Giriş Komponenti (Yeni):** Təmiz JavaScript, CSS Modulu və Framer Motion ilə hazırlanan `be-ui-otp-input` komponenti yaradıldı və `/verify` (e-poçt doğrulama) səhifəsinə qoşuldu. Kod daxil edildikdə avtomatik təsdiqləmə (auto-submit), xətalarda silkələnmə (shake) və uğurlu doğrulama zamanı animasiyalı yaşıl işarə tətbiq edildi.
*   **İşıqlı Rejim və Theme Toggle Bərpası:** Əvvəllər deaktiv edilmiş aydınlıq rejimi yenidən aktivləşdirildi. `ThemeToggle` komponenti və `themeStore` yenidən tam funksional hala gətirildi. Toggle düyməsi `/login`, `/register` və `/verify` səhifələrinin yuxarı sağ küncünə yerləşdirildi.
*   **Premium "Buzlu Şüşə" (Frosted Glass) Kartları:** Giriş, qeydiyyat, doğrulama kartları və dashboard elementləri üçün mövzuya duyarlı frosted glass dizaynı yaradıldı. Yüksək arxa plan bulanıqlığı (`blur(48px)`), sol küncdən düşən işıq əks olunması (radial highlight), incə kənar haşiyələri və arxa planda üzən 3 ədəd rəngli ambient dairə (`.bgGlow1-3`) tətbiq edildi.
*   **Dashboard və Mobil Naviqasiya Şüşə Effekti:** Dashboard-dakı profil kartı, balans qutuları, stat kartları, səviyyə cədvəli və mobil cihazlar üçün alt menyu (`FooterNav.js`) tamamilə bu dinamik şüşə dizaynına keçirildi.
*   **Yumşaq İşıqlı Mod Fonu (Gradient BG):** Aydınlıq rejimindəki dümdüz arxa plan ekran görüntüsünə uyğun olaraq ağ-nanə yaşılına keçən zərif gradientlə (`linear-gradient(180deg, #ffffff 0%, #e8faf4 50%, #c4f2e3 100%)`) əvəzləndi və scrolling zamanı sabitləndi (`fixed`).
*   **Düymə Kontrastı və Səviyyə Xətti Düzəlişləri:**
    *   İşıqlı modda primary düymələrdəki (məs. "GÖNDƏR" və "Çıxarış Sorğusu Göndər") yazı rənginin qara qalaraq görünməməsi xətası yazı rəngini `--primary-foreground` (ağ) dəyişəninə bağlamaqla həll edildi.
    *   Səviyyə kartlarının üstündəki tərəqqi xəttinin arxa fonu işıqlı mod üçün aydın görünən boz şərkildə tənzimləndi (`--progress-track-bg`).
*   **Masaüstü Sürüşmə (Flex Shift) Xətasının Həlli:** `NeuralBackground` arxa fon komponentindəki Tailwind sinifləri raw CSS inline stillərlə əvəzlənərək flexbox layoutunun pozulması və kartın sağa sürüşməsi xətası tamamilə aradan qaldırıldı. Animasiya həmçinin ana səhifəyə də inteqrasiya olundu.

---

## 8. Son Sessiyada Görülən Təkmilləşdirmələr (LEVEL UP Rebrendinqi, Giriş Təkmilləşdirmələri və Mövzu Kilidi)
*   **LEVEL UP Rebrendinqi (Bütün Layihə üzrə):** Layihədəki bütün "3bucaq" marka adları, loqo mətnləri, SEO başlıqları, tərcümə lüğətləri və referal link paylaşım parametrləri böyük hərflərlə **`LEVEL UP`** olaraq yeniləndi. 
    *   Loqo mətni `LEVEL UP` kimi yazıldı, "LEVEL" düz və "UP" yaşıl/sian gradyanlı neon formatda tərtib edildi.
    *   Domen ünvanları `3bucaq.com` yerinə `levelup.com` olaraq dəyişdirildi.
*   **Supabase OTP Doğrulama Koduna Keçid:** Supabase e-poçt şablonunun tənzimlənməsi üçün SMTP provider inteqrasiya addımları və şablonun `{{ .Token }}` istifadə edərək e-posta ilə 6 rəqəmli OTP doğrulama kodu göndərəcək şəkildə dəyişdirilməsi təsvir edildi.
*   **Yeni Loqonun İnteqrasiyası:** İndirilənlərdəki yeni `logo-level-up.png` şimşək formalı mavi-mor loqosu projedəki bütün loqo resursları ilə (`3bucaq-logo.png`, `icon-192.png`, `icon-512.png`) əvəz olundu. Next.js resim cache-i sıfırlanaraq təmiz yüklənməsi təmin edildi.
*   **E-poçt və ya İstifadəçi Adı ilə Giriş Dəstəyi (Login):** Giriş səhifəsindəki validation xətası (keçərli e-poçtları rədd edən tərs yazılmış `validateEmail` məntiqi) düzəldildi. Həmçinin input tipi `email` əvəzinə `text` edilərək istifadəçinin həm e-poçt (məs: `admin@levelup.com`), həm də birbaşa istifadəçi adı (məs: `admin`, `mockadmin`, `user`) daxil edərək problemsiz giriş etməsi təmin olundu.
*   **Aydınlıq Rejiminin (Light Mode) Müvəqqəti Deaktiv edilməsi:** İşıqlı rejim müvəqqəti olaraq deaktiv edildi və sistem tamamilə qaranlıq moda (dark mode) kilidləndi. HTML head script və `themeStore` tənzimlənərək sistem hər zaman dark modda açılacaq şəkildə quruldu, `ThemeToggle` düyməsi isə arayüzdən tamamilə gizlədildi.
*   **Partiküllü Arka Plan İdeal Şəffaflığı (NeuralBackground):** Canvas elementinin hər frame-də fon rəngi ilə doldurulub digər arxa plan ızgaralarını örtməsi problemi aradan qaldırıldı. Canvas-da `destination-out` kompozit metodu tətbiq edilərək, partikül quyruqları (trail) saxlanılmaqla canvas tamamilə transparent (şəffaf) edildi. Beləliklə, neon partikül hərəkətləri və yaşıl ızgara (grid) fonu eyni anda problemsiz görünür.
*   **Butonların Sağ Üstə Köçürülməsi:** Ana səhifənin ortasındakı böyük "Giriş" və "Hesab Yarat" butonları silindi və sağ üst küncdəki topBar sahəsinə ikisi də `variant="ghost"` olqraq yerləşdirildikdə çox daha səliqəli və responsive bir navbar quruluşu təmin edildi.

---

## 9. Son Sessiyada Görülən Təkmilləşdirmələr (Vahid Balans, Çıxarış Şəbəkələri, Hotbed Kilidləri və Arayüz Tənzimləmələri)
* **Vahid Balans Sisteminin Qurulması (Single Balance):** Layihədəki "Transfer Balansı" (transfer_balance) tamamilə ləğv edildi. Bütün depozitlər, paket aktivləşdirmələr, deaktivasiyalar, səviyyə bonusları, referal gəlirləri, daxili köçürmələr və çıxarışlar vahid Əsas Balans (`balance`) üzərinə keçirildi. SQL RPC funksiyaları (`transfer_funds`, `buy_package`, `create_level_claim`, `create_withdrawal`, `deactivate_package`) bu məntiqlə yenidən yazıldı.
* **Kripto Cüzdan İdarəçiliyi (Admin & İstifadəçi):** Admin panelə adminin kripto cüzdan ünvanlarını (məs. USDT TRC20, USDC ERC20) və bank kartı ödəniş məlumatlarını idarə edə biləcəyi səhifə əlavə edildi. İstifadəçi tərəfdə depozit edərkən bu cüzdanları görə və kopyalaya bilməsi üçün kopyalama funksiyası tətbiq olundu.
* **Hotbed Paketlərində Kilid Müddətləri və Deaktivasiya:** Paketlər üçün kilid müddətləri ($19-$199 paketləri üçün 180 gün, $399-$799 paketləri üçün 120 gün) bazada və arayüzdə tətbiq edildi. Paket deaktiv edildikdə vəsait avtomatik Əsas Balansa geri dönür.
* **Balans Kifayət Etmir Modalı (Popup):** Hotbed paketi alarkən balans yetərsiz olduqda standart alert yerinə, istifadəçini depozit səhifəsinə yönləndirən xüsusi "Balans Kifayət Etmir" popup-ı yaradıldı.
* **USDT Çıxarışında Şəbəkə Seçimi və Custom Dropdown:** Çıxarış səhifəsində şəbəkə seçərkən Webkit/Blink mühərriklərində baş verən (backdrop-filter səbəbli) sürüşmə və kəsilmə xətasını aradan qaldırmaq üçün standart select elementi ləğv edilərək xüsusi açılan menyu (custom dropdown) dizayn edildi.
* **Avtomatik Səviyyə (Level) Claim Məntiqi:** Səviyyə şərtləri dolduqda bonuslar birbaşa və avtomatik Əsas Balansa köçürülür, admin təsdiqi gözləmir.
* **Arayüz Düzəlişləri:**
  * Admin panelin mobil və desktop başlıqlarında Logo və "Admin Panel" sözlərinin üst-üstə minməsi düzəldildi.
  * Dashboard-da "Şəxsi Məlumat" kartı sola, "Balans" kartı sağa keçirildi, "Hesabı İdarə Et" mətninin ölçüsü və dizaynı səliqəli formaya gətirildi.
  * USDT Tarixçəsində "All Types" filter menyusunun mobil ekranlarda kənara qaçması sola hizalanmaqla aradan qaldırıldı.

---

## 10. Son Sessiyada Görülən Təkmilləşdirmələr (KYC Tələbi İnteqrasiyası və Depozit Tərcümələri)
* **Depozit Səhifəsi İkidilli Dəstək Bərpası:** Depozit səhifəsindəki hardkod azərbaycanca olan hissələr (Kripto tab, Kripto ilə Mədaxil başlığı) və `translations.js` faylında açarları əskik olduğu üçün ingiliscə rejimdə də azərbaycanca görünən bütün sahələr (Göndəriləcək cüzdan ünvanı, depozit sorğusu düyməsi, qəbz başlığı və s.) tərcümə sisteminə qoşularaq tamamilə ingiliscəyə çevrilə bilən vəziyyətə gətirildi.
* **Maliyyə Əməliyyatlarında KYC Doğrulaması Şərti:**
    * **Baza/JS Helper Səviyyəsində Qoruma:** `createDeposit`, `transferFunds` və `createWithdrawal` funksiyalarında istifadəçinin KYC statusunun `approved` olub-olmaması yoxlanılır (admin rolundan başqa) və təsdiq olunmayıbsa əməliyyatın icrasına icazə verilmir.
    * **İstifadəçi Arayüzü (UI) Səviyyəsində Bloklama:** Depozit və Köçürmə/Çıxarış səhifələrində kyc statusu approved olmayan istifadəçilərə yuxarıda sarı rəngli zərif bir **KYC Xəbərdarlıq Baneri** gösterilir. Eyni zamanda həmin səhifələrdəki əməliyyat göndərmə (submit) düymələri tamamilə deaktiv edilir. KYC təsdiqləndikdən sonra baner avtomatik olaraq itir və düymələr aktivləşir.
* **Qeydiyyat zamanı OTP təsdiqinin müvəqqəti söndürülməsi:** Yeni istifadəçi qeydiyyatdan keçdikdən sonra OTP doğrulama kodu tələb edən `/verify` səhifəsinə yönləndirilmə müvəqqəti olaraq deaktiv edildi və birbaşa `/dashboard` səhifəsinə yönləndirmə təyin olundu (sonradan asanlıqla geri qaytarıla bilər).
* **E-poçt təsdiqlənməsi və Supabase Ayarı:** Qeydiyyatda OTP baneri frontend-də söndürüldükdən sonra yeni yaranan istifadəçilərin birbaşa daxil ola bilməsi üçün uzaqdakı Supabase Dashboard-da (`Authentication -> Providers -> Email -> Confirm email`) ayarının söndürülməsi vacibdir. Bu ayar hələ aktiv olarkən yaranan istifadəçi (`jasminjasmin85@mail.ru`) Service Role Key vasitəsilə arxa fonda təhlükəsiz skript işlədilərək verilənlər bazası səviyyəsində əllə təsdiqləndi.

---

## 11. Son Sessiyada Görülən Təkmilləşdirmələr (Landing Giriş Düymələri, Referral Sistemi Bərpası, Hotbed Lifetime/Expiry, Qeydiyyat Redireksiya Təmiri və İkidilli Dəstək)
* **Landing Page Düymələrinin Aşağı Çəkilməsi:** Ana təqdimat səhifəsində (`src/app/page.js`) yuxarı sağ küncdəki Giriş/Qeydiyyat düymələri silindi. Mərkəzdəki hero kontent 40px aşağı endirildi və Giriş/Qeydiyyat düymələri birbaşa bu mətnlərin altına əlavə edildi.
* **Referral Sistemi Bərpası (Database + Trigger Fallback):** `create_profile_if_missing()` veritabanı RPC funksiyası (trigger gecikdiyi halda işə düşən fallback funksiyası) `raw_user_meta_data.referral_code` yoxlayıb referalın `referred_by` sütununu dolduracaq şəkildə tamamilə yeniləndi. Beləliklə, yeni qeydiyyatdan keçən referalların itməsi problemi birdəfəlik həll olundu.
* **Hotbed Paketlərinin Yenidən Qurulması (Lifetime vs 120 Günlük):**
    * Yatırım paketləri (`#19, #49, #99, #199`) ömürlük (lifetime) edildi, bir dəfə aktivləşdirilir və müddəti bitmir.
    * Qazanc paketləri (`#399, #799`) isə hər zaman 120 günlük təyin olundu. 120 gündən sonra bu paketlər avtomatik olaraq vaxtı bitərək sönür (deaktivasiya) və istifadəçiyə heç bir məbləğ geri ödənilmir, üstünlüklərdən yararlanmaq üçün yenidən alınmalıdır. `processPackageExpiry` helper funksiyası bu məntiqlə yeniləndi.
* **Arayüz Buton Dəyişikliyi (On/Off Switch ➔ Satın Al):** Hotbed səhifəsindəki köhnə ON/OFF switch düymələri ləğv edilərək standard premium **"Satın Al" (Buy)** düyməsi ilə əvəz olundu. Aktiv paketlər üçün kliklənə bilməyən **"Aktivdir" (Active)** düyməsi göstərilir. Qazanc paketləri üçün isə altında dinamik şəkildə neçə gün qaldığı (`105 gün qalıb`) vizual olasın deyə əks etdirilir.
* **Deaktivasiya və Geri Ödəniş Bloklanması:** Təhlükəsizlik məqsədilə verilənlər bazası səviyyəsində `deactivate_package()` funksiyası deaktiv edilərək, paketlərin əl ilə deaktiv olunub balansın geri alınması cəhdləri tamamilə bloklandı (funksiya birbaşa xəta qaytarır). Bütün bu baza yenilikləri üçün [fix_referral_and_packages.sql](file:///Users/manis85/Documents/3bucaq-web%20project/fix_referral_and_packages.sql) tərtib edilib tətbiq olundu.
* **Qeydiyyatdan Sonra Admin Panelinə Yönləndirilmə Xətası (Session Hijacking):** Admin olaraq daxil olmuş brauzerlərdən yeni hesab yaradılarkən köhnə admin tokeninin qeydiyyatdan sonra brauzerdə qalması və redireksiya zamanı yeni istifadəçini admin olaraq görməsi xətası həll olundu. `register/page.js` handleSubmit içərisində qeydiyyatdan əvvəl təmiz `supabase.auth.signOut()` edilməsi təmin edildi. Həmçinin `schema.sql` triggerində `admin@levelup.com` e-poçtunun admin olaraq təyin olunması dəstəkləndi.
* **Info Modalı Dil Qarışıqlığının Həlli:** Hotbed səhifəsindəki paket təfərrüatları, müddətlər və ömürlük məlumatlarının tərcümə açarları (`lock_info_title`, `lock_info_desc_updated`, `lock_days`, `lifetime` və s.) `translations.js` lüğətinə (həm AZ, həm EN) əlavə olundu. Həmçinin köhnəlmiş "transfer balansı" ifadələri "balansınız" / "your balance" olaraq dəyişdirildi.
* **Git Sinxronizasiyası:** Bütün bu yeniliklər stage edildi, commit olundu və uzaqdakı GitHub repozitoriyasına (`main` qoluna) push edildi.

---

## 12. Son Sessiya (2026-07-02/03): user_code Kimlik Sistemi + Hərtərəfli Təhlükəsizlik Auditı (KRİTİK)

Bu sessiyada çox-agentli audit workflow'ları ilə dərin təhlükəsizlik denetimi aparıldı, **əvvəlki remediation'ın buraxdığı KRİTİK açıqlar** tapılıb düzəldildi və `user_code` kimlik sistemi əlavə olundu. **Dəyişikliklər `security-remediation` git qoluna commit olundu (push EDİLMƏDİ).**

### 12.1 YENİ SQL Miqrasiya Faylları (Supabase-də SIRAYLA tətbiq olundu)
`security_remediation.sql` → `security_remediation_2_rpcs.sql` → `security_remediation_3.sql`. **Üçü də canlı bazada UYĞULANDI.** (Köhnə `security_patch.sql`, `remove_transfer_balance.sql` və s. superseded — köhnə funksiya təriflərini yenidən tətbiq etməyin.)

### 12.2 KRİTİK Təhlükəsizlik Düzəlişləri (audit + adversarial review tərəfindən təsdiqləndi)
* **`check_profile_updates` trigger'i SECURITY DEFINER idi → tamamilə bypass olurdu:** Definer trigger içində `current_user=postgres` olduğu üçün `'postgres'` guard'ı hər zaman uyğun gəlib bütün qorumaları atlayırdı (istifadəçi birbaşa UPDATE ilə balance/points/role='admin'/superadmin yaza bilirdi). **DÜZƏLİŞ:** trigger-dən `SECURITY DEFINER` çıxarıldı (INVOKER). İndi birbaşa client UPDATE-də `current_user='authenticated'` → yoxlamalar işləyir; definer RPC-lərdə `postgres` → guard ilə bypass (məşru).
* **Trigger indi WHITELIST modelindədir:** `balance, total_points, active_packages, current_level, claimed_levels, user_code, referred_by, referral_code, last_daily_earning_date` HEÇ BİR client (admin daxil) tərəfindən dəyişdirilə bilməz — yalnız definer RPC-lər. `role`/`admin_permissions` yalnız superadmin. Admin block/kyc/login əməliyyatları `has_admin_perm(...)` ilə granuler yoxlanılır.
* **Granuler admin bypass bağlandı:** `security_patch.sql`-dəki "Admins can manage X" (for all) RLS siyasətləri (deposits/withdrawals/level_claims/transactions/points_history) DROP edildi. Admin oxuması "Users can view..." (or is_admin()) ilə davam edir; bütün mutasyonlar definer RPC-lərdən keçir. (Əvvəllər yalnız 'kyc' icazəli alt-admin belə birbaşa balans yaza və öz çıxarışını təsdiq edə bilirdi.)
* **Self-referral/dövrə ilə pul basma bağlandı:** `referred_by` trigger-də kilidli + `buy_package`-a self/cycle detection (`visited uuid[]`) + `check(referred_by<>id)`.
* **`admin_adjust_points` `'users'` → `'finance'` icazəsinə keçirildi** (xal level-claim ilə balansa çevrilir).
* **Storage (`kyc-documents`):** bucket service_role ilə **PRIVATE** yaradıldı (əvvəllər yox idi — bu səbəbdən KYC/qəbz yükləmələri işləmirdi). `storage.objects` RLS siyasətləri əlavə olundu. Frontend `getPublicUrl` → `createSignedUrl`. Admin KYC ekranındakı sınıq şəkillər `createSignedUrls` ilə düzəldildi.
* **Digər:** `resolve_login_email`/`check_login_exists`/`lookup_login` DROP (anon email sızması); `admin_reject_claim` value-based jsonb removal; `process_daily_earnings` date-guard + is_effectively_blocked; `admin_approve_deposit` KYC yoxlaması; `set_admin_log_actor` trigger (log forgery); `admin_logs.admin_uid` auth.uid()-dən zorlanır.

### 12.3 YENİ ÖZƏLLİK: `user_code` (kimlik = 6 simvollu alfanumerik)
* **`profiles.user_code`** əlavə olundu: 6 simvol (A-Z + 2-9, qarışdıran I/O/0/1 yox, məs. `K7M2QX`), unique, `handle_new_user`/`create_profile_if_missing` avtomatik yaradır, mövcud istifadəçilər backfill edildi. `referral_code` da artıq `'REF'||user_code` (çarpışma yox).
* **Qeydiyyatda istifadəçi adı (username) TAMAMİLƏ QALDIRILDI.** Giriş yalnız **email** ilə (username→email həlli silindi).
* **Kimlik hər yerdə user_code:** transfer alıcısı (`transfer_funds(to_code)` + `lookup_user_code`), admin axtarışı (users/kyc/admins/logs/page), subscribers siyahısı (`get_my_referral_tree` userCode qaytarır), dashboard-da **kopyalana bilən "Sizin ID Kodunuz"**, personal-info label.
* **⚠️ Köhnə bölmələri əvəz edir:** artıq `display_login` kimlik/unique DEYİL (arxa planda qalır, yeni istifadəçilərdə = user_code); §3.2-dəki köhnə `handle_new_user` və §5.1-dəki "İstifadəçi adı ilə giriş" ARTIQ KEÇƏRLİ DEYİL.

### 12.4 Digər
* **Referal qazancı üçün ≥1 aktiv paket** şərti `buy_package`-da bərkidildi (upline-ın ən az 1 aktiv paketi olmalı).
* **Qeydiyyat OTP:** sadə yol seçildi (birbaşa `/dashboard`, "Confirm email" OFF). Verify axını istənilsə geri açıla bilər (register-də tək sətir şərh var).
* Kiçik düzəlişlər: admin təsdiq/rədd düymələrinə çift-klik qoruması, reset-password submit guard, personal-info buton kilidi, hardcoded `levelup.com` → `window.location.origin`, `.env.example` Firebase→Supabase.

### 12.5 Növbəti addımlar (PENDING)
1. Yeni frontend'i işə sal (`git checkout security-remediation` + `npm run dev`) — SQL Part 3 ilə birlikdə getməlidir. **[TAMAMLANDI — main'ə merge + push, Vercel deploy edir]**
2. (Opsional) Gündəlik qazanc üçün `run_daily_maintenance()` RPC-sini pg_cron/Edge Function ilə gündəlik çağır.
3. (Opsional) E-poçt doğrulaması (Confirm email + `{{ .Token }}` şablonu) + register verify yönləndirməsini geri aç.
4. `security-remediation` qolunu push et / PR aç. **[TAMAMLANDI — main'ə merge + push edildi]**

---

## 13. Son Sessiya (2026-07-03): Hotbed KYC Şərti, Referal Paket-Şərti, Telefon Redaktəsi + Deploy

**Git/Deploy statusu (§12-ni əvəz edir):** Bütün §12 və §13 dəyişiklikləri `main` qoluna **merge + push EDİLDİ**. Vercel `main`-dən **production deploy edir** (auto). `.env` gitignore-dadır, Vercel öz env dəyişənlərini işlədir.

### 13.1 Yeni İş Qaydaları / Özəlliklər
* **Hotbed paketi almaq üçün KYC 'approved' şərti:** `buy_package` RPC-də KYC yoxlaması (admin xaric); hotbed səhifəsində KYC yoxdursa sarı **xəbərdarlıq banneri** + "Satın Al" düyməsi KYC səhifəsinə yönləndirir.
* **Referal linki/kodu yalnız ≥1 aktiv hotbed paketi olduqda AKTİV:** ("əvvəl paket al, sonra referal")
    * `check_referral_code`: referrer'in aktiv paketi yoxdursa `valid=false` (`reason:'inactive'`).
    * `handle_new_user` + `create_profile_if_missing`: `referred_by` yalnız aktiv-paketli referrer üçün set edilir (aks halda referal baglanmir).
    * Frontend: dashboard referal kodu sətri + subscribers referal link/QR kartı, aktiv paket yoxdursa **"🔒 kilidli"** göstərilir + Paketlərə yönləndirmə.
* **Profildə telefon nömrəsi redaktə oluna bilər:** `personal-info` səhifəsində telefon artıq disabled deyil, redaktə edilən input; `updateUserProfile` `phone`-u whitelist-də saxlayır (trigger normal user üçün phone dəyişməsinə icazə verir).

### 13.2 SQL Faylı — TƏTBİQ EDİLDİ ✅ (2026-07-03)
**`security_remediation_4.sql`** 2026-07-03-də canlı Supabase bazasına psql ilə **TƏTBİQ OLUNDU və doğrulandı**: `buy_package` (KYC şərti), `check_referral_code` (paket şərti → `reason:'inactive'`), `handle_new_user` + `create_profile_if_missing` (referral paket-gate). Beləliklə bütün 4 migration canlıdadır; Part 1-3 vəziyyəti də eyni gün canlı bazada yoxlanılıb təsdiqləndi (trigger INVOKER, RLS 8 cədvəldə aktiv, köhnə sızma funksiyaları silinib, bucket private).

### 13.3 (2026-07-03, davamı): İgnore/Token Nizamı, Sərtləşdirmə və Birbaşa Supabase Girişi
* **Claude ignore mexanizmi:** `.claude/settings.json`-a `permissions.deny` Read qaydaları əlavə olundu (node_modules, .next, .git, package-lock.json, .env*, *.pem, *.key və s.) — token qənaəti + secret hijyeni. `.cloudeignore` yalnız istinaddır (Claude Code onu oxumur).
* **Şifrə sızması aradan qaldırıldı:** test hesab şifrələri compact.md-dən çıxarıldı → gitignore-lu `TEST_HESABLAR.local.md`. Köhnə şifrələr git tarixçəsində qaldığı üçün 4 hesabın şifrəsi Auth Admin API ilə **ROTATE EDİLDİ** (yeni şifrələr yalnız lokal faylda, sohbetə/git-ə düşməyib).
* **next.config.mjs:** security header-ləri (X-Frame-Options DENY, nosniff, HSTS, Referrer-Policy, Permissions-Policy) + `poweredByHeader:false`. `npm audit fix` → next@16.2.10 (high açıqlar bağlandı; qalan 2 moderate = next-in pin etdiyi postcss, canary tələb edir — gözlədilir).
* **Birbaşa DB girişi:** `.env`-də `SUPABASE_DB_URL` (Session pooler). SQL miqrasiyaları artıq Claude tərəfindən psql ilə birbaşa tətbiq olunur. Rəsmi **Supabase MCP** serveri `.mcp.json`-a əlavə olundu (ilk istifadədə sessiyada `/mcp` ilə OAuth təsdiqi lazımdır). `npx skills` ilə `supabase/agent-skills` quruldu.
* **pg_cron QURULDU ✅:** `daily-maintenance` job-u (jobid 1) hər gün **00:05 UTC** (Bakı 04:05) `public.run_daily_maintenance()` çağırır → gündəlik qazanclar (#399/#799) və paket müddət bitişi artıq tam avtomatikdir. Fonksiya tarix-qorumalıdır (eyni gün iki dəfə ödəmir).


---

## 14. Son Sessiya (2026-07-03, gecə): SQL Fayl Təmizliyi + KRİTİK Eksik Policy Aşkarlandı (Part 5)

### 14.1 KRİTİK Tapıntı: 7 cədvəldə RLS policy YOX idi
Supabase MCP ilə canlı baza yoxlanarkən aşkarlandı: `security_patch.sql` production layihəsinə **heç vaxt tətbiq olunmayıbmış**. Part 1/3 onun policy-lərinin mövcudluğunu fərz edib yalnız köhnə/boş olanları DROP etmişdi. Nəticə: `transactions`, `points_history`, `level_claims`, `deposits`, `withdrawals`, `system_settings`, `admin_logs` cədvəllərində RLS aktiv amma **sıfır policy** → client heç nə oxuya/yaza bilmirdi (əməliyyat tarixçəsi boş, depozit yaradıla bilmirdi, admin panel siyahıları boş).

### 14.2 `security_remediation_5.sql` — TƏTBİQ EDİLDİ ✅ (MCP apply_migration: `security_remediation_5_policies_cleanup`)
* **Eksik RLS policy-ləri yaradıldı** (Part 3 dizaynı qorunub — para cədvəllərinə client-side WRITE yox, hər mutasiya DEFINER RPC ilə):
  * `transactions/points_history/level_claims/deposits/withdrawals` → SELECT (öz sətirləri və ya admin)
  * `deposits` → INSERT (öz, yalnız `status='pending'`)
  * `system_settings` → SELECT (authenticated), WRITE yalnız `has_admin_perm('finance')` (depozit kartı nömrəsi burada!)
  * `admin_logs` → SELECT/INSERT yalnız admin (actor-u `tr_set_admin_log_actor` zorlayır)
* **`deactivate_package` stub-u Part 5-ə köçürüldü** (bilərəkdən deaktiv — "paketlər manuel deaktiv edilə bilməz"; client hələ çağırır, canlı tanımın mənbəyi artıq bu fayl).
* **`profiles.transfer_balance` kolonu DROP edildi** (dual-balance dizaynı ləğv olunmuşdu; kod istifadə etmir, bütün dəyərlər 0 idi — yoxlanıldı).
* Doğrulama: pg_policies-də 12 policy (6 cədvəl + profiles 2 + storage 4 ayrıca), kolon silinib, funksiya yerində.

### 14.3 Köhnəlmiş SQL faylları SİLİNDİ (git rm — tarixçədə qalır)
`security_patch.sql`, `dual_balance_migration.sql`, `remove_transfer_balance.sql`, `fix_referral_and_packages.sql`.
**Aktiv zəncir:** `schema.sql` (yalnız cədvəllər) → `security_remediation.sql` → `_2_rpcs.sql` → `_3.sql` → `_4.sql` → `_5.sql`. CLAUDE.md §Güvenlik-3 yeniləndi.

### 14.4 Kök qovluq təmizliyi
`.cloudeignore` (funksiyasız istinad — real deny qaydaları `.claude/settings.json`-dadır, git rm), `.DS_Store` (macOS zibili) və `graphify-out/` (gitignore-lu, regenerasiya oluna bilən vizuallaşdırma çıxışı) silindi.

---

## 15. Son Sessiya (2026-07-03, gecə 2): TAM LANSMAN DENETİMİ + Part 6-7 + Frontend Sərtləşdirmə

Kullanıcı istəyi: "backend+frontend tara, güvenlik/bozukluk/ölçeklenme sorunlarını bul, düzelt". 3 paralel denetim ajanı + Supabase advisor taraması + canlı smoke testlər.

### 15.1 `security_remediation_6.sql` — TƏTBİQ EDİLDİ ✅ (`security_remediation_6_launch_hardening`)
* **[KRİTİK] RPC EXECUTE kilidi:** TÜM fonksiyonlar (run_daily_maintenance dahil!) anon tərəfindən çağrıla bilirdi — Part 2 revoke'u sonrakı CREATE OR REPLACE'lərdə itmişdi. İndi whitelist grant modeli: `revoke all from public/anon/authenticated` + yalnız lazım olanlara grant. `check_referral_code` → anon+auth; istifadəçi/admin RPC-ləri → authenticated; cron → service_role; `is_admin/has_admin_perm/is_superadmin` → authenticated (RLS policy-lər + INVOKER trigger çağırdığı üçün MÜTLƏQ lazımdır). `alter default privileges ... revoke execute from public` → gələcək fonksiyonlar da avtomatik PUBLIC almır (yeni fonksiyonda grant YAZMAĞI UNUTMA).
* **RLS initplan:** bütün policy-lər `(select auth.uid())` / `(select public.is_admin())` sarmalamasına keçirildi (satır-başına → sorğu-başına). Storage kyc policy-ləri daxil.
* Köməkçi fonksiyonlar STABLE işarələndi; **16 index** yaradıldı (bütün FK-lər + pending partial indexlər + referral_code + created_at).
* Performans advisor: **tamamilə təmiz** (yalnız "unused index" INFO — yeni yaradıldıqları üçün normal).

### 15.2 `security_remediation_7.sql` — TƏTBİQ EDİLDİ ✅ (`security_remediation_7_stats_receipts_backfill`)
* `get_admin_stats()` RPC (admin dashboard 8 sorğu + bütün profiles endirmə → tək RPC; recentUsers-də active_packages VAR).
* **Dekont düzəlişi:** admin çıxarış dekontu artıq `receipts/<user-uid>/...` yoluna yüklənir + `receipts_select_own` storage policy → istifadəçi öz dekontunu AÇA BİLİR (əvvəl owner=admin olduğu üçün heç görə bilmirdi).
* Bucket sərtləşdirmə: kyc-documents **5MB + yalnız image/*** (server-side).
* Legacy backfill: transactions/points_history/deposits/withdrawals/level_claims-dəki köhnə display_login snapshot-ları user_code-a çevrildi (from_uid=NULL yetim test sətirləri qaldı — heç kimə görünmür).

### 15.3 Frontend düzəlişləri (2 paralel agent + orkestrator)
* **Data layer:** bütün list sorğularına limit (200/300/500); `getSystemSettings(keys)` batched (deposit səhifəsi 9→2 sorğu); `friendlyError()` — raw PostgREST/İngilis xətaları UI-a çıxmır; ölü exportlar silindi (updateProfileLogin, deactivatePackage, getSignedUrl).
* **AuthProvider:** TOKEN_REFRESHED-də profil yenidən yüklənmir (saatlıq lazımsız yük); keçici fetch xətası artıq istifadəçini logout ETMİR (retry + mövcud profili saxla).
* **Admin UI:** "Admin et" düyməsi yalnız superadmin-ə; KYC düymələri yalnız kyc icazəlilərə; admin şifrə-sıfırlama artıq redirectTo ilə; mock notification console.log-ları silindi.
* **Fayl yükləmə:** image/* + ≤5MB client yoxlaması (KYC 3 fayl, depozit dekontu, admin dekontu).
* **Debounce:** transfer kod lookup + register referral yoxlaması 400ms + stale-guard.
* **validateAmount:** Number.isFinite + 1M cap ('Infinity', '1e300' keçmir).
* **Referal kilidi UI tutarlılığı:** Sidebar/SlideUpMenu artıq paketi olmayana linki göstərmir.
* **create-subadmin route:** 0-satır update bug-ı düzəldildi (retry loop + uğursuzsa auth user silinir); server-side validasiya; permissions whitelist; generic xəta mesajları.
* **layout.js:** fontlar next/font-a keçdi (self-host, render-blocking link yox; Outfit istifadə olunmurdu — çıxarıldı, Inter+JetBrains Mono qaldı); favicon.ico + kiçik apple-touch-icon; maximumScale:1 silindi (accessibility).
* **Assetlər:** logo 505KB→70KB, icon-192 505KB→13KB, icon-512 505KB→71KB (pad-lənmiş kvadrat).
* **Yeni səhifələr:** error.js, global-error.js, not-found.js (AZ, dark tema).
* **Partikül fonu:** prefers-reduced-motion hörməti + mobildə 150 partikl.
* AuthGuard.js (ölü kod) silindi; sonner/clsx/tailwind-merge çıxarıldı (**motion QALIR** — verify OTP inputu istifadə edir!).

### 15.4 Doğrulama
`npm run build` ✅; prod server curl: bütün route-lar 200, 404 işləyir ✅. Canlı smoke: normal user login→öz profili/tarixçəsi ✅, anon transfer_funds/run_daily_maintenance → 42501 DENIED ✅, anon check_referral_code ✅, admin get_admin_stats + 20 profil görür ✅.

### 15.5 QALAN MANUAL İŞLƏR (Dashboard-dan, kod yox)
1. **Auth → Leaked password protection AÇ** (advisor xəbərdarlığı).
2. **Custom SMTP qur** (Resend/Postmark və s.) — Supabase default SMTP saatda ~2-4 email, lansmanda şifrə-sıfırlama/təsdiq emailları çatmayacaq. KRİTİK lansman şərti.
3. Email confirmation strategiyasına qərar (hazırda bağlı görünür; 6 unconfirmed user var).
4. Supabase planı: Pro + kompüt yüksəltmə + PITR backup (minlərlə istifadəçi üçün Nano/Free yetməz).
5. Sentry (@sentry/nextjs) + Vercel Analytics — heç bir observability yoxdur.
6. Repo private yoxlaması (köhnədən qalan).
7. (Toxunulmadı, qərar istəyir:) admin/claims səhifəsi vestigial (claims avto-done olur, pending həmişə boş); kök superadmin-in başqa superadmin tərəfindən demote edilməsinə DB-səviyyə qadağa yoxdur.

---

## 16. Operasyonel Erişim: Doğrudan DB (psql) + Supabase MCP

Bu ve paralel sekmelerdeki tüm SQL işleri artık iki yoldan yapılabiliyor; ikisi de kuruldu:

* **Doğrudan DB (psql):** `.env` içinde `SUPABASE_DB_URL` var (Session pooler: `aws-1-eu-central-2.pooler.supabase.com:5432`, user `postgres.kqggnpqidlqassxorvtq`). Claude SQL migration'ları bununla psql üzerinden uygular (`.env` Read-deny'li; Bash script `set -a && . ./.env` ile source edip değeri ekrana basmadan kullanır). psql v18.3 kurulu.
  * ⚠️ **DB şifresi sohbete yapıştırıldı → transcript'te duruyor.** Uygun bir zamanda Supabase Dashboard → Database → **Reset database password** yapıp yeni URI'yi `.env`'e işle (uygulamayı etkilemez; app anon key ile bağlanıyor, bu şifreyi kullanmıyor).
* **Supabase MCP** (`.mcp.json`, project scope, `mcp.supabase.com/mcp?project_ref=kqggnpqidlqassxorvtq`) artık **authenticate edilmiş ve çalışıyor** — §14/§15'teki `apply_migration` ve advisor taramaları bununla yapıldı. Sağladığı ekstra: canlı log okuma, güvenlik/performans advisor raporları, migration listeleme.
  * **MCP mekaniği (ileride sorun çıkarsa):** `.mcp.json`'daki HTTP MCP server yalnızca **oturum açılışında** yüklenir → oturum ortasında `claude mcp add` ile eklenen server o oturumda görünmez, **yeniden başlatmak** gerekir. Açılıştaki "Use this MCP server" istemi sadece *güven onayı*; araçların gelmesi için ayrıca `/mcp` → supabase → **Authenticate** (tarayıcıda Supabase OAuth) gerekir. Bağlanınca araçlar `mcp__supabase__*` olarak gelir.
  * `npx skills` ile `supabase/agent-skills` kuruldu (`.agents/skills/`, `.claude/skills/` symlink — ikisi de gitignore'lu).

---

## 17. Son Sessiya (2026-07-04): Email Rate Limit Həlli + Auth Config Düzəlişləri (Management API)

* **Email rate limit sorunu ÇÖZÜLDÜ:** Səbəb: "Confirm email" açıq idi + Supabase daxili SMTP saatda ~2 mail → qeydiyyatda `email rate limit exceeded`. İstifadəçi Dashboard-dan **"Confirm email"i BAĞLADI** (yeni UI-da Email provider panelində deyil, Sign In/Providers səhifəsinin üst bölməsindədir). 7 ilişib qalmış unconfirmed hesab admin API ilə təsdiqləndi (0 qaldı); probe qeydiyyat testi ilə doğrulandı, probe user silindi.
* **Management API ilə auth config dəyişiklikləri** (istifadəçinin PAT-ı ilə):
    * `password_min_length`: 6 → **8**. (Frontend `constants.js` `PASSWORD_RULES.minLength=10` — serverdən sərt, uyğundur; create-subadmin route-da da min 8 var.)
    * `site_url`: localhost:3000 → **https://3bucaq-web-project.vercel.app** (şifrə sıfırlama linkləri artıq canlıya gedir).
    * `uri_allow_list`: prod + localhost:3001/3000 əlavə edildi (boş idi).
    * `password_hibp_enabled` (leaked password protection): sınandı → **Pro plan tələb edir** (layihə FREE plandadır — doğrulandı). §15.5-dəki 1-ci manual iş bu səbəbdən blokludur.
* **⚠️ TƏHLÜKƏSİZLİK:** İstifadəçi PAT-ı (sbp_...) söhbətə yapışdırmışdı → https://supabase.com/dashboard/account/tokens ünvanından **SİLİNMƏLİDİR**.
* **Domain durumu:** Hələ yoxdur; canlı ünvan https://3bucaq-web-project.vercel.app. Domain alınınca: `site_url`/`uri_allow_list` yenilə + Resend SMTP qur + Vercel-ə bağla.

---

## 18. Son Sessiya (2026-07-04, davamı): KYC yalnız pul ÇIXIŞI üçün (§10 və §13.1-i əvəz edir)

**Yeni iş qaydası (istifadəçi istəyi):** KYC doğrulaması artıq YALNIZ **daxili köçürmə (`transfer_funds`)** və **çıxarış (`create_withdrawal`)** üçün tələb olunur. Paket almaq və depozit KYC-siz mümkündür ("pul KYC-siz girə bilər, amma KYC-siz çıxa bilməz").

* **`security_remediation_8.sql` — TƏTBİQ EDİLDİ ✅** (MCP `apply_migration: security_remediation_8_kyc_only_for_outflow`):
    * `buy_package`: Part 4-dəki KYC şərti çıxarıldı (qalan hər şey eynidir: balans, aktiv-paket təkrarı, self/cycle qoruması, upline min-1-paket, 5 xətt bonus).
    * `admin_approve_deposit`: istifadəçinin KYC yoxlaması çıxarıldı (`has_admin_perm('finance')` qalır).
    * Hər ikisində Part 6 whitelist grant modeli açıqca yenidən yazıldı (revoke public/anon + grant authenticated).
    * Doğrulama: `kyc_status` istinadı buy_package/admin_approve_deposit-də YOX, transfer_funds/create_withdrawal-da VAR; anon `buy_package` → 42501 DENIED ✅.
* **Frontend:**
    * `hotbed/page.js`: KYC banneri + "Satın Al"dakı KYC yönləndirməsi silindi.
    * `deposit/page.js`: KYC banneri + submit düyməsindəki KYC kilidi silindi.
    * `database.js` `createDeposit`: KYC yoxlaması silindi (`transferFunds` və `createWithdrawal`-da QALIR).
    * `transfer/page.js`: dəyişməz qaldı — banner + hər iki submit (köçürmə/çıxarış) KYC ilə kilidli.
    * `translations.js` `kyc_required_desc` (AZ+EN): "depozit" mətndən çıxarıldı (yalnız köçürmə/çıxarış).
* Aktiv SQL zənciri artıq `_8.sql`-ə qədərdir (CLAUDE.md yeniləndi). `npm run build` ✅.
