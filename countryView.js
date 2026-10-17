/**
 * ============================================================================
 * countryView.js - واجهة تفاصيل وإدارة الدولة المستقلة (عصر الهيمنة - Pure ES6)
 * ============================================================================
 * 
 * المزايا المحدثة:
 * 1. توافق تام بنسبة 100% مع معايير Pure ES6 القياسية وحل كافة أخطاء بناء الجملة (Syntax Errors).
 * 2. حماية سرية وخصوصية بطاقات الدول: منع أي لاعب في الغرفة من فتح أو إدارة بطاقة لاعب آخر.
 * 3. مزامنة فورية لكافة عمليات البناء والهدم والترقية وسحب الأموال عبر الشبكة (P2P).
 * 4. عدادات وأمبيرات القطاعات الـ 16 التنازلية مهيأة بالكامل للمس على الهواتف.
 */

window.currentViewingCountry = null;
window.currentBuildingTab = 1;

// دالة مساعدة للوصول لكائن الدولة سواء تم تمرير كائن أو ID أو اسم
function resolveCountryObject(target) {
    if (!target) return null;
    if (typeof target === "object" && (target.id || target.name)) return target;

    const searchKey = String(target).trim();
    if (window.currentWorld && Array.isArray(window.currentWorld.countries)) {
        const found = window.currentWorld.countries.find(function(c) {
            return String(c.id) === searchKey || String(c.name) === searchKey;
        });
        if (found) return found;
    }
    return null;
}

class CountryViewController {
    static init() {
        this.setupNavigationButtons();
        this.setupBuildingTabs();
        this.setupFinancialActions();
        this.setupDonationModal();
        this.setupStageUpgradeButton();
        this.setupTableClickListener();
    }

    // دعم النقر المباشر على بطاقات وكروت الدول
    static setupTableClickListener() {
        const grid = document.getElementById("nations-cards-grid") || document.getElementById("nations-table-body");
        if (!grid) return;

        grid.addEventListener("click", function(e) {
            const card = e.target.closest(".nation-sovereign-card") || e.target.closest("tr");
            if (!card) return;

            const btnElem = e.target.closest("button");
            const btnId = btnElem ? btnElem.getAttribute("data-id") : null;
            const datasetId = (card.dataset && card.dataset.countryId) ? card.dataset.countryId : null;
            const countryId = card.getAttribute("data-id") || datasetId || btnId;

            if (countryId) {
                CountryViewController.open(countryId);
            }
        });
    }

    static setupNavigationButtons() {
        const btnBack = document.getElementById("btn-back-to-world");
        if (btnBack) {
            btnBack.onclick = function() {
                const screens = document.querySelectorAll(".screen");
                for (let i = 0; i < screens.length; i++) {
                    screens[i].classList.remove("active");
                }
                const dash = document.getElementById("game-dashboard");
                if (dash) dash.classList.add("active");

                if (window.renderNationsTable) {
                    window.renderNationsTable();
                }
            };
        }

        // زر رؤية العاصمة ثلاثية الأبعاد Low-Poly
        const btnCapital = document.getElementById("btn-open-capital");
        if (btnCapital) {
            btnCapital.onclick = function() {
                const country = window.currentViewingCountry;
                if (!country) return;
                if (window.CapitalView && typeof window.CapitalView.open === "function") {
                    window.CapitalView.open(country);
                }
            };
        }

        // زر قيادة القوات المسلحة والجيش
        const btnMilHQ = document.getElementById("btn-open-military-hq");
        if (btnMilHQ) {
            btnMilHQ.onclick = function() {
                const country = window.currentViewingCountry;
                if (!country) return;

                const screens = document.querySelectorAll(".screen");
                for (let i = 0; i < screens.length; i++) {
                    screens[i].classList.remove("active");
                }
                const milScreen = document.getElementById("military-screen");
                if (milScreen) milScreen.classList.add("active");

                const nameEl = document.getElementById("mil-country-name");
                if (nameEl) nameEl.textContent = "وزارة الدفاع والقيادة العامة - " + country.name;

                const fundsEl = document.getElementById("mil-disposable-funds");
                if (fundsEl) fundsEl.textContent = "$" + Number(country.disposableRevenue || 0).toLocaleString();

                const popEl = document.getElementById("mil-population-count");
                if (popEl) popEl.textContent = Number(country.unemployed || 0).toLocaleString() + " متاح للتجنيد";

                if (window.MilitaryView) {
                    if (typeof window.MilitaryView.show === "function") {
                        window.MilitaryView.show(country);
                    } else if (typeof window.MilitaryView.open === "function") {
                        window.MilitaryView.open(country);
                    } else if (typeof window.MilitaryView.render === "function") {
                        window.MilitaryView.render(country);
                    }
                }
                if (typeof window.showMilitaryScreen === "function") {
                    window.showMilitaryScreen(country);
                }
            };
        }

        // زر العودة من شاشة الجيش إلى شاشة تفاصيل الدولة
        const btnBackFromMil = document.getElementById("btn-back-from-military");
        if (btnBackFromMil) {
            btnBackFromMil.onclick = function() {
                const screens = document.querySelectorAll(".screen");
                for (let i = 0; i < screens.length; i++) {
                    screens[i].classList.remove("active");
                }
                const detailScreen = document.getElementById("country-detail-screen");
                if (detailScreen) detailScreen.classList.add("active");

                if (window.currentViewingCountry) {
                    CountryViewController.render(window.currentViewingCountry);
                }
            };
        }
    }

