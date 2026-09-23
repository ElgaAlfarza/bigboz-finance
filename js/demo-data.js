/**
 * FinVibe - Demo Data Starter Pack
 * Dataset realistis keuangan pribadi Indonesia untuk portofolio & demonstrasi
 */

const DEFAULT_SETTINGS = {
  monthlyIncome: 16750000,
  monthlySavingsTarget: 3500000,
  currentEmergencyFund: 18000000,
  emergencyFundMonths: 6, // target 6 bulan pengeluaran
  profileType: 'single',  // 'single' | 'married' | 'freelancer'
  theme: 'dark',          // 'dark' | 'light'
  googleAccount: {
    connected: true,
    name: 'Budi Santoso (BigBoz)',
    email: 'budi.bigboz@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing',
    lastSynced: new Date().toISOString()
  }
};

const DEFAULT_DEBTS = [
  {
    id: 'debt-kpr-01',
    name: 'KPR Rumah Griya Asri',
    type: 'house', // 'house' | 'motorcycle' | 'car' | 'credit_card' | 'other'
    totalAmount: 450000000,
    monthlyPayment: 2800000,
    totalTenorMonths: 180,
    remainingTenorMonths: 142,
    interestRate: 7.5,
    dueDay: 10,
    notes: 'KPR Bank BTN Syariah fix 5 tahun'
  },
  {
    id: 'debt-motor-02',
    name: 'Motor Honda Vario 160',
    type: 'motorcycle',
    totalAmount: 28000000,
    monthlyPayment: 780000,
    totalTenorMonths: 36,
    remainingTenorMonths: 14,
    interestRate: 8.2,
    dueDay: 25,
    notes: 'Cicilan leasing FIF'
  },
  {
    id: 'debt-cc-03',
    name: 'Kartu Kredit Mandiri Signature',
    type: 'credit_card',
    totalAmount: 6500000,
    monthlyPayment: 650000,
    totalTenorMonths: 12,
    remainingTenorMonths: 4,
    interestRate: 1.75,
    dueDay: 18,
    notes: 'Cicilan 0% gadget kerja laptop'
  }
];

// Helper to generate dynamic dates relative to current month/days
function getRelativeDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const DEFAULT_TRANSACTIONS = [
  // Pemasukan Bulan Ini
  {
    id: 'tx-001',
    type: 'income',
    category: 'Gaji',
    amount: 12500000,
    date: getRelativeDate(2),
    notes: 'Gaji Pokok & Tunjangan Maret',
    icon: 'briefcase'
  },
  {
    id: 'tx-002',
    type: 'income',
    category: 'Freelance',
    amount: 3800000,
    date: getRelativeDate(5),
    notes: 'Proyek Desain UI/UX Design System Mobile App',
    icon: 'laptop'
  },
  {
    id: 'tx-003',
    type: 'income',
    category: 'Investasi',
    amount: 450000,
    date: getRelativeDate(12),
    notes: 'Dividen Reksadana & Kupon Obligasi ORI',
    icon: 'trending-up'
  },

  // Pengeluaran: Cicilan
  {
    id: 'tx-004',
    type: 'expense',
    category: 'Cicilan',
    amount: 2800000,
    date: getRelativeDate(3),
    notes: 'Bayar Cicilan KPR Rumah Griya Asri',
    debtId: 'debt-kpr-01',
    icon: 'home'
  },
  {
    id: 'tx-005',
    type: 'expense',
    category: 'Cicilan',
    amount: 650000,
    date: getRelativeDate(7),
    notes: 'Bayar Cicilan CC Mandiri Gadget',
    debtId: 'debt-cc-03',
    icon: 'credit-card'
  },

  // Pengeluaran: Kebutuhan Pokok
  {
    id: 'tx-006',
    type: 'expense',
    category: 'Belanja & Groceries',
    amount: 1950000,
    date: getRelativeDate(1),
    notes: 'Belanja bulanan Superindo & sayur segar',
    icon: 'shopping-cart'
  },
  {
    id: 'tx-007',
    type: 'expense',
    category: 'Tagihan & Utilitas',
    amount: 540000,
    date: getRelativeDate(4),
    notes: 'Listrik PLN Token 400k & PDAM Air Bersih',
    icon: 'zap'
  },
  {
    id: 'tx-008',
    type: 'expense',
    category: 'Internet & Pulsa',
    amount: 420000,
    date: getRelativeDate(6),
    notes: 'IndiHome 50 Mbps & Kuota Data Telkomsel',
    icon: 'wifi'
  },
  {
    id: 'tx-009',
    type: 'expense',
    category: 'Transportasi',
    amount: 650000,
    date: getRelativeDate(2),
    notes: 'Bensin Pertamax, Tol Jabodetabek, & Parkir',
    icon: 'truck'
  },

  // Pengeluaran: Keinginan / Hiburan
  {
    id: 'tx-010',
    type: 'expense',
    category: 'Makanan & Kuliner',
    amount: 820000,
    date: getRelativeDate(0),
    notes: 'Makan bareng kolega & Kopi Cafe Specialty',
    icon: 'coffee'
  },
  {
    id: 'tx-011',
    type: 'expense',
    category: 'Hiburan & Langganan',
    amount: 235000,
    date: getRelativeDate(8),
    notes: 'Langganan Netflix Premium & Spotify Family',
    icon: 'tv'
  },
  {
    id: 'tx-012',
    type: 'expense',
    category: 'Belanja Pribadi',
    amount: 490000,
    date: getRelativeDate(10),
    notes: 'Beli buku finansial & Mechanical keyboard mod',
    icon: 'package'
  },

  // Pengeluaran / Alokasi Tabungan
  {
    id: 'tx-013',
    type: 'expense',
    category: 'Tabungan & Investasi',
    amount: 1500000,
    date: getRelativeDate(3),
    notes: 'Top up Reksadana Pasar Uang Bibit',
    icon: 'shield'
  }
];

// Bulan lalu untuk data pembanding "Bulan Ini vs Bulan Lalu"
const LAST_MONTH_STATS = {
  income: 15800000,
  expense: 10250000,
  net: 5550000
};
