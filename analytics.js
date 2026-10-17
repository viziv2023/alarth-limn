/**
 * Analytics Engine - عصر الهيمنة
 * محرك واجهة "تحليل" لاستعراض وترتيب مؤشرات الدول تنازلياً مع الحسابات التجميعية والأعلام السيادية
 */

class AnalyticsManager {
  constructor() {
    this.container = null;
  }

  init() {
    this.container = document.getElementById("analytics-grid-wrapper");
  }

  static getCountryTotalPopulation(country) {
    if (window.BuildingsEngine && typeof window.BuildingsEngine.getTotalHousingCapacity === "function") {
      const cap = window.BuildingsEngine.getTotalHousingCapacity(country);
      if (cap > 0) return cap;
    }

    if (country.buildings) {
      const b = country.buildings;
      const bldgPop = (
        (Number(b.house || 0) * 4) +
        (Number(b.house_large || 0) * 6) +
        (Number(b.palace || 0) * 10) +
        (Number(b.apartments || 0) * 50) +
        (Number(b.hotel || 0) * 100) +
        (Number(b.residential_towers || 0) * 300) +
        (Number(b.skyscrapers || 0) * 800)
      );
      if (bldgPop > 0) return bldgPop;
    }
    return Number(country.population) || 0;
  }

  // توليد كود HTML لعلم الدولة المصغر (3 أسطر × 4 أعمدة)
  static renderFlagHtml(flagMatrix, pixelW = 5, pixelH = 4) {
    if (!flagMatrix || !Array.isArray(flagMatrix) || flagMatrix.length === 0) {
      return `<span style="display:inline-block; width:${pixelW * 4}px; height:${pixelH * 3}px; background:#334155; border-radius:2px; border:1px solid #475569; vertical-align:middle; flex-shrink:0;"></span>`;
    }

    let pixels = "";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const color = (flagMatrix[r] && flagMatrix[r][c]) ? flagMatrix[r][c] : "#ffffff";
        pixels += `<span style="background-color:${color}; display:block; width:${pixelW}px; height:${pixelH}px;"></span>`;
      }
    }

    return `
      <span style="display:inline-grid; grid-template-columns:repeat(4, ${pixelW}px); grid-template-rows:repeat(3, ${pixelH}px); gap:0; border:1px solid rgba(255,255,255,0.25); border-radius:2px; overflow:hidden; vertical-align:middle; box-shadow:0 1px 2px rgba(0,0,0,0.4); flex-shrink:0;">
        ${pixels}
      </span>
    `;
  }

  // عرض اسم الدولة مدمجاً معه العلم السيادي
  static getCountryNameWithFlag(country) {
    if (!country) return "-";
    const name = country.name || "دولة";
    const flag = country.flag || country.flagData || country.flagMatrix;
    const flagHtml = AnalyticsManager.renderFlagHtml(flag, 5, 4);

    return `
      <div style="display:inline-flex; align-items:center; gap:8px; vertical-align:middle;">
        ${flagHtml}
        <span style="font-weight:600; color:#f8fafc;">${name}</span>
      </div>
    `;
  }

  // حساب إجمالي تكلفة الطاقة والتشغيل للمنشآت المستهلكة للمال (تشمل محطات الطاقة النظيفة)
  static getCountryOperationalExpenditure(country) {
    const opBuildingIds = [
      "water_well",
      "water_pump",
      "water_desalination",
      "power_generator",
      "power_plant",
      "police_station",
      "fire_station",
      "police_headquarters",
      "municipality",
      "governorate",
      "solar_farm",
      "wind_station",
      "nuclear_reactor"
    ];

    let totalOpCost = 0;
    const bldgs = country.buildings || {};

    opBuildingIds.forEach(id => {
      const count = Number(bldgs[id] || 0);
      if (count > 0) {
        const res = window.BuildingsEngine ? window.BuildingsEngine.getResource(id) : null;
        if (res && res.revenue < 0) {
          totalOpCost += Math.abs(res.revenue) * count;
        }
      }
    });

    return totalOpCost;
  }

  render(world) {
    if (!this.container) {
      this.container = document.getElementById("analytics-grid-wrapper");
    }
    if (!this.container || !world) return;

    const countries = world.getAllCountries() || [];
    this.container.innerHTML = "";

    if (countries.length === 0) {
      this.container.innerHTML = `
        <div style="text-align:center; padding: 40px; color:#888; background:#1b2431; border-radius:8px; border:1px dashed #303e54; width:100%;">
          لا توجد دول مسجلة حالياً لإجراء التحليل. قم بتأسيس دولة جديدة أو استيراد ملف حفظ.
        </div>
      `;
      return;
    }

    const n = countries.length;

    countries.forEach(c => {
      if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
        window.MilitaryEngine.refreshMilitaryStats(c);
      }
      if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
        window.IndicatorsEngine.refreshCountryIndicators(c);
      }
    });

    const totalPopulation = countries.reduce((sum, c) => sum + AnalyticsManager.getCountryTotalPopulation(c), 0);
    const totalBudget = countries.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
    const totalArea = countries.reduce((sum, c) => sum + (Number(c.area) || 0), 0);
    
    const avgGeneralIndex = countries.reduce((sum, c) => sum + (Number(c.generalIndex) || 0), 0) / n;
    const avgIncome = countries.reduce((sum, c) => sum + (Number(c.perCapitaIncome) || 0), 0) / n;

    const globalCurrency = avgIncome > 0 ? (avgGeneralIndex / avgIncome) : 1.0;

    const budgetList = [...countries].sort((a, b) => (Number(b.budget) || 0) - (Number(a.budget) || 0));
    const popList = [...countries].sort((a, b) => AnalyticsManager.getCountryTotalPopulation(b) - AnalyticsManager.getCountryTotalPopulation(a));
    const incomeList = [...countries].sort((a, b) => (Number(b.perCapitaIncome) || 0) - (Number(a.perCapitaIncome) || 0));
    const areaList = [...countries].sort((a, b) => (Number(b.area) || 0) - (Number(a.area) || 0));
    const indexList = [...countries].sort((a, b) => (Number(b.generalIndex) || 0) - (Number(a.generalIndex) || 0));
    const currencyList = [...countries].sort((a, b) => (Number(b.currencyValue) || 0) - (Number(a.currencyValue) || 0));

    const getOilPrice = (c) => (c.energy && typeof c.energy.oilPrice === "number") ? c.energy.oilPrice : 0;
    const oilList = [...countries].sort((a, b) => getOilPrice(b) - getOilPrice(a));
    const avgOilPrice = countries.reduce((sum, c) => sum + getOilPrice(c), 0) / n;

    const getGasPrice = (c) => (c.energy && typeof c.energy.gasPrice === "number") ? c.energy.gasPrice : 0;
    const gasList = [...countries].sort((a, b) => getGasPrice(b) - getGasPrice(a));
    const avgGasPrice = countries.reduce((sum, c) => sum + getGasPrice(c), 0) / n;

    const militaryList = [...countries].map(c => {
      const pop = AnalyticsManager.getCountryTotalPopulation(c);
      const crew = Number(c.military?.totalCrew || c.military?.totalPersonnel || 0);
      const ratio = pop > 0 ? ((crew / pop) * 100).toFixed(1) + "%" : "0.0%";
      const perCapita = Number(c.perCapitaIncome) || 0;
      const spending = Math.round(crew * perCapita);
      return {
        country: c,
        name: c.name,
        crew: crew,
        ratio: ratio,
        spending: spending
      };
    }).sort((a, b) => b.spending - a.spending);

    const totalMilitarySpending = militaryList.reduce((sum, item) => sum + item.spending, 0);

    const operationalList = [...countries].map(c => {
      const opCost = AnalyticsManager.getCountryOperationalExpenditure(c);
      const budget = Number(c.budget) || 0;
      const pct = budget > 0 ? ((opCost / budget) * 100).toFixed(1) + "%" : (opCost > 0 ? "100%" : "0.0%");
      return {
        country: c,
        name: c.name,
        opCost: opCost,
        pct: pct
      };
    }).sort((a, b) => b.opCost - a.opCost);

    const totalOperationalCost = operationalList.reduce((sum, item) => sum + item.opCost, 0);

    let html = `
      <div class="analytics-overview-bar">
        <div class="ov-item">العملة العالمية الموحدة: <strong class="text-gold">${globalCurrency.toFixed(3)}</strong> (المؤشر العام الدولي ÷ متوسط الدخل)</div>
        <div class="ov-item">إجمالي الدول المحللة: <strong class="text-cyan">${n} دولة</strong></div>
      </div>
      <div class="analytics-cards-grid">
    `;

    // 1. الميزانية
    html += this.buildTableCard("الميزانية", "ترتيب من الأعلى للأقل ميزانية", ["الدولة", "الميزانية"], budgetList.map((c) => [
      AnalyticsManager.getCountryNameWithFlag(c),
      `$${Number(c.budget).toLocaleString()}`
    ]), `إجمالي الميزانيات: $${totalBudget.toLocaleString()}`);

    // 2. السكان
    html += this.buildTableCard("السكان", "ترتيب السكان ونسبتهم من العالم", ["الدولة", "السكان", "النسبة للعالم"], popList.map((c) => {
      const pop = AnalyticsManager.getCountryTotalPopulation(c);
      const pct = totalPopulation > 0 ? ((pop / totalPopulation) * 100).toFixed(2) + "%" : "0.00%";
      return [AnalyticsManager.getCountryNameWithFlag(c), pop.toLocaleString(), pct];
    }), `إجمالي سكان العالم: ${totalPopulation.toLocaleString()} نسمة`);

    // 3. دخل الفرد
    html += this.buildTableCard("دخل الفرد", "الدخل الاسمي والمبلغ الفعلي للدخل", ["الدولة", "دخل الفرد", "المبلغ الفعلي (شهري)"], incomeList.map((c) => {
      const inc = Number(c.perCapitaIncome) || 0;
      const cVal = Number(c.currencyValue) || 0;
      const rateVsGlobal = globalCurrency > 0 ? (cVal / globalCurrency) : 0;
      const actualIncome = rateVsGlobal * inc * 30;
      return [AnalyticsManager.getCountryNameWithFlag(c), `$${inc.toLocaleString()}`, `$${actualIncome.toFixed(2)}`];
    }), `متوسط دخل الدول: $${avgIncome.toFixed(2)}`);

    // 4. المساحة
    html += this.buildTableCard("المساحة (المنشآت)", "ترتيب المساحة من الأكبر للأصغر", ["الدولة", "المساحة"], areaList.map((c) => [
      AnalyticsManager.getCountryNameWithFlag(c),
      `${Number(c.area).toLocaleString()} نقطة`
    ]), `إجمالي المساحات: ${totalArea.toLocaleString()} نقطة`);

    // 5. المؤشر العام
    html += this.buildTableCard("المؤشر العام", "ترتيب نقاط المؤشر من الأكبر للأصغر", ["الدولة", "المؤشر العام"], indexList.map((c) => [
      AnalyticsManager.getCountryNameWithFlag(c),
      `${Number(c.generalIndex).toLocaleString()}`
    ]), `متوسط المؤشر العام: ${avgGeneralIndex.toFixed(2)}`);

    // 6. قيمة العملة
    html += this.buildTableCard("قيمة العملة", "قيمة العملة الوطنية ومقابل العالمية", ["الدولة", "قيمة العملة", "أمام العالمية"], currencyList.map((c) => {
      const cVal = Number(c.currencyValue) || 0;
      const vsGlobal = globalCurrency > 0 ? (cVal / globalCurrency).toFixed(3) : "0.000";
      return [AnalyticsManager.getCountryNameWithFlag(c), cVal.toFixed(2), vsGlobal];
    }), `العملة العالمية المرجعية: ${globalCurrency.toFixed(3)}`);

    // 7. سعر النفط
    html += this.buildTableCard("سعر النفط (البرميل)", "ترتيب من الأغلى إلى الأرخص", ["الدولة", "سعر البرميل"], oilList.map((c) => [
      AnalyticsManager.getCountryNameWithFlag(c),
      `$${getOilPrice(c).toLocaleString()}`
    ]), `متوسط سعر النفط: $${avgOilPrice.toFixed(2)}`);

    // 8. سعر أسطوانة الغاز
    html += this.buildTableCard("سعر أسطوانة الغاز", "ترتيب من الأغلى إلى الأرخص", ["الدولة", "سعر الأسطوانة"], gasList.map((c) => [
      AnalyticsManager.getCountryNameWithFlag(c),
      `$${getGasPrice(c).toLocaleString()}`
    ]), `متوسط سعر الغاز: $${avgGasPrice.toFixed(2)}`);

    // 9. الإنفاق العسكري
    html += this.buildTableCard(
      "🎖️ الإنفاق العسكري",
      "فرز تنازلي بحسب الإنفاق (أفراد الجيش × دخل الفرد)",
      ["الدولة", "أفراد الجيش", "نسبة الجيش", "الإنفاق العسكري ⬇"],
      militaryList.map((item) => [
        AnalyticsManager.getCountryNameWithFlag(item.country),
        `${item.crew.toLocaleString()} فرد`,
        item.ratio,
        `$${item.spending.toLocaleString()}`
      ]),
      `إجمالي الإنفاق العسكري الدولي: $${totalMilitarySpending.toLocaleString()}`
    );

    // 10. الإنفاق على الطاقة والتشغيل
    html += this.buildTableCard(
      "⚡ الإنفاق على الطاقة والتشغيل",
      "مجموع استهلاك المنشآت الخدمية والنسبة من الميزانية",
      ["الدولة", "مجموع الاستهلاك ⬇", "النسبة من الميزانية"],
      operationalList.map((item) => [
        AnalyticsManager.getCountryNameWithFlag(item.country),
        `$${item.opCost.toLocaleString()}`,
        item.pct
      ]),
      `إجمالي استهلاك الطاقة والتشغيل: $${totalOperationalCost.toLocaleString()}`
    );

    html += `</div>`;
    this.container.innerHTML = html;
  }

  buildTableCard(title, subtitle, headers, rows, footerText) {
    let theadCols = headers.map(h => `<th>${h}</th>`).join("");
    let tbodyRows = rows.map((r, idx) => {
      let tds = r.map((tdText, tdIdx) => `<td class="${tdIdx > 0 ? 'text-accent' : ''}">${tdText}</td>`).join("");
      return `<tr><td style="width:25px; text-align:center; color:#718096; font-size:0.8rem;">${idx + 1}</td>${tds}</tr>`;
    }).join("");

    return `
      <div class="analytics-card">
        <div class="analytics-card-header">
          <h3>${title}</h3>
          <span class="analytics-card-sub">${subtitle}</span>
        </div>
        <div class="analytics-table-wrap">
          <table class="analytics-table">
            <thead>
              <tr>
                <th style="width:25px; text-align:center;">#</th>
                ${theadCols}
              </tr>
            </thead>
            <tbody>
              ${tbodyRows}
            </tbody>
          </table>
        </div>
        <div class="analytics-card-footer">
          <strong>${footerText}</strong>
        </div>
      </div>
    `;
  }
}

window.AnalyticsManager = new AnalyticsManager();