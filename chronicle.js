/**
 * ============================================================================
 * chronicle.js - محرك المحادثات النصية والدردشة الدبلوماسية الفورية في الروم (v6.6)
 * ============================================================================
 * تم استبدال نظام كتابة التاريخ بالكامل بنظام محادثات نصية حية بين اللاعبين في الروم الواحد.
 */

class ChronicleManager {
  constructor() {
    this.container = null;
    this.unreadCount = 0;
    this.isTabActive = false;

    this.QUICK_PHRASES = [
      "🤝 هل نبرم اتفاقية تجارية؟",
      "💰 أحتاج قرضاً أو منحة مالية عاجلة!",
      "🛡️ لنشكّل تحالفاً دفاعياً مشتركاً!",
      "⚠️ احذر من الاقتراب من حدود دولتي!",
      "✅ أنا جاهز للانتقال للسنة الجديدة 🌟",
      "⚔️ استعدوا للمواجهة في غرفة الحرب!"
    ];
  }

  init() {
    this.container = document.getElementById("chronicle-tables-wrapper");
  }

  escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  formatTime(ts) {
    try {
      const d = new Date(ts || Date.now());
      return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  renderMiniFlagHtml(flagInput) {
    if (!flagInput || !Array.isArray(flagInput) || flagInput.length === 0) {
      return `<span style="display:inline-block; width:22px; height:15px; background:#334155; border-radius:3px; border:1px solid #fbbf24; vertical-align:middle;"></span>`;
    }
    const flat = Array.isArray(flagInput[0]) ? flagInput.flat() : flagInput;
    let cells = "";
    for (let i = 0; i < 12; i++) {
      const col = flat[i] || "#c0392b";
      cells += `<span style="background:${col}; display:block; width:100%; height:100%;"></span>`;
    }
    return `<span style="display:inline-grid; grid-template-columns:repeat(4, 1fr); grid-template-rows:repeat(3, 1fr); width:24px; height:16px; border:1px solid #fbbf24; border-radius:3px; overflow:hidden; vertical-align:middle; flex-shrink:0;">${cells}</span>`;
  }

  sendMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text) return;

    if (!window.currentWorld && window.World) {
      window.currentWorld = new window.World();
    }
    const world = window.currentWorld;
    if (!world) return;

    const myPlayerId = (window.NetworkEngine && typeof window.NetworkEngine.getLocalPlayerId === "function")
      ? window.NetworkEngine.getLocalPlayerId()
      : "local_player";
    const myPlayerName = (window.NetworkEngine && typeof window.NetworkEngine.getPlayerName === "function")
      ? window.NetworkEngine.getPlayerName()
      : "قائد سيادي";
    const myCountryId = (window.NetworkEngine && typeof window.NetworkEngine.getMyCountryId === "function")
      ? window.NetworkEngine.getMyCountryId()
      : (window.currentViewingCountry ? window.currentViewingCountry.id : null);

    const countries = Array.isArray(world.countries) ? world.countries : [];
    const myCountry = (myCountryId && countries.find(c => String(c.id) === String(myCountryId))) ||
      window.currentViewingCountry ||
      countries[0] ||
      null;

    const msgPayload = {
      id: "chat_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      senderId: myPlayerId,
      senderName: myPlayerName,
      countryId: myCountry ? myCountry.id : null,
      countryName: myCountry ? myCountry.name : "بدون دولة",
      flag: myCountry ? myCountry.flag : null,
      text: text.substring(0, 400),
      year: world.year || 1,
      isSystem: false,
      timestamp: Date.now()
    };

    if (typeof world.addChatMessage === "function") {
      world.addChatMessage(msgPayload);
    } else {
      if (!Array.isArray(world.chatMessages)) world.chatMessages = [];
      world.chatMessages.push(msgPayload);
    }

    if (window.GameSFX && typeof window.GameSFX.playClick === "function") {
      window.GameSFX.playClick();
    }

    if (window.NetworkEngine && typeof window.NetworkEngine.sendChatMessage === "function") {
      window.NetworkEngine.sendChatMessage(msgPayload);
    }

    this.render(world, true);
  }

  addSystemNotification(text) {
    if (!text || !window.currentWorld) return;
    const world = window.currentWorld;
    const msgPayload = {
      id: "sys_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      senderId: "system",
      senderName: "النظام السيادي",
      countryId: null,
      countryName: "",
      flag: null,
      text: text,
      year: world.year || 1,
      isSystem: true,
      timestamp: Date.now()
    };
    if (typeof world.addChatMessage === "function") {
      world.addChatMessage(msgPayload);
    } else {
      if (!Array.isArray(world.chatMessages)) world.chatMessages = [];
      world.chatMessages.push(msgPayload);
    }
    this.render(world, true);
  }

