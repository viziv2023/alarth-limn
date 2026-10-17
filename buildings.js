/**
 * Buildings Engine - عصر الهيمنة
 * محرك الموارد والمنشآت الوطنية وتتبع المراحل الخمس ومنظومة الطاقة النظيفة
 */

class BuildingsEngine {
  static STAGE_NAMES = {
    1: "النشأة والتأسيس",
    2: "النمو والتوسع",
    3: "النهضة الحضرية والصناعية",
    4: "السيادة والمدن الذكية",
    5: "الهيمنة العالمية والمشاريع العملاقة"
  };

  static RESOURCES_LIST = [
    // ==========================================
    // المرحلة الأولى: النشأة والتأسيس (12 مورداً)
    // ==========================================
    {
      id: "house",
      name: "بيت",
      icon: "🏠",
      stage: 1,
      price: 40,
      revenue: 10,
      populationType: "add",
      populationValue: 4,
      electricityNeed: -1,
      waterNeed: -1,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 4,
      capacityUnit: "أشخاص",
      capacityType: "person",
      prerequisites: [],
      prerequisiteText: "لا يوجد",
      sectorEffects: { commercial: -1, agricultural: -1, healthcare: -1, education: -1, entertainment: -1, trains: -1, airports: -1, gas: -1, electricity: -1, water: -1 },
      desc: "يوفر سكناً للمواطنين، يولد عائداً سنوياً مستمراً، ويستهلك من 8 قطاعات والكهرباء والماء."
    },
    {
      id: "shop",
      name: "محل",
      icon: "🏪",
      stage: 1,
      price: 20,
      revenue: 5,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: -1,
      waterNeed: 0,
      satisfiesBase: 5,
      satisfiesUnit: "بيوت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["farm", "boat"],
      prerequisiteMode: "OR",
      prerequisiteText: "مزرعة أو قارب",
      sectorEffects: { commercial: 5, navigation: -1, electricity: -1 },
      desc: "نشاط تجاري يخدم البيوت، يرفع التجاري بـ 5 ويخصم 1 ملاحي و1 كهرباء."
    },
    {
      id: "farm",
      name: "مزرعة",
      icon: "🌾",
      stage: 1,
      price: 30,
      revenue: 10,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: 0,
      waterNeed: -1,
      satisfiesBase: 5,
      satisfiesUnit: "نقاط",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["water_well"],
      prerequisiteMode: "AND",
      prerequisiteText: "بئر ماء",
      sectorEffects: { agricultural: 5, water: -1 },
      desc: "إنتاج زراعي يضيف 5 نقاط للزراعي، يتطلب بئر ماء ويستهلك 1 ماء وعامل 1."
    },
    {
      id: "clinic",
      name: "عيادة",
      icon: "🏥",
      stage: 1,
      price: 30,
      revenue: 10,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: -1,
      waterNeed: -1,
      satisfiesBase: 10,
      satisfiesUnit: "بيوت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة",
      sectorEffects: { healthcare: 10, agricultural: -1, electricity: -1, water: -1 },
      desc: "رعاية صحية تخدم البيوت، تضيف 10 نقاط للصحي وتخصم 1 من الزراعي."
    },
    {
      id: "boat",
      name: "قارب",
      icon: "⛵",
      stage: 1,
      price: 20,
      revenue: 5,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 2,
      satisfiesUnit: "محل",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة",
      sectorEffects: { navigation: 2, ports: -1 },
      desc: "قارب ملاحة وصيد، يلبي احتياج المحال، يضيف 2 للملاحي ويخصم 1 موانئ."
    },
    {
      id: "water_well",
      name: "بئر ماء",
      icon: "🚰",
      stage: 1,
      price: 50,
      revenue: 0,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 10,
      satisfiesUnit: "نقاط",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: [],
      prerequisiteText: "لا يوجد",
      sectorEffects: { water: 10 },
      desc: "مصدر للمياه النقية، يغذي المنشآت والمزارع ويضيف 10 نقاط للماء."
    },
    {
      id: "classroom",
      name: "غرفة تعليم",
      icon: "🎓",
      stage: 1,
      price: 50,
      revenue: 15,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: -1,
      waterNeed: -1,
      satisfiesBase: 10,
      satisfiesUnit: "بيوت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: [],
      prerequisiteText: "لا يوجد",
      sectorEffects: { education: 10, electricity: -1, water: -1 },
      desc: "منشأة تعليمية تخدم البيوت، تضيف 10 نقاط للتعليم وتستهلك كهرباء وماء وعامل 1."
    },
    {
      id: "handicrafts",
      name: "حرف يدوية",
      icon: "🏺",
      stage: 1,
      price: 40,
      revenue: 15,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: -1,
      waterNeed: -1,
      satisfiesBase: 10,
      satisfiesUnit: "نقاط",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة",
      sectorEffects: { industrial: 10, agricultural: -1, gas: -1, electricity: -1, water: -1 },
      desc: "مشغل حرفي، يضيف 10 للصناعي ويخصم 1 زراعي و1 غاز، ويسحب 2 عمال."
    },
    {
      id: "poultry_farm",
      name: "مزرعة دواجن",
      icon: "🐓",
      stage: 1,
      price: 30,
      revenue: 10,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: 0,
      waterNeed: -1,
      satisfiesBase: 10,
      satisfiesUnit: "نقاط",
      capacityBase: 50,
      capacityUnit: "طائر",
      capacityType: "poultry",
      prerequisites: ["farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة",
      sectorEffects: { agricultural: -1, water: -1 },
      desc: "مزرعة مخصصة للدواجن بسعة 50 طائراً للمزرعة، تخصم 1 زراعي و1 ماء."
    },
    {
      id: "bird",
      name: "طير",
      icon: "🐥",
      stage: 1,
      price: 1,
      revenue: 1,
      populationType: "none",
      populationValue: 0,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 0,
      capacityUnit: "-",
      capacityConsumes: "poultry",
      capacityUnits: 1,
      prerequisites: ["poultry_farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة دواجن بسعة متاحة",
      sectorEffects: {},
      desc: "طير داجن يستهلك 1 من سعة مزرعة الدواجن ويولد عائداً سنوياً مستمراً $1."
    },
    {
      id: "livestock_farm",
      name: "مزرعة مواشي",
      icon: "🐄",
      stage: 1,
      price: 50,
      revenue: 20,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: 0,
      waterNeed: -2,
      satisfiesBase: 10,
      satisfiesUnit: "نقاط",
      capacityBase: 20,
      capacityUnit: "حيوان",
      capacityType: "livestock",
      prerequisites: ["farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة",
      sectorEffects: { agricultural: -1, water: -2 },
      desc: "مزرعة مواشي بسعة 20 رأساً للمزرعة، تستهلك 2 ماء وعامل 1 وتولد عائداً مستمراً $20."
    },
    {
      id: "animal",
      name: "حيوان",
      icon: "🐂",
      stage: 1,
      price: 5,
      revenue: 5,
      populationType: "none",
      populationValue: 0,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 0,
      capacityUnit: "-",
      capacityConsumes: "livestock",
      capacityUnits: 1,
      prerequisites: ["livestock_farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة مواشي بسعة متاحة",
      sectorEffects: {},
      desc: "رأس ماشية يستهلك 1 من سعة مزرعة المواشي ويولد عائداً سنوياً مستمراً $5."
    },

    // ==========================================
    // المرحلة الثانية: النمو والتوسع (10 موارد)
    // ==========================================
    {
      id: "house_large",
      name: "بيت*",
      icon: "🏘️",
      stage: 2,
      price: 80,
      revenue: 20,
      populationType: "add",
      populationValue: 6,
      electricityNeed: -2,
      waterNeed: -2,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 6,
      capacityUnit: "أشخاص",
      capacityType: "person",
      prerequisites: ["house"],
      prerequisiteMode: "AND",
      prerequisiteText: "بيت",
      sectorEffects: { commercial: -2, agricultural: -2, healthcare: -2, education: -2, entertainment: -2, trains: -2, airports: -1, gas: -1, electricity: -2, water: -2 },
      desc: "مجمع سكني كبير، يضيف 6 مواطنين وعائداً مستمراً $20، ويستهلك من 8 قطاعات والكهرباء والماء."
    },
    {
      id: "shop_large",
      name: "محل*",
      icon: "🏬",
      stage: 2,
      price: 50,
      revenue: 15,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: -1,
      waterNeed: 0,
      satisfiesBase: 15,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["ship"],
      prerequisiteMode: "AND",
      prerequisiteText: "سفينة",
      sectorEffects: { commercial: 15, navigation: -2, electricity: -1 },
      desc: "متجر موسع يلبي احتياج 15 بيتاً، يرفع التجاري بـ 15 ويخصم 2 ملاحي و1 كهرباء ويسحب عاملين."
    },
    {
      id: "ship",
      name: "سفينة",
      icon: "🚢",
      stage: 2,
      price: 50,
      revenue: 15,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 8,
      satisfiesUnit: "محلات",
      capacityBase: 0,
      capacityUnit: "-",
      capacityConsumes: "marina",
      capacityUnits: 1,
      prerequisites: ["farm", "workshop", "marina"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة، ورشة عمل، مرسى شاغر",
      sectorEffects: { navigation: 8, ports: -2 },
      desc: "سفينة تجارية وملاحية كبرى تلبي 8 محلات، تضيف 8 للملاحي وتخصم 2 موانئ وتستهلك سعة من المرسى."
    },
    {
      id: "park",
      name: "حديقة",
      icon: "🌳",
      stage: 2,
      price: 100,
      revenue: 25,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: -1,
      waterNeed: -2,
      satisfiesBase: 20,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["workshop"],
      prerequisiteMode: "AND",
      prerequisiteText: "ورشة عمل",
      sectorEffects: { entertainment: 20, electricity: -1, water: -2 },
      desc: "رافد الترفيه والسياحة، تخدم 20 بيتاً وتضيف 20 نقطة للترفيه، تستهلك 2 ماء و1 كهرباء وعاملين."
    },
    {
      id: "marina",
      name: "مرسى",
      icon: "⚓",
      stage: 2,
      price: 200,
      revenue: 50,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: -1,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 20,
      capacityUnit: "سفينة",
      capacityType: "marina",
      prerequisites: ["workshop", "farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "ورشة عمل، مزرعة",
      sectorEffects: { ports: 20, electricity: -1 },
      desc: "حاضن للملاحة وأرصفة الموانئ، يستوعب حتى 20 سفينة ويضيف 20 نقطة للموانئ وعائداً مستمراً $50."
    },
    {
      id: "police_station",
      name: "قسم شرطة",
      icon: "🚓",
      stage: 2,
      price: 100,
      revenue: -30,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: -1,
      waterNeed: -1,
      satisfiesBase: 24,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["workshop"],
      prerequisiteMode: "AND",
      prerequisiteText: "ورشة عمل",
      sectorEffects: { security: 24, electricity: -1, water: -1 },
      desc: "الداعم الأساسي للأمن والاستقرار، يولد 24 نقطة للأمن بتكلفة صيانة -$30 و4 أفراد أمن."
    },
    {
      id: "power_generator",
      name: "مولد كهرباء",
      icon: "⚡",
      stage: 2,
      price: 200,
      revenue: -50,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 24,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["workshop"],
      prerequisiteMode: "AND",
      prerequisiteText: "ورشة عمل",
      sectorEffects: { electricity: 24 },
      desc: "بداية الإنتاج الصناعي للطاقة، يولد 24 نقطة لشبكة الكهرباء بتكلفة صيانة تشغيلية -$50 وعاملين."
    },
    {
      id: "water_pump",
      name: "مضخة ماء",
      icon: "💧",
      stage: 2,
      price: 200,
      revenue: -50,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: -2,
      waterNeed: 0,
      satisfiesBase: 24,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["power_generator"],
      prerequisiteMode: "AND",
      prerequisiteText: "مولد كهرباء",
      sectorEffects: { water: 24, electricity: -2 },
      desc: "مضخة مياه حديثة تضخ 24 نقطة لشبكة المياه بتكلفة صيانة -$50 وتستهلك 2 كهرباء وعاملين."
    },
    {
      id: "school",
      name: "مدرسة",
      icon: "🏫",
      stage: 2,
      price: 200,
      revenue: 25,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: -2,
      waterNeed: -2,
      satisfiesBase: 40,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["classroom"],
      prerequisiteMode: "AND",
      prerequisiteText: "غرفة تعليم",
      sectorEffects: { education: 40, electricity: -2, water: -2 },
      desc: "صرح تعليمي متقدم يخدم 40 بيتاً ويضيف 40 نقطة للتعليم، يستهلك كادر 4 عمال وكهرباء وماء."
    },
    {
      id: "workshop",
      name: "ورشة عمل",
      icon: "🏭",
      stage: 2,
      price: 100,
      revenue: 30,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: -2,
      waterNeed: -1,
      satisfiesBase: 25,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["handicrafts", "farm"],
      prerequisiteMode: "AND",
      prerequisiteText: "حرف يدوية، مزرعة",
      sectorEffects: { industrial: 25, agricultural: -1, gas: -1, electricity: -2, water: -1 },
      desc: "ورشة تصنيع متقدمة ترفع الصناعي بـ 25 وتخصم 1 زراعي و1 غاز، وتسحب 4 عمال وكهرباء وماء."
    },

    // ==========================================
    // المرحلة الثالثة: النهضة الحضرية والصناعية (24 مورداً)
    // ==========================================
    {
      id: "municipality",
      name: "بلدية",
      icon: "🏛️",
      stage: 3,
      price: 1000,
      revenue: -100,
      populationType: "workforce",
      populationValue: 8,
      electricityNeed: -4,
      waterNeed: -2,
      satisfiesBase: 100,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["house_large", "police_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "بيت*، قسم شرطة",
      sectorEffects: { civil: 100, services: 100, electricity: -4, water: -2 },
      desc: "مركز الإدارة والتخطيط الحضري، يوفر 100 نقطة مدنية وخدمية بتكلفة تشغيل -$100 و8 موظفين."
    },
    {
      id: "palace",
      name: "قصر",
      icon: "🏰",
      stage: 3,
      price: 200,
      revenue: 40,
      populationType: "add",
      populationValue: 10,
      electricityNeed: -3,
      waterNeed: -3,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 10,
      capacityUnit: "أشخاص",
      capacityType: "person",
      prerequisites: ["municipality", "workshop", "house_large"],
      prerequisiteMode: "AND",
      prerequisiteText: "بلدية، ورشة عمل، بيت*",
      sectorEffects: { civil: 10, electricity: -3, water: -3 },
      desc: "سكن سيادي فاخر يستوعب 10 أشخاص ويولد عائداً مستمراً $40 ويستهلك 3 كهرباء و3 ماء."
    },
    {
      id: "showroom",
      name: "صالة بيع",
      icon: "🏬",
      stage: 3,
      price: 100,
      revenue: 25,
      populationType: "workforce",
      populationValue: 5,
      electricityNeed: -3,
      waterNeed: 0,
      satisfiesBase: 30,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["municipality", "workshop", "cargo_carrier"],
      prerequisiteMode: "AND",
      prerequisiteText: "بلدية، ورشة عمل، ناقلة بضائع",
      sectorEffects: { commercial: 30, electricity: -3 },
      desc: "صالة تجارية كبرى تلبي احتياج 30 بيتاً، تضيف 30 نقطة تجارية وتولد عائداً مستمراً $25."
    },
    {
      id: "production_farm",
      name: "مزرعة انتاج",
      icon: "🚜",
      stage: 3,
      price: 200,
      revenue: 50,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: -1,
      waterNeed: -4,
      satisfiesBase: 40,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["power_generator", "water_pump"],
      prerequisiteMode: "AND",
      prerequisiteText: "مولد كهرباء، مضخة ماء",
      sectorEffects: { agricultural: 40, electricity: -1, water: -4 },
      desc: "مزرعة إنتاج متطورة تضيف 40 نقطة للقطاع الزراعي وتولد عائداً مستمراً $50."
    },
    {
      id: "dispensary",
      name: "مستوصف",
      icon: "🏥",
      stage: 3,
      price: 200,
      revenue: 50,
      populationType: "workforce",
      populationValue: 6,
      electricityNeed: -2,
      waterNeed: -2,
      satisfiesBase: 40,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["clinic", "workshop"],
      prerequisiteMode: "AND",
      prerequisiteText: "عيادة، ورشة عمل",
      sectorEffects: { healthcare: 40, electricity: -2, water: -2 },
      desc: "مستوصف طبي موسع يلبي احتياج 40 بيتاً، يضيف 40 نقطة صحية وعائداً مستمراً $50."
    },
    {
      id: "cargo_carrier",
      name: "ناقلة بضائع",
      icon: "🚛",
      stage: 3,
      price: 100,
      revenue: 30,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 20,
      satisfiesUnit: "محل",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["workshop", "marina", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "ورشة عمل، مرسى، محطة وقود",
      sectorEffects: { navigation: 20, ports: -2 },
      desc: "أسطول ناقلات تجارية يخدم 20 محلاً، يضيف 20 نقطة ملاحة ويولد عائداً مستمراً $30."
    },
    {
      id: "educational_complex",
      name: "مجمع تعليمي",
      icon: "📚",
      stage: 3,
      price: 500,
      revenue: 100,
      populationType: "workforce",
      populationValue: 12,
      electricityNeed: -4,
      waterNeed: -3,
      satisfiesBase: 100,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["school"],
      prerequisiteMode: "AND",
      prerequisiteText: "مدرسة",
      sectorEffects: { education: 100, electricity: -4, water: -3 },
      desc: "صرح تعليمي شامل يخدم 100 بيت، يضيف 100 نقطة تعليمية وعائداً مستمراً $100."
    },
    {
      id: "factory",
      name: "مصنع",
      icon: "🏭",
      stage: 3,
      price: 1000,
      revenue: 300,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -10,
      waterNeed: -5,
      satisfiesBase: 100,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["marina", "workshop", "municipality"],
      prerequisiteMode: "AND",
      prerequisiteText: "مرسى، ورشة عمل، بلدية",
      sectorEffects: { industrial: 100, electricity: -10, water: -5 },
      desc: "قلب الصناعة الثقيلة، يضيف 100 نقطة صناعية ويوظف 20 عاملاً ويدر عائداً ضخماً $300."
    },
    {
      id: "poultry_complex",
      name: "مجمع انتاج دواجن",
      icon: "🐔",
      stage: 3,
      price: 500,
      revenue: 150,
      populationType: "workforce",
      populationValue: 10,
      electricityNeed: -4,
      waterNeed: -5,
      satisfiesBase: 100,
      satisfiesUnit: "نقطة",
      capacityBase: 1000,
      capacityUnit: "طائر",
      capacityType: "poultry",
      prerequisites: ["production_farm", "factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة انتاج، مصنع",
      sectorEffects: { agricultural: 100, electricity: -4, water: -5 },
      desc: "مجمع استراتيجي للدواجن يضيف سعة 1,000 طائر، و100 نقطة زراعية وعائداً مستمراً $150."
    },
    {
      id: "livestock_complex",
      name: "مجمع انتاج ماشية",
      icon: "🥩",
      stage: 3,
      price: 1000,
      revenue: 300,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -5,
      waterNeed: -6,
      satisfiesBase: 100,
      satisfiesUnit: "نقطة",
      capacityBase: 600,
      capacityUnit: "حيوان",
      capacityType: "livestock",
      prerequisites: ["production_farm", "factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مزرعة انتاج، مصنع",
      sectorEffects: { agricultural: 100, electricity: -5, water: -6 },
      desc: "مجمع حيواني هائل يستوعب 600 حيوان، يضيف 100 نقطة زراعية وعائداً مستمراً $300."
    },
    {
      id: "theme_park",
      name: "مدينة العاب",
      icon: "🎡",
      stage: 3,
      price: 400,
      revenue: 100,
      populationType: "workforce",
      populationValue: 6,
      electricityNeed: -3,
      waterNeed: -4,
      satisfiesBase: 100,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["power_generator", "park"],
      prerequisiteMode: "AND",
      prerequisiteText: "مولد كهرباء، حديقة",
      sectorEffects: { entertainment: 100, electricity: -3, water: -4 },
      desc: "مدينة ترفيهية ضخمة تخدم 100 بيت وتضيف 100 نقطة للترفيه وعائداً سنوياً $100."
    },
    {
      id: "markets",
      name: "اسواق",
      icon: "🛍️",
      stage: 3,
      price: 500,
      revenue: 150,
      populationType: "workforce",
      populationValue: 10,
      electricityNeed: -6,
      waterNeed: 0,
      satisfiesBase: 100,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["factory", "cargo_carrier"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع، ناقلة بضائع",
      sectorEffects: { commercial: 100, electricity: -6 },
      desc: "أسواق مركزية كبرى تخدم 100 بيت وتضيف 100 نقطة تجارية وعائداً مستمراً $150."
    },
    {
      id: "regional_airport",
      name: "مطار اقليمي",
      icon: "🛫",
      stage: 3,
      price: 2500,
      revenue: 450,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -20,
      waterNeed: -5,
      satisfiesBase: 100,
      satisfiesUnit: "بيت",
      capacityBase: 20,
      capacityUnit: "طائرة",
      capacityType: "airport_regional",
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { airports: 100, electricity: -20, water: -5 },
      desc: "بوابة جوية إقليمية تستوعب 20 طائرة، تخدم 100 بيت وتدر عائداً سنوياً $450."
    },
    {
      id: "plane_50",
      name: "طائره 50 راكب",
      icon: "✈️",
      stage: 3,
      price: 400,
      revenue: 80,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 50,
      capacityUnit: "راكب",
      capacityConsumes: "airport_regional",
      capacityUnits: 1,
      prerequisites: ["regional_airport", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "مطار اقليمي، محطة وقود",
      sectorEffects: { airports: 10 },
      desc: "طائرة نقل ركاب إقليمية بسعة 50 راكباً، تستهلك 1 من سعة المطار الإقليمي وتدر $80 سنوياً."
    },
    {
      id: "plane_100",
      name: "طائره 100 راكب",
      icon: "🛩️",
      stage: 3,
      price: 800,
      revenue: 160,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 100,
      capacityUnit: "راكب",
      capacityConsumes: "airport_regional",
      capacityUnits: 1,
      prerequisites: ["regional_airport", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "مطار اقليمي، محطة وقود",
      sectorEffects: { airports: 20 },
      desc: "طائرة نقل ركاب موسعة بسعة 100 راكب، تستهلك سعة من المطار الإقليمي وتدر $160 سنوياً."
    },
    {
      id: "train_station",
      name: "محطة قطار",
      icon: "🚉",
      stage: 3,
      price: 1000,
      revenue: 200,
      populationType: "workforce",
      populationValue: 10,
      electricityNeed: -10,
      waterNeed: 0,
      satisfiesBase: 50,
      satisfiesUnit: "بيت",
      capacityBase: 10,
      capacityUnit: "عربات",
      capacityType: "train_station",
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { trains: 50, electricity: -10 },
      desc: "محطة سكك حديدية تخدم 50 بيتاً وتستوعب حتى 10 عربات، وتضيف 50 نقطة للقطارات."
    },
    {
      id: "train_cart_20",
      name: "عربة 20 راكب",
      icon: "🚋",
      stage: 3,
      price: 200,
      revenue: 50,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 20,
      capacityUnit: "راكب",
      capacityConsumes: "train_station",
      capacityUnits: 1,
      prerequisites: ["train_station", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "محطة قطار، محطة وقود",
      sectorEffects: { trains: 10 },
      desc: "عربة قطار ركاب تسع 20 راكباً، تستهلك سعة عربة من المحطة وتولد عائداً مستمراً $50."
    },
    {
      id: "train_cart_40",
      name: "عربة 40 راكب",
      icon: "🚆",
      stage: 3,
      price: 400,
      revenue: 100,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 40,
      capacityUnit: "راكب",
      capacityConsumes: "train_station",
      capacityUnits: 1,
      prerequisites: ["train_station", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "محطة قطار، محطة وقود",
      sectorEffects: { trains: 20 },
      desc: "عربة قطار مزدوجة بسعة 40 راكباً، تستهلك سعة من المحطة وتولد عائداً مستمراً $100."
    },
    {
      id: "fire_station",
      name: "مركز اطفاء",
      icon: "🚒",
      stage: 3,
      price: 300,
      revenue: -90,
      populationType: "workforce",
      populationValue: 8,
      electricityNeed: -3,
      waterNeed: -5,
      satisfiesBase: 80,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["water_pump"],
      prerequisiteMode: "AND",
      prerequisiteText: "مضخة ماء",
      sectorEffects: { security: 40, services: 40, electricity: -3, water: -5 },
      desc: "مركز حماية مدنية وإطفاء يخدم 80 بيتاً، يرفع الأمن والخدمات بتكلفة تشغيل -$90."
    },
    {
      id: "apartments",
      name: "شقق",
      icon: "🏢",
      stage: 3,
      price: 400,
      revenue: 100,
      populationType: "add",
      populationValue: 50,
      electricityNeed: -6,
      waterNeed: -6,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 50,
      capacityUnit: "شخص",
      capacityType: "person",
      prerequisites: ["municipality"],
      prerequisiteMode: "AND",
      prerequisiteText: "بلدية",
      sectorEffects: { civil: 50, electricity: -6, water: -6 },
      desc: "عمارة شقق سكنية متطورة توفر سكناً لـ 50 مواطناً وتدر عائداً سنوياً $100."
    },
    {
      id: "hotel",
      name: "فندق",
      icon: "🏨",
      stage: 3,
      price: 800,
      revenue: 200,
      populationType: "add",
      populationValue: 100,
      electricityNeed: -10,
      waterNeed: -10,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 100,
      capacityUnit: "شخص",
      capacityType: "person",
      prerequisites: ["municipality"],
      prerequisiteMode: "AND",
      prerequisiteText: "بلدية",
      sectorEffects: { entertainment: 50, civil: 50, electricity: -10, water: -10 },
      desc: "فندق سياحي فخم يستوعب 100 شخص، يدعم قطاع الترفيه ويولد عائداً سنوياً $200."
    },
    {
      id: "fuel_station",
      name: "محطة وقود",
      icon: "⛽",
      stage: 3,
      price: 500,
      revenue: 200,
      populationType: "workforce",
      populationValue: 4,
      electricityNeed: -4,
      waterNeed: 0,
      satisfiesBase: 40,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["oil_well", "factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "بئر نفط، مصنع",
      sectorEffects: { gas: 40, electricity: -4 },
      desc: "محطة تزويد بالوقود تلبي احتياج 40 نقطة، تدعم وسائل النقل وتدر عائداً مستمراً $200."
    },
    {
      id: "oil_well",
      name: "بئر نفط",
      icon: "🛢️",
      stage: 3,
      price: 4000,
      revenue: 1000,
      populationType: "workforce",
      populationValue: 8,
      electricityNeed: -5,
      waterNeed: -5,
      satisfiesBase: 10,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { industrial: 10, electricity: -5, water: -5 },
      desc: "منشأة استخراج الذهب الأسود، تضخ عائداً سيادياً هائلاً بقيمة $1,000 سنوياً."
    },
    {
      id: "gas_station_shop",
      name: "محل غاز",
      icon: "🔥",
      stage: 3,
      price: 400,
      revenue: 150,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: -1,
      waterNeed: 0,
      satisfiesBase: 40,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["handicrafts"],
      prerequisiteMode: "AND",
      prerequisiteText: "حرف يدوية (أو بئر غاز)",
      sectorEffects: { gas: 40, electricity: -1 },
      desc: "مركز توزيع أسطوانات الغاز يلبي احتياج 40 نقطة ويولد عائداً سنوياً $150."
    },

    // ==========================================
    // المرحلة الرابعة: السيادة والمدن الذكية (19 مورداً)
    // ==========================================
    {
      id: "governorate",
      name: "امانة",
      icon: "🏛️",
      stage: 4,
      price: 5000,
      revenue: -500,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -5,
      waterNeed: -4,
      satisfiesBase: 500,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["oil_well", "municipality"],
      prerequisiteMode: "AND",
      prerequisiteText: "بئر نفط، بلدية",
      sectorEffects: { civil: 500, services: 500, electricity: -5, water: -4 },
      desc: "أمانة العاصمة الكبرى، تدير 500 نقطة مدنية وخدمية بتكلفة تشغيل -$500 و20 موظفاً."
    },
    {
      id: "hospital",
      name: "مستشفى",
      icon: "🏥",
      stage: 4,
      price: 1000,
      revenue: 250,
      populationType: "workforce",
      populationValue: 15,
      electricityNeed: -5,
      waterNeed: -5,
      satisfiesBase: 100,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["dispensary", "governorate"],
      prerequisiteMode: "AND",
      prerequisiteText: "مستوصف، امانة",
      sectorEffects: { healthcare: 100, electricity: -5, water: -5 },
      desc: "صرح صحي متكامل يلبي احتياج 100 بيت، يضيف 100 نقطة صحية وعائداً مستمراً $250."
    },
    {
      id: "cargo_ship_large",
      name: "باخره",
      icon: "🚢",
      stage: 4,
      price: 300,
      revenue: 100,
      populationType: "workforce",
      populationValue: 10,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 50,
      satisfiesUnit: "محل",
      capacityBase: 0,
      capacityUnit: "-",
      capacityConsumes: "seaport",
      capacityUnits: 1,
      prerequisites: ["factory", "seaport", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع، ميناء، محطة وقود",
      sectorEffects: { navigation: 50, ports: -5 },
      desc: "باخرة شحن دولية عملاقة تخدم 50 محلاً، تستهلك سعة من الميناء وتولد عائداً مستمراً $100."
    },
    {
      id: "water_desalination",
      name: "محطة تحلية مياه",
      icon: "🌊",
      stage: 4,
      price: 1000,
      revenue: -200,
      populationType: "workforce",
      populationValue: 10,
      electricityNeed: -5,
      waterNeed: 0,
      satisfiesBase: 80,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["fuel_station", "power_generator"],
      prerequisiteMode: "AND",
      prerequisiteText: "محطة وقود، مولد كهرباء",
      sectorEffects: { water: 80, electricity: -5 },
      desc: "محطة تحلية بحرية حديثة تغذي شبكة المياه بـ 80 نقطة بتكلفة صيانة تشغيلية -$200."
    },
    {
      id: "university",
      name: "جامعة",
      icon: "🎓",
      stage: 4,
      price: 2000,
      revenue: 500,
      populationType: "workforce",
      populationValue: 25,
      electricityNeed: -10,
      waterNeed: -5,
      satisfiesBase: 500,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["educational_complex"],
      prerequisiteMode: "AND",
      prerequisiteText: "مجمع تعليمي",
      sectorEffects: { education: 500, electricity: -10, water: -5 },
      desc: "جامعة وطنية كبرى تخدم 500 بيت، وتضيف 500 نقطة للتعليم وتدر عائداً سنوياً $500."
    },
    {
      id: "factory_large",
      name: "مصنع*",
      icon: "🏭",
      stage: 4,
      price: 3000,
      revenue: 1000,
      populationType: "workforce",
      populationValue: 50,
      electricityNeed: -20,
      waterNeed: -10,
      satisfiesBase: 400,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["governorate", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "امانة، محطة وقود",
      sectorEffects: { industrial: 400, electricity: -20, water: -10 },
      desc: "مجمع صناعي استراتيجي موسع، يوظف 50 عاملاً ويضيف 400 نقطة صناعية ويدر $1,000 سنوياً."
    },
    {
      id: "resort",
      name: "منتجع سياحي",
      icon: "🏝️",
      stage: 4,
      price: 1500,
      revenue: 500,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -10,
      waterNeed: -20,
      satisfiesBase: 500,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["governorate"],
      prerequisiteMode: "AND",
      prerequisiteText: "امانة",
      sectorEffects: { entertainment: 500, electricity: -10, water: -20 },
      desc: "منتجع سياحي فاخر يخدم 500 بيت ويضيف 500 نقطة للترفيه ويولد عائداً مستمراً $500."
    },
    {
      id: "seaport",
      name: "ميناء",
      icon: "⚓",
      stage: 4,
      price: 5000,
      revenue: 2000,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -20,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 100,
      capacityUnit: "باخرة",
      capacityType: "seaport",
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { ports: 100, electricity: -20 },
      desc: "ميناء بحري تجاري استراتيجي يستوعب 100 باخرة ويضيف 100 نقطة للموانئ وعائداً مستمراً $2,000."
    },
    {
      id: "police_headquarters",
      name: "مركز شرطة*",
      icon: "🛡️",
      stage: 4,
      price: 500,
      revenue: -200,
      populationType: "workforce",
      populationValue: 12,
      electricityNeed: -5,
      waterNeed: -5,
      satisfiesBase: 100,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["governorate", "factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "امانة، مصنع",
      sectorEffects: { security: 100, electricity: -5, water: -5 },
      desc: "قيادة أمنية عليا تخدم 100 بيت وتضيف 100 نقطة للأمن بتكلفة صيانة تشغيلية -$200."
    },
    {
      id: "power_plant",
      name: "محطة توليد كهرباء",
      icon: "⚡",
      stage: 4,
      price: 2000,
      revenue: -400,
      populationType: "workforce",
      populationValue: 10,
      electricityNeed: 0,
      waterNeed: -5,
      satisfiesBase: 100,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["factory", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع، محطة وقود",
      sectorEffects: { electricity: 100, water: -5 },
      desc: "محطة توليد طاقة كبرى تضخ 100 نقطة لشبكة الكهرباء بتكلفة تشغيل -$400 و10 فنيين."
    },
    {
      id: "mall",
      name: "مول",
      icon: "🏬",
      stage: 4,
      price: 2000,
      revenue: 500,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -12,
      waterNeed: -5,
      satisfiesBase: 200,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["factory", "cargo_carrier"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع، ناقلة بضائع",
      sectorEffects: { commercial: 200, electricity: -12, water: -5 },
      desc: "مركز تسوق عصري ضخم يلبي احتياج 200 بيت، يضيف 200 نقطة تجارية وعائداً مستمراً $500."
    },
    {
      id: "intl_airport",
      name: "مطار دولي",
      icon: "✈️",
      stage: 4,
      price: 8000,
      revenue: 3000,
      populationType: "workforce",
      populationValue: 50,
      electricityNeed: -50,
      waterNeed: -20,
      satisfiesBase: 500,
      satisfiesUnit: "بيت",
      capacityBase: 100,
      capacityUnit: "طائره",
      capacityType: "airport_intl",
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { airports: 500, electricity: -50, water: -20 },
      desc: "مطار دولي عالمي يستوعب 100 طائرة عملاقة، ويخدم 500 بيت ويدر عائداً سيادياً $3,000 سنوياً."
    },
    {
      id: "plane_200",
      name: "طائره 200 راكب",
      icon: "🛫",
      stage: 4,
      price: 1600,
      revenue: 320,
      populationType: "workforce",
      populationValue: 8,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 200,
      capacityUnit: "راكب",
      capacityConsumes: "airport_intl",
      capacityUnits: 1,
      prerequisites: ["intl_airport", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "مطار دولي، محطة وقود",
      sectorEffects: { airports: 50 },
      desc: "طائرة نقل عابرة للقارات بسعة 200 راكب، تستهلك سعة من المطار الدولي وتدر عائداً سنوياً $320."
    },
    {
      id: "plane_400",
      name: "طائره 400 راكب",
      icon: "🛬",
      stage: 4,
      price: 3200,
      revenue: 640,
      populationType: "workforce",
      populationValue: 16,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 400,
      capacityUnit: "راكب",
      capacityConsumes: "airport_intl",
      capacityUnits: 1,
      prerequisites: ["intl_airport", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "مطار دولي، محطة وقود",
      sectorEffects: { airports: 100 },
      desc: "طائرة جامبو نفاثة عريضة البدن بسعة 400 راكب، تدر عائداً سنوياً مستمراً $640."
    },
    {
      id: "train_station_large",
      name: "محطة قطار*",
      icon: "🚉",
      stage: 4,
      price: 2000,
      revenue: 500,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: -20,
      waterNeed: -5,
      satisfiesBase: 100,
      satisfiesUnit: "بيت",
      capacityBase: 40,
      capacityUnit: "عربة",
      capacityType: "train_station_large",
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { trains: 100, electricity: -20, water: -5 },
      desc: "محطة قطارات مركزية دولية تستوعب 40 عربة، تخدم 100 بيت وتدر عائداً مستمراً $500."
    },
    {
      id: "train_cart_100",
      name: "عربة 100 راكب",
      icon: "🚄",
      stage: 4,
      price: 800,
      revenue: 200,
      populationType: "workforce",
      populationValue: 8,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 100,
      capacityUnit: "راكب",
      capacityConsumes: "train_station_large",
      capacityUnits: 1,
      prerequisites: ["train_station_large", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "محطة قطار*، محطة وقود",
      sectorEffects: { trains: 50 },
      desc: "عربة قطار سريع تسع 100 راكب، تستهلك سعة عربة من المحطة الدولية وتولد عائداً مستمراً $200."
    },
    {
      id: "train_cart_200",
      name: "عربة 200 راكب",
      icon: "🚅",
      stage: 4,
      price: 1500,
      revenue: 500,
      populationType: "workforce",
      populationValue: 20,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 200,
      capacityUnit: "راكب",
      capacityConsumes: "train_station_large",
      capacityUnits: 1,
      prerequisites: ["train_station_large", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "محطة قطار*، محطة وقود",
      sectorEffects: { trains: 100 },
      desc: "عربة قطار طلقة فائقة بسعة 200 راكب، تستهلك سعة من المحطة الدولية وتدر $500 سنوياً."
    },
    {
      id: "residential_towers",
      name: "ابراج سكنية",
      icon: "🏙️",
      stage: 4,
      price: 2000,
      revenue: 500,
      populationType: "add",
      populationValue: 300,
      electricityNeed: -20,
      waterNeed: -20,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 300,
      capacityUnit: "شخص",
      capacityType: "person",
      prerequisites: ["governorate"],
      prerequisiteMode: "AND",
      prerequisiteText: "امانة",
      sectorEffects: { civil: 300, electricity: -20, water: -20 },
      desc: "أبراج سكنية شاهقة تستوعب 300 مواطن وتولد عائداً سنوياً $500 وتستهلك 20 كهرباء و20 ماء."
    },
    {
      id: "gas_well",
      name: "بئر غاز",
      icon: "⛽",
      stage: 4,
      price: 2000,
      revenue: 600,
      populationType: "workforce",
      populationValue: 5,
      electricityNeed: -3,
      waterNeed: -3,
      satisfiesBase: 10,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { gas: 10, electricity: -3, water: -3 },
      desc: "بئر إنتاج واستخراج الغاز الطبيعي، يلبي 10 نقاط طاقة ويضخ عائداً سيادياً $600 سنوياً."
    },

    // ==========================================
    // المرحلة الخامسة: الهيمنة والمشاريع العملاقة (4 موارد)
    // ==========================================
    {
      id: "medical_city",
      name: "مدينة طبية",
      icon: "🏥",
      stage: 5,
      price: 8000,
      revenue: 2000,
      populationType: "workforce",
      populationValue: 50,
      electricityNeed: -20,
      waterNeed: -20,
      satisfiesBase: 500,
      satisfiesUnit: "بيت",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["governorate", "factory_large"],
      prerequisiteMode: "AND",
      prerequisiteText: "امانة، مصنع*",
      sectorEffects: { healthcare: 500, electricity: -20, water: -20 },
      desc: "مجمع استشفائي دولي يخدم 500 بيت، يضيف 500 نقطة صحية ويوظف 50 كادراً ويدر $2,000 سنوياً."
    },
    {
      id: "industrial_authority",
      name: "هيئة صناعية",
      icon: "🏭",
      stage: 5,
      price: 10000,
      revenue: 3500,
      populationType: "workforce",
      populationValue: 100,
      electricityNeed: -50,
      waterNeed: -30,
      satisfiesBase: 1500,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["governorate", "fuel_station"],
      prerequisiteMode: "AND",
      prerequisiteText: "امانة، محطة وقود",
      sectorEffects: { industrial: 1500, electricity: -50, water: -30 },
      desc: "هيئة صناعية استراتيجية كبرى ترفع الصناعي بـ 1500 نقطة، وتوظف 100 عامل ويدر $3,500 سنوياً."
    },
    {
      id: "skyscrapers",
      name: "ناطحات سحاب",
      icon: "🏙️",
      stage: 5,
      price: 5000,
      revenue: 1500,
      populationType: "add",
      populationValue: 800,
      electricityNeed: -40,
      waterNeed: -40,
      satisfiesBase: 0,
      satisfiesUnit: "-",
      capacityBase: 800,
      capacityUnit: "شخص",
      capacityType: "person",
      prerequisites: ["governorate"],
      prerequisiteMode: "AND",
      prerequisiteText: "امانة",
      sectorEffects: { civil: 800, electricity: -40, water: -40 },
      desc: "ناطحات سحاب عملاقة تستوعب 800 مواطن وتضخ عائداً سنوياً $1,500 وتستهلك 40 كهرباء و40 ماء."
    },
    {
      id: "oil_field",
      name: "حقل نفط",
      icon: "🛢️",
      stage: 5,
      price: 15000,
      revenue: 5500,
      populationType: "workforce",
      populationValue: 40,
      electricityNeed: -40,
      waterNeed: -20,
      satisfiesBase: 100,
      satisfiesUnit: "نقطة",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: null,
      prerequisites: ["factory_large", "seaport", "cargo_ship_large"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع*، ميناء، باخرة",
      sectorEffects: { industrial: 100, electricity: -40, water: -20 },
      desc: "حقل نفطي بري وبحري عملاق يضخ 100 نقطة صناعية ويدر عائداً سيادياً أسطورياً $5,500 سنوياً."
    },

    // ==========================================
    // 🌱 منظومة الطاقة النظيفة (3 منشآت مستقلة)
    // ==========================================
    {
      id: "solar_farm",
      name: "مزرعة طاقة شمسية",
      icon: "☀️",
      stage: "clean_energy",
      category: "clean_energy",
      price: 100,
      revenue: -5,
      populationType: "workforce",
      populationValue: 1,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 12,
      satisfiesUnit: "نقطة كهرباء",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: "solar_farm",
      prerequisites: ["factory"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع",
      sectorEffects: { electricity: 12 },
      desc: "ألواح طاقة شمسية تنتج 12 نقطة كهرباء بتكلفة تشغيل -$5 وعامل 1، أقصى حد لبنائها هو مساحة الدولة."
    },
    {
      id: "wind_station",
      name: "محطة طاقة رياح",
      icon: "🌀",
      stage: "clean_energy",
      category: "clean_energy",
      price: 500,
      revenue: -10,
      populationType: "workforce",
      populationValue: 2,
      electricityNeed: 0,
      waterNeed: 0,
      satisfiesBase: 20,
      satisfiesUnit: "نقطة كهرباء",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: "wind_station",
      prerequisites: ["workshop"],
      prerequisiteMode: "AND",
      prerequisiteText: "ورشة عمل",
      sectorEffects: { electricity: 20 },
      desc: "توربينات هوائية تنتج 20 نقطة كهرباء بتكلفة تشغيل -$10 وعاملين، أقصى حد لبنائها هو نصف مساحة الدولة."
    },
    {
      id: "nuclear_reactor",
      name: "مفاعل نووي سلمي",
      icon: "☢️",
      stage: "clean_energy",
      category: "clean_energy",
      price: 20000,
      revenue: -1000,
      populationType: "workforce",
      populationValue: 24,
      electricityNeed: 0,
      waterNeed: -24,
      satisfiesBase: 1500,
      satisfiesUnit: "نقطة كهرباء",
      capacityBase: 0,
      capacityUnit: "-",
      capacityType: "nuclear_reactor",
      prerequisites: ["factory", "oil_well", "water_desalination"],
      prerequisiteMode: "AND",
      prerequisiteText: "مصنع - بئر نفط - محطة تحلية مياه",
      sectorEffects: { electricity: 1500, water: -24 },
      desc: "مفاعل نووي سلمي يولد 1500 نقطة كهرباء، يستهلك 24 نقطة ماء و24 عاملاً وتكلفة تشغيل -$1,000، حده مفاعل واحد لكل أمانة."
    }
  ];

  static createDefaultBuildings() {
    const data = {};
    this.RESOURCES_LIST.forEach(res => {
      data[res.id] = 0;
    });
    return data;
  }

  static getResource(id) {
    return this.RESOURCES_LIST.find(r => r.id === id) || null;
  }

  static getTotalHousingCapacity(country) {
    if (!country || !country.buildings) return 0;
    const b = country.buildings;
    return (
      (Number(b.house || 0) * 4) +
      (Number(b.house_large || 0) * 6) +
      (Number(b.palace || 0) * 10) +
      (Number(b.apartments || 0) * 50) +
      (Number(b.hotel || 0) * 100) +
      (Number(b.residential_towers || 0) * 300) +
      (Number(b.skyscrapers || 0) * 800)
    );
  }

  static getPoultryCapacity(country) {
    const farms = Number(country?.buildings?.poultry_farm || 0);
    const complexes = Number(country?.buildings?.poultry_complex || 0);
    const maxCapacity = (farms * 50) + (complexes * 1000);
    const current = Number(country?.buildings?.bird || 0);
    return {
      farms: farms + complexes,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static getLivestockCapacity(country) {
    const farms = Number(country?.buildings?.livestock_farm || 0);
    const complexes = Number(country?.buildings?.livestock_complex || 0);
    const maxCapacity = (farms * 20) + (complexes * 600);
    const current = Number(country?.buildings?.animal || 0);
    return {
      farms: farms + complexes,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static getMarinaCapacity(country) {
    const marinas = Number(country?.buildings?.marina || 0);
    const maxCapacity = marinas * 20;
    const current = Number(country?.buildings?.ship || 0);
    return {
      marinas: marinas,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static getSeaportCapacity(country) {
    const ports = Number(country?.buildings?.seaport || 0);
    const maxCapacity = ports * 100;
    const current = Number(country?.buildings?.cargo_ship_large || 0);
    return {
      ports: ports,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static getRegionalAirportCapacity(country) {
    const airports = Number(country?.buildings?.regional_airport || 0);
    const maxCapacity = airports * 20;
    const current = (Number(country?.buildings?.plane_50 || 0) + Number(country?.buildings?.plane_100 || 0));
    return {
      airports: airports,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static getIntlAirportCapacity(country) {
    const airports = Number(country?.buildings?.intl_airport || 0);
    const maxCapacity = airports * 100;
    const current = (Number(country?.buildings?.plane_200 || 0) + Number(country?.buildings?.plane_400 || 0));
    return {
      airports: airports,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static getTrainStationCapacity(country) {
    const stations = Number(country?.buildings?.train_station || 0);
    const maxCapacity = stations * 10;
    const current = (Number(country?.buildings?.train_cart_20 || 0) + Number(country?.buildings?.train_cart_40 || 0));
    return {
      stations: stations,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static getLargeTrainStationCapacity(country) {
    const stations = Number(country?.buildings?.train_station_large || 0);
    const maxCapacity = stations * 40;
    const current = (Number(country?.buildings?.train_cart_100 || 0) + Number(country?.buildings?.train_cart_200 || 0));
    return {
      stations: stations,
      max: maxCapacity,
      current: current,
      available: Math.max(0, maxCapacity - current)
    };
  }

  static checkPrerequisites(country, resourceId) {
    const res = this.getResource(resourceId);
    if (!res) return { satisfied: false, reason: "المورد غير موجود!" };

    const b = country.buildings || {};

    // 1. فحص سقوف وضوابط الطاقة النظيفة
    if (resourceId === "solar_farm") {
      const maxLimit = Number(country?.area || 0);
      const currentCount = Number(b.solar_farm || 0);
      if (currentCount >= maxLimit) {
        return { satisfied: false, reason: `أقصى حد لبناء الألواح الشمسية هو مساحة الدولة الحالية (${maxLimit})!` };
      }
    } else if (resourceId === "wind_station") {
      const maxLimit = Math.floor(Number(country?.area || 0) / 2);
      const currentCount = Number(b.wind_station || 0);
      if (currentCount >= maxLimit) {
        return { satisfied: false, reason: `أقصى حد لبناء محطات الرياح هو نصف مساحة الدولة (${maxLimit})!` };
      }
    } else if (resourceId === "nuclear_reactor") {
      const maxLimit = Number(b.governorate || 0);
      const currentCount = Number(b.nuclear_reactor || 0);
      if (currentCount >= maxLimit) {
        return { satisfied: false, reason: `يسمح ببناء مفاعل نووي واحد فقط لكل أمانة قائمة (${maxLimit})! أنشئ أمانة جديدة أولاً.` };
      }
    }

    // 2. قفل المراحل الصارم للمنشآت الرقمية
    const countryStage = Number(country?.stage) || 1;
    if (typeof res.stage === "number" && res.stage > countryStage) {
      return {
        satisfied: false,
        reason: `هذا المورد من موارد المرحلة (${res.stage})! يجب ترقية الدولة أولاً.`
      };
    }

    // 3. فحص الشروط المسبقة للبناء
    if (res.prerequisites && res.prerequisites.length > 0) {
      if (res.prerequisiteMode === "OR") {
        const hasAny = res.prerequisites.some(pId => (Number(b[pId]) || 0) > 0);
        if (!hasAny) {
          return { satisfied: false, reason: `يتطلب توفر أحدهما: ${res.prerequisiteText}` };
        }
      } else {
        const hasAll = res.prerequisites.every(pId => (Number(b[pId]) || 0) > 0);
        if (!hasAll) {
          return { satisfied: false, reason: `يتطلب توفر: ${res.prerequisiteText}` };
        }
      }
    }

    // 4. فحص السعات الاستيعابية اللوجستية
    if (res.capacityConsumes === "poultry") {
      const cap = this.getPoultryCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة مزارع ومجمعات الدواجن ممتلئة (${cap.current}/${cap.max})! أنشئ مزرعة أو مجمع دواجن جديد أولاً.` };
      }
    }

    if (res.capacityConsumes === "livestock") {
      const cap = this.getLivestockCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة مزارع ومجمعات المواشي ممتلئة (${cap.current}/${cap.max})! أنشئ مزرعة أو مجمع ماشية جديد أولاً.` };
      }
    }

    if (res.capacityConsumes === "marina") {
      const cap = this.getMarinaCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة المراسي البحرية ممتلئة (${cap.current}/${cap.max})! أنشئ مرسى بحري جديد أولاً.` };
      }
    }

    if (res.capacityConsumes === "seaport") {
      const cap = this.getSeaportCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة الميناء للبواخر ممتلئة (${cap.current}/${cap.max})! أنشئ ميناء بحري جديد أولاً.` };
      }
    }

    if (res.capacityConsumes === "airport_regional") {
      const cap = this.getRegionalAirportCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة المطار الإقليمي ممتلئة (${cap.current}/${cap.max})! أنشئ مطاراً إقليمياً جديداً أولاً.` };
      }
    }

    if (res.capacityConsumes === "airport_intl") {
      const cap = this.getIntlAirportCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة المطار الدولي ممتلئة (${cap.current}/${cap.max})! أنشئ مطاراً دولياً جديداً أولاً.` };
      }
    }

    if (res.capacityConsumes === "train_station") {
      const cap = this.getTrainStationCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة محطة القطار ممتلئة (${cap.current}/${cap.max})! أنشئ محطة قطار جديدة أولاً.` };
      }
    }

    if (res.capacityConsumes === "train_station_large") {
      const cap = this.getLargeTrainStationCapacity(country);
      if (cap.available <= 0) {
        return { satisfied: false, reason: `سعة محطة القطار* الدولية ممتلئة (${cap.current}/${cap.max})! أنشئ محطة قطار* جديدة أولاً.` };
      }
    }

    return { satisfied: true };
  }

  static purchaseResource(country, resourceId) {
    const res = this.getResource(resourceId);
    if (!res) return { success: false, msg: "المورد غير معرف!" };

    if (Number(country.disposableRevenue || 0) < res.price) {
      return { success: false, msg: `التحصيل المتاح ($${country.disposableRevenue}) لا يكفي لشراء ${res.name} بقيمة $${res.price}!` };
    }

    const prereq = this.checkPrerequisites(country, resourceId);
    if (!prereq.satisfied) {
      return { success: false, msg: prereq.reason };
    }

    if (res.populationType === "workforce") {
      const availableWorkforce = Number(country.unemployed || 0);
      if (availableWorkforce < res.populationValue) {
        return { success: false, msg: `لا توجد قوى عاملة شاغرة لتشغيل ${res.name}! يتطلب ${res.populationValue} عامل. وفر سكناً للمواطنين أولاً.` };
      }
    }

    country.disposableRevenue -= res.price;

    if (!country.buildings) country.buildings = this.createDefaultBuildings();
    country.buildings[res.id] = (Number(country.buildings[res.id]) || 0) + 1;

    country.sectorRevenues = this.calculateTotalRevenue(country);
    country.budget = country.sectorRevenues;

    if (res.populationType === "add") {
      country.population += res.populationValue;
    } else if (res.populationType === "workforce") {
      country.employed += res.populationValue;
    }

    if (res.id !== "bird" && res.id !== "animal") {
      country.area += 1;
    }

    if (res.sectorEffects) {
      if (!country.sectors) country.sectors = {};
      Object.keys(res.sectorEffects).forEach(sId => {
        country.sectors[sId] = (Number(country.sectors[sId]) || 0) + res.sectorEffects[sId];
      });
    }

    if (window.SectorsEngine && typeof window.SectorsEngine.recalculateCountrySectors === "function") {
      window.SectorsEngine.recalculateCountrySectors(country, window.currentWorld);
    }

    if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
      window.IndicatorsEngine.refreshCountryIndicators(country);
    }

    return { success: true, msg: `تم بناء وتشييد [${res.name}] بنجاح!` };
  }

  static demolishResource(country, resourceId) {
    const res = this.getResource(resourceId);
    if (!res) return { success: false, msg: "المورد غير موجود!" };

    const currentCount = Number(country.buildings?.[res.id] || 0);
    if (currentCount <= 0) {
      return { success: false, msg: `لا تمتلك أي وحدات من ${res.name} لإزالتها!` };
    }

    if (res.populationType === "add") {
      const newPop = country.population - res.populationValue;
      if (newPop < Number(country.employed || 0)) {
        return { success: false, msg: `لا يمكن هدم السكن! عدد العاملين الحاليين (${country.employed}) سيتجاوز إجمالي السكان بعد الهدم (${newPop}).` };
      }
    }

    if (res.id === "poultry_farm" || res.id === "poultry_complex") {
      const capDrop = res.id === "poultry_farm" ? 50 : 1000;
      const cap = this.getPoultryCapacity(country);
      if (cap.current > (cap.max - capDrop)) {
        return { success: false, msg: `لا يمكن الهدم! لديك ${cap.current} طائر بينما السعة بعد الهدم ستصبح ${cap.max - capDrop}. بادر بإزالة الطيور أولاً.` };
      }
    }

    if (res.id === "livestock_farm" || res.id === "livestock_complex") {
      const capDrop = res.id === "livestock_farm" ? 20 : 600;
      const cap = this.getLivestockCapacity(country);
      if (cap.current > (cap.max - capDrop)) {
        return { success: false, msg: `لا يمكن الهدم! لديك ${cap.current} حيوان بينما السعة بعد الهدم ستصبح ${cap.max - capDrop}. بادر بإزالة الحيوانات أولاً.` };
      }
    }

    if (res.id === "marina") {
      const cap = this.getMarinaCapacity(country);
      if (cap.current > (cap.max - 20)) {
        return { success: false, msg: `لا يمكن إزالة المرسى! لديك ${cap.current} سفينة بينما السعة بعد الإزالة ستصبح ${cap.max - 20}.` };
      }
    }

    if (res.id === "seaport") {
      const cap = this.getSeaportCapacity(country);
      if (cap.current > (cap.max - 100)) {
        return { success: false, msg: `لا يمكن إزالة الميناء! لديك ${cap.current} باخرة بينما السعة بعد الإزالة ستصبح ${cap.max - 100}.` };
      }
    }

    if (res.id === "regional_airport") {
      const cap = this.getRegionalAirportCapacity(country);
      if (cap.current > (cap.max - 20)) {
        return { success: false, msg: `لا يمكن إزالة المطار الإقليمي! لديك ${cap.current} طائرة بينما السعة بعد الإزالة ستصبح ${cap.max - 20}.` };
      }
    }

    if (res.id === "intl_airport") {
      const cap = this.getIntlAirportCapacity(country);
      if (cap.current > (cap.max - 100)) {
        return { success: false, msg: `لا يمكن إزالة المطار الدولي! لديك ${cap.current} طائرة بينما السعة بعد الإزالة ستصبح ${cap.max - 100}.` };
      }
    }

    if (res.id === "train_station") {
      const cap = this.getTrainStationCapacity(country);
      if (cap.current > (cap.max - 10)) {
        return { success: false, msg: `لا يمكن إزالة محطة القطار! لديك ${cap.current} عربة بينما السعة بعد الإزالة ستصبح ${cap.max - 10}.` };
      }
    }

    if (res.id === "train_station_large") {
      const cap = this.getLargeTrainStationCapacity(country);
      if (cap.current > (cap.max - 40)) {
        return { success: false, msg: `لا يمكن إزالة محطة القطار*! لديك ${cap.current} عربة بينما السعة بعد الإزالة ستصبح ${cap.max - 40}.` };
      }
    }

    country.buildings[res.id] -= 1;
    country.disposableRevenue += res.price;

    country.sectorRevenues = this.calculateTotalRevenue(country);
    country.budget = country.sectorRevenues;

    if (res.populationType === "add") {
      country.population = Math.max(0, country.population - res.populationValue);
    } else if (res.populationType === "workforce") {
      country.employed = Math.max(0, country.employed - res.populationValue);
    }

    if (res.id !== "bird" && res.id !== "animal") {
      country.area = Math.max(0, country.area - 1);
    }

    if (res.sectorEffects) {
      if (!country.sectors) country.sectors = {};
      Object.keys(res.sectorEffects).forEach(sId => {
        country.sectors[sId] = (Number(country.sectors[sId]) || 0) - res.sectorEffects[sId];
      });
    }

    if (window.SectorsEngine && typeof window.SectorsEngine.recalculateCountrySectors === "function") {
      window.SectorsEngine.recalculateCountrySectors(country, window.currentWorld);
    }

    if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
      window.IndicatorsEngine.refreshCountryIndicators(country);
    }

    return { success: true, msg: `تمت إزالة [${res.name}] واسترداد قيمتها ($${res.price}) بنجاح!` };
  }

  static calculateTotalRevenue(country) {
    if (!country || !country.buildings) return 0;
    let total = 0;
    this.RESOURCES_LIST.forEach(res => {
      const count = Number(country.buildings[res.id] || 0);
      total += count * res.revenue;
    });
    return total;
  }

  static checkStageCompletion(country, stageNumber) {
    // دعم تبويب الطاقة النظيفة المستقل
    if (stageNumber === "clean_energy") {
      const stageItems = this.RESOURCES_LIST.filter(r => r.stage === "clean_energy" || r.category === "clean_energy");
      if (!country || !country.buildings) {
        return { isComplete: false, ownedTypes: 0, totalTypes: stageItems.length, missing: stageItems.map(r => r.name) };
      }
      const missing = [];
      let ownedTypes = 0;
      stageItems.forEach(res => {
        const count = Number(country.buildings[res.id] || 0);
        if (count >= 1) ownedTypes += 1;
        else missing.push(res.name);
      });
      return {
        isComplete: (stageItems.length > 0) && (ownedTypes === stageItems.length),
        ownedTypes: ownedTypes,
        totalTypes: stageItems.length,
        missing: missing
      };
    }

    const stageItems = this.RESOURCES_LIST.filter(r => Number(r.stage) === Number(stageNumber));
    if (!country || !country.buildings) {
      return { isComplete: false, ownedTypes: 0, totalTypes: stageItems.length, missing: stageItems.map(r => r.name) };
    }

    const missing = [];
    let ownedTypes = 0;

    stageItems.forEach(res => {
      const count = Number(country.buildings[res.id] || 0);
      if (count >= 1) {
        ownedTypes += 1;
      } else {
        missing.push(res.name);
      }
    });

    return {
      isComplete: (stageItems.length > 0) && (ownedTypes === stageItems.length),
      ownedTypes: ownedTypes,
      totalTypes: stageItems.length,
      missing: missing
    };
  }

  static checkPhase1Completion(country) { return this.checkStageCompletion(country, 1); }
  static checkPhase2Completion(country) { return this.checkStageCompletion(country, 2); }
  static checkPhase3Completion(country) { return this.checkStageCompletion(country, 3); }
  static checkPhase4Completion(country) { return this.checkStageCompletion(country, 4); }

  static upgradeToStage(country, targetStage, world) {
    const currentStage = Number(country?.stage) || 1;

    if (targetStage !== currentStage + 1) {
      return { success: false, msg: `لا يمكن الترقية إلى المرحلة ${targetStage} مباشرة! الترقية تتم بالتتابع مرحلة تلو الأخرى.` };
    }

    const check = this.checkStageCompletion(country, currentStage);
    if (!check.isComplete) {
      return {
        success: false,
        msg: `لا يمكن الانتقال للمرحلة (${targetStage})! يجب توفر وحدة واحدة على الأقل من كل عنصر من عناصر المرحلة (${currentStage}) بالكامل. المتبقي: ${check.missing.join("، ")}`
      };
    }

    country.stage = targetStage;
    country.stageName = this.STAGE_NAMES[targetStage] || `المرحلة ${targetStage}`;

    if (world && typeof world.addHistoryEvent === "function") {
      world.addHistoryEvent(
        "political",
        `ترقية دولة ${country.name} رسمياً إلى المرحلة ${targetStage} (${country.stageName}) بعد استكمال كافة مقومات المرحلة ${currentStage}`,
        world.year
      );
    }

    return {
      success: true,
      msg: `تهانينا! تمت ترقية دولة ${country.name} رسمياً إلى المرحلة ${targetStage}: ${country.stageName}!`
    };
  }

  static upgradeToStage2(country, world) {
    return this.upgradeToStage(country, 2, world);
  }
}

window.BuildingsEngine = BuildingsEngine;