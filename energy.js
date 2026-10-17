/**
 * Energy Engine - عصر الهيمنة
 * محرك الطاقة ذو المستويين للنفط والغاز والمخزون الاستراتيجي
 * الإصدار v3.8: توحيد تسعير الطاقة مع معادلة (تكلفة المنشأة ÷ الإنتاج ÷ المخزون الفائض)
 */

class EnergyEngine {
  // الحسابات الشاملة لمنظومة البترول والغاز وفق جداول العرض والطلب الدقيقة
  static refreshEnergyStatus(country) {
    if (!country.energy) this.initCountryEnergy(country);

    const en = country.energy;
    const b = country.buildings || {};
    const getCount = (id) => Number(b[id] || 0);

    // ==========================================
    // 🛢️ أولاً: منظومة البترول والوقود (مستويان)
    // ==========================================

    // المنشآت
    en.oilWells = getCount("oil_well");
    en.oilFields = getCount("oil_field");
    en.fuelStations = getCount("fuel_station");

    // المستوى 1: بترول خام بالبرميل
    // إضافة: بئر نفط (+10)، حقل نفط (+100)، بترول مستورد
    en.oilProduced = (en.oilWells * 10) + (en.oilFields * 100);
    en.totalOil = en.oilProduced + Number(en.oilImported || 0);

    // خصم: محطة وقود (-1 برميل لتكريره)
    en.oilConsumed = en.fuelStations * 1;
    en.netOilBalance = en.totalOil - en.oilConsumed;

    // المستوى 2: وقود مكرر بالنقاط / اللترات
    // إضافة: محطة وقود (+10 نقاط وقود)
    en.fuelProduced = en.fuelStations * 10;

    // خصم: استهلاك وسائل النقل والمصانع
    let civilianFuelDemand = (
      (getCount("cargo_carrier") * 1) +
      (getCount("cargo_ship_large") * 2) +
      (getCount("factory") * 1) +
      (getCount("factory_large") * 2) +
      (getCount("industrial_authority") * 5) +
      (getCount("plane_50") * 1) +
      (getCount("plane_100") * 1) +
      (getCount("plane_200") * 1) +
      (getCount("plane_400") * 1) +
      (getCount("train_cart_20") * 1) +
      (getCount("train_cart_40") * 1) +
      (getCount("train_cart_100") * 1) +
      (getCount("train_cart_200") * 1)
    );

    // استهلاك الوقود العسكري: 1 لتر وقود عسكري = 1 نقطة وقود مخصومة
    let militaryFuelDemand = 0;
    if (country.military) {
      militaryFuelDemand = Number(country.military.totalFuelConsumption || country.military.fuelDemand || 0);
    }

    en.fuelDemand = civilianFuelDemand + militaryFuelDemand;
    en.fuelAmount = en.fuelProduced; // كمية الوقود المتاحة من المحطات
    en.netFuelBalance = en.fuelProduced - en.fuelDemand;

    // ==========================================
    // 🔥 ثانياً: منظومة الغاز والأسطوانات (مستويان)
    // ==========================================

    // المنشآت
    en.gasWells = getCount("gas_well");
    en.gasShops = getCount("gas_station_shop");

    // المستوى 1: غاز خام بالخزان / م³
    // إضافة: بئر غاز (+10 بالخزان)، غاز مستورد
    en.gasRaw = en.gasWells * 10;
    en.totalGas = en.gasRaw + Number(en.gasImported || 0);

    // خصم: محل غاز (-1 لتعبئته)
    en.gasRawConsumed = en.gasShops * 1;
    en.netGasBalance = en.totalGas - en.gasRawConsumed;

    // المستوى 2: أسطوانات الغاز
    // إضافة: محل غاز (+50 أسطوانة)
    en.gasCylinders = en.gasShops * 50;

    // خصم السكن:
    let resGasDemand = (
      (getCount("house") * 1) +
      (getCount("house_large") * 1) +
      (getCount("palace") * 2) +
      (getCount("apartments") * 10) +
      (getCount("hotel") * 20) +
      (getCount("residential_towers") * 50) +
      (getCount("skyscrapers") * 100)
    );

    // خصم المنشآت التجارية (مجموع المنشآت التجارية قسمة 4):
    let commercialBldgsCount = (
      getCount("shop") +
      getCount("shop_large") +
      getCount("showroom") +
      getCount("markets") +
      getCount("mall")
    );
    let commGasDemand = Math.floor(commercialBldgsCount / 4);

    // خصم الصناعة:
    let indGasDemand = (
      (getCount("handicrafts") * 1) +
      (getCount("workshop") * 1) +
      (getCount("factory") * 10) +
      (getCount("factory_large") * 20) +
      (getCount("industrial_authority") * 50)
    );

    // خصم المطارات والطائرات:
    let aviationGasDemand = (
      (getCount("regional_airport") * 5) +
      (getCount("intl_airport") * 10) +
      (getCount("plane_50") * 1) +
      (getCount("plane_100") * 1) +
      (getCount("plane_200") * 1) +
      (getCount("plane_400") * 1)
    );

    en.cylindersDemand = resGasDemand + commGasDemand + indGasDemand + aviationGasDemand;
    en.netCylindersBalance = en.gasCylinders - en.cylindersDemand;

    // ==========================================
    // 📈 ثالثاً: الأسعار الديناميكية ومؤشر الطاقة
    // ==========================================
    en.oilPrice = this.calculateOilPrice(country);
    en.gasPrice = this.calculateGasPrice(country);
    en.energyIndex = this.calculateEnergyIndex(country);
  }

