/**
 * FinVibe - Debt & Installment Tracker Module
 * Mengelola cicilan, rasio Debt-to-Income (DTI), jatuh tempo, dan simulasi pelunasan dipercepat
 */

const DebtTracker = {
  // Ambil total beban cicilan bulanan yang aktif (sisa tenor > 0)
  getTotalMonthlyInstallment(debts) {
    if (!debts || !Array.isArray(debts)) return 0;
    return debts
      .filter(d => (d.remainingTenorMonths || 0) > 0)
      .reduce((sum, d) => sum + Number(d.monthlyPayment || 0), 0);
  },

  // Hitung jumlah cicilan aktif
  getActiveDebtCount(debts) {
    if (!debts || !Array.isArray(debts)) return 0;
    return debts.filter(d => (d.remainingTenorMonths || 0) > 0).length;
  },

  // Hitung Rasio Cicilan terhadap Pemasukan (Debt-to-Income / DTI Ratio)
  calculateDTI(totalMonthlyDebt, monthlyIncome) {
    if (!monthlyIncome || monthlyIncome <= 0) return 0;
    const ratio = (totalMonthlyDebt / monthlyIncome) * 100;
    return Math.round(ratio * 10) / 10;
  },

  // Tentukan status kesehatan perbankan dari nilai DTI
  getDTIStatus(dti) {
    if (dti < 30) {
      return {
        label: 'Sangat Sehat',
        badgeClass: 'badge-emerald',
        textColor: 'text-emerald-500',
        borderColor: 'border-emerald-500/30',
        bgColor: 'bg-emerald-500/10',
        description: 'Beban cicilan aman (<30%). Kapasitas tabungan & investasi Anda sangat baik.',
        level: 'safe'
      };
    } else if (dti <= 40) {
      return {
        label: 'Perlu Waspada',
        badgeClass: 'badge-amber',
        textColor: 'text-amber-500',
        borderColor: 'border-amber-500/30',
        bgColor: 'bg-amber-500/10',
        description: 'Beban cicilan moderat (30–40%). Batasi penambahan utang konsumtif baru.',
        level: 'warning'
      };
    } else {
      return {
        label: 'Beban Berisiko',
        badgeClass: 'badge-crimson',
        textColor: 'text-red-500',
        borderColor: 'border-red-500/30',
        bgColor: 'bg-red-500/10',
        description: 'Beban cicilan tinggi (>40%). Berisiko mengganggu cash flow & dana darurat Anda.',
        level: 'danger'
      };
    }
  },

  // Hitung sisa hari menuju tanggal jatuh tempo
  getDueStatus(dueDay) {
    const today = new Date();
    const currentDay = today.getDate();
    const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    let daysRemaining;
    if (dueDay >= currentDay) {
      daysRemaining = dueDay - currentDay;
    } else {
      daysRemaining = (daysInCurrentMonth - currentDay) + dueDay;
    }

    if (daysRemaining === 0) {
      return { text: 'Jatuh tempo HARI INI', isUrgent: true, color: 'text-red-500 bg-red-500/10 border-red-500/30' };
    } else if (daysRemaining <= 3) {
      return { text: `Jatuh tempo ${daysRemaining} hari lagi`, isUrgent: true, color: 'text-red-400 bg-red-500/10 border-red-500/30' };
    } else if (daysRemaining <= 7) {
      return { text: `Jatuh tempo ${daysRemaining} hari lagi`, isUrgent: false, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    } else {
      return { text: `Jatuh tempo tgl ${dueDay}`, isUrgent: false, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
    }
  },

  // Icon cicilan sesuai jenis
  getTypeIcon(type) {
    switch (type) {
      case 'house': return { emoji: '🏠', name: 'Rumah / KPR' };
      case 'motorcycle': return { emoji: '🏍️', name: 'Motor' };
      case 'car': return { emoji: '🚗', name: 'Mobil' };
      case 'credit_card': return { emoji: '💳', name: 'Kartu Kredit' };
      default: return { emoji: '📦', name: 'Lainnya' };
    }
  },

  // Simulasi Pelunasan Dipercepat
  simulateAcceleratedPayoff(debt, extraMonthlyPayment) {
    if (!debt || debt.remainingTenorMonths <= 0) return null;
    
    const monthlyPayment = Number(debt.monthlyPayment);
    const extra = Number(extraMonthlyPayment) || 0;
    const currentRemainingMonths = Number(debt.remainingTenorMonths);
    const interestRateAnnual = Number(debt.interestRate || 0) / 100;
    
    // Perkiraan sisa saldo pokok
    const estimatedRemainingBalance = monthlyPayment * currentRemainingMonths;
    
    if (extra <= 0) {
      return {
        originalMonths: currentRemainingMonths,
        newMonths: currentRemainingMonths,
        monthsSaved: 0,
        interestSaved: 0,
        totalWithExtra: monthlyPayment
      };
    }

    const totalNewPayment = monthlyPayment + extra;
    // Estimasi tenor baru yang dipersingkat
    const newMonths = Math.max(1, Math.ceil(estimatedRemainingBalance / totalNewPayment));
    const monthsSaved = Math.max(0, currentRemainingMonths - newMonths);
    
    // Estimasi penghematan bunga (jika ada suku bunga > 0)
    let interestSaved = 0;
    if (interestRateAnnual > 0) {
      const monthlyRate = interestRateAnnual / 12;
      const normalInterest = (estimatedRemainingBalance * monthlyRate * currentRemainingMonths) / 2;
      const acceleratedInterest = (estimatedRemainingBalance * monthlyRate * newMonths) / 2;
      interestSaved = Math.max(0, Math.round(normalInterest - acceleratedInterest));
    } else {
      // Fallback penghematan waktu ekuivalen nominal
      interestSaved = Math.round(monthsSaved * (monthlyPayment * 0.1));
    }

    return {
      originalMonths: currentRemainingMonths,
      newMonths,
      monthsSaved,
      interestSaved,
      totalNewPayment
    };
  }
};
