/**
 * Charts Engine - عصر الهيمنة
 * محرك رسم المخططات البيانية المقارنة بنظام Canvas التكتيكي السيادي
 * مرتب تنازلياً من الأعلى قيمة إلى الأدنى بدون أي مكتبات خارجية
 */

class ChartsManager {
  constructor() {
    this.container = null;
    this.currentFilter = "all";
    this.currentCountries = [];

    this.configs = [
      {
        key: "budget",
        title: "الميزانية السنوية",
        legend: "الميزانية",
        color: "#fbbf24",
        type: "currency",
        getValue: (c) => (c.budget != null ? Number(c.budget) : 0)
      },
      {
        key: "population",
        title: "التعداد السكاني",
        legend: "السكان",
        color: "#38bdf8",
        type: "number",
        getValue: (c) => (c.population != null ? Number(c.population) : 0)
      },
      {
        key: "income",
        title: "متوسط دخل الفرد",
        legend: "دخل الفرد",
        color: "#34d399",
        type: "currency",
        getValue: (c) => (c.perCapitaIncome != null ? Number(c.perCapitaIncome) : 0)
      },
      {
        key: "area",
        title: "المساحة والعمران",
        legend: "المساحة",
        color: "#2dd4bf",
        type: "number",
        getValue: (c) => (c.area != null ? Number(c.area) : 0)
      },
      {
        key: "generalIndex",
        title: "المؤشر العام للدولة",
        legend: "المؤشر العام",
        color: "#c084fc",
        type: "number",
        getValue: (c) => (c.generalIndex != null ? Number(c.generalIndex) : 0)
      },
      {
        key: "oilPrice",
        title: "سعر برميل النفط",
        legend: "سعر النفط",
        color: "#fb923c",
        type: "currency",
        getValue: (c) => {
          if (c.energy && typeof c.energy.oilPrice === "number") return c.energy.oilPrice;
          if (window.EnergyEngine && typeof window.EnergyEngine.getOilPrice === "function") {
            return window.EnergyEngine.getOilPrice(c);
          }
          return 50;
        }
      },
      {
        key: "militaryPower",
        title: "القوة العسكرية المقدرة",
        legend: "القوة المقدرة",
        color: "#f87171",
        type: "number",
        getValue: (c) => {
          if (window.MilitaryEngine && typeof window.MilitaryEngine.calculateTotalPower === "function") {
            return window.MilitaryEngine.calculateTotalPower(c);
          }
          if (c.military && typeof c.military.totalPower === "number") {
            return c.military.totalPower;
          }
          if (c.military && Array.isArray(c.military.units)) {
            return c.military.units.reduce((sum, u) => sum + (Number(u.count || 0) * Number(u.power || 0)), 0);
          }
          return 0;
        }
      },
      {
        key: "currencyValue",
        title: "قيمة العملة الوطنية",
        legend: "قيمة العملة",
        color: "#60a5fa",
        type: "decimal",
        getValue: (c) => (c.currencyValue != null ? Number(c.currencyValue) : 0)
      }
    ];
  }

  init() {
    this.container = document.getElementById("charts-grid");
    this.setupFilterButtons();
  }

