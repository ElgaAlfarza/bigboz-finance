/**
 * BigBoz - Google Identity Services (GIS) OAuth 2.0 Authentication Layer
 * Mengelola otorisasi Google OAuth 2.0 client-side tanpa server terpisah.
 * Keamanan: Access Token HANYA disimpan di memori JavaScript (tidak pernah disimpan di localStorage).
 */

const GoogleAuth = {
  // Scopes minimal yang dibutuhkan BigBoz
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets', // Akses data tabel keuangan
    'https://www.googleapis.com/auth/drive.file',    // Akses HANYA file & folder yang dibuat oleh BigBoz
    'openid',                                        // Identitas akun
    'email',                                         // Alamat email
    'profile'                                        // Nama dan foto profil
  ].join(' '),

  // Default demo / development Client ID (pengguna dapat memasukkan Client ID milik sendiri via Settings)
  DEFAULT_CLIENT_ID: '143853969372-2mljoiksd6qlp5q2der8tal1ilan17c1.apps.googleusercontent.com',

  // Variabel in-memory (rahasia & tidak persisten di disk)
  _tokenClient: null,
  _accessToken: null,
  _tokenExpiresAt: 0,
  _userProfile: null,
  _authCallbacks: [],
  _isInitialized: false,

  // Mengambil Client ID yang aktif (dari localStorage jika ada kustomisasi, atau default)
  getClientId() {
    return localStorage.getItem('bigboz_google_client_id') || this.DEFAULT_CLIENT_ID;
  },

  // Menyimpan Client ID baru
  setClientId(clientId) {
    if (!clientId) {
      localStorage.removeItem('bigboz_google_client_id');
    } else {
      localStorage.setItem('bigboz_google_client_id', clientId.trim());
    }
    // Re-inisialisasi token client
    this._tokenClient = null;
    this._isInitialized = false;
    this.init();
  },

  // Inisialisasi Google Identity Services
  init() {
    if (this._isInitialized && this._tokenClient) return true;

    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      console.warn('[GoogleAuth] Google Identity Services (GIS) library belum siap.');
      return false;
    }

    try {
      const clientId = this.getClientId();
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: this.SCOPES,
        callback: (tokenResponse) => {
          this._handleTokenResponse(tokenResponse);
        },
        error_callback: (err) => {
          console.error('[GoogleAuth] OAuth Error:', err);
          this._notifyAuthChanged(false, { error: err });
        }
      });

      this._isInitialized = true;
      console.log('[GoogleAuth] Token client berhasil diinisialisasi.');

      // Muat profil cache dari sesi sebelumnya (jika ada) untuk UI cepat
      const cachedProfile = localStorage.getItem('bigboz_user_profile');
      if (cachedProfile) {
        try {
          this._userProfile = JSON.parse(cachedProfile);
        } catch (e) {}
      }

      return true;
    } catch (err) {
      console.error('[GoogleAuth] Gagal inisialisasi token client:', err);
      return false;
    }
  },

  // Daftarkan listener saat status autentikasi berubah
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this._authCallbacks.push(callback);
    }
  },

  _notifyAuthChanged(isSignedIn, data = null) {
    this._authCallbacks.forEach(cb => {
      try {
        cb(isSignedIn, data);
      } catch (e) {
        console.error('[GoogleAuth] Error in auth callback:', e);
      }
    });
  },

  // Handler saat menerima token response dari Google
  async _handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) {
      console.error('[GoogleAuth] Error response:', tokenResponse.error);
      this._accessToken = null;
      this._tokenExpiresAt = 0;
      this._notifyAuthChanged(false, { error: tokenResponse.error });
      return;
    }

    this._accessToken = tokenResponse.access_token;
    // expires_in biasanya 3599 detik
    const expiresInSec = Number(tokenResponse.expires_in) || 3600;
    this._tokenExpiresAt = Date.now() + (expiresInSec * 1000);

    console.log('[GoogleAuth] Access token berhasil didapatkan di memori. Expire dalam (detik):', expiresInSec);

    // Ambil info profil pengguna
    try {
      const profile = await this.fetchUserProfile();
      this._userProfile = profile;
      localStorage.setItem('bigboz_user_profile', JSON.stringify(profile));
      localStorage.setItem('bigboz_auth_state', 'connected');
      this._notifyAuthChanged(true, { profile, token: this._accessToken });
    } catch (err) {
      console.warn('[GoogleAuth] Gagal mengambil profil userinfo, tetap melanjutkan autentikasi:', err);
      this._notifyAuthChanged(true, { profile: this._userProfile, token: this._accessToken });
    }
  },

  // Mengambil data profil user (openid, email, profile)
  async fetchUserProfile() {
    if (!this._accessToken) throw new Error('Belum ada access token');

    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        'Authorization': `Bearer ${this._accessToken}`
      }
    });

    if (!res.ok) {
      throw new Error(`Userinfo HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      id: data.sub,
      name: data.name || data.email,
      email: data.email,
      picture: data.picture || '',
      locale: data.locale || 'id'
    };
  },

  // Login dengan Google (memunculkan popup persetujuan)
  signIn(promptMode = 'consent') {
    if (!this.init()) {
      if (typeof google === 'undefined') {
        alert('Library Google Identity Services belum selesai dimuat. Pastikan koneksi internet stabil dan muat ulang halaman.');
        return;
      }
    }

    if (!this._tokenClient) {
      console.error('[GoogleAuth] Token client belum tersedia.');
      return;
    }

    // Minta access token
    this._tokenClient.requestAccessToken({
      prompt: promptMode
    });
  },

  // Silent refresh token saat mendekati masa kedaluwarsa atau saat API mengembalikan 401
  async refreshAccessToken() {
    return new Promise((resolve, reject) => {
      if (!this.init() || !this._tokenClient) {
        return reject(new Error('Token client tidak tersedia'));
      }

      console.log('[GoogleAuth] Mencoba silent token refresh...');

      // Buat handler satu kali
      const tempCallback = (tokenResponse) => {
        if (tokenResponse.error) {
          console.warn('[GoogleAuth] Silent refresh gagal:', tokenResponse.error);
          reject(new Error(tokenResponse.error));
        } else {
          this._handleTokenResponse(tokenResponse);
          resolve(this._accessToken);
        }
      };

      // Set callback sementara
      this._tokenClient.callback = tempCallback;
      this._tokenClient.requestAccessToken({ prompt: '' });
    });
  },

  // Mengambil Access Token aktif di memori (dengan pengecekan expiry otomatis)
  async getValidAccessToken() {
    // Jika tidak ada token sama sekali
    if (!this._accessToken) {
      return null;
    }

    // Jika token kedaluwarsa dalam 3 menit ke depan, refresh terlebih dahulu
    const timeRemaining = this._tokenExpiresAt - Date.now();
    if (timeRemaining < 3 * 60 * 1000) {
      try {
        console.log('[GoogleAuth] Token mendekati expiry, merefresh...');
        return await this.refreshAccessToken();
      } catch (e) {
        console.warn('[GoogleAuth] Gagal silent refresh, menggunakan token lama:', e);
        return this._accessToken;
      }
    }

    return this._accessToken;
  },

  // Mendapatkan profil pengguna yang sedang login
  getUserProfile() {
    return this._userProfile;
  },

  // Cek apakah sedang login (ada token di memori)
  isSignedIn() {
    return Boolean(this._accessToken && Date.now() < this._tokenExpiresAt);
  },

  // Cek apakah ada sesi akun sebelumnya yang tercatat di browser
  hasPreviousSession() {
    return localStorage.getItem('bigboz_auth_state') === 'connected';
  },

  // Keluar / Logout: Cabut token & bersihkan sesi
  signOut() {
    const token = this._accessToken;
    if (token && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      try {
        google.accounts.oauth2.revoke(token, () => {
          console.log('[GoogleAuth] Sesi OAuth 2.0 token berhasil dicabut di Google.');
        });
      } catch (e) {
        console.warn('[GoogleAuth] Gagal mencabut token ke Google:', e);
      }
    }

    // Bersihkan memori JS
    this._accessToken = null;
    this._tokenExpiresAt = 0;
    this._userProfile = null;

    // Bersihkan flag auth di localStorage (tanpa menghapus data cache offline agar data tidak hilang)
    localStorage.removeItem('bigboz_auth_state');
    localStorage.removeItem('bigboz_user_profile');

    this._notifyAuthChanged(false, { manualLogout: true });
    console.log('[GoogleAuth] Berhasil keluar dari akun Google.');
  }
};

window.GoogleAuth = GoogleAuth;
