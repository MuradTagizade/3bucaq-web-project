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
Lokal yoxlamalar və test üçün istifadə olunan, `LEVEL UP` domenlərinə köçürülmüş və təsdiqlənmiş test giriş məlumatları:
*   **Yönetici Hesabı (Admin):**
    *   **Email:** `admin@levelup.com` (və ya İstifadəçi adı: `admin`)
    *   **Şifrə:** `Admin123!`
    *   **Rol:** `ADMIN`
*   **Zəngin Mock Yönetici Hesabı (Super Admin):**
    *   **Email:** `mockadmin@levelup.com` (və ya İstifadəçi adı: `mockadmin`)
    *   **Şifrə:** `Mockadmin123!`
    *   **Rol:** `ADMIN`
*   **Normal İstifadəçi Hesabı:**
    *   **Email:** `user@levelup.com` (və ya İstifadəçi adı: `user`)
    *   **Şifrə:** `User123!`
    *   **Rol:** `USER`
*   **Zəngin Mock İstifadəçi Hesabı:**
    *   **Email:** `testmock@levelup.com` (və ya İstifadəçi adı: `testmock`)
    *   **Şifrə:** `Testmock123!`
    *   **Rol:** `USER`

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
