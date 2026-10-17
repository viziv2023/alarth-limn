/**
 * War View - عصر الهيمنة
 * واجهة هيئة الأركان المشتركة، حشد التحالفات، واستعراض الإنذار الحربي السيادي
 * الإصدار v3.9.2: ضبط أبعاد النوافذ، استبعاد الدول الصفرية من الحلف، وتثبيت أزرار الإطلاق
 */

class WarView {
  static init() {
    this.primaryAttacker = null;
    this.primaryDefender = null;
    this.attackerCoalition = [];
    this.defenderCoalition = [];
    this.attackerMobStatus = "PARTIAL";
    this.defenderMobStatus = "PARTIAL";
    this.battleEngine = null;

    this.bindGlobalEvents();
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

  static render(world) {
    const container = document.getElementById("war-content-wrapper");
    if (!container) return;

    world = world || window.currentWorld;
    if (!world) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:#888;">لم يتم تحميل بيانات العالم بعد.</div>`;
      return;
    }

    const countries = (typeof world.getAllCountries === "function") ? world.getAllCountries() : (world.countries || []);

    if (countries.length < 2) {
      container.innerHTML = `
        <div style="background:#131c2e; border:1px solid #2d3748; border-radius:8px; padding:36px 20px; text-align:center; margin:20px auto; max-width:620px; box-shadow:0 4px 14px rgba(0,0,0,0.4);">
          <div style="font-size:3.2rem; margin-bottom:12px;">⚠️</div>
          <h3 style="color:#f6ad55; font-size:1.25rem; margin-bottom:10px;">يلزم وجود دولتين على الأقل لإدارة العمليات العسكرية والتحالفات</h3>
          <p style="color:#a0aec0; font-size:0.95rem; line-height:1.6; margin-bottom:20px;">
            يوجد في السجل العام حالياً (${countries.length}) دولة فقط. يرجى التوجه لجدول سجل الأمم وتأسيس دولة ثانية لبدء التجريدات وحشد الجيوش والمعارك المباشرة.
          </p>
          <button id="btn-war-create-second-nation" class="btn btn-primary" style="padding:8px 22px; font-weight:bold;">
            + تأسيس دولة جديدة الآن
          </button>
        </div>
      `;

      const btnCreate = document.getElementById("btn-war-create-second-nation");
      if (btnCreate) {
        btnCreate.onclick = () => {
          const addBtn = document.getElementById("btn-add-nation");
          if (addBtn) addBtn.click();
        };
      }
      return;
    }

    let html = `
      <div style="background:#141c2b; border:1px solid #2d3d54; border-radius:8px; padding:12px 18px; margin-bottom:14px; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:1.8rem;">⚔️</span>
          <div>
            <h3 style="color:#f6ad55; margin:0 0 2px 0; font-size:1.1rem;">هيئة الأركان المشتركة وغرفة العمليات الحربية</h3>
            <p style="color:#a0aec0; margin:0; font-size:0.8rem;">إدارة التجريدات العسكرية، تشكيل التحالفات الهجومية والدفاعية، وخوض المعارك.</p>
          </div>
        </div>
        <div style="background:#09121f; border:1px solid #1e293b; padding:4px 12px; border-radius:6px; font-size:0.75rem; color:#38bdf8;">
          ⚡ نظام المعارك v3.9: حسم تحالفات متكافئ
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
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
        <div class="war-country-card" style="background:#131c2e; border:1px solid #28374d; border-top:4px solid ${armyColor}; border-radius:8px; padding:14px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div class="w-card-flag" id="w-flag-${c.id}"></div>
              <div>
                <strong style="font-size:1.05rem; color:#fff; display:block;">${c.name}</strong>
                <span style="font-size:0.75rem; color:${totalStandingUnits > 0 ? '#34d399' : '#f87171'};">
                  ${totalStandingUnits > 0 ? `الترسانة: ${totalStandingUnits} قطعة` : '⚠️ لا تمتلك قوات مسلحة'}
                </span>
              </div>
            </div>
            <div style="text-align:left; border:1px solid ${armyColor}; padding:4px 8px; border-radius:6px; background:rgba(0,0,0,0.2);">
              <span style="font-size:0.7rem; color:#a0aec0; display:block;">القوة المقدرة</span>
              <strong style="color:${armyColor}; font-size:1.05rem;">${milPower.toLocaleString()}</strong>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; background:#0e1624; padding:6px 10px; border-radius:6px; margin-bottom:12px; border:1px solid #1e2a3a;">
            <span style="font-size:0.8rem; color:#cbd5e0;">🎨 لون راية الجيش الميدانية:</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:14px; height:14px; border-radius:50%; background:${armyColor}; border:1px solid rgba(255,255,255,0.3);"></span>
              <input type="color" class="w-army-color-picker" data-id="${c.id}" value="${armyColor}" style="width:28px; height:24px; padding:0; border:none; border-radius:4px; cursor:pointer; background:transparent;" title="تغيير لون راية الجيش" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px;">
            <div style="background:#162032; padding:6px 10px; border-radius:4px; border:1px solid #233147; display:flex; justify-content:space-between;">
              <span style="font-size:0.8rem; color:#cbd5e0;">🛡️ برية</span>
              <strong style="color:#63b3ed;">${groundCount}</strong>
            </div>
            <div style="background:#162032; padding:6px 10px; border-radius:4px; border:1px solid #233147; display:flex; justify-content:space-between;">
              <span style="font-size:0.8rem; color:#cbd5e0;">⚓ بحرية</span>
              <strong style="color:#63b3ed;">${navalCount}</strong>
            </div>
            <div style="background:#162032; padding:6px 10px; border-radius:4px; border:1px solid #233147; display:flex; justify-content:space-between;">
              <span style="font-size:0.8rem; color:#cbd5e0;">✈️ جوية</span>
              <strong style="color:#63b3ed;">${airCount}</strong>
            </div>
            <div style="background:#162032; padding:6px 10px; border-radius:4px; border:1px solid #233147; display:flex; justify-content:space-between;">
              <span style="font-size:0.8rem; color:#cbd5e0;">🚀 دفاع/صواريخ</span>
              <strong style="color:#63b3ed;">${defenseCount}</strong>
            </div>
          </div>

          <div>
            <button class="btn btn-military btn-select-attacker" data-id="${c.id}" style="width:100%; padding:8px; font-weight:bold;">
              🎯 حشد القوات وإعلان الحرب ➔
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    countries.forEach(c => {
      const flagBox = document.getElementById(`w-flag-${c.id}`);
      if (flagBox && window.FlagEditor) {
        if (typeof window.FlagEditor.renderFlag === "function") {
          window.FlagEditor.renderFlag(flagBox, c.flag, 24, 18);
        } else if (typeof window.FlagEditor.renderFlagToElement === "function") {
          window.FlagEditor.renderFlagToElement(c.flag, flagBox);
        }
      }
    });

    container.querySelectorAll(".w-army-color-picker").forEach(picker => {
      picker.addEventListener("change", (e) => {
        const countryId = e.target.getAttribute("data-id");
        const country = countries.find(c => c.id === countryId);
        if (country && window.WarEngine) {
          window.WarEngine.setCountryMilitaryColor(country, e.target.value);
          this.render(world);
        }
      });
    });

    container.querySelectorAll(".btn-select-attacker").forEach(btn => {
      btn.onclick = () => {
        const cId = btn.getAttribute("data-id");
        const attacker = countries.find(c => c.id === cId);
        if (attacker) {
          this.openMobilizationModal(attacker, world);
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
    this.primaryAttacker = attacker;
    this.attackerCoalition = [];

    const modal = document.getElementById("modal-war-mobilize");
    if (!modal) return;

    document.getElementById("war-modal-attacker-name").textContent = `غرفة عمليات القيادة: حشد تجريدة دولة [${attacker.name}]`;

    const defenderSelect = document.getElementById("war-target-defender-select");
    defenderSelect.innerHTML = `<option value="">-- اضغط هنا لاختيار الدولة المراد غزوها --</option>`;

    const countries = (typeof world.getAllCountries === "function") ? world.getAllCountries() : (world.countries || []);
    countries.forEach(c => {
      if (c.id !== attacker.id) {
        const milPower = c.military?.totalPower || c.militaryPower || 0;
        const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
        defenderSelect.innerHTML += `<option value="${c.id}">${c.name} — (القوة: ${milPower} | الترسانة: ${standing} قطعة | السكان: ${Number(c.population || 0).toLocaleString()})</option>`;
      }
    });

    // بناء واجهة التحالفات المضغوطة جداً رأسياً
    let alliesBox = document.getElementById("war-attacker-allies-container");
    if (!alliesBox) {
      alliesBox = document.createElement("div");
      alliesBox.id = "war-attacker-allies-container";
      alliesBox.style.cssText = "background:#0f172a; border:1px solid #334155; border-radius:6px; padding:6px 10px; margin:6px 0; flex-shrink:0;";
      const listParent = document.getElementById("war-mobilize-units-list")?.closest(".form-group-units-scrollable");
      if (listParent && listParent.parentElement) {
        listParent.parentElement.insertBefore(alliesBox, listParent);
      }
    }

    let armedAllies = countries.filter(c => c.id !== attacker.id && (window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0) > 0);

    let alliesHtml = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <strong style="color:#38bdf8; font-size:0.8rem;">🤝 تشكيل حلف هجومي مشترك (ضم حلفاء يمتلكون جيشاً):</strong>
        <span style="font-size:0.7rem; color:#94a3b8;">${armedAllies.length > 0 ? `متاح (${armedAllies.length}) دول مسلحة` : 'لا يوجد حلفاء مسلحون حالياً'}</span>
      </div>
      <div id="war-attacker-allies-list" style="display:flex; flex-wrap:wrap; gap:5px; max-height:48px; overflow-y:auto;">
    `;

    if (armedAllies.length === 0) {
      alliesHtml += `<span style="font-size:0.75rem; color:#64748b;">(كافة الدول الأخرى لا تمتلك أسلحة للمشاركة بالحلف)</span>`;
    } else {
      armedAllies.forEach(c => {
        const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
        alliesHtml += `
          <label style="background:#1e293b; padding:2px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; gap:4px; border:1px solid #334155; margin:0;">
            <input type="checkbox" class="chk-attacker-ally" value="${c.id}" />
            <span>${c.name} (${standing} قطعة)</span>
          </label>
        `;
      });
    }

    alliesHtml += `</div>`;
    alliesBox.innerHTML = alliesHtml;

    this.renderUnitsSelectorTable("war-mobilize-units-list", attacker, "w-unit-input");
    modal.classList.add("active");
  }

