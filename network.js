/**
 * ============================================================================
 * network.js - محرك الشبكة، الغرف المتزامنة P2P، والحفظ الدائم (عصر الهيمنة - v4.8)
 * ============================================================================
 * 
 * المزايا المعمارية المحدثة:
 * 1. متوافق 100% مع Pure ES6 وخالٍ تماماً من أخطاء بناء الجملة (Syntax Errors).
 * 2. الحفظ الدائم التلقائي لجلسة الغرفة (Room Persistence) في LocalStorage برمز الروم.
 * 3. التعرف التلقائي على اللاعبين الـ 10 عند العودة وإعادة ربطهم بدولهم السابقة.
 * 4. مزامنة تأسيس الدول الجديدة فور إنشائها لكافة أعضاء الغرفة (Nation Creation Broadcast).
 * 5. مؤقت الدقيقة (60 ثانية) الذكي التلقائي عند بقاء لاعب واحد متأخر عن الجاهزية.
 * 6. تحديث كافة التابات الثمانية وجدول الأمم لحظياً فور استقبال أي تحديث عبر الشبكة.
 * 7. نبض اتصال مستمر (Heartbeat) لمنع انقطاع الغرفة عند قفل شاشات الهواتف.
 */

window.NetworkEngine = (function() {
    let peer = null;
    let connections = [];
    let hostConn = null;
    let isHost = false;
    let roomId = null;
    let localPlayerId = null;
    let myCountryId = null;
    let myPlayerName = "قائد سيادي";
    let myReadiness = "WAITING"; // 'WAITING' | 'READY_YEAR' | 'READY_WAR'
    let heartbeatInterval = null;

    // مؤقت الدقيقة التلقائي لدوران السنة
    let autoTurnTimer = null;
    let autoTurnSeconds = 60;
    let timerTargetPlayerId = null;

    let roomState = {
        roomId: null,
        hostId: null,
        players: {}, // playerId -> { name, countryId, readyState, isConnected }
        turnStatus: "PLANNING",
        lastUpdate: Date.now()
    };

    const ROOM_PREFIX = "HEG-";
    const SAVE_PREFIX = "hegemony_room_save_";

    /**
     * دالة تنظيف وتوحيد رمز الغرفة مهما كتبه اللاعب
     */
    function normalizeRoomCode(input) {
        if (!input) return "";
        let clean = String(input).trim().toUpperCase().replace(/\s+/g, "");

        if (/^\d+$/.test(clean)) {
            return ROOM_PREFIX + clean;
        }
        if (clean.indexOf("HEG") === 0 && clean.indexOf(ROOM_PREFIX) !== 0) {
            return ROOM_PREFIX + clean.substring(3);
        }
        if (clean.indexOf(ROOM_PREFIX) === 0) {
            return clean;
        }
        return ROOM_PREFIX + clean;
    }

    function generateRoomCode() {
        const rand = Math.floor(1000 + Math.random() * 9000);
        return ROOM_PREFIX + rand;
    }

    function initIdentity() {
        let storedId = localStorage.getItem("hegemony_player_id");
        if (!storedId) {
            storedId = "usr_" + Math.random().toString(36).substring(2, 9);
            localStorage.setItem("hegemony_player_id", storedId);
        }
        localPlayerId = storedId;

        const storedName = localStorage.getItem("hegemony_player_name");
        if (storedName) {
            myPlayerName = storedName;
        }
    }

    // =========================================================================
    // 1. نظام الحفظ الدائم للغرفة واستئناف اللعب (Persistence Engine)
    // =========================================================================
    function saveRoomPersistence() {
        if (!roomId || !isHost) return;
        try {
            const dataToSave = {
                roomId: roomId,
                hostId: localPlayerId,
                savedAt: Date.now(),
                players: roomState.players,
                worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ?
                    window.currentWorld.toJSON() :
                    null
            };
            localStorage.setItem(SAVE_PREFIX + roomId, JSON.stringify(dataToSave));
            localStorage.setItem("hegemony_last_active_room", roomId);
        } catch (e) {
            console.warn("تعذر حفظ جلسة الغرفة محلياً:", e);
        }
    }

    function loadRoomPersistence(targetRoomId) {
        if (!targetRoomId) return false;
        try {
            const savedRaw = localStorage.getItem(SAVE_PREFIX + targetRoomId);
            if (!savedRaw) return false;

            const saved = JSON.parse(savedRaw);
            if (saved && saved.worldData && window.World) {
                window.currentWorld = window.World.fromJSON(saved.worldData);
                if (saved.players) {
                    roomState.players = Object.assign({}, saved.players);
                }
                return true;
            }
        } catch (e) {
            console.warn("خطأ أثناء استرجاع جلسة الغرفة المحفوظة:", e);
        }
        return false;
    }

    // =========================================================================
    // 2. تحديث كافة التابات الثمانية لحظياً (Multi-Tab Reactive Bridge)
    // =========================================================================
    function refreshAllGameViews() {
        try {
            if (typeof window.renderNationsTable === "function") {
                window.renderNationsTable();
            }
            if (window.AnalyticsManager && typeof window.AnalyticsManager.render === "function") {
                window.AnalyticsManager.render(window.currentWorld);
            }
            if (window.WorldBankManager && typeof window.WorldBankManager.render === "function") {
                window.WorldBankManager.render(window.currentWorld);
            }
            if (window.TradeManager && typeof window.TradeManager.render === "function") {
                window.TradeManager.render(window.currentWorld);
            }
            if (window.ExchangeManager && typeof window.ExchangeManager.render === "function") {
                window.ExchangeManager.render(window.currentWorld);
            }
            if (window.WarView && typeof window.WarView.render === "function") {
                window.WarView.render(window.currentWorld);
            }
            if (window.ChartsManager && typeof window.ChartsManager.render === "function") {
                window.ChartsManager.render(window.currentWorld);
            }
            if (window.ChronicleManager && typeof window.ChronicleManager.render === "function") {
                window.ChronicleManager.render(window.currentWorld);
            }
            if (window.CountryViewController && window.currentViewingCountry) {
                const refreshed = window.currentWorld ? window.currentWorld.countries.find(function(c) {
                    return String(c.id) === String(window.currentViewingCountry.id);
                }) : null;
                if (refreshed) {
                    window.CountryViewController.render(refreshed);
                }
            }
        } catch (err) {
            console.error("خطأ أثناء تحديث واجهات التابات التفاعلية:", err);
        }
    }

    // =========================================================================
    // 3. نبضات الاتصال المستمرة وحافظة الرمز (Heartbeat & Utilities)
    // =========================================================================
    function startHeartbeat() {
        stopHeartbeat();
        heartbeatInterval = setInterval(function() {
            if (peer && !peer.destroyed) {
                if (peer.disconnected) {
                    peer.reconnect();
                }
            }
        }, 10000);
    }

    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }

    function copyRoomCode() {
        if (!roomId) return;
        const textToCopy = roomId;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(function() {
                if (window.showGameToast) window.showGameToast("تم نسخ رمز الغرفة: " + textToCopy, "📋");
            }).catch(function() {
                prompt("انسخ رمز الغرفة يدوياً:", textToCopy);
            });
        } else {
            prompt("انسخ رمز الغرفة يدوياً:", textToCopy);
        }
    }

    // =========================================================================
    // 4. إنشاء غرفة جديدة أو استئناف غرفة محفوظة بواسطة المضيف (Host)
    // =========================================================================
    function createRoom(desiredCode, playerName, callback) {
        initIdentity();
        if (playerName) {
            myPlayerName = playerName;
            localStorage.setItem("hegemony_player_name", playerName);
        }

        roomId = desiredCode ? normalizeRoomCode(desiredCode) : generateRoomCode();
        isHost = true;

        if (peer) {
            try { peer.destroy(); } catch (e) {}
        }

        peer = new Peer(roomId, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" }
                ]
            }
        });

        peer.on("open", function(id) {
            roomId = id;
            roomState.roomId = id;
            roomState.hostId = localPlayerId;

            // استئناف الجلسة المحفوظة مسبقاً إذا وجدت
            const isRestored = loadRoomPersistence(roomId);

            if (!roomState.players[localPlayerId]) {
                roomState.players[localPlayerId] = {
                    name: myPlayerName,
                    countryId: null,
                    readyState: "WAITING",
                    isConnected: true
                };
            } else {
                roomState.players[localPlayerId].isConnected = true;
                roomState.players[localPlayerId].name = myPlayerName;
                if (roomState.players[localPlayerId].countryId) {
                    myCountryId = roomState.players[localPlayerId].countryId;
                }
            }

            saveRoomPersistence();
            startHeartbeat();
            updateTopReadinessBar();
            refreshAllGameViews();

            if (callback) callback({ success: true, roomId: id, isHost: true, isRestored: isRestored });

            const msg = isRestored ?
                "تم استئناف الغرفة المحفوظة بنجاح (" + id + ") واستعادة تقدم اللاعبين!" :
                "تم إنشاء الغرفة بنجاح: " + id + " (انقر لنسخ الرمز)";
            if (window.showGameToast) window.showGameToast(msg, isRestored ? "📂" : "📡");
        });

        peer.on("connection", function(conn) {
            handleIncomingConnection(conn);
        });

        peer.on("disconnected", function() {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        });

        peer.on("error", function(err) {
            console.error("PeerJS Host Error:", err);
            if (err.type === "unavailable-id") {
                createRoom(null, myPlayerName, callback);
            } else {
                if (callback) callback({ success: false, error: err.type });
                if (window.showGameToast) window.showGameToast("خطأ في الخادم: " + err.type, "⚠️");
            }
        });
    }

    // =========================================================================
    // 5. الانضمام لغرفة قائمة بواسطة الرمز (Client Join)
    // =========================================================================
    function joinRoom(inputCode, playerName, callback) {
        initIdentity();
        if (playerName) {
            myPlayerName = playerName;
            localStorage.setItem("hegemony_player_name", playerName);
        }

        const normalizedCode = normalizeRoomCode(inputCode);
        if (!normalizedCode || normalizedCode === ROOM_PREFIX) {
            if (callback) callback({ success: false, error: "الرمز غير صحيح" });
            if (window.showGameToast) window.showGameToast("يرجى كتابة رمز الغرفة!", "✍️");
            return;
        }

        roomId = normalizedCode;
        isHost = false;

        if (peer) {
            try { peer.destroy(); } catch (e) {}
        }

        const clientPeerId = "cli_" + Math.random().toString(36).substring(2, 9);
        peer = new Peer(clientPeerId, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                    { urls: "stun:stun2.l.google.com:19302" }
                ]
            }
        });

        peer.on("open", function() {
            hostConn = peer.connect(roomId, {
                reliable: true,
                metadata: {
                    playerId: localPlayerId,
                    playerName: myPlayerName
                }
            });

            hostConn.on("open", function() {
                sendToHost({
                    type: "JOIN_REQUEST",
                    playerId: localPlayerId,
                    playerName: myPlayerName
                });

                startHeartbeat();
                updateTopReadinessBar();
                if (callback) callback({ success: true, roomId: roomId, isHost: false });
                if (window.showGameToast) window.showGameToast("تم دخول الغرفة: " + roomId, "✅");
            });

            hostConn.on("data", function(data) {
                handleClientReceivedData(data);
            });

            hostConn.on("close", function() {
                if (window.showGameToast) window.showGameToast("انقطع الاتصال بمضيف الغرفة!", "🔌");
                updateTopReadinessBar();
            });

            hostConn.on("error", function(err) {
                console.error("Host connection error:", err);
                if (callback) callback({ success: false, error: "تعذر الاتصال بالمضيف" });
            });
        });

        peer.on("disconnected", function() {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        });

        peer.on("error", function(err) {
            console.error("PeerJS Join Error:", err);
            let msg = "تعذر العثور على الغرفة (" + normalizedCode + ")! تأكد من أن منشئ الغرفة متصل حالياً.";
            if (err.type === "peer-unavailable") {
                msg = "الغرفة (" + normalizedCode + ") غير متوفرة! تأكد من صحة الأرقام ومن بقاء المضيف داخل اللعبة.";
            }
            if (callback) callback({ success: false, error: err.type });
            if (window.showGameToast) window.showGameToast(msg, "❌");
        });
    }

    // =========================================================================
    // 6. إدارة اتصالات المضيف (Host Connection Handler)
    // =========================================================================
    function handleIncomingConnection(conn) {
        const currentCount = Object.keys(roomState.players).length;
        if (currentCount >= 10) {
            conn.on("open", function() {
                conn.send({ type: "ROOM_FULL", msg: "الغرفة مكتملة بالحد الأقصى (10 لاعبين)!" });
                setTimeout(function() { conn.close(); }, 500);
            });
            return;
        }

        connections.push(conn);

        conn.on("data", function(data) {
            handleHostReceivedData(conn, data);
        });

        conn.on("close", function() {
            const pId = (conn.metadata && conn.metadata.playerId) ? conn.metadata.playerId : null;
            if (pId && roomState.players[pId]) {
                roomState.players[pId].isConnected = false;
                broadcastRoomState();
                checkAllPlayersReady();
                saveRoomPersistence();
            }
            connections = connections.filter(function(c) {
                return c !== conn;
            });
        });
    }

    // =========================================================================
    // 7. معالجة البيانات الواردة للمضيف (Host Data Processor)
    // =========================================================================
    function handleHostReceivedData(conn, data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case "JOIN_REQUEST":
                {
                    const pId = data.playerId;
                    const isReturning = !!roomState.players[pId];

                    if (!isReturning) {
                        roomState.players[pId] = {
                            name: data.playerName || "لاعب",
                            countryId: null,
                            readyState: "WAITING",
                            isConnected: true
                        };
                    } else {
                        roomState.players[pId].isConnected = true;
                        roomState.players[pId].name = data.playerName || roomState.players[pId].name;
                    }

                    conn.send({
                        type: "INIT_SYNC",
                        roomState: roomState,
                        assignedCountryId: roomState.players[pId].countryId,
                        worldData: window.currentWorld ? window.currentWorld.toJSON() : null
                    });

                    broadcastRoomState();
                    saveRoomPersistence();

                    if (isReturning && roomState.players[pId].countryId) {
                        broadcastNotification("عازف القيادة " + roomState.players[pId].name + " عاد لاستئناف قيادة دولته!", "👑");
                    }
                    break;
                }

            case "CLAIM_COUNTRY":
                {
                    const pId = data.playerId;
                    const cId = data.countryId;
                    const playerKeys = Object.keys(roomState.players);
                    const isTaken = playerKeys.some(function(k) {
                        return k !== pId && roomState.players[k].countryId === cId && roomState.players[k].isConnected;
                    });

                    if (!isTaken) {
                        if (roomState.players[pId]) {
                            roomState.players[pId].countryId = cId;
                            broadcastRoomState();
                            saveRoomPersistence();
                            broadcastNotification("قام القائد " + roomState.players[pId].name + " بحجز قيادة دولة!", "👑");
                        }
                    } else {
                        conn.send({ type: "CLAIM_REJECTED", msg: "هذه الدولة محجوزة لقائد آخر بالفعل!" });
                    }
                    break;
                }

            case "CREATE_NATION":
                {
                    const pId = data.playerId;
                    const newCountry = data.countryData;
                    if (newCountry && window.currentWorld) {
                        newCountry.ownerPlayerId = pId;
                        const existingIdx = window.currentWorld.countries.findIndex(function(c) {
                            return String(c.id) === String(newCountry.id);
                        });
                        if (existingIdx >= 0) {
                            window.currentWorld.countries[existingIdx] = newCountry;
                        } else {
                            window.currentWorld.countries.push(newCountry);
                        }

                        if (roomState.players[pId]) {
                            roomState.players[pId].countryId = newCountry.id;
                        }

                        saveRoomPersistence();
                        broadcastToAll({
                            type: "NATION_CREATED",
                            countryData: newCountry,
                            playerId: pId
                        });
                        broadcastRoomState();
                        refreshAllGameViews();

                        const pName = (roomState.players[pId] && roomState.players[pId].name) ? roomState.players[pId].name : "جديد";
                        broadcastNotification("أعلن القائد " + pName + " تأسيس دولة [" + newCountry.name + "]!", "🏰");
                    }
                    break;
                }

            case "SUBMIT_READY":
                {
                    const pId = data.playerId;
                    const decision = data.decision;
                    if (roomState.players[pId]) {
                        roomState.players[pId].readyState = decision;
                        broadcastRoomState();
                        checkAllPlayersReady();
                    }
                    break;
                }

            case "SYNC_MY_COUNTRY_DATA":
                {
                    if (data.countryData && window.currentWorld) {
                        const target = window.currentWorld.countries.find(function(c) {
                            return String(c.id) === String(data.countryData.id);
                        });
                        if (target) {
                            Object.assign(target, data.countryData);
                            saveRoomPersistence();
                            broadcastToAll({
                                type: "COUNTRY_UPDATED",
                                countryData: data.countryData
                            });
                            refreshAllGameViews();
                        }
                    }
                    break;
                }
        }
    }

    // =========================================================================
    // 8. معالجة البيانات عند اللاعب المنضم (Client Data Processor)
    // =========================================================================
    function handleClientReceivedData(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case "INIT_SYNC":
                {
                    roomState = data.roomState;
                    if (data.assignedCountryId) {
                        myCountryId = data.assignedCountryId;
                    }
                    if (data.worldData && window.World) {
                        window.currentWorld = window.World.fromJSON(data.worldData);
                    }
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    break;
                }

            case "ROOM_STATE_UPDATE":
                {
                    roomState = data.roomState;
                    updateTopReadinessBar();
                    break;
                }

            case "NATION_CREATED":
                {
                    if (window.currentWorld && data.countryData) {
                        const existingIdx = window.currentWorld.countries.findIndex(function(c) {
                            return String(c.id) === String(data.countryData.id);
                        });
                        if (existingIdx >= 0) {
                            window.currentWorld.countries[existingIdx] = data.countryData;
                        } else {
                            window.currentWorld.countries.push(data.countryData);
                        }
                        if (data.playerId === localPlayerId) {
                            myCountryId = data.countryData.id;
                        }
                        refreshAllGameViews();
                        updateTopReadinessBar();
                    }
                    break;
                }

            case "COUNTRY_UPDATED":
                {
                    if (window.currentWorld && data.countryData) {
                        const found = window.currentWorld.countries.find(function(c) {
                            return String(c.id) === String(data.countryData.id);
                        });
                        if (found) {
                            Object.assign(found, data.countryData);
                            refreshAllGameViews();
                        }
                    }
                    break;
                }

            case "TIMER_UPDATE":
                {
                    autoTurnSeconds = data.seconds;
                    timerTargetPlayerId = data.targetPlayerId;
                    updateTopReadinessBar();
                    break;
                }

            case "ADVANCE_YEAR_TRIGGER":
                {
                    if (window.currentWorld && data.worldData) {
                        window.currentWorld = window.World.fromJSON(data.worldData);
                        myReadiness = "WAITING";
                        autoTurnSeconds = 0;
                        stopAutoTurnCountdown();
                        updateTopReadinessBar();
                        refreshAllGameViews();
                        if (window.GameSFX && typeof window.GameSFX.newYear === "function") window.GameSFX.newYear();
                        if (window.showGameToast) window.showGameToast("انطلقت السنة المالية " + window.currentWorld.year + "م لجميع اللاعبين!", "🌟");
                    }
                    break;
                }

            case "WAR_TRIGGER":
                {
                    myReadiness = "WAITING";
                    autoTurnSeconds = 0;
                    stopAutoTurnCountdown();
                    updateTopReadinessBar();
                    const screens = document.querySelectorAll(".screen");
                    for (let i = 0; i < screens.length; i++) {
                        screens[i].classList.remove("active");
                    }
                    const dash = document.getElementById("game-dashboard");
                    if (dash) dash.classList.add("active");
                    const warBtn = document.getElementById("btn-view-war");
                    if (warBtn) warBtn.click();
                    if (window.showGameToast) window.showGameToast("أعلن أحد القادة الحرب! الانتقال لغرفة العمليات العسكرية!", "⚔️");
                    break;
                }

            case "NOTIFICATION":
                {
                    if (window.showGameToast) window.showGameToast(data.msg, data.icon || "📢");
                    break;
                }

            case "CLAIM_REJECTED":
                {
                    alert(data.msg);
                    myCountryId = null;
                    break;
                }
        }
    }

    // =========================================================================
    // 9. نظام المؤقت الذكي والتحقق من الجاهزية (Smart 60s Turn Engine)
    // =========================================================================
    function startAutoTurnCountdown(targetId) {
        if (autoTurnTimer) return;
        autoTurnSeconds = 60;
        timerTargetPlayerId = targetId;

        broadcastToAll({
            type: "TIMER_UPDATE",
            seconds: autoTurnSeconds,
            targetPlayerId: timerTargetPlayerId
        });
        updateTopReadinessBar();

        autoTurnTimer = setInterval(function() {
            autoTurnSeconds--;
            broadcastToAll({
                type: "TIMER_UPDATE",
                seconds: autoTurnSeconds,
                targetPlayerId: timerTargetPlayerId
            });
            updateTopReadinessBar();

            if (autoTurnSeconds <= 0) {
                stopAutoTurnCountdown();
                executeAutoTurnProgression();
            }
        }, 1000);
    }

    function stopAutoTurnCountdown() {
        if (autoTurnTimer) {
            clearInterval(autoTurnTimer);
            autoTurnTimer = null;
        }
        autoTurnSeconds = 0;
        timerTargetPlayerId = null;
        if (isHost) {
            broadcastToAll({
                type: "TIMER_UPDATE",
                seconds: 0,
                targetPlayerId: null
            });
        }
        updateTopReadinessBar();
    }

    function executeAutoTurnProgression() {
        if (!isHost || !window.currentWorld) return;

        const playerKeys = Object.keys(roomState.players);
        for (let i = 0; i < playerKeys.length; i++) {
            roomState.players[playerKeys[i]].readyState = "WAITING";
        }

        window.currentWorld.advanceYear();
        const updatedWorldData = window.currentWorld.toJSON();
        saveRoomPersistence();

        broadcastToAll({
            type: "ADVANCE_YEAR_TRIGGER",
            worldData: updatedWorldData
        });

        handleClientReceivedData({
            type: "ADVANCE_YEAR_TRIGGER",
            worldData: updatedWorldData
        });
    }

    function checkAllPlayersReady() {
        if (!isHost) return;

        const playerKeys = Object.keys(roomState.players);
        const activePlayers = [];
        for (let i = 0; i < playerKeys.length; i++) {
            const p = roomState.players[playerKeys[i]];
            if (p.isConnected && p.countryId) {
                activePlayers.push(p);
            }
        }

        if (activePlayers.length === 0) {
            stopAutoTurnCountdown();
            return;
        }

        const readyPlayers = activePlayers.filter(function(p) {
            return p.readyState === "READY_YEAR" || p.readyState === "READY_WAR";
        });

        // الحالة 1: الجميع مستعد بالكامل -> دوران مباشر
        if (readyPlayers.length === activePlayers.length) {
            stopAutoTurnCountdown();

            const hasWar = activePlayers.some(function(p) {
                return p.readyState === "READY_WAR";
            });

            activePlayers.forEach(function(p) {
                p.readyState = "WAITING";
            });

            if (hasWar) {
                broadcastToAll({ type: "WAR_TRIGGER" });
                handleClientReceivedData({ type: "WAR_TRIGGER" });
            } else {
                executeAutoTurnProgression();
            }
            return;
        }

        // الحالة 2: بقي لاعب واحد فقط لم يستعد في غرفة تضم أكثر من لاعب -> تفعيل مؤقت الدقيقة (60 ثانية)
        if (activePlayers.length > 1 && readyPlayers.length === activePlayers.length - 1) {
            const waitingPlayer = activePlayers.find(function(p) {
                return p.readyState === "WAITING";
            });
            if (waitingPlayer && !autoTurnTimer) {
                const targetKey = Object.keys(roomState.players).find(function(k) {
                    return roomState.players[k] === waitingPlayer;
                });
                startAutoTurnCountdown(targetKey);
            }
        } else {
            if (autoTurnTimer) {
                stopAutoTurnCountdown();
            }
        }
    }

    function broadcastRoomState() {
        if (!isHost) return;
        roomState.lastUpdate = Date.now();
        broadcastToAll({
            type: "ROOM_STATE_UPDATE",
            roomState: roomState
        });
        updateTopReadinessBar();
    }

    function broadcastNotification(msg, icon) {
        broadcastToAll({
            type: "NOTIFICATION",
            msg: msg,
            icon: icon
        });
    }

    function broadcastToAll(msg) {
        connections.forEach(function(conn) {
            if (conn.open) {
                conn.send(msg);
            }
        });
    }

    function sendToHost(msg) {
        if (hostConn && hostConn.open) {
            hostConn.send(msg);
        }
    }

    // =========================================================================
    // 10. واجهات وإجراءات اللاعب (Player Actions & Sovereignty)
    // =========================================================================
    function syncNewCountry(countryData) {
        if (!countryData) return;
        countryData.ownerPlayerId = localPlayerId;
        myCountryId = countryData.id;

        if (isHost) {
            if (window.currentWorld) {
                const idx = window.currentWorld.countries.findIndex(function(c) {
                    return String(c.id) === String(countryData.id);
                });
                if (idx >= 0) window.currentWorld.countries[idx] = countryData;
                else window.currentWorld.countries.push(countryData);
            }
            roomState.players[localPlayerId].countryId = countryData.id;
            saveRoomPersistence();
            broadcastToAll({
                type: "NATION_CREATED",
                countryData: countryData,
                playerId: localPlayerId
            });
            broadcastRoomState();
            refreshAllGameViews();
        } else {
            sendToHost({
                type: "CREATE_NATION",
                countryData: countryData,
                playerId: localPlayerId
            });
            refreshAllGameViews();
        }
        updateTopReadinessBar();
    }

    function claimCountry(countryId) {
        myCountryId = countryId;
        if (isHost) {
            roomState.players[localPlayerId].countryId = countryId;
            saveRoomPersistence();
            broadcastRoomState();
        } else {
            sendToHost({
                type: "CLAIM_COUNTRY",
                playerId: localPlayerId,
                countryId: countryId
            });
        }
        updateTopReadinessBar();
    }

    function submitDecision(decision) {
        if (!myCountryId) {
            alert("يرجى تأسيس دولتك أو اختيارها أولاً من قائمة بطاقات الأمم!");
            return;
        }

        myReadiness = decision;
        updateTopReadinessBar();

        if (isHost) {
            roomState.players[localPlayerId].readyState = decision;
            broadcastRoomState();
            checkAllPlayersReady();
        } else {
            sendToHost({
                type: "SUBMIT_READY",
                playerId: localPlayerId,
                decision: decision
            });
        }
    }

    function canControlCountry(targetCountryId) {
        if (!roomId) return true;
        if (!myCountryId) return true;
        return String(myCountryId) === String(targetCountryId);
    }

    function isMyCountry(targetCountryId) {
        if (!roomId) return true;
        return String(myCountryId) === String(targetCountryId);
    }

    function syncCountryChanges(country) {
        if (!roomId || !country) return;
        if (isHost) {
            saveRoomPersistence();
            broadcastToAll({
                type: "COUNTRY_UPDATED",
                countryData: country
            });
            refreshAllGameViews();
        } else {
            sendToHost({
                type: "SYNC_MY_COUNTRY_DATA",
                countryData: country
            });
            refreshAllGameViews();
        }
    }

    // =========================================================================
    // 11. تحديث شريط الجاهزية العلوي ومؤشر المؤقت (HUD Updates)
    // =========================================================================
    function updateTopReadinessBar() {
        const bar = document.getElementById("multiplayer-status-bar");
        if (!bar) return;

        if (!roomId) {
            bar.style.display = "none";
            return;
        }

        bar.style.display = "flex";

        const roomCodeLabel = document.getElementById("mp-room-code-label");
        const countLabel = document.getElementById("mp-players-count");
        const statusDetails = document.getElementById("mp-status-details");
        const btnNextYear = document.getElementById("btn-mp-ready-year");
        const btnWar = document.getElementById("btn-mp-ready-war");

        if (roomCodeLabel) {
            roomCodeLabel.textContent = "غرفة: " + roomId;
            roomCodeLabel.title = "اضغط لنسخ الرمز";
            roomCodeLabel.style.cursor = "pointer";
            roomCodeLabel.onclick = copyRoomCode;
        }

        const playerKeys = Object.keys(roomState.players);
        const playersArr = [];
        for (let i = 0; i < playerKeys.length; i++) {
            const p = roomState.players[playerKeys[i]];
            if (p.isConnected) playersArr.push(p);
        }

        let readyCount = 0;
        for (let j = 0; j < playersArr.length; j++) {
            if (playersArr[j].readyState !== "WAITING") readyCount++;
        }

        if (countLabel) countLabel.textContent = "👥 " + playersArr.length + "/10";

        if (statusDetails) {
            if (autoTurnSeconds > 0) {
                let targetName = "آخر قائد";
                if (timerTargetPlayerId && roomState.players[timerTargetPlayerId] && roomState.players[timerTargetPlayerId].name) {
                    targetName = roomState.players[timerTargetPlayerId].name;
                }
                statusDetails.innerHTML = '<span style="color:#fde047; font-weight:900;">⏳ بانتظار ' + targetName + ': ' + autoTurnSeconds + ' ثانية للتقدم التلقائي</span>';
            } else {
                statusDetails.textContent = "الجاهزية: " + readyCount + "/" + playersArr.length;
            }
        }

        if (btnNextYear && btnWar) {
            if (myReadiness === "READY_YEAR") {
                btnNextYear.className = "btn btn-sm btn-primary active-decision";
                btnNextYear.textContent = "✅ بانتظار البقية";
                btnWar.className = "btn btn-sm btn-secondary";
                btnWar.textContent = "⚔️ إعلان الحرب";
            } else if (myReadiness === "READY_WAR") {
                btnNextYear.className = "btn btn-sm btn-secondary";
                btnNextYear.textContent = "🌾 سنة جديدة";
                btnWar.className = "btn btn-sm btn-danger active-decision";
                btnWar.textContent = "🚨 أعلنت الحرب";
            } else {
                btnNextYear.className = "btn btn-sm btn-primary";
                btnNextYear.textContent = "🌾 سنة جديدة";
                btnWar.className = "btn btn-sm btn-danger";
                btnWar.textContent = "⚔️ إعلان الحرب";
            }
        }
    }

    return {
        createRoom: createRoom,
        joinRoom: joinRoom,
        claimCountry: claimCountry,
        syncNewCountry: syncNewCountry,
        submitDecision: submitDecision,
        canControlCountry: canControlCountry,
        isMyCountry: isMyCountry,
        syncCountryChanges: syncCountryChanges,
        updateTopReadinessBar: updateTopReadinessBar,
        copyRoomCode: copyRoomCode,
        refreshAllGameViews: refreshAllGameViews,
        getRoomId: function() { return roomId; },
        isHost: function() { return isHost; },
        getMyCountryId: function() { return myCountryId; },
        getLocalPlayerId: function() { return localPlayerId; },
        getRoomState: function() { return roomState; }
    };
})();
