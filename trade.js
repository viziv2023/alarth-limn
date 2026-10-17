/**
 * Trade Exchange Engine - عصر الهيمنة
 * محرك التبادل التجاري بين الدول، نقل النقاط، التسعير الديناميكي الذكي، والفرز التنازلي
 * الإصدار v3.8: تكامل تسعير الصفقات مع معادلة تكلفة المنشأة والمخزون الفائض وقوة العملة
 */

class TradeManager {
  constructor() {
    this.container = null;

    // ربط قطاعات الدولة الـ 16 بالمنشآت الإنتاجية وتكلفتها وإنتاجها المعياري
    this.sectorMetadata = {
      agricultural: { name: "زراعياً (الإنتاج الغذائي)", facilityId: "farm", fallbackId: "production_farm", defaultPrice: 30, defaultOutput: 5 },
      commercial: { name: "تجارياً (الأسواق والمحال)", facilityId: "shop", fallbackId: "markets", defaultPrice: 20, defaultOutput: 5 },
      healthcare: { name: "صحياً (المشافي والعيادات)", facilityId: "clinic", fallbackId: "dispensary", defaultPrice: 30, defaultOutput: 10 },
      education: { name: "تعليمياً (المدارس والتعليم)", facilityId: "classroom", fallbackId: "school", defaultPrice: 50, defaultOutput: 10 },
      industrial: { name: "صناعياً (الورش والمصانع)", facilityId: "handicrafts", fallbackId: "workshop", defaultPrice: 40, defaultOutput: 10 },
      navigation: { name: "ملاحياً (النقل المائي)", facilityId: "boat", fallbackId: "ship", defaultPrice: 20, defaultOutput: 2 },
      water: { name: "مائياً (شبكات المياه والآبار)", facilityId: "water_well", fallbackId: "water_pump", defaultPrice: 50, defaultOutput: 10 },
      gas: { name: "أسطوانة غاز (الإمدادات)", facilityId: "gas_station_shop", fallbackId: "gas_well", defaultPrice: 400, defaultOutput: 40 },
      electricity: { name: "كهربائياً (محطات التوليد)", facilityId: "power_generator", fallbackId: "power_plant", defaultPrice: 200, defaultOutput: 24 },
      ports: { name: "موانئ (الشحن البحري)", facilityId: "marina", fallbackId: "seaport", defaultPrice: 200, defaultOutput: 20 },
      airports: { name: "مطارات (المنافذ الجوية)", facilityId: "regional_airport", fallbackId: "intl_airport", defaultPrice: 2500, defaultOutput: 100 },
      trains: { name: "قطارات (السكك الحديدية)", facilityId: "train_station", fallbackId: "train_station_large", defaultPrice: 1000, defaultOutput: 50 },
      security: { name: "أمنياً (الشرطة والأمن)", facilityId: "police_station", fallbackId: "police_headquarters", defaultPrice: 100, defaultOutput: 24 },
      entertainment: { name: "ترفيهياً (الحدائق والترفيه)", facilityId: "park", fallbackId: "theme_park", defaultPrice: 100, defaultOutput: 20 },
      civil: { name: "مدنياً (التخطيط والدفاع)", facilityId: "fire_station", fallbackId: "municipality", defaultPrice: 300, defaultOutput: 80 },
      services: { name: "خدمياً (اللوجستيات والبلدية)", facilityId: "municipality", fallbackId: "governorate", defaultPrice: 1000, defaultOutput: 100 }
    };
  }

  init() {
    this.container = document.getElementById("trade-content-wrapper");
  }

  getSectorPoints(country, secKey) {
    if (!country || !country.sectors) return 0;
    if (typeof country.sectors[secKey] === "number") return country.sectors[secKey];
    if (country.sectors[secKey] && typeof country.sectors[secKey].points === "number") {
      return country.sectors[secKey].points;
    }
    return 0;
  }

  setSectorPoints(country, secKey, val) {
    if (!country || !country.sectors) return;
    if (typeof country.sectors[secKey] === "number") {
      country.sectors[secKey] = val;
    } else if (country.sectors[secKey] && typeof country.sectors[secKey].points === "number") {
      country.sectors[secKey].points = val;
    }
  }

