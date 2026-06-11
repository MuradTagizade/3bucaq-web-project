# Project 3bucaq: Sistem Arxitekturası və UI Tələbləri

**Status:** Aktif
**Tip:** Veb/Mobil Tətbiq
**Sahə:** Finans, Affiliate Marketing, İnvestisiya

Bu sənəd "3bucaq" layihəsinin əllə çəkilmiş eskizlərindən və qeydlərindən çıxarılmış sistem tələblərini və UI komponentlərini əhatə edir.

---

## 1. Biznes Məntiqi və Marketinq Planı

Sistem, istifadəçilərin paketlər alaraq və referallar cəlb edərək qazanc əldə etdiyi çoxsəviyyəli bir marketinq (MLM) və investisiya platformasıdır.

### 1.1 Qazanc Yolları
*   **Referal Bonusu:** Birbaşa gətirilən referalın (1-ci xətt) ödənişindən 10% dərhal istifadəçinin balansına yüklənir.
*   **Dərinlik Bonusu:** Özündən sonrakı hər bir yatırımından (5-ci xəttə qədər) 1% qazanc gəlir və dərhal balansa yüklənir.
*   **Aktivlik Şərti:** Qeydiyyatdan keçib amma yatırım yoxdursa heç bir qazanc əldə etmək mümkün deyil. Mütləq hər hansı bir yatırım olmalıdır.

### 1.2 "Hot Bed" Paketləri (İstixanalar)
İstifadəçilər müxtəlif yatırım paketləri ala bilərlər.

*   **Sadəcə Yatırım Paketləri:** (Gündəlik qazanc vermir, xal qazandırır)
    *   **#19:** 0.6 point (xal)
    *   **#49:** 1.5 point
    *   **#99:** 3 point
    *   **#199:** 6 point
*   **Gündəlik Qazanc Verən Paketlər:** (Həm xal, həm gündəlik dollar qazandırır)
    *   **#399:** Gündəlik 3.3 $ qazanc + 12 point (Transfer balansına yığılır)
    *   **#799:** Gündəlik 6.5 $ qazanc + 24 point (Transfer balansına yığılır)

> **Zəmanət (Sığorta):** 1 il ərzində heç bir qazanc əldə etməzsinizsə ödədiyiniz məbləğ geri qayıdır.

### 1.3 Point (Xal) və Level Sistemi
Referalların (5-ci xəttə qədər) aldıqları paketlərdən xallar (pointlər) toplanır. Xallar müəyyən həddə çatdıqda istifadəçi növbəti Level-ə yüksəlir və bonus qazanır. Bonuslar USDT (Coinbase wallet) olaraq çıxarılır.

