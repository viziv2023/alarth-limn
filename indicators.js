class IndicatorsEngine {
  static calculateUnemployed(population, employed) {
    return Math.max(0, Number(population) - Number(employed));
  }

  static calculateUnemploymentRate(population, unemployed) {
    if (Number(population) <= 0) return 0;
    return Number(((Number(unemployed) / Number(population)) * 100).toFixed(1));
  }

  static calculatePerCapitaIncome(budget, population) {
    if (Number(population) <= 0) return 0;
    return Number((Number(budget) / Number(population)).toFixed(2));
  }

  // تصحيح: المؤشر العام يساوي حصراً مجموع نقاط قطاعات الدولة
  // إن كانت كل القطاعات 0، فالمؤشر العام = 0 حتماً
  static calculateGeneralIndex(country) {
    const totalSectorPoints = window.SectorsEngine.calculateTotalSectorPoints(country);
    return Number(totalSectorPoints);
  }

  // قيمة العملة: إذا كان المؤشر العام 0 تكون قيمة العملة 0.00
  static calculateCurrencyValue(generalIndex, perCapitaIncome) {
    if (Number(generalIndex) <= 0) return 0.00;
    if (Number(perCapitaIncome) <= 0) return Number(generalIndex.toFixed(2));
    return Number((Number(generalIndex) / Number(perCapitaIncome)).toFixed(2));
  }

  static refreshCountryIndicators(country) {
    country.unemployed = this.calculateUnemployed(country.population, country.employed);
    country.unemploymentRate = this.calculateUnemploymentRate(country.population, country.unemployed);
    country.perCapitaIncome = this.calculatePerCapitaIncome(country.budget, country.population);
    
    // حساب المؤشر العام بناءً على قطاعات الدولة الفعلية
    country.generalIndex = this.calculateGeneralIndex(country);
    country.currencyValue = this.calculateCurrencyValue(country.generalIndex, country.perCapitaIncome);
  }
}

window.IndicatorsEngine = IndicatorsEngine;