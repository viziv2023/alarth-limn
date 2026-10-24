/**
 * ============================================================================
 * BattleCanvasEngine - محرك ساحة المعركة التكتيكي ثلاثي الأبعاد المُنخفض المضلعات
 * (True 3D Low-Poly Hexagonal Tactical Battlefield Engine - v4.6 Mobile)
 * ============================================================================
 *
 * المزايا المعمارية والقتالية الشاملة:
 * 1. مسرح عمليات سداسي ثلاثي الأبعاد مطابق لجمالية العاصمة (True 3D Hexagonal Low-Poly):
 *    - شبكة خلايا سداسية ثلاثية الأبعاد (Hexagonal 3D Prisms) تملأ الميدان بالكامل:
 *      25% مسرح بحري هيدروديناميكي بمضلعات مائية متموجة وزبد شاطئ متحرك،
 *      و75% مسرح بري تكتيكي بتلال وجبال في الأفق، غابات صنوبر، خنادق رملية، وعوائق خرسانية.
 *    - قواعد قيادة أمامية حصينة على طرفي الميدان ترفرف فوقها الراية الوطنية الثلاثية الأبعاد لكل دولة.
 * 2. تمايز بصري كامل للجنود والآليات والأسلحة الـ 48 (Zero Confusion):
 *    - الجنود مصممون بتفاصيل ثلاثية الأبعاد واضحة (حذاء عسكري، بنطال، سترة درع صدري، خوذة قتالية بنظارات،
 *      حقيبة ظهر، وراية فصيل علوية) مع ألوان زي متباينة تماماً بين المهاجم والمدافع، وحركة أرجل عند الجري وركوع عند الرمي.
 *    - مجسمات 3D Low-Poly كبيرة ومفصلة لكل صنف من الأصناف الـ 48 (دروع المشاة، قاذفات الدروع، الشاحنات،
 *      المدافع المجرورة، المدرعات المدولبة، الدبابات الخفيفة والثقيلة ببرج دوار، راجمات الصواريخ، البوارج،
 *      حاملات الطائرات، الغواصات، المقاتلات النفاثة، طائرات الإسناد، ومنصات الصواريخ الاستراتيجية والنووية).
 *    - دعم كامل لرسم الأسلحة السيادية المصنعة في استوديو (WeaponForge CAD).
 * 3. فيزياء قتال ومقذوفات حية لكل سلاح ("روح القتال"):
 *    - اشتباك فوري ومكثف: رشقات رصاص متوهجة، قذائف دبابات خارقة مع لهب فوهة وارتداد سبطانة،
 *      قذائف مدفعية وصواريخ باليستية بمسارات قوسية ثلاثية الأبعاد (Parabolic 3D Arcs)،
 *      رشقات راجمات متعددة بدخان متصاعد، طوربيدات بحرية تفجر أعمدة مائية، وضربات استراتيجية بموجات صدمة واهتزاز كاميرا.
 * 4. تحكم كامل باللمس وشاشات الهواتف (Touch Controls & Camera):
 *    - تحريك وسحب الميدان باللمس، تقريب وتبعيد بالقرص (Pinch-to-zoom)، تدوير زاوية المعركة،
 *      والتحكم بسرعة المعركة (0.5x بطيء سينمائي / 1x طبيعي / 2x سريع).
 */

class BattleCanvasEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
        this.animationFrameId = null;
        this.isRunning = false;

        this.attacker = null;
        this.defender = null;
        this.attackerCoalition = [];
        this.defenderCoalition = [];

        this.hexTiles = [];
        this.entities = [];
        this.projectiles = [];
        this.particles = [];
        this.shockwaves = [];
        this.craters = [];
        this.terrainFeatures = [];
        this.animClock = 0;

        // إعدادات الكاميرا ثلاثية الأبعاد للميدان
        this.camera = {
            panX: 0,
            panY: -10,
            targetPanX: 0,
            targetPanY: -10,
            zoom: 1.04,
            targetZoom: 1.04,
            minZoom: 0.55,
            maxZoom: 2.6,
            yaw: 0.0,
            targetYaw: 0.0,
            pitch: 0.76,
            targetPitch: 0.76,
            shakeAmount: 0,
            isDragging: false,
            dragMode: "pan",
            lastX: 0,
            lastY: 0
        };

        this.timeScale = 1.0;
        this.battleSeed = 123456789;

        this.attackerLosses = {};
        this.defenderLosses = {};
        this.attackerLossesByCountry = {};
        this.defenderLossesByCountry = {};
        this.onBattleEndCallback = null;

        this._setupControlsAndEvents();
    }

    // =========================================================================
    // 1. أدوات الألوان والإضاءة ثلاثية الأبعاد
    // =========================================================================
    static clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    setSeed(seed) {
        this.battleSeed = (Number(seed) || 123456789) >>> 0;
        if (this.battleSeed === 0) this.battleSeed = 123456789;
    }

    _rng() {
        let t = (this.battleSeed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    static parseHex(hex) {
        if (!hex || typeof hex !== "string") return { r: 120, g: 130, b: 145 };
        let clean = hex.replace("#", "").trim();
        if (clean.length === 3) {
            clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
        }
        const num = parseInt(clean, 16);
        if (isNaN(num)) return { r: 120, g: 130, b: 145 };
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    static adjustColor(hex, percent) {
        const c = BattleCanvasEngine.parseHex(hex);
        const delta = Math.round(255 * percent);
        const r = BattleCanvasEngine.clamp(c.r + delta, 0, 255);
        const g = BattleCanvasEngine.clamp(c.g + delta, 0, 255);
        const b = BattleCanvasEngine.clamp(c.b + delta, 0, 255);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    static mixColors(hex1, hex2, t) {
        const c1 = BattleCanvasEngine.parseHex(hex1);
        const c2 = BattleCanvasEngine.parseHex(hex2);
        const r = BattleCanvasEngine.clamp(Math.round(BattleCanvasEngine.lerp(c1.r, c2.r, t)), 0, 255);
        const g = BattleCanvasEngine.clamp(Math.round(BattleCanvasEngine.lerp(c1.g, c2.g, t)), 0, 255);
        const b = BattleCanvasEngine.clamp(Math.round(BattleCanvasEngine.lerp(c1.b, c2.b, t)), 0, 255);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    getCountrySovereignColor(country, fallbackColor) {
        if (country && country.militaryColor && typeof country.militaryColor === "string" && country.militaryColor.indexOf("#") === 0) {
            return country.militaryColor;
        }
        if (country && Array.isArray(country.flag) && country.flag.length > 0) {
            const flat = country.flag.flat ? country.flag.flat() : country.flag;
            const valid = flat.filter(function(c) {
                return c && c !== "#000000" && c !== "#111111" && c !== "#ffffff";
            });
            if (valid.length > 0) return valid[0];
            return flat[0] || (fallbackColor || "#e11d48");
        }
        return fallbackColor || "#e11d48";
    }

    // =========================================================================
    // 2. تهيئة الكاميرا وأزرار التحكم العائمة ودعم اللمس على الهواتف
    // =========================================================================
    _setupControlsAndEvents() {
        window.addEventListener("resize", () => {
            if (this.isRunning) {
                this.resizeCanvas();
                this.generateBattlefieldTerrain();
            }
        });

        if (!this.canvas) return;
        const wrapper = this.canvas.parentElement;
        if (!wrapper) return;

        wrapper.style.position = "relative";

        if (!document.getElementById("battle-floating-controls")) {
            const ctrlBar = document.createElement("div");
            ctrlBar.id = "battle-floating-controls";
            ctrlBar.style.cssText = "position:absolute; bottom:14px; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:30; background:rgba(15,23,42,0.92); border:2px solid #f59e0b; padding:5px 12px; border-radius:999px; box-shadow:0 8px 24px rgba(0,0,0,0.65); backdrop-filter:blur(6px); max-width:95vw; overflow-x:auto;";

            const makeBtn = (id, label, title, onClick) => {
                const b = document.createElement("button");
                b.id = id;
                b.type = "button";
                b.className = "btn btn-secondary btn-sm";
                b.style.cssText = "padding:4px 8px; font-size:0.75rem; min-width:30px; white-space:nowrap;";
                b.textContent = label;
                b.title = title;
                b.onclick = onClick;
                return b;
            };

            ctrlBar.appendChild(makeBtn("bat-zoom-in", "🔍+", "تكبير الميدان", () => {
                this.camera.targetZoom = BattleCanvasEngine.clamp(this.camera.targetZoom + 0.18, this.camera.minZoom, this.camera.maxZoom);
            }));
            ctrlBar.appendChild(makeBtn("bat-zoom-out", "🔍-", "تصغير الميدان", () => {
                this.camera.targetZoom = BattleCanvasEngine.clamp(this.camera.targetZoom - 0.18, this.camera.minZoom, this.camera.maxZoom);
            }));
            ctrlBar.appendChild(makeBtn("bat-rot-left", "↺", "تدوير يساراً", () => {
                this.camera.targetYaw = BattleCanvasEngine.clamp(this.camera.targetYaw - 0.14, -0.45, 0.45);
            }));
            ctrlBar.appendChild(makeBtn("bat-rot-right", "↻", "تدوير يميناً", () => {
                this.camera.targetYaw = BattleCanvasEngine.clamp(this.camera.targetYaw + 0.14, -0.45, 0.45);
            }));
            ctrlBar.appendChild(makeBtn("bat-pitch-btn", "📐 3D", "تبديل زاوية الكاميرا", () => {
                this.camera.targetPitch = this.camera.targetPitch > 0.80 ? 0.58 : (this.camera.targetPitch < 0.66 ? 0.76 : 0.88);
            }));
            const speedBtn = makeBtn("bat-speed-btn", "⚡ 1x", "تبديل سرعة المعركة", () => {
                if (this.timeScale === 1.0) {
                    this.timeScale = 1.85;
                    speedBtn.textContent = "⚡ 2x";
                } else if (this.timeScale > 1.2) {
                    this.timeScale = 0.55;
                    speedBtn.textContent = "🎬 0.5x";
                } else {
                    this.timeScale = 1.0;
                    speedBtn.textContent = "⚡ 1x";
                }
            });
            ctrlBar.appendChild(speedBtn);
            ctrlBar.appendChild(makeBtn("bat-cam-reset", "⟲", "إعادة ضبط الكاميرا", () => {
                this.resetCamera();
            }));

            wrapper.appendChild(ctrlBar);
        }

        this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

        this.canvas.addEventListener("mousedown", (e) => {
            this.camera.isDragging = true;
            this.camera.dragMode = (e.button === 2 || e.button === 1 || e.shiftKey) ? "orbit" : "pan";
            this.camera.lastX = e.clientX;
            this.camera.lastY = e.clientY;
        });

        window.addEventListener("mousemove", (e) => {
            if (!this.isRunning || !this.camera.isDragging) return;
            const dx = e.clientX - this.camera.lastX;
            const dy = e.clientY - this.camera.lastY;
            this.camera.lastX = e.clientX;
            this.camera.lastY = e.clientY;

            if (this.camera.dragMode === "orbit") {
                this.camera.targetYaw = BattleCanvasEngine.clamp(this.camera.targetYaw + dx * 0.004, -0.45, 0.45);
                this.camera.targetPitch = BattleCanvasEngine.clamp(this.camera.targetPitch + dy * 0.004, 0.52, 0.92);
            } else {
                this.camera.targetPanX = BattleCanvasEngine.clamp(this.camera.targetPanX + dx, -350, 350);
                this.camera.targetPanY = BattleCanvasEngine.clamp(this.camera.targetPanY + dy, -220, 220);
            }
        });

        window.addEventListener("mouseup", () => {
            this.camera.isDragging = false;
        });

        this.canvas.addEventListener("wheel", (e) => {
            if (!this.isRunning) return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.12 : -0.12;
            this.camera.targetZoom = BattleCanvasEngine.clamp(this.camera.targetZoom + delta, this.camera.minZoom, this.camera.maxZoom);
        }, { passive: false });

        // دعم اللمس الكامل على الهواتف الذكية (Pinch-to-zoom & Mobile Pan)
        let touchStartDist = 0;
        let touchStartAngle = 0;

        this.canvas.addEventListener("touchstart", (e) => {
            if (!this.isRunning) return;
            if (e.touches.length === 1) {
                this.camera.isDragging = true;
                this.camera.dragMode = "pan";
                this.camera.lastX = e.touches[0].clientX;
                this.camera.lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                this.camera.isDragging = true;
                this.camera.dragMode = "pinch";
                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                touchStartDist = Math.hypot(dx, dy);
                touchStartAngle = Math.atan2(dy, dx);
            }
        }, { passive: false });

        this.canvas.addEventListener("touchmove", (e) => {
            if (!this.isRunning || !this.camera.isDragging) return;
            e.preventDefault();

            if (e.touches.length === 1 && this.camera.dragMode === "pan") {
                const dx = e.touches[0].clientX - this.camera.lastX;
                const dy = e.touches[0].clientY - this.camera.lastY;
                this.camera.lastX = e.touches[0].clientX;
                this.camera.lastY = e.touches[0].clientY;
                this.camera.targetPanX = BattleCanvasEngine.clamp(this.camera.targetPanX + dx * 1.1, -400, 400);
                this.camera.targetPanY = BattleCanvasEngine.clamp(this.camera.targetPanY + dy * 1.1, -260, 260);
            } else if (e.touches.length === 2) {
                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                const dist = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx);

                if (touchStartDist > 10) {
                    const zoomDelta = (dist - touchStartDist) * 0.005;
                    this.camera.targetZoom = BattleCanvasEngine.clamp(this.camera.targetZoom + zoomDelta, this.camera.minZoom, this.camera.maxZoom);

                    let dAngle = angle - touchStartAngle;
                    if (dAngle > Math.PI) dAngle -= Math.PI * 2;
                    if (dAngle < -Math.PI) dAngle += Math.PI * 2;
                    this.camera.targetYaw = BattleCanvasEngine.clamp(this.camera.targetYaw + dAngle * 0.6, -0.45, 0.45);
                }
                touchStartDist = dist;
                touchStartAngle = angle;
            }
        }, { passive: false });

        this.canvas.addEventListener("touchend", () => {
            this.camera.isDragging = false;
        });
    }

    resetCamera() {
        this.camera.targetPanX = 0;
        this.camera.targetPanY = -10;
        this.camera.targetZoom = 1.04;
        this.camera.targetYaw = 0.0;
        this.camera.targetPitch = 0.76;
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        this.width = this.canvas.width = Math.max(320, parent ? parent.clientWidth : 1000);
        this.height = this.canvas.height = Math.max(380, parent ? parent.clientHeight : 560);
    }

    // =========================================================================
    // 3. محرك الإسقاط ثلاثي الأبعاد للميدان (3D Battlefield Projection)
    // =========================================================================
    projectBattle3D(bx, by, bz) {
        const cx = this.width * 0.5;
        const cy = this.height * 0.50;
        const wx = bx - cx;
        const wy = by - cy;
        const wz = bz || 0;

        const cosY = Math.cos(this.camera.yaw);
        const sinY = Math.sin(this.camera.yaw);
        const rx = wx * cosY - wy * sinY;
        const ry = wx * sinY + wy * cosY;

        const sinP = Math.sin(this.camera.pitch);
        const cosP = Math.cos(this.camera.pitch);

        const persp = 1 + (ry / Math.max(700, this.height)) * 0.14;
        const zScale = this.camera.zoom * persp;

        let shakeX = 0;
        let shakeY = 0;
        if (this.camera.shakeAmount > 0.2) {
            shakeX = (Math.random() - 0.5) * this.camera.shakeAmount;
            shakeY = (Math.random() - 0.5) * this.camera.shakeAmount;
        }

        const sx = cx + this.camera.panX + shakeX + rx * zScale;
        const sy = cy + this.camera.panY + shakeY + (ry * sinP * 1.16 - wz * cosP) * zScale;
        const depth = ry * cosP + wz * sinP * 0.2;

        return { x: sx, y: sy, depth: depth, scale: zScale };
    }

    fillPoly2D(pts, fillStyle, strokeStyle, lineWidth) {
        if (!pts || pts.length < 3) return;
        this.ctx.beginPath();
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            this.ctx.lineTo(pts[i].x, pts[i].y);
        }
        this.ctx.closePath();
        if (fillStyle) {
            this.ctx.fillStyle = fillStyle;
            this.ctx.fill();
        }
        if (strokeStyle) {
            this.ctx.strokeStyle = strokeStyle;
            this.ctx.lineWidth = lineWidth || 0.7;
            this.ctx.stroke();
        }
    }

    fillPoly3D(pts3D, fillColor, strokeColor, lineWidth) {
        if (!pts3D || pts3D.length < 3) return;
        const proj = [];
        for (let i = 0; i < pts3D.length; i++) {
            const p = pts3D[i];
            proj.push(this.projectBattle3D(p[0], p[1], p[2] || 0));
        }
        this.fillPoly2D(proj, fillColor, strokeColor, lineWidth);
    }

    drawBattleHexTile3D(tile) {
        const rx = tile.rx;
        const ry = tile.ry;
        const baseZ = -10;
        let wz = tile.elev;

        if (tile.type === "water") {
            wz = Math.sin(this.animClock * 2.2 + tile.col * 0.55 + tile.row * 0.65) * 2.2;
        }

        const topPts = [];
        const botPts = [];
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 180) * (60 * i - 30);
            const vx = tile.x + rx * Math.cos(a);
            const vy = tile.y + ry * Math.sin(a);
            let vz = wz;
            if (tile.type === "water") {
                vz += Math.sin(this.animClock * 2.5 + vx * 0.025 + vy * 0.025) * 1.4;
            }
            topPts.push(this.projectBattle3D(vx, vy, vz));
            botPts.push(this.projectBattle3D(vx, vy, baseZ));
        }

        const cliffCol = tile.type === "water" ? "#0c4a6e" : (tile.type === "sand" ? "#78350f" : "#3f2e21");
        for (let i = 1; i <= 3; i++) {
            const next = (i + 1) % 6;
            const shade = i === 2 ? -0.16 : -0.08;
            this.fillPoly2D(
                [topPts[i], topPts[next], botPts[next], botPts[i]],
                BattleCanvasEngine.adjustColor(cliffCol, shade),
                "rgba(0,0,0,0.22)",
                0.6
            );
        }

        const centerZ = tile.type === "water" ? wz : wz + tile.bump;
        const centerPt = this.projectBattle3D(tile.x, tile.y, centerZ);

        for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            const triShade = ((i % 3) - 1) * 0.04;
            const fCol = BattleCanvasEngine.adjustColor(tile.topColor, triShade);
            this.fillPoly2D(
                [centerPt, topPts[i], topPts[next]],
                fCol,
                tile.type === "water" ? "rgba(186,230,253,0.14)" : "rgba(255,255,255,0.05)",
                0.55
            );
        }

        if (tile.isCoastWater) {
            const foamAlpha = 0.4 + (Math.sin(this.animClock * 3.2 + tile.col) + 1) * 0.25;
            this.ctx.save();
            this.ctx.strokeStyle = "rgba(240, 249, 255, " + foamAlpha + ")";
            this.ctx.lineWidth = 2.2 * centerPt.scale;
            this.ctx.beginPath();
            this.ctx.moveTo(topPts[1].x, topPts[1].y);
            this.ctx.lineTo(topPts[2].x, topPts[2].y);
            this.ctx.lineTo(topPts[3].x, topPts[3].y);
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    drawBox3D(bx, by, bz, w, d, h, angle, wallColor, topColor, strokeCol) {
        const hw = w * 0.5;
        const hd = d * 0.5;
        const cosA = Math.cos(angle || 0);
        const sinA = Math.sin(angle || 0);

        const local = [
            [-hw, -hd],
            [hw, -hd],
            [hw, hd],
            [-hw, hd]
        ];

        const bot = [];
        const top = [];
        for (let i = 0; i < 4; i++) {
            const lx = local[i][0];
            const ly = local[i][1];
            const gx = bx + lx * cosA - ly * sinA;
            const gy = by + lx * sinA + ly * cosA;
            bot.push(this.projectBattle3D(gx, gy, bz));
            top.push(this.projectBattle3D(gx, gy, bz + h));
        }

        const faces = [];
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            const b0 = bot[i],
                b1 = bot[next],
                t1 = top[next],
                t0 = top[i];
            const faceAngle = (angle || 0) + i * (Math.PI * 0.5) + this.camera.yaw;
            const shade = Math.cos(faceAngle - 0.9) * 0.18;
            faces.push({
                depth: (b0.depth + b1.depth + t1.depth + t0.depth) * 0.25,
                pts: [b0, b1, t1, t0],
                color: BattleCanvasEngine.adjustColor(wallColor, shade)
            });
        }

        faces.sort((a, b) => a.depth - b.depth);
        const sCol = strokeCol || "rgba(15, 23, 42, 0.38)";

        for (let i = 0; i < faces.length; i++) {
            const f = faces[i];
            this.fillPoly2D(f.pts, f.color, sCol, 0.75);
        }

        this.fillPoly2D(top, topColor || BattleCanvasEngine.adjustColor(wallColor, 0.22), sCol, 0.75);
    }

    // =========================================================================
    // 4. بدء المعركة وتوليد التضاريس السداسية وإنزال الجيوش
    // =========================================================================
    startBattle(attacker, defender, attackerForces, defenderForces, onBattleEnd) {
        const atkCoalition = [{ country: attacker, forces: attackerForces }];
        const defCoalition = [{ country: defender, forces: defenderForces }];

        this.startCoalitionBattle(atkCoalition, defCoalition, (res) => {
            if (onBattleEnd) {
                onBattleEnd({
                    winner: res.winner,
                    attackerLosses: res.attackerLossesByCountry[attacker.id] || {},
                    defenderLosses: res.defenderLossesByCountry[defender.id] || {}
                });
            }
        });
    }

    startCoalitionBattle(atkCoalition, defCoalition, onBattleEnd, battleSeed) {
        this.setSeed(battleSeed || Date.now());
        this.resizeCanvas();
        this.resetCamera();
        this.timeScale = 1.0;
        const speedBtn = document.getElementById("bat-speed-btn");
        if (speedBtn) speedBtn.textContent = "⚡ 1x";

        this.attackerCoalition = atkCoalition;
        this.defenderCoalition = defCoalition;
        this.attacker = atkCoalition[0] ? atkCoalition[0].country : null;
        this.defender = defCoalition[0] ? defCoalition[0].country : null;
        this.onBattleEndCallback = onBattleEnd;

        let atkBaseColor = this.getCountrySovereignColor(this.attacker, "#10b981");
        let defBaseColor = this.getCountrySovereignColor(this.defender, "#ef4444");

        if (atkBaseColor.toLowerCase() === defBaseColor.toLowerCase()) {
            atkBaseColor = "#10b981";
            defBaseColor = "#ef4444";
        }

        this.attackerColor = atkBaseColor;
        this.defenderColor = defBaseColor;

        this.entities = [];
        this.projectiles = [];
        this.particles = [];
        this.shockwaves = [];
        this.craters = [];
        this.attackerLosses = {};
        this.defenderLosses = {};
        this.attackerLossesByCountry = {};
        this.defenderLossesByCountry = {};
        this.animClock = 0;

        atkCoalition.forEach((m) => {
            this.attackerLossesByCountry[m.country.id] = {};
        });
        defCoalition.forEach((m) => {
            this.defenderLossesByCountry[m.country.id] = {};
        });

        this.generateBattlefieldTerrain();

        atkCoalition.forEach((member, idx) => {
            let col = this.getCountrySovereignColor(member.country, idx === 0 ? atkBaseColor : "#06b6d4");
            this.spawnForces(member.forces, "attacker", member.country, col);
        });

        defCoalition.forEach((member, idx) => {
            let col = this.getCountrySovereignColor(member.country, idx === 0 ? defBaseColor : "#f97316");
            if (col.toLowerCase() === atkBaseColor.toLowerCase()) col = "#ef4444";
            this.spawnForces(member.forces, "defender", member.country, col);
        });

        this.isRunning = true;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.loop();
    }

    generateBattlefieldTerrain() {
        this.hexTiles = [];
        this.terrainFeatures = [];

        const seaHeight = this.height * 0.25;
        const hexR = 46;
        const stepX = hexR * Math.sqrt(3) * 0.96;
        const stepY = hexR * 1.44;

        const startX = -110;
        const endX = this.width + 110;
        const startY = -120;
        const endY = this.height + 90;

        let row = 0;
        for (let y = startY; y <= endY; y += stepY) {
            let col = 0;
            const offsetX = (row % 2 !== 0) ? stepX * 0.5 : 0;
            for (let x = startX; x <= endX; x += stepX) {
                const hx = x + offsetX;
                const hy = y;

                const noise = (Math.sin(col * 0.65 + row * 0.45) + Math.cos(col * 0.35 - row * 0.8)) * 0.25 + 0.5;
                let type = "grass";
                let elev = 6;
                let topColor = "#4d7c0f";
                let isCoastWater = false;

                if (hy < seaHeight - 10) {
                    type = "water";
                    elev = 0;
                    topColor = hy < 0 ? "#0369a1" : (hy < seaHeight * 0.5 ? "#0284c7" : "#0ea5e9");
                    if (hy >= seaHeight - stepY - 12) isCoastWater = true;
                } else if (hy < seaHeight + 28) {
                    type = "sand";
                    elev = 4.5 + noise * 1.5;
                    topColor = BattleCanvasEngine.mixColors("#eab308", "#d97706", noise);
                } else {
                    type = "grass";
                    const distFromCenter = Math.abs(hx - this.width * 0.5) / (this.width * 0.5);
                    elev = 7.0 + noise * 5.0 + (distFromCenter > 0.75 ? 4.0 : 0);
                    const grassCol = BattleCanvasEngine.mixColors("#3f6212", "#15803d", noise);
                    topColor = distFromCenter < 0.22 ?
                        BattleCanvasEngine.mixColors("#57534e", grassCol, distFromCenter / 0.22) :
                        grassCol;
                }

                this.hexTiles.push({
                    col: col,
                    row: row,
                    x: hx,
                    y: hy,
                    rx: hexR,
                    ry: hexR,
                    type: type,
                    elev: elev,
                    topColor: topColor,
                    isCoastWater: isCoastWater,
                    bump: (noise - 0.5) * 2.4
                });
                col++;
            }
            row++;
        }

        const landTop = seaHeight + 35;
        const landH = this.height - landTop - 30;
        const midX = this.width * 0.5;

        for (let i = 0; i < 6; i++) {
            const ty = landTop + (i + 0.5) * (landH / 6);
            this.terrainFeatures.push({
                type: "dragons_teeth",
                x: midX + (i % 2 === 0 ? -18 : 18),
                y: ty
            });
            if (i % 2 === 1) {
                this.terrainFeatures.push({
                    type: "sandbag_wall",
                    x: midX - 95,
                    y: ty
                });
                this.terrainFeatures.push({
                    type: "sandbag_wall",
                    x: midX + 95,
                    y: ty
                });
            }
        }

        const decor = [
            { type: "mountain_peak", x: 65, y: landTop + 15 },
            { type: "mountain_peak", x: this.width - 65, y: landTop + 15 },
            { type: "pine_cluster", x: this.width * 0.26, y: landTop + landH * 0.14 },
            { type: "pine_cluster", x: this.width * 0.74, y: landTop + landH * 0.16 },
            { type: "pine_cluster", x: this.width * 0.24, y: landTop + landH * 0.86 },
            { type: "pine_cluster", x: this.width * 0.76, y: landTop + landH * 0.88 },
            { type: "rock_outcrop", x: this.width * 0.36, y: landTop + landH * 0.22 },
            { type: "rock_outcrop", x: this.width * 0.64, y: landTop + landH * 0.78 }
        ];
        for (let i = 0; i < decor.length; i++) {
            this.terrainFeatures.push(decor[i]);
        }
    }

    classifyUnitArchetype(u) {
        const id = u.id || "";
        const branch = u.branch || "ground";

        if (u.isCustom && Array.isArray(u.componentsData) && u.componentsData.length > 0) {
            return {
                model: "custom_cad",
                weaponStyle: branch === "air" ? "air_missile" : (branch === "naval" ? "naval_shell" : (branch === "defense" ? "ballistic" : "tank_shell")),
                altitude: branch === "air" ? 76 : 0,
                speed: branch === "air" ? 2.6 : (branch === "naval" ? 1.35 : 1.5),
                reload: 32,
                echelon: "armor"
            };
        }

        if (id === "infantry_def") return { model: "infantry_def", weaponStyle: "rifle_burst", altitude: 0, speed: 1.35, reload: 20, echelon: "vanguard" };
        if (id === "infantry_atk") return { model: "infantry_atk", weaponStyle: "assault_rpg", altitude: 0, speed: 1.75, reload: 18, echelon: "vanguard" };
        if (id === "troop_carrier") return { model: "troop_truck", weaponStyle: "mg_tracer", altitude: 0, speed: 1.85, reload: 24, echelon: "vanguard" };
        if (id === "cannon") return { model: "field_cannon", weaponStyle: "howitzer_arc", altitude: 0, speed: 0.75, reload: 46, echelon: "rear" };
        if (id === "armored_carrier") return { model: "apc_wheeled", weaponStyle: "autocannon", altitude: 0, speed: 1.8, reload: 22, echelon: "armor" };
        if (id === "auto_cannon") return { model: "spaag_wheeled", weaponStyle: "aa_flak", altitude: 0, speed: 1.5, reload: 15, echelon: "armor" };
        if (id === "small_tank") return { model: "light_tank", weaponStyle: "tank_shell", altitude: 0, speed: 1.75, reload: 28, echelon: "vanguard" };
        if (id === "med_tank") return { model: "main_battle_tank", weaponStyle: "heavy_tank_shell", altitude: 0, speed: 1.45, reload: 34, echelon: "armor" };
        if (id === "small_mlrs") return { model: "light_mlrs", weaponStyle: "rocket_salvo", altitude: 0, speed: 1.2, reload: 50, echelon: "rear" };
        if (id === "aa_tank") return { model: "aa_tank", weaponStyle: "sam_interceptor", altitude: 0, speed: 1.3, reload: 22, echelon: "armor" };
        if (id === "as_tank") return { model: "coastal_missile_tank", weaponStyle: "cruise_missile", altitude: 0, speed: 1.15, reload: 42, echelon: "rear" };
        if (id === "rocket_launcher") return { model: "heavy_mlrs", weaponStyle: "heavy_rocket_salvo", altitude: 0, speed: 1.0, reload: 54, echelon: "rear" };
        if (id === "anti_rocket_launcher") return { model: "cram_battery", weaponStyle: "sam_interceptor", altitude: 0, speed: 0.9, reload: 18, echelon: "rear" };
        if (id === "military_base" || id === "arms_factory" || id === "ammo_factory") {
            return { model: "fortified_base", weaponStyle: "autocannon", altitude: 0, speed: 0.0, reload: 32, echelon: "rear" };
        }

        if (id === "naval_troop_carrier" || id === "naval_gear_carrier") {
            return { model: "landing_ship", weaponStyle: "mg_tracer", altitude: 0, speed: 1.3, reload: 30, echelon: "vanguard" };
        }
        if (id === "war_corvette") return { model: "corvette", weaponStyle: "naval_shell", altitude: 0, speed: 1.6, reload: 24, echelon: "vanguard" };
        if (id === "destroyer") return { model: "destroyer", weaponStyle: "naval_vls", altitude: 0, speed: 1.4, reload: 30, echelon: "armor" };
        if (id === "frigate") return { model: "frigate", weaponStyle: "naval_shell", altitude: 0, speed: 1.35, reload: 28, echelon: "armor" };
        if (id === "small_sub") return { model: "submarine", weaponStyle: "torpedo", altitude: 0, speed: 1.35, reload: 38, echelon: "vanguard" };
        if (id === "aa_sub") return { model: "aa_submarine", weaponStyle: "sam_interceptor", altitude: 0, speed: 1.2, reload: 30, echelon: "armor" };
        if (id === "missile_sub") return { model: "ssbn_submarine", weaponStyle: "ballistic", altitude: 0, speed: 1.0, reload: 48, echelon: "rear" };
        if (id === "battleship") return { model: "battleship", weaponStyle: "broadside_salvo", altitude: 0, speed: 1.05, reload: 40, echelon: "armor" };
        if (id === "carrier") return { model: "aircraft_carrier", weaponStyle: "carrier_strike", altitude: 0, speed: 0.9, reload: 44, echelon: "rear" };

        if (id === "uav_attack") return { model: "uav_drone", weaponStyle: "air_missile", altitude: 66, speed: 2.3, reload: 28, echelon: "vanguard" };
        if (id === "a10_ground" || id === "su25_ground") return { model: "attack_jet_a10", weaponStyle: "gatling_brrrt", altitude: 70, speed: 2.5, reload: 20, echelon: "vanguard" };
        if (id === "cargo_plane" || id === "c130_ground") return { model: "gunship_c130", weaponStyle: "howitzer_arc", altitude: 82, speed: 2.0, reload: 26, echelon: "armor" };
        if (id === "f35_attack") return { model: "stealth_f35", weaponStyle: "air_missile", altitude: 88, speed: 3.0, reload: 24, echelon: "vanguard" };
        if (id === "mirage_attack") return { model: "delta_mirage", weaponStyle: "air_missile", altitude: 80, speed: 2.8, reload: 25, echelon: "vanguard" };
        if (branch === "air") return { model: "fighter_jet", weaponStyle: "air_missile", altitude: 78, speed: 2.7, reload: 25, echelon: "vanguard" };

        if (id === "nuclear_missile" || id === "nuclear_bomb") {
            return { model: "nuke_launcher", weaponStyle: "nuclear_strike", altitude: 0, speed: 0.5, reload: 80, echelon: "rear" };
        }
        if (id === "moab_bomb") {
            return { model: "scud_tel", weaponStyle: "moab_strike", altitude: 0, speed: 0.6, reload: 68, echelon: "rear" };
        }
        if (id === "scud_missile" || id === "cruise_missile") {
            return { model: "scud_tel", weaponStyle: "ballistic", altitude: 0, speed: 0.7, reload: 52, echelon: "rear" };
        }
        return { model: "sam_patriot", weaponStyle: "sam_interceptor", altitude: 0, speed: 0.65, reload: 26, echelon: "rear" };
    }

    spawnForces(forces, side, country, teamColor) {
        const isAttacker = side === "attacker";
        const seaHeight = this.height * 0.25;
        const landHeight = this.height * 0.75;
        const countryId = country.id;
        const countryName = country.name;

        const uniformCloth = isAttacker ? "#065f46" : "#1e1b4b";
        const helmetColor = isAttacker ? "#10b981" : "#f43f5e";

        Object.keys(forces || {}).forEach((unitId) => {
            const count = forces[unitId];
            if (count <= 0) return;

            const u = window.MilitaryData ? window.MilitaryData.getUnitById(unitId) : null;
            if (!u) return;

            const arch = this.classifyUnitArchetype(u);
            const baseHp = Math.max(18, Math.floor((u.price / 8) + ((u.power || 1) * 2.6)));
            const baseDmg = Math.max(3, Math.floor((u.power || 1) * 1.55));

            let domain = "ground";
            if (u.branch === "naval") domain = "naval";
            else if (u.branch === "air") domain = "air";

            const targetDomains = (Array.isArray(u.targetDomains) && u.targetDomains.length > 0) ?
                u.targetDomains.slice() : ["ground", "naval", "air"];

            let combatRange = Number(u.combatRange || u.range) || 220;
            combatRange = BattleCanvasEngine.clamp(combatRange * 0.78, 145, 460);
            if (arch.weaponStyle === "rifle_burst" || arch.weaponStyle === "assault_rpg") {
                combatRange = BattleCanvasEngine.clamp(combatRange, 135, 195);
            }

            const numEntities = Math.min(count, 10);
            const unitsPerEntity = Math.ceil(count / numEntities);

            for (let i = 0; i < numEntities; i++) {
                let pctFromEdge = 0.24;
                if (arch.echelon === "rear") pctFromEdge = 0.11 + this._rng() * 0.07;
                else if (arch.echelon === "armor") pctFromEdge = 0.20 + this._rng() * 0.09;
                else pctFromEdge = 0.30 + this._rng() * 0.09;

                const offsetDist = this.width * pctFromEdge;
                const x = isAttacker ? offsetDist : (this.width - offsetDist);

                let y = 0;
                if (domain === "naval") {
                    y = 22 + ((i + 0.5) / numEntities) * (seaHeight - 44) + (this._rng() - 0.5) * 12;
                } else if (domain === "air") {
                    y = 50 + ((i + 0.5) / numEntities) * (this.height - 105) + (this._rng() - 0.5) * 20;
                } else {
                    y = seaHeight + 44 + ((i + 0.5) / numEntities) * (landHeight - 78) + (this._rng() - 0.5) * 16;
                }

                this.entities.push({
                    id: Math.random().toString(36).slice(2),
                    side: side,
                    countryId: countryId,
                    countryName: countryName,
                    flag: country.flag,
                    unitId: unitId,
                    unitRef: u,
                    name: u.name,
                    model: arch.model,
                    weaponStyle: arch.weaponStyle,
                    domain: domain,
                    targetDomains: targetDomains,
                    unitsRepresented: unitsPerEntity,
                    x: x,
                    y: y,
                    z: arch.altitude,
                    vx: 0,
                    vy: 0,
                    heading: isAttacker ? 0 : Math.PI,
                    turretAngle: isAttacker ? 0 : Math.PI,
                    speed: arch.speed,
                    color: teamColor,
                    uniformColor: uniformCloth,
                    helmetColor: helmetColor,
                    hp: baseHp * unitsPerEntity,
                    maxHp: baseHp * unitsPerEntity,
                    damage: baseDmg * unitsPerEntity,
                    range: combatRange,
                    cooldown: Math.floor(this._rng() * 12),
                    reloadTime: arch.reload,
                    recoil: 0,
                    isMoving: false,
                    animSeed: this._rng() * Math.PI * 2
                });
            }
        });
    }

    // =========================================================================
    // 5. حلقة التحديث والفيزياء (60 FPS)
    // =========================================================================
    loop() {
        if (!this.isRunning) return;

        this.animClock += 0.048 * this.timeScale;
        this.updateCamera();
        this.update();
        this.render();

        const atkCount = this.entities.filter((e) => e.side === "attacker" && e.hp > 0).length;
        const defCount = this.entities.filter((e) => e.side === "defender" && e.hp > 0).length;

        if (atkCount === 0 || defCount === 0) {
            this.isRunning = false;
            const winner = atkCount > 0 ? "attacker" : (defCount > 0 ? "defender" : "draw");
            setTimeout(() => {
                if (this.onBattleEndCallback) {
                    this.onBattleEndCallback({
                        winner: winner,
                        attackerLosses: this.attackerLosses,
                        defenderLosses: this.defenderLosses,
                        attackerLossesByCountry: this.attackerLossesByCountry,
                        defenderLossesByCountry: this.defenderLossesByCountry
                    });
                }
            }, 1200);
            return;
        }

        this.animationFrameId = requestAnimationFrame(() => this.loop());
    }

    updateCamera() {
        const s = 0.16;
        this.camera.panX = BattleCanvasEngine.lerp(this.camera.panX, this.camera.targetPanX, s);
        this.camera.panY = BattleCanvasEngine.lerp(this.camera.panY, this.camera.targetPanY, s);
        this.camera.zoom = BattleCanvasEngine.lerp(this.camera.zoom, this.camera.targetZoom, s);
        this.camera.yaw = BattleCanvasEngine.lerp(this.camera.yaw, this.camera.targetYaw, s);
        this.camera.pitch = BattleCanvasEngine.lerp(this.camera.pitch, this.camera.targetPitch, s);
        if (this.camera.shakeAmount > 0.1) {
            this.camera.shakeAmount *= 0.86;
        } else {
            this.camera.shakeAmount = 0;
        }
    }

    update() {
        const seaHeight = this.height * 0.25;
        const shoreYNaval = seaHeight - 18;
        const shoreYGround = seaHeight + 30;
        const dt = this.timeScale;

        this.entities.forEach((e) => {
            if (e.hp <= 0) return;

            if (e.recoil > 0.05) e.recoil *= 0.82;
            else e.recoil = 0;

            let nearestTarget = null;
            let minDistance = Infinity;

            for (let i = 0; i < this.entities.length; i++) {
                const t = this.entities[i];
                if (t.side !== e.side && t.hp > 0) {
                    if (e.targetDomains.indexOf(t.domain) === -1) continue;
                    const dist = Math.hypot(t.x - e.x, t.y - e.y);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestTarget = t;
                    }
                }
            }

            if (!nearestTarget) {
                for (let i = 0; i < this.entities.length; i++) {
                    const t = this.entities[i];
                    if (t.side !== e.side && t.hp > 0) {
                        const dist = Math.hypot(t.x - e.x, t.y - e.y);
                        if (dist < minDistance) {
                            minDistance = dist;
                            nearestTarget = t;
                        }
                    }
                }
            }

            if (nearestTarget) {
                let targetX = nearestTarget.x;
                let targetY = nearestTarget.y;

                if (e.domain === "ground" && nearestTarget.domain === "naval") {
                    targetY = shoreYGround;
                } else if (e.domain === "naval" && nearestTarget.domain === "ground") {
                    targetY = shoreYNaval;
                }

                const realDist = Math.hypot(nearestTarget.x - e.x, nearestTarget.y - e.y);
                const aimAngle = Math.atan2(nearestTarget.y - e.y, nearestTarget.x - e.x);
                e.turretAngle = aimAngle;

                if (e.domain === "air") {
                    e.isMoving = true;
                    const orbitOffset = Math.sin(this.animClock * 1.8 + e.animSeed) * 34;
                    const desiredX = realDist > e.range * 0.82 ? targetX : e.x + Math.cos(this.animClock * 1.6 + e.animSeed) * 48;
                    const desiredY = targetY + orbitOffset;
                    const dx = desiredX - e.x;
                    const dy = desiredY - e.y;
                    const dNorm = Math.hypot(dx, dy) || 1;
                    e.vx = (dx / dNorm) * e.speed * dt;
                    e.vy = (dy / dNorm) * e.speed * dt;
                    e.x += e.vx;
                    e.y += e.vy;
                    e.heading = Math.atan2(e.vy, e.vx);

                    if (realDist <= e.range * 1.2 && e.cooldown <= 0) {
                        this.fireWeapon(e, nearestTarget);
                        e.cooldown = e.reloadTime + Math.floor(this._rng() * 8);
                    }
                } else if (realDist <= e.range) {
                    e.isMoving = false;
                    e.heading = aimAngle;
                    if (e.cooldown <= 0) {
                        this.fireWeapon(e, nearestTarget);
                        e.cooldown = e.reloadTime + Math.floor(this._rng() * 8);
                    }
                } else if (e.speed > 0) {
                    e.isMoving = true;
                    const dx = targetX - e.x;
                    const dy = targetY - e.y;
                    const distToNav = Math.hypot(dx, dy) || 1;
                    e.vx = (dx / distToNav) * e.speed * dt;
                    e.vy = (dy / distToNav) * e.speed * dt;
                    e.x += e.vx;
                    e.y += e.vy;
                    e.heading = Math.atan2(e.vy, e.vx);

                    if (e.domain === "ground" && Math.random() < 0.24 * dt && e.model !== "infantry_def" && e.model !== "infantry_atk") {
                        this.particles.push({
                            x: e.x - Math.cos(e.heading) * 12,
                            y: e.y - Math.sin(e.heading) * 6,
                            z: 1,
                            vx: (Math.random() - 0.5) * 0.4,
                            vy: (Math.random() - 0.5) * 0.4,
                            vz: 0.25 + Math.random() * 0.2,
                            color: "rgba(168, 162, 158, 0.42)",
                            size: 3.2,
                            life: 0.55
                        });
                    } else if (e.domain === "naval" && Math.random() < 0.38 * dt) {
                        this.particles.push({
                            x: e.x - Math.cos(e.heading) * 18,
                            y: e.y - Math.sin(e.heading) * 6,
                            z: 0,
                            vx: -Math.cos(e.heading) * 0.3,
                            vy: (Math.random() - 0.5) * 0.3,
                            vz: 0.05,
                            color: "rgba(224, 242, 254, 0.6)",
                            size: 3.4,
                            life: 0.65
                        });
                    }
                }
            }

            if (e.cooldown > 0) e.cooldown -= dt;

            e.x = BattleCanvasEngine.clamp(e.x, 38, this.width - 38);
            if (e.domain === "naval") {
                e.y = BattleCanvasEngine.clamp(e.y, 18, shoreYNaval);
            } else if (e.domain === "ground") {
                e.y = BattleCanvasEngine.clamp(e.y, shoreYGround, this.height - 28);
            } else if (e.domain === "air") {
                e.y = BattleCanvasEngine.clamp(e.y, 24, this.height - 34);
            }
        });

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.progress = Math.min(1, p.progress + p.step * dt);

            const curX = BattleCanvasEngine.lerp(p.startX, p.target.x, p.progress);
            const curY = BattleCanvasEngine.lerp(p.startY, p.target.y, p.progress);
            const baseZ = BattleCanvasEngine.lerp(p.startZ, p.target.z || 5, p.progress);
            const arcBoost = Math.sin(p.progress * Math.PI) * (p.arcHeight || 0);
            const wobble = p.wobble ? Math.sin(p.progress * 26 + p.seed) * p.wobble : 0;

            p.x = curX;
            p.y = curY + wobble;
            p.z = Math.max(0, baseZ + arcBoost);

            if (p.smokeTrail && Math.random() < 0.72) {
                this.particles.push({
                    x: p.x,
                    y: p.y,
                    z: p.z,
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: (Math.random() - 0.5) * 0.35,
                    vz: p.style === "torpedo" ? 0.05 : 0.25,
                    color: p.style === "torpedo" ? "rgba(186, 230, 253, 0.75)" : "rgba(226, 232, 240, 0.55)",
                    size: p.style === "nuclear_strike" ? 4.8 : 2.6,
                    life: 0.68
                });
            }

            if (p.progress >= 1 || p.target.hp <= 0) {
                if (p.target.hp > 0) {
                    p.target.hp -= p.damage;
                    this.triggerImpactEffect(p, p.target);

                    if (p.target.hp <= 0) {
                        const map = p.target.side === "attacker" ? this.attackerLosses : this.defenderLosses;
                        map[p.target.unitId] = (map[p.target.unitId] || 0) + p.target.unitsRepresented;

                        const countryMap = p.target.side === "attacker" ?
                            this.attackerLossesByCountry[p.target.countryId] :
                            this.defenderLossesByCountry[p.target.countryId];

                        if (countryMap) {
                            countryMap[p.target.unitId] = (countryMap[p.target.unitId] || 0) + p.target.unitsRepresented;
                        }

                        this.spawnExplosion3D(p.target.x, p.target.y, p.target.z || 5, "#f59e0b", 28, p.target.domain === "naval", true);
                    }
                }
                this.projectiles.splice(i, 1);
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.z = Math.max(0, (pt.z || 0) + (pt.vz || 0) * dt);
            if (pt.gravity) pt.vz -= pt.gravity * dt;
            pt.life -= 0.036 * dt;
            if (pt.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const sw = this.shockwaves[i];
            sw.radius += sw.speed * dt;
            sw.alpha -= 0.032 * dt;
            if (sw.alpha <= 0) this.shockwaves.splice(i, 1);
        }
    }

    // =========================================================================
    // 6. منظومة إطلاق النيران
    // =========================================================================
    fireWeapon(shooter, target) {
        shooter.recoil = 6.5;
        const style = shooter.weaponStyle;
        const isAtk = shooter.side === "attacker";
        const teamTracer = isAtk ? "#34d399" : "#fb7185";
        const dist = Math.max(40, Math.hypot(target.x - shooter.x, target.y - shooter.y));

        const muzzleX = shooter.x + Math.cos(shooter.turretAngle) * 18;
        const muzzleY = shooter.y + Math.sin(shooter.turretAngle) * 10;
        const muzzleZ = (shooter.z || 6) + 7;

        if (style !== "torpedo") {
            this.particles.push({
                x: muzzleX,
                y: muzzleY,
                z: muzzleZ,
                vx: Math.cos(shooter.turretAngle) * 0.9,
                vy: Math.sin(shooter.turretAngle) * 0.9,
                vz: 0.1,
                color: "#fef08a",
                size: style.indexOf("tank") !== -1 || style.indexOf("howitzer") !== -1 ? 6.0 : 3.6,
                life: 0.24
            });
        }

        const createProj = (opts) => {
            this.projectiles.push({
                startX: opts.sx !== undefined ? opts.sx : muzzleX,
                startY: opts.sy !== undefined ? opts.sy : muzzleY,
                startZ: opts.sz !== undefined ? opts.sz : muzzleZ,
                x: opts.sx !== undefined ? opts.sx : muzzleX,
                y: opts.sy !== undefined ? opts.sy : muzzleY,
                z: opts.sz !== undefined ? opts.sz : muzzleZ,
                target: target,
                damage: opts.dmg !== undefined ? opts.dmg : shooter.damage,
                style: opts.style || style,
                color: opts.color || teamTracer,
                arcHeight: opts.arcHeight || 0,
                wobble: opts.wobble || 0,
                smokeTrail: !!opts.smokeTrail,
                progress: 0,
                step: (opts.speed || 10) / dist,
                seed: Math.random() * 10
            });
        };

        if (style === "rifle_burst" || style === "mg_tracer") {
            for (let b = 0; b < 3; b++) {
                createProj({ dmg: shooter.damage / 3, speed: 15 - b * 1.4, color: teamTracer, arcHeight: 2 });
            }
        } else if (style === "assault_rpg") {
            createProj({ dmg: shooter.damage * 0.4, speed: 15, color: teamTracer, arcHeight: 2 });
            createProj({ dmg: shooter.damage * 0.6, speed: 11, color: "#f97316", arcHeight: 12, smokeTrail: true, wobble: 1.6 });
        } else if (style === "autocannon" || style === "aa_flak" || style === "gatling_brrrt") {
            for (let b = 0; b < 4; b++) {
                createProj({ dmg: shooter.damage / 4, speed: 17 - b * 1.2, color: "#fde047", arcHeight: 1 });
            }
        } else if (style === "tank_shell" || style === "heavy_tank_shell" || style === "naval_shell") {
            createProj({ dmg: shooter.damage, speed: 14.5, color: "#fbbf24", arcHeight: 9, smokeTrail: style === "heavy_tank_shell" });
        } else if (style === "broadside_salvo") {
            for (let s = -1; s <= 1; s++) {
                createProj({ sx: shooter.x + s * 12, sy: shooter.y, dmg: shooter.damage / 3, speed: 12.0, color: "#f97316", arcHeight: 28 + Math.abs(s) * 5, smokeTrail: true });
            }
        } else if (style === "howitzer_arc") {
            createProj({ dmg: shooter.damage, speed: 9.0, color: "#fb923c", arcHeight: 72, smokeTrail: true });
        } else if (style === "rocket_salvo" || style === "heavy_rocket_salvo") {
            const rockets = style === "heavy_rocket_salvo" ? 4 : 3;
            for (let r = 0; r < rockets; r++) {
                createProj({ sx: shooter.x + (r - 1) * 5, sy: shooter.y + (r - 1) * 4, dmg: shooter.damage / rockets, speed: 10.0 - r * 0.6, color: "#f97316", arcHeight: 52 + r * 9, wobble: 2.4, smokeTrail: true });
            }
        } else if (style === "torpedo") {
            createProj({ sz: 0, dmg: shooter.damage, speed: 8.5, color: "#38bdf8", arcHeight: 0, wobble: 1.0, smokeTrail: true });
        } else if (style === "sam_interceptor" || style === "air_missile" || style === "naval_vls" || style === "cruise_missile" || style === "carrier_strike") {
            createProj({ dmg: shooter.damage, speed: 13.5, color: "#38bdf8", arcHeight: style === "naval_vls" ? 58 : 24, wobble: 1.5, smokeTrail: true });
        } else if (style === "ballistic" || style === "moab_strike" || style === "nuclear_strike") {
            createProj({ dmg: shooter.damage, speed: 8.0, color: style === "nuclear_strike" ? "#fde047" : "#ef4444", arcHeight: style === "nuclear_strike" ? 150 : 110, smokeTrail: true });
        } else {
            createProj({ dmg: shooter.damage, speed: 12, color: teamTracer, arcHeight: 6 });
        }
    }

    triggerImpactEffect(p, target) {
        const isNaval = target.domain === "naval";
        if (p.style === "nuclear_strike" || p.style === "moab_strike") {
            this.camera.shakeAmount = p.style === "nuclear_strike" ? 14 : 8;
            this.shockwaves.push({ x: target.x, y: target.y, z: 6, radius: 6, speed: 4.5, alpha: 0.95, color: "#fde047" });
            this.shockwaves.push({ x: target.x, y: target.y, z: 6, radius: 2, speed: 2.8, alpha: 0.85, color: "#ef4444" });
            this.spawnExplosion3D(target.x, target.y, target.z || 6, "#fde047", 36, isNaval, true);
            if (!isNaval && this.craters.length < 28) {
                this.craters.push({ x: target.x, y: target.y, r: 17 });
            }
        } else if (p.style === "torpedo") {
            this.shockwaves.push({ x: target.x, y: target.y, z: 0, radius: 4, speed: 2.4, alpha: 0.85, color: "#e0f2fe" });
            for (let i = 0; i < 16; i++) {
                this.particles.push({
                    x: target.x + (Math.random() - 0.5) * 8,
                    y: target.y + (Math.random() - 0.5) * 4,
                    z: 2,
                    vx: (Math.random() - 0.5) * 1.2,
                    vy: (Math.random() - 0.5) * 0.8,
                    vz: 2.4 + Math.random() * 2.6,
                    gravity: 0.12,
                    color: i % 2 === 0 ? "#e0f2fe" : "#38bdf8",
                    size: 3.4,
                    life: 0.9
                });
            }
        } else if (p.arcHeight >= 35 || p.style.indexOf("tank") !== -1) {
            this.shockwaves.push({ x: target.x, y: target.y, z: target.z || 6, radius: 3, speed: 2.0, alpha: 0.72, color: "#fb923c" });
            this.spawnExplosion3D(target.x, target.y, target.z || 6, p.color, 12, isNaval, false);
            if (!isNaval && p.arcHeight >= 45 && this.craters.length < 28 && Math.random() < 0.45) {
                this.craters.push({ x: target.x, y: target.y, r: 10 });
            }
        } else {
            this.spawnExplosion3D(target.x, target.y, target.z || 6, p.color, 5, isNaval, false);
        }
    }

    spawnExplosion3D(x, y, z, color, count, isNaval, isBig) {
        if (isBig) {
            this.camera.shakeAmount = Math.max(this.camera.shakeAmount, 5.5);
        }
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * (isBig ? 3.5 : 2.3) + 0.6;
            this.particles.push({
                x: x,
                y: y,
                z: z,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                vz: Math.random() * (isBig ? 3.4 : 1.9) + 0.4,
                gravity: 0.08,
                color: isNaval ?
                    (Math.random() < 0.55 ? "#38bdf8" : "#f8fafc") :
                    (Math.random() < 0.45 ? color : (Math.random() < 0.5 ? "#fde047" : "#ef4444")),
                size: Math.random() * (isBig ? 4.4 : 2.8) + 1.5,
                life: isBig ? 1.15 : 0.75
            });
        }
    }

    // =========================================================================
    // 7. رندر المشهد الكامل ثلاثي الأبعاد
    // =========================================================================
    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.width, this.height);

        const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        skyGrad.addColorStop(0, "#0b192c");
        skyGrad.addColorStop(0.45, "#112240");
        skyGrad.addColorStop(1, "#09101d");
        this.ctx.fillStyle = skyGrad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        for (let i = 0; i < this.hexTiles.length; i++) {
            const t = this.hexTiles[i];
            const p = this.projectBattle3D(t.x, t.y, t.elev);
            t._depth = p.depth;
        }
        this.hexTiles.sort((a, b) => a._depth - b._depth);

        for (let i = 0; i < this.hexTiles.length; i++) {
            this.drawBattleHexTile3D(this.hexTiles[i]);
        }

        this.craters.forEach((cr) => {
            const pt = this.projectBattle3D(cr.x, cr.y, 7);
            this.ctx.save();
            this.ctx.fillStyle = "rgba(15, 23, 42, 0.58)";
            this.ctx.strokeStyle = "rgba(68, 51, 37, 0.75)";
            this.ctx.lineWidth = 1.6 * pt.scale;
            this.ctx.beginPath();
            this.ctx.ellipse(pt.x, pt.y, cr.r * pt.scale, cr.r * 0.55 * pt.scale, 0, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.restore();
        });

        const seaHeight = this.height * 0.25;
        this.renderForwardCommandBases(seaHeight);
        this.renderShockwaves();

        const renderQueue = [];

        this.terrainFeatures.forEach((tf) => {
            const p = this.projectBattle3D(tf.x, tf.y, 7);
            renderQueue.push({ kind: "terrain", data: tf, depth: p.depth });
        });

        this.entities.forEach((e) => {
            if (e.hp <= 0) return;
            const p = this.projectBattle3D(e.x, e.y, e.z || 7);
            renderQueue.push({ kind: "unit", data: e, depth: p.depth });
        });

        renderQueue.sort((a, b) => a.depth - b.depth);

        for (let i = 0; i < renderQueue.length; i++) {
            const item = renderQueue[i];
            if (item.kind === "terrain") {
                this.renderTerrainFeature3D(item.data);
            } else {
                this.renderUnit3D(item.data);
            }
        }

        this.renderProjectiles3D();
        this.renderParticles3D();
        this.renderTacticalHUD();
    }

    renderForwardCommandBases(seaHeight) {
        const midLandY = seaHeight + (this.height - seaHeight) * 0.52;

        if (this.attacker) {
            this.drawCommandOutpost3D(78, midLandY, this.attackerColor, this.attacker.flag, 1);
        }
        if (this.defender) {
            this.drawCommandOutpost3D(this.width - 78, midLandY, this.defenderColor, this.defender.flag, -1);
        }
    }

    drawCommandOutpost3D(bx, by, sovColor, flagMatrix, dir) {
        this.drawBox3D(bx, by, 7, 32, 42, 14, 0, "#334155", sovColor);
        this.drawBox3D(bx - dir * 5, by, 21, 18, 22, 12, 0, "#475569", BattleCanvasEngine.adjustColor(sovColor, 0.18));

        const poleBase = this.projectBattle3D(bx, by, 33);
        const poleTop = this.projectBattle3D(bx, by, 64);

        this.ctx.save();
        this.ctx.strokeStyle = "#fde047";
        this.ctx.lineWidth = 2.6 * poleBase.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(poleBase.x, poleBase.y);
        this.ctx.lineTo(poleTop.x, poleTop.y);
        this.ctx.stroke();

        const fw = 30 * poleTop.scale;
        const fh = 19 * poleTop.scale;
        const rows = 3,
            cols = 4;
        const cw = fw / cols,
            ch = fh / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const wave = Math.sin(this.animClock * 4.2 + c * 0.8 + r * 0.3) * 2.2 * poleTop.scale;
                let col = sovColor;
                if (Array.isArray(flagMatrix) && flagMatrix.length === 12) {
                    col = flagMatrix[r * cols + c] || sovColor;
                } else if (Array.isArray(flagMatrix) && Array.isArray(flagMatrix[r]) && flagMatrix[r][c]) {
                    col = flagMatrix[r][c];
                }
                this.ctx.fillStyle = col;
                this.ctx.fillRect(poleTop.x + dir * (c * cw), poleTop.y + r * ch + wave, cw + 0.8, ch + 0.8);
            }
        }
        this.ctx.restore();
    }

    renderTerrainFeature3D(tf) {
        if (tf.type === "mountain_peak") {
            const s = 26;
            const apex = [tf.x, tf.y, 42];
            const b0 = [tf.x - s, tf.y - s, 7];
            const b1 = [tf.x + s, tf.y - s, 7];
            const b2 = [tf.x + s, tf.y + s, 7];
            const b3 = [tf.x - s, tf.y + s, 7];
            this.fillPoly3D([b0, b1, apex], "#64748b", "rgba(0,0,0,0.25)", 0.7);
            this.fillPoly3D([b1, b2, apex], "#475569", "rgba(0,0,0,0.25)", 0.7);
            this.fillPoly3D([b2, b3, apex], "#334155", "rgba(0,0,0,0.25)", 0.7);
            this.fillPoly3D([b3, b0, apex], "#94a3b8", "rgba(0,0,0,0.25)", 0.7);
        } else if (tf.type === "dragons_teeth") {
            const s = 11;
            const apex = [tf.x, tf.y, 20];
            const b0 = [tf.x - s, tf.y - s, 7];
            const b1 = [tf.x + s, tf.y - s, 7];
            const b2 = [tf.x + s, tf.y + s, 7];
            const b3 = [tf.x - s, tf.y + s, 7];
            this.fillPoly3D([b0, b1, apex], "#94a3b8", "rgba(0,0,0,0.3)", 0.7);
            this.fillPoly3D([b1, b2, apex], "#64748b", "rgba(0,0,0,0.3)", 0.7);
            this.fillPoly3D([b2, b3, apex], "#475569", "rgba(0,0,0,0.3)", 0.7);
            this.fillPoly3D([b3, b0, apex], "#cbd5e1", "rgba(0,0,0,0.3)", 0.7);
        } else if (tf.type === "sandbag_wall") {
            this.drawBox3D(tf.x, tf.y, 7, 10, 26, 8.0, 0, "#a16207", "#eab308");
        } else if (tf.type === "rock_outcrop") {
            this.drawBox3D(tf.x, tf.y, 7, 18, 15, 10, 0.4, "#475569", "#64748b");
            this.drawBox3D(tf.x + 7, tf.y + 4, 7, 12, 11, 7, 0.1, "#334155", "#475569");
        } else if (tf.type === "pine_cluster") {
            this.drawBox3D(tf.x, tf.y, 7, 3.5, 3.5, 6.5, 0, "#5c4033", "#3e2723");
            const p0 = [tf.x - 8, tf.y + 5, 12],
                p1 = [tf.x + 8, tf.y + 5, 12],
                p2 = [tf.x, tf.y - 7, 12],
                top = [tf.x, tf.y, 29];
            this.fillPoly3D([p0, p1, top], "#15803d", null);
            this.fillPoly3D([p1, p2, top], "#166534", null);
            this.fillPoly3D([p2, p0, top], "#22c55e", null);
        }
    }

    // =========================================================================
    // 8. رسم المجسمات العسكرية ثلاثية الأبعاد للوحدات الـ 48
    // =========================================================================
    renderUnit3D(e) {
        const isAttacker = e.side === "attacker";
        const dir = Math.cos(e.heading) >= 0 ? 1 : -1;
        const sovColor = e.color;

        let wz = e.z || 7;
        if (e.domain === "naval") {
            wz = Math.sin(this.animClock * 2.5 + e.x * 0.04 + e.animSeed) * 2.4;
        } else if (e.domain === "air") {
            wz = (e.z || 76) + Math.sin(this.animClock * 3.0 + e.animSeed) * 3.8;
        }

        const groundPt = this.projectBattle3D(e.x, e.y, e.domain === "naval" ? 0 : 7);
        const unitPt = this.projectBattle3D(e.x, e.y, wz);
        const sc = unitPt.scale;

        this.ctx.save();

        this.ctx.save();
        this.ctx.fillStyle = isAttacker ? "rgba(16, 185, 129, 0.28)" : "rgba(244, 63, 94, 0.28)";
        this.ctx.strokeStyle = isAttacker ? "#10b981" : "#f43f5e";
        this.ctx.lineWidth = 2.0 * sc;
        this.ctx.beginPath();
        this.ctx.ellipse(groundPt.x, groundPt.y, 17 * sc, 7.5 * sc, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        if (e.domain === "air") {
            this.ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
            this.ctx.beginPath();
            this.ctx.ellipse(groundPt.x, groundPt.y, 16 * sc, 6.2 * sc, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();

        const recX = e.x - Math.cos(e.turretAngle) * e.recoil;
        const recY = e.y - Math.sin(e.turretAngle) * e.recoil * 0.5;

        switch (e.model) {
            case "custom_cad":
                this.drawModelCustomCAD(e, unitPt, sc, dir);
                break;
            case "infantry_def":
                this.drawModelInfantrySquad(e, recX, recY, wz, dir, true);
                break;
            case "infantry_atk":
                this.drawModelInfantrySquad(e, recX, recY, wz, dir, false);
                break;
            case "troop_truck":
                this.drawModelTroopTruck(recX, recY, wz, e.heading, sovColor, e.uniformColor);
                break;
            case "field_cannon":
                this.drawModelFieldCannon(recX, recY, wz, e.turretAngle, sovColor, e.uniformColor);
                break;
            case "apc_wheeled":
            case "spaag_wheeled":
                this.drawModelWheeledAPC(recX, recY, wz, e.heading, e.turretAngle, sovColor, e.model === "spaag_wheeled");
                break;
            case "light_tank":
                this.drawModelTank3D(recX, recY, wz, e.heading, e.turretAngle, sovColor, 0.96, false);
                break;
            case "main_battle_tank":
                this.drawModelTank3D(recX, recY, wz, e.heading, e.turretAngle, sovColor, 1.25, true);
                break;
            case "aa_tank":
                this.drawModelAATank3D(recX, recY, wz, e.heading, e.turretAngle, sovColor);
                break;
            case "light_mlrs":
            case "heavy_mlrs":
            case "coastal_missile_tank":
                this.drawModelMLRS3D(recX, recY, wz, e.heading, e.turretAngle, sovColor, e.model === "heavy_mlrs" ? 1.28 : 1.05);
                break;
            case "cram_battery":
            case "sam_patriot":
                this.drawModelSAMBattery3D(recX, recY, wz, e.turretAngle, sovColor);
                break;
            case "scud_tel":
            case "nuke_launcher":
                this.drawModelBallisticLauncher3D(recX, recY, wz, e.heading, sovColor, e.model === "nuke_launcher");
                break;
            case "fortified_base":
                this.drawBox3D(recX, recY, wz, 25, 22, 14, 0, "#475569", sovColor);
                break;
            case "landing_ship":
            case "corvette":
            case "frigate":
            case "destroyer":
                this.drawModelWarship3D(recX, recY, wz, e.heading, e.turretAngle, sovColor, e.model === "destroyer" ? 1.28 : 1.05);
                break;
            case "battleship":
                this.drawModelBattleship3D(recX, recY, wz, e.heading, e.turretAngle, sovColor);
                break;
            case "aircraft_carrier":
                this.drawModelCarrier3D(recX, recY, wz, e.heading, sovColor);
                break;
            case "submarine":
            case "aa_submarine":
            case "ssbn_submarine":
                this.drawModelSubmarine3D(recX, recY, wz, e.heading, sovColor, e.model === "ssbn_submarine" ? 1.3 : 1.05);
                break;
            case "uav_drone":
                this.drawModelAircraft3D(unitPt, sc, e.heading, sovColor, "uav");
                break;
            case "attack_jet_a10":
                this.drawModelAircraft3D(unitPt, sc, e.heading, sovColor, "a10");
                break;
            case "gunship_c130":
                this.drawModelAircraft3D(unitPt, sc, e.heading, sovColor, "c130");
                break;
            case "stealth_f35":
            case "delta_mirage":
                this.drawModelAircraft3D(unitPt, sc, e.heading, sovColor, "stealth");
                break;
            default:
                this.drawModelAircraft3D(unitPt, sc, e.heading, sovColor, "fighter");
                break;
        }

        const hudOffset = e.domain === "air" ? -26 * sc : -30 * sc;
        const barW = 30 * sc;
        const barH = 4.2 * sc;
        const ratio = BattleCanvasEngine.clamp(e.hp / e.maxHp, 0, 1);
        const barX = unitPt.x - barW * 0.5;
        const barY = unitPt.y + hudOffset;

        this.ctx.fillStyle = "rgba(9, 13, 24, 0.88)";
        this.ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        this.ctx.fillStyle = ratio > 0.5 ? (isAttacker ? "#10b981" : "#f43f5e") : (ratio > 0.25 ? "#f59e0b" : "#dc2626");
        this.ctx.fillRect(barX, barY, barW * ratio, barH);

        this.ctx.fillStyle = sovColor;
        this.ctx.fillRect(barX - 6 * sc, barY - 1, 5 * sc, barH + 2);

        if (e.unitsRepresented > 1) {
            this.ctx.font = "bold " + Math.max(9, Math.round(10.5 * sc)) + "px Cairo, sans-serif";
            this.ctx.fillStyle = "#fde047";
            this.ctx.textAlign = "center";
            this.ctx.fillText("×" + e.unitsRepresented, unitPt.x, barY - 3 * sc);
        }

        this.ctx.restore();
    }

    drawModelInfantrySquad(e, bx, by, bz, dir, hasShield) {
        const offsets = [
            [0, 0],
            [-7.5 * dir, -7.5],
            [-7.5 * dir, 7.5]
        ];

        for (let i = 0; i < offsets.length; i++) {
            const sx = bx + offsets[i][0];
            const sy = by + offsets[i][1];
            const stride = e.isMoving ? Math.sin(this.animClock * 8.5 + e.animSeed + i * 2) * 3.5 : 0;
            const crouch = e.isMoving ? 0 : -1.8;

            this.drawBox3D(sx + stride * 0.45, sy - 1.8, bz, 3.0, 2.6, 5.5 + crouch * 0.3, 0, e.uniformColor, "#0f172a");
            this.drawBox3D(sx - stride * 0.45, sy + 1.8, bz, 3.0, 2.6, 5.5 + crouch * 0.3, 0, e.uniformColor, "#0f172a");

            const torsoZ = bz + 5.5 + crouch * 0.3;
            this.drawBox3D(sx, sy, torsoZ, 5.4, 6.0, 6.8, e.turretAngle, e.uniformColor, e.color);
            this.drawBox3D(sx, sy, torsoZ + 6.8, 4.2, 4.2, 3.6, e.turretAngle, "#fde68a", e.helmetColor);

            if (i === 0) {
                const pBase = this.projectBattle3D(sx - dir * 2, sy, torsoZ + 6);
                const pTop = this.projectBattle3D(sx - dir * 2, sy, torsoZ + 18);
                this.ctx.strokeStyle = "#fde047";
                this.ctx.lineWidth = 1.5 * pBase.scale;
                this.ctx.beginPath();
                this.ctx.moveTo(pBase.x, pBase.y);
                this.ctx.lineTo(pTop.x, pTop.y);
                this.ctx.stroke();

                this.ctx.fillStyle = e.helmetColor;
                this.ctx.beginPath();
                this.ctx.moveTo(pTop.x, pTop.y);
                this.ctx.lineTo(pTop.x - dir * 9 * pTop.scale, pTop.y + 3 * pTop.scale);
                this.ctx.lineTo(pTop.x, pTop.y + 6 * pTop.scale);
                this.ctx.closePath();
                this.ctx.fill();
            }

            if (hasShield) {
                this.drawBox3D(
                    sx + Math.cos(e.turretAngle) * 4.6,
                    sy + Math.sin(e.turretAngle) * 4.6,
                    bz + 2,
                    2.2, 6.8, 10.0,
                    e.turretAngle,
                    "#1e293b",
                    e.color
                );
            }

            const gunStart = this.projectBattle3D(sx, sy, torsoZ + 4.2);
            const gunEnd = this.projectBattle3D(
                sx + Math.cos(e.turretAngle) * 11.5,
                sy + Math.sin(e.turretAngle) * 11.5,
                torsoZ + 4.6
            );
            this.ctx.strokeStyle = "#0f172a";
            this.ctx.lineWidth = 2.6 * gunStart.scale;
            this.ctx.beginPath();
            this.ctx.moveTo(gunStart.x, gunStart.y);
            this.ctx.lineTo(gunEnd.x, gunEnd.y);
            this.ctx.stroke();
        }
    }

    drawModelTank3D(bx, by, bz, hullAngle, turretAngle, sovColor, scale, isHeavy) {
        const s = scale || 1.0;
        this.drawBox3D(bx, by, bz, 26 * s, 16 * s, 5.0 * s, hullAngle, "#1e293b", "#334155");
        this.drawBox3D(bx, by, bz + 5.0 * s, 23 * s, 14 * s, 4.6 * s, hullAngle, BattleCanvasEngine.adjustColor(sovColor, -0.18), sovColor);

        const tz = bz + 9.6 * s;
        this.drawBox3D(bx, by, tz, (isHeavy ? 14 : 11.5) * s, (isHeavy ? 11.5 : 9.8) * s, 5.0 * s, turretAngle, sovColor, BattleCanvasEngine.adjustColor(sovColor, 0.22));

        const bStart = this.projectBattle3D(bx + Math.cos(turretAngle) * 4 * s, by + Math.sin(turretAngle) * 4 * s, tz + 2.8 * s);
        const bEnd = this.projectBattle3D(bx + Math.cos(turretAngle) * 23 * s, by + Math.sin(turretAngle) * 23 * s, tz + 3.0 * s);
        this.ctx.strokeStyle = "#0f172a";
        this.ctx.lineWidth = (isHeavy ? 4.2 : 3.0) * bStart.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(bStart.x, bStart.y);
        this.ctx.lineTo(bEnd.x, bEnd.y);
        this.ctx.stroke();
    }

    drawModelWheeledAPC(bx, by, bz, hullAngle, turretAngle, sovColor, isAA) {
        this.drawBox3D(bx, by, bz, 24, 13.5, 4.5, hullAngle, "#0f172a", "#334155");
        this.drawBox3D(bx, by, bz + 4.5, 22, 12.5, 5.5, hullAngle, "#475569", sovColor);
        this.drawBox3D(bx, by, bz + 10.0, 8.5, 8.5, 4.2, turretAngle, sovColor, "#e2e8f0");

        const bStart = this.projectBattle3D(bx, by, bz + 12);
        const bEnd = this.projectBattle3D(
            bx + Math.cos(turretAngle) * 16,
            by + Math.sin(turretAngle) * 16,
            bz + (isAA ? 18 : 12.5)
        );
        this.ctx.strokeStyle = "#0f172a";
        this.ctx.lineWidth = 2.6 * bStart.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(bStart.x, bStart.y);
        this.ctx.lineTo(bEnd.x, bEnd.y);
        this.ctx.stroke();
    }

    drawModelTroopTruck(bx, by, bz, angle, sovColor, clothColor) {
        this.drawBox3D(bx, by, bz, 24, 12.5, 4.0, angle, "#1e293b", "#334155");
        this.drawBox3D(bx - Math.cos(angle) * 3.5, by - Math.sin(angle) * 3.5, bz + 4.0, 15, 12, 7.2, angle, clothColor, BattleCanvasEngine.adjustColor(clothColor, 0.16));
        this.drawBox3D(bx + Math.cos(angle) * 7.5, by + Math.sin(angle) * 7.5, bz + 4.0, 7.5, 11.5, 6.0, angle, sovColor, "#38bdf8");
    }

    drawModelFieldCannon(bx, by, bz, aimAngle, sovColor, clothColor) {
        this.drawBox3D(bx, by, bz, 13.5, 11, 4.0, aimAngle, "#334155", sovColor);
        this.drawBox3D(bx - Math.cos(aimAngle) * 8, by - Math.sin(aimAngle) * 8, bz, 4.2, 4.2, 8, aimAngle, clothColor, sovColor);

        const bStart = this.projectBattle3D(bx, by, bz + 4.5);
        const bEnd = this.projectBattle3D(
            bx + Math.cos(aimAngle) * 20,
            by + Math.sin(aimAngle) * 20,
            bz + 14
        );
        this.ctx.strokeStyle = "#0f172a";
        this.ctx.lineWidth = 4.0 * bStart.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(bStart.x, bStart.y);
        this.ctx.lineTo(bEnd.x, bEnd.y);
        this.ctx.stroke();
    }

    drawModelAATank3D(bx, by, bz, hullAngle, turretAngle, sovColor) {
        this.drawBox3D(bx, by, bz, 24, 15, 5.5, hullAngle, "#1e293b", "#475569");
        this.drawBox3D(bx, by, bz + 5.5, 12, 11, 6.0, turretAngle, sovColor, "#cbd5e1");
        const bStart = this.projectBattle3D(bx, by, bz + 10);
        const bEnd = this.projectBattle3D(
            bx + Math.cos(turretAngle) * 17,
            by + Math.sin(turretAngle) * 17,
            bz + 19
        );
        this.ctx.strokeStyle = "#0f172a";
        this.ctx.lineWidth = 3.5 * bStart.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(bStart.x, bStart.y);
        this.ctx.lineTo(bEnd.x, bEnd.y);
        this.ctx.stroke();
    }

    drawModelMLRS3D(bx, by, bz, hullAngle, aimAngle, sovColor, scale) {
        const s = scale || 1.0;
        this.drawBox3D(bx, by, bz, 25 * s, 13 * s, 4.8 * s, hullAngle, "#1e293b", "#334155");
        this.drawBox3D(bx + Math.cos(hullAngle) * 7.5 * s, by + Math.sin(hullAngle) * 7.5 * s, bz + 4.8 * s, 7.5 * s, 12 * s, 6.0 * s, hullAngle, sovColor, "#38bdf8");
        this.drawBox3D(bx - Math.cos(hullAngle) * 4.5 * s, by - Math.sin(hullAngle) * 4.5 * s, bz + 7.0 * s, 14 * s, 11 * s, 7.0 * s, aimAngle, "#334155", "#f59e0b");
    }

    drawModelSAMBattery3D(bx, by, bz, aimAngle, sovColor) {
        this.drawBox3D(bx, by, bz, 20, 17, 4.5, 0, "#334155", "#475569");
        this.drawBox3D(bx, by, bz + 4.5, 12.5, 10, 9.5, aimAngle, sovColor, "#e2e8f0");
    }

    drawModelBallisticLauncher3D(bx, by, bz, hullAngle, sovColor, isNuke) {
        this.drawBox3D(bx, by, bz, 30, 14, 5.5, hullAngle, "#1e293b", "#334155");
        this.drawBox3D(bx, by, bz + 5.5, 8, 8, isNuke ? 25 : 19, hullAngle, isNuke ? "#fbbf24" : "#f8fafc", "#ef4444");
    }

    drawModelWarship3D(bx, by, bz, angle, turretAngle, sovColor, scale) {
        const s = scale || 1.0;
        this.drawBox3D(bx, by, bz, 36 * s, 12 * s, 6.0 * s, angle, "#334155", "#64748b");
        this.drawBox3D(bx - Math.cos(angle) * 3 * s, by - Math.sin(angle) * 3 * s, bz + 6.0 * s, 13 * s, 8.5 * s, 7.0 * s, angle, sovColor, "#f8fafc");
        const bStart = this.projectBattle3D(bx + Math.cos(angle) * 11 * s, by + Math.sin(angle) * 11 * s, bz + 7.0 * s);
        const bEnd = this.projectBattle3D(bx + Math.cos(turretAngle) * 21 * s, by + Math.sin(turretAngle) * 21 * s, bz + 9.0 * s);
        this.ctx.strokeStyle = "#0f172a";
        this.ctx.lineWidth = 2.6 * bStart.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(bStart.x, bStart.y);
        this.ctx.lineTo(bEnd.x, bEnd.y);
        this.ctx.stroke();
    }

    drawModelBattleship3D(bx, by, bz, angle, turretAngle, sovColor) {
        this.drawBox3D(bx, by, bz, 48, 15, 7.5, angle, "#1e293b", "#475569");
        this.drawBox3D(bx, by, bz + 7.5, 18, 11, 9.5, angle, sovColor, "#fde047");
        this.drawBox3D(bx + Math.cos(angle) * 14, by + Math.sin(angle) * 14, bz + 7.5, 8, 8, 4.5, turretAngle, "#334155", sovColor);
        this.drawBox3D(bx - Math.cos(angle) * 14, by - Math.sin(angle) * 14, bz + 7.5, 8, 8, 4.5, turretAngle, "#334155", sovColor);
    }

    drawModelCarrier3D(bx, by, bz, angle, sovColor) {
        this.drawBox3D(bx, by, bz, 54, 19, 8.5, angle, "#1e293b", "#0f172a");
        this.drawBox3D(bx - Math.sin(angle) * 6.5, by + Math.cos(angle) * 6.5, bz + 8.5, 13, 5.5, 9.5, angle, sovColor, "#38bdf8");
    }

    drawModelSubmarine3D(bx, by, bz, angle, sovColor, scale) {
        const s = scale || 1.0;
        this.drawBox3D(bx, by, bz, 32 * s, 9.5 * s, 4.5 * s, angle, "#0f172a", "#1e293b");
        this.drawBox3D(bx + Math.cos(angle) * 2 * s, by + Math.sin(angle) * 2 * s, bz + 4.5 * s, 8 * s, 5.5 * s, 6.5 * s, angle, sovColor, "#334155");
    }

    drawModelAircraft3D(unitPt, sc, heading, sovColor, style) {
        this.ctx.save();
        this.ctx.translate(unitPt.x, unitPt.y);
        this.ctx.rotate(heading);
        this.ctx.scale(sc * 1.15, sc * 1.15);

        const lit = BattleCanvasEngine.adjustColor(sovColor, 0.22);
        const shade = BattleCanvasEngine.adjustColor(sovColor, -0.25);

        if (style !== "uav") {
            this.ctx.fillStyle = "#f97316";
            this.ctx.beginPath();
            this.ctx.moveTo(-14, -2.5);
            this.ctx.lineTo(-22 - Math.random() * 5, 0);
            this.ctx.lineTo(-14, 2.5);
            this.ctx.closePath();
            this.ctx.fill();
        }

        if (style === "c130") {
            this.ctx.fillStyle = shade;
            this.ctx.fillRect(-6, -20, 8, 40);
            this.ctx.fillStyle = "#475569";
            this.ctx.fillRect(-16, -4.5, 32, 9);
            this.ctx.fillStyle = sovColor;
            this.ctx.fillRect(-16, -3, 10, 6);
        } else if (style === "a10") {
            this.ctx.fillStyle = sovColor;
            this.ctx.fillRect(-3, -15, 7, 30);
            this.ctx.fillStyle = "#334155";
            this.ctx.fillRect(-14, -3, 28, 6);
            this.ctx.fillStyle = lit;
            this.ctx.fillRect(-10, -7, 6, 3);
            this.ctx.fillRect(-10, 4, 6, 3);
        } else if (style === "uav") {
            this.ctx.fillStyle = sovColor;
            this.ctx.fillRect(-2, -14, 4, 28);
            this.ctx.fillStyle = "#cbd5e1";
            this.ctx.fillRect(-10, -2, 20, 4);
        } else {
            this.ctx.fillStyle = sovColor;
            this.ctx.beginPath();
            this.ctx.moveTo(16, 0);
            this.ctx.lineTo(-11, -13);
            this.ctx.lineTo(-7, 0);
            this.ctx.lineTo(-11, 13);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.fillStyle = lit;
            this.ctx.beginPath();
            this.ctx.moveTo(18, 0);
            this.ctx.lineTo(-12, -3.2);
            this.ctx.lineTo(-12, 3.2);
            this.ctx.closePath();
            this.ctx.fill();

            this.ctx.fillStyle = "#38bdf8";
            this.ctx.beginPath();
            this.ctx.ellipse(5, 0, 4.5, 2.0, 0, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    drawModelCustomCAD(e, unitPt, sc, dir) {
        if (window.WeaponForge && typeof window.WeaponForge.drawComponents === "function" && e.unitRef && Array.isArray(e.unitRef.componentsData)) {
            this.ctx.save();
            this.ctx.translate(unitPt.x, unitPt.y);
            window.WeaponForge.drawComponents(this.ctx, e.unitRef.componentsData, {
                dir: dir,
                targetW: 48 * sc,
                targetH: 36 * sc
            });
            this.ctx.restore();
        } else {
            this.drawModelTank3D(e.x, e.y, e.z || 7, e.heading, e.turretAngle, e.color, 1.15, true);
        }
    }

    // =========================================================================
    // 9. رندر المقذوفات والشرر ولوحة القيادة العلوية (HUD)
    // =========================================================================
    renderProjectiles3D() {
        this.projectiles.forEach((p) => {
            const pt = this.projectBattle3D(p.x, p.y, p.z);
            const groundPt = this.projectBattle3D(p.x, p.y, 7);

            this.ctx.save();
            if (p.z > 12) {
                this.ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
                this.ctx.beginPath();
                this.ctx.arc(groundPt.x, groundPt.y, 2.5 * groundPt.scale, 0, Math.PI * 2);
                this.ctx.fill();
            }

            const r = (p.style === "nuclear_strike" ? 5.6 : (p.smokeTrail ? 3.8 : 2.6)) * pt.scale;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = "#ffffff";
            this.ctx.beginPath();
            this.ctx.arc(pt.x, pt.y, r * 0.48, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    renderShockwaves() {
        this.shockwaves.forEach((sw) => {
            const pt = this.projectBattle3D(sw.x, sw.y, sw.z || 7);
            this.ctx.save();
            this.ctx.strokeStyle = sw.color;
            this.ctx.globalAlpha = BattleCanvasEngine.clamp(sw.alpha, 0, 1);
            this.ctx.lineWidth = 3.2 * pt.scale;
            this.ctx.beginPath();
            this.ctx.ellipse(pt.x, pt.y, sw.radius * pt.scale, sw.radius * 0.52 * pt.scale, 0, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        });
    }

    renderParticles3D() {
        this.particles.forEach((pt) => {
            const proj = this.projectBattle3D(pt.x, pt.y, pt.z || 0);
            this.ctx.save();
            this.ctx.fillStyle = pt.color;
            this.ctx.globalAlpha = BattleCanvasEngine.clamp(pt.life, 0, 1);
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, Math.max(1.2, (pt.size || 2) * proj.scale), 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    renderTacticalHUD() {
        const atkUnits = this.entities.filter((e) => e.side === "attacker" && e.hp > 0);
        const defUnits = this.entities.filter((e) => e.side === "defender" && e.hp > 0);

        let atkAliveCount = 0;
        atkUnits.forEach((u) => { atkAliveCount += u.unitsRepresented; });

        let defAliveCount = 0;
        defUnits.forEach((u) => { defAliveCount += u.unitsRepresented; });

        const hudW = Math.min(260, Math.max(130, (this.width - 40) * 0.45));
        const hudH = 44;

        this.ctx.save();

        if (this.attacker) {
            this.ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
            this.ctx.strokeStyle = "#10b981";
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(12, 10, hudW, hudH);
            this.ctx.strokeRect(12, 10, hudW, hudH);

            this.ctx.fillStyle = "#34d399";
            this.ctx.font = "bold 11px Cairo, sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText("⚔️ الهجوم: " + this.attacker.name, 12 + hudW * 0.5, 26);

            this.ctx.fillStyle = "#fde68a";
            this.ctx.font = "bold 10px Cairo, sans-serif";
            this.ctx.fillText("المقاتلون: " + atkAliveCount, 12 + hudW * 0.5, 43);
        }

        if (this.defender) {
            const rx = this.width - hudW - 12;
            this.ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
            this.ctx.strokeStyle = "#f43f5e";
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(rx, 10, hudW, hudH);
            this.ctx.strokeRect(rx, 10, hudW, hudH);

            this.ctx.fillStyle = "#fb7185";
            this.ctx.font = "bold 11px Cairo, sans-serif";
            this.ctx.textAlign = "center";
            this.ctx.fillText("🛡️ الدفاع: " + this.defender.name, rx + hudW * 0.5, 26);

            this.ctx.fillStyle = "#fde68a";
            this.ctx.font = "bold 10px Cairo, sans-serif";
            this.ctx.fillText("الصامدون: " + defAliveCount, rx + hudW * 0.5, 43);
        }

        this.ctx.restore();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}

window.BattleCanvasEngine = BattleCanvasEngine;
