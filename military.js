class MilitaryEngine {
  static createDefaultMilitary() {
    const inventory = {};
    if (window.MilitaryData && Array.isArray(window.MilitaryData.UNITS)) {
      window.MilitaryData.UNITS.forEach(u => {
        inventory[u.id] = 0;
      });
    }

    return {
      inventory: inventory,
      totalPower: 0,
      totalCrew: 0,
      totalUnits: 0,
      branchCounts: { ground: 0, naval: 0, air: 0, defense: 0 },
      branchPower: { ground: 0, naval: 0, air: 0, defense: 0 },
      totalFuelConsumption: 0,
      ammoProduction: 0,
      ammoDemand: 0,
      netAmmoBalance: 0
    };
  }

  // حساب عدد العاملين في المنشآت المدنية فقط (لفصلهم بوضوح عن جنود الجيش)
  static getCivilianEmployedCount(country) {
    if (!country || !country.buildings) return 0;
    let civEmployed = 0;
    if (window.BuildingsEngine && Array.isArray(window.BuildingsEngine.RESOURCES_LIST)) {
      window.BuildingsEngine.RESOURCES_LIST.forEach(res => {
        if (res.populationType === "workforce" && res.populationValue > 0) {
          const cnt = Number(country.buildings[res.id] || 0);
          if (cnt > 0) {
            civEmployed += cnt * Number(res.populationValue);
          }
        }
      });
    }
    return civEmployed;
  }

  // شراء وتجنيد سلاح / تشييد منشأة عسكرية
  static purchaseUnit(country, unitId, count = 1) {
    if (!country) return { success: false, msg: "لم يتم تحديد الدولة!" };
    count = Math.max(1, Math.floor(Number(count) || 1));

    const unit = window.MilitaryData ? window.MilitaryData.getUnitById(unitId) : null;
    if (!unit) return { success: false, msg: "السلاح غير موجود في قاعدة البيانات!" };

    this.refreshMilitaryStats(country);

    const totalPrice = Number(unit.price || 0) * count;
    const crewNeeded = Number(unit.crew || 0) * count;

    // 1. فحص توفر السيولة في التحصيل المتاح
    const availableFunds = Number(country.disposableRevenue) || 0;
    if (availableFunds < totalPrice) {
      return {
        success: false,
        msg: `السيولة المتاحة ($${availableFunds.toLocaleString()}) لا تكفي لشراء ${count}× ${unit.name} (المطلوب: $${totalPrice.toLocaleString()})!`
      };
    }

    // 2. فحص توفر السكان العاطلين المتاحين للتجنيد
    const pop = Number(country.population) || 0;
    const emp = Number(country.employed) || 0;
    const availableCitizens = Math.max(0, pop - emp);
    country.unemployed = availableCitizens;

    if (crewNeeded > 0 && availableCitizens < crewNeeded) {
      return {
        success: false,
        msg: `عدد المواطنين المتاحين للتجنيد غير كافٍ! يلزم ${crewNeeded} فرد لتجنيد ${count}× ${unit.name}، والمتوفر حالياً: ${availableCitizens} فرد (ابْنِ مساكن 🏠 لزيادة السكان).`
      };
    }

    // تنفيذ الخصم المالي
    country.disposableRevenue = Math.max(0, availableFunds - totalPrice);

    // إضافة الوحدة للمخزون العسكري
    if (!country.military) country.military = this.createDefaultMilitary();
    if (!country.military.inventory) country.military.inventory = {};
    country.military.inventory[unitId] = (Number(country.military.inventory[unitId]) || 0) + count;

    // تحديث شامل وموحد لبيانات الجيش والدولة والقطاعات والطاقة والمؤشرات
    this.syncCountryWithMilitary(country);

    // مزامنة فورية عبر الروم السحابي إن وجد
    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      window.NetworkEngine.syncCountryChanges(country);
    }

    return {
      success: true,
      msg: `تم تجنيد وتصنيع ${count}× [${unit.name}] بنجاح! (القوة المضافة: +${((unit.power || 0) * count).toLocaleString()})`
    };
  }

  // تسريح / بيع وحدة عسكرية واسترداد تكلفتها وإعادة طاقمها للسكان المتاحين
  static demobilizeUnit(country, unitId, count = 1) {
    if (!country || !country.military || !country.military.inventory) {
      return { success: false, msg: "لا توجد وحدات لتسريحها!" };
    }
    count = Math.max(1, Math.floor(Number(count) || 1));

    const unit = window.MilitaryData ? window.MilitaryData.getUnitById(unitId) : null;
    if (!unit) return { success: false, msg: "السلاح غير موجود!" };

    const currentOwned = Number(country.military.inventory[unitId] || 0);
    if (currentOwned <= 0) {
      return { success: false, msg: `لا تمتلك أي وحدات من [${unit.name}] لتسريحها!` };
    }

    const actualRemove = Math.min(currentOwned, count);
    const refund = Number(unit.price || 0) * actualRemove;

    country.military.inventory[unitId] = currentOwned - actualRemove;
    country.disposableRevenue = (Number(country.disposableRevenue) || 0) + refund;

    this.syncCountryWithMilitary(country);

    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      window.NetworkEngine.syncCountryChanges(country);
    }

    return {
      success: true,
      msg: `تم تسريح ${actualRemove}× [${unit.name}] واسترداد $${refund.toLocaleString()} وإعادة الأفراد للقوى المتاحة.`
    };
  }

  // توحيد ومزامنة كافة بيانات الدولة مع جيشها (المصدر الموحد للبيانات)
  static syncCountryWithMilitary(country) {
    if (!country) return;

    this.refreshMilitaryStats(country);

    // إعادة احتساب القطاعات (بما فيها المساحة ونقاط الأمن المضافة من الجيش)
    if (window.SectorsEngine && typeof window.SectorsEngine.recalculateCountrySectors === "function") {
      window.SectorsEngine.recalculateCountrySectors(country, window.currentWorld);
    }

    // تحديث الطاقة والوقود (لأن الوحدات العسكرية تستهلك الوقود ومصانع الأسلحة تنتجه)
    if (window.EnergyEngine && typeof window.EnergyEngine.refreshEnergyStatus === "function") {
      window.EnergyEngine.refreshEnergyStatus(country);
    }

    // تحديث المؤشر العام، البطالة، وقيمة العملة
    if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
      window.IndicatorsEngine.refreshCountryIndicators(country);
    }
  }

  // احتساب إجمالي القوة، الأفراد، القطع، الوقود، والذخيرة وربطها بخصائص الدولة مباشرة
  static refreshMilitaryStats(country) {
    if (!country) return;
    if (!country.military) country.military = this.createDefaultMilitary();
    if (!country.military.inventory) country.military.inventory = {};

    // التأكد من تسجيل أي أسلحة سيادية مخصصة خاصة بهذه الدولة في قاعدة البيانات
    if (Array.isArray(country.customUnits) && window.WeaponForge && typeof window.WeaponForge.registerUnitToGame === "function") {
      country.customUnits.forEach(cu => {
        if (cu && cu.id) window.WeaponForge.registerUnitToGame(cu);
      });
    }

    const mil = country.military;
    const inv = mil.inventory;

    let powerSum = 0;
    let crewSum = 0;
    let unitsSum = 0;
    let fuelSum = 0;
    let ammoNeededSum = 0;
    let ammoProducedSum = 0;

    const branchCounts = { ground: 0, naval: 0, air: 0, defense: 0 };
    const branchPower = { ground: 0, naval: 0, air: 0, defense: 0 };

    const visitedIds = new Set();

    const processUnitEntry = (u, count) => {
      if (!u || count <= 0) return;
      const uPower = (Number(u.power) || 0) * count;
      const uCrew = (Number(u.crew) || 0) * count;
      const uFuel = (Number(u.fuel) || 0) * count;

      powerSum += uPower;
      crewSum += uCrew;
      unitsSum += count;
      fuelSum += uFuel;

      const br = u.branch || "ground";
      if (branchCounts[br] !== undefined) {
        branchCounts[br] += count;
        branchPower[br] = Number((branchPower[br] + uPower).toFixed(1));
      } else {
        branchCounts.ground += count;
        branchPower.ground = Number((branchPower.ground + uPower).toFixed(1));
      }

      if (u.id === "ammo_factory" || Number(u.ammo) < 0) {
        ammoProducedSum += Math.abs(Number(u.ammo) || 100) * count;
      } else {
        ammoNeededSum += (Number(u.ammo) || 0) * count;
      }
    };

    if (window.MilitaryData && Array.isArray(window.MilitaryData.UNITS)) {
      window.MilitaryData.UNITS.forEach(u => {
        visitedIds.add(u.id);
        const count = Number(inv[u.id] || 0);
        if (count > 0) {
          processUnitEntry(u, count);
        }
      });
    }

    // فحص أي وحدات مخصصة موجودة في المخزون ولم تكن ضمن القائمة الافتراضية
    Object.keys(inv).forEach(uid => {
      if (visitedIds.has(uid)) return;
      const count = Number(inv[uid] || 0);
      if (count <= 0) return;
      const customU = (Array.isArray(country.customUnits) ? country.customUnits.find(x => x.id === uid) : null) ||
        (window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null);
      if (customU) {
        processUnitEntry(customU, count);
      }
    });

    mil.totalPower = Number(powerSum.toFixed(1));
    mil.totalCrew = crewSum;
    mil.totalUnits = unitsSum;
    mil.branchCounts = branchCounts;
    mil.branchPower = branchPower;
    mil.totalFuelConsumption = fuelSum;
    mil.ammoDemand = ammoNeededSum;
    mil.ammoProduction = ammoProducedSum;
    mil.netAmmoBalance = ammoProducedSum - ammoNeededSum;

    // ربط مباشر بخصائص الدولة لضمان عدم وجود أي ضبابية أو تضارب في أي شاشة
    country.militaryPower = mil.totalPower;
    country.militaryCrew = mil.totalCrew;
    country.militaryUnitsCount = mil.totalUnits;

    // توحيد حساب العاملين (العاملون بالمنشآت المدنية + أفراد الجيش)
    if (country.buildings && Object.keys(country.buildings).length > 0) {
      const civWorkers = this.getCivilianEmployedCount(country);
      country.civilianEmployed = civWorkers;
      country.employed = civWorkers + crewSum;
    } else {
      country.employed = Math.max(crewSum, Number(country.employed) || 0);
    }

    const totalPop = Number(country.population) || 0;
    country.unemployed = Math.max(0, totalPop - country.employed);
    country.unemploymentRate = totalPop > 0 ? Number(((country.unemployed / totalPop) * 100).toFixed(1)) : 0;
  }
}

window.MilitaryEngine = MilitaryEngine;