    static setupBuildingTabs() {
        const tabs = [
            { id: "btn-tab-stage1", tab: 1 },
            { id: "btn-tab-stage2", tab: 2 },
            { id: "btn-tab-stage3", tab: 3 },
            { id: "btn-tab-stage4", tab: 4 },
            { id: "btn-tab-stage5", tab: 5 },
            { id: "btn-tab-clean-energy", tab: "clean_energy" }
        ];

        tabs.forEach(function(t) {
            const btn = document.getElementById(t.id);
            if (!btn) return;

            btn.onclick = function() {
                tabs.forEach(function(other) {
                    const b = document.getElementById(other.id);
                    if (b) {
                        b.classList.remove("active");
                        b.classList.remove("btn-primary");
                        b.classList.add("btn-secondary");
                    }
                });

                btn.classList.add("active");
                btn.classList.remove("btn-secondary");
                btn.classList.add("btn-primary");

                window.currentBuildingTab = t.tab;
                if (window.currentViewingCountry) {
                    CountryViewController.renderBuildingsTable(window.currentViewingCountry, t.tab);
                }
            };
        });
    }

    static setupFinancialActions() {
        // سحب كامل الرصيد من البنك الوطني
        const btnWithdrawAll = document.getElementById("btn-action-withdraw-all");
        if (btnWithdrawAll) {
            btnWithdrawAll.onclick = function() {
                const c = window.currentViewingCountry;
                if (!c) return;
                const bankVal = Number(c.bank !== undefined ? c.bank : (c.bankBalance || 0));
                if (bankVal <= 0) {
                    if (window.showGameToast) window.showGameToast("رصيد البنك الوطني فارغ حالياً!", "⚠️");
                    else alert("رصيد البنك الوطني فارغ حالياً!");
                    return;
                }
                c.disposableRevenue = Number(c.disposableRevenue || 0) + bankVal;
                c.bank = 0;
                c.bankBalance = 0;

                CountryViewController.render(c);
                if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
                if (window.showGameToast) window.showGameToast("تم سحب $" + bankVal.toLocaleString() + " بالكامل!", "💰");
            };
        }

        // سحب جزئي من البنك الوطني
        const btnWithdrawPart = document.getElementById("btn-action-withdraw-partial");
        if (btnWithdrawPart) {
            btnWithdrawPart.onclick = function() {
                const c = window.currentViewingCountry;
                if (!c) return;
                const bankVal = Number(c.bank !== undefined ? c.bank : (c.bankBalance || 0));
                if (bankVal <= 0) {
                    if (window.showGameToast) window.showGameToast("رصيد البنك الوطني فارغ حالياً!", "⚠️");
                    else alert("رصيد البنك الوطني فارغ حالياً!");
                    return;
                }
                const val = prompt("أدخل المبلغ المطلوب سحبه من البنك (المتاح: $" + bankVal.toLocaleString() + "):", "500");
                const amount = Math.floor(Number(val));
                if (isNaN(amount) || amount <= 0) return;

                if (amount > bankVal) {
                    alert("المبلغ المدخل أكبر من الرصيد المتوفر في البنك!");
                    return;
                }

                const remaining = bankVal - amount;
                c.bank = remaining;
                c.bankBalance = remaining;
                c.disposableRevenue = Number(c.disposableRevenue || 0) + amount;

                CountryViewController.render(c);
                if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
            };
        }

        // سحب أموال الطوارئ من مدخرات البنك الدولي
        const btnEmergency = document.getElementById("btn-action-worldbank-emergency");
        if (btnEmergency) {
            btnEmergency.onclick = function() {
                const c = window.currentViewingCountry;
                if (!c) return;

                const availableSavings = Math.max(0, Number(c.worldBankFund) || 0);
                if (availableSavings <= 0) {
                    alert("لا توجد مدخرات متاحة لدولة " + c.name + " في البنك الدولي للسحب!");
                    return;
                }

                const input = prompt(
                    "أدخل المبلغ المطلوب سحبه من رصيد المدخرات في البنك الدولي لدولة " + c.name + "\n(الرصيد المتاح للسحب: $" + availableSavings.toLocaleString() + "):",
                    String(availableSavings)
                );

                if (input === null) return;

                const amount = Math.floor(Number(input));
                if (isNaN(amount) || amount <= 0) {
                    alert("يرجى إدخال مبلغ صحيح أكبر من الصفر!");
                    return;
                }

                let res;
                if (window.EconomyEngine && typeof window.EconomyEngine.emergencyWithdrawFromWorldBank === "function") {
                    res = window.EconomyEngine.emergencyWithdrawFromWorldBank(c, amount);
                } else {
                    if (amount > availableSavings) {
                        res = { success: false, msg: "المبلغ المطلوب يتجاوز رصيد المدخرات المتوفر ($" + availableSavings.toLocaleString() + ")!" };
                    } else {
                        c.worldBankFund = availableSavings - amount;
                        c.disposableRevenue = (Number(c.disposableRevenue) || 0) + amount;
                        res = { success: true, msg: "تم بنجاح سحب $" + amount.toLocaleString() + " من المدخرات وإيداعها في التحصيل المتاح!" };
                    }
                }

                alert(res.msg);
                if (res.success) {
                    CountryViewController.render(c);
                    if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
                    if (window.renderNationsTable) window.renderNationsTable();
                }
            };
        }

        // فتح نافذة تقديم التبرع
        const btnDonate = document.getElementById("btn-action-donate");
        if (btnDonate) {
            btnDonate.onclick = function() {
                CountryViewController.openDonationModal();
            };
        }
    }