  static renderUnitsSelectorTable(containerId, country, inputClass) {
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
        sectionHeader.style.cssText = "background:#1e293b; color:#93c5fd; padding:4px 8px; font-weight:bold; font-size:0.8rem; margin-top:6px; border-radius:4px;";
        listBody.appendChild(sectionHeader);

        const table = document.createElement("table");
        table.className = "w-mobilize-table";
        table.style.cssText = "width:100%; border-collapse:collapse; margin-bottom:4px; font-size:0.82rem;";
        table.innerHTML = `
          <thead>
            <tr style="background:#131c2e; color:#a0aec0;">
              <th style="padding:4px 6px; text-align:right;">السلاح والمعدة</th>
              <th style="padding:4px 6px; text-align:center;">القوة</th>
              <th style="padding:4px 6px; text-align:center;">المتاح</th>
              <th style="padding:4px 6px; text-align:center;">العدد المشارك</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");

        owned.forEach(u => {
          const available = inv[u.id] || 0;
          const tr = document.createElement("tr");
          tr.style.cssText = "border-bottom:1px solid #1e293b;";
          tr.innerHTML = `
            <td style="padding:4px 6px;">
              <strong style="color:#fff; font-size:0.85rem;">${u.name}</strong>
              <div style="font-size:0.7rem; color:#718096;">طاقم: ${u.crew || 0} | وقود: ${u.fuel || 0} | ذخيرة: ${u.ammo || 0}</div>
            </td>
            <td style="text-align:center; padding:4px 6px;"><span class="badge badge-gold" style="font-size:0.75rem; padding:1px 6px;">${u.power}</span></td>
            <td style="text-align:center; padding:4px 6px;"><strong style="color:#38bdf8; font-size:0.85rem;">${available}</strong></td>
            <td style="text-align:center; padding:4px 6px;">
              <div style="display:flex; gap:3px; justify-content:center;">
                <input type="number" min="0" max="${available}" value="0" class="${inputClass}" data-id="${u.id}" style="width:65px; padding:3px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:4px; text-align:center; font-size:0.85rem;" />
                <button type="button" class="btn btn-secondary btn-sm btn-set-max" data-id="${u.id}" data-max="${available}" style="padding:1px 6px; font-size:0.7rem;">الكل</button>
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
        <div style="text-align:center; padding:20px; color:#8492a6; background:#101726; border-radius:6px; margin:6px 0; font-size:0.85rem;">
          ⚠️ هذه الدولة لا تمتلك أي قطع عسكرية في ترسانتها حالياً.
        </div>
      `;
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
    titleEl.textContent = isDefTrulyArmyless
      ? `🚨 إنذار استراتيجي: الدولة المستهدفة [${primaryDef.name}] لا تمتلك جيشاً!`
      : `🚨 صفارات الإنذار: حلف عسكري يزحف لاجتياح [${primaryDef.name}]!`;
    titleEl.style.color = isDefTrulyArmyless ? "#f59e0b" : "#ef4444";

    document.getElementById("defender-country-name-label").textContent = primaryDef.name;
    const countBadge = document.getElementById("war-attacker-units-count-badge");
    if (countBadge) {
      countBadge.textContent = `${totalAtkUnits} قطعة (القوة: ${totalAtkPower.toLocaleString()})`;
    }

    let atkAlliesInfo = document.getElementById("defender-modal-atk-allies-info");
    if (!atkAlliesInfo) {
      atkAlliesInfo = document.createElement("div");
      atkAlliesInfo.id = "defender-modal-atk-allies-info";
      atkAlliesInfo.style.cssText = "background:#09121f; border:1px solid #1e293b; padding:6px 10px; border-radius:6px; margin:6px 0; font-size:0.8rem; flex-shrink:0;";
      const parentNode = titleEl.closest(".modal-header-fixed") || titleEl.parentElement;
      if (parentNode) parentNode.appendChild(atkAlliesInfo);
    }

    let atkNamesHtml = atkCoalition.map(m => `<span class="badge badge-gold" style="margin:1px; font-size:0.75rem;">🚩 ${m.country.name}</span>`).join(" ");
    atkAlliesInfo.innerHTML = `<strong>الجبهة المهاجمة:</strong> ${atkNamesHtml}`;

    let armylessBox = document.getElementById("defender-armyless-choice-box");
    if (!armylessBox) {
      armylessBox = document.createElement("div");
      armylessBox.id = "defender-armyless-choice-box";
      armylessBox.style.cssText = "background:rgba(239, 68, 68, 0.15); border:1px dashed #ef4444; padding:10px; border-radius:6px; margin:8px 0; flex-shrink:0;";
      const formBox = document.getElementById("defender-mobilize-units-list")?.closest(".form-group-units-scrollable");
      if (formBox && formBox.parentElement) {
        formBox.parentElement.insertBefore(armylessBox, formBox);
      }
    }

    if (isDefTrulyArmyless) {
      armylessBox.style.display = "block";
      armylessBox.innerHTML = `
        <h4 style="color:#f87171; margin:0 0 4px 0; font-size:0.95rem;">⚠️ الدولة المستهدفة عزلاء بالكامل!</h4>
        <p style="color:#e2e8f0; font-size:0.8rem; margin:0 0 8px 0;">
          لا تمتلك [${primaryDef.name}] أي قطع حربية للمقاومة. يحق للحلف المهاجم فرض الاستسلام السلمي ومصادرة كامل مدخرات البنوك.
        </p>
        <div style="display:flex; gap:8px;">
          <button type="button" id="btn-confirm-peaceful-occupation" class="btn btn-danger btn-sm" style="font-weight:bold;">
            🚩 تنفيذ الاجتياح ومصادرة المدخرات فوراً
          </button>
          <button type="button" onclick="document.getElementById('modal-defender-decision').classList.remove('active')" class="btn btn-secondary btn-sm">
            إلغاء والانسحاب
          </button>
        </div>
      `;

      document.getElementById("btn-confirm-peaceful-occupation").onclick = () => {
        this.executeArmylessSurrender(atkCoalition, primaryDef, world);
      };

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
        defAlliesBox.style.cssText = "background:#0f172a; border:1px solid #334155; border-radius:6px; padding:6px 10px; margin:4px 0 8px 0; flex-shrink:0;";
        const listParent = document.getElementById("defender-mobilize-units-list")?.closest(".form-group-units-scrollable");
        if (listParent && listParent.parentElement) {
          listParent.parentElement.insertBefore(defAlliesBox, listParent);
        }
      }

      const countries = (typeof world.getAllCountries === "function") ? world.getAllCountries() : (world.countries || []);
      const armedDefAllies = countries.filter(c => {
        const isAttackerMember = atkCoalition.some(m => m.country.id === c.id);
        const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
        return c.id !== primaryDef.id && !isAttackerMember && standing > 0;
      });

      let defAlliesHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="color:#63b3ed; font-size:0.8rem;">🛡️ نداء الحلفاء (تشكيل حلف دفاعي مشترك):</strong>
          <span style="font-size:0.7rem; color:#94a3b8;">${armedDefAllies.length > 0 ? `متاح (${armedDefAllies.length}) دول` : 'لا يوجد حلفاء مسلحون'}</span>
        </div>
        <div id="war-defender-allies-list" style="display:flex; flex-wrap:wrap; gap:4px; max-height:45px; overflow-y:auto;">
      `;

      if (armedDefAllies.length === 0) {
        defAlliesHtml += `<span style="font-size:0.75rem; color:#64748b;">(لا توجد دول حليفة تمتلك جيشاً جاهزاً للإسناد)</span>`;
      } else {
        armedDefAllies.forEach(c => {
          const standing = window.WarEngine ? window.WarEngine.getStandingArmyCount(c) : 0;
          defAlliesHtml += `
            <label style="background:#1e293b; padding:2px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; gap:4px; border:1px solid #334155; margin:0;">
              <input type="checkbox" class="chk-defender-ally" value="${c.id}" />
              <span>${c.name} (${standing})</span>
            </label>
          `;
        });
      }

      defAlliesHtml += `</div>`;
      defAlliesBox.innerHTML = defAlliesHtml;

      this.renderUnitsSelectorTable("defender-mobilize-units-list", primaryDef, "w-def-unit-input");
    }

    modal.classList.add("active");
  }

  static executeArmylessSurrender(atkCoalition, armylessDef, world) {
    document.getElementById("modal-defender-decision").classList.remove("active");

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
      <div style="background:#0f172a; border:1px solid #34d399; border-radius:6px; padding:12px; margin:10px 0;">
        <h4 style="color:#34d399; margin:0 0 4px 0;">${outcome.title}</h4>
        <p style="color:#e2e8f0; font-size:0.85rem; margin:0; line-height:1.6;">${outcome.details}</p>
      </div>
    `;

    document.getElementById("report-attacker-loss-text").innerHTML = `<strong style="color:#10b981;">الحلف الغازي:</strong><br>لم يتكبد أي خسائر نظراً لعدم وجود مقاومة.`;
    document.getElementById("report-defender-loss-text").innerHTML = `<strong style="color:#ef4444;">الدولة المستهدفة (${armylessDef.name}):</strong><br>خسارة كامل المدخرات النقدية دون خسائر بشرية.`;

    if (modal) modal.classList.add("active");
  }

  static openBattleReview(atkCoalition, defCoalition) {
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
    if (window.FlagEditor) {
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
      atkList.innerHTML += `<div style="font-weight:bold; color:#f6ad55; margin-top:4px; font-size:0.8rem;">🚩 قوات [${member.country.name}]:</div>`;
      Object.keys(member.forces).forEach(uid => {
        const count = member.forces[uid];
        if (count > 0) {
          const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
          atkList.innerHTML += `<div class="review-force-item" style="display:flex; justify-content:space-between; padding:2px 4px; border-bottom:1px solid #1e293b; font-size:0.75rem;"><span>${u ? u.name : uid}</span><strong style="color:#10b981;">${count}</strong></div>`;
        }
      });
    });

    defCoalition.forEach(member => {
      defList.innerHTML += `<div style="font-weight:bold; color:#38bdf8; margin-top:4px; font-size:0.8rem;">🛡️ قوات [${member.country.name}]:</div>`;
      Object.keys(member.forces).forEach(uid => {
        const count = member.forces[uid];
        if (count > 0) {
          const u = window.MilitaryData ? window.MilitaryData.getUnitById(uid) : null;
          defList.innerHTML += `<div class="review-force-item" style="display:flex; justify-content:space-between; padding:2px 4px; border-bottom:1px solid #1e293b; font-size:0.75rem;"><span>${u ? u.name : uid}</span><strong style="color:#ef4444;">${count}</strong></div>`;
        }
      });
    });

    modal.classList.add("active");
  }

  static launchBattleScreen(atkCoalition, defCoalition) {
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
    const dash = document.getElementById("game-dashboard");
    if (dash) dash.classList.remove("active");

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
    if (window.FlagEditor) {
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
        <div style="background:#0f172a; border:1px solid ${outcome.color}; border-radius:6px; padding:10px; margin:10px 0;">
          <h4 style="color:${outcome.color}; margin:0 0 4px 0; font-size:0.95rem;">${outcome.title}</h4>
          <p style="color:#e2e8f0; font-size:0.8rem; margin:0; line-height:1.5;">${outcome.details}</p>
        </div>
      `;
    } else if (result.winner === "defender") {
      titleElem.textContent = `🛡️ صمود بطولي وهزيمة الغزو لصالح [${leadDef.name}]!`;
      titleElem.style.color = "#38bdf8";

      outcomeSectionHtml = `
        <div style="background:#0f172a; border:1px solid #38bdf8; border-radius:6px; padding:10px; margin:10px 0;">
          <h4 style="color:#38bdf8; margin:0 0 4px 0; font-size:0.95rem;">🛡️ كسر شوكة الغزو المشترك</h4>
          <p style="color:#e2e8f0; font-size:0.8rem; margin:0; line-height:1.5;">
            تمكنت قوات التحالف المدافع بقيادة [${leadDef.name}] من إبادة التجريدة الغازية وحفظ السيادة والمدخرات كاملة.
          </p>
        </div>
      `;

      if (window.currentWorld) {
        window.currentWorld.addHistoryEvent("political", `دفاع بطولي: تمكن حلف ${leadDef.name} من صد وسحق تحالف الغزو.`, window.currentWorld.year);
      }
    } else {
      titleElem.textContent = `⚖️ استنزاف متبادل لكلا الحلفين!`;
      titleElem.style.color = "#f59e0b";
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

    document.getElementById("report-attacker-loss-text").innerHTML = `
      <strong style="color:#10b981;">خسائر حلف الهجوم:</strong><br>
      • الآليات المدمرة: <strong>${totalAtkLostUnits}</strong><br>
      • الخسائر البشرية: <strong>${totalAtkLostCrew}</strong> فرد
    `;

    document.getElementById("report-defender-loss-text").innerHTML = `
      <strong style="color:#ef4444;">خسائر حلف الدفاع:</strong><br>
      • الآليات المدمرة: <strong>${totalDefLostUnits}</strong><br>
      • الخسائر البشرية: <strong>${totalDefLostCrew}</strong> فرد
    `;

    if (modal) modal.classList.add("active");
  }

  static bindGlobalEvents() {
    const btnConfirmMobilize = document.getElementById("btn-confirm-mobilize-attack");
    if (btnConfirmMobilize) {
      btnConfirmMobilize.onclick = () => {
        const targetSelect = document.getElementById("war-target-defender-select");
        const defenderId = targetSelect ? targetSelect.value : null;
        if (!defenderId) {
          alert("يرجى اختيار الدولة الهدف من القائمة المنسدلة أولاً!");
          return;
        }

        const defender = window.currentWorld.countries.find(c => c.id === defenderId);
        const forces = {};
        let totalCount = 0;

        document.querySelectorAll("#war-mobilize-units-list .w-unit-input").forEach(inp => {
          const val = parseInt(inp.value, 10) || 0;
          if (val > 0) {
            forces[inp.getAttribute("data-id")] = val;
            totalCount += val;
          }
        });

        if (totalCount === 0) {
          alert("يرجى تحديد قطعة عسكرية واحدة على الأقل من الجيش الرئيسي للمشاركة في التجريدة!");
          return;
        }

        const atkCoalition = [{ country: this.primaryAttacker, forces: forces }];
        document.querySelectorAll(".chk-attacker-ally:checked").forEach(chk => {
          const allyId = chk.value;
          const allyCountry = window.currentWorld.countries.find(c => c.id === allyId);
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

        document.getElementById("modal-war-mobilize").classList.remove("active");
        this.openGrandWarBriefingModal(this.primaryAttacker, defender, atkCoalition, window.currentWorld);
      };
    }

    const btnAllOut = document.getElementById("btn-defender-all-out");
    if (btnAllOut) {
      btnAllOut.onclick = () => {
        document.querySelectorAll("#defender-mobilize-units-list .w-def-unit-input").forEach(inp => {
          inp.value = inp.getAttribute("max");
        });
      };
    }

    const btnConfront = document.getElementById("btn-defender-confront");
    if (btnConfront) {
      btnConfront.onclick = () => {
        const defForces = {};
        let count = 0;

        document.querySelectorAll("#defender-mobilize-units-list .w-def-unit-input").forEach(inp => {
          const val = parseInt(inp.value, 10) || 0;
          if (val > 0) {
            defForces[inp.getAttribute("data-id")] = val;
            count += val;
          }
        });

        if (count === 0) {
          alert("يرجى اختيار قطع عسكرية للدفاع أو الضغط على (تعبئة كامل الجيش)!");
          return;
        }

        const defCoalition = [{ country: this.primaryDefender, forces: defForces }];
        document.querySelectorAll(".chk-defender-ally:checked").forEach(chk => {
          const allyId = chk.value;
          const allyCountry = window.currentWorld.countries.find(c => c.id === allyId);
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
        document.getElementById("modal-defender-decision").classList.remove("active");
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
        document.getElementById("modal-battle-report").classList.remove("active");
        document.getElementById("battle-screen").classList.remove("active");
        document.getElementById("game-dashboard").classList.add("active");
        if (typeof window.renderNationsTable === "function") window.renderNationsTable();
        if (window.AnalyticsManager) window.AnalyticsManager.render(window.currentWorld);
        if (window.WorldBankManager) window.WorldBankManager.render(window.currentWorld);
        this.render(window.currentWorld);
      };
    }
  }
}

window.WarView = WarView;