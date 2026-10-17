/**
 * World Bank Engine - عصر الهيمنة
 * المحرك المالي والاستثماري للبنك الدولي، الإقراض المؤسسي، والإقراض السيادي الثنائي المباشر بين الدول
 */

class WorldBankManager {
  constructor() {
    this.container = null;
  }

  init() {
    this.container = document.getElementById("worldbank-content-wrapper");
  }

  // رسم العلم المصغر بدقة
  static renderMiniFlag(flagMatrix) {
    if (!flagMatrix || !Array.isArray(flagMatrix) || flagMatrix.length === 0) {
      return `<span style="display:inline-block; width:16px; height:12px; background:#475569; border-radius:2px; vertical-align:middle; margin-left:6px;"></span>`;
    }
    let dots = "";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const color = (flagMatrix[r] && flagMatrix[r][c]) ? flagMatrix[r][c] : "#ffffff";
        dots += `<span style="background-color:${color}; display:block; width:4px; height:3px;"></span>`;
      }
    }
    return `
      <span style="display:inline-grid; grid-template-columns:repeat(4, 4px); grid-template-rows:repeat(3, 3px); gap:0; border:1px solid rgba(255,255,255,0.25); border-radius:2px; overflow:hidden; vertical-align:middle; margin-left:6px; flex-shrink:0;">
        ${dots}
      </span>
    `;
  }

  // احتساب الدورة الاستثمارية السنوية وأقساط ديون البنك الدولي والقروض السيادية بين الدول
  processAnnualCycle(world) {
    if (!world) return;
    const countries = world.getAllCountries();
    if (countries.length === 0) return;

    // 1. حساب إجمالي مبالغ الـ 5% المقتطعة في هذه السنة حصراً واستثمارها بعائد 25%
    const totalYearlyDeductions = countries.reduce((sum, c) => {
      const cut = Number(c.lastWbCut !== undefined ? c.lastWbCut : (c.year > 1 ? Math.floor((Number(c.budget) || 0) * 0.05) : 0)) || 0;
      return sum + cut;
    }, 0);

    const totalProfits = Math.floor(totalYearlyDeductions * 0.25);

    // 25% من الأرباح تذهب لخزينة البنك الدولي التراكمية
    const bankTreasuryShare = Math.floor(totalProfits * 0.25);
    world.worldBankTreasury = (Number(world.worldBankTreasury) || 0) + bankTreasuryShare;

    // 75% من الأرباح تقسم بالتساوي على كافة الدول وتوضع في مدخراتها التراكمية (الرافد الثاني)
    const countriesProfitPool = totalProfits - bankTreasuryShare;
    const perCountryShare = countries.length > 0 ? Math.floor(countriesProfitPool / countries.length) : 0;

    countries.forEach(c => {
      // الرافد الثاني للمدخرات: إضافة حصة الدولة المتساوية من أرباح الاستثمار
      c.worldBankFund = (Number(c.worldBankFund) || 0) + perCountryShare;

      // 2. سداد أقساط ديون البنك الدولي المؤسسية
      if (Number(c.wbDebt) > 0) {
        const annualInstallment = Number(c.wbAnnualInstallment) || Math.ceil(c.wbDebt / Math.max(1, c.wbDebtDuration));
        const actualDeduction = Math.min(c.wbDebt, annualInstallment);

        // يستقطع القسط من المدخرات أو التحصيل
        if (Number(c.worldBankFund) >= actualDeduction) {
          c.worldBankFund -= actualDeduction;
        } else {
          const deficit = actualDeduction - Math.max(0, Number(c.worldBankFund));
          c.worldBankFund = 0;
          if (Number(c.disposableRevenue) >= deficit) {
            c.disposableRevenue -= deficit;
          } else {
            c.bank = (Number(c.bank) || 0) - (deficit - Number(c.disposableRevenue));
            c.disposableRevenue = 0;
          }
        }

        c.wbDebt -= actualDeduction;
        world.worldBankTreasury += actualDeduction;

        c.wbDebtDuration = Math.max(0, (Number(c.wbDebtDuration) || 1) - 1);

        if (c.wbDebt <= 0) {
          c.wbDebt = 0;
          c.wbDebtDuration = 0;
          c.wbAnnualInstallment = 0;
        }
      }
    });

    if (totalProfits > 0) {
      world.addHistoryEvent(
        "economic",
        `البنك الدولي يستثمر اقتطاعات الـ 5% ($${totalYearlyDeductions.toLocaleString()}) ويحقق أرباحاً بـ $${totalProfits.toLocaleString()} (وزع $${countriesProfitPool.toLocaleString()} بالتساوي على الدول بواقع +$${perCountryShare.toLocaleString()} لكل دولة، وحول $${bankTreasuryShare.toLocaleString()} لخزينته)`,
        world.year
      );
    }

    // 3. معالجة استقطاعات وتحويلات القروض السيادية المباشرة بين الدول
    if (!world.sovereignLoans) world.sovereignLoans = [];

    for (let i = world.sovereignLoans.length - 1; i >= 0; i--) {
      const loan = world.sovereignLoans[i];
      const lender = countries.find(c => c.id === loan.lenderId);
      const borrower = countries.find(c => c.id === loan.borrowerId);

      if (!lender || !borrower) {
        continue;
      }

      const installment = Math.min(loan.remainingAmount, loan.annualInstallment);

      // استقطاع القسط من التحصيل المتاح للمقترض (أو من بنكه إذا قل التحصيل)
      if (Number(borrower.disposableRevenue) >= installment) {
        borrower.disposableRevenue -= installment;
      } else {
        const deficit = installment - Number(borrower.disposableRevenue);
        borrower.disposableRevenue = 0;
        borrower.bank = (Number(borrower.bank) || 0) - deficit;
      }

      // تحويل القسط مباشرة إلى رصيد الدولة المقرضة (في التحصيل المتاح)
      lender.disposableRevenue = (Number(lender.disposableRevenue) || 0) + installment;

      loan.remainingAmount -= installment;
      loan.remainingYears = Math.max(0, loan.remainingYears - 1);

      world.addHistoryEvent(
        "economic",
        `تحصيل قسط قرض سيادي: تم استقطاع $${installment.toLocaleString()} من دولة ${borrower.name} وتحويلها لدولة ${lender.name} (المتبقي: $${loan.remainingAmount.toLocaleString()})`,
        world.year
      );

      // إذا اكتمل السداد أو انتهت السنوات
      if (loan.remainingAmount <= 0 || loan.remainingYears <= 0) {
        world.addHistoryEvent(
          "economic",
          `تم بنجاح سداد كامل القرض السيادي المبرم بين دولة ${lender.name} ودولة ${borrower.name}`,
          world.year
        );
        world.sovereignLoans.splice(i, 1);
      }
    }
  }

  // 1. إبرام قرض سيادي مباشر بين دولتين عبر وسيط البنك الدولي
  issueSovereignLoan(world, lenderId, borrowerId, amount, years, source) {
    if (!world) return { success: false, msg: "بيانات العالم غير متوفرة!" };
    if (!world.sovereignLoans) world.sovereignLoans = [];

    if (!lenderId || !borrowerId) {
      return { success: false, msg: "يرجى تحديد الدولة المقرضة والدولة المقترضة!" };
    }
    if (lenderId === borrowerId) {
      return { success: false, msg: "لا يمكن لدولة أن تقرض نفسها!" };
    }

    const lender = world.getAllCountries().find(c => c.id === lenderId);
    const borrower = world.getAllCountries().find(c => c.id === borrowerId);

    if (!lender || !borrower) {
      return { success: false, msg: "إحدى الدولتين المحددة غير موجودة بالسجل!" };
    }

    amount = Math.floor(Number(amount));
    if (isNaN(amount) || amount <= 0) {
      return { success: false, msg: "يرجى إدخال مبلغ إقراض صحيح أكبر من الصفر!" };
    }

    years = Math.floor(Number(years));
    if (isNaN(years) || years < 1 || years > 5) {
      return { success: false, msg: "مدة القرض يجب أن تكون بين 1 إلى 5 سنوات كحد أقصى!" };
    }

    // التحقق من كفاية رصيد الدولة المقرضة
    if (source === "revenue") {
      const rev = Number(lender.disposableRevenue) || 0;
      if (rev < amount) {
        return { success: false, msg: `التحصيل المتاح لدولة ${lender.name} ($${rev.toLocaleString()}) لا يكفي لتمويل هذا القرض ($${amount.toLocaleString()})!` };
      }
      lender.disposableRevenue -= amount;
    } else if (source === "bank") {
      const bank = Number(lender.bank) || 0;
      if (bank < amount) {
        return { success: false, msg: `رصيد البنك الوطني لدولة ${lender.name} ($${bank.toLocaleString()}) لا يكفي لتمويل هذا القرض ($${amount.toLocaleString()})!` };
      }
      lender.bank -= amount;
    } else {
      return { success: false, msg: "يرجى اختيار مصدر أموال صحيح للمقرض (التحصيل أو البنك)!" };
    }

    // إيداع المبلغ المقترض فوراً في التحصيل المتاح للدولة المقترضة
    borrower.disposableRevenue = (Number(borrower.disposableRevenue) || 0) + amount;

    const annualInstallment = Math.ceil(amount / years);

    const loanRecord = {
      id: "sloan_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      lenderId: lender.id,
      lenderName: lender.name,
      lenderFlag: lender.flag,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      borrowerFlag: borrower.flag,
      totalAmount: amount,
      remainingAmount: amount,
      years: years,
      remainingYears: years,
      annualInstallment: annualInstallment,
      createdYear: world.year
    };

    world.sovereignLoans.push(loanRecord);

    const sourceName = source === "revenue" ? "التحصيل المتاح" : "البنك الوطني";
    world.addHistoryEvent(
      "economic",
      `إبرام عقد قرض سيادي: دولة ${lender.name} تقرض دولة ${borrower.name} مبلغ $${amount.toLocaleString()} خصماً من ${sourceName} يسدد على ${years} سنوات بقسط سنوي $${annualInstallment.toLocaleString()}`,
      world.year
    );

    return {
      success: true,
      msg: `تم بنجاح إبرام القرض السيادي! حُوّلت $${amount.toLocaleString()} من ${lender.name} إلى خزينة ${borrower.name} (المستقطع السنوي: $${annualInstallment.toLocaleString()} لمدة ${years} سنوات).`
    };
  }

  // سداد مبكر لكامل القرض السيادي القائم
  repaySovereignLoanEarly(world, loanId, source) {
    if (!world || !world.sovereignLoans) return { success: false, msg: "لا توجد قروض مسجلة!" };

    const loanIdx = world.sovereignLoans.findIndex(l => l.id === loanId);
    if (loanIdx === -1) return { success: false, msg: "القرض غير موجود أو تم سداده مسبقاً!" };

    const loan = world.sovereignLoans[loanIdx];
    const lender = world.getAllCountries().find(c => c.id === loan.lenderId);
    const borrower = world.getAllCountries().find(c => c.id === loan.borrowerId);

    if (!borrower || !lender) return { success: false, msg: "أحد أطراف القرض غير متوفر!" };

    const remaining = loan.remainingAmount;

    if (source === "revenue") {
      const rev = Number(borrower.disposableRevenue) || 0;
      if (rev < remaining) {
        return { success: false, msg: `التحصيل المتاح لدولة ${borrower.name} ($${rev.toLocaleString()}) لا يكفي لسداد باقي القرض ($${remaining.toLocaleString()})!` };
      }
      borrower.disposableRevenue -= remaining;
    } else if (source === "bank") {
      const bank = Number(borrower.bank) || 0;
      if (bank < remaining) {
        return { success: false, msg: `رصيد البنك الوطني لدولة ${borrower.name} ($${bank.toLocaleString()}) لا يكفي لسداد باقي القرض ($${remaining.toLocaleString()})!` };
      }
      borrower.bank -= remaining;
    } else {
      return { success: false, msg: "مصدر السداد غير صالح!" };
    }

    // إرجاع الأموال فوراً لرصيد المقرض
    lender.disposableRevenue = (Number(lender.disposableRevenue) || 0) + remaining;

    world.addHistoryEvent(
      "economic",
      `سداد مبكر: قامت دولة ${borrower.name} بسداد كامل المتبقي من القرض السيادي ($${remaining.toLocaleString()}) لدولة ${lender.name}`,
      world.year
    );

    world.sovereignLoans.splice(loanIdx, 1);

    return {
      success: true,
      msg: `تم بنجاح سداد كامل المبلغ المتبقي ($${remaining.toLocaleString()}) وتحويله إلى خزينة ${lender.name}!`
    };
  }

  // 2. إقراض دولة من خزينة البنك الدولي المركزية
  issueLoan(world, countryId, amount) {
    const country = world.getAllCountries().find(c => c.id === countryId);
    if (!country) return { success: false, msg: "الدولة غير موجودة!" };

    amount = Math.floor(Number(amount));
    if (isNaN(amount) || amount <= 0) return { success: false, msg: "يرجى تحديد مبلغ إقراض صحيح!" };

    const cut5 = Math.floor((Number(country.budget) || 0) * 0.05);
    const maxDebt = cut5 * 3;

    if (amount > maxDebt) {
      return { success: false, msg: `المبلغ المطلوب ($${amount}) يتجاوز الحد الأقصى للدين المسموح به لهذه الدولة ($${maxDebt})!` };
    }

    if (Number(country.wbDebt) > 0) {
      return { success: false, msg: "الدولة لديها قرض قائم بالفعل لدى البنك الدولي لم يتم الانتهاء من سداده!" };
    }

    if (Number(world.worldBankTreasury) < amount) {
      return { success: false, msg: `سيولة خزينة البنك الدولي الحالية ($${world.worldBankTreasury.toLocaleString()}) غير كافية لتمويل هذا القرض!` };
    }

    world.worldBankTreasury -= amount;
    country.disposableRevenue = (Number(country.disposableRevenue) || 0) + amount;

    country.wbDebt = amount;
    country.wbDebtDuration = 5;
    country.wbAnnualInstallment = Math.ceil(amount / 5);

    world.addHistoryEvent("economic", `البنك الدولي يمنح قرضاً لدولة ${country.name} بقيمة $${amount.toLocaleString()} يسدد على 5 سنوات`, world.year);

    return { success: true, msg: `تم بنجاح إقراض دولة ${country.name} مبلغ $${amount.toLocaleString()} وإيداعه في تحصيلها المتاح!` };
  }

  // سداد دين البنك الدولي بالكامل
  repayFullDebt(world, countryId, source) {
    const country = world.getAllCountries().find(c => c.id === countryId);
    if (!country) return { success: false, msg: "الدولة غير موجودة!" };

    const debt = Number(country.wbDebt) || 0;
    if (debt <= 0) {
      return { success: false, msg: `دولة ${country.name} لا يوجد عليها أي ديون قائمة للبنك الدولي!` };
    }

    if (source === "revenue") {
      const revenue = Number(country.disposableRevenue) || 0;
      if (revenue < debt) {
        return { success: false, msg: `التحصيل المتاح لدولة ${country.name} ($${revenue.toLocaleString()}) لا يكفي لسداد كامل الدين ($${debt.toLocaleString()})!` };
      }
      country.disposableRevenue -= debt;
    } else if (source === "bank") {
      const bank = Number(country.bank) || 0;
      if (bank < debt) {
        return { success: false, msg: `رصيد البنك الوطني لدولة ${country.name} ($${bank.toLocaleString()}) لا يكفي لسداد كامل الدين ($${debt.toLocaleString()})!` };
      }
      country.bank -= debt;
    } else {
      return { success: false, msg: "يرجى تحديد مصدر سداد صالح (التحصيل أو البنك الوطني)!" };
    }

    world.worldBankTreasury = (Number(world.worldBankTreasury) || 0) + debt;

    const sourceName = source === "revenue" ? "التحصيل المتاح" : "البنك الوطني";
    world.addHistoryEvent("economic", `دولة ${country.name} تسدد كامل دينها للبنك الدولي بقيمة $${debt.toLocaleString()} خصماً من ${sourceName}`, world.year);

    country.wbDebt = 0;
    country.wbDebtDuration = 0;
    country.wbAnnualInstallment = 0;

    return { success: true, msg: `تم بنجاح سداد كامل دين دولة ${country.name} البالغ $${debt.toLocaleString()} خصماً من ${sourceName}، وتحويله لخزينة البنك!` };
  }

  render(world) {
    if (!this.container) {
      this.container = document.getElementById("worldbank-content-wrapper");
    }
    if (!this.container || !world) return;

    if (!world.sovereignLoans) world.sovereignLoans = [];

    const countries = world.getAllCountries() || [];
    const treasury = Number(world.worldBankTreasury) || 0;

    const sorted = [...countries].sort((a, b) => (Number(b.worldBankFund) || 0) - (Number(a.worldBankFund) || 0));

    const totalSavings = sorted.reduce((sum, c) => sum + Math.max(0, Number(c.worldBankFund) || 0), 0);
    const avgSavings = countries.length > 0 ? Math.floor(totalSavings / countries.length) : 0;
    const totalDebts = sorted.reduce((sum, c) => sum + (Number(c.wbDebt) || 0), 0);

    // حساب الأرباح المتوقعة حصراً من إجمالي مقتطعات الـ 5% السنوية
    const totalYearlyCuts = sorted.reduce((sum, c) => {
      const cut = Number(c.lastWbCut !== undefined ? c.lastWbCut : (c.year > 1 ? Math.floor((Number(c.budget) || 0) * 0.05) : 0)) || 0;
      return sum + cut;
    }, 0);

    const projectedProfits = Math.floor(totalYearlyCuts * 0.25);
    const projectedBankShare = Math.floor(projectedProfits * 0.25);
    const projectedCountriesShare = projectedProfits - projectedBankShare;
    const projectedPerCountry = countries.length > 0 ? Math.floor(projectedCountriesShare / countries.length) : 0;

    const indebtedCountries = countries.filter(c => Number(c.wbDebt) > 0);

    let html = `
      <!-- كروت الإحصائيات العامة للبنك الدولي -->
      <div class="wb-stats-grid">
        <div class="wb-stat-card theme-gold">
          <span class="wb-stat-lbl">خزينة البنك الدولي التراكمية</span>
          <strong class="wb-stat-val text-gold">$${treasury.toLocaleString()}</strong>
          <span class="wb-stat-desc">المصدر الرئيسي لإقراض الدول واستقبال السداد وحصة 25% من الأرباح</span>
        </div>
        <div class="wb-stat-card theme-blue">
          <span class="wb-stat-lbl">إجمالي مدخرات الدول (5% + الأرباح الموزعة)</span>
          <strong class="wb-stat-val text-blue">$${totalSavings.toLocaleString()}</strong>
          <span class="wb-stat-desc">رصيد الطوارئ القابل للسحب المباشر (متوسط: $${avgSavings.toLocaleString()})</span>
        </div>
        <div class="wb-stat-card theme-green">
          <span class="wb-stat-lbl">الأرباح الاستثمارية السنوية (25% من الاقتطاعات)</span>
          <strong class="wb-stat-val text-green">+$${projectedProfits.toLocaleString()}</strong>
          <span class="wb-stat-desc">25% للخزينة ($${projectedBankShare.toLocaleString()}) | 75% تقسم بالتساوي ($${projectedPerCountry.toLocaleString()} لكل دولة)</span>
        </div>
        <div class="wb-stat-card theme-red">
          <span class="wb-stat-lbl">إجمالي ديون البنك الدولي</span>
          <strong class="wb-stat-val text-orange">$${totalDebts.toLocaleString()}</strong>
          <span class="wb-stat-desc">إجمالي اقتطاعات الـ 5% لهذه السنة: $${totalYearlyCuts.toLocaleString()}</span>
        </div>
      </div>

      <!-- 🌟 قسم العمليات: الإقراض السيادي المباشر بين الدول -->
      <div style="background:#131c2e; border:1px solid #3182ce; border-radius:8px; padding:16px; margin-bottom:18px; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <h3 style="color:#63b3ed; margin:0; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
            <span>🤝</span> منصة الإقراض السيادي المباشر بين الدول (وساطة البنك الدولي)
          </h3>
          <span style="font-size:0.8rem; color:#a0aec0;">تحديد المبلغ والسنوات (1-5) والتحويل فوري بين رصيد الدولتين</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; align-items:flex-end;">
          <div>
            <label style="display:block; font-size:0.8rem; color:#cbd5e0; margin-bottom:4px;">الدولة المقرضة (الدائنة):</label>
            <select id="sov-lender-select" style="width:100%; padding:7px; background:#1a2332; border:1px solid #2d3d54; color:#fff; border-radius:4px;">
              <option value="">-- اختر المقرض --</option>
              ${countries.map(c => `<option value="${c.id}">${c.name} [تحصيل: $${Number(c.disposableRevenue).toLocaleString()} | بنك: $${Number(c.bank).toLocaleString()}]</option>`).join("")}
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; color:#cbd5e0; margin-bottom:4px;">مصدر أموال المقرض:</label>
            <select id="sov-source-select" style="width:100%; padding:7px; background:#1a2332; border:1px solid #2d3d54; color:#fff; border-radius:4px;">
              <option value="revenue">من التحصيل المتاح</option>
              <option value="bank">من البنك الوطني</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; color:#cbd5e0; margin-bottom:4px;">الدولة المقترضة (المدينة):</label>
            <select id="sov-borrower-select" style="width:100%; padding:7px; background:#1a2332; border:1px solid #2d3d54; color:#fff; border-radius:4px;">
              <option value="">-- اختر المقترض --</option>
              ${countries.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; color:#cbd5e0; margin-bottom:4px;">مبلغ القرض ($):</label>
            <input type="number" id="sov-amount-input" placeholder="مثال: 1000" min="1" style="width:100%; padding:7px; background:#1a2332; border:1px solid #2d3d54; color:#fff; border-radius:4px;" />
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; color:#cbd5e0; margin-bottom:4px;">مدة السداد (أقصاها 5 سنوات):</label>
            <select id="sov-years-select" style="width:100%; padding:7px; background:#1a2332; border:1px solid #2d3d54; color:#fff; border-radius:4px;">
              <option value="5" selected>5 سنوات (الافتراضي)</option>
              <option value="4">4 سنوات</option>
              <option value="3">3 سنوات</option>
              <option value="2">سنتان</option>
              <option value="1">سنة واحدة</option>
            </select>
          </div>

          <div>
            <div id="sov-calc-preview" style="font-size:0.8rem; color:#f6ad55; margin-bottom:6px; min-height:18px;">المستقطع السنوي: $0 / سنة</div>
            <button id="btn-sov-execute-loan" class="btn btn-accent" style="width:100%; padding:7px; font-weight:bold; background:#2b6cb0; border-color:#3182ce;">
              توقيع وتحويل القرض ➔
            </button>
          </div>
        </div>
      </div>

      <!-- 📋 جدول القروض السيادية النشطة بين الدول -->
      ${world.sovereignLoans.length > 0 ? `
        <div class="excel-ledger-frame" style="margin-bottom:20px; border-color:#3182ce;">
          <table class="excel-history-table">
            <thead>
              <tr>
                <th colspan="8" style="background:#1a365d !important; color:#90cdf4; font-size:1.05rem; padding:10px;">
                  📋 سجل القروض السيادية المباشرة النشطة بين الدول (تستقطع سنوياً تلقائياً عبر البنك)
                </th>
              </tr>
              <tr class="sub-header-row">
                <th style="width:30px; text-align:center;">#</th>
                <th>الدولة المقرضة (الدائنة)</th>
                <th>الدولة المقترضة (المدينة)</th>
                <th style="color:#f6ad55;">إجمالي القرض</th>
                <th style="color:#48bb78;">القسط السنوي</th>
                <th style="color:#e53e3e;">المتبقي</th>
                <th style="text-align:center;">السنوات المتبقية</th>
                <th style="text-align:center;">إجراء السداد المبكر</th>
              </tr>
            </thead>
            <tbody>
              ${world.sovereignLoans.map((loan, lIdx) => {
                const lenderFlagHtml = WorldBankManager.renderMiniFlag(loan.lenderFlag);
                const borrowerFlagHtml = WorldBankManager.renderMiniFlag(loan.borrowerFlag);

                return `
                  <tr>
                    <td style="text-align:center; color:#718096; font-weight:bold;">${lIdx + 1}</td>
                    <td style="font-weight:bold;">
                      <div style="display:inline-flex; align-items:center;">${lenderFlagHtml} <span>${loan.lenderName}</span></div>
                    </td>
                    <td style="font-weight:bold;">
                      <div style="display:inline-flex; align-items:center;">${borrowerFlagHtml} <span>${loan.borrowerName}</span></div>
                    </td>
                    <td class="text-gold" style="font-weight:bold;">$${Number(loan.totalAmount).toLocaleString()}</td>
                    <td class="text-green" style="font-weight:bold;">$${Number(loan.annualInstallment).toLocaleString()} / سنة</td>
                    <td style="color:#e53e3e; font-weight:bold;">$${Number(loan.remainingAmount).toLocaleString()}</td>
                    <td style="text-align:center; font-weight:bold;">${loan.remainingYears} من ${loan.years} سنوات</td>
                    <td style="text-align:center;">
                      <div style="display:flex; gap:4px; justify-content:center;">
                        <button class="btn btn-secondary btn-sov-repay" data-id="${loan.id}" data-source="revenue" style="padding:2px 8px; font-size:0.75rem;" title="سداد مبكر من التحصيل المتاح">سداد مبكر (تحصيل)</button>
                        <button class="btn btn-secondary btn-sov-repay" data-id="${loan.id}" data-source="bank" style="padding:2px 8px; font-size:0.75rem;" title="سداد مبكر من البنك الوطني">سداد مبكر (بنك)</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- أشرطة العمليات: الاقتراض المؤسسي من خزينة البنك والسداد الكامل -->
      <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:18px;">
        <!-- 1) شريط طلب قرض من البنك الدولي -->
        <div class="wb-loan-action-bar" style="flex:1; min-width:320px;">
          <div style="font-weight:bold; color:#f6ad55; width:100%;">🏛️ طلب قرض من خزينة البنك الدولي:</div>
          <select id="wb-loan-country-select" style="flex:1;">
            <option value="">-- اختر الدولة المستفيدة --</option>
            ${countries.map(c => {
              const cut5 = Math.floor((Number(c.budget) || 0) * 0.05);
              const max = cut5 * 3;
              const hasDebt = Number(c.wbDebt) > 0 ? " (عليه دين)" : "";
              return `<option value="${c.id}">${c.name} [أقصى دين: $${max}]${hasDebt}</option>`;
            }).join("")}
          </select>
          <input type="number" id="wb-loan-amount-input" placeholder="المبلغ ($)" min="1" style="width: 100px;" />
          <button id="btn-wb-grant-loan" class="btn btn-accent" style="padding:6px 14px;">اعتماد ➔</button>
        </div>

        <!-- 2) شريط سداد دين البنك الدولي بالكامل -->
        <div class="wb-loan-action-bar" style="flex:1; min-width:320px; border-color:#2f855a;">
          <div style="font-weight:bold; color:#48bb78; width:100%;">💳 سداد كامل دين البنك الدولي:</div>
          <select id="wb-repay-country-select" style="flex:1;">
            <option value="">-- اختر الدولة المدينة --</option>
            ${indebtedCountries.map(c => {
              return `<option value="${c.id}">${c.name} [دينها: $${Number(c.wbDebt).toLocaleString()}]</option>`;
            }).join("")}
          </select>
          <select id="wb-repay-source-select">
            <option value="revenue">من التحصيل المتاح</option>
            <option value="bank">من البنك الوطني</option>
          </select>
          <button id="btn-wb-repay-full" class="btn btn-primary" style="background:#27ae60; border-color:#2ecc71; padding:6px 14px;">سداد بالكامل ➔</button>
        </div>
      </div>

      <!-- جدول مدخرات الدول وديون البنك الدولي المرتب تنازلياً -->
      <div class="excel-ledger-frame">
        <table class="excel-history-table">
          <thead>
            <tr>
              <th colspan="9" style="background:#23354d !important; color:#fff; font-size:1.1rem; padding:10px;">
                قائمة مدخرات الدول بصندوق البنك الدولي وموقف الديون المؤسسية والسداد
              </th>
            </tr>
            <tr class="sub-header-row">
              <th style="width:30px; text-align:center;">#</th>
              <th>الدولة</th>
              <th style="color:#3182ce; font-weight:bold;">المدخرات (المتاحة لسحب الطوارئ) ⬇</th>
              <th>المبلغ المقتطع (5%)</th>
              <th>أقصى دين للبنك (5% × 3)</th>
              <th style="color:#e53e3e;">دين البنك القائم</th>
              <th>القسط السنوي</th>
              <th>المدة المتبقية</th>
              <th style="text-align:center;">إجراء السداد</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (sorted.length === 0) {
      html += `<tr><td colspan="9" style="text-align:center; color:#888; padding:20px;">لا توجد دول مسجلة حتى الآن.</td></tr>`;
    } else {
      sorted.forEach((c, idx) => {
        const savings = Math.max(0, Number(c.worldBankFund) || 0);
        const cut5 = Number(c.lastWbCut !== undefined ? c.lastWbCut : (c.year > 1 ? Math.floor((Number(c.budget) || 0) * 0.05) : 0)) || 0;
        const maxDebt = cut5 * 3;
        const debt = Number(c.wbDebt) || 0;
        const installment = Number(c.wbAnnualInstallment) || (debt > 0 ? Math.ceil(debt / Math.max(1, c.wbDebtDuration)) : 0);
        const duration = Number(c.wbDebtDuration) || 0;

        let actionHtml = `-`;
        if (debt > 0) {
          actionHtml = `
            <div style="display:flex; gap:4px; justify-content:center;">
              <button class="btn btn-secondary btn-quick-repay" data-id="${c.id}" data-source="revenue" style="padding:2px 6px; font-size:0.75rem;" title="سداد الدين كاملاً من التحصيل المتاح">سداد (تحصيل)</button>
              <button class="btn btn-secondary btn-quick-repay" data-id="${c.id}" data-source="bank" style="padding:2px 6px; font-size:0.75rem;" title="سداد الدين كاملاً من البنك الوطني">سداد (بنك)</button>
            </div>
          `;
        }

        const flagHtml = WorldBankManager.renderMiniFlag(c.flag);

        html += `
          <tr>
            <td style="text-align:center; color:#718096; font-weight:bold;">${idx + 1}</td>
            <td style="font-weight:bold;">
              <div style="display:inline-flex; align-items:center;">${flagHtml} <span>${c.name}</span></div>
            </td>
            <td class="text-blue" style="font-weight:bold;">$${savings.toLocaleString()}</td>
            <td style="color:#718096;">$${cut5.toLocaleString()}</td>
            <td class="text-gold" style="font-weight:bold;">$${maxDebt.toLocaleString()}</td>
            <td style="color:${debt > 0 ? '#e53e3e' : '#718096'}; font-weight:${debt > 0 ? 'bold' : 'normal'};">
              $${debt.toLocaleString()}
            </td>
            <td>${debt > 0 ? `$${installment.toLocaleString()} / سنة` : "-"}</td>
            <td style="text-align:center;">${debt > 0 ? `${duration} سنوات` : "-"}</td>
            <td>${actionHtml}</td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
          <tfoot>
            <tr style="background:#edf2f7; font-weight:bold; border-top:2px solid #cbd5e0;">
              <td colspan="2" style="text-align:center;">المجموع العام والمتوسطات</td>
              <td class="text-blue">$${totalSavings.toLocaleString()} (متوسط: $${avgSavings.toLocaleString()})</td>
              <td>$${totalYearlyCuts.toLocaleString()}</td>
              <td>-</td>
              <td style="color:#e53e3e;">إجمالي الديون: $${totalDebts.toLocaleString()}</td>
              <td colspan="3" style="text-align:center; color:#4a5568;">تتم تسوية كافة الأقساط سنوياً وتلقائياً عبر النظام المالي</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    this.container.innerHTML = html;

    // احتساب القسط المباشر في واجهة الإقراض السيادي
    const sovAmountInput = document.getElementById("sov-amount-input");
    const sovYearsSelect = document.getElementById("sov-years-select");
    const sovCalcPreview = document.getElementById("sov-calc-preview");

    const updateCalcPreview = () => {
      const amt = Number(sovAmountInput.value) || 0;
      const yrs = Number(sovYearsSelect.value) || 5;
      if (amt > 0) {
        const inst = Math.ceil(amt / yrs);
        sovCalcPreview.textContent = `المستقطع السنوي: $${inst.toLocaleString()} / سنة (لمدة ${yrs} سنوات)`;
      } else {
        sovCalcPreview.textContent = `المستقطع السنوي: $0 / سنة`;
      }
    };

    if (sovAmountInput && sovYearsSelect) {
      sovAmountInput.addEventListener("input", updateCalcPreview);
      sovYearsSelect.addEventListener("change", updateCalcPreview);
    }

    // تفعيل زر إبرام القرض السيادي المباشر
    const btnSovExecute = document.getElementById("btn-sov-execute-loan");
    if (btnSovExecute) {
      btnSovExecute.addEventListener("click", () => {
        const lenderId = document.getElementById("sov-lender-select").value;
        const source = document.getElementById("sov-source-select").value;
        const borrowerId = document.getElementById("sov-borrower-select").value;
        const amount = document.getElementById("sov-amount-input").value;
        const years = document.getElementById("sov-years-select").value;

        const res = this.issueSovereignLoan(world, lenderId, borrowerId, amount, years, source);
        alert(res.msg);
        if (res.success) {
          this.render(world);
          if (window.renderNationsTable) window.renderNationsTable();
        }
      });
    }

    // تفعيل أزرار السداد المبكر للقروض السيادية
    const sovRepayBtns = document.querySelectorAll(".btn-sov-repay");
    sovRepayBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const loanId = btn.dataset.id;
        const src = btn.dataset.source;
        const loan = world.sovereignLoans.find(l => l.id === loanId);
        if (!loan) return;

        const srcName = src === "revenue" ? "التحصيل المتاح" : "البنك الوطني";
        if (!confirm(`هل أنت متأكد من سداد كامل المبلغ المتبقي لدولة ${loan.lenderName} البالغ $${Number(loan.remainingAmount).toLocaleString()} خصماً من ${srcName} لدولة ${loan.borrowerName}؟`)) {
          return;
        }

        const res = this.repaySovereignLoanEarly(world, loanId, src);
        alert(res.msg);
        if (res.success) {
          this.render(world);
          if (window.renderNationsTable) window.renderNationsTable();
        }
      });
    });

    // تفعيل زر منح قرض البنك الدولي المركزي
    const btnGrant = document.getElementById("btn-wb-grant-loan");
    if (btnGrant) {
      btnGrant.addEventListener("click", () => {
        const countrySelect = document.getElementById("wb-loan-country-select");
        const amountInput = document.getElementById("wb-loan-amount-input");
        const cId = countrySelect.value;
        const amt = amountInput.value;

        if (!cId) {
          alert("يرجى اختيار الدولة أولاً!");
          return;
        }

        const res = this.issueLoan(world, cId, amt);
        alert(res.msg);
        if (res.success) {
          this.render(world);
          if (window.renderNationsTable) window.renderNationsTable();
        }
      });
    }

    // تفعيل زر سداد دين البنك الدولي بالكامل
    const btnRepay = document.getElementById("btn-wb-repay-full");
    if (btnRepay) {
      btnRepay.addEventListener("click", () => {
        const countrySelect = document.getElementById("wb-repay-country-select");
        const sourceSelect = document.getElementById("wb-repay-source-select");
        const cId = countrySelect.value;
        const src = sourceSelect.value;

        if (!cId) {
          alert("يرجى اختيار الدولة المدينة أولاً!");
          return;
        }

        const res = this.repayFullDebt(world, cId, src);
        alert(res.msg);
        if (res.success) {
          this.render(world);
          if (window.renderNationsTable) window.renderNationsTable();
        }
      });
    }

    // تفعيل أزرار السداد السريع لدين البنك الدولي
    const quickRepayBtns = document.querySelectorAll(".btn-quick-repay");
    quickRepayBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const cId = btn.dataset.id;
        const src = btn.dataset.source;
        const country = world.getAllCountries().find(c => c.id === cId);
        if (!country) return;

        const srcName = src === "revenue" ? "التحصيل المتاح" : "البنك الوطني";
        if (!confirm(`هل أنت متأكد من سداد كامل دين دولة ${country.name} البالغ $${Number(country.wbDebt).toLocaleString()} خصماً من ${srcName}؟`)) {
          return;
        }

        const res = this.repayFullDebt(world, cId, src);
        alert(res.msg);
        if (res.success) {
          this.render(world);
          if (window.renderNationsTable) window.renderNationsTable();
        }
      });
    });
  }
}

window.WorldBankManager = new WorldBankManager();