# BigBoz — Dashboard Analisis, Catatan Keuangan & Edukasi Finansial Pribadi

Aplikasi web modern, mobile-first, dan berkelas portofolio yang bertindak sebagai **pendamping finansial cerdas**. Dirancang khusus agar tidak terasa generik seperti template AI biasa, melainkan seperti produk fintech profesional dengan sentuhan *Cinematic Dark Mode*, *Modern Light Mode*, manajemen utang/cicilan (DTI & simulasi pelunasan), sinkronisasi cloud Google Sheets, pusat edukasi literasi finansial komprehensif, input suara Web Speech API (id-ID), visualisasi data Chart.js, serta ekspor laporan PDF formal menggunakan jsPDF.

---

## 🌟 Fitur Utama BigBoz

### 1. Design System & Tema Ganda (Dark & Light Mode)
- **Cinematic Dark Mode (Default)**: Deep Slate (`#090D16`, `#0F172A`), Glassmorphism cards dengan border semi-transparan, aksen ambient radial gradient di sudut layar.
- **Modern Clean Light Mode**: Tampilan terang berdaya kontras tinggi, elegan, dan nyaman di mata untuk siang hari.
- **Tipografi Harmonis**: *Plus Jakarta Sans* untuk teks UI & navigasi, serta *JetBrains Mono* untuk seluruh nominal uang Rupiah dan metrik numerik.
- **Kode Warna Standar Produk Finansial**:
  - 🟢 **Pemasukan (Income)**: Emerald Green (`#10B981`)
  - 🔴 **Pengeluaran (Expense)**: Crimson Red (`#EF4444`)
  - 🟣 **Cicilan & Utang (Debt)**: Violet / Indigo (`#8B5CF6`)
  - 🔵 **Aksen Utama**: Cyber Cyan / Electric Blue (`#38BDF8`)
  - 🟡 **Peringatan / Target**: Amber Gold (`#F59E0B`)

### 2. Dashboard Ringkasan (Hero Summary Cards)
- **Saldo Kas Bersih**: Real-time perhitungan (Pemasukan - Pengeluaran).
- **Pemasukan & Pengeluaran Bulan Ini**: Metrik arus kas berjalan.
- **Rata-rata Burn Rate Harian**: Analisis konsumsi uang harian untuk memproyeksikan kecukupan cash flow hingga akhir bulan.
- **Kartu Total Cicilan Aktif Bulan Ini (Violet)**: Menampilkan total nominal kewajiban cicilan yang harus dibayar bulan ini serta jumlah pinjaman yang masih berjalan.
- **Progress Bar Target Tabungan Bulanan**: Pelacakan persentase tabungan terhadap target yang ditentukan.

### 3. Visualisasi & Analisis Grafik (Chart.js)
- **Line Chart Tren Pemasukan vs Pengeluaran**: Grafik spline bergelombang dengan area fill gradient lembut dan tooltip nominal Rupiah.
- **Donut Chart Distribusi Kategori**: Visualisasi proporsi pengeluaran per kategori belanja.
- **Data-Analyst View (Bulan Ini vs Bulan Lalu)**: Bar chart komparasi multi-metrik (Pemasukan, Pengeluaran, Saldo Bersih).
- **Pola Pengeluaran per Hari dalam Seminggu**: Bar chart 7 hari yang secara otomatis mendeteksi dan memberi *highlight* warna merah/crimson pada **Hari Terboros** pengguna.

### 4. Manajemen Cicilan & Utang (Debt & Installment Tracker)
- **Form Tambah & Edit Cicilan**:
  - Kategori pinjaman lengkap dengan icon: 🏠 Rumah/KPR, 🏍️ Motor, 🚗 Mobil, 💳 Kartu Kredit, 📦 Lainnya.
  - Plafon pinjaman, cicilan per bulan, tenor total, sisa tenor berjalan, suku bunga tahunan, dan tanggal jatuh tempo.
- **Kartu per Cicilan Interaktif**:
  - Progress bar persentase pelunasan (tenor terbayar / total tenor).
  - Estimasi sisa saldo pokok utang.
  - Badge dinamis jatuh tempo (*"Jatuh tempo X hari lagi"* atau peringatan mendesak jika dekat tanggal bayar).
  - Tombol **"Tandai Sudah Dibayar"**: Otomatis memotong sisa tenor 1 bulan, mencatat transaksi pengeluaran kategori Cicilan, dan memicu animasi konfeti saat lunas!
- **Kartu Rasio Debt-to-Income (DTI)**:
  - Mengukur total cicilan bulanan dibagi pemasukan kotor dengan standar perbankan:
    - `< 30%`: **Sangat Sehat** (Emerald)
    - `30% – 40%`: **Perlu Waspada** (Amber)
    - `> 40%`: **Beban Berisiko** (Rose/Red)
