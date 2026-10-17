/* ==========================================================================
   عصر الهيمنة - المنسق العام ومحرك التفاعلات المبهجة (main.js)
   الإصدار v4.6 Mobile & Multiplayer Coordinator
   ========================================================================== */

/* 1. محرك الصوتيات التفاعلي للألعاب (Pure Web Audio API - بدون ملفات خارجية) */
const GameSFX = {
    ctx: null,
    enabled: true,

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    },

    playTone(freq, type = "sine", duration = 0.12, vol = 0.12, delay = 0) {
        if (!this.enabled) return;
        try {
            this.init();
            if (!this.ctx) return;
            const startTime = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        } catch (e) {
            // تجاهل أي قيود متصفح قبل أول نقرة
        }
    },

    click() {
        this.playTone(520, "triangle", 0.07, 0.1);
    },

    tab() {
        this.playTone(440, "sine", 0.06, 0.09, 0);
        this.playTone(660, "triangle", 0.09, 0.1, 0.04);
    },

    fanfare() {
        this.playTone(523.25, "triangle", 0.14, 0.14, 0); // C5
        this.playTone(659.25, "triangle", 0.14, 0.14, 0.11); // E5
        this.playTone(783.99, "triangle", 0.16, 0.14, 0.22); // G5
        this.playTone(1046.5, "sine", 0.35, 0.16, 0.34); // C6
    },

    newYear() {
        this.playTone(587.33, "sine", 0.12, 0.14, 0); // D5
        this.playTone(880.0, "triangle", 0.15, 0.14, 0.09); // A5
        this.playTone(1174.66, "sine", 0.32, 0.16, 0.18); // D6
    }
};
window.GameSFX = GameSFX;

/* 2. نظام الإشعارات العائمة والنصوص المتطايرة داخل اللعبة */
function showGameToast(message, icon = "✨") {
    const container = document.getElementById("game-toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "game-toast";
    toast.innerHTML = `<span style="font-size:1.25rem;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        toast.style.opacity = "0";
        toast.style.transform = "translateY(12px)";
        setTimeout(() => toast.remove(), 320);
    }, 3200);
}
window.showGameToast = showGameToast;

function spawnFloatingText(text, x, y) {
    const el = document.createElement("div");
    el.className = "floating-reward-text";
    el.textContent = text;
    el.style.left = `${x || window.innerWidth / 2 - 60}px`;
    el.style.top = `${y || 90}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1350);
}
window.spawnFloatingText = spawnFloatingText;

/* 3. تهيئة العالم والمتغيرات الأساسية */
let currentWorld = window.World ? new window.World() : {
    year: 1,
    countries: [],
    getAllCountries() { return this.countries; },
    addCountry(c) { this.countries.push(c); },
    addHistoryEvent() {},
    advanceYear() { this.year += 1; }
};
window.currentWorld = currentWorld;

let flagEditor = null;

const screens = {
    menu: document.getElementById("main-menu"),
    dashboard: document.getElementById("game-dashboard"),
    countryDetail: document.getElementById("country-detail-screen")
};

const modal = document.getElementById("modal-create-country");
const modalConfirmYear = document.getElementById("modal-confirm-year");
const modalMpLobby = document.getElementById("modal-multiplayer-lobby");
const inputName = document.getElementById("country-name-input");
const nationsGrid = document.getElementById("nations-cards-grid") || document.getElementById("nations-table-body");
const globalCountBadge = document.getElementById("global-stats-count");
const globalYearBadge = document.getElementById("global-year-badge");
const customColorInput = document.getElementById("custom-color-input");

const fileInputMenu = document.getElementById("file-input-menu");
const fileInputDash = document.getElementById("file-input-dash");

// تابات الواجهة الثمانية
const viewTableBtn = document.getElementById("btn-view-table");
const viewChartsBtn = document.getElementById("btn-view-charts");
const viewChronicleBtn = document.getElementById("btn-view-chronicle");
const viewAnalyticsBtn = document.getElementById("btn-view-analytics");
const viewWorldBankBtn = document.getElementById("btn-view-worldbank");
const viewTradeBtn = document.getElementById("btn-view-trade");
const viewExchangeBtn = document.getElementById("btn-view-exchange");
const viewWarBtn = document.getElementById("btn-view-war");

