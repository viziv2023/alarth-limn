// بدائل آمنة للنوافذ الحوارية داخل بيئة Canvas والجوال
function alert(msg) {
    if (typeof window.showGameToast === "function") {
        window.showGameToast(String(msg || ""), "⚠️");
    }
}
function confirm(msg) {
    return true;
}
function prompt(msg, defVal) {
    return defVal || "";
}

/**
 * ============================================================================
 * main.js - محرك التشغيل الرئيسي والانتقال المباشر لمشهد العاصمة 3D (v5.2)
 * ============================================================================
 *
 * الإصلاحات والمزايا المحدثة (v5.2):
 * 1. تفعيل تلقائي لنظام الحرب (WarView.init) وإصلاح تبديل تاب غرفة الحرب.
 * 2. إصلاح التمرير السلس في نافذة تأسيس الدولة ومحرر العلم الوطني على الهواتف.
 * 3. تنظيم شامل للدخول في الروم واختيار الاسم والدولة دون أخطاء أو تداخل في الملكية.
 * 4. دعم تطبيق الجوال المستقل (PWA Service Worker + زر ملء الشاشة التلقائي).
 */

window.currentWorld = null;
window.soundEnabled = true;
window.activeChartFilter = "all";

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
    toast.innerHTML = `<span style="font-size:1.1rem;">${icon || "🌟"}</span><span>${msg}</span>`;
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

// دالة موحدة لمعالجة ضغط اللاعب على أحد الزرين في الأعلى بعد انتهاء الشراء:
// الزر الأول: (الانتقال للسنة الجديدة - READY_YEAR)
// الزر الثاني: (الانتقال للحرب - READY_WAR)
window.triggerPlayerTurnDecision = function(decision) {
    if (window.GameSFX) window.GameSFX.playClick();

    const countries = (window.currentWorld && Array.isArray(window.currentWorld.countries)) ? window.currentWorld.countries : [];
    const myId = (window.NetworkEngine && typeof window.NetworkEngine.getMyCountryId === "function") ? window.NetworkEngine.getMyCountryId() : null;
    const activeCountry = (myId && countries.find(c => String(c.id) === String(myId) && !c.isAI)) ||
        (window.currentViewingCountry && !window.currentViewingCountry.isAI ? window.currentViewingCountry : null) ||
        countries.find(c => !c.isAI) ||
        countries[0] ||
        null;

    if (!activeCountry) {
        window.showGameToast("يرجى تأسيس دولتك أولاً قبل الانتقال للسنة الجديدة أو الحرب!", "🏰");
        if (typeof window.openCreateCountryModal === "function") window.openCreateCountryModal();
        return;
    }

    if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
        window.MilitaryEngine.syncCountryWithMilitary(activeCountry);
    }

    const isMp = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());
    if (isMp) {
        window.NetworkEngine.submitDecision(decision);
        return;
    }

    // في وضع اللعب الفردي أو المحلي على نفس الجهاز:
    if (decision === "READY_WAR") {
        if (window.AIEngine && typeof window.AIEngine.runPreYearEndAITurns === "function") {
            try { window.AIEngine.runPreYearEndAITurns(window.currentWorld); } catch (e) {}
        }
        const warQueue = [
            {
                playerId: "local_player",
                playerName: activeCountry.name,
                countryId: activeCountry.id
            }
        ];
        if (window.AIEngine && typeof window.AIEngine.collectAIWarRequesters === "function") {
            const aiWars = window.AIEngine.collectAIWarRequesters(window.currentWorld);
            aiWars.forEach(item => warQueue.push(item));
        }
        if (window.WarView && typeof window.WarView.onNetworkWarPhaseTriggered === "function") {
            window.WarView.onNetworkWarPhaseTriggered(warQueue, true);
        }
    } else {
        const modal = document.getElementById("modal-confirm-year");
        if (modal) modal.classList.add("active");
    }
};

// تحديث مظهر ونصوص أزرار (الانتقال للسنة الجديدة) و(الانتقال للحرب) في جميع الشاشات
window.updateAllTurnDecisionButtons = function(myReadiness, readyCount, totalActive, isMp) {
    if (myReadiness === undefined && window.NetworkEngine && typeof window.NetworkEngine.getMyReadiness === "function") {
        myReadiness = window.NetworkEngine.getMyReadiness();
    }
    if (isMp === undefined) {
        isMp = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());
    }

    const yearBtnIds = ["btn-mp-ready-year", "btn-global-next-year", "btn-cap-next-year", "btn-detail-next-year", "btn-mil-next-year"];
    const warBtnIds = ["btn-mp-ready-war", "btn-global-go-war", "btn-cap-go-war", "btn-detail-go-war", "btn-mil-go-war"];
    const currentYr = (window.currentWorld && window.currentWorld.year) ? window.currentWorld.year : 1;

    const progressSuffix = (isMp && totalActive > 1) ? ` (${readyCount}/${totalActive})` : "";

    yearBtnIds.forEach(function(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (isMp && myReadiness === "READY_YEAR") {
            btn.className = btn.className.replace(/btn-secondary/g, "btn-primary") + " active-decision";
            btn.textContent = "✅ جاهز للسنة الجديدة" + progressSuffix;
        } else {
            btn.classList.remove("active-decision");
            btn.textContent = `🌟 السنة الجديدة (${currentYr + 1}م)`;
        }
    });

    warBtnIds.forEach(function(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (isMp && myReadiness === "READY_WAR") {
            btn.className = btn.className.replace(/btn-secondary/g, "btn-danger") + " active-decision";
            btn.textContent = "🚨 طلبت الحرب" + progressSuffix;
        } else {
            btn.classList.remove("active-decision");
            btn.textContent = "⚔️ الحرب";
        }
    });
};

// =========================================================================
// 0. نظام ملء الشاشة وتثبيت التطبيق على الجوال (PWA & Fullscreen Mode)
// =========================================================================
function registerPWAAndFullscreen() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").catch(function() {});
    }

    window.toggleGameFullscreen = function(forceEnter) {
        const docEl = document.documentElement;
        const isFull = document.fullscreenElement || document.webkitFullscreenElement;

        if (!isFull || forceEnter === true) {
            const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
            if (req) {
                req.call(docEl).then(function() {
                    if (screen.orientation && typeof screen.orientation.lock === "function") {
                        screen.orientation.lock("landscape").catch(function() {});
                    }
                }).catch(function() {});
            }
        } else if (forceEnter !== true) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
            if (exit) exit.call(document).catch(function() {});
        }
    };

    const btnFullDash = document.getElementById("btn-fullscreen-dash");
    if (btnFullDash) {
        btnFullDash.onclick = function() {
            window.GameSFX.playClick();
            window.toggleGameFullscreen();
        };
    }

    const btnFullMenu = document.getElementById("btn-menu-fullscreen");
    if (btnFullMenu) {
        btnFullMenu.onclick = function() {
            window.GameSFX.playClick();
            window.toggleGameFullscreen();
        };
    }
}

// =========================================================================
// 0.ب. محرر العلم الوطني التفاعلي المضمون (مع دعم تمرير النافذة بسلاسة)
// =========================================================================
let activeFlagBrushColor = "#c0392b";
let currentFlagCellsState = [
    "#c0392b", "#c0392b", "#c0392b", "#c0392b",
    "#ffffff", "#f1c40f", "#f1c40f", "#ffffff",
    "#27ae60", "#27ae60", "#27ae60", "#27ae60"
];
let isPaintingFlag = false;

function normalizeFlagArray(flagInput) {
    const defaultFlag = [
        "#c0392b", "#c0392b", "#c0392b", "#c0392b",
        "#ffffff", "#f1c40f", "#f1c40f", "#ffffff",
        "#27ae60", "#27ae60", "#27ae60", "#27ae60"
    ];
    if (!Array.isArray(flagInput) || flagInput.length === 0) return [...defaultFlag];
    const flat = Array.isArray(flagInput[0]) ? flagInput.flat() : flagInput;
    const res = [];
    for (let i = 0; i < 12; i++) {
        res.push(flat[i] || defaultFlag[i]);
    }
    return res;
}

window.renderFlagGridToElement = function(container, flagInput, w, h) {
    if (!container) return;
    const colors = normalizeFlagArray(flagInput);
    container.innerHTML = "";
    container.style.display = "inline-grid";
    container.style.gridTemplateColumns = "repeat(4, 1fr)";
    container.style.gridTemplateRows = "repeat(3, 1fr)";
    container.style.gap = "1px";
    container.style.background = "#090612";
    container.style.padding = "2px";
    container.style.border = "1.5px solid #fbbf24";
    container.style.borderRadius = "5px";
    container.style.width = (w || 38) + "px";
    container.style.height = (h || 24) + "px";
    container.style.minWidth = (w || 38) + "px";
    container.style.minHeight = (h || 24) + "px";
    container.style.verticalAlign = "middle";

    colors.forEach(function(col) {
        const cell = document.createElement("div");
        cell.style.backgroundColor = col;
        cell.style.background = col;
        cell.style.width = "100%";
        cell.style.height = "100%";
        cell.style.minWidth = "6px";
        cell.style.minHeight = "5px";
        container.appendChild(cell);
    });
};

function ensureInteractiveFlagDesigner() {
    const grid = document.getElementById("flag-grid");
    if (!grid) return;

    const allBlack = currentFlagCellsState.every(c => !c || c === "#000000" || c === "#111111" || c === "rgb(0, 0, 0)");
    if (allBlack) {
        currentFlagCellsState = [
            "#c0392b", "#c0392b", "#c0392b", "#c0392b",
            "#ffffff", "#f1c40f", "#f1c40f", "#ffffff",
            "#27ae60", "#27ae60", "#27ae60", "#27ae60"
        ];
    }

    grid.innerHTML = "";

    function paintCell(cellEl, idx, color) {
        currentFlagCellsState[idx] = color;
        cellEl.style.backgroundColor = color;
        cellEl.style.background = color;
        cellEl.setAttribute("data-color", color);
        if (window.FlagEditor) {
            if (Array.isArray(window.FlagEditor.cells)) window.FlagEditor.cells[idx] = color;
            if (Array.isArray(window.FlagEditor.currentFlag)) window.FlagEditor.currentFlag[idx] = color;
        }
    }

    for (let i = 0; i < 12; i++) {
        const cell = document.createElement("div");
        cell.className = "flag-cell";
        const col = currentFlagCellsState[i] || "#c0392b";
        cell.style.backgroundColor = col;
        cell.style.background = col;
        cell.setAttribute("data-idx", String(i));
        cell.setAttribute("data-color", col);

        cell.addEventListener("mousedown", function() {
            isPaintingFlag = true;
            if (window.GameSFX) window.GameSFX.playClick();
            paintCell(cell, i, activeFlagBrushColor);
        });

        cell.addEventListener("mouseenter", function() {
            if (isPaintingFlag) {
                paintCell(cell, i, activeFlagBrushColor);
            }
        });

        cell.addEventListener("click", function() {
            if (window.GameSFX) window.GameSFX.playClick();
            paintCell(cell, i, activeFlagBrushColor);
        });

        grid.appendChild(cell);
    }

    window.addEventListener("mouseup", function() {
        isPaintingFlag = false;
    });

    const paletteBtns = document.querySelectorAll("#preset-palette .palette-btn");
    paletteBtns.forEach(function(btn) {
        const col = btn.getAttribute("data-color");
        if (col) {
            btn.style.backgroundColor = col;
            btn.style.background = col;
        }
        btn.onclick = function(e) {
            e.preventDefault();
            if (window.GameSFX) window.GameSFX.playClick();
            paletteBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            activeFlagBrushColor = col || "#c0392b";
        };
    });

    const customInp = document.getElementById("custom-color-input");
    if (customInp) {
        customInp.oninput = function(e) {
            activeFlagBrushColor = e.target.value;
            paletteBtns.forEach(b => b.classList.remove("selected"));
        };
        customInp.onchange = function(e) {
            activeFlagBrushColor = e.target.value;
        };
    }

    const wrap = grid.closest(".flag-designer-wrap");
    if (wrap && !document.getElementById("flag-quick-tools")) {
        const toolsRow = document.createElement("div");
        toolsRow.id = "flag-quick-tools";
        toolsRow.style.cssText = "display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-top:4px;";
        toolsRow.innerHTML = `
            <button type="button" id="btn-flag-random" class="btn btn-secondary btn-sm" style="font-size:0.7rem; padding:2px 8px;">🎲 علم عشوائي</button>
            <button type="button" id="btn-flag-stripes" class="btn btn-secondary btn-sm" style="font-size:0.7rem; padding:2px 8px;">🏳️ 3 خطوط</button>
            <button type="button" id="btn-flag-fill" class="btn btn-secondary btn-sm" style="font-size:0.7rem; padding:2px 8px;">🪣 تلوين الكل</button>
        `;
        wrap.appendChild(toolsRow);

        const paletteColors = ["#c0392b", "#2980b9", "#27ae60", "#f1c40f", "#8e44ad", "#e67e22", "#00b894", "#ffffff", "#111111"];

        document.getElementById("btn-flag-random").onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            const c1 = paletteColors[Math.floor(Math.random() * paletteColors.length)];
            const c2 = paletteColors[Math.floor(Math.random() * paletteColors.length)];
            const c3 = paletteColors[Math.floor(Math.random() * paletteColors.length)];
            const emblem = "#f1c40f";
            const pattern = [c1, c1, c1, c1, c2, emblem, emblem, c2, c3, c3, c3, c3];
            const cells = grid.querySelectorAll(".flag-cell");
            cells.forEach((el, idx) => paintCell(el, idx, pattern[idx]));
        };

        document.getElementById("btn-flag-stripes").onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            const c1 = activeFlagBrushColor || "#c0392b";
            const pattern = [c1, c1, c1, c1, "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#111111", "#111111", "#111111", "#111111"];
            const cells = grid.querySelectorAll(".flag-cell");
            cells.forEach((el, idx) => paintCell(el, idx, pattern[idx]));
        };

        document.getElementById("btn-flag-fill").onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            const cells = grid.querySelectorAll(".flag-cell");
            cells.forEach((el, idx) => paintCell(el, idx, activeFlagBrushColor));
        };
    }

    window.FlagEditor = window.FlagEditor || {};
    window.FlagEditor.getCurrentFlag = function() {
        const domCells = document.querySelectorAll("#flag-grid .flag-cell, #flag-grid > div");
        if (domCells.length === 12) {
            return Array.from(domCells).map((el, idx) => el.getAttribute("data-color") || currentFlagCellsState[idx] || "#c0392b");
        }
        return [...currentFlagCellsState];
    };
    window.FlagEditor.renderFlag = function(container, flagArr, w, h) {
        window.renderFlagGridToElement(container, flagArr, w || 38, h || 24);
    };
}