    static setupDonationModal() {
        const modal = document.getElementById("modal-donate-aid");
        if (!modal) return;

        const btnCancel = document.getElementById("btn-cancel-donation");
        if (btnCancel) {
            btnCancel.onclick = function() {
                modal.classList.remove("active");
            };
        }

        const btnMax = document.getElementById("btn-donate-max");
        if (btnMax) {
            btnMax.onclick = function() {
                const c = window.currentViewingCountry;
                if (!c) return;
                const input = document.getElementById("donate-amount-input");
                if (input) input.value = Math.max(0, Number(c.disposableRevenue || 0));
            };
        }

        const quickBtns = modal.querySelectorAll(".donate-quick-btn");
        quickBtns.forEach(function(b) {
            b.onclick = function() {
                const addVal = Number(b.getAttribute("data-val") || 0);
                const input = document.getElementById("donate-amount-input");
                if (input) {
                    const cur = Number(input.value || 0);
                    input.value = cur + addVal;
                }
            };
        });

        const btnConfirm = document.getElementById("btn-confirm-donation");
        if (btnConfirm) {
            btnConfirm.onclick = function() {
                const sender = window.currentViewingCountry;
                if (!sender) return;

                const select = document.getElementById("donate-recipient-select");
                if (!select || !select.value) {
                    alert("يرجى اختيار الدولة المستفيدة من المساعدة المالية!");
                    return;
                }

                const recipient = resolveCountryObject(select.value);
                if (!recipient) {
                    alert("تعذر العثور على الدولة المستفيدة المحددة!");
                    return;
                }

                const input = document.getElementById("donate-amount-input");
                const amount = Math.floor(Number(input ? input.value : 0));

                if (isNaN(amount) || amount <= 0) {
                    alert("يرجى إدخال مبلغ صحيح أكبر من الصفر!");
                    return;
                }

                const res = window.EconomyEngine.sendDonation(sender, recipient, amount);
                alert(res.msg);

                if (res.success) {
                    modal.classList.remove("active");
                    CountryViewController.render(sender);
                    if (window.NetworkEngine) {
                        window.NetworkEngine.syncCountryChanges(sender);
                        window.NetworkEngine.syncCountryChanges(recipient);
                    }
                    if (window.renderNationsTable) window.renderNationsTable();
                }
            };
        }
    }

    static openDonationModal() {
        const c = window.currentViewingCountry;
        if (!c) return;

        const modal = document.getElementById("modal-donate-aid");
        if (!modal) return;

        const donorName = document.getElementById("donate-donor-name");
        if (donorName) donorName.value = c.name;

        const availFunds = document.getElementById("donate-available-funds");
        if (availFunds) availFunds.textContent = "$" + Number(c.disposableRevenue || 0).toLocaleString();

        const input = document.getElementById("donate-amount-input");
        if (input) input.value = "";

        const select = document.getElementById("donate-recipient-select");
        if (select && window.currentWorld && Array.isArray(window.currentWorld.countries)) {
            select.innerHTML = "";
            const otherCountries = window.currentWorld.countries.filter(function(other) {
                return other.id !== c.id && other.name !== c.name;
            });

            if (otherCountries.length === 0) {
                select.innerHTML = '<option value="">لا توجد دول أخرى في العالم لتقديم المساعدة لها</option>';
            } else {
                otherCountries.forEach(function(other) {
                    const opt = document.createElement("option");
                    opt.value = other.id || other.name;
                    opt.textContent = other.name + " (التحصيل الحالي: $" + Number(other.disposableRevenue || 0).toLocaleString() + ")";
                    select.appendChild(opt);
                });
            }
        }

        modal.classList.add("active");
    }

