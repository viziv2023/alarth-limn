/**
 * ============================================================================
 * main.js - محرك التشغيل الرئيسي والانتقال المباشر لمشهد العاصمة 3D (v5.0)
 * ============================================================================
 *
 * المزايا المحدثة:
 * 1. الانتقال الفوري والمباشر إلى مشهد العاصمة ثلاثي الأبعاد (`CapitalView.open`)
 *    فور إنشاء اللاعب لدولته أو الضغط على بطاقة أي دولة.
 * 2. فتح نافذة تأسيس الدولة تلقائياً عند بدء عالم جديد فارغ لعدم تشتيت اللاعب.
 * 3. زر مباشر في شاشة العالم للعودة الفورية إلى عاصمة اللاعب (`#btn-go-my-capital`).
 */

window.currentWorld = null;
window.soundEnabled = true;

// صوتيات اللعبة المدمجة
window.GameSFX = {
    playClick: function() {
        if (!window.soundEnabled) return;
        try {
            const ctx = new(window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.08);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } catch (e) {}
    },
    newYear: function() {
        if (!window.soundEnabled) return;
        try {
            const ctx = new(window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "triangle";
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
    }
};

// إشعار اللعبة العائم (Toast Notification)
window.showGameToast = function(msg, icon) {
    const container = document.getElementById("game-toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "game-toast";
    toast.innerHTML = `<span style="font-size:1.2rem;">${icon || "🌟"}</span><span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(function() {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";
        toast.style.transform = "translateY(-15px) scale(0.9)";
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 400);
    }, 3200);
};

// =========================================================================
// 1. تهيئة اللعبة وبناء العالم الافتراضي (Initialization)
// =========================================================================
function initGame() {
    if (!window.currentWorld && window.World) {
        window.currentWorld = new window.World();
    }

    setupMainMenuEvents();
    setupDashboardEvents();
    setupMultiplayerLobbyEvents();
    setupCreationModalEvents();
    setupYearConfirmationEvents();
    setupTabSwitching();

    if (window.FlagEditor && typeof window.FlagEditor.init === "function") {
        window.FlagEditor.init();
    }
    if (window.CountryViewController && typeof window.CountryViewController.init === "function") {
        window.CountryViewController.init();
    }

    renderNationsTable();
}

// =========================================================================
// 2. أحداث القائمة الرئيسية (Main Menu Events)
// =========================================================================
function setupMainMenuEvents() {
    const btnMultiplayer = document.getElementById("btn-menu-multiplayer");
    if (btnMultiplayer) {
        btnMultiplayer.onclick = function() {
            window.GameSFX.playClick();
            openMultiplayerLobbyModal();
        };
    }

    const btnNew = document.getElementById("btn-menu-new");
    if (btnNew) {
        btnNew.onclick = function() {
            window.GameSFX.playClick();
            if (window.World) window.currentWorld = new window.World();
            showDashboardScreen();
            renderNationsTable();
            // فتح نافذة تأسيس الدولة مباشرة ليبدأ اللاعب بتصميم دولته والدخول للعاصمة فوراً
            openCreateCountryModal();
        };
    }

    const btnLoad = document.getElementById("btn-menu-load");
    const fileMenu = document.getElementById("file-input-menu");
    if (btnLoad && fileMenu) {
        btnLoad.onclick = function() {
            fileMenu.click();
        };
        fileMenu.onchange = function(e) {
            handleFileUpload(e.target.files[0]);
        };
    }
}

// =========================================================================
// 3. أحداث لوحة القيادة والشريط العلوي (Dashboard & HUD Events)
// =========================================================================
function setupDashboardEvents() {
    const btnGoMyCap = document.getElementById("btn-go-my-capital");
    if (btnGoMyCap) {
        btnGoMyCap.onclick = function() {
            window.GameSFX.playClick();
            const countries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];
            if (countries.length === 0) {
                openCreateCountryModal();
                return;
            }
            const myId = (window.NetworkEngine && typeof window.NetworkEngine.getMyCountryId === "function") ?
                window.NetworkEngine.getMyCountryId() : null;
            const targetCountry = (myId && countries.find(c => String(c.id) === String(myId))) ||
                window.currentViewingCountry ||
                countries[0];
            if (targetCountry && window.CapitalView) {
                window.CapitalView.open(targetCountry);
            }
        };
    }

    const btnNextYear = document.getElementById("btn-global-next-year");
    if (btnNextYear) {
        btnNextYear.onclick = function() {
            window.GameSFX.playClick();
            const isMp = window.NetworkEngine && window.NetworkEngine.getRoomId();
            if (isMp) {
                window.NetworkEngine.submitDecision("READY_YEAR");
            } else {
                const modal = document.getElementById("modal-confirm-year");
                if (modal) modal.classList.add("active");
            }
        };
    }

    const btnAddNation = document.getElementById("btn-add-nation");
    if (btnAddNation) {
        btnAddNation.onclick = function() {
            window.GameSFX.playClick();
            openCreateCountryModal();
        };
    }

    const btnOpenRooms = document.getElementById("btn-open-rooms-modal");
    if (btnOpenRooms) {
        btnOpenRooms.onclick = function() {
            window.GameSFX.playClick();
            openMultiplayerLobbyModal();
        };
    }

    const btnSaveFile = document.getElementById("btn-save-to-file");
    if (btnSaveFile) {
        btnSaveFile.onclick = function() {
            window.GameSFX.playClick();
            saveWorldToFile();
        };
    }

    const btnLoadFile = document.getElementById("btn-load-from-file");
    const fileDash = document.getElementById("file-input-dash");
    if (btnLoadFile && fileDash) {
        btnLoadFile.onclick = function() {
            fileDash.click();
        };
        fileDash.onchange = function(e) {
            handleFileUpload(e.target.files[0]);
        };
    }

    const btnSound = document.getElementById("btn-toggle-sound");
    if (btnSound) {
        btnSound.onclick = function() {
            window.soundEnabled = !window.soundEnabled;
            btnSound.textContent = window.soundEnabled ? "🔊" : "🔇";
            window.showGameToast(window.soundEnabled ? "تم تفعيل المؤثرات الصوتية" : "تم كتم الصوت", "🎵");
        };
    }

    // أزرار شريط الجاهزية العلوي للشبكة
    const btnMpReadyYear = document.getElementById("btn-mp-ready-year");
    if (btnMpReadyYear) {
        btnMpReadyYear.onclick = function() {
            if (window.NetworkEngine) window.NetworkEngine.submitDecision("READY_YEAR");
        };
    }

    const btnMpReadyWar = document.getElementById("btn-mp-ready-war");
    if (btnMpReadyWar) {
        btnMpReadyWar.onclick = function() {
            if (window.NetworkEngine) window.NetworkEngine.submitDecision("READY_WAR");
        };
    }

    const btnMpOpenLobby = document.getElementById("btn-mp-open-lobby");
    if (btnMpOpenLobby) {
        btnMpOpenLobby.onclick = function() {
            openMultiplayerLobbyModal();
        };
    }
}

// =========================================================================
// 4. إدارة نافذة الغرف المتعددة والحفظ الدائم (Multiplayer Lobby)
// =========================================================================
function getSafeLocalStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function openMultiplayerLobbyModal() {
    const modal = document.getElementById("modal-multiplayer-lobby");
    if (!modal) return;

    const lastRoomId = getSafeLocalStorage("hegemony_last_active_room");
    const savedBox = document.getElementById("mp-saved-room-box");
    const savedDesc = document.getElementById("mp-saved-room-desc");

    if (lastRoomId && getSafeLocalStorage("hegemony_room_save_" + lastRoomId) && savedBox && savedDesc) {
        savedBox.style.display = "block";
        savedDesc.textContent = "رمز الغرفة المحفوظة: " + lastRoomId + " (يمكنك استئنافها ومتابعة اللعب)";

        const btnResume = document.getElementById("btn-resume-saved-room");
        if (btnResume) {
            btnResume.onclick = function() {
                const nameInp = document.getElementById("mp-player-name-input");
                const pName = (nameInp && nameInp.value) ? nameInp.value.trim() : "قائد سيادي";
                if (window.NetworkEngine) {
                    window.NetworkEngine.createRoom(lastRoomId, pName, function(res) {
                        if (res.success) {
                            modal.classList.remove("active");
                            showDashboardScreen();
                        }
                    });
                }
            };
        }
    } else if (savedBox) {
        savedBox.style.display = "none";
    }

    modal.classList.add("active");
}

function setupMultiplayerLobbyEvents() {
    const modal = document.getElementById("modal-multiplayer-lobby");
    if (!modal) return;

    const btnClose = document.getElementById("btn-close-mp-lobby");
    if (btnClose) {
        btnClose.onclick = function() {
            modal.classList.remove("active");
        };
    }

    const btnCreate = document.getElementById("btn-create-new-room");
    if (btnCreate) {
        btnCreate.onclick = function() {
            const nameInp = document.getElementById("mp-player-name-input");
            const pName = (nameInp && nameInp.value) ? nameInp.value.trim() : "قائد سيادي";
            if (window.NetworkEngine) {
                window.NetworkEngine.createRoom(null, pName, function(res) {
                    if (res.success) {
                        modal.classList.remove("active");
                        showDashboardScreen();
                        openCreateCountryModal();
                    }
                });
            }
        };
    }

    const btnJoin = document.getElementById("btn-join-existing-room");
    if (btnJoin) {
        btnJoin.onclick = function() {
            const codeInp = document.getElementById("mp-room-code-input");
            const nameInp = document.getElementById("mp-player-name-input");
            const code = codeInp ? codeInp.value.trim() : "";
            const pName = (nameInp && nameInp.value) ? nameInp.value.trim() : "قائد سيادي";

            if (!code) {
                window.showGameToast("يرجى إدخال رمز الغرفة أولاً!", "⚠️");
                return;
            }

            if (window.NetworkEngine) {
                window.NetworkEngine.joinRoom(code, pName, function(res) {
                    if (res.success) {
                        modal.classList.remove("active");
                        showDashboardScreen();
                    }
                });
            }
        };
    }
}

// =========================================================================
// 5. نافذة تأسيس دولة جديدة والانتقال المباشر إلى مشهد العاصمة 3D
// =========================================================================
function openCreateCountryModal() {
    const modal = document.getElementById("modal-create-country");
    if (!modal) return;
    const nameInp = document.getElementById("country-name-input");
    if (nameInp) {
        nameInp.value = "";
        setTimeout(() => nameInp.focus(), 80);
    }
    modal.classList.add("active");
}
window.openCreateCountryModal = openCreateCountryModal;

function setupCreationModalEvents() {
    const modal = document.getElementById("modal-create-country");
    if (!modal) return;

    const btnCancel = document.getElementById("btn-cancel-creation");
    if (btnCancel) {
        btnCancel.onclick = function() {
            modal.classList.remove("active");
        };
    }

    const btnConfirm = document.getElementById("btn-confirm-creation");
    if (btnConfirm) {
        btnConfirm.onclick = function() {
            const nameInp = document.getElementById("country-name-input");
            const nationName = nameInp ? nameInp.value.trim() : "";

            if (!nationName) {
                window.showGameToast("يرجى كتابة اسم دولتك أولاً!", "⚠️");
                if (nameInp) nameInp.focus();
                return;
            }

            let flagColors = ["#c0392b", "#2980b9", "#27ae60", "#f1c40f", "#8e44ad", "#ffffff", "#c0392b", "#2980b9", "#27ae60", "#f1c40f", "#8e44ad", "#ffffff"];
            if (window.FlagEditor && typeof window.FlagEditor.getCurrentFlag === "function") {
                flagColors = window.FlagEditor.getCurrentFlag();
            }

            const uniqueId = "cnt_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);

            let newCountry = null;
            if (window.Country) {
                newCountry = new window.Country(nationName, flagColors);
                newCountry.id = uniqueId;
            } else {
                newCountry = {
                    id: uniqueId,
                    name: nationName,
                    flag: flagColors,
                    stage: 1,
                    stageName: "النشأة والتأسيس",
                    population: 10,
                    employed: 0,
                    unemployed: 10,
                    budget: 0,
                    disposableRevenue: 200,
                    bank: 0,
                    worldBankFund: 0,
                    generalIndex: 100,
                    currencyValue: 1.0,
                    perCapitaIncome: 200,
                    area: 10,
                    buildings: window.BuildingsEngine ? window.BuildingsEngine.createDefaultBuildings() : {},
                    sectors: {},
                    energy: {},
                    military: { inventory: {}, totalPower: 0, totalCrew: 0, totalFuelConsumption: 0, netAmmoBalance: 0, ammoDemand: 0, ammoProduction: 0 }
                };
            }

            if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
                window.NetworkEngine.syncNewCountry(newCountry);
            } else {
                if (window.currentWorld) {
                    if (typeof window.currentWorld.addCountry === "function") {
                        window.currentWorld.addCountry(newCountry);
                    } else if (Array.isArray(window.currentWorld.countries)) {
                        window.currentWorld.countries.push(newCountry);
                    }
                }
                renderNationsTable();
            }

            modal.classList.remove("active");
            window.currentViewingCountry = newCountry;
            window.isViewingAsSpectator = false;

            // الانتقال الفوري والمباشر إلى مشهد العاصمة ثلاثي الأبعاد!
            if (window.CapitalView && typeof window.CapitalView.open === "function") {
                window.CapitalView.open(newCountry);
            } else if (window.CountryViewController) {
                window.CountryViewController.open(newCountry);
            }

            window.showGameToast("🎉 مرحباً بك في عاصمة [" + nationName + "]! اضغط على أي أرض أو أيقونة للبناء", "🏛️");
        };
    }
}

// =========================================================================
// 6. نافذة تدوير السنة المالية (Next Year Modal)
// =========================================================================
function setupYearConfirmationEvents() {
    const modal = document.getElementById("modal-confirm-year");
    if (!modal) return;

    const btnNo = document.getElementById("btn-confirm-next-year-no");
    if (btnNo) {
        btnNo.onclick = function() {
            modal.classList.remove("active");
        };
    }

    const btnYes = document.getElementById("btn-confirm-next-year-yes");
    if (btnYes) {
        btnYes.onclick = function() {
            modal.classList.remove("active");
            if (window.currentWorld) {
                if (typeof window.currentWorld.advanceYear === "function") {
                    window.currentWorld.advanceYear();
                }
                if (window.GameSFX) window.GameSFX.newYear();
                if (window.NetworkEngine) window.NetworkEngine.refreshAllGameViews();
                else renderNationsTable();

                // تحديث العاصمة فوراً إذا كان اللاعب داخل مشهد العاصمة
                if (window.CapitalView && typeof window.CapitalView.refreshHUDAndMap === "function") {
                    window.CapitalView.refreshHUDAndMap();
                }

                window.showGameToast("🌟 انطلقت السنة المالية " + (window.currentWorld.year || 1) + "م وتم جني العوائد!", "💰");
            }
        };
    }
}

// =========================================================================
// 7. التبديل التفاعلي بين التابات الثمانية (Desktop & Mobile Tabs)
// =========================================================================
function setupTabSwitching() {
    const tabMap = [
        { btnId: "btn-view-table", containerId: "nations-table-container", key: "table" },
        { btnId: "btn-view-charts", containerId: "nations-charts-container", key: "charts" },
        { btnId: "btn-view-chronicle", containerId: "nations-chronicle-container", key: "chronicle" },
        { btnId: "btn-view-analytics", containerId: "nations-analytics-container", key: "analytics" },
        { btnId: "btn-view-worldbank", containerId: "nations-worldbank-container", key: "worldbank" },
        { btnId: "btn-view-trade", containerId: "nations-trade-container", key: "trade" },
        { btnId: "btn-view-exchange", containerId: "nations-exchange-container", key: "exchange" },
        { btnId: "btn-view-war", containerId: "nations-war-container", key: "war" }
    ];

    function activateTab(targetKey) {
        tabMap.forEach(function(t) {
            const btn = document.getElementById(t.btnId);
            const container = document.getElementById(t.containerId);
            const isMatch = t.key === targetKey;

            if (btn) {
                if (isMatch) btn.classList.add("active");
                else btn.classList.remove("active");
            }

            if (container) {
                container.style.display = isMatch ? "block" : "none";
            }
        });

        document.querySelectorAll(".mob-nav-btn").forEach(function(mBtn) {
            if (mBtn.dataset.target === targetKey) mBtn.classList.add("active");
            else mBtn.classList.remove("active");
        });

        if (targetKey === "table") renderNationsTable();
        else if (targetKey === "charts" && window.ChartsManager) window.ChartsManager.render(window.currentWorld);
        else if (targetKey === "chronicle" && window.ChronicleManager) window.ChronicleManager.render(window.currentWorld);
        else if (targetKey === "analytics" && window.AnalyticsManager) window.AnalyticsManager.render(window.currentWorld);
        else if (targetKey === "worldbank" && window.WorldBankManager) window.WorldBankManager.render(window.currentWorld);
        else if (targetKey === "trade" && window.TradeManager) window.TradeManager.render(window.currentWorld);
        else if (targetKey === "exchange" && window.ExchangeManager) window.ExchangeManager.render(window.currentWorld);
        else if (targetKey === "war" && window.WarView) window.WarView.render(window.currentWorld);
    }

    tabMap.forEach(function(t) {
        const btn = document.getElementById(t.btnId);
        if (btn) {
            btn.onclick = function() {
                window.GameSFX.playClick();
                activateTab(t.key);
            };
        }
    });

    document.querySelectorAll(".mob-nav-btn").forEach(function(btn) {
        btn.onclick = function() {
            window.GameSFX.playClick();
            activateTab(btn.dataset.target);
        };
    });
}

// =========================================================================
// 8. رسم كروت وبطاقات سجل الأمم التفاعلية (Nations Cards Grid)
// =========================================================================
function renderNationsTable() {
    const grid = document.getElementById("nations-cards-grid");
    if (!grid) return;

    grid.innerHTML = "";

    const countries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];

    const countBadge = document.getElementById("global-stats-count");
    if (countBadge) countBadge.textContent = "🌍 الدول: " + countries.length;

    const yearBadge = document.getElementById("global-year-badge");
    if (yearBadge && window.currentWorld) yearBadge.textContent = "⏳ السنة: " + (window.currentWorld.year || 1) + "م";

    if (countries.length === 0) {
        grid.innerHTML = `
            <div class="nations-empty-card">
                <div style="font-size:3.2rem; margin-bottom:10px;">🏰</div>
                <h3 style="color:#fde047; margin-bottom:8px;">ابدأ رحلتك الآن وأسس دولتك الأولى!</h3>
                <p style="color:#e2e8f0; font-size:0.92rem; margin-bottom:18px;">
                    صمّم علمك الوطني وانتقل مباشرةً إلى عاصمتك ثلاثية الأبعاد لبناء المنشآت وقيادة الجيوش.
                </p>
                <button type="button" class="btn btn-primary" onclick="openCreateCountryModal()">
                    🏰 + تأسيس دولتي والدخول للعاصمة ➔
                </button>
            </div>
        `;
        return;
    }

    const myCountryId = (window.NetworkEngine && typeof window.NetworkEngine.getMyCountryId === "function") ?
        window.NetworkEngine.getMyCountryId() :
        null;

    countries.forEach(function(c, idx) {
        const isMyOwn = myCountryId ? String(myCountryId) === String(c.id) : true;
        const milPower = (c.military && typeof c.military.totalPower === "number") ?
            c.military.totalPower :
            (Number(c.militaryPower) || 0);

        const card = document.createElement("div");
        card.className = "nation-sovereign-card";
        card.setAttribute("data-id", c.id);

        card.innerHTML = `
            <div class="nation-card-top-ribbon">
                <span class="nation-stage-pill">🏆 ${c.stageName || ("المرحلة " + (c.stage || 1))}</span>
                ${isMyOwn ? '<span class="badge badge-gold" style="font-size:0.7rem; padding:2px 8px;">👑 دولتي</span>' : '<span class="badge badge-purple" style="font-size:0.7rem; padding:2px 8px;">👁️ مشاهدة</span>'}
                <span class="nation-index-pill">#${idx + 1}</span>
            </div>

            <div class="nation-card-flag-frame">
                <div class="nation-flag-box" id="nation-flag-grid-${c.id}"></div>
            </div>

            <div class="nation-card-name">${c.name}</div>

            <div class="nation-card-stats-grid">
                <div class="nation-card-stat">
                    <span class="stat-label">💵 السيولة:</span>
                    <span class="stat-val text-emerald">$${Number(c.disposableRevenue || 0).toLocaleString()}</span>
                </div>
                <div class="nation-card-stat">
                    <span class="stat-label">👥 السكان:</span>
                    <span class="stat-val text-purple">${Number(c.population || 0).toLocaleString()}</span>
                </div>
                <div class="nation-card-stat">
                    <span class="stat-label">⭐ المؤشر:</span>
                    <span class="stat-val text-cyan">${Number(c.generalIndex || 100).toLocaleString()}</span>
                </div>
                <div class="nation-card-stat">
                    <span class="stat-label">⚔️ القوة:</span>
                    <span class="stat-val text-green">${Number(milPower).toLocaleString()}</span>
                </div>
            </div>

            <div class="nation-card-play-footer">
                ${isMyOwn ? '🏛️ دخول العاصمة 3D والبناء المباشر ➔' : '👁️ التجول في العاصمة 3D ➔'}
            </div>
        `;

        card.onclick = function() {
            window.GameSFX.playClick();
            if (window.CountryViewController) {
                window.CountryViewController.open(c.id);
            } else if (window.CapitalView) {
                window.CapitalView.open(c);
            }
        };

        grid.appendChild(card);

        const flagBox = document.getElementById("nation-flag-grid-" + c.id);
        if (flagBox) {
            if (window.FlagEditor && typeof window.FlagEditor.renderFlag === "function") {
                window.FlagEditor.renderFlag(flagBox, c.flag, 26, 18);
            } else if (Array.isArray(c.flag)) {
                flagBox.style.gridTemplateColumns = "repeat(4, 1fr)";
                flagBox.style.gridTemplateRows = "repeat(3, 1fr)";
                c.flag.forEach(function(col) {
                    const d = document.createElement("div");
                    d.style.background = col || "#1e293b";
                    d.style.width = "18px";
                    d.style.height = "12px";
                    flagBox.appendChild(d);
                });
            }
        }
    });
}
window.renderNationsTable = renderNationsTable;

// =========================================================================
// 9. دوال الحفظ والتحميل من ملفات خارجية (JSON File I/O)
// =========================================================================
function showDashboardScreen() {
    const screens = document.querySelectorAll(".screen");
    for (let i = 0; i < screens.length; i++) {
        screens[i].classList.remove("active");
    }
    const dash = document.getElementById("game-dashboard");
    if (dash) dash.classList.add("active");
}

function saveWorldToFile() {
    if (!window.currentWorld) return;
    const jsonStr = JSON.stringify(window.currentWorld.toJSON ? window.currentWorld.toJSON() : window.currentWorld, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "عصر_الهيمنة_سنة_" + (window.currentWorld.year || 1) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.showGameToast("تم تصدير ملف الحفظ بنجاح!", "💾");
}

function handleFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (window.World && typeof window.World.fromJSON === "function") {
                window.currentWorld = window.World.fromJSON(data);
            } else {
                window.currentWorld = data;
            }
            const firstCountry = (window.currentWorld && window.currentWorld.countries && window.currentWorld.countries[0]) || null;
            if (firstCountry && window.CapitalView) {
                window.CapitalView.open(firstCountry);
            } else {
                showDashboardScreen();
                renderNationsTable();
            }
            window.showGameToast("تم تحميل العالم المحفوظ بنجاح!", "📂");
        } catch (err) {
            window.showGameToast("فشل تحميل ملف الحفظ، تأكد من صحة الملف!", "⚠️");
        }
    };
    reader.readAsText(file);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initGame);
} else {
    CountryViewController && initGame();
}
