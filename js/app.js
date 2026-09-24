/**
 * FinVibe - Core Application Engine & State Controller
 * Mengintegrasikan State, UI Reactivity, LocalStorage, Theme Toggle, Modals & Toast
 */

const FinVibeApp = {
  // State Utama
  transactions: [],
  debts: [],
  paymentHistory: [],
  categories: [],
  settings: {},
  currentTheme: 'dark',
  activeTab: 'summary', // 'summary' | 'charts' | 'debt' | 'education' | 'history'

  // State Integrasi Google & Sinkronisasi
  spreadsheetId: null,
  spreadsheetUrl: null,
  driveFolderId: null,
  isSyncing: false,
  lastSyncTime: null,
  pendingPhotos: {
    tx: null,
    debtPay: null
  },

  // Filter riwayat transaksi
  filters: {
    search: '',
    type: 'all',
    category: 'all'
  },

  // Inisialisasi Aplikasi
  init() {
    // 1. Muat data cache lokal lebih dulu agar UI instan tanpa menunggu jaringan
    this.loadState();
    this.applyTheme(this.currentTheme);
    this.setupEventListeners();
    this.renderAll();

    // 2. Siapkan listener autentikasi Google Identity Services
    if (window.GoogleAuth) {
      GoogleAuth.onAuthStateChanged((isSignedIn, data) => {
        this.handleAuthStateChanged(isSignedIn, data);
      });
      GoogleAuth.init();
    }

    // 3. Update antarmuka status login Google
    this.updateAuthUI();

    // 4. Sembunyikan skeleton loader setelah inisialisasi awal
    setTimeout(() => {
      const skeleton = document.getElementById('initialSkeleton');
      if (skeleton) {
        skeleton.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => skeleton.remove(), 400);
      }
    }, 450);


    // 5. Sesi dipulihkan oleh onGoogleLibraryLoad via sessionStorage (tanpa popup)
    // Tidak perlu memanggil refreshAccessToken() di sini karena akan memicu popup yang diblokir browser.


    console.log('BigBoz Finance Initialized Successfully.');
  },

  // Muat state dari LocalStorage (Cache Fallback Offline-First)
  loadState() {
    try {
      const savedTx = localStorage.getItem('finvibe_transactions');
      const savedDebts = localStorage.getItem('finvibe_debts');
      const savedSettings = localStorage.getItem('finvibe_settings');
      const savedTheme = localStorage.getItem('finvibe_theme');
      const savedPayHistory = localStorage.getItem('finvibe_pay_history');

      this.transactions = savedTx ? JSON.parse(savedTx) : [...DEFAULT_TRANSACTIONS];
      this.debts = savedDebts ? JSON.parse(savedDebts) : [...DEFAULT_DEBTS];
      this.paymentHistory = savedPayHistory ? JSON.parse(savedPayHistory) : [];
      this.settings = savedSettings ? JSON.parse(savedSettings) : { ...DEFAULT_SETTINGS };
      this.currentTheme = savedTheme || this.settings.theme || 'dark';

      // Auto-sinkron pengaturan pemasukan & tanggal gajian dari transaksi Gaji
      const lastGaji = (this.transactions || []).find(t => 
        t.type === 'income' && (
          t.category === 'Gaji' || 
          t.category === 'Gaji & Tunjangan' || 
          (t.category && t.category.toLowerCase().includes('gaji')) ||
          t.category === 'Bonus' ||
          t.category === 'Bonus & Komisi'
        )
      );
      if (lastGaji) {
        let txDate;
        if (lastGaji.createdAt) txDate = new Date(lastGaji.createdAt);
        else if (lastGaji.date) {
          txDate = typeof lastGaji.date === 'number' ? new Date((lastGaji.date - 25569) * 86400000) : new Date(lastGaji.date);
        }
        if (txDate && !isNaN(txDate.getTime())) {
          this.settings.payDay = txDate.getDate();
        }
        if (lastGaji.amount) {
          this.settings.monthlyIncome = Number(lastGaji.amount);
        }
      }

      // Muat ID spreadsheet cache jika ada
      const profile = window.GoogleAuth ? GoogleAuth.getUserProfile() : null;
      if (profile && profile.email) {
        this.spreadsheetId = localStorage.getItem(`bigboz_sheet_id_${profile.email}`);
        if (this.spreadsheetId) {
          this.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
        }
      }
    } catch (e) {
      console.warn('Gagal memuat LocalStorage, memuat default demo data.', e);
      this.transactions = [...DEFAULT_TRANSACTIONS];
      this.debts = [...DEFAULT_DEBTS];
      this.settings = { ...DEFAULT_SETTINGS };
      this.currentTheme = 'dark';
    }
  },

  // Simpan salinan state ke LocalStorage sebagai Cache Offline-First
  saveState() {
    try {
      localStorage.setItem('finvibe_transactions', JSON.stringify(this.transactions));
      localStorage.setItem('finvibe_debts', JSON.stringify(this.debts));
      localStorage.setItem('finvibe_pay_history', JSON.stringify(this.paymentHistory));
      localStorage.setItem('finvibe_settings', JSON.stringify(this.settings));
      localStorage.setItem('finvibe_theme', this.currentTheme);
      this.updateStorageBadge();
    } catch (e) {
      console.error('Gagal menyimpan ke LocalStorage:', e);
    }
  },

  // Perbarui UI status autentikasi Google (Header, Banner, & Modal Settings)
  updateAuthUI() {
    const isAuth = window.GoogleAuth && GoogleAuth.isSignedIn();
    const profile = window.GoogleAuth ? GoogleAuth.getUserProfile() : null;

    // Header buttons
    const signInBtn = document.getElementById('googleSignInBtn');
    const profileCapsule = document.getElementById('googleUserProfileCapsule');
    const navAvatar = document.getElementById('navUserAvatar');
    const navName = document.getElementById('navUserName');

    // Promo banner
    const promoBanner = document.getElementById('googleAuthPromoBanner');

    // Settings Modal elements
    const statusBadge = document.getElementById('settingsGoogleStatusBadge');
    const connectedCard = document.getElementById('settingsProfileConnectedCard');
    const disconnectedCard = document.getElementById('settingsProfileDisconnectedCard');
    const googleAvatar = document.getElementById('googleAvatar');
    const googleName = document.getElementById('googleName');
    const googleEmail = document.getElementById('googleEmail');
    const sheetNameEl = document.getElementById('settingsSheetName');
    const logoutBtn = document.getElementById('settingsLogoutBtn');
    const clientIdInput = document.getElementById('settingGoogleClientId');

    if (clientIdInput && window.GoogleAuth) {
      clientIdInput.value = GoogleAuth.getClientId();
    }

    if (isAuth && profile) {
      // Tampilkan profil di header
      if (signInBtn) signInBtn.classList.add('hidden');
      if (profileCapsule) {
        profileCapsule.classList.remove('hidden');
        profileCapsule.classList.add('flex');
      }
      if (navAvatar && profile.picture) navAvatar.src = profile.picture;
      if (navName) navName.textContent = profile.name || profile.email;

      // Sembunyikan promo banner jika sudah terhubung
      if (promoBanner) promoBanner.classList.add('hidden');

      // Update settings modal
      if (statusBadge) {
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Terhubung';
        statusBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1';
      }
      if (connectedCard) connectedCard.classList.remove('hidden');
      if (disconnectedCard) disconnectedCard.classList.add('hidden');
      if (googleAvatar && profile.picture) googleAvatar.src = profile.picture;
      if (googleName) googleName.textContent = profile.name || 'Pengguna Google';
      if (googleEmail) googleEmail.textContent = profile.email || '-';
      if (sheetNameEl) sheetNameEl.textContent = `BigBoz-Database-${profile.email}`;
      if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
      // Mode offline / belum login Google
      if (signInBtn) signInBtn.classList.remove('hidden');
      if (profileCapsule) {
        profileCapsule.classList.add('hidden');
        profileCapsule.classList.remove('flex');
      }
      if (promoBanner) promoBanner.classList.remove('hidden');

      // Update settings modal
      if (statusBadge) {
        statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Belum Terhubung';
        statusBadge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 border border-slate-600 flex items-center gap-1';
      }
      if (connectedCard) connectedCard.classList.add('hidden');
      if (disconnectedCard) disconnectedCard.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
    }

    this.updateStorageBadge();
  },

  // Handler callback saat status autentikasi Google berubah
  async handleAuthStateChanged(isSignedIn, data) {
    console.log('[BigBoz] Auth state changed:', isSignedIn, data);
    this.updateAuthUI();

    if (isSignedIn) {
      const profile = GoogleAuth.getUserProfile();
      this.showToast(`Selamat datang, ${profile ? profile.name : 'Pengguna'}! Menghubungkan Google Sheets...`, 'success');
      await this.loadFromSheets(false);
    } else {
      this.spreadsheetId = null;
      this.spreadsheetUrl = null;
      this.updateStorageBadge();
      if (data && data.manualLogout) {
        this.showToast('Sesi Google telah ditutup. Aplikasi menggunakan data lokal di perangkat.', 'info');
      }
    }
  },

  // Trigger login Google dari tombol UI
  handleGoogleLogin() {
    if (!window.GoogleAuth) {
      alert('Modul Google Auth belum tersedia.');
      return;
    }
    GoogleAuth.signIn('consent');
  },

  // Trigger logout Google dari tombol UI
  handleGoogleLogout() {
    if (!confirm('Keluar dari akun Google? Seluruh data catatan tetap tersimpan aman di perangkat & Google Sheets Anda.')) return;
    if (window.GoogleAuth) {
      GoogleAuth.signOut();
    }
  },

  // Simpan custom Google Client ID dari modal Pengaturan
  saveCustomClientId() {
    const input = document.getElementById('settingGoogleClientId');
    if (!input) return;
    const val = input.value.trim();
    if (window.GoogleAuth) {
      GoogleAuth.setClientId(val);
      this.showToast('Google OAuth Client ID berhasil disimpan & diperbarui!', 'success');
    }
  },

  // =========================================================================
  // CLOUD SYNC: LOAD FROM SHEETS & WRITE-THROUGH
  // =========================================================================

  // Memuat data dari Google Sheets pengguna (Auto-discovery, Provisioning, & BatchGet)
  async loadFromSheets(manual = false) {
    if (!window.GoogleAuth || !GoogleAuth.isSignedIn()) {
      if (manual) {
        this.showToast('Silakan login dengan akun Google terlebih dahulu untuk sinkronisasi.', 'info');
        this.handleGoogleLogin();
      }
      return;
    }

    const profile = GoogleAuth.getUserProfile();
    if (!profile || !profile.email) {
      console.warn('[BigBoz] Profil pengguna Google belum tersedia.');
      return;
    }

    const overlay = document.getElementById('syncLoadingOverlay');
    if (overlay && manual) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    }

    try {
      this.isSyncing = true;
      const sheetKey = `bigboz_sheet_id_${profile.email}`;
      let targetSheetId = this.spreadsheetId || localStorage.getItem(sheetKey);

      // Jika belum ada ID spreadsheet tersimpan, cari atau buat otomatis di Google Drive
      if (!targetSheetId) {
        console.log('[BigBoz] Mencari spreadsheet database di Google Drive pengguna...');
        const existingSheet = await SheetsApi.findDatabaseSpreadsheet(profile.email);

        if (existingSheet) {
          console.log('[BigBoz] Spreadsheet database ditemukan:', existingSheet.id);
          targetSheetId = existingSheet.id;
          this.spreadsheetUrl = existingSheet.webViewLink || `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`;
        } else {
          console.log('[BigBoz] Spreadsheet belum ada, membuat database baru di Google Drive pengguna...');
          const newSheet = await SheetsApi.createDatabaseSpreadsheet(profile.email);
          targetSheetId = newSheet.id;
          this.spreadsheetUrl = newSheet.webViewLink;
        }

        // Simpan spreadsheetId di localStorage per akun
        localStorage.setItem(sheetKey, targetSheetId);
      }

      this.spreadsheetId = targetSheetId;
      if (!this.spreadsheetUrl) {
        this.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${targetSheetId}/edit`;
      }

      // Pastikan folder bukti foto di Google Drive juga siap
      SheetsApi.getOrCreateProofFolder(profile.email).catch(e => {
        console.warn('[BigBoz] Background preparation folder bukti:', e);
      });

      // Lakukan satu panggilan batchGet untuk seluruh tab sheet
      const cloudData = await SheetsApi.batchGetAllData(this.spreadsheetId);

      // Perbarui in-memory state jika sheet cloud memiliki baris data
      // Cek apakah user pernah hapus semua data — jangan restore data yang lebih tua
      const clearedAt = localStorage.getItem('bigboz_cleared_at');
      const clearedTime = clearedAt ? new Date(clearedAt) : null;

      if (cloudData.transactions && cloudData.transactions.length > 0) {
        // Filter: hanya ambil transaksi yang dibuat SETELAH user hapus data
        const validTx = clearedTime
          ? cloudData.transactions.filter(tx => {
              const txTime = tx.createdAt ? new Date(tx.createdAt)
                : (tx.date ? (typeof tx.date === 'number' ? new Date((tx.date - 25569) * 86400000) : new Date(tx.date))
                : null);
              return txTime && txTime > clearedTime;
            })
          : cloudData.transactions;

        if (validTx.length > 0) {
          this.transactions = validTx;
        }
      }
      if (cloudData.debts && cloudData.debts.length > 0) {
        // Filter: hanya ambil utang yang dibuat SETELAH user hapus data
        const validDebts = clearedTime
          ? cloudData.debts.filter(debt => {
              const debtTime = debt.createdAt ? new Date(debt.createdAt) : null;
              return !debtTime || debtTime > clearedTime;
            })
          : cloudData.debts;
        if (validDebts.length > 0) {
          this.debts = validDebts;
        }
      }
      if (cloudData.paymentHistory) {
        this.paymentHistory = cloudData.paymentHistory;
      }
      if (cloudData.categories && cloudData.categories.length > 0) {
        this.categories = cloudData.categories;
      }
      if (cloudData.settings && Object.keys(cloudData.settings).length > 0) {
        this.settings = { ...this.settings, ...cloudData.settings };
      }

      // Catat waktu sukses sinkronisasi & simpan cache lokal
      this.lastSyncTime = new Date();
      this.saveState();
      this.renderAll();
      this.updateStorageBadge();

      console.log('[BigBoz] Sinkronisasi Google Sheets selesai dengan sukses.');
      if (manual) {
        this.showToast('Data berhasil disinkronkan langsung dari Google Sheets Anda!', 'success');
      }
    } catch (err) {
      console.error('[BigBoz] Error saat sinkronisasi Google Sheets:', err);
      // Tangani edge case: Spreadsheet 404 (dihapus manual dari Drive)
      if (err.message && err.message.includes('FILE_NOT_FOUND')) {
        localStorage.removeItem(`bigboz_sheet_id_${profile.email}`);
        this.spreadsheetId = null;
        if (confirm('Spreadsheet database tidak ditemukan di Google Drive (mungkin telah dipindahkan/dihapus). Apakah Anda ingin membuat spreadsheet baru otomatis?')) {
          this.loadFromSheets(true);
          return;
        }
      }
      this.showToast(err.message || 'Gagal menyinkronkan dengan Google Sheets.', 'danger');
    } finally {
      this.isSyncing = false;
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
      }
    }
  },

  // Menulis perubahan data ke Google Sheets (Optimistic UI dengan Background Sync)
  async syncToSheets(actionType, payload) {
    // 1. Selalu perbarui cache lokal lebih dulu (offline-first)
    this.saveState();

    // 2. Jika tidak terhubung ke Google Sheets, cukup simpan lokal
    if (!window.GoogleAuth || !GoogleAuth.isSignedIn() || !this.spreadsheetId) {
      this.updateStorageBadge();
      return;
    }

    try {
      this.isSyncing = true;
      this.updateStorageBadge();

      switch (actionType) {
        case 'ADD_TRANSACTION':
          SheetsApi.enqueueTransaction(this.spreadsheetId, payload, (err) => {
            if (err) {
              console.error('[BigBoz] Gagal mengirim transaksi ke Google Sheets:', err);
              this.showToast('Gagal sinkron transaksi ke Google Sheets: ' + err.message, 'danger');
            } else {
              this.lastSyncTime = new Date();
              this.updateStorageBadge();
            }
          });
          break;

        case 'UPDATE_TRANSACTION':
          if (payload._rowNumber) {
            await SheetsApi.updateTransaction(this.spreadsheetId, payload, payload._rowNumber);
          }
          break;

        case 'DELETE_TRANSACTION':
          if (payload._rowNumber) {
            await SheetsApi.deleteRow(this.spreadsheetId, 'Transaksi', payload._rowNumber);
          }
          break;

        case 'ADD_DEBT':
          await SheetsApi.appendDebt(this.spreadsheetId, payload);
          break;

        case 'UPDATE_DEBT':
          if (payload._rowNumber) {
            await SheetsApi.updateDebt(this.spreadsheetId, payload, payload._rowNumber);
          }
          break;

        case 'DELETE_DEBT':
          if (payload._rowNumber) {
            await SheetsApi.deleteRow(this.spreadsheetId, 'Cicilan', payload._rowNumber);
          }
          break;

        case 'ADD_PAYMENT_HISTORY':
          await SheetsApi.appendPaymentHistory(this.spreadsheetId, payload);
          break;

        case 'UPDATE_SETTINGS':
          await SheetsApi.updateSettings(this.spreadsheetId, payload);
          break;

        default:
          console.warn('[BigBoz] Aksi sync tidak dikenal:', actionType);
      }

      this.lastSyncTime = new Date();
      this.updateStorageBadge();
    } catch (err) {
      console.error('[BigBoz] Gagal syncToSheets:', err);
      if (err.message && err.message.includes('AUTH_EXPIRED')) {
        this.showToast('Sesi otorisasi Google telah berakhir. Silakan login kembali.', 'warning');
      } else if (err.message && err.message.includes('RATE_LIMIT')) {
        this.showToast('Batas permintaan Google tercapai. Data Anda tetap tersimpan di lokal.', 'warning');
      } else {
        this.showToast('Gagal sinkron ke Google Sheets: ' + (err.message || 'Error jaringan'), 'danger');
      }
    } finally {
      this.isSyncing = false;
      this.updateStorageBadge();
    }
  },

  // Manual Trigger Sinkronisasi dari Tombol Header atau Modal
  syncGoogleSheets(manual = false) {
    if (!window.GoogleAuth || !GoogleAuth.isSignedIn()) {
      this.showToast('Silakan masuk dengan akun Google untuk sinkronisasi cloud.', 'info');
      this.handleGoogleLogin();
      return;
    }
    this.loadFromSheets(true);
  },

  // Buka Spreadsheet Asli di Google Sheets di tab browser baru
  openGoogleSheet() {
    if (this.spreadsheetUrl) {
      window.open(this.spreadsheetUrl, '_blank');
      this.showToast('Membuka Google Sheets database BigBoz di tab baru...', 'info');
    } else {
      const profile = window.GoogleAuth ? GoogleAuth.getUserProfile() : null;
      if (profile) {
        window.open('https://docs.google.com/spreadsheets/u/0/', '_blank');
      } else {
        this.showToast('Silakan login dengan akun Google terlebih dahulu.', 'info');
      }
    }
  },

  // Buka Folder Bukti Pembayaran di Google Drive di tab browser baru
  openDriveProofFolder() {
    const profile = window.GoogleAuth ? GoogleAuth.getUserProfile() : null;
    const email = profile ? profile.email : '';
    const folderId = localStorage.getItem(`bigboz_proof_folder_${email}`);
    if (folderId) {
      window.open(`https://drive.google.com/drive/folders/${folderId}`, '_blank');
      this.showToast('Membuka folder bukti transaksi di Google Drive...', 'info');
    } else {
      window.open('https://drive.google.com/drive/u/0/search?q=BigBoz-Bukti-Transaksi', '_blank');
      this.showToast('Membuka Google Drive untuk mencari folder bukti BigBoz...', 'info');
    }
  },

  // Update status badge penyimpanan & sinkronisasi Google Sheets di header
  updateStorageBadge() {
    const badge = document.getElementById('storageBadge');
    const syncText = document.getElementById('syncStatusText');
    const syncTime = document.getElementById('syncTimeText');
    if (!badge) return;

    const isConnected = window.GoogleAuth && GoogleAuth.isSignedIn();

    if (isConnected) {
      const last = this.lastSyncTime || new Date();
      const now = new Date();
      const diffMins = Math.floor((now - last) / (1000 * 60));
      let timeStr = '• Baru saja';
      if (diffMins >= 60) {
        const hours = Math.floor(diffMins / 60);
        timeStr = `• ${hours} jam lalu`;
      } else if (diffMins > 0) {
        timeStr = `• ${diffMins} mnt lalu`;
      }

      badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm';
      if (syncText) syncText.textContent = this.isSyncing ? 'Menyinkronkan...' : '🟢 Tersinkron ke Google Sheets';
      if (syncTime) syncTime.textContent = timeStr;
    } else {
      badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all cursor-pointer shadow-sm';
      if (syncText) syncText.textContent = '💾 Tersimpan di Perangkat (Lokal)';
      if (syncTime) syncTime.textContent = '';
    }
  },

  // =========================================================================
  // FOTO BUKTI PEMBAYARAN & STRUK
  // =========================================================================

  // Handle saat user memilih file foto (pada modal transaksi atau modal bayar cicilan)
  handlePhotoSelect(event, targetType) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Harap pilih berkas foto gambar (JPG, PNG, WebP).', 'danger');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      this.showToast('Ukuran foto terlalu besar. Maksimal 8 MB.', 'danger');
      return;
    }

    this.pendingPhotos[targetType] = file;

    // Tampilkan thumbnail preview instan
    const previewUrl = URL.createObjectURL(file);
    if (targetType === 'tx') {
      const nameEl = document.getElementById('txPhotoFileName');
      const previewImg = document.getElementById('txPhotoPreview');
      const previewBox = document.getElementById('txPhotoPreviewContainer');
      if (nameEl) nameEl.textContent = file.name;
      if (previewImg) previewImg.src = previewUrl;
      if (previewBox) previewBox.classList.remove('hidden');
    } else if (targetType === 'debtPay') {
      const nameEl = document.getElementById('debtPayPhotoFileName');
      const previewImg = document.getElementById('debtPayPhotoPreview');
      const previewBox = document.getElementById('debtPayPhotoPreviewContainer');
      if (nameEl) nameEl.textContent = file.name;
      if (previewImg) previewImg.src = previewUrl;
      if (previewBox) previewBox.classList.remove('hidden');
    }
  },

  // Reset foto yang dipilih
  clearSelectedPhoto(targetType) {
    this.pendingPhotos[targetType] = null;
    if (targetType === 'tx') {
      const input = document.getElementById('txReceiptPhoto');
      const nameEl = document.getElementById('txPhotoFileName');
      const previewBox = document.getElementById('txPhotoPreviewContainer');
      if (input) input.value = '';
      if (nameEl) nameEl.textContent = 'Pilih Foto Struk / Nota';
      if (previewBox) previewBox.classList.add('hidden');
    } else if (targetType === 'debtPay') {
      const input = document.getElementById('debtPayPhoto');
      const nameEl = document.getElementById('debtPayPhotoFileName');
      const previewBox = document.getElementById('debtPayPhotoPreviewContainer');
      if (input) input.value = '';
      if (nameEl) nameEl.textContent = 'Pilih Foto Resi / Screenshot';
      if (previewBox) previewBox.classList.add('hidden');
    }
  },

  // Buka Modal Preview Foto Bukti
  previewPhoto(photoUrl) {
    if (!photoUrl) return;
    const modal = document.getElementById('photoPreviewModal');
    const img = document.getElementById('photoPreviewImg');
    const driveLink = document.getElementById('photoPreviewDriveLink');
    if (!modal || !img) return;

    img.src = photoUrl;
    if (driveLink) {
      driveLink.href = photoUrl;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closePhotoPreviewModal() {
    const modal = document.getElementById('photoPreviewModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  // =========================================================================
  // MODAL PEMBAYARAN CICILAN
  // =========================================================================

  openPayDebtModal(debtId) {
    const debt = this.debts.find(d => d.id === debtId);
    if (!debt) return;

    if (debt.remainingTenorMonths <= 0) {
      this.showToast('Cicilan ini sudah lunas sebelumnya!', 'info');
      return;
    }

    const modal = document.getElementById('payDebtModal');
    if (!modal) return;

    document.getElementById('payDebtId').value = debt.id;
    document.getElementById('payDebtName').textContent = debt.name;
    document.getElementById('payDebtAmountText').textContent = this.formatRupiah(debt.monthlyPayment);
    document.getElementById('payDebtTenorText').textContent = `Sisa ${debt.remainingTenorMonths} bln → Menjadi ${debt.remainingTenorMonths - 1} bln`;
    document.getElementById('payDebtDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('payDebtIsLate').checked = false;

    this.clearSelectedPhoto('debtPay');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closePayDebtModal() {
    const modal = document.getElementById('payDebtModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  // Konfirmasi Pembayaran Cicilan & Upload Bukti Foto
  async handleConfirmPayDebt(e) {
    e.preventDefault();
    const debtId = document.getElementById('payDebtId').value;
    const payDate = document.getElementById('payDebtDate').value;
    const isLate = document.getElementById('payDebtIsLate').checked;
    const submitBtn = document.getElementById('btnConfirmPayDebt');

    const debt = this.debts.find(d => d.id === debtId);
    if (!debt) return;

    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    }

    let photoUrl = '';
    // Jika ada foto bukti yang dipilih dan login Google
    if (this.pendingPhotos.debtPay && window.GoogleAuth && GoogleAuth.isSignedIn()) {
      try {
        if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-fade"></i> Unggah Bukti ke Drive...';
        const profile = GoogleAuth.getUserProfile();
        const uploadResult = await SheetsApi.uploadPhotoToDrive(this.pendingPhotos.debtPay, this.pendingPhotos.debtPay.name, profile.email);
        photoUrl = uploadResult.viewUrl;
      } catch (uploadErr) {
        console.warn('[BigBoz] Gagal upload foto ke Google Drive, melanjutkan simpan catatan:', uploadErr);
        this.showToast('Gagal mengunggah foto ke Drive: ' + uploadErr.message, 'warning');
      }
    }

    // 1. Kurangi sisa tenor 1 bulan & update status
    debt.remainingTenorMonths = Math.max(0, debt.remainingTenorMonths - 1);
    debt.paidTenorMonths = (debt.totalTenorMonths || 0) - debt.remainingTenorMonths;
    if (debt.remainingTenorMonths === 0) {
      debt.status = 'lunas';
    }

    // 2. Buat catatan riwayat pembayaran di sheet RiwayatBayarCicilan
    const paymentRecord = {
      id: 'pay-' + Date.now(),
      debtId: debt.id,
      paymentDate: payDate,
      amount: Number(debt.monthlyPayment),
      isLate: isLate,
      photoProofUrl: photoUrl
    };
    this.paymentHistory.unshift(paymentRecord);

    // 3. Otomatis catat transaksi pengeluaran kategori Cicilan di sheet Transaksi
    const newTx = {
      id: 'tx-' + Date.now(),
      type: 'expense',
      category: 'Cicilan',
      amount: Number(debt.monthlyPayment),
      date: payDate,
      notes: `Pembayaran cicilan: ${debt.name} (Sisa tenor ${debt.remainingTenorMonths} bln)`,
      source: 'cicilan_otomatis',
      createdAt: new Date().toISOString(),
      photoProofUrl: photoUrl,
      debtId: debt.id
    };
    this.transactions.unshift(newTx);

    // 4. Sinkronkan ke Google Sheets di background
    this.syncToSheets('UPDATE_DEBT', debt);
    this.syncToSheets('ADD_PAYMENT_HISTORY', paymentRecord);
    this.syncToSheets('ADD_TRANSACTION', newTx);

    this.closePayDebtModal();
    this.renderAll();

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }

    // Trigger animasi konfeti jika resmi lunas
    if (debt.remainingTenorMonths === 0) {
      if (window.confetti) window.confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      this.showToast(`🎉 SELAMAT! Cicilan "${debt.name}" RESMI LUNAS!`, 'success');
    } else {
      this.showToast(`Cicilan "${debt.name}" berhasil dibayar! Sisa ${debt.remainingTenorMonths} bulan.`, 'success');
    }
  },

  // Hitung Metrik Keuangan Pokok
  calculateStats() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Filter hanya transaksi bulan ini
    const monthlyTx = this.transactions.filter(tx => {
      let d;
      if (tx.createdAt) {
        d = new Date(tx.createdAt);
      } else if (tx.date) {
        if (typeof tx.date === 'number' || /^\d{5,}$/.test(String(tx.date))) {
          d = new Date((Number(tx.date) - 25569) * 86400000);
        } else {
          d = new Date(tx.date);
        }
      }
      if (!d || isNaN(d.getTime())) return false;
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    let income = 0;
    let expense = 0;
    let cicilanExpense = 0; // total pengeluaran kategori Cicilan bulan ini

    monthlyTx.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') income += amt;
      if (tx.type === 'expense') {
        expense += amt;
        if (tx.category === 'Cicilan') cicilanExpense += amt;
      }
    });

    const net = income - expense;

    // Hitung rata-rata Burn Rate Harian (berdasarkan hari berjalan bulan ini)
    const currentDay = Math.max(1, now.getDate());
    const dailyBurnRate = expense / currentDay;

    // Auto-deteksi tanggal gajian dari transaksi Gaji terbaru jika payDay belum diset
    let detectedPayDay = this.settings.payDay || 0;
    if (!detectedPayDay) {
      const lastGaji = this.transactions.find(tx =>
        tx.type === 'income' && (tx.category === 'Gaji & Tunjangan' || tx.category === 'Bonus & Komisi')
      );
      if (lastGaji) {
        const d = lastGaji.createdAt ? new Date(lastGaji.createdAt) : new Date(lastGaji.date);
        detectedPayDay = d.getDate();
        // Simpan ke settings jika belum ada
        this.settings.payDay = detectedPayDay;
        this.saveState();
      }
    }

    return {
      income,
      expense,
      net,
      dailyBurnRate,
      cicilanExpense,
      txCount: monthlyTx.length,
      totalTxCount: this.transactions.length
    };
  },

  // Format Rupiah
  formatRupiah(amount, withPrefix = true) {
    const num = Math.round(Number(amount) || 0);
    const formatted = num.toLocaleString('id-ID');
    return withPrefix ? `Rp ${formatted}` : formatted;
  },

  // Live formatter untuk input nominal — tampilkan 4.500.000 saat ketik 4500000
  formatRupiahInput(input) {
    const cursorPos = input.selectionStart;
    const prevLen = input.value.length;
    // Ambil hanya digit
    const raw = input.value.replace(/\D/g, '');
    if (!raw) { input.value = ''; return; }
    const num = parseInt(raw, 10);
    const formatted = num.toLocaleString('id-ID'); // e.g. "4.500.000"
    input.value = formatted;
    // Preserve cursor position
    const newLen = formatted.length;
    const newPos = cursorPos + (newLen - prevLen);
    try { input.setSelectionRange(Math.max(0, newPos), Math.max(0, newPos)); } catch {}
  },

  // Baca nilai angka dari input terformat (strip titik/koma)
  getRawAmount(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return 0;
    return Number(input.value.replace(/\D/g, '')) || 0;
  },


  // Konversi nilai tanggal (bisa serial Excel atau string) ke objek Date
  parseDateValue(val) {
    if (!val) return new Date(0);
    // Excel serial date (angka bulat, misal: 46288)
    if (typeof val === 'number' || (typeof val === 'string' && /^\d{5,}$/.test(val.trim()))) {
      return new Date((Number(val) - 25569) * 86400000);
    }
    return new Date(val);
  },

  // Format tampilan tanggal: "24 Sep 2026, 07:30:00"
  formatDateDisplay(dateVal, createdAt = null) {
    // Gunakan createdAt untuk presisi jam:menit:detik jika tersedia
    const raw = createdAt || dateVal;
    const d = createdAt ? new Date(createdAt) : this.parseDateValue(dateVal);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  },

  // Ganti Tema Gelap / Terang
  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(this.currentTheme);
    this.saveState();

    // Refresh charts agar kontras warna grid & teks menyesuaikan tema
    const stats = this.calculateStats();
    FinVibeCharts.refreshAll(this.transactions, stats, LAST_MONTH_STATS, this.currentTheme);
    
    // Perbarui circular gauge jika ada
    this.renderHealthGauge();

    this.showToast(`Beralih ke Mode ${this.currentTheme === 'dark' ? 'Gelap (Dark Mode)' : 'Terang (Light Mode)'}`, 'info');
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const themeIcon = document.getElementById('themeToggleIcon');
    const themeText = document.getElementById('themeToggleText');
    if (themeIcon) {
      themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun text-amber-400' : 'fa-solid fa-moon text-indigo-400';
    }
    if (themeText) {
      themeText.textContent = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
    }
  },

  // Navigasi Tab / Section
  switchTab(tabId) {
    this.activeTab = tabId;
    
    // Update active tab buttons (desktop & mobile nav)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const target = btn.getAttribute('data-tab');
      if (target === tabId) {
        btn.classList.add('active-tab', 'text-sky-400', 'border-sky-400');
        btn.classList.remove('text-slate-400', 'border-transparent');
      } else {
        btn.classList.remove('active-tab', 'text-sky-400', 'border-sky-400');
        btn.classList.add('text-slate-400', 'border-transparent');
      }
    });

    // Update bottom nav icons
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      const target = btn.getAttribute('data-tab');
      if (target === tabId) {
        btn.classList.add('text-sky-400', 'font-bold');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('text-sky-400', 'font-bold');
        btn.classList.add('text-slate-400');
      }
    });

    // Scroll halus ke section terkait di layar mobile/desktop
    const sectionEl = document.getElementById(`section-${tabId}`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  // Render Seluruh Komponen Halaman
  renderAll() {
    const stats = this.calculateStats();

    this.renderHeroCards(stats);
    this.renderDebtSection(stats);
    this.renderEducationSection(stats);
    this.renderTransactionsList();

    // Render Charts
    FinVibeCharts.refreshAll(this.transactions, stats, LAST_MONTH_STATS, this.currentTheme);
    this.updateStorageBadge();
  },

  // Render Hero Summary Cards
  renderHeroCards(stats) {
    const { income, expense, net, dailyBurnRate } = stats;
    
    // Saldo Saat Ini
    const netEl = document.getElementById('statCurrentBalance');
    if (netEl) {
      netEl.textContent = this.formatRupiah(net);
      netEl.className = `text-2xl lg:text-3xl font-bold font-mono-num ${net >= 0 ? 'text-sky-400' : 'text-red-400'}`;
    }

    // Pemasukan
    const incEl = document.getElementById('statTotalIncome');
    if (incEl) incEl.textContent = this.formatRupiah(income);

    // Pengeluaran
    const expEl = document.getElementById('statTotalExpense');
    if (expEl) expEl.textContent = this.formatRupiah(expense);

    // Burn Rate Harian
    const burnEl = document.getElementById('statBurnRate');
    if (burnEl) burnEl.textContent = `${this.formatRupiah(dailyBurnRate)} / hr`;

    // Total Cicilan Bulan Ini
    const totalDebt = DebtTracker.getTotalMonthlyInstallment(this.debts);
    const activeDebtCount = DebtTracker.getActiveDebtCount(this.debts);
    const debtStatEl = document.getElementById('statTotalDebtMonthly');
    const debtCountEl = document.getElementById('statActiveDebtCount');
    if (debtStatEl) debtStatEl.textContent = this.formatRupiah(totalDebt);
    if (debtCountEl) debtCountEl.textContent = `${activeDebtCount} Cicilan Aktif`;

    // Target Tabungan Bulanan
    const targetSavings = Number(this.settings.monthlySavingsTarget) || 3000000;
    const savingsPct = targetSavings > 0 ? Math.min(100, Math.max(0, Math.round((net / targetSavings) * 100))) : 0;
    
    const targetAmtEl = document.getElementById('statSavingsTarget');
    const savingsPctEl = document.getElementById('statSavingsPercent');
    const savingsBarEl = document.getElementById('statSavingsBar');
    
    if (targetAmtEl) targetAmtEl.textContent = this.formatRupiah(targetSavings);
    if (savingsPctEl) savingsPctEl.textContent = `${savingsPct}%`;
    if (savingsBarEl) {
      savingsBarEl.style.width = `${savingsPct}%`;
      savingsBarEl.className = `h-full rounded-full transition-all duration-700 ${savingsPct >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-sky-500 to-indigo-500'}`;
    }
  },

  // Render Modul Cicilan & Debt Tracker
  renderDebtSection(stats) {
    const totalDebt = DebtTracker.getTotalMonthlyInstallment(this.debts);
    const dti = DebtTracker.calculateDTI(totalDebt, stats.income);
    const dtiStatus = DebtTracker.getDTIStatus(dti);

    // DTI Card
    const dtiValueEl = document.getElementById('dtiRatioValue');
    const dtiBadgeEl = document.getElementById('dtiStatusBadge');
    const dtiDescEl = document.getElementById('dtiDescription');
    const dtiBarEl = document.getElementById('dtiProgressBar');

    if (dtiValueEl) dtiValueEl.textContent = `${dti}%`;
    if (dtiBadgeEl) {
      dtiBadgeEl.textContent = dtiStatus.label;
      dtiBadgeEl.className = `px-3 py-1 rounded-full text-xs font-bold ${dtiStatus.badgeClass}`;
    }
    if (dtiDescEl) dtiDescEl.textContent = dtiStatus.description;
    if (dtiBarEl) {
      dtiBarEl.style.width = `${Math.min(100, dti)}%`;
      dtiBarEl.className = `h-full rounded-full transition-all duration-700 ${
        dtiStatus.level === 'safe' ? 'bg-emerald-500' : (dtiStatus.level === 'warning' ? 'bg-amber-500' : 'bg-red-500')
      }`;
    }

    // Debt Cards List
    const debtListContainer = document.getElementById('debtCardsContainer');
    if (!debtListContainer) return;

    if (this.debts.length === 0) {
      debtListContainer.innerHTML = `
        <div class="col-span-full py-10 text-center text-slate-400">
          <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-800/60 flex items-center justify-center text-2xl">🎉</div>
          <p class="font-semibold text-lg text-slate-200">Tidak ada kewajiban cicilan</p>
          <p class="text-sm text-slate-400 mt-1">Anda bebas dari utang! Klik tombol "+ Tambah Cicilan" jika ingin memantau pinjaman baru.</p>
        </div>
      `;
      return;
    }

    debtListContainer.innerHTML = this.debts.map(debt => {
      const typeInfo = DebtTracker.getTypeIcon(debt.type);
      const dueInfo = DebtTracker.getDueStatus(debt.dueDay);
      const isLunas = (debt.remainingTenorMonths || 0) <= 0;
      const progressPct = isLunas 
        ? 100 
        : Math.round(((debt.totalTenorMonths - debt.remainingTenorMonths) / debt.totalTenorMonths) * 100);
      const estimatedBalance = isLunas 
        ? 0 
        : (debt.monthlyPayment * debt.remainingTenorMonths);

      return `
        <div class="glass-card p-5 relative overflow-hidden group">
          <!-- Top subtle accent line -->
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500"></div>

          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <span class="text-2xl p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">${typeInfo.emoji}</span>
              <div>
                <h4 class="font-bold text-base text-slate-100 group-hover:text-violet-400 transition-colors">${debt.name}</h4>
                <span class="text-xs text-slate-400">${typeInfo.name} ${debt.interestRate ? `• Bunga ${debt.interestRate}%/thn` : ''}</span>
              </div>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${dueInfo.color}">
              ${dueInfo.text}
            </span>
          </div>

          <!-- Metrik Angka -->
          <div class="grid grid-cols-2 gap-3 py-3 border-y border-slate-700/40 my-3">
            <div>
              <p class="text-xs text-slate-400">Cicilan / Bulan</p>
              <p class="text-sm font-bold font-mono-num text-violet-400">${this.formatRupiah(debt.monthlyPayment)}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400">Est. Sisa Saldo Pokok</p>
              <p class="text-sm font-bold font-mono-num text-slate-200">${this.formatRupiah(estimatedBalance)}</p>
            </div>
          </div>

          <!-- Progress Bar Tenor -->
          <div class="space-y-1.5 mb-4">
            <div class="flex justify-between text-xs">
              <span class="text-slate-400">Tenor: <b class="text-slate-200">${debt.totalTenorMonths - debt.remainingTenorMonths}/${debt.totalTenorMonths}</b> bln</span>
              <span class="font-bold ${isLunas ? 'text-emerald-400' : 'text-violet-400'}">${progressPct}% Lunas</span>
            </div>
            <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700 ${isLunas ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-600 to-indigo-500'}" style="width: ${progressPct}%"></div>
            </div>
            <div class="flex justify-between text-[11px] text-slate-500">
              <span>Sisa ${debt.remainingTenorMonths} bulan</span>
              <span>Jatuh tempo tiap tgl ${debt.dueDay}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 pt-2">
            ${isLunas ? `
              <span class="flex-1 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold text-center border border-emerald-500/30">
                🎉 Cicilan Sudah Lunas
              </span>
            ` : `
              <button onclick="FinVibeApp.openPayDebtModal('${debt.id}')" 
                      class="flex-1 py-2 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-violet-600/30">
                <i class="fa-solid fa-receipt"></i> Bayar & Bukti Foto
              </button>
            `}
            
            <button onclick="FinVibeApp.openDebtModal(true, '${debt.id}')" 
                    title="Edit Cicilan"
                    class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-xs">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="FinVibeApp.deleteDebt('${debt.id}')" 
                    title="Hapus Cicilan"
                    class="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors text-xs">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Update opsi simulator cicilan
    this.updateSimulatorSelect();
  },

  // Update dropdown pilihan cicilan di simulator pelunasan
  updateSimulatorSelect() {
    const select = document.getElementById('simDebtSelect');
    if (!select) return;

    const activeDebts = this.debts.filter(d => (d.remainingTenorMonths || 0) > 0);
    if (activeDebts.length === 0) {
      select.innerHTML = '<option value="">Tidak ada cicilan aktif</option>';
      return;
    }

    select.innerHTML = activeDebts.map(d => `
      <option value="${d.id}">${d.name} (${this.formatRupiah(d.monthlyPayment)}/bln - sisa ${d.remainingTenorMonths} bln)</option>
    `).join('');

    this.runPayoffSimulation();
  },

  // Jalankan kalkulasi simulasi pelunasan dipercepat
  runPayoffSimulation() {
    const select = document.getElementById('simDebtSelect');
    const extraInput = document.getElementById('simExtraPayment');
    const resultBox = document.getElementById('simResultBox');

    if (!select || !extraInput || !resultBox) return;

    const debtId = select.value;
    const extra = Number(extraInput.value) || 0;
    const debt = this.debts.find(d => d.id === debtId);

    if (!debt) {
      resultBox.innerHTML = '<p class="text-slate-400 text-sm">Pilih cicilan untuk memulai simulasi.</p>';
      return;
    }

    const res = DebtTracker.simulateAcceleratedPayoff(debt, extra);
    if (!res) return;

    resultBox.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div class="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50">
          <p class="text-[11px] text-slate-400">Tenor Normal</p>
          <p class="text-base font-bold font-mono-num text-slate-300">${res.originalMonths} Bln</p>
        </div>
        <div class="p-3 rounded-lg bg-violet-500/10 border border-violet-500/30">
          <p class="text-[11px] text-violet-300">Tenor Dipercepat</p>
          <p class="text-base font-bold font-mono-num text-violet-400">${res.newMonths} Bln</p>
        </div>
        <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <p class="text-[11px] text-emerald-300">Lebih Cepat</p>
          <p class="text-base font-bold font-mono-num text-emerald-400">${res.monthsSaved} Bulan!</p>
        </div>
        <div class="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30">
          <p class="text-[11px] text-sky-300">Est. Bunga Dihemat</p>
          <p class="text-base font-bold font-mono-num text-sky-400">${this.formatRupiah(res.interestSaved)}</p>
        </div>
      </div>
      <p class="text-xs text-slate-400 mt-3">
        💡 Dengan membayar ekstra <b>${this.formatRupiah(extra)}</b>/bulan (total bayar: <b>${this.formatRupiah(debt.monthlyPayment + extra)}</b>), cicilan <b>${debt.name}</b> Anda akan lunas <b>${res.monthsSaved} bulan lebih awal</b> dan menghemat beban bunga perkiraan <b>${this.formatRupiah(res.interestSaved)}</b>.
      </p>
    `;
  },

  // Render Pusat Edukasi Keuangan
  renderEducationSection(stats) {
    const health = FinancialEducation.calculateHealthScore(stats, this.debts, this.settings, this.transactions);
    this.currentHealthScore = health;

    // 1. Skor Kesehatan Keuangan Circular Gauge
    this.renderHealthGauge(health);

    // 2. Kartu "Tahukah Kamu?" Dinamis
    this.renderDynamicInsights(stats);

    // 3. Kalkulator Alokasi Anggaran Interaktif (50/30/20, 40/30/20/10, 80/20)
    this.renderBudgetCalculator();

    // 4. Aturan 50/30/20 Aktual vs Ideal
    this.render503020Rule(stats);

    // 5. Dompet Tabungan
    this.renderSavingsWallet();

    // 6. Distribusi 4 Jenis Pengeluaran
    this.renderExpenseTypeStats(stats);

    // 7. Budget Advisor / Peringatan Gajian
    this.renderBudgetAdvisor(stats);

    // 8. Kamus Mini Istilah Keuangan
    this.renderGlossary();

    // 9. Badges Gamifikasi
    this.renderBadges(stats);
  },

  // Render Circular Gauge Skor Kesehatan Finansial
  renderHealthGauge(healthData) {
    const health = healthData || this.currentHealthScore || FinancialEducation.calculateHealthScore(this.calculateStats(), this.debts, this.settings, this.transactions);
    
    const scoreValEl = document.getElementById('healthScoreValue');
    const scoreGradeEl = document.getElementById('healthScoreGrade');
    const scoreAdviceEl = document.getElementById('healthScoreAdvice');
    const circleEl = document.getElementById('gaugeCircleProgress');

    if (scoreValEl) scoreValEl.textContent = health.totalScore;
    if (scoreGradeEl) {
      scoreGradeEl.textContent = health.grade.title;
      scoreGradeEl.className = `text-lg font-bold ${health.grade.badgeClass} px-3 py-1 rounded-full inline-block`;
    }
    if (scoreAdviceEl) scoreAdviceEl.textContent = health.grade.advice;

    // Animasi stroke dash offset lingkaran SVG (keliling = 2 * PI * r = 2 * 3.14159 * 52 ≈ 326.7)
    if (circleEl) {
      const circumference = 326.7;
      const offset = circumference - (health.totalScore / 100) * circumference;
      circleEl.style.strokeDashoffset = offset;
      circleEl.style.stroke = health.grade.color;
    }

    // Breakdown Bars
    const bd = health.breakdown;
    this.updateHealthBar('scoreBarSavings', bd.savings.points, bd.savings.max,
      `${bd.savings.points}/${bd.savings.max} pt · Sisihkan ${bd.savings.rate}% dari penghasilan`);
    this.updateHealthBar('scoreBarDTI', bd.dti.points, bd.dti.max,
      `${bd.dti.points}/${bd.dti.max} pt · Beban cicilan ${bd.dti.ratio}% dari penghasilan`);
    this.updateHealthBar('scoreBarEmergency', bd.emergency.points, bd.emergency.max,
      `${bd.emergency.points}/${bd.emergency.max} pt · Dana darurat ${bd.emergency.ratio}% terpenuhi`);
    this.updateHealthBar('scoreBarConsistency', bd.consistency.points, bd.consistency.max,
      `${bd.consistency.points}/${bd.consistency.max} pt · ${bd.consistency.count} transaksi bulan ini`);

  },

  updateHealthBar(elementId, points, max, label) {
    const el = document.getElementById(elementId);
    const labelEl = document.getElementById(`${elementId}Label`);
    if (el) {
      const pct = Math.round((points / max) * 100);
      el.style.width = `${pct}%`;
    }
    if (labelEl) {
      labelEl.textContent = label;
    }
  },

  // Render Kartu "Tahukah Kamu?" Berbasis Data Riil
  renderDynamicInsights(stats) {
    const container = document.getElementById('dynamicInsightsContainer');
    if (!container) return;

    const insights = FinancialEducation.generateDynamicInsights(stats, this.debts, this.settings, this.transactions);
    
    container.innerHTML = insights.map(item => {
      const colorMap = {
        success: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', iconColor: 'text-emerald-400', icon: 'fa-shield-halved' },
        warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', iconColor: 'text-amber-400', icon: 'fa-triangle-exclamation' },
        danger: { border: 'border-red-500/30', bg: 'bg-red-500/10', iconColor: 'text-red-400', icon: 'fa-circle-exclamation' },
        info: { border: 'border-sky-500/30', bg: 'bg-sky-500/10', iconColor: 'text-sky-400', icon: 'fa-lightbulb' }
      };

      const c = colorMap[item.type] || colorMap.info;

      return `
        <div class="glass-card p-4 border ${c.border} ${c.bg} flex items-start gap-3 transition-transform hover:-translate-y-0.5">
          <div class="p-2.5 rounded-xl bg-slate-900/60 ${c.iconColor} text-base shrink-0">
            <i class="fa-solid ${c.icon}"></i>
          </div>
          <div class="flex-1">
            <h5 class="text-sm font-bold text-slate-100 mb-1">${item.title}</h5>
            <p class="text-xs text-slate-300 leading-relaxed">${item.text}</p>
            ${item.actionText ? `
              <button onclick="FinVibeApp.handleInsightAction('${item.actionTarget}')" 
                      class="mt-2 text-xs font-semibold ${c.iconColor} hover:underline inline-flex items-center gap-1">
                ${item.actionText} <i class="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  handleInsightAction(target) {
    if (target === 'add-tx') {
      this.openTransactionModal();
    } else {
      this.switchTab(target);
    }
  },

  currentBudgetRule: '5020',

  switchBudgetRule(ruleKey) {
    this.currentBudgetRule = ruleKey;
    ['5020', '40301020', '8020'].forEach(k => {
      const btn = document.getElementById(`ruleTab${k}`);
      if (btn) {
        if (k === ruleKey) {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-sky-500 text-white rule-tab-active';
        } else {
          btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600';
        }
      }
    });
    this.renderBudgetCalculator();
  },

  renderBudgetCalculator() {
    const salaryInput = document.getElementById('calcBudgetSalary');
    if (!salaryInput) return;

    let salary = this.getRawAmount('calcBudgetSalary');
    if (!salary) {
      salary = Number(this.settings.monthlyIncome) || 4500000;
      salaryInput.value = salary.toLocaleString('id-ID');
    }

    const labelEl = document.getElementById('calcBudgetLabel');
    if (labelEl) {
      labelEl.textContent = this.formatRupiah(salary);
    }

    const descEl = document.getElementById('budgetRuleDesc');
    const barEl = document.getElementById('calcBudgetBar');
    const cardsEl = document.getElementById('calcBudgetCards');
    if (!descEl || !barEl || !cardsEl) return;

    let items = [];
    if (this.currentBudgetRule === '40301020') {
      descEl.innerHTML = `
        <p class="font-bold text-sky-300 mb-0.5">Rumus 40 / 30 / 20 / 10 (Cocok jika Ada Cicilan & Alokasi Sosial)</p>
        <p>Metode ini ideal jika Anda memiliki kewajiban cicilan rutin dan ingin mengalokasikan dana untuk kegiatan sosial atau keluarga. Batas maksimal aman cicilan adalah 30% agar arus kas tidak terganggu.</p>
      `;
      items = [
        { label: 'Kebutuhan Hidup', pct: 40, color: 'bg-rose-500', textClass: 'text-rose-400', desc: 'Operasional harian & konsumsi wajib' },
        { label: 'Cicilan / Utang', pct: 30, color: 'bg-indigo-500', textClass: 'text-indigo-400', desc: 'Batas maksimal cicilan kendaraan / rumah' },
        { label: 'Tabungan & Asuransi', pct: 20, color: 'bg-emerald-500', textClass: 'text-emerald-400', desc: 'Dana darurat, asuransi, & pensiun' },
        { label: 'Sosial / Kebaikan', pct: 10, color: 'bg-amber-500', textClass: 'text-amber-400', desc: 'Zakat, donasi, sedekah, ortu' }
      ];
    } else if (this.currentBudgetRule === '8020') {
      descEl.innerHTML = `
        <p class="font-bold text-sky-300 mb-0.5">Rumus 80 / 20 (Pay Yourself First - Paling Sederhana)</p>
        <p>Cocok untuk Anda yang tidak ingin pusing mencatat pengeluaran secara detail. Langsung sisihkan 20% di awal gajian untuk masa depan, sisanya 80% bebas digunakan untuk menutup seluruh kebutuhan dan keinginan tanpa batasan ketat.</p>
      `;
      items = [
        { label: 'Bebas Digunakan', pct: 80, color: 'bg-sky-500', textClass: 'text-sky-400', desc: 'Menutup seluruh kebutuhan & keinginan' },
        { label: 'Tabungan & Investasi', pct: 20, color: 'bg-emerald-500', textClass: 'text-emerald-400', desc: 'Langsung sisihkan saat gajian masuk' }
      ];
    } else {
      descEl.innerHTML = `
        <p class="font-bold text-sky-300 mb-0.5">Rumus 50 / 30 / 20 (Elizabeth Warren - Paling Populer)</p>
        <p>Formula klasik paling seimbang antara pemenuhan kebutuhan dasar (50%), kenyamanan gaya hidup (30%), dan pembentukan aset masa depan (20%).</p>
      `;
      items = [
        { label: 'Kebutuhan Pokok (Needs)', pct: 50, color: 'bg-rose-500', textClass: 'text-rose-400', desc: 'Makan, sewa/KPR, listrik, air, pulsa, bensin' },
        { label: 'Keinginan (Wants)', pct: 30, color: 'bg-amber-500', textClass: 'text-amber-400', desc: 'Hiburan, hobi, streaming, kafe, jalan-jalan' },
        { label: 'Tabungan & Investasi', pct: 20, color: 'bg-emerald-500', textClass: 'text-emerald-400', desc: 'Dana darurat, investasi, tabungan jangka panjang' }
      ];
    }

    barEl.innerHTML = items.map(item => `
      <div class="${item.color} transition-all duration-500 flex items-center justify-center" style="width: ${item.pct}%" title="${item.label}: ${item.pct}%">
        <span>${item.pct}%</span>
      </div>
    `).join('');

    cardsEl.innerHTML = items.map(item => {
      const amount = Math.round((salary * item.pct) / 100);
      return `
        <div class="glass-card p-3 rounded-xl border border-slate-700/60 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[11px] font-bold ${item.textClass}">${item.label}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">${item.pct}%</span>
            </div>
            <p class="text-[10px] text-slate-400 leading-tight mb-2">${item.desc}</p>
          </div>
          <p class="text-sm font-bold font-mono-num ${item.textClass}">${this.formatRupiah(amount)}</p>
        </div>
      `;
    }).join('');
  },

  // Render Distribusi 4 Jenis Pengeluaran (Tetap, Variabel, Diskresi, Tak Terduga)
  renderExpenseTypeStats(stats) {
    const statsContainer = document.getElementById('expenseTypeStats');
    const chartEl = document.getElementById('expenseTypeChart');
    if (!statsContainer || !chartEl) return;

    const typeTotals = { tetap: 0, variabel: 0, diskresi: 0, tak_terduga: 0 };
    let totalExpense = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    (this.transactions || []).forEach(tx => {
      if (tx.type !== 'expense') return;
      let d = tx.createdAt ? new Date(tx.createdAt) : (tx.date ? new Date(tx.date) : null);
      if (d && !isNaN(d.getTime()) && (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth)) {
        return;
      }
      const amt = Number(tx.amount) || 0;
      totalExpense += amt;

      let expType = tx.expenseType;
      if (!expType) {
        const cat = tx.category || '';
        if (cat === 'Cicilan') expType = 'tetap';
        else if (['Tagihan & Utilitas', 'Internet & Pulsa', 'Belanja & Groceries', 'Transportasi'].includes(cat)) expType = 'variabel';
        else if (['Makanan & Kuliner', 'Hiburan & Langganan', 'Belanja Pribadi'].includes(cat)) expType = 'diskresi';
        else if (cat === 'Kesehatan') expType = 'tak_terduga';
        else expType = 'variabel';
      }
      if (typeTotals[expType] !== undefined) {
        typeTotals[expType] += amt;
      } else {
        typeTotals.variabel += amt;
      }
    });

    if (totalExpense <= 0) {
      statsContainer.classList.add('hidden');
      return;
    }

    statsContainer.classList.remove('hidden');

    const typeConfigs = [
      { key: 'tetap', label: 'Tetap', icon: '🔒', color: 'bg-red-500', textClass: 'text-red-400' },
      { key: 'variabel', label: 'Variabel', icon: '📊', color: 'bg-amber-500', textClass: 'text-amber-400' },
      { key: 'diskresi', label: 'Diskresi (Gaya Hidup)', icon: '🎯', color: 'bg-purple-500', textClass: 'text-purple-400', badge: 'Pos Pangkas Utama' },
      { key: 'tak_terduga', label: 'Tak Terduga', icon: '⚡', color: 'bg-slate-500', textClass: 'text-slate-300' }
    ];

    chartEl.innerHTML = typeConfigs.map(cfg => {
      const amt = typeTotals[cfg.key];
      const pct = Math.round((amt / totalExpense) * 100) || 0;
      return `
        <div class="space-y-1">
          <div class="flex justify-between items-center text-[11px]">
            <span class="text-slate-300 flex items-center gap-1">
              <span>${cfg.icon}</span> ${cfg.label}
              ${cfg.badge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold">${cfg.badge}</span>` : ''}
            </span>
            <span class="font-mono-num font-bold text-slate-200">${this.formatRupiah(amt)} (${pct}%)</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="${cfg.color} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Render Aturan 50/30/20 Visual
  render503020Rule(stats) {
    const data = FinancialEducation.calculate503020Rule(stats, this.transactions);

    // Reset ke 0 jika tidak ada data income
    if (!data || stats.income <= 0) {
      ['ruleActualNeeds','ruleActualWants','ruleActualSavings'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.width = '0%'; el.textContent = '0%'; }
      });
      ['valActualNeeds','valActualWants','valActualSavings'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'Rp 0';
      });
      return;
    }

    const actual = data.actual;
    
    // Bar aktual
    const barNeeds = document.getElementById('ruleActualNeeds');
    const barWants = document.getElementById('ruleActualWants');
    const barSavings = document.getElementById('ruleActualSavings');

    if (barNeeds) {
      barNeeds.style.width = `${actual.needsPct}%`;
      barNeeds.textContent = `${actual.needsPct}%`;
    }
    if (barWants) {
      barWants.style.width = `${actual.wantsPct}%`;
      barWants.textContent = `${actual.wantsPct}%`;
    }
    if (barSavings) {
      barSavings.style.width = `${actual.savingsPct}%`;
      barSavings.textContent = `${actual.savingsPct}%`;
    }

    // Detail Nominal
    const valNeeds = document.getElementById('valActualNeeds');
    const valWants = document.getElementById('valActualWants');
    const valSavings = document.getElementById('valActualSavings');

    if (valNeeds) valNeeds.textContent = this.formatRupiah(actual.needs);
    if (valWants) valWants.textContent = this.formatRupiah(actual.wants);
    if (valSavings) valSavings.textContent = this.formatRupiah(actual.savings);
  },

  // ============================================================
  // DOMPET TABUNGAN
  // ============================================================

  // Hitung saldo tabungan dari semua transaksi
  getSavingsBalance() {
    let balance = 0;
    (this.transactions || []).forEach(tx => {
      if (tx.category === 'Tabungan & Investasi' && tx.type === 'expense') {
        balance += Number(tx.amount) || 0; // setoran tabungan
      }
      if (tx.category === 'Ambil Tabungan' && tx.type === 'income') {
        balance -= Number(tx.amount) || 0; // pengambilan tabungan
      }
    });
    return Math.max(0, balance);
  },

  // Render Dompet Tabungan
  renderSavingsWallet() {
    const balance = this.getSavingsBalance();
    const balEl = document.getElementById('savingsWalletBalance');
    const badgeEl = document.getElementById('savingsWalletBadge');
    const subtextEl = document.getElementById('savingsWalletSubtext');
    const historyEl = document.getElementById('savingsHistoryList');

    if (balEl) balEl.textContent = this.formatRupiah(balance);
    if (badgeEl) badgeEl.textContent = this.formatRupiah(balance);

    // Riwayat tabungan (max 5 terbaru)
    const savingsTx = (this.transactions || [])
      .filter(tx => tx.category === 'Tabungan & Investasi' || tx.category === 'Ambil Tabungan')
      .sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt) : this.parseDateValue(a.date);
        const tB = b.createdAt ? new Date(b.createdAt) : this.parseDateValue(b.date);
        return tB - tA;
      })
      .slice(0, 5);

    if (subtextEl) {
      subtextEl.textContent = savingsTx.length === 0
        ? 'Belum ada tabungan. Mulai nabung sekarang!'
        : `${savingsTx.length} riwayat tabungan terakhir`;
    }

    if (historyEl) {
      if (savingsTx.length === 0) {
        historyEl.innerHTML = `<p class="text-slate-500 text-center text-[11px] py-2">Belum ada riwayat tabungan</p>`;
      } else {
        historyEl.innerHTML = savingsTx.map(tx => {
          const isDeposit = tx.category === 'Tabungan & Investasi';
          return `
            <div class="flex items-center justify-between py-1 border-b border-slate-800/60">
              <div class="flex items-center gap-2">
                <span class="${isDeposit ? 'text-emerald-400' : 'text-red-400'} text-[11px]">
                  ${isDeposit ? '↑ Setor' : '↓ Ambil'}
                </span>
                <span class="text-[11px] text-slate-400 truncate max-w-[100px]">${tx.notes || '-'}</span>
              </div>
              <span class="font-mono-num text-[11px] font-bold ${isDeposit ? 'text-emerald-400' : 'text-red-400'}">
                ${isDeposit ? '+' : '-'}${this.formatRupiah(tx.amount)}
              </span>
            </div>
          `;
        }).join('');
      }
    }
  },

  _savingsModalMode: 'deposit',

  openSavingsModal(mode = 'deposit') {
    this._savingsModalMode = mode;
    const isDeposit = mode === 'deposit';
    const modal = document.getElementById('savingsModal');
    const title = document.getElementById('savingsModalTitle');
    const desc = document.getElementById('savingsModalDesc');
    const btn = document.getElementById('savingsConfirmBtn');
    const warn = document.getElementById('savingsWarning');

    if (title) title.innerHTML = `<i class="fa-solid ${isDeposit ? 'fa-piggy-bank text-emerald-400' : 'fa-hand-holding-dollar text-amber-400'}"></i> ${isDeposit ? 'Tambah Tabungan' : 'Gunakan Tabungan'}`;
    if (desc) desc.textContent = isDeposit
      ? 'Masukkan jumlah yang ingin Anda tabung. Akan dicatat sebagai pengeluaran "Tabungan & Investasi".'
      : `Masukkan jumlah yang ingin diambil dari tabungan. Saldo saat ini: ${this.formatRupiah(this.getSavingsBalance())}`;
    if (btn) btn.className = `flex-1 py-2.5 rounded-lg ${isDeposit ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'} text-white text-sm font-bold transition-colors`;
    if (warn) warn.classList.add('hidden');

    document.getElementById('savingsAmount').value = '';
    document.getElementById('savingsNote').value = '';

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeSavingsModal() {
    const modal = document.getElementById('savingsModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  },

  async confirmSavings() {
    const amount = this.getRawAmount('savingsAmount') || Number(document.getElementById('savingsAmount').value);
    const note = document.getElementById('savingsNote').value.trim();
    const warn = document.getElementById('savingsWarning');

    if (!amount || amount <= 0) {
      this.showToast('Masukkan jumlah yang valid!', 'danger');
      return;
    }

    const isDeposit = this._savingsModalMode === 'deposit';

    // Validasi saldo cukup saat pengambilan
    if (!isDeposit) {
      const balance = this.getSavingsBalance();
      if (amount > balance) {
        if (warn) { warn.classList.remove('hidden'); warn.textContent = `⚠️ Saldo tabungan tidak cukup! Saldo: ${this.formatRupiah(balance)}`; }
        return;
      }
    }

    const newTx = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'tx-' + Date.now(),
      type: isDeposit ? 'expense' : 'income',
      category: isDeposit ? 'Tabungan & Investasi' : 'Ambil Tabungan',
      amount,
      date: new Date().toISOString().split('T')[0],
      notes: note || (isDeposit ? 'Setoran tabungan' : 'Pengambilan tabungan'),
      createdAt: new Date().toISOString(),
      source: 'savings'
    };

    this.transactions.unshift(newTx);
    this.syncToSheets('ADD_TRANSACTION', newTx);
    this.showToast(
      isDeposit
        ? `✅ Tabungan ${this.formatRupiah(amount)} berhasil ditambahkan!`
        : `💸 Tabungan ${this.formatRupiah(amount)} berhasil digunakan. Sisa: ${this.formatRupiah(this.getSavingsBalance())}`,
      'success'
    );
    this.closeSavingsModal();
    this.renderAll();
  },

  // ============================================================
  // BUDGET ADVISOR — Peringatan Gajian
  // ============================================================

  renderBudgetAdvisor(stats) {
    const payDay = Number(this.settings.payDay || 0);
    const card = document.getElementById('budgetAdvisorCard');
    if (!card || payDay === 0 || stats.income <= 0) {
      if (card) card.classList.add('hidden');
      return;
    }

    const now = new Date();
    const today = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysInNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();

    // Hitung hari ke gajian berikutnya
    // Jika today >= payDay → sudah gajian bulan ini → hitung ke bulan depan
    let daysUntilPayday;
    if (today < payDay) {
      daysUntilPayday = payDay - today;
    } else {
      // Hari ini = hari gajian ATAU sudah lewat → hitung ke bulan depan
      // Misal gajian tgl 24, hari ini 24 → next payday 24 bulan depan = ~30 hari
      daysUntilPayday = (daysInMonth - today) + Math.min(payDay, daysInNextMonth);
    }

    const { income, expense, dailyBurnRate } = stats;
    const netBalance = income - expense;
    const projectedSpendUntilPayday = dailyBurnRate * daysUntilPayday;
    const projectedLeftover = netBalance - projectedSpendUntilPayday;

    // Tampilkan peringatan jika:
    // - sisa saldo setelah proyeksi pengeluaran < 30% income
    // - ATAU saldo bersih (net) negatif
    // - DAN masih > 3 hari ke gajian
    const isWarning = (projectedLeftover < (income * 0.3) || netBalance < 0) && daysUntilPayday > 3 && income > 0;

    if (!isWarning) {
      card.classList.add('hidden');
      return;
    }

    card.classList.remove('hidden');

    // Update info
    const subtitle = document.getElementById('budgetAdvisorSubtitle');
    const daysLeftLabel = document.getElementById('budgetAdvisorDaysLeft');
    const dailyBurnEl = document.getElementById('advisorDailyBurn');
    const daysLeftEl = document.getElementById('advisorDaysLeft');
    const projectedEl = document.getElementById('advisorProjectedLeft');
    const topExpEl = document.getElementById('advisorTopExpenses');

    if (subtitle) subtitle.textContent = `Dengan pola belanja saat ini, diperkirakan saldo menipis sebelum gajian tgl ${payDay} (${daysUntilPayday} hari lagi)`;
    if (daysLeftLabel) daysLeftLabel.textContent = `${daysUntilPayday} hari lagi gajian`;
    if (dailyBurnEl) dailyBurnEl.textContent = this.formatRupiah(Math.round(dailyBurnRate));
    if (daysLeftEl) daysLeftEl.textContent = `${daysUntilPayday} hari`;
    if (projectedEl) {
      projectedEl.textContent = this.formatRupiah(Math.max(0, Math.round(projectedLeftover)));
      projectedEl.className = `text-sm font-bold font-mono-num ${projectedLeftover < 0 ? 'text-red-400' : 'text-amber-400'}`;
    }

    // Top 3 kategori pengeluaran terbesar (saran pengurangan)
    const expenseByCategory = {};
    (this.transactions || []).forEach(tx => {
      if (tx.type === 'expense' && tx.category !== 'Tabungan & Investasi') {
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + Number(tx.amount);
      }
    });
    const topCategories = Object.entries(expenseByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topExpEl) {
      topExpEl.innerHTML = topCategories.map(([cat, total]) => `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 text-xs">
          <span class="text-slate-300 font-medium">${cat}</span>
          <span class="font-mono-num font-bold text-red-400">${this.formatRupiah(total)}</span>
        </div>
      `).join('') || `<p class="text-slate-500 text-xs">Belum ada data pengeluaran.</p>`;
    }
  },

  // Render Kamus Istilah Keuangan Mini
  renderGlossary(filterQuery = '') {
    const container = document.getElementById('glossaryAccordion');
    if (!container) return;

    const list = FinancialEducation.glossary.filter(item => {
      const q = filterQuery.toLowerCase();
      return item.term.toLowerCase().includes(q) || item.definition.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
    });

    if (list.length === 0) {
      container.innerHTML = '<p class="text-sm text-slate-400 py-3 text-center">Istilah tidak ditemukan.</p>';
      return;
    }

    container.innerHTML = list.map((item, idx) => `
      <div class="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-800/40">
        <button onclick="FinVibeApp.toggleAccordion('glossary-item-${idx}')" 
                class="w-full py-3 px-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors">
          <div class="flex items-center gap-2">
            <span class="text-xs px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">${item.category}</span>
            <span class="text-sm font-semibold text-slate-200">${item.term}</span>
          </div>
          <i id="glossary-arrow-${idx}" class="fa-solid fa-chevron-down text-xs text-slate-400 transition-transform"></i>
        </button>
        <div id="glossary-item-${idx}" class="hidden p-4 pt-1 border-t border-slate-700/40 text-xs text-slate-300 leading-relaxed bg-slate-900/30">
          <p class="mb-2">${item.definition}</p>
          <p class="text-amber-400/90 font-medium">💡 <b>Kiat Praktis:</b> ${item.tip}</p>
        </div>
      </div>
    `).join('');
  },

  toggleAccordion(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isHidden = el.classList.contains('hidden');
    el.classList.toggle('hidden', !isHidden);

    const idx = id.split('-')[2];
    const arrow = document.getElementById(`glossary-arrow-${idx}`);
    if (arrow) {
      arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  },

  // Render Gamifikasi Badges & Notifikasi Pencapaian Baru
  renderBadges(stats) {
    const container = document.getElementById('badgesGridContainer');
    if (!container) return;

    const badges = FinancialEducation.checkBadges(stats, this.debts, this.settings, this.transactions);
    
    // Deteksi badge yang baru terbuka
    if (!this.unlockedBadgesCache) {
      this.unlockedBadgesCache = badges.filter(b => b.unlocked).map(b => b.id);
    } else {
      badges.forEach(b => {
        if (b.unlocked && !this.unlockedBadgesCache.includes(b.id)) {
          this.unlockedBadgesCache.push(b.id);
          this.showToast(`🏆 Selamat! Anda meraih badge baru: "${b.title}"!`, 'success');
          if (window.confetti) window.confetti({ particleCount: 90, spread: 65, origin: { y: 0.65 } });
        }
      });
    }

    container.innerHTML = badges.map(b => `
      <div class="p-3.5 rounded-xl border transition-all ${
        b.unlocked 
          ? 'bg-slate-800/80 border-amber-500/30 shadow-lg shadow-amber-500/5' 
          : 'bg-slate-900/40 border-slate-800 opacity-50 grayscale'
      }">
        <div class="flex items-center gap-3">
          <div class="text-2xl p-2 rounded-lg bg-slate-800 border border-slate-700/60">${b.icon}</div>
          <div>
            <div class="flex items-center gap-1.5">
              <h5 class="text-xs font-bold text-slate-100">${b.title}</h5>
              ${b.unlocked ? '<i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i>' : ''}
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5 leading-snug">${b.desc}</p>
          </div>
        </div>
      </div>
    `).join('');
  },

  // Render Riwayat Transaksi (Tabel Desktop & Kartu Mobile)
  renderTransactionsList() {
    const tbody = document.getElementById('transactionsTableBody');
    const mobileCards = document.getElementById('transactionsMobileCards');
    const countBadge = document.getElementById('transactionCountBadge');

    const filtered = this.transactions.filter(tx => {
      // Search
      const q = this.filters.search.toLowerCase();
      const matchSearch = !q || (tx.notes && tx.notes.toLowerCase().includes(q)) || (tx.category && tx.category.toLowerCase().includes(q));
      // Type
      const matchType = this.filters.type === 'all' || tx.type === this.filters.type;
      // Category
      const matchCat = this.filters.category === 'all' || tx.category === this.filters.category;
      return matchSearch && matchType && matchCat;
    }).sort((a, b) => {
      // Urutkan terbaru di atas — pakai createdAt (presisi penuh) jika ada, fallback ke date
      const tA = a.createdAt ? new Date(a.createdAt) : this.parseDateValue(a.date);
      const tB = b.createdAt ? new Date(b.createdAt) : this.parseDateValue(b.date);
      return tB - tA;
    });

    if (countBadge) countBadge.textContent = `${filtered.length} Transaksi`;

    if (filtered.length === 0) {
      const emptyHtml = `
        <div class="py-12 text-center text-slate-400">
          <i class="fa-regular fa-folder-open text-3xl mb-2 text-slate-500"></i>
          <p class="font-medium text-slate-300">Tidak ada riwayat transaksi yang cocok</p>
          <p class="text-xs text-slate-500 mt-1">Coba sesuaikan kata kunci atau filter pencarian Anda.</p>
        </div>
      `;
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-8">${emptyHtml}</td></tr>`;
      if (mobileCards) mobileCards.innerHTML = emptyHtml;
      return;
    }

    // Desktop Table Rows
    if (tbody) {
      tbody.innerHTML = filtered.map(tx => {
        const isInc = tx.type === 'income';
        const isDebt = tx.category === 'Cicilan';
        let badgeClass = isInc ? 'badge-emerald' : (isDebt ? 'badge-violet' : 'badge-crimson');

        let expTypeBadge = '';
        if (!isInc) {
          const et = tx.expenseType || (
            tx.category === 'Cicilan' ? 'tetap'
            : (['Tagihan & Utilitas', 'Internet & Pulsa', 'Belanja & Groceries', 'Transportasi'].includes(tx.category) ? 'variabel'
            : (['Makanan & Kuliner', 'Hiburan & Langganan', 'Belanja Pribadi'].includes(tx.category) ? 'diskresi'
            : (tx.category === 'Kesehatan' ? 'tak_terduga' : 'variabel')))
          );
          const map = {
            tetap: { text: 'Tetap', class: 'bg-blue-500/20 text-blue-300' },
            variabel: { text: 'Variabel', class: 'bg-amber-500/20 text-amber-300' },
            diskresi: { text: 'Diskresi', class: 'bg-purple-500/20 text-purple-300' },
            tak_terduga: { text: 'Tak Terduga', class: 'bg-rose-500/20 text-rose-300' }
          };
          if (map[et]) {
            expTypeBadge = `<span class="text-[9px] px-1.5 py-0.5 rounded font-medium ${map[et].class} ml-1">${map[et].text}</span>`;
          }
        }

        return `
          <tr class="border-b border-slate-800/80 hover:bg-slate-800/30 transition-colors">
            <td class="py-3 px-4 text-xs text-slate-400">${this.formatDateDisplay(tx.date, tx.createdAt)}</td>
            <td class="py-3 px-4">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}">
                <i class="fa-solid ${isInc ? 'fa-arrow-down' : 'fa-arrow-up'} text-[10px]"></i>
                ${tx.category}
              </span>
              ${expTypeBadge}
            </td>
            <td class="py-3 px-4 text-xs text-slate-200">
              <div class="flex items-center gap-2">
                <span>${tx.notes || '-'}</span>
                ${tx.photoProofUrl ? `
                  <button type="button" onclick="FinVibeApp.previewPhoto('${tx.photoProofUrl}')" 
                          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors" 
                          title="Lihat Foto Bukti">
                    <i class="fa-solid fa-paperclip"></i> Bukti
                  </button>
                ` : ''}
              </div>
            </td>
            <td class="py-3 px-4 text-right font-mono-num font-bold text-xs ${isInc ? 'text-emerald-400' : 'text-red-400'}">
              ${isInc ? '+' : '-'} ${this.formatRupiah(tx.amount)}
            </td>
            <td class="py-3 px-4 text-right">
              <div class="inline-flex items-center gap-1">
                <button onclick="FinVibeApp.openTransactionModal(true, '${tx.id}')" 
                        class="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors text-xs" title="Edit">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="FinVibeApp.deleteTransaction('${tx.id}')" 
                        class="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors text-xs" title="Hapus">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Mobile Vertical Cards
    if (mobileCards) {
      mobileCards.innerHTML = filtered.map(tx => {
        const isInc = tx.type === 'income';
        const isDebt = tx.category === 'Cicilan';
        let badgeClass = isInc ? 'badge-emerald' : (isDebt ? 'badge-violet' : 'badge-crimson');

        let expTypeBadge = '';
        if (!isInc) {
          const et = tx.expenseType || (
            tx.category === 'Cicilan' ? 'tetap'
            : (['Tagihan & Utilitas', 'Internet & Pulsa', 'Belanja & Groceries', 'Transportasi'].includes(tx.category) ? 'variabel'
            : (['Makanan & Kuliner', 'Hiburan & Langganan', 'Belanja Pribadi'].includes(tx.category) ? 'diskresi'
            : (tx.category === 'Kesehatan' ? 'tak_terduga' : 'variabel')))
          );
          const map = {
            tetap: { text: 'Tetap', class: 'bg-blue-500/20 text-blue-300' },
            variabel: { text: 'Variabel', class: 'bg-amber-500/20 text-amber-300' },
            diskresi: { text: 'Diskresi', class: 'bg-purple-500/20 text-purple-300' },
            tak_terduga: { text: 'Tak Terduga', class: 'bg-rose-500/20 text-rose-300' }
          };
          if (map[et]) {
            expTypeBadge = `<span class="text-[9px] px-1.5 py-0.2 rounded font-medium ${map[et].class}">${map[et].text}</span>`;
          }
        }

        return `
          <div class="glass-card p-3.5 border border-slate-700/50 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm ${badgeClass}">
                <i class="fa-solid ${isInc ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
              </div>
              <div>
                <h6 class="text-xs font-bold text-slate-200">${tx.notes || tx.category}</h6>
                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span class="text-[10px] text-slate-400">${this.formatDateDisplay(tx.date, tx.createdAt)}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded font-medium ${badgeClass}">${tx.category}</span>
                  ${expTypeBadge}
                  ${tx.photoProofUrl ? `
                    <button type="button" onclick="FinVibeApp.previewPhoto('${tx.photoProofUrl}')" 
                            class="text-[10px] text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-0.5">
                      <i class="fa-solid fa-paperclip"></i> Bukti
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xs font-bold font-mono-num ${isInc ? 'text-emerald-400' : 'text-red-400'}">
                ${isInc ? '+' : '-'} ${this.formatRupiah(tx.amount)}
              </p>
              <div class="flex items-center justify-end gap-2 mt-1">
                <button onclick="FinVibeApp.openTransactionModal(true, '${tx.id}')" class="text-slate-400 hover:text-slate-200 text-xs">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="FinVibeApp.deleteTransaction('${tx.id}')" class="text-slate-400 hover:text-red-400 text-xs">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  // Modal Transaksi: Tambah & Edit
  openTransactionModal(isEdit = false, txId = null) {
    const modal = document.getElementById('transactionModal');
    const titleEl = document.getElementById('txModalTitle');
    const form = document.getElementById('transactionForm');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('txEditId').value = '';
    document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
    this.clearSelectedPhoto('tx');

    if (isEdit && txId) {
      const tx = this.transactions.find(t => t.id === txId);
      if (tx) {
        titleEl.textContent = 'Edit Transaksi';
        document.getElementById('txEditId').value = tx.id;
        document.getElementById('txType').value = tx.type;
        document.getElementById('txAmount').value = tx.amount ? tx.amount.toLocaleString('id-ID') : '';
        document.getElementById('txCategory').value = tx.category;
        document.getElementById('txDate').value = tx.date;
        document.getElementById('txNotes').value = tx.notes || '';
        const expTypeEl = document.getElementById('txExpenseType');
        if (expTypeEl) expTypeEl.value = tx.expenseType || 'variabel';
        this.updateTxTypeUI(tx.type);

        if (tx.photoProofUrl) {
          const previewImg = document.getElementById('txPhotoPreview');
          const previewBox = document.getElementById('txPhotoPreviewContainer');
          const nameEl = document.getElementById('txPhotoFileName');
          if (previewImg) previewImg.src = tx.photoProofUrl;
          if (previewBox) previewBox.classList.remove('hidden');
          if (nameEl) nameEl.textContent = 'Foto Tersimpan (Klik untuk lihat)';
        }
      }
    } else {
      titleEl.textContent = '+ Tambah Transaksi Baru';
      const expTypeEl = document.getElementById('txExpenseType');
      if (expTypeEl) expTypeEl.value = 'variabel';
      this.updateTxTypeUI('expense');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeTransactionModal() {
    const modal = document.getElementById('transactionModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  handleCategoryChange(selectEl) {
    const cat = selectEl.value;
    const typeEl = document.getElementById('txExpenseType');
    if (!typeEl) return;
    if (cat === 'Cicilan') {
      typeEl.value = 'tetap';
    } else if (['Tagihan & Utilitas', 'Internet & Pulsa', 'Belanja & Groceries', 'Transportasi'].includes(cat)) {
      typeEl.value = 'variabel';
    } else if (['Makanan & Kuliner', 'Hiburan & Langganan', 'Belanja Pribadi'].includes(cat)) {
      typeEl.value = 'diskresi';
    } else if (cat === 'Kesehatan') {
      typeEl.value = 'tak_terduga';
    }
  },

  updateTxTypeUI(type) {
    const incomeBtn = document.getElementById('txTypeIncomeBtn');
    const expenseBtn = document.getElementById('txTypeExpenseBtn');
    const typeInput = document.getElementById('txType');
    const catSelect = document.getElementById('txCategory');
    const expGroup = document.getElementById('txExpenseTypeGroup');

    typeInput.value = type;

    if (type === 'income') {
      incomeBtn.className = 'flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold transition-all';
      expenseBtn.className = 'flex-1 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold hover:text-slate-200 transition-all';
      if (expGroup) expGroup.classList.add('hidden');

      // Kategori Pemasukan
      catSelect.innerHTML = `
        <option value="Gaji">💼 Gaji & Tunjangan</option>
        <option value="Freelance">💻 Proyek / Freelance</option>
        <option value="Investasi">📈 Dividen & Investasi</option>
        <option value="Bonus">🎁 Hadiah & Bonus</option>
        <option value="Lainnya">📦 Pemasukan Lainnya</option>
      `;
    } else {
      expenseBtn.className = 'flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-bold transition-all';
      incomeBtn.className = 'flex-1 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold hover:text-slate-200 transition-all';
      if (expGroup) expGroup.classList.remove('hidden');

      // Kategori Pengeluaran
      catSelect.innerHTML = `
        <option value="Belanja & Groceries">🛒 Belanja & Groceries</option>
        <option value="Makanan & Kuliner">☕ Makanan & Kuliner</option>
        <option value="Tagihan & Utilitas">⚡ Tagihan & Utilitas</option>
        <option value="Internet & Pulsa">📡 Internet & Pulsa</option>
        <option value="Transportasi">🚗 Transportasi & Bensin</option>
        <option value="Cicilan">💳 Cicilan & Pinjaman</option>
        <option value="Hiburan & Langganan">🎬 Hiburan & Langganan</option>
        <option value="Belanja Pribadi">🛍️ Belanja Pribadi</option>
        <option value="Tabungan & Investasi">🛡️ Tabungan & Investasi</option>
        <option value="Kesehatan">💊 Kesehatan</option>
        <option value="Lainnya">📦 Pengeluaran Lainnya</option>
      `;
    }
  },

  // Simpan Transaksi Baru / Edit (Mendukung upload bukti foto & sinkronisasi Google Sheets)
  async handleSaveTransaction(e) {
    e.preventDefault();
    const editId = document.getElementById('txEditId').value;
    const type = document.getElementById('txType').value;
    const amountInput = document.getElementById('txAmount');
    // Support both plain number input and formatted text (e.g. "4.500.000")
    const amount = this.getRawAmount('txAmount') || Number(amountInput.value);
    const category = document.getElementById('txCategory').value;
    const date = document.getElementById('txDate').value;
    const notes = document.getElementById('txNotes').value.trim();
    const expenseType = type === 'expense' ? (document.getElementById('txExpenseType')?.value || 'variabel') : null;

    // Validasi input nominal dengan indikator error merah
    if (!amount || amount <= 0) {
      amountInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/40');
      amountInput.focus();
      this.showToast('Nominal transaksi harus lebih besar dari Rp 0!', 'danger');
      return;
    } else {
      amountInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/40');
    }

    let photoUrl = '';
    // Jika ada foto baru yang dipilih dan login Google
    if (this.pendingPhotos.tx && window.GoogleAuth && GoogleAuth.isSignedIn()) {
      try {
        const profile = GoogleAuth.getUserProfile();
        this.showToast('Mengunggah bukti foto struk ke Google Drive...', 'info');
        const uploadResult = await SheetsApi.uploadPhotoToDrive(this.pendingPhotos.tx, this.pendingPhotos.tx.name, profile.email);
        photoUrl = uploadResult.viewUrl;
      } catch (uploadErr) {
        console.warn('[BigBoz] Gagal upload foto ke Drive, transaksi tetap dicatat:', uploadErr);
        this.showToast('Gagal upload foto ke Drive: ' + uploadErr.message, 'warning');
      }
    }

    if (editId) {
      const idx = this.transactions.findIndex(t => t.id === editId);
      if (idx !== -1) {
        const existingTx = this.transactions[idx];
        const updatedTx = {
          ...existingTx,
          type,
          amount,
          category,
          expenseType,
          date,
          notes,
          photoProofUrl: photoUrl || existingTx.photoProofUrl || ''
        };
        this.transactions[idx] = updatedTx;
        this.syncToSheets('UPDATE_TRANSACTION', updatedTx);
        this.showToast(`Transaksi ${type === 'income' ? 'pemasukan' : 'pengeluaran'} sebesar Rp ${amount.toLocaleString('id-ID')} berhasil diperbarui & disinkronkan!`, 'success');
      }
    } else {
      const newTx = {
        id: (crypto.randomUUID ? crypto.randomUUID() : 'tx-' + Date.now()),
        type,
        amount,
        category,
        expenseType,
        date: date || new Date().toISOString().split('T')[0],
        notes,
        source: this._lastTxSource || 'manual',
        createdAt: new Date().toISOString(),
        photoProofUrl: photoUrl || ''
      };
      this.transactions.unshift(newTx);
      this._lastTxSource = 'manual';
      this.syncToSheets('ADD_TRANSACTION', newTx);
      this.showToast(`Transaksi ${type === 'income' ? 'pemasukan' : 'pengeluaran'} sebesar Rp ${amount.toLocaleString('id-ID')} berhasil dicatat & disinkronkan!`, 'success');

      // 🔄 Auto-sinkron Pengaturan saat input Gaji
      const isGaji = type === 'income' && (
        category === 'Gaji' ||
        category === 'Gaji & Tunjangan' ||
        (category && category.toLowerCase().includes('gaji')) ||
        category === 'Bonus' ||
        category === 'Bonus & Komisi'
      );
      if (isGaji) {
        let txDate;
        if (date) txDate = new Date(date);
        else if (newTx.createdAt) txDate = new Date(newTx.createdAt);
        else txDate = new Date();
        const payDay = !isNaN(txDate.getTime()) ? txDate.getDate() : 24;

        this.settings.monthlyIncome = amount;
        this.settings.payDay = payDay;
        this.saveState();
        this.showToast(`⚙️ Pengaturan disinkronkan otomatis: Pemasukan Rp ${amount.toLocaleString('id-ID')}, Tanggal Gajian: tgl ${payDay}`, 'info');
      }
    }

    this.clearSelectedPhoto('tx');
    this.closeTransactionModal();
    this.renderAll();
  },

  // Hapus Transaksi
  deleteTransaction(id) {
    if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
    const tx = this.transactions.find(t => t.id === id);
    this.transactions = this.transactions.filter(t => t.id !== id);
    if (tx) {
      this.syncToSheets('DELETE_TRANSACTION', tx);
    } else {
      this.saveState();
    }
    this.renderAll();
    this.showToast('Transaksi telah dihapus.', 'info');
  },

  // Tandai Cicilan Sudah Dibayar Bulan Ini (Diarahkan ke Modal dengan Bukti Foto)
  markDebtPaid(debtId) {
    this.openPayDebtModal(debtId);
  },

  // Modal Cicilan
  openDebtModal(isEdit = false, debtId = null) {
    const modal = document.getElementById('debtModal');
    const titleEl = document.getElementById('debtModalTitle');
    const form = document.getElementById('debtForm');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('debtEditId').value = '';
    
    // Clear error highlights
    ['debtName', 'debtMonthlyPayment', 'debtTotalTenor', 'debtRemainingTenor'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('border-red-500', 'ring-2', 'ring-red-500/40');
    });

    if (isEdit && debtId) {
      const d = this.debts.find(item => item.id === debtId);
      if (d) {
        titleEl.textContent = 'Edit Data Cicilan';
        document.getElementById('debtEditId').value = d.id;
        document.getElementById('debtName').value = d.name;
        document.getElementById('debtType').value = d.type;
        document.getElementById('debtTotalAmount').value = d.totalAmount || '';
        document.getElementById('debtMonthlyPayment').value = d.monthlyPayment;
        document.getElementById('debtTotalTenor').value = d.totalTenorMonths;
        document.getElementById('debtRemainingTenor').value = d.remainingTenorMonths;
        document.getElementById('debtInterestRate').value = d.interestRate || '';
        document.getElementById('debtDueDay').value = d.dueDay;
      }
    } else {
      titleEl.textContent = '+ Tambah Cicilan Baru';
      document.getElementById('debtDueDay').value = 10;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeDebtModal() {
    const modal = document.getElementById('debtModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  handleSaveDebt(e) {
    e.preventDefault();
    const editId = document.getElementById('debtEditId').value;
    const nameInput = document.getElementById('debtName');
    const paymentInput = document.getElementById('debtMonthlyPayment');
    const tenorInput = document.getElementById('debtTotalTenor');

    const name = nameInput.value.trim();
    const type = document.getElementById('debtType').value;
    const totalAmount = Number(document.getElementById('debtTotalAmount').value) || 0;
    const monthlyPayment = Number(paymentInput.value);
    const totalTenorMonths = Number(tenorInput.value);
    const remainingTenorMonths = Number(document.getElementById('debtRemainingTenor').value);
    const interestRate = Number(document.getElementById('debtInterestRate').value) || 0;
    const dueDay = Number(document.getElementById('debtDueDay').value) || 1;

    let hasError = false;
    if (!name) {
      nameInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/40');
      hasError = true;
    } else {
      nameInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/40');
    }

    if (!monthlyPayment || monthlyPayment <= 0) {
      paymentInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/40');
      hasError = true;
    } else {
      paymentInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/40');
    }

    if (!totalTenorMonths || totalTenorMonths <= 0) {
      tenorInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/40');
      hasError = true;
    } else {
      tenorInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/40');
    }

    if (hasError) {
      this.showToast('Mohon lengkapi formulir cicilan yang ditandai merah!', 'danger');
      return;
    }

    if (editId) {
      const idx = this.debts.findIndex(d => d.id === editId);
      if (idx !== -1) {
        // Hitung paidTenorMonths dari remainingTenorMonths yang diinput user
        const paidTenorMonths = Math.max(0, totalTenorMonths - remainingTenorMonths);
        const updated = {
          ...this.debts[idx],
          name, type, totalAmount, monthlyPayment,
          totalTenorMonths, remainingTenorMonths,
          paidTenorMonths,
          interestRate, dueDay
        };
        this.debts[idx] = updated;
        this.saveState();
        this.closeDebtModal();
        this.renderAll();
        this.showToast(`Data cicilan "${name}" berhasil diperbarui.`, 'success');
        // Sinkron ke Sheets di background
        this.syncToSheets('UPDATE_DEBT', updated);
      }
    } else {
      const paidTenorMonths = Math.max(0, totalTenorMonths - remainingTenorMonths);
      const newDebt = {
        id: 'debt-' + Date.now(),
        name,
        type,
        totalAmount,
        monthlyPayment,
        totalTenorMonths,
        remainingTenorMonths,
        paidTenorMonths,
        interestRate,
        dueDay,
        createdAt: new Date().toISOString()
      };
      this.debts.push(newDebt);
      this.saveState();
      this.closeDebtModal();
      this.renderAll();
      this.showToast(`Cicilan "${name}" berhasil ditambahkan ke portofolio BigBoz!`, 'success');
      // Sinkron ke Sheets di background
      this.syncToSheets('ADD_DEBT', newDebt);
    }
  },

  deleteDebt(id) {
    if (!confirm('Hapus cicilan ini dari daftar pemantauan?')) return;
    const debt = this.debts.find(d => d.id === id);
    this.debts = this.debts.filter(d => d.id !== id);
    this.saveState();
    this.renderAll();
    this.showToast('Cicilan telah dihapus.', 'info');
    // Sinkron penghapusan ke Sheets di background
    if (debt) this.syncToSheets('DELETE_DEBT', debt);
  },

  // Modal Pengaturan
  openSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    const monthlyIncInput = document.getElementById('settingMonthlyIncome');
    if (monthlyIncInput) {
      monthlyIncInput.value = this.settings.monthlyIncome ?? '';
    }
    document.getElementById('settingSavingsTarget').value = this.settings.monthlySavingsTarget ?? '';
    document.getElementById('settingEmergencyFund').value = this.settings.currentEmergencyFund ?? '';
    const payDayInput = document.getElementById('settingPayDay');
    if (payDayInput) payDayInput.value = this.settings.payDay || '';
    document.getElementById('settingProfileType').value = this.settings.profileType || 'single';
    document.getElementById('settingThemeSelect').value = this.currentTheme;

    // Perbarui tampilan status Google Auth menggunakan state real (bukan dummy data)
    this.updateAuthUI();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  handleSaveSettings(e) {
    e.preventDefault();
    const monthlyIncInput = document.getElementById('settingMonthlyIncome');
    if (monthlyIncInput) {
      this.settings.monthlyIncome = Number(monthlyIncInput.value) || 16750000;
    }
    this.settings.monthlySavingsTarget = Number(document.getElementById('settingSavingsTarget').value) || 3500000;
    this.settings.currentEmergencyFund = Number(document.getElementById('settingEmergencyFund').value) || 0;
    const payDaySave = document.getElementById('settingPayDay');
    if (payDaySave) this.settings.payDay = Number(payDaySave.value) || 0;
    this.settings.profileType = document.getElementById('settingProfileType').value;
    
    const chosenTheme = document.getElementById('settingThemeSelect').value;
    if (chosenTheme !== this.currentTheme) {
      this.currentTheme = chosenTheme;
      this.applyTheme(this.currentTheme);
    }

    this.saveState();
    this.closeSettingsModal();
    this.renderAll();
    this.showToast('Pengaturan profil keuangan & Google Sheets berhasil disimpan!', 'success');
    // Sinkron pengaturan ke Sheets di background
    this.syncToSheets('UPDATE_SETTINGS', this.settings);
  },

  // Ekspor & Impor JSON Backup
  exportJSON() {
    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      transactions: this.transactions,
      debts: this.debts,
      settings: this.settings
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bigboz_finance_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Backup data JSON berhasil diunduh.', 'success');
  },

  importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.transactions && imported.debts) {
          this.transactions = imported.transactions;
          this.debts = imported.debts;
          if (imported.settings) this.settings = imported.settings;
          this.saveState();
          this.renderAll();
          this.closeSettingsModal();
          this.showToast('Data berhasil diimpor & dipulihkan!', 'success');
        } else {
          this.showToast('Format file JSON tidak sesuai!', 'danger');
        }
      } catch (err) {
        this.showToast('Gagal membaca file JSON: ' + err.message, 'danger');
      }
    };
    reader.readAsText(file);
  },

  // Muat Ulang Data Sampel Demo
  loadDemoData() {
    if (!confirm('Muat ulang data demo awal? Perubahan saat ini akan diganti dengan data sampel portofolio.')) return;
    this.transactions = [...DEFAULT_TRANSACTIONS];
    this.debts = [...DEFAULT_DEBTS];
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveState();
    this.closeSettingsModal();
    this.renderAll();
    this.showToast('Data sampel demo realistis berhasil dimuat!', 'success');
  },

  // Reset Semua Data
  clearAllData() {
    if (!confirm('PERINGATAN: Seluruh catatan transaksi dan cicilan Anda akan dihapus bersih dari perangkat DAN Google Sheets. Lanjutkan?')) return;

    this.transactions = [];
    this.debts = [];
    this.settings = { ...DEFAULT_SETTINGS, monthlySavingsTarget: 0, currentEmergencyFund: 0 };

    // Simpan timestamp kapan data dihapus — dipakai untuk blokir restore dari cloud
    const clearedAt = new Date().toISOString();
    localStorage.setItem('bigboz_cleared_at', clearedAt);

    // Hapus juga dari Google Sheets agar tidak muncul kembali saat refresh
    if (window.GoogleAuth && GoogleAuth.isSignedIn() && this.spreadsheetId) {
      SheetsApi.clearSheetData(this.spreadsheetId)
        .then(() => this.showToast('✅ Data lokal & Google Sheets berhasil dikosongkan.', 'success'))
        .catch(e => {
          console.warn('[BigBoz] Gagal hapus data dari Sheets:', e);
          this.showToast('Data lokal dihapus. Gagal hapus dari Sheets (coba manual).', 'warning');
        });
    } else {
      this.showToast('Seluruh data lokal berhasil dibersihkan.', 'info');
    }

    this.saveState();
    this.closeSettingsModal();
    this.renderAll();
  },

  // Trigger Voice Input
  triggerVoiceNote(micButton) {
    const notesInput = document.getElementById('txNotes');
    const amountInput = document.getElementById('txAmount');

    FinVibeSpeech.toggle(
      micButton,
      // onResult
      (parsed) => {
        if (notesInput && parsed.text) {
          notesInput.value = parsed.text;
          this.showToast(`Catatan suara ditambahkan: "${parsed.text}"`, 'info');
        }
        if (amountInput && parsed.amount && (!amountInput.value || Number(amountInput.value) === 0)) {
          amountInput.value = parsed.amount;
          amountInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/40');
          this.showToast(`Nominal Rp ${parsed.amount.toLocaleString('id-ID')} terdeteksi dari suara!`, 'success');
        }
      },
      // onStateChange
      (isListening) => {
        if (micButton) {
          if (isListening) {
            micButton.classList.add('mic-recording');
            micButton.title = 'Mendengarkan... Silakan bicara';
          } else {
            micButton.classList.remove('mic-recording');
            micButton.title = 'Klik untuk bicara (Web Speech API)';
          }
        }
      }
    );
  },

  // Toast Notification System
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const typeIcons = {
      success: 'fa-circle-check text-emerald-400',
      danger: 'fa-circle-xmark text-red-400',
      warning: 'fa-triangle-exclamation text-amber-400',
      info: 'fa-circle-info text-sky-400'
    };

    toast.className = `toast-item glass-card p-3.5 border border-slate-700/60 shadow-xl flex items-center gap-3 min-w-[280px] max-w-sm text-xs text-slate-100`;
    toast.innerHTML = `
      <i class="fa-solid ${typeIcons[type] || typeIcons.info} text-base shrink-0"></i>
      <div class="flex-1 leading-relaxed">${message}</div>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-200 p-1">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, 3800);
  },

  // Event Listeners Binding
  setupEventListeners() {
    // Search input riwayat
    const searchInput = document.getElementById('txSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.renderTransactionsList();
      });
    }

    // Filter Type
    const filterType = document.getElementById('txFilterType');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        this.filters.type = e.target.value;
        this.renderTransactionsList();
      });
    }

    // Filter Kategori
    const filterCat = document.getElementById('txFilterCategory');
    if (filterCat) {
      filterCat.addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.renderTransactionsList();
      });
    }

    // Search Kamus
    const searchGlossary = document.getElementById('glossarySearchInput');
    if (searchGlossary) {
      searchGlossary.addEventListener('input', (e) => {
        this.renderGlossary(e.target.value);
      });
    }

    // Simulasi Pelunasan Slider / Input
    const simExtraInput = document.getElementById('simExtraPayment');
    const simSelect = document.getElementById('simDebtSelect');
    if (simExtraInput) {
      simExtraInput.addEventListener('input', () => this.runPayoffSimulation());
    }
    if (simSelect) {
      simSelect.addEventListener('change', () => this.runPayoffSimulation());
    }

    // Form Submits
    const txForm = document.getElementById('transactionForm');
    if (txForm) txForm.addEventListener('submit', (e) => this.handleSaveTransaction(e));

    const debtForm = document.getElementById('debtForm');
    if (debtForm) debtForm.addEventListener('submit', (e) => this.handleSaveDebt(e));

    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', (e) => this.handleSaveSettings(e));

    // Tombol Download PDF
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        const stats = this.calculateStats();
        FinVibePDF.exportReport({
          stats,
          debts: this.debts,
          transactions: this.transactions,
          settings: this.settings,
          healthScore: this.currentHealthScore
        });
      });
    }
  }
};

// Global Helper untuk memudahkan pemanggilan dari inline event handler
function showToast(msg, type) {
  FinVibeApp.showToast(msg, type);
}

// Alias BigBozFinanceApp
window.BigBozFinanceApp = FinVibeApp;

// Inisialisasi saat DOM ready
document.addEventListener('DOMContentLoaded', () => {
  FinVibeApp.init();
});
