/**
 * Commodity & Services Exchange Engine - عصر الهيمنة
 * محرك بورصة الأسعار العالمية لاستعراض سلع ومنتجات الدول وأسعارها المحلية والدولية وعوائد التصدير المتوقعة
 * الإصدار v3.8: اعتماد منظومة التسعير التكافؤية (تكلفة النقطة ÷ الفائض المتاح × العملة الدولية)
 */

class ExchangeManager {
  constructor() {
    this.container = null;

    // قائمة السلع والقطاعات الـ 13 المعتمدة في البورصة
    this.COMMODITIES = [
      { id: "commercial", name: "تجارياً", icon: "🏪", unit: "نقطة فائض", type: "sector", desc: "الخدمات والأنشطة والتبادل التجاري" },
      { id: "agricultural", name: "زراعياً", icon: "🌾", unit: "نقطة فائض", type: "sector", desc: "المحاصيل والمنتجات والمواشي الزراعية" },
      { id: "healthcare", name: "صحياً", icon: "🏥", unit: "نقطة فائض", type: "sector", desc: "الرعاية والخدمات الطبية والعلاجية" },
      { id: "navigation", name: "ملاحياً", icon: "🧭", unit: "نقطة فائض", type: "sector", desc: "التوجيه والشحن والملاحة البحرية" },
      { id: "electricity", name: "كهربائياً", icon: "⚡", unit: "نقطة فائض", type: "sector", desc: "طاقة وشبكات الإمداد الكهربائي" },
      { id: "water", name: "مائياً", icon: "💧", unit: "نقطة فائض", type: "sector", desc: "إمدادات وشبكات المياه النقية" },
      { id: "education", name: "تعليمياً", icon: "🎓", unit: "نقطة فائض", type: "sector", desc: "الخدمات التعليمية والكوادر والتدريب" },
      { id: "industrial", name: "صناعياً", icon: "🏭", unit: "نقطة فائض", type: "sector", desc: "الصناعات والمنتجات الحرفية والورش" },
      { id: "entertainment", name: "ترفيهياً", icon: "🎡", unit: "نقطة فائض", type: "sector", desc: "السياحة والحدائق والترفيه الوطني" },
      { id: "trains", name: "قطارات", icon: "🚆", unit: "نقطة فائض", type: "sector", desc: "شبكات وخطوط سكك الحديد والنقل" },
      { id: "airports", name: "مطارات", icon: "✈️", unit: "نقطة فائض", type: "sector", desc: "الموانئ الجوية ومدارج الشحن الدولي" },
      { id: "fuel", name: "وقود ونفط", icon: "🛢️", unit: "برميل نفط", type: "energy", desc: "النفط الخام والوقود المتاح للتصدير" },
      { id: "gas", name: "غاز", icon: "🔥", unit: "أسطوانة/م³", type: "energy", desc: "الغاز الطبيعي والأسطوانات المصدرة" }
    ];

    // البيانات التأسيسية للموارد: ربط السلعة بالمنشأة وتكلفتها وإنتاجها المعياري
    this.commodityMetadata = {
      commercial: { name: "تجارياً", facilityId: "shop", defaultPrice: 20, defaultOutput: 5 },
      agricultural: { name: "زراعياً", facilityId: "farm", defaultPrice: 30, defaultOutput: 5 },
      healthcare: { name: "صحياً", facilityId: "clinic", defaultPrice: 30, defaultOutput: 10 },
      navigation: { name: "ملاحياً", facilityId: "boat", defaultPrice: 20, defaultOutput: 2 },
      electricity: { name: "كهربائياً", facilityId: "power_generator", defaultPrice: 200, defaultOutput: 24 },
      water: { name: "مائياً", facilityId: "water_well", defaultPrice: 50, defaultOutput: 10 },
      education: { name: "تعليمياً", facilityId: "classroom", defaultPrice: 50, defaultOutput: 10 },
      industrial: { name: "صناعياً", facilityId: "handicrafts", defaultPrice: 40, defaultOutput: 10 },
      entertainment: { name: "ترفيهياً", facilityId: "park", defaultPrice: 100, defaultOutput: 20 },
      trains: { name: "قطارات", facilityId: "train_station", defaultPrice: 1000, defaultOutput: 50 },
      airports: { name: "مطارات", facilityId: "regional_airport", defaultPrice: 2500, defaultOutput: 100 },
      fuel: { name: "وقود ونفط", facilityId: "oil_well", defaultPrice: 4000, defaultOutput: 50 },
      gas: { name: "غاز", facilityId: "gas_station_shop", defaultPrice: 400, defaultOutput: 40 }
    };
  }

