class MilitaryEngine {
  static createDefaultMilitary() {
    const inventory = {};
    window.MilitaryData.UNITS.forEach(u => {
      inventory[u.id] = 0;
    });

    return {
      inventory: inventory,
      totalPower: 0,
      totalCrew: 0,
      totalFuelConsumption: 0,
      ammoProduction: 0,
      ammoDemand: 0,
      netAmmoBalance: 0
    };
  }

  // شراء وتجنيد سلاح / تشييد منشأة عسكرية
  static purchaseUnit(country, unitId, count = 1) {
    const unit = window.MilitaryData.getUnitById(unitId);
    if (!unit) return { success: false, msg: "السلاح غير موجود!" };

    const totalPrice = unit.price * count;
    const crewNeeded = (unit.crew || 0) * count;

    // 1. فحص توفر السيولة في التحصيل المتاح
    const availableFunds = Number(country.disposableRevenue) || 0;
    if (availableFunds < totalPrice) {
      return { success: false, msg: `التحصيل المتوفر ($${availableFunds}) لا يكفي لشراء ${unit.name} (المطلوب: $${totalPrice})!` };
    }

    // 2. فحص توفر السكان العاطلين المتاحين للتجنيد
    const availableCitizens = (country.unemployed !== undefined && country.unemployed !== null)
      ? Number(country.unemployed)
      : Math.max(0, Number(country.population) - Number(country.employed || 0));

    if (crewNeeded > 0 && availableCitizens < crewNeeded) {
      return { success: false, msg: `عدد المواطنين المتاحين للتجنيد غير كافٍ! يلزم ${crewNeeded} أفراد، والمتوفر حالياً: ${availableCitizens}.` };
    }

    // تنفيذ الخصم المالي
    country.disposableRevenue -= totalPrice;

    // تحويل الأفراد من العاطلين إلى العاملين بالجيش دون تخفيض سعة البيوت الأصلية
    if (crewNeeded > 0) {
      country.employed = (Number(country.employed) || 0) + crewNeeded;
      country.unemployed = Math.max(0, availableCitizens - crewNeeded);
      country.unemploymentRate = country.population > 0 ? Math.round((country.unemployed / country.population) * 100) : 0;
    }

    // إضافة الوحدة للمخزون العسكري
    country.military.inventory[unitId] = (country.military.inventory[unitId] || 0) + count;

    // المنشآت العسكرية تضيف مساحة ونقاط أمان
    country.area += count;
    country.sectors.security = (country.sectors.security || 0) + count;

    this.refreshMilitaryStats(country);
    return { success: true, msg: `تم شراء ${count} من [${unit.name}] بنجاح!` };
  }

  // احتساب إجمالي القوة، الأفراد، الوقود، والذخيرة
  static refreshMilitaryStats(country) {
    if (!country.military) country.military = this.createDefaultMilitary();
    const mil = country.military;

    let powerSum = 0;
    let crewSum = 0;
    let fuelSum = 0;
    let ammoNeededSum = 0;
    let ammoProducedSum = 0;

    window.MilitaryData.UNITS.forEach(u => {
      const count = Number(mil.inventory[u.id] || 0);
      if (count > 0) {
        powerSum += (u.power || 0) * count;
        crewSum += (u.crew || 0) * count;
        fuelSum += (u.fuel || 0) * count;

        if (u.id === "ammo_factory") {
          ammoProducedSum += 100 * count;
        } else {
          ammoNeededSum += (u.ammo || 0) * count;
        }
      }
    });

    mil.totalPower = Number(powerSum.toFixed(1));
    mil.totalCrew = crewSum;
    mil.totalFuelConsumption = fuelSum;
    mil.ammoDemand = ammoNeededSum;
    mil.ammoProduction = ammoProducedSum;
    mil.netAmmoBalance = ammoProducedSum - ammoNeededSum;
  }
}

window.MilitaryEngine = MilitaryEngine;