- **Simulasi Pelunasan Dipercepat**:
  - Kalkulator ekstra bayar bulanan — menghitung berapa bulan lebih cepat lunas dan estimasi bunga yang dihemat.

### 5. Pusat Edukasi Keuangan (Financial Literacy Hub)
- **Skor Kesehatan Keuangan (0–100)**:
  - Circular SVG Gauge meter animasi dengan breakdown transparan: Rasio Tabungan (35 pt), Rasio Cicilan (30 pt), Ketahanan Dana Darurat (20 pt), dan Disiplin Mencatat (15 pt).
- **Kartu "Tahukah Kamu?" Dinamis**:
  - Rekomendasi kontekstual yang dievaluasi langsung dari kondisi data riil pengguna (misal: saat DTI melebihi batas, saat dana darurat tipis, atau saat kategori tertentu mendominasi).
- **Panduan Visual Aturan Finansial Populer**:
  - Perbandingan langsung rasio riil pengguna vs standar **Aturan 50/30/20** (*Needs / Wants / Savings*).
  - Panduan ideal Dana Darurat (3–6x pengeluaran).
  - Batas aman cicilan maksimal (30–35%).
- **Kalkulator Dana Darurat Interaktif**:
  - Menghitung target ideal berdasarkan profil (Lajang / Berkeluarga / Freelancer) dan daya tahan bulan saat ini.
- **Kamus Istilah Keuangan Mini (Glossary)**:
  - Daftar istilah (DTI, Bunga Efektif vs Flat, Dana Darurat, Sinking Fund, Compounding Interest, dll) dengan filter pencarian instan dan kiat praktis.
- **Gamifikasi / Badges Pencapaian**:
  - 5 Badges kebiasaan baik (*Start Smart*, *Pencatat Disiplin*, *Master Pengendali Utang*, *Benteng Finansial*, *Target Hunter*) yang terbuka secara otomatis saat syarat terpenuhi.

### 6. Transaksi Cepat & Input Suara (Web Speech API)
- Toggle cepat Pemasukan / Pengeluaran.
- Auto-format nominal mata uang Rupiah.
- Catatan dengan tombol mikrofon **Web Speech API (`id-ID`)**:
  - Animasi *pulsing red mic* saat mendengarkan.
  - Parser heuristik otomatis: mengekstrak angka/nominal jika diucapkan (misal: *"Kopi susu 25 ribu"* otomatis mengisi nominal 25.000).
- Tabel transaksi desktop dan kartu ringkas mobile dengan filter pencarian teks, jenis transaksi, dan kategori.

### 7. Ekspor Laporan PDF Profesional (jsPDF + AutoTable)
- Menghasilkan dokumen laporan resmi A4 siap cetak/unduh:
  - Header & status privasi.
  - Ringkasan eksekutif kas & skor kesehatan.
  - Portofolio cicilan aktif & rasio DTI.
  - Sebaran pengeluaran per kategori.
  - Riwayat transaksi terperinci.

### 8. Privasi 100% Client-Side
- Seluruh data disimpan secara lokal di `LocalStorage` browser.
- Dilengkapi fitur **Ekspor JSON (Backup)** dan **Impor JSON (Restore)**.
- Opsi 1-klik **Muat Data Demo** untuk presentasi portofolio.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi dibangun sebagai Single Page Application (SPA) mandiri tanpa perlu build step yang rumit:

1. **Buka Langsung di Browser**:
   - Cukup buka file `index.html` dengan browser modern apa pun (Google Chrome, Microsoft Edge, Firefox, Safari).
2. **Atau Menggunakan Live Server**:
   ```bash
   # Jalankan static server lokal (misalnya dengan npx serve)
   npx serve .
   ```
   Lalu buka URL yang muncul (misalnya `http://localhost:3000`).

---

## 📂 Struktur Berkas

```
d:/BigBoz/My Finance/
├── index.html          # Markup SPA, navigasi, modal, drawer, dan komponen utama
├── css/
│   └── styles.css      # Design system, variabel dark/light mode, glassmorphism, pulse mic
├── js/
│   ├── app.js          # Controller utama, state management, LocalStorage, theme toggle
│   ├── demo-data.js    # Dataset realistis awal keuangan pribadi Indonesia
│   ├── charts.js       # 4 visualisasi data interaktif Chart.js
│   ├── debt.js         # Modul cicilan, rasio DTI, dan kalkulator pelunasan ekstra
│   ├── education.js    # Health Score, dynamic insights, 50/30/20, glossary, badges
│   ├── speech.js       # Web Speech API recognition & parser suara Bahasa Indonesia
│   └── export-pdf.js   # Pembuat laporan PDF formal via jsPDF & AutoTable
└── README.md           # Dokumentasi produk & panduan penggunaan
```
