class EconomyEngine {
  static WORLD_BANK_RATE = 0.05;

  static setupInitialFinances(country) {
    country.year = 1;
    country.worldBankFund = 0;
    country.budget = 0;
    country.disposableRevenue = 200;
    country.bank = 0;
    country.exports = 0;
    country.imports = 0;
    country.lastWbCut = 0;
  }

  // تدوير السنة المالية لدولة ومزامنتها مع دخل المنشآت المستمر
  static advanceFinancialYear(country) {
    // 1. ترحيل الفائض المتبقي في التحصيل إلى البنك الوطني تلقائياً
    country.bank = (Number(country.bank) || 0) + (Number(country.disposableRevenue) || 0);

    // 2. تطبيق أثر التبادل التجاري
    country.bank += Number(country.exports || 0);
    country.bank -= Number(country.imports || 0);

    // 3. مزامنة سنة الدولة مع سنة العالم العامة
    if (window.currentWorld && window.currentWorld.year) {
      country.year = window.currentWorld.year;
    } else {
      country.year = (Number(country.year) || 1) + 1;
    }

    // 4. المحرك الأساسي للمال: احتساب دخل الموارد والمنشآت المستمر
    const totalResourceRevenue = window.BuildingsEngine 
      ? window.BuildingsEngine.calculateTotalRevenue(country)
      : (window.SectorsEngine ? window.SectorsEngine.calculateSectorRevenue(country) : 0);

    country.sectorRevenues = totalResourceRevenue;
    country.budget = totalResourceRevenue;

    // 5. استقطاع الـ 5% كادخار إلزامي لصندوق البنك الدولي (مع الإعفاء في السنة الأولى)
    let wbCut = 0;
    if (country.year > 1) {
      wbCut = Math.floor(country.budget * this.WORLD_BANK_RATE);
    }
    country.lastWbCut = wbCut;

    // الرافد الأول للمدخرات: إضافة مبلغ الاقتطاع تراكمياً في رصيد مدخرات الدولة لدى البنك الدولي
    country.worldBankFund = (Number(country.worldBankFund) || 0) + wbCut;

    // 6. التحصيل الجديد المستمر للسنة المالية الجديدة: التحصيل = الميزانية - استقطاع الادخار الإلزامي
    country.disposableRevenue = country.budget - wbCut;
  }

  static withdrawAllFromBank(country) {
    if (country.bank <= 0) {
      return { success: false, msg: "لا يوجد رصيد إيجابي في البنك لسحبه!" };
    }
    const amount = country.bank;
    country.disposableRevenue += amount;
    country.bank = 0;
    return { success: true, amount: amount };
  }

  static withdrawPartialFromBank(country, amount) {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) {
      return { success: false, msg: "المبلغ المدخل غير صالح!" };
    }
    if (country.bank <= 0) {
      return { success: false, msg: "رصيد البنك صفر أو مديون، لا يمكن السحب!" };
    }
    if (val > country.bank) {
      return { success: false, msg: `رصيد البنك المتوفر ($${country.bank}) أقل من المبلغ المطلوب!` };
    }

    country.bank -= val;
    country.disposableRevenue += val;
    return { success: true, amount: val };
  }

  // سحب أموال الطوارئ مقيد حصراً بما تمتلكه الدولة في رصيد مدخرات البنك الدولي (5% التراكمية + الأرباح الموزعة)
  static emergencyWithdrawFromWorldBank(country, amount) {
    const availableSavings = Math.max(0, Number(country.worldBankFund) || 0);

    if (availableSavings <= 0) {
      return { 
        success: false, 
        msg: `لا يمكن سحب أموال الطوارئ! رصيد المدخرات في البنك الدولي لدولة ${country.name} هو $0.` 
      };
    }

    // إذا لم يحدد مبلغ أو طلب سحب الرصيد كاملاً
    const val = (amount !== undefined && amount !== null && amount !== "") ? Math.floor(Number(amount)) : availableSavings;

    if (isNaN(val) || val <= 0) {
      return { success: false, msg: "يرجى تحديد مبلغ سحب صحيح أكبر من الصفر!" };
    }

    if (val > availableSavings) {
      return { 
        success: false, 
        msg: `المبلغ المطلوب ($${val.toLocaleString()}) يتجاوز رصيد المدخرات المتوفر لدولة ${country.name} في البنك الدولي ($${availableSavings.toLocaleString()})!` 
      };
    }

    country.worldBankFund = availableSavings - val;
    country.disposableRevenue = (Number(country.disposableRevenue) || 0) + val;

    return { 
      success: true, 
      amount: val, 
      msg: `تم بنجاح سحب $${val.toLocaleString()} من المدخرات وإيداعها في التحصيل المتاح لدولة ${country.name}!` 
    };
  }

  // نظام التبرعات والمساعدات المالية السيادية بين الدول
  static sendDonation(sender, recipient, amount) {
    if (!sender || !recipient) {
      return { success: false, msg: "بيانات الدولة المانحة أو المستفيدة غير صحيحة!" };
    }
    if (sender.id === recipient.id || sender.name === recipient.name) {
      return { success: false, msg: "لا يمكن للدولة تقديم مساعدة مالية لنفسها!" };
    }

    const val = Math.floor(Number(amount));
    if (isNaN(val) || val <= 0) {
      return { success: false, msg: "يرجى تحديد مبلغ مساعدة مالي صحيح وأكبر من الصفر!" };
    }

    const senderFunds = Number(sender.disposableRevenue || 0);
    if (val > senderFunds) {
      return { 
        success: false, 
        msg: `السيولة المالية المتاحة لدى دولة ${sender.name} ($${senderFunds.toLocaleString()}) غير كافية لتقديم منحة بقيمة $${val.toLocaleString()}!` 
      };
    }

    // خصم المبلغ من الدولة المانحة وإيداعه في التحصيل المتاح للدولة المستفيدة
    sender.disposableRevenue -= val;
    recipient.disposableRevenue = (Number(recipient.disposableRevenue) || 0) + val;

    // توثيق المنحة في الأرشيف الدفتري وسجل التاريخ
    if (window.ChronicleEngine && typeof window.ChronicleEngine.addEntry === "function") {
      const currentYear = window.currentWorld?.year || sender.year || 1;
      window.ChronicleEngine.addEntry(
        currentYear,
        "economic",
        `🤝 قدمت [${sender.name}] منحة ومساعدة مالية سيادية قدرها $${val.toLocaleString()} إلى دولة [${recipient.name}].`
      );
    }

    return {
      success: true,
      amount: val,
      msg: `تم بنجاح تحويل مساعدة مالية بقيمة $${val.toLocaleString()} من دولة ${sender.name} إلى دولة ${recipient.name}!`
    };
  }
}

window.EconomyEngine = EconomyEngine;