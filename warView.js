/**
 * ============================================================================
 * warView.js - واجهة هيئة الأركان المشتركة، حشد التحالفات، وإدارة المعارك (v5.2)
 * ============================================================================
 *
 * الإصلاحات الجذرية لنظام الحرب (v5.2):
 * 1. تفعيل تلقائي ومضمون لـ WarView.init() وربط كافة أزرار النوافذ المنبثقة 100%.
 * 2. التعبئة التلقائية للوحدات المتاحة عند فتح نافذة الحشد الهجومي أو الدفاعي لمنع خطأ (0 قطعة).
 * 3. إضافة أزرار "تعبئة كامل الجيش" و"تصفير" للمهاجم والمدافع، والاختيار التلقائي للدولة الهدف.
 * 4. إضافة خيار "توليد دولة خصم مسلحة فوراً" لمن يلعب بمفرده ويريد خوض الحرب مباشرةً،
 *    وخيار الانتقال السريع لوزارة الدفاع أو تجنيد كتيبة سريعة إذا لم يكن لدى الدولة جيش بعد.
 * 5. منع تداخل الحلفاء مع الدولة المستهدفة، واستبدال نوافذ alert المزعجة بإشعارات اللعبة.
 */

class WarView {
  static init() {
    if (!this.attackerCoalition) this.attackerCoalition = [];
    if (!this.defenderCoalition) this.defenderCoalition = [];
    if (!this.attackerMobStatus) this.attackerMobStatus = "FULL";
    if (!this.defenderMobStatus) this.defenderMobStatus = "FULL";
    if (!this.battleEngine) this.battleEngine = null;

    this.bindGlobalEvents();
    this._isInitialized = true;
  }

  static notify(msg, icon) {
    if (typeof window.showGameToast === "function") {
      window.showGameToast(msg, icon || "⚔️");
    } else {
      alert(msg);
    }
  }

  static calculateMobilizationStatus(country, mobilizedForces) {
    const totalStanding = window.WarEngine ? window.WarEngine.getStandingArmyCount(country) : 0;
    if (totalStanding === 0) return "NO_ARMY";

    let totalMobilized = 0;
    Object.keys(mobilizedForces || {}).forEach(uid => {
      totalMobilized += Number(mobilizedForces[uid] || 0);
    });

    if (totalMobilized === 0) return "NO_ARMY";
    if (totalMobilized >= totalStanding) return "FULL";
    return "PARTIAL";
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
        population: 60,
        employed: 20,
        unemployed: 40,
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
    rival.employed = 24;
    rival.unemployed = 56;
    rival.bank = 500;
    rival.worldBankFund = 200;
    rival.disposableRevenue = 450;
    rival.generalIndex = 18;
    rival.militaryColor = c1;

    if (!rival.military) {
      rival.military = window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {} };
    }
    if (!rival.military.inventory) rival.military.inventory = {};

    // تسليح الدولة الخصم بوحدات متوازنة
    rival.military.inventory["infantry_def"] = 4;
    rival.military.inventory["infantry_atk"] = 3;
    rival.military.inventory["small_tank"] = 2;
    rival.military.inventory["armored_carrier"] = 2;
    rival.military.inventory["war_corvette"] = 1;

    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
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

