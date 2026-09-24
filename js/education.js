/**
 * FinVibe - Financial Literacy & Education Hub Module
 * Menghitung Skor Kesehatan Finansial, Insights Dinamis "Tahukah Kamu?", 
 * Aturan 50/30/20, Kalkulator Dana Darurat, Kamus Mini, dan Badges Gamifikasi
 */

const FinancialEducation = {
  // Kamus Istilah Keuangan Mini
  glossary: [
    {
      term: 'Debt-to-Income (DTI) Ratio',
      category: 'Utang & Kredit',
      definition: 'Persentase total kewajiban cicilan bulanan dibanding total pemasukan kotor bulanan.',
      tip: 'Standar perbankan menyarankan DTI di bawah 30% untuk kondisi prima, dan maksimal 35–40% untuk batas waspada.'
    },
    {
      term: 'Bunga Efektif vs Flat',
      category: 'Perbankan & Pinjaman',
      definition: 'Bunga Flat dihitung dari plafon awal pinjaman sehingga nominal bunga tetap, sedangkan Bunga Efektif dihitung dari sisa pokok utang yang kian menyusut.',
      tip: 'Suku bunga flat 8% per tahun sebenarnya setara dengan bunga efektif sekitar 14–15% per tahun!'
    },
    {
      term: 'Dana Darurat (Emergency Fund)',
      category: 'Proteksi Finansial',
      definition: 'Simpanan likuid (mudah dicairkan tanpa pinalti) yang khusus digunakan saat terjadi krisis mendadak seperti PHK, sakit, atau renovasi genting.',
      tip: 'Simpan di instrumen likuid dan stabil: Reksadana Pasar Uang (RDPU), Tabungan terpisah, atau Emas digital.'
    },
    {
      term: 'Sinking Fund',
      category: 'Budgeting',
      definition: 'Tabungan berkala yang disisihkan secara terencana untuk pengeluaran besar di masa depan yang pasti terjadi.',
      tip: 'Contoh: Pajak tahunan kendaraan bermotor, premi asuransi tahunan, servis besar mobil, atau qurban/liburan.'
    },
    {
      term: 'Burn Rate Harian',
      category: 'Analisis Arus Kas',
      definition: 'Rata-rata jumlah uang yang Anda keluarkan setiap hari dalam periode tertentu.',
      tip: 'Formula: Total Pengeluaran Bulan Ini ÷ Jumlah Hari yang Telah Berjalan. Sangat berguna mencegah kantong kering sebelum tanggal gajian.'
    },
    {
      term: 'Aturan 50 / 30 / 20',
      category: 'Budgeting Populer',
      definition: 'Formula alokasi gaji: 50% untuk Kebutuhan Pokok (Needs), 30% untuk Keinginan (Wants), dan 20% untuk Tabungan / Investasi / Pelunasan Utang.',
      tip: 'Jika cicilan Anda tinggi, kurangi porsi keinginan (Wants) terlebih dahulu, bukan porsi kebutuhan pokok.'
    },
    {
      term: 'Compounding Interest (Bunga Berbunga)',
      category: 'Investasi',
      definition: 'Proses di mana imbal hasil investasi menghasilkan imbal hasil tambahan lagi secara eksponensial seiring berjalannya waktu.',
      tip: 'Albert Einstein menyebutnya sebagai keajaiban dunia ke-8. Semakin dini Anda mulai berinvestasi rutin, efek compounding semakin dahsyat.'
    },
    {
      term: 'Aset Likuid',
      category: 'Manajemen Kekayaan',
      definition: 'Aset atau kekayaan yang bisa diubah menjadi uang tunai seketika dalam tempo 1–3 hari kerja tanpa kehilangan nilai signifikan.',
      tip: 'Kas, tabungan bank, dan reksadana pasar uang adalah aset likuid. Properti dan tanah adalah aset tidak likuid.'
    }
  ],

  // Hitung Skor Kesehatan Finansial (0 - 100)
  calculateHealthScore(stats, debts, settings) {
    const { income, expense, net } = stats;
    const totalDebtMonthly = DebtTracker.getTotalMonthlyInstallment(debts);
    const dti = DebtTracker.calculateDTI(totalDebtMonthly, income);
    
    // 1. Savings Rate Score (Maks 35 poin)
    let savingsRate = 0;
    let savingsPoints = 0;
    if (income > 0) {
      savingsRate = ((income - expense) / income) * 100;
      if (savingsRate >= 25) savingsPoints = 35;
      else if (savingsRate >= 15) savingsPoints = 28;
      else if (savingsRate >= 5) savingsPoints = 18;
      else if (savingsRate >= 0) savingsPoints = 10;
      else savingsPoints = 0; // defisit
    }

    // 2. DTI Score (Maks 30 poin)
    // Hanya dihitung jika ada income — hindari skor palsu saat data kosong
    let dtiPoints = 0;
    if (income > 0) {
      if (debts.length === 0 || totalDebtMonthly === 0) {
        dtiPoints = 30; // Bebas utang
      } else if (dti < 20) {
        dtiPoints = 28;
      } else if (dti < 30) {
        dtiPoints = 25;
      } else if (dti <= 40) {
        dtiPoints = 15;
      } else {
        dtiPoints = 5;
      }
    }

    // 3. Dana Darurat Score (Maks 20 poin)
    // Hanya dihitung jika ada data pengeluaran aktual — hindari skor palsu saat data kosong
    const currentEmergency = Number(settings.currentEmergencyFund || 0);
    const targetMultiplier = settings.profileType === 'freelancer' ? 9 : (settings.profileType === 'married' ? 6 : 3);
    const targetEmergency = expense > 0 ? expense * targetMultiplier : 0;
    const emergencyRatio = targetEmergency > 0 ? (currentEmergency / targetEmergency) : 0;
    // Jika tidak ada pengeluaran (belum ada data), skor darurat = 0
    const emergencyPoints = expense > 0 ? Math.min(20, Math.round(emergencyRatio * 20)) : 0;


    // 4. Disiplin Pencatatan (Maks 15 poin)
    const txCount = stats.txCount || 0;
    let consistencyPoints = 5;
    if (txCount >= 10) consistencyPoints = 15;
    else if (txCount >= 5) consistencyPoints = 10;

    const totalScore = Math.min(100, Math.max(0, savingsPoints + dtiPoints + emergencyPoints + consistencyPoints));

    // Label kualitatif
    let grade = {};
    if (totalScore >= 85) {
      grade = {
        title: 'Sangat Sehat & Prima',
        badgeClass: 'badge-emerald',
        color: '#10B981',
        advice: 'Arus kas dan struktur utang Anda sangat terjaga. Anda siap melangkah ke investasi jangka panjang.'
      };
    } else if (totalScore >= 70) {
      grade = {
        title: 'Cukup Sehat & Stabil',
        badgeClass: 'badge-cyan',
        color: '#38BDF8',
        advice: 'Keuangan Anda di jalur yang benar. Tingkatkan alokasi dana darurat atau percepat pelunasan utang berbunga tinggi.'
      };
    } else if (totalScore >= 50) {
      grade = {
        title: 'Perlu Perhatian',
        badgeClass: 'badge-amber',
        color: '#F59E0B',
        advice: 'Ada beberapa pos yang membebani (rasio cicilan atau tabungan tipis). Disarankan evaluasi pengeluaran non-primer.'
      };
    } else {
      grade = {
        title: 'Kritis / Perlu Pemulihan',
        badgeClass: 'badge-crimson',
        color: '#EF4444',
        advice: 'Arus kas mengalami defisit atau beban cicilan terlalu tinggi. Segera rem pengeluaran gaya hidup & restrukturisasi utang.'
      };
    }

    return {
      totalScore,
      grade,
      breakdown: {
        savings: { points: savingsPoints, max: 35, rate: Math.round(savingsRate) },
        dti: { points: dtiPoints, max: 30, ratio: dti },
        emergency: { points: emergencyPoints, max: 20, ratio: Math.min(100, Math.round(emergencyRatio * 100)) },
        consistency: { points: consistencyPoints, max: 15, count: txCount }
      },
      targetEmergency,
      currentEmergency
    };
  },

  // Generator "Tahukah Kamu?" Berbasis Data Riil Pengguna (Bukan teks generik statis)
  generateDynamicInsights(stats, debts, settings, transactions) {
    const insights = [];
    const { income, expense, dailyBurnRate } = stats;
    const totalDebtMonthly = DebtTracker.getTotalMonthlyInstallment(debts);
    const dti = DebtTracker.calculateDTI(totalDebtMonthly, income);

    // 1. Cek DTI
    if (dti > 35) {
      insights.push({
        type: 'danger',
        icon: 'alert-triangle',
        title: 'Beban Cicilan Melebihi Batas Aman',
        text: `Rasio cicilanmu mencapai ${dti}% dari pemasukan (batas sehat perbankan adalah <30%). Hindari utang konsumtif baru agar arus kas bulanan tidak tercekik.`,
        actionText: 'Lihat Pelunasan Dipercepat',
        actionTarget: 'debt'
      });
    } else if (debts.length > 0 && dti <= 25) {
      insights.push({
        type: 'success',
        icon: 'shield-check',
        title: 'Rasio Cicilan Sangat Ideal',
        text: `Cicilan bulananmu hanya menyerap ${dti}% dari total pemasukan. Ini memberikan ruang bernapas yang sangat lega untuk investasi dan tabungan.`,
        actionText: 'Kelola Cicilan',
        actionTarget: 'debt'
      });
    }

    // 2. Analisis Kategori Pengeluaran Terbesar
    const categoryTotals = {};
    (transactions || []).forEach(tx => {
      if (tx.type === 'expense') {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + Number(tx.amount);
      }
    });

    let topCategory = null;
    let topCatAmount = 0;
    for (const [cat, amt] of Object.entries(categoryTotals)) {
      if (amt > topCatAmount && cat !== 'Cicilan') {
        topCatAmount = amt;
        topCategory = cat;
      }
    }

    if (topCategory && expense > 0) {
      const topCatPercent = Math.round((topCatAmount / expense) * 100);
      if (topCatPercent >= 25) {
        insights.push({
          type: 'info',
          icon: 'pie-chart',
          title: `Dominasi Pengeluaran: ${topCategory}`,
          text: `Pos "${topCategory}" memakan ${topCatPercent}% (Rp ${topCatAmount.toLocaleString('id-ID')}) dari total pengeluaranmu. Menghemat 10% saja dari pos ini memberi tambahan dana Rp ${Math.round(topCatAmount * 0.1).toLocaleString('id-ID')}.`,
          actionText: 'Cek Grafik Pengeluaran',
          actionTarget: 'charts'
        });
      }
    }

    // 3. Evaluasi Dana Darurat (hanya tampilkan jika ada data pengeluaran)
    const currentEmergency = Number(settings.currentEmergencyFund || 0);
    const monthsCovered = expense > 0 ? (currentEmergency / expense).toFixed(1) : 0;
    if (expense > 0 && monthsCovered < 3) {
      insights.push({
        type: 'warning',
        icon: 'life-buoy',
        title: 'Kesiapan Dana Darurat Masih Rendah',
        text: `Dana daruratmu saat ini baru sanggup bertahan selama ${monthsCovered} bulan pengeluaran normal. Idealnya siapkan minimal 3 hingga 6 bulan pengeluaran. Update jumlah dana darurat di Pengaturan.`,
        actionText: null,
        actionTarget: null
      });
    } else if (expense > 0 && monthsCovered >= 6) {
      insights.push({
        type: 'success',
        icon: 'award',
        title: 'Benteng Dana Darurat Kokoh',
        text: `Hebat! Dana daruratmu telah mencukupi kebutuhan ${monthsCovered} bulan pengeluaran. Kamu memiliki perlindungan kuat dari risiko finansial mendadak.`,
        actionText: null,
        actionTarget: null
      });
    }

    // 4. Cek Burn Rate Harian
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const safeDailyAllowance = income > 0 ? Math.round((income * 0.7) / daysInMonth) : 0;
    if (dailyBurnRate > safeDailyAllowance && safeDailyAllowance > 0) {
      insights.push({
        type: 'warning',
        icon: 'trending-up',
        title: 'Burn Rate Harian Cukup Tinggi',
        text: `Rata-rata pengeluaran harianmu Rp ${Math.round(dailyBurnRate).toLocaleString('id-ID')}/hari, lebih tinggi dari batas aman belanja harian Rp ${safeDailyAllowance.toLocaleString('id-ID')}/hari.`,
        actionText: 'Lihat Analisis Harian',
        actionTarget: 'charts'
      });
    }

    // Fallback jika belum banyak data
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        icon: 'lightbulb',
        title: 'Pencatatan Berkelanjutan Membuka Peluang',
        text: 'Setiap transaksi yang kamu catat di BigBoz Finance membantu algoritma kami mengenali kebiasaan belanja dan memberikan rekomendasi yang presisi.',
        actionText: 'Tambah Transaksi',
        actionTarget: 'add-tx'
      });
    }

    return insights;
  },

  // Perhitungan Breakdown Aturan 50/30/20 vs Realita Pengguna
  calculate503020Rule(stats, transactions) {
    const income = stats.income || 0;
    if (income <= 0) return null;

    let needs = 0;
    let wants = 0;
    let savings = 0;

    // Mapping kategori ke Needs / Wants / Savings
    const needsCategories = ['Belanja & Groceries', 'Tagihan & Utilitas', 'Internet & Pulsa', 'Transportasi', 'Cicilan', 'Kesehatan'];
    const wantsCategories = ['Makanan & Kuliner', 'Hiburan & Langganan', 'Belanja Pribadi', 'Liburan'];
    const savingsCategories = ['Tabungan & Investasi', 'Dana Darurat'];

    (transactions || []).forEach(tx => {
      if (tx.type === 'expense') {
        const amt = Number(tx.amount);
        if (savingsCategories.includes(tx.category)) {
          savings += amt;
        } else if (wantsCategories.includes(tx.category)) {
          wants += amt;
        } else {
          needs += amt;
        }
      }
    });

    // Pemasukan tersisa di akhir bulan otomatis diperlakukan sebagai potensi tabungan
    const remainingNet = Math.max(0, income - (needs + wants + savings));
    savings += remainingNet;

    const needsPct = Math.round((needs / income) * 100);
    const wantsPct = Math.round((wants / income) * 100);
    const savingsPct = Math.round((savings / income) * 100);

    return {
      actual: { needs, wants, savings, needsPct, wantsPct, savingsPct },
      ideal: {
        needs: Math.round(income * 0.5),
        wants: Math.round(income * 0.3),
        savings: Math.round(income * 0.2),
        needsPct: 50,
        wantsPct: 30,
        savingsPct: 20
      }
    };
  },

  // Gamifikasi / Badges Pencapaian Kebiasaan Baik
  checkBadges(stats, debts, settings, transactions) {
    const totalDebtMonthly = DebtTracker.getTotalMonthlyInstallment(debts);
    const dti = DebtTracker.calculateDTI(totalDebtMonthly, stats.income);
    const txCount = (transactions || []).length;
    const currentEmergency = Number(settings.currentEmergencyFund || 0);
    const monthsEmergency = stats.expense > 0 ? (currentEmergency / stats.expense) : 0;
    const savingsAchieved = stats.net >= Number(settings.monthlySavingsTarget || 0);

    const badges = [
      {
        id: 'badge-first-step',
        icon: '🌱',
        title: 'Start Smart',
        desc: 'Mencatat transaksi pertama di BigBoz Finance.',
        unlocked: txCount >= 1
      },
      {
        id: 'badge-disciplined',
        icon: '🔥',
        title: 'Pencatat Disiplin',
        desc: 'Mencatat minimal 10 transaksi secara rapi.',
        unlocked: txCount >= 10
      },
      {
        id: 'badge-debt-master',
        icon: '🛡️',
        title: 'Master Pengendali Utang',
        desc: 'Mempertahankan rasio utang bulanan di bawah 30%.',
        unlocked: dti < 30 && stats.income > 0
      },
      {
        id: 'badge-emergency-ready',
        icon: '🏰',
        title: 'Benteng Finansial',
        desc: 'Memiliki dana darurat minimal 3 bulan pengeluaran.',
        unlocked: monthsEmergency >= 3
      },
      {
        id: 'badge-target-hunter',
        icon: '🎯',
        title: 'Target Hunter',
        desc: 'Berhasil mencapai target tabungan bulanan.',
        unlocked: savingsAchieved && stats.income > 0
      }
    ];

    return badges;
  }
};