    static setupStageUpgradeButton() {
        const btnUpgrade = document.getElementById("btn-upgrade-stage");
        if (btnUpgrade) {
            btnUpgrade.onclick = function() {
                const c = window.currentViewingCountry;
                if (!c) return;
                const currentStage = Number(c.stage) || 1;
                const targetStage = currentStage + 1;
                const res = BuildingsEngine.upgradeToStage(c, targetStage, window.currentWorld);
                alert(res.msg);
                if (res.success) {
                    CountryViewController.render(c);
                    if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
                }
            };
        }
    }

    static open(target) {
        const country = resolveCountryObject(target);
        if (!country) return;

        if (window.NetworkEngine && typeof window.NetworkEngine.canControlCountry === "function") {
            const hasAccess = window.NetworkEngine.canControlCountry(country.id);
            if (!hasAccess) {
                if (window.showGameToast) {
                    window.showGameToast("🔒 دولة \"" + country.name + "\" خاصة بقائد آخر! لا يمكنك الاطلاع على بطاقتها الخاصة أو إدارتها.", "🛡️");
                } else {
                    alert("🔒 دولة \"" + country.name + "\" خاصة بقائد آخر! لا يمكنك الاطلاع على بطاقتها الخاصة أو إدارتها.");
                }
                return;
            }
        }

        window.currentViewingCountry = country;

        const screens = document.querySelectorAll(".screen");
        for (let i = 0; i < screens.length; i++) {
            screens[i].classList.remove("active");
        }
        const screen = document.getElementById("country-detail-screen");
        if (screen) screen.classList.add("active");

        this.render(country);
    }

    static show(target) {
        this.open(target);
    }