  // حساب العملة العالمية الموحدة
  getGlobalCurrency(world) {
    if (!world) return 1.0;
    const countries = world.getAllCountries() || [];
    const n = countries.length;
    if (n === 0) return 1.0;

    const avgGeneralIndex = countries.reduce((sum, c) => sum + (Number(c.generalIndex) || 0), 0) / n;
    const avgIncome = countries.reduce((sum, c) => sum + (Number(c.perCapitaIncome) || 0), 0) / n;
    return avgIncome > 0 ? (avgGeneralIndex / avgIncome) : 1.0;
  }

  /**
   * احتساب سعر الشراء التبادلي وفق المعادلة الجديدة:
   * 1. السعر المحلي = (سعر المنشأة ÷ إنتاج النقاط) ÷ النقاط الموجودة للدولة
   * 2. سعر التصدير الدولي = السعر المحلي × (قيمة العملة الوطنية ÷ العملة المرجعية)
   */
  calculateDynamicPointPrice(exporter, secKey, importer = null, world = null) {
    let domesticPrice = 1.0;

    if (window.ExchangeManager && typeof window.ExchangeManager.calculatePointDomesticPrice === "function") {
      domesticPrice = window.ExchangeManager.calculatePointDomesticPrice(exporter, secKey);
    } else {
      const meta = this.sectorMetadata[secKey] || { defaultPrice: 50, defaultOutput: 5 };
      let bPrice = meta.defaultPrice;
      let bOutput = meta.defaultOutput;

      if (window.BuildingsEngine && typeof window.BuildingsEngine.getResource === "function") {
        const res = window.BuildingsEngine.getResource(meta.facilityId);
        if (res) {
          if (typeof res.price === "number" && res.price > 0) bPrice = res.price;
          if (res.sectorEffects && typeof res.sectorEffects[secKey] === "number" && res.sectorEffects[secKey] > 0) {
            bOutput = res.sectorEffects[secKey];
          } else if (typeof res.satisfiesBase === "number" && res.satisfiesBase > 0) {
            bOutput = res.satisfiesBase;
          }
        }
      }

      const basePointCost = bPrice / Math.max(1, bOutput);
      const surplusPts = Math.max(1, this.getSectorPoints(exporter, secKey));
      domesticPrice = basePointCost / surplusPts;
    }

    // احتساب سعر التصدير الدولي بناءً على العملة الوطنية والعملة العالمية
    const exporterCurrency = Number(exporter.currencyValue) || 1.0;
    const globalCurrency = this.getGlobalCurrency(world || window.currentWorld);
    const rateVsGlobal = globalCurrency > 0 ? (exporterCurrency / globalCurrency) : 1.0;
    const intlExportPrice = domesticPrice * rateVsGlobal;

    return Math.max(0.01, Math.round(intlExportPrice * 100) / 100);
  }

  // عقد صفقة تجارية ونقل النقاط فورياً
  createDeal(world, exporterId, importerId, secKey, points, durationYears, unitPrice) {
    points = parseInt(points);
    durationYears = parseInt(durationYears);
    unitPrice = parseFloat(unitPrice);

    if (exporterId === importerId) {
      return { success: false, msg: "لا يمكن أن تكون الدولة المصدرة والمستوردة هي نفس الدولة!" };
    }

    const exporter = world.getAllCountries().find(c => c.id === exporterId);
    const importer = world.getAllCountries().find(c => c.id === importerId);

    if (!exporter || !importer) {
      return { success: false, msg: "الدول المحددة غير موجودة!" };
    }

    if (isNaN(points) || points <= 0) {
      return { success: false, msg: "يرجى إدخال عدد نقاط صحيح أكبر من الصفر!" };
    }

    if (isNaN(durationYears) || durationYears <= 0) {
      return { success: false, msg: "يرجى تحديد مدة عقد صالحة بالسنوات!" };
    }

    const expPoints = this.getSectorPoints(exporter, secKey);
    if (expPoints < points) {
      return { success: false, msg: `الدولة المصدرة لا تمتلك رصيد نقاط كافٍ في هذا القطاع (المتوفر: ${expPoints} نقطة)!` };
    }

    const finalUnitPrice = (!isNaN(unitPrice) && unitPrice > 0) 
      ? unitPrice 
      : this.calculateDynamicPointPrice(exporter, secKey, importer, world);
      
    const totalValue = Math.round(points * finalUnitPrice);

    // 1. تحويل النقاط فورياً
    this.setSectorPoints(exporter, secKey, expPoints - points);
    const impPoints = this.getSectorPoints(importer, secKey);
    this.setSectorPoints(importer, secKey, impPoints + points);

    // 2. تحديث المؤشرات العامة للدولتين
    if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
      window.IndicatorsEngine.refreshCountryIndicators(exporter);
      window.IndicatorsEngine.refreshCountryIndicators(importer);
    }

