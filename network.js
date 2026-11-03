/**
 * ============================================================================
 * network.js - محرك الروم السحابي الموحد بالأرقام ومزامنة الاقتصاد والحروب والدردشة (v6.6)
 * ============================================================================
 *
 * الإصلاحات الجوهرية في (v6.6):
 * 1. إصلاح شامل لمشكلة الأموال وتحديثها بعد دورة أو دورتين سنوية عبر:
 *    - منع الكتابة فوق السنة المالية المتقدمة بلقطات (Retained Snapshots) قديمة.
 *    - مزامنة شاملة لخزينة البنك الدولي، القروض السيادية، عقود التجارة، والجزية.
 *    - اختيار منسق وحيد (Deterministic Turn Coordinator) لتنفيذ تدوير السنة المالية
 *      ثم بث النتيجة الموحدة لجميع اللاعبين في الروم لمنع تضارب أو تصفير الأرصدة.
 * 2. دعم كامل للمحادثات النصية المباشرة بين اللاعبين في الروم الواحد (CHAT_MESSAGE).
 * 3. دمج معلومات الروم والجاهزية في الشريط العلوي الموحد لكل شاشة دون تكرار الشريط العلوي.
 */

window.NetworkEngine = (function() {
    let mqttClient = null;
    let bcChannel = null;
    let roomId = null; // دائماً رقم صافٍ فقط مثل "1000" أو "4821"
    let localPlayerId = null;
    let myCountryId = null;
    let myPlayerName = "قائد سيادي";
    let myReadiness = "WAITING"; // 'WAITING' | 'READY_YEAR' | 'READY_WAR'
    let isConnectedToCloud = false;
    let currentBrokerIdx = 0;

    let autoTurnTimer = null;
    let autoTurnSeconds = 60;
    let timerTargetPlayerId = null;
    let lastProcessedYearAdvance = 0;

    let roomState = {
        roomId: null,
        hostId: null,
        players: {}, // playerId -> { name, countryId, readyState, isConnected, lastSeen }
        turnStatus: "PLANNING",
        lastUpdate: Date.now()
    };

    const SAVE_PREFIX = "hegemony_num_room_save_";
    const TOPIC_PREFIX = "hegemony_game_v6_room_";

    const CLOUD_BROKERS = [
        "wss://broker.emqx.io:8084/mqtt",
        "wss://broker.hivemq.com:8884/mqtt",
        "wss://test.mosquitto.org:8081/mqtt"
    ];

    function normalizeRoomCode(input) {
        if (input === null || input === undefined) return "";
        const arabicNums = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
        const easternNums = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
        let str = String(input);

        for (let i = 0; i < 10; i++) {
            str = str.replace(new RegExp(arabicNums[i], "g"), String(i));
            str = str.replace(new RegExp(easternNums[i], "g"), String(i));
        }

        const digitsOnly = str.replace(/[^0-9]/g, "");
        return digitsOnly.substring(0, 8);
    }

    function generateRoomCode() {
        return String(Math.floor(1000 + Math.random() * 9000));
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

        // ضمان إعادة احتساب عوائد المنشآت والميزانية والقطاعات والمؤشرات بدقة
        if (window.BuildingsEngine && typeof window.BuildingsEngine.calculateTotalRevenue === "function") {
            inst.sectorRevenues = window.BuildingsEngine.calculateTotalRevenue(inst);
            inst.budget = inst.sectorRevenues;
        }
        if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
            window.MilitaryEngine.syncCountryWithMilitary(inst);
        } else if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
            window.MilitaryEngine.refreshMilitaryStats(inst);
        }
        return inst;
    }

    function upsertCountryInWorld(rawCountry, allowOverwriteMyCountry = true) {
        if (!rawCountry || !window.currentWorld) return null;
        const incomingYear = Number(rawCountry.year || 1);
        const currentWorldYear = Number(window.currentWorld.year || 1);

        // تجاهل بيانات الدولة إذا كانت من سنة مالية أقدم من سنة العالم الحالية لمنع إرجاع الأموال للخلف
        if (incomingYear < currentWorldYear) {
            return window.currentWorld.countries.find(function(c) {
                return String(c.id) === String(rawCountry.id);
            }) || null;
        }

        const isMine = myCountryId && String(rawCountry.id) === String(myCountryId);
        if (isMine && !allowOverwriteMyCountry && incomingYear === currentWorldYear) {
            return window.currentWorld.countries.find(function(c) {
                return String(c.id) === String(rawCountry.id);
            }) || null;
        }

        const countryInst = ensureCountryInstance(rawCountry);
        countryInst.year = Math.max(incomingYear, currentWorldYear);

        if (!Array.isArray(window.currentWorld.countries)) {
            window.currentWorld.countries = [];
        }
        const idx = window.currentWorld.countries.findIndex(function(c) {
            return String(c.id) === String(countryInst.id);
        });
        if (idx >= 0) {
            const existing = window.currentWorld.countries[idx];
            Object.assign(existing, countryInst);
            if (window.BuildingsEngine && typeof window.BuildingsEngine.calculateTotalRevenue === "function") {
                existing.sectorRevenues = window.BuildingsEngine.calculateTotalRevenue(existing);
                existing.budget = existing.sectorRevenues;
            }
            if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
                window.MilitaryEngine.syncCountryWithMilitary(existing);
            }
            return existing;
        } else {
            window.currentWorld.countries.push(countryInst);
            return countryInst;
        }
    }

    function mergeWorldDataFromCloud(incomingWorldData, forceReplaceAll = false) {
        if (!incomingWorldData) return;
        if (!window.currentWorld && window.World) {
            window.currentWorld = new window.World();
        }
        if (!window.currentWorld) return;

        const incomingYear = Number(incomingWorldData.year || 1);
        const localYear = Number(window.currentWorld.year || 1);

        // حماية حاسمة: إذا كانت اللقطة الواردة من سنة مالية أقدم من سنتنا الحالية، نتجاهل بياناتها المالية
        // ونحتفظ فقط بدمج أي رسائل دردشة لم تكن لدينا
        if (incomingYear < localYear && !forceReplaceAll) {
            if (Array.isArray(incomingWorldData.chatMessages)) {
                incomingWorldData.chatMessages.forEach(function(m) {
                    if (typeof window.currentWorld.addChatMessage === "function") {
                        window.currentWorld.addChatMessage(m);
                    }
                });
            }
            return;
        }

        const isNewerYear = incomingYear > localYear;
        if (isNewerYear || forceReplaceAll) {
            window.currentWorld.year = incomingYear;
        }

        if (incomingWorldData.worldBankTreasury !== undefined) {
            if (isNewerYear || forceReplaceAll || Number(incomingWorldData.worldBankTreasury) !== Number(window.currentWorld.worldBankTreasury || 0)) {
                window.currentWorld.worldBankTreasury = Number(incomingWorldData.worldBankTreasury);
            }
        }

        if (Array.isArray(incomingWorldData.tradeDeals)) {
            window.currentWorld.tradeDeals = incomingWorldData.tradeDeals;
        }

        if (Array.isArray(incomingWorldData.tributes)) {
            window.currentWorld.tributes = incomingWorldData.tributes;
        }

        if (Array.isArray(incomingWorldData.sovereignLoans)) {
            window.currentWorld.sovereignLoans = incomingWorldData.sovereignLoans;
        }

        if (Array.isArray(incomingWorldData.chatMessages)) {
            if (!Array.isArray(window.currentWorld.chatMessages)) {
                window.currentWorld.chatMessages = [];
            }
            incomingWorldData.chatMessages.forEach(function(msg) {
                if (typeof window.currentWorld.addChatMessage === "function") {
                    window.currentWorld.addChatMessage(msg);
                } else if (!window.currentWorld.chatMessages.some(function(x) { return x.id === msg.id; })) {
                    window.currentWorld.chatMessages.push(msg);
                }
            });
        }

        if (Array.isArray(incomingWorldData.countries)) {
            incomingWorldData.countries.forEach(function(rawC) {
                rawC.year = Math.max(Number(rawC.year || 1), window.currentWorld.year);
                // نسمح باستبدال بيانات دولتي فقط إذا كانت الحزمة من تدوير سنة جديدة أو فرض شامل
                upsertCountryInWorld(rawC, isNewerYear || forceReplaceAll);
            });
        }

        if (window.TradeManager && typeof window.TradeManager.recalculateCountriesTrade === "function") {
            window.TradeManager.recalculateCountriesTrade(window.currentWorld);
        }
    }

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
        } catch (e) {}
    }

    function loadRoomPersistence(targetRoomId) {
        if (!targetRoomId) return false;
        try {
            const cleanId = normalizeRoomCode(targetRoomId);
            const savedRaw = localStorage.getItem(SAVE_PREFIX + cleanId) ||
                localStorage.getItem("hegemony_room_save_HEG-" + cleanId);
            if (!savedRaw) return false;

            const saved = JSON.parse(savedRaw);
            if (saved && saved.worldData) {
                mergeWorldDataFromCloud(saved.worldData, true);
                if (saved.players) {
                    roomState.players = Object.assign({}, saved.players, roomState.players);
                }
                return true;
            }
        } catch (e) {}
        return false;
    }

    function refreshAllGameViews() {
        try {
            if (window.currentWorld && Array.isArray(window.currentWorld.countries)) {
                if (myCountryId) {
                    const mine = window.currentWorld.countries.find(function(c) {
                        return String(c.id) === String(myCountryId);
                    });
                    if (mine && (!window.currentViewingCountry || String(window.currentViewingCountry.id) === String(mine.id))) {
                        window.currentViewingCountry = mine;
                    }
                }
            }

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
                window.ChronicleManager.render(window.currentWorld, true);
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
            if (window.MilitaryView && window.MilitaryView.country && window.currentWorld) {
                const milScreen = document.getElementById("military-screen");
                if (milScreen && milScreen.classList.contains("active")) {
                    const refreshedMil = window.currentWorld.countries.find(function(c) {
                        return String(c.id) === String(window.MilitaryView.country.id);
                    });
                    if (refreshedMil) {
                        window.MilitaryView.render(refreshedMil);
                    }
                }
            }
            if (window.CapitalView && typeof window.CapitalView.refreshHUDAndMap === "function") {
                const capScreen = document.getElementById("capital-screen");
                if (capScreen && capScreen.classList.contains("active")) {
                    if (window.currentViewingCountry && window.currentWorld) {
                        const updatedCapCountry = window.currentWorld.countries.find(function(c) {
                            return String(c.id) === String(window.currentViewingCountry.id);
                        });
                        if (updatedCapCountry && typeof window.CapitalView.setCurrentCountry === "function") {
                            window.CapitalView.setCurrentCountry(updatedCapCountry);
                        }
                    }
                    window.CapitalView.refreshHUDAndMap();
                }
            }
            updateTopReadinessBar();
        } catch (err) {
            console.error("خطأ أثناء تحديث واجهات التابات التفاعلية:", err);
        }
    }

    function getRoomEventsTopic(rId) {
        return TOPIC_PREFIX + rId + "/events";
    }

    function getRoomRetainedStateTopic(rId) {
        return TOPIC_PREFIX + rId + "/snapshot";
    }

    function publishMessage(packet, retainSnapshot) {
        if (!roomId || !packet) return;
        packet.senderId = localPlayerId;
        packet.roomId = roomId;
        packet.ts = Date.now();

        const jsonStr = JSON.stringify(packet);

        if (bcChannel) {
            try { bcChannel.postMessage(packet); } catch (e) {}
        }

        if (mqttClient && mqttClient.connected) {
            try {
                mqttClient.publish(getRoomEventsTopic(roomId), jsonStr, { qos: 0, retain: false });
                if (retainSnapshot) {
                    const snapshotPacket = {
                        type: "CLOUD_SNAPSHOT",
                        senderId: localPlayerId,
                        roomId: roomId,
                        roomState: roomState,
                        worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ?
                            window.currentWorld.toJSON() :
                            window.currentWorld,
                        ts: Date.now()
                    };
                    mqttClient.publish(
                        getRoomRetainedStateTopic(roomId),
                        JSON.stringify(snapshotPacket),
                        { qos: 0, retain: true }
                    );
                }
            } catch (e) {}
        }
    }

    function connectToUnifiedRoom(numericCode, playerName, callback) {
        initIdentity();

        if (playerName && String(playerName).trim()) {
            myPlayerName = String(playerName).trim();
            try { localStorage.setItem("hegemony_player_name", myPlayerName); } catch (e) {}
        }

        let cleanNumber = normalizeRoomCode(numericCode);
        if (!cleanNumber) {
            cleanNumber = generateRoomCode();
        }

        roomId = cleanNumber;
        roomState.roomId = roomId;
        if (!roomState.hostId) {
            roomState.hostId = localPlayerId;
        }

        loadRoomPersistence(roomId);

        if (!roomState.players[localPlayerId]) {
            roomState.players[localPlayerId] = {
                name: myPlayerName,
                countryId: myCountryId || null,
                readyState: "WAITING",
                isConnected: true,
                lastSeen: Date.now()
            };
        } else {
            roomState.players[localPlayerId].name = myPlayerName;
            roomState.players[localPlayerId].isConnected = true;
            roomState.players[localPlayerId].lastSeen = Date.now();
            if (roomState.players[localPlayerId].countryId) {
                myCountryId = roomState.players[localPlayerId].countryId;
            }
        }

        const countries = (window.currentWorld && Array.isArray(window.currentWorld.countries)) ? window.currentWorld.countries : [];
        if (!myCountryId && countries.length > 0) {
            const myOwned = countries.find(function(c) { return c.ownerPlayerId === localPlayerId; }) ||
                (countries.length === 1 && !countries[0].ownerPlayerId ? countries[0] : null);
            if (myOwned) {
                myCountryId = myOwned.id;
                myOwned.ownerPlayerId = localPlayerId;
                myOwned.ownerPlayerName = myPlayerName;
                roomState.players[localPlayerId].countryId = myOwned.id;
            }
        }

        saveRoomPersistence();
        updateTopReadinessBar();
        refreshAllGameViews();

        if (bcChannel) {
            try { bcChannel.close(); } catch (e) {}
        }
        if (typeof BroadcastChannel !== "undefined") {
            try {
                bcChannel = new BroadcastChannel(TOPIC_PREFIX + roomId);
                bcChannel.onmessage = function(ev) {
                    if (ev && ev.data) {
                        handleIncomingPacket(ev.data);
                    }
                };
            } catch (e) {}
        }

        if (mqttClient) {
            try { mqttClient.end(true); } catch (e) {}
            mqttClient = null;
        }

        let callbackDone = false;
        function completeEntry() {
            if (callbackDone) return;
            callbackDone = true;
            updateTopReadinessBar();
            refreshAllGameViews();
            if (callback) {
                callback({
                    success: true,
                    roomId: roomId,
                    isHost: true,
                    hasCountry: !!myCountryId
                });
            }
        }

        const quickEntryTimer = setTimeout(completeEntry, 600);

        if (typeof window.mqtt !== "undefined" && typeof window.mqtt.connect === "function") {
            connectMqttBroker(0, function() {
                clearTimeout(quickEntryTimer);
                completeEntry();
            });
        } else {
            clearTimeout(quickEntryTimer);
            completeEntry();
        }

        if (window.showGameToast) {
            window.showGameToast("تم دخول الروم الموحد رقم (" + roomId + ") بنجاح!", "🌐");
        }
    }

    function connectMqttBroker(brokerIndex, onReadyCallback) {
        if (!roomId) return;
        currentBrokerIdx = brokerIndex % CLOUD_BROKERS.length;
        const brokerUrl = CLOUD_BROKERS[currentBrokerIdx];

        try {
            mqttClient = window.mqtt.connect(brokerUrl, {
                clientId: "heg_" + localPlayerId + "_" + Math.random().toString(36).substring(2, 6),
                clean: true,
                connectTimeout: 4500,
                reconnectPeriod: 4000
            });
        } catch (err) {
            if (brokerIndex + 1 < CLOUD_BROKERS.length) {
                connectMqttBroker(brokerIndex + 1, onReadyCallback);
            } else if (onReadyCallback) {
                onReadyCallback();
            }
            return;
        }

        let switchedBroker = false;
        const brokerFailTimer = setTimeout(function() {
            if (!isConnectedToCloud && !switchedBroker && brokerIndex + 1 < CLOUD_BROKERS.length) {
                switchedBroker = true;
                try { mqttClient.end(true); } catch (e) {}
                connectMqttBroker(brokerIndex + 1, onReadyCallback);
            }
        }, 4200);

        mqttClient.on("connect", function() {
            clearTimeout(brokerFailTimer);
            isConnectedToCloud = true;

            const eventsTopic = getRoomEventsTopic(roomId);
            const snapshotTopic = getRoomRetainedStateTopic(roomId);

            mqttClient.subscribe([eventsTopic, snapshotTopic], { qos: 0 }, function() {
                publishMessage({
                    type: "PLAYER_JOINED",
                    playerId: localPlayerId,
                    playerName: myPlayerName,
                    countryId: myCountryId || null,
                    myCountryData: getMyCountryObjectJSON()
                }, false);

                updateTopReadinessBar();
                if (onReadyCallback) onReadyCallback();
            });
        });

        mqttClient.on("message", function(topic, messageBuffer) {
            try {
                const str = messageBuffer.toString();
                if (!str) return;
                const data = JSON.parse(str);
                handleIncomingPacket(data);
            } catch (e) {}
        });

        mqttClient.on("error", function() {
            if (!isConnectedToCloud && !switchedBroker && brokerIndex + 1 < CLOUD_BROKERS.length) {
                clearTimeout(brokerFailTimer);
                switchedBroker = true;
                try { mqttClient.end(true); } catch (e) {}
                connectMqttBroker(brokerIndex + 1, onReadyCallback);
            }
        });

        mqttClient.on("offline", function() {
            isConnectedToCloud = false;
            updateTopReadinessBar();
        });
    }

    function getMyCountryObjectJSON() {
        if (!myCountryId || !window.currentWorld || !Array.isArray(window.currentWorld.countries)) return null;
        const c = window.currentWorld.countries.find(function(item) {
            return String(item.id) === String(myCountryId);
        });
        if (!c) return null;
        if (window.BuildingsEngine && typeof window.BuildingsEngine.calculateTotalRevenue === "function") {
            c.sectorRevenues = window.BuildingsEngine.calculateTotalRevenue(c);
            c.budget = c.sectorRevenues;
        }
        if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
            window.MilitaryEngine.syncCountryWithMilitary(c);
        }
        const json = (typeof c.toJSON === "function") ? c.toJSON() : Object.assign({}, c);
        json.ownerPlayerId = localPlayerId;
        json.ownerPlayerName = myPlayerName;
        if (c.militaryColor) json.militaryColor = c.militaryColor;
        return json;
    }

    // =========================================================================
    // 4. معالجة الرسائل المتزامنة في الروم الموحد (شاملة الاقتصاد، الحرب، والدردشة)
    // =========================================================================
    function handleIncomingPacket(data) {
        if (!data || !data.type) return;
        if (String(data.roomId) !== String(roomId)) return;

        if (data.type === "CLOUD_SNAPSHOT") {
            if (data.roomState && data.roomState.players) {
                Object.keys(data.roomState.players).forEach(function(pid) {
                    if (!roomState.players[pid] || pid !== localPlayerId) {
                        roomState.players[pid] = data.roomState.players[pid];
                    }
                });
            }
            if (data.worldData) {
                mergeWorldDataFromCloud(data.worldData, false);
            }
            syncCountryOwnersFromRoomState();
            saveRoomPersistence();
            updateTopReadinessBar();
            refreshAllGameViews();
            return;
        }

        if (data.senderId === localPlayerId) return;

        switch (data.type) {
            case "PLAYER_JOINED":
                {
                    const pId = data.playerId;
                    const pName = data.playerName || "قائد متحالف";
                    roomState.players[pId] = {
                        name: pName,
                        countryId: data.countryId || (roomState.players[pId] ? roomState.players[pId].countryId : null),
                        readyState: "WAITING",
                        isConnected: true,
                        lastSeen: Date.now()
                    };

                    if (data.myCountryData) {
                        upsertCountryInWorld(data.myCountryData, true);
                    }

                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    refreshAllGameViews();

                    publishMessage({
                        type: "WORLD_STATE_SYNC",
                        roomState: roomState,
                        worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ?
                            window.currentWorld.toJSON() :
                            window.currentWorld
                    }, true);

                    if (window.showGameToast) {
                        window.showGameToast("انضم القائد [" + pName + "] إلى الروم (" + roomId + ")!", "🌐");
                    }
                    break;
                }

            case "WORLD_STATE_SYNC":
                {
                    if (data.roomState && data.roomState.players) {
                        Object.keys(data.roomState.players).forEach(function(pid) {
                            if (pid !== localPlayerId) {
                                roomState.players[pid] = data.roomState.players[pid];
                            }
                        });
                    }
                    if (data.worldData) {
                        mergeWorldDataFromCloud(data.worldData, !!data.forceSync);
                    }
                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    break;
                }

            case "CHAT_MESSAGE":
                {
                    if (data.message && window.ChronicleManager && typeof window.ChronicleManager.onIncomingNetworkMessage === "function") {
                        window.ChronicleManager.onIncomingNetworkMessage(data.message);
                        saveRoomPersistence();
                    }
                    break;
                }

            case "NATION_CREATED":
                {
                    if (data.countryData) {
                        if (data.ownerPlayerId) data.countryData.ownerPlayerId = data.ownerPlayerId;
                        if (data.ownerPlayerName) data.countryData.ownerPlayerName = data.ownerPlayerName;
                        const added = upsertCountryInWorld(data.countryData, true);

                        if (data.ownerPlayerId && added) {
                            if (!roomState.players[data.ownerPlayerId]) {
                                roomState.players[data.ownerPlayerId] = {
                                    name: data.ownerPlayerName || "قائد",
                                    countryId: added.id,
                                    readyState: "WAITING",
                                    isConnected: true
                                };
                            } else {
                                roomState.players[data.ownerPlayerId].countryId = added.id;
                            }
                        }

                        syncCountryOwnersFromRoomState();
                        saveRoomPersistence();
                        updateTopReadinessBar();
                        refreshAllGameViews();

                        if (window.showGameToast && added) {
                            window.showGameToast("أسس القائد [" + (data.ownerPlayerName || "متحالف") + "] دولة [" + added.name + "]!", "🏰");
                        }
                    }
                    break;
                }

            case "CLAIM_COUNTRY":
                {
                    const pId = data.playerId;
                    const cId = data.countryId;
                    const pName = data.playerName || "قائد";

                    if (!roomState.players[pId]) {
                        roomState.players[pId] = {
                            name: pName,
                            countryId: cId,
                            readyState: "WAITING",
                            isConnected: true
                        };
                    } else {
                        roomState.players[pId].countryId = cId;
                        roomState.players[pId].name = pName;
                    }

                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    break;
                }

            case "COUNTRY_UPDATED":
                {
                    if (data.countryData) {
                        upsertCountryInWorld(data.countryData, true);
                        syncCountryOwnersFromRoomState();
                        saveRoomPersistence();
                        refreshAllGameViews();
                    }
                    break;
                }

            case "SUBMIT_READY":
                {
                    const pId = data.playerId;
                    if (data.countryData) {
                        upsertCountryInWorld(data.countryData, true);
                    }
                    if (pId && roomState.players[pId]) {
                        roomState.players[pId].readyState = data.decision;
                        if (data.countryId) roomState.players[pId].countryId = data.countryId;
                    } else if (pId) {
                        roomState.players[pId] = {
                            name: data.playerName || "قائد",
                            countryId: data.countryId || null,
                            readyState: data.decision,
                            isConnected: true
                        };
                    }
                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    checkAllPlayersReady(false);
                    break;
                }

            case "ADVANCE_YEAR_TRIGGER":
                {
                    if (data.worldData) {
                        const incomingYr = Number(data.worldData.year || 1);
                        const currentYr = Number((window.currentWorld && window.currentWorld.year) || 1);
                        if (incomingYr >= currentYr) {
                            lastProcessedYearAdvance = incomingYr;
                            if (window.World && typeof window.World.fromJSON === "function") {
                                const prevChats = (window.currentWorld && Array.isArray(window.currentWorld.chatMessages))
                                    ? window.currentWorld.chatMessages
                                    : [];
                                window.currentWorld = window.World.fromJSON(data.worldData);
                                prevChats.forEach(function(m) {
                                    window.currentWorld.addChatMessage(m);
                                });
                            } else {
                                mergeWorldDataFromCloud(data.worldData, true);
                            }
                        }
                    }
                    Object.keys(roomState.players).forEach(function(k) {
                        if (roomState.players[k]) roomState.players[k].readyState = "WAITING";
                    });
                    syncCountryOwnersFromRoomState();
                    myReadiness = "WAITING";
                    autoTurnSeconds = 0;
                    stopAutoTurnCountdown();
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    refreshAllGameViews();

                    if (window.GameSFX && typeof window.GameSFX.newYear === "function") window.GameSFX.newYear();
                    if (window.showGameToast) {
                        window.showGameToast("🌟 انطلقت السنة المالية " + ((window.currentWorld && window.currentWorld.year) || 1) + "م وتم إيداع العوائد لجميع اللاعبين!", "💰");
                    }
                    break;
                }

            case "WAR_TRIGGER":
                {
                    if (data.worldData) {
                        mergeWorldDataFromCloud(data.worldData, true);
                    }
                    Object.keys(roomState.players).forEach(function(k) {
                        if (roomState.players[k]) roomState.players[k].readyState = "WAITING";
                    });
                    syncCountryOwnersFromRoomState();
                    myReadiness = "WAITING";
                    autoTurnSeconds = 0;
                    stopAutoTurnCountdown();
                    saveRoomPersistence();
                    updateTopReadinessBar();

                    if (window.WarView && typeof window.WarView.onNetworkWarPhaseTriggered === "function") {
                        window.WarView.onNetworkWarPhaseTriggered(data.warRequesters || [], data.pendingNewYearAfterWar !== false);
                    } else {
                        document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
                        const dash = document.getElementById("game-dashboard");
                        if (dash) dash.classList.add("active");
                        const warBtn = document.getElementById("btn-view-war");
                        if (warBtn) warBtn.click();
                    }
                    if (window.showGameToast) {
                        window.showGameToast("⚔️ انتهى الشراء وطلب أحد القادة القتال! الانتقال لمركز الحرب والقتال!", "🚨");
                    }
                    break;
                }

            case "WAR_ULTIMATUM_SENT":
                {
                    if (data.worldData) {
                        mergeWorldDataFromCloud(data.worldData, true);
                    }
                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    if (window.WarView && typeof window.WarView.onNetworkUltimatumReceived === "function") {
                        window.WarView.onNetworkUltimatumReceived(data);
                    }
                    break;
                }

            case "WAR_RESOLUTION_BROADCAST":
                {
                    if (data.worldData) {
                        mergeWorldDataFromCloud(data.worldData, true);
                    }
                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    refreshAllGameViews();
                    if (window.WarView && typeof window.WarView.onNetworkPeacefulResolution === "function") {
                        window.WarView.onNetworkPeacefulResolution(data);
                    }
                    break;
                }

            case "WAR_BATTLE_START_BROADCAST":
                {
                    if (data.worldData) {
                        mergeWorldDataFromCloud(data.worldData, true);
                    }
                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    if (window.WarView && typeof window.WarView.onNetworkBattleStart === "function") {
                        window.WarView.onNetworkBattleStart(data);
                    }
                    break;
                }

            case "WAR_BATTLE_FINISHED_SYNC":
                {
                    if (data.worldData) {
                        mergeWorldDataFromCloud(data.worldData, true);
                    }
                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    refreshAllGameViews();
                    if (window.WarView && typeof window.WarView.showBattleResults === "function") {
                        const atkCoalition = window.WarView.deserializeCoalition(data.atkCoalitionData, window.currentWorld);
                        const defCoalition = window.WarView.deserializeCoalition(data.defCoalitionData, window.currentWorld);
                        if (atkCoalition.length > 0 && defCoalition.length > 0) {
                            window.WarView.showBattleResults(atkCoalition, defCoalition, data, true);
                        }
                    }
                    break;
                }

            case "ROOM_RESET":
                {
                    if (window.World) window.currentWorld = new window.World();
                    myCountryId = null;
                    myReadiness = "WAITING";
                    lastProcessedYearAdvance = 0;
                    Object.keys(roomState.players).forEach(function(k) {
                        if (roomState.players[k]) {
                            roomState.players[k].countryId = null;
                            roomState.players[k].readyState = "WAITING";
                        }
                    });
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    if (window.showGameToast) {
                        window.showGameToast("تم تصفير الروم لبدء جولة جديدة!", "🔄");
                    }
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
                    if (pid === localPlayerId) {
                        myCountryId = c.id;
                    }
                }
            }
        });
    }

    function stopAutoTurnCountdown() {
        if (autoTurnTimer) {
            clearInterval(autoTurnTimer);
            autoTurnTimer = null;
        }
        autoTurnSeconds = 0;
        timerTargetPlayerId = null;
        updateTopReadinessBar();
    }

    function executeAutoTurnProgression() {
        if (!window.currentWorld) return;

        const nextTargetYr = (Number(window.currentWorld.year) || 1) + 1;
        if (lastProcessedYearAdvance >= nextTargetYr) {
            return;
        }
        lastProcessedYearAdvance = nextTargetYr;

        Object.keys(roomState.players).forEach(function(k) {
            if (roomState.players[k]) roomState.players[k].readyState = "WAITING";
        });
        myReadiness = "WAITING";

        if (typeof window.currentWorld.advanceYear === "function") {
            window.currentWorld.advanceYear();
        }

        const updatedWorldData = (typeof window.currentWorld.toJSON === "function") ?
            window.currentWorld.toJSON() :
            window.currentWorld;

        saveRoomPersistence();
        publishMessage({
            type: "ADVANCE_YEAR_TRIGGER",
            worldData: updatedWorldData
        }, true);

        updateTopReadinessBar();
        refreshAllGameViews();
        if (window.GameSFX && typeof window.GameSFX.newYear === "function") window.GameSFX.newYear();
        if (window.showGameToast) {
            window.showGameToast("🌟 انطلقت السنة المالية " + (window.currentWorld.year || 1) + "م وتم إيداع العوائد لجميع اللاعبين!", "💰");
        }
    }

    function checkAllPlayersReady(isTriggeredByLocalClick = false) {
        const playerKeys = Object.keys(roomState.players || {});
        const activePlayers = [];
        for (let i = 0; i < playerKeys.length; i++) {
            const p = roomState.players[playerKeys[i]];
            if (p && p.isConnected && p.countryId) {
                activePlayers.push({ id: playerKeys[i], data: p });
            }
        }

        if (activePlayers.length === 0) return;

        const readyPlayers = activePlayers.filter(function(item) {
            return item.data.readyState === "READY_YEAR" || item.data.readyState === "READY_WAR";
        });

        if (readyPlayers.length === activePlayers.length) {
            stopAutoTurnCountdown();

            // لمنع حساب السنة مرتين من جهازين مختلفين في نفس اللحظة:
            // يتولى اللاعب الذي ضغط أخيراً أو صاحب المعرف الأصغر أبجدياً عملية الحساب وبث النتيجة للجميع
            activePlayers.sort(function(a, b) { return String(a.id).localeCompare(String(b.id)); });
            const coordinatorId = activePlayers[0].id;
            const shouldCoordinate = isTriggeredByLocalClick || (String(localPlayerId) === String(coordinatorId));

            if (!shouldCoordinate) return;

            const warRequesters = activePlayers
                .filter(function(item) { return item.data.readyState === "READY_WAR"; })
                .map(function(item) {
                    return {
                        playerId: item.id,
                        playerName: item.data.name || "قائد",
                        countryId: item.data.countryId
                    };
                });

            if (warRequesters.length > 0) {
                const worldJson = (window.currentWorld && typeof window.currentWorld.toJSON === "function")
                    ? window.currentWorld.toJSON()
                    : window.currentWorld;

                const warPacket = {
                    type: "WAR_TRIGGER",
                    warRequesters: warRequesters,
                    pendingNewYearAfterWar: true,
                    worldData: worldJson
                };

                publishMessage(warPacket, true);
                handleIncomingPacket(Object.assign({}, warPacket, { roomId: roomId, senderId: "system" }));
            } else {
                executeAutoTurnProgression();
            }
        }
    }

    function sendWarUltimatum(payload) {
        const packet = Object.assign({
            type: "WAR_ULTIMATUM_SENT",
            worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ? window.currentWorld.toJSON() : window.currentWorld
        }, payload || {});

        saveRoomPersistence();
        publishMessage(packet, true);
        handleIncomingPacket(Object.assign({}, packet, { roomId: roomId, senderId: "system" }));
    }

    function broadcastWarResolution(payload) {
        const packet = Object.assign({
            type: "WAR_RESOLUTION_BROADCAST",
            worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ? window.currentWorld.toJSON() : window.currentWorld
        }, payload || {});

        saveRoomPersistence();
        publishMessage(packet, true);
        handleIncomingPacket(Object.assign({}, packet, { roomId: roomId, senderId: "system" }));
    }

    function broadcastBattleStart(payload) {
        const packet = Object.assign({
            type: "WAR_BATTLE_START_BROADCAST",
            worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ? window.currentWorld.toJSON() : window.currentWorld
        }, payload || {});

        saveRoomPersistence();
        publishMessage(packet, false);
        handleIncomingPacket(Object.assign({}, packet, { roomId: roomId, senderId: "system" }));
    }

    function broadcastBattleFinishedSync(payload) {
        const packet = Object.assign({
            type: "WAR_BATTLE_FINISHED_SYNC",
            worldData: (window.currentWorld && typeof window.currentWorld.toJSON === "function") ? window.currentWorld.toJSON() : window.currentWorld
        }, payload || {});

        saveRoomPersistence();
        publishMessage(packet, true);
    }

    function completeWarPhaseToNewYear() {
        executeAutoTurnProgression();
    }

    function sendChatMessage(messageObj) {
        if (!messageObj) return;
        saveRoomPersistence();
        if (!roomId) return;
        publishMessage({
            type: "CHAT_MESSAGE",
            message: messageObj
        }, true);
    }

    function syncWorldState() {
        if (!window.currentWorld) return;
        saveRoomPersistence();
        if (roomId) {
            publishMessage({
                type: "WORLD_STATE_SYNC",
                forceSync: true,
                roomState: roomState,
                worldData: (typeof window.currentWorld.toJSON === "function")
                    ? window.currentWorld.toJSON()
                    : window.currentWorld
            }, true);
        }
        refreshAllGameViews();
    }

    function createRoom(desiredCode, playerName, callback) {
        const numCode = normalizeRoomCode(desiredCode) || generateRoomCode();
        connectToUnifiedRoom(numCode, playerName, callback);
    }

    function joinRoom(inputCode, playerName, callback) {
        const numCode = normalizeRoomCode(inputCode);
        if (!numCode) {
            if (window.showGameToast) window.showGameToast("يرجى كتابة رقم الروم بالأرقام فقط (مثال: 4821 أو 1000)!", "🔢");
            if (callback) callback({ success: false, error: "يرجى إدخال رقم فقط" });
            return;
        }
        connectToUnifiedRoom(numCode, playerName, callback);
    }

    function resetCurrentRoom() {
        if (!roomId) return;
        if (window.World) window.currentWorld = new window.World();
        myCountryId = null;
        myReadiness = "WAITING";
        lastProcessedYearAdvance = 0;
        Object.keys(roomState.players).forEach(function(k) {
            if (roomState.players[k]) {
                roomState.players[k].countryId = null;
                roomState.players[k].readyState = "WAITING";
            }
        });
        try { localStorage.removeItem(SAVE_PREFIX + roomId); } catch (e) {}
        publishMessage({ type: "ROOM_RESET" }, true);
        updateTopReadinessBar();
        refreshAllGameViews();
        if (window.showGameToast) {
            window.showGameToast("تم تصفير دول الروم (" + roomId + ") بنجاح!", "🗑️");
        }
    }

    function syncNewCountry(countryData) {
        if (!countryData) return;
        initIdentity();
        countryData.ownerPlayerId = localPlayerId;
        countryData.ownerPlayerName = myPlayerName;
        myCountryId = countryData.id;

        const cInst = upsertCountryInWorld(countryData, true);

        if (!roomState.players[localPlayerId]) {
            roomState.players[localPlayerId] = {
                name: myPlayerName,
                countryId: cInst.id,
                readyState: "WAITING",
                isConnected: true
            };
        } else {
            roomState.players[localPlayerId].countryId = cInst.id;
            roomState.players[localPlayerId].name = myPlayerName;
        }

        saveRoomPersistence();
        publishMessage({
            type: "NATION_CREATED",
            countryData: (cInst && typeof cInst.toJSON === "function") ? cInst.toJSON() : cInst,
            ownerPlayerId: localPlayerId,
            ownerPlayerName: myPlayerName
        }, true);

        updateTopReadinessBar();
        refreshAllGameViews();
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
            roomState.players[localPlayerId].name = myPlayerName;
        }

        saveRoomPersistence();
        publishMessage({
            type: "CLAIM_COUNTRY",
            playerId: localPlayerId,
            playerName: myPlayerName,
            countryId: countryId
        }, true);

        updateTopReadinessBar();
        refreshAllGameViews();
        return true;
    }

    function submitDecision(decision) {
        initIdentity();

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
                window.showGameToast("يرجى تأسيس دولتك أولاً أو اختيار دولة متاحة قبل الانتقال!", "🏰");
            }
            if (typeof window.openCreateCountryModal === "function") {
                window.openCreateCountryModal();
            }
            return;
        }

        // مزامنة بيانات الدولة والجيش قبل إعلان الجاهزية
        const myCountryObj = getMyCountryObjectJSON();

        myReadiness = decision;
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

        updateTopReadinessBar();
        publishMessage({
            type: "SUBMIT_READY",
            playerId: localPlayerId,
            playerName: myPlayerName,
            countryId: myCountryId,
            countryData: myCountryObj,
            decision: decision
        }, true);

        const playerKeys = Object.keys(roomState.players || {});
        const activePlayers = playerKeys.filter(function(k) {
            const p = roomState.players[k];
            return p && p.isConnected && p.countryId;
        });
        const readyPlayers = activePlayers.filter(function(k) {
            const st = roomState.players[k].readyState;
            return st === "READY_YEAR" || st === "READY_WAR";
        });

        if (readyPlayers.length < activePlayers.length && window.showGameToast) {
            const actionName = decision === "READY_WAR" ? "الانتقال للحرب ⚔️" : "الانتقال للسنة الجديدة 🌟";
            window.showGameToast(`تم تسجيل اختيارك (${actionName})! بانتظار إنهاء بقية اللاعبين للشراء (${readyPlayers.length}/${activePlayers.length})...`, "⏳");
        }

        checkAllPlayersReady(true);
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
        if (!country) return;
        if (window.BuildingsEngine && typeof window.BuildingsEngine.calculateTotalRevenue === "function") {
            country.sectorRevenues = window.BuildingsEngine.calculateTotalRevenue(country);
            country.budget = country.sectorRevenues;
        }
        if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
            window.MilitaryEngine.syncCountryWithMilitary(country);
        }
        if (!roomId) {
            refreshAllGameViews();
            return;
        }
        const payload = (typeof country.toJSON === "function") ? country.toJSON() : Object.assign({}, country);
        if (country.ownerPlayerId) payload.ownerPlayerId = country.ownerPlayerId;
        if (country.ownerPlayerName) payload.ownerPlayerName = country.ownerPlayerName;
        if (country.militaryColor) payload.militaryColor = country.militaryColor;

        saveRoomPersistence();
        publishMessage({
            type: "COUNTRY_UPDATED",
            countryData: payload
        }, true);
        refreshAllGameViews();
    }

    function copyRoomCode() {
        if (!roomId) return;
        const textToCopy = String(roomId);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(function() {
                if (window.showGameToast) window.showGameToast("تم نسخ رقم الروم: " + textToCopy, "📋");
            }).catch(function() {
                if (window.showGameToast) window.showGameToast("رقم الروم الحالي: " + textToCopy, "🔢");
            });
        } else {
            if (window.showGameToast) window.showGameToast("رقم الروم الحالي: " + textToCopy, "🔢");
        }
    }

    // تحديث شارات الروم والجاهزية المدمجة داخل الشريط العلوي الموحد (دون إنشاء شريط علوي ثانٍ)
    function updateTopReadinessBar() {
        const legacyBar = document.getElementById("multiplayer-status-bar");
        if (legacyBar) {
            legacyBar.style.display = "none";
        }

        const playerKeys = Object.keys(roomState.players || {});
        const playersArr = [];
        for (let i = 0; i < playerKeys.length; i++) {
            const p = roomState.players[playerKeys[i]];
            if (p && p.isConnected && p.countryId) playersArr.push(p);
        }

        let readyCount = 0;
        for (let j = 0; j < playersArr.length; j++) {
            if (playersArr[j].readyState !== "WAITING") readyCount++;
        }

        const totalActive = Math.max(1, playersArr.length);

        // تحديث أزرار وشارات الروم المدمجة في الشريط العلوي الموحد
        const roomBtns = [
            document.getElementById("btn-open-rooms-modal"),
            document.getElementById("btn-cap-room-pill")
        ];
        roomBtns.forEach(function(btn) {
            if (!btn) return;
            if (roomId) {
                btn.innerHTML = `${isConnectedToCloud ? "🟢" : "🟡"} روم ${roomId} (${readyCount}/${totalActive})`;
                btn.title = "اضغط لإدارة الروم أو نسخ رقم الروم (" + roomId + ")";
            } else {
                btn.innerHTML = `🌐 الروم`;
                btn.title = "دخول أو إنشاء روم مشترك بالأرقام";
            }
        });

        if (typeof window.updateAllTurnDecisionButtons === "function") {
            window.updateAllTurnDecisionButtons(myReadiness, readyCount, totalActive, !!roomId);
        }
    }

    initIdentity();

    return {
        createRoom: createRoom,
        joinRoom: joinRoom,
        connectToUnifiedRoom: connectToUnifiedRoom,
        resetCurrentRoom: resetCurrentRoom,
        normalizeRoomCode: normalizeRoomCode,
        claimCountry: claimCountry,
        getCountryOwnerInfo: getCountryOwnerInfo,
        syncNewCountry: syncNewCountry,
        submitDecision: submitDecision,
        sendWarUltimatum: sendWarUltimatum,
        broadcastWarResolution: broadcastWarResolution,
        broadcastBattleStart: broadcastBattleStart,
        broadcastBattleFinishedSync: broadcastBattleFinishedSync,
        completeWarPhaseToNewYear: completeWarPhaseToNewYear,
        sendChatMessage: sendChatMessage,
        syncWorldState: syncWorldState,
        canControlCountry: canControlCountry,
        isMyCountry: isMyCountry,
        syncCountryChanges: syncCountryChanges,
        updateTopReadinessBar: updateTopReadinessBar,
        copyRoomCode: copyRoomCode,
        refreshAllGameViews: refreshAllGameViews,
        getRoomId: function() { return roomId; },
        isHost: function() { return true; },
        getMyCountryId: function() { return myCountryId; },
        getLocalPlayerId: function() { return localPlayerId; },
        getPlayerName: function() { return myPlayerName; },
        getMyReadiness: function() { return myReadiness; },
        getRoomState: function() { return roomState; }
    };
})();