    static render(country) {
        if (!country) return;

        const nameEl = document.getElementById("detail-country-name");
        if (nameEl) nameEl.textContent = country.name || "--";

        const stageEl = document.getElementById("detail-country-stage");
        if (stageEl) stageEl.textContent = country.stageName || ("المرحلة " + (country.stage || 1));

        const yearEl = document.getElementById("detail-year");
        const currentYear = (window.currentWorld && window.currentWorld.year) ? window.currentWorld.year : (country.year || 1);
        if (yearEl) yearEl.textContent = "السنة المالية العالمية: " + currentYear + "م";

        const milPower = (country.military && typeof country.military.totalPower === "number") ?
            country.military.totalPower :
            (country.militaryPower || 0);
        const topMil = document.getElementById("top-military-power-badge");
        if (topMil) topMil.textContent = "القوة: " + Number(milPower).toLocaleString();

        const flagBox = document.getElementById("detail-flag-box");
        if (flagBox) {
            flagBox.innerHTML = "";
            let rendered = false;

            if (window.FlagEditor && typeof window.FlagEditor.renderFlag === "function") {
                window.FlagEditor.renderFlag(flagBox, country.flag);
                rendered = flagBox.children.length > 0;
            }

            if (!rendered && Array.isArray(country.flag) && country.flag.length > 0) {
                flagBox.style.display = "grid";
                flagBox.style.gridTemplateColumns = "repeat(4, 1fr)";
                flagBox.style.gridTemplateRows = "repeat(3, 1fr)";
                flagBox.style.gap = "2px";
                flagBox.style.width = "100%";
                flagBox.style.height = "140px";
                flagBox.style.borderRadius = "8px";
                flagBox.style.overflow = "hidden";
                flagBox.style.border = "1px solid #334155";
                flagBox.style.background = "#0f172a";

                country.flag.forEach(function(col) {
                    const cell = document.createElement("div");
                    cell.style.background = col || "#1e293b";
                    cell.style.width = "100%";
                    cell.style.height = "100%";
                    flagBox.appendChild(cell);
                });
            }
        }

        const idxEl = document.getElementById("detail-general-index");
        if (idxEl) idxEl.textContent = Number(country.generalIndex || 0).toLocaleString() + " نقطة";

        const currEl = document.getElementById("detail-currency-val");
        if (currEl) currEl.textContent = Number(country.currencyValue || 1).toFixed(2);

        const capEl = document.getElementById("detail-per-capita");
        if (capEl) capEl.textContent = "$" + Number(country.perCapitaIncome || 0).toLocaleString();

        const areaEl = document.getElementById("detail-area");
        if (areaEl) areaEl.textContent = Number(country.area || 0).toLocaleString() + " نقطة";

        const pop = Number(country.population || 0);
        const emp = Number(country.employed || 0);
        const unemp = Math.max(0, pop - emp);
        country.unemployed = unemp;

        const popEl = document.getElementById("detail-population");
        if (popEl) popEl.textContent = pop.toLocaleString() + " نسمة";

        const empEl = document.getElementById("detail-employed");
        if (empEl) empEl.textContent = emp.toLocaleString() + " فرد";

        const unempEl = document.getElementById("detail-unemployed");
        if (unempEl) unempEl.textContent = unemp.toLocaleString() + " فرد";

        const unempRateEl = document.getElementById("detail-unemployment-rate");
        if (unempRateEl) {
            const rate = pop > 0 ? ((unemp / pop) * 100).toFixed(1) : 0;
            unempRateEl.textContent = rate + "%";
        }

        const budEl = document.getElementById("val-budget");
        if (budEl) budEl.textContent = "$" + Number(country.budget || 0).toLocaleString();

        const revEl = document.getElementById("val-revenue");
        if (revEl) revEl.textContent = "$" + Number(country.disposableRevenue || 0).toLocaleString();

        const currentBankVal = Number(c => c !== undefined ? c : 0)(country.bank !== undefined ? country.bank : (country.bankBalance || 0));
        const bankEl = document.getElementById("val-bank");
        if (bankEl) bankEl.textContent = "$" + currentBankVal.toLocaleString();

        const currentWbVal = Math.max(0, Number(country.worldBankFund !== undefined ? country.worldBankFund : (country.worldBankDeposit || 0)));
        const wbEl = document.getElementById("val-worldbank");
        if (wbEl) wbEl.textContent = "$" + currentWbVal.toLocaleString();

        const expEl = document.getElementById("val-exports");
        if (expEl) expEl.textContent = "$" + Number(country.exports !== undefined ? country.exports : (country.exportsTotal || 0)).toLocaleString();

        const impEl = document.getElementById("val-imports");
        if (impEl) impEl.textContent = "$" + Number(country.imports !== undefined ? country.imports : (country.importsTotal || 0)).toLocaleString();

        const totRevBadge = document.getElementById("bldg-total-revenue-badge");
        if (totRevBadge) {
            const totRev = BuildingsEngine.calculateTotalRevenue(country);
            totRevBadge.textContent = "عوائد المنشآت: $" + totRev.toLocaleString() + " / سنة";
        }

        this.renderBuildingsTable(country, window.currentBuildingTab || 1);
        this.renderEnergySection(country);
        this.renderSectorsGrid(country);
    }

