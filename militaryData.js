class MilitaryData {
  static UNITS = [
    // ==========================================
    // 1. القوات البرية (16 صنفاً)
    // ==========================================
    // المشاة: يقاتلون براً ولديهم نيران دفاع ساحلي خفيفة ضد الزوارق والسفن القريبة
    { id: "infantry_def", name: "مشاة دفاعية", branch: "ground", price: 60, crew: 1, power: 0.6, capacity: 0, fuel: 0, ammo: 1, targetDomains: ["ground", "naval"], range: 180 },
    { id: "infantry_atk", name: "مشاة هجومية", branch: "ground", price: 50, crew: 1, power: 0.5, capacity: 0, fuel: 0, ammo: 1, targetDomains: ["ground", "naval"], range: 190 },
    { id: "troop_carrier", name: "ناقلة جنود", branch: "ground", price: 100, crew: 1, power: 0, capacity: 5, fuel: 1, ammo: 0, targetDomains: ["ground"], range: 100 },
    { id: "cannon", name: "مدفع", branch: "ground", price: 200, crew: 1, power: 2, capacity: 0, fuel: 0, ammo: 2, targetDomains: ["ground", "naval"], range: 350 },
    { id: "armored_carrier", name: "ناقلة مدرعة", branch: "ground", price: 400, crew: 1, power: 4, capacity: 5, fuel: 1, ammo: 0, targetDomains: ["ground", "naval"], range: 180 },
    { id: "auto_cannon", name: "مدفع آلي", branch: "ground", price: 400, crew: 1, power: 4, capacity: 0, fuel: 0, ammo: 2, targetDomains: ["ground", "naval", "air"], range: 300 },
    { id: "small_tank", name: "دبابة صغيرة", branch: "ground", price: 600, crew: 2, power: 6, capacity: 0, fuel: 1, ammo: 2, targetDomains: ["ground", "naval"], range: 240 },
    { id: "med_tank", name: "دبابة متوسطة", branch: "ground", price: 1000, crew: 2, power: 10, capacity: 0, fuel: 1, ammo: 3, targetDomains: ["ground", "naval"], range: 280 },
    { id: "small_mlrs", name: "راجمة صغيرة", branch: "ground", price: 1000, crew: 2, power: 10, capacity: 0, fuel: 1, ammo: 2, targetDomains: ["ground", "naval"], range: 380 },
    { id: "aa_tank", name: "دبابة مضادة للطائرات", branch: "ground", price: 4000, crew: 3, power: 50, capacity: 0, fuel: 1, ammo: 4, targetDomains: ["air", "ground"], range: 420 },
    { id: "as_tank", name: "دبابة مضادة للسفن", branch: "ground", price: 4000, crew: 3, power: 50, capacity: 0, fuel: 1, ammo: 4, targetDomains: ["naval", "ground"], range: 450 },
    { id: "rocket_launcher", name: "راجمة صواريخ", branch: "ground", price: 5000, crew: 3, power: 50, capacity: 0, fuel: 1, ammo: 5, targetDomains: ["ground", "naval"], range: 420 },
    { id: "military_base", name: "قاعدة عسكرية", branch: "ground", price: 5000, crew: 4, power: 0, capacity: 15, fuel: 0, ammo: 0, targetDomains: ["ground", "naval"], range: 150 },
    { id: "arms_factory", name: "مصنع أسلحة", branch: "ground", price: 5000, crew: 8, power: 0, capacity: 0, fuel: -200, ammo: 0, targetDomains: [], range: 0 },
    { id: "anti_rocket_launcher", name: "راجمة صواريخ مضادة", branch: "ground", price: 10000, crew: 4, power: 100, capacity: 0, fuel: 1, ammo: 10, targetDomains: ["air", "ground"], range: 460 },
    { id: "ammo_factory", name: "مصنع ذخيرة", branch: "ground", price: 2000, crew: 4, power: 0, capacity: 100, fuel: -100, ammo: -100, targetDomains: [], range: 0 },

    // ==========================================
    // 2. القوات البحرية (10 أصناف)
    // ==========================================
    { id: "naval_troop_carrier", name: "ناقلة جنود بحرية", branch: "naval", price: 400, crew: 1, power: 0, capacity: 5, fuel: 2, ammo: 0, targetDomains: ["naval", "ground"], range: 150 },
    // الطراد يمتلك مدافع ورشاشات تقصف البحر والشاطئ والجو
    { id: "war_corvette", name: "طراد حربي", branch: "naval", price: 500, crew: 1, power: 5, capacity: 0, fuel: 1, ammo: 1, targetDomains: ["naval", "ground", "air"], range: 320 },
    { id: "naval_gear_carrier", name: "ناقلة معدات حربية", branch: "naval", price: 1000, crew: 1, power: 0, capacity: 5, fuel: 2, ammo: 0, targetDomains: ["naval", "ground"], range: 150 },
    { id: "destroyer", name: "مدمرة", branch: "naval", price: 1500, crew: 2, power: 15, capacity: 0, fuel: 2, ammo: 5, targetDomains: ["naval", "ground", "air"], range: 380 },
    { id: "small_sub", name: "غواصة صغيرة", branch: "naval", price: 2000, crew: 2, power: 20, capacity: 0, fuel: 1, ammo: 4, targetDomains: ["naval", "ground"], range: 260 },
    { id: "frigate", name: "فرقاطة", branch: "naval", price: 3200, crew: 4, power: 32, capacity: 0, fuel: 2, ammo: 10, targetDomains: ["naval", "ground", "air"], range: 380 },
    { id: "aa_sub", name: "غواصة مضادة للطائرات", branch: "naval", price: 8000, crew: 4, power: 80, capacity: 0, fuel: 2, ammo: 8, targetDomains: ["air", "naval", "ground"], range: 420 },
    { id: "battleship", name: "بارجة", branch: "naval", price: 10000, crew: 8, power: 100, capacity: 0, fuel: 2, ammo: 15, targetDomains: ["naval", "ground", "air"], range: 500 },
    { id: "missile_sub", name: "غواصة قاذفة للصواريخ", branch: "naval", price: 8000, crew: 8, power: 80, capacity: 0, fuel: 2, ammo: 15, targetDomains: ["naval", "ground"], range: 480 },
    { id: "carrier", name: "حاملة صواريخ وطائرات", branch: "naval", price: 18000, crew: 12, power: 180, capacity: 10, fuel: 3, ammo: 0, targetDomains: ["air", "ground", "naval"], range: 520 },

    // ==========================================
    // 3. القوات الجوية (12 صنفاً)
    // ==========================================
    { id: "uav_attack", name: "بدون طيار - هجوم", branch: "air", price: 500, crew: 0, power: 5, capacity: 0, fuel: 1, ammo: 3, targetDomains: ["ground", "naval"], range: 280 },
    { id: "a10_ground", name: "إي 10 - أرض", branch: "air", price: 600, crew: 1, power: 6, capacity: 0, fuel: 2, ammo: 5, targetDomains: ["ground", "naval"], range: 300 },
    { id: "f15_attack", name: "إف 15 - هجوم", branch: "air", price: 1000, crew: 1, power: 10, capacity: 0, fuel: 2, ammo: 15, targetDomains: ["air", "ground", "naval"], range: 360 },
    { id: "su25_ground", name: "إس 25 - أرض", branch: "air", price: 2000, crew: 2, power: 20, capacity: 0, fuel: 2, ammo: 20, targetDomains: ["ground", "naval"], range: 320 },
    { id: "cargo_plane", name: "طائرة نقل", branch: "air", price: 1000, crew: 2, power: 0, capacity: 10, fuel: 2, ammo: 0, targetDomains: [], range: 0 },
    { id: "mig25_attack", name: "ميج 25 - هجوم", branch: "air", price: 2500, crew: 1, power: 25, capacity: 0, fuel: 2, ammo: 25, targetDomains: ["air", "ground", "naval"], range: 360 },
    { id: "f16_attack", name: "إف 16 - هجوم", branch: "air", price: 5000, crew: 1, power: 50, capacity: 0, fuel: 2, ammo: 20, targetDomains: ["air", "ground", "naval"], range: 380 },
    { id: "mig31_attack", name: "ميج 31 - هجوم", branch: "air", price: 6000, crew: 1, power: 60, capacity: 0, fuel: 2, ammo: 20, targetDomains: ["air", "ground", "naval"], range: 400 },
    { id: "mirage_attack", name: "ميراج - هجوم", branch: "air", price: 8000, crew: 1, power: 80, capacity: 0, fuel: 2, ammo: 15, targetDomains: ["air", "ground", "naval"], range: 400 },
    { id: "f35_attack", name: "إف 35 - هجوم", branch: "air", price: 30000, crew: 1, power: 300, capacity: 0, fuel: 2, ammo: 25, targetDomains: ["air", "ground", "naval"], range: 450 },
    { id: "c130_ground", name: "إتش 130 - أرض", branch: "air", price: 10000, crew: 5, power: 100, capacity: 0, fuel: 2, ammo: 30, targetDomains: ["ground", "naval"], range: 340 },
    { id: "air_base", name: "قاعدة جوية", branch: "air", price: 4000, crew: 4, power: 0, capacity: 20, fuel: 0, ammo: 0, targetDomains: [], range: 0 },

    // ==========================================
    // 4. قوات الدفاع ص ق (10 أصناف)
    // ==========================================
    { id: "naval_defense", name: "مضاد بحري", branch: "defense", price: 4000, crew: 0, power: 40, range: "10*10", destruction: "المثل أو أقل", fuel: 0, ammo: 5, targetDomains: ["naval", "ground"], combatRange: 450 },
    { id: "air_defense", name: "مضاد جوي", branch: "defense", price: 4000, crew: 0, power: 40, range: "10*10", destruction: "المثل أو أقل", fuel: 0, ammo: 5, targetDomains: ["air"], combatRange: 480 },
    { id: "scud_missile", name: "صاروخ سكود", branch: "defense", price: 4000, crew: 0, power: 40, range: "50", destruction: "7*7", fuel: 0, ammo: 0, targetDomains: ["ground", "naval"], combatRange: 500 },
    { id: "patriot_missile", name: "صاروخ باتريوت", branch: "defense", price: 8000, crew: 0, power: 80, range: "100", destruction: "15*15", fuel: 0, ammo: 0, targetDomains: ["air"], combatRange: 520 },
    { id: "anti_missile", name: "مضاد صواريخ", branch: "defense", price: 12000, crew: 0, power: 120, range: "15*15", destruction: "المثل أو أقل", fuel: 0, ammo: 5, targetDomains: ["air"], combatRange: 520 },
    { id: "cruise_missile", name: "صاروخ كروز", branch: "defense", price: 12000, crew: 0, power: 120, range: "200", destruction: "25*25", fuel: 0, ammo: 0, targetDomains: ["ground", "naval"], combatRange: 550 },
    { id: "nuclear_missile", name: "صاروخ نووي", branch: "defense", price: 200000, crew: 0, power: 2000, range: "400", destruction: "40*40", fuel: 0, ammo: 0, targetDomains: ["ground", "naval"], combatRange: 650 },
    { id: "moab_bomb", name: "أم القنابل", branch: "defense", price: 800000, crew: 0, power: 8000, range: "*", destruction: "50*50", fuel: 0, ammo: 0, targetDomains: ["ground", "naval"], combatRange: 700 },
    { id: "nuclear_bomb", name: "قنبلة نووية", branch: "defense", price: 2000000, crew: 0, power: 20000, range: "*", destruction: "70*70", fuel: 0, ammo: 0, targetDomains: ["ground", "naval"], combatRange: 800 },
    { id: "launch_pad", name: "منصة إطلاق", branch: "defense", price: 4000, crew: 2, power: 0, range: "*", destruction: "*", fuel: 0, ammo: 0, targetDomains: ["ground", "naval", "air"], combatRange: 500 }
  ];

  static getUnitById(id) {
    return this.UNITS.find(u => u.id === id);
  }

  static getUnitsByBranch(branch) {
    return this.UNITS.filter(u => u.branch === branch);
  }
}

window.MilitaryData = MilitaryData;