  init() {
    this.container = document.getElementById("exchange-content-wrapper");
  }

  render(world) {
    if (!this.container) {
      this.container = document.getElementById("exchange-content-wrapper");
    }
    if (!this.container || !world) return;

    const countries = world.getAllCountries() || [];
    this.container.innerHTML = "";

    if (countries.length === 0) {
      this.container.innerHTML = `
        <div style="text-align:center; padding: 40px; color:#888; background:#1b2431; border-radius:8px; border:1px dashed #303e54; width:100%;">
          لا توجد دول مسجلة حالياً لعرض بورصة الأسعار. قم بتأسيس دولة جديدة أو استيراد ملف حفظ.
        </div>
      `;
      return;
    }

    const n = countries.length;

    // 1. حساب العملة العالمية المرجعية
    const avgGeneralIndex = countries.reduce((sum, c) => sum + (Number(c.generalIndex) || 0), 0) / n;
    const avgIncome = countries.reduce((sum, c) => sum + (Number(c.perCapitaIncome) || 0), 0) / n;
    const globalCurrency = avgIncome > 0 ? (avgGeneralIndex / avgIncome) : 1.0;

    // 2. ترويسة البورصة العامة
    let html = `
      <div class="analytics-overview-bar" style="margin-bottom: 20px;">
        <div class="ov-item">العملة العالمية الموحدة: <strong class="text-gold">${globalCurrency.toFixed(3)}</strong></div>
        <div class="ov-item">إجمالي السلع والخدمات المدرجة: <strong class="text-cyan">${this.COMMODITIES.length} سلعة</strong></div>
        <div class="ov-item">نظام التسعير: <span style="color:#34d399; font-weight:bold;">تكلفة النقطة (المنشأة ÷ الإنتاج) ÷ المخزون الفائض × العملة</span></div>
      </div>
      <div class="exchange-grid-container">
    `;

    // 3. بناء جداول السلع الـ 13
    this.COMMODITIES.forEach(comm => {
      html += this.buildCommodityTable(comm, countries, globalCurrency);
    });

    html += `</div>`;
    this.container.innerHTML = html;
  }

