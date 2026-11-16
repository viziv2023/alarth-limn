/**
 * ============================================================================
 * world.js - محرك العالم الموحد وتدوير السنوات المالية والمحادثات والذكاء الاصطناعي (عصر الهيمنة - v7.0)
 * ============================================================================
 */

class World {
    constructor() {
        this.countries = [];
        this.history = [];
        this.chatMessages = []; // سجل المحادثات النصية بين اللاعبين في الروم الواحد
        this.year = 1;
        this.worldBankTreasury = 0;
        this.tradeDeals = [];
        this.tributes = []; // عقود الدية العسكرية الخمسية
        this.sovereignLoans = []; // عقود القروض السيادية المباشرة بين الدول
        this.alliances = []; // معاهدات التحالف والدفاع المشترك بين الدول
        this.aiTurnLogs = []; // سجل قرارات وأحداث الذكاء الاصطناعي في السنة الحالية
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

    advanceYear(options = {}) {
        this.year = (Number(this.year) || 1) + 1;

        // تحديث إجماليات الصادرات والواردات قبل تدوير السنة المالية
        if (window.TradeManager && typeof window.TradeManager.recalculateCountriesTrade === "function") {
            window.TradeManager.recalculateCountriesTrade(this);
        }

        this.countries.forEach(country => {
            country.year = this.year;

            // 1. إعادة إعمار وتجديد سكان البيوت والمجمعات والأبراج السكنية تلقائياً
            if (country.buildings) {
                let housingCapacity = 0;
                if (window.BuildingsEngine && typeof window.BuildingsEngine.getTotalHousingCapacity === "function") {
                    housingCapacity = window.BuildingsEngine.getTotalHousingCapacity(country);
                } else {
                    const b = country.buildings;
                    housingCapacity = (
                        (Number(b.house || 0) * 4) +
                        (Number(b.house_large || 0) * 6) +
                        (Number(b.palace || 0) * 10) +
                        (Number(b.apartments || 0) * 50) +
                        (Number(b.hotel || 0) * 100) +
                        (Number(b.residential_towers || 0) * 300) +
                        (Number(b.skyscrapers || 0) * 800)
                    );
                }

                if (housingCapacity > 0) {
                    country.population = housingCapacity;
                    country.unemployed = Math.max(0, country.population - (Number(country.employed) || 0));
                    country.unemploymentRate = country.population > 0 ? Math.round((country.unemployed / country.population) * 100) : 0;
                }
            }

            // 2. تدوير النظام المالي وعوائد المنشآت
            if (window.EconomyEngine && typeof window.EconomyEngine.advanceFinancialYear === "function") {
                window.EconomyEngine.advanceFinancialYear(country);
            } else {
                const rev = window.BuildingsEngine ? window.BuildingsEngine.calculateTotalRevenue(country) : 0;
                country.bank = (Number(country.bank) || 0) + (Number(country.disposableRevenue) || 0);
                country.budget = rev;
                const deduction = (country.year > 1 && country.budget > 0) ? Math.floor(country.budget * 0.05) : 0;
                country.lastWbCut = deduction;
                country.worldBankFund = Math.max(0, (Number(country.worldBankFund) || 0) + deduction);
                country.disposableRevenue = Math.max(0, country.budget - deduction);
            }

            // 3. تدوير الطاقة والمؤشرات
            if (window.EnergyEngine && typeof window.EnergyEngine.processYearEnd === "function") {
                window.EnergyEngine.processYearEnd(country);
            }

            if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
                window.MilitaryEngine.syncCountryWithMilitary(country);
            } else if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
                window.IndicatorsEngine.refreshCountryIndicators(country);
            }
        });

        // 4. تسوية عقود الدية السنوية، والبنك الدولي، والتبادل التجاري
        if (window.WarEngine && typeof window.WarEngine.processAnnualTributes === "function") {
            window.WarEngine.processAnnualTributes(this);
        }

        if (window.WorldBankManager && typeof window.WorldBankManager.processAnnualCycle === "function") {
            window.WorldBankManager.processAnnualCycle(this);
        }

        if (window.TradeManager && typeof window.TradeManager.processAnnualCycle === "function") {
            window.TradeManager.processAnnualCycle(this);
        }

        // 5. تنفيذ دور وقرارات المنافسين بالذكاء الاصطناعي (بناء، تسليح، شراء منتجات وتجارة، تحالفات، وهجمات عسكرية)
        this.lastAIWarAttackers = [];
        if (window.AIEngine && typeof window.AIEngine.processAllAITurns === "function") {
            const aiResult = window.AIEngine.processAllAITurns(this, options);
            if (aiResult && Array.isArray(aiResult.warAttackers)) {
                this.lastAIWarAttackers = aiResult.warAttackers;
            }
        }