*   **LVL 1:** 30 point toplandıqda -> 99 USDT bonus
*   **LVL 2:** 109 point toplandıqda -> 299 USDT bonus (Şərt: #19 və #49 paketləri aktiv [ON] olmalıdır)
*   **LVL 3:** 268 point toplandıqda -> 499 USDT bonus (Şərt: #19 və #49 aktiv olmalıdır)
*   **LVL 4:** 597 point toplandıqda -> 999 USDT bonus (Şərt: #19 və #49 aktiv olmalıdır)
*   **LVL 5:** 1266 point toplandıqda -> 1999 USDT bonus (Şərt: #19, #49 və #99 aktiv olmalıdır)
*   **LVL 6:** 2615 point toplandıqda -> 4399 USDT bonus (Şərt: #19, #49 və #99 aktiv olmalıdır)
*   **LVL 7:** 5314 point toplandıqda -> 8999 USDT bonus (Şərt: #19, #49, #99 və #199 aktiv olmalıdır)
*   **LVL 8:** 10723 point toplandıqda -> 18999 USDT bonus (Şərt: #19, #49, #99, #199, #399 aktiv olmalıdır)
*   **LVL 9:** 21552 point toplandıqda -> 39999 USDT bonus (Şərt: #19, #49, #99, #199, #399 aktiv olmalıdır)
*   **LVL 10:** 43321 point toplandıqda -> 72999 USDT bonus (Şərt: #19, #49, #99, #199, #399 aktiv olmalıdır)

### 1.4 Şirkətin Gəlir Modeli
*   Ümumi oborotun 50%-i şirkətdə qalır, 50%-i istifadəçilərə paylanır. (Dəqiq iş 40% hesablanıb).
*   Məsələn: 1000$ oborotdan 500$ şirkətin xərcləyə biləcəyi məbləğdir.

---

## 2. İstifadəçi İnterfeysi (UI) Komponentləri

**Ümumi Dizayn Tələbi:** Saytın dizaynı "Digital, ultra" olmalıdır. Loqo üçün üçbucaq içində ağac və ya yuxarı ox (A hərfinə bənzər) stili nəzərdə tutulub.

### 2.1 Landing Page & Qeydiyyat (Auth)
*   **Landing Page:** "MAKE WORLD GREEN AGAIN" şüarı. İki əsas düymə: `Create Account` və `Login`.
*   **Login Ekranı:** Email və Password. Səhv məlumat daxil edildikdə sahənin altında `WRONG` yazısı çıxır. `Unutmuşam` düyməsi mövcuddur.
*   **Qeydiyyat (Create Account):**
    *   Sahələr: Email, Name Surname, Password (Min 10 simvol, 1 böyük hərf, rəqəm).
    *   Qeydiyyatdan sonra emailə 6 rəqəmli təsdiq kodu gedir.
    *   Kod təsdiq ekranına yazılır və `İrəli` düyməsi ilə ana səhifəyə keçilir.
    *   *Vacib:* Qeydiyyat bitdikdən sonra və ya hesaba ilk girişdə (və sonrakı bütün girişlərdə) **Üztanıma (Face ID)** verifikasiyası tələb olunur.

### 2.2 Ana Səhifə (Dashboard / Point Səhifəsi)
Sistemə daxil olduqda açılan ilk səhifədir.
*   **Header:** İstifadəçi login adı (`Hi: Loginim`), Üztanıma logosu.
*   **Əsas Panel (Level Cədvəli):** Bütün 10 səviyyənin (LVL1 - LVL10) siyahısı.
    *   Hər sətirdə: Toplanmış xal / Tələb olunan xal (Məsələn: `30/30`), Alınacaq Məbləğ (Məsələn: `99 USDT`), və `Receive` düyməsi.
    *   Şərtlər dolmadıqda `Receive` basılarsa popup çıxır: `Hələ hazır deyil` (2-3 saniyəyə itir).
    *   Şərtlər dolduqda `Receive` aktivləşir. Basıldıqda `USDT adresinizi daxil edin: (Yalnız coinbase wallet)` pəncərəsi açılır.
    *   Göndərdikdən sonra düymənin yazısı `Pending` olur. Admin təsdiqlədikdən sonra `Done` olur.
*   **Footer Navigation:**
    *   `Ana Səhifə (Logo)`: Hər yerdən bura qayıtmaq üçün.
    *   `Transfer Səhifəsi`: Balans göstəricisi ilə birlikdə (Məsələn: `4.3K`).
    *   `Hot Bed Səhifəsi (HB)`: Paketlər səhifəsinə keçid.
    *   `Subscribers Səhifəsi`: İnsan ikonu ilə.

### 2.3 Transfer (Köçürmə) Səhifəsi
*   Yuxarıda ümumi balans göstərilir (Məsələn: `4317.6`).
*   **Kimə:** Qəbul edənin logini yazılır. Düzgündürsə yaninda `V` (check) işarəsi çıxır. Səhvdirsə altdan `WRONG` yazılır.
*   **Məbləğ:** Göndəriləcək məbləğ yazılır. Balans çatmazsa `Balans kifayət etmir` xəbərdarlığı çıxır.
*   `İrəli` düyməsi ilə köçürmə edilir. Uğurlu olduqda `Success` (check) popupı çıxır.
*   Bütün köçürmələr **History** bölməsində qalır.

### 2.4 Hot Bed (Paketlər) Səhifəsi
*   Bütün paketlərin (#19, #49, #99, #199, #399, #799) siyahısı.
*   Hər paketin yanında `[ON]` / `[OFF]` düyməsi (Toggle).
*   `OFF` olanı `ON` etmək istədikdə `YES / NO` təsdiq pəncərəsi açılır. Təsdiq edildikdə məbləğ əsas balansdan çıxılır və status `ON` olur.
*   Yuxarıda `(i)` info ikonu var. Basdıqda paketlərin qazandırdığı xallar və gündəlik gəlirlər haqqında məlumat çıxır.

### 2.5 Subscribers (Abonələr) Səhifəsi
*   İstifadəçinin özündən sonrakı referallarının (nəfərlərin) siyahısı.
*   Siyahıda loginlər görünür. Login üzərinə kliklədikdə şəxsin məlumatları (Full Name, Email, Reg Date, aktiv Hot Bed paketləri) popup olaraq çıxır.
*   Hər səhifədə 15-20 nəfər, aşağıda pagination (1 2 3 4 5...).

### 2.6 History (Tarixçə) Səhifəsi
*   Giriş-çıxış tranzaksiyalarının siyahısı.
*   **Giriş məbləğləri:** Yaşıl ox (aşağı baxan).
*   **Çıxış məbləğləri:** Qırmızı ox (yuxarı baxan).
*   Siyahıdakı bir elementin üzərinə (`i` ikonuna) basdıqda ətraflı popup çıxır: (Kimdən, Kimə, Məbləğ, Tarix/Saat, Əməliyyatın növü - Məsələn: *hesabdan transfer*, *10% bonus*, *oborotdan 1% bonus*).
*   Çox olduqda səhifələnir (pagination).

### 2.7 Menyu (Slide Up)
*   Aşağıdan yuxarıya doğru (footerdan headerə qədər) açılan menyu.
*   **Bölmələr:**
    *   `Edit Password`
    *   `Edit Email`
    *   `History`
    *   `Ref Link`: Referal linki kopyalamaq (Copy ikonu) və ya messenjerlərlə göndərmək üçün (Share ikonu).
    *   `Exit`

---

## 3. Admin Panel Tələbləri
*   Admin istifadəçilərin giriş parollarını dəyişdirə bilməlidir.
*   Admin parol yazmadan istənilən müştərinin hesabına daxil ola bilməlidir.
*   Admin istənilən istifadəçinin hesabını bloklaya bilər. Bloklandıqda istifadəçiyə səbəb göstərilən ekran çıxmalıdır (`Sizin hesabınız filan səbəblərdən bloklanmışdır`).
*   Admin müştərinin qazandığı pointləri ödədikdə, çekini və Hash kodunu müştərinin emailinə göndərməli və arxivdə 1 nüsxəsini saxlamalıdır.

---
*Qeydlər: Layihənin kodlanması (Backend və s.) 3-cü mərhələdir və proqramistlər tərəfindən icra ediləcək. Şriftlərdə İlqar bəyin xatırlatması: "Tənbəl olma. Logo bu üslubda olsun (üçbucaq/ağac). Ümumi saytın dizaynı digital, ultra olsun."*