/**
 * ============================================================================
 * network.js - محرك الشبكة والغرف المتزامنة P2P (عصر الهيمنة - Pure ES6)
 * ============================================================================
 * 
 * المزايا البرمجية:
 * 1. توافق تام 100% مع معايير Pure ES6 لحل أخطاء التوافقية ومحرر الأكواد.
 * 2. دعم الغرف التعددية (حتى 10 لاعبين) برمز غرفة رقمي عبر شبكة PeerJS المباشرة.
 * 3. تعيين دولة مستقلة لكل لاعب وقفل بطاقات الدول الأخرى لمنع التجسس أو التعديل.
 * 4. شريط الجاهزية واتخاذ القرار: (جاهز للسنة التالية) أو (إعلان الحرب).
 * 5. إدارة تدوير السنة الجماعي أو الانتقال للمواجهة العسكرية فور اكتمال قرارات الـ 10 لاعبين.
 */

window.NetworkEngine = (function() {
    let peer = null;
    let connections = []; // للمضيف: قائمة الاتصالات بجميع اللاعبين
    let hostConn = null; // للاعب المنضم: الاتصال بالمضيف
    let isHost = false;
    let roomId = null;
    let localPlayerId = null;
    let myCountryId = null;
    let myPlayerName = "قائد سيادي";
    let myReadiness = "WAITING"; // 'WAITING' | 'READY_YEAR' | 'READY_WAR'

    // حالة الغرفة المشتركة (تخزن في جهاز المضيف وتبث للجميع)
    let roomState = {
        roomId: null,
        hostId: null,
        players: {}, // playerId -> { name, countryId, readyState, isConnected }
        turnStatus: "PLANNING",
        lastUpdate: Date.now()
    };

    // بادئة تعريف الغرف
    const ROOM_PREFIX = "HEG-";

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

    /**
     * تأسيس غرفة جديدة ويكون هذا الجهاز هو المضيف (Host)
     */
    function createRoom(desiredCode, playerName, callback) {
        initIdentity();
        if (playerName) {
            myPlayerName = playerName;
            localStorage.setItem("hegemony_player_name", playerName);
        }

        roomId = desiredCode ? (desiredCode.indexOf(ROOM_PREFIX) === 0 ? desiredCode : (ROOM_PREFIX + desiredCode)) : generateRoomCode();
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
            roomState.roomId = id;
            roomState.hostId = localPlayerId;
            roomState.players[localPlayerId] = {
                name: myPlayerName,
                countryId: null,
                readyState: "WAITING",
                isConnected: true
            };

            updateTopReadinessBar();
            if (callback) callback({ success: true, roomId: id, isHost: true });
            if (window.showGameToast) window.showGameToast("تم إنشاء الغرفة بنجاح: " + id, "📡");
        });

        peer.on("connection", function(conn) {
            handleIncomingConnection(conn);
        });

        peer.on("error", function(err) {
            console.error("PeerJS Error:", err);
            if (err.type === "unavailable-id") {
                createRoom(null, myPlayerName, callback);
            } else {
                if (callback) callback({ success: false, error: err.type });
                if (window.showGameToast) window.showGameToast("خطأ في الشبكة: " + err.type, "⚠️");
            }
        });
    }

    /**
     * الانضمام لغرفة قائمة بواسطة رمز الغرفة
     */
    function joinRoom(inputCode, playerName, callback) {
        initIdentity();
        if (playerName) {
            myPlayerName = playerName;
            localStorage.setItem("hegemony_player_name", playerName);
        }

        const cleanInput = inputCode.trim();
        const targetCode = cleanInput.indexOf(ROOM_PREFIX) === 0 ? cleanInput : (ROOM_PREFIX + cleanInput);
        roomId = targetCode;
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
                    { urls: "stun:stun1.l.google.com:19302" }
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

                updateTopReadinessBar();
                if (callback) callback({ success: true, roomId: roomId, isHost: false });
                if (window.showGameToast) window.showGameToast("تم الاتصال بالغرفة: " + roomId, "✅");
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
                if (callback) callback({ success: false, error: "فشل الاتصال بالمضيف" });
            });
        });

        peer.on("error", function(err) {
            console.error("PeerJS Join Error:", err);
            if (callback) callback({ success: false, error: err.type });
            if (window.showGameToast) window.showGameToast("تعذر العثور على الغرفة أو الكود غير صحيح!", "❌");
        });
    }

    /**
     * معالجة الاتصالات الواردة للمضيف
     */
    function handleIncomingConnection(conn) {
        const currentCount = Object.keys(roomState.players).length;
        if (currentCount >= 10) {
            conn.on("open", function() {
                conn.send({ type: "ROOM_FULL", msg: "الغرفة مكتملة (الحد الأقصى 10 لاعبين)!" });
                setTimeout(function() { conn.close(); }, 500);
            });
            return;
        }

        connections.push(conn);

        conn.on("data", function(data) {
            handleHostReceivedData(conn, data);
        });

        conn.on("close", function() {
            // معالجة السطر 212 المتوافقة مع Pure ES6 دون استخدام ?.
            const pId = (conn.metadata && conn.metadata.playerId) ? conn.metadata.playerId : null;
            if (pId && roomState.players[pId]) {
                roomState.players[pId].isConnected = false;
                broadcastRoomState();
                checkAllPlayersReady();
            }
            connections = connections.filter(function(c) {
                return c !== conn;
            });
        });
    }

    /**
     * معالجة البيانات لدى المضيف (Authoritative Host)
     */
    function handleHostReceivedData(conn, data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case "JOIN_REQUEST":
                {
                    const pId = data.playerId;
                    roomState.players[pId] = {
                        name: data.playerName || "لاعب",
                        countryId: null,
                        readyState: "WAITING",
                        isConnected: true
                    };
                    conn.send({
                        type: "INIT_SYNC",
                        roomState: roomState,
                        worldData: window.currentWorld ? window.currentWorld.toJSON() : null
                    });
                    broadcastRoomState();
                    break;
                }

            case "CLAIM_COUNTRY":
                {
                    const pId = data.playerId;
                    const cId = data.countryId;
                    const playerKeys = Object.keys(roomState.players);
                    const isTaken = playerKeys.some(function(k) {
                        return k !== pId && roomState.players[k].countryId === cId;
                    });

                    if (!isTaken) {
                        if (roomState.players[pId]) {
                            roomState.players[pId].countryId = cId;
                            broadcastRoomState();
                            broadcastNotification("قام القائد " + roomState.players[pId].name + " بحجز قيادة دولة!", "👑");
                        }
                    } else {
                        conn.send({ type: "CLAIM_REJECTED", msg: "هذه الدولة محجوزة للاعب آخر بالفعل!" });
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
                            broadcastToAll({
                                type: "COUNTRY_UPDATED",
                                countryData: data.countryData
                            });
                        }
                    }
                    break;
                }
        }
    }

    /**
     * معالجة البيانات لدى اللاعب المنضم (Client)
     */
    function handleClientReceivedData(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case "INIT_SYNC":
                {
                    roomState = data.roomState;
                    if (data.worldData && window.World) {
                        window.currentWorld = window.World.fromJSON(data.worldData);
                        if (window.renderNationsTable) window.renderNationsTable();
                    }
                    updateTopReadinessBar();
                    break;
                }

            case "ROOM_STATE_UPDATE":
                {
                    roomState = data.roomState;
                    updateTopReadinessBar();
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
                            if (window.CountryViewController && window.currentViewingCountry && window.currentViewingCountry.id === found.id) {
                                window.CountryViewController.render(found);
                            }
                            if (window.renderNationsTable) window.renderNationsTable();
                        }
                    }
                    break;
                }

            case "ADVANCE_YEAR_TRIGGER":
                {
                    if (window.currentWorld && data.worldData) {
                        window.currentWorld = window.World.fromJSON(data.worldData);
                        myReadiness = "WAITING";
                        updateTopReadinessBar();
                        if (window.renderNationsTable) window.renderNationsTable();
                        if (window.GameSFX) window.GameSFX.newYear();
                        if (window.showGameToast) window.showGameToast("انطلقت السنة المالية " + window.currentWorld.year + "م للجميع!", "🌟");
                    }
                    break;
                }

            case "WAR_TRIGGER":
                {
                    myReadiness = "WAITING";
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

    /**
     * التحقق من اكتمال قرارات جميع اللاعبين النشطين
     */
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

        if (activePlayers.length === 0) return;

        const allReady = activePlayers.every(function(p) {
            return p.readyState === "READY_YEAR" || p.readyState === "READY_WAR";
        });

        if (allReady) {
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
                if (window.currentWorld) {
                    window.currentWorld.advanceYear();
                    const updatedWorldData = window.currentWorld.toJSON();

                    broadcastToAll({
                        type: "ADVANCE_YEAR_TRIGGER",
                        worldData: updatedWorldData
                    });

                    handleClientReceivedData({
                        type: "ADVANCE_YEAR_TRIGGER",
                        worldData: updatedWorldData
                    });
                }
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

    function claimCountry(countryId) {
        myCountryId = countryId;
        if (isHost) {
            roomState.players[localPlayerId].countryId = countryId;
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
            alert("يرجى اختيار دولتك وتثبيتها أولاً من قائمة بطاقات الأمم!");
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

        if (!myCountryId) {
            const playerKeys = Object.keys(roomState.players);
            const isTaken = playerKeys.some(function(k) {
                return roomState.players[k].countryId === targetCountryId && roomState.players[k].isConnected;
            });
            if (!isTaken) {
                claimCountry(targetCountryId);
                return true;
            }
            return false;
        }

        return String(myCountryId) === String(targetCountryId);
    }

    function syncCountryChanges(country) {
        if (!roomId || !country) return;
        if (isHost) {
            broadcastToAll({
                type: "COUNTRY_UPDATED",
                countryData: country
            });
        } else {
            sendToHost({
                type: "SYNC_MY_COUNTRY_DATA",
                countryData: country
            });
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

        if (roomCodeLabel) roomCodeLabel.textContent = "غرفة: " + roomId;

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

        if (countLabel) countLabel.textContent = "👥 اللاعبون: " + playersArr.length + "/10";
        if (statusDetails) statusDetails.textContent = "الجاهزية: " + readyCount + " من " + playersArr.length + " قادة أكدوا خيارهم";

        if (btnNextYear && btnWar) {
            if (myReadiness === "READY_YEAR") {
                btnNextYear.className = "btn btn-sm btn-primary active-decision";
                btnNextYear.textContent = "✅ بانتظار البقية (سنة جديدة)";
                btnWar.className = "btn btn-sm btn-secondary";
                btnWar.textContent = "⚔️ إعلان الحرب";
            } else if (myReadiness === "READY_WAR") {
                btnNextYear.className = "btn btn-sm btn-secondary";
                btnNextYear.textContent = "🌾 سنة مالية جديدة";
                btnWar.className = "btn btn-sm btn-danger active-decision";
                btnWar.textContent = "🚨 أعلنت الحرب (بانتظار البقية)";
            } else {
                btnNextYear.className = "btn btn-sm btn-primary";
                btnNextYear.textContent = "🌾 جاهز للسنة التالية";
                btnWar.className = "btn btn-sm btn-danger";
                btnWar.textContent = "⚔️ إعلان الحرب";
            }
        }
    }

    return {
        createRoom: createRoom,
        joinRoom: joinRoom,
        claimCountry: claimCountry,
        submitDecision: submitDecision,
        canControlCountry: canControlCountry,
        syncCountryChanges: syncCountryChanges,
        updateTopReadinessBar: updateTopReadinessBar,
        getRoomId: function() { return roomId; },
        isHost: function() { return isHost; },
        getMyCountryId: function() { return myCountryId; },
        getLocalPlayerId: function() { return localPlayerId; },
        getRoomState: function() { return roomState; }
    };
})();