const tableContainer = document.getElementById("nations-table-container");
const chartsContainer = document.getElementById("nations-charts-container");
const chronicleContainer = document.getElementById("nations-chronicle-container");
const analyticsContainer = document.getElementById("nations-analytics-container");
const worldbankContainer = document.getElementById("nations-worldbank-container");
const tradeContainer = document.getElementById("nations-trade-container");
const exchangeContainer = document.getElementById("nations-exchange-container");
const warContainer = document.getElementById("nations-war-container");

function initApp() {
    if (window.FlagEditor) {
        flagEditor = new window.FlagEditor("flag-grid");
    }
    if (window.ChartsManager) window.ChartsManager.init();
    if (window.ChronicleManager) window.ChronicleManager.init();
    if (window.AnalyticsManager) window.AnalyticsManager.init();
    if (window.WorldBankManager) window.WorldBankManager.init();
    if (window.TradeManager) window.TradeManager.init();
    if (window.ExchangeManager) window.ExchangeManager.init();
    if (window.WarView) window.WarView.init();
    setupPalette();
    setupEvents();
    setupMultiplayerEvents();
    setupMobileBottomNav();
    setupGlobalButtonAudio();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

function setupGlobalButtonAudio() {
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn || btn.disabled) return;
        if (btn.classList.contains("view-tab-btn") || btn.classList.contains("mil-tab-btn") || btn.classList.contains("mob-nav-btn")) {
            GameSFX.tab();
        } else {
            GameSFX.click();
        }
    });
}

function setupPalette() {
    const btns = document.querySelectorAll(".palette-btn");

    btns.forEach(btn => {
        btn.style.display = "inline-block";
        btn.style.width = "28px";
        btn.style.height = "28px";
        btn.style.borderRadius = "8px";
        btn.style.cursor = "pointer";
        btn.style.margin = "2px";
        btn.style.boxSizing = "border-box";
        btn.style.border = btn.classList.contains("selected") ? "3px solid #fde047" : "2px solid rgba(255, 255, 255, 0.3)";

        btn.addEventListener("click", () => {
            btns.forEach(b => {
                b.classList.remove("selected");
                b.style.border = "2px solid rgba(255, 255, 255, 0.3)";
            });
            btn.classList.add("selected");
            btn.style.border = "3px solid #fde047";
            if (flagEditor) flagEditor.setColor(btn.dataset.color);
        });
    });

    if (customColorInput) {
        customColorInput.addEventListener("input", (e) => {
            btns.forEach(b => {
                b.classList.remove("selected");
                b.style.border = "2px solid rgba(255, 255, 255, 0.3)";
            });
            if (flagEditor) flagEditor.setColor(e.target.value);
        });
    }
}

function executeAdvanceYear() {
    currentWorld.advanceYear();
    updateYearDisplay();
    renderNationsTable();
    GameSFX.newYear();
    spawnFloatingText(`+1 سنة مالية (${currentWorld.year}م) 💰`);
    showGameToast(`انطلقت السنة المالية ${currentWorld.year}م وتم تحصيل عوائد وتجارة كافة الإمبراطوريات!`, "🌟");
}

