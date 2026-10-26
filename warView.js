/**
 * ============================================================================
 * warView.js - مركز الحرب والقتال الموحد وإدارة المعارك المتزامنة (v6.1)
 * ============================================================================
 *
 * الآلية المتسلسلة الكاملة حسب طلب المستخدم:
 * 1. بعد انتهاء اللاعبين من الشراء والضغط على (الانتقال للحرب)، تنتقل شاشات جميع اللاعبين
 *    في الغرفة إلى مركز الحرب والقتال.
 * 2. اللاعب الذي طلب القتال يختار الدولة المستهدفة، ثم يختار الجنود الذين يريد الغزو بهم
 *    مع رؤية واضحة للأعداد والقوة المتوفرة (التزام صارم 1:1 بالوحدات المقاتلة الفعلية فقط)،
 *    ثم يضغط على (الانتقال للحرب).
 * 3. تظهر للاعب المستهدف (الذي وقعت عليه الحرب) رسالة تنبيه وتحذير بقدوم الجيش المهاجم
 *    وتفاصيل أعداده وقوته، ويختار أحد الخيارات الثلاثة:
 *    - (1) الاستسلام
 *    - (2) دفع الجزية
 *    - (3) الحرب (وهنا يختار جزءاً من جيشه أو الجيش كله)
 * 4. عند اختيار الحرب، تنتقل شاشات جميع اللاعبين في الروم لمشاهدة المعركة الحية حتى انتهائها.
 * 5. بعد انتهاء المعركة وإعلان المنتصر والخسائر والغنائم، يتم الانتقال لاستكمال اللعب والسنة الجديدة.
 */

class WarView {
  static init() {
    if (!this.attackerCoalition) this.attackerCoalition = [];
    if (!this.defenderCoalition) this.defenderCoalition = [];
    if (!this.attackerMobStatus) this.attackerMobStatus = "FULL";
    if (!this.defenderMobStatus) this.defenderMobStatus = "FULL";
    if (!this.battleEngine) this.battleEngine = null;

    // حالة مرحلة الحرب الجماعية بعد انتهاء الشراء
    if (!this.warRequestersQueue) this.warRequestersQueue = [];
    if (this.pendingNewYearAfterWar === undefined) this.pendingNewYearAfterWar = false;
    if (!this.activeWarState) {
      this.activeWarState = {
        phase: "IDLE", // IDLE | SELECTING_ATTACK | WAITING_DEFENDER | IN_BATTLE | REPORT_SHOWN
        attackerCountryId: null,
        attackerPlayerId: null,
        defenderCountryId: null,
        defenderPlayerId: null,
        battleResultApplied: false
      };
    }

    this.bindGlobalEvents();
    this._isInitialized = true;
  }

  static isCombatUnit(unitOrId) {
    if (window.WarEngine && typeof window.WarEngine.isCombatUnit === "function") {
      return window.WarEngine.isCombatUnit(unitOrId);
    }
    const u = (typeof unitOrId === "string")
      ? (window.MilitaryData ? window.MilitaryData.getUnitById(unitOrId) : null)
      : unitOrId;
    if (!u) return false;
    return !!u.isCustom || Number(u.power || 0) > 0;
  }

  static notify(msg, icon) {
    if (typeof window.showGameToast === "function") {
      window.showGameToast(msg, icon || "⚔️");
    } else {
      alert(msg);
    }
  }

  static playWarSiren() {
    if (!window.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(620, ctx.currentTime + 0.28);
      osc.frequency.linearRampToValueAtTime(340, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.58);
      osc.start();
      osc.stop(ctx.currentTime + 0.58);
    } catch (e) {}
  }

  static calculateMobilizationStatus(country, mobilizedForces) {
    const totalStanding = window.WarEngine ? window.WarEngine.getStandingArmyCount(country) : 0;
    if (totalStanding === 0) return "NO_ARMY";

    let totalMobilized = 0;
    Object.keys(mobilizedForces || {}).forEach(uid => {
      if (this.isCombatUnit(uid)) {
        totalMobilized += Math.max(0, Math.floor(Number(mobilizedForces[uid] || 0)));
      }
    });

    if (totalMobilized === 0) return "NO_ARMY";
    if (totalMobilized >= totalStanding) return "FULL";
    return "PARTIAL";
  }

  static serializeCoalition(coalition) {
    return (coalition || []).map(member => {
      const cleanForces = {};
      Object.keys(member.forces || {}).forEach(uid => {
        const cnt = Math.max(0, Math.floor(Number(member.forces[uid] || 0)));
        if (cnt > 0 && this.isCombatUnit(uid)) {
          cleanForces[uid] = cnt;
        }
      });
      return {
        countryId: member.country ? member.country.id : member.countryId,
        countryName: member.country ? member.country.name : (member.countryName || ""),
        forces: cleanForces
      };
    });
  }

  static deserializeCoalition(serializedList, world) {
    world = world || window.currentWorld;
    const countries = (world && Array.isArray(world.countries)) ? world.countries : [];
    const result = [];
    (serializedList || []).forEach(item => {
      const c = countries.find(x => String(x.id) === String(item.countryId));
      if (c) {
        const cleanForces = (window.WarEngine && typeof window.WarEngine.sanitizeMobilizedForces === "function")
          ? window.WarEngine.sanitizeMobilizedForces(c, item.forces || {})
          : Object.assign({}, item.forces || {});
        result.push({
          country: c,
          forces: cleanForces
        });
      }
    });
    return result;
  }

  /**
   * الانتقال الجماعي إلى مركز الحرب والقتال بعد انتهاء اللاعبين من الشراء
   */
  static onNetworkWarPhaseTriggered(warRequesters, pendingNewYear = true) {
    this.init();
    const world = window.currentWorld;

    if (window.CapitalView && typeof window.CapitalView.close === "function") {
      window.CapitalView.close();
    }

    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

    const dash = document.getElementById("game-dashboard");
    if (dash) dash.classList.add("active");

    const warBtn = document.getElementById("btn-view-war");
    if (warBtn) warBtn.click();

    this.warRequestersQueue = Array.isArray(warRequesters) ? [...warRequesters] : [];
    this.pendingNewYearAfterWar = !!pendingNewYear;

    this.advanceToNextWarRequesterOrFinish();
  }

  static advanceToNextWarRequesterOrFinish() {
    const world = window.currentWorld;
    const countries = (world && Array.isArray(world.countries)) ? world.countries : [];

    while (this.warRequestersQueue && this.warRequestersQueue.length > 0) {
      const nextReq = this.warRequestersQueue[0];
      const atkCountry = countries.find(c => String(c.id) === String(nextReq.countryId));
      if (atkCountry) {
        this.activeWarState = {
          phase: "SELECTING_ATTACK",
          attackerCountryId: atkCountry.id,
          attackerPlayerId: nextReq.playerId || atkCountry.ownerPlayerId || null,
          attackerPlayerName: nextReq.playerName || atkCountry.ownerPlayerName || atkCountry.name,
          defenderCountryId: null,
          defenderPlayerId: null,
          battleResultApplied: false
        };

        this.render(world);

        // إذا كان هذا اللاعب هو من طلب القتال (أو في اللعب الفردي)، افتح له نافذة اختيار الدولة والجنود تلقائياً
        const isMp = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());
        const myPid = window.NetworkEngine ? window.NetworkEngine.getLocalPlayerId() : null;
        const myCid = window.NetworkEngine ? window.NetworkEngine.getMyCountryId() : null;
        const isMyAttackTurn = !isMp ||
          (myPid && String(this.activeWarState.attackerPlayerId) === String(myPid)) ||
          (myCid && String(atkCountry.id) === String(myCid)) ||
          (window.NetworkEngine && window.NetworkEngine.canControlCountry(atkCountry.id));

        if (isMyAttackTurn && countries.length >= 2) {
          setTimeout(() => {
            this.openMobilizationModal(atkCountry, world);
          }, 250);
        }
        return;
      } else {
        this.warRequestersQueue.shift();
      }
    }

    // انتهت جميع الحروب المسجلة في هذه الجولة
    this.activeWarState = {
      phase: "IDLE",
      attackerCountryId: null,
      attackerPlayerId: null,
      defenderCountryId: null,
      defenderPlayerId: null,
      battleResultApplied: false
    };