    static renderBuildingsTable(country, selectedTab) {
        if (selectedTab === undefined) selectedTab = 1;
        const tbody = document.getElementById("buildings-tbody");
        const btnUpgrade = document.getElementById("btn-upgrade-stage");
        const progTxt = document.getElementById("bldg-stage-progress-text");
        if (!tbody || !country) return;

        tbody.innerHTML = "";

        if (selectedTab === "clean_energy") {
            if (progTxt) progTxt.textContent = "🌱 منظومة الطاقة النظيفة المستقلة (شمسية، رياح، مفاعلات نووية)";
            if (btnUpgrade) btnUpgrade.style.display = "none";
        } else {
            if (btnUpgrade) btnUpgrade.style.display = "inline-block";
            const comp = BuildingsEngine.checkStageCompletion(country, selectedTab);
            if (progTxt) {
                progTxt.textContent = "اكتمال متطلبات المرحلة " + selectedTab + ": " + comp.ownedTypes + " من أصل " + comp.totalTypes;
            }

            const countryStage = Number(country.stage) || 1;
            if (btnUpgrade) {
                if (countryStage === selectedTab && comp.isComplete) {
                    btnUpgrade.disabled = false;
                    btnUpgrade.className = "btn btn-pulse-upgrade btn-primary";
                    btnUpgrade.textContent = "✨ الترقية للمرحلة " + (countryStage + 1);
                } else {
                    btnUpgrade.disabled = true;
                    btnUpgrade.className = "btn btn-secondary";
                    btnUpgrade.textContent = "🔒 الترقية للمرحلة " + (countryStage + 1);
                }
            }
        }

        const resources = BuildingsEngine.RESOURCES_LIST.filter(function(res) {
            if (selectedTab === "clean_energy") {
                return res.stage === "clean_energy" || res.category === "clean_energy";
            }
            return Number(res.stage) === Number(selectedTab);
        });

        if (resources.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px; color:#a0aec0;">لا توجد منشآت لعرضها في هذا القسم.</td></tr>';
            return;
        }

        resources.forEach(function(res) {
            const ownedCount = Number((country.buildings && country.buildings[res.id]) ? country.buildings[res.id] : 0);
            const prereq = BuildingsEngine.checkPrerequisites(country, res.id);
            const canAfford = Number(country.disposableRevenue || 0) >= res.price;

            let elecBonus = 0;
            if (res.sectorEffects && res.sectorEffects.electricity > 0) {
                elecBonus = res.sectorEffects.electricity;
            }
            const elecText = res.electricityNeed ? String(res.electricityNeed) : (elecBonus > 0 ? "+" + elecBonus : "0");
            const popText = res.populationType === "workforce" ? ("👷 " + res.populationValue) : (res.populationType === "add" ? ("🏠 +" + res.populationValue) : "-");

            const tr = document.createElement("tr");
            tr.innerHTML = `
        <td>
          <div class="td-bldg-name">
            <span class="bldg-ico">${res.icon}</span>
            <div>
              <strong>${res.name}</strong>
              <span class="bldg-subdesc">${res.desc}</span>
            </div>
          </div>
        </td>
        <td class="td-center"><span class="price-val">$${res.price.toLocaleString()}</span></td>
        <td class="td-center"><span class="${res.revenue >= 0 ? 'rev-val' : 'price-val'}">${res.revenue >= 0 ? '+$' + res.revenue : '-$' + Math.abs(res.revenue)}</span></td>
        <td class="td-center">${popText}</td>
        <td class="td-center">
          <span class="tag-util util-elec">⚡ ${elecText}</span>
          <span class="tag-util util-water">💧 ${res.waterNeed || 0}</span>
        </td>
        <td class="td-center">${res.satisfiesBase > 0 ? (res.satisfiesBase + ' ' + res.satisfiesUnit) : '-'}</td>
        <td class="td-center">${res.capacityBase > 0 ? (res.capacityBase + ' ' + res.capacityUnit) : '-'}</td>
        <td class="td-center">
          <span class="tag-status ${prereq.satisfied ? 'tag-ok' : 'tag-missing'}">
            ${res.prerequisiteText || 'لا يوجد'}
          </span>
        </td>
        <td class="td-center">
          <strong class="${ownedCount > 0 ? 'count-owned' : 'count-zero'}">${ownedCount}</strong>
        </td>
        <td class="td-center">
          <div class="action-btn-group">
            <button class="${prereq.satisfied && canAfford ? 'btn-buy-active' : 'btn-buy-disabled'}" 
                    onclick="handleBuyResource('${res.id}')" 
                    ${!prereq.satisfied || !canAfford ? 'disabled' : ''}>
              شراء
            </button>
            <button class="btn-demolish" 
                    onclick="handleDemolishResource('${res.id}')" 
                    ${ownedCount <= 0 ? 'disabled' : ''}>
              إزالة
            </button>
          </div>
        </td>
      `;
            tbody.appendChild(tr);
        });
    }

