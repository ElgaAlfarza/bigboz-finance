/**
 * FinVibe - Web Speech API Integration
 * Input suara berbahasa Indonesia (id-ID) untuk catatan transaksi dengan ekstraksi nominal pintar
 */

const FinVibeSpeech = {
  recognition: null,
  isRecording: false,

  // Inisialisasi engine Speech Recognition
  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported on this browser.');
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'id-ID';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      return true;
    } catch (e) {
      console.error('Speech recognition init error:', e);
      return false;
    }
  },

  // Mulai atau hentikan rekaman suara
  toggle(buttonElement, onResultCallback, onStateChangeCallback) {
    if (!this.recognition) {
      const ok = this.init();
      if (!ok) {
        if (typeof showToast === 'function') {
          showToast('Browser Anda tidak mendukung Web Speech API. Silakan ketik catatan secara manual.', 'warning');
        }
        return;
      }
    }

    if (this.isRecording) {
      this.stop();
      return;
    }

    try {
      this.isRecording = true;
      if (onStateChangeCallback) onStateChangeCallback(true);

      this.recognition.onstart = () => {
        this.isRecording = true;
        if (onStateChangeCallback) onStateChangeCallback(true);
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.isRecording = false;
        if (onStateChangeCallback) onStateChangeCallback(false);

        // Ekstraksi teks & potensi nominal uang
        const parsed = this.parseIndonesianVoiceInput(transcript);
        if (onResultCallback) onResultCallback(parsed);
      };

      this.recognition.onerror = (event) => {
        this.isRecording = false;
        if (onStateChangeCallback) onStateChangeCallback(false);
        console.warn('Speech recognition error:', event.error);
        if (typeof showToast === 'function') {
          if (event.error === 'not-allowed') {
            showToast('Izin akses mikrofon ditolak oleh browser.', 'danger');
          } else if (event.error !== 'no-speech') {
            showToast('Terjadi kendala saat mengenali suara. Coba ulangi lagi.', 'warning');
          }
        }
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        if (onStateChangeCallback) onStateChangeCallback(false);
      };

      this.recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      this.isRecording = false;
      if (onStateChangeCallback) onStateChangeCallback(false);
    }
  },

  stop() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
    }
  },

  // Parser Heuristik Suara Bahasa Indonesia
  // Contoh: "Makan siang di cafe 35 ribu" -> text: "Makan siang di cafe", amount: 35000
  // Contoh: "Beli bensin lima puluh ribu" -> text: "Beli bensin", amount: 50000
  parseIndonesianVoiceInput(rawText) {
    if (!rawText) return { text: '', amount: null };
    
    let text = rawText.trim();
    let detectedAmount = null;

    // 1. Cek pola angka langsung seperti "35.000", "50000", "25 ribu", "1.5 juta"
    const numberRibuRegex = /(\d+[\d.,]*)\s*(ribu|k|rb)/i;
    const numberJutaRegex = /(\d+[\d.,]*)\s*(juta|jt)/i;
    const pureNumberRegex = /\b(\d{4,9})\b/;

    const matchJuta = text.match(numberJutaRegex);
    if (matchJuta) {
      const num = parseFloat(matchJuta[1].replace(',', '.'));
      if (!isNaN(num)) {
        detectedAmount = Math.round(num * 1000000);
        text = text.replace(matchJuta[0], '').trim();
      }
    } else {
      const matchRibu = text.match(numberRibuRegex);
      if (matchRibu) {
        const num = parseFloat(matchRibu[1].replace(',', '.'));
        if (!isNaN(num)) {
          detectedAmount = Math.round(num * 1000);
          text = text.replace(matchRibu[0], '').trim();
        }
      } else {
        const matchPure = text.match(pureNumberRegex);
        if (matchPure) {
          detectedAmount = parseInt(matchPure[1], 10);
          text = text.replace(matchPure[0], '').trim();
        }
      }
    }

    // 2. Cek kata-kata nominal umum bahasa Indonesia jika belum terdeteksi
    if (!detectedAmount) {
      const wordMap = {
        'sepuluh ribu': 10000,
        'dua puluh ribu': 20000,
        'dua puluh lima ribu': 25000,
        'tiga puluh ribu': 30000,
        'tiga puluh lima ribu': 35000,
        'empat puluh ribu': 40000,
        'lima puluh ribu': 50000,
        'tujuh puluh lima ribu': 75000,
        'seratus ribu': 100000,
        'seratus lima puluh ribu': 150000,
        'dua ratus ribu': 200000,
        'dua ratus lima puluh ribu': 250000,
        'tiga ratus ribu': 300000,
        'lima ratus ribu': 500000,
        'satu juta': 1000000,
        'dua juta': 2000000,
        'tiga juta': 3000000,
        'lima juta': 5000000
      };

      const lower = text.toLowerCase();
      for (const [phrase, val] of Object.entries(wordMap)) {
        if (lower.includes(phrase)) {
          detectedAmount = val;
          text = text.replace(new RegExp(phrase, 'gi'), '').trim();
          break;
        }
      }
    }

    // Bersihkan karakter sisa
    text = text.replace(/^sebesar\s+/i, '').replace(/\s{2,}/g, ' ').trim();
    if (!text && rawText) {
      text = rawText; // Fallback jika semua teks terhapus
    }

    return {
      text: text.charAt(0).toUpperCase() + text.slice(1),
      amount: detectedAmount,
      raw: rawText
    };
  }
};