    if (this.pendingNewYearAfterWar) {
      this.pendingNewYearAfterWar = false;
      this.completeWarPhaseAndAdvanceYear();
    } else {
      this.render(world);
    }
  }

  static completeWarPhaseAndAdvanceYear() {
    const isMp = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());
    if (isMp && window.NetworkEngine && typeof window.NetworkEngine.completeWarPhaseToNewYear === "function") {
      window.NetworkEngine.completeWarPhaseToNewYear();
      return;
    }

    if (window.currentWorld && typeof window.currentWorld.advanceYear === "function") {
      window.currentWorld.advanceYear();
      if (window.GameSFX && typeof window.GameSFX.newYear === "function") {
        window.GameSFX.newYear();
      }
      if (window.NetworkEngine && typeof window.NetworkEngine.refreshAllGameViews === "function") {
        window.NetworkEngine.refreshAllGameViews();
      } else if (typeof window.renderNationsTable === "function") {
        window.renderNationsTable();
      }
      this.notify(`🌟 انتهت مرحلة الحرب وانطلقت السنة المالية ${window.currentWorld.year}م! يمكنك الآن استكمال الشراء والبناء.`, "💰");

      // إعادة اللاعب إلى عاصمته أو جدول الدول لاستكمال اللعب
      const myCid = window.NetworkEngine ? window.NetworkEngine.getMyCountryId() : null;
      const myCountry = (myCid && window.currentWorld.countries.find(c => String(c.id) === String(myCid))) ||
        window.currentViewingCountry ||
        window.currentWorld.countries[0];
      if (myCountry && window.CapitalView && typeof window.CapitalView.open === "function") {
        window.CapitalView.open(myCountry);
      } else {
        const tblBtn = document.getElementById("btn-view-table");
        if (tblBtn) tblBtn.click();
      }
    }
  }

  /**
   * توليد دولة خصم مسلحة جاهزة للمعركة بكبسة زر (للاعب المنفرد أو لاختبار الجيوش فوراً)
   */
  static spawnArmedRivalNation(world) {
    world = world || window.currentWorld;
    if (!world) return null;

    const rivalNames = [
      "إمبراطورية الشمال", "تحالف الصقور", "جمهورية الحديد",
      "مملكة الشرق", "اتحاد العواصف", "دولة الرعد السيادية"
    ];
    const existingNames = (world.countries || []).map(c => c.name);
    let chosenName = rivalNames.find(n => !existingNames.includes(n)) || ("دولة الخصم " + ((world.countries ? world.countries.length : 1) + 1));

    const palette = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#ffffff", "#111111"];
    const c1 = palette[Math.floor(Math.random() * 6)];
    const c2 = "#ffffff";
    const c3 = palette[(Math.floor(Math.random() * 6) + 2) % 6];
    const flagColors = [c1, c1, c1, c1, c2, "#fbbf24", "#fbbf24", c2, c3, c3, c3, c3];

    let rival = null;
    if (window.Country) {
      rival = new window.Country(chosenName, flagColors);
    } else {
      rival = {
        id: "rival_" + Date.now(),
        name: chosenName,
        flag: flagColors,
        stage: 1,
        stageName: "النشأة والتأسيس",
        population: 80,
        employed: 24,
        unemployed: 56,
        budget: 250,
        disposableRevenue: 500,
        bank: 400,
        worldBankFund: 150,
        generalIndex: 15,
        currencyValue: 1.2,
        area: 12,
        buildings: window.BuildingsEngine ? window.BuildingsEngine.createDefaultBuildings() : {},
        sectors: window.SectorsEngine ? window.SectorsEngine.createDefaultSectors() : {},
        energy: {},
        military: window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {}, totalPower: 0 }
      };
    }

    rival.population = 80;
    rival.buildings = rival.buildings || {};
    rival.buildings.house = 20;
    rival.bank = 500;
    rival.worldBankFund = 200;
    rival.disposableRevenue = 450;
    rival.militaryColor = c1;
    rival.isAI = true;

    if (!rival.military) {
      rival.military = window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {} };
    }
    if (!rival.military.inventory) rival.military.inventory = {};

    rival.military.inventory["infantry_def"] = 4;
    rival.military.inventory["infantry_atk"] = 3;
    rival.military.inventory["small_tank"] = 2;
    rival.military.inventory["armored_carrier"] = 2;
    rival.military.inventory["war_corvette"] = 1;

    if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
      window.MilitaryEngine.syncCountryWithMilitary(rival);
    } else if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(rival);
    }

    if (typeof world.addCountry === "function") {
      world.addCountry(rival);
    } else if (Array.isArray(world.countries)) {
      world.countries.push(rival);
    }

    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      window.NetworkEngine.syncCountryChanges(rival);
    }

    if (typeof window.renderNationsTable === "function") {
      window.renderNationsTable();
    }

    this.notify("تم تأسيس وتسليح [" + chosenName + "] بنجاح! يمكنك الآن اختيارها ومحاربتها.", "⚔️");
    this.render(world);
    return rival;
  }

  static render(world) {
    this.bindGlobalEvents();

    const container = document.getElementById("war-content-wrapper");
    if (!container) return;

    world = world || window.currentWorld;
    if (!world) {
      container.innerHTML = `<div style="text-align:center; padding:24px; color:#fde68a;">لم يتم تحميل بيانات العالم بعد.</div>`;
      return;
    }

    const countries = (typeof world.getAllCountries === "function") ? world.getAllCountries() : (world.countries || []);

    if (countries.length < 2) {
      container.innerHTML = `
        <div style="background:linear-gradient(180deg, #281c44 0%, #19112e 100%); border:2px solid #f59e0b; border-radius:16px; padding:24px 18px; text-align:center; margin:10px auto; max-width:640px; box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <div style="font-size:2.8rem; margin-bottom:8px;">⚔️</div>
          <h3 style="color:#fde047; font-size:1.15rem; margin-bottom:8px;">مركز الحرب والقتال — يلزم وجود دولتين على الأقل لخوض المعركة</h3>
          <p style="color:#e2e8f0; font-size:0.86rem; line-height:1.6; margin-bottom:16px;">
            يوجد حالياً (${countries.length}) دولة فقط في العالم. يمكنك إضافة دولة خصم مسلحة فوراً للتجربة والقتال، أو تأسيس دولة ثانية:
          </p>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button type="button" id="btn-war-spawn-rival" class="btn btn-danger" style="font-weight:900;">
              🤖 + إضافة دولة خصم مسلحة للمعركة فوراً
            </button>
            <button type="button" id="btn-war-create-second-nation" class="btn btn-primary" style="font-weight:900;">
              🏰 + تأسيس دولة جديدة يدوياً
            </button>
            ${this.pendingNewYearAfterWar ? `
              <button type="button" id="btn-war-skip-to-newyear-empty" class="btn btn-accent" style="font-weight:900;">
                🌟 تخطي الحرب والانتقال للسنة الجديدة ➔
              </button>
            ` : ''}
          </div>
        </div>
      `;

      const btnSpawn = document.getElementById("btn-war-spawn-rival");
      if (btnSpawn) {
        btnSpawn.onclick = () => this.spawnArmedRivalNation(world);
      }

      const btnCreate = document.getElementById("btn-war-create-second-nation");
      if (btnCreate) {
        btnCreate.onclick = () => {
          if (typeof window.openCreateCountryModal === "function") {
            window.openCreateCountryModal();
          }
        };
      }

      const btnSkipEmpty = document.getElementById("btn-war-skip-to-newyear-empty");
      if (btnSkipEmpty) {
        btnSkipEmpty.onclick = () => {
          this.warRequestersQueue = [];
          this.advanceToNextWarRequesterOrFinish();
        };
      }
      return;
    }

    // شريط الحالة التفاعلي لمرحلة مركز الحرب والقتال
    let phaseBannerHtml = "";
    const state = this.activeWarState || { phase: "IDLE" };
    const isMp = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());
    const myPid = window.NetworkEngine ? window.NetworkEngine.getLocalPlayerId() : null;
    const myCid = window.NetworkEngine ? window.NetworkEngine.getMyCountryId() : null;

    if (state.phase === "SELECTING_ATTACK" && state.attackerCountryId) {
      const atkC = countries.find(c => String(c.id) === String(state.attackerCountryId));
      const isMeAttacker = !isMp ||
        (myPid && String(state.attackerPlayerId) === String(myPid)) ||
        (myCid && String(state.attackerCountryId) === String(myCid)) ||
        (atkC && window.NetworkEngine && window.NetworkEngine.canControlCountry(atkC.id));

      phaseBannerHtml = `
        <div style="background:linear-gradient(90deg, rgba(225, 29, 72, 0.25), rgba(15, 23, 42, 0.95)); border:2px solid #fb7185; border-radius:14px; padding:12px 16px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; box-shadow:0 6px 20px rgba(225,29,72,0.25);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.8rem;">🚨</span>
            <div>
              <h4 style="color:#fda4af; margin:0 0 3px 0; font-size:0.96rem;">
                ${isMeAttacker
                  ? `⚔️ دورك الهجومي الآن يا قائد [${atkC ? atkC.name : ''}]: اختر الدولة المستهدفة والجنود للغزو!`
                  : `⏳ مركز الحرب والقتال: القائد [${state.attackerPlayerName || (atkC ? atkC.name : '')}] يختار الآن الدولة المستهدفة ويجهز جيش الغزو...`}
              </h4>
              <p style="color:#e2e8f0; margin:0; font-size:0.78rem;">
                ${isMeAttacker
                  ? `اضغط على زر (اختيار الدولة والجنود للغزو) لفتح نافذة الحشد، أو اضغط تخطي للانتقال للسنة الجديدة.`
                  : `ستظهر المعركة أو رسالة التحذير تلقائياً فور تثبيت المهاجم لجيشه.`}
              </p>
            </div>
          </div>
          ${isMeAttacker && atkC ? `
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" id="btn-banner-open-attack-modal" class="btn btn-danger btn-sm">
                🎯 اختيار الدولة والجنود للغزو ➔
              </button>
              <button type="button" id="btn-banner-skip-war" class="btn btn-secondary btn-sm">
                ⏭️ إلغاء الحرب والانتقال للسنة الجديدة
              </button>
            </div>
          ` : ''}
        </div>
      `;
    } else if (state.phase === "WAITING_DEFENDER" && state.attackerCountryId && state.defenderCountryId) {
      const atkC = countries.find(c => String(c.id) === String(state.attackerCountryId));
      const defC = countries.find(c => String(c.id) === String(state.defenderCountryId));
      const isMeDefender = !isMp ||
        (myPid && String(state.defenderPlayerId) === String(myPid)) ||
        (myCid && String(state.defenderCountryId) === String(myCid)) ||
        (defC && window.NetworkEngine && window.NetworkEngine.canControlCountry(defC.id));

      phaseBannerHtml = `
        <div style="background:linear-gradient(90deg, rgba(245, 158, 11, 0.25), rgba(15, 23, 42, 0.95)); border:2px solid #fbbf24; border-radius:14px; padding:12px 16px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.8rem;">📣</span>
            <div>
              <h4 style="color:#fde047; margin:0 0 3px 0; font-size:0.96rem;">
                🚨 جيش دولة [${atkC ? atkC.name : 'المهاجم'}] يتجه لغزو دولة [${defC ? defC.name : 'المدافع'}]!
              </h4>
              <p style="color:#e2e8f0; margin:0; font-size:0.78rem;">
                ${isMeDefender
                  ? `⚠️ دولتك مستهدفة! افتح نافذة القرار لاختيار: (الاستسلام) أو (دفع الجزية) أو (الحرب واختيار جيش الدفاع).`
                  : `⏳ بانتظار قائد دولة [${defC ? defC.name : 'المدافع'}] لاختيار رده (الاستسلام / دفع الجزية / خوض الحرب)...`}
              </p>
            </div>
          </div>
          ${isMeDefender ? `
            <button type="button" id="btn-banner-reopen-defender-modal" class="btn btn-danger btn-sm">
              🛡️ فتح نافذة الرد على الغزو (الخيارات الثلاثة) ➔
            </button>
          ` : ''}
        </div>
      `;
    }

    let html = `
      ${phaseBannerHtml}
      <div style="background:linear-gradient(180deg, #281c44 0%, #19112e 100%); border:1.5px solid #4a3b6e; border-radius:12px; padding:10px 14px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.5rem;">⚔️</span>
          <div>
            <h3 style="color:#fde047; margin:0; font-size:0.98rem;">مركز الحرب والقتال — البيانات العسكرية المترابطة لكافة الدول</h3>
            <p style="color:#cbd5e1; margin:0; font-size:0.76rem;">يعرض الأعداد الحقيقية للجنود والآليات القتالية (1:1) لكل دولة، ومن هنا يختار المهاجم الدولة المستهدفة وجنود الغزو.</p>
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="btn-war-header-spawn-rival" class="btn btn-secondary btn-sm" title="إضافة دولة منافسة مسلحة">🤖 + دولة خصم مسلحة</button>
          ${this.pendingNewYearAfterWar ? `
            <button type="button" id="btn-war-header-finish-phase" class="btn btn-primary btn-sm">🌟 إنهاء الحرب والانتقال للسنة الجديدة ➔</button>
          ` : ''}
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:12px;">
    `;

    countries.forEach(c => {
      if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
        window.MilitaryEngine.refreshMilitaryStats(c);
      }

      const milPower = window.WarEngine ? window.WarEngine.getStandingArmyPower(c) : Number(c.military?.totalPower || 0);
      const armyColor = window.WarEngine ? window.WarEngine.getCountryMilitaryColor(c) : (c.militaryColor || "#3182ce");
      const totalStandingUnits = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;

      const groundCount = this.countBranchUnits(c, "ground");
      const navalCount = this.countBranchUnits(c, "naval");
      const airCount = this.countBranchUnits(c, "air");
      const defenseCount = this.countBranchUnits(c, "defense");

      const canControlThis = !isMp || (window.NetworkEngine && window.NetworkEngine.canControlCountry(c.id));
      const isHighlightedAttacker = state.phase === "SELECTING_ATTACK" && String(state.attackerCountryId) === String(c.id);

      const ownedUnitsSummary = this.getOwnedUnitsSummaryList(c);
      let combatCrewCount = 0;
      ownedUnitsSummary.forEach(item => { combatCrewCount += item.crewTotal; });

      html += `
        <div class="war-country-card" style="background:linear-gradient(180deg, #24193d 0%, #160f29 100%); border:${isHighlightedAttacker ? '2.5px solid #fb7185' : '1.5px solid #4a3b6e'}; border-top:4px solid ${armyColor}; border-radius:14px; padding:12px; box-shadow:${isHighlightedAttacker ? '0 0 20px rgba(244,63,94,0.35)' : '0 6px 14px rgba(0,0,0,0.4)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="table-flag" id="w-flag-${c.id}" data-flag-country="${c.id}"></div>
              <div>
                <strong style="font-size:0.98rem; color:#fffbeb; display:block;">
                  ${c.name}
                  ${isHighlightedAttacker ? `<span class="badge badge-danger" style="font-size:0.65rem; padding:1px 6px;">⚔️ طالب القتال</span>` : ''}
                </strong>
                <span style="font-size:0.74rem; font-weight:800; color:${totalStandingUnits > 0 ? '#34d399' : '#fb7185'};">
                  ${totalStandingUnits > 0 ? `✅ الوحدات المقاتلة: ${totalStandingUnits} (${combatCrewCount} جندي مقاتل)` : '⚠️ لا تمتلك وحدات مقاتلة بعد'}
                </span>
              </div>
            </div>
            <div style="text-align:center; border:1.5px solid ${armyColor}; padding:3px 8px; border-radius:8px; background:rgba(15,10,28,0.65);">
              <span style="font-size:0.66rem; color:#fde68a; display:block;">القوة القتالية</span>
              <strong style="color:${armyColor}; font-size:0.95rem;">${milPower.toLocaleString()}</strong>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; background:rgba(15,10,28,0.65); padding:6px 8px; border-radius:8px; margin-bottom:8px; border:1px solid #352659; font-size:0.72rem; text-align:center;">
            <div>
              <span style="color:#94a3b8; display:block;">💵 السيولة</span>
              <strong style="color:#34d399;">$${Number(c.disposableRevenue || 0).toLocaleString()}</strong>
            </div>
            <div>
              <span style="color:#94a3b8; display:block;">🏦 البنوك</span>
              <strong style="color:#fbbf24;">$${(Number(c.bank || 0) + Number(c.worldBankFund || 0)).toLocaleString()}</strong>
            </div>
            <div>
              <span style="color:#94a3b8; display:block;">👷 متاح للتجنيد</span>
              <strong style="color:#c084fc;">${Math.max(0, Number(c.population || 0) - Number(c.employed || 0))} فرد</strong>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">🛡️ مقاتلات برية</span>
              <strong style="color:#38bdf8;">${groundCount}</strong>
            </div>
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">⚓ مقاتلات بحرية</span>
              <strong style="color:#38bdf8;">${navalCount}</strong>
            </div>
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">✈️ مقاتلات جوية</span>
              <strong style="color:#38bdf8;">${airCount}</strong>
            </div>
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">🚀 دفاع وصواريخ</span>
              <strong style="color:#38bdf8;">${defenseCount}</strong>
            </div>
          </div>

          <div style="background:rgba(9,6,18,0.55); border:1px solid #2e214d; border-radius:8px; padding:6px 8px; margin-bottom:10px; min-height:36px; max-height:66px; overflow-y:auto; font-size:0.72rem; color:#fde68a;">
            ${ownedUnitsSummary.length > 0
              ? `<strong style="color:#cbd5e1;">📋 الوحدات المقاتلة:</strong> ` + ownedUnitsSummary.map(item => `<span style="display:inline-block; background:#1e293b; border:1px solid #334155; border-radius:5px; padding:1px 6px; margin:1px; color:#fffbeb;">${item.name}: <strong style="color:#34d399;">${item.count}</strong> (قوة ${item.power})</span>`).join(" ")
              : `<span style="color:#94a3b8;">لا توجد وحدات مقاتلة في المخزون حالياً — اضغط (🎖️ تسليح) لشراء الجنود والأسلحة.</span>`
            }
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,10,28,0.6); padding:4px 8px; border-radius:8px; margin-bottom:8px; border:1px solid #352659;">
            <span style="font-size:0.72rem; color:#fde68a;">🎨 لون راية الجيش بالميدان:</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:13px; height:13px; border-radius:50%; background:${armyColor}; border:1px solid rgba(255,255,255,0.4);"></span>
              <input type="color" class="w-army-color-picker" data-id="${c.id}" value="${armyColor}" style="width:28px; height:20px; padding:0; border:none; border-radius:4px; cursor:pointer; background:transparent;" title="تغيير لون راية الجيش" />
            </div>
          </div>

          <div style="display:flex; gap:6px;">
            ${canControlThis ? `
              <button type="button" class="btn btn-danger btn-select-attacker" data-id="${c.id}" style="flex:2; padding:7px 10px; font-size:0.82rem;">
                🎯 اختيار الدولة والجنود للغزو ➔
              </button>
              <button type="button" class="btn btn-secondary btn-open-nation-mil" data-id="${c.id}" style="flex:1; padding:7px 8px; font-size:0.78rem;" title="تجنيد وشراء أسلحة لهذه الدولة">
                🎖️ تسليح
              </button>
            ` : `
              <button type="button" class="btn btn-secondary" disabled style="width:100%; padding:7px 10px; font-size:0.78rem;">
                👤 بقيادة: ${c.ownerPlayerName || 'قائد آخر'}
              </button>
            `}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    const btnHeaderSpawn = document.getElementById("btn-war-header-spawn-rival");
    if (btnHeaderSpawn) {
      btnHeaderSpawn.onclick = () => this.spawnArmedRivalNation(world);
    }

    const btnHeaderFinish = document.getElementById("btn-war-header-finish-phase");
    if (btnHeaderFinish) {
      btnHeaderFinish.onclick = () => {
        this.warRequestersQueue = [];
        this.advanceToNextWarRequesterOrFinish();
      };
    }

    const btnBannerOpenAtk = document.getElementById("btn-banner-open-attack-modal");
    if (btnBannerOpenAtk && state.attackerCountryId) {
      btnBannerOpenAtk.onclick = () => {
        const atkC = countries.find(c => String(c.id) === String(state.attackerCountryId));
        if (atkC) this.openMobilizationModal(atkC, world);
      };
    }

    const btnBannerSkip = document.getElementById("btn-banner-skip-war");
    if (btnBannerSkip) {
      btnBannerSkip.onclick = () => {
        if (this.warRequestersQueue && this.warRequestersQueue.length > 0) {
          this.warRequestersQueue.shift();
        }
        this.advanceToNextWarRequesterOrFinish();
      };
    }

    const btnBannerReopenDef = document.getElementById("btn-banner-reopen-defender-modal");
    if (btnBannerReopenDef && this.primaryAttacker && this.primaryDefender) {
      btnBannerReopenDef.onclick = () => {
        this.openGrandWarBriefingModal(this.primaryAttacker, this.primaryDefender, this.attackerCoalition, world);
      };
    }

    countries.forEach(c => {
      const flagBox = document.getElementById(`w-flag-${c.id}`);
      if (flagBox) {
        if (typeof window.renderFlagGridToElement === "function") {
          window.renderFlagGridToElement(flagBox, c.flag, 36, 22);
        } else if (window.FlagEditor && typeof window.FlagEditor.renderFlag === "function") {
          window.FlagEditor.renderFlag(flagBox, c.flag, 36, 22);
        }
      }
    });

    container.querySelectorAll(".w-army-color-picker").forEach(picker => {
      picker.addEventListener("change", (e) => {
        const countryId = e.target.getAttribute("data-id");
        const country = countries.find(c => String(c.id) === String(countryId));
        if (country && window.WarEngine) {
          window.WarEngine.setCountryMilitaryColor(country, e.target.value);
          if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
            window.NetworkEngine.syncCountryChanges(country);
          }
          this.render(world);
        }
      });
    });

    container.querySelectorAll(".btn-select-attacker").forEach(btn => {
      btn.onclick = () => {
        const cId = btn.getAttribute("data-id");
        const attacker = countries.find(c => String(c.id) === String(cId));
        if (attacker) {
          this.openMobilizationModal(attacker, world);
        }
      };
    });

    container.querySelectorAll(".btn-open-nation-mil").forEach(btn => {
      btn.onclick = () => {
        const cId = btn.getAttribute("data-id");
        const targetCountry = countries.find(c => String(c.id) === String(cId));
        if (targetCountry) {
          window.currentViewingCountry = targetCountry;
          document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
          const milScreen = document.getElementById("military-screen");
          if (milScreen) milScreen.classList.add("active");
          if (window.MilitaryView && typeof window.MilitaryView.open === "function") {
            window.MilitaryView.open(targetCountry, () => {
              document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
              const dash = document.getElementById("game-dashboard");
              if (dash) dash.classList.add("active");
              this.render(window.currentWorld);
            });
          }
        }
      };
    });
  }

  static getOwnedUnitsSummaryList(country) {
    const list = [];
    if (!country || !country.military || !country.military.inventory) return list;
    const inv = country.military.inventory;
    Object.keys(inv).forEach(uid => {
      const cnt = Math.max(0, Math.floor(Number(inv[uid] || 0)));
      if (cnt > 0 && this.isCombatUnit(uid)) {
        const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
        if (u) {
          list.push({
            id: uid,
            name: u.name,
            count: cnt,
            crewTotal: (Number(u.crew) || 0) * cnt,
            power: Number(((u.power || 0) * cnt).toFixed(1))
          });
        }
      }
    });
    return list;
  }

  static countBranchUnits(country, branch) {
    let sum = 0;
    if (!country || !country.military) return 0;
    const inv = country.military.inventory || country.military.units || {};

    if (window.MilitaryData && typeof window.MilitaryData.getUnitsByBranch === "function") {
      const units = window.MilitaryData.getUnitsByBranch(branch) || [];
      units.forEach(u => {
        if (this.isCombatUnit(u)) {
          sum += Math.max(0, Math.floor(Number(inv[u.id] || 0)));
        }
      });
    }
    return sum;
  }

  /**
   * نافذة المهاجم: اختيار الدولة التي سيحاربها + اختيار الجنود الذين يريد الغزو بهم + زر الانتقال للحرب
   */
  static openMobilizationModal(attacker, world) {
    this.bindGlobalEvents();
    world = world || window.currentWorld;
    this.primaryAttacker = attacker;
    this.attackerCoalition = [];

    const modal = document.getElementById("modal-war-mobilize");
    if (!modal) return;

    const titleEl = document.getElementById("war-modal-attacker-name");
    if (titleEl) {
      titleEl.textContent = `⚔️ تجهيز الغزو: دولة [${attacker.name}] — اختر الدولة الهدف والجنود`;
    }

    const defenderSelect = document.getElementById("war-target-defender-select");
    const countries = (typeof world.getAllCountries === "function") ? world.getAllCountries() : (world.countries || []);
    const otherCountries = countries.filter(c => String(c.id) !== String(attacker.id));

    if (defenderSelect) {
      defenderSelect.innerHTML = "";
      if (otherCountries.length === 0) {
        defenderSelect.innerHTML = `<option value="">-- لا توجد دولة أخرى حالياً --</option>`;
      } else {
        otherCountries.forEach((c, idx) => {
          if (window.MilitaryEngine) window.MilitaryEngine.refreshMilitaryStats(c);
          const milPower = window.WarEngine ? window.WarEngine.getStandingArmyPower(c) : ((c.military && c.military.totalPower) || 0);
          const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
          const selectedAttr = idx === 0 ? "selected" : "";
          defenderSelect.innerHTML += `<option value="${c.id}" ${selectedAttr}>🎯 ${c.name} — (الجيش المقاتل: ${standing} وحدة | القوة: ${milPower})</option>`;
        });
      }
    }

    let alliesBox = document.getElementById("war-attacker-allies-container");
    if (!alliesBox) {
      alliesBox = document.createElement("div");
      alliesBox.id = "war-attacker-allies-container";
      alliesBox.style.cssText = "background:#0f172a; border:1px solid #334155; border-radius:8px; padding:6px 10px; margin:4px 0; flex-shrink:0;";
      const listParent = document.getElementById("war-mobilize-units-list")?.closest(".form-group-units-scrollable");
      if (listParent && listParent.parentElement) {
        listParent.parentElement.insertBefore(alliesBox, listParent);
      }
    }

    const updateAlliesCheckboxes = () => {
      const currentDefId = defenderSelect ? defenderSelect.value : "";
      const armedAllies = otherCountries.filter(c =>
        String(c.id) !== String(currentDefId) &&
        (window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0) > 0
      );

      let alliesHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:#38bdf8; font-size:0.76rem;">🤝 ضم حلفاء للهجوم المشترك (اختياري):</strong>
          <span style="font-size:0.68rem; color:#94a3b8;">${armedAllies.length > 0 ? `متاح (${armedAllies.length}) دول مسلحة` : 'هجوم منفرد بجيش دولتك'}</span>
        </div>
        <div id="war-attacker-allies-list" style="display:flex; flex-wrap:wrap; gap:5px; max-height:44px; overflow-y:auto;">
      `;

      if (armedAllies.length === 0) {
        alliesHtml += `<span style="font-size:0.72rem; color:#64748b;">(الهجوم منفرد بجيش دولة ${attacker.name})</span>`;
      } else {
        armedAllies.forEach(c => {
          const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
          alliesHtml += `
            <label style="background:#1e293b; padding:2px 8px; border-radius:6px; font-size:0.74rem; cursor:pointer; display:flex; align-items:center; gap:4px; border:1px solid #334155; margin:0;">
              <input type="checkbox" class="chk-attacker-ally" value="${c.id}" />
              <span>${c.name} (${standing} قطعة)</span>
            </label>
          `;
        });
      }
      alliesHtml += `</div>`;
      alliesBox.innerHTML = alliesHtml;
    };

    updateAlliesCheckboxes();
    if (defenderSelect) {
      defenderSelect.onchange = updateAlliesCheckboxes;
    }

    this.renderUnitsSelectorTable("war-mobilize-units-list", attacker, "w-unit-input", true);
    modal.classList.add("active");
  }

  /**
   * جدول اختيار الجنود والوحدات القتالية (للمهاجم أو المدافع) مع شريط حساب لحظي للأعداد والقوة
   * يعرض فقط الوحدات المقاتلة الفعلية (ويستثني المصانع والقواعد اللوجستية غير المقاتلة)
   */
  static renderUnitsSelectorTable(containerId, country, inputClass, defaultFullMobilize = true) {
    const listBody = document.getElementById(containerId);
    if (!listBody) return;
    listBody.innerHTML = "";

    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(country);
    }

    const branches = [
      { id: "ground", name: "🛡️ القوات البرية المقاتلة" },
      { id: "naval", name: "⚓ القوات البحرية المقاتلة" },
      { id: "air", name: "✈️ القوات الجوية المقاتلة" },
      { id: "defense", name: "🚀 الدفاع والصواريخ" }
    ];

    let hasAnyUnit = false;
    const inv = country.military?.inventory || country.military?.units || {};

    // شريط ملخص حي يوضح للمهاجم أو المدافع عدد الجنود المختارين وقوتهم مقارنة بالمتوفر
    const liveSummaryBar = document.createElement("div");
    liveSummaryBar.className = "w-live-mobilize-summary";
    liveSummaryBar.style.cssText = "background:linear-gradient(90deg, #0f172a, #1e1b4b); border:1.5px solid #fbbf24; border-radius:8px; padding:7px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:0.8rem;";
    listBody.appendChild(liveSummaryBar);

    const updateLiveSummary = () => {
      let selectedUnits = 0;
      let selectedPower = 0;
      let selectedCrew = 0;
      const totalOwnedUnits = window.WarEngine ? window.WarEngine.getStandingArmyCount(country) : 0;
      const totalOwnedPower = window.WarEngine ? window.WarEngine.getStandingArmyPower(country) : 0;

      listBody.querySelectorAll(`.${inputClass}`).forEach(inp => {
        const uid = inp.getAttribute("data-id");
        const maxVal = parseInt(inp.getAttribute("max"), 10) || 0;
        const val = Math.min(maxVal, Math.max(0, parseInt(inp.value, 10) || 0));
        if (val > 0 && this.isCombatUnit(uid)) {
          selectedUnits += val;
          const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
          if (u) {
            selectedPower += (Number(u.power) || 0) * val;
            selectedCrew += (Number(u.crew) || 0) * val;
          }
        }
      });

      const modeText = (selectedUnits >= totalOwnedUnits && totalOwnedUnits > 0)
        ? `<span class="badge badge-gold" style="font-size:0.7rem;">🔥 الجيش المقاتل بالكامل (${selectedUnits})</span>`
        : (selectedUnits > 0
          ? `<span class="badge badge-purple" style="font-size:0.7rem;">⚡ قوة مختارة (${selectedUnits})</span>`
          : `<span class="badge badge-danger" style="font-size:0.7rem;">⚠️ لم يتم اختيار جنود (0)</span>`);

      liveSummaryBar.innerHTML = `
        <div>
          <strong style="color:#fde047;">📊 المقاتلون المشاركون بالميدان:</strong>
          <span style="color:#34d399; font-weight:900; margin:0 4px;">${selectedUnits}</span> من أصل <strong>${totalOwnedUnits}</strong> وحدة مقاتلة
          <span style="color:#cbd5e1; font-size:0.74rem;">(${selectedCrew} جندي)</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span>⚔️ القوة المختارة: <strong style="color:#38bdf8;">${Number(selectedPower.toFixed(1)).toLocaleString()}</strong> / ${totalOwnedPower.toLocaleString()}</span>
          ${modeText}
        </div>
      `;
    };

    branches.forEach(br => {
      if (!window.MilitaryData || typeof window.MilitaryData.getUnitsByBranch !== "function") return;
      const units = window.MilitaryData.getUnitsByBranch(br.id) || [];
      // فلترة صارمة: إظهار الوحدات المقاتلة الفعلية فقط واستبعاد المصانع والمنشآت اللوجستية غير المقاتلة
      const owned = units.filter(u => this.isCombatUnit(u) && Math.floor(Number(inv[u.id] || 0)) > 0);

      if (owned.length > 0) {
        hasAnyUnit = true;
        const sectionHeader = document.createElement("div");
        sectionHeader.className = "w-modal-branch-header";
        sectionHeader.textContent = br.name;
        sectionHeader.style.cssText = "background:#1e293b; color:#fde047; padding:4px 8px; font-weight:bold; font-size:0.78rem; margin-top:4px; border-radius:6px;";
        listBody.appendChild(sectionHeader);

        const table = document.createElement("table");
        table.className = "w-mobilize-table";
        table.style.cssText = "width:100%; border-collapse:collapse; margin-bottom:4px; font-size:0.8rem;";
        table.innerHTML = `
          <thead>
            <tr style="background:#131c2e; color:#cbd5e1;">
              <th style="padding:4px 6px; text-align:right;">الجندي / السلاح المقاتل</th>
              <th style="padding:4px 6px; text-align:center;">قوة الوحدة</th>
              <th style="padding:4px 6px; text-align:center;">المتوفر بجيشك</th>
              <th style="padding:4px 6px; text-align:center;">العدد المشارك بالمعركة (1:1)</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");

        owned.forEach(u => {
          const available = Math.max(0, Math.floor(Number(inv[u.id] || 0)));
          const initialVal = defaultFullMobilize ? available : 0;
          const tr = document.createElement("tr");
          tr.style.cssText = "border-bottom:1px solid #1e293b;";
          tr.innerHTML = `
            <td style="padding:4px 6px;">
              <strong style="color:#fffbeb; font-size:0.82rem;">${u.name}</strong>
              <div style="font-size:0.68rem; color:#94a3b8;">طاقم: ${u.crew || 0} جندي | إجمالي قوتها: ${Number(((u.power || 0) * available).toFixed(1))}</div>
            </td>
            <td style="text-align:center; padding:4px 6px;"><span class="badge badge-gold" style="font-size:0.72rem; padding:1px 6px;">${u.power}</span></td>
            <td style="text-align:center; padding:4px 6px;"><strong style="color:#38bdf8; font-size:0.88rem;">${available}</strong></td>
            <td style="text-align:center; padding:4px 6px;">
              <div style="display:flex; gap:4px; justify-content:center; align-items:center;">
                <button type="button" class="btn btn-secondary btn-sm btn-step-minus" data-id="${u.id}" style="padding:2px 7px; font-size:0.75rem;">−</button>
                <input type="number" min="0" max="${available}" value="${initialVal}" class="${inputClass}" data-id="${u.id}" style="width:58px; padding:3px; background:#0f172a; border:1.5px solid #fbbf24; color:#fff; border-radius:6px; text-align:center; font-size:0.84rem; font-weight:900;" />
                <button type="button" class="btn btn-secondary btn-sm btn-step-plus" data-id="${u.id}" data-max="${available}" style="padding:2px 7px; font-size:0.75rem;">+</button>
                <button type="button" class="btn btn-accent btn-sm btn-set-max" data-id="${u.id}" data-max="${available}" style="padding:2px 6px; font-size:0.68rem;">الكل</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });

        listBody.appendChild(table);
      }
    });

    if (!hasAnyUnit) {
      liveSummaryBar.style.display = "none";
      const emptyBox = document.createElement("div");
      emptyBox.style.cssText = "text-align:center; padding:14px; color:#fef3c7; background:rgba(136, 19, 55, 0.28); border:1.5px dashed #fb7185; border-radius:10px; margin:4px 0;";
      emptyBox.innerHTML = `
        <div style="font-size:1.5rem; margin-bottom:4px;">⚠️</div>
        <strong style="color:#fda4af; display:block; margin-bottom:4px; font-size:0.88rem;">دولة [${country.name}] لا تمتلك أي جنود أو وحدات مقاتلة في مخزونها حالياً!</strong>
        <p style="font-size:0.75rem; color:#e2e8f0; margin-bottom:10px;">
          السيولة المتاحة لديك: <strong style="color:#34d399;">$${Number(country.disposableRevenue || 0).toLocaleString()}</strong> | السكان المتاحون للتجنيد: <strong style="color:#c084fc;">${Math.max(0, Number(country.population || 0) - Number(country.employed || 0))} فرد</strong>
        </p>
        <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
          <button type="button" id="btn-quick-emergency-garrison" class="btn btn-military btn-sm">
            ⚡ تجنيد جندي مشاة دفاعية واحد فوراً
          </button>
          <button type="button" id="btn-go-to-military-from-war" class="btn btn-accent btn-sm">
            🎖️ فتح وزارة الدفاع لشراء الجنود والأسلحة
          </button>
        </div>
      `;
      listBody.appendChild(emptyBox);

      const btnQuickGarrison = emptyBox.querySelector("#btn-quick-emergency-garrison");
      if (btnQuickGarrison) {
        btnQuickGarrison.onclick = () => {
          if (!country.military) {
            country.military = window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {} };
          }
          if (!country.military.inventory) country.military.inventory = {};
          country.military.inventory["infantry_def"] = (country.military.inventory["infantry_def"] || 0) + 1;
          if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
            window.MilitaryEngine.syncCountryWithMilitary(country);
          }
          if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
            window.NetworkEngine.syncCountryChanges(country);
          }
          this.notify("تم تجنيد جندي مشاة دفاعية (1) لدولة [" + country.name + "] بنجاح!", "🎖️");
          this.renderUnitsSelectorTable(containerId, country, inputClass, true);
          this.render(window.currentWorld);
        };
      }

      const btnGoMil = emptyBox.querySelector("#btn-go-to-military-from-war");
      if (btnGoMil) {
        btnGoMil.onclick = () => {
          document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
          window.currentViewingCountry = country;
          document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
          const milScreen = document.getElementById("military-screen");
          if (milScreen) milScreen.classList.add("active");
          if (window.MilitaryView && typeof window.MilitaryView.open === "function") {
            window.MilitaryView.open(country);
          }
        };
      }
      return;
    }

    listBody.querySelectorAll(`.${inputClass}`).forEach(inp => {
      inp.addEventListener("input", () => {
        const maxVal = parseInt(inp.getAttribute("max"), 10) || 0;
        let v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 0) v = 0;
        if (v > maxVal) v = maxVal;
        inp.value = v;
        updateLiveSummary();
      });
    });

    listBody.querySelectorAll(".btn-step-minus").forEach(b => {
      b.onclick = () => {
        const uid = b.getAttribute("data-id");
        const inp = listBody.querySelector(`.${inputClass}[data-id="${uid}"]`);
        if (inp) {
          inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) - 1);
          updateLiveSummary();
        }
      };
    });

    listBody.querySelectorAll(".btn-step-plus").forEach(b => {
      b.onclick = () => {
        const uid = b.getAttribute("data-id");
        const max = parseInt(b.getAttribute("data-max"), 10) || 0;
        const inp = listBody.querySelector(`.${inputClass}[data-id="${uid}"]`);
        if (inp) {
          inp.value = Math.min(max, (parseInt(inp.value, 10) || 0) + 1);
          updateLiveSummary();
        }
      };
    });

    listBody.querySelectorAll(".btn-set-max").forEach(b => {
      b.onclick = () => {
        const uid = b.getAttribute("data-id");
        const max = b.getAttribute("data-max");
        const inp = listBody.querySelector(`.${inputClass}[data-id="${uid}"]`);
        if (inp) {
          inp.value = max;
          updateLiveSummary();
        }
      };
    });

    listBody._updateLiveSummary = updateLiveSummary;
    updateLiveSummary();
  }

  /**
   * استقبال إنذار الهجوم عبر الشبكة (أو محلياً) وعرض رسالة التحذير والخيارات الثلاثة للمدافع
   */
  static onNetworkUltimatumReceived(data) {
    this.init();
    const world = window.currentWorld;
    if (!world || !Array.isArray(world.countries)) return;

    const primaryAtk = world.countries.find(c => String(c.id) === String(data.attackerCountryId));
    const primaryDef = world.countries.find(c => String(c.id) === String(data.defenderCountryId));
    if (!primaryAtk || !primaryDef) return;

    const atkCoalition = this.deserializeCoalition(data.atkCoalitionData, world);
    if (atkCoalition.length === 0) {
      atkCoalition.push({ country: primaryAtk, forces: {} });
    }

    this.primaryAttacker = primaryAtk;
    this.primaryDefender = primaryDef;
    this.attackerCoalition = atkCoalition;
    this.attackerMobStatus = data.attackerMobStatus || "FULL";

    this.activeWarState = {
      phase: "WAITING_DEFENDER",
      attackerCountryId: primaryAtk.id,
      attackerPlayerId: data.attackerPlayerId || primaryAtk.ownerPlayerId || null,
      defenderCountryId: primaryDef.id,
      defenderPlayerId: data.defenderPlayerId || primaryDef.ownerPlayerId || null,
      battleResultApplied: false
    };

    // نقل شاشات جميع اللاعبين إلى مركز الحرب والقتال لمتابعة الموقف
    if (window.CapitalView && typeof window.CapitalView.close === "function") {
      window.CapitalView.close();
    }
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const dash = document.getElementById("game-dashboard");
    if (dash) dash.classList.add("active");
    const warBtn = document.getElementById("btn-view-war");
    if (warBtn) warBtn.click();

    this.render(world);
    this.playWarSiren();

    const isMp = !!(window.NetworkEngine && window.NetworkEngine.getRoomId());
    let shouldOpenDefenderModalHere = true;

    if (isMp && window.NetworkEngine) {
      const defOwnerInfo = window.NetworkEngine.getCountryOwnerInfo(primaryDef.id);
      const myPid = window.NetworkEngine.getLocalPlayerId();
      if (defOwnerInfo && defOwnerInfo.isClaimed) {
        shouldOpenDefenderModalHere = defOwnerInfo.isMine;
      } else {
        shouldOpenDefenderModalHere = (String(data.attackerPlayerId) === String(myPid));
      }
    }

    if (shouldOpenDefenderModalHere) {
      this.openGrandWarBriefingModal(primaryAtk, primaryDef, atkCoalition, world);
    } else {
      this.notify(`🚨 جيش [${primaryAtk.name}] يزحف نحو [${primaryDef.name}]! بانتظار رد المدافع...`, "⚔️");
    }
  }

  /**
   * نافذة تحذير المدافع والخيارات الثلاثة الصريحة:
   * 1. الاستسلام
   * 2. دفع الجزية
   * 3. الحرب (مع اختيار جزء من الجيش أو كله)
   */
  static openGrandWarBriefingModal(primaryAtk, primaryDef, atkCoalition, world) {
    this.bindGlobalEvents();
    this.primaryAttacker = primaryAtk;
    this.primaryDefender = primaryDef;
    this.attackerCoalition = atkCoalition;
    this.defenderCoalition = [{ country: primaryDef, forces: {} }];

    const standingDefUnits = window.WarEngine ? window.WarEngine.getStandingArmyCount(primaryDef) : 0;
    const standingDefPower = window.WarEngine ? window.WarEngine.getStandingArmyPower(primaryDef) : 0;
    const modal = document.getElementById("modal-defender-decision");
    if (!modal) return;

    let totalAtkUnits = 0;
    let totalAtkPower = 0;
    let incomingUnitsBreakdown = [];

    atkCoalition.forEach(member => {
      Object.keys(member.forces || {}).forEach(uid => {
        const cnt = Math.max(0, Math.floor(Number(member.forces[uid] || 0)));
        if (cnt > 0 && this.isCombatUnit(uid)) {
          totalAtkUnits += cnt;
          const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
          const uPwr = (u ? (u.power || 1) : 1) * cnt;
          totalAtkPower += uPwr;
          incomingUnitsBreakdown.push(`${u ? u.name : uid} ×${cnt}`);
        }
      });
    });

    const titleEl = document.getElementById("defender-decision-title");
    if (titleEl) {
      titleEl.innerHTML = `🚨 تحذير عاجل: جيش دولة [${primaryAtk.name}] قادم لغزو أراضيك!`;
      titleEl.style.color = "#fb7185";
    }

    const defNameLbl = document.getElementById("defender-country-name-label");
    if (defNameLbl) defNameLbl.textContent = primaryDef.name;

    const countBadge = document.getElementById("war-attacker-units-count-badge");
    if (countBadge) {
      countBadge.textContent = `${totalAtkUnits} وحدة مقاتلة (إجمالي القوة: ${Number(totalAtkPower.toFixed(1)).toLocaleString()})`;
    }

    const incomingDetailsEl = document.getElementById("defender-incoming-army-details");
    if (incomingDetailsEl) {
      incomingDetailsEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:4px;">
          <span>🚩 <strong>الجيش المهاجم القادم:</strong> دولة <strong style="color:#fde047;">${atkCoalition.map(m => m.country.name).join(" + ")}</strong></span>
          <span>🛡️ <strong>جيشك المقاتل المتوفر:</strong> <strong style="color:#38bdf8;">${standingDefUnits} وحدة (قوة: ${standingDefPower.toLocaleString()})</strong></span>
        </div>
        <div style="font-size:0.74rem; color:#cbd5e1; background:rgba(9,13,24,0.65); padding:5px 8px; border-radius:6px; border:1px solid #334155;">
          <strong>تفاصيل القوات الغازية القادمة (1:1):</strong> ${incomingUnitsBreakdown.join(" ، ") || "قوة غزو عسكرية"}
        </div>
      `;
    }

    const tribAmount = window.WarEngine ? window.WarEngine.calculateTributeOfferAmount(primaryDef) : 0;
    const surrenderSavings = Math.max(0, Number(primaryDef.bank || 0)) + Math.max(0, Number(primaryDef.worldBankFund || 0));

    const btnSurrender = document.getElementById("btn-defender-surrender");
    if (btnSurrender) {
      btnSurrender.innerHTML = `🏳️ 1. الاستسلام الفوري <small style="display:block; font-size:0.68rem; font-weight:700; opacity:0.9;">(تسليم المعركة ومصادرة المدخرات $${surrenderSavings.toLocaleString()} وحفظ جيشك)</small>`;
    }

    const btnPayTribute = document.getElementById("btn-defender-pay-tribute");
    if (btnPayTribute) {
      btnPayTribute.innerHTML = `💰 2. دفع الجزية <small style="display:block; font-size:0.68rem; font-weight:700; opacity:0.9;">(دفع $${tribAmount.toLocaleString()} + جزية 20% وإيقاف الغزو فوراً)</small>`;
    }

    let defAlliesBox = document.getElementById("war-defender-allies-container");
    if (!defAlliesBox) {
      defAlliesBox = document.createElement("div");
      defAlliesBox.id = "war-defender-allies-container";
      defAlliesBox.style.cssText = "background:#0f172a; border:1px solid #334155; border-radius:8px; padding:5px 8px; margin:4px 0; flex-shrink:0;";
      const listParent = document.getElementById("defender-mobilize-units-list")?.closest(".form-group-units-scrollable");
      if (listParent && listParent.parentElement) {
        listParent.parentElement.insertBefore(defAlliesBox, listParent);
      }
    }

    const countries = (typeof world.getAllCountries === "function") ? world.getAllCountries() : (world.countries || []);
    const armedDefAllies = countries.filter(c => {
      const isAttackerMember = atkCoalition.some(m => String(m.country.id) === String(c.id));
      const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
      return String(c.id) !== String(primaryDef.id) && !isAttackerMember && standing > 0;
    });

    if (armedDefAllies.length > 0) {
      defAlliesBox.style.display = "block";
      defAlliesBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <strong style="color:#63b3ed; font-size:0.74rem;">🤝 طلب إسناد دفاعي من دول حليفة (اختياري):</strong>
        </div>
        <div id="war-defender-allies-list" style="display:flex; flex-wrap:wrap; gap:4px; max-height:40px; overflow-y:auto;">
          ${armedDefAllies.map(c => {
            const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
            return `
              <label style="background:#1e293b; padding:2px 8px; border-radius:6px; font-size:0.72rem; cursor:pointer; display:flex; align-items:center; gap:4px; border:1px solid #334155; margin:0;">
                <input type="checkbox" class="chk-defender-ally" value="${c.id}" />
                <span>${c.name} (${standing})</span>
              </label>
            `;
          }).join("")}
        </div>
      `;
    } else {
      defAlliesBox.style.display = "none";
    }

    this.renderUnitsSelectorTable("defender-mobilize-units-list", primaryDef, "w-def-unit-input", true);
    modal.classList.add("active");
  }

  /**
   * تنفيذ الخيار الأول للمدافع: الاستسلام الفوري
   */
  static handleDefenderChoiceSurrender() {
    const world = window.currentWorld;
    if (!this.primaryAttacker || !this.primaryDefender || !world) return;

    document.getElementById("modal-defender-decision")?.classList.remove("active");

    const defCoalition = [{ country: this.primaryDefender, forces: {} }];
    const outcome = window.WarEngine.executeDefenderSurrender(this.attackerCoalition, defCoalition, world);

    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      window.NetworkEngine.broadcastWarResolution({
        decisionType: "SURRENDER",
        outcome: outcome,
        atkCoalitionData: this.serializeCoalition(this.attackerCoalition),
        defCoalitionData: this.serializeCoalition(defCoalition)
      });
    } else {
      this.displayPeacefulResolutionReport("SURRENDER", this.attackerCoalition, defCoalition, outcome);
    }
  }

  /**
   * تنفيذ الخيار الثاني للمدافع: دفع الجزية
   */
  static handleDefenderChoicePayTribute() {
    const world = window.currentWorld;
    if (!this.primaryAttacker || !this.primaryDefender || !world) return;

    document.getElementById("modal-defender-decision")?.classList.remove("active");

    const defCoalition = [{ country: this.primaryDefender, forces: {} }];
    const outcome = window.WarEngine.executeDefenderPayTribute(this.attackerCoalition, defCoalition, world);

    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      window.NetworkEngine.broadcastWarResolution({
        decisionType: "PAY_TRIBUTE",
        outcome: outcome,
        atkCoalitionData: this.serializeCoalition(this.attackerCoalition),
        defCoalitionData: this.serializeCoalition(defCoalition)
      });
    } else {
      this.displayPeacefulResolutionReport("PAY_TRIBUTE", this.attackerCoalition, defCoalition, outcome);
    }
  }

  /**
   * عرض التقرير الموحد لجميع اللاعبين في حال الاستسلام أو دفع الجزية
   */
  static onNetworkPeacefulResolution(data) {
    const world = window.currentWorld;
    const atkCoalition = this.deserializeCoalition(data.atkCoalitionData, world);
    const defCoalition = this.deserializeCoalition(data.defCoalitionData, world);
    if (atkCoalition.length === 0 || defCoalition.length === 0) return;

    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    this.displayPeacefulResolutionReport(data.decisionType, atkCoalition, defCoalition, data.outcome);
  }

  static displayPeacefulResolutionReport(decisionType, atkCoalition, defCoalition, outcome) {
    this.activeWarState.phase = "REPORT_SHOWN";
    const leadAtk = atkCoalition[0].country;
    const leadDef = defCoalition[0].country;

    const modal = document.getElementById("modal-battle-report");
    const titleElem = document.getElementById("battle-report-winner-title");
    if (titleElem) {
      if (decisionType === "PAY_TRIBUTE") {
        titleElem.textContent = `💰 دولة [${leadDef.name}] دفعت الجزية لدولة [${leadAtk.name}] وتم إيقاف الحرب!`;
        titleElem.style.color = "#fbbf24";
      } else {
        titleElem.textContent = `🏳️ استسلام رسمي لدولة [${leadDef.name}] أمام جيش [${leadAtk.name}]!`;
        titleElem.style.color = "#34d399";
      }
    }

    let reportContainer = document.getElementById("battle-report-outcome-box");
    if (!reportContainer) {
      reportContainer = document.createElement("div");
      reportContainer.id = "battle-report-outcome-box";
      const lossSection = document.getElementById("report-attacker-loss-text")?.parentElement;
      if (lossSection && lossSection.parentElement) {
        lossSection.parentElement.insertBefore(reportContainer, lossSection);
      }
    }

    reportContainer.innerHTML = `
      <div style="background:#0f172a; border:1.5px solid ${outcome.color || '#34d399'}; border-radius:8px; padding:10px; margin:8px 0;">
        <h4 style="color:${outcome.color || '#34d399'}; margin:0 0 4px 0; font-size:0.92rem;">${outcome.title}</h4>
        <p style="color:#e2e8f0; font-size:0.8rem; margin:0; line-height:1.55;">${outcome.details}</p>
      </div>
    `;

    const atkLossEl = document.getElementById("report-attacker-loss-text");
    if (atkLossEl) {
      atkLossEl.innerHTML = `<strong style="color:#10b981;">🚩 جيش الهجوم (${leadAtk.name}):</strong><br>• لم يتكبد أي خسائر عسكرية.<br>• السيولة الحالية: <strong>$${Number(leadAtk.disposableRevenue || 0).toLocaleString()}</strong>`;
    }

    const defLossEl = document.getElementById("report-defender-loss-text");
    if (defLossEl) {
      defLossEl.innerHTML = `<strong style="color:#ef4444;">🛡️ الدولة المدافعة (${leadDef.name}):</strong><br>• لم تتكبد خسائر في الأرواح أو الآليات.<br>• السيولة المتبقية: <strong>$${Number(leadDef.disposableRevenue || 0).toLocaleString()}</strong>`;
    }

    if (modal) modal.classList.add("active");
    this.render(window.currentWorld);
  }

  /**
   * انطلاق المعركة الميدانية الحية على شاشات جميع اللاعبين في الغرفة في نفس اللحظة
   */
  static onNetworkBattleStart(data) {
    const world = window.currentWorld;
    const atkCoalition = this.deserializeCoalition(data.atkCoalitionData, world);
    const defCoalition = this.deserializeCoalition(data.defCoalitionData, world);
    if (atkCoalition.length === 0 || defCoalition.length === 0) return;

    this.attackerCoalition = atkCoalition;
    this.defenderCoalition = defCoalition;
    this.attackerMobStatus = data.attackerMobStatus || "FULL";
    this.defenderMobStatus = data.defenderMobStatus || "FULL";
    this.activeWarState.phase = "IN_BATTLE";
    this.activeWarState.battleResultApplied = false;

    this.launchBattleScreen(atkCoalition, defCoalition, data.battleSeed || 123456789);
  }

  static launchBattleScreen(atkCoalition, defCoalition, battleSeed) {
    if (window.CapitalView && typeof window.CapitalView.close === "function") {
      window.CapitalView.close();
    }

    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

    const battleScreen = document.getElementById("battle-screen");
    if (battleScreen) battleScreen.classList.add("active");

    const leadAtk = atkCoalition[0].country;
    const leadDef = defCoalition[0].country;

    let totalAtkOwned = 0, totalAtkMob = 0;
    atkCoalition.forEach(m => {
      totalAtkOwned += window.WarEngine.getStandingArmyCount(m.country);
      Object.keys(m.forces || {}).forEach(uid => {
        if (this.isCombatUnit(uid)) {
          totalAtkMob += Math.max(0, Math.floor(Number(m.forces[uid] || 0)));
        }
      });
    });
    this.attackerMobStatus = (totalAtkMob >= totalAtkOwned && totalAtkOwned > 0) ? "FULL" : "PARTIAL";

    let totalDefOwned = 0, totalDefMob = 0;
    defCoalition.forEach(m => {
      totalDefOwned += window.WarEngine.getStandingArmyCount(m.country);
      Object.keys(m.forces || {}).forEach(uid => {
        if (this.isCombatUnit(uid)) {
          totalDefMob += Math.max(0, Math.floor(Number(m.forces[uid] || 0)));
        }
      });
    });
    this.defenderMobStatus = (totalDefMob >= totalDefOwned && totalDefOwned > 0) ? "FULL" : "PARTIAL";

    const atkNameEl = document.getElementById("battle-attacker-name");
    const defNameEl = document.getElementById("battle-defender-name");
    if (atkNameEl) atkNameEl.textContent = `${leadAtk.name} (${totalAtkMob} مقاتل)`;
    if (defNameEl) defNameEl.textContent = `${leadDef.name} (${totalDefMob} مقاتل)`;

    const atkFlag = document.getElementById("battle-attacker-flag");
    const defFlag = document.getElementById("battle-defender-flag");
    if (typeof window.renderFlagGridToElement === "function") {
      if (atkFlag) window.renderFlagGridToElement(atkFlag, leadAtk.flag, 34, 22);
      if (defFlag) window.renderFlagGridToElement(defFlag, leadDef.flag, 34, 22);
    } else if (window.FlagEditor) {
      if (atkFlag) window.FlagEditor.renderFlag(atkFlag, leadAtk.flag, 24, 18);
      if (defFlag) window.FlagEditor.renderFlag(defFlag, leadDef.flag, 24, 18);
    }

    if (!this.battleEngine && window.BattleCanvasEngine) {
      this.battleEngine = new window.BattleCanvasEngine("battle-canvas");
    }

    if (this.battleEngine) {
      this.battleEngine.startCoalitionBattle(atkCoalition, defCoalition, (result) => {
        this.showBattleResults(atkCoalition, defCoalition, result);
      }, battleSeed || Date.now());
    }
  }

  static showBattleResults(atkCoalition, defCoalition, result, isFromNetworkSync = false) {
    if (this.activeWarState && this.activeWarState.battleResultApplied && !isFromNetworkSync) {
      return;
    }
    if (this.activeWarState) {
      this.activeWarState.battleResultApplied = true;
      this.activeWarState.phase = "REPORT_SHOWN";
    }

    if (this.battleEngine && typeof this.battleEngine.stop === "function") {
      this.battleEngine.stop();
    }

    const modal = document.getElementById("modal-battle-report");
    const titleElem = document.getElementById("battle-report-winner-title");
    const leadAtk = atkCoalition[0].country;
    const leadDef = defCoalition[0].country;

    let totalAtkLostUnits = 0, totalAtkLostCrew = 0;
    let totalDefLostUnits = 0, totalDefLostCrew = 0;

    if (!isFromNetworkSync) {
      atkCoalition.forEach(member => {
        const losses = result.attackerLossesByCountry?.[member.country.id] || {};
        const rep = window.WarEngine.applyBattleLosses(member.country, losses);
        totalAtkLostUnits += rep.totalLostUnits;
        totalAtkLostCrew += rep.totalLostCrew;
      });

      defCoalition.forEach(member => {
        const losses = result.defenderLossesByCountry?.[member.country.id] || {};
        const rep = window.WarEngine.applyBattleLosses(member.country, losses);
        totalDefLostUnits += rep.totalLostUnits;
        totalDefLostCrew += rep.totalLostCrew;
      });
    } else {
      totalAtkLostUnits = Number(result.totalAtkLostUnits || 0);
      totalAtkLostCrew = Number(result.totalAtkLostCrew || 0);
      totalDefLostUnits = Number(result.totalDefLostUnits || 0);
      totalDefLostCrew = Number(result.totalDefLostCrew || 0);
    }

    let outcomeSectionHtml = "";
    let outcomeObj = result.outcomeObj || null;

    if (result.winner === "attacker") {
      if (titleElem) {
        titleElem.textContent = `🏆 انتصار كاسح لجيش [${leadAtk.name}] على [${leadDef.name}]!`;
        titleElem.style.color = "#10b981";
      }

      if (!isFromNetworkSync && !outcomeObj) {
        outcomeObj = window.WarEngine.resolveCoalitionPostBattleVictory(
          atkCoalition,
          defCoalition,
          window.currentWorld,
          this.attackerMobStatus,
          this.defenderMobStatus
        );
      }

      if (outcomeObj) {
        outcomeSectionHtml = `
          <div style="background:#0f172a; border:1px solid ${outcomeObj.color}; border-radius:8px; padding:10px; margin:8px 0;">
            <h4 style="color:${outcomeObj.color}; margin:0 0 4px 0; font-size:0.9rem;">${outcomeObj.title}</h4>
            <p style="color:#e2e8f0; font-size:0.78rem; margin:0; line-height:1.5;">${outcomeObj.details}</p>
          </div>
        `;
      }
    } else if (result.winner === "defender") {
      if (titleElem) {
        titleElem.textContent = `🛡️ صمود بطولي وانتصار دفاعي لدولة [${leadDef.name}]!`;
        titleElem.style.color = "#38bdf8";
      }

      outcomeSectionHtml = `
        <div style="background:#0f172a; border:1px solid #38bdf8; border-radius:8px; padding:10px; margin:8px 0;">
          <h4 style="color:#38bdf8; margin:0 0 4px 0; font-size:0.9rem;">🛡️ دحر الغزو وحماية السيادة</h4>
          <p style="color:#e2e8f0; font-size:0.78rem; margin:0; line-height:1.5;">
            تمكن جيش دولة [${leadDef.name}] من صد وسحق الحملة الغازية لدولة [${leadAtk.name}] وحفظ السيادة والمدخرات كاملة.
          </p>
        </div>
      `;

      if (!isFromNetworkSync && window.currentWorld && typeof window.currentWorld.addHistoryEvent === "function") {
        window.currentWorld.addHistoryEvent("political", `دفاع بطولي: تمكن جيش ${leadDef.name} من صد وسحق غزو ${leadAtk.name}.`, window.currentWorld.year);
      }
    } else {
      if (titleElem) {
        titleElem.textContent = `⚖️ استنزاف متبادل لكلا الجيشين!`;
        titleElem.style.color = "#f59e0b";
      }
    }

    if (!isFromNetworkSync && window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      window.NetworkEngine.broadcastBattleFinishedSync({
        winner: result.winner,
        totalAtkLostUnits,
        totalAtkLostCrew,
        totalDefLostUnits,
        totalDefLostCrew,
        outcomeObj,
        atkCoalitionData: this.serializeCoalition(atkCoalition),
        defCoalitionData: this.serializeCoalition(defCoalition)
      });
    }

    let reportContainer = document.getElementById("battle-report-outcome-box");
    if (!reportContainer) {
      reportContainer = document.createElement("div");
      reportContainer.id = "battle-report-outcome-box";
      const lossSection = document.getElementById("report-attacker-loss-text")?.parentElement;
      if (lossSection && lossSection.parentElement) {
        lossSection.parentElement.insertBefore(reportContainer, lossSection);
      }
    }
    reportContainer.innerHTML = outcomeSectionHtml;

    const remAtkUnits = window.WarEngine ? window.WarEngine.getStandingArmyCount(leadAtk) : 0;
    const remAtkPower = window.WarEngine ? window.WarEngine.getStandingArmyPower(leadAtk) : 0;
    const remDefUnits = window.WarEngine ? window.WarEngine.getStandingArmyCount(leadDef) : 0;
    const remDefPower = window.WarEngine ? window.WarEngine.getStandingArmyPower(leadDef) : 0;

    const atkLossEl = document.getElementById("report-attacker-loss-text");
    if (atkLossEl) {
      atkLossEl.innerHTML = `
        <strong style="color:#10b981;">🚩 خسائر جيش الهجوم (${leadAtk.name}):</strong><br>
        • الوحدات المدمرة بالميدان: <strong style="color:#fb7185;">${totalAtkLostUnits}</strong> وحدة<br>
        • الخسائر البشرية: <strong style="color:#fb7185;">${totalAtkLostCrew}</strong> جندي<br>
        • المتبقي في جيش الدولة: <strong style="color:#34d399;">${remAtkUnits} وحدة مقاتلة (قوة: ${remAtkPower})</strong>
      `;
    }

    const defLossEl = document.getElementById("report-defender-loss-text");
    if (defLossEl) {
      defLossEl.innerHTML = `
        <strong style="color:#38bdf8;">🛡️ خسائر جيش الدفاع (${leadDef.name}):</strong><br>
        • الوحدات المدمرة بالميدان: <strong style="color:#fb7185;">${totalDefLostUnits}</strong> وحدة<br>
        • الخسائر البشرية: <strong style="color:#fb7185;">${totalDefLostCrew}</strong> جندي<br>
        • المتبقي في جيش الدولة: <strong style="color:#38bdf8;">${remDefUnits} وحدة مقاتلة (قوة: ${remDefPower})</strong>
      `;
    }

    if (modal) modal.classList.add("active");
  }

  static bindGlobalEvents() {
    const btnAttackerAllOut = document.getElementById("btn-attacker-all-out");
    if (btnAttackerAllOut) {
      btnAttackerAllOut.onclick = () => {
        const listEl = document.getElementById("war-mobilize-units-list");
        document.querySelectorAll("#war-mobilize-units-list .w-unit-input").forEach(inp => {
          inp.value = inp.getAttribute("max") || "0";
        });
        if (listEl && typeof listEl._updateLiveSummary === "function") listEl._updateLiveSummary();
      };
    }

    const btnAttackerClear = document.getElementById("btn-attacker-clear-units");
    if (btnAttackerClear) {
      btnAttackerClear.onclick = () => {
        const listEl = document.getElementById("war-mobilize-units-list");
        document.querySelectorAll("#war-mobilize-units-list .w-unit-input").forEach(inp => {
          inp.value = "0";
        });
        if (listEl && typeof listEl._updateLiveSummary === "function") listEl._updateLiveSummary();
      };
    }

    // زر المهاجم: "الانتقال للحرب" (تثبيت جيش الغزو وإرسال التحذير للمدافع)
    const btnConfirmMobilize = document.getElementById("btn-confirm-mobilize-attack");
    if (btnConfirmMobilize) {
      btnConfirmMobilize.onclick = () => {
        const targetSelect = document.getElementById("war-target-defender-select");
        const defenderId = targetSelect ? targetSelect.value : null;
        if (!defenderId) {
          this.notify("يرجى اختيار الدولة التي تريد محاربتها أولاً!", "⚠️");
          return;
        }

        const countries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];
        const defender = countries.find(c => String(c.id) === String(defenderId));
        if (!defender) {
          this.notify("تعذر العثور على الدولة الهدف!", "⚠️");
          return;
        }

        const rawForces = {};
        document.querySelectorAll("#war-mobilize-units-list .w-unit-input").forEach(inp => {
          const uid = inp.getAttribute("data-id");
          const maxVal = parseInt(inp.getAttribute("max"), 10) || 0;
          const val = Math.min(maxVal, Math.max(0, parseInt(inp.value, 10) || 0));
          if (val > 0 && this.isCombatUnit(uid)) {
            rawForces[uid] = val;
          }
        });

        const forces = (window.WarEngine && typeof window.WarEngine.sanitizeMobilizedForces === "function")
          ? window.WarEngine.sanitizeMobilizedForces(this.primaryAttacker, rawForces)
          : rawForces;

        let totalCount = 0;
        Object.values(forces).forEach(v => { totalCount += Number(v || 0); });

        if (totalCount === 0) {
          this.notify("يرجى اختيار جندي أو وحدة مقاتلة واحدة على الأقل للغزو بها!", "⚠️");
          return;
        }

        const atkCoalition = [{ country: this.primaryAttacker, forces: forces }];
        document.querySelectorAll(".chk-attacker-ally:checked").forEach(chk => {
          const allyId = chk.value;
          if (String(allyId) === String(defenderId)) return;
          const allyCountry = countries.find(c => String(c.id) === String(allyId));
          if (allyCountry) {
            const allyForces = {};
            const inv = allyCountry.military?.inventory || {};
            Object.keys(inv).forEach(uid => {
              if (!this.isCombatUnit(uid)) return;
              const cnt = Math.ceil(Math.floor(Number(inv[uid] || 0)) * 0.5);
              if (cnt > 0) allyForces[uid] = cnt;
            });
            if (Object.keys(allyForces).length > 0) {
              atkCoalition.push({ country: allyCountry, forces: allyForces });
            }
          }
        });

        this.attackerCoalition = atkCoalition;
        this.primaryDefender = defender;

        let totalAtkOwned = 0, totalAtkMob = 0;
        atkCoalition.forEach(m => {
          totalAtkOwned += window.WarEngine.getStandingArmyCount(m.country);
          Object.values(m.forces || {}).forEach(v => totalAtkMob += Number(v || 0));
        });
        this.attackerMobStatus = (totalAtkMob >= totalAtkOwned && totalAtkOwned > 0) ? "FULL" : "PARTIAL";

        document.getElementById("modal-war-mobilize")?.classList.remove("active");

        const ultimatumPayload = {
          attackerCountryId: this.primaryAttacker.id,
          attackerPlayerId: window.NetworkEngine ? window.NetworkEngine.getLocalPlayerId() : null,
          defenderCountryId: defender.id,
          defenderPlayerId: defender.ownerPlayerId || null,
          atkCoalitionData: this.serializeCoalition(atkCoalition),
          attackerMobStatus: this.attackerMobStatus
        };

        if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
          window.NetworkEngine.sendWarUltimatum(ultimatumPayload);
        } else {
          this.onNetworkUltimatumReceived(ultimatumPayload);
        }
      };
    }

    // الخيار 1: الاستسلام
    const btnSurrender = document.getElementById("btn-defender-surrender");
    if (btnSurrender) {
      btnSurrender.onclick = () => {
        if (window.GameSFX) window.GameSFX.playClick();
        this.handleDefenderChoiceSurrender();
      };
    }

    // الخيار 2: دفع الجزية
    const btnPayTribute = document.getElementById("btn-defender-pay-tribute");
    if (btnPayTribute) {
      btnPayTribute.onclick = () => {
        if (window.GameSFX) window.GameSFX.playClick();
        this.handleDefenderChoicePayTribute();
      };
    }

    const btnAllOut = document.getElementById("btn-defender-all-out");
    if (btnAllOut) {
      btnAllOut.onclick = () => {
        const listEl = document.getElementById("defender-mobilize-units-list");
        document.querySelectorAll("#defender-mobilize-units-list .w-def-unit-input").forEach(inp => {
          inp.value = inp.getAttribute("max") || "0";
        });
        if (listEl && typeof listEl._updateLiveSummary === "function") listEl._updateLiveSummary();
      };
    }

    const btnDefClear = document.getElementById("btn-defender-clear-units");
    if (btnDefClear) {
      btnDefClear.onclick = () => {
        const listEl = document.getElementById("defender-mobilize-units-list");
        document.querySelectorAll("#defender-mobilize-units-list .w-def-unit-input").forEach(inp => {
          inp.value = "0";
        });
        if (listEl && typeof listEl._updateLiveSummary === "function") listEl._updateLiveSummary();
      };
    }

    // الخيار 3: الحرب (تأكيد الجيوش المختارة والانتقال لساحة المعركة أمام جميع اللاعبين في الروم)
    const btnConfront = document.getElementById("btn-defender-confront");
    if (btnConfront) {
      btnConfront.onclick = () => {
        if (window.GameSFX) window.GameSFX.playClick();
        const rawDefForces = {};

        document.querySelectorAll("#defender-mobilize-units-list .w-def-unit-input").forEach(inp => {
          const uid = inp.getAttribute("data-id");
          const maxVal = parseInt(inp.getAttribute("max"), 10) || 0;
          const val = Math.min(maxVal, Math.max(0, parseInt(inp.value, 10) || 0));
          if (val > 0 && this.isCombatUnit(uid)) {
            rawDefForces[uid] = val;
          }
        });

        const defForces = (window.WarEngine && typeof window.WarEngine.sanitizeMobilizedForces === "function")
          ? window.WarEngine.sanitizeMobilizedForces(this.primaryDefender, rawDefForces)
          : rawDefForces;

        let count = 0;
        Object.values(defForces).forEach(v => { count += Number(v || 0); });

        if (count === 0) {
          this.notify("للقتال، اختر جندياً أو وحدة مقاتلة واحدة على الأقل من جيشك أو اضغط (تعبئة كامل الجيش)، أو اختر الاستسلام أو دفع الجزية!", "⚠️");
          return;
        }

        const countries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];
        const defCoalition = [{ country: this.primaryDefender, forces: defForces }];
        document.querySelectorAll(".chk-defender-ally:checked").forEach(chk => {
          const allyId = chk.value;
          const allyCountry = countries.find(c => String(c.id) === String(allyId));
          if (allyCountry) {
            const allyForces = {};
            const inv = allyCountry.military?.inventory || {};
            Object.keys(inv).forEach(uid => {
              if (!this.isCombatUnit(uid)) return;
              const cnt = Math.ceil(Math.floor(Number(inv[uid] || 0)) * 0.5);
              if (cnt > 0) allyForces[uid] = cnt;
            });
            if (Object.keys(allyForces).length > 0) {
              defCoalition.push({ country: allyCountry, forces: allyForces });
            }
          }
        });

        this.defenderCoalition = defCoalition;

        let totalDefOwned = 0, totalDefMob = 0;
        defCoalition.forEach(m => {
          totalDefOwned += window.WarEngine.getStandingArmyCount(m.country);
          Object.values(m.forces || {}).forEach(v => totalDefMob += Number(v || 0));
        });
        this.defenderMobStatus = (totalDefMob >= totalDefOwned && totalDefOwned > 0) ? "FULL" : "PARTIAL";

        document.getElementById("modal-defender-decision")?.classList.remove("active");

        const sharedSeed = Math.floor(100000 + Math.random() * 900000000);
        const battleStartPayload = {
          atkCoalitionData: this.serializeCoalition(this.attackerCoalition),
          defCoalitionData: this.serializeCoalition(this.defenderCoalition),
          attackerMobStatus: this.attackerMobStatus,
          defenderMobStatus: this.defenderMobStatus,
          battleSeed: sharedSeed
        };

        if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
          window.NetworkEngine.broadcastBattleStart(battleStartPayload);
        } else {
          this.onNetworkBattleStart(battleStartPayload);
        }
      };
    }

    const btnStart = document.getElementById("btn-start-battle-action");
    if (btnStart) {
      btnStart.onclick = () => {
        this.launchBattleScreen(this.attackerCoalition, this.defenderCoalition, Date.now());
      };
    }

    // إغلاق تقرير المعركة والانتقال لاستكمال اللعب (أو الانتقال للدور/السنة التالية)
    const btnCloseReport = document.getElementById("btn-close-battle-report");
    if (btnCloseReport) {
      btnCloseReport.onclick = () => {
        if (window.GameSFX) window.GameSFX.playClick();
        document.getElementById("modal-battle-report")?.classList.remove("active");
        document.getElementById("battle-screen")?.classList.remove("active");
        document.getElementById("game-dashboard")?.classList.add("active");

        if (this.warRequestersQueue && this.warRequestersQueue.length > 0) {
          this.warRequestersQueue.shift();
        }

        if (this.warRequestersQueue && this.warRequestersQueue.length > 0) {
          this.advanceToNextWarRequesterOrFinish();
        } else if (this.pendingNewYearAfterWar) {
          this.pendingNewYearAfterWar = false;
          this.completeWarPhaseAndAdvanceYear();
        } else {
          this.activeWarState.phase = "IDLE";
          if (typeof window.renderNationsTable === "function") window.renderNationsTable();
          if (window.AnalyticsManager) window.AnalyticsManager.render(window.currentWorld);
          if (window.WorldBankManager) window.WorldBankManager.render(window.currentWorld);
          this.render(window.currentWorld);
        }
      };
    }
  }
}

window.WarView = WarView;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => WarView.init());
} else {
  WarView.init();
}
