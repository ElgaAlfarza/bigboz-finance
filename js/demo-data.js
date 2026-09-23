/**
 * BigBoz - Default Data
 * Data kosong untuk pengguna baru — isi sendiri sesuai kondisi keuangan Anda.
 */

const DEFAULT_SETTINGS = {
  monthlyIncome: 0,
  monthlySavingsTarget: 0,
  currentEmergencyFund: 0,
  emergencyFundMonths: 6,
  profileType: 'single',
  theme: 'dark',
  googleAccount: {
    connected: false,
    name: '',
    email: '',
    avatar: '',
    sheetUrl: '',
    lastSynced: null
  }
};

const DEFAULT_DEBTS = [];

const DEFAULT_TRANSACTIONS = [];

const LAST_MONTH_STATS = {
  income: 0,
  expense: 0,
  net: 0
};