    static renderEnergySection(country) {
        const b = country.buildings || {};
        const e = country.energy || {};

        const eIdx = document.getElementById("val-energy-index");
        if (eIdx) eIdx.textContent = Number(country.energyIndex || 0).toLocaleString();

        const oilWellsCount = Number(b.oil_well || 0) + Number(b.oil_field || 0);
        const oilProducedVal = Number(e.oilProduced || 0);
        const oilImportedVal = Number(e.oilImported || 0);
        const oilStockVal = Number(e.oilStock || 0);
        const hasOil = (oilWellsCount > 0) || (oilProducedVal > 0) || (oilImportedVal > 0) || (oilStockVal > 0);

        const oilPrice = document.getElementById("val-oil-price");
        if (oilPrice) {
            if (hasOil) {
                const currentOilPrice = country.oilPrice || (window.currentWorld ? window.currentWorld.oilPrice : 50) || 50;
                oilPrice.textContent = "$" + Number(currentOilPrice);
                oilPrice.style.color = "#ecc94b";
            } else {
                oilPrice.textContent = "غير متوفر";
                oilPrice.style.color = "#a0aec0";
            }
        }

        const oilWells = document.getElementById("val-oil-wells");
        if (oilWells) oilWells.textContent = oilWellsCount;

        const fuelStations = document.getElementById("val-fuel-stations");
        if (fuelStations) fuelStations.textContent = Number(b.fuel_station || 0);

        const oilProd = document.getElementById("val-oil-produced");
        if (oilProd) oilProd.textContent = oilProducedVal.toLocaleString() + " برميل";

        const fuelAmount = document.getElementById("val-fuel-amount");
        if (fuelAmount) fuelAmount.textContent = Number(e.fuelAmount || 0).toLocaleString() + " لتر";

        const oilImp = document.getElementById("val-oil-imported");
        if (oilImp) oilImp.textContent = oilImportedVal.toLocaleString() + " برميل";

        const oilStock = document.getElementById("val-oil-stock");
        if (oilStock) oilStock.textContent = oilStockVal.toLocaleString() + " برميل";

        const netOil = document.getElementById("val-net-oil");
        if (netOil) {
            const net = Number(e.netOil || 0);
            netOil.textContent = net.toLocaleString() + " برميل";
            netOil.style.color = net >= 0 ? "#48bb78" : "#fc8181";
        }

        const gasWellsCount = Number(b.gas_well || 0);
        const gasRawVal = Number(e.gasRaw || 0);
        const gasImportedVal = Number(e.gasImported || 0);
        const gasStockVal = Number(e.gasStock || 0);
        const hasGas = (gasWellsCount > 0) || (gasRawVal > 0) || (gasImportedVal > 0) || (gasStockVal > 0);

        const gasPrice = document.getElementById("val-gas-price");
        if (gasPrice) {
            if (hasGas) {
                const currentGasPrice = country.gasPrice || (window.currentWorld ? window.currentWorld.gasPrice : 15) || 15;
                gasPrice.textContent = "$" + Number(currentGasPrice);
                gasPrice.style.color = "#ed8936";
            } else {
                gasPrice.textContent = "غير متوفر";
                gasPrice.style.color = "#a0aec0";
            }
        }

        const gasWells = document.getElementById("val-gas-wells");
        if (gasWells) gasWells.textContent = gasWellsCount;

        const gasShops = document.getElementById("val-gas-shops");
        if (gasShops) gasShops.textContent = Number(b.gas_station_shop || 0);

        const gasRaw = document.getElementById("val-gas-raw");
        if (gasRaw) gasRaw.textContent = gasRawVal.toLocaleString() + " م³";

        const gasCyl = document.getElementById("val-gas-cylinders");
        if (gasCyl) gasCyl.textContent = Number(e.gasCylinders || 0).toLocaleString() + " أسطوانة";

        const gasImp = document.getElementById("val-gas-imported");
        if (gasImp) gasImp.textContent = gasImportedVal.toLocaleString() + " م³";

        const gasStock = document.getElementById("val-gas-stock");
        if (gasStock) gasStock.textContent = gasStockVal.toLocaleString() + " م³";

        const netGas = document.getElementById("val-net-gas");
        if (netGas) {
            const net = Number(e.netGas || 0);
            netGas.textContent = net.toLocaleString() + " م³";
            netGas.style.color = net >= 0 ? "#48bb78" : "#fc8181";
        }
    }

