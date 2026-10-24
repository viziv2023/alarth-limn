class Country {
  constructor(name, flagData) {
    this.id = "nation_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    this.name = name;
    this.flag = flagData;

    this.population = 0;
    this.employed = 0;
    this.civilianEmployed = 0;
    this.unemployed = 0;
    this.unemploymentRate = 0;
    this.area = 0;

    this.sectors = window.SectorsEngine ? window.SectorsEngine.createDefaultSectors() : {};
    if (window.EnergyEngine && typeof window.EnergyEngine.initCountryEnergy === "function") {
      window.EnergyEngine.initCountryEnergy(this);
    }

    // المنظومة العسكرية والأسلحة المبتكرة الخاصة بالدولة
    this.military = window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {}, totalPower: 0, totalCrew: 0, totalUnits: 0 };
    this.militaryPower = 0;
    this.militaryCrew = 0;
    this.militaryUnitsCount = 0;
    this.customUnits = []; // براءات الاختراع والأسلحة السيادية المصنعة

    // منظومة الموارد والمنشآت
    this.buildings = window.BuildingsEngine ? window.BuildingsEngine.createDefaultBuildings() : {};
    this.sectorRevenues = 0;

    this.generalIndex = 0;
    this.perCapitaIncome = 0;
    this.currencyValue = 1.0;

    this.stage = 1;
    this.stageName = "النشأة والتأسيس";

    // الميزانية تبدأ بصفر وتتراكم لحظياً مع عوائد المنشآت، والتحصيل المتاح يبدأ بـ 200
    this.budget = 0;
    this.disposableRevenue = 200;
    this.worldBankFund = 0; // يمثل رصيد المدخرات التراكمية من أرباح استثمار البنك الدولي
    this.lastWbCut = 0; // مبلغ اقتطاع الـ 5% في السنة الحالية
    this.bank = 0;
    this.exports = 0;
    this.imports = 0;
    this.year = 1;

    // منظومة ديون وقروض البنك الدولي
    this.wbDebt = 0;
    this.wbDebtDuration = 0;
    this.wbAnnualInstallment = 0;

    // بيانات ملكية اللاعب واللون العسكري
    this.ownerPlayerId = null;
    this.ownerPlayerName = null;
    this.militaryColor = null;
  }

  toJSON() {
    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(this);
    }
    return {
      id: this.id,
      name: this.name,
      flag: this.flag,
      population: this.population,
      employed: this.employed,
      civilianEmployed: this.civilianEmployed,
      unemployed: this.unemployed,
      unemploymentRate: this.unemploymentRate,
      area: this.area,
      sectors: this.sectors,
      energy: this.energy,
      military: this.military,
      militaryPower: this.militaryPower,
      militaryCrew: this.militaryCrew,
      militaryUnitsCount: this.militaryUnitsCount,
      customUnits: this.customUnits,
      buildings: this.buildings,
      sectorRevenues: this.sectorRevenues,
      generalIndex: this.generalIndex,
      perCapitaIncome: this.perCapitaIncome,
      currencyValue: this.currencyValue,
      stage: this.stage,
      stageName: this.stageName,
      budget: this.budget,
      disposableRevenue: this.disposableRevenue,
      worldBankFund: this.worldBankFund,
      lastWbCut: this.lastWbCut,
      bank: this.bank,
      exports: this.exports,
      imports: this.imports,
      year: this.year,
      wbDebt: this.wbDebt,
      wbDebtDuration: this.wbDebtDuration,
      wbAnnualInstallment: this.wbAnnualInstallment,
      ownerPlayerId: this.ownerPlayerId || null,
      ownerPlayerName: this.ownerPlayerName || null,
      militaryColor: this.militaryColor || null
    };
  }

  static fromJSON(data) {
    const country = new Country(data.name, data.flag);
    country.id = data.id || country.id;
    country.population = data.population ?? 0;
    country.employed = data.employed ?? 0;
    country.civilianEmployed = data.civilianEmployed ?? 0;
    country.unemployed = data.unemployed ?? 0;
    country.unemploymentRate = data.unemploymentRate ?? 0;
    country.area = data.area ?? 0;
    country.sectors = data.sectors || (window.SectorsEngine ? window.SectorsEngine.createDefaultSectors() : {});
    if (data.energy) {
      country.energy = data.energy;
    } else if (window.EnergyEngine && typeof window.EnergyEngine.initCountryEnergy === "function") {
      window.EnergyEngine.initCountryEnergy(country);
    }
    country.military = data.military || (window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {} });
    country.customUnits = Array.isArray(data.customUnits) ? data.customUnits : [];

    const defaultBldgs = window.BuildingsEngine ? window.BuildingsEngine.createDefaultBuildings() : {};
    country.buildings = Object.assign(defaultBldgs, data.buildings || {});

    country.sectorRevenues = data.sectorRevenues ?? 0;

    country.generalIndex = data.generalIndex ?? 0;
    country.perCapitaIncome = data.perCapitaIncome ?? 0;
    country.currencyValue = data.currencyValue ?? 1.0;

    country.stage = data.stage ?? 1;
    country.stageName = data.stageName ?? "النشأة والتأسيس";
    country.budget = data.budget ?? 0;
    country.disposableRevenue = data.disposableRevenue ?? 200;
    country.worldBankFund = data.worldBankFund ?? 0;
    country.lastWbCut = data.lastWbCut ?? 0;
    country.bank = data.bank ?? 0;
    country.exports = data.exports ?? 0;
    country.imports = data.imports ?? 0;
    country.year = data.year ?? 1;

    country.wbDebt = data.wbDebt ?? 0;
    country.wbDebtDuration = data.wbDebtDuration ?? 0;
    country.wbAnnualInstallment = data.wbAnnualInstallment ?? 0;

    country.ownerPlayerId = data.ownerPlayerId || null;
    country.ownerPlayerName = data.ownerPlayerName || null;
    country.militaryColor = data.militaryColor || null;

    // تسجيل أي أسلحة خاصة بهذه الدولة فورياً في قاعدة بيانات الأسلحة
    if (window.WeaponForge && Array.isArray(country.customUnits)) {
      country.customUnits.forEach(u => window.WeaponForge.registerUnitToGame(u));
    }

    // مزامنة الإحصائيات العسكرية فور استرجاع بيانات الدولة
    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(country);
    }

    return country;
  }
}

window.Country = Country;
