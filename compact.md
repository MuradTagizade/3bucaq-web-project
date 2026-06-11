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
Lokal yoxlamalar üçün istifadə olunan test giriş məlumatları:
*   **Admin Hesabı:**
    *   **Email:** `admin@3bucaq.com`
    *   **Şifrə:** `Admin123!`
    *   **Login:** `admin`
*   **Yeni Zəngin Mock Admin Hesabı:**
    *   **Email:** `mockadmin@3bucaq.com`
    *   **Şifrə:** `Mockadmin123!`
    *   **Login:** `mockadmin`
*   **Adi İstifadəçi Hesabı:**
    *   **Email:** `user@3bucaq.com`
    *   **Şifrə:** `User123!`
    *   **Login:** `testuser`
*   **Yeni Zəngin Mock İstifadəçi Hesabı:**
    *   **Email:** `testmock@3bucaq.com`
    *   **Şifrə:** `Testmock123!`
    *   **Login:** `mockuser`

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