// =========================================================================
// 1. تهيئة اللعبة وبناء العالم الافتراضي (Initialization)
// =========================================================================
function initGame() {
    registerPWAAndFullscreen();

    if (!window.currentWorld && window.World) {
        window.currentWorld = new window.World();
    }

    setupMainMenuEvents();
    setupDashboardEvents();
    setupMultiplayerLobbyEvents();
    setupCreationModalEvents();
    setupYearConfirmationEvents();
    setupTabSwitching();
    setupChartsFilterEvents();

    if (window.FlagEditor && typeof window.FlagEditor.init === "function") {
        try { window.FlagEditor.init(); } catch (e) {}
    }
    ensureInteractiveFlagDesigner();

    if (window.CountryViewController && typeof window.CountryViewController.init === "function") {
        try { window.CountryViewController.init(); } catch (e) {}
    }

    if (window.WarView && typeof window.WarView.init === "function") {
        try { window.WarView.init(); } catch (e) {}
    }

    if (window.AIEngine && typeof window.AIEngine.init === "function") {
        try { window.AIEngine.init(); } catch (e) {}
    }

    if (window.IntroBattleEngine && typeof window.IntroBattleEngine.start === "function") {
        try { window.IntroBattleEngine.start(); } catch (e) {}
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
            if (window.innerWidth <= 960 && window.toggleGameFullscreen) {
                window.toggleGameFullscreen(true);
            }
            if (!window.currentWorld && window.World) {
                window.currentWorld = new window.World();
            }
            showDashboardScreen();
            renderNationsTable();
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
            const targetCountry = (myId && countries.find(c => String(c.id) === String(myId) && !c.isAI)) ||
                countries.find(c => !c.isAI) ||
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
            window.triggerPlayerTurnDecision("READY_YEAR");
        };
    }

    const btnGlobalWar = document.getElementById("btn-global-go-war");
    if (btnGlobalWar) {
        btnGlobalWar.onclick = function() {
            window.triggerPlayerTurnDecision("READY_WAR");
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

    const btnMpReadyYear = document.getElementById("btn-mp-ready-year");
    if (btnMpReadyYear) {
        btnMpReadyYear.onclick = function() {
            window.triggerPlayerTurnDecision("READY_YEAR");
        };
    }

    const btnMpReadyWar = document.getElementById("btn-mp-ready-war");
    if (btnMpReadyWar) {
        btnMpReadyWar.onclick = function() {
            window.triggerPlayerTurnDecision("READY_WAR");
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
// 4. إدارة نافذة الغرف المتعددة والحفظ الدائم (Multiplayer Lobby - بدون أخطاء)
// =========================================================================
function getSafeLocalStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function enterNumericRoomAndProceed(roomNumStr) {
    const modal = document.getElementById("modal-multiplayer-lobby");
    const nameInp = document.getElementById("mp-player-name-input");
    const pName = (nameInp && nameInp.value && nameInp.value.trim()) ? nameInp.value.trim() : "قائد سيادي";

    if (!window.NetworkEngine) return;

    window.NetworkEngine.joinRoom(roomNumStr, pName, function(res) {
        if (res && res.success) {
            if (modal) modal.classList.remove("active");
            showDashboardScreen();
            renderNationsTable();

            setTimeout(function() {
                const myCId = window.NetworkEngine.getMyCountryId();
                const countries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];
                if (!myCId) {
                    if (countries.length === 0) {
                        openCreateCountryModal();
                    } else {
                        window.showGameToast("تم دخول الروم (" + res.roomId + ")! اختر دولة متاحة أو اضغط (🏰 + دولة) لتأسيس دولتك.", "👑");
                    }
                }
            }, 350);
        }
    });
}

function openMultiplayerLobbyModal() {
    const modal = document.getElementById("modal-multiplayer-lobby");
    if (!modal) return;

    const nameInp = document.getElementById("mp-player-name-input");
    const savedName = getSafeLocalStorage("hegemony_player_name");
    if (nameInp && savedName) {
        nameInp.value = savedName;
    }

    const btnResetRoom = document.getElementById("btn-reset-current-room");
    if (btnResetRoom) {
        const activeRoom = window.NetworkEngine && window.NetworkEngine.getRoomId();
        btnResetRoom.style.display = activeRoom ? "inline-flex" : "none";
        btnResetRoom.onclick = function() {
            if (window.NetworkEngine && typeof window.NetworkEngine.resetCurrentRoom === "function") {
                window.NetworkEngine.resetCurrentRoom();
                modal.classList.remove("active");
            }
        };
    }

    const rawLastRoom = getSafeLocalStorage("hegemony_last_active_room");
    const cleanLastRoom = (window.NetworkEngine && typeof window.NetworkEngine.normalizeRoomCode === "function") ?
        window.NetworkEngine.normalizeRoomCode(rawLastRoom) :
        (rawLastRoom ? String(rawLastRoom).replace(/[^0-9]/g, "") : "");

    const savedBox = document.getElementById("mp-saved-room-box");
    const savedDesc = document.getElementById("mp-saved-room-desc");

    if (cleanLastRoom && savedBox && savedDesc) {
        savedBox.style.display = "block";
        savedDesc.textContent = "🔄 آخر روم محفوظ لديك: رقم (" + cleanLastRoom + ")";

        const btnResume = document.getElementById("btn-resume-saved-room");
        if (btnResume) {
            btnResume.onclick = function() {
                enterNumericRoomAndProceed(cleanLastRoom);
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

    // فلترة حقل رقم الغرفة ليقبل الأرقام فقط (مع تحويل الأرقام العربية تلقائياً)
    const codeInp = document.getElementById("mp-room-code-input");
    if (codeInp) {
        codeInp.addEventListener("input", function() {
            if (window.NetworkEngine && typeof window.NetworkEngine.normalizeRoomCode === "function") {
                const cleaned = window.NetworkEngine.normalizeRoomCode(codeInp.value);
                if (codeInp.value !== cleaned) {
                    codeInp.value = cleaned;
                }
            } else {
                codeInp.value = codeInp.value.replace(/[^0-9]/g, "");
            }
        });
    }

    // زر الروم الموحد العام (1000) بضغطة واحدة
    const btnUnifiedGlobal = document.getElementById("btn-join-unified-global-room");
    if (btnUnifiedGlobal) {
        btnUnifiedGlobal.onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            enterNumericRoomAndProceed("1000");
        };
    }

    // أزرار الأرقام السريعة (1111, 2222, 5555, 9999)
    modal.querySelectorAll(".mp-quick-num-btn").forEach(function(btn) {
        btn.onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            const num = btn.getAttribute("data-room") || "1000";
            if (codeInp) codeInp.value = num;
            enterNumericRoomAndProceed(num);
        };
    });

    // زر توليد رقم عشوائي جديد (4 أرقام فقط)
    const btnCreate = document.getElementById("btn-create-new-room");
    if (btnCreate) {
        btnCreate.onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            const randNum = String(Math.floor(1000 + Math.random() * 9000));
            if (codeInp) codeInp.value = randNum;
            enterNumericRoomAndProceed(randNum);
        };
    }

    // زر الدخول بالرقم المكتوب
    const btnJoin = document.getElementById("btn-join-existing-room");
    if (btnJoin) {
        btnJoin.onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            const rawCode = codeInp ? codeInp.value : "";
            const numCode = (window.NetworkEngine && typeof window.NetworkEngine.normalizeRoomCode === "function") ?
                window.NetworkEngine.normalizeRoomCode(rawCode) :
                String(rawCode).replace(/[^0-9]/g, "");

            if (!numCode) {
                window.showGameToast("يرجى كتابة رقم الروم بالأرقام فقط (مثال: 4821) أو الضغط على الروم الموحد (1000)!", "🔢");
                if (codeInp) codeInp.focus();
                return;
            }
            enterNumericRoomAndProceed(numCode);
        };
    }
}

// =========================================================================
// 5. نافذة تأسيس دولة جديدة (السكان = 0، المؤشر العام = 0، والعلم ملون بالكامل)
// =========================================================================
function openCreateCountryModal() {
    const modal = document.getElementById("modal-create-country");
    if (!modal) return;
    ensureInteractiveFlagDesigner();

    const aiBox = document.getElementById("create-modal-ai-selector");
    if (aiBox) {
        const isMp = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());
        const existingCountries = (window.currentWorld && Array.isArray(window.currentWorld.countries)) ? window.currentWorld.countries : [];
        // يظهر خيار تحديد عدد دول الذكاء الاصطناعي (1 إلى 10) عند تأسيس الدولة في اللعب المنفرد
        aiBox.style.display = (!isMp && existingCountries.length === 0) ? "block" : "none";
    }

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

            // منع تكرار نفس اسم الدولة داخل نفس العالم
            const existingCountries = (window.currentWorld && Array.isArray(window.currentWorld.countries)) ? window.currentWorld.countries : [];
            const duplicate = existingCountries.find(c => String(c.name).trim() === nationName);
            if (duplicate) {
                window.showGameToast("توجد دولة بهذا الاسم بالفعل! يرجى اختيار اسم مميز لدولتك.", "⚠️");
                if (nameInp) nameInp.focus();
                return;
            }

            const flagColors = window.FlagEditor && typeof window.FlagEditor.getCurrentFlag === "function" ?
                window.FlagEditor.getCurrentFlag() :
                [...currentFlagCellsState];

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
                    population: 0,
                    employed: 0,
                    unemployed: 0,
                    budget: 0,
                    disposableRevenue: 200,
                    bank: 0,
                    worldBankFund: 0,
                    generalIndex: 0,
                    currencyValue: 1.0,
                    perCapitaIncome: 0,
                    area: 0,
                    buildings: window.BuildingsEngine ? window.BuildingsEngine.createDefaultBuildings() : {},
                    sectors: {},
                    energy: {},
                    military: { inventory: {}, totalPower: 0, totalCrew: 0, totalFuelConsumption: 0, netAmmoBalance: 0, ammoDemand: 0, ammoProduction: 0 }
                };
            }

            newCountry.flag = flagColors;
            newCountry.population = 0;
            newCountry.employed = 0;
            newCountry.unemployed = 0;
            newCountry.generalIndex = 0;

            if (window.NetworkEngine) {
                newCountry.ownerPlayerId = window.NetworkEngine.getLocalPlayerId();
                newCountry.ownerPlayerName = window.NetworkEngine.getPlayerName ? window.NetworkEngine.getPlayerName() : "قائد سيادي";
            }

            if (window.SectorsEngine && typeof window.SectorsEngine.recalculateCountrySectors === "function") {
                window.SectorsEngine.recalculateCountrySectors(newCountry, window.currentWorld);
            }
            if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
                window.IndicatorsEngine.refreshCountryIndicators(newCountry);
            } else if (window.BuildingsEngine && typeof window.BuildingsEngine.refreshFallbackIndicators === "function") {
                window.BuildingsEngine.refreshFallbackIndicators(newCountry);
            }

            const wasFirstSoloCountry = !(window.NetworkEngine && window.NetworkEngine.getRoomId()) && existingCountries.length === 0;
            newCountry.isAI = false;

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
                if (window.NetworkEngine && typeof window.NetworkEngine.claimCountry === "function") {
                    window.NetworkEngine.claimCountry(newCountry.id);
                }
                // تأسيس دول الذكاء الاصطناعي المختارة (من 1 إلى 10) عند بدء اللعب المنفرد
                if (wasFirstSoloCountry && window.AIEngine && typeof window.AIEngine.spawnAICountries === "function") {
                    const aiCount = Number(window.selectedSoloAICount) || 4;
                    window.AIEngine.spawnAICountries(window.currentWorld, aiCount);
                }
                renderNationsTable();
            }

            modal.classList.remove("active");
            window.currentViewingCountry = newCountry;
            window.isViewingAsSpectator = false;

            if (window.CapitalView && typeof window.CapitalView.open === "function") {
                window.CapitalView.open(newCountry);
            } else if (window.CountryViewController) {
                window.CountryViewController.open(newCountry);
            }

            const spawnedAiCount = wasFirstSoloCountry ? (Number(window.selectedSoloAICount) || 4) : 0;
            if (spawnedAiCount > 0) {
                window.showGameToast("🎉 مرحباً بك في عاصمة [" + nationName + "]! بدأ اللعب المنفرد مع (" + spawnedAiCount + ") دول يتحكم بها الذكاء الاصطناعي 🤖", "🏛️");
            } else {
                window.showGameToast("🎉 مرحباً بك في عاصمة [" + nationName + "]! ابْنِ بيتاً 🏠 أولاً لخروج السكان والعمال", "🏛️");
            }
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

                if (window.CapitalView && typeof window.CapitalView.refreshHUDAndMap === "function") {
                    window.CapitalView.refreshHUDAndMap();
                }

                window.showGameToast("🌟 انطلقت السنة المالية " + (window.currentWorld.year || 1) + "م وتم جني العوائد!", "💰");
            }
        };
    }
}

