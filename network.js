/**
 * ============================================================================
 * network.js - محرك الروم السحابي الموحد بالأرقام فقط (Unified Cloud Room v6.0)
 * ============================================================================
 *
 * لماذا هذا النظام أفضل بمراحل من الطريقة القديمة (PeerJS P2P)؟
 * 1. أرقام فقط بدون أي حروف (Numbers-Only Room Codes):
 *    - جميع رموز الغرف أرقام صافية فقط (مثل: 1000 أو 4821 أو 5555) مع تحويل تلقائي
 *      للأرقام العربية (١٢٣٤ -> 1234) وفتح لوحة الأرقام في الجوال مباشرةً.
 * 2. نظام "الروم الموحد السحابي" عبر بروتوكول WebSockets السحابي (MQTT over WSS):
 *    - بدلاً من اتصال هاتف بهاتف مباشرة (الذي تفشله شبكات الجوال 4G/5G وجدران الحماية)،
 *      يتصل الجميع بقناة سحابية موحدة ومشفرة عبر المنفذ القياسي 443/8084.
 *    - لا يوجد رفض دخول نهائياً ("الغرفة غير موجودة" انتهت للأبد!): أي لاعبين يكتبون نفس
 *      الرقم (مثلاً 4821) أو يدخلون الروم الموحد العام (1000) يجتمعون تلقائياً في نفس الروم
 *      سواء دخلوا معاً أو دخل أحدهم قبل الآخر!
 * 3. حفظ سحابي فوري لحالة الروم (Retained Cloud State) + مزامنة لحظية:
 *    - حتى لو خرج أحد اللاعبين لتطبيق واتساب أو أغلق الشاشة، تبقى بيانات الروم والدول محفوظة
 *      في القناة السحابية وفي الذاكرة المحلية ويستلمها أي لاعب يدخل الروم فوراً.
 * 4. تعدد الخوادم السحابية التلقائي (Multi-Broker Failover):
 *    - يتصل تلقائياً بـ EMQX Cloud WSS مع بديل فوري لـ HiveMQ Cloud و Mosquitto Cloud
 *      وقناة BroadcastChannel المحلية لضمان عمل الروم بنسبة 100% تحت أي ظرف.
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

    // مؤقت الدقيقة التلقائي لدوران السنة
    let autoTurnTimer = null;
    let autoTurnSeconds = 60;
    let timerTargetPlayerId = null;

    let roomState = {
        roomId: null,
        hostId: null,
        players: {}, // playerId -> { name, countryId, readyState, isConnected, lastSeen }
        turnStatus: "PLANNING",
        lastUpdate: Date.now()
    };

    const SAVE_PREFIX = "hegemony_num_room_save_";
    const TOPIC_PREFIX = "hegemony_game_v6_room_";

    // خوادم WebSockets سحابية عالمية سريعة ومجانية تعمل على كافة شبكات الجوال 4G/5G/WiFi
    const CLOUD_BROKERS = [
        "wss://broker.emqx.io:8084/mqtt",
        "wss://broker.hivemq.com:8884/mqtt",
        "wss://test.mosquitto.org:8081/mqtt"
    ];

    /**
     * تحويل أي مدخل (أرقام عربية أو إنجليزية أو نص) إلى أرقام إنجليزية صافية فقط بدون أي حروف!
     */
    function normalizeRoomCode(input) {
        if (input === null || input === undefined) return "";
        const arabicNums = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
        const easternNums = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
        let str = String(input);

        for (let i = 0; i < 10; i++) {
            str = str.replace(new RegExp(arabicNums[i], "g"), String(i));
            str = str.replace(new RegExp(easternNums[i], "g"), String(i));
        }

        // استخراج الأرقام فقط وحذف أي حروف أو رموز
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

    /**
     * دمج بيانات العالم الواردة من السحابة بذكاء دون مسح دول اللاعبين الآخرين
     */
    function mergeWorldDataFromCloud(incomingWorldData) {
        if (!incomingWorldData) return;
        if (!window.currentWorld && window.World) {
            window.currentWorld = new window.World();
        }
        if (!window.currentWorld) return;

        if (incomingWorldData.year && Number(incomingWorldData.year) > Number(window.currentWorld.year || 1)) {
            window.currentWorld.year = Number(incomingWorldData.year);
        }

        if (Array.isArray(incomingWorldData.tributes) && incomingWorldData.tributes.length > 0) {
            window.currentWorld.tributes = incomingWorldData.tributes;
        }

        if (Array.isArray(incomingWorldData.history) && incomingWorldData.history.length > (window.currentWorld.history ? window.currentWorld.history.length : 0)) {
            window.currentWorld.history = incomingWorldData.history;
        }

        if (Array.isArray(incomingWorldData.countries)) {
            incomingWorldData.countries.forEach(function(rawC) {
                upsertCountryInWorld(rawC);
            });
        }
    }

    // =========================================================================
    // 1. نظام الحفظ الدائم المحلي والسحابي للغرفة (Persistence & Cloud Retain)
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
                mergeWorldDataFromCloud(saved.worldData);
                if (saved.players) {
                    roomState.players = Object.assign({}, saved.players, roomState.players);
                }
                return true;
            }
        } catch (e) {}
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
    // 3. الاتصال بالروم السحابي الموحد بالأرقام (Unified Numeric Room Connection)
    // =========================================================================
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

        // 1. الإرسال عبر القناة المحلية (للنوافذ المتعددة على نفس الجهاز)
        if (bcChannel) {
            try { bcChannel.postMessage(packet); } catch (e) {}
        }

        // 2. الإرسال عبر السحابة الموحدة (MQTT over WSS)
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

        // استرجاع أي حفظ محلي سابق لهذا الرقم
        loadRoomPersistence(roomId);

        // تسجيل اللاعب الحالي في الروم فوراً
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

        // إذا كان لدى اللاعب دولة مؤسسة بالفعل في جلسته الحالية، نربطها به تلقائياً
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

        // إعداد BroadcastChannel للمزامنة الفورية على نفس الجهاز/الشبكة
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

        // إغلاق أي اتصال سحابي سابق قبل فتح القناة الجديدة
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

        // الدخول للروم فوري ولا يرفض أبداً (بحد أقصى 600 مللي ثانية حتى لو كانت الشبكة بطيئة)
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
                // إعلان الانضمام وطلب أحدث حالة من جميع المتصلين في الروم
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
        const json = (typeof c.toJSON === "function") ? c.toJSON() : Object.assign({}, c);
        json.ownerPlayerId = localPlayerId;
        json.ownerPlayerName = myPlayerName;
        if (c.militaryColor) json.militaryColor = c.militaryColor;
        return json;
    }

    // =========================================================================
    // 4. معالجة الرسائل المتزامنة في الروم الموحد (Unified Packet Handler)
    // =========================================================================
    function handleIncomingPacket(data) {
        if (!data || !data.type) return;
        if (String(data.roomId) !== String(roomId)) return;

        // لقطة الروم السحابية المحفوظة (تصل فور الدخول حتى لو كان الآخرون في الخلفية)
        if (data.type === "CLOUD_SNAPSHOT") {
            if (data.roomState && data.roomState.players) {
                Object.keys(data.roomState.players).forEach(function(pid) {
                    if (!roomState.players[pid] || pid !== localPlayerId) {
                        roomState.players[pid] = data.roomState.players[pid];
                    }
                });
            }
            if (data.worldData) {
                mergeWorldDataFromCloud(data.worldData);
            }
            syncCountryOwnersFromRoomState();
            saveRoomPersistence();
            updateTopReadinessBar();
            refreshAllGameViews();
            return;
        }

        // تجاهل الرسائل الحية التي أرسلناها نحن أنفسنا
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
                        upsertCountryInWorld(data.myCountryData);
                    }

                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    refreshAllGameViews();

                    // نرد عليه بإرسال حالة العالم والدول الحالية ليتزامن فوراً
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
                        mergeWorldDataFromCloud(data.worldData);
                    }
                    syncCountryOwnersFromRoomState();
                    saveRoomPersistence();
                    updateTopReadinessBar();
                    refreshAllGameViews();
                    break;
                }

            case "NATION_CREATED":
                {
                    if (data.countryData) {
                        if (data.ownerPlayerId) data.countryData.ownerPlayerId = data.ownerPlayerId;
                        if (data.ownerPlayerName) data.countryData.ownerPlayerName = data.ownerPlayerName;
                        const added = upsertCountryInWorld(data.countryData);

                        if (data.ownerPlayerId) {
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

                        if (window.showGameToast) {
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
                        upsertCountryInWorld(data.countryData);
                        syncCountryOwnersFromRoomState();
                        saveRoomPersistence();
                        refreshAllGameViews();
                    }
                    break;
                }

            case "SUBMIT_READY":
                {
                    const pId = data.playerId;
                    if (pId && roomState.players[pId]) {
                        roomState.players[pId].readyState = data.decision;
                    } else if (pId) {
                        roomState.players[pId] = {
                            name: data.playerName || "قائد",
                            countryId: data.countryId || null,
                            readyState: data.decision,
                            isConnected: true
                        };
                    }
                    updateTopReadinessBar();
                    checkAllPlayersReady();
                    break;
                }

            case "ADVANCE_YEAR_TRIGGER":
                {
                    if (data.worldData) {
                        if (window.World && typeof window.World.fromJSON === "function") {
                            window.currentWorld = window.World.fromJSON(data.worldData);
                        } else {
                            window.currentWorld = data.worldData;
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
                        window.showGameToast("🌟 انطلقت السنة المالية " + ((window.currentWorld && window.currentWorld.year) || 1) + "م لجميع اللاعبين!", "💰");
                    }
                    break;
                }

            case "WAR_TRIGGER":
                {
                    Object.keys(roomState.players).forEach(function(k) {
                        if (roomState.players[k]) roomState.players[k].readyState = "WAITING";
                    });
                    myReadiness = "WAITING";
                    autoTurnSeconds = 0;
                    stopAutoTurnCountdown();
                    updateTopReadinessBar();

                    document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
                    const dash = document.getElementById("game-dashboard");
                    if (dash) dash.classList.add("active");
                    const warBtn = document.getElementById("btn-view-war");
                    if (warBtn) warBtn.click();
                    if (window.showGameToast) {
                        window.showGameToast("⚔️ أعلن أحد القادة الحرب! الانتقال لغرفة العمليات العسكرية!", "🚨");
                    }
                    break;
                }

            case "ROOM_RESET":
                {
                    if (window.World) window.currentWorld = new window.World();
                    myCountryId = null;
                    myReadiness = "WAITING";
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

    // =========================================================================
    // 5. إدارة جاهزية اللاعبين وتدوير السنة (Turn & War Progression)
    // =========================================================================
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
            window.showGameToast("🌟 انطلقت السنة المالية " + (window.currentWorld.year || 1) + "م لجميع اللاعبين!", "💰");
        }
    }

    function checkAllPlayersReady() {
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
            const hasWar = activePlayers.some(function(item) {
                return item.data.readyState === "READY_WAR";
            });

            if (hasWar) {
                publishMessage({ type: "WAR_TRIGGER" }, false);
                handleIncomingPacket({ type: "WAR_TRIGGER", roomId: roomId, senderId: "system" });
            } else {
                executeAutoTurnProgression();
            }
        }
    }

    // =========================================================================
    // 6. دوال تأسيس الدولة، اختيار الدولة، والمزامنة اللحظية
    // =========================================================================
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

        const cInst = upsertCountryInWorld(countryData);

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
                window.showGameToast("يرجى تأسيس دولتك أولاً أو اختيار دولة متاحة قبل إعلان الجاهزية!", "🏰");
            }
            if (typeof window.openCreateCountryModal === "function") {
                window.openCreateCountryModal();
            }
            return;
        }

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
            decision: decision
        }, false);

        checkAllPlayersReady();
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
                prompt("انسخ رقم الروم:", textToCopy);
            });
        } else {
            prompt("انسخ رقم الروم:", textToCopy);
        }
    }

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
            roomCodeLabel.textContent = "روم رقم: " + roomId + " 📋";
            roomCodeLabel.title = "اضغط لنسخ رقم الروم";
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
            if (!myCountryId) {
                statusDetails.innerHTML = '<span style="color:#38bdf8; font-weight:900;">🏰 أسس دولتك أو اختر دولة</span>';
            } else {
                statusDetails.textContent = (isConnectedToCloud ? "🟢 متصل | " : "🟡 محلي | ") + "الجاهزية: " + readyCount + "/" + Math.max(1, playersArr.length);
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
        connectToUnifiedRoom: connectToUnifiedRoom,
        resetCurrentRoom: resetCurrentRoom,
        normalizeRoomCode: normalizeRoomCode,
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
        isHost: function() { return true; },
        getMyCountryId: function() { return myCountryId; },
        getLocalPlayerId: function() { return localPlayerId; },
        getPlayerName: function() { return myPlayerName; },
        getRoomState: function() { return roomState; }
    };
})();