    static renderSectorsGrid(country) {
        const grid = document.getElementById("sectors-grid");
        if (!grid) return;
        grid.innerHTML = "";

        const sectors = [
            { id: "commercial", name: "التجاري", icon: "🏪" },
            { id: "agricultural", name: "الزراعي", icon: "🌾" },
            { id: "healthcare", name: "الصحي", icon: "🏥" },
            { id: "education", name: "التعليمي", icon: "🎓" },
            { id: "entertainment", name: "الترفيهي", icon: "🎡" },
            { id: "trains", name: "القطارات", icon: "🚆" },
            { id: "airports", name: "المطارات", icon: "✈️" },
            { id: "gas", name: "الغاز", icon: "🔥" },
            { id: "electricity", name: "الكهرباء", icon: "⚡" },
            { id: "water", name: "المياه", icon: "💧" },
            { id: "industrial", name: "الصناعي", icon: "🏭" },
            { id: "security", name: "الأمني", icon: "🛡️" },
            { id: "civil", name: "المدني", icon: "🏛️" },
            { id: "services", name: "الخدمي", icon: "🤝" },
            { id: "navigation", name: "الملاحي", icon: "⛵" },
            { id: "ports", name: "الموانئ", icon: "⚓" }
        ];

        let totalPoints = 0;

        const sectorData = sectors.map(function(s) {
            const val = Number((country.sectors && country.sectors[s.id]) ? country.sectors[s.id] : 0);
            totalPoints += val;
            return { id: s.id, name: s.name, icon: s.icon, val: val };
        });

        sectorData.sort(function(a, b) {
            return a.val - b.val;
        });

        sectorData.forEach(function(item) {
            const gaugeCard = document.createElement("div");
            gaugeCard.className = "sector-gauge-card";

            let statusColor = "#f87171";
            let statusText = "عجز";
            let borderColor = "rgba(239, 68, 68, 0.4)";
            let cardBg = "#15101a";

            if (item.val === 0) {
                statusColor = "#fbbf24";
                statusText = "متعادل";
                borderColor = "rgba(251, 191, 36, 0.3)";
                cardBg = "#131926";
            } else if (item.val > 0) {
                statusColor = "#34d399";
                statusText = "فائض";
                borderColor = "rgba(52, 211, 153, 0.3)";
                cardBg = "#0e1a1e";
            }

            const clampedVal = Math.max(-20, Math.min(20, item.val));
            const normalized = (clampedVal + 20) / 40;
            const needleAngle = 180 - (normalized * 180);

            const rad = (needleAngle * Math.PI) / 180;
            const needleLength = 32;
            const pivotX = 50;
            const pivotY = 46;
            const needleTipX = pivotX + needleLength * Math.cos(rad);
            const needleTipY = pivotY - needleLength * Math.sin(rad);

            gaugeCard.style.background = cardBg;
            gaugeCard.style.border = "1px solid " + borderColor;
            gaugeCard.style.borderRadius = "10px";
            gaugeCard.style.padding = "8px 6px";
            gaugeCard.style.display = "flex";
            gaugeCard.style.flexDirection = "column";
            gaugeCard.style.alignItems = "center";

            gaugeCard.innerHTML = `
        <div style="font-size:0.8rem; font-weight:800; color:#e2e8f0; margin-bottom:2px; display:flex; align-items:center; gap:4px;">
          <span>${item.icon}</span>
          <span>${item.name}</span>
        </div>

        <svg viewBox="0 0 100 52" style="width:100%; max-width:110px; height:auto; overflow:visible;">
          <path d="M 12 46 A 38 38 0 0 1 36 17" fill="none" stroke="#ef4444" stroke-width="7" stroke-linecap="round" />
          <path d="M 39 15 A 38 38 0 0 1 61 15" fill="none" stroke="#f59e0b" stroke-width="7" />
          <path d="M 64 17 A 38 38 0 0 1 88 46" fill="none" stroke="#10b981" stroke-width="7" stroke-linecap="round" />

          <line x1="${pivotX}" y1="${pivotY}" x2="${needleTipX}" y2="${needleTipY}" stroke="${statusColor}" stroke-width="2.5" stroke-linecap="round" />
          <circle cx="${pivotX}" cy="${pivotY}" r="4" fill="#f8fafc" stroke="${statusColor}" stroke-width="1.5" />
        </svg>

        <div style="font-size:1.15rem; font-weight:900; color:${statusColor}; margin-top:2px; font-variant-numeric:tabular-nums;">
          ${item.val > 0 ? '+' + item.val : item.val}
        </div>

        <span style="font-size:0.7rem; color:${statusColor}; font-weight:700;">
          ${statusText}
        </span>
      `;

            grid.appendChild(gaugeCard);
        });

        const badge = document.getElementById("total-sectors-badge");
        if (badge) {
            badge.textContent = "نقاط التغطية: " + (totalPoints > 0 ? ("+" + totalPoints) : totalPoints);
            badge.style.color = totalPoints >= 0 ? "#34d399" : "#f87171";
        }
    }
}

// جسر التوافق لكافة الاستدعاءات
window.openCountry = function(target) { return CountryViewController.open(target); };
window.viewCountry = function(target) { return CountryViewController.open(target); };
window.showCountry = function(target) { return CountryViewController.open(target); };
window.selectCountry = function(target) { return CountryViewController.open(target); };
window.openCountryDetail = function(target) { return CountryViewController.open(target); };
window.showCountryDetailScreen = function(target) { return CountryViewController.open(target); };

CountryViewController.renderCountry = function(target) { return CountryViewController.open(target); };

window.CountryView = CountryViewController;

window.handleBuyResource = function(resourceId) {
    if (!window.currentViewingCountry) return;
    const res = BuildingsEngine.purchaseResource(window.currentViewingCountry, resourceId);
    if (!res.success) {
        alert(res.msg);
    } else {
        CountryViewController.render(window.currentViewingCountry);
        if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(window.currentViewingCountry);
    }
};

window.handleDemolishResource = function(resourceId) {
    if (!window.currentViewingCountry) return;
    if (!confirm("هل أنت متأكد من رغبتك في إزالة هذه المنشأة؟")) return;
    const res = BuildingsEngine.demolishResource(window.currentViewingCountry, resourceId);
    if (!res.success) {
        alert(res.msg);
    } else {
        CountryViewController.render(window.currentViewingCountry);
        if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(window.currentViewingCountry);
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
        CountryViewController.init();
    });
} else {
    CountryViewController.init();
}