  buildCommodityTable(comm, countries, globalCurrency) {
    const exportEntries = [];

    countries.forEach(country => {
      const quantity = this.getAvailableQuantity(country, comm.id);
      if (quantity > 0) {
        const domesticPrice = this.calculatePointDomesticPrice(country, comm.id);
        const currencyVal = Number(country.currencyValue) || 1.0;
        
        // سعر المنتج دولياً للتصدير = السعر المحلي × (قيمة العملة الوطنية ÷ العملة المرجعية العالمية)
        const rateVsGlobal = globalCurrency > 0 ? (currencyVal / globalCurrency) : 1.0;
        const intlPrice = domesticPrice * rateVsGlobal;

        // قيمة الصادرات المتوقعة = الكمية المتوفرة × سعر السلعة دولياً
        const expectedRevenue = quantity * intlPrice;

        exportEntries.push({
          country: country,
          quantity: quantity,
          domesticPrice: domesticPrice,
          rateVsGlobal: rateVsGlobal,
          intlPrice: intlPrice,
          expectedRevenue: expectedRevenue
        });
      }
    });

    exportEntries.sort((a, b) => b.expectedRevenue - a.expectedRevenue);

    const totalExpectedRevenue = exportEntries.reduce((sum, item) => sum + item.expectedRevenue, 0);
    const totalAvailableQty = exportEntries.reduce((sum, item) => sum + item.quantity, 0);

    let rowsHtml = "";
    if (exportEntries.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 18px; color: #64748b; font-style: italic;">
            لا توجد أي دولة تملك فائضاً متاحاً للتصدير من هذا المنتج حالياً.
          </td>
        </tr>
      `;
    } else {
      rowsHtml = exportEntries.map((item, idx) => {
        return `
          <tr>
            <td style="width: 30px; text-align: center; color: #94a3b8; font-weight: bold;">${idx + 1}</td>
            <td style="font-weight: 800; color: #fff;">${item.country.name}</td>
            <td style="text-align: center; color: #38bdf8; font-weight: 800;">${item.quantity.toLocaleString()} ${comm.unit}</td>
            <td style="text-align: center; color: #cbd5e1;">$${item.domesticPrice < 0.01 ? item.domesticPrice.toFixed(3) : item.domesticPrice.toFixed(2)}</td>
            <td style="text-align: center; color: #fbbf24; font-weight: 800;">$${item.intlPrice < 0.01 ? item.intlPrice.toFixed(3) : item.intlPrice.toFixed(2)}</td>
            <td style="text-align: center; color: #34d399; font-weight: 900;">$${Math.round(item.expectedRevenue).toLocaleString()}</td>
          </tr>
        `;
      }).join("");
    }

    return `
      <div class="analytics-card">
        <div class="analytics-card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 style="margin: 0; font-size: 1.05rem; color: #fbbf24; display: flex; align-items: center; gap: 8px;">
              <span>${comm.icon}</span> ${comm.name}
            </h3>
            <span class="analytics-card-sub">${comm.desc}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <span class="badge" style="font-size: 0.76rem;">
              المعروض: ${totalAvailableQty.toLocaleString()}
            </span>
            <span class="badge badge-gold" style="font-size: 0.76rem;">
              الدول: ${exportEntries.length}
            </span>
          </div>
        </div>

        <div class="analytics-table-wrap">
          <table class="analytics-table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th>اسم الدولة</th>
                <th style="text-align: center;">الكمية المتوفرة</th>
                <th style="text-align: center;">محلياً</th>
                <th style="text-align: center;">دولياً</th>
                <th style="text-align: center;">العائد المتوقع</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div class="analytics-card-footer" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #94a3b8; font-size: 0.78rem;">
            * السعر المحلي = (سعر المنشأة ÷ الإنتاج) ÷ الفائض | الدولي = المحلي × العملة النسبية
          </span>
          <div style="font-size: 0.88rem; color: #e2e8f0;">
            إجمالي الصادرات: <strong class="text-gold" style="font-size: 1rem;">$${Math.round(totalExpectedRevenue).toLocaleString()}</strong>
          </div>
        </div>
      </div>
    `;
  }

  getAvailableQuantity(country, commodityId) {
    if (commodityId === "fuel") {
      const en = country.energy;
      if (!en) return 0;
      const surplus = Math.max(0, Number(en.netOilBalance || 0));
      const stock = Number(en.oilStock || 0);
      return surplus > 0 ? surplus : (stock > 0 ? stock : 0);
    }

    if (commodityId === "gas") {
      const en = country.energy;
      if (!en) return 0;
      const surplus = Math.max(0, Math.round(en.netGasBalance || 0));
      const stock = Number(en.gasStock || 0);
      return surplus > 0 ? surplus : (stock > 0 ? stock : 0);
    }

    return Math.max(0, Number(country.sectors?.[commodityId] || 0));
  }

  /**
   * احتساب السعر المحلي وفق المنظومة المعتمدة:
   * 1. تكلفة النقطة المعيارية = تكلفة بناء المنشأة ÷ النقاط المنتجة من المنشأة
   * 2. السعر المحلي = تكلفة النقطة ÷ عدد النقاط الموجودة للدولة (المخزون/الفائض)
   */
  calculatePointDomesticPrice(country, commodityId) {
    const meta = this.commodityMetadata[commodityId] || { facilityId: "", defaultPrice: 50, defaultOutput: 5 };
    let buildingPrice = meta.defaultPrice;
    let buildingOutput = meta.defaultOutput;

    // استخراج بيانات التكلفة والإنتاج الحقيقي من قاعدة بيانات المنشآت
    if (window.BuildingsEngine && typeof window.BuildingsEngine.getResource === "function") {
      const res = window.BuildingsEngine.getResource(meta.facilityId);
      if (res) {
        if (typeof res.price === "number" && res.price > 0) {
          buildingPrice = res.price;
        }
        if (res.sectorEffects && typeof res.sectorEffects[commodityId] === "number" && res.sectorEffects[commodityId] > 0) {
          buildingOutput = res.sectorEffects[commodityId];
        } else if (typeof res.satisfiesBase === "number" && res.satisfiesBase > 0) {
          buildingOutput = res.satisfiesBase;
        }
      }
    }

    // 1. تكلفة إنتاج النقطة الواحدة
    const basePointCost = buildingPrice / Math.max(1, buildingOutput);

    // 2. النقاط المتوفرة لدى الدولة (مع حد أدنى 1 لمنع القسمة على صفر)
    const availableQty = this.getAvailableQuantity(country, commodityId);
    const divisor = Math.max(1, availableQty);

    // 3. السعر المحلي = تكلفة النقطة مقسومة على المخزون الفائض
    const domesticPrice = basePointCost / divisor;

    return Math.max(0.01, Math.round(domesticPrice * 1000) / 1000);
  }
}

window.ExchangeManager = new ExchangeManager();