  onIncomingNetworkMessage(msgPayload) {
    if (!msgPayload || !window.currentWorld) return;
    const world = window.currentWorld;
    const added = (typeof world.addChatMessage === "function")
      ? world.addChatMessage(msgPayload)
      : null;

    if (!added && Array.isArray(world.chatMessages)) {
      if (!world.chatMessages.some(m => m.id === msgPayload.id)) {
        world.chatMessages.push(msgPayload);
      } else {
        return;
      }
    } else if (!added) {
      return;
    }

    const chatContainer = document.getElementById("nations-chronicle-container");
    const isVisible = chatContainer && chatContainer.style.display !== "none" && document.getElementById("game-dashboard")?.classList.contains("active");

    if (!isVisible) {
      this.unreadCount += 1;
      this.updateUnreadBadge();
      if (window.showGameToast && !msgPayload.isSystem) {
        const senderTitle = msgPayload.countryName ? `${msgPayload.senderName} (${msgPayload.countryName})` : msgPayload.senderName;
        window.showGameToast(`💬 ${senderTitle}: ${msgPayload.text}`, "📨");
      }
    } else {
      this.unreadCount = 0;
      this.updateUnreadBadge();
    }

    this.render(world, true);
  }

  clearUnread() {
    this.unreadCount = 0;
    this.updateUnreadBadge();
  }

  updateUnreadBadge() {
    const badges = document.querySelectorAll(".chat-unread-badge");
    badges.forEach(b => {
      if (this.unreadCount > 0) {
        b.style.display = "inline-flex";
        b.textContent = this.unreadCount > 9 ? "+9" : String(this.unreadCount);
      } else {
        b.style.display = "none";
      }
    });
  }