  /**
   * احتساب سعر برميل البترول وفق المنظومة الجديدة:
   * تكلفة بئر النفط ($4000) ÷ إنتاجه (10 براميل) = $400 تكلفة البرميل المعيارية.
   * السعر المحلي = التكلفة المعيارية ÷ الفائض أو المخزون المتاح للدولة.
   */
  static calculateOilPrice(country) {
    const en = country.energy;

    const hasOilActivity = (
      en.oilWells > 0 ||
      en.oilFields > 0 ||
      en.fuelStations > 0 ||
      Number(en.oilImported || 0) > 0 ||
      Number(en.oilStock || 0) > 0
    );

    // شرط السعر الصفري عند انعدام أي نشاط نفطي في الدولة
    if (!hasOilActivity) return 0;

    let bPrice = 4000;
    let bOutput = 10;

    if (window.BuildingsEngine && typeof window.BuildingsEngine.getResource === "function") {
      const res = window.BuildingsEngine.getResource("oil_well");
      if (res) {
        if (typeof res.price === "number" && res.price > 0) bPrice = res.price;
        if (typeof res.satisfiesBase === "number" && res.satisfiesBase > 0) bOutput = res.satisfiesBase;
      }
    }

    const baseUnitCost = bPrice / Math.max(1, bOutput);
    const availableSupply = Math.max(1, en.netOilBalance > 0 ? en.netOilBalance : (Number(en.oilStock || 0) || 1));
    const localPrice = baseUnitCost / availableSupply;

    return Math.max(0.01, Math.round(localPrice * 100) / 100);
  }

  /**
   * احتساب سعر أسطوانة الغاز وفق المنظومة الجديدة:
   * تكلفة محل الغاز ($400) ÷ إنتاجه (40 أسطوانة) = $10 تكلفة الأسطوانة المعيارية.
   * السعر المحلي = التكلفة المعيارية ÷ الفائض أو المخزون المتاح للدولة.
   */
  static calculateGasPrice(country) {
    const en = country.energy;

    const hasGasActivity = (
      en.gasWells > 0 ||
      en.gasShops > 0 ||
      Number(en.gasImported || 0) > 0 ||
      Number(en.gasStock || 0) > 0
    );

    // شرط السعر الصفري عند انعدام أي نشاط غازي في الدولة
    if (!hasGasActivity) return 0;

    let bPrice = 400;
    let bOutput = 40;

    if (window.BuildingsEngine && typeof window.BuildingsEngine.getResource === "function") {
      const res = window.BuildingsEngine.getResource("gas_station_shop");
      if (res) {
        if (typeof res.price === "number" && res.price > 0) bPrice = res.price;
        if (res.sectorEffects && typeof res.sectorEffects.gas === "number" && res.sectorEffects.gas > 0) {
          bOutput = res.sectorEffects.gas;
        }
      }
    }

    const baseUnitCost = bPrice / Math.max(1, bOutput);
    const availableSupply = Math.max(1, en.netGasBalance > 0 ? en.netGasBalance : (Number(en.gasStock || 0) || 1));
    const localPrice = baseUnitCost / availableSupply;

    return Math.max(0.01, Math.round(localPrice * 100) / 100);
  }

  // احتساب مؤشر الطاقة العام بناءً على صوافي الإنتاج والمخزون
  static calculateEnergyIndex(country) {
    const en = country.energy;
    let score = (
      (Number(en.oilStock || 0) * 0.1) +
      (Number(en.gasStock || 0) * 0.1) +
      (en.netOilBalance * 2) +
      (en.netFuelBalance * 1.5) +
      (en.netGasBalance * 2) +
      (en.netCylindersBalance * 0.5)
    );
    return Math.round(score);
  }

  // ترحيل الفائض السنوي للمخزون الاستراتيجي وتغطية العجز
  static advanceEnergyYear(country) {
    if (!country.energy) this.initCountryEnergy(country);
    const en = country.energy;

    // 1. ترحيل رصيد النفط الخام
    if (en.netOilBalance > 0) {
      en.oilStock += en.netOilBalance;
    } else if (en.netOilBalance < 0) {
      const deficit = Math.abs(en.netOilBalance);
      if (en.oilStock >= deficit) {
        en.oilStock -= deficit;
      } else {
        en.oilStock = 0;
      }
    }

    // 2. ترحيل رصيد الغاز الخام
    if (en.netGasBalance > 0) {
      en.gasStock += Math.round(en.netGasBalance);
    } else if (en.netGasBalance < 0) {
      const deficit = Math.abs(en.netGasBalance);
      if (en.gasStock >= deficit) {
        en.gasStock -= deficit;
      } else {
        en.gasStock = 0;
      }
    }

    this.refreshEnergyStatus(country);
  }

  static processYearEnd(country) {
    this.advanceEnergyYear(country);
  }

  // تهيئة كائن الطاقة الأولي للدولة
  static initCountryEnergy(country) {
    country.energy = {
      // منشآت النفط والوقود
      oilWells: 0,
      oilFields: 0,
      fuelStations: 0,

      // كميات البترول والوقود
      oilProduced: 0,
      oilImported: 0,
      totalOil: 0,
      oilConsumed: 0,
      netOilBalance: 0,
      oilStock: 0,
      oilPrice: 0,

      fuelProduced: 0,
      fuelDemand: 0,
      fuelAmount: 0,
      netFuelBalance: 0,

      // منشآت الغاز
      gasWells: 0,
      gasShops: 0,

      // كميات الغاز والأسطوانات
      gasRaw: 0,
      gasImported: 0,
      totalGas: 0,
      gasRawConsumed: 0,
      netGasBalance: 0,
      gasStock: 0,
      gasPrice: 0,

      gasCylinders: 0,
      cylindersDemand: 0,
      netCylindersBalance: 0,

      // المؤشر العام
      energyIndex: 0
    };
  }
}

window.EnergyEngine = EnergyEngine;