/**
 * War Engine - عصر الهيمنة
 * محرك الحروب الموحد والخيارات الثلاثة للمدافع (الاستسلام / دفع الجزية / الحرب)
 * ومصفوفة حسم ما بعد المعركة وترابط بيانات الجيوش والدول
 */

class WarEngine {
  static MILITARY_PALETTE = [
    "#ef4444", "#3b82f6", "#10b981", "#f59e0b",
    "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6",
    "#f97316", "#64748b"
  ];

  static getCountryMilitaryColor(country) {
    if (!country) return "#3b82f6";

    if (country.militaryColor && typeof country.militaryColor === "string" && country.militaryColor.startsWith("#")) {
      return country.militaryColor;
    }

    if (country.flag && Array.isArray(country.flag)) {
      for (let r = 0; r < country.flag.length; r++) {
        const row = country.flag[r];
        if (Array.isArray(row)) {
          for (let c = 0; c < row.length; c++) {
            const col = row[c];
            if (typeof col === "string" && col.startsWith("#") && col !== "#ffffff" && col !== "#000000" && col !== "#111111") {
              country.militaryColor = col;
              return col;
            }
          }
        } else if (typeof row === "string" && row.startsWith("#") && row !== "#ffffff" && row !== "#000000" && row !== "#111111") {
          country.militaryColor = row;
          return row;
        }
      }
    }

    let hash = 0;
    const nameStr = String(country.name || "nation");
    for (let i = 0; i < nameStr.length; i++) {
      hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = this.MILITARY_PALETTE[Math.abs(hash) % this.MILITARY_PALETTE.length];
    country.militaryColor = color;
    return color;
  }

  static setCountryMilitaryColor(country, colorHex) {
    if (!country || typeof colorHex !== "string" || !colorHex.startsWith("#")) return;
    country.militaryColor = colorHex;
  }

  // فحص إجمالي القطع العسكرية الفعلية المخزنة لدى الدولة
  static getStandingArmyCount(country) {
    if (!country) return 0;
    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(country);
    }
    if (!country.military) return 0;
    const inv = country.military.inventory || country.military.units || {};
    let total = 0;
    Object.keys(inv).forEach(uid => {
      total += Math.max(0, Number(inv[uid] || 0));
    });
    return total;
  }

  // حساب إجمالي القوة العسكرية الفعلية للدولة
  static getStandingArmyPower(country) {
    if (!country) return 0;
    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(country);
    }
    return Number((country.military && country.military.totalPower) || country.militaryPower || 0);
  }

  // حساب إحصائيات جيش محتشد (عدد الوحدات، إجمالي القوة، وإجمالي الأفراد)
  static calculateForcesSummary(forcesMap) {
    let totalUnits = 0;
    let totalPower = 0;
    let totalCrew = 0;

    Object.keys(forcesMap || {}).forEach(uid => {
      const cnt = Math.max(0, Number(forcesMap[uid] || 0));
      if (cnt > 0) {
        totalUnits += cnt;
        const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
        if (u) {
          totalPower += (Number(u.power) || 0) * cnt;
          totalCrew += (Number(u.crew) || 0) * cnt;
        } else {
          totalPower += cnt;
        }
      }
    });

    return {
      totalUnits,
      totalPower: Number(totalPower.toFixed(1)),
      totalCrew
    };
  }

  // حساب قيمة الجزية المطلوبة من الدولة المدافعة لتجنب الحرب
  static calculateTributeOfferAmount(defenderCountry) {
    if (!defenderCountry) return 50;
    const disp = Math.max(0, Number(defenderCountry.disposableRevenue || 0));
    const bank = Math.max(0, Number(defenderCountry.bank || 0));
    const wb = Math.max(0, Number(defenderCountry.worldBankFund || 0));
    const totalLiquid = disp + bank;

    if (totalLiquid > 0) {
      return Math.max(20, Math.floor(totalLiquid * 0.25));
    }
    if (wb > 0) {
      return Math.max(20, Math.floor(wb * 0.25));
    }
    return 0;
  }

  /**
   * الخيار الأول للمدافع: الاستسلام الفوري (بدون قتال)
   * يتم تسليم المعركة ومصادرة مدخرات البنوك (و50% من السيولة إن كانت البنوك فارغة) لصالح المهاجم مع حفظ جيش المدافع من التدمير
   */
  static executeDefenderSurrender(winningCoalition, losingCoalition, world) {
    world = world || window.currentWorld;
    const yr = world?.year || 1;

    const leadWinner = winningCoalition[0].country;
    const leadLoser = losingCoalition[0].country;

    let totalWinningPower = 0;
    winningCoalition.forEach(member => {
      const stats = this.calculateForcesSummary(member.forces);
      member.powerContribution = Math.max(1, stats.totalPower || 1);
      totalWinningPower += member.powerContribution;
    });

    let totalSeizedLocal = 0;
    let totalSeizedWorld = 0;
    let totalSeizedCash = 0;

    losingCoalition.forEach(loserMember => {
      const lc = loserMember.country;
      const localB = Math.max(0, Number(lc.bank) || 0);
      const worldB = Math.max(0, Number(lc.worldBankFund) || 0);
      const cashCut = (localB + worldB === 0) ? Math.floor(Math.max(0, Number(lc.disposableRevenue || 0)) * 0.5) : 0;

      totalSeizedLocal += localB;
      totalSeizedWorld += worldB;
      totalSeizedCash += cashCut;

      lc.bank = 0;
      lc.worldBankFund = 0;
      if (cashCut > 0) {
        lc.disposableRevenue = Math.max(0, Number(lc.disposableRevenue || 0) - cashCut);
      }
      lc.generalIndex = Math.max(0, (Number(lc.generalIndex) || 0) - 15);
    });

    const totalLoot = totalSeizedLocal + totalSeizedWorld + totalSeizedCash;

    winningCoalition.forEach(winnerMember => {
      const ratio = winnerMember.powerContribution / totalWinningPower;
      const myShare = Math.floor(totalLoot * ratio);
      winnerMember.country.disposableRevenue = (Number(winnerMember.country.disposableRevenue) || 0) + myShare;
      winnerMember.country.generalIndex = (Number(winnerMember.country.generalIndex) || 0) + 10;
    });

    const logText = `🏳️ استسلام رسمي: اختارت دولة [${leadLoser.name}] الاستسلام أمام جيش [${leadWinner.name}] دون قتال. صودرت المدخرات والغنائم بإجمالي $${totalLoot.toLocaleString()} وأودعت في خزينة المنتصر.`;
    if (world && typeof world.addHistoryEvent === "function") {
      world.addHistoryEvent("political", logText, yr);
    }

    return {
      type: "surrender_choice",
      title: `🏳️ استسلام دولة [${leadLoser.name}] وتسليم الغنائم بدون قتال`,
      details: logText,
      color: "#34d399",
      seizedAmount: totalLoot
    };
  }

  /**
   * الخيار الثاني للمدافع: دفع الجزية (تجنب الحرب وحقن الدماء)
   * يدفع المدافع دفعة جزية فورية (25% من السيولة/البنك) + إبرام عقد جزية سنوية (20% لمدة 5 سنوات) مقابل انسحاب الجيش المهاجم
   */
  static executeDefenderPayTribute(winningCoalition, losingCoalition, world) {
    world = world || window.currentWorld;
    const yr = world?.year || 1;

    const leadWinner = winningCoalition[0].country;
    const leadLoser = losingCoalition[0].country;

    let totalWinningPower = 0;
    winningCoalition.forEach(member => {
      const stats = this.calculateForcesSummary(member.forces);
      member.powerContribution = Math.max(1, stats.totalPower || 1);
      totalWinningPower += member.powerContribution;
    });

    let totalPaidNow = 0;

    losingCoalition.forEach(loserMember => {
      const lCountry = loserMember.country;
      let tribAmount = this.calculateTributeOfferAmount(lCountry);

      let rem = tribAmount;
      const disp = Math.max(0, Number(lCountry.disposableRevenue || 0));
      if (disp >= rem) {
        lCountry.disposableRevenue = disp - rem;
        rem = 0;
      } else {
        rem -= disp;
        lCountry.disposableRevenue = 0;
        const bnk = Math.max(0, Number(lCountry.bank || 0));
        if (bnk >= rem) {
          lCountry.bank = bnk - rem;
          rem = 0;
        } else {
          rem -= bnk;
          lCountry.bank = 0;
          const wbf = Math.max(0, Number(lCountry.worldBankFund || 0));
          lCountry.worldBankFund = Math.max(0, wbf - rem);
        }
      }

      totalPaidNow += tribAmount;

      if (!world.tributes) world.tributes = [];
      // إزالة أي عقد جزية قديم بين نفس الطرفين لمنع الازدواجية ثم تسجيل العقد الجديد
      world.tributes = world.tributes.filter(t => String(t.defenderId) !== String(lCountry.id));
      world.tributes.push({
        id: "trib_" + Date.now() + "_" + lCountry.id,
        targetCoalition: winningCoalition.map(w => ({ id: w.country.id, shareRatio: w.powerContribution / totalWinningPower })),
        attackerName: leadWinner.name + (winningCoalition.length > 1 ? " وحلفاؤها" : ""),
        defenderId: lCountry.id,
        defenderName: lCountry.name,
        rate: 0.20,
        yearsRemaining: 5,
        createdYear: yr
      });
    });

    winningCoalition.forEach(winnerMember => {
      const share = Math.floor(totalPaidNow * (winnerMember.powerContribution / totalWinningPower));
      winnerMember.country.disposableRevenue = (Number(winnerMember.country.disposableRevenue) || 0) + share;
    });

    const logText = `💰 معاهدة دفع الجزية: وافقت دولة [${leadLoser.name}] على دفع جزية فورية قدرها $${totalPaidNow.toLocaleString()} مع التزام بعقد جزية خمسية (20% سنوياً) لصالح دولة [${leadWinner.name}] مقابل إيقاف الغزو وسحب الجيوش.`;
    if (world && typeof world.addHistoryEvent === "function") {
      world.addHistoryEvent("political", logText, yr);
    }

    return {
      type: "tribute_choice",
      title: `💰 دفع الجزية وإيقاف الغزو (${leadLoser.name} ➔ ${leadWinner.name})`,
      details: logText,
      color: "#fbbf24",
      amount: totalPaidNow
    };
  }

  /**
   * مصفوفة حسم ما بعد المعركة للتحالفات الفائزة بعد انتهاء القتال الميداني
   */
  static resolveCoalitionPostBattleVictory(winningCoalition, losingCoalition, world, atkMobStatus, defMobStatus) {
    world = world || window.currentWorld;
    const yr = world?.year || 1;

    const leadWinner = winningCoalition[0].country;
    const leadLoser = losingCoalition[0].country;

    let totalWinningPower = 0;
    winningCoalition.forEach(member => {
      let memberPower = 0;
      Object.keys(member.forces || {}).forEach(uid => {
        const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
        memberPower += (u ? (u.power || 1) : 1) * Number(member.forces[uid] || 0);
      });
      member.powerContribution = Math.max(1, memberPower);
      totalWinningPower += member.powerContribution;
    });

    const isFullVsFull = (atkMobStatus === "FULL" && defMobStatus === "FULL");
    const isSurrenderCase = (
      (atkMobStatus === "FULL" && defMobStatus === "PARTIAL") ||
      (atkMobStatus === "PARTIAL" && defMobStatus === "FULL") ||
      (defMobStatus === "NO_ARMY")
    );

    // 1. حالة كامل ضد كامل => عقد دية خمسية (20% سنوياً) توزع على دول الحلف المنتصر
    if (isFullVsFull) {
      let totalFirstCut = 0;
      losingCoalition.forEach(loserMember => {
        const lCountry = loserMember.country;
        const tribCut = Math.floor(Number(lCountry.disposableRevenue || 0) * 0.20);
        lCountry.disposableRevenue = Math.max(0, (Number(lCountry.disposableRevenue) || 0) - tribCut);
        totalFirstCut += tribCut;

        if (!world.tributes) world.tributes = [];
        world.tributes.push({
          id: "trib_" + Date.now() + "_" + lCountry.id,
          targetCoalition: winningCoalition.map(w => ({ id: w.country.id, shareRatio: w.powerContribution / totalWinningPower })),
          attackerName: leadWinner.name + (winningCoalition.length > 1 ? " وحلفاؤها" : ""),
          defenderId: lCountry.id,
          defenderName: lCountry.name,
          rate: 0.20,
          yearsRemaining: 5,
          createdYear: yr
        });
      });

      winningCoalition.forEach(winnerMember => {
        const share = Math.floor(totalFirstCut * (winnerMember.powerContribution / totalWinningPower));
        winnerMember.country.disposableRevenue = (Number(winnerMember.country.disposableRevenue) || 0) + share;
      });

      const logText = `حسم عسكري كامل: انتصار جيش [${leadWinner.name}] على جيش [${leadLoser.name}]. فُرضت جزية خمسية (20% سنوياً) بدفعة أولى $${totalFirstCut.toLocaleString()}.`;
      if (world && typeof world.addHistoryEvent === "function") world.addHistoryEvent("political", logText, yr);

      return {
        type: "tribute",
        title: "📜 إبرام عقد الجزية الخمسية للجيش المنتصر (20% سنوياً)",
        details: logText,
        color: "#fbbf24",
        amount: totalFirstCut
      };
    }

    // 2. حالة الاستسلام ومصادرة مدخرات البنكين
    if (isSurrenderCase) {
      let totalSeizedLocal = 0;
      let totalSeizedWorld = 0;

      losingCoalition.forEach(loserMember => {
        const lc = loserMember.country;
        const localB = Math.max(0, Number(lc.bank) || 0);
        const worldB = Math.max(0, Number(lc.worldBankFund) || 0);

        totalSeizedLocal += localB;
        totalSeizedWorld += worldB;

        lc.bank = 0;
        lc.worldBankFund = 0;
        lc.generalIndex = Math.max(0, (Number(lc.generalIndex) || 0) - 15);
      });

      const totalLoot = totalSeizedLocal + totalSeizedWorld;

      winningCoalition.forEach(winnerMember => {
        const ratio = winnerMember.powerContribution / totalWinningPower;
        const myShare = Math.floor(totalLoot * ratio);
        winnerMember.country.bank = (Number(winnerMember.country.bank) || 0) + myShare;
        winnerMember.country.generalIndex = (Number(winnerMember.country.generalIndex) || 0) + 10;
      });

      let reasonTitle = "اجتياح عسكري ومصادرة مدخرات البنوك";
      if (defMobStatus === "NO_ARMY") reasonTitle = "سيطرة ميدانية لانعدام الجيش المدافع";

      const logText = `${reasonTitle}: انتصر جيش [${leadWinner.name}] على [${leadLoser.name}] وصودرت المدخرات (البنك المحلي: $${totalSeizedLocal.toLocaleString()} | البنك الدولي: $${totalSeizedWorld.toLocaleString()}) بإجمالي $${totalLoot.toLocaleString()}.`;
      if (world && typeof world.addHistoryEvent === "function") world.addHistoryEvent("political", logText, yr);

      return {
        type: "surrender_banks",
        title: "🏳️ حسم المعركة ومصادرة مدخرات البنوك",
        details: logText,
        color: "#34d399",
        seizedAmount: totalLoot
      };
    }

    // 3. حالة المناوشة الجزئية (بعض ضد بعض)
    const skirmishLog = `معركة تكتيكية محدودة: انتصر جيش [${leadWinner.name}] ميدانياً على القوة المشاركة من [${leadLoser.name}] وتكبد الطرفان خسائر الوحدات المدمرة في الميدان.`;
    if (world && typeof world.addHistoryEvent === "function") world.addHistoryEvent("political", skirmishLog, yr);

    return {
      type: "skirmish_draw",
      title: "⚔️ حسم الاشتباك الميداني وتطبيق الخسائر العسكرية",
      details: skirmishLog,
      color: "#38bdf8"
    };
  }

  static processAnnualTributes(world) {
    if (!world || !world.tributes || world.tributes.length === 0) return;

    world.tributes = world.tributes.filter(trib => {
      const defender = world.countries.find(c => c.id === trib.defenderId);
      if (!defender) return false;

      const annualCut = Math.floor(Number(defender.disposableRevenue || 0) * trib.rate);
      if (annualCut > 0) {
        defender.disposableRevenue = Math.max(0, defender.disposableRevenue - annualCut);

        if (Array.isArray(trib.targetCoalition)) {
          trib.targetCoalition.forEach(target => {
            const ally = world.countries.find(c => c.id === target.id);
            if (ally) {
              const allyShare = Math.floor(annualCut * target.shareRatio);
              ally.bank = (Number(ally.bank) || 0) + allyShare;
            }
          });
        } else if (trib.attackerId) {
          const attacker = world.countries.find(c => c.id === trib.attackerId);
          if (attacker) attacker.bank = (Number(attacker.bank) || 0) + annualCut;
        }

        world.addHistoryEvent(
          "economic",
          `سداد الجزية السنوية: دفعت دولة [${defender.name}] قسط الجزية البالغ $${annualCut.toLocaleString()} لصالح [${trib.attackerName}] (المتبقي: ${trib.yearsRemaining - 1} سنوات).`,
          world.year
        );
      }

      trib.yearsRemaining -= 1;
      return trib.yearsRemaining > 0;
    });
  }

  static applyBattleLosses(country, lossesMap) {
    if (!country || !country.military || !country.military.inventory) {
      return { totalLostUnits: 0, totalLostCrew: 0, remainingUnits: 0, remainingPower: 0 };
    }

    let totalLostUnits = 0;
    let totalLostCrew = 0;

    Object.keys(lossesMap || {}).forEach(unitId => {
      const lostCount = Math.max(0, Number(lossesMap[unitId] || 0));
      if (lostCount > 0) {
        const currentCount = Number(country.military.inventory[unitId] || 0);
        const actualDeduction = Math.min(currentCount, lostCount);
        country.military.inventory[unitId] = Math.max(0, currentCount - actualDeduction);

        const unitData = window.MilitaryData ? window.MilitaryData.getUnitById(unitId) : null;
        totalLostUnits += actualDeduction;
        if (unitData) {
          totalLostCrew += (Number(unitData.crew) || 0) * actualDeduction;
        }
      }
    });

    // تقليص عدد السكان بالجنود الذين سقطوا في المعركة وتحديث بيانات الجيش والدولة بالكامل
    if (totalLostCrew > 0) {
      country.population = Math.max(0, (Number(country.population) || 0) - totalLostCrew);
    }

    if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
      window.MilitaryEngine.syncCountryWithMilitary(country);
    } else if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(country);
    }

    return {
      totalLostUnits,
      totalLostCrew,
      remainingUnits: Number(country.military?.totalUnits || 0),
      remainingPower: Number(country.military?.totalPower || 0)
    };
  }
}

window.WarEngine = WarEngine;