        // إعادة تحديث المؤشرات بعد تسويات البنك والتجارة وقرارات الذكاء الاصطناعي
        this.countries.forEach(country => {
            if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
                window.IndicatorsEngine.refreshCountryIndicators(country);
            }
        });

        // 6. حفظ تلقائي فوري لكافة بيانات وإحصائيات الدول مع نهاية كل سنة مالية
        if (window.StorageManager && typeof window.StorageManager.autoSave === "function") {
            window.StorageManager.autoSave(this);
        }

        // إذا شن أحد المنافسين بالذكاء الاصطناعي هجوماً على دولة اللاعب، نطلق إنذار الحرب بعد لحظات
        if (this.lastAIWarAttackers && this.lastAIWarAttackers.length > 0 && window.WarView) {
            const attackEvent = this.lastAIWarAttackers[0];
            setTimeout(() => {
                if (window.WarView && typeof window.WarView.onNetworkUltimatumReceived === "function") {
                    window.WarView.onNetworkUltimatumReceived({
                        attackerCountryId: attackEvent.attacker.id,
                        attackerPlayerId: attackEvent.attacker.ownerPlayerId || "ai_attacker",
                        defenderCountryId: attackEvent.defender.id,
                        defenderPlayerId: attackEvent.defender.ownerPlayerId || "local_player",
                        atkCoalitionData: window.WarView.serializeCoalition(attackEvent.atkCoalition),
                        attackerMobStatus: "FULL"
                    });
                }
            }, 450);
        }

        return this.year;
    }

    addHistoryEvent(category, text, year, key = null) {
        if (!text) return;
        if (!Array.isArray(this.history)) this.history = [];
        this.history.unshift({
            category: category || "general",
            text: text,
            year: year || this.year || 1,
            ts: Date.now()
        });
        if (this.history.length > 80) {
            this.history = this.history.slice(0, 80);
        }
    }

    addChatMessage(msgObj) {
        if (!msgObj || !msgObj.text) return null;
        if (!Array.isArray(this.chatMessages)) this.chatMessages = [];
        const id = msgObj.id || ("msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000));
        if (this.chatMessages.some(m => m.id === id)) return null;

        const cleanMsg = {
            id: id,
            senderId: msgObj.senderId || "local",
            senderName: msgObj.senderName || "قائد سيادي",
            countryId: msgObj.countryId || null,
            countryName: msgObj.countryName || "",
            flag: msgObj.flag || null,
            text: String(msgObj.text).trim().substring(0, 400),
            year: msgObj.year || this.year || 1,
            isSystem: !!msgObj.isSystem,
            timestamp: msgObj.timestamp || Date.now()
        };

        this.chatMessages.push(cleanMsg);
        if (this.chatMessages.length > 150) {
            this.chatMessages = this.chatMessages.slice(-150);
        }
        return cleanMsg;
    }

    toJSON() {
        return {
            version: "1.5",
            savedAt: new Date().toISOString(),
            year: this.year,
            worldBankTreasury: this.worldBankTreasury,
            tradeDeals: this.tradeDeals || [],
            tributes: this.tributes || [],
            sovereignLoans: this.sovereignLoans || [],
            alliances: this.alliances || [],
            aiTurnLogs: this.aiTurnLogs || [],
            chatMessages: this.chatMessages || [],
            countries: this.countries.map(c => {
                if (c && typeof c.toJSON === "function") {
                    return c.toJSON();
                }
                return c;
            }),
            history: this.history || []
        };
    }

    static fromJSON(data) {
        const world = new World();
        world.year = (data && data.year) ? Number(data.year) : 1;
        world.worldBankTreasury = (data && data.worldBankTreasury !== undefined) ? Number(data.worldBankTreasury) : 0;
        world.tradeDeals = (data && Array.isArray(data.tradeDeals)) ? data.tradeDeals : [];
        world.tributes = (data && Array.isArray(data.tributes)) ? data.tributes : [];
        world.sovereignLoans = (data && Array.isArray(data.sovereignLoans)) ? data.sovereignLoans : [];
        world.alliances = (data && Array.isArray(data.alliances)) ? data.alliances : [];
        world.aiTurnLogs = (data && Array.isArray(data.aiTurnLogs)) ? data.aiTurnLogs : [];
        world.chatMessages = (data && Array.isArray(data.chatMessages)) ? data.chatMessages : [];
        world.history = (data && Array.isArray(data.history)) ? data.history : [];

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
        return world;
    }
}

window.World = World;
