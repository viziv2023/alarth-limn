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
// 4. إدارة نافذة الغرف المتعددة والحفظ الدائم (Multiplayer Lobby - بدون أخطاء)
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

    const nameInp = document.getElementById("mp-player-name-input");
    const savedName = getSafeLocalStorage("hegemony_player_name");
    if (nameInp && savedName) {
        nameInp.value = savedName;
    }

    const lastRoomId = getSafeLocalStorage("hegemony_last_active_room");
    const savedBox = document.getElementById("mp-saved-room-box");
    const savedDesc = document.getElementById("mp-saved-room-desc");

    if (lastRoomId && getSafeLocalStorage("hegemony_room_save_" + lastRoomId) && savedBox && savedDesc) {
        savedBox.style.display = "block";
        savedDesc.textContent = "رمز الغرفة المحفوظة: " + lastRoomId + " (يمكنك استئنافها ومتابعة اللعب فوراً)";

        const btnResume = document.getElementById("btn-resume-saved-room");
        if (btnResume) {
            btnResume.onclick = function() {
                const pName = (nameInp && nameInp.value && nameInp.value.trim()) ? nameInp.value.trim() : "قائد سيادي";
                btnResume.disabled = true;
                btnResume.textContent = "⏳ جاري استعادة الغرفة...";
                if (window.NetworkEngine) {
                    window.NetworkEngine.createRoom(lastRoomId, pName, function(res) {
                        btnResume.disabled = false;
                        btnResume.textContent = "🌟 استئناف الغرفة المحفوظة ➔";
                        if (res && res.success) {
                            modal.classList.remove("active");
                            showDashboardScreen();
                            renderNationsTable();
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
            const pName = (nameInp && nameInp.value && nameInp.value.trim()) ? nameInp.value.trim() : "قائد سيادي";

            btnCreate.disabled = true;
            const origText = btnCreate.textContent;
            btnCreate.textContent = "⏳ جاري فتح الغرفة...";

            if (window.NetworkEngine) {
                window.NetworkEngine.createRoom(null, pName, function(res) {
                    btnCreate.disabled = false;
                    btnCreate.textContent = origText;
                    if (res && res.success) {
                        modal.classList.remove("active");
                        showDashboardScreen();
                        renderNationsTable();

                        const myCId = window.NetworkEngine.getMyCountryId();
                        const existingCountries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];
                        if (!myCId && existingCountries.length === 0) {
                            openCreateCountryModal();
                        }
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
            const pName = (nameInp && nameInp.value && nameInp.value.trim()) ? nameInp.value.trim() : "قائد سيادي";

            if (!code) {
                window.showGameToast("يرجى إدخال رمز الغرفة أولاً (مثال: 4821 أو HEG-4821)!", "⚠️");
                if (codeInp) codeInp.focus();
                return;
            }

            btnJoin.disabled = true;
            const origText = btnJoin.textContent;
            btnJoin.textContent = "⏳ جاري الاتصال...";

            if (window.NetworkEngine) {
                window.NetworkEngine.joinRoom(code, pName, function(res) {
                    btnJoin.disabled = false;
                    btnJoin.textContent = origText;
                    if (res && res.success) {
                        modal.classList.remove("active");
                        showDashboardScreen();
                        renderNationsTable();

                        setTimeout(function() {
                            const myCId = window.NetworkEngine.getMyCountryId();
                            const countries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];
                            if (!myCId) {
                                if (countries.length === 0) {
                                    openCreateCountryModal();
                                } else {
                                    window.showGameToast("اختر دولة متاحة للقيادة من البطاقات أو اضغط (🏰 + دولة) لتأسيس دولتك!", "👑");
                                }
                            }
                        }, 300);
                    }
                });
            }
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

            window.showGameToast("🎉 مرحباً بك في عاصمة [" + nationName + "]! ابْنِ بيتاً 🏠 أولاً لخروج السكان والعمال", "🏛️");
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
            if (window.ChronicleManager && typeof window.ChronicleManager.render === "function") {
                try { window.ChronicleManager.render(window.currentWorld); } catch (e) {}
            }
            enhanceAndSanitizeTabDOM("chronicle-tables-wrapper", "chronicle", window.currentWorld);
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

        const milPower = (c.military && typeof c.military.totalPower === "number") ?
            c.military.totalPower :
            (Number(c.militaryPower) || 0);

        let ownershipBadgeHtml = '<span class="badge badge-gold" style="font-size:0.68rem; padding:2px 7px;">👑 دولتي</span>';
        let footerActionText = '🏛️ دخول العاصمة 3D والبناء المباشر ➔';

        if (isMpActive) {
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
                    <span class="stat-label">⚔️ القوة:</span>
                    <span class="stat-val text-green">${Number(milPower).toLocaleString()}</span>
                </div>
            </div>

            <div class="nation-card-play-footer">
                ${footerActionText}
            </div>
        `;

        card.onclick = function() {
            window.GameSFX.playClick();
            if (isMpActive && !ownerInfo.isClaimed && !window.NetworkEngine.getMyCountryId()) {
                window.NetworkEngine.claimCountry(c.id);
            }
            if (window.CountryViewController) {
                window.CountryViewController.open(c.id);
            } else if (window.CapitalView) {
                window.CapitalView.open(c);
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
