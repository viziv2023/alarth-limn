/**
 * Clean Energy Engine - عصر الهيمنة
 * محرك منظومة الطاقة النظيفة المستقل: الطاقة الشمسية، طاقة الرياح، والمفاعلات النووية السلمية
 */

class CleanEnergyEngine {
  static RESOURCES = [
    {
      id: "solar_farm",
      name: "مزرعة طاقة شمسية",
      icon: "☀️",
      stage: "clean_energy",
      category: "clean_energy",
      price: 100,
      revenue: -5, // تكلفة التشغيل السنوية
      populationType: "workforce",
      populationValue: 1, // يحتاج إلى عامل 1
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 12,
      satisfiesUnit: "نقطة كهرباء",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: "solar_farm",
      limitType: "area_equal",
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { electricity: 12 },
      desc: "ألواح طاقة شمسية تنتج 12 كهرباء بتكلفة تشغيل -$5 وعامل 1، حدها الأقصى مساحة الدولة."
    },
    {
      id: "wind_station",
      name: "محطة طاقة رياح",
      icon: "🌀",
      stage: "clean_energy",
      category: "clean_energy",
      price: 500,
      revenue: -10, // تكلفة التشغيل السنوية
      populationType: "workforce",
      populationValue: 2, // يحتاج إلى 2 عمال
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 20,
      satisfiesUnit: "نقطة كهرباء",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: "wind_station",
      limitType: "area_half",
      prerequisites: ["workshop"],
      prerequisiteMode: "AND",
      prerequisiteText: "ورشة عمل",
      sectorEffects: { electricity: 20 },
      desc: "محطة توربينات رياح تنتج 20 كهرباء بتكلفة تشغيل -$10 وعاملين، حدها الأقصى نصف مساحة الدولة."
    },
    {
      id: "nuclear_reactor",
      name: "مفاعل نووي سلمي",
      icon: "☢️",
      stage: "clean_energy",
      category: "clean_energy",
      price: 20000,
      revenue: -1000, // تكلفة التشغيل السنوية
      populationType: "workforce",
      populationValue: 24, // يحتاج إلى 24 عاملاً
      electricityNeed: 0,
      waterNeed: -24, // يستهلك 24 نقطة ماء
      satisfiesBase: 1500,
      satisfiesUnit: "نقطة كهرباء",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: "nuclear_reactor",
      limitType: "one_per_governorate",
      prerequisites: ["factory", "oil_well", "water_desalination"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع - بئر نفط - محطة تحلية مياه",
      sectorEffects: { electricity: 1500, water: -24 },
      desc: "مفاعل نووي سلمي عملاق يولد 1500 كهرباء ويستهلك 24 ماء و24 عاملاً وتكلفة -$1,000، حده مفاعل واحد لكل أمانة."
    }
  ];

  // حساب الحدود القصوى المسموح بها للبناء
  static getSolarFarmMaxCap(country) {
    return Number(country?.area || 0);
  }

  static getWindStationMaxCap(country) {
    return Math.floor(Number(country?.area || 0) / 2);
  }

  static getNuclearReactorMaxCap(country) {
    return Number(country?.buildings?.governorate || 0);
  }

  // فحص قيود البناء وحدود المساحة والمنشآت التمكينية
  static checkCleanEnergyLimits(country, resourceId) {
    const b = country.buildings || {};
    const count = Number(b[resourceId] || 0);

    if (resourceId === "solar_farm") {
      const max = this.getSolarFarmMaxCap(country);
      if (count >= max) {
        return {
          allowed: false,
          reason: `تجاوزت الحد الأقصى للألواح الشمسية! أقصى حد للبناء هو مساحة الدولة (${max} ألواح).`
        };
      }
    } else if (resourceId === "wind_station") {
      const max = this.getWindStationMaxCap(country);
      if (count >= max) {
        return {
          allowed: false,
          reason: `تجاوزت الحد الأقصى لمحطات الرياح! أقصى حد هو نصف مساحة الدولة (${max} محطة).`
        };
      }
    } else if (resourceId === "nuclear_reactor") {
      const max = this.getNuclearReactorMaxCap(country);
      if (count >= max) {
        return {
          allowed: false,
          reason: `يسمح ببناء مفاعل نووي واحد فقط لكل أمانة قائمة! عدد الأمانات الحالية: (${max}). أنشئ أمانة جديدة أولاً.`
        };
      }
    }

    return { allowed: true };
  }

  // احتساب إجمالي إنتاج الكهرباء من الطاقة النظيفة
  static getTotalCleanElectricity(country) {
    const b = country?.buildings || {};
    const solar = Number(b.solar_farm || 0) * 12;
    const wind = Number(b.wind_station || 0) * 20;
    const nuclear = Number(b.nuclear_reactor || 0) * 1500;
    return solar + wind + nuclear;
  }

  // احتساب إجمالي تكاليف التشغيل السنوية للطاقة النظيفة
  static getTotalOperatingCost(country) {
    const b = country?.buildings || {};
    const solar = Number(b.solar_farm || 0) * 5;
    const wind = Number(b.wind_station || 0) * 10;
    const nuclear = Number(b.nuclear_reactor || 0) * 1000;
    return solar + wind + nuclear;
  }
}

window.CleanEnergyEngine = CleanEnergyEngine;