function setupEvents() {
    // زر الصوت التفاعلي
    const btnToggleSound = document.getElementById("btn-toggle-sound");
    if (btnToggleSound) {
        btnToggleSound.addEventListener("click", () => {
            GameSFX.enabled = !GameSFX.enabled;
            btnToggleSound.innerHTML = GameSFX.enabled ? "🔊" : "🔇";
            showGameToast(GameSFX.enabled ? "تم تفعيل المؤثرات الصوتية" : "تم كتم المؤثرات الصوتية", GameSFX.enabled ? "🔊" : "🔇");
        });
    }

    // زر إنهاء السنة المالية
    const btnGlobalNextYear = document.getElementById("btn-global-next-year");
    const btnConfirmYearYes = document.getElementById("btn-confirm-next-year-yes");
    const btnConfirmYearNo = document.getElementById("btn-confirm-next-year-no");

    if (btnGlobalNextYear) {
        btnGlobalNextYear.addEventListener("click", () => {
            // في نمط اللعب الجماعي، يتم توجيه اللاعب لتحديد جاهزيته بدلاً من تدوير العالم بمفرده
            if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
                window.NetworkEngine.submitDecision("READY_YEAR");
                showGameToast("تم تأكيد جاهزيتك للسنة التالية! بانتظار تصويت بقية اللاعبين في الغرفة.", "🌾");
                return;
            }

            const countries = currentWorld.getAllCountries();
            if (countries.length === 0) {
                showGameToast("أسّس دولتك الأولى أولاً قبل بدء تدوير السنوات المالية!", "🏰");
                openCreateModal();
                return;
            }

            const nextYear = currentWorld.year + 1;
            if (modalConfirmYear) {
                const titleEl = document.getElementById("confirm-year-title");
                const descEl = document.getElementById("confirm-year-desc");
                if (titleEl) titleEl.textContent = `إنهاء عام ${currentWorld.year}م والانتقال إلى عام ${nextYear}م`;
                if (descEl) {
                    descEl.textContent = `هل أنت مستعد لبدء السنة المالية (${nextYear}م)؟ سيتم جني عوائد المنشآت، توزيع أرباح البنك الدولي، تحصيل عقود الدية والتجارة، وتحديث بورصة الأسعار العالمية.`;
                }
                modalConfirmYear.classList.add("active");
            } else {
                executeAdvanceYear();
            }
        });
    }

    if (btnConfirmYearYes) {
        btnConfirmYearYes.addEventListener("click", () => {
            if (modalConfirmYear) modalConfirmYear.classList.remove("active");
            executeAdvanceYear();
        });
    }

    if (btnConfirmYearNo) {
        btnConfirmYearNo.addEventListener("click", () => {
            if (modalConfirmYear) modalConfirmYear.classList.remove("active");
        });
    }

    // التبديل بين التابات الثمانية لسطح المكتب
    const allTabs = [
        { id: "table", btn: viewTableBtn, container: tableContainer },
        { id: "charts", btn: viewChartsBtn, container: chartsContainer, onOpen: () => window.ChartsManager && window.ChartsManager.renderCharts(currentWorld.getAllCountries()) },
        { id: "chronicle", btn: viewChronicleBtn, container: chronicleContainer, onOpen: () => window.ChronicleManager && window.ChronicleManager.render(currentWorld) },
        { id: "analytics", btn: viewAnalyticsBtn, container: analyticsContainer, onOpen: () => window.AnalyticsManager && window.AnalyticsManager.render(currentWorld) },
        { id: "worldbank", btn: viewWorldBankBtn, container: worldbankContainer, onOpen: () => window.WorldBankManager && window.WorldBankManager.render(currentWorld) },
        { id: "trade", btn: viewTradeBtn, container: tradeContainer, onOpen: () => window.TradeManager && window.TradeManager.render(currentWorld) },
        { id: "exchange", btn: viewExchangeBtn, container: exchangeContainer, onOpen: () => window.ExchangeManager && window.ExchangeManager.render(currentWorld) },
        { id: "war", btn: viewWarBtn, container: warContainer, onOpen: () => window.WarView && window.WarView.render(currentWorld) }
    ];

    allTabs.forEach(tab => {
        if (tab.btn) {
            tab.btn.addEventListener("click", () => {
                allTabs.forEach(t => {
                    if (t.btn) t.btn.classList.remove("active");
                    if (t.container) t.container.style.display = "none";
                });
                tab.btn.classList.add("active");
                tab.container.style.display = "block";

                // مزامنة شريط التنقل السفلي للهواتف
                const mobBtns = document.querySelectorAll(".mob-nav-btn");
                mobBtns.forEach(mb => {
                    if (mb.dataset.target === tab.id) mb.classList.add("active");
                    else mb.classList.remove("active");
                });

                if (tab.onOpen) tab.onOpen();
            });
        }
    });

    document.getElementById("btn-menu-new").addEventListener("click", () => {
        if (window.World) {
            currentWorld = new window.World();
            window.currentWorld = currentWorld;
        }
        updateYearDisplay();
        openDashboard();
        openCreateModal();
    });

    document.getElementById("btn-menu-load").addEventListener("click", () => fileInputMenu.click());
    fileInputMenu.addEventListener("change", (e) => handleFileImport(e));

    document.getElementById("btn-add-nation").addEventListener("click", () => openCreateModal());
    document.getElementById("btn-cancel-creation").addEventListener("click", () => modal.classList.remove("active"));

    document.getElementById("btn-save-to-file").addEventListener("click", () => {
        if (currentWorld.getAllCountries().length === 0) {
            showGameToast("لا توجد دول في العالم لحفظها حالياً!", "⚠️");
            return;
        }
        if (window.StorageManager) {
            window.StorageManager.exportToFile(currentWorld);
            showGameToast("تم تصدير وحفظ ملف العالم بنجاح!", "💾");
        }
    });

    document.getElementById("btn-load-from-file").addEventListener("click", () => fileInputDash.click());
    fileInputDash.addEventListener("change", (e) => handleFileImport(e));

    document.getElementById("btn-confirm-creation").addEventListener("click", () => {
        const name = inputName.value.trim();

        if (!name) {
            showGameToast("يرجى كتابة اسم الدولة أو الإمبراطورية أولاً!", "✍️");
            inputName.focus();
            return;
        }

        const flag = flagEditor ? flagEditor.getFlagData() : [];
        const newNation = window.Country ? new window.Country(name, flag) : {
            id: "c_" + Date.now(),
            name,
            flag,
            year: currentWorld.year,
            stage: 1,
            budget: 0,
            revenue: 200,
            population: 100,
            area: 0,
            generalIndex: 0,
            military: { totalPower: 0 }
        };
        newNation.year = currentWorld.year;

        if (window.EconomyEngine) window.EconomyEngine.setupInitialFinances(newNation);
        if (window.IndicatorsEngine) window.IndicatorsEngine.refreshCountryIndicators(newNation);

        currentWorld.addCountry(newNation);
        if (currentWorld.addHistoryEvent) {
            currentWorld.addHistoryEvent("political", `تأسيس دولة ${name} وانضمامها إلى مجلس الأمم`, currentWorld.year);
        }

        // في نمط الغرف، حجز الدولة تلقائياً للمنشئ إن لم يكن قد حجز
        if (window.NetworkEngine && window.NetworkEngine.getRoomId() && !window.NetworkEngine.getMyCountryId()) {
            window.NetworkEngine.claimCountry(newNation.id);
        }

        modal.classList.remove("active");
        renderNationsTable();
        GameSFX.fanfare();
        spawnFloatingText(`👑 تأسست ${name}!`);
        showGameToast(`مرحباً بدولة "${name}" في عصر الهيمنة! اضغط على بطاقتها لبدء البناء.`, "🎉");
    });
}