// =========================================================================
// 7. التبديل التفاعلي بين التابات الثمانية + معالج التباين والسباق والأعلام
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

        if (targetKey === "table") {
            renderNationsTable();
        } else if (targetKey === "charts") {
            renderChartsAndRaceTab(window.currentWorld, window.activeChartFilter || "all");
        } else if (targetKey === "chronicle") {
            if (window.ChronicleManager) {
                if (typeof window.ChronicleManager.clearUnread === "function") {
                    window.ChronicleManager.clearUnread();
                }
                if (typeof window.ChronicleManager.render === "function") {
                    try { window.ChronicleManager.render(window.currentWorld); } catch (e) {}
                }
            }
        } else if (targetKey === "analytics") {
            if (window.AnalyticsManager && typeof window.AnalyticsManager.render === "function") {
                try { window.AnalyticsManager.render(window.currentWorld); } catch (e) {}
            }
            enhanceAndSanitizeTabDOM("analytics-grid-wrapper", "analytics", window.currentWorld);
        } else if (targetKey === "worldbank") {
            if (window.WorldBankManager && typeof window.WorldBankManager.render === "function") {
                try { window.WorldBankManager.render(window.currentWorld); } catch (e) {}
            }
            enhanceAndSanitizeTabDOM("worldbank-content-wrapper", "worldbank", window.currentWorld);
        } else if (targetKey === "trade") {
            if (window.TradeManager && typeof window.TradeManager.render === "function") {
                try { window.TradeManager.render(window.currentWorld); } catch (e) {}
            }
            enhanceAndSanitizeTabDOM("trade-content-wrapper", "trade", window.currentWorld);
        } else if (targetKey === "exchange") {
            if (window.ExchangeManager && typeof window.ExchangeManager.render === "function") {
                try { window.ExchangeManager.render(window.currentWorld); } catch (e) {}
            }
            enhanceAndSanitizeTabDOM("exchange-content-wrapper", "exchange", window.currentWorld);
        } else if (targetKey === "war") {
            if (window.WarView && typeof window.WarView.render === "function") {
                try { window.WarView.render(window.currentWorld); } catch (e) { console.error(e); }
            }
        }
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
// 7.أ. محرك سباق المؤشرات الـ 8 المضمون (Race / Charts Tab)
// =========================================================================
const CHART_INDICATORS_META = [
    { key: "budget", title: "💰 الميزانية والعائد السنوي", unit: "$", prefix: true, color: "#fbbf24", getVal: c => Number(c.budget || 0) },
    { key: "population", title: "👥 إجمالي السكان", unit: " نسمة", prefix: false, color: "#c084fc", getVal: c => Number(c.population || 0) },
    { key: "income", title: "💎 متوسط دخل الفرد", unit: "$", prefix: true, color: "#34d399", getVal: c => Number(c.perCapitaIncome || 0) },
    { key: "area", title: "🏗️ المساحة العمرانية", unit: " نقطة", prefix: false, color: "#38bdf8", getVal: c => Number(c.area || 0) },
    { key: "generalIndex", title: "⭐ المؤشر العام للدولة", unit: " نقطة", prefix: false, color: "#22d3ee", getVal: c => Number(c.generalIndex || 0) },
    { key: "oilPrice", title: "🛢️ سعر برميل النفط", unit: "$", prefix: true, color: "#fb923c", getVal: c => Number(c.oilPrice || (c.energy && c.energy.oilPrice) || 50) },
    { key: "militaryPower", title: "⚔️ القوة العسكرية المقدرة", unit: " قوة", prefix: false, color: "#a3e635", getVal: c => Number((c.military && c.military.totalPower) || c.militaryPower || 0) },
    { key: "currencyValue", title: "🪙 قيمة العملة الوطنية", unit: "", prefix: false, color: "#60a5fa", getVal: c => Number(Number(c.currencyValue || 1).toFixed(2)) }
];

function setupChartsFilterEvents() {
    const filterBtns = document.querySelectorAll(".charts-filter-bar .chart-filter-btn");
    filterBtns.forEach(function(btn) {
        btn.onclick = function() {
            if (window.GameSFX) window.GameSFX.playClick();
            filterBtns.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            window.activeChartFilter = btn.getAttribute("data-chart") || "all";
            renderChartsAndRaceTab(window.currentWorld, window.activeChartFilter);
        };
    });
}

function renderChartsAndRaceTab(world, filterKey) {
    const grid = document.getElementById("charts-grid");
    if (!grid) return;

    const countries = (world && Array.isArray(world.countries)) ? world.countries : [];
    if (countries.length === 0) {
        grid.innerHTML = `<div class="nations-empty-card" style="padding:24px;">📊 أسس دولة واحدة على الأقل لبدء سباق المؤشرات الثمانية!</div>`;
        return;
    }

    const activeIndicators = (!filterKey || filterKey === "all") ?
        CHART_INDICATORS_META :
        CHART_INDICATORS_META.filter(m => m.key === filterKey);

    grid.innerHTML = "";

    activeIndicators.forEach(function(ind) {
        const sorted = [...countries].sort((a, b) => ind.getVal(b) - ind.getVal(a));
        const maxVal = Math.max(1, ...sorted.map(c => Math.abs(ind.getVal(c))));

        const card = document.createElement("div");
        card.className = "race-indicator-card";
        card.style.borderTopColor = ind.color;

        const rowsHtml = sorted.map(function(c, idx) {
            const val = ind.getVal(c);
            const pct = Math.max(6, Math.min(100, Math.round((Math.abs(val) / maxVal) * 100)));
            const formattedVal = ind.prefix ?
                (val < 0 ? "-$" + Math.abs(val).toLocaleString() : "$" + val.toLocaleString()) :
                (val.toLocaleString() + ind.unit);

            return `
                <div class="race-bar-row">
                    <div class="race-bar-top">
                        <div class="race-nation-info">
                            <span class="race-rank-badge">#${idx + 1}</span>
                            <div class="table-flag" data-flag-country="${c.id}"></div>
                            <strong style="color:#fffbeb; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</strong>
                        </div>
                        <strong style="color:${ind.color}; font-variant-numeric:tabular-nums;">${formattedVal}</strong>
                    </div>
                    <div class="race-bar-track">
                        <div class="race-bar-fill" style="width:${pct}%; background:${ind.color};"></div>
                    </div>
                </div>
            `;
        }).join("");

        card.innerHTML = `
            <div class="race-card-header">
                <span>${ind.title}</span>
                <span class="badge" style="font-size:0.72rem; padding:2px 8px;">⏳ سنة ${(world && world.year) || 1}م</span>
            </div>
            <div class="race-bars-list">
                ${rowsHtml}
            </div>
        `;

        grid.appendChild(card);
    });

    populateAllFlagPlaceholders(grid, countries);
}

// =========================================================================
// 7.ب. معالج التباين وإظهار الأعلام في الكشاف والتاريخ والبنك والبورصة
// =========================================================================
function populateAllFlagPlaceholders(rootEl, countries) {
    if (!rootEl || !Array.isArray(countries)) return;

    rootEl.querySelectorAll("[data-flag-country]").forEach(function(el) {
        const cId = el.getAttribute("data-flag-country");
        const c = countries.find(item => String(item.id) === String(cId) || String(item.name) === String(cId));
        if (c) window.renderFlagGridToElement(el, c.flag, 38, 24);
    });

    rootEl.querySelectorAll(".table-flag, .mini-flag, .analytics-flag, .chronicle-flag").forEach(function(el) {
        if (el.children.length === 0) {
            const row = el.closest("tr, .analytics-card, .dossier-card, div");
            const text = row ? row.textContent : "";
            const matchedCountry = countries.find(c => c.name && text.includes(c.name)) || countries[0];
            if (matchedCountry) {
                window.renderFlagGridToElement(el, matchedCountry.flag, 38, 24);
            }
        } else {
            el.style.display = "inline-grid";
            el.style.gridTemplateColumns = "repeat(4, 8px)";
            el.style.gridTemplateRows = "repeat(3, 6px)";
            el.style.width = "38px";
            el.style.height = "24px";
            Array.from(el.children).forEach(function(child) {
                child.style.width = "100%";
                child.style.height = "100%";
                child.style.minWidth = "6px";
                child.style.minHeight = "5px";
            });
        }
    });
}

function enhanceAndSanitizeTabDOM(wrapperId, tabKey, world) {
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const countries = (world && Array.isArray(world.countries)) ? world.countries : [];

    if (wrapper.children.length === 0) {
        renderBuiltInTabFallback(wrapper, tabKey, world, countries);
    }

    wrapper.querySelectorAll("*").forEach(function(el) {
        const bg = (el.style && (el.style.backgroundColor || el.style.background)) ?
            (el.style.backgroundColor || el.style.background).toLowerCase() : "";

        if (bg.includes("#fff") || bg.includes("#fdf6e3") || bg.includes("#f8fafc") || bg.includes("#f1f5f9") || bg.includes("white") || bg.includes("rgb(255, 255, 255)") || bg.includes("rgb(253, 246, 227)")) {
            const tag = el.tagName.toLowerCase();
            if (tag === "span" || tag === "button") {
                el.style.color = "#1e1b4b";
            } else {
                el.style.background = "linear-gradient(180deg, #281c44 0%, #19112e 100%)";
                el.style.color = "#fffbeb";
                el.style.borderColor = "#4a3b6e";
            }
        }

        if (el.style) {
            if (parseInt(el.style.marginBottom, 10) > 16) el.style.marginBottom = "10px";
            if (parseInt(el.style.marginTop, 10) > 16) el.style.marginTop = "10px";
            if (parseInt(el.style.paddingTop, 10) > 18) el.style.paddingTop = "10px";
            if (parseInt(el.style.paddingBottom, 10) > 18) el.style.paddingBottom = "10px";
            if (parseInt(el.style.gap, 10) > 16) el.style.gap = "10px";
            if (el.style.minHeight && parseInt(el.style.minHeight, 10) > 220 && el.tagName.toLowerCase() !== "canvas") {
                el.style.minHeight = "0px";
            }
        }
    });

    populateAllFlagPlaceholders(wrapper, countries);
}

