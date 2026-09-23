/**
 * BigBoz Finance - Comprehensive Executive Financial Statement PDF Exporter
 * Menghasilkan dokumen laporan keuangan lengkap: Ringkasan Eksekutif, Skor Kesehatan,
 * Rekomendasi/Saran Cerdas Kontekstual, Visualisasi Grafik Chart.js, Portofolio Cicilan & Riwayat Transaksi Lengkap
 */

const FinVibePDF = {
  exportReport(data) {
    const { stats, debts, transactions, settings, healthScore } = data;
    const { jsPDF } = window.jspdf;
    
    if (!jsPDF) {
      if (typeof showToast === 'function') {
        showToast('Library jsPDF gagal dimuat. Pastikan koneksi internet aktif.', 'danger');
      }
      return;
    }

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 14;
      const contentWidth = pageWidth - (margin * 2); // 182mm

      const todayStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      // Hitung metrik pendukung
      const totalDebtMonthly = DebtTracker.getTotalMonthlyInstallment(debts);
      const dtiRatio = DebtTracker.calculateDTI(totalDebtMonthly, stats.income);
      const dtiStatus = DebtTracker.getDTIStatus(dtiRatio);
      const health = healthScore || FinancialEducation.calculateHealthScore(stats, debts, settings);
      const ruleData = FinancialEducation.calculate503020Rule(stats, transactions);
      const insights = FinancialEducation.generateDynamicInsights(stats, debts, settings, transactions);

      // Helper Header Bar
      const renderHeaderBanner = (pageTitle, subTitle, pageNum = 1) => {
        doc.setFillColor(15, 23, 42); // Slate 900
        doc.rect(0, 0, pageWidth, 28, 'F');

        // Logo & Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text('BigBoz — Laporan Keuangan Pribadi', margin, 12);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(pageTitle || 'Executive Personal Financial Statement & Intelligence Report', margin, 19);

        // Right details
        doc.setFontSize(8);
        doc.setTextColor(203, 213, 225);
        doc.text(`Tgl Laporan: ${todayStr}`, pageWidth - margin, 10, { align: 'right' });
        doc.text(`Profil: ${settings.profileType === 'freelancer' ? 'Freelancer' : (settings.profileType === 'married' ? 'Berkeluarga' : 'Lajang')}`, pageWidth - margin, 15, { align: 'right' });
        doc.text(`Privasi: 100% Client-Side (Lokal)`, pageWidth - margin, 20, { align: 'right' });

        // Accent bottom line
        doc.setFillColor(56, 189, 248); // Sky 400
        doc.rect(0, 27.5, pageWidth, 0.8, 'F');
      };

      // ========================================================
      // HALAMAN 1: EXECUTIVE SUMMARY, HEALTH SCORE & REKOMENDASI
      // ========================================================
      renderHeaderBanner('Ringkasan Eksekutif, Skor Kesehatan & Rekomendasi Cerdas', 'Hal 1');

      let currentY = 36;

      // 1. Executive Metric Boxes (Grid 3x2)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('I. METRIK KEUANGAN UTAMA (KEY FINANCIAL INDICATORS)', margin, currentY);
      currentY += 5;

      const boxW = (contentWidth - 8) / 3; // ~58mm
      const boxH = 18;

      const kpis = [
        { label: 'Saldo Kas Bersih', val: `Rp ${stats.net.toLocaleString('id-ID')}`, sub: 'Pemasukan - Pengeluaran', color: [14, 165, 233] },
        { label: 'Total Pemasukan', val: `Rp ${stats.income.toLocaleString('id-ID')}`, sub: 'Arus kas masuk bulan ini', color: [16, 185, 129] },
        { label: 'Total Pengeluaran', val: `Rp ${stats.expense.toLocaleString('id-ID')}`, sub: 'Kebutuhan & gaya hidup', color: [239, 68, 68] },
        { label: 'Beban Cicilan Bulanan', val: `Rp ${totalDebtMonthly.toLocaleString('id-ID')}`, sub: `${DebtTracker.getActiveDebtCount(debts)} cicilan aktif`, color: [139, 92, 246] },
        { label: 'Burn Rate Harian', val: `Rp ${Math.round(stats.dailyBurnRate).toLocaleString('id-ID')} / hr`, sub: 'Rata-rata pengeluaran harian', color: [245, 158, 11] },
        { label: 'Target Tabungan', val: `Rp ${(settings.monthlySavingsTarget || 0).toLocaleString('id-ID')}`, sub: `${Math.min(100, Math.round((stats.net / (settings.monthlySavingsTarget || 1)) * 100))}% tercapai`, color: [16, 185, 129] }
      ];

      kpis.forEach((kpi, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = margin + (col * (boxW + 4));
        const by = currentY + (row * (boxH + 3));

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'FD');

        // Top accent
        doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.rect(bx, by, boxW, 1.2, 'F');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, bx + 3.5, by + 5.5);

        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(kpi.val, bx + 3.5, by + 11.5);

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(kpi.sub, bx + 3.5, by + 15.5);
      });

      currentY += (boxH * 2) + 10;

      // 2. Financial Health Score Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('II. EVALUASI SKOR KESEHATAN FINANSIAL (FINANCIAL HEALTH SCORE)', margin, currentY);
      currentY += 5;

      // Background card
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, currentY, contentWidth, 26, 2, 2, 'FD');

      // Score Big Badge
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(margin + 4, currentY + 3.5, 34, 19, 2, 2, 'F');
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(56, 189, 248);
      doc.text(`${health.totalScore}`, margin + 21, currentY + 12, { align: 'center' });
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('DARI 100 POIN', margin + 21, currentY + 18, { align: 'center' });

      // Grade & Advice
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Predikat: ${health.grade.title}`, margin + 42, currentY + 9);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const splitAdvice = doc.splitTextToSize(health.grade.advice, contentWidth - 46);
      doc.text(splitAdvice, margin + 42, currentY + 14);

      // Breakdown mini row
      const bd = health.breakdown;
      const bdText = `Tabungan: ${bd.savings.points}/35 pt  |  Beban Cicilan (DTI): ${bd.dti.points}/30 pt (${dtiRatio}%)  |  Dana Darurat: ${bd.emergency.points}/20 pt  |  Disiplin: ${bd.consistency.points}/15 pt`;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(bdText, margin + 42, currentY + 22);

      currentY += 32;

      // 3. Formula 50 / 30 / 20 Analysis
      if (ruleData) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('III. ANALISIS FORMULA ALOKASI 50 / 30 / 20', margin, currentY);
        currentY += 4;

        const actual = ruleData.actual;
        const ruleRows = [
          ['Kebutuhan Pokok (Needs)', `Rp ${actual.needs.toLocaleString('id-ID')}`, `${actual.needsPct}%`, 'Maksimal 50%', actual.needsPct <= 50 ? 'Ideal' : 'Berlebih'],
          ['Keinginan & Gaya Hidup (Wants)', `Rp ${actual.wants.toLocaleString('id-ID')}`, `${actual.wantsPct}%`, 'Maksimal 30%', actual.wantsPct <= 30 ? 'Terkendali' : 'Perlu Penghematan'],
          ['Tabungan & Investasi (Savings)', `Rp ${actual.savings.toLocaleString('id-ID')}`, `${actual.savingsPct}%`, 'Minimal 20%', actual.savingsPct >= 20 ? 'Optimal' : 'Di Bawah Standar']
        ];

        doc.autoTable({
          startY: currentY,
          head: [['Pos Pengeluaran', 'Nominal Aktual', 'Porsi Riil', 'Batas Standar', 'Status Evaluasi']],
          body: ruleRows,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], fontSize: 8, halign: 'center' },
          styles: { fontSize: 7.5, cellPadding: 2.2 },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'center', fontStyle: 'bold' },
            3: { halign: 'center' },
            4: { halign: 'center', fontStyle: 'bold' }
          },
          margin: { left: margin, right: margin }
        });

        currentY = doc.lastAutoTable.finalY + 8;
      }

      // 4. Saran & Rekomendasi Finansial Cerdas (Actionable Advice)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('IV. REKOMENDASI & SARAN STRATEGIS BIGBOZ', margin, currentY);
      currentY += 5;

      const renderedInsights = insights.slice(0, 3);
      renderedInsights.forEach((item, i) => {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, currentY, contentWidth, 16, 1.5, 1.5, 'FD');

        // Color indicator bar
        let barColor = [56, 189, 248]; // Sky
        if (item.type === 'danger') barColor = [239, 68, 68];
        else if (item.type === 'warning') barColor = [245, 158, 11];
        else if (item.type === 'success') barColor = [16, 185, 129];

        doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        doc.rect(margin, currentY, 2.5, 16, 'F');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${i + 1}. ${item.title}`, margin + 6, currentY + 5.5);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const splitText = doc.splitTextToSize(item.text, contentWidth - 10);
        doc.text(splitText, margin + 6, currentY + 10.5);

        currentY += 19;
      });

      // ========================================================
      // HALAMAN 2: VISUALISASI GRAFIK ANALISIS (CHARTS IN PDF)
      // ========================================================
      doc.addPage();
      renderHeaderBanner('Analisis Visual Grafik & Pola Arus Kas', 'Hal 2');

      currentY = 36;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('V. DOKUMENTASI GRAFIK ANALITIS (CHART VISUALIZATIONS)', margin, currentY);
      currentY += 5;

      // Tangkap gambar Chart.js dari canvas HTML
      const getChartImg = (chartInstance) => {
        if (!chartInstance) return null;
        try {
          return chartInstance.toBase64Image('image/png', 1.0);
        } catch (e) {
          console.warn('Gagal render chart to base64:', e);
          return null;
        }
      };

      const lineImg = getChartImg(FinVibeCharts.lineChart);
      const donutImg = getChartImg(FinVibeCharts.donutChart);
      const compImg = getChartImg(FinVibeCharts.comparisonBarChart);
      const dayImg = getChartImg(FinVibeCharts.dayPatternBarChart);

      const chartW = (contentWidth - 6) / 2; // ~88mm
      const chartH = 54;

      // Row 1: Line Chart & Donut Chart
      if (lineImg) {
        doc.setFillColor(15, 23, 42); // Dark slate card container
        doc.roundedRect(margin, currentY, chartW, chartH, 2, 2, 'F');
        doc.addImage(lineImg, 'PNG', margin + 1.5, currentY + 1.5, chartW - 3, chartH - 3);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Grafik 1: Tren Pemasukan vs Pengeluaran Mingguan', margin, currentY + chartH + 4);
      }

      if (donutImg) {
        const dx = margin + chartW + 6;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(dx, currentY, chartW, chartH, 2, 2, 'F');
        doc.addImage(donutImg, 'PNG', dx + 1.5, currentY + 1.5, chartW - 3, chartH - 3);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Grafik 2: Proporsi Distribusi Belanja per Kategori', dx, currentY + chartH + 4);
      }

      currentY += chartH + 11;

      // Row 2: Comparison Bar & Day Pattern Bar
      if (compImg) {
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(margin, currentY, chartW, chartH, 2, 2, 'F');
        doc.addImage(compImg, 'PNG', margin + 1.5, currentY + 1.5, chartW - 3, chartH - 3);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Grafik 3: Komparasi Bulan Ini vs Bulan Lalu', margin, currentY + chartH + 4);
      }

      if (dayImg) {
        const dx = margin + chartW + 6;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(dx, currentY, chartW, chartH, 2, 2, 'F');
        doc.addImage(dayImg, 'PNG', dx + 1.5, currentY + 1.5, chartW - 3, chartH - 3);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Grafik 4: Pola Pengeluaran Hari & Hari Terboros', dx, currentY + chartH + 4);
      }

      currentY += chartH + 12;

      // Catatan Analisis Pola Belanja
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, 34, 2, 2, 'FD');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Catatan Analis Finansial (Data-Analyst Observations):', margin + 4, currentY + 6);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);

      const notesObservations = [
        `1. Arus kas bersih saat ini berada pada posisi ${stats.net >= 0 ? 'SURPLUS' : 'DEFISIT'} sebesar Rp ${Math.abs(stats.net).toLocaleString('id-ID')}.`,
        `2. Rata-rata konsumsi kas harian (Burn Rate) tercatat Rp ${Math.round(stats.dailyBurnRate).toLocaleString('id-ID')} per hari.`,
        `3. Pola hari menunjukkan fluktuasi belanja yang perlu diawasi pada akhir pekan guna menjaga disiplin anggaran.`,
        `4. Total cicilan menyerap ${(stats.income > 0 ? (totalDebtMonthly / stats.income * 100).toFixed(1) : 0)}% dari arus kas masuk bulanan Anda.`
      ];

      notesObservations.forEach((n, idx) => {
        doc.text(n, margin + 4, currentY + 12 + (idx * 5));
      });

      // ========================================================
      // HALAMAN 3: MANAJEMEN PORTOFOLIO CICILAN & TRANSAKSI
      // ========================================================
      doc.addPage();
      renderHeaderBanner('Portofolio Cicilan, Beban Utang & Riwayat Transaksi Lengkap', 'Hal 3');

      currentY = 36;

      // Section VI: Portofolio Cicilan & DTI
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('VI. PORTOFOLIO CICILAN & ANALISIS DEBT-TO-INCOME (DTI)', margin, currentY);
      currentY += 4;

      // Info Bar DTI
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, currentY, contentWidth, 9, 1.5, 1.5, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rasio DTI: ${dtiRatio}% (Status: ${dtiStatus.label})`, margin + 3, currentY + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Total Cicilan Bulanan: Rp ${totalDebtMonthly.toLocaleString('id-ID')} | Standar Sehat: <30%`, pageWidth - margin - 3, currentY + 6, { align: 'right' });

      currentY += 12;

      // Tabel Cicilan Lengkap dengan Catatan
      const debtRows = (debts || []).map(d => {
        const estRemaining = (d.monthlyPayment * d.remainingTenorMonths).toLocaleString('id-ID');
        const progress = Math.round(((d.totalTenorMonths - d.remainingTenorMonths) / d.totalTenorMonths) * 100);
        return [
          d.name,
          DebtTracker.getTypeIcon(d.type).name,
          `Rp ${Number(d.monthlyPayment).toLocaleString('id-ID')}`,
          `${d.remainingTenorMonths}/${d.totalTenorMonths} bln`,
          `Rp ${estRemaining}`,
          `Tgl ${d.dueDay}`,
          `${progress}%`,
          d.notes || '-'
        ];
      });

      doc.autoTable({
        startY: currentY,
        head: [['Nama Pinjaman', 'Jenis', 'Cicilan/Bln', 'Sisa Tenor', 'Est. Sisa Pokok', 'Jatuh Tempo', 'Progres', 'Catatan Khusus']],
        body: debtRows.length ? debtRows : [['Tidak ada cicilan aktif', '-', '-', '-', '-', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246], fontSize: 7.5, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 32 },
          2: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          7: { cellWidth: 35 }
        },
        margin: { left: margin, right: margin }
      });

      currentY = doc.lastAutoTable.finalY + 9;

      // Section VII: Riwayat Catatan Transaksi Lengkap
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('VII. BUKU CATATAN TRANSAKSI (DETAILED TRANSACTION LOG)', margin, currentY);
      currentY += 4;

      const txRows = (transactions || []).map(tx => {
        const isInc = tx.type === 'income';
        const formattedAmt = `${isInc ? '+' : '-'} Rp ${Number(tx.amount).toLocaleString('id-ID')}`;
        return [
          tx.date,
          isInc ? 'Masuk' : 'Keluar',
          tx.category,
          tx.notes || '-',
          formattedAmt
        ];
      });

      doc.autoTable({
        startY: currentY,
        head: [['Tanggal', 'Tipe', 'Kategori', 'Catatan / Keterangan Lengkap', 'Nominal']],
        body: txRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 7.5 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          1: { halign: 'center' },
          3: { cellWidth: 70 },
          4: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin },
        didDrawPage: function(data) {
          // Jika transaksi melebihi 1 halaman, render mini banner header di halaman baru
          if (doc.internal.getNumberOfPages() > 3 && data.pageNumber > 3) {
            renderHeaderBanner('Buku Catatan Transaksi (Lanjutan)', `Hal ${data.pageNumber}`);
          }
        }
      });

      // ========================================================
      // FOOTER DI SETIAP HALAMAN
      // ========================================================
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        
        // Garis batas footer tipis
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, 287, pageWidth - margin, 287);

        doc.text(
          `Dokumen Resmi BigBoz — Laporan Keuangan Pribadi`,
          margin,
          291
        );
        doc.text(
          `Halaman ${i} dari ${totalPages}`,
          pageWidth - margin,
          291,
          { align: 'right' }
        );
      }

      // Download PDF
      const filename = `BigBoz_Laporan_Keuangan_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      if (typeof showToast === 'function') {
        showToast(`Laporan PDF Lengkap "${filename}" berhasil diunduh!`, 'success');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      if (typeof showToast === 'function') {
        showToast('Gagal membuat laporan PDF: ' + err.message, 'danger');
      }
    }
  }
};