/* 4. إعداد شريط التنقل السفلي للهواتف الذكية (Mobile Bottom Navigation) */
function setupMobileBottomNav() {
    const mobBtns = document.querySelectorAll(".mob-nav-btn");
    mobBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.target;
            const targetDesktopBtn = {
                table: viewTableBtn,
                charts: viewChartsBtn,
                chronicle: viewChronicleBtn,
                analytics: viewAnalyticsBtn,
                worldbank: viewWorldBankBtn,
                trade: viewTradeBtn,
                exchange: viewExchangeBtn,
                war: viewWarBtn
            }[target];

            if (targetDesktopBtn) {
                targetDesktopBtn.click();
            }
        });
    });
}

/* 5. إعداد نظام الغرف والتعددية (Multiplayer Lobby Events) */
function setupMultiplayerEvents() {
    const btnMenuMp = document.getElementById("btn-menu-multiplayer");
    const btnDashMp = document.getElementById("btn-open-rooms-modal");
    const btnCloseLobby = document.getElementById("btn-close-mp-lobby");
    const btnCreateRoom = document.getElementById("btn-create-new-room");
    const btnJoinRoom = document.getElementById("btn-join-existing-room");
    const btnMpReadyYear = document.getElementById("btn-mp-ready-year");
    const btnMpReadyWar = document.getElementById("btn-mp-ready-war");
    const btnMpOpenLobby = document.getElementById("btn-mp-open-lobby");

    const openLobby = () => {
        if (modalMpLobby) modalMpLobby.classList.add("active");
    };

    if (btnMenuMp) btnMenuMp.addEventListener("click", openLobby);
    if (btnDashMp) btnDashMp.addEventListener("click", openLobby);
    if (btnMpOpenLobby) btnMpOpenLobby.addEventListener("click", openLobby);
    if (btnCloseLobby) btnCloseLobby.addEventListener("click", () => modalMpLobby.classList.remove("active"));

    if (btnCreateRoom) {
        btnCreateRoom.addEventListener("click", () => {
            const name = document.getElementById("mp-player-name-input").value.trim() || "قائد سيادي";
            if (window.NetworkEngine) {
                window.NetworkEngine.createRoom(null, name, (res) => {
                    if (res.success) {
                        modalMpLobby.classList.remove("active");
                        openDashboard();
                        renderNationsTable();
                        showGameToast(`تم إنشاء الغرفة (${res.roomId}) بنجاح! شارك الرمز مع أصدقائك.`, "👑");
                    }
                });
            }
        });
    }

    if (btnJoinRoom) {
        btnJoinRoom.addEventListener("click", () => {
            const code = document.getElementById("mp-room-code-input").value.trim();
            const name = document.getElementById("mp-player-name-input").value.trim() || "قائد سيادي";

            if (!code) {
                showGameToast("يرجى إدخال رمز الغرفة أولاً!", "✍️");
                return;
            }

            if (window.NetworkEngine) {
                window.NetworkEngine.joinRoom(code, name, (res) => {
                    if (res.success) {
                        modalMpLobby.classList.remove("active");
                        openDashboard();
                        showGameToast(`تم الانضمام للغرفة بنجاح! اختر دولتك لبدء القيادة.`, "✅");
                    }
                });
            }
        });
    }

    if (btnMpReadyYear) {
        btnMpReadyYear.addEventListener("click", () => {
            if (window.NetworkEngine) {
                window.NetworkEngine.submitDecision("READY_YEAR");
            }
        });
    }

    if (btnMpReadyWar) {
        btnMpReadyWar.addEventListener("click", () => {
            if (window.NetworkEngine) {
                window.NetworkEngine.submitDecision("READY_WAR");
            }
        });
    }
}

