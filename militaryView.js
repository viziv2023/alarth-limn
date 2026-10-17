class MilitaryView {
  static open(country, onBackCallback) {
    document.getElementById("country-detail-screen").classList.remove("active");
    const milScreen = document.getElementById("military-screen");
    milScreen.classList.add("active");

    this.country = country;
    this.onBackCallback = onBackCallback;
    this.activeBranch = "ground";

    window.MilitaryEngine.refreshMilitaryStats(this.country);
    this.render();
    this.bindEvents();
  }

  static render() {
    const c = this.country;
    const mil = c.military;

    const availableToRecruit = (c.unemployed !== undefined && c.unemployed !== null)
      ? Number(c.unemployed)
      : Math.max(0, Number(c.population) - Number(c.employed || 0));

    // الرأسيات
    document.getElementById("mil-country-name").textContent = `وزارة الدفاع - ${c.name}`;
    document.getElementById("mil-disposable-funds").textContent = `$${Number(c.disposableRevenue).toLocaleString()}`;
    document.getElementById("mil-population-count").textContent = `${availableToRecruit.toLocaleString()} متاح للتجنيد`;

    // لوحة القيادة اللوجستية
    document.getElementById("stat-mil-power").textContent = mil.totalPower.toLocaleString();
    document.getElementById("stat-mil-crew").textContent = `${mil.totalCrew} ضابط وجندي`;
    document.getElementById("stat-mil-fuel").textContent = `${mil.totalFuelConsumption} لتر/دورة`;

    const ammoElem = document.getElementById("stat-mil-ammo");
    if (mil.netAmmoBalance < 0) {
      ammoElem.innerHTML = `<span class="text-deficit">${mil.netAmmoBalance} (عجز بحاجة لمصانع)</span>`;
    } else {
      ammoElem.innerHTML = `<span class="text-surplus">+${mil.netAmmoBalance} (فائض تغطية)</span>`;
    }

    document.getElementById("stat-ammo-demand").textContent = `الطلب: ${mil.ammoDemand}`;
    document.getElementById("stat-ammo-prod").textContent = `الإنتاج: ${mil.ammoProduction}`;

    this.renderBranchTable(this.activeBranch);
  }

  static renderBranchTable(branch) {
    const tbody = document.getElementById("military-units-tbody");
    tbody.innerHTML = "";

    const units = window.MilitaryData.getUnitsByBranch(branch);

    units.forEach(u => {
      const currentCount = this.country.military.inventory[u.id] || 0;
      const tr = document.createElement("tr");

      const isCustom = !!u.isCustom;
      if (isCustom) {
        tr.style.background = "rgba(139, 92, 246, 0.08)";
      }

      let extraInfo = "";
      if (u.capacity > 0) extraInfo += `سعة: ${u.capacity} | `;
      if (u.range) extraInfo += `المدى: ${u.range} | `;
      if (u.destruction) extraInfo += `تدمير: ${u.destruction} | `;
      if (u.fuel > 0) extraInfo += `وقود: ${u.fuel} | `;
      if (u.ammo > 0) extraInfo += `ذخيرة: ${u.ammo}`;

      tr.innerHTML = `
        <td class="unit-name-col">
          <div style="display:flex; align-items:center; gap:8px;">
            <div>
              <strong style="color:${isCustom ? '#c084fc' : '#ffffff'};">${u.name}</strong>
              ${isCustom ? `<span class="badge badge-purple" style="font-size:0.65rem; padding:1px 6px; margin-right:4px;">★ طراز سيادي [${u.creatorCountryName || 'خاص'}]</span>` : ''}
              <span class="unit-subtext" style="display:block;">${extraInfo || "معدة قتالية قياسية"}</span>
            </div>
          </div>
        </td>
        <td class="unit-count-badge">${currentCount}</td>
        <td>$${u.price.toLocaleString()}</td>
        <td>${u.crew > 0 ? u.crew + " فرد" : "—"}</td>
        <td class="text-accent">${u.power > 0 ? u.power : "—"}</td>
        <td>
          <button class="btn btn-primary btn-sm btn-buy-unit" data-id="${u.id}">+ تصنيع / تجنيد</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-buy-unit").forEach(btn => {
      btn.onclick = (e) => {
        const uid = e.target.dataset.id;
        const res = window.MilitaryEngine.purchaseUnit(this.country, uid, 1);
        if (!res.success) {
          alert(res.msg);
        } else {
          this.render();
        }
      };
    });
  }

  static bindEvents() {
    const btnBack = document.getElementById("btn-back-from-military");
    if (btnBack) {
      btnBack.onclick = () => {
        document.getElementById("military-screen").classList.remove("active");
        document.getElementById("country-detail-screen").classList.add("active");
        if (this.onBackCallback) this.onBackCallback();
      };
    }

    // زر الدخول إلى مجمع التطوير الحربي وصناعة الأسلحة
    const btnForge = document.getElementById("btn-open-weapon-forge");
    if (btnForge) {
      btnForge.onclick = () => {
        if (window.WeaponForge && this.country) {
          window.WeaponForge.open(this.country);
        }
      };
    }

    document.querySelectorAll(".mil-tab-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".mil-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeBranch = btn.dataset.branch;
        this.renderBranchTable(this.activeBranch);
      };
    });
  }
}

window.MilitaryView = MilitaryView;