  render(world, keepInputFocus = false) {
    if (!this.container) {
      this.container = document.getElementById("chronicle-tables-wrapper");
    }
    if (!this.container) return;

    world = world || window.currentWorld;
    if (!world) return;

    if (!Array.isArray(world.chatMessages)) {
      world.chatMessages = [];
    }

    const existingInput = document.getElementById("room-chat-input");
    const draftVal = existingInput ? existingInput.value : "";

    const roomId = (window.NetworkEngine && typeof window.NetworkEngine.getRoomId === "function")
      ? window.NetworkEngine.getRoomId()
      : null;
    const myPlayerId = (window.NetworkEngine && typeof window.NetworkEngine.getLocalPlayerId === "function")
      ? window.NetworkEngine.getLocalPlayerId()
      : "local_player";
    const roomState = (window.NetworkEngine && typeof window.NetworkEngine.getRoomState === "function")
      ? window.NetworkEngine.getRoomState()
      : null;

    const countries = Array.isArray(world.countries) ? world.countries : [];

    // قائمة اللاعبين المتصلين في الروم
    let onlinePlayersHtml = "";
    if (roomState && roomState.players && Object.keys(roomState.players).length > 0) {
      onlinePlayersHtml = Object.keys(roomState.players).map(pid => {
        const p = roomState.players[pid];
        if (!p) return "";
        const c = p.countryId ? countries.find(x => String(x.id) === String(p.countryId)) : null;
        const isMe = String(pid) === String(myPlayerId);
        const flagHtml = c ? this.renderMiniFlagHtml(c.flag) : `<span>👤</span>`;
        const statusDot = p.readyState !== "WAITING" ? "🟢 جاهز" : "⏳ يتسوق";
        return `
          <div class="chat-player-pill ${isMe ? 'is-me' : ''}">
            ${flagHtml}
            <span><strong>${this.escapeHtml(p.name || 'قائد')}</strong>${c ? ` (${this.escapeHtml(c.name)})` : ''}</span>
            <small style="color:#fde047;">${statusDot}</small>
          </div>
        `;
      }).join("");
    } else if (countries.length > 0) {
      onlinePlayersHtml = countries.map(c => `
        <div class="chat-player-pill">
          ${this.renderMiniFlagHtml(c.flag)}
          <span><strong>${this.escapeHtml(c.name)}</strong></span>
        </div>
      `).join("");
    } else {
      onlinePlayersHtml = `<span style="font-size:0.76rem; color:#94a3b8;">لا توجد دول مؤسسة في الروم بعد</span>`;
    }

    // بناء قائمة الرسائل
    let messagesHtml = "";
    if (world.chatMessages.length === 0) {
      messagesHtml = `
        <div class="chat-empty-state">
          <div style="font-size:2.4rem; margin-bottom:6px;">💬</div>
          <h4 style="color:#fde047; margin-bottom:4px;">محادثات الروم الدبلوماسية المباشرة</h4>
          <p style="color:#cbd5e1; font-size:0.82rem; max-width:440px; margin:0 auto;">
            تحدث مباشرة مع القادة واللاعبين المتواجدين معك في نفس الروم لعقد التحالفات والصفقات التجارية أو إعلان التحديات!
          </p>
        </div>
      `;
    } else {
      messagesHtml = world.chatMessages.map(msg => {
        if (msg.isSystem) {
          return `
            <div class="chat-msg-system">
              <span>📢 ${this.escapeHtml(msg.text)}</span>
              <small>سنة ${msg.year || 1}م</small>
            </div>
          `;
        }
        const isMine = String(msg.senderId) === String(myPlayerId);
        const flagHtml = msg.flag ? this.renderMiniFlagHtml(msg.flag) : "";
        return `
          <div class="chat-msg-row ${isMine ? 'msg-mine' : 'msg-other'}">
            <div class="chat-msg-bubble">
              <div class="chat-msg-header">
                <div style="display:flex; align-items:center; gap:6px;">
                  ${flagHtml}
                  <strong class="chat-sender-name">${this.escapeHtml(msg.senderName || 'قائد')}</strong>
                  ${msg.countryName ? `<span class="chat-country-tag">🏰 ${this.escapeHtml(msg.countryName)}</span>` : ''}
                </div>
                <span class="chat-msg-time">سنة ${msg.year || 1}م • ${this.formatTime(msg.timestamp)}</span>
              </div>
              <div class="chat-msg-text">${this.escapeHtml(msg.text)}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    const quickPhrasesHtml = this.QUICK_PHRASES.map(phrase => `
      <button type="button" class="btn btn-secondary btn-sm chat-quick-phrase-btn" data-phrase="${this.escapeHtml(phrase)}">
        ${this.escapeHtml(phrase)}
      </button>
    `).join("");

    this.container.innerHTML = `
      <div class="room-chat-card">
        <div class="room-chat-header">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:1.3rem;">💬</span>
            <div>
              <h3 style="margin:0; font-size:0.96rem; color:#fde047;">ديوان المحادثات النصية للاعبين في الروم</h3>
              <span style="font-size:0.72rem; color:#cbd5e1;">
                ${roomId ? `🌐 متصل بالروم رقم (${roomId}) — رسائلك تصل فوراً لجميع اللاعبين في الروم` : `🏠 وضع اللعب المحلي — ادخل روماً من الأعلى للدردشة المباشرة مع أصدقائك`}
              </span>
            </div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            ${!roomId ? `<button type="button" id="btn-chat-open-room" class="btn btn-accent btn-sm">🌐 دخول روم أونلاين</button>` : `<span class="badge badge-gold">🔢 روم: ${roomId}</span>`}
          </div>
        </div>

        <div class="room-chat-players-bar">
          <span style="font-size:0.74rem; color:#fde68a; font-weight:800; white-space:nowrap;">👥 القادة في الروم:</span>
          <div class="room-chat-players-scroll">
            ${onlinePlayersHtml}
          </div>
        </div>

        <div id="room-chat-messages-box" class="room-chat-messages-box">
          ${messagesHtml}
        </div>

        <div class="room-chat-quick-bar">
          ${quickPhrasesHtml}
        </div>

        <form id="room-chat-form" class="room-chat-input-bar" onsubmit="return false;">
          <input
            type="text"
            id="room-chat-input"
            placeholder="اكتب رسالتك هنا لجميع اللاعبين في الروم..."
            maxlength="400"
            autocomplete="off"
          />
          <button type="submit" id="btn-send-room-chat" class="btn btn-primary">
            إرسال 📨
          </button>
        </form>
      </div>
    `;

    const msgBox = document.getElementById("room-chat-messages-box");
    if (msgBox) {
      msgBox.scrollTop = msgBox.scrollHeight;
    }

    const inputEl = document.getElementById("room-chat-input");
    if (inputEl && draftVal && !keepInputFocus) {
      inputEl.value = draftVal;
    }

    const formEl = document.getElementById("room-chat-form");
    if (formEl && inputEl) {
      formEl.onsubmit = (e) => {
        if (e) e.preventDefault();
        const val = inputEl.value;
        if (!val || !val.trim()) return false;
        inputEl.value = "";
        this.sendMessage(val);
        const updatedInput = document.getElementById("room-chat-input");
        if (updatedInput) updatedInput.focus();
        return false;
      };
    }

    const btnOpenRoom = document.getElementById("btn-chat-open-room");
    if (btnOpenRoom) {
      btnOpenRoom.onclick = () => {
        const lobbyModal = document.getElementById("modal-multiplayer-lobby");
        if (lobbyModal) lobbyModal.classList.add("active");
      };
    }

    this.container.querySelectorAll(".chat-quick-phrase-btn").forEach(btn => {
      btn.onclick = () => {
        const phrase = btn.getAttribute("data-phrase");
        if (phrase) {
          this.sendMessage(phrase);
        }
      };
    });
  }
}

window.ChronicleManager = new ChronicleManager();
window.ChronicleEngine = {
  addEntry: function() {}
};
