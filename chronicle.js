/**
 * Chronicle Engine - عصر الهيمنة
 * محرك تدوين وأرشفة التاريخ السياسي والاقتصادي للأمم تلقائياً بمطابقة تامة للإكسل
 */

class ChronicleManager {
  constructor() {
    this.container = null;
  }

  init() {
    this.container = document.getElementById("chronicle-tables-wrapper");
  }

  // فحص وتسجيل المحطات التاريخية الفارقة تلقائياً
  checkMilestoneEvents(world) {
    if (!world) return;
    const countries = world.getAllCountries();
    if (countries.length === 0) return;

    const currentYear = world.year || 1;

    // 1. حدث قيام الدول الأولي (السنة الأولى)
    const hasCreationPol = world.history.some(h => h.category === "political" && h.text.includes("قيام"));
    if (!hasCreationPol && countries.length > 0) {
      world.addHistoryEvent("political", `قيام ${countries.length} دولة ذات سيادة`, 1, "world_pol_init");
    }

    const hasBudgetEco = world.history.some(h => h.category === "economic" && h.text.includes("ميزانية كل دولة 200"));
    if (!hasBudgetEco && countries.length > 0) {
      world.addHistoryEvent("economic", "ميزانية كل دولة 200 دولار كمنحة تأسيسية معفاة", 1, "world_eco_init");
    }

    // 2. فحص أحداث الدول المفصلية لربطها بسنة العالم
    countries.forEach(c => {
      // أ) ارتفاع العطالة عن 50%
      if (c.unemploymentRate >= 50) {
        const key = `unemp_${c.id}_${currentYear}`;
        if (!world.history.some(h => h.key === key)) {
          world.addHistoryEvent("political", `في ${c.name} ضجر شعبي من سوء الإدارة حيث تجاوزت نسبة العطالة ${c.unemploymentRate}%`, currentYear, key);
        }
      }

      // ب) انهيار العملة أو أزمة اقتصادية
      if (c.currencyValue <= 0.2 && c.population > 0) {
        const key = `crisis_${c.id}_${currentYear}`;
        if (!world.history.some(h => h.key === key)) {
          world.addHistoryEvent("economic", `${c.name} تعاني من أزمة اقتصادية وتراجع في قيمة عملتها الوطنية`, currentYear, key);
        }
      }

      // ج) قيام جيش منظم
      const milPower = c.military && c.military.totalPower ? c.military.totalPower : 0;
      if (milPower >= 100) {
        const key = `army_${c.id}`;
        if (!world.history.some(h => h.key === key)) {
          world.addHistoryEvent("political", `دولة ${c.name} تبدأ بإقامة جيش حماية وقوة عسكرية نظامية`, currentYear, key);
        }
      }

      // د) ترقية المرحلة
      if (c.stage > 1) {
        const key = `stage_${c.id}_${c.stage}`;
        if (!world.history.some(h => h.key === key)) {
          world.addHistoryEvent("economic", `${c.name} تنتقل رسمياً إلى المرحلة ${c.stage} (${c.stageName})`, currentYear, key);
        }
      }
    });
  }

  render(world) {
    if (!this.container) {
      this.container = document.getElementById("chronicle-tables-wrapper");
    }
    if (!this.container || !world) return;

    this.checkMilestoneEvents(world);

    const history = world.history || [];
    const ecoEvents = history.filter(h => h.category === "economic");
    const polEvents = history.filter(h => h.category === "political");

    const maxRows = Math.max(ecoEvents.length, polEvents.length, 1);

    let html = `
      <div class="excel-ledger-frame">
        <table class="excel-history-table">
          <thead>
            <tr>
              <th colspan="2" class="th-economic">اقتصادياً</th>
              <th colspan="2" class="th-political">سياسياً</th>
            </tr>
            <tr class="sub-header-row">
              <th class="col-event">الحدث والتفاصيل</th>
              <th class="col-date">تاريخ</th>
              <th class="col-event">الحدث والتفاصيل</th>
              <th class="col-date">تاريخ</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (let i = 0; i < maxRows; i++) {
      const eco = ecoEvents[i];
      const pol = polEvents[i];

      const ecoDesc = eco ? eco.text : "";
      const ecoDate = eco ? `${eco.year}م` : "";
      const polDesc = pol ? pol.text : "";
      const polDate = pol ? `${pol.year}م` : "";

      html += `
        <tr>
          <td class="td-desc td-eco">${ecoDesc}</td>
          <td class="td-date">${ecoDate}</td>
          <td class="td-desc td-pol">${polDesc}</td>
          <td class="td-date">${polDate}</td>
        </tr>
      `;
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    this.container.innerHTML = html;
  }
}

window.ChronicleManager = new ChronicleManager();