function updateYearDisplay() {
    if (globalYearBadge) {
        globalYearBadge.textContent = `⏳ السنة المالية: ${currentWorld.year}م`;
    }
}

function openCreateModal() {
    inputName.value = "";
    if (!flagEditor && window.FlagEditor) {
        flagEditor = new window.FlagEditor("flag-grid");
    }
    if (flagEditor && typeof flagEditor.clearGrid === "function") {
        flagEditor.clearGrid();
    }
    modal.classList.add("active");
    setTimeout(() => inputName.focus(), 100);
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (window.StorageManager) {
        window.StorageManager.importFromFile(file, (err, world) => {
            if (err) {
                showGameToast(err, "❌");
                return;
            }
            currentWorld = world;
            window.currentWorld = currentWorld;
            updateYearDisplay();
            openDashboard();
            renderNationsTable();
            GameSFX.fanfare();
            showGameToast("تم استرجاع العالم المحفوظ بنجاح!", "📂");
            event.target.value = "";
        });
    }
}

function openDashboard() {
    screens.menu.classList.remove("active");
    screens.countryDetail.classList.remove("active");
    screens.dashboard.classList.add("active");
    updateYearDisplay();
}

function getStageTitle(stageNum) {
    const stages = {
        1: "🏕️ النشأة",
        2: "🏘️ التوسع",
        3: "🏭 الصناعة",
        4: "🏙️ المدن الذكية",
        5: "🚀 العصر العملاق"
    };
    return stages[stageNum] || `🏛️ المرحلة ${stageNum || 1}`;
}

