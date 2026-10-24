/**
 * Weapon Forge & Defense R&D Engine - عصر الهيمنة
 * مجمع الصناعات الحربية بنظام التركيب الهندسي المعياري (Modular CAD Assembler)
 * الإصدار: v3.9
 *  - إصلاح خطأ ReferenceError (alertRed / glass) الذي كان يوقف الرسم
 *  - سحب القطع بالماوس/اللمس + تكبير بعجلة الماوس + تحريك المنظر + مقابض تدوير وتحجيم
 *  - مكتبة موسعة (73 قطعة) تُبنى أزرارها تلقائياً من الكود دون الحاجة لتعديل index.html
 *  - تراجع (Ctrl+Z)، اختصارات لوحة المفاتيح، وتصدير رسم القطع لمحاكي المعركة
 */

class WeaponForgeEngine {
  static currentCountry = null;
  static activeTab = "catalog"; // catalog | assemble | export
  static selectedUnit = null;
  static baseTemplateUnit = null;
  static baseTemplateComponentCount = 0;
  static isManuallyPriced = false;

  static components = [];
  static selectedPartIndex = -1;
  static activePartCategory = "ground";

  // حالة العرض (تكبير + تحريك) وحالة السحب
  static view = { zoom: 1, panX: 0, panY: 0 };
  static drag = null;
  static undoStack = [];
  static _eventsBound = false;

  static BOUNDS = {
    minX: -160, maxX: 160,
    minY: -100, maxY: 100,
    maxWidth: 320,
    maxHeight: 200
  };

  // ألوان ثابتة على مستوى الكلاس (كانت سبب الخطأ سابقاً)
  static COLORS = {
    alertRed: "#ef4444",
    glass: "#38bdf8",
    darkMetal: "#1e293b",
    steel: "#475569"
  };

  // =========================================================================
  // مكتبة القطع: تُبنى مرة واحدة. لكل قطعة: الفئة، الاسم، الأبعاد، دالة الرسم
  // =========================================================================
  static get PARTS() {
    if (!this._parts) this._parts = this.buildParts();
    return this._parts;
  }