function renderBuiltInTabFallback(wrapper, tabKey, world, countries) {
    const yr = (world && world.year) || 1;

    if (tabKey === "analytics") {
        if (countries.length === 0) {
            wrapper.innerHTML = `<div class="nations-empty-card">🔭 لا توجد دول حالياً لتحليلها في الكشاف.</div>`;
            return;
        }
        const rows = countries.map((c, i) => {
            const mil = Number((c.military && c.military.totalPower) || c.militaryPower || 0);
            const unemp = Math.max(0, Number(c.population || 0) - Number(c.employed || 0));
            return `
                <tr>
                    <td class="td-center">#${i + 1}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div class="table-flag" data-flag-country="${c.id}"></div>
                            <strong style="color:#fde047;">${c.name}</strong>
                        </div>
                    </td>
                    <td class="td-center"><span class="badge" style="font-size:0.74rem; padding:2px 8px;">م${c.stage || 1}</span></td>
                    <td class="td-center text-emerald">$${Number(c.disposableRevenue || 0).toLocaleString()}</td>
                    <td class="td-center text-gold">$${Number(c.budget || 0).toLocaleString()}</td>
                    <td class="td-center text-purple">${Number(c.population || 0).toLocaleString()} (👷${unemp})</td>
                    <td class="td-center text-cyan">${Number(c.generalIndex || 0).toLocaleString()}</td>
                    <td class="td-center text-green">${mil.toLocaleString()}</td>
                    <td class="td-center text-blue">${Number(c.currencyValue || 1).toFixed(2)}</td>
                </tr>
            `;
        }).join("");

        wrapper.innerHTML = `
            <div class="analytics-card">
                <div class="card-header-flex">
                    <h3>🔭 كشاف القوى والمقارنة الاستراتيجية الشاملة (سنة ${yr}م)</h3>
                    <span class="badge badge-gold">🌍 الدول: ${countries.length}</span>
                </div>
                <div class="bldg-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="td-center">الترتيب</th>
                                <th>الدولة والراية</th>
                                <th class="td-center">المرحلة</th>
                                <th class="td-center">السيولة</th>
                                <th class="td-center">العائد السنوي</th>
                                <th class="td-center">السكان (العمال)</th>
                                <th class="td-center">المؤشر العام</th>
                                <th class="td-center">القوة العسكرية</th>
                                <th class="td-center">قيمة العملة</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (tabKey === "chronicle") {
        const events = (world && Array.isArray(world.history)) ? world.history : [];
        const eventsHtml = events.length > 0 ? events.map((ev) => `
            <tr>
                <td class="td-center"><span class="badge badge-gold" style="font-size:0.72rem; padding:2px 8px;">سنة ${ev.year || yr}م</span></td>
                <td><strong style="color:#fffbeb;">${ev.text || ev.description || "حدث تاريخي سيادي"}</strong></td>
            </tr>
        `).join("") : `<tr><td colspan="2" class="td-center" style="padding:18px; color:#fde68a;">📜 لم تسجل أحداث تاريخية كبرى بعد؛ ستدون التوسعات والترقيات والحروب هنا تباعاً.</td></tr>`;

        const snapRows = countries.map(c => `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="table-flag" data-flag-country="${c.id}"></div>
                        <strong style="color:#fffbeb;">${c.name}</strong>
                    </div>
                </td>
                <td class="td-center text-gold">$${Number(c.budget || 0).toLocaleString()}</td>
                <td class="td-center text-purple">${Number(c.population || 0).toLocaleString()}</td>
                <td class="td-center text-cyan">${Number(c.generalIndex || 0).toLocaleString()}</td>
                <td class="td-center text-emerald">${Number(c.area || 0).toLocaleString()}</td>
            </tr>
        `).join("");

        wrapper.innerHTML = `
            <div class="chronicle-card">
                <div class="card-header-flex">
                    <h3>📜 مخطوطة التاريخ والأرشيف السيادي - السنة ${yr}م</h3>
                </div>
                ${countries.length > 0 ? `
                <div class="bldg-table-wrap" style="margin-bottom:10px;">
                    <table>
                        <thead>
                            <tr>
                                <th>الدولة</th>
                                <th class="td-center">الميزانية</th>
                                <th class="td-center">السكان</th>
                                <th class="td-center">المؤشر العام</th>
                                <th class="td-center">المساحة</th>
                            </tr>
                        </thead>
                        <tbody>${snapRows}</tbody>
                    </table>
                </div>` : ""}
                <div class="bldg-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="td-center" style="width:110px;">السنة</th>
                                <th>الوقائع والأحداث التاريخية المسجلة</th>
                            </tr>
                        </thead>
                        <tbody>${eventsHtml}</tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (tabKey === "worldbank") {
        const totalFund = countries.reduce((acc, c) => acc + Math.max(0, Number(c.worldBankFund || 0)), 0);
        const rows = countries.map(c => `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="table-flag" data-flag-country="${c.id}"></div>
                        <strong>${c.name}</strong>
                    </div>
                </td>
                <td class="td-center text-emerald">$${Number(c.bank || 0).toLocaleString()}</td>
                <td class="td-center text-cyan">$${Math.max(0, Number(c.worldBankFund || 0)).toLocaleString()}</td>
                <td class="td-center text-gold">$${Number(c.disposableRevenue || 0).toLocaleString()}</td>
            </tr>
        `).join("");

        wrapper.innerHTML = `
            <div class="wb-card">
                <div class="card-header-flex">
                    <h3>🏦 البنك الدولي والاحتياطي النقدي</h3>
                    <span class="badge badge-gold">🌐 إجمالي الصندوق الدولي: $${totalFund.toLocaleString()}</span>
                </div>
                <div class="bldg-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>الدولة</th>
                                <th class="td-center">خزينة البنك الوطني</th>
                                <th class="td-center">مدخرات البنك الدولي (5%)</th>
                                <th class="td-center">السيولة المتاحة</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="4" class="td-center">لا توجد دول مسجلة</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (tabKey === "exchange") {
        wrapper.innerHTML = `
            <div class="exchange-grid-container">
                <div class="exchange-card">
                    <div class="card-header-flex">
                        <h3>🛢️ بورصة الطاقة والوقود العالمية</h3>
                        <span class="badge badge-orange">تحديث سنوي</span>
                    </div>
                    <div class="stat-row"><span>🛢️ سعر برميل النفط القياسي:</span><strong class="text-gold">$50</strong></div>
                    <div class="stat-row"><span>🔥 سعر المتر المكعب من الغاز:</span><strong class="text-orange">$15</strong></div>
                    <div class="stat-row"><span>⛽ سعر لتر الوقود المكرر:</span><strong class="text-emerald">$2</strong></div>
                </div>
                <div class="exchange-card">
                    <div class="card-header-flex">
                        <h3>🌾 بورصة السلع والموارد الاستراتيجية</h3>
                        <span class="badge badge-gold">الأسعار الفورية</span>
                    </div>
                    <div class="stat-row"><span>🌾 المحاصيل الغذائية (نقطة):</span><strong class="text-green">$12</strong></div>
                    <div class="stat-row"><span>🏭 المنتجات الصناعية (نقطة):</span><strong class="text-cyan">$25</strong></div>
                    <div class="stat-row"><span>💣 صناديق الذخيرة القياسية:</span><strong class="text-red">$18</strong></div>
                </div>
            </div>
        `;
    } else if (tabKey === "trade") {
        wrapper.innerHTML = `
            <div class="wb-card">
                <div class="card-header-flex">
                    <h3>🚢 القوافل والتجارة الدولية</h3>
                    <span class="badge">تلقائي عند فائض وعجز القطاعات</span>
                </div>
                <p style="font-size:0.84rem; color:#fde68a;">تباع فوائض القطاعات تلقائياً للدول التي تعاني من عجز في نفس القطاع مع نهاية كل سنة مالية وتودع أرباحها في البنك الوطني.</p>
            </div>
        `;
    }
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
                <div style="font-size:2.8rem; margin-bottom:8px;">🏰</div>
                <h3 style="color:#fde047; margin-bottom:6px;">ابدأ رحلتك الآن وأسس دولتك الأولى!</h3>
                <p style="color:#e2e8f0; font-size:0.88rem; margin-bottom:14px;">
                    صمّم علمك الوطني وانتقل مباشرةً إلى عاصمتك ثلاثية الأبعاد لبناء المنشآت وقيادة الجيوش.
                </p>
                <button type="button" class="btn btn-primary" onclick="openCreateCountryModal()">
                    🏰 + تأسيس دولتي والدخول للعاصمة ➔
                </button>
            </div>
        `;
        return;
    }

    const isMpActive = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());

    countries.forEach(function(c, idx) {
        const ownerInfo = (window.NetworkEngine && typeof window.NetworkEngine.getCountryOwnerInfo === "function") ?
            window.NetworkEngine.getCountryOwnerInfo(c.id) :
            { isMine: true, isClaimed: true, ownerName: null };

        if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
            window.MilitaryEngine.refreshMilitaryStats(c);
        }
        const milPower = (c.military && typeof c.military.totalPower === "number") ?
            c.military.totalPower :
            (Number(c.militaryPower) || 0);
        const milUnits = (c.military && typeof c.military.totalUnits === "number") ?
            c.military.totalUnits :
            (window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0);

        let ownershipBadgeHtml = '<span class="badge badge-gold" style="font-size:0.68rem; padding:2px 7px;">👑 دولتي</span>';
        let footerActionText = '🏛️ دخول العاصمة 3D والبناء المباشر ➔';

        if (c.isAI) {
            ownershipBadgeHtml = `<span class="badge badge-purple" style="font-size:0.68rem; padding:2px 7px;">${c.aiTitle || '🤖 ذكاء اصطناعي'}</span>`;
            footerActionText = '👁️ التجول في العاصمة 3D (' + (c.aiDesc || 'مشاهدة الذكاء الاصطناعي') + ') ➔';
        } else if (isMpActive) {
            if (ownerInfo.isMine) {
                ownershipBadgeHtml = `<span class="badge badge-gold" style="font-size:0.68rem; padding:2px 7px;">👑 دولتي</span>`;
                footerActionText = '🏛️ دخول عاصمتي 3D والبناء المباشر ➔';
            } else if (!ownerInfo.isClaimed) {
                ownershipBadgeHtml = `<span class="badge badge-military" style="font-size:0.68rem; padding:2px 7px;">🟢 متاحة للقيادة</span>`;
                footerActionText = '👑 تولي قيادة الدولة ودخول العاصمة 3D ➔';
            } else {
                ownershipBadgeHtml = `<span class="badge badge-purple" style="font-size:0.68rem; padding:2px 7px;">👤 ${ownerInfo.ownerName || 'قائد آخر'}</span>`;
                footerActionText = '👁️ التجول في العاصمة 3D (مشاهدة) ➔';
            }
        }

        const card = document.createElement("div");
        card.className = "nation-sovereign-card";
        card.setAttribute("data-id", c.id);

        card.innerHTML = `
            <div class="nation-card-top-ribbon">
                <span class="nation-stage-pill">🏆 ${c.stageName || ("المرحلة " + (c.stage || 1))}</span>
                ${ownershipBadgeHtml}
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
                    <span class="stat-val text-cyan">${Number(c.generalIndex || 0).toLocaleString()}</span>
                </div>
                <div class="nation-card-stat">
                    <span class="stat-label">⚔️ الجيش والقوة:</span>
                    <span class="stat-val text-green">${Number(milPower).toLocaleString()} (${milUnits} وحدة)</span>
                </div>
            </div>

            <div class="nation-card-play-footer">
                ${footerActionText}
            </div>
        `;

        card.onclick = function(e) {
            if (e && typeof e.stopPropagation === "function") e.stopPropagation();
            if (window.GameSFX) window.GameSFX.playClick();
            if (isMpActive && !ownerInfo.isClaimed && window.NetworkEngine && !window.NetworkEngine.getMyCountryId()) {
                window.NetworkEngine.claimCountry(c.id);
            }
            if (window.CapitalView && typeof window.CapitalView.open === "function") {
                window.CapitalView.open(c);
            } else if (window.CountryViewController && typeof window.CountryViewController.open === "function") {
                window.CountryViewController.open(c);
            }
        };

        grid.appendChild(card);

        const flagBox = document.getElementById("nation-flag-grid-" + c.id);
        if (flagBox) {
            window.renderFlagGridToElement(flagBox, c.flag, 72, 44);
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
    initGame();
}

// =========================================================================
// 10. محرك شاشة المقدمة السينمائية (Intro Battlefield View Engine)
//     - في الأسفل: جنود ودبابات تطلق النار على بعضها
//     - في الأعلى: طائرات حربية وصواريخ تتقاتل وتشتبك
//     - في المنتصف: يخرج اسم اللعبة بتأثير بصري ملحمي ثم تتخافت الشاشة
// =========================================================================
window.IntroBattleEngine = (function() {
    let canvas = null;
    let ctx = null;
    let animId = null;
    let titleTimerId = null;
    let fadeTimerId = null;
    let isRunning = false;
    let startTime = 0;
    let fadeTriggered = false;
    let titleTriggered = false;

    function triggerCenterTitle() {
        if (titleTriggered) return;
        titleTriggered = true;
        const titleWrap = document.getElementById("intro-center-title-wrap");
        if (titleWrap) titleWrap.classList.add("emerge-active");
        const w = canvas ? canvas.width : 960;
        const h = canvas ? canvas.height : 540;
        shockwaves.push({ x: w * 0.5, y: h * 0.5, r: 10, maxR: Math.max(w, h) * 0.45, alpha: 0.95, color: "#fbbf24" });
        if (window.GameSFX && typeof window.GameSFX.newYear === "function") {
            try { window.GameSFX.newYear(); } catch (e) {}
        }
    }

    const DURATION_MS = 5800; // مدة العرض قبل التخافت التلقائي
    const TITLE_EMERGE_MS = 950; // لحظة انبثاق اسم اللعبة من المنتصف

    let soldiers = [];
    let tanks = [];
    let planes = [];
    let missiles = [];
    let projectiles = [];
    let explosions = [];
    let shockwaves = [];
    let stars = [];

    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth || 960;
        canvas.height = window.innerHeight || 540;
    }

    function initEntities() {
        const w = canvas ? canvas.width : 960;
        const h = canvas ? canvas.height : 540;

        soldiers = [];
        tanks = [];
        planes = [];
        missiles = [];
        projectiles = [];
        explosions = [];
        shockwaves = [];
        stars = [];

        for (let i = 0; i < 45; i++) {
            stars.push({
                x: Math.random() * w,
                y: Math.random() * (h * 0.55),
                r: 0.7 + Math.random() * 1.6,
                alpha: 0.3 + Math.random() * 0.7
            });
        }

        // 1. الدبابات في الأسفل (3 في اليسار تواجه اليمين، 3 في اليمين تواجه اليسار)
        const tankYPositions = [0.68, 0.77, 0.86];
        tankYPositions.forEach((yr, idx) => {
            tanks.push({
                side: "left",
                x: w * (0.09 + idx * 0.085),
                baseX: w * (0.09 + idx * 0.085),
                y: h * yr,
                dir: 1,
                color: "#e11d48",
                accent: "#fbbf24",
                recoil: 0,
                fireTimer: 15 + idx * 18
            });
            tanks.push({
                side: "right",
                x: w * (0.91 - idx * 0.085),
                baseX: w * (0.91 - idx * 0.085),
                y: h * yr,
                dir: -1,
                color: "#0284c7",
                accent: "#34d399",
                recoil: 0,
                fireTimer: 22 + idx * 18
            });
        });

        // 2. الجنود المشاة في الأسفل (8 في اليسار، 8 في اليمين يطلقون النار والآر بي جي)
        for (let i = 0; i < 8; i++) {
            const rowY = h * (0.70 + (i % 4) * 0.068 + (Math.random() * 0.02));
            soldiers.push({
                side: "left",
                x: w * (0.14 + (i * 0.036)),
                y: rowY,
                dir: 1,
                color: "#fb7185",
                helmet: "#9f1239",
                hasRpg: i % 3 === 0,
                fireTimer: Math.floor(Math.random() * 25),
                muzzleFlash: 0
            });
            soldiers.push({
                side: "right",
                x: w * (0.86 - (i * 0.036)),
                y: rowY,
                dir: -1,
                color: "#38bdf8",
                helmet: "#075985",
                hasRpg: i % 3 === 0,
                fireTimer: Math.floor(Math.random() * 25),
                muzzleFlash: 0
            });
        }

        // 3. الطائرات الحربية في الأعلى (4 من اليسار لليمين، 4 من اليمين لليسار)
        for (let i = 0; i < 4; i++) {
            planes.push({
                side: "left",
                x: (w * 0.1 * i) - 60,
                y: h * (0.11 + i * 0.085),
                baseY: h * (0.11 + i * 0.085),
                vx: 3.4 + (i % 2) * 0.9,
                dir: 1,
                color: "#f43f5e",
                wingColor: "#fbbf24",
                phase: i * 1.4,
                fireTimer: 10 + i * 14
            });
            planes.push({
                side: "right",
                x: w - (w * 0.1 * i) + 60,
                y: h * (0.14 + i * 0.085),
                baseY: h * (0.14 + i * 0.085),
                vx: -(3.4 + (i % 2) * 0.9),
                dir: -1,
                color: "#0ea5e9",
                wingColor: "#34d399",
                phase: i * 1.7,
                fireTimer: 16 + i * 14
            });
        }
    }

    function spawnExplosion(x, y, radius, colorCore, colorEdge) {
        explosions.push({
            x: x,
            y: y,
            r: 2,
            maxR: radius || 28,
            alpha: 1,
            colorCore: colorCore || "#fef08a",
            colorEdge: colorEdge || "#f97316"
        });
    }

    function spawnMissile(fromX, fromY, toX, toY, side) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const speed = 6.2 + Math.random() * 2.2;
        missiles.push({
            x: fromX,
            y: fromY,
            vx: (dx / dist) * speed,
            vy: (dy / dist) * speed - 0.8,
            side: side,
            trail: [],
            life: 0,
            maxLife: Math.min(95, Math.floor(dist / speed) + 12),
            color: side === "left" ? "#fbbf24" : "#38bdf8"
        });
    }

    function updateAndDraw(now) {
        if (!isRunning || !ctx || !canvas) return;

        const elapsed = now - startTime;
        const w = canvas.width;
        const h = canvas.height;
        const groundY = h * 0.59;

        // تحديث شريط التقدم وإظهار اسم اللعبة من المنتصف
        const barFill = document.getElementById("intro-loading-bar-fill");
        if (barFill) {
            const pct = Math.min(100, Math.round((elapsed / DURATION_MS) * 100));
            barFill.style.width = pct + "%";
        }

        if (!titleTriggered && elapsed >= TITLE_EMERGE_MS) {
            triggerCenterTitle();
        }

        if (!fadeTriggered && elapsed >= DURATION_MS) {
            fadeOutToMainMenu();
        }

        // 1. رسم السماء الحربية العلوية والأرض السفلية
        const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        skyGrad.addColorStop(0, "#05030d");
        skyGrad.addColorStop(0.55, "#150d2a");
        skyGrad.addColorStop(1, "#2d1528");
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, groundY);

        // النجوم والوهج الجوي
        stars.forEach(st => {
            ctx.fillStyle = `rgba(254, 243, 199, ${st.alpha})`;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // سلسلة جبال الأفق المشتعلة
        ctx.fillStyle = "#120a1d";
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for (let x = 0; x <= w; x += w / 12) {
            const peak = groundY - 14 - Math.abs(Math.sin(x * 0.015)) * 26;
            ctx.lineTo(x, peak);
        }
        ctx.lineTo(w, groundY);
        ctx.closePath();
        ctx.fill();

        // أرضية ساحة المعركة في الأسفل (جنود ودبابات)
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
        groundGrad.addColorStop(0, "#241623");
        groundGrad.addColorStop(0.4, "#18111e");
        groundGrad.addColorStop(1, "#0b0711");
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, w, h - groundY);

        // خط الأفق المشتعل
        ctx.strokeStyle = "rgba(249, 115, 22, 0.45)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(w, groundY);
        ctx.stroke();

        // 2. تحديث ورسم الطائرات الحربية في الأعلى (Top Airspace)
        planes.forEach(p => {
            p.x += p.vx;
            p.y = p.baseY + Math.sin(elapsed * 0.004 + p.phase) * 10;

            if (p.dir === 1 && p.x > w + 90) p.x = -80;
            if (p.dir === -1 && p.x < -90) p.x = w + 80;

            p.fireTimer--;
            if (p.fireTimer <= 0) {
                p.fireTimer = 28 + Math.floor(Math.random() * 28);
                // إطلاق رشاشات جوية أو صاروخ جو-جو باتجاه الطائرات المعادية في الأعلى
                const enemies = planes.filter(e => e.side !== p.side);
                const target = enemies[Math.floor(Math.random() * enemies.length)];
                if (target) {
                    if (Math.random() < 0.55) {
                        spawnMissile(p.x + p.dir * 22, p.y, target.x, target.y, p.side);
                    } else {
                        projectiles.push({
                            x: p.x + p.dir * 24,
                            y: p.y,
                            vx: p.dir * 13,
                            vy: (Math.random() - 0.5) * 1.8,
                            color: p.side === "left" ? "#fde047" : "#38bdf8",
                            len: 18,
                            width: 2.2,
                            zone: "air",
                            life: 0,
                            maxLife: 42
                        });
                    }
                }
            }

            // رسم الطائرة المقاتلة
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(p.dir, 1);

            // لهب المحرك النفاث (Afterburner)
            const flameLen = 14 + Math.random() * 10;
            const flameGrad = ctx.createLinearGradient(-22, 0, -22 - flameLen, 0);
            flameGrad.addColorStop(0, "#fef08a");
            flameGrad.addColorStop(0.5, "#f97316");
            flameGrad.addColorStop(1, "transparent");
            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.moveTo(-18, -3);
            ctx.lineTo(-18 - flameLen, 0);
            ctx.lineTo(-18, 3);
            ctx.closePath();
            ctx.fill();

            // جسم المقاتلة الحربية والأجنحة
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.moveTo(26, 0);
            ctx.lineTo(6, -5);
            ctx.lineTo(-10, -14);
            ctx.lineTo(-16, -14);
            ctx.lineTo(-12, -4);
            ctx.lineTo(-20, -8);
            ctx.lineTo(-20, 8);
            ctx.lineTo(-12, 4);
            ctx.lineTo(-16, 14);
            ctx.lineTo(-10, 14);
            ctx.lineTo(6, 5);
            ctx.closePath();
            ctx.fill();

            // قمرة القيادة الزجاجية
            ctx.fillStyle = "#bae6fd";
            ctx.beginPath();
            ctx.ellipse(8, -1.5, 6, 2.5, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });

        // إطلاق صواريخ اعتراضية وباليستية إضافية تتقاتل في الأعلى
        if (Math.random() < 0.14) {
            const fromLeft = Math.random() < 0.5;
            const sx = fromLeft ? w * (0.05 + Math.random() * 0.25) : w * (0.70 + Math.random() * 0.25);
            const sy = h * (0.12 + Math.random() * 0.35);
            const tx = fromLeft ? w * (0.55 + Math.random() * 0.35) : w * (0.10 + Math.random() * 0.35);
            const ty = h * (0.08 + Math.random() * 0.36);
            spawnMissile(sx, sy, tx, ty, fromLeft ? "left" : "right");
        }

        // تحديث ورسم الصواريخ في الأعلى
        for (let i = missiles.length - 1; i >= 0; i--) {
            const m = missiles[i];
            m.trail.push({ x: m.x, y: m.y });
            if (m.trail.length > 14) m.trail.shift();

            m.x += m.vx;
            m.y += m.vy;
            m.vy += 0.018; // انحناء باليستي خفيف
            m.life++;

            // رسم أثر دخان الصاروخ
            if (m.trail.length > 1) {
                ctx.strokeStyle = m.side === "left" ? "rgba(251, 191, 36, 0.38)" : "rgba(56, 189, 248, 0.38)";
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.moveTo(m.trail[0].x, m.trail[0].y);
                for (let t = 1; t < m.trail.length; t++) {
                    ctx.lineTo(m.trail[t].x, m.trail[t].y);
                }
                ctx.stroke();
            }

            // رسم جسم الصاروخ المشتعل
            const angle = Math.atan2(m.vy, m.vx);
            ctx.save();
            ctx.translate(m.x, m.y);
            ctx.rotate(angle);
            ctx.fillStyle = "#f8fafc";
            ctx.fillRect(-8, -2, 14, 4);
            ctx.fillStyle = m.color;
            ctx.beginPath();
            ctx.moveTo(6, -2.5);
            ctx.lineTo(12, 0);
            ctx.lineTo(6, 2.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#f97316";
            ctx.beginPath();
            ctx.arc(-9, 0, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // فحص تصادم الصواريخ في الجو أو انتهاء مداها
            let exploded = m.life >= m.maxLife;
            for (let j = i - 1; j >= 0; j--) {
                const other = missiles[j];
                if (other.side !== m.side && Math.hypot(other.x - m.x, other.y - m.y) < 24) {
                    exploded = true;
                    other.life = other.maxLife;
                    break;
                }
            }
            if (exploded) {
                spawnExplosion(m.x, m.y, 26 + Math.random() * 16, "#fef08a", m.side === "left" ? "#f97316" : "#38bdf8");
                missiles.splice(i, 1);
            }
        }

        // 3. تحديث ورسم الدبابات في الأسفل (Bottom Battlefield Tanks)
        tanks.forEach(tk => {
            tk.x = tk.baseX + Math.sin(elapsed * 0.002 + tk.y) * 8 - tk.recoil * tk.dir;
            if (tk.recoil > 0) tk.recoil *= 0.82;

            tk.fireTimer--;
            if (tk.fireTimer <= 0) {
                tk.fireTimer = 32 + Math.floor(Math.random() * 28);
                tk.recoil = 5.5;
                const muzzleX = tk.x + tk.dir * 34;
                const muzzleY = tk.y - 11;
                spawnExplosion(muzzleX, muzzleY, 12, "#ffffff", "#fbbf24");

                projectiles.push({
                    x: muzzleX,
                    y: muzzleY,
                    vx: tk.dir * (9.5 + Math.random() * 2.5),
                    vy: (Math.random() - 0.5) * 1.2,
                    color: tk.accent,
                    len: 16,
                    width: 3.4,
                    zone: "ground",
                    life: 0,
                    maxLife: Math.floor((w * 0.55) / 10) + Math.floor(Math.random() * 14)
                });
            }

            // رسم الدبابة القتالية
            ctx.save();
            ctx.translate(tk.x, tk.y);
            ctx.scale(tk.dir, 1);

            // الجنزير والعجلات المدرعة
            ctx.fillStyle = "#0f172a";
            ctx.beginPath();
            ctx.roundRect(-24, -4, 48, 10, 4);
            ctx.fill();
            ctx.strokeStyle = "#475569";
            ctx.lineWidth = 1.2;
            ctx.stroke();

            for (let wx = -18; wx <= 18; wx += 9) {
                ctx.fillStyle = "#334155";
                ctx.beginPath();
                ctx.arc(wx, 1, 3.2, 0, Math.PI * 2);
                ctx.fill();
            }

            // بدن الدبابة المصفح
            ctx.fillStyle = tk.color;
            ctx.beginPath();
            ctx.moveTo(-26, -4);
            ctx.lineTo(-18, -11);
            ctx.lineTo(20, -11);
            ctx.lineTo(27, -4);
            ctx.closePath();
            ctx.fill();

            // برج الدبابة وسبطانة المدفع
            ctx.fillStyle = tk.color;
            ctx.beginPath();
            ctx.roundRect(-11, -18, 22, 8, 3);
            ctx.fill();

            ctx.strokeStyle = "#e2e8f0";
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(9, -14);
            ctx.lineTo(33, -15);
            ctx.stroke();

            ctx.restore();
        });

        // 4. تحديث ورسم الجنود في الأسفل (Bottom Battlefield Infantry)
        soldiers.forEach(s => {
            s.fireTimer--;
            if (s.muzzleFlash > 0) s.muzzleFlash--;

            if (s.fireTimer <= 0) {
                s.fireTimer = s.hasRpg ? (42 + Math.floor(Math.random() * 30)) : (14 + Math.floor(Math.random() * 18));
                s.muzzleFlash = 4;
                const gunX = s.x + s.dir * 11;
                const gunY = s.y - 9;

                projectiles.push({
                    x: gunX,
                    y: gunY,
                    vx: s.dir * (s.hasRpg ? 8.5 : 12.5),
                    vy: (Math.random() - 0.5) * 1.5,
                    color: s.hasRpg ? "#f97316" : (s.side === "left" ? "#fde047" : "#67e8f9"),
                    len: s.hasRpg ? 13 : 9,
                    width: s.hasRpg ? 2.8 : 1.7,
                    zone: "ground",
                    life: 0,
                    maxLife: 34 + Math.floor(Math.random() * 22)
                });
            }

            // رسم الجندي المقاتل والسلاح
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.scale(s.dir, 1);

            // الساقان والجسم التكتيكي
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(-3, 4);
            ctx.lineTo(0, -4);
            ctx.lineTo(3, 4);
            ctx.stroke();

            ctx.fillStyle = s.color;
            ctx.fillRect(-3.5, -11, 7, 8);

            // الخوذة والرأس
            ctx.fillStyle = "#fde68a";
            ctx.beginPath();
            ctx.arc(0, -14, 3.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = s.helmet;
            ctx.beginPath();
            ctx.arc(0, -15, 3.8, Math.PI, 0);
            ctx.fill();

            // البندقية / قاذف الآر بي جي
            ctx.strokeStyle = s.hasRpg ? "#fbbf24" : "#cbd5e1";
            ctx.lineWidth = s.hasRpg ? 2.6 : 1.8;
            ctx.beginPath();
            ctx.moveTo(-2, -9);
            ctx.lineTo(11, -10);
            ctx.stroke();

            // وميض إطلاق النار
            if (s.muzzleFlash > 0) {
                ctx.fillStyle = "#fef08a";
                ctx.beginPath();
                ctx.arc(13, -10, 3.8, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        // 5. تحديث ورسم القذائف والطلقات النارية
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const pr = projectiles[i];
            pr.x += pr.vx;
            pr.y += pr.vy;
            pr.life++;

            ctx.strokeStyle = pr.color;
            ctx.lineWidth = pr.width;
            ctx.beginPath();
            ctx.moveTo(pr.x, pr.y);
            ctx.lineTo(pr.x - (pr.vx > 0 ? pr.len : -pr.len), pr.y);
            ctx.stroke();

            if (pr.life >= pr.maxLife) {
                spawnExplosion(pr.x, pr.y, pr.width > 2.5 ? 20 : 9, "#fef08a", pr.color);
                projectiles.splice(i, 1);
            }
        }

        // 6. تحديث ورسم الانفجارات وموجات الصدمة
        for (let i = explosions.length - 1; i >= 0; i--) {
            const ex = explosions[i];
            ex.r += (ex.maxR - ex.r) * 0.24;
            ex.alpha -= 0.055;

            if (ex.alpha <= 0) {
                explosions.splice(i, 1);
                continue;
            }

            const grad = ctx.createRadialGradient(ex.x, ex.y, 1, ex.x, ex.y, ex.r);
            grad.addColorStop(0, ex.colorCore);
            grad.addColorStop(0.5, ex.colorEdge);
            grad.addColorStop(1, "transparent");

            ctx.save();
            ctx.globalAlpha = Math.max(0, ex.alpha);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const sw = shockwaves[i];
            sw.r += (sw.maxR - sw.r) * 0.09;
            sw.alpha -= 0.022;
            if (sw.alpha <= 0) {
                shockwaves.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = Math.max(0, sw.alpha);
            ctx.strokeStyle = sw.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        animId = requestAnimationFrame(updateAndDraw);
    }

    function fadeOutToMainMenu() {
        if (fadeTriggered) return;
        fadeTriggered = true;
        const screenEl = document.getElementById("intro-battle-screen");
        if (!screenEl) {
            stop();
            return;
        }
        screenEl.classList.add("fading-out");
        setTimeout(function() {
            screenEl.classList.remove("active");
            screenEl.classList.remove("fading-out");
            stop();
        }, 1350);
    }

    function start() {
        const screenEl = document.getElementById("intro-battle-screen");
        canvas = document.getElementById("intro-battle-canvas");
        if (!screenEl || !canvas) return;

        ctx = canvas.getContext("2d");
        stop();

        fadeTriggered = false;
        titleTriggered = false;
        screenEl.classList.remove("fading-out");
        screenEl.classList.add("active");

        const titleWrap = document.getElementById("intro-center-title-wrap");
        if (titleWrap) titleWrap.classList.remove("emerge-active");

        const barFill = document.getElementById("intro-loading-bar-fill");
        if (barFill) barFill.style.width = "0%";

        resize();
        initEntities();
        isRunning = true;
        startTime = performance.now();
        titleTimerId = setTimeout(triggerCenterTitle, TITLE_EMERGE_MS);
        fadeTimerId = setTimeout(fadeOutToMainMenu, DURATION_MS);
        animId = requestAnimationFrame(updateAndDraw);

        const skipBtn = document.getElementById("btn-skip-intro");
        if (skipBtn) {
            skipBtn.onclick = function() {
                if (window.GameSFX) window.GameSFX.playClick();
                fadeOutToMainMenu();
            };
        }

        const replayBtn = document.getElementById("btn-replay-intro");
        if (replayBtn) {
            replayBtn.onclick = function() {
                if (window.GameSFX) window.GameSFX.playClick();
                start();
            };
        }
    }

    function stop() {
        isRunning = false;
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        if (titleTimerId) {
            clearTimeout(titleTimerId);
            titleTimerId = null;
        }
        if (fadeTimerId) {
            clearTimeout(fadeTimerId);
            fadeTimerId = null;
        }
    }

    window.addEventListener("resize", function() {
        if (isRunning) resize();
    });

    return {
        start: start,
        stop: stop,
        fadeOut: fadeOutToMainMenu
    };
})();

// =========================================================================
// 11. محرك طور اللعب مع الذكاء الاصطناعي ذي الـ 10 شخصيات المستقلة
//     (10 Distinct AI Personalities & Doctrines Engine)
// =========================================================================
window.selectedSoloAICount = 4;

window.AIEngine = (function() {
    // 10 شخصيات مستقلة تماماً تختلف في العقيدة، خطة البداية، الأولويات العمرانية، التسليح، التجارة، والقرارات العسكريه
    const AI_NATION_PROFILES = [
        {
            key: "iron_general",
            name: "إمبراطورية الشمال",
            title: "⚔️ الجنرال الحديدي",
            desc: "عقيدة المدرعات والزحف البري",
            c1: "#e11d48", c2: "#ffffff", c3: "#1e293b", emblem: "#fbbf24",
            milReserveRatio: 0.60,
            focusStageRush: false,
            loanStrategy: "none",
            fightThreshold: 0.08, // يقاتل دائماً تقريباً ويرفض دفع الجزية
            aggressionChance: 0.55,
            openingBuilds: ["house", "house", "boat", "shop", "shop"],
            openingUnits: ["infantry_atk"],
            preferredBuildings: ["house", "handicrafts", "workshop", "factory", "water_well", "farm", "house_large"],
            preferredBranches: ["ground"],
            preferredUnits: ["infantry_atk", "cannon", "small_tank", "med_tank", "small_mlrs", "rocket_launcher", "armored_carrier"],
            chatLines: [
                "⚔️ الجنرال الحديدي: مدرعاتنا ودباباتنا لا تعرف التراجع، الميدان يحسم السيادة!",
                "⚔️ الجنرال الحديدي: القوة العسكرية البرية هي الضمان الوحيد للهيمنة."
            ]
        },
        {
            key: "capitalist_mogul",
            name: "مملكة الشرق",
            title: "💰 إمبراطور المال",
            desc: "عقيدة المصارف والأسواق والثراء",
            c1: "#059669", c2: "#ffffff", c3: "#064e3b", emblem: "#fde047",
            milReserveRatio: 0.14,
            focusStageRush: false,
            loanStrategy: "lender",
            fightThreshold: 0.85, // يفضل دفع الجزية لحماية اقتصاده الضخم
            aggressionChance: 0.05,
            openingBuilds: ["house", "boat", "shop", "shop", "shop", "shop", "shop", "boat"],
            openingUnits: [],
            preferredBuildings: ["shop", "boat", "shop_large", "markets", "showroom", "mall", "hotel", "resort", "park", "theme_park", "house_large"],
            preferredBranches: ["defense", "ground"],
            preferredUnits: ["infantry_def", "auto_cannon", "air_defense"],
            chatLines: [
                "💰 إمبراطور المال: التجارة والمصارف تصنع الإمبراطوريات.. خزائننا جاهزة للصفقات والقروض!",
                "💰 إمبراطور المال: استثمرنا في الأسواق والمولات وحققنا أعلى عائد مالي هذا العام."
            ]
        },
        {
            key: "naval_admiral",
            name: "سلطنة البحار",
            title: "⚓ أمير البحار",
            desc: "عقيدة الموانئ والأساطيل البحرية",
            c1: "#0284c7", c2: "#e0f2fe", c3: "#0369a1", emblem: "#fbbf24",
            milReserveRatio: 0.42,
            focusStageRush: false,
            loanStrategy: "none",
            fightThreshold: 0.25,
            aggressionChance: 0.35,
            openingBuilds: ["house", "house", "boat", "boat", "boat", "shop", "shop"],
            openingUnits: [],
            preferredBuildings: ["boat", "marina", "ship", "cargo_carrier", "seaport", "cargo_ship_large", "shop", "fish_market", "water_desalination"],
            preferredBranches: ["naval", "defense"],
            preferredUnits: ["war_corvette", "destroyer", "small_sub", "frigate", "battleship", "carrier", "naval_defense", "as_tank"],
            chatLines: [
                "⚓ أمير البحار: من يحكم الموانئ والمضايق البحرية يحكم تجارة العالم!",
                "⚓ أمير البحار: طراداتنا وغواصاتنا تجوب المياه الإقليمية لحماية سيادتنا."
            ]
        },
        {
            key: "sky_falcon",
            name: "تحالف الصقور",
            title: "✈️ صقر السماء",
            desc: "عقيدة السيادة الجوية والدرونات",
            c1: "#2563eb", c2: "#f8fafc", c3: "#0f172a", emblem: "#f59e0b",
            milReserveRatio: 0.45,
            focusStageRush: false,
            loanStrategy: "none",
            fightThreshold: 0.22,
            aggressionChance: 0.40,
            openingBuilds: ["house", "water_well", "farm", "clinic", "classroom"],
            openingUnits: [],
            preferredBuildings: ["classroom", "school", "university", "regional_airport", "plane_50", "plane_100", "intl_airport", "plane_200", "plane_400", "clinic"],
            preferredBranches: ["air"],
            preferredUnits: ["uav_attack", "a10_ground", "f15_attack", "su25_ground", "mig25_attack", "f16_attack", "mirage_attack", "f35_attack"],
            chatLines: [
                "✈️ صقر السماء: أسراب المسيّرات والمقاتلات الجوية تفرض سيطرتها من فوق السحاب!",
                "✈️ صقر السماء: العلم والمطارات المتطورة هما مفتاح التفوق الجوي الحديث."
            ]
        },
        {
            key: "oil_baron",
            name: "جمهورية الحديد",
            title: "🛢️ بارون النفط والصناعة",
            desc: "عقيدة الآبار النفطية والمصانع الثقيلة",
            c1: "#334155", c2: "#e2e8f0", c3: "#dc2626", emblem: "#fbbf24",
            milReserveRatio: 0.38,
            focusStageRush: false,
            loanStrategy: "saver",
            fightThreshold: 0.25,
            aggressionChance: 0.30,
            openingBuilds: ["house", "house", "handicrafts", "handicrafts", "workshop"],
            openingUnits: [],
            preferredBuildings: ["handicrafts", "workshop", "factory", "factory_large", "oil_well", "fuel_station", "gas_station_shop", "gas_well", "oil_field", "power_generator", "power_plant"],
            preferredBranches: ["ground", "air"],
            preferredUnits: ["ammo_factory", "arms_factory", "armored_carrier", "med_tank", "aa_tank", "as_tank", "c130_ground"],
            chatLines: [
                "🛢️ بارون النفط والصناعة: المصانع وآبار النفط والغاز هي عصب الحرب والاقتصاد!",
                "🛢️ بارون النفط والصناعة: خطوط إنتاجنا الصناعية ومصانع الذخيرة تعمل بأقصى طاقتها."
            ]
        },
        {
            key: "urban_architect",
            name: "جمهورية القمة",
            title: "🏙️ مهندس الحضارة",
            desc: "عقيدة المدن المليونية والترقية السريعة",
            c1: "#0d9488", c2: "#ffffff", c3: "#134e4a", emblem: "#fde047",
            milReserveRatio: 0.20,
            focusStageRush: true, // يركز بأقصى سرعة على استكمال شروط المراحل والترقية
            loanStrategy: "none",
            fightThreshold: 0.35,
            aggressionChance: 0.12,
            openingBuilds: ["house", "house", "house", "house", "boat", "shop"],
            openingUnits: [],
            preferredBuildings: ["house_large", "palace", "apartments", "hotel", "residential_towers", "skyscrapers", "clinic", "dispensary", "hospital", "park", "municipality", "governorate"],
            preferredBranches: ["ground", "defense"],
            preferredUnits: ["infantry_def", "infantry_atk", "cannon", "auto_cannon"],
            chatLines: [
                "🏙️ مهندس الحضارة: نبني الحواضر والأبراج السكنية ونرتقي عبر المراحل الحضارية بسرعة قياسية!",
                "🏙️ مهندس الحضارة: النمو السكاني والعمراني هو أساس القوة المستدامة."
            ]
        },
        {
            key: "fortress_guardian",
            name: "مملكة الأسود",
            title: "🛡️ الدرع الحصين",
            desc: "عقيدة التحصين الدفاعي والاكتفاء الذاتي",
            c1: "#991b1b", c2: "#fef3c7", c3: "#450a0a", emblem: "#fbbf24",
            milReserveRatio: 0.48,
            focusStageRush: false,
            loanStrategy: "saver",
            fightThreshold: 0.05, // لا يستسلم أبداً ويدافع بشراسة
            aggressionChance: 0.0, // لا يبادر بالهجوم أبداً، دفاعي 100%
            openingBuilds: ["house", "water_well", "farm", "shop"],
            openingUnits: ["infantry_def"],
            preferredBuildings: ["water_well", "water_pump", "farm", "production_farm", "police_station", "fire_station", "municipality", "police_headquarters", "power_generator"],
            preferredBranches: ["defense", "ground"],
            preferredUnits: ["infantry_def", "auto_cannon", "aa_tank", "as_tank", "air_defense", "naval_defense", "patriot_missile", "anti_missile", "anti_rocket_launcher"],
            chatLines: [
                "🛡️ الدرع الحصين: لا نعتدي على أحد، لكن حدودنا محمية ببطاريات الدفاع والمدافع المضادة!",
                "🛡️ الدرع الحصين: الاكتفاء الذاتي والأمن الداخلي خط أحمر في مملكتنا."
            ]
        },
        {
            key: "opportunist_fox",
            name: "اتحاد الصحراء",
            title: "🦊 الثعلب الانتهازي",
            desc: "عقيدة القروض والمناورة والغارات",
            c1: "#c2410c", c2: "#fffbeb", c3: "#431407", emblem: "#fbbf24",
            milReserveRatio: 0.36,
            focusStageRush: false,
            loanStrategy: "borrower", // يقترض من البنك الدولي لتسريع قفزاته
            fightThreshold: 0.75, // يناور بدفع الجزية إذا واجه جيشاً أقوى منه
            aggressionChance: 0.48, // يغزو الدول الأضعف منه لنهب الغنائم
            openingBuilds: ["house", "water_well", "farm", "poultry_farm", "bird", "bird", "bird", "bird", "bird", "bird", "bird", "bird"],
            openingUnits: [],
            preferredBuildings: ["poultry_farm", "bird", "livestock_farm", "animal", "poultry_complex", "livestock_complex", "farm", "shop"],
            preferredBranches: ["ground", "air", "naval"],
            preferredUnits: ["infantry_atk", "uav_attack", "small_tank", "war_corvette", "small_mlrs"],
            chatLines: [
                "🦊 الثعلب الانتهازي: الدهاء السياسي واغتنام الفرص أهم من الحروب العمياء!",
                "🦊 الثعلب الانتهازي: مشاريعنا الزراعية والإنتاجية تضاعف أرباحنا بأقل تكلفة."
            ]
        },
        {
            key: "nuclear_strategist",
            name: "اتحاد العواصف",
            title: "☢️ العقل الاستراتيجي",
            desc: "عقيدة الصواريخ الباليستية والطاقة النظيفة",
            c1: "#7c3aed", c2: "#f1f5f9", c3: "#3b0764", emblem: "#38bdf8",
            milReserveRatio: 0.50,
            focusStageRush: false,
            loanStrategy: "saver",
            fightThreshold: 0.20,
            aggressionChance: 0.32,
            openingBuilds: ["house", "house", "handicrafts", "handicrafts", "solar_farm", "wind_station"],
            openingUnits: [],
            preferredBuildings: ["solar_farm", "wind_station", "nuclear_reactor", "train_station", "train_cart_20", "train_cart_40", "train_station_large", "governorate", "workshop", "factory"],
            preferredBranches: ["defense", "ground"],
            preferredUnits: ["launch_pad", "scud_missile", "patriot_missile", "cruise_missile", "rocket_launcher", "anti_rocket_launcher", "nuclear_missile", "cannon"],
            chatLines: [
                "☢️ العقل الاستراتيجي: الطاقة النظيفة والردع الصاروخي البعيد المدى هما مستقبل السيادة!",
                "☢️ العقل الاستراتيجي: منصات الصواريخ الاستراتيجية لدينا ترصد كل تحرك."
            ]
        },
        {
            key: "diplomatic_sage",
            name: "إمارة الذهب",
            title: "⚖️ الحكيم الدبلوماسي",
            desc: "عقيدة التوازن الشامل وقوة العملة",
            c1: "#ca8a04", c2: "#ffffff", c3: "#422006", emblem: "#f59e0b",
            milReserveRatio: 0.28,
            focusStageRush: true,
            loanStrategy: "lender",
            fightThreshold: 0.40,
            aggressionChance: 0.15,
            openingBuilds: ["house", "water_well", "farm", "clinic", "boat", "shop"],
            openingUnits: [],
            preferredBuildings: ["water_well", "farm", "clinic", "classroom", "boat", "shop", "handicrafts", "park", "police_station", "fire_station"],
            preferredBranches: ["ground", "naval", "air", "defense"],
            preferredUnits: ["infantry_def", "small_tank", "war_corvette", "uav_attack", "f15_attack", "air_defense"],
            chatLines: [
                "⚖️ الحكيم الدبلوماسي: توازن جميع القطاعات الـ 16 هو سر قوة عملتنا الوطنية ومؤشرنا العام!",
                "⚖️ الحكيم الدبلوماسي: نرحب بالتبادل التجاري المشترك والتعاون بين جميع الدول."
            ]
        }
    ];

    function getProfileForCountry(country) {
        if (!country) return AI_NATION_PROFILES[0];
        const found = AI_NATION_PROFILES.find(p => p.key === country.aiPersonality || p.name === country.name);
        return found || AI_NATION_PROFILES[0];
    }

    function setSoloAICount(count) {
        const clean = Math.max(1, Math.min(10, parseInt(count, 10) || 4));
        window.selectedSoloAICount = clean;

        document.querySelectorAll(".ai-count-selector-btn").forEach(function(btn) {
            const v = parseInt(btn.getAttribute("data-ai-count"), 10);
            if (v === clean) btn.classList.add("selected");
            else btn.classList.remove("selected");
        });

        const labelWord = clean === 1 ? "دولة واحدة" : (clean === 2 ? "دولتان" : (clean + " دول"));
        const menuBadge = document.getElementById("menu-ai-selected-badge");
        if (menuBadge) menuBadge.textContent = labelWord + " (10 شخصيات مختلفة)";

        const modalLbl = document.getElementById("modal-ai-selected-label");
        if (modalLbl) modalLbl.textContent = labelWord + " بشخصيات مستقلة";

        const btnNew = document.getElementById("btn-menu-new");
        if (btnNew) {
            btnNew.textContent = `🏰 ابدأ اللعب منفرداً (ضد ${labelWord} ذكاء اصطناعي) ➔`;
        }
    }

    function init() {
        document.querySelectorAll(".ai-count-selector-btn").forEach(function(btn) {
            btn.addEventListener("click", function(e) {
                e.preventDefault();
                if (window.GameSFX) window.GameSFX.playClick();
                const cnt = parseInt(btn.getAttribute("data-ai-count"), 10) || 4;
                setSoloAICount(cnt);
            });
        });
        setSoloAICount(window.selectedSoloAICount || 4);
    }

    function getBestAffordableHousingId(country) {
        const housingOrder = ["skyscrapers", "residential_towers", "hotel", "apartments", "palace", "house_large", "house"];
        const cash = Number(country.disposableRevenue || 0);
        for (let i = 0; i < housingOrder.length; i++) {
            const hId = housingOrder[i];
            const res = window.BuildingsEngine ? window.BuildingsEngine.getResource(hId) : null;
            if (res && cash >= res.price && window.BuildingsEngine.checkPrerequisites(country, hId).satisfied) {
                return hId;
            }
        }
        return "house";
    }

    function resolveBuildableResource(country, targetId, depth) {
        depth = depth || 0;
        if (depth > 6 || !window.BuildingsEngine) return null;

        const res = window.BuildingsEngine.getResource(targetId);
        if (!res) return null;

        const countryStage = Number(country.stage) || 1;
        if (typeof res.stage === "number" && res.stage > countryStage) return null;

        const b = country.buildings || {};

        if (Array.isArray(res.prerequisites) && res.prerequisites.length > 0) {
            if (res.prerequisiteMode === "OR") {
                const hasAny = res.prerequisites.some(pId => Number(b[pId] || 0) > 0);
                if (!hasAny) {
                    const prof = getProfileForCountry(country);
                    // أمير البحار وإمبراطور المال يفضلان القارب كشرط للمحل بدلاً من المزرعة
                    const preferredPrereq = res.prerequisites.find(p => prof.preferredBuildings.includes(p)) || res.prerequisites[0];
                    return resolveBuildableResource(country, preferredPrereq, depth + 1);
                }
            } else {
                for (let i = 0; i < res.prerequisites.length; i++) {
                    const pId = res.prerequisites[i];
                    if (Number(b[pId] || 0) <= 0) {
                        return resolveBuildableResource(country, pId, depth + 1);
                    }
                }
            }
        }

        if (res.capacityConsumes === "poultry" && window.BuildingsEngine.getPoultryCapacity(country).available <= 0) {
            return resolveBuildableResource(country, countryStage >= 4 ? "poultry_complex" : "poultry_farm", depth + 1);
        }
        if (res.capacityConsumes === "livestock" && window.BuildingsEngine.getLivestockCapacity(country).available <= 0) {
            return resolveBuildableResource(country, countryStage >= 4 ? "livestock_complex" : "livestock_farm", depth + 1);
        }
        if (res.capacityConsumes === "marina" && window.BuildingsEngine.getMarinaCapacity(country).available <= 0) {
            return resolveBuildableResource(country, "marina", depth + 1);
        }
        if (res.capacityConsumes === "seaport" && window.BuildingsEngine.getSeaportCapacity(country).available <= 0) {
            return resolveBuildableResource(country, "seaport", depth + 1);
        }
        if (res.capacityConsumes === "airport_regional" && window.BuildingsEngine.getRegionalAirportCapacity(country).available <= 0) {
            return resolveBuildableResource(country, "regional_airport", depth + 1);
        }
        if (res.capacityConsumes === "airport_intl" && window.BuildingsEngine.getIntlAirportCapacity(country).available <= 0) {
            return resolveBuildableResource(country, "intl_airport", depth + 1);
        }
        if (res.capacityConsumes === "train_station" && window.BuildingsEngine.getTrainStationCapacity(country).available <= 0) {
            return resolveBuildableResource(country, "train_station", depth + 1);
        }
        if (res.capacityConsumes === "train_station_large" && window.BuildingsEngine.getLargeTrainStationCapacity(country).available <= 0) {
            return resolveBuildableResource(country, "train_station_large", depth + 1);
        }

        const unemployed = Math.max(0, Number(country.population || 0) - Number(country.employed || 0));
        if (res.populationType === "workforce" && unemployed < Number(res.populationValue || 1)) {
            return getBestAffordableHousingId(country);
        }

        if (window.BuildingsEngine.checkPrerequisites(country, targetId).satisfied) {
            return targetId;
        }
        return null;
    }

    // إدارة المصارف والقروض حسب شخصية كل دولة
    function manageBankAndLoans(country, world, profile) {
        if (!country) return;

        // 1. سحب الفائض من البنك الوطني (إمبراطور المال يبقي جزءاً في البنك كاحتياطي، بينما البقية يسحبونه للاستثمار)
        if (Number(country.bank || 0) > 0 && window.EconomyEngine) {
            if (profile.loanStrategy === "lender" && Number(country.bank) > 300) {
                const half = Math.floor(Number(country.bank) * 0.65);
                if (half > 0) window.EconomyEngine.withdrawPartialFromBank(country, half);
            } else {
                window.EconomyEngine.withdrawAllFromBank(country);
            }
        }

        // 2. الثعلب الانتهازي يقترض من البنك الدولي لتسريع مشاريعه
        if (profile.loanStrategy === "borrower" && Number(country.wbDebt || 0) === 0 && Number(world?.worldBankTreasury || 0) >= 60) {
            const maxLoan = Math.floor((Number(country.budget) || 0) * 0.05) * 3;
            const wantLoan = Math.min(maxLoan, Number(world.worldBankTreasury));
            if (wantLoan >= 30 && window.WorldBankManager && typeof window.WorldBankManager.issueLoan === "function") {
                try { window.WorldBankManager.issueLoan(world, country.id, wantLoan); } catch (e) {}
            }
        }

        // 3. سداد الديون عند وفرة السيولة
        if (Number(country.wbDebt || 0) > 0 && Number(country.disposableRevenue || 0) > Number(country.wbDebt) * 2.2) {
            if (window.WorldBankManager && typeof window.WorldBankManager.repayFullDebt === "function") {
                try { window.WorldBankManager.repayFullDebt(world, country.id, "revenue"); } catch (e) {}
            }
        }

        // 4. إمبراطور المال والحكيم الدبلوماسي يمنحان قروضاً سيادية للدول المحتاجة
        if (profile.loanStrategy === "lender" && Number(country.disposableRevenue || 0) >= 900 && world && window.WorldBankManager) {
            const needy = (world.countries || []).find(
                other => other.id !== country.id && Number(other.disposableRevenue || 0) < 120
            );
            if (needy && typeof window.WorldBankManager.issueSovereignLoan === "function") {
                const alreadyLent = (world.sovereignLoans || []).some(l => l.lenderId === country.id && l.borrowerId === needy.id);
                if (!alreadyLent) {
                    try { window.WorldBankManager.issueSovereignLoan(world, country.id, needy.id, 250, 4, "revenue"); } catch (e) {}
                }
            }
        }

        // 5. سحب طوارئ من البنك الدولي عند الحاجة الشديدة
        if (Number(country.disposableRevenue || 0) < 35 && Number(country.worldBankFund || 0) >= 35 && window.EconomyEngine) {
            window.EconomyEngine.emergencyWithdrawFromWorldBank(country, Math.floor(country.worldBankFund));
        }
    }

    // إدارة البناء والعمران وفق عقيدة الشخصية المستقلة
    function manageBuildingsAndStages(country, world, profile, reserveRatio) {
        if (!country || !window.BuildingsEngine) return;

        let minReserve = Math.floor(Number(country.disposableRevenue || 0) * (reserveRatio || 0));
        // إذا كان دخل الدولة السنوي قوياً (>= 75)، تدخر الدولة بشكل تراكمي لشراء سلاحها النوعي (طراد بحري، طائرة، مدفع، دبابة)
        if (Number(country.budget || 0) >= 75 && reserveRatio >= 0.25 && Array.isArray(profile.preferredUnits) && window.MilitaryData) {
            const firstUnit = window.MilitaryData.getUnitById(profile.preferredUnits[0]);
            const targetPrice = firstUnit ? Number(firstUnit.price || 200) : 200;
            minReserve = Math.max(minReserve, Math.min(targetPrice, Math.floor(Number(country.disposableRevenue || 0) * 0.78)));
        }

        for (let step = 0; step < 26; step++) {
            const curStage = Number(country.stage) || 1;
            if (curStage < 5) {
                const stCheck = window.BuildingsEngine.checkStageCompletion(country, curStage);
                if (stCheck && stCheck.isComplete) {
                    window.BuildingsEngine.upgradeToStage(country, curStage + 1, world);
                }
            }

            const cash = Number(country.disposableRevenue || 0);
            if (cash <= Math.max(15, minReserve)) break;

            let chosenResId = null;
            const unemployed = Math.max(0, Number(country.population || 0) - Number(country.employed || 0));
            const minUnemployedTarget = profile.key === "urban_architect" ? 6 : 2;

            // 1. توفير السكن حسب عقيدة الشخصية
            if (unemployed < minUnemployedTarget) {
                chosenResId = getBestAffordableHousingId(country);
            }

            // 2. الدرع الحصين والحكيم الدبلوماسي يصلحان أي قطاع سالب فوراً
            if (!chosenResId && (profile.key === "fortress_guardian" || profile.key === "diplomatic_sage")) {
                if (Number(country.sectors?.water || 0) < 0) {
                    chosenResId = resolveBuildableResource(country, curStage >= 2 ? "water_pump" : "water_well", 0);
                } else if (Number(country.sectors?.electricity || 0) < 0) {
                    chosenResId = resolveBuildableResource(country, curStage >= 2 ? "power_generator" : "solar_farm", 0);
                }
            }

            // 3. إذا كانت الشخصية تركز على الترقية السريعة (مهندس الحضارة أو الحكيم الدبلوماسي)، تعطي الأولوية القصوى للمباني غير المبنية في المرحلة
            if (!chosenResId && profile.focusStageRush) {
                const missingStageItems = window.BuildingsEngine.RESOURCES_LIST
                    .filter(r => Number(r.stage) === curStage && Number(country.buildings?.[r.id] || 0) === 0)
                    .sort((a, b) => a.price - b.price);
                for (let i = 0; i < missingStageItems.length; i++) {
                    const cand = resolveBuildableResource(country, missingStageItems[i].id, 0);
                    if (cand) {
                        const cRes = window.BuildingsEngine.getResource(cand);
                        if (cRes && (cash - cRes.price) >= minReserve) {
                            chosenResId = cand;
                            break;
                        }
                    }
                }
            }

            // 4. بناء المنشآت المفضلة الخاصة بعقيدة الشخصية (التجارية، البحرية، الجوية، النفطية، الطاقة النظيفة، الدواجن، إلخ)
            if (!chosenResId && Array.isArray(profile.preferredBuildings)) {
                for (let i = 0; i < profile.preferredBuildings.length; i++) {
                    const prefId = profile.preferredBuildings[i];
                    const cand = resolveBuildableResource(country, prefId, 0);
                    if (cand) {
                        const cRes = window.BuildingsEngine.getResource(cand);
                        if (cRes && (cash - cRes.price) >= minReserve) {
                            // إذا كان المبنى مملوكاً بكثرة، ننتقل للتالي في قائمة التفضيلات للتنويع داخل نفس العقيدة
                            const ownedCnt = Number(country.buildings?.[cand] || 0);
                            if (ownedCnt < (2 + curStage * 2) || Math.random() < 0.35) {
                                chosenResId = cand;
                                break;
                            }
                        }
                    }
                }
            }

            // 5. استكمال بقية منشآت المرحلة الحالية تدريجياً
            if (!chosenResId) {
                const stageList = window.BuildingsEngine.RESOURCES_LIST
                    .filter(r => Number(r.stage) === curStage && Number(country.buildings?.[r.id] || 0) === 0)
                    .sort((a, b) => a.price - b.price);
                for (let i = 0; i < stageList.length; i++) {
                    const cand = resolveBuildableResource(country, stageList[i].id, 0);
                    if (cand) {
                        const cRes = window.BuildingsEngine.getResource(cand);
                        if (cRes && (cash - cRes.price) >= minReserve) {
                            chosenResId = cand;
                            break;
                        }
                    }
                }
            }

            if (!chosenResId) break;

            const finalRes = window.BuildingsEngine.getResource(chosenResId);
            if (!finalRes || (cash - finalRes.price) < minReserve) break;

            const buyOutcome = window.BuildingsEngine.purchaseResource(country, chosenResId);
            if (!buyOutcome || !buyOutcome.success) break;
        }

        const finalStage = Number(country.stage) || 1;
        if (finalStage < 5 && window.BuildingsEngine.checkStageCompletion(country, finalStage).isComplete) {
            window.BuildingsEngine.upgradeToStage(country, finalStage + 1, world);
        }
    }

    // إدارة التسليح وتجنيد الوحدات القتالية وفق العقيدة العسكرية الخاصة بكل شخصية
    function manageMilitaryRecruitment(country, profile) {
        if (!country || !window.MilitaryEngine || !window.MilitaryData) return;

        // إمبراطور المال يكتفي بحراسة خفيفة ويوفر أمواله للاقتصاد
        const maxPurchases = profile.key === "capitalist_mogul" ? 2 : (profile.key === "iron_general" ? 18 : 10);

        for (let step = 0; step < maxPurchases; step++) {
            const cash = Number(country.disposableRevenue || 0);
            if (cash < 50) break;

            // بارون النفط والجنرال الحديدي يبنيان مصانع الذخيرة والأسلحة مبكراً
            if ((profile.key === "oil_baron" || profile.key === "iron_general") && country.military && Number(country.military.netAmmoBalance || 0) < 0 && cash >= 2100) {
                const unemp = Math.max(0, Number(country.population || 0) - Number(country.employed || 0));
                if (unemp < 4 && window.BuildingsEngine) {
                    window.BuildingsEngine.purchaseResource(country, getBestAffordableHousingId(country));
                }
                const ammoRes = window.MilitaryEngine.purchaseUnit(country, "ammo_factory", 1);
                if (ammoRes && ammoRes.success) continue;
            }

            // البحث أولاً في قائمة الأسلحة المفضلة لهذه الشخصية تحديداً
            const preferredPool = (profile.preferredUnits || [])
                .map(uid => window.MilitaryData.getUnitById(uid))
                .filter(u => u && Number(u.power || 0) > 0 && u.price <= cash);

            // أو البحث في الفروع العسكرية المفضلة للشخصية (بري / بحري / جوي / دفاع)
            const branchPool = window.MilitaryData.UNITS.filter(u => {
                return Number(u.power || 0) > 0 &&
                    u.price <= cash &&
                    (profile.preferredBranches || ["ground"]).includes(u.branch);
            });

            const candidatePool = preferredPool.length > 0 ? preferredPool : branchPool;
            if (candidatePool.length === 0) break;

            // اختيار السلاح الأقوى ضمن ميزانية الشخصية
            candidatePool.sort((a, b) => b.price - a.price);
            const topSlice = candidatePool.slice(0, Math.min(3, candidatePool.length));
            const picked = topSlice[Math.floor(Math.random() * topSlice.length)];

            const crewNeeded = Number(picked.crew || 0);
            let unemployed = Math.max(0, Number(country.population || 0) - Number(country.employed || 0));

            if (crewNeeded > unemployed && window.BuildingsEngine) {
                const hId = getBestAffordableHousingId(country);
                const hRes = window.BuildingsEngine.getResource(hId);
                if (hRes && cash >= (hRes.price + picked.price)) {
                    window.BuildingsEngine.purchaseResource(country, hId);
                    unemployed = Math.max(0, Number(country.population || 0) - Number(country.employed || 0));
                }
            }

            if (crewNeeded > unemployed) {
                const zeroCrew = candidatePool.filter(u => Number(u.crew || 0) === 0);
                if (zeroCrew.length > 0) {
                    const zBuy = window.MilitaryEngine.purchaseUnit(country, zeroCrew[0].id, 1);
                    if (!zBuy || !zBuy.success) break;
                    continue;
                }
                break;
            }

            const buyRes = window.MilitaryEngine.purchaseUnit(country, picked.id, 1);
            if (!buyRes || !buyRes.success) break;
        }
    }

    // إدارة الصفقات التجارية والرسائل الدبلوماسية حسب الشخصية
    function manageTradeAndDiplomacy(country, world, profile) {
        if (!country || !world) return;

        const tm = typeof window.TradeManager === "function" ? new window.TradeManager() : window.TradeManager;
        if (tm && typeof tm.getSectorPoints === "function") {
            const allCountries = world.getAllCountries ? world.getAllCountries() : (world.countries || []);
            if (allCountries.length >= 2) {
                const sectorKeys = Object.keys(tm.sectorMetadata || {});
                const minSurplusToExport = (profile.key === "capitalist_mogul" || profile.key === "diplomatic_sage") ? 6 : 12;

                for (let i = 0; i < sectorKeys.length; i++) {
                    const sKey = sectorKeys[i];
                    const myPts = tm.getSectorPoints(country, sKey);
                    if (myPts >= minSurplusToExport) {
                        const needyImporter = allCountries.find(other => other.id !== country.id && tm.getSectorPoints(other, sKey) < 0);
                        if (needyImporter) {
                            const alreadyHasDeal = (world.tradeDeals || []).some(
                                d => d.exporterId === country.id && d.importerId === needyImporter.id && d.sectorKey === sKey
                            );
                            if (!alreadyHasDeal) {
                                const ptsToTrade = Math.min(6, Math.max(1, Math.floor(myPts * 0.45)));
                                tm.createDeal(world, country.id, needyImporter.id, sKey, ptsToTrade, 3);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // إرسال رسالة دبلوماسية تعبر عن شخصية القائد في سجل محادثات الروم
        if (Array.isArray(profile.chatLines) && profile.chatLines.length > 0 && Math.random() < 0.22) {
            const line = profile.chatLines[Math.floor(Math.random() * profile.chatLines.length)];
            if (typeof world.addChatMessage === "function") {
                world.addChatMessage({
                    senderId: country.ownerPlayerId || ("ai_" + country.id),
                    senderName: profile.title,
                    countryId: country.id,
                    countryName: country.name,
                    flag: country.flag,
                    text: line,
                    year: world.year || 1,
                    isSystem: false,
                    timestamp: Date.now()
                });
            }
        }
    }

    // تنفيذ جولة كاملة لدولة ذكاء اصطناعي وفق شخصيتها المستقلة
    function executeCountryTurn(country, world, isStartOfYear) {
        if (!country || !country.isAI) return;
        const profile = getProfileForCountry(country);

        // 1. في السنة الأولى: تنفذ كل شخصية خطة التأسيس الفريدة الخاصة بها!
        if ((Number(world?.year) || 1) === 1 && Number(country.area || 0) === 0 && Number(country.population || 0) === 0) {
            if (window.BuildingsEngine && Array.isArray(profile.openingBuilds)) {
                profile.openingBuilds.forEach(function(bId) {
                    window.BuildingsEngine.purchaseResource(country, bId);
                });
            }
            if (window.MilitaryEngine && Array.isArray(profile.openingUnits)) {
                profile.openingUnits.forEach(function(uId) {
                    window.MilitaryEngine.purchaseUnit(country, uId, 1);
                });
            }
            if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
                window.MilitaryEngine.syncCountryWithMilitary(country);
            }
            return;
        }

        manageBankAndLoans(country, world, profile);

        // 2. البناء والتطوير العمراني مع احترام نسبة الاحتياطي العسكري للشخصية
        manageBuildingsAndStages(country, world, profile, profile.milReserveRatio);

        // 3. التسليح وتجنيد الوحدات المفضلة للشخصية (أو الادخار التراكمي لشراء السلاح المفضل كالسفن والطائرات والدبابات)
        manageMilitaryRecruitment(country, profile);

        // 5. التجارة والدبلوماسية
        if (isStartOfYear) {
            manageTradeAndDiplomacy(country, world, profile);
        }

        if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
            window.MilitaryEngine.syncCountryWithMilitary(country);
        } else if (window.IndicatorsEngine && typeof window.IndicatorsEngine.refreshCountryIndicators === "function") {
            window.IndicatorsEngine.refreshCountryIndicators(country);
        }
    }

    function runPreYearEndAITurns(world) {
        world = world || window.currentWorld;
        if (!world || !Array.isArray(world.countries)) return;
        world.countries.forEach(function(c) {
            if (c && c.isAI) {
                executeCountryTurn(c, world, false);
            }
        });
    }

    function runPostYearStartAITurns(world) {
        world = world || window.currentWorld;
        if (!world || !Array.isArray(world.countries)) return;
        let aiCount = 0;
        world.countries.forEach(function(c) {
            if (c && c.isAI) {
                aiCount++;
                executeCountryTurn(c, world, true);
            }
        });
        if (aiCount > 0 && typeof window.renderNationsTable === "function") {
            window.renderNationsTable();
        }
    }

    // توليد الدول المنافسة (من 1 إلى 10) بحيث تأخذ كل دولة شخصية مستقلة تماماً من الـ 10 شخصيات
    function spawnAICountries(world, count) {
        world = world || window.currentWorld;
        if (!world) return [];

        const cleanCount = Math.max(1, Math.min(10, parseInt(count, 10) || 4));
        const existingNames = (world.countries || []).map(c => String(c.name).trim());
        const spawned = [];

        for (let i = 0; i < cleanCount; i++) {
            const profile = AI_NATION_PROFILES[i % AI_NATION_PROFILES.length];
            let finalName = profile.name;
            if (existingNames.includes(finalName)) {
                finalName = profile.name + " (" + (i + 1) + ")";
            }
            existingNames.push(finalName);

            const flagColors = [
                profile.c1, profile.c1, profile.c1, profile.c1,
                profile.c2, profile.emblem, profile.emblem, profile.c2,
                profile.c3, profile.c3, profile.c3, profile.c3
            ];

            const aiCountry = window.Country
                ? new window.Country(finalName, flagColors)
                : { id: "ai_" + Date.now() + "_" + i, name: finalName, flag: flagColors };

            aiCountry.id = "ai_nation_" + Date.now().toString(36) + "_" + i;
            aiCountry.isAI = true;
            aiCountry.aiPersonality = profile.key;
            aiCountry.aiTitle = profile.title;
            aiCountry.aiDesc = profile.desc;
            aiCountry.ownerPlayerId = "ai_bot_" + (i + 1);
            aiCountry.ownerPlayerName = profile.title;
            aiCountry.militaryColor = profile.c1;

            if (typeof world.addCountry === "function") {
                world.addCountry(aiCountry);
            } else if (Array.isArray(world.countries)) {
                world.countries.push(aiCountry);
            }

            // تنفيذ خطة السنة الأولى الخاصة بهذه الشخصية الفريدة
            executeCountryTurn(aiCountry, world, true);
            spawned.push(aiCountry);
        }

        if (window.StorageManager && typeof window.StorageManager.autoSave === "function") {
            window.StorageManager.autoSave(world);
        }

        return spawned;
    }

    // قرار الدفاع حسب شخصية القائد (الجنرال الحديدي والدرع الحصين يقاتلان دائماً، إمبراطور المال والثعلب يفضلان الجزية عند التفوق المعادي)
    function handleAIDefenderUltimatum(primaryAtk, primaryDef, atkCoalition, world) {
        if (!primaryAtk || !primaryDef || !window.WarView || !window.WarEngine) return;
        const profile = getProfileForCountry(primaryDef);

        let totalAtkPower = 0;
        (atkCoalition || []).forEach(member => {
            Object.keys(member.forces || {}).forEach(uid => {
                const cnt = Math.max(0, Math.floor(Number(member.forces[uid] || 0)));
                if (cnt > 0 && window.WarView.isCombatUnit(uid)) {
                    const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
                    totalAtkPower += (u ? (u.power || 1) : 1) * cnt;
                }
            });
        });

        const standingDefUnits = window.WarEngine.getStandingArmyCount(primaryDef);
        const standingDefPower = window.WarEngine.getStandingArmyPower(primaryDef);
        const tribAmount = window.WarEngine.calculateTributeOfferAmount(primaryDef);
        const totalAvailableFunds = Math.max(0, Number(primaryDef.disposableRevenue || 0)) + Math.max(0, Number(primaryDef.bank || 0));

        window.WarView.primaryAttacker = primaryAtk;
        window.WarView.primaryDefender = primaryDef;
        window.WarView.attackerCoalition = atkCoalition;

        const threshold = typeof profile.fightThreshold === "number" ? profile.fightThreshold : 0.30;

        // إذا كان القائد من أصحاب العقيدة الاقتصادية/الانتهازية ولديه مال كافٍ وجيش العدو أقوى منه، يدفع الجزية فوراً
        if (standingDefPower < totalAtkPower * threshold && tribAmount > 0 && totalAvailableFunds >= tribAmount) {
            if (Number(primaryDef.disposableRevenue || 0) < tribAmount && window.EconomyEngine) {
                window.EconomyEngine.withdrawAllFromBank(primaryDef);
            }
            if (typeof window.showGameToast === "function") {
                window.showGameToast(`💰 [${profile.title} - ${primaryDef.name}] فضّل الدبلوماسية ودفع الجزية ($${tribAmount.toLocaleString()}) لحماية اقتصاده!`, "🤖");
            }
            window.WarView.handleDefenderChoicePayTribute();
            return;
        }

        // إذا كان لديه جيش مقاتل -> خوض المعركة الميدانية!
        if (standingDefUnits > 0) {
            const defForces = {};
            const inv = primaryDef.military?.inventory || {};
            Object.keys(inv).forEach(uid => {
                if (window.WarView.isCombatUnit(uid)) {
                    const cnt = Math.max(0, Math.floor(Number(inv[uid] || 0)));
                    if (cnt > 0) defForces[uid] = cnt;
                }
            });

            const cleanDefForces = window.WarEngine.sanitizeMobilizedForces(primaryDef, defForces);
            const defCoalition = [{ country: primaryDef, forces: cleanDefForces }];

            window.WarView.defenderCoalition = defCoalition;
            window.WarView.defenderMobStatus = "FULL";

            if (typeof window.showGameToast === "function") {
                window.showGameToast(`⚔️ [${profile.title} - ${primaryDef.name}] رفض الاستسلام وحشد جيشه (${standingDefUnits} وحدة) للمواجهة!`, "🤖");
            }

            window.WarView.onNetworkBattleStart({
                atkCoalitionData: window.WarView.serializeCoalition(atkCoalition),
                defCoalitionData: window.WarView.serializeCoalition(defCoalition),
                attackerMobStatus: window.WarView.attackerMobStatus || "FULL",
                defenderMobStatus: "FULL",
                battleSeed: Date.now()
            });
            return;
        }

        // إذا لم يمتلك جيشاً ويمكنه دفع الجزية
        if (tribAmount > 0 && totalAvailableFunds >= tribAmount) {
            if (Number(primaryDef.disposableRevenue || 0) < tribAmount && window.EconomyEngine) {
                window.EconomyEngine.withdrawAllFromBank(primaryDef);
            }
            window.WarView.handleDefenderChoicePayTribute();
            return;
        }

        if (typeof window.showGameToast === "function") {
            window.showGameToast(`🏳️ أعلنت دولة [${primaryDef.name}] الاستسلام الفوري أمام جيش [${primaryAtk.name}]!`, "🤖");
        }
        window.WarView.handleDefenderChoiceSurrender();
    }

    function executeAIAttackerTurn(atkCountry, world) {
        world = world || window.currentWorld;
        if (!atkCountry || !world || !window.WarView || !window.WarEngine) return;

        const countries = world.countries || [];
        const myStanding = window.WarEngine.getStandingArmyCount(atkCountry);
        if (myStanding <= 0 || countries.length < 2) {
            if (window.WarView.warRequestersQueue && window.WarView.warRequestersQueue.length > 0) {
                window.WarView.warRequestersQueue.shift();
            }
            window.WarView.advanceToNextWarRequesterOrFinish();
            return;
        }

        const targets = countries
            .filter(c => String(c.id) !== String(atkCountry.id))
            .sort((a, b) => window.WarEngine.getStandingArmyPower(a) - window.WarEngine.getStandingArmyPower(b));

        const defender = targets[0];
        if (!defender) {
            if (window.WarView.warRequestersQueue && window.WarView.warRequestersQueue.length > 0) {
                window.WarView.warRequestersQueue.shift();
            }
            window.WarView.advanceToNextWarRequesterOrFinish();
            return;
        }

        const atkForces = {};
        const inv = atkCountry.military?.inventory || {};
        Object.keys(inv).forEach(uid => {
            if (window.WarView.isCombatUnit(uid)) {
                const cnt = Math.max(0, Math.floor(Number(inv[uid] || 0)));
                if (cnt > 0) atkForces[uid] = cnt;
            }
        });

        const cleanForces = window.WarEngine.sanitizeMobilizedForces(atkCountry, atkForces);
        const atkCoalition = [{ country: atkCountry, forces: cleanForces }];

        window.WarView.primaryAttacker = atkCountry;
        window.WarView.primaryDefender = defender;
        window.WarView.attackerCoalition = atkCoalition;
        window.WarView.attackerMobStatus = "FULL";

        window.WarView.onNetworkUltimatumReceived({
            attackerCountryId: atkCountry.id,
            attackerPlayerId: atkCountry.ownerPlayerId || ("ai_" + atkCountry.id),
            defenderCountryId: defender.id,
            defenderPlayerId: defender.ownerPlayerId || null,
            atkCoalitionData: window.WarView.serializeCoalition(atkCoalition),
            attackerMobStatus: "FULL"
        });
    }

    function collectAIWarRequesters(world) {
        world = world || window.currentWorld;
        if (!world || !Array.isArray(world.countries) || !window.WarEngine) return [];
        const list = [];
        if ((Number(world.year) || 1) >= 3) {
            const candidates = world.countries.filter(c => {
                if (!c || !c.isAI) return false;
                const prof = getProfileForCountry(c);
                return prof.aggressionChance > 0 && window.WarEngine.getStandingArmyCount(c) >= 5 && Math.random() < prof.aggressionChance;
            });
            if (candidates.length > 0) {
                const chosen = candidates[Math.floor(Math.random() * candidates.length)];
                list.push({
                    playerId: chosen.ownerPlayerId || ("ai_" + chosen.id),
                    playerName: chosen.name,
                    countryId: chosen.id
                });
            }
        }
        return list;
    }

    return {
        init: init,
        PROFILES: AI_NATION_PROFILES,
        getProfileForCountry: getProfileForCountry,
        setSoloAICount: setSoloAICount,
        spawnAICountries: spawnAICountries,
        executeCountryTurn: executeCountryTurn,
        runPreYearEndAITurns: runPreYearEndAITurns,
        runPostYearStartAITurns: runPostYearStartAITurns,
        handleAIDefenderUltimatum: handleAIDefenderUltimatum,
        executeAIAttackerTurn: executeAIAttackerTurn,
        collectAIWarRequesters: collectAIWarRequesters
    };
})();