  setupFilterButtons() {
    const filterBtns = document.querySelectorAll(".chart-filter-btn");
    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        this.currentFilter = btn.dataset.chart;
        this.renderCharts(this.currentCountries);
      });
    });
  }

  renderCharts(countries) {
    this.currentCountries = countries || [];
    if (!this.container) {
      this.container = document.getElementById("charts-grid");
    }
    if (!this.container) return;

    this.container.innerHTML = "";

    if (this.currentCountries.length === 0) {
      this.container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 45px 20px; color:#94a3b8; background:#0d1526; border-radius:12px; border:2px dashed #223252; font-weight:800;">
          لا توجد دول مسجلة حالياً لعرض الرسوم البيانية. قم بتأسيس دولة جديدة للبدء.
        </div>
      `;
      return;
    }

    const configsToRender = this.currentFilter === "all"
      ? this.configs
      : this.configs.filter(cfg => cfg.key === this.currentFilter);

    configsToRender.forEach(cfg => {
      const card = document.createElement("div");
      card.className = "chart-card";
      card.style.background = "#0f172a";
      card.style.border = "1px solid #1e293b";
      card.style.borderRadius = "12px";
      card.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.45)";
      card.style.overflow = "hidden";

      const scrollWrap = document.createElement("div");
      scrollWrap.className = "chart-scroll-wrap";

      const canvas = document.createElement("canvas");
      canvas.className = "chart-canvas";

      scrollWrap.appendChild(canvas);
      card.appendChild(scrollWrap);
      this.container.appendChild(card);

      this.drawChart(canvas, cfg, this.currentCountries);
    });
  }

  drawChart(canvas, cfg, countries) {
    // 1. الفرز التنازلي الحاسم للدول من الأعلى قيمة إلى الأقل
    const sortedData = [...countries].map(c => ({
      country: c,
      val: Math.max(0, cfg.getValue(c))
    })).sort((a, b) => b.val - a.val);

    const values = sortedData.map(d => d.val);
    const maxVal = Math.max(...values, 0);

    // حساب مقياس الرسم المتزن وتفادي تداخل نصوص محور Y
    const scale = this.calculateScale(maxVal, cfg.type);

    const minWidth = Math.max(900, sortedData.length * 48 + 160);
    const cssWidth = minWidth;
    const cssHeight = 310;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // 2. خلفية تكتيكية سيادية عالية الفخامة
    const bgGrad = ctx.createLinearGradient(0, 0, 0, cssHeight);
    bgGrad.addColorStop(0, "#111c30");
    bgGrad.addColorStop(1, "#090f1d");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // 3. الرأس العلوي: العنوان والتصنيف
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px 'Cairo', 'Segoe UI', Tahoma, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(cfg.title, cssWidth / 2, 14);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 11px 'Cairo', 'Segoe UI', Tahoma, sans-serif";
    ctx.fillText("▼ ترتيب تنازلي (من الأكثر إلى الأقل)", cssWidth / 2, 34);

    // مساحة الرسم (Plot Area)
    const plotLeft = 60;
    const plotRight = cssWidth - 85;
    const plotTop = 60;
    const plotBottom = cssHeight - 65;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;

    // 4. مفتاح الرسم التكتيكي (Legend) في الجهة اليمنى العليا
    ctx.fillStyle = this.hexToRgba(cfg.color, 0.2);
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 1;
    this.roundRect(ctx, plotRight - 130, 14, 130, 26, 6, true, true);

    ctx.fillStyle = cfg.color;
    ctx.fillRect(plotRight - 22, 22, 10, 10);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px 'Cairo', sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(cfg.legend, plotRight - 28, 27);

    // 5. رسم الخطوط الأفقية التكتيكية وقيم المحور الرأسي Y
    ctx.lineWidth = 1;
    scale.ticks.forEach(tick => {
      const ratio = scale.max > 0 ? (tick / scale.max) : 0;
      const y = plotBottom - (ratio * plotHeight);

      // خطوط الشبكة الخافتة
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
      ctx.setLineDash([]); // إعادة الخط المتصل

      // نصوص المحور Y على اليمين
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px 'Cairo', Tahoma, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(this.formatLabel(tick, cfg.type), plotRight + 8, y);
    });

    // محور Y الرأسي الأيمن
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotRight, plotTop);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // محور X الأفقي السفلي
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plotLeft, plotBottom);
    ctx.lineTo(plotRight, plotBottom);
    ctx.stroke();

    // 6. رسم الأعمدة الرأسية والقيم الذهبية وأسماء الدول من اليمين إلى اليسار (RTL الطبيعي)
    const colWidth = plotWidth / sortedData.length;
    const barWidth = Math.max(8, Math.min(28, colWidth * 0.55));

    sortedData.forEach((item, index) => {
      const val = item.val;
      const ratio = scale.max > 0 ? (val / scale.max) : 0;
      const barHeight = Math.max(2, ratio * plotHeight);

      // الترتيب من اليمين إلى اليسار: المركز الأول يميناً بجانب المحور وينحدر تنازلياً نحو اليسار
      const colCenterX = plotRight - (index + 0.5) * colWidth;
      const barX = colCenterX - (barWidth / 2);
      const barY = plotBottom - barHeight;

      // تدرج لوني عمودي للعمود مع إضاءة علوية
      const barGrad = ctx.createLinearGradient(0, barY, 0, plotBottom);
      barGrad.addColorStop(0, cfg.color);
      barGrad.addColorStop(1, this.hexToRgba(cfg.color, 0.35));

      ctx.fillStyle = barGrad;
      this.roundTopRect(ctx, barX, barY, barWidth, barHeight, 4);

      // القيمة الرقمية البراقة أعلى كل عمود
      const barValueText = this.formatBarValue(val, cfg.type);
      ctx.save();
      ctx.fillStyle = val > 0 ? "#fbbf24" : "#64748b";
      ctx.font = "bold 11px 'Cairo', Tahoma, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      const textY = Math.max(plotTop + 5, barY - 4);

      if (colWidth < 38 && barValueText.length > 5) {
        ctx.font = "bold 9px 'Cairo', sans-serif";
        ctx.translate(colCenterX, barY - 4);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(barValueText, 0, 0);
      } else {
        ctx.fillText(barValueText, colCenterX, textY);
      }
      ctx.restore();

      // اسم الدولة أسفل العمود بزاوية أنيقة وواضحة
      ctx.save();
      ctx.translate(colCenterX, plotBottom + 8);
      ctx.rotate(Math.PI / 4);
      ctx.font = "bold 11px 'Cairo', Tahoma, sans-serif";
      ctx.fillStyle = val > 0 ? "#f1f5f9" : "#64748b";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(item.country.name, 4, 0);
      ctx.restore();
    });
  }

  // رسم مستطيل بحواف علوية منحنية فقط للأعمدة
  roundTopRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  }

  // رسم مستطيل كامل الحواف المنحنية
  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // تحويل كود Hex إلى RGBA بشفافية ناعمة
  hexToRgba(hex, alpha) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(c => c + c).join("");
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  formatBarValue(val, type) {
    if (val === 0) return "0";
    if (type === "currency") return "$" + Number(val).toLocaleString();
    if (type === "decimal") return Number(val).toFixed(2);
    return Number(val).toLocaleString();
  }

  // محرك التدريج الذكي المتوازن لمنع التداخل تماماً
  calculateScale(maxVal, type) {
    if (maxVal <= 0) {
      if (type === "decimal") return { max: 1.0, ticks: [0, 0.25, 0.5, 0.75, 1.0] };
      return { max: 100, ticks: [0, 25, 50, 75, 100] };
    }

    // استهداف من 4 إلى 5 تدريجات فقط لضمان التباعد والوضوح
    const targetSteps = 5;
    const roughStep = maxVal / targetSteps;

    let step;
    if (roughStep < 1) {
      if (roughStep <= 0.05) step = 0.05;
      else if (roughStep <= 0.1) step = 0.1;
      else if (roughStep <= 0.2) step = 0.2;
      else if (roughStep <= 0.25) step = 0.25;
      else if (roughStep <= 0.5) step = 0.5;
      else step = 1.0;
    } else {
      const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
      const normalized = roughStep / magnitude;

      let niceFactor = 1;
      if (normalized <= 1.2) niceFactor = 1;
      else if (normalized <= 2.5) niceFactor = 2;
      else if (normalized <= 5) niceFactor = 5;
      else niceFactor = 10;

      step = niceFactor * magnitude;
    }

    const niceMax = Math.ceil(maxVal / step) * step;
    const ticks = [];
    for (let t = 0; t <= niceMax + (step * 0.01); t += step) {
      ticks.push(type === "decimal" ? Number(t.toFixed(2)) : Math.round(t));
    }

    return { max: niceMax, ticks };
  }

  formatLabel(val, type) {
    if (val === 0) return type === "currency" ? "$0" : "0";
    if (type === "currency") return "$" + Number(val).toLocaleString();
    if (type === "decimal") return Number(val).toFixed(2);
    return Number(val).toLocaleString();
  }
}

window.ChartsManager = new ChartsManager();