    this.notify("تم تأسيس وتسليح [" + chosenName + "] بنجاح! يمكنك الآن إعلان الحرب عليها فوراً.", "⚔️");
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
          <h3 style="color:#fde047; font-size:1.15rem; margin-bottom:8px;">يلزم وجود دولتين على الأقل لإعلان الحرب وخوض المعارك</h3>
          <p style="color:#e2e8f0; font-size:0.86rem; line-height:1.6; margin-bottom:16px;">
            يوجد حالياً (${countries.length}) دولة فقط في العالم. يمكنك توليد دولة خصم مسلحة بضغطة زر لخوض معركة فورية، أو تأسيس دولة ثانية بنفسك:
          </p>
          <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button type="button" id="btn-war-spawn-rival" class="btn btn-danger" style="font-weight:900;">
              🤖 + إضافة دولة خصم مسلحة للمعركة فوراً
            </button>
            <button type="button" id="btn-war-create-second-nation" class="btn btn-primary" style="font-weight:900;">
              🏰 + تأسيس دولة جديدة يدوياً
            </button>
          </div>
        </div>
      `;

      const btnSpawn = document.getElementById("btn-war-spawn-rival");
      if (btnSpawn) {
        btnSpawn.onclick = () => {
          this.spawnArmedRivalNation(world);
        };
      }

      const btnCreate = document.getElementById("btn-war-create-second-nation");
      if (btnCreate) {
        btnCreate.onclick = () => {
          if (typeof window.openCreateCountryModal === "function") {
            window.openCreateCountryModal();
          } else {
            const addBtn = document.getElementById("btn-add-nation");
            if (addBtn) addBtn.click();
          }
        };
      }
      return;
    }

    let html = `
      <div style="background:linear-gradient(180deg, #281c44 0%, #19112e 100%); border:1.5px solid #4a3b6e; border-radius:12px; padding:10px 14px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:1.5rem;">⚔️</span>
          <div>
            <h3 style="color:#fde047; margin:0; font-size:0.98rem;">هيئة الأركان المشتركة وغرفة العمليات الحربية</h3>
            <p style="color:#cbd5e1; margin:0; font-size:0.76rem;">اختر الدولة المهاجمة لحشد جيشها أو افتح وزارة الدفاع لتجنيد قوات جديدة.</p>
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <button type="button" id="btn-war-header-spawn-rival" class="btn btn-secondary btn-sm" title="إضافة دولة منافسة مسلحة">🤖 + دولة خصم مسلحة</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
    `;

    countries.forEach(c => {
      if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
        window.MilitaryEngine.refreshMilitaryStats(c);
      }

      const mil = c.military || {};
      const milPower = (typeof mil.totalPower === "number") ? mil.totalPower : (Number(c.militaryPower) || 0);
      const armyColor = window.WarEngine ? window.WarEngine.getCountryMilitaryColor(c) : (c.militaryColor || "#3182ce");
      const totalStandingUnits = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;

      const groundCount = this.countBranchUnits(c, "ground");
      const navalCount = this.countBranchUnits(c, "naval");
      const airCount = this.countBranchUnits(c, "air");
      const defenseCount = this.countBranchUnits(c, "defense");

      html += `
        <div class="war-country-card" style="background:linear-gradient(180deg, #24193d 0%, #160f29 100%); border:1.5px solid #4a3b6e; border-top:4px solid ${armyColor}; border-radius:14px; padding:12px; box-shadow:0 6px 14px rgba(0,0,0,0.4);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="table-flag" id="w-flag-${c.id}" data-flag-country="${c.id}"></div>
              <div>
                <strong style="font-size:0.98rem; color:#fffbeb; display:block;">${c.name}</strong>
                <span style="font-size:0.74rem; font-weight:800; color:${totalStandingUnits > 0 ? '#34d399' : '#fb7185'};">
                  ${totalStandingUnits > 0 ? `✅ الترسانة: ${totalStandingUnits} قطعة` : '⚠️ لا تمتلك جيشاً بعد'}
                </span>
              </div>
            </div>
            <div style="text-align:center; border:1.5px solid ${armyColor}; padding:3px 8px; border-radius:8px; background:rgba(15,10,28,0.65);">
              <span style="font-size:0.66rem; color:#fde68a; display:block;">القوة العسكرية</span>
              <strong style="color:${armyColor}; font-size:0.95rem;">${milPower.toLocaleString()}</strong>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(15,10,28,0.6); padding:5px 8px; border-radius:8px; margin-bottom:10px; border:1px solid #352659;">
            <span style="font-size:0.75rem; color:#fde68a;">🎨 لون راية الجيش بالميدان:</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:13px; height:13px; border-radius:50%; background:${armyColor}; border:1px solid rgba(255,255,255,0.4);"></span>
              <input type="color" class="w-army-color-picker" data-id="${c.id}" value="${armyColor}" style="width:28px; height:22px; padding:0; border:none; border-radius:4px; cursor:pointer; background:transparent;" title="تغيير لون راية الجيش" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px;">
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">🛡️ برية</span>
              <strong style="color:#38bdf8;">${groundCount}</strong>
            </div>
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">⚓ بحرية</span>
              <strong style="color:#38bdf8;">${navalCount}</strong>
            </div>
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">✈️ جوية</span>
              <strong style="color:#38bdf8;">${airCount}</strong>
            </div>
            <div style="background:rgba(15,10,28,0.55); padding:5px 8px; border-radius:7px; border:1px solid #352659; display:flex; justify-content:space-between; font-size:0.76rem;">
              <span style="color:#cbd5e0;">🚀 دفاع/صواريخ</span>
              <strong style="color:#38bdf8;">${defenseCount}</strong>
            </div>
          </div>

          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-military btn-select-attacker" data-id="${c.id}" style="flex:2; padding:7px 10px; font-size:0.82rem;">
              🎯 حشد وإعلان الحرب ➔
            </button>
            <button type="button" class="btn btn-secondary btn-open-nation-mil" data-id="${c.id}" style="flex:1; padding:7px 8px; font-size:0.78rem;" title="تجنيد وشراء أسلحة لهذه الدولة">
              🎖️ تسليح
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    const btnHeaderSpawn = document.getElementById("btn-war-header-spawn-rival");
    if (btnHeaderSpawn) {
      btnHeaderSpawn.onclick = () => {
        this.spawnArmedRivalNation(world);
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

  static countBranchUnits(country, branch) {
    let sum = 0;
    if (!country || !country.military) return 0;
    const inv = country.military.inventory || country.military.units || {};

    if (window.MilitaryData && typeof window.MilitaryData.getUnitsByBranch === "function") {
      const units = window.MilitaryData.getUnitsByBranch(branch) || [];
      units.forEach(u => {
        sum += Number(inv[u.id] || 0);
      });
    }
    return sum;
  }

  static openMobilizationModal(attacker, world) {
    this.bindGlobalEvents();
    world = world || window.currentWorld;
    this.primaryAttacker = attacker;
    this.attackerCoalition = [];

    const modal = document.getElementById("modal-war-mobilize");
    if (!modal) return;

    const titleEl = document.getElementById("war-modal-attacker-name");
    if (titleEl) {
      titleEl.textContent = `⚔️ غرفة العمليات: حشد جيش دولة [${attacker.name}]`;
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
          const milPower = (c.military && c.military.totalPower) || c.militaryPower || 0;
          const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
          const selectedAttr = idx === 0 ? "selected" : "";
          defenderSelect.innerHTML += `<option value="${c.id}" ${selectedAttr}>🎯 ${c.name} — (القوة: ${milPower} | الترسانة: ${standing} قطعة)</option>`;
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
          <strong style="color:#38bdf8; font-size:0.76rem;">🤝 ضم حلفاء للهجوم المشترك:</strong>
          <span style="font-size:0.68rem; color:#94a3b8;">${armedAllies.length > 0 ? `متاح (${armedAllies.length}) دول مسلحة` : 'لا يوجد حلفاء مسلحون إضافيون'}</span>
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

  static renderUnitsSelectorTable(containerId, country, inputClass, defaultFullMobilize = true) {
    const listBody = document.getElementById(containerId);
    if (!listBody) return;
    listBody.innerHTML = "";

    const branches = [
      { id: "ground", name: "🛡️ القوات البرية" },
      { id: "naval", name: "⚓ القوات البحرية" },
      { id: "air", name: "✈️ القوات الجوية" },
      { id: "defense", name: "🚀 الدفاع والصواريخ" }
    ];

    let hasAnyUnit = false;
    const inv = country.military?.inventory || country.military?.units || {};

    branches.forEach(br => {
      if (!window.MilitaryData || typeof window.MilitaryData.getUnitsByBranch !== "function") return;
      const units = window.MilitaryData.getUnitsByBranch(br.id) || [];
      const owned = units.filter(u => (inv[u.id] || 0) > 0);

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
              <th style="padding:4px 6px; text-align:right;">السلاح والمعدة</th>
              <th style="padding:4px 6px; text-align:center;">القوة</th>
              <th style="padding:4px 6px; text-align:center;">المملوك</th>
              <th style="padding:4px 6px; text-align:center;">المشارك بالمعركة</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");

        owned.forEach(u => {
          const available = Number(inv[u.id] || 0);
          const initialVal = defaultFullMobilize ? available : 0;
          const tr = document.createElement("tr");
          tr.style.cssText = "border-bottom:1px solid #1e293b;";
          tr.innerHTML = `
            <td style="padding:4px 6px;">
              <strong style="color:#fffbeb; font-size:0.82rem;">${u.name}</strong>
              <div style="font-size:0.68rem; color:#94a3b8;">طاقم: ${u.crew || 0} | وقود: ${u.fuel || 0} | ذخيرة: ${u.ammo || 0}</div>
            </td>
            <td style="text-align:center; padding:4px 6px;"><span class="badge badge-gold" style="font-size:0.72rem; padding:1px 6px;">${u.power}</span></td>
            <td style="text-align:center; padding:4px 6px;"><strong style="color:#38bdf8; font-size:0.84rem;">${available}</strong></td>
            <td style="text-align:center; padding:4px 6px;">
              <div style="display:flex; gap:4px; justify-content:center; align-items:center;">
                <input type="number" min="0" max="${available}" value="${initialVal}" class="${inputClass}" data-id="${u.id}" style="width:62px; padding:3px; background:#0f172a; border:1.5px solid #fbbf24; color:#fff; border-radius:6px; text-align:center; font-size:0.84rem; font-weight:900;" />
                <button type="button" class="btn btn-secondary btn-sm btn-set-max" data-id="${u.id}" data-max="${available}" style="padding:2px 6px; font-size:0.68rem;">الكل</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });

        listBody.appendChild(table);
      }
    });

    if (!hasAnyUnit) {
      listBody.innerHTML = `
        <div style="text-align:center; padding:14px; color:#fef3c7; background:rgba(136, 19, 55, 0.28); border:1.5px dashed #fb7185; border-radius:10px; margin:4px 0;">
          <div style="font-size:1.5rem; margin-bottom:4px;">⚠️</div>
          <strong style="color:#fda4af; display:block; margin-bottom:4px; font-size:0.88rem;">دولة [${country.name}] لا تمتلك أي وحدات عسكرية مجندة حالياً!</strong>
          <p style="font-size:0.75rem; color:#e2e8f0; margin-bottom:10px;">
            لخوض المعركة، يمكنك تجنيد كتيبة طوارئ سريعة فوراً أو الانتقال إلى وزارة الدفاع لشراء الأسلحة:
          </p>
          <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
            <button type="button" id="btn-quick-emergency-garrison" class="btn btn-military btn-sm">
              ⚡ تجنيد كتيبة سريعة فوراً وخوض الحرب
            </button>
            <button type="button" id="btn-go-to-military-from-war" class="btn btn-accent btn-sm">
              🎖️ فتح وزارة الدفاع والتسليح
            </button>
          </div>
        </div>
      `;

      const btnQuickGarrison = listBody.querySelector("#btn-quick-emergency-garrison");
      if (btnQuickGarrison) {
        btnQuickGarrison.onclick = () => {
          if (!country.military) {
            country.military = window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {} };
          }
          if (!country.military.inventory) country.military.inventory = {};
          country.military.inventory["infantry_def"] = (country.military.inventory["infantry_def"] || 0) + 3;
          country.military.inventory["infantry_atk"] = (country.military.inventory["infantry_atk"] || 0) + 2;
          country.military.inventory["small_tank"] = (country.military.inventory["small_tank"] || 0) + 1;
          if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
            window.MilitaryEngine.refreshMilitaryStats(country);
          }
          this.notify("تم تجهيز كتيبة قتالية لدولة [" + country.name + "] بنجاح!", "🎖️");
          this.renderUnitsSelectorTable(containerId, country, inputClass, true);
          this.render(window.currentWorld);
        };
      }

      const btnGoMil = listBody.querySelector("#btn-go-to-military-from-war");
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
    }

    listBody.querySelectorAll(".btn-set-max").forEach(b => {
      b.onclick = () => {
        const uid = b.getAttribute("data-id");
        const max = b.getAttribute("data-max");
        const inp = listBody.querySelector(`.${inputClass}[data-id="${uid}"]`);
        if (inp) inp.value = max;
      };
    });
  }

  static openGrandWarBriefingModal(primaryAtk, primaryDef, atkCoalition, world) {
    this.bindGlobalEvents();
    this.primaryAttacker = primaryAtk;
    this.primaryDefender = primaryDef;
    this.attackerCoalition = atkCoalition;
    this.defenderCoalition = [{ country: primaryDef, forces: {} }];

    const standingDefUnits = window.WarEngine ? window.WarEngine.getStandingArmyCount(primaryDef) : 0;
    const modal = document.getElementById("modal-defender-decision");
    if (!modal) return;

    let totalAtkUnits = 0;
    let totalAtkPower = 0;
    atkCoalition.forEach(member => {
      Object.keys(member.forces || {}).forEach(uid => {
        const cnt = Number(member.forces[uid] || 0);
        totalAtkUnits += cnt;
        const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
        totalAtkPower += (u ? (u.power || 1) : 1) * cnt;
      });
    });

    const isDefTrulyArmyless = (standingDefUnits === 0);

    const titleEl = document.getElementById("defender-decision-title");
    if (titleEl) {
      titleEl.textContent = isDefTrulyArmyless
        ? `🚨 إنذار استراتيجي: الدولة المستهدفة [${primaryDef.name}] لا تمتلك جيشاً!`
        : `🚨 صفارات الإنذار: حلف عسكري يزحف لاجتياح [${primaryDef.name}]!`;
      titleEl.style.color = isDefTrulyArmyless ? "#f59e0b" : "#ef4444";
    }

    const defNameLbl = document.getElementById("defender-country-name-label");
    if (defNameLbl) defNameLbl.textContent = primaryDef.name;

    const countBadge = document.getElementById("war-attacker-units-count-badge");
    if (countBadge) {
      countBadge.textContent = `${totalAtkUnits} قطعة (القوة: ${totalAtkPower.toLocaleString()})`;
    }

    let atkAlliesInfo = document.getElementById("defender-modal-atk-allies-info");
    if (!atkAlliesInfo && titleEl) {
      atkAlliesInfo = document.createElement("div");
      atkAlliesInfo.id = "defender-modal-atk-allies-info";
      atkAlliesInfo.style.cssText = "background:#09121f; border:1px solid #1e293b; padding:5px 8px; border-radius:6px; margin:4px 0; font-size:0.76rem; flex-shrink:0;";
      const parentNode = titleEl.closest(".modal-header-fixed") || titleEl.parentElement;
      if (parentNode) parentNode.appendChild(atkAlliesInfo);
    }

    if (atkAlliesInfo) {
      let atkNamesHtml = atkCoalition.map(m => `<span class="badge badge-gold" style="margin:1px; font-size:0.72rem;">🚩 ${m.country.name}</span>`).join(" ");
      atkAlliesInfo.innerHTML = `<strong>الجبهة المهاجمة:</strong> ${atkNamesHtml}`;
    }

    let armylessBox = document.getElementById("defender-armyless-choice-box");
    if (!armylessBox) {
      armylessBox = document.createElement("div");
      armylessBox.id = "defender-armyless-choice-box";
      armylessBox.style.cssText = "background:rgba(239, 68, 68, 0.15); border:1.5px dashed #ef4444; padding:10px; border-radius:8px; margin:6px 0; flex-shrink:0;";
      const formBox = document.getElementById("defender-mobilize-units-list")?.closest(".form-group-units-scrollable");
      if (formBox && formBox.parentElement) {
        formBox.parentElement.insertBefore(armylessBox, formBox);
      }
    }

    if (isDefTrulyArmyless) {
      armylessBox.style.display = "block";
      armylessBox.innerHTML = `
        <h4 style="color:#f87171; margin:0 0 4px 0; font-size:0.9rem;">⚠️ الدولة المستهدفة [${primaryDef.name}] لا تمتلك جيشاً للمقاومة!</h4>
        <p style="color:#e2e8f0; font-size:0.78rem; margin:0 0 8px 0;">
          يمكنك فرض الاستسلام ومصادرة المدخرات فوراً، أو تعبئة مقاومة شعبية للدولة المدافعة لخوض معركة ميدانية:
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" id="btn-confirm-peaceful-occupation" class="btn btn-danger btn-sm">
            🚩 فرض الاستسلام ومصادرة المدخرات فوراً
          </button>
          <button type="button" id="btn-spawn-defender-militia" class="btn btn-military btn-sm">
            🛡️ تجنيد مقاومة دفاعية وخوض المعركة الميدانية!
          </button>
        </div>
      `;

      const btnOccupy = document.getElementById("btn-confirm-peaceful-occupation");
      if (btnOccupy) {
        btnOccupy.onclick = () => {
          this.executeArmylessSurrender(atkCoalition, primaryDef, world);
        };
      }

      const btnMilitia = document.getElementById("btn-spawn-defender-militia");
      if (btnMilitia) {
        btnMilitia.onclick = () => {
          if (!primaryDef.military) {
            primaryDef.military = window.MilitaryEngine ? window.MilitaryEngine.createDefaultMilitary() : { inventory: {} };
          }
          if (!primaryDef.military.inventory) primaryDef.military.inventory = {};
          primaryDef.military.inventory["infantry_def"] = 3;
          primaryDef.military.inventory["small_tank"] = 1;
          if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
            window.MilitaryEngine.refreshMilitaryStats(primaryDef);
          }
          this.openGrandWarBriefingModal(primaryAtk, primaryDef, atkCoalition, world);
        };
      }

      const defUnitsWrap = document.getElementById("defender-mobilize-units-list")?.closest(".form-group-units-scrollable");
      if (defUnitsWrap) defUnitsWrap.style.display = "none";
      const confrontBtn = document.getElementById("btn-defender-confront");
      if (confrontBtn) confrontBtn.style.display = "none";
    } else {
      armylessBox.style.display = "none";
      const defUnitsWrap = document.getElementById("defender-mobilize-units-list")?.closest(".form-group-units-scrollable");
      if (defUnitsWrap) defUnitsWrap.style.display = "flex";
      const confrontBtn = document.getElementById("btn-defender-confront");
      if (confrontBtn) confrontBtn.style.display = "inline-flex";

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

      let defAlliesHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <strong style="color:#63b3ed; font-size:0.76rem;">🛡️ نداء الحلفاء للدفاع المشترك:</strong>
          <span style="font-size:0.68rem; color:#94a3b8;">${armedDefAllies.length > 0 ? `متاح (${armedDefAllies.length}) دول` : 'لا يوجد حلفاء مسلحون'}</span>
        </div>
        <div id="war-defender-allies-list" style="display:flex; flex-wrap:wrap; gap:4px; max-height:42px; overflow-y:auto;">
      `;

      if (armedDefAllies.length === 0) {
        defAlliesHtml += `<span style="font-size:0.72rem; color:#64748b;">(دفاع وطني مباشر بقوات ${primaryDef.name})</span>`;
      } else {
        armedDefAllies.forEach(c => {
          const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
          defAlliesHtml += `
            <label style="background:#1e293b; padding:2px 8px; border-radius:6px; font-size:0.74rem; cursor:pointer; display:flex; align-items:center; gap:4px; border:1px solid #334155; margin:0;">
              <input type="checkbox" class="chk-defender-ally" value="${c.id}" />
              <span>${c.name} (${standing})</span>
            </label>
          `;
        });
      }

      defAlliesHtml += `</div>`;
      defAlliesBox.innerHTML = defAlliesHtml;

      this.renderUnitsSelectorTable("defender-mobilize-units-list", primaryDef, "w-def-unit-input", true);
    }

    modal.classList.add("active");
  }

  static executeArmylessSurrender(atkCoalition, armylessDef, world) {
    document.getElementById("modal-defender-decision")?.classList.remove("active");

    const outcome = window.WarEngine.resolveCoalitionPostBattleVictory(
      atkCoalition,
      [{ country: armylessDef, forces: {} }],
      world,
      "FULL",
      "NO_ARMY"
    );

    const modal = document.getElementById("modal-battle-report");
    const titleElem = document.getElementById("battle-report-winner-title");
    if (titleElem) {
      titleElem.textContent = `🏳️ استسلام رسمي لدولة [${armylessDef.name}]!`;
      titleElem.style.color = "#34d399";
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
      <div style="background:#0f172a; border:1px solid #34d399; border-radius:8px; padding:10px; margin:8px 0;">
        <h4 style="color:#34d399; margin:0 0 4px 0; font-size:0.9rem;">${outcome.title}</h4>
        <p style="color:#e2e8f0; font-size:0.78rem; margin:0; line-height:1.5;">${outcome.details}</p>
      </div>
    `;

    const atkLossEl = document.getElementById("report-attacker-loss-text");
    if (atkLossEl) atkLossEl.innerHTML = `<strong style="color:#10b981;">الحلف الغازي:</strong><br>لم يتكبد أي خسائر نظراً لعدم وجود مقاومة.`;
    const defLossEl = document.getElementById("report-defender-loss-text");
    if (defLossEl) defLossEl.innerHTML = `<strong style="color:#ef4444;">الدولة المستهدفة (${armylessDef.name}):</strong><br>خسارة كامل المدخرات النقدية دون خسائر بشرية.`;

    if (modal) modal.classList.add("active");
  }

  static openBattleReview(atkCoalition, defCoalition) {
    this.bindGlobalEvents();
    const modal = document.getElementById("modal-battle-review");
    if (!modal) return;

    const leadAtk = atkCoalition[0].country;
    const leadDef = defCoalition[0].country;

    let totalAtkOwned = 0, totalAtkMob = 0;
    atkCoalition.forEach(m => {
      totalAtkOwned += window.WarEngine.getStandingArmyCount(m.country);
      Object.values(m.forces || {}).forEach(v => totalAtkMob += Number(v || 0));
    });
    this.attackerMobStatus = (totalAtkMob >= totalAtkOwned && totalAtkOwned > 0) ? "FULL" : "PARTIAL";

    let totalDefOwned = 0, totalDefMob = 0;
    defCoalition.forEach(m => {
      totalDefOwned += window.WarEngine.getStandingArmyCount(m.country);
      Object.values(m.forces || {}).forEach(v => totalDefMob += Number(v || 0));
    });
    this.defenderMobStatus = (totalDefMob >= totalDefOwned && totalDefOwned > 0) ? "FULL" : "PARTIAL";

    const atkFlagBox = document.getElementById("review-attacker-flag");
    const defFlagBox = document.getElementById("review-defender-flag");
    if (typeof window.renderFlagGridToElement === "function") {
      if (atkFlagBox) window.renderFlagGridToElement(atkFlagBox, leadAtk.flag, 34, 22);
      if (defFlagBox) window.renderFlagGridToElement(defFlagBox, leadDef.flag, 34, 22);
    } else if (window.FlagEditor) {
      if (atkFlagBox) window.FlagEditor.renderFlag(atkFlagBox, leadAtk.flag, 24, 18);
      if (defFlagBox) window.FlagEditor.renderFlag(defFlagBox, leadDef.flag, 24, 18);
    }

    const atkNames = atkCoalition.map(m => m.country.name).join(" + ");
    const defNames = defCoalition.map(m => m.country.name).join(" + ");

    document.getElementById("review-attacker-name").textContent = `${atkNames} (${this.attackerMobStatus === 'FULL' ? 'حشد كامل' : 'حشد جزئي'})`;
    document.getElementById("review-defender-name").textContent = `${defNames} (${this.defenderMobStatus === 'FULL' ? 'حشد كامل' : 'حشد جزئي'})`;

    const atkList = document.getElementById("review-attacker-forces-list");
    const defList = document.getElementById("review-defender-forces-list");
    atkList.innerHTML = "";
    defList.innerHTML = "";

    atkCoalition.forEach(member => {
      atkList.innerHTML += `<div style="font-weight:bold; color:#f6ad55; margin-top:4px; font-size:0.78rem;">🚩 قوات [${member.country.name}]:</div>`;
      Object.keys(member.forces).forEach(uid => {
        const count = member.forces[uid];
        if (count > 0) {
          const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
          atkList.innerHTML += `<div class="review-force-item" style="display:flex; justify-content:space-between; padding:2px 4px; border-bottom:1px solid #1e293b; font-size:0.74rem;"><span>${u ? u.name : uid}</span><strong style="color:#10b981;">×${count}</strong></div>`;
        }
      });
    });

    defCoalition.forEach(member => {
      defList.innerHTML += `<div style="font-weight:bold; color:#38bdf8; margin-top:4px; font-size:0.78rem;">🛡️ قوات [${member.country.name}]:</div>`;
      Object.keys(member.forces).forEach(uid => {
        const count = member.forces[uid];
        if (count > 0) {
          const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
          defList.innerHTML += `<div class="review-force-item" style="display:flex; justify-content:space-between; padding:2px 4px; border-bottom:1px solid #1e293b; font-size:0.74rem;"><span>${u ? u.name : uid}</span><strong style="color:#ef4444;">×${count}</strong></div>`;
        }
      });
    });

    modal.classList.add("active");
  }

  static launchBattleScreen(atkCoalition, defCoalition) {
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

    const battleScreen = document.getElementById("battle-screen");
    if (battleScreen) battleScreen.classList.add("active");

    const leadAtk = atkCoalition[0].country;
    const leadDef = defCoalition[0].country;

    const atkNameEl = document.getElementById("battle-attacker-name");
    const defNameEl = document.getElementById("battle-defender-name");
    if (atkNameEl) atkNameEl.textContent = leadAtk.name + (atkCoalition.length > 1 ? ` (+${atkCoalition.length - 1} حلفاء)` : "");
    if (defNameEl) defNameEl.textContent = leadDef.name + (defCoalition.length > 1 ? ` (+${defCoalition.length - 1} حلفاء)` : "");

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
      });
    }
  }

  static showBattleResults(atkCoalition, defCoalition, result) {
    const modal = document.getElementById("modal-battle-report");
    const titleElem = document.getElementById("battle-report-winner-title");
    const leadAtk = atkCoalition[0].country;
    const leadDef = defCoalition[0].country;

    let totalAtkLostUnits = 0, totalAtkLostCrew = 0;
    atkCoalition.forEach(member => {
      const losses = result.attackerLossesByCountry?.[member.country.id] || {};
      const rep = window.WarEngine.applyBattleLosses(member.country, losses);
      totalAtkLostUnits += rep.totalLostUnits;
      totalAtkLostCrew += rep.totalLostCrew;
    });

    let totalDefLostUnits = 0, totalDefLostCrew = 0;
    defCoalition.forEach(member => {
      const losses = result.defenderLossesByCountry?.[member.country.id] || {};
      const rep = window.WarEngine.applyBattleLosses(member.country, losses);
      totalDefLostUnits += rep.totalLostUnits;
      totalDefLostCrew += rep.totalLostCrew;
    });

    let outcomeSectionHtml = "";

    if (result.winner === "attacker") {
      titleElem.textContent = `🏆 انتصار كاسح لتحالف [${leadAtk.name}]!`;
      titleElem.style.color = "#10b981";

      const outcome = window.WarEngine.resolveCoalitionPostBattleVictory(
        atkCoalition,
        defCoalition,
        window.currentWorld,
        this.attackerMobStatus,
        this.defenderMobStatus
      );

      outcomeSectionHtml = `
        <div style="background:#0f172a; border:1px solid ${outcome.color}; border-radius:8px; padding:10px; margin:8px 0;">
          <h4 style="color:${outcome.color}; margin:0 0 4px 0; font-size:0.9rem;">${outcome.title}</h4>
          <p style="color:#e2e8f0; font-size:0.78rem; margin:0; line-height:1.5;">${outcome.details}</p>
        </div>
      `;
    } else if (result.winner === "defender") {
      titleElem.textContent = `🛡️ صمود بطولي وهزيمة الغزو لصالح [${leadDef.name}]!`;
      titleElem.style.color = "#38bdf8";

      outcomeSectionHtml = `
        <div style="background:#0f172a; border:1px solid #38bdf8; border-radius:8px; padding:10px; margin:8px 0;">
          <h4 style="color:#38bdf8; margin:0 0 4px 0; font-size:0.9rem;">🛡️ كسر شوكة الغزو المشترك</h4>
          <p style="color:#e2e8f0; font-size:0.78rem; margin:0; line-height:1.5;">
            تمكنت قوات التحالف المدافع بقيادة [${leadDef.name}] من إبادة التجريدة الغازية وحفظ السيادة والمدخرات كاملة.
          </p>
        </div>
      `;

      if (window.currentWorld && typeof window.currentWorld.addHistoryEvent === "function") {
        window.currentWorld.addHistoryEvent("political", `دفاع بطولي: تمكن حلف ${leadDef.name} من صد وسحق تحالف الغزو.`, window.currentWorld.year);
      }
    } else {
      titleElem.textContent = `⚖️ استنزاف متبادل لكلا الحلفين!`;
      titleElem.style.color = "#f59e0b";
    }

    // مزامنة نتائج المعركة عبر الشبكة إن كان هناك غرفة نشطة
    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      atkCoalition.forEach(m => window.NetworkEngine.syncCountryChanges(m.country));
      defCoalition.forEach(m => window.NetworkEngine.syncCountryChanges(m.country));
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

    const atkLossEl = document.getElementById("report-attacker-loss-text");
    if (atkLossEl) {
      atkLossEl.innerHTML = `
        <strong style="color:#10b981;">خسائر حلف الهجوم:</strong><br>
        • الآليات المدمرة: <strong>${totalAtkLostUnits}</strong><br>
        • الخسائر البشرية: <strong>${totalAtkLostCrew}</strong> فرد
      `;
    }

    const defLossEl = document.getElementById("report-defender-loss-text");
    if (defLossEl) {
      defLossEl.innerHTML = `
        <strong style="color:#ef4444;">خسائر حلف الدفاع:</strong><br>
        • الآليات المدمرة: <strong>${totalDefLostUnits}</strong><br>
        • الخسائر البشرية: <strong>${totalDefLostCrew}</strong> فرد
      `;
    }

    if (modal) modal.classList.add("active");
  }

  static bindGlobalEvents() {
    const btnAttackerAllOut = document.getElementById("btn-attacker-all-out");
    if (btnAttackerAllOut) {
      btnAttackerAllOut.onclick = () => {
        document.querySelectorAll("#war-mobilize-units-list .w-unit-input").forEach(inp => {
          inp.value = inp.getAttribute("max") || "0";
        });
      };
    }

    const btnAttackerClear = document.getElementById("btn-attacker-clear-units");
    if (btnAttackerClear) {
      btnAttackerClear.onclick = () => {
        document.querySelectorAll("#war-mobilize-units-list .w-unit-input").forEach(inp => {
          inp.value = "0";
        });
      };
    }

    const btnConfirmMobilize = document.getElementById("btn-confirm-mobilize-attack");
    if (btnConfirmMobilize) {
      btnConfirmMobilize.onclick = () => {
        const targetSelect = document.getElementById("war-target-defender-select");
        const defenderId = targetSelect ? targetSelect.value : null;
        if (!defenderId) {
          this.notify("يرجى اختيار الدولة الهدف من القائمة أولاً!", "⚠️");
          return;
        }

        const countries = (window.currentWorld && window.currentWorld.countries) ? window.currentWorld.countries : [];
        const defender = countries.find(c => String(c.id) === String(defenderId));
        if (!defender) {
          this.notify("تعذر العثور على الدولة الهدف!", "⚠️");
          return;
        }

        const forces = {};
        let totalCount = 0;

        document.querySelectorAll("#war-mobilize-units-list .w-unit-input").forEach(inp => {
          const maxVal = parseInt(inp.getAttribute("max"), 10) || 0;
          const val = Math.min(maxVal, Math.max(0, parseInt(inp.value, 10) || 0));
          if (val > 0) {
            forces[inp.getAttribute("data-id")] = val;
            totalCount += val;
          }
        });

        if (totalCount === 0) {
          this.notify("يرجى تحديد قطعة عسكرية واحدة على الأقل أو الضغط على (تعبئة كامل الجيش)!", "⚠️");
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
              const cnt = Math.ceil((inv[uid] || 0) * 0.5);
              if (cnt > 0) allyForces[uid] = cnt;
            });
            atkCoalition.push({ country: allyCountry, forces: allyForces });
          }
        });

        document.getElementById("modal-war-mobilize")?.classList.remove("active");
        this.openGrandWarBriefingModal(this.primaryAttacker, defender, atkCoalition, window.currentWorld);
      };
    }

    const btnAllOut = document.getElementById("btn-defender-all-out");
    if (btnAllOut) {
      btnAllOut.onclick = () => {
        document.querySelectorAll("#defender-mobilize-units-list .w-def-unit-input").forEach(inp => {
          inp.value = inp.getAttribute("max") || "0";
        });
      };
    }

    const btnConfront = document.getElementById("btn-defender-confront");
    if (btnConfront) {
      btnConfront.onclick = () => {
        const defForces = {};
        let count = 0;

        document.querySelectorAll("#defender-mobilize-units-list .w-def-unit-input").forEach(inp => {
          const maxVal = parseInt(inp.getAttribute("max"), 10) || 0;
          const val = Math.min(maxVal, Math.max(0, parseInt(inp.value, 10) || 0));
          if (val > 0) {
            defForces[inp.getAttribute("data-id")] = val;
            count += val;
          }
        });

        if (count === 0) {
          this.notify("يرجى اختيار قطع عسكرية للدفاع أو الضغط على (النفير العام)!", "⚠️");
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
              const cnt = Math.ceil((inv[uid] || 0) * 0.5);
              if (cnt > 0) allyForces[uid] = cnt;
            });
            defCoalition.push({ country: allyCountry, forces: allyForces });
          }
        });

        this.defenderCoalition = defCoalition;
        document.getElementById("modal-defender-decision")?.classList.remove("active");
        this.openBattleReview(this.attackerCoalition, this.defenderCoalition);
      };
    }

    const btnStart = document.getElementById("btn-start-battle-action");
    if (btnStart) {
      btnStart.onclick = () => {
        this.launchBattleScreen(this.attackerCoalition, this.defenderCoalition);
      };
    }

    const btnCloseReport = document.getElementById("btn-close-battle-report");
    if (btnCloseReport) {
      btnCloseReport.onclick = () => {
        document.getElementById("modal-battle-report")?.classList.remove("active");
        document.getElementById("battle-screen")?.classList.remove("active");
        document.getElementById("game-dashboard")?.classList.add("active");
        if (typeof window.renderNationsTable === "function") window.renderNationsTable();
        if (window.AnalyticsManager) window.AnalyticsManager.render(window.currentWorld);
        if (window.WorldBankManager) window.WorldBankManager.render(window.currentWorld);
        this.render(window.currentWorld);
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