  static _poly(ctx, pts, fill, stroke = true) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    if (stroke) ctx.stroke();
  }

  static buildParts() {
    const P = (ctx, f, pts) => WeaponForgeEngine._poly(ctx, pts, f);
    const R = (ctx, f, x, y, w, h) => { ctx.fillStyle = f; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); };
    const C = (ctx, f, x, y, r) => { ctx.fillStyle = f; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    const E = (ctx, f, x, y, rx, ry) => { ctx.fillStyle = f; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); };
    const RED = this.COLORS.alertRed, GLASS = this.COLORS.glass;
    const d = {};
    const add = (id, cat, name, w, h, fn) => { d[id] = { cat, name, w, h, draw: fn }; };

    // ================= برية =================
    add("tracks", "ground", "جنزير دبابات مضلع", 68, 22, (ctx) => {
      ctx.fillStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(-28, -9); ctx.lineTo(28, -9);
      ctx.arc(28, 0, 9, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-28, 9);
      ctx.arc(-28, 0, 9, Math.PI / 2, -Math.PI / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0f172a"; ctx.fillRect(-24, -6, 48, 12);
      ctx.fillStyle = "#64748b";
      for (let i = -20; i <= 20; i += 10) { ctx.beginPath(); ctx.arc(i, 0, 3.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    });
    add("hull_tank", "ground", "هيكل مدرع مشطوف", 66, 26, (ctx, c, l, s) => {
      P(ctx, s, [[-31, 11], [31, 11], [24, -7], [-23, -7]]);
      P(ctx, l, [[-23, -7], [24, -7], [18, -12], [-17, -12]]);
    });
    add("turret_tank", "ground", "برج قتالي مصفح", 36, 24, (ctx, c, l) => {
      P(ctx, c, [[-15, 10], [12, 10], [17, 0], [11, -10], [-15, -10], [-18, 0]]);
      P(ctx, l, [[-12, -7], [8, -7], [13, 0], [-14, 0]]);
    });
    add("barrel_cannon", "ground", "سبطانة مدفع مع كابح", 46, 10, (ctx) => {
      R(ctx, "#334155", -2, -3, 38, 6);
      R(ctx, "#0f172a", 36, -5, 6, 10);
    });
    add("mlrs_pod", "ground", "راجمة صواريخ متعددة", 36, 22, (ctx) => {
      R(ctx, "#1e293b", -16, -10, 32, 20);
      ctx.fillStyle = "#f59e0b";
      for (let r = -5; r <= 5; r += 5) for (let cc = -10; cc <= 10; cc += 10) { ctx.beginPath(); ctx.arc(cc, r, 2.2, 0, Math.PI * 2); ctx.fill(); }
    });
    add("chassis_truck", "ground", "شاسيه شاحنة مدولبة", 62, 20, (ctx) => {
      R(ctx, "#334155", -28, -4, 56, 8);
      C(ctx, "#0f172a", -18, 6, 5.5); C(ctx, "#0f172a", 18, 6, 5.5);
    });
    add("wheel_armored", "ground", "عجلة عسكرية مصفحة", 20, 20, (ctx) => {
      C(ctx, "#0f172a", 0, 0, 9); C(ctx, "#475569", 0, 0, 5);
    });
    add("turret_aa", "ground", "برج مدفعي مضاد للطيران", 38, 24, (ctx, c) => {
      C(ctx, c, 0, 0, 9);
      ctx.fillStyle = "#0f172a"; ctx.fillRect(4, -6, 22, 3); ctx.fillRect(4, 3, 22, 3);
    });
    add("armored_cabin", "ground", "كابينة قيادة مصفحة", 32, 26, (ctx, c) => {
      P(ctx, c, [[-14, 11], [14, 11], [14, -2], [4, -11], [-14, -11]]);
      P(ctx, GLASS, [[2, -2], [11, -2], [3, -9], [-2, -9]]);
    });
    add("howitzer_barrel", "ground", "سبطانة هاوتزر ثقيلة", 60, 12, (ctx, c, l) => {
      R(ctx, "#334155", -4, -3, 50, 6);
      R(ctx, c, -4, -5, 12, 10);
      R(ctx, l, 14, -4.5, 14, 9);
      R(ctx, "#0f172a", 46, -4, 8, 8);
    });
    add("mg_turret", "ground", "برج رشاش خفيف", 24, 16, (ctx, c) => {
      C(ctx, c, 0, 0, 7);
      R(ctx, "#111827", 5, -1.5, 16, 3);
    });
    add("reactive_armor", "ground", "دروع تفاعلية", 44, 10, (ctx) => {
      for (let i = 0; i < 5; i++) R(ctx, i % 2 ? "#475569" : "#334155", -22 + i * 9, -5, 8, 10);
    });
    add("soldier", "ground", "جندي مشاة", 14, 26, (ctx, c, l) => {
      R(ctx, "#334155", -4, 7, 3, 6); R(ctx, "#334155", 1, 7, 3, 6);
      R(ctx, c, -4, -5, 8, 12);
      C(ctx, l, 0, -9, 4);
    });
    add("rifle", "ground", "بندقية هجومية", 28, 6, (ctx) => {
      R(ctx, "#1e293b", -12, -1.5, 26, 3);
      R(ctx, "#7c4a1e", -12, -2.5, 8, 5);
    });
    add("bunker", "ground", "مخبأ خرساني", 50, 28, (ctx, c, l, s) => {
      P(ctx, s, [[-25, 14], [25, 14], [20, -6], [-20, -6]]);
      R(ctx, c, -22, -14, 44, 8);
      R(ctx, "#000000", -10, -2, 20, 4);
    });
    add("antenna_mast", "ground", "صاري اتصالات", 8, 40, (ctx) => {
      R(ctx, "#94a3b8", -1, -20, 2, 40);
      C(ctx, RED, 0, -20, 2.5);
    });

    // ================= جوية =================
    add("hull_jet", "air", "جسم مقاتلة انسيابي", 76, 20, (ctx, c, l) => {
      P(ctx, c, [[36, 0], [-26, -9], [-32, 0], [-26, 9]]);
      P(ctx, l, [[20, 0], [-20, -4], [-20, 4]]);
    });
    add("wings_delta", "air", "أجنحة دلتا نفاثة", 44, 68, (ctx, c, l, s) => {
      P(ctx, s, [[14, 0], [-18, -32], [-8, 0], [-18, 32]]);
    });
    add("wing_straight", "air", "جناح طيران مستقيم", 20, 72, (ctx, c) => {
      P(ctx, c, [[-8, -34], [8, -34], [5, 34], [-5, 34]]);
    });
    add("tail_fin", "air", "زعنفة ذيلية رأسية", 22, 24, (ctx, c, l, s) => {
      P(ctx, s, [[0, 0], [-16, -18], [-6, -18], [8, 0]]);
    });
    add("cockpit", "air", "قمرة قيادة زجاجية", 26, 12, (ctx) => {
      E(ctx, GLASS, 0, 0, 12, 5.5);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.ellipse(-2, -1.5, 6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
    });
    add("jet_engine", "air", "محرك نفاث نافث", 32, 14, (ctx) => {
      R(ctx, "#1e293b", -14, -5, 26, 10);
      P(ctx, "#f97316", [[-14, -4], [-22, 0], [-14, 4]]);
    });
    add("propeller", "air", "مروحة دفع", 12, 36, (ctx) => {
      ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(-2, -17, 4, 34);
    });
    add("heli_body", "air", "جسم مروحية", 78, 22, (ctx, c, l) => {
      P(ctx, c, [[-18, -3], [-38, -2], [-38, 2], [-18, 4]]);
      E(ctx, c, 0, 0, 22, 10);
      P(ctx, GLASS, [[8, -7], [20, 0], [8, 6]]);
      P(ctx, l, [[-36, -8], [-33, -8], [-36, 0]]);
    });
    add("rotor", "air", "ريشة دوارة", 80, 6, (ctx) => {
      ctx.fillStyle = "rgba(226,232,240,0.85)"; ctx.fillRect(-40, -1.5, 80, 3);
      C(ctx, "#0f172a", 0, 0, 3);
    });
    add("bomb_load", "air", "حمولة قنابل", 36, 14, (ctx) => {
      for (let i = 0; i < 3; i++) {
        E(ctx, "#64748b", -10 + i * 10, 0, 5.5, 3.6);
        P(ctx, "#334155", [[-14 + i * 10, 0], [-17 + i * 10, -3], [-17 + i * 10, 3]]);
      }
    });
    add("drop_tank", "air", "خزان وقود خارجي", 34, 12, (ctx, c, l) => {
      E(ctx, l, 0, 0, 16, 5.5);
    });
    add("aam_missile", "air", "صاروخ جو-جو", 34, 8, (ctx) => {
      R(ctx, "#f8fafc", -14, -2, 26, 4);
      P(ctx, RED, [[12, -2], [17, 0], [12, 2]]);
      P(ctx, "#475569", [[-14, -4], [-9, -2], [-9, 2], [-14, 4]]);
    });
    add("canard", "air", "جناح أمامي (كاناد)", 14, 30, (ctx, c, l, s) => {
      P(ctx, s, [[4, 0], [-6, -15], [-2, 0]]);
      P(ctx, s, [[4, 0], [-6, 15], [-2, 0]]);
    });
    add("swept_wing", "air", "جناح مائل للخلف", 40, 72, (ctx, c, l, s) => {
      P(ctx, c, [[12, 0], [-6, -36], [-16, -36], [-4, 0], [-16, 36], [-6, 36]]);
    });
    add("stealth_hull", "air", "جسم شبحي مضلع", 80, 40, (ctx, c, l) => {
      P(ctx, c, [[40, 0], [6, -20], [-30, -18], [-22, 0], [-30, 18], [6, 20]]);
      P(ctx, l, [[30, 0], [6, -11], [-14, -10], [-14, 10], [6, 11]]);
    });

    // ================= بحرية =================
    add("hull_ship", "naval", "بدن سفينة حربية", 86, 22, (ctx, c, l, s) => {
      P(ctx, s, [[40, 0], [26, -9], [-38, -9], [-34, 9], [26, 9]]);
      P(ctx, l, [[34, 0], [22, -6], [-30, -6], [-30, 6], [22, 6]]);
    });
    add("deck_carrier", "naval", "سطح مدرج حاملة طائرات", 94, 32, (ctx) => {
      P(ctx, "#1e293b", [[-42, -14], [42, -14], [44, 14], [-44, 14]]);
      ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 1.8; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(38, 0); ctx.stroke();
      ctx.setLineDash([]);
    });
    add("bridge_naval", "naval", "برج قيادة ورادار بحري", 30, 28, (ctx, c, l) => {
      R(ctx, c, -12, -8, 24, 16);
      R(ctx, l, -8, -14, 16, 6);
    });
    add("turret_naval", "naval", "مدفع بحري دوار", 38, 18, (ctx, c) => {
      C(ctx, c, 0, 0, 8);
      ctx.fillStyle = "#0f172a"; ctx.fillRect(3, -2, 20, 4);
    });
    add("sub_hull", "naval", "بدن غواصة أسطواني", 78, 22, (ctx, c, l, s) => {
      E(ctx, s, 0, 0, 36, 10);
    });
    add("sub_tower", "naval", "برج غواصة (شراع)", 20, 20, (ctx, c) => {
      P(ctx, c, [[-8, 6], [8, 6], [4, -8], [-6, -8]]);
    });
    add("hull_destroyer", "naval", "بدن مدمرة انسيابي", 96, 18, (ctx, c, l, s) => {
      P(ctx, s, [[48, 0], [34, -8], [-44, -8], [-44, 8], [34, 8]]);
      P(ctx, l, [[40, 0], [30, -4], [-40, -4], [-40, 4], [30, 4]]);
    });
    add("torpedo_tube", "naval", "أنابيب طوربيد", 28, 12, (ctx) => {
      R(ctx, "#1e293b", -12, -5, 24, 4.5);
      R(ctx, "#1e293b", -12, 0.5, 24, 4.5);
      C(ctx, "#0f172a", 12, -2.7, 2); C(ctx, "#0f172a", 12, 2.7, 2);
    });
    add("ciws", "naval", "مدفع CIWS الدفاعي", 18, 18, (ctx, c) => {
      C(ctx, "#e2e8f0", 0, 0, 7);
      R(ctx, "#111827", 2, -2, 12, 4);
      C(ctx, c, -2, 0, 3);
    });
    add("landing_ramp", "naval", "منحدر إنزال", 36, 20, (ctx) => {
      P(ctx, "#334155", [[-18, -10], [18, -6], [18, 6], [-18, 10]]);
      ctx.fillStyle = "#fbbf24"; ctx.fillRect(-10, -1, 20, 2);
    });
    add("vls_deck", "naval", "خلايا إطلاق عمودية", 40, 20, (ctx, c) => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        R(ctx, "#0f172a", -18 + i * 9, -8 + j * 9, 7, 7);
        ctx.fillStyle = c; ctx.fillRect(-16 + i * 9, -6 + j * 9, 3, 3);
      }
    });
    add("ship_mast", "naval", "صاري سفينة", 20, 36, (ctx, c, l, s) => {
      R(ctx, s, -1.5, -18, 3, 36);
      R(ctx, s, -9, -10, 18, 2);
    });
    add("funnel", "naval", "مدخنة سفينة", 18, 22, (ctx, c) => {
      P(ctx, c, [[-8, 11], [8, 11], [6, -11], [-6, -11]]);
      R(ctx, "#111111", -7, -11, 14, 3);
    });

    // ================= صواريخ ورادارات =================
    add("missile_heavy", "defense", "صاروخ باليستي ضخم", 56, 14, (ctx) => {
      P(ctx, "#f8fafc", [[-20, -5], [16, -5], [26, 0], [16, 5], [-20, 5]]);
      P(ctx, RED, [[16, -5], [26, 0], [16, 5]]);
      P(ctx, "#475569", [[-20, -8], [-14, -5], [-14, 5], [-20, 8]]);
    });
    add("missile_launcher_box", "defense", "حاوية صواريخ دفاعية", 32, 20, (ctx, c) => {
      R(ctx, "#1e293b", -14, -8, 28, 16);
      ctx.fillStyle = c; ctx.fillRect(-11, -5, 22, 10);
    });
    add("missile_silo", "defense", "صومعة إطلاق عمودية", 28, 44, (ctx) => {
      R(ctx, "#0f172a", -12, -18, 24, 36);
      ctx.fillStyle = "#475569"; ctx.fillRect(-14, -20, 28, 4);
    });
    add("radar_dish", "defense", "طبق رادار متحرك", 26, 26, (ctx) => {
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 11, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
      ctx.fillStyle = "#f59e0b"; ctx.fillRect(-3, -3, 6, 6);
    });
    add("radar_dome", "defense", "قبة رادار كروية", 24, 24, (ctx) => {
      C(ctx, "#ffffff", 0, 0, 11);
    });
    add("torpedo", "defense", "طوربيد", 44, 10, (ctx) => {
      E(ctx, "#64748b", 0, 0, 20, 4.5);
      P(ctx, "#334155", [[-20, -1], [-24, -5], [-24, 5], [-20, 1]]);
    });
    add("cruise_body", "defense", "صاروخ كروز مجنح", 50, 28, (ctx) => {
      P(ctx, "#94a3b8", [[16, -4], [26, 0], [16, 4]]);
      P(ctx, "#475569", [[0, -4], [-8, -14], [-12, -14], [-8, -4]]);
      P(ctx, "#475569", [[0, 4], [-8, 14], [-12, 14], [-8, 4]]);
      R(ctx, "#f8fafc", -20, -4, 36, 8);
      P(ctx, RED, [[-20, -4], [-24, -8], [-24, 8], [-20, 4]]);
    });
    add("aerial_bomb", "defense", "قنبلة جوية موجهة", 32, 14, (ctx, c, l, s) => {
      E(ctx, s, 0, 0, 14, 6);
      P(ctx, RED, [[-14, 0], [-20, -7], [-12, -5]]);
      P(ctx, RED, [[-14, 0], [-20, 7], [-12, 5]]);
      ctx.fillStyle = "#fbbf24"; ctx.fillRect(-2, -6, 3, 12);
    });
    add("nuke_warhead", "defense", "رأس نووي", 34, 18, (ctx) => {
      P(ctx, "#fbbf24", [[-14, -8], [8, -8], [18, 0], [8, 8], [-14, 8]]);
      C(ctx, "#111111", -2, 0, 4); C(ctx, "#fbbf24", -2, 0, 1.3);
    });
    add("radar_array", "defense", "رادار مصفوفة طورية", 36, 28, (ctx) => {
      R(ctx, "#1e293b", -14, -12, 28, 24);
      ctx.fillStyle = GLASS;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) ctx.fillRect(-11 + i * 7, -9 + j * 7, 5, 5);
    });
    add("radar_mast", "defense", "صاري رادار", 18, 40, (ctx) => {
      R(ctx, "#94a3b8", -1.5, -20, 3, 40);
      P(ctx, "#cbd5e1", [[-9, -20], [9, -20], [0, -12]]);
      C(ctx, RED, 0, -22, 2);
    });
    add("launch_rail", "defense", "سكة إطلاق", 52, 8, (ctx) => {
      R(ctx, "#475569", -26, -4, 52, 3);
      R(ctx, "#475569", -26, 1, 52, 3);
      for (let i = -22; i <= 22; i += 11) { ctx.fillStyle = "#334155"; ctx.fillRect(i, -4, 2, 8); }
    });
    add("rocket_booster", "defense", "معزز صاروخي", 30, 14, (ctx) => {
      P(ctx, "#f97316", [[-20, -3], [-28, 0], [-20, 3]]);
      P(ctx, "#475569", [[-14, -4], [-20, -6], [-20, 6], [-14, 4]]);
      R(ctx, "#e2e8f0", -14, -6, 26, 12);
    });

    // ================= أشكال هندسية حرة =================
    add("poly_rect", "shapes", "صفيحة درع مستطيلة", 36, 24, (ctx, c, l) => {
      R(ctx, c, -16, -10, 32, 20);
      ctx.fillStyle = l; ctx.fillRect(-16, -12, 32, 2);
    });
    add("poly_trapezoid", "shapes", "شبه منحرف مصفح", 40, 24, (ctx, c) => {
      P(ctx, c, [[-18, 10], [18, 10], [11, -10], [-11, -10]]);
    });
    add("poly_triangle", "shapes", "مثلث مشطوف حاد", 38, 30, (ctx, c) => {
      P(ctx, c, [[18, 0], [-16, -14], [-16, 14]]);
    });
    add("poly_circle", "shapes", "قرص أسطواني مضلع", 26, 26, (ctx, c, l) => {
      C(ctx, c, 0, 0, 12);
      ctx.fillStyle = l; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, Math.PI * 2); ctx.fill();
    });
    add("poly_chevron", "shapes", "درع زاوية حادة (سهم)", 36, 32, (ctx, c) => {
      P(ctx, c, [[18, 0], [-12, -15], [-5, 0], [-12, 15]]);
    });
    add("poly_hexagon", "shapes", "سداسي مضلع", 32, 28, (ctx, c) => {
      const pts = []; for (let i = 0; i < 6; i++) pts.push([16 * Math.cos(i * Math.PI / 3), 14 * Math.sin(i * Math.PI / 3)]);
      P(ctx, c, pts);
    });
    add("poly_octagon", "shapes", "ثماني مضلع", 30, 30, (ctx, c) => {
      const pts = []; for (let i = 0; i < 8; i++) pts.push([15 * Math.cos(i * Math.PI / 4 + Math.PI / 8), 15 * Math.sin(i * Math.PI / 4 + Math.PI / 8)]);
      P(ctx, c, pts);
    });
    add("poly_star", "shapes", "نجمة خماسية", 34, 34, (ctx, c) => {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 16 : 7, a = -Math.PI / 2 + i * Math.PI / 5;
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      P(ctx, c, pts);
    });
    add("poly_parallelogram", "shapes", "متوازي أضلاع", 40, 20, (ctx, c) => {
      P(ctx, c, [[-20, 10], [10, 10], [20, -10], [-10, -10]]);
    });
    add("poly_semicircle", "shapes", "نصف دائرة (قبة)", 32, 16, (ctx, c) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 8, 16, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
    add("poly_ring", "shapes", "حلقة دائرية", 30, 30, (ctx, c) => {
      ctx.fillStyle = c; ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.arc(0, 0, 7, 0, Math.PI * 2, true);
      ctx.fill("evenodd"); ctx.stroke();
    });
    add("poly_cross", "shapes", "شكل صليبي", 30, 30, (ctx, c) => {
      P(ctx, c, [[-5, -15], [5, -15], [5, -5], [15, -5], [15, 5], [5, 5], [5, 15], [-5, 15], [-5, 5], [-15, 5], [-15, -5], [-5, -5]]);
    });
    add("poly_diamond", "shapes", "معين (ماسة)", 26, 34, (ctx, c) => {
      P(ctx, c, [[0, -17], [13, 0], [0, 17], [-13, 0]]);
    });
    add("poly_bar", "shapes", "قضيب رفيع", 48, 6, (ctx, c) => {
      R(ctx, c, -24, -3, 48, 6);
    });
    add("poly_right_triangle", "shapes", "مثلث قائم", 34, 24, (ctx, c) => {
      P(ctx, c, [[-17, 12], [17, 12], [-17, -12]]);
    });
    add("poly_arrow", "shapes", "سهم عريض", 40, 20, (ctx, c) => {
      P(ctx, c, [[-20, -4], [6, -4], [6, -10], [20, 0], [6, 10], [6, 4], [-20, 4]]);
    });

    return d;
  }

  // توافق مع الشيفرة القديمة: أبعاد القطع
  static get PART_DIMENSIONS() {
    const out = {};
    Object.keys(this.PARTS).forEach(k => { out[k] = { w: this.PARTS[k].w, h: this.PARTS[k].h }; });
    return out;
  }

  // =========================================================================
  // التهيئة
  // =========================================================================
  static init() {
    this.buildLibraryUI();
    this.setupEvents();
    this.setupControls();
    this.setupCanvasInteraction();
  }

  static syncCustomUnits(world) {
    if (!world || !Array.isArray(world.countries)) return;
    world.countries.forEach(country => {
      if (Array.isArray(country.customUnits)) {
        country.customUnits.forEach(unit => this.registerUnitToGame(unit));
      }
    });
  }

  static registerUnitToGame(unit) {
    if (!window.MilitaryData || !Array.isArray(window.MilitaryData.UNITS)) return;
    const existingIndex = window.MilitaryData.UNITS.findIndex(u => u.id === unit.id);
    if (existingIndex >= 0) window.MilitaryData.UNITS[existingIndex] = unit;
    else window.MilitaryData.UNITS.push(unit);
  }

  static open(country) {
    if (!country) {
      if (window.currentWorld && window.currentWorld.selectedCountry) country = window.currentWorld.selectedCountry;
      else return;
    }
    this.currentCountry = country;
    const modal = document.getElementById("modal-weapon-forge");
    if (!modal) return;
    modal.classList.add("active");
    this.switchTab("catalog");
    this.renderCatalog();
    this.renderExportMarket();
  }

  static close() {
    const modal = document.getElementById("modal-weapon-forge");
    if (modal) modal.classList.remove("active");
  }

  static switchTab(tab) {
    this.activeTab = tab;
    ["catalog", "assemble", "export"].forEach(t => {
      const btn = document.getElementById(`btn-forge-tab-${t}`);
      const content = document.getElementById(`forge-tab-content-${t}`);
      if (btn) {
        btn.classList.toggle("btn-primary", t === tab);
        btn.classList.toggle("btn-secondary", t !== tab);
      }
      if (content) content.style.display = (t === tab) ? "block" : "none";
    });
    if (tab === "assemble") {
      this.switchPartCategory(this.activePartCategory);
      this.updatePartsListUI();
      this.redrawCanvas();
    }
  }

  static switchPartCategory(cat) {
    this.activePartCategory = cat;
    document.querySelectorAll(".forge-cat-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-cat") === cat);
    });
    document.querySelectorAll(".forge-parts-category-group").forEach(grp => {
      grp.style.display = (grp.getAttribute("data-cat") === cat) ? "grid" : "none";
    });
  }

  // بناء أزرار المكتبة تلقائياً من تعريف القطع (لا حاجة لتعديل index.html)
  static buildLibraryUI() {
    document.querySelectorAll(".forge-parts-category-group").forEach(grp => {
      const cat = grp.getAttribute("data-cat");
      grp.innerHTML = "";
      Object.keys(this.PARTS).forEach(id => {
        const def = this.PARTS[id];
        if (def.cat !== cat) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary btn-sm btn-add-part";
        b.setAttribute("data-part", id);
        b.textContent = `+ ${def.name}`;
        b.onclick = () => this.addPart(id);
        grp.appendChild(b);
      });
    });
  }

  // =========================================================================
  // 1. الكتالوج
  // =========================================================================
  static renderCatalog() {
    const listContainer = document.getElementById("forge-catalog-grid");
    if (!listContainer) return;
    listContainer.innerHTML = "";
    const units = window.MilitaryData?.UNITS || [];

    units.forEach(u => {
      const isCustom = !!u.isCustom;
      const card = document.createElement("div");
      card.className = "forge-unit-card";
      card.style.cssText = `
        background: #0f172a;
        border: 1px solid ${isCustom ? '#8b5cf6' : '#1e293b'};
        border-radius: 8px; padding: 12px;
        display: flex; flex-direction: column; justify-content: space-between;
      `;
      let branchBadge = "🛡️ برية";
      if (u.branch === "naval") branchBadge = "⚓ بحرية";
      else if (u.branch === "air") branchBadge = "✈️ جوية";
      else if (u.branch === "defense") branchBadge = "🚀 ص ق";

      card.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span class="badge ${isCustom ? 'badge-purple' : ''}" style="font-size:0.75rem;">${branchBadge}</span>
            ${isCustom ? `<span style="color:#c084fc; font-size:0.72rem; font-weight:bold;">★ طراز سيادي [${u.creatorCountryName || 'خاص'}]</span>` : ''}
          </div>
          <strong style="color:#ffffff; font-size:0.95rem; display:block; margin-bottom:4px;">${u.name}</strong>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:0.75rem; color:#94a3b8; margin:8px 0;">
            <div>القوة: <strong style="color:#fbbf24;">${u.power || 0}</strong></div>
            <div>السعر: <strong style="color:#34d399;">$${(u.price || 0).toLocaleString()}</strong></div>
            <div>المدى: <strong style="color:#38bdf8;">${u.combatRange || u.range || 200}</strong></div>
            <div>الطاقم: <strong style="color:#f87171;">${u.crew || 0}</strong></div>
            <div>وقود: <strong style="color:#fb923c;">${u.fuel || 0}</strong></div>
            <div>ذخيرة: <strong style="color:#e2e8f0;">${u.ammo || 0}</strong></div>
          </div>
        </div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="btn btn-secondary btn-sm btn-load-to-builder" data-id="${u.id}" style="flex:1;">⚙️ فتح للتطوير والتحسين</button>
        </div>
      `;
      listContainer.appendChild(card);
    });

    listContainer.querySelectorAll(".btn-load-to-builder").forEach(btn => {
      btn.onclick = () => this.loadUnitIntoAssembler(btn.getAttribute("data-id"));
    });
  }

  // =========================================================================
  // 2. التفكيك والتحميل (الـ 48 سلاحاً) - قوالب مدمجة
  // =========================================================================
  static loadUnitIntoAssembler(unitId) {
    const u = (window.MilitaryData && typeof window.MilitaryData.getUnitById === "function")
      ? window.MilitaryData.getUnitById(unitId)
      : (window.MilitaryData?.UNITS || []).find(item => item.id === unitId);
    if (!u) return;

    this.selectedUnit = u;
    this.baseTemplateUnit = u;
    this.isManuallyPriced = false;
    const country = this.currentCountry;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    setVal("asm-unit-name", `${u.name} - طراز [${country ? country.name : 'سيادي'}]`);
    setVal("asm-unit-branch", u.branch || "ground");
    setVal("asm-unit-power", Math.max(1, Math.round((u.power || 1) * 1.2)));
    setVal("asm-unit-range", Math.max(100, Math.round(parseFloat(u.combatRange) || parseFloat(u.range) || 200)));
    setVal("asm-unit-crew", u.crew !== undefined ? u.crew : 1);
    setVal("asm-unit-fuel", u.fuel !== undefined ? u.fuel : 1);
    setVal("asm-unit-ammo", u.ammo !== undefined ? u.ammo : 2);

    const targets = Array.isArray(u.targetDomains) ? u.targetDomains : ["ground"];
    ["ground", "naval", "air"].forEach(t => {
      const chk = document.getElementById(`target-chk-${t}`);
      if (chk) chk.checked = targets.includes(t);
    });

    if (u.isCustom && Array.isArray(u.componentsData) && u.componentsData.length > 0) {
      this.components = JSON.parse(JSON.stringify(u.componentsData));
    } else {
      this.components = this.generateDeconstructedComponentsForUnit(u);
    }

    this.baseTemplateComponentCount = this.components.length;
    this.selectedPartIndex = this.components.length - 1;
    this.undoStack = [];
    this.resetView();
    this.switchTab("assemble");
    this.updatePartsListUI();
    this.redrawCanvas();
    this.calculateDynamicPrice();
  }

  static resetToScratch() {
    this.baseTemplateUnit = null;
    this.baseTemplateComponentCount = 0;
    this.isManuallyPriced = false;
    this.components = [];
    this.selectedPartIndex = -1;
    this.undoStack = [];
    this.resetView();

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal("asm-unit-name", "سلاح قتالي مبتكر");
    setVal("asm-unit-power", 10);
    setVal("asm-unit-range", 200);
    setVal("asm-unit-crew", 1);
    setVal("asm-unit-fuel", 1);
    setVal("asm-unit-ammo", 2);

    this.switchTab("assemble");
    this.updatePartsListUI();
    this.redrawCanvas();
    this.calculateDynamicPrice();
  }

  /**
   * قوالب التفكيك: [النوع, x, y, scaleX, scaleY, rotation, مفتاح اللون]
   * مفاتيح الألوان: D معدن داكن | S فولاذ | C لون الدولة | R أحمر | G زجاج | W أبيض
   *                 K أسود | B كحلي | L رمادي فاتح | Z رمادي ثلجي | Y أصفر | N ذهبي | F ثلجي | U أزرق داكن
   */
  static get DECONSTRUCT_TEMPLATES() {
    return {
      infantry_def: [["poly_rect", -6, 16, .6, 1.2, 0, "D"], ["poly_rect", 6, 16, .6, 1.2, 0, "D"], ["poly_trapezoid", 0, 2, 1.1, 1.2, 0, "C"], ["poly_circle", 0, -16, .9, .9, 0, "S"], ["poly_trapezoid", -18, 0, .8, 1.6, 0, "B"], ["barrel_cannon", 12, 2, .6, .5, -10, "K"]],
      infantry_atk: [["poly_rect", -6, 16, .6, 1.2, 10, "D"], ["poly_rect", 8, 16, .6, 1.2, -15, "D"], ["poly_trapezoid", 0, 2, 1.1, 1.2, 0, "C"], ["poly_circle", 0, -16, .9, .9, 0, "S"], ["barrel_cannon", 16, -2, .8, .6, -15, "B"]],
      troop_carrier: [["chassis_truck", 0, 18, 1.2, 1, 0, "D"], ["hull_tank", -6, 6, 1.2, 1.1, 0, "S"], ["armored_cabin", 28, 0, .9, .9, 0, "C"], ["poly_rect", -14, -6, 1.4, .8, 0, "S"]],
      cannon: [["wheel_armored", -14, 14, 1.2, 1.2, 0, "D"], ["wheel_armored", 14, 14, 1.2, 1.2, 0, "D"], ["poly_trapezoid", 0, 4, 1.3, .9, 0, "C"], ["howitzer_barrel", 26, -6, 1, 1, -18, "D"]],
      armored_carrier: [["tracks", 0, 18, 1.1, 1, 0, "D"], ["hull_tank", 0, 4, 1.1, 1.1, 0, "S"], ["turret_tank", 10, -8, .8, .8, 0, "C"], ["barrel_cannon", 24, -8, .8, .8, 0, "D"]],
      auto_cannon: [["wheel_armored", -24, 18, 1, 1, 0, "D"], ["wheel_armored", 0, 18, 1, 1, 0, "D"], ["wheel_armored", 24, 18, 1, 1, 0, "D"], ["hull_tank", 0, 4, 1.2, 1.1, 0, "S"], ["turret_aa", 6, -10, 1.1, 1.1, -20, "C"], ["radar_dish", -22, -10, .8, .8, 0, "L"]],
      small_tank: [["tracks", 0, 16, .9, .9, 0, "D"], ["hull_tank", 0, 4, .9, .9, 0, "S"], ["turret_tank", -4, -6, .8, .8, 0, "C"], ["barrel_cannon", 14, -6, 1.1, .9, 0, "D"]],
      med_tank: [["tracks", 0, 18, 1.1, 1, 0, "D"], ["hull_tank", 0, 4, 1.1, 1.1, 0, "S"], ["turret_tank", -4, -8, 1.1, 1.1, 0, "C"], ["barrel_cannon", 18, -8, 1.4, 1.1, 0, "D"]],
      small_mlrs: [["chassis_truck", 0, 16, 1, 1, 0, "D"], ["armored_cabin", 24, 4, .9, .9, 0, "S"], ["mlrs_pod", -12, -8, 1, 1, -20, "C"]],
      aa_tank: [["tracks", 0, 18, 1.15, 1, 0, "D"], ["hull_tank", 0, 4, 1.15, 1.1, 0, "S"], ["turret_aa", 0, -8, 1.3, 1.2, -35, "C"], ["radar_dish", -24, -12, .9, .9, 0, "L"]],
      as_tank: [["tracks", 0, 18, 1.2, 1.1, 0, "D"], ["hull_tank", 0, 4, 1.2, 1.1, 0, "S"], ["missile_launcher_box", -6, -10, 1.3, 1.2, -25, "C"], ["missile_heavy", 8, -12, .8, .8, -25, "R"]],
      rocket_launcher: [["wheel_armored", -30, 18, 1, 1, 0, "D"], ["wheel_armored", -10, 18, 1, 1, 0, "D"], ["wheel_armored", 10, 18, 1, 1, 0, "D"], ["wheel_armored", 30, 18, 1, 1, 0, "D"], ["armored_cabin", 32, 4, 1, 1, 0, "C"], ["mlrs_pod", -14, -8, 1.5, 1.2, -28, "D"]],
      military_base: [["poly_rect", 0, 16, 3, .8, 0, "D"], ["poly_trapezoid", -20, 2, 1.5, 1.2, 0, "S"], ["poly_trapezoid", 20, 2, 1.5, 1.2, 0, "S"], ["radar_dish", -20, -18, 1.2, 1.2, 0, "C"], ["radar_dome", 20, -14, 1, 1, 0, "W"]],
      arms_factory: [["poly_rect", 0, 14, 3.2, 1, 0, "D"], ["poly_rect", -18, -2, 1.6, 1.5, 0, "S"], ["poly_trapezoid", 22, -4, 1.2, 1.6, 0, "C"], ["poly_rect", 32, -22, .4, 1.2, 0, "L"]],
      ammo_factory: [["poly_rect", 0, 14, 3.2, 1, 0, "D"], ["poly_rect", -18, -2, 1.6, 1.5, 0, "S"], ["poly_trapezoid", 22, -4, 1.2, 1.6, 0, "C"], ["poly_rect", 32, -22, .4, 1.2, 0, "L"]],
      anti_rocket_launcher: [["tracks", 0, 18, 1.3, 1.1, 0, "D"], ["hull_tank", 0, 4, 1.3, 1.1, 0, "S"], ["missile_launcher_box", -10, -12, 1.4, 1.3, -40, "C"], ["radar_dish", 28, -8, 1, 1, 0, "Z"]],

      naval_troop_carrier: [["hull_ship", 0, 14, 1.3, 1.1, 0, "S"], ["bridge_naval", -28, -2, 1, 1, 0, "C"], ["poly_rect", 12, 4, 1.8, .8, 0, "D"]],
      war_corvette: [["hull_ship", 0, 12, 1, 1, 0, "S"], ["bridge_naval", -6, -4, .9, .9, 0, "C"], ["turret_naval", 24, 4, .8, .8, 0, "D"], ["radar_dish", -6, -16, .8, .8, 0, "Z"]],
      naval_gear_carrier: [["hull_ship", 0, 14, 1.4, 1.2, 0, "S"], ["bridge_naval", -34, -4, .9, 1.1, 0, "C"], ["poly_rect", -6, 2, 1, .8, 0, "R"], ["poly_rect", 18, 2, 1, .8, 0, "Y"]],
      destroyer: [["hull_destroyer", 0, 12, 1.1, 1, 0, "S"], ["bridge_naval", -4, -4, 1.1, 1, 0, "C"], ["turret_naval", 34, 4, .9, .9, 0, "D"], ["turret_naval", -30, 4, .8, .8, 180, "D"], ["radar_dome", -4, -18, .9, .9, 0, "W"]],
      small_sub: [["sub_hull", 0, 8, 1.4, 1.1, 0, "D"], ["sub_tower", 6, -10, 1, 1.1, 0, "C"], ["poly_triangle", -44, 8, .8, .9, 180, "S"], ["poly_rect", 24, 8, .5, .5, 0, "S"]],
      aa_sub: [["sub_hull", 0, 8, 1.4, 1.1, 0, "D"], ["sub_tower", 6, -10, 1, 1.1, 0, "C"], ["poly_triangle", -44, 8, .8, .9, 180, "S"], ["turret_aa", 26, 0, .8, .8, -30, "L"]],
      missile_sub: [["sub_hull", 0, 8, 1.4, 1.1, 0, "D"], ["sub_tower", 6, -10, 1, 1.1, 0, "C"], ["poly_triangle", -44, 8, .8, .9, 180, "S"], ["missile_heavy", -16, -12, .8, .8, -45, "R"]],
      frigate: [["hull_ship", 0, 12, 1.25, 1, 0, "S"], ["bridge_naval", -6, -4, 1, 1, 0, "C"], ["turret_naval", 30, 4, .9, .9, 0, "D"], ["missile_launcher_box", 10, 0, .8, .8, -20, "D"], ["radar_dish", -6, -18, .9, .9, 0, "Z"]],
      battleship: [["hull_ship", 0, 14, 1.5, 1.3, 0, "S"], ["bridge_naval", -2, -6, 1.3, 1.2, 0, "C"], ["turret_naval", 42, 4, 1.2, 1.1, 0, "D"], ["turret_naval", 22, 4, 1.1, 1, 0, "D"], ["turret_naval", -36, 4, 1.1, 1, 180, "D"], ["radar_dome", -2, -22, 1, 1, 0, "W"]],
      carrier: [["hull_ship", 0, 16, 1.6, 1.3, 0, "S"], ["deck_carrier", 0, 4, 1.6, .8, 0, "D"], ["bridge_naval", -32, -8, .8, 1.1, 0, "C"], ["hull_jet", 16, 0, .45, .45, 0, "W"], ["hull_jet", -4, 0, .45, .45, 0, "W"]],

      uav_attack: [["hull_jet", 0, 0, .9, .7, 0, "S"], ["wing_straight", -4, 0, 1.4, .6, 0, "C"], ["tail_fin", -26, -10, .7, .8, -25, "S"], ["tail_fin", -26, 10, .7, .8, 25, "S"], ["radar_dome", 16, 2, .5, .5, 0, "G"]],
      a10_ground: [["hull_jet", 0, 0, 1.1, 1, 0, "S"], ["wing_straight", 0, 0, 1.2, 1, 0, "C"], ["jet_engine", -16, -12, .9, .8, 0, "D"], ["jet_engine", -16, 12, .9, .8, 0, "D"], ["cockpit", 18, 0, .9, .9, 0, "G"], ["barrel_cannon", 34, 2, .7, .7, 0, "O"]],
      f15_attack: "FIGHTER", f16_attack: "FIGHTER", mig25_attack: "FIGHTER", mig31_attack: "FIGHTER", mirage_attack: "FIGHTER",
      su25_ground: [["hull_jet", 0, 0, 1.15, 1.05, 0, "S"], ["wing_straight", -2, 0, 1.15, 1.05, 0, "C"], ["cockpit", 16, 0, .9, .9, 0, "G"], ["tail_fin", -24, 0, .9, 1, 0, "S"], ["bomb_load", -2, 20, .8, .8, 0, "S"], ["bomb_load", -2, -20, .8, .8, 0, "S"]],
      cargo_plane: "CARGO", c130_ground: "CARGO",
      f35_attack: [["stealth_hull", 2, 0, 1.1, 1, 0, "S"], ["wings_delta", -6, 0, 1.2, 1.2, 0, "C"], ["cockpit", 18, 0, .9, .8, 0, "U"], ["tail_fin", -22, -12, .8, .9, -20, "S"], ["tail_fin", -22, 12, .8, .9, 20, "S"]],
      air_base: [["poly_rect", 0, 0, 3.2, 1.8, 0, "D"], ["poly_rect", 0, 0, 3, .3, 0, "Y"], ["poly_trapezoid", -28, -16, 1.2, 1.3, 0, "C"], ["radar_dish", -28, -34, 1, 1, 0, "W"]],

      naval_defense: "SAM_TRUCK", air_defense: "SAM_TRUCK",
      scud_missile: "MISSILE_TRUCK", nuclear_missile: "MISSILE_TRUCK",
      patriot_missile: "PATRIOT", anti_missile: "PATRIOT",
      cruise_missile: [["cruise_body", 0, 0, 1.2, 1, 0, "F"], ["wing_straight", 2, 0, .8, .5, 0, "C"], ["tail_fin", -26, 0, .6, .6, 0, "R"]],
      moab_bomb: "BOMB", nuclear_bomb: "BOMB",
      launch_pad: [["poly_rect", 0, 18, 3.2, 1, 0, "D"], ["poly_trapezoid", -22, -2, 1.2, 1.8, 0, "S"], ["missile_silo", 12, -6, 1.2, 1.6, 0, "C"], ["radar_dish", -22, -26, 1.1, 1.1, 0, "W"]]
    };
  }

  static generateDeconstructedComponentsForUnit(u) {
    const col = {
      D: "#1e293b", S: "#475569", C: this.currentCountry ? (this.currentCountry.militaryColor || "#3b82f6") : "#3b82f6",
      R: "#ef4444", G: "#38bdf8", W: "#ffffff", K: "#111111", B: "#0f172a", L: "#94a3b8",
      Z: "#cbd5e1", Y: "#eab308", N: "#fbbf24", F: "#f8fafc", U: "#0284c7", O: "#000000"
    };
    const T = this.DECONSTRUCT_TEMPLATES;
    let tpl = T[u.id];

    if (tpl === "FIGHTER") {
      tpl = [["hull_jet", 2, 0, 1.2, 1, 0, "S"], ["wings_delta", -4, 0, 1.1, 1.1, 0, "C"], ["cockpit", 16, 0, 1, 1, 0, "G"], ["tail_fin", -24, 0, .9, 1, 0, "S"], ["aam_missile", -4, -24, .7, .7, 0, "R"], ["aam_missile", -4, 24, .7, .7, 0, "R"]];
    } else if (tpl === "CARGO") {
      tpl = [["hull_jet", 0, 0, 1.5, 1.4, 0, "S"], ["wing_straight", 0, 0, 1.6, 1.2, 0, "C"], ["cockpit", 28, 0, .8, .8, 0, "G"], ["propeller", 6, -26, .8, .8, 0, "W"], ["propeller", 6, 26, .8, .8, 0, "W"], ["tail_fin", -36, 0, 1.2, 1.2, 0, "S"]];
    } else if (tpl === "SAM_TRUCK") {
      tpl = [["poly_rect", 0, 16, 2.2, .8, 0, "D"], ["poly_trapezoid", 0, 6, 1.4, 1, 0, "S"], ["missile_launcher_box", 4, -8, 1.4, 1.3, -40, "C"], ["radar_dish", -24, -4, 1, 1, 0, "Z"]];
    } else if (tpl === "MISSILE_TRUCK") {
      const nuke = u.id === "nuclear_missile";
      tpl = [["wheel_armored", -30, 18, 1, 1, 0, "D"], ["wheel_armored", -10, 18, 1, 1, 0, "D"], ["wheel_armored", 10, 18, 1, 1, 0, "D"], ["wheel_armored", 30, 18, 1, 1, 0, "D"], ["armored_cabin", 32, 4, 1, 1, 0, "S"], ["missile_heavy", -6, -8, 1.6, 1.5, -22, nuke ? "N" : "R"]];
    } else if (tpl === "PATRIOT") {
      tpl = [["poly_rect", 0, 18, 2.2, .8, 0, "D"], ["poly_trapezoid", 0, 8, 1.3, 1, 0, "S"], ["missile_launcher_box", 6, -8, 1.5, 1.3, -45, "C"], ["radar_dome", -24, -2, 1, 1, 0, "W"]];
    } else if (tpl === "BOMB") {
      const nuke = u.id === "nuclear_bomb";
      tpl = [["missile_heavy", 0, 0, 1.6, 1.8, 0, nuke ? "N" : "S"], ["tail_fin", -24, -8, .8, .8, -30, "R"], ["tail_fin", -24, 8, .8, .8, 30, "R"], ["poly_circle", 22, 0, .9, .9, 0, "D"]];
    }

    if (!Array.isArray(tpl)) {
      tpl = [["hull_tank", 0, 6, 1, 1, 0, "S"], ["turret_tank", 0, -6, 1, 1, 0, "C"], ["barrel_cannon", 16, -6, 1.2, 1, 0, "D"]];
    }
    return tpl.map(([type, x, y, scaleX, scaleY, rotation, ck]) => ({ type, x, y, scaleX, scaleY, rotation, color: col[ck] || ck }));
  }

  // =========================================================================
  // 3. الطبقات والأدوات (إضافة، نسخ، تناظر، حذف، تراجع)
  // =========================================================================
  static pushUndo() {
    this.undoStack.push({ c: JSON.stringify(this.components), s: this.selectedPartIndex });
    if (this.undoStack.length > 60) this.undoStack.shift();
  }

  static undo() {
    const snap = this.undoStack.pop();
    if (!snap) return;
    this.components = JSON.parse(snap.c);
    this.selectedPartIndex = Math.min(snap.s, this.components.length - 1);
    this.updatePartsListUI();
    this.redrawCanvas();
    this.calculateDynamicPrice();
  }

  static _afterChange() {
    this.updatePartsListUI();
    this.redrawCanvas();
    this.calculateDynamicPrice();
  }

  static addPart(type) {
    if (!this.PARTS[type]) return;
    this.pushUndo();
    const sovColor = this.currentCountry ? this.currentCountry.militaryColor || "#3b82f6" : "#3b82f6";
    const offsetStep = (this.components.length % 6) * 8;
    this.components.push({ type, x: offsetStep - 20, y: offsetStep - 20, scaleX: 1.0, scaleY: 1.0, rotation: 0, color: sovColor });
    this.selectedPartIndex = this.components.length - 1;
    this._afterChange();
  }

  static duplicateSelectedPart() {
    if (this.selectedPartIndex < 0 || this.selectedPartIndex >= this.components.length) {
      alert("يرجى تحديد قطعة أولاً لنسخها!");
      return;
    }
    this.pushUndo();
    const cloned = JSON.parse(JSON.stringify(this.components[this.selectedPartIndex]));
    cloned.x = Math.min(this.BOUNDS.maxX, cloned.x + 12);
    cloned.y = Math.min(this.BOUNDS.maxY, cloned.y + 12);
    this.components.push(cloned);
    this.selectedPartIndex = this.components.length - 1;
    this._afterChange();
  }

  static mirrorSelectedPart() {
    if (this.selectedPartIndex < 0 || this.selectedPartIndex >= this.components.length) {
      alert("يرجى تحديد قطعة أولاً لعكس تناظرها!");
      return;
    }
    this.pushUndo();
    const mirrored = JSON.parse(JSON.stringify(this.components[this.selectedPartIndex]));
    mirrored.y = -mirrored.y;
    mirrored.rotation = -mirrored.rotation;
    mirrored.scaleY = -mirrored.scaleY; // قلب الشكل نفسه ليصبح انعكاساً حقيقياً
    this.components.push(mirrored);
    this.selectedPartIndex = this.components.length - 1;
    this._afterChange();
  }

  static deleteSelectedPart() {
    if (this.selectedPartIndex >= 0 && this.selectedPartIndex < this.components.length) {
      this.pushUndo();
      this.components.splice(this.selectedPartIndex, 1);
      this.selectedPartIndex = Math.min(this.selectedPartIndex, this.components.length - 1);
      this._afterChange();
    }
  }

  static deletePartByIndex(index) {
    if (index >= 0 && index < this.components.length) {
      this.pushUndo();
      this.components.splice(index, 1);
      if (this.selectedPartIndex >= this.components.length) this.selectedPartIndex = this.components.length - 1;
      this._afterChange();
    }
  }

  static movePartOrder(index, direction) {
    this.pushUndo();
    if (direction === "up" && index < this.components.length - 1) {
      [this.components[index], this.components[index + 1]] = [this.components[index + 1], this.components[index]];
      this.selectedPartIndex = index + 1;
    } else if (direction === "down" && index > 0) {
      [this.components[index], this.components[index - 1]] = [this.components[index - 1], this.components[index]];
      this.selectedPartIndex = index - 1;
    }
    this.updatePartsListUI();
    this.redrawCanvas();
  }

  static updatePartsListUI() {
    const container = document.getElementById("asm-layers-list");
    if (!container) return;
    container.innerHTML = "";

    if (this.components.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:12px; color:#64748b; font-size:0.8rem;">لا توجد قطع مضافة بعد. اختر قطعة لإضافتها.</div>`;
      return;
    }

    this.components.forEach((part, idx) => {
      const isSelected = (idx === this.selectedPartIndex);
      const def = this.PARTS[part.type];
      const item = document.createElement("div");
      item.className = `asm-layer-item ${isSelected ? 'active' : ''}`;
      item.style.cssText = `
        padding: 6px 8px; background: ${isSelected ? '#1e3a8a' : '#0d1527'};
        border: 1px solid ${isSelected ? '#60a5fa' : '#1e293b'}; border-radius: 6px;
        margin-bottom: 4px; display: flex; justify-content: space-between;
        align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer;
      `;
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden;">
          <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:${part.color}; border:1px solid rgba(255,255,255,0.4); flex-shrink:0;"></span>
          <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:${isSelected ? 'bold' : 'normal'}; color:${isSelected ? '#fff' : '#cbd5e1'};">
            ${idx + 1}. ${def ? def.name : part.type}
          </span>
        </div>
        <div style="display:flex; gap:3px; align-items:center;">
          <button type="button" class="btn btn-secondary btn-sm layer-btn-move" data-idx="${idx}" data-dir="up" title="رفع الطبقة للأعلى" style="padding:1px 5px; font-size:0.65rem;">▲</button>
          <button type="button" class="btn btn-secondary btn-sm layer-btn-move" data-idx="${idx}" data-dir="down" title="خفض الطبقة للأسفل" style="padding:1px 5px; font-size:0.65rem;">▼</button>
          <button type="button" class="btn btn-danger btn-sm layer-btn-del" data-idx="${idx}" title="حذف هذه القطعة بمفردها" style="padding:1px 6px; font-size:0.65rem;">✕</button>
        </div>
      `;
      item.onclick = (e) => {
        if (e.target.closest("button")) return;
        this.selectedPartIndex = idx;
        this.updatePartsListUI();
        this.redrawCanvas();
      };
      container.appendChild(item);
    });

    container.querySelectorAll(".layer-btn-move").forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        this.movePartOrder(parseInt(b.getAttribute("data-idx"), 10), b.getAttribute("data-dir"));
      };
    });
    container.querySelectorAll(".layer-btn-del").forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        this.deletePartByIndex(parseInt(b.getAttribute("data-idx"), 10));
      };
    });

    if (this.selectedPartIndex >= 0 && this.components[this.selectedPartIndex]) {
      this.syncSlidersWithPart(this.components[this.selectedPartIndex]);
    }
  }

  static syncSlidersWithPart(part) {
    if (!part) return;
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const sx = Math.abs(part.scaleX), sy = Math.abs(part.scaleY);
    setV("slider-part-x", Math.round(part.x));
    setV("slider-part-y", Math.round(part.y));
    setV("slider-part-scale-x", sx);
    setV("slider-part-scale-y", sy);
    setV("slider-part-rot", Math.round(part.rotation));
    const cp = document.getElementById("picker-part-color");
    if (cp && part.color && /^#[0-9a-fA-F]{6}$/.test(part.color)) cp.value = part.color;
    setT("val-part-x", Math.round(part.x));
    setT("val-part-y", Math.round(part.y));
    setT("val-part-scale-x", `${+sx.toFixed(2)}x`);
    setT("val-part-scale-y", `${+sy.toFixed(2)}x`);
    setT("val-part-rot", `${Math.round(part.rotation)}°`);
  }

  // =========================================================================
  // 4. العرض: تكبير/تحريك + الرسم
  // =========================================================================
  static resetView() {
    this.view = { zoom: 1, panX: 0, panY: 0 };
  }

  static zoomBy(factor, px, py) {
    const canvas = document.getElementById("forge-assemble-canvas");
    if (!canvas) return;
    const v = this.view;
    if (px === undefined) { px = canvas.width / 2; py = canvas.height / 2; }
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const wx = (px - cx - v.panX) / v.zoom;
    const wy = (py - cy - v.panY) / v.zoom;
    const nz = Math.max(0.4, Math.min(6, v.zoom * factor));
    v.zoom = nz;
    v.panX = px - cx - wx * nz;
    v.panY = py - cy - wy * nz;
    this.redrawCanvas();
  }

  static redrawCanvas() {
    const canvas = document.getElementById("forge-assemble-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const v = this.view;
    const cx = canvas.width / 2, cy = canvas.height / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#070d18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cx + v.panX, cy + v.panY);
    ctx.scale(v.zoom, v.zoom);

    // الشبكة (في فضاء العالم)
    const x0 = (-cx - v.panX) / v.zoom, x1 = (canvas.width - cx - v.panX) / v.zoom;
    const y0 = (-cy - v.panY) / v.zoom, y1 = (canvas.height - cy - v.panY) / v.zoom;
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1 / v.zoom;
    for (let x = Math.floor(x0 / 20) * 20; x <= x1; x += 20) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    for (let y = Math.floor(y0 / 20) * 20; y <= y1; y += 20) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }

    ctx.strokeStyle = "rgba(56,189,248,0.25)";
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(0, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();

    // إطار الأمان الحجمي
    ctx.strokeStyle = "rgba(56,189,248,0.4)";
    ctx.setLineDash([5 / v.zoom, 5 / v.zoom]);
    ctx.strokeRect(this.BOUNDS.minX, this.BOUNDS.minY, this.BOUNDS.maxWidth, this.BOUNDS.maxHeight);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(56,189,248,0.6)";
    ctx.font = `bold ${10 / v.zoom}px 'Cairo', sans-serif`;
    ctx.fillText("إطار الأمان الحجمي للأسلحة في ساحات القتال", this.BOUNDS.minX + 6 / v.zoom, this.BOUNDS.minY - 6 / v.zoom);

    // القطع بالترتيب العمقي
    this.components.forEach(part => this.drawPart(ctx, part));

    // التحديد والمقابض (حجمها ثابت على الشاشة بغض النظر عن التكبير)
    const sel = this.components[this.selectedPartIndex];
    if (sel) this.drawSelection(ctx, sel);

    ctx.restore();

    // معلومات العرض
    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.font = "11px 'Cairo', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`🔍 ${Math.round(v.zoom * 100)}%  |  قطع: ${this.components.length}`, 8, canvas.height - 8);
    ctx.textAlign = "right";
    ctx.fillText("اسحب القطعة • عجلة الماوس للتكبير • اسحب الخلفية للتحريك", canvas.width - 8, canvas.height - 8);
    ctx.textAlign = "left";
  }

  static drawPart(ctx, part) {
    ctx.save();
    try {
      ctx.translate(part.x, part.y);
      ctx.rotate(((part.rotation || 0) * Math.PI) / 180);
      ctx.scale(part.scaleX || 1, part.scaleY || 1);
      this.renderLowPolyPart(ctx, part.type, part.color);
    } catch (err) {
      console.error("WeaponForge: فشل رسم القطعة", part && part.type, err);
    }
    ctx.restore();
  }

  static getHandles(part) {
    const def = this.PARTS[part.type] || { w: 36, h: 26 };
    const hw = def.w * Math.abs(part.scaleX) / 2;
    const hh = def.h * Math.abs(part.scaleY) / 2;
    const a = ((part.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const toWorld = (lx, ly) => ({ x: part.x + lx * cos - ly * sin, y: part.y + lx * sin + ly * cos });
    return {
      hw, hh, a,
      rot: toWorld(0, -hh - 24 / this.view.zoom),
      scale: toWorld(hw, hh)
    };
  }

  static drawSelection(ctx, part) {
    const h = this.getHandles(part);
    const z = this.view.zoom;
    ctx.save();
    ctx.translate(part.x, part.y);
    ctx.rotate(h.a);
    const pad = 3 / z;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.6 / z;
    ctx.setLineDash([4 / z, 3 / z]);
    ctx.strokeRect(-h.hw - pad, -h.hh - pad, (h.hw + pad) * 2, (h.hh + pad) * 2);
    ctx.setLineDash([]);
    // خط وقابض التدوير
    ctx.beginPath();
    ctx.moveTo(0, -h.hh - pad);
    ctx.lineTo(0, -h.hh - 24 / z);
    ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath(); ctx.arc(0, -h.hh - 24 / z, 5 / z, 0, Math.PI * 2); ctx.fill();
    // مقبض التحجيم
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(h.hw + pad - 4 / z, h.hh + pad - 4 / z, 8 / z, 8 / z);
    ctx.restore();
  }

  /** رسم قطعة بالمسار الهندسي المضلع (دالة ثابتة قابلة للاستدعاء من محاكي المعركة) */
  static renderLowPolyPart(ctx, type, color) {
    const def = this.PARTS[type];
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    const c = color || "#64748b";
    const lit = this.adjustColor(c, 0.28);
    const shade = this.adjustColor(c, -0.32);
    if (def) {
      def.draw(ctx, c, lit, shade);
    } else {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.rect(-15, -10, 30, 20); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /** حدود مجموعة قطع بعد التدوير والتحجيم */
  static getComponentsBounds(comps) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (comps || []).forEach(p => {
      const def = this.PARTS[p.type] || { w: 30, h: 20 };
      const hw = def.w * Math.abs(p.scaleX || 1) / 2, hh = def.h * Math.abs(p.scaleY || 1) / 2;
      const a = ((p.rotation || 0) * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
      [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([lx, ly]) => {
        const wx = p.x + lx * cos - ly * sin, wy = p.y + lx * sin + ly * cos;
        minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
        minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
      });
    });
    if (!isFinite(minX)) return { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    return { minX, minY, maxX, maxY };
  }

  /**
   * رسم السلاح كاملاً مضغوطاً في حجم مناسب (يستخدمه battleCanvas.js)
   * dir: +1 يواجه اليمين، -1 يواجه اليسار | يعيد أبعاد الرسم الفعلية
   */
  static drawComponents(ctx, comps, opts = {}) {
    const dir = opts.dir === -1 ? -1 : 1;
    const targetW = opts.targetW || 40;
    const targetH = opts.targetH || 30;
    const b = this.getComponentsBounds(comps);
    const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
    const sc = Math.min(targetW / w, targetH / h, 1.5);
    ctx.save();
    ctx.scale(dir * sc, sc);
    ctx.translate(-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2);
    comps.forEach(p => this.drawPart(ctx, p));
    ctx.restore();
    return { top: (h * sc) / 2, width: w * sc, height: h * sc };
  }

  static adjustColor(hex, percent) {
    if (!hex || typeof hex !== "string") return "#64748b";
    let cleanHex = hex.replace("#", "").trim();
    if (cleanHex.length === 3) cleanHex = cleanHex.split("").map(c => c + c).join("");
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return hex;
    const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * percent)));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + Math.round(255 * percent)));
    const b = Math.min(255, Math.max(0, (num & 0xFF) + Math.round(255 * percent)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  // =========================================================================
  // 5. التفاعل المباشر بالماوس/اللمس: سحب، تدوير، تحجيم، تحريك المنظر، تكبير
  // =========================================================================
  static _toWorld(e) {
    const canvas = document.getElementById("forge-assemble-canvas");
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width);
    const py = (e.clientY - r.top) * (canvas.height / r.height);
    const v = this.view;
    return { px, py, x: (px - canvas.width / 2 - v.panX) / v.zoom, y: (py - canvas.height / 2 - v.panY) / v.zoom };
  }

  static hitTest(wx, wy) {
    const tol = 4 / this.view.zoom;
    for (let i = this.components.length - 1; i >= 0; i--) {
      const p = this.components[i];
      const def = this.PARTS[p.type] || { w: 36, h: 26 };
      const a = ((p.rotation || 0) * Math.PI) / 180;
      const dx = wx - p.x, dy = wy - p.y;
      const rx = dx * Math.cos(a) + dy * Math.sin(a);
      const ry = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(rx) <= def.w * Math.abs(p.scaleX) / 2 + tol && Math.abs(ry) <= def.h * Math.abs(p.scaleY) / 2 + tol) return i;
    }
    return -1;
  }

  static setupCanvasInteraction() {
    const canvas = document.getElementById("forge-assemble-canvas");
    if (!canvas || canvas._forgeBound) return;
    canvas._forgeBound = true;
    canvas.style.touchAction = "none";
    canvas.tabIndex = 0;
    canvas.style.outline = "none";
    const self = this;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      canvas.focus();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const m = self._toWorld(e);
      const sel = self.components[self.selectedPartIndex];
      const r = 10 / self.view.zoom;
      self.drag = null;

      if (sel) {
        const h = self.getHandles(sel);
        if (dist(m, h.rot) <= r) {
          self.pushUndo();
          self.drag = { mode: "rotate" };
        } else if (dist(m, h.scale) <= r) {
          self.pushUndo();
          self.drag = { mode: "scale", d0: Math.max(1, Math.hypot(h.hw, h.hh)), sx: Math.abs(sel.scaleX), sy: Math.abs(sel.scaleY) };
        }
      }
      if (!self.drag) {
        const idx = self.hitTest(m.x, m.y);
        if (idx >= 0) {
          if (idx !== self.selectedPartIndex) {
            self.selectedPartIndex = idx;
            self.updatePartsListUI();
          }
          self.pushUndo();
          const p = self.components[idx];
          self.drag = { mode: "move", ox: m.x - p.x, oy: m.y - p.y };
        } else {
          self.drag = { mode: "pan", sx: m.px, sy: m.py, px0: self.view.panX, py0: self.view.panY };
        }
      }
      self.redrawCanvas();
    });

    canvas.addEventListener("pointermove", (e) => {
      const m = self._toWorld(e);
      const d = self.drag;
      const part = self.components[self.selectedPartIndex];

      if (!d) {
        let cur = "grab";
        if (part) {
          const h = self.getHandles(part), r = 10 / self.view.zoom;
          if (dist(m, h.rot) <= r) cur = "alias";
          else if (dist(m, h.scale) <= r) cur = "nwse-resize";
          else if (self.hitTest(m.x, m.y) >= 0) cur = "move";
        } else if (self.hitTest(m.x, m.y) >= 0) cur = "move";
        canvas.style.cursor = cur;
        return;
      }

      if (d.mode === "pan") {
        self.view.panX = d.px0 + (m.px - d.sx);
        self.view.panY = d.py0 + (m.py - d.sy);
        canvas.style.cursor = "grabbing";
        self.redrawCanvas();
        return;
      }
      if (!part) return;

      if (d.mode === "move") {
        part.x = Math.round(Math.max(self.BOUNDS.minX, Math.min(self.BOUNDS.maxX, m.x - d.ox)));
        part.y = Math.round(Math.max(self.BOUNDS.minY, Math.min(self.BOUNDS.maxY, m.y - d.oy)));
      } else if (d.mode === "rotate") {
        let deg = Math.atan2(m.x - part.x, -(m.y - part.y)) * 180 / Math.PI;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        part.rotation = Math.round(Math.max(-180, Math.min(180, deg)));
      } else if (d.mode === "scale") {
        const def = self.PARTS[part.type] || { w: 36, h: 26 };
        const a = ((part.rotation || 0) * Math.PI) / 180;
        const dx = m.x - part.x, dy = m.y - part.y;
        const rx = Math.abs(dx * Math.cos(a) + dy * Math.sin(a));
        const ry = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
        let nsx, nsy;
        if (e.shiftKey) { // تحجيم حر مستقل
          nsx = (2 * rx) / def.w; nsy = (2 * ry) / def.h;
        } else { // تحجيم متناسب
          const f = Math.hypot(rx, ry) / d.d0;
          nsx = d.sx * f; nsy = d.sy * f;
        }
        const clamp = (v) => Math.round(Math.max(0.2, Math.min(4, v)) * 20) / 20;
        part.scaleX = Math.sign(part.scaleX || 1) * clamp(nsx);
        part.scaleY = Math.sign(part.scaleY || 1) * clamp(nsy);
      }
      self.syncSlidersWithPart(part);
      self.redrawCanvas();
    });

    const endDrag = (e) => {
      if (!self.drag) return;
      const mode = self.drag.mode;
      self.drag = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      canvas.style.cursor = "grab";
      if (mode !== "pan") self._afterChange();
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const m = self._toWorld(e);
      self.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, m.px, m.py);
    }, { passive: false });

    canvas.addEventListener("dblclick", (e) => {
      const m = self._toWorld(e);
      if (self.hitTest(m.x, m.y) < 0) { self.resetView(); self.redrawCanvas(); }
    });

    canvas.addEventListener("keydown", (e) => {
      const part = self.components[self.selectedPartIndex];
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); self.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); self.duplicateSelectedPart(); return; }
      if (!part) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); self.deleteSelectedPart(); return; }
      const step = e.shiftKey ? 5 : 1;
      let moved = true;
      if (e.key === "ArrowLeft") part.x -= step;
      else if (e.key === "ArrowRight") part.x += step;
      else if (e.key === "ArrowUp") part.y -= step;
      else if (e.key === "ArrowDown") part.y += step;
      else moved = false;
      if (moved) {
        e.preventDefault();
        part.x = Math.max(self.BOUNDS.minX, Math.min(self.BOUNDS.maxX, part.x));
        part.y = Math.max(self.BOUNDS.minY, Math.min(self.BOUNDS.maxY, part.y));
        self.syncSlidersWithPart(part);
        self.redrawCanvas();
      }
    });
  }

  // =========================================================================
  // 6. التسعير المزدوج العادل
  // =========================================================================
  static calculateDynamicPrice() {
    const num = (id, d) => { const el = document.getElementById(id); return el ? el.value : d; };
    const power = Math.max(0.1, parseFloat(num("asm-unit-power", 1)) || 1);
    const range = Math.max(50, parseFloat(num("asm-unit-range", 100)) || 100);
    const crew = Math.max(0, parseInt(num("asm-unit-crew", 0), 10) || 0);
    const ammo = Math.max(0, parseInt(num("asm-unit-ammo", 0), 10) || 0);
    const branch = num("asm-unit-branch", "ground") || "ground";

    const isGround = !!document.getElementById("target-chk-ground")?.checked;
    const isNaval = !!document.getElementById("target-chk-naval")?.checked;
    const isAir = !!document.getElementById("target-chk-air")?.checked;
    let domainCount = (isGround ? 1 : 0) + (isNaval ? 1 : 0) + (isAir ? 1 : 0);
    if (domainCount === 0) domainCount = 1;

    let computedPrice = 0;
    const statusBadge = document.getElementById("asm-pricing-mode-badge");

    if (this.baseTemplateUnit) {
      const base = this.baseTemplateUnit;
      const basePrice = Math.max(50, Number(base.price) || 100);
      const basePower = Number(base.power) || 1;
      const baseRange = parseFloat(base.combatRange || base.range) || 200;
      const baseCrew = Number(base.crew) || 0;
      const baseAmmo = Number(base.ammo) || 0;
      const baseDomains = Array.isArray(base.targetDomains) ? base.targetDomains : ["ground"];

      const deltaPower = Math.max(0, power - basePower);
      const deltaRange = Math.max(0, range - baseRange);
      const deltaCrew = Math.max(0, crew - baseCrew);
      const deltaAmmo = Math.max(0, ammo - baseAmmo);
      const deltaParts = Math.max(0, this.components.length - this.baseTemplateComponentCount);

      let newDomainBonus = 0;
      if (isGround && !baseDomains.includes("ground")) newDomainBonus += Math.round(basePrice * 0.15);
      if (isNaval && !baseDomains.includes("naval")) newDomainBonus += Math.round(basePrice * 0.15);
      if (isAir && !baseDomains.includes("air")) newDomainBonus += Math.round(basePrice * 0.15);

      const deltaCost = Math.round((deltaPower * 80) + (deltaRange * 0.5) + (deltaAmmo * 25) + (deltaCrew * 15) + (deltaParts * 15) + newDomainBonus);
      computedPrice = basePrice + deltaCost;

      if (statusBadge) {
        statusBadge.textContent = `★ طراز مطور من [${base.name}] (إضافات: +$${deltaCost.toLocaleString()})`;
        statusBadge.className = "badge badge-purple";
      }
    } else {
      let branchBase = 30;
      if (branch === "air") branchBase = 120;
      else if (branch === "naval") branchBase = 150;
      else if (branch === "defense") branchBase = 200;

      const powerCost = power < 1 ? (power * 60) : (power * 75);
      const rawCost = branchBase + powerCost + (range * 0.4) + (crew * 15) + (ammo * 20) + (this.components.length * 12);
      const domainMult = domainCount === 3 ? 1.30 : (domainCount === 2 ? 1.15 : 1.0);
      computedPrice = Math.max(50, Math.round(rawCost * domainMult));

      if (statusBadge) {
        statusBadge.textContent = "⚙️ سلاح مبتكر جديد بالكامل";
        statusBadge.className = "badge badge-gold";
      }
    }

    const badge = document.getElementById("asm-calc-price-badge");
    if (badge) badge.textContent = `$${computedPrice.toLocaleString()}`;
    const priceInput = document.getElementById("asm-unit-price");
    if (!this.isManuallyPriced && priceInput) priceInput.value = computedPrice;
  }

  /** صورة مصغرة نظيفة للسلاح (بدون شبكة أو مقابض تحديد) */
  static makeThumbnail() {
    try {
      const c = document.createElement("canvas");
      c.width = 200; c.height = 120;
      const ctx = c.getContext("2d");
      ctx.translate(100, 60);
      this.drawComponents(ctx, this.components, { dir: 1, targetW: 180, targetH: 100 });
      return c.toDataURL("image/png");
    } catch (_) {
      return null;
    }
  }

  static saveAssembledUnit() {
    const country = this.currentCountry;
    if (!country) return;

    const name = (document.getElementById("asm-unit-name")?.value || "").trim();
    if (!name) { alert("يرجى إدخال اسم الطراز المبتكر!"); return; }
    if (this.components.length === 0) { alert("لا يمكن حفظ سلاح بدون مكونات! أضف قطعاً للسلاح أولاً."); return; }

    const gv = (id, d) => document.getElementById(id)?.value ?? d;
    const branch = gv("asm-unit-branch", "ground");
    const power = parseFloat(gv("asm-unit-power", 10)) || 10;
    const price = parseInt(gv("asm-unit-price", 500), 10) || 500;
    const range = parseInt(gv("asm-unit-range", 200), 10) || 200;
    const crew = parseInt(gv("asm-unit-crew", 1), 10) || 0;
    const fuel = parseInt(gv("asm-unit-fuel", 0), 10) || 0;
    const ammo = parseInt(gv("asm-unit-ammo", 1), 10) || 0;

    const targets = [];
    ["ground", "naval", "air"].forEach(t => { if (document.getElementById(`target-chk-${t}`)?.checked) targets.push(t); });

    let visualType = "tank";
    if (branch === "naval") visualType = "ship";
    else if (branch === "air") visualType = "jet";
    else if (branch === "defense") visualType = "missile_pad";

    const newUnitId = `custom_${country.id}_${Date.now()}`;
    const newUnit = {
      id: newUnitId, name, branch, price, crew, power, capacity: 0, fuel, ammo,
      targetDomains: targets.length > 0 ? targets : ["ground"],
      range, combatRange: range, isCustom: true,
      creatorCountryId: country.id, creatorCountryName: country.name,
      visualType, customVisualData: this.makeThumbnail(),
      componentsData: JSON.parse(JSON.stringify(this.components)),
      baseTemplateUnitId: this.baseTemplateUnit ? this.baseTemplateUnit.id : null
    };

    if (!Array.isArray(country.customUnits)) country.customUnits = [];
    country.customUnits.push(newUnit);
    this.registerUnitToGame(newUnit);

    if (!country.military) country.military = {};
    if (!country.military.inventory) country.military.inventory = {};
    country.military.inventory[newUnitId] = 0;

    alert(`🎉 تم بنجاح اعتماد وتثبيت براءة اختراع السلاح [${name}] بسعر $${price.toLocaleString()} ودخوله الترسانة الرسمية لدولة [${country.name}]!`);
    this.renderCatalog();
    this.renderExportMarket();
    this.switchTab("export");

    if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") window.MilitaryEngine.syncCountryWithMilitary(country);
    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) window.NetworkEngine.syncCountryChanges(country);
    if (window.MilitaryView && typeof window.MilitaryView.render === "function") window.MilitaryView.render();
  }

  // =========================================================================
  // 7. سوق التصدير
  // =========================================================================
  static renderExportMarket() {
    const listBody = document.getElementById("forge-export-table-body");
    const selectUnit = document.getElementById("export-deal-unit-select");
    const selectBuyer = document.getElementById("export-deal-buyer-select");
    if (!listBody || !selectUnit || !selectBuyer) return;
    const country = this.currentCountry;
    if (!country) return;

    listBody.innerHTML = "";
    selectUnit.innerHTML = `<option value="">-- اختر السلاح المراد بيعه --</option>`;
    selectBuyer.innerHTML = `<option value="">-- اختر الدولة المشتري --</option>`;

    const customList = country.customUnits || [];
    const inv = country.military?.inventory || {};

    customList.forEach(u => {
      const owned = inv[u.id] || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:8px;"><strong style="color:#c084fc;">${u.name}</strong></td>
        <td style="padding:8px; text-align:center;">${u.power}</td>
        <td style="padding:8px; text-align:center;">$${u.price.toLocaleString()}</td>
        <td style="padding:8px; text-align:center;"><strong style="color:#38bdf8;">${owned}</strong></td>
        <td style="padding:8px; text-align:center;"><span class="badge badge-gold">براءة اختراع سيادية</span></td>
      `;
      listBody.appendChild(tr);
      selectUnit.innerHTML += `<option value="${u.id}">${u.name} (المتوفر لديك: ${owned} | سعر الوحدة: $${u.price.toLocaleString()})</option>`;
    });

    if (customList.length === 0) {
      listBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:16px; color:#64748b;">لم تقم هذه الدولة بتصنيع أي أسلحة خاصة حتى الآن.</td></tr>`;
    }

    if (window.currentWorld && Array.isArray(window.currentWorld.countries)) {
      window.currentWorld.countries.forEach(other => {
        if (other.id !== country.id) {
          selectBuyer.innerHTML += `<option value="${other.id}">${other.name} (السيولة: $${Number(other.disposableRevenue || 0).toLocaleString()})</option>`;
        }
      });
    }
  }

  static executeExportDeal() {
    const seller = this.currentCountry;
    const unitSelect = document.getElementById("export-deal-unit-select");
    const buyerSelect = document.getElementById("export-deal-buyer-select");
    const countInput = document.getElementById("export-deal-count");
    if (!seller || !unitSelect || !buyerSelect || !countInput) return;

    const unitId = unitSelect.value;
    const buyerId = buyerSelect.value;
    const count = parseInt(countInput.value, 10);
    if (!unitId || !buyerId || isNaN(count) || count <= 0) { alert("يرجى إكمال تفاصيل الصفقة والكمية بدقة!"); return; }

    const buyer = window.currentWorld?.countries?.find(c => c.id === buyerId);
    const unit = (window.MilitaryData && typeof window.MilitaryData.getUnitById === "function")
      ? window.MilitaryData.getUnitById(unitId)
      : (window.MilitaryData?.UNITS || []).find(item => item.id === unitId);
    if (!buyer || !unit) return;

    const ownedCount = Number(seller.military?.inventory?.[unitId] || 0);
    if (ownedCount < count) {
      alert(`مستودعاتك لا تحتوي على هذه الكمية الجاهزة للتصدير (المتوفر لديك: ${ownedCount})! قم بتصنيعها أولاً في وزارة الدفاع.`);
      return;
    }

    const totalDealPrice = unit.price * count;
    if (Number(buyer.disposableRevenue || 0) < totalDealPrice) {
      alert(`الدولة المشتري لا تملك سيولة كافية (المطلوب: $${totalDealPrice.toLocaleString()})!`);
      return;
    }

    if (!buyer.military) buyer.military = {};
    if (!buyer.military.inventory) buyer.military.inventory = {};

    buyer.disposableRevenue -= totalDealPrice;
    seller.disposableRevenue = (Number(seller.disposableRevenue) || 0) + totalDealPrice;
    seller.military.inventory[unitId] -= count;
    buyer.military.inventory[unitId] = (Number(buyer.military.inventory[unitId]) || 0) + count;

    if (window.ChronicleEngine && typeof window.ChronicleEngine.addEntry === "function") {
      const yr = window.currentWorld?.year || 1;
      window.ChronicleEngine.addEntry(yr, "economic",
        `🤝 صفقة تسليح دولية: اشترت [${buyer.name}] عدد ${count} قطع من السلاح السيادي [${unit.name}] من دولة [${seller.name}] بإجمالي $${totalDealPrice.toLocaleString()}.`);
    }

    alert(`✅ تمت صفقة بيع السلاح بنجاح وتحويل $${totalDealPrice.toLocaleString()} إلى خزينة [${seller.name}]!`);
    this.renderExportMarket();

    if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
      window.MilitaryEngine.syncCountryWithMilitary(seller);
      window.MilitaryEngine.syncCountryWithMilitary(buyer);
    }
    if (window.NetworkEngine && window.NetworkEngine.getRoomId()) {
      window.NetworkEngine.syncCountryChanges(seller);
      window.NetworkEngine.syncCountryChanges(buyer);
    }
  }

  // =========================================================================
  // 8. ربط الأحداث وعناصر التحكم
  // =========================================================================
  static setupEvents() {
    const btnOpenForge = document.getElementById("btn-open-weapon-forge");
    if (btnOpenForge) {
      btnOpenForge.onclick = () => this.open(window.currentWorld?.selectedCountry || this.currentCountry);
    }
    const btnClose = document.getElementById("btn-close-weapon-forge");
    if (btnClose) btnClose.onclick = () => this.close();

    ["catalog", "assemble", "export"].forEach(t => {
      const b = document.getElementById(`btn-forge-tab-${t}`);
      if (b) b.onclick = () => this.switchTab(t);
    });

    const btnSave = document.getElementById("btn-save-assembled-unit");
    if (btnSave) btnSave.onclick = () => this.saveAssembledUnit();
    const btnExecExport = document.getElementById("btn-execute-export-deal");
    if (btnExecExport) btnExecExport.onclick = () => this.executeExportDeal();

    document.querySelectorAll(".forge-cat-tab-btn").forEach(btn => {
      btn.onclick = () => this.switchPartCategory(btn.getAttribute("data-cat"));
    });

    const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
    bind("btn-duplicate-part", () => this.duplicateSelectedPart());
    bind("btn-mirror-part", () => this.mirrorSelectedPart());
    bind("btn-delete-selected-part", () => this.deleteSelectedPart());
    bind("btn-recalc-price", () => { this.isManuallyPriced = false; this.calculateDynamicPrice(); });
    bind("btn-new-scratch-weapon", () => this.resetToScratch());

    // أزرار العرض (تُضاف برمجياً بجانب أدوات النسخ والتناظر)
    const bar = document.querySelector(".cad-quick-actions-bar");
    if (bar && !document.getElementById("btn-forge-zoom-in")) {
      const mk = (id, text, title, fn) => {
        const b = document.createElement("button");
        b.type = "button"; b.id = id; b.className = "btn btn-secondary btn-sm";
        b.textContent = text; b.title = title; b.onclick = fn;
        bar.appendChild(b);
      };
      mk("btn-forge-undo", "↶ تراجع", "تراجع عن آخر تعديل (Ctrl+Z)", () => this.undo());
      mk("btn-forge-zoom-in", "🔍+", "تكبير", () => this.zoomBy(1.25));
      mk("btn-forge-zoom-out", "🔍−", "تصغير", () => this.zoomBy(1 / 1.25));
      mk("btn-forge-view-reset", "⟲ العرض", "إعادة ضبط التكبير والموضع", () => { this.resetView(); this.redrawCanvas(); });
      bar.style.flexWrap = "wrap";
    }
  }

  static setupControls() {
    // توسيع مدى المنزلقات لتناسب القطع المفككة والتكبير الحر
    const range = (id, min, max, step) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.min = min; el.max = max; if (step) el.step = step;
    };
    range("slider-part-x", this.BOUNDS.minX, this.BOUNDS.maxX, 1);
    range("slider-part-y", this.BOUNDS.minY, this.BOUNDS.maxY, 1);
    range("slider-part-scale-x", 0.2, 4, 0.05);
    range("slider-part-scale-y", 0.2, 4, 0.05);
    range("slider-part-rot", -180, 180, 1);

    // كل منزلق يعدل خاصيته فقط (حتى لا تُكتب القيم المقصوصة على بقية الخصائص)
    const bindSlider = (id, apply) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("pointerdown", () => this.pushUndo());
      el.oninput = () => {
        const part = this.components[this.selectedPartIndex];
        if (!part) return;
        const v = parseFloat(el.value);
        if (isNaN(v)) return;
        apply(part, v);
        this.syncSlidersWithPart(part);
        this.redrawCanvas();
        this.calculateDynamicPrice();
      };
    };
    bindSlider("slider-part-x", (p, v) => { p.x = v; });
    bindSlider("slider-part-y", (p, v) => { p.y = v; });
    bindSlider("slider-part-scale-x", (p, v) => { p.scaleX = Math.sign(p.scaleX || 1) * v; });
    bindSlider("slider-part-scale-y", (p, v) => { p.scaleY = Math.sign(p.scaleY || 1) * v; });
    bindSlider("slider-part-rot", (p, v) => { p.rotation = v; });

    const colorPicker = document.getElementById("picker-part-color");
    if (colorPicker) {
      colorPicker.addEventListener("pointerdown", () => this.pushUndo());
      colorPicker.oninput = () => {
        const part = this.components[this.selectedPartIndex];
        if (!part) return;
        part.color = colorPicker.value;
        this.redrawCanvas();
        this.updatePartsListUI();
      };
    }

    ["asm-unit-power", "asm-unit-range", "asm-unit-crew", "asm-unit-ammo", "asm-unit-branch"].forEach(id => {
      const inp = document.getElementById(id);
      if (inp) inp.oninput = () => this.calculateDynamicPrice();
    });
    ["target-chk-ground", "target-chk-naval", "target-chk-air"].forEach(id => {
      const chk = document.getElementById(id);
      if (chk) chk.onchange = () => this.calculateDynamicPrice();
    });

    const priceInput = document.getElementById("asm-unit-price");
    if (priceInput) {
      priceInput.oninput = () => {
        this.isManuallyPriced = true;
        const manualVal = parseInt(priceInput.value, 10) || 0;
        const badge = document.getElementById("asm-calc-price-badge");
        if (badge) badge.textContent = `$${manualVal.toLocaleString()} (تحديد يدوي)`;
      };
    }
  }
}

window.WeaponForge = WeaponForgeEngine;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => WeaponForgeEngine.init());
} else {
  WeaponForgeEngine.init();
}
