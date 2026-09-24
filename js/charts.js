/**
 * FinVibe - Chart.js Visualizations & Analytics Engine
 * Mengelola 4 grafik: Tren Mingguan, Distribusi Kategori, Komparasi Bulanan, & Pola Hari
 * Mendukung transisi tema dinamis Dark Mode & Light Mode
 */

const FinVibeCharts = {
  lineChart: null,
  donutChart: null,
  comparisonBarChart: null,
  dayPatternBarChart: null,

  // Helper warna tema
  getThemeColors(theme) {
    const isDark = theme === 'dark';
    return {
      textColor: isDark ? '#94A3B8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      tooltipText: isDark ? '#F8FAFC' : '#0F172A',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'
    };
  },

  // 1. Line Chart: Tren Pemasukan vs Pengeluaran
  renderLineChart(canvasId, transactions, theme) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.lineChart) {
      this.lineChart.destroy();
    }

    const tc = this.getThemeColors(theme);

    // Kumpulkan 7 hari terakhir
    const days = [];
    const incomeData = [0, 0, 0, 0, 0, 0, 0];
    const expenseData = [0, 0, 0, 0, 0, 0, 0];

    // Helper: ambil tanggal YYYY-MM-DD dari tx (support createdAt, string, dan serial Excel)
    const getTxDateStr = (tx) => {
      if (tx.createdAt) return tx.createdAt.split('T')[0];
      if (!tx.date) return '';
      if (typeof tx.date === 'number' || /^\d{5,}$/.test(String(tx.date))) {
        return new Date((Number(tx.date) - 25569) * 86400000).toISOString().split('T')[0];
      }
      return String(tx.date).split('T')[0];
    };

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      days.push(dayName);

      const dateStr = d.toISOString().split('T')[0];
      (transactions || []).forEach(tx => {
        if (getTxDateStr(tx) === dateStr) {
          const amt = Number(tx.amount);
          if (tx.type === 'income') incomeData[6 - i] += amt;
          if (tx.type === 'expense') expenseData[6 - i] += amt;
        }
      });
    }

    // Tampilkan data asli (tanpa fallback demo)
    const finalIncome = incomeData;
    const finalExpense = expenseData;

    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Pemasukan',
            data: finalIncome,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            fill: true,
            tension: 0.38,
            borderWidth: 2.5,
            pointBackgroundColor: '#10B981',
            pointBorderColor: '#FFF',
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Pengeluaran',
            data: finalExpense,
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            fill: true,
            tension: 0.38,
            borderWidth: 2.5,
            pointBackgroundColor: '#EF4444',
            pointBorderColor: '#FFF',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: tc.textColor,
              font: { family: 'Plus Jakarta Sans', size: 12, weight: '500' },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipText,
            bodyColor: tc.tooltipText,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                label += 'Rp ' + Number(context.raw).toLocaleString('id-ID');
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: tc.gridColor },
            ticks: { color: tc.textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: tc.gridColor },
            ticks: {
              color: tc.textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: function(value) {
                if (value >= 1000000) return (value / 1000000) + ' Jt';
                if (value >= 1000) return (value / 1000) + ' Rb';
                return value;
              }
            }
          }
        }
      }
    });
  },

  // 2. Donut Chart: Distribusi Pengeluaran per Kategori
  renderDonutChart(canvasId, transactions, theme) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.donutChart) {
      this.donutChart.destroy();
    }

    const tc = this.getThemeColors(theme);

    const categories = {};
    (transactions || []).forEach(tx => {
      if (tx.type === 'expense') {
        categories[tx.category] = (categories[tx.category] || 0) + Number(tx.amount);
      }
    });

    const labels = Object.keys(categories);
    const dataValues = Object.values(categories);

    // Palet warna modern berkarakter
    const colorPalette = [
      '#8B5CF6', // Violet (Cicilan)
      '#EF4444', // Crimson
      '#3B82F6', // Blue
      '#10B981', // Emerald
      '#F59E0B', // Amber
      '#EC4899', // Pink
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#6366F1'  // Indigo
    ];

    this.donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['Cicilan', 'Belanja', 'Utilitas', 'Kuliner', 'Lainnya'],
        datasets: [{
          data: dataValues.length ? dataValues : [3450000, 1950000, 960000, 820000, 490000],
          backgroundColor: colorPalette.slice(0, Math.max(labels.length, 5)),
          borderWidth: 2,
          borderColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: tc.textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipText,
            bodyColor: tc.tooltipText,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.raw;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: Rp ${val.toLocaleString('id-ID')} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  // 3. Bar Chart: Bulan Ini vs Bulan Lalu (Data-Analyst View)
  renderComparisonChart(canvasId, currentStats, lastMonthStats, theme) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.comparisonBarChart) {
      this.comparisonBarChart.destroy();
    }

    const tc = this.getThemeColors(theme);

    const labels = ['Pemasukan', 'Pengeluaran', 'Saldo Bersih'];
    const currentData = [
      currentStats.income || 0,
      currentStats.expense || 0,
      Math.max(0, currentStats.net || 0)
    ];
    const lastData = [
      lastMonthStats.income || 15800000,
      lastMonthStats.expense || 10250000,
      Math.max(0, lastMonthStats.net || 5550000)
    ];

    this.comparisonBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Bulan Lalu',
            data: lastData,
            backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.6)',
            borderRadius: 6,
            borderWidth: 0
          },
          {
            label: 'Bulan Ini',
            data: currentData,
            backgroundColor: [
              '#10B981', // Pemasukan
              '#EF4444', // Pengeluaran
              '#3B82F6'  // Net
            ],
            borderRadius: 6,
            borderWidth: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: tc.textColor,
              font: { family: 'Plus Jakarta Sans', size: 12 },
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipText,
            bodyColor: tc.tooltipText,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: Rp ${Number(context.raw).toLocaleString('id-ID')}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tc.textColor, font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' } }
          },
          y: {
            grid: { color: tc.gridColor },
            ticks: {
              color: tc.textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: function(value) {
                if (value >= 1000000) return (value / 1000000) + ' Jt';
                return value;
              }
            }
          }
        }
      }
    });
  },

  // 4. Bar Chart: Pola Pengeluaran per Hari dalam Seminggu
  renderDayPatternChart(canvasId, transactions, theme) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.dayPatternBarChart) {
      this.dayPatternBarChart.destroy();
    }

    const tc = this.getThemeColors(theme);

    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];

    (transactions || []).forEach(tx => {
      if (tx.type === 'expense') {
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
        if (!d || isNaN(d.getTime())) return;
        let dayIdx = d.getDay();
        const mappedIdx = (dayIdx + 6) % 7;
        dayTotals[mappedIdx] += Number(tx.amount);
      }
    });

    // Cari hari dengan pengeluaran tertinggi (hari paling boros)
    const maxVal = Math.max(...dayTotals);
    const maxIdx = dayTotals.indexOf(maxVal);

    // Warna: hari paling boros diberi highlight Crimson Red / Amber mencolok
    const backgroundColors = dayTotals.map((val, idx) => {
      if (val === maxVal && maxVal > 0) {
        return '#EF4444'; // Highlight Hari Terboros
      }
      return theme === 'dark' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(59, 130, 246, 0.55)';
    });

    this.dayPatternBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dayNames,
        datasets: [{
          label: 'Total Pengeluaran',
          data: dayTotals,
          backgroundColor: backgroundColors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tc.tooltipBg,
            titleColor: tc.tooltipText,
            bodyColor: tc.tooltipText,
            borderColor: tc.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                const isMax = context.dataIndex === maxIdx && maxVal > 0;
                const prefix = isMax ? '🔥 HARI TERBOROS: ' : ' Pengeluaran: ';
                return prefix + 'Rp ' + Number(context.raw).toLocaleString('id-ID');
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tc.textColor, font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' } }
          },
          y: {
            grid: { color: tc.gridColor },
            ticks: {
              color: tc.textColor,
              font: { family: 'JetBrains Mono', size: 11 },
              callback: function(value) {
                if (value >= 1000000) return (value / 1000000) + ' Jt';
                if (value >= 1000) return (value / 1000) + ' Rb';
                return value;
              }
            }
          }
        }
      }
    });

    // Update label hari terboros di UI jika elemen ada
    const mostWastefulDayEl = document.getElementById('mostWastefulDayBadge');
    if (mostWastefulDayEl) {
      if (maxVal > 0) {
        mostWastefulDayEl.textContent = `Hari Terboros: ${dayNames[maxIdx]} (Rp ${maxVal.toLocaleString('id-ID')})`;
        mostWastefulDayEl.className = 'text-xs font-semibold px-2.5 py-1 rounded-full badge-crimson';
      } else {
        mostWastefulDayEl.textContent = 'Belum ada data pengeluaran harian';
        mostWastefulDayEl.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400';
      }
    }
  },

  // Refresh semua grafik sekaligus dengan data & tema terkini
  refreshAll(transactions, stats, lastMonthStats, theme) {
    this.renderLineChart('trendLineChart', transactions, theme);
    this.renderDonutChart('categoryDonutChart', transactions, theme);
    this.renderComparisonChart('comparisonBarChart', stats, lastMonthStats, theme);
    this.renderDayPatternChart('dayPatternBarChart', transactions, theme);
  }
};
