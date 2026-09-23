/**
 * BigBoz - Google Sheets API v4 & Google Drive API v3 Integration Layer
 * Menangani seluruh operasi CRUD, auto-provisioning database, photo upload ke Drive,
 * batchGet saat inisialisasi, dynamic header mapping, debouncing queue, dan exponential backoff.
 */

const SheetsApi = {
  BASE_SHEETS_URL: 'https://sheets.googleapis.com/v4/spreadsheets',
  BASE_DRIVE_URL: 'https://www.googleapis.com/drive/v3/files',
  BASE_UPLOAD_URL: 'https://www.googleapis.com/upload/drive/v3/files',

  // Cache sheetId numerik (diperlukan untuk batchUpdate deleteDimension)
  _sheetMetadataCache: {},
  // Cache header mapping { [sheetTitle]: { [colName]: colIndex } }
  _headerMappings: {},

  // Antrean debounce untuk penambahan cepat (batching)
  _syncQueue: {
    transactions: [],
    timer: null,
    isFlushing: false
  },

  // =========================================================================
  // HTTP CLIENT WITH EXPONENTIAL BACKOFF & 401 SILENT RETRY
  // =========================================================================

  async fetchWithRetry(url, options = {}, retries = 3, backoffMs = 1000) {
    let token = await GoogleAuth.getValidAccessToken();
    if (!token) {
      throw new Error('NO_TOKEN: Pengguna belum login atau token tidak tersedia.');
    }

    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    };

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const response = await fetch(url, { ...options, headers });

        // Sukses
        if (response.ok) {
          return response;
        }

        // 401 Unauthorized -> Token kedaluwarsa atau izin dicabut
        if (response.status === 401 && attempt === 0) {
          console.warn('[SheetsApi] HTTP 401 diterima, mencoba silent refresh token...');
          try {
            token = await GoogleAuth.refreshAccessToken();
            headers['Authorization'] = `Bearer ${token}`;
            attempt++;
            continue; // Ulangi sekali lagi dengan token baru
          } catch (refreshErr) {
            console.error('[SheetsApi] Gagal refresh token setelah 401:', refreshErr);
            throw new Error('AUTH_EXPIRED: Sesi Google telah berakhir. Silakan login kembali.');
          }
        }

        // 429 Too Many Requests atau 503 Service Unavailable -> Rate Limit, lakukan Exponential Backoff
        if (response.status === 429 || response.status === 503) {
          attempt++;
          if (attempt > retries) {
            const errBody = await response.text();
            throw new Error(`RATE_LIMIT: Batas frekuensi Google API tercapai (HTTP ${response.status}). Silakan coba beberapa saat lagi.`);
          }
          // Exponential backoff + jitter
          const delay = (Math.pow(2, attempt - 1) * backoffMs) + Math.floor(Math.random() * 500);
          console.warn(`[SheetsApi] HTTP ${response.status} (Rate limit). Menunggu ${delay}ms sebelum retry ke-${attempt}...`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }

        // 404 Not Found -> Spreadsheet atau file dihapus dari Drive
        if (response.status === 404) {
          throw new Error('FILE_NOT_FOUND: Spreadsheet atau file Drive tidak ditemukan (mungkin telah dihapus dari Google Drive).');
        }

        // Error HTTP lainnya
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);

      } catch (err) {
        // Jika error jaringan murni
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
          attempt++;
          if (attempt > retries) {
            throw new Error('OFFLINE_ERROR: Gagal terhubung ke Google API. Pastikan internet Anda aktif.');
          }
          const delay = (Math.pow(2, attempt - 1) * backoffMs) + 300;
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        throw err;
      }
    }
  },

  // =========================================================================
  // GOOGLE DRIVE: AUTO-DISCOVERY & FOLDER BUKTI TRANSAKSI
  // =========================================================================

  // Mencari spreadsheet BigBoz di Drive user
  async findDatabaseSpreadsheet(userEmail) {
    const filename = `BigBoz-Database-${userEmail}`;
    const q = `name = '${filename}' and trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'`;
    const url = `${this.BASE_DRIVE_URL}?q=${encodeURIComponent(q)}&fields=files(id,name,appProperties,webViewLink)&pageSize=1`;

    const res = await this.fetchWithRetry(url);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  },

  // Mencari atau membuat folder "BigBoz-Bukti-Transaksi" di Drive
  async getOrCreateProofFolder(userEmail) {
    const folderKey = `bigboz_proof_folder_${userEmail}`;
    const cachedFolderId = localStorage.getItem(folderKey);
    if (cachedFolderId) return cachedFolderId;

    const folderName = 'BigBoz-Bukti-Transaksi';
    const q = `name = '${folderName}' and trashed = false and mimeType = 'application/vnd.google-apps.folder'`;
    const searchUrl = `${this.BASE_DRIVE_URL}?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;

    try {
      const res = await this.fetchWithRetry(searchUrl);
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        const folderId = data.files[0].id;
        localStorage.setItem(folderKey, folderId);
        return folderId;
      }
    } catch (e) {
      console.warn('[SheetsApi] Gagal mencari folder bukti, mencoba buat baru:', e);
    }

    // Buat folder baru di Google Drive user
    const createUrl = `${this.BASE_DRIVE_URL}?fields=id,name`;
    const body = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Folder penyimpanan otomatis foto bukti transaksi dan pembayaran cicilan aplikasi BigBoz',
      appProperties: { app: 'BigBoz', purpose: 'proof_receipts', owner: userEmail }
    };

    const createRes = await this.fetchWithRetry(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const newFolder = await createRes.json();
    localStorage.setItem(folderKey, newFolder.id);
    return newFolder.id;
  },

  // Upload file foto (Struk / Bukti Bayar) ke Google Drive user secara serverless
  async uploadPhotoToDrive(fileBlob, filename, userEmail) {
    const folderId = await this.getOrCreateProofFolder(userEmail);
    const safeFilename = `Bukti_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const metadata = {
      name: safeFilename,
      parents: [folderId],
      description: 'Bukti pembayaran / transaksi BigBoz',
      appProperties: { app: 'BigBoz', uploadedBy: userEmail }
    };

    // Multipart upload ke Google Drive
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const reader = new FileReader();
    const fileDataPromise = new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(fileBlob);
    });

    const fileBuffer = await fileDataPromise;
    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${fileBlob.type || 'image/jpeg'}\r\n\r\n`;

    // Gabungkan ArrayBuffer
    const metaBytes = new TextEncoder().encode(metadataPart);
    const closeBytes = new TextEncoder().encode(closeDelimiter);
    const totalLength = metaBytes.length + fileBuffer.byteLength + closeBytes.length;
    const combinedBuffer = new Uint8Array(totalLength);

    combinedBuffer.set(metaBytes, 0);
    combinedBuffer.set(new Uint8Array(fileBuffer), metaBytes.length);
    combinedBuffer.set(closeBytes, metaBytes.length + fileBuffer.byteLength);

    const uploadUrl = `${this.BASE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink`;
    const uploadRes = await this.fetchWithRetry(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: combinedBuffer
    });

    const uploadData = await uploadRes.json();
    console.log('[SheetsApi] Berhasil upload foto bukti ke Google Drive:', uploadData);

    return {
      fileId: uploadData.id,
      name: uploadData.name,
      viewUrl: uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`,
      downloadUrl: uploadData.webContentLink,
      thumbnailUrl: uploadData.thumbnailLink || uploadData.webViewLink
    };
  },

  // =========================================================================
  // SPREADSHEET AUTO-PROVISIONING (STRUKTUR 5 SHEET & HEADER)
  // =========================================================================

  // Skema Header Resmi
  SCHEMA_HEADERS: {
    Transaksi: ['id', 'tanggal', 'tipe', 'kategori', 'nominal', 'catatan', 'sumber', 'dibuat_pada', 'bukti_foto'],
    Cicilan: ['id', 'nama', 'jenis', 'total_pinjaman', 'cicilan_per_bulan', 'bunga_persen', 'tenor_bulan', 'tenor_terbayar', 'tanggal_jatuh_tempo', 'status', 'dibuat_pada'],
    RiwayatBayarCicilan: ['id', 'cicilan_id', 'tanggal_bayar', 'nominal', 'terlambat', 'bukti_foto'],
    Kategori: ['id', 'nama', 'tipe', 'warna', 'ikon'],
    Pengaturan: ['key', 'value']
  },

  // Data Default Kategori Awal
  DEFAULT_CATEGORIES_DATA: [
    ['cat-1', 'Makanan', 'expense', '#F59E0B', 'utensils'],
    ['cat-2', 'Transportasi', 'expense', '#38BDF8', 'car'],
    ['cat-3', 'Tagihan', 'expense', '#8B5CF6', 'receipt'],
    ['cat-4', 'Hiburan', 'expense', '#EC4899', 'gamepad'],
    ['cat-5', 'Belanja', 'expense', '#10B981', 'bag-shopping'],
    ['cat-6', 'Kesehatan', 'expense', '#EF4444', 'heart-pulse'],
    ['cat-7', 'Gaji', 'income', '#10B981', 'wallet'],
    ['cat-8', 'Cicilan', 'expense', '#8B5CF6', 'landmark'],
    ['cat-9', 'Lainnya', 'expense', '#64748B', 'ellipsis']
  ],

  // Membuat Spreadsheet Baru Lengkap dengan 5 Sheet & Header
  async createDatabaseSpreadsheet(userEmail) {
    const filename = `BigBoz-Database-${userEmail}`;
    console.log(`[SheetsApi] Membuat spreadsheet database baru: ${filename}`);

    const createPayload = {
      properties: {
        title: filename
      },
      sheets: [
        { properties: { title: 'Transaksi', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Cicilan', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'RiwayatBayarCicilan', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Kategori', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Pengaturan', gridProperties: { frozenRowCount: 1 } } }
      ]
    };

    const res = await this.fetchWithRetry(this.BASE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload)
    });

    const newSheet = await res.json();
    const spreadsheetId = newSheet.spreadsheetId;

    // Cache metadata sheetId numerik
    this._cacheSheetNumericIds(newSheet);

    // Tandai appProperties di Drive file agar mudah diidentifikasi
    try {
      const patchUrl = `${this.BASE_DRIVE_URL}/${spreadsheetId}?fields=id,appProperties`;
      await this.fetchWithRetry(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appProperties: { app: 'BigBoz', version: '2.0', owner: userEmail }
        })
      });
    } catch (err) {
      console.warn('[SheetsApi] Gagal mengatur appProperties pada spreadsheet Drive:', err);
    }

    // Inisialisasi baris Header dan Default Categories / Settings via batchUpdate
    const initDataPayload = {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: 'Transaksi!A1:I1',
          values: [this.SCHEMA_HEADERS.Transaksi]
        },
        {
          range: 'Cicilan!A1:K1',
          values: [this.SCHEMA_HEADERS.Cicilan]
        },
        {
          range: 'RiwayatBayarCicilan!A1:F1',
          values: [this.SCHEMA_HEADERS.RiwayatBayarCicilan]
        },
        {
          range: 'Kategori!A1:E10',
          values: [
            this.SCHEMA_HEADERS.Kategori,
            ...this.DEFAULT_CATEGORIES_DATA
          ]
        },
        {
          range: 'Pengaturan!A1:B6',
          values: [
            this.SCHEMA_HEADERS.Pengaturan,
            ['pemasukan_bulanan', '16750000'],
            ['target_tabungan', '3500000'],
            ['dana_darurat_saat_ini', '18000000'],
            ['tipe_profil', 'single'],
            ['tema', 'dark']
          ]
        }
      ]
    };

    await this.fetchWithRetry(`${this.BASE_SHEETS_URL}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initDataPayload)
    });

    console.log('[SheetsApi] Inisialisasi struktur sheet & header berhasil:', spreadsheetId);
    return {
      id: spreadsheetId,
      name: filename,
      webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    };
  },

  // Menyimpan pemetaan sheetId numerik (0, 12345, dst.) dari metadata spreadsheet
  _cacheSheetNumericIds(spreadsheetObj) {
    if (!spreadsheetObj || !spreadsheetObj.sheets) return;
    const cache = {};
    spreadsheetObj.sheets.forEach(s => {
      if (s.properties) {
        cache[s.properties.title] = s.properties.sheetId;
      }
    });
    this._sheetMetadataCache[spreadsheetObj.spreadsheetId] = cache;
  },

  // Memastikan metadata sheetId numerik tersedia di memori
  async ensureSheetMetadata(spreadsheetId) {
    if (this._sheetMetadataCache[spreadsheetId]) return this._sheetMetadataCache[spreadsheetId];

    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}?fields=sheets.properties`;
    const res = await this.fetchWithRetry(url);
    const data = await res.json();
    this._cacheSheetNumericIds({ spreadsheetId, sheets: data.sheets });
    return this._sheetMetadataCache[spreadsheetId];
  },

  // =========================================================================
  // DYNAMIC HEADER MAPPING & BATCH READ (OPTIMIZED INITIAL LOAD)
  // =========================================================================

  // Membaca seluruh sheet sekaligus dengan 1 kali pemanggilan batchGet
  async batchGetAllData(spreadsheetId) {
    console.log('[SheetsApi] Memulai batchGet seluruh sheet database...');

    const ranges = [
      'Transaksi!A1:Z',
      'Cicilan!A1:Z',
      'RiwayatBayarCicilan!A1:Z',
      'Kategori!A1:Z',
      'Pengaturan!A1:Z'
    ];
    const queryParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}/values:batchGet?${queryParams}&valueRenderOption=UNFORMATTED_VALUE`;

    const res = await this.fetchWithRetry(url);
    const result = await res.json();
    const valueRanges = result.valueRanges || [];

    // Parse tiap sheet berdasarkan dynamic header baris ke-1
    const rawData = {
      transactions: [],
      debts: [],
      paymentHistory: [],
      categories: [],
      settings: {}
    };

    valueRanges.forEach(vr => {
      const rangeTitle = (vr.range || '').split('!')[0].replace(/'/g, '');
      const rows = vr.values || [];

      if (rows.length === 0) return;

      // Baris pertama selalu header
      const headers = rows[0].map(h => String(h || '').trim().toLowerCase());
      const headerMap = {};
      headers.forEach((h, idx) => { headerMap[h] = idx; });
      this._headerMappings[rangeTitle] = headerMap;

      const dataRows = rows.slice(1);

      if (rangeTitle === 'Transaksi') {
        rawData.transactions = dataRows.map((r, rowIdx) => ({
          _rowNumber: rowIdx + 2, // Baris 1-indexed di Google Sheets
          id: String(r[headerMap['id']] || `tx-${Date.now()}-${rowIdx}`),
          date: String(r[headerMap['tanggal']] || new Date().toISOString().split('T')[0]),
          type: String(r[headerMap['tipe']] || 'expense').toLowerCase(),
          category: String(r[headerMap['kategori']] || 'Lainnya'),
          amount: Number(r[headerMap['nominal']]) || 0,
          notes: String(r[headerMap['catatan']] || ''),
          source: String(r[headerMap['sumber']] || 'manual'),
          createdAt: String(r[headerMap['dibuat_pada']] || ''),
          photoProofUrl: String(r[headerMap['bukti_foto']] || '')
        })).filter(tx => tx.id);
      }

      else if (rangeTitle === 'Cicilan') {
        rawData.debts = dataRows.map((r, rowIdx) => {
          const totalTenor = Number(r[headerMap['tenor_bulan']]) || 0;
          const paidTenor = Number(r[headerMap['tenor_terbayar']]) || 0;
          const remainingTenor = Math.max(0, totalTenor - paidTenor);

          return {
            _rowNumber: rowIdx + 2,
            id: String(r[headerMap['id']] || `debt-${rowIdx}`),
            name: String(r[headerMap['nama']] || 'Cicilan'),
            type: String(r[headerMap['jenis']] || 'other'),
            totalAmount: Number(r[headerMap['total_pinjaman']]) || 0,
            monthlyPayment: Number(r[headerMap['cicilan_per_bulan']]) || 0,
            interestRate: Number(r[headerMap['bunga_persen']]) || 0,
            totalTenorMonths: totalTenor,
            paidTenorMonths: paidTenor,
            remainingTenorMonths: remainingTenor,
            dueDay: Number(r[headerMap['tanggal_jatuh_tempo']]) || 1,
            status: String(r[headerMap['status']] || (remainingTenor <= 0 ? 'lunas' : 'aktif')),
            createdAt: String(r[headerMap['dibuat_pada']] || '')
          };
        }).filter(d => d.id);
      }

      else if (rangeTitle === 'RiwayatBayarCicilan') {
        rawData.paymentHistory = dataRows.map((r, rowIdx) => ({
          _rowNumber: rowIdx + 2,
          id: String(r[headerMap['id']] || `pay-${rowIdx}`),
          debtId: String(r[headerMap['cicilan_id']] || ''),
          paymentDate: String(r[headerMap['tanggal_bayar']] || ''),
          amount: Number(r[headerMap['nominal']]) || 0,
          isLate: String(r[headerMap['terlambat']] || '').toLowerCase() === 'ya' || r[headerMap['terlambat']] === true,
          photoProofUrl: String(r[headerMap['bukti_foto']] || '')
        })).filter(p => p.id);
      }

      else if (rangeTitle === 'Kategori') {
        rawData.categories = dataRows.map(r => ({
          id: String(r[headerMap['id']] || ''),
          name: String(r[headerMap['nama']] || ''),
          type: String(r[headerMap['tipe']] || 'expense'),
          color: String(r[headerMap['warna']] || '#38BDF8'),
          icon: String(r[headerMap['ikon']] || 'tag')
        })).filter(c => c.name);
      }

      else if (rangeTitle === 'Pengaturan') {
        const settings = {};
        dataRows.forEach(r => {
          const k = String(r[0] || '').trim();
          const v = r[1];
          if (k) settings[k] = v;
        });

        rawData.settings = {
          monthlyIncome: Number(settings['pemasukan_bulanan']) || 16750000,
          monthlySavingsTarget: Number(settings['target_tabungan']) || 3500000,
          currentEmergencyFund: Number(settings['dana_darurat_saat_ini']) || 18000000,
          profileType: String(settings['tipe_profil'] || 'single'),
          theme: String(settings['tema'] || 'dark')
        };
      }
    });

    console.log('[SheetsApi] batchGet selesai diproses. Total transaksi:', rawData.transactions.length);
    return rawData;
  },

  // =========================================================================
  // CREATE (APPEND) DENGAN DEBOUNCE / BATCHING QUEUE
  // =========================================================================

  // Format transaksi menjadi baris array sesuai skema header
  _formatTransactionRow(tx) {
    return [
      tx.id || (crypto.randomUUID ? crypto.randomUUID() : 'tx-' + Date.now()),
      tx.date || new Date().toISOString().split('T')[0],
      tx.type || 'expense',
      tx.category || 'Lainnya',
      Number(tx.amount) || 0,
      tx.notes || '',
      tx.source || 'manual',
      tx.createdAt || new Date().toISOString(),
      tx.photoProofUrl || ''
    ];
  },

  // Antrean penambahan transaksi agar operasi beruntun (misal voice note berulang) dikirim sebagai 1 batch
  enqueueTransaction(spreadsheetId, tx, onComplete) {
    this._syncQueue.transactions.push({ tx, onComplete });

    if (this._syncQueue.timer) {
      clearTimeout(this._syncQueue.timer);
    }

    // Debounce 750ms
    this._syncQueue.timer = setTimeout(() => {
      this.flushTransactionQueue(spreadsheetId);
    }, 750);
  },

  // Kirim antrean transaksi sebagai satu pemanggilan values.append
  async flushTransactionQueue(spreadsheetId) {
    if (this._syncQueue.transactions.length === 0 || this._syncQueue.isFlushing) return;

    this._syncQueue.isFlushing = true;
    const batch = [...this._syncQueue.transactions];
    this._syncQueue.transactions = [];

    const rows = batch.map(item => this._formatTransactionRow(item.tx));
    console.log(`[SheetsApi] Mengirim batch append ${rows.length} transaksi ke Google Sheets...`);

    try {
      const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}/values/Transaksi!A:I:append?valueInputOption=USER_ENTERED`;
      const res = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows })
      });

      const appendResult = await res.json();
      console.log('[SheetsApi] Batch append sukses:', appendResult);

      batch.forEach(item => {
        if (typeof item.onComplete === 'function') item.onComplete(null, appendResult);
      });
    } catch (err) {
      console.error('[SheetsApi] Batch append gagal:', err);
      batch.forEach(item => {
        if (typeof item.onComplete === 'function') item.onComplete(err);
      });
      throw err;
    } finally {
      this._syncQueue.isFlushing = false;
      // Jika ada transaksi baru yang masuk saat flushing, jadwalkan lagi
      if (this._syncQueue.transactions.length > 0) {
        this._syncQueue.timer = setTimeout(() => this.flushTransactionQueue(spreadsheetId), 300);
      }
    }
  },

  // Tambah Cicilan baru
  async appendDebt(spreadsheetId, debt) {
    const row = [
      debt.id || (crypto.randomUUID ? crypto.randomUUID() : 'debt-' + Date.now()),
      debt.name || '',
      debt.type || 'other',
      Number(debt.totalAmount) || 0,
      Number(debt.monthlyPayment) || 0,
      Number(debt.interestRate) || 0,
      Number(debt.totalTenorMonths) || 0,
      Number(debt.paidTenorMonths) || 0,
      Number(debt.dueDay) || 1,
      debt.status || 'aktif',
      debt.createdAt || new Date().toISOString()
    ];

    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}/values/Cicilan!A:K:append?valueInputOption=USER_ENTERED`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    return await res.json();
  },

  // Tambah Catatan Pembayaran Cicilan (RiwayatBayarCicilan)
  async appendPaymentHistory(spreadsheetId, payment) {
    const row = [
      payment.id || (crypto.randomUUID ? crypto.randomUUID() : 'pay-' + Date.now()),
      payment.debtId || '',
      payment.paymentDate || new Date().toISOString().split('T')[0],
      Number(payment.amount) || 0,
      payment.isLate ? 'Ya' : 'Tidak',
      payment.photoProofUrl || ''
    ];

    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}/values/RiwayatBayarCicilan!A:F:append?valueInputOption=USER_ENTERED`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    return await res.json();
  },

  // =========================================================================
  // UPDATE OPERATIONS (BY ROW NUMBER IN MEMORY)
  // =========================================================================

  // Update baris transaksi yang sudah ada
  async updateTransaction(spreadsheetId, tx, rowNumber) {
    if (!rowNumber || rowNumber < 2) {
      throw new Error('Nomor baris tidak valid untuk update transaksi.');
    }

    const row = this._formatTransactionRow(tx);
    const range = `Transaksi!A${rowNumber}:I${rowNumber}`;
    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

    const res = await this.fetchWithRetry(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    return await res.json();
  },

  // Update baris cicilan (misal sisa tenor atau status)
  async updateDebt(spreadsheetId, debt, rowNumber) {
    if (!rowNumber || rowNumber < 2) {
      throw new Error('Nomor baris tidak valid untuk update cicilan.');
    }

    const row = [
      debt.id,
      debt.name,
      debt.type,
      Number(debt.totalAmount) || 0,
      Number(debt.monthlyPayment) || 0,
      Number(debt.interestRate) || 0,
      Number(debt.totalTenorMonths) || 0,
      Number(debt.paidTenorMonths) || 0,
      Number(debt.dueDay) || 1,
      debt.status,
      debt.createdAt || ''
    ];

    const range = `Cicilan!A${rowNumber}:K${rowNumber}`;
    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

    const res = await this.fetchWithRetry(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    return await res.json();
  },

  // Simpan Pengaturan Akun ke Sheet Pengaturan (Key-Value)
  async updateSettings(spreadsheetId, settingsObj) {
    const rows = [
      ['pemasukan_bulanan', Number(settingsObj.monthlyIncome) || 0],
      ['target_tabungan', Number(settingsObj.monthlySavingsTarget) || 0],
      ['dana_darurat_saat_ini', Number(settingsObj.currentEmergencyFund) || 0],
      ['tipe_profil', settingsObj.profileType || 'single'],
      ['tema', settingsObj.theme || 'dark']
    ];

    const range = 'Pengaturan!A2:B6';
    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

    const res = await this.fetchWithRetry(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows })
    });
    return await res.json();
  },

  // =========================================================================
  // DELETE ROW (VIA BATCHUPDATE deleteDimension)
  // =========================================================================

  // Hapus baris spesifik di Google Sheets
  async deleteRow(spreadsheetId, sheetTitle, rowNumber1Based) {
    const metadata = await this.ensureSheetMetadata(spreadsheetId);
    const numericSheetId = metadata[sheetTitle];

    if (numericSheetId === undefined) {
      throw new Error(`Sheet "${sheetTitle}" tidak ditemukan pada metadata spreadsheet.`);
    }

    const startIndex = rowNumber1Based - 1; // 0-indexed
    const endIndex = startIndex + 1;

    const payload = {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: numericSheetId,
              dimension: 'ROWS',
              startIndex: startIndex,
              endIndex: endIndex
            }
          }
        }
      ]
    };

    const url = `${this.BASE_SHEETS_URL}/${spreadsheetId}:batchUpdate`;
    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }
};

window.SheetsApi = SheetsApi;
