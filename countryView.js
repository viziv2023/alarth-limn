/**
 * ============================================================================
 * countryView.js - واجهة إدارة الدولة والربط المباشر بمشهد العاصمة 3D (v5.0)
 * ============================================================================
 *
 * المزايا المعمارية المحدثة:
 * 1. التوجيه المباشر للعاصمة (Capital-First Gameplay): عند اختيار الدولة أو تأسيسها،
 *    ينتقل اللاعب مباشرةً إلى مشهد العاصمة ثلاثي الأبعاد بدلاً من الجداول النصية المشتتة.
 * 2. الاحتفاظ بصفحة السجل التفصيلي كخيار ثانوي (`openDetailedDossier`) لمن يرغب بمراجعة الأرقام التفصيلية.
 * 3. المزامنة التلقائية مع مشهد العاصمة عند شراء أو إزالة المنشآت أو تدوير السنة المالية.
 */

window.currentViewingCountry = null;
window.currentBuildingTab = 1;
window.isViewingAsSpectator = false;

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

    static setupTableClickListener() {
        const grid = document.getElementById("nations-cards-grid");
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
        // زر الرجوع من صفحة البيانات التفصيلية يعود مباشرةً إلى مشهد العاصمة 3D
        const btnBack = document.getElementById("btn-back-to-world");
        if (btnBack) {
            btnBack.onclick = function() {
                if (window.currentViewingCountry && window.CapitalView && typeof window.CapitalView.open === "function") {
                    window.CapitalView.open(window.currentViewingCountry);
                    return;
                }
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

        const btnDetailNextYear = document.getElementById("btn-detail-next-year");
        if (btnDetailNextYear) {
            btnDetailNextYear.onclick = function() {
                if (typeof window.triggerPlayerTurnDecision === "function") {
                    window.triggerPlayerTurnDecision("READY_YEAR");
                }
            };
        }

        const btnDetailGoWar = document.getElementById("btn-detail-go-war");
        if (btnDetailGoWar) {
            btnDetailGoWar.onclick = function() {
                if (typeof window.triggerPlayerTurnDecision === "function") {
                    window.triggerPlayerTurnDecision("READY_WAR");
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
                if (nameEl) nameEl.textContent = "🎖️ وزارة الدفاع والقيادة العامة - " + country.name;

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

        // زر العودة من شاشة الجيش يعود مباشرةً إلى مشهد العاصمة 3D
        const btnBackFromMil = document.getElementById("btn-back-from-military");
        if (btnBackFromMil) {
            btnBackFromMil.onclick = function() {
                if (window.currentViewingCountry && window.CapitalView && typeof window.CapitalView.open === "function") {
                    window.CapitalView.open(window.currentViewingCountry);
                    return;
                }
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
                if (window.isViewingAsSpectator) return;
                const c = window.currentViewingCountry;
                if (!c) return;
                const bankVal = Number(c.bank !== undefined ? c.bank : (c.bankBalance || 0));
                if (bankVal <= 0) {
                    if (window.showGameToast) window.showGameToast("رصيد البنك الوطني فارغ حالياً!", "⚠️");
                    return;
                }
                c.disposableRevenue = Number(c.disposableRevenue || 0) + bankVal;
                c.bank = 0;
                c.bankBalance = 0;

                CountryViewController.render(c);
                if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
                if (window.showGameToast) window.showGameToast("تم سحب $" + bankVal.toLocaleString() + " بالكامل! السيولة المتاحة: $" + Number(c.disposableRevenue).toLocaleString(), "💰");
            };
        }

        // سحب نصف الرصيد أو دفعة سريعة من البنك الوطني
        const btnWithdrawPart = document.getElementById("btn-action-withdraw-partial");
        if (btnWithdrawPart) {
            btnWithdrawPart.onclick = function() {
                if (window.isViewingAsSpectator) return;
                const c = window.currentViewingCountry;
                if (!c) return;
                const bankVal = Number(c.bank !== undefined ? c.bank : (c.bankBalance || 0));
                if (bankVal <= 0) {
                    if (window.showGameToast) window.showGameToast("رصيد البنك الوطني فارغ حالياً!", "⚠️");
                    return;
                }
                const amount = Math.max(1, Math.min(bankVal, Math.ceil(bankVal * 0.5)));
                const remaining = bankVal - amount;
                c.bank = remaining;
                c.bankBalance = remaining;
                c.disposableRevenue = Number(c.disposableRevenue || 0) + amount;

                CountryViewController.render(c);
                if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
                if (window.showGameToast) window.showGameToast("تم سحب $" + amount.toLocaleString() + " | السيولة الحالية: $" + Number(c.disposableRevenue).toLocaleString(), "💵");
            };
        }

        // سحب أموال الطوارئ من مدخرات البنك الدولي
        const btnEmergency = document.getElementById("btn-action-worldbank-emergency");
        if (btnEmergency) {
            btnEmergency.onclick = function() {
                if (window.isViewingAsSpectator) return;
                const c = window.currentViewingCountry;
                if (!c) return;

                const availableSavings = Math.max(0, Number(c.worldBankFund) || 0);
                if (availableSavings <= 0) {
                    if (window.showGameToast) window.showGameToast("لا توجد مدخرات متاحة في البنك الدولي للسحب!", "⚠️");
                    return;
                }

                let res;
                if (window.EconomyEngine && typeof window.EconomyEngine.emergencyWithdrawFromWorldBank === "function") {
                    res = window.EconomyEngine.emergencyWithdrawFromWorldBank(c, availableSavings);
                } else {
                    c.worldBankFund = 0;
                    c.disposableRevenue = (Number(c.disposableRevenue) || 0) + availableSavings;
                    res = { success: true, msg: "تم سحب $" + availableSavings.toLocaleString() + " من المدخرات وإيداعها في السيولة المتاحة!" };
                }

                if (window.showGameToast) window.showGameToast(res.msg, res.success ? "🚨" : "⚠️");
                if (res.success) {
                    CountryViewController.render(c);
                    if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
                    if (window.renderNationsTable) window.renderNationsTable();
                }
            };
        }

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
                const myId = window.NetworkEngine ? window.NetworkEngine.getMyCountryId() : null;
                const sender = myId ? resolveCountryObject(myId) : window.currentViewingCountry;
                if (!sender) return;
                const input = document.getElementById("donate-amount-input");
                if (input) input.value = Math.max(0, Number(sender.disposableRevenue || 0));
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
                const myId = window.NetworkEngine ? window.NetworkEngine.getMyCountryId() : null;
                const sender = myId ? resolveCountryObject(myId) : window.currentViewingCountry;
                if (!sender) return;

                const select = document.getElementById("donate-recipient-select");
                if (!select || !select.value) {
                    if (window.showGameToast) window.showGameToast("يرجى اختيار الدولة المستفيدة أولاً!", "⚠️");
                    return;
                }

                const recipient = resolveCountryObject(select.value);
                if (!recipient) {
                    if (window.showGameToast) window.showGameToast("تعذر العثور على الدولة المستفيدة!", "⚠️");
                    return;
                }

                const input = document.getElementById("donate-amount-input");
                const amount = Math.floor(Number(input ? input.value : 0));

                if (isNaN(amount) || amount <= 0) {
                    if (window.showGameToast) window.showGameToast("يرجى إدخال مبلغ صحيح أكبر من الصفر!", "⚠️");
                    return;
                }

                if (Number(sender.disposableRevenue || 0) < amount) {
                    if (window.showGameToast) window.showGameToast("السيولة المتاحة في خزينتك غير كافية!", "⚠️");
                    return;
                }

                const res = window.EconomyEngine ? window.EconomyEngine.sendDonation(sender, recipient, amount) : {
                    success: true,
                    msg: "تم تقديم المساعدة المالية بنجاح!"
                };

                if (res.success) {
                    if (!window.EconomyEngine) {
                        sender.disposableRevenue = Number(sender.disposableRevenue || 0) - amount;
                        recipient.disposableRevenue = Number(recipient.disposableRevenue || 0) + amount;
                    }
                    modal.classList.remove("active");
                    CountryViewController.render(window.currentViewingCountry);
                    if (window.NetworkEngine) {
                        window.NetworkEngine.syncCountryChanges(sender);
                        window.NetworkEngine.syncCountryChanges(recipient);
                    }
                    if (window.renderNationsTable) window.renderNationsTable();
                    if (window.showGameToast) window.showGameToast("تم إرسال منحة مالية قدرها $" + amount.toLocaleString() + " إلى " + recipient.name, "🎁");
                } else {
                    if (window.showGameToast) window.showGameToast(res.msg, "⚠️");
                }
            };
        }
    }

    static openDonationModal() {
        const myId = window.NetworkEngine ? window.NetworkEngine.getMyCountryId() : null;
        const sender = myId ? resolveCountryObject(myId) : window.currentViewingCountry;
        if (!sender) return;

        const modal = document.getElementById("modal-donate-aid");
        if (!modal) return;

        const donorName = document.getElementById("donate-donor-name");
        if (donorName) donorName.value = sender.name;

        const availFunds = document.getElementById("donate-available-funds");
        if (availFunds) availFunds.textContent = "$" + Number(sender.disposableRevenue || 0).toLocaleString();

        const input = document.getElementById("donate-amount-input");
        if (input) input.value = "";

        const select = document.getElementById("donate-recipient-select");
        if (select && window.currentWorld && Array.isArray(window.currentWorld.countries)) {
            select.innerHTML = "";
            const targetViewing = window.currentViewingCountry;
            const otherCountries = window.currentWorld.countries.filter(function(other) {
                return other.id !== sender.id;
            });

            if (otherCountries.length === 0) {
                select.innerHTML = '<option value="">لا توجد دول أخرى في العالم لتقديم المساعدة لها</option>';
            } else {
                otherCountries.forEach(function(other) {
                    const opt = document.createElement("option");
                    opt.value = other.id || other.name;
                    opt.textContent = other.name + " (السيولة: $" + Number(other.disposableRevenue || 0).toLocaleString() + ")";
                    if (targetViewing && targetViewing.id === other.id) {
                        opt.selected = true;
                    }
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
                if (window.isViewingAsSpectator) return;
                const c = window.currentViewingCountry;
                if (!c) return;
                const currentStage = Number(c.stage) || 1;
                const targetStage = currentStage + 1;
                const res = window.BuildingsEngine.upgradeToStage(c, targetStage, window.currentWorld);
                if (window.showGameToast) window.showGameToast(res.msg, res.success ? "🎉" : "⚠️");
                if (res.success) {
                    CountryViewController.render(c);
                    if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
                }
            };
        }
    }

    // =========================================================================
    // فتح الدولة: الانتقال المباشر لمشهد العاصمة 3D افتراضياً!
    // =========================================================================
    static open(target, forceDetailedScreen = false) {
        const country = resolveCountryObject(target);
        if (!country) return;

        if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
            const ownerInfo = typeof window.NetworkEngine.getCountryOwnerInfo === "function"
                ? window.NetworkEngine.getCountryOwnerInfo(country.id)
                : null;
            if (ownerInfo && !ownerInfo.isClaimed && !window.NetworkEngine.getMyCountryId()) {
                window.NetworkEngine.claimCountry(country.id);
            }
        }

        const isOwner = window.NetworkEngine ? window.NetworkEngine.canControlCountry(country.id) : true;
        window.isViewingAsSpectator = !isOwner;
        window.currentViewingCountry = country;

        // إذا لم يُطلب فتح الشاشة النصية التفصيلية صراحة، افتح مشهد العاصمة التفاعلي مباشرةً
        if (!forceDetailedScreen && window.CapitalView && typeof window.CapitalView.open === "function") {
            this.render(country);
            window.CapitalView.open(country);
            return;
        }

        const screens = document.querySelectorAll(".screen");
        for (let i = 0; i < screens.length; i++) {
            screens[i].classList.remove("active");
        }
        const screen = document.getElementById("country-detail-screen");
        if (screen) screen.classList.add("active");

        this.render(country);
    }

    static openDetailedDossier(target) {
        this.open(target, true);
    }

    static show(target) {
        this.open(target, false);
    }

    static render(country) {
        if (!country) return;

        // تحديث مشهد العاصمة إذا كان مفتوحاً حالياً
        const capScreen = document.getElementById("capital-screen");
        if (capScreen && capScreen.classList.contains("active") && window.CapitalView && typeof window.CapitalView.refreshHUDAndMap === "function") {
            window.CapitalView.refreshHUDAndMap();
        }

        const isOwner = !window.isViewingAsSpectator;

        const nameEl = document.getElementById("detail-country-name");
        if (nameEl) {
            nameEl.textContent = country.name || "--";
        }

        const stageEl = document.getElementById("detail-country-stage");
        if (stageEl) {
            stageEl.innerHTML = (country.stageName || ("المرحلة " + (country.stage || 1))) +
                (isOwner ? "" : ' <span class="badge badge-purple" style="font-size:0.75rem; margin-right:4px;">👁️ وضع المشاهدة</span>');
        }

        const yearEl = document.getElementById("detail-year");
        const currentYear = (window.currentWorld && window.currentWorld.year) ? window.currentWorld.year : (country.year || 1);
        if (yearEl) yearEl.textContent = "السنة المالية: " + currentYear + "م";

        if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
            window.MilitaryEngine.syncCountryWithMilitary(country);
        } else if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
            window.MilitaryEngine.refreshMilitaryStats(country);
        }

        const mil = country.military || {};
        const milPower = typeof mil.totalPower === "number" ? mil.totalPower : (country.militaryPower || 0);
        const milUnits = typeof mil.totalUnits === "number" ? mil.totalUnits : (country.militaryUnitsCount || 0);
        const milCrew = typeof mil.totalCrew === "number" ? mil.totalCrew : (country.militaryCrew || 0);

        const topMil = document.getElementById("top-military-power-badge");
        if (topMil) topMil.textContent = `⚔️ القوة: ${Number(milPower).toLocaleString()} (${milUnits} وحدة)`;

        const withdrawAllBtn = document.getElementById("btn-action-withdraw-all");
        const withdrawPartBtn = document.getElementById("btn-action-withdraw-partial");
        const emergencyBtn = document.getElementById("btn-action-worldbank-emergency");
        const milHqBtn = document.getElementById("btn-open-military-hq");

        if (withdrawAllBtn) withdrawAllBtn.style.display = isOwner ? "inline-flex" : "none";
        if (withdrawPartBtn) withdrawPartBtn.style.display = isOwner ? "inline-flex" : "none";
        if (emergencyBtn) emergencyBtn.style.display = isOwner ? "inline-flex" : "none";
        if (milHqBtn) milHqBtn.style.display = isOwner ? "inline-flex" : "none";

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
                flagBox.style.height = "110px";
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
        const civEmp = (country.civilianEmployed !== undefined) ? Number(country.civilianEmployed) : Math.max(0, emp - milCrew);
        const unemp = Math.max(0, pop - emp);
        country.unemployed = unemp;

        const popEl = document.getElementById("detail-population");
        if (popEl) popEl.textContent = pop.toLocaleString() + " نسمة";

        const empEl = document.getElementById("detail-employed");
        if (empEl) empEl.textContent = civEmp.toLocaleString() + " عامل";

        const milCrewEl = document.getElementById("detail-military-crew");
        if (milCrewEl) milCrewEl.textContent = milCrew.toLocaleString() + " جندي";

        const unempEl = document.getElementById("detail-unemployed");
        if (unempEl) unempEl.textContent = unemp.toLocaleString() + " فرد";

        // تحديث بطاقة الجيش والترسانة المترابطة مع بيانات الدولة
        const milUnitsBadge = document.getElementById("detail-mil-units-badge");
        if (milUnitsBadge) milUnitsBadge.textContent = `${milUnits} وحدة (${milCrew} جندي)`;

        const milTotPwrEl = document.getElementById("detail-mil-total-power");
        if (milTotPwrEl) milTotPwrEl.textContent = `${Number(milPower).toLocaleString()} نقطة قوة`;

        const bc = mil.branchCounts || { ground: 0, naval: 0, air: 0, defense: 0 };
        const bp = mil.branchPower || { ground: 0, naval: 0, air: 0, defense: 0 };

        const gEl = document.getElementById("detail-mil-ground");
        if (gEl) gEl.textContent = `${bc.ground || 0} وحدة (قوة: ${bp.ground || 0})`;

        const nEl = document.getElementById("detail-mil-naval");
        if (nEl) nEl.textContent = `${bc.naval || 0} وحدة (قوة: ${bp.naval || 0})`;

        const aEl = document.getElementById("detail-mil-air");
        if (aEl) aEl.textContent = `${bc.air || 0} وحدة (قوة: ${bp.air || 0})`;

        const dEl = document.getElementById("detail-mil-defense");
        if (dEl) dEl.textContent = `${bc.defense || 0} وحدة (قوة: ${bp.defense || 0})`;

        const ownedListEl = document.getElementById("detail-mil-owned-list");
        if (ownedListEl) {
            const inv = mil.inventory || {};
            const items = [];
            Object.keys(inv).forEach(function(uid) {
                const cnt = Number(inv[uid] || 0);
                if (cnt > 0) {
                    const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
                    items.push(`${u ? u.name : uid}: <strong style="color:#34d399;">×${cnt}</strong>`);
                }
            });
            ownedListEl.innerHTML = items.length > 0
                ? `<strong style="color:#fffbeb;">📋 الوحدات المتوفرة في جيش الدولة:</strong><br>` + items.join(" | ")
                : `<span style="color:#94a3b8;">لا توجد وحدات مجندة حالياً — اضغط زر (🎖️ الجيش) لشراء وتجنيد القوات.</span>`;
        }

        const unempRateEl = document.getElementById("detail-unemployment-rate");
        if (unempRateEl) {
            const rate = pop > 0 ? ((unemp / pop) * 100).toFixed(1) : 0;
            unempRateEl.textContent = rate + "%";
        }

        const budEl = document.getElementById("val-budget");
        if (budEl) budEl.textContent = "$" + Number(country.budget || 0).toLocaleString();

        const revEl = document.getElementById("val-revenue");
        if (revEl) revEl.textContent = "$" + Number(country.disposableRevenue || 0).toLocaleString();

        const currentBankVal = Number(country.bank !== undefined ? country.bank : (country.bankBalance || 0));
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
            const totRev = window.BuildingsEngine ? window.BuildingsEngine.calculateTotalRevenue(country) : 0;
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
        const bldgTabsNav = document.querySelector(".bldg-tabs-nav");
        if (!tbody || !country) return;

        tbody.innerHTML = "";
        const isOwner = !window.isViewingAsSpectator;

        if (!isOwner) {
            if (bldgTabsNav) bldgTabsNav.style.display = "none";
            if (btnUpgrade) btnUpgrade.style.display = "none";
            if (progTxt) progTxt.textContent = "🛡️ المخطط العمراني محفوظ لسيادة دولة [" + country.name + "]";

            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding:30px 20px; background:rgba(15, 10, 28, 0.65);">
                        <div style="font-size:2.6rem; margin-bottom:8px;">🏛️</div>
                        <h3 style="color:#fde047; margin-bottom:6px;">تفاصيل المشتريات خاصة بقيادة الدولة</h3>
                        <button type="button" class="btn btn-accent" onclick="if(window.CapitalView) window.CapitalView.open(window.currentViewingCountry);">
                            🏛️ العودة إلى مشهد العاصمة 3D ➔
                        </button>
                    </td>
                </tr>
            `;
            return;
        }

        if (bldgTabsNav) bldgTabsNav.style.display = "flex";
        const currentDisposable = Number(country.disposableRevenue || 0);

        if (selectedTab === "clean_energy") {
            if (progTxt) progTxt.textContent = "🌱 الطاقة النظيفة | السيولة: $" + currentDisposable.toLocaleString();
            if (btnUpgrade) btnUpgrade.style.display = "none";
        } else {
            if (btnUpgrade) btnUpgrade.style.display = "inline-block";
            const comp = window.BuildingsEngine ? window.BuildingsEngine.checkStageCompletion(country, selectedTab) : { ownedTypes: 0, totalTypes: 12, isComplete: false };
            if (progTxt) {
                progTxt.textContent = "المرحلة " + selectedTab + ": (" + comp.ownedTypes + " / " + comp.totalTypes + ") | السيولة: $" + currentDisposable.toLocaleString();
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

        const resources = window.BuildingsEngine ? window.BuildingsEngine.RESOURCES_LIST.filter(function(res) {
            if (selectedTab === "clean_energy") {
                return res.stage === "clean_energy" || res.category === "clean_energy";
            }
            return Number(res.stage) === Number(selectedTab);
        }) : [];

        resources.forEach(function(res) {
            const ownedCount = Number((country.buildings && country.buildings[res.id]) ? country.buildings[res.id] : 0);
            const prereq = window.BuildingsEngine ? window.BuildingsEngine.checkPrerequisites(country, res.id) : { satisfied: true };
            const canAfford = currentDisposable >= res.price;

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
                    <span class="tag-status ${prereq.satisfied ? 'tag-ok' : 'tag-missing'}">${res.prerequisiteText || 'لا يوجد'}</span>
                </td>
                <td class="td-center"><strong class="${ownedCount > 0 ? 'count-owned' : 'count-zero'}">${ownedCount}</strong></td>
                <td class="td-center">
                    <div class="action-btn-group">
                        <button class="${prereq.satisfied && canAfford ? 'btn-buy-active' : 'btn-buy-disabled'}" onclick="handleBuyResource('${res.id}')" ${!prereq.satisfied || !canAfford ? 'disabled' : ''}>➕</button>
                        <button class="btn-demolish" onclick="handleDemolishResource('${res.id}')" ${ownedCount <= 0 ? 'disabled' : ''}>➖</button>
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
        const oilWells = document.getElementById("val-oil-wells");
        if (oilWells) oilWells.textContent = oilWellsCount;

        const fuelStations = document.getElementById("val-fuel-stations");
        if (fuelStations) fuelStations.textContent = Number(b.fuel_station || 0);

        const oilProd = document.getElementById("val-oil-produced");
        if (oilProd) oilProd.textContent = Number(e.oilProduced || 0).toLocaleString() + " برميل";

        const fuelAmount = document.getElementById("val-fuel-amount");
        if (fuelAmount) fuelAmount.textContent = Number(e.fuelAmount || 0).toLocaleString() + " لتر";

        const oilImp = document.getElementById("val-oil-imported");
        if (oilImp) oilImp.textContent = Number(e.oilImported || 0).toLocaleString() + " برميل";

        const oilStock = document.getElementById("val-oil-stock");
        if (oilStock) oilStock.textContent = Number(e.oilStock || 0).toLocaleString() + " برميل";

        const netOil = document.getElementById("val-net-oil");
        if (netOil) {
            const net = Number(e.netOil || 0);
            netOil.textContent = net.toLocaleString() + " برميل";
            netOil.style.color = net >= 0 ? "#48bb78" : "#fc8181";
        }

        const gasWells = document.getElementById("val-gas-wells");
        if (gasWells) gasWells.textContent = Number(b.gas_well || 0);

        const gasShops = document.getElementById("val-gas-shops");
        if (gasShops) gasShops.textContent = Number(b.gas_station_shop || 0);

        const gasRaw = document.getElementById("val-gas-raw");
        if (gasRaw) gasRaw.textContent = Number(e.gasRaw || 0).toLocaleString() + " م³";

        const gasCyl = document.getElementById("val-gas-cylinders");
        if (gasCyl) gasCyl.textContent = Number(e.gasCylinders || 0).toLocaleString() + " أسطوانة";

        const gasImp = document.getElementById("val-gas-imported");
        if (gasImp) gasImp.textContent = Number(e.gasImported || 0).toLocaleString() + " م³";

        const gasStock = document.getElementById("val-gas-stock");
        if (gasStock) gasStock.textContent = Number(e.gasStock || 0).toLocaleString() + " م³";

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

            gaugeCard.style.background = cardBg;
            gaugeCard.style.border = "1px solid " + borderColor;
            gaugeCard.style.borderRadius = "10px";
            gaugeCard.style.padding = "8px 6px";
            gaugeCard.style.display = "flex";
            gaugeCard.style.flexDirection = "column";
            gaugeCard.style.alignItems = "center";

            gaugeCard.innerHTML = `
                <div style="font-size:0.84rem; font-weight:900; color:#e2e8f0; display:flex; align-items:center; gap:4px;">
                    <span style="font-size:1.2rem;">${item.icon}</span>
                    <span>${item.name}</span>
                </div>
                <div style="font-size:1.15rem; font-weight:900; color:${statusColor}; margin-top:2px;">
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

window.openCountry = function(target) { return CountryViewController.open(target); };
window.viewCountry = function(target) { return CountryViewController.open(target); };
window.showCountry = function(target) { return CountryViewController.open(target); };
window.selectCountry = function(target) { return CountryViewController.open(target); };
window.openCountryDetail = function(target) { return CountryViewController.openDetailedDossier(target); };
window.showCountryDetailScreen = function(target) { return CountryViewController.openDetailedDossier(target); };

CountryViewController.renderCountry = function(target) { return CountryViewController.open(target); };
window.CountryViewController = CountryViewController;
window.CountryView = CountryViewController;

window.handleBuyResource = function(resourceId) {
    if (window.isViewingAsSpectator) {
        if (window.showGameToast) window.showGameToast("🔒 لا يمكنك البناء في دولة قائد آخر!", "⚠️");
        return;
    }
    const c = window.currentViewingCountry;
    if (!c) return;

    const res = window.BuildingsEngine ? window.BuildingsEngine.purchaseResource(c, resourceId) : { success: false, msg: "محرك البناء غير متاح" };
    if (!res.success) {
        if (window.showGameToast) window.showGameToast(res.msg, "⚠️");
    } else {
        CountryViewController.render(c);
        if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
        if (window.showGameToast) {
            window.showGameToast(res.msg + " | المتبقي: $" + Number(c.disposableRevenue).toLocaleString(), "🏗️");
        }
    }
};

window.handleDemolishResource = function(resourceId) {
    if (window.isViewingAsSpectator) {
        if (window.showGameToast) window.showGameToast("🔒 لا يمكنك إزالة منشآت دولة قائد آخر!", "⚠️");
        return;
    }
    const c = window.currentViewingCountry;
    if (!c) return;

    const res = window.BuildingsEngine ? window.BuildingsEngine.demolishResource(c, resourceId) : { success: false, msg: "محرك البناء غير متاح" };
    if (!res.success) {
        if (window.showGameToast) window.showGameToast(res.msg, "⚠️");
    } else {
        CountryViewController.render(c);
        if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(c);
        if (window.showGameToast) {
            window.showGameToast(res.msg, "🔨");
        }
    }
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
        CountryViewController.init();
    });
} else {
    CountryViewController.init();
}