function renderNationsTable() {
    if (!nationsGrid) return;
    nationsGrid.innerHTML = "";
    const countries = currentWorld.getAllCountries();
    if (globalCountBadge) globalCountBadge.textContent = `🌍 إجمالي الدول: ${countries.length}`;
    updateYearDisplay();

    if (countries.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "nations-empty-card";
        emptyDiv.innerHTML = `
      <div style="font-size:3.2rem; margin-bottom:10px;">🏰✨</div>
      <div>عالمك الجديد بانتظار أولى حضاراته!</div>
      <span style="font-size:0.95rem; color:#fde68a; margin-top:8px; display:inline-block;">
        اضغط على زر <strong>"🏰 + تأسيس دولة"</strong> لرفع رايتك وبناء أول إمبراطورية.
      </span>
    `;
        nationsGrid.appendChild(emptyDiv);

        if (window.ChartsManager) window.ChartsManager.renderCharts([]);
        if (window.ChronicleManager) window.ChronicleManager.render(currentWorld);
        if (window.AnalyticsManager) window.AnalyticsManager.render(currentWorld);
        if (window.WorldBankManager) window.WorldBankManager.render(currentWorld);
        if (window.TradeManager) window.TradeManager.render(currentWorld);
        if (window.ExchangeManager) window.ExchangeManager.render(currentWorld);
        if (window.WarView) window.WarView.render(currentWorld);
        return;
    }

    countries.forEach(c => {
        if (window.IndicatorsEngine) window.IndicatorsEngine.refreshCountryIndicators(c);
        if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
            window.MilitaryEngine.refreshMilitaryStats(c);
        }

        const milPower = (c.military && typeof c.military.totalPower === "number") ?
            c.military.totalPower :
            0;
        const generalIdx = typeof c.generalIndex === "number" ? Math.round(c.generalIndex) : 0;

        const card = document.createElement("div");
        card.className = "nation-sovereign-card";
        card.setAttribute("data-id", c.id);

        const topRibbon = document.createElement("div");
        topRibbon.className = "nation-card-top-ribbon";
        topRibbon.innerHTML = `
      <span class="nation-stage-pill">${getStageTitle(c.stage || 1)}</span>
      <span class="nation-index-pill">⭐ ${generalIdx.toLocaleString()}</span>
    `;

        const flagFrame = document.createElement("div");
        flagFrame.className = "nation-card-flag-frame";
        const flagBox = document.createElement("div");
        flagBox.className = "nation-flag-box";

        if (window.FlagEditor && typeof window.FlagEditor.renderFlag === "function") {
            window.FlagEditor.renderFlag(flagBox, c.flag, 58, 36);
        }
        flagFrame.appendChild(flagBox);

        const nameEl = document.createElement("div");
        nameEl.className = "nation-card-name";
        nameEl.textContent = `👑 ${c.name}`;

        const statsGrid = document.createElement("div");
        statsGrid.className = "nation-card-stats-grid";

        statsGrid.innerHTML = `
      <div class="nation-card-stat">
        <span class="stat-label">💰 الميزانية</span>
        <span class="stat-val text-gold">$${Number(c.budget || 0).toLocaleString()}</span>
      </div>
      <div class="nation-card-stat">
        <span class="stat-label">👥 السكان</span>
        <span class="stat-val text-purple">${Number(c.population || 0).toLocaleString()}</span>
      </div>
      <div class="nation-card-stat">
        <span class="stat-label">🏗️ العمران</span>
        <span class="stat-val text-cyan">${Number(c.area || 0).toLocaleString()}</span>
      </div>
      <div class="nation-card-stat">
        <span class="stat-label">⚔️ القوة</span>
        <span class="stat-val text-emerald">${Number(milPower).toLocaleString()}</span>
      </div>
    `;

        const playFooter = document.createElement("div");
        playFooter.className = "nation-card-play-footer";
        playFooter.innerHTML = `🎮 قيادة الدولة وإدارتها ➔`;

        card.appendChild(topRibbon);
        card.appendChild(flagFrame);
        card.appendChild(nameEl);
        card.appendChild(statsGrid);
        card.appendChild(playFooter);

        card.addEventListener("click", () => {
            GameSFX.tab();
            if (window.CountryView && typeof window.CountryView.open === "function") {
                window.CountryView.open(c);
            }
        });

        nationsGrid.appendChild(card);
    });

    if (window.ChartsManager) window.ChartsManager.renderCharts(countries);
    if (window.ChronicleManager) window.ChronicleManager.render(currentWorld);
    if (window.AnalyticsManager) window.AnalyticsManager.render(currentWorld);
    if (window.WorldBankManager) window.WorldBankManager.render(currentWorld);
    if (window.TradeManager) window.TradeManager.render(currentWorld);
    if (window.ExchangeManager) window.ExchangeManager.render(currentWorld);
    if (window.WarView) window.WarView.render(currentWorld);
}

window.renderNationsTable = renderNationsTable;