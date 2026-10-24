class SectorsEngine {
  static SECTORS_LIST = [
    { id: "commercial", name: "تجارياً", category: "اقتصاد وإنتاج", icon: "🏪", desc: "الأسواق والمحال التجارية" },
    { id: "education", name: "تعليمياً", category: "أمان وتنمية", icon: "🎓", desc: "المدارس والجامعات والتدريب" },
    { id: "agricultural", name: "زراعياً", category: "اقتصاد وإنتاج", icon: "🌾", desc: "المزارع والإنتاج الزراعي" },
    { id: "industrial", name: "صناعياً", category: "اقتصاد وإنتاج", icon: "🏭", desc: "المصانع والإنتاج الصناعي" },
    { id: "healthcare", name: "صحياً", category: "أمان وتنمية", icon: "🏥", desc: "المشافي والمراكز الطبية" },
    { id: "entertainment", name: "ترفيهياً", category: "أمان وتنمية", icon: "🎡", desc: "الحدائق والمنتزهات والترفيه" },
    { id: "navigation", name: "ملاحياً", category: "نقل ومنافذ", icon: "🧭", desc: "الملاحة وحركة الشحن" },
    { id: "security", name: "أمنياً", category: "أمان وتنمية", icon: "🛡️", desc: "الشرطة والأمن والجيش وحماية الدولة" },
    { id: "civil", name: "مدنياً", category: "شؤون مدنية", icon: "🏛️", desc: "الدفاع المدني والتنظيم الحضري" },
    { id: "services", name: "خدمياً", category: "شؤون مدنية", icon: "🛠️", desc: "الخدمات البلدية واللوجستية" },
    { id: "ports", name: "موانئ", category: "نقل ومنافذ", icon: "⚓", desc: "أرصفة وموانئ الشحن البحري" },
    { id: "trains", name: "قطارات", category: "نقل ومنافذ", icon: "🚆", desc: "السكك الحديدية والقطارات" },
    { id: "airports", name: "مطارات", category: "نقل ومنافذ", icon: "✈️", desc: "المطارات وحركة الطيران" },
    { id: "electricity", name: "كهربائياً", category: "مرافق وطاقة", icon: "⚡", desc: "محطات وشبكات التوليد والطاقة النظيفة" },
    { id: "water", name: "مائياً", category: "مرافق وطاقة", icon: "💧", desc: "محطات وشبكات المياه والتبريد" },
    { id: "gas", name: "أسطوانة غاز", category: "مرافق وطاقة", icon: "🔥", desc: "إمدادات وتوزيع الغاز" }
  ];

  static createDefaultSectors() {
    const data = {};
    this.SECTORS_LIST.forEach(s => {
      data[s.id] = 0;
    });
    return data;
  }

  static recalculateCountrySectors(country, world = null) {
    if (!country) return;
    if (!country.sectors) country.sectors = this.createDefaultSectors();

    const b = country.buildings || {};
    const getCount = (id) => Number(b[id] || 0);

    // حساب إجمالي الوحدات العسكرية لربطها بالمساحة والقطاع الأمني للدولة
    let militaryUnitsCount = 0;
    if (country.military && country.military.inventory) {
      Object.values(country.military.inventory).forEach(cnt => {
        militaryUnitsCount += Math.max(0, Number(cnt || 0));
      });
    }

    // 1. إجمالي عدد منشآت السكن
    const housingCount = (
      getCount("house") +
      getCount("house_large") +
      getCount("palace") +
      getCount("apartments") +
      getCount("hotel") +
      getCount("residential_towers") +
      getCount("skyscrapers")
    );

    // 2. إجمالي مساحة الدولة (مجموع المنشآت المدنية عدا الطيور والحيوانات + الوحدات والمنشآت العسكرية)
    let civilianArea = 0;
    if (window.BuildingsEngine && Array.isArray(window.BuildingsEngine.RESOURCES_LIST)) {
      window.BuildingsEngine.RESOURCES_LIST.forEach(r => {
        if (r.id !== "bird" && r.id !== "animal") {
          civilianArea += getCount(r.id);
        }
      });
    } else {
      civilianArea = Object.keys(b).reduce((acc, key) => (key !== "bird" && key !== "animal") ? acc + Number(b[key] || 0) : acc, 0);
    }
    const totalArea = civilianArea + militaryUnitsCount;
    country.area = totalArea;

    const calculated = {};

    // 1) تجارياً
    calculated.commercial = (
      (getCount("shop") * 5) +
      (getCount("shop_large") * 15) +
      (getCount("showroom") * 30) +
      (getCount("markets") * 100) +
      (getCount("mall") * 200)
    ) - (
      (getCount("house") * 1) +
      (getCount("house_large") * 2) +
      (getCount("palace") * 4) +
      (getCount("apartments") * 8) +
      (getCount("hotel") * 20) +
      (getCount("residential_towers") * 40) +
      (getCount("skyscrapers") * 100)
    );

    // 2) تعليمياً
    calculated.education = (
      (getCount("classroom") * 10) +
      (getCount("school") * 40) +
      (getCount("educational_complex") * 100) +
      (getCount("university") * 500)
    ) - (
      (getCount("house") * 1) +
      (getCount("house_large") * 2) +
      (getCount("palace") * 4) +
      (getCount("apartments") * 8) +
      (getCount("hotel") * 20) +
      (getCount("residential_towers") * 40) +
      (getCount("skyscrapers") * 60)
    );

    // 3) زراعياً
    calculated.agricultural = (
      (getCount("farm") * 5) +
      (getCount("production_farm") * 40)
    ) - (
      (getCount("clinic") * 1) +
      (getCount("handicrafts") * 1) +
      (getCount("poultry_farm") * 1) +
      (getCount("livestock_farm") * 1) +
      (getCount("workshop") * 1) +
      (getCount("poultry_complex") * 1) +
      (getCount("livestock_complex") * 1) +
      (getCount("house") * 1) +
      (getCount("house_large") * 2) +
      (getCount("palace") * 4) +
      (getCount("apartments") * 8) +
      (getCount("hotel") * 20) +
      (getCount("residential_towers") * 40) +
      (getCount("skyscrapers") * 60)
    );

    // 4) صناعياً
    calculated.industrial = (
      (getCount("handicrafts") * 10) +
      (getCount("workshop") * 25) +
      (getCount("factory") * 100) +
      (getCount("factory_large") * 400) +
      (getCount("industrial_authority") * 1500)
    ) - (
      (getCount("showroom") * 1) +
      (getCount("poultry_complex") * 1) +
      (getCount("livestock_complex") * 1) +
      (getCount("markets") * 1) +
      (getCount("fuel_station") * 1) +
      (getCount("oil_well") * 1) +
      (getCount("police_station") * 1) +
      (getCount("mall") * 1) +
      (getCount("medical_city") * 1)
    );

    // 5) صحياً
    calculated.healthcare = (
      (getCount("clinic") * 10) +
      (getCount("dispensary") * 40) +
      (getCount("hospital") * 100) +
      (getCount("medical_city") * 500)
    ) - (
      (getCount("house") * 1) +
      (getCount("house_large") * 2) +
      (getCount("palace") * 4) +
      (getCount("apartments") * 8) +
      (getCount("hotel") * 20) +
      (getCount("residential_towers") * 40) +
      (getCount("skyscrapers") * 60)
    );

    // 6) ترفيهياً
    calculated.entertainment = (
      (getCount("park") * 20) +
      (getCount("theme_park") * 100) +
      (getCount("resort") * 500)
    ) - (
      (getCount("house") * 1) +
      (getCount("house_large") * 2) +
      (getCount("palace") * 4) +
      (getCount("apartments") * 8) +
      (getCount("hotel") * 20) +
      (getCount("residential_towers") * 40) +
      (getCount("skyscrapers") * 60)
    );

    // 7) ملاحياً
    calculated.navigation = (
      (getCount("boat") * 2) +
      (getCount("ship") * 8) +
      (getCount("cargo_carrier") * 20) +
      (getCount("cargo_ship_large") * 50)
    ) - (
      (getCount("shop") * 1) +
      (getCount("shop_large") * 2) +
      (getCount("showroom") * 4) +
      (getCount("markets") * 10) +
      (getCount("mall") * 20) +
      (housingCount * 1)
    );

    // 8) أمنياً (يشمل الشرطة + مساهمة الوحدات العسكرية في أمن الدولة)
    calculated.security = (
      (getCount("police_station") * 24) +
      (getCount("police_headquarters") * 100) +
      (militaryUnitsCount * 1)
    ) - (housingCount * 1);

    // 9) مدنياً
    calculated.civil = (
      (getCount("fire_station") * 80)
    ) - (housingCount * 1);

    // 10) خدمياً
    calculated.services = (
      (getCount("municipality") * 100) +
      (getCount("governorate") * 500)
    ) - (civilianArea * 1);

    // 11) موانئ
    calculated.ports = (
      (getCount("marina") * 20) +
      (getCount("seaport") * 100)
    ) - (
      (getCount("boat") * 1) +
      (getCount("ship") * 2) +
      (getCount("cargo_carrier") * 4) +
      (getCount("cargo_ship_large") * 10)
    );

    // 12) قطارات
    calculated.trains = (
      (getCount("train_station") * 100) +
      (getCount("train_station_large") * 200) +
      (getCount("train_cart_20") * 1) +
      (getCount("train_cart_40") * 1) +
      (getCount("train_cart_100") * 1) +
      (getCount("train_cart_200") * 1)
    ) - (
      (getCount("house") * 1) +
      (getCount("house_large") * 2) +
      (getCount("palace") * 4) +
      (getCount("apartments") * 8) +
      (getCount("hotel") * 20) +
      (getCount("residential_towers") * 40) +
      (getCount("skyscrapers") * 60)
    );

    // 13) مطارات
    calculated.airports = (
      (getCount("regional_airport") * 150) +
      (getCount("intl_airport") * 500) +
      (getCount("plane_50") * 1) +
      (getCount("plane_100") * 1) +
      (getCount("plane_200") * 1) +
      (getCount("plane_400") * 1)
    ) - (
      (getCount("house") * 1) +
      (getCount("house_large") * 1) +
      (getCount("palace") * 2) +
      (getCount("apartments") * 4) +
      (getCount("hotel") * 10) +
      (getCount("residential_towers") * 20) +
      (getCount("skyscrapers") * 30)
    );

    // 14) كهربائياً: التوليد التقليدي + إنتاج الطاقة النظيفة (شمسية +12، رياح +20، مفاعل نووي +1500)
    let elecGenerated = (
      (getCount("power_generator") * 24) +
      (getCount("power_plant") * 100) +
      (getCount("solar_farm") * 12) +
      (getCount("wind_station") * 20) +
      (getCount("nuclear_reactor") * 1500)
    );

    let elecConsumed = 0;
    if (window.BuildingsEngine && Array.isArray(window.BuildingsEngine.RESOURCES_LIST)) {
      window.BuildingsEngine.RESOURCES_LIST.forEach(r => {
        if (r.electricityNeed < 0) {
          elecConsumed += Math.abs(r.electricityNeed) * getCount(r.id);
        }
      });
    }
    calculated.electricity = elecGenerated - elecConsumed;

    // 15) مائياً: التوليد ناقص الاستهلاك العام ويخصم منه 24 نقطة ماء لتبريد كل مفاعل نووي سلمي
    let waterGenerated = (
      (getCount("water_well") * 10) +
      (getCount("water_pump") * 24) +
      (getCount("water_desalination") * 80)
    );

    let waterConsumed = 0;
    if (window.BuildingsEngine && Array.isArray(window.BuildingsEngine.RESOURCES_LIST)) {
      window.BuildingsEngine.RESOURCES_LIST.forEach(r => {
        if (r.waterNeed < 0) {
          waterConsumed += Math.abs(r.waterNeed) * getCount(r.id);
        }
      });
    }
    calculated.water = waterGenerated - waterConsumed - (getCount("nuclear_reactor") * 24);

    // 16) أسطوانة غاز
    let gasSupplied = (getCount("gas_station_shop") * 40) + (getCount("fuel_station") * 40) + (getCount("gas_well") * 10);
    let gasConsumed = (getCount("handicrafts") * 1) + (getCount("workshop") * 1) + (getCount("house") * 1) + (getCount("house_large") * 1);
    calculated.gas = gasSupplied - gasConsumed;

    // تطبيق أثر البورصة والتبادل التجاري
    const activeWorld = world || window.currentWorld;
    const tradeDeals = (activeWorld && Array.isArray(activeWorld.tradeDeals)) ? activeWorld.tradeDeals : [];

    this.SECTORS_LIST.forEach(sec => {
      let tradeModifier = 0;
      tradeDeals.forEach(deal => {
        if (deal.sectorKey === sec.id) {
          if (deal.exporterId === country.id) {
            tradeModifier -= Number(deal.points || 0);
          } else if (deal.importerId === country.id) {
            tradeModifier += Number(deal.points || 0);
          }
        }
      });

      country.sectors[sec.id] = (calculated[sec.id] || 0) + tradeModifier;
    });

    return country.sectors;
  }

  static calculateTotalSectorPoints(country) {
    if (!country) return 0;
    this.recalculateCountrySectors(country, window.currentWorld);

    let total = 0;
    this.SECTORS_LIST.forEach(s => {
      total += Number(country.sectors[s.id] || 0);
    });
    return total;
  }

  static calculateSectorRevenue(country) {
    if (!country) return 0;
    if (window.BuildingsEngine && typeof window.BuildingsEngine.calculateTotalRevenue === "function") {
      return window.BuildingsEngine.calculateTotalRevenue(country);
    }
    return Number(country.sectorRevenues || 0);
  }

  static getTrainsCapacityStatus(country) {
    const b = country.buildings || {};
    const cap = (Number(b.train_station || 0) * 10) + (Number(b.train_station_large || 0) * 40);
    const used = (
      Number(b.train_cart_20 || 0) +
      Number(b.train_cart_40 || 0) +
      Number(b.train_cart_100 || 0) +
      Number(b.train_cart_200 || 0)
    );
    return { capacity: cap, used: used, buffer: cap - used };
  }

  static getAirportsCapacityStatus(country) {
    const b = country.buildings || {};
    const cap = (Number(b.regional_airport || 0) * 20) + (Number(b.intl_airport || 0) * 100);
    const used = (
      Number(b.plane_50 || 0) +
      Number(b.plane_100 || 0) +
      Number(b.plane_200 || 0) +
      Number(b.plane_400 || 0)
    );
    return { capacity: cap, used: used, buffer: cap - used };
  }
}

window.SectorsEngine = SectorsEngine;