    // 3. تسجيل العقد
    const sectorName = this.sectorMetadata[secKey]?.name || secKey;
    const deal = {
      id: "deal_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      exporterId: exporter.id,
      exporterName: exporter.name,
      importerId: importer.id,
      importerName: importer.name,
      sectorKey: secKey,
      sectorName: sectorName,
      points: points,
      totalValue: totalValue,
      unitPrice: finalUnitPrice,
      durationYears: durationYears,
      remainingYears: durationYears,
      startYear: world.year
    };

    if (!Array.isArray(world.tradeDeals)) {
      world.tradeDeals = [];
    }
    world.tradeDeals.push(deal);

    // 4. تحديث إجماليات الصادرات والواردات المالية للدول
    this.recalculateCountriesTrade(world);

    world.addHistoryEvent("economic", `عقد اتفاقية تبادل تجاري: ${importer.name} تستورد ${points} نقاط (${sectorName}) من ${exporter.name} بسعر $${finalUnitPrice} للنقطة وإجمالي $${totalValue.toLocaleString()} سنوياً لمدة ${durationYears} سنوات`, world.year);

    return { success: true, msg: `تم بنجاح إبرام الاتفاقية ونقل ${points} نقطة لصالح ${importer.name} بسعر $${finalUnitPrice} للنقطة!` };
  }

  // تدوير عقود التبادل التجاري مع نهاية كل سنة وفك النقاط عند الانتهاء
  processAnnualCycle(world) {
    if (!world || !Array.isArray(world.tradeDeals)) return;

    const activeDeals = [];

    world.tradeDeals.forEach(deal => {
      deal.remainingYears -= 1;

      if (deal.remainingYears <= 0) {
        const exporter = world.getAllCountries().find(c => c.id === deal.exporterId);
        const importer = world.getAllCountries().find(c => c.id === deal.importerId);

        if (exporter) {
          const currentExp = this.getSectorPoints(exporter, deal.sectorKey);
          this.setSectorPoints(exporter, deal.sectorKey, currentExp + deal.points);
          if (window.IndicatorsEngine) window.IndicatorsEngine.refreshCountryIndicators(exporter);
        }

        if (importer) {
          const currentImp = this.getSectorPoints(importer, deal.sectorKey);
          this.setSectorPoints(importer, deal.sectorKey, currentImp - deal.points);
          if (window.IndicatorsEngine) window.IndicatorsEngine.refreshCountryIndicators(importer);
        }

        world.addHistoryEvent("economic", `انتهاء أجل اتفاقية التبادل التجاري بين ${deal.exporterName} و ${deal.importerName} واسترجاع ${deal.points} نقطة إلى ${deal.exporterName}`, world.year);
      } else {
        activeDeals.push(deal);
      }
    });

    world.tradeDeals = activeDeals;
    this.recalculateCountriesTrade(world);
  }

  // فسخ يدوي لعقد تجاري
  cancelDeal(world, dealId) {
    if (!world || !Array.isArray(world.tradeDeals)) return;
    const index = world.tradeDeals.findIndex(d => d.id === dealId);
    if (index === -1) return;

    const deal = world.tradeDeals[index];
    const exporter = world.getAllCountries().find(c => c.id === deal.exporterId);
    const importer = world.getAllCountries().find(c => c.id === deal.importerId);

    if (exporter) {
      const currentExp = this.getSectorPoints(exporter, deal.sectorKey);
      this.setSectorPoints(exporter, deal.sectorKey, currentExp + deal.points);
      if (window.IndicatorsEngine) window.IndicatorsEngine.refreshCountryIndicators(exporter);
    }

    if (importer) {
      const currentImp = this.getSectorPoints(importer, deal.sectorKey);
      this.setSectorPoints(importer, deal.sectorKey, currentImp - deal.points);
      if (window.IndicatorsEngine) window.IndicatorsEngine.refreshCountryIndicators(importer);
    }

    world.tradeDeals.splice(index, 1);
    this.recalculateCountriesTrade(world);

    world.addHistoryEvent("economic", `فسخ اتفاقية التبادل التجاري بين ${deal.exporterName} و ${deal.importerName} مبكراً وعودة النقاط لمصدرها`, world.year);
  }

  // إعادة احتساب وتحديث تجارة الصادرات والواردات المالية لكافة الدول
  recalculateCountriesTrade(world) {
    const countries = world.getAllCountries();
    const deals = world.tradeDeals || [];

    countries.forEach(c => {
      const exportSum = deals
        .filter(d => d.exporterId === c.id)
        .reduce((sum, d) => sum + Number(d.totalValue || 0), 0);

      const importSum = deals
        .filter(d => d.importerId === c.id)
        .reduce((sum, d) => sum + Number(d.totalValue || 0), 0);

      c.exports = exportSum;
      c.imports = importSum;
    });
  }

  render(world) {
    if (!this.container) {
      this.container = document.getElementById("trade-content-wrapper");
    }
    if (!this.container || !world) return;

    this.recalculateCountriesTrade(world);

    const countries = world.getAllCountries() || [];
    const deals = world.tradeDeals || [];

    // ترتيب المصدرين تنازلياً حسب مجموع الصادرات
    const exportersRanked = [...countries]
      .map(c => ({
        name: c.name,
        total: c.exports || 0,
        dealCount: deals.filter(d => d.exporterId === c.id).length
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    // ترتيب المستوردين تنازلياً حسب مجموع الواردات
    const importersRanked = [...countries]
      .map(c => ({
        name: c.name,
        total: c.imports || 0,
        dealCount: deals.filter(d => d.importerId === c.id).length
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);

    let html = `
      <!-- 1) المؤشرات التنازلية المزدوجة للصادرات والواردات -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">
        <div class="analytics-card" style="border-top:3px solid #38a169;">
          <div class="analytics-card-header" style="background:#162720;">
            <h3 style="color:#48bb78;">📦 مؤشر كبار المصدرين (إجمالي الصادرات النشطة)</h3>
            <span class="analytics-card-sub">فرز تنازلي بالدول الأكثر تصديراً للأموال والنقاط</span>
          </div>
          <div class="analytics-table-wrap">
            <table class="analytics-table">
              <thead>
                <tr>
                  <th style="width:30px;">#</th>
                  <th>الدولة المصدرة</th>
                  <th>عدد الصفقات</th>
                  <th style="color:#48bb78;">إجمالي مبالغ الصادرات ⬇</th>
                </tr>
              </thead>
              <tbody>
                ${exportersRanked.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:#888;">لا توجد صفقات تصدير جارية حالياً</td></tr>` : 
                  exportersRanked.map((c, i) => `
                    <tr>
                      <td style="text-align:center; color:#718096;">${i + 1}</td>
                      <td style="font-weight:bold;">${c.name}</td>
                      <td>${c.dealCount} صفقات</td>
                      <td class="text-green" style="font-weight:bold;">$${c.total.toLocaleString()}</td>
                    </tr>
                  `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="analytics-card" style="border-top:3px solid #dd6b20;">
          <div class="analytics-card-header" style="background:#2b1d15;">
            <h3 style="color:#ed8936;">🚢 مؤشر كبار المستوردين (إجمالي الواردات النشطة)</h3>
            <span class="analytics-card-sub">فرز تنازلي بالدول الأكثر استيراداً للأموال والنقاط</span>
          </div>
          <div class="analytics-table-wrap">
            <table class="analytics-table">
              <thead>
                <tr>
                  <th style="width:30px;">#</th>
                  <th>الدولة المستوردة</th>
                  <th>عدد الصفقات</th>
                  <th style="color:#ed8936;">إجمالي مبالغ الواردات ⬇</th>
                </tr>
              </thead>
              <tbody>
                ${importersRanked.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:#888;">لا توجد صفقات استيراد جارية حالياً</td></tr>` : 
                  importersRanked.map((c, i) => `
                    <tr>
                      <td style="text-align:center; color:#718096;">${i + 1}</td>
                      <td style="font-weight:bold;">${c.name}</td>
                      <td>${c.dealCount} صفقات</td>
                      <td class="text-orange" style="font-weight:bold;">$${c.total.toLocaleString()}</td>
                    </tr>
                  `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 2) نافذة إبرام اتفاقية تبادل تجاري جديدة بالنظام التفاعلي الثلاثي -->
      <div class="wb-loan-action-bar" style="background:#151e2d; border-color:#2a3b55; margin-bottom:20px; flex-direction:column; align-items:stretch; gap:14px;">
        <div style="font-weight:bold; color:#63b3ed; font-size:1.05rem;">📝 إبرام اتفاقية تبادل تجاري جديدة ونقل نقاط:</div>
        
        <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
          <!-- الخانة 1: الدولة المستوردة -->
          <div style="flex:1; min-width:220px;">
            <label style="display:block; font-size:0.8rem; color:#a0aec0; margin-bottom:4px;">1. الدولة المستوردة (التي تعاني من العجز):</label>
            <select id="trade-importer-select" style="width:100%;">
              <option value="">-- اختر الدولة المستوردة --</option>
              ${countries.map(c => `<option value="${c.id}">${c.name} (عملتها: ${(Number(c.currencyValue) || 1).toFixed(2)})</option>`).join("")}
            </select>
          </div>

          <!-- الخانة 2: المؤشر المراد الشراء منه -->
          <div style="flex:1; min-width:220px;">
            <label style="display:block; font-size:0.8rem; color:#a0aec0; margin-bottom:4px;">2. نوع المؤشر / القطاع المطلوب:</label>
            <select id="trade-sector-select" style="width:100%;" disabled>
              <option value="">-- اختر الدولة المستوردة أولاً --</option>
            </select>
          </div>

          <!-- الخانة 3: الدول التي تمتلك فائضاً مع سعر النقطة الديناميكي -->
          <div style="flex:1.4; min-width:260px;">
            <label style="display:block; font-size:0.8rem; color:#a0aec0; margin-bottom:4px;">3. الدولة المصدرة (فائض وسعر النقطة):</label>
            <select id="trade-exporter-select" style="width:100%;" disabled>
              <option value="">-- اختر نوع القطاع أولاً --</option>
            </select>
          </div>
        </div>

        <!-- شريط تفاصيل العقد والتنفيذ -->
        <div id="trade-deal-controls" style="display:none; gap:12px; flex-wrap:wrap; align-items:center; background:#101722; padding:12px; border-radius:6px; border:1px solid #233147;">
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.85rem; color:#cbd5e0;">النقاط:</label>
            <input type="number" id="trade-points-input" value="1" min="1" style="width:100px;" />
            <span id="trade-max-points-hint" style="font-size:0.78rem; color:#f6ad55;">(الفائض: 0)</span>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:0.85rem; color:#cbd5e0;">المدة (سنوات):</label>
            <input type="number" id="trade-duration-input" value="3" min="1" max="10" style="width:90px;" />
          </div>

          <div style="display:flex; align-items:center; gap:8px; margin-right:auto;">
            <span style="font-size:0.85rem; color:#a0aec0;">الإجمالي السنوي:</span>
            <strong id="trade-total-cost-display" style="color:#48bb78; font-size:1.15rem;">$0</strong>
            <small id="trade-unit-calc-hint" style="color:#718096; font-size:0.75rem;"></small>
          </div>

          <button id="btn-create-trade-deal" class="btn btn-accent" style="padding:7px 18px; font-weight:bold;">توقيع الاتفاقية ➔</button>
        </div>
      </div>

      <!-- 3) جدول الصفقات والاتفاقيات الجارية -->
      <div class="excel-ledger-frame">
        <table class="excel-history-table">
          <thead>
            <tr>
              <th colspan="9" style="background:#1f2e42 !important; color:#fff; font-size:1.1rem; padding:10px;">
                سجل اتفاقيات التبادل التجاري المبرمة بين الدول وتتبع سريان المدة
              </th>
            </tr>
            <tr class="sub-header-row">
              <th style="width:30px; text-align:center;">#</th>
              <th>الدولة المنتجة (المصدرة)</th>
              <th>الدولة المستوردة (المستفيدة)</th>
              <th>نوع المؤشر والنشاط</th>
              <th style="text-align:center;">النقاط المنقولة</th>
              <th style="text-align:center;">سعر النقطة</th>
              <th style="color:#48bb78; text-align:center;">القيمة السنوية</th>
              <th style="text-align:center;">المدة المتبقية</th>
              <th style="text-align:center;">إجراء</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (deals.length === 0) {
      html += `<tr><td colspan="9" style="text-align:center; color:#888; padding:24px;">لا توجد صفقات تبادل تجاري قائمة حالياً.</td></tr>`;
    } else {
      deals.forEach((d, idx) => {
        html += `
          <tr>
            <td style="text-align:center; color:#718096; font-weight:bold;">${idx + 1}</td>
            <td style="font-weight:bold; color:#68d391;">${d.exporterName}</td>
            <td style="font-weight:bold; color:#f6ad55;">${d.importerName}</td>
            <td>${d.sectorName}</td>
            <td style="text-align:center; font-weight:bold;">${d.points} نقطة</td>
            <td style="text-align:center; color:#ecc94b; font-weight:bold;">$${d.unitPrice}</td>
            <td style="text-align:center; font-weight:bold; color:#48bb78;">$${Number(d.totalValue).toLocaleString()}</td>
            <td style="text-align:center; font-weight:bold; color:#63b3ed;">${d.remainingYears} سنوات (من ${d.durationYears})</td>
            <td style="text-align:center;">
              <button class="btn btn-sm btn-danger" data-action="cancel-deal" data-id="${d.id}" style="padding:3px 8px; font-size:0.75rem;">فسخ</button>
            </td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
          <tfoot>
            <tr style="background:#edf2f7; font-weight:bold; border-top:2px solid #cbd5e0;">
              <td colspan="4" style="text-align:center;">إجمالي عقود التبادل التجاري السارية</td>
              <td style="text-align:center;">${deals.reduce((s, d) => s + Number(d.points || 0), 0)} نقطة</td>
              <td style="text-align:center;">-</td>
              <td style="text-align:center; color:#276a3c;">$${deals.reduce((s, d) => s + Number(d.totalValue || 0), 0).toLocaleString()}</td>
              <td colspan="2" style="text-align:center; color:#4a5568;">تعود النقاط تلقائياً بانتهاء المدة</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    this.container.innerHTML = html;
    this.bindEvents(world);
  }

  bindEvents(world) {
    const selImporter = document.getElementById("trade-importer-select");
    const selSector = document.getElementById("trade-sector-select");
    const selExporter = document.getElementById("trade-exporter-select");
    const controlsBar = document.getElementById("trade-deal-controls");
    const pointsInput = document.getElementById("trade-points-input");
    const durationInput = document.getElementById("trade-duration-input");
    const maxHint = document.getElementById("trade-max-points-hint");
    const costDisplay = document.getElementById("trade-total-cost-display");
    const calcHint = document.getElementById("trade-unit-calc-hint");
    const btnCreate = document.getElementById("btn-create-trade-deal");

    let currentUnitPrice = 0;
    let currentMaxPoints = 0;

    const updateCalculations = () => {
      let pts = parseInt(pointsInput.value) || 1;
      if (pts > currentMaxPoints) {
        pts = currentMaxPoints;
        pointsInput.value = pts;
      }
      if (pts < 1) {
        pts = 1;
        pointsInput.value = pts;
      }
      const total = Math.round(pts * currentUnitPrice);
      costDisplay.textContent = `$${total.toLocaleString()}`;
      calcHint.textContent = `($${currentUnitPrice} للنقطة × ${pts} نقطة)`;
    };

    // 1. اختيار الدولة المستوردة
    selImporter.addEventListener("change", () => {
      const impId = selImporter.value;
      controlsBar.style.display = "none";
      selExporter.innerHTML = `<option value="">-- اختر نوع القطاع أولاً --</option>`;
      selExporter.disabled = true;

      if (!impId) {
        selSector.innerHTML = `<option value="">-- اختر الدولة المستوردة أولاً --</option>`;
        selSector.disabled = true;
        return;
      }

      const importer = world.getAllCountries().find(c => c.id === impId);
      selSector.innerHTML = `<option value="">-- اختر نوع المؤشر / القطاع --</option>`;

      const sectorKeys = Object.keys(this.sectorMetadata);
      sectorKeys.sort((a, b) => {
        const ptsA = this.getSectorPoints(importer, a);
        const ptsB = this.getSectorPoints(importer, b);
        return ptsA - ptsB;
      });

      sectorKeys.forEach(secKey => {
        const pts = this.getSectorPoints(importer, secKey);
        const meta = this.sectorMetadata[secKey];
        const statusText = pts < 0 ? ` (عجز: ${pts} نقطة) ⚠️` : ` (${pts} نقطة)`;
        selSector.innerHTML += `<option value="${secKey}">${meta.name}${statusText}</option>`;
      });

      selSector.disabled = false;
    });

    // 2. اختيار القطاع
    selSector.addEventListener("change", () => {
      const impId = selImporter.value;
      const secKey = selSector.value;
      controlsBar.style.display = "none";

      if (!secKey) {
        selExporter.innerHTML = `<option value="">-- اختر نوع القطاع أولاً --</option>`;
        selExporter.disabled = true;
        return;
      }

      const importer = world.getAllCountries().find(c => c.id === impId);
      const eligibleExporters = world.getAllCountries().filter(c => {
        if (c.id === impId) return false;
        const pts = this.getSectorPoints(c, secKey);
        return pts > 0;
      });

      if (eligibleExporters.length === 0) {
        selExporter.innerHTML = `<option value="">❌ لا توجد أي دولة تملك فائضاً في هذا القطاع</option>`;
        selExporter.disabled = true;
        return;
      }

      selExporter.innerHTML = `<option value="">-- اختر الدولة المصدرة (${eligibleExporters.length} دولة بفائض) --</option>`;

      eligibleExporters.forEach(exp => {
        const surplusPts = this.getSectorPoints(exp, secKey);
        const unitPrice = this.calculateDynamicPointPrice(exp, secKey, importer, world);
        selExporter.innerHTML += `
          <option value="${exp.id}" data-surplus="${surplusPts}" data-price="${unitPrice}">
            ${exp.name} (الفائض: +${surplusPts} نقطة | سعر الشراء لك: $${unitPrice})
          </option>
        `;
      });

      selExporter.disabled = false;
    });

    // 3. اختيار الدولة المصدرة
    selExporter.addEventListener("change", () => {
      const expId = selExporter.value;
      if (!expId) {
        controlsBar.style.display = "none";
        return;
      }

      const opt = selExporter.selectedOptions[0];
      currentMaxPoints = parseInt(opt.getAttribute("data-surplus")) || 1;
      currentUnitPrice = parseFloat(opt.getAttribute("data-price")) || 1;

      pointsInput.max = currentMaxPoints;
      pointsInput.value = 1;
      maxHint.textContent = `(الحد الأقصى للفائض: +${currentMaxPoints} نقطة)`;

      updateCalculations();
      controlsBar.style.display = "flex";
    });

    pointsInput.addEventListener("input", updateCalculations);

    // توقيع الاتفاقية
    btnCreate.addEventListener("click", () => {
      const expId = selExporter.value;
      const impId = selImporter.value;
      const secKey = selSector.value;
      const points = pointsInput.value;
      const duration = durationInput.value;

      if (!expId || !impId || !secKey) {
        alert("يرجى إكمال تحديد كافة أطراف الاتفاقية!");
        return;
      }

      const res = this.createDeal(world, expId, impId, secKey, points, duration, currentUnitPrice);
      alert(res.msg);
      if (res.success) {
        this.render(world);
        if (window.renderNationsTable) window.renderNationsTable();
      }
    });

    // فسخ العقود
    this.container.querySelectorAll("button[data-action='cancel-deal']").forEach(btn => {
      btn.addEventListener("click", () => {
        const dealId = btn.getAttribute("data-id");
        if (confirm("هل أنت متأكد من فسخ هذا العقد التجاري واسترجاع النقاط لمصدرها؟")) {
          this.cancelDeal(world, dealId);
          alert("تم فسخ العقد واسترجاع النقاط فورياً.");
          this.render(world);
          if (window.renderNationsTable) window.renderNationsTable();
        }
      });
    });
  }
}

window.TradeManager = new TradeManager();