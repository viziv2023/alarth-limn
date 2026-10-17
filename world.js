/**
 * ============================================================================
 * world.js - محرك العالم الموحد وتدوير السنوات المالية (عصر الهيمنة - v4.6)
 * ============================================================================
 * 
 * المزايا البرمجية:
 * 1. تدوير السنة المالية العالمية وتحديث السكان والتشغيل تلقائياً.
 * 2. ترحيل الفوائض واقتطاعات البنك الدولي (5%) وتسوية عوائد المنشآت الـ 72.
 * 3. تسوية عقود الدية العسكرية الخمسية، والبنك الدولي، والتبادل التجاري.
 * 4. دعم التسلسل الكامل للبيانات (toJSON / fromJSON) للمزامنة اللحظية في شبكة P2P.
 * 5. الحفظ التلقائي الشامل في LocalStorage مع نهاية كل عام مالي.
 */

class World {
    constructor() {
        this.countries = [];
        this.history = [];
        this.year = 1;
        this.worldBankTreasury = 0;
        this.tradeDeals = [];
        this.tributes = []; // عقود الدية العسكرية الخمسية
        this.sovereignLoans = []; // عقود القروض السيادية المباشرة بين الدول
    }

    addCountry(country) {
        if (!country) return;
        country.year = this.year;
        this.countries.push(country);
    }

    getAllCountries() {
        return this.countries;
    }

    getCountryById(id) {
        if (!id) return null;
        return this.countries.find(c => String(c.id) === String(id)) || null;
    }

    advanceYear() {
        this.year += 1;

        this.countries.forEach(country => {
            country.year = this.year;

            // 1. إعادة إعمار وتجديد سكان البيوت والمجمعات والأبراج السكنية تلقائياً
            if (country.buildings) {
                let housingCapacity = 0;
                if (window.BuildingsEngine && typeof window.BuildingsEngine.getTotalHousingCapacity === "function") {
                    housingCapacity = window.BuildingsEngine.getTotalHousingCapacity(country);
                } else {
                    const h1 = Number(country.buildings.house || 0);
                    const h2 = Number(country.buildings.house_large || 0);
                    housingCapacity = (h1 * 4) + (h2 * 6);
                }

                if (housingCapacity > 0) {
                    // يعود إجمالي سكان الدولة كاملاً لسعة السكن الحقيقية القائمة
                    country.population = housingCapacity;
                    // العاطلون الجدد = إجمالي السكان - العاملين المتبقين في الجيش والمنشآت
                    country.unemployed = Math.max(0, country.population - (Number(country.employed) || 0));
                    country.unemploymentRate = country.population > 0 ? Math.round((country.unemployed / country.population) * 100) : 0;
                }
            }

            // 2. تدوير النظام المالي وعوائد المنشآت
            if (window.EconomyEngine) {
                if (typeof window.EconomyEngine.advanceFinancialYear === "function") {
                    window.EconomyEngine.advanceFinancialYear(country);
                } else if (typeof window.EconomyEngine.advanceYear === "function") {
                    window.EconomyEngine.advanceYear(country);
                } else if (typeof window.EconomyEngine.processYearEnd === "function") {
                    window.EconomyEngine.processYearEnd(country);
                } else {
                    const rev = window.BuildingsEngine ? window.BuildingsEngine.calculateTotalRevenue(country) : 0;
                    country.bank = (Number(country.bank) || 0) + (Number(country.disposableRevenue) || 0);
                    country.budget = rev;
                    const deduction = country.year > 1 ? Math.floor(country.budget * 0.05) : 0;
                    country.lastWbCut = deduction;
                    country.disposableRevenue = country.budget - deduction;
                }
            }

            // 3. تدوير الطاقة والمؤشرات
            if (window.EnergyEngine && typeof window.EnergyEngine.processYearEnd === "function") {
                window.EnergyEngine.processYearEnd(country);
            }

            if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
                window.IndicatorsEngine.refreshCountryIndicators(country);
            }
        });

        // 4. تسوية عقود الدية السنوية، والبنك الدولي (استثمار 25% من الاقتطاعات والقروض السيادية)، والتبادل التجاري
        if (window.WarEngine && typeof window.WarEngine.processAnnualTributes === "function") {
            window.WarEngine.processAnnualTributes(this);
        }

        if (window.WorldBankManager && typeof window.WorldBankManager.processAnnualCycle === "function") {
            window.WorldBankManager.processAnnualCycle(this);
        }

        if (window.TradeManager && typeof window.TradeManager.processAnnualCycle === "function") {
            window.TradeManager.processAnnualCycle(this);
        }

        this.addHistoryEvent(
            "economic",
            `بدء السنة المالية العالمية ${this.year}م وتجديد سكان البيوت وإعادة الإعمار وترحيل الفوائض السنوية`,
            this.year
        );

        // 5. حفظ تلقائي فوري لكافة بيانات وإحصائيات الدول مع نهاية كل سنة مالية
        if (window.StorageManager && typeof window.StorageManager.autoSave === "function") {
            window.StorageManager.autoSave(this);
        }

        return this.year;
    }

    addHistoryEvent(category, text, year, key = null) {
        if (key && this.history.some(h => h.key === key)) return;

        this.history.push({
            id: "evt_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            category: category,
            text: text,
            year: year || this.year,
            key: key || null,
            timestamp: Date.now()
        });
    }

    toJSON() {
        return {
            version: "1.2",
            savedAt: new Date().toISOString(),
            year: this.year,
            worldBankTreasury: this.worldBankTreasury,
            tradeDeals: this.tradeDeals,
            tributes: this.tributes,
            sovereignLoans: this.sovereignLoans || [],
            countries: this.countries.map(c => {
                if (c && typeof c.toJSON === "function") {
                    return c.toJSON();
                }
                return c;
            }),
            history: this.history
        };
    }

    static fromJSON(data) {
        const world = new World();
        world.year = (data && data.year) ? Number(data.year) : 1;
        world.worldBankTreasury = (data && data.worldBankTreasury) ? Number(data.worldBankTreasury) : 0;
        world.tradeDeals = (data && Array.isArray(data.tradeDeals)) ? data.tradeDeals : [];
        world.tributes = (data && Array.isArray(data.tributes)) ? data.tributes : [];
        world.sovereignLoans = (data && Array.isArray(data.sovereignLoans)) ? data.sovereignLoans : [];

        if (data && Array.isArray(data.countries)) {
            world.countries = data.countries.map(cData => {
                if (window.Country && typeof window.Country.fromJSON === "function") {
                    const c = window.Country.fromJSON(cData);
                    c.year = world.year;
                    return c;
                }
                cData.year = world.year;
                return cData;
            });
        }
        if (data && Array.isArray(data.history)) {
            world.history = data.history;
        }
        return world;
    }
}

window.World = World;