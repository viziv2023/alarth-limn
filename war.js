/**
 * War Engine - عصر الهيمنة
 * محرك الحروب الموحد والتحالفات الدولية ومصفوفة حسم ما بعد المعركة
 * الإصدار v3.9: دعم التحالفات متعددة الأطراف، التسوية التناسبية، وحماية السيادة
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
        } else if (typeof row === "string" && row.startsWith("#") && row !== "#ffffff" && row !== "#000000") {
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
    if (!country || !country.military) return 0;
    const inv = country.military.inventory || country.military.units || {};
    let total = 0;
    Object.keys(inv).forEach(uid => {
      total += Number(inv[uid] || 0);
    });
    return total;
  }

  /**
   * مصفوفة حسم ما بعد المعركة للتحالفات الفائزة
   * تدعم دولة بمفردها أو أحلافاً عسكرية مشتركة
   */
  static resolveCoalitionPostBattleVictory(winningCoalition, losingCoalition, world, atkMobStatus, defMobStatus) {
    world = world || window.currentWorld;
    const yr = world?.year || 1;

    const leadWinner = winningCoalition[0].country;
    const leadLoser = losingCoalition[0].country;

    // حساب إجمالي القوة المساهمة في الحلف المنتصر لتوزيع الغنائم بالتناسب
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

        // تسجيل عقد الدية في سجلات العالم
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

      // توزيع الدفعة الأولى على المنتصرين حسب مساهمتهم
      winningCoalition.forEach(winnerMember => {
        const share = Math.floor(totalFirstCut * (winnerMember.powerContribution / totalWinningPower));
        winnerMember.country.disposableRevenue = (Number(winnerMember.country.disposableRevenue) || 0) + share;
      });

      const logText = `حسم عسكري كامل: انتصار تحالف [${leadWinner.name}] على تحالف [${leadLoser.name}]. فُرضت دية خمسية (20% سنوياً) بقيمة أولية $${totalFirstCut.toLocaleString()} وزعت تناسبياً بين الحلفاء.`;
      if (world && typeof world.addHistoryEvent === "function") world.addHistoryEvent("political", logText, yr);

      return {
        type: "tribute",
        title: "📜 إبرام عقد الدية الخمسية للتحالف المنتصر (20% سنوياً)",
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

      // توزيع المدخرات المصادرة على بنوك دول الحلف المنتصر
      winningCoalition.forEach(winnerMember => {
        const ratio = winnerMember.powerContribution / totalWinningPower;
        const myShare = Math.floor(totalLoot * ratio);
        winnerMember.country.bank = (Number(winnerMember.country.bank) || 0) + myShare;
        winnerMember.country.generalIndex = (Number(winnerMember.country.generalIndex) || 0) + 10;
      });

      let reasonTitle = "استسلام عسكري وتجريد كامل للمدخرات";
      if (defMobStatus === "NO_ARMY") reasonTitle = "استسلام تلقائي لانعدام المقاومة والجيش المدافع";

      const logText = `${reasonTitle}: خضع تحالف [${leadLoser.name}] للاستسلام التام لصالح تحالف [${leadWinner.name}]. صودرت كافة المدخرات (المحلي: $${totalSeizedLocal.toLocaleString()} | الدولي: $${totalSeizedWorld.toLocaleString()}) بإجمالي $${totalLoot.toLocaleString()} وقُسّمت بين الحلفاء.`;
      if (world && typeof world.addHistoryEvent === "function") world.addHistoryEvent("political", logText, yr);

      return {
        type: "surrender_banks",
        title: "🏳️ استسلام تام ومصادرة مدخرات البنوك",
        details: logText,
        color: "#34d399",
        seizedAmount: totalLoot
      };
    }

    // 3. حالة المناوشة الجزئية (بعض ضد بعض)
    const skirmishLog = `مناوشة عسكرية محدودة: انتهى الاشتباك بين تحالف [${leadWinner.name}] وتحالف [${leadLoser.name}] بانسحاب تكتيكي دون فرض استسلام أو تعويضات مالية، واقتصرت النتيجة على خسائر الميدان.`;
    if (world && typeof world.addHistoryEvent === "function") world.addHistoryEvent("political", skirmishLog, yr);

    return {
      type: "skirmish_draw",
      title: "⚔️ انتهاء المناوشة بدون تعويضات مالية",
      details: skirmishLog,
      color: "#94a3b8"
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

        // إذا كان التحالف مستهدفاً
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
          `سداد الدية السنوية: دفعت دولة [${defender.name}] قسط الدية البالغ $${annualCut.toLocaleString()} لصالح [${trib.attackerName}] (المتبقي: ${trib.yearsRemaining - 1} سنوات).`,
          world.year
        );
      }

      trib.yearsRemaining -= 1;
      return trib.yearsRemaining > 0;
    });
  }

  static applyBattleLosses(country, lossesMap) {
    if (!country || !country.military || !country.military.inventory) return { totalLostUnits: 0, totalLostCrew: 0 };

    let totalLostUnits = 0;
    let totalLostCrew = 0;

    Object.keys(lossesMap || {}).forEach(unitId => {
      const lostCount = lossesMap[unitId] || 0;
      if (lostCount > 0) {
        const currentCount = country.military.inventory[unitId] || 0;
        const actualDeduction = Math.min(currentCount, lostCount);
        country.military.inventory[unitId] = Math.max(0, currentCount - actualDeduction);

        const unitData = window.MilitaryData ? window.MilitaryData.getUnitById(unitId) : null;
        if (unitData) {
          totalLostUnits += actualDeduction;
          totalLostCrew += (unitData.crew || 0) * actualDeduction;
        }
      }
    });

    if (totalLostCrew > 0) {
      country.employed = Math.max(0, (Number(country.employed) || 0) - totalLostCrew);
    }

    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(country);
    }

    return { totalLostUnits, totalLostCrew };
  }
}

window.WarEngine = WarEngine;