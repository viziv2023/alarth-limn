class MilitaryView {
  static open(country, onBackCallback) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const milScreen = document.getElementById("military-screen");
    if (milScreen) milScreen.classList.add("active");

    this.country = country;
    window.currentViewingCountry = country;
    this.onBackCallback = onBackCallback || null;
    if (!this.activeBranch) this.activeBranch = "ground";

    if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
      window.MilitaryEngine.syncCountryWithMilitary(this.country);
    } else if (window.MilitaryEngine) {
      window.MilitaryEngine.refreshMilitaryStats(this.country);
    }

    this.render();
    this.bindEvents();
  }

  static show(country, onBackCallback) {
    this.open(country, onBackCallback);
  }

  static notify(msg, icon = "🎖️") {
    if (typeof window.showGameToast === "function") {
      window.showGameToast(msg, icon);
    } else {
      alert(msg);
    }
  }

  static render(countryOverride) {
    if (countryOverride) this.country = countryOverride;
    const c = this.country;
    if (!c) return;

    if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
      window.MilitaryEngine.refreshMilitaryStats(c);
    }

    const mil = c.military || {};
    const pop = Number(c.population || 0);
    const emp = Number(c.employed || 0);
    const availableToRecruit = Math.max(0, pop - emp);
    c.unemployed = availableToRecruit;

    // الرأسيات المرتبطة مباشرة ببيانات الدولة
    const nameEl = document.getElementById("mil-country-name");
    if (nameEl) nameEl.textContent = `🎖️ وزارة الدفاع والقيادة العامة - ${c.name}`;

    const fundsEl = document.getElementById("mil-disposable-funds");
    if (fundsEl) fundsEl.textContent = `$${Number(c.disposableRevenue || 0).toLocaleString()}`;

    const popEl = document.getElementById("mil-population-count");
    if (popEl) {
      popEl.textContent = `${availableToRecruit.toLocaleString()} متاح للتجنيد (من ${pop.toLocaleString()} نسمة)`;
    }

    // لوحة القيادة اللوجستية الموحدة
    const pwrEl = document.getElementById("stat-mil-power");
    if (pwrEl) {
      pwrEl.textContent = `${Number(mil.totalPower || 0).toLocaleString()} (${Number(mil.totalUnits || 0).toLocaleString()} قطعة)`;
    }

    const crewEl = document.getElementById("stat-mil-crew");
    if (crewEl) {
      crewEl.textContent = `${Number(mil.totalCrew || 0).toLocaleString()} ضابط وجندي`;
    }

    const fuelEl = document.getElementById("stat-mil-fuel");
    if (fuelEl) {
      const fVal = Number(mil.totalFuelConsumption || 0);
      fuelEl.textContent = fVal <= 0 ? `+${Math.abs(fVal)} لتر (فائض إنتاج)` : `${fVal} لتر/دورة`;
    }

    const ammoElem = document.getElementById("stat-mil-ammo");
    if (ammoElem) {
      if ((mil.netAmmoBalance || 0) < 0) {
        ammoElem.innerHTML = `<span class="text-deficit">${mil.netAmmoBalance} (عجز بحاجة لمصنع ذخيرة)</span>`;
      } else {
        ammoElem.innerHTML = `<span class="text-surplus">+${mil.netAmmoBalance || 0} (فائض تغطية)</span>`;
      }
    }

    const demandEl = document.getElementById("stat-ammo-demand");
    if (demandEl) demandEl.textContent = `الطلب: ${mil.ammoDemand || 0}`;

    const prodEl = document.getElementById("stat-ammo-prod");
    if (prodEl) prodEl.textContent = `الإنتاج: ${mil.ammoProduction || 0}`;

    // تحديث أعداد الفروع على أزرار التابات ليعرف اللاعب المتوفر لديه فوراً
    const bc = mil.branchCounts || { ground: 0, naval: 0, air: 0, defense: 0 };
    const bp = mil.branchPower || { ground: 0, naval: 0, air: 0, defense: 0 };
    const tabLabels = {
      ground: `🛡️ القوات البرية (${bc.ground || 0} | قوة: ${bp.ground || 0})`,
      naval: `⚓ البحرية (${bc.naval || 0} | قوة: ${bp.naval || 0})`,
      air: `✈️ الجوية (${bc.air || 0} | قوة: ${bp.air || 0})`,
      defense: `🚀 دفاع صاروخي (${bc.defense || 0} | قوة: ${bp.defense || 0})`
    };

    document.querySelectorAll(".mil-tab-btn").forEach(btn => {
      const br = btn.dataset.branch;
      if (br && tabLabels[br]) {
        btn.textContent = tabLabels[br];
      }
      if (br === this.activeBranch) btn.classList.add("active");
      else btn.classList.remove("active");
    });

    this.renderBranchTable(this.activeBranch || "ground");

    if (typeof window.updateAllTurnDecisionButtons === "function") {
      window.updateAllTurnDecisionButtons();
    }
  }

  static renderBranchTable(branch) {
    const tbody = document.getElementById("military-units-tbody");
    if (!tbody || !this.country) return;
    tbody.innerHTML = "";

    const units = window.MilitaryData ? window.MilitaryData.getUnitsByBranch(branch) : [];
    const inv = (this.country.military && this.country.military.inventory) ? this.country.military.inventory : {};
    const cash = Number(this.country.disposableRevenue || 0);
    const availPop = Math.max(0, Number(this.country.population || 0) - Number(this.country.employed || 0));

    const isOwner = (window.NetworkEngine && typeof window.NetworkEngine.canControlCountry === "function")
      ? window.NetworkEngine.canControlCountry(this.country.id)
      : !window.isViewingAsSpectator;

    units.forEach(u => {
      const currentCount = Number(inv[u.id] || 0);
      const totalUnitPower = Number(((u.power || 0) * currentCount).toFixed(1));
      const tr = document.createElement("tr");

      const isCustom = !!u.isCustom;
      if (isCustom) {
        tr.style.background = "rgba(139, 92, 246, 0.12)";
      } else if (currentCount > 0) {
        tr.style.background = "rgba(16, 185, 129, 0.08)";
      }

      let extraInfo = "";
      if (u.capacity > 0) extraInfo += `سعة: ${u.capacity} | `;
      if (u.range) extraInfo += `المدى: ${u.range} | `;
      if (u.destruction) extraInfo += `تدمير: ${u.destruction} | `;
      if (u.fuel !== undefined && u.fuel !== 0) extraInfo += `وقود: ${u.fuel > 0 ? u.fuel : ('+' + Math.abs(u.fuel) + ' إنتاج')} | `;
      if (u.ammo !== undefined && u.ammo !== 0) extraInfo += `ذخيرة: ${u.ammo > 0 ? u.ammo : ('+' + Math.abs(u.ammo) + ' إنتاج')}`;

      const canBuy1 = isOwner && cash >= u.price && (u.crew <= 0 || availPop >= u.crew);
      const canBuy5 = isOwner && cash >= (u.price * 5) && (u.crew <= 0 || availPop >= (u.crew * 5));

      tr.innerHTML = `
        <td class="unit-name-col">
          <div style="display:flex; align-items:center; gap:8px;">
            <div>
              <strong style="color:${isCustom ? '#c084fc' : '#ffffff'}; font-size:0.9rem;">${u.name}</strong>
              ${isCustom ? `<span class="badge badge-purple" style="font-size:0.65rem; padding:1px 6px; margin-right:4px;">★ طراز سيادي [${u.creatorCountryName || 'خاص'}]</span>` : ''}
              <span class="unit-subtext" style="display:block; color:#cbd5e1; font-size:0.72rem;">${extraInfo || "معدة قتالية قياسية"}</span>
            </div>
          </div>
        </td>
        <td class="unit-count-badge" style="text-align:center;">
          <strong style="font-size:0.98rem; color:${currentCount > 0 ? '#34d399' : '#94a3b8'};">${currentCount}</strong>
          ${currentCount > 0 && u.power > 0 ? `<div style="font-size:0.68rem; color:#fde047;">إجمالي القوة: ${totalUnitPower}</div>` : ''}
        </td>
        <td style="text-align:center; color:#fbbf24; font-weight:800;">$${Number(u.price || 0).toLocaleString()}</td>
        <td style="text-align:center;">${u.crew > 0 ? u.crew + " فرد" : "آلي (0)"}</td>
        <td class="text-accent" style="text-align:center; font-weight:900;">${u.power > 0 ? u.power : "لوجستي"}</td>
        <td style="text-align:center;">
          ${isOwner ? `
            <div style="display:flex; gap:4px; justify-content:center; align-items:center; flex-wrap:wrap;">
              <button type="button" class="btn ${canBuy1 ? 'btn-primary' : 'btn-secondary'} btn-sm btn-buy-unit" data-id="${u.id}" data-count="1" ${!canBuy1 ? 'disabled' : ''} style="padding:4px 9px; font-size:0.76rem;">+1 تجنيد</button>
              <button type="button" class="btn ${canBuy5 ? 'btn-accent' : 'btn-secondary'} btn-sm btn-buy-unit" data-id="${u.id}" data-count="5" ${!canBuy5 ? 'disabled' : ''} style="padding:4px 7px; font-size:0.72rem;" title="تجنيد 5 دفعة واحدة">+5</button>
              ${currentCount > 0 ? `<button type="button" class="btn btn-danger btn-sm btn-demob-unit" data-id="${u.id}" style="padding:4px 7px; font-size:0.72rem;" title="تسريح وحدة واسترداد $${u.price}">➖</button>` : ''}
            </div>
          ` : `<span style="font-size:0.74rem; color:#94a3b8;">👁️ مشاهدة</span>`}
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-buy-unit").forEach(btn => {
      btn.onclick = () => {
        const uid = btn.getAttribute("data-id");
        const cnt = parseInt(btn.getAttribute("data-count") || "1", 10) || 1;
        if (window.GameSFX) window.GameSFX.playClick();
        const res = window.MilitaryEngine.purchaseUnit(this.country, uid, cnt);
        if (!res.success) {
          this.notify(res.msg, "⚠️");
        } else {
          this.notify(res.msg, "🎖️");
          this.render();
          if (window.CountryViewController && typeof window.CountryViewController.render === "function") {
            window.CountryViewController.render(this.country);
          }
        }
      };
    });

    tbody.querySelectorAll(".btn-demob-unit").forEach(btn => {
      btn.onclick = () => {
        const uid = btn.getAttribute("data-id");
        if (window.GameSFX) window.GameSFX.playClick();
        const res = window.MilitaryEngine.demobilizeUnit(this.country, uid, 1);
        if (!res.success) {
          this.notify(res.msg, "⚠️");
        } else {
          this.notify(res.msg, "🔄");
          this.render();
          if (window.CountryViewController && typeof window.CountryViewController.render === "function") {
            window.CountryViewController.render(this.country);
          }
        }
      };
    });
  }

  static bindEvents() {
    const btnBack = document.getElementById("btn-back-from-military");
    if (btnBack) {
      btnBack.onclick = () => {
        if (window.GameSFX) window.GameSFX.playClick();
        document.getElementById("military-screen")?.classList.remove("active");
        if (this.onBackCallback) {
          const cb = this.onBackCallback;
          this.onBackCallback = null;
          cb();
          return;
        }
        if (this.country && window.CapitalView && typeof window.CapitalView.open === "function") {
          window.CapitalView.open(this.country);
        } else {
          document.getElementById("country-detail-screen")?.classList.add("active");
          if (window.CountryViewController && this.country) {
            window.CountryViewController.render(this.country);
          }
        }
      };
    }

    const btnForge = document.getElementById("btn-open-weapon-forge");
    if (btnForge) {
      btnForge.onclick = () => {
        if (window.GameSFX) window.GameSFX.playClick();
        if (window.WeaponForge && this.country) {
          window.WeaponForge.open(this.country);
        }
      };
    }

    const btnMilNextYear = document.getElementById("btn-mil-next-year");
    if (btnMilNextYear) {
      btnMilNextYear.onclick = () => {
        if (typeof window.triggerPlayerTurnDecision === "function") {
          window.triggerPlayerTurnDecision("READY_YEAR");
        }
      };
    }

    const btnMilGoWar = document.getElementById("btn-mil-go-war");
    if (btnMilGoWar) {
      btnMilGoWar.onclick = () => {
        if (typeof window.triggerPlayerTurnDecision === "function") {
          window.triggerPlayerTurnDecision("READY_WAR");
        }
      };
    }

    document.querySelectorAll(".mil-tab-btn").forEach(btn => {
      btn.onclick = () => {
        if (window.GameSFX) window.GameSFX.playClick();
        document.querySelectorAll(".mil-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeBranch = btn.dataset.branch;
        this.renderBranchTable(this.activeBranch);
      };
    });
  }
}

window.MilitaryView = MilitaryView;
