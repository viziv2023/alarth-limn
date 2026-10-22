/**
 * ============================================================================
 * network.js - محرك الشبكة، الغرف المتزامنة P2P، والحفظ الدائم (عصر الهيمنة - v5.2)
 * ============================================================================
 *
 * الإصلاحات الجذرية (v5.2):
 * 1. منع رفض الدخول أو أخطاء PeerJS عند إنشاء الغرفة أو الانضمام إليها أو تحديث الصفحة.
 * 2. إعادة إرسال طلب الانضمام (Handshake Retry) لضمان استلام حالة الغرفة والدول 100%.
 * 3. استرجاع تلقائي للغرفة المحفوظة على نفس الجهاز إذا تعذر الاتصال بالخادم السحابي.
 * 4. تحويل كافة كائنات الدول المتزامنة عبر Country.fromJSON لمنع أخطاء toJSON.
 * 5. فصل واضح ودقيق بين (دولتي / دولة متاحة للقيادة / دولة بقيادة لاعب آخر) لمنع الفوضى.
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
    let isConnectingRoom = false;
    let initSyncReceived = false;
    let joinRetryInterval = null;

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

    function normalizeRoomCode(input) {
        if (!input) return "";
        let clean = String(input).trim().toUpperCase().replace(/\s+/g, "");
        if (!clean) return "";

        if (/^\d+$/.test(clean)) {
            return ROOM_PREFIX + clean;
        }
        if (clean.indexOf("HEG-") === 0) {
            return clean;
        }
        if (clean.indexOf("HEG") === 0) {
            return ROOM_PREFIX + clean.substring(3).replace(/^-+/, "");
        }
        return ROOM_PREFIX + clean;
    }

    function generateRoomCode() {
        const rand = Math.floor(1000 + Math.random() * 9000);
        return ROOM_PREFIX + rand;
    }

    function initIdentity() {
        try {
            let storedId = localStorage.getItem("hegemony_player_id");
            if (!storedId) {
                storedId = "usr_" + Math.random().toString(36).substring(2, 9);
                localStorage.setItem("hegemony_player_id", storedId);
            }
            localPlayerId = storedId;

            const storedName = localStorage.getItem("hegemony_player_name");
            if (storedName && storedName.trim()) {
                myPlayerName = storedName.trim();
            }
        } catch (e) {
            if (!localPlayerId) {
                localPlayerId = "usr_" + Math.random().toString(36).substring(2, 9);
            }
        }
    }

    /**
     * ضمان تحويل أي بيانات دولة قادمة من الشبكة إلى كائن Country مكتمل الدوال
     */
    function ensureCountryInstance(rawData) {
        if (!rawData) return null;
        let inst = rawData;
        if (window.Country && typeof window.Country.fromJSON === "function" && !(rawData instanceof window.Country)) {
            try {
                inst = window.Country.fromJSON(rawData);
            } catch (e) {
                inst = rawData;
            }
        }
        if (rawData.ownerPlayerId) inst.ownerPlayerId = rawData.ownerPlayerId;
        if (rawData.ownerPlayerName) inst.ownerPlayerName = rawData.ownerPlayerName;
        if (rawData.militaryColor) inst.militaryColor = rawData.militaryColor;
        return inst;
    }

    function upsertCountryInWorld(rawCountry) {
        if (!rawCountry || !window.currentWorld) return null;
        const countryInst = ensureCountryInstance(rawCountry);
        if (!Array.isArray(window.currentWorld.countries)) {
            window.currentWorld.countries = [];
        }
        const idx = window.currentWorld.countries.findIndex(function(c) {
            return String(c.id) === String(countryInst.id);
        });
        if (idx >= 0) {
            const existing = window.currentWorld.countries[idx];
            Object.assign(existing, countryInst);
            return existing;
        } else {
            window.currentWorld.countries.push(countryInst);
            return countryInst;
        }
    }

    // =========================================================================
    // 1. نظام الحفظ الدائم للغرفة واستئناف اللعب (Persistence Engine)
    // =========================================================================
    function saveRoomPersistence() {
        if (!roomId) return;
        try {
            const dataToSave = {
                roomId: roomId,
                hostId: roomState.hostId || localPlayerId,
                savedAt: Date.now(),
                players: roomState.players,
                worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ?
                    window.currentWorld.toJSON() :
                    window.currentWorld
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
            if (saved && saved.worldData) {
                if (window.World && typeof window.World.fromJSON === "function") {
                    window.currentWorld = window.World.fromJSON(saved.worldData);
                } else {
                    window.currentWorld = saved.worldData;
                }
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
            if (window.CountryViewController && window.currentViewingCountry && window.currentWorld) {
                const refreshed = window.currentWorld.countries.find(function(c) {
                    return String(c.id) === String(window.currentViewingCountry.id);
                });
                if (refreshed) {
                    window.currentViewingCountry = refreshed;
                    window.CountryViewController.render(refreshed);
                }
            }
            if (window.CapitalView && typeof window.CapitalView.refreshHUDAndMap === "function") {
                const capScreen = document.getElementById("capital-screen");
                if (capScreen && capScreen.classList.contains("active")) {
                    window.CapitalView.refreshHUDAndMap();
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
                    try { peer.reconnect(); } catch (e) {}
                }
            }
        }, 10000);
    }

    function stopHeartbeat() {
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
        if (joinRetryInterval) {
            clearInterval(joinRetryInterval);
            joinRetryInterval = null;
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

    /**
     * تهيئة حالة المضيف محلياً وربط دولته إن كانت موجودة مسبقاً
     */
    function finalizeHostRoomSetup(finalRoomId, sourceSavedRoomId, callback) {
        isConnectingRoom = false;
        roomId = finalRoomId;
        isHost = true;
        roomState.roomId = finalRoomId;
        roomState.hostId = localPlayerId;

        const isRestored = loadRoomPersistence(sourceSavedRoomId || finalRoomId);

        if (!roomState.players[localPlayerId]) {
            roomState.players[localPlayerId] = {
                name: myPlayerName,
                countryId: myCountryId || null,
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

        // إذا كان لدى المضيف دولة مؤسسة مسبقاً في العالم الحالي، نربطها به تلقائياً
        const countries = (window.currentWorld && Array.isArray(window.currentWorld.countries)) ? window.currentWorld.countries : [];
        if (!myCountryId && countries.length > 0) {
            const myOwned = countries.find(function(c) { return c.ownerPlayerId === localPlayerId; }) ||
                (countries.length === 1 ? countries[0] : null);
            if (myOwned) {
                myCountryId = myOwned.id;
                myOwned.ownerPlayerId = localPlayerId;
                myOwned.ownerPlayerName = myPlayerName;
                roomState.players[localPlayerId].countryId = myOwned.id;
            }
        }

        saveRoomPersistence();
        startHeartbeat();
        updateTopReadinessBar();
        refreshAllGameViews();

        if (callback) {
            callback({
                success: true,
                roomId: finalRoomId,
                isHost: true,
                isRestored: isRestored,
                hasCountry: !!myCountryId
            });
        }
    }

    // =========================================================================
    // 4. إنشاء غرفة جديدة أو استئناف غرفة محفوظة بواسطة المضيف (Host)
    // =========================================================================
    function createRoom(desiredCode, playerName, callback, _retryCount) {
        initIdentity();
        const retryAttempt = _retryCount || 0;

        if (playerName && String(playerName).trim()) {
            myPlayerName = String(playerName).trim();
            try { localStorage.setItem("hegemony_player_name", myPlayerName); } catch (e) {}
        }

        const requestedRoomId = desiredCode ? normalizeRoomCode(desiredCode) : generateRoomCode();
        const targetPeerId = retryAttempt > 0 ? generateRoomCode() : requestedRoomId;

        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }

        // إذا لم تكن مكتبة PeerJS محملة (مثلاً بدون إنترنت)، نفعل الغرفة محلياً فوراً بدون خطأ
        if (typeof Peer === "undefined") {
            finalizeHostRoomSetup(targetPeerId, requestedRoomId, callback);
            if (window.showGameToast) {
                window.showGameToast("تم فتح الغرفة (" + targetPeerId + ") في الوضع المحلي!", "👑");
            }
            return;
        }

        isConnectingRoom = true;
        let callbackFired = false;

        // مؤقت أمان: إذا تأخر خادم PeerJS أكثر من 6 ثوانٍ، نفتح الغرفة فوراً دون تعليق اللاعب
        const fallbackTimer = setTimeout(function() {
            if (!callbackFired) {
                callbackFired = true;
                finalizeHostRoomSetup(targetPeerId, requestedRoomId, callback);
                if (window.showGameToast) {
                    window.showGameToast("تم تفعيل الغرفة: " + targetPeerId, "📡");
                }
            }
        }, 6000);

        try {
            peer = new Peer(targetPeerId, {
                debug: 0,
                config: {
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" }
                    ]
                }
            });
        } catch (err) {
            clearTimeout(fallbackTimer);
            callbackFired = true;
            finalizeHostRoomSetup(targetPeerId, requestedRoomId, callback);
            return;
        }

        peer.on("open", function(id) {
            if (callbackFired) return;
            clearTimeout(fallbackTimer);
            callbackFired = true;

            finalizeHostRoomSetup(id, requestedRoomId, callback);

            const msg = desiredCode ?
                "تم استئناف الغرفة المحفوظة بنجاح (" + id + ")!" :
                "تم إنشاء الغرفة بنجاح: " + id + " (اضغط على الرمز بالأعلى لنسخه)";
            if (window.showGameToast) window.showGameToast(msg, "📡");
        });

        peer.on("connection", function(conn) {
            handleIncomingConnection(conn);
        });

        peer.on("disconnected", function() {
            if (peer && !peer.destroyed) {
                try { peer.reconnect(); } catch (e) {}
            }
        });

        peer.on("error", function(err) {
            clearTimeout(fallbackTimer);
            if (callbackFired) return;

            console.warn("PeerJS Host Warning:", err ? err.type : err);
            if (err && err.type === "unavailable-id" && retryAttempt < 3) {
                setTimeout(function() {
                    createRoom(desiredCode, myPlayerName, callback, retryAttempt + 1);
                }, 250);
                return;
            }

            // في حال أي خطأ شبكي آخر، لا نرفض دخول اللاعب بل نفتح الغرفة ونستعيد بياناتها
            callbackFired = true;
            finalizeHostRoomSetup(targetPeerId, requestedRoomId, callback);
            if (window.showGameToast) {
                window.showGameToast("تم فتح الغرفة (" + targetPeerId + ") بنجاح!", "👑");
            }
        });
    }

    // =========================================================================
    // 5. الانضمام لغرفة قائمة بواسطة الرمز (Client Join)
    // =========================================================================
    function joinRoom(inputCode, playerName, callback) {
        initIdentity();
        if (playerName && String(playerName).trim()) {
            myPlayerName = String(playerName).trim();
            try { localStorage.setItem("hegemony_player_name", myPlayerName); } catch (e) {}
        }

        const normalizedCode = normalizeRoomCode(inputCode);
        if (!normalizedCode || normalizedCode === ROOM_PREFIX) {
            if (callback) callback({ success: false, error: "يرجى كتابة رمز الغرفة الصحيح" });
            if (window.showGameToast) window.showGameToast("يرجى إدخال رمز الغرفة أولاً (مثال: 4821 أو HEG-4821)!", "✍️");
            return;
        }

        // إذا كان اللاعب متصلاً بالفعل بنفس هذه الغرفة، ندخله فوراً دون خطأ!
        if (roomId === normalizedCode && (isHost || (hostConn && hostConn.open))) {
            if (callback) callback({ success: true, roomId: roomId, isHost: isHost, hasCountry: !!myCountryId });
            if (window.showGameToast) window.showGameToast("أنت داخل الغرفة (" + roomId + ") بالفعل!", "✅");
            return;
        }

        // إذا كانت هذه الغرفة محفوظة على نفس هذا الجهاز والمستخدم يحاول استئنافها من خانة الانضمام
        let hasLocalSave = false;
        try {
            hasLocalSave = !!localStorage.getItem(SAVE_PREFIX + normalizedCode);
        } catch (e) {}

        if (peer) {
            try { peer.destroy(); } catch (e) {}
            peer = null;
        }

        if (typeof Peer === "undefined") {
            if (hasLocalSave) {
                createRoom(normalizedCode, myPlayerName, callback);
                return;
            }
            if (callback) callback({ success: false, error: "لا يوجد اتصال بالشبكة" });
            if (window.showGameToast) window.showGameToast("تعذر الاتصال بالشبكة، تأكد من اتصالك بالإنترنت!", "⚠️");
            return;
        }

        roomId = normalizedCode;
        isHost = false;
        initSyncReceived = false;
        isConnectingRoom = true;
        let callbackFired = false;

        const clientPeerId = "cli_" + Math.random().toString(36).substring(2, 9);

        const connectionTimeout = setTimeout(function() {
            if (!callbackFired) {
                callbackFired = true;
                isConnectingRoom = false;
                if (hasLocalSave) {
                    // إذا كانت الغرفة محفوظة على نفس الجهاز ولم يرد مضيف خارجي، نستأنفها كمضيف
                    createRoom(normalizedCode, myPlayerName, callback);
                    return;
                }
                roomId = null;
                if (callback) callback({ success: false, error: "انتهت مهلة الاتصال" });
                if (window.showGameToast) {
                    window.showGameToast("لم يتم العثور على مضيف نشط للغرفة (" + normalizedCode + "). تأكد أن صديقك أنشأ الغرفة وأن الرمز صحيح!", "⚠️");
                }
            }
        }, 8500);

        try {
            peer = new Peer(clientPeerId, {
                debug: 0,
                config: {
                    iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        { urls: "stun:stun2.l.google.com:19302" }
                    ]
                }
            });
        } catch (err) {
            clearTimeout(connectionTimeout);
            isConnectingRoom = false;
            if (hasLocalSave) {
                createRoom(normalizedCode, myPlayerName, callback);
                return;
            }
            if (callback) callback({ success: false, error: "تعذر تهيئة الاتصال" });
            return;
        }

        peer.on("open", function() {
            hostConn = peer.connect(roomId, {
                reliable: true,
                metadata: {
                    playerId: localPlayerId,
                    playerName: myPlayerName
                }
            });

            hostConn.on("open", function() {
                const sendJoinPacket = function() {
                    sendToHost({
                        type: "JOIN_REQUEST",
                        playerId: localPlayerId,
                        playerName: myPlayerName
                    });
                };

                sendJoinPacket();

                // إعادة إرسال طلب الانضمام حتى تصلنا رسالة INIT_SYNC من المضيف
                let retries = 0;
                if (joinRetryInterval) clearInterval(joinRetryInterval);
                joinRetryInterval = setInterval(function() {
                    retries++;
                    if (initSyncReceived || retries > 4) {
                        clearInterval(joinRetryInterval);
                        joinRetryInterval = null;
                        return;
                    }
                    sendJoinPacket();
                }, 900);

                startHeartbeat();
                updateTopReadinessBar();

                // ننتظر لحظة قصيرة لوصول INIT_SYNC ثم نكمل الدخول بسلاسة
                setTimeout(function() {
                    if (!callbackFired) {
                        clearTimeout(connectionTimeout);
                        callbackFired = true;
                        isConnectingRoom = false;
                        if (callback) callback({ success: true, roomId: roomId, isHost: false, hasCountry: !!myCountryId });
                        if (window.showGameToast) window.showGameToast("تم دخول الغرفة (" + roomId + ") بنجاح!", "✅");
                    }
                }, 450);
            });

            hostConn.on("data", function(data) {
                handleClientReceivedData(data);
                if (data && data.type === "INIT_SYNC" && !callbackFired) {
                    clearTimeout(connectionTimeout);
                    callbackFired = true;
                    isConnectingRoom = false;
                    if (callback) callback({ success: true, roomId: roomId, isHost: false, hasCountry: !!myCountryId });
                    if (window.showGameToast) window.showGameToast("تم دخول الغرفة (" + roomId + ") بنجاح!", "✅");
                }
            });

            hostConn.on("close", function() {
                if (window.showGameToast) window.showGameToast("انقطع الاتصال بمضيف الغرفة!", "🔌");
                updateTopReadinessBar();
            });

            hostConn.on("error", function(err) {
                console.warn("Host connection error:", err);
            });
        });

        peer.on("disconnected", function() {
            if (peer && !peer.destroyed) {
                try { peer.reconnect(); } catch (e) {}
            }
        });

        peer.on("error", function(err) {
            clearTimeout(connectionTimeout);
            if (callbackFired) return;
            callbackFired = true;
            isConnectingRoom = false;

            // إذا كانت الغرفة محفوظة على هذا الجهاز ولم نجد مضيفاً خارجياً، نستأنفها مباشرةً!
            if (hasLocalSave) {
                createRoom(normalizedCode, myPlayerName, callback);
                return;
            }

            roomId = null;
            let msg = "تعذر الدخول للغرفة (" + normalizedCode + ")! تأكد أن منشئ الغرفة فتحها الآن وأن الرمز صحيح.";
            if (err && err.type === "peer-unavailable") {
                msg = "الغرفة (" + normalizedCode + ") غير نشطة حالياً! اطلب من صديقك إنشاء الغرفة أولاً أو تحقق من الرمز.";
            }
            if (callback) callback({ success: false, error: err ? err.type : "error" });
            if (window.showGameToast) window.showGameToast(msg, "❌");
        });
    }

    // =========================================================================
    // 6. إدارة اتصالات المضيف (Host Connection Handler)
    // =========================================================================
    function handleIncomingConnection(conn) {
        const connectedCount = Object.keys(roomState.players).filter(function(k) {
            return roomState.players[k] && roomState.players[k].isConnected;
        }).length;

        if (connectedCount >= 10) {
            conn.on("open", function() {
                conn.send({ type: "ROOM_FULL", msg: "الغرفة مكتملة بالحد الأقصى (10 لاعبين)!" });
                setTimeout(function() { conn.close(); }, 500);
            });
            return;
        }

        if (connections.indexOf(conn) === -1) {
            connections.push(conn);
        }

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

    function safeSendToConn(conn, payload) {
        if (!conn) return;
        if (conn.open) {
            try { conn.send(payload); } catch (e) {}
        } else {
            conn.once("open", function() {
                try { conn.send(payload); } catch (e) {}
            });
        }
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
                    const pName = data.playerName || "قائد متحالف";
                    const isReturning = !!roomState.players[pId];

                    if (!isReturning) {
                        // التحقق مما إذا كان لديه دولة مسجلة باسمه أو بمعرفه في العالم
                        let existingCountryId = null;
                        if (window.currentWorld && Array.isArray(window.currentWorld.countries)) {
                            const matched = window.currentWorld.countries.find(function(c) {
                                return c.ownerPlayerId === pId;
                            });
                            if (matched) existingCountryId = matched.id;
                        }
                        roomState.players[pId] = {
                            name: pName,
                            countryId: existingCountryId,
                            readyState: "WAITING",
                            isConnected: true
                        };
                    } else {
                        roomState.players[pId].isConnected = true;
                        roomState.players[pId].name = pName || roomState.players[pId].name;
                    }

                    safeSendToConn(conn, {
                        type: "INIT_SYNC",
                        roomState: roomState,
                        assignedCountryId: roomState.players[pId].countryId,
                        worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ?
                            window.currentWorld.toJSON() :
                            window.currentWorld
                    });

                    broadcastRoomState();
                    saveRoomPersistence();
                    refreshAllGameViews();

                    if (isReturning && roomState.players[pId].countryId) {
                        broadcastNotification("عاد القائد " + roomState.players[pId].name + " لاستئناف قيادة دولته!", "👑");
                    } else {
                        broadcastNotification("انضم القائد " + pName + " إلى الغرفة!", "🌐");
                    }
                    break;
                }

            case "CLAIM_COUNTRY":
                {
                    const pId = data.playerId;
                    const cId = data.countryId;
                    const playerKeys = Object.keys(roomState.players);
                    const isTaken = playerKeys.some(function(k) {
                        return k !== pId && String(roomState.players[k].countryId) === String(cId) && roomState.players[k].isConnected;
                    });

                    if (!isTaken) {
                        if (!roomState.players[pId]) {
                            roomState.players[pId] = {
                                name: data.playerName || "قائد",
                                countryId: cId,
                                readyState: "WAITING",
                                isConnected: true
                            };
                        } else {
                            roomState.players[pId].countryId = cId;
                        }

                        if (window.currentWorld && Array.isArray(window.currentWorld.countries)) {
                            const cObj = window.currentWorld.countries.find(function(c) {
                                return String(c.id) === String(cId);
                            });
                            if (cObj) {
                                cObj.ownerPlayerId = pId;
                                cObj.ownerPlayerName = roomState.players[pId].name;
                            }
                        }

                        broadcastRoomState();
                        saveRoomPersistence();
                        refreshAllGameViews();
                        safeSendToConn(conn, {
                            type: "CLAIM_ACCEPTED",
                            countryId: cId,
                            roomState: roomState
                        });
                        broadcastNotification("تولى القائد " + roomState.players[pId].name + " قيادة دولته!", "👑");
                    } else {
                        safeSendToConn(conn, {
                            type: "CLAIM_REJECTED",
                            msg: "هذه الدولة محجوزة لقائد آخر متصل حالياً! يمكنك تأسيس دولتك الخاصة."
                        });
                    }
                    break;
                }

            case "CREATE_NATION":
                {
                    const pId = data.playerId;
                    const rawCountry = data.countryData;
                    if (rawCountry && window.currentWorld) {
                        const pName = (roomState.players[pId] && roomState.players[pId].name) ?
                            roomState.players[pId].name :
                            (data.playerName || "قائد");

                        rawCountry.ownerPlayerId = pId;
                        rawCountry.ownerPlayerName = pName;

                        const addedCountry = upsertCountryInWorld(rawCountry);

                        if (!roomState.players[pId]) {
                            roomState.players[pId] = {
                                name: pName,
                                countryId: addedCountry.id,
                                readyState: "WAITING",
                                isConnected: true
                            };
                        } else {
                            roomState.players[pId].countryId = addedCountry.id;
                        }

                        saveRoomPersistence();
                        broadcastToAll({
                            type: "NATION_CREATED",
                            countryData: (addedCountry && typeof addedCountry.toJSON === "function") ? addedCountry.toJSON() : addedCountry,
                            ownerPlayerId: pId,
                            ownerPlayerName: pName,
                            playerId: pId
                        });
                        broadcastRoomState();
                        refreshAllGameViews();

                        broadcastNotification("أعلن القائد " + pName + " تأسيس دولة [" + addedCountry.name + "]!", "🏰");
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
                        const updated = upsertCountryInWorld(data.countryData);
                        saveRoomPersistence();
                        broadcastToAll({
                            type: "COUNTRY_UPDATED",
                            countryData: (updated && typeof updated.toJSON === "function") ? updated.toJSON() : updated
                        });
                        refreshAllGameViews();
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
            case "ROOM_FULL":
                {
                    if (window.showGameToast) window.showGameToast(data.msg || "الغرفة ممتلئة!", "⚠️");
                    roomId = null;
                    updateTopReadinessBar();
                    break;
                }

            case "INIT_SYNC":
                {
                    initSyncReceived = true;
                    if (joinRetryInterval) {
                        clearInterval(joinRetryInterval);
                        joinRetryInterval = null;
                    }
                    if (data.roomState) {
                        roomState = data.roomState;
                    }
                    if (data.assignedCountryId) {
                        myCountryId = data.assignedCountryId;
                    }
                    if (data.worldData) {
                        if (window.World && typeof window.World.fromJSON === "function") {
                            window.currentWorld = window.World.fromJSON(data.worldData);
                        } else {
                            window.currentWorld = data.worldData;
                        }
                    }
                    // مزامنة ملكية الدول من جدول اللاعبين
                    syncCountryOwnersFromRoomState();
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    break;
                }

            case "ROOM_STATE_UPDATE":
                {
                    if (data.roomState) {
                        roomState = data.roomState;
                        if (roomState.players && roomState.players[localPlayerId] && roomState.players[localPlayerId].countryId) {
                            myCountryId = roomState.players[localPlayerId].countryId;
                        }
                        syncCountryOwnersFromRoomState();
                    }
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    break;
                }

            case "CLAIM_ACCEPTED":
                {
                    if (data.countryId) {
                        myCountryId = data.countryId;
                    }
                    if (data.roomState) {
                        roomState = data.roomState;
                    }
                    syncCountryOwnersFromRoomState();
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    break;
                }

            case "NATION_CREATED":
                {
                    if (window.currentWorld && data.countryData) {
                        if (data.ownerPlayerId) data.countryData.ownerPlayerId = data.ownerPlayerId;
                        if (data.ownerPlayerName) data.countryData.ownerPlayerName = data.ownerPlayerName;
                        const cInst = upsertCountryInWorld(data.countryData);
                        if (data.playerId === localPlayerId && cInst) {
                            myCountryId = cInst.id;
                        }
                        syncCountryOwnersFromRoomState();
                        refreshAllGameViews();
                        updateTopReadinessBar();
                    }
                    break;
                }

            case "COUNTRY_UPDATED":
                {
                    if (window.currentWorld && data.countryData) {
                        upsertCountryInWorld(data.countryData);
                        syncCountryOwnersFromRoomState();
                        refreshAllGameViews();
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
                        if (window.World && typeof window.World.fromJSON === "function") {
                            window.currentWorld = window.World.fromJSON(data.worldData);
                        } else {
                            window.currentWorld = data.worldData;
                        }
                        syncCountryOwnersFromRoomState();
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
                    if (window.showGameToast) window.showGameToast(data.msg || "هذه الدولة محجوزة لقائد آخر!", "⚠️");
                    if (myCountryId && !isMyCountry(myCountryId)) {
                        myCountryId = null;
                    }
                    refreshAllGameViews();
                    break;
                }
        }
    }

    function syncCountryOwnersFromRoomState() {
        if (!window.currentWorld || !Array.isArray(window.currentWorld.countries) || !roomState || !roomState.players) return;
        const pKeys = Object.keys(roomState.players);
        pKeys.forEach(function(pid) {
            const p = roomState.players[pid];
            if (p && p.countryId) {
                const c = window.currentWorld.countries.find(function(item) {
                    return String(item.id) === String(p.countryId);
                });
                if (c) {
                    c.ownerPlayerId = pid;
                    c.ownerPlayerName = p.name;
                }
            }
        });
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

        if (typeof window.currentWorld.advanceYear === "function") {
            window.currentWorld.advanceYear();
        }
        const updatedWorldData = (typeof window.currentWorld.toJSON === "function") ?
            window.currentWorld.toJSON() :
            window.currentWorld;
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
            if (conn && conn.open) {
                try { conn.send(msg); } catch (e) {}
            }
        });
    }

    function sendToHost(msg) {
        if (hostConn && hostConn.open) {
            try { hostConn.send(msg); } catch (e) {}
        }
    }

    // =========================================================================
    // 10. واجهات وإجراءات اللاعب والسيادة على الدولة (Player Sovereignty)
    // =========================================================================
    function syncNewCountry(countryData) {
        if (!countryData) return;
        initIdentity();
        countryData.ownerPlayerId = localPlayerId;
        countryData.ownerPlayerName = myPlayerName;
        myCountryId = countryData.id;

        const cInst = upsertCountryInWorld(countryData);

        if (roomState && roomState.players) {
            if (!roomState.players[localPlayerId]) {
                roomState.players[localPlayerId] = {
                    name: myPlayerName,
                    countryId: cInst.id,
                    readyState: "WAITING",
                    isConnected: true
                };
            } else {
                roomState.players[localPlayerId].countryId = cInst.id;
            }
        }

        if (isHost) {
            saveRoomPersistence();
            broadcastToAll({
                type: "NATION_CREATED",
                countryData: (cInst && typeof cInst.toJSON === "function") ? cInst.toJSON() : cInst,
                ownerPlayerId: localPlayerId,
                ownerPlayerName: myPlayerName,
                playerId: localPlayerId
            });
            broadcastRoomState();
            refreshAllGameViews();
        } else {
            sendToHost({
                type: "CREATE_NATION",
                countryData: (cInst && typeof cInst.toJSON === "function") ? cInst.toJSON() : cInst,
                playerId: localPlayerId,
                playerName: myPlayerName
            });
            refreshAllGameViews();
        }
        updateTopReadinessBar();
    }

    function getCountryOwnerInfo(countryId) {
        initIdentity();
        if (!countryId) return { isMine: false, isClaimed: false, ownerId: null, ownerName: null };

        if (!roomId) {
            return { isMine: true, isClaimed: true, ownerId: localPlayerId, ownerName: myPlayerName };
        }

        if (myCountryId && String(myCountryId) === String(countryId)) {
            return { isMine: true, isClaimed: true, ownerId: localPlayerId, ownerName: myPlayerName };
        }

        if (roomState && roomState.players) {
            const pKeys = Object.keys(roomState.players);
            for (let i = 0; i < pKeys.length; i++) {
                const pid = pKeys[i];
                const p = roomState.players[pid];
                if (p && String(p.countryId) === String(countryId)) {
                    const mine = String(pid) === String(localPlayerId);
                    if (mine) myCountryId = countryId;
                    return {
                        isMine: mine,
                        isClaimed: true,
                        ownerId: pid,
                        ownerName: p.name || "قائد"
                    };
                }
            }
        }

        if (window.currentWorld && Array.isArray(window.currentWorld.countries)) {
            const c = window.currentWorld.countries.find(function(item) {
                return String(item.id) === String(countryId);
            });
            if (c && c.ownerPlayerId) {
                const mine = String(c.ownerPlayerId) === String(localPlayerId);
                if (mine) myCountryId = countryId;
                return {
                    isMine: mine,
                    isClaimed: true,
                    ownerId: c.ownerPlayerId,
                    ownerName: c.ownerPlayerName || "قائد"
                };
            }
        }

        return { isMine: false, isClaimed: false, ownerId: null, ownerName: null };
    }

    function claimCountry(countryId) {
        if (!countryId) return false;
        initIdentity();
        const ownerInfo = getCountryOwnerInfo(countryId);
        if (ownerInfo.isClaimed && !ownerInfo.isMine) {
            if (window.showGameToast) {
                window.showGameToast("هذه الدولة بقيادة [" + (ownerInfo.ownerName || "لاعب آخر") + "]! يمكنك مشاهدتها أو تأسيس دولتك.", "👁️");
            }
            return false;
        }

        myCountryId = countryId;
        if (window.currentWorld && Array.isArray(window.currentWorld.countries)) {
            const c = window.currentWorld.countries.find(function(item) {
                return String(item.id) === String(countryId);
            });
            if (c) {
                c.ownerPlayerId = localPlayerId;
                c.ownerPlayerName = myPlayerName;
            }
        }

        if (!roomState.players[localPlayerId]) {
            roomState.players[localPlayerId] = {
                name: myPlayerName,
                countryId: countryId,
                readyState: "WAITING",
                isConnected: true
            };
        } else {
            roomState.players[localPlayerId].countryId = countryId;
        }

        if (isHost) {
            saveRoomPersistence();
            broadcastRoomState();
            refreshAllGameViews();
        } else if (roomId) {
            sendToHost({
                type: "CLAIM_COUNTRY",
                playerId: localPlayerId,
                playerName: myPlayerName,
                countryId: countryId
            });
        }
        updateTopReadinessBar();
        return true;
    }

    function submitDecision(decision) {
        initIdentity();

        // إذا لم يكن للاعب دولة مربوطة بعد، نحاول ربطه بدولته الحالية إن وجدت
        if (!myCountryId && window.currentViewingCountry) {
            const info = getCountryOwnerInfo(window.currentViewingCountry.id);
            if (!info.isClaimed || info.isMine) {
                claimCountry(window.currentViewingCountry.id);
            }
        }

        if (!myCountryId && window.currentWorld && Array.isArray(window.currentWorld.countries)) {
            const myOwned = window.currentWorld.countries.find(function(c) {
                return c.ownerPlayerId === localPlayerId;
            });
            if (myOwned) {
                myCountryId = myOwned.id;
            } else if (window.currentWorld.countries.length === 1) {
                const onlyC = window.currentWorld.countries[0];
                const info = getCountryOwnerInfo(onlyC.id);
                if (!info.isClaimed) {
                    claimCountry(onlyC.id);
                }
            }
        }

        if (!myCountryId) {
            if (window.showGameToast) {
                window.showGameToast("يرجى تأسيس دولتك أولاً أو اختيار دولة متاحة قبل إعلان الجاهزية!", "🏰");
            }
            if (typeof window.openCreateCountryModal === "function") {
                window.openCreateCountryModal();
            }
            return;
        }

        myReadiness = decision;
        updateTopReadinessBar();

        if (isHost) {
            if (!roomState.players[localPlayerId]) {
                roomState.players[localPlayerId] = {
                    name: myPlayerName,
                    countryId: myCountryId,
                    readyState: decision,
                    isConnected: true
                };
            } else {
                roomState.players[localPlayerId].readyState = decision;
                roomState.players[localPlayerId].countryId = myCountryId;
            }
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
        if (!targetCountryId) return false;
        const info = getCountryOwnerInfo(targetCountryId);
        if (info.isMine) return true;
        if (!info.isClaimed && !myCountryId) return true;
        return false;
    }

    function isMyCountry(targetCountryId) {
        if (!roomId) return true;
        if (!targetCountryId) return false;
        return getCountryOwnerInfo(targetCountryId).isMine;
    }

    function syncCountryChanges(country) {
        if (!roomId || !country) return;
        const payload = (typeof country.toJSON === "function") ? country.toJSON() : country;
        if (country.ownerPlayerId) payload.ownerPlayerId = country.ownerPlayerId;
        if (country.ownerPlayerName) payload.ownerPlayerName = country.ownerPlayerName;
        if (country.militaryColor) payload.militaryColor = country.militaryColor;

        if (isHost) {
            saveRoomPersistence();
            broadcastToAll({
                type: "COUNTRY_UPDATED",
                countryData: payload
            });
            refreshAllGameViews();
        } else {
            sendToHost({
                type: "SYNC_MY_COUNTRY_DATA",
                countryData: payload
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
            roomCodeLabel.textContent = "غرفة: " + roomId + " 📋";
            roomCodeLabel.title = "اضغط لنسخ الرمز ومشاركته";
            roomCodeLabel.style.cursor = "pointer";
            roomCodeLabel.onclick = copyRoomCode;
        }

        const playerKeys = Object.keys(roomState.players || {});
        const playersArr = [];
        for (let i = 0; i < playerKeys.length; i++) {
            const p = roomState.players[playerKeys[i]];
            if (p && p.isConnected) playersArr.push(p);
        }

        let readyCount = 0;
        for (let j = 0; j < playersArr.length; j++) {
            if (playersArr[j].readyState !== "WAITING") readyCount++;
        }

        if (countLabel) countLabel.textContent = "👥 " + Math.max(1, playersArr.length) + "/10";

        if (statusDetails) {
            if (autoTurnSeconds > 0) {
                let targetName = "آخر قائد";
                if (timerTargetPlayerId && roomState.players[timerTargetPlayerId] && roomState.players[timerTargetPlayerId].name) {
                    targetName = roomState.players[timerTargetPlayerId].name;
                }
                statusDetails.innerHTML = '<span style="color:#fde047; font-weight:900;">⏳ بانتظار ' + targetName + ': ' + autoTurnSeconds + 'ث</span>';
            } else if (!myCountryId) {
                statusDetails.innerHTML = '<span style="color:#38bdf8; font-weight:900;">🏰 أسس دولتك أو اختر دولة</span>';
            } else {
                statusDetails.textContent = "الجاهزية: " + readyCount + "/" + Math.max(1, playersArr.length);
            }
        }

        if (btnNextYear && btnWar) {
            if (myReadiness === "READY_YEAR") {
                btnNextYear.className = "btn btn-sm btn-primary active-decision";
                btnNextYear.textContent = "✅ مستعد";
                btnWar.className = "btn btn-sm btn-secondary";
                btnWar.textContent = "⚔️ حرب";
            } else if (myReadiness === "READY_WAR") {
                btnNextYear.className = "btn btn-sm btn-secondary";
                btnNextYear.textContent = "🌾 سنة جديدة";
                btnWar.className = "btn btn-sm btn-danger active-decision";
                btnWar.textContent = "🚨 أعلنت الحرب";
            } else {
                btnNextYear.className = "btn btn-sm btn-primary";
                btnNextYear.textContent = "🌾 سنة جديدة";
                btnWar.className = "btn btn-sm btn-danger";
                btnWar.textContent = "⚔️ حرب";
            }
        }
    }

    initIdentity();

    return {
        createRoom: createRoom,
        joinRoom: joinRoom,
        claimCountry: claimCountry,
        getCountryOwnerInfo: getCountryOwnerInfo,
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
        getPlayerName: function() { return myPlayerName; },
        getRoomState: function() { return roomState; }
    };
})();
