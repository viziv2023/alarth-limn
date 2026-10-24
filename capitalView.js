/**
 * ============================================================================
 * capitalView.js - محرك العاصمة ثلاثي الأبعاد والواجهة البصرية الأفقية (Landscape HUD v5.0)
 * لعبة "عصر الهيمنة" - مصمم خصيصاً بأسلوب ألعاب الجوال الأفقية المعتمد على الرموز والأشكال
 * ============================================================================
 */

window.CapitalView = (function() {
    let canvas = null;
    let ctx = null;
    let currentCountry = null;
    let animationFrameId = null;
    let isInitialized = false;

    // إعدادات العرض البصري
    let showBuildingBadges = true;
    let activeDrawerId = null;
    let currentBuildStageTab = 1;
    let currentBuildCategory = 'all';
    let filterBySectorId = null;

    // تتبع النقرات مقابل السحب (Tap vs Drag)
    let pointerDownPos = { x: 0, y: 0 };
    let pointerMovedDist = 0;

    const SECTOR_META = {
        commercial: { name: "التجاري", icon: "🏪" },
        agricultural: { name: "الزراعي", icon: "🌾" },
        healthcare: { name: "الصحي", icon: "🏥" },
        education: { name: "التعليمي", icon: "🎓" },
        entertainment: { name: "الترفيهي", icon: "🎡" },
        trains: { name: "القطارات", icon: "🚆" },
        airports: { name: "المطارات", icon: "✈️" },
        gas: { name: "الغاز", icon: "🔥" },
        electricity: { name: "الكهرباء", icon: "⚡" },
        water: { name: "المياه", icon: "💧" },
        industrial: { name: "الصناعي", icon: "🏭" },
        security: { name: "الأمني", icon: "🛡️" },
        civil: { name: "المدني", icon: "🏛️" },
        services: { name: "الخدمي", icon: "🤝" },
        navigation: { name: "الملاحي", icon: "⛵" },
        ports: { name: "الموانئ", icon: "⚓" }
    };

    // =========================================================================
    // 1. إعدادات الكاميرا ثلاثية الأبعاد (True 3D Camera with Smooth Damping)
    // =========================================================================
    const camera = {
        x: 0,
        y: 18,
        targetX: 0,
        targetY: 18,
        zoom: 1.26,
        targetZoom: 1.26,
        minZoom: 0.42,
        maxZoom: 3.0,
        yaw: -0.32,
        targetYaw: -0.32,
        pitch: 0.62,
        targetPitch: 0.62,
        minPitch: 0.40,
        maxPitch: 1.05,
        isDragging: false,
        dragMode: 'pan',
        lastMouseX: 0,
        lastMouseY: 0,
        touchDist: 0,
        touchAngle: 0
    };

    const HEX_RADIUS = 42;
    let baseGridRadius = 8;
    let extraExpansionRings = 0;

    const TIME_MODES = ['day', 'sunset', 'night', 'auto'];
    let timeModeIndex = 0;
    let animClock = 0;
    let dayCycleClock = 0;

    let hexMesh = [];
    let hexMap = new Map();
    let roadEdges = [];
    let railPath = [];
    let hoveredHex = null;
    let selectedHex = null;

    let roadVehicles = [];
    let seaVessels = [];
    let skyAircraft = [];
    let railTrains = [];
    let smokeParticles = [];
    let skyClouds = [];
    let birdFlocks = [];

    // =========================================================================
    // 2. دوال الرياضيات والألوان والإضاءة ثلاثية الأبعاد
    // =========================================================================
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function hash2D(q, r, seed = 1) {
        let h = Math.sin(q * 127.1 + r * 311.7 + seed * 74.7) * 43758.5453123;
        return h - Math.floor(h);
    }

    function biomeNoise(q, r) {
        const n1 = Math.sin(q * 0.45 + Math.cos(r * 0.42) * 1.5) * Math.cos(r * 0.38 - Math.sin(q * 0.35) * 1.5);
        const n2 = Math.sin((q * 0.7 + r * 0.9) * 0.65) * 0.45;
        const n3 = (hash2D(q, r, 7) - 0.5) * 0.65;
        return (n1 + n2 + n3 + 1.5) / 3.0;
    }

    function parseHexColor(hex) {
        if (!hex || typeof hex !== 'string') return { r: 136, g: 136, b: 136 };
        let clean = hex.replace('#', '').trim();
        if (clean.length === 3) {
            clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
        }
        const num = parseInt(clean, 16);
        if (isNaN(num)) return { r: 136, g: 136, b: 136 };
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    function rgbToHex(r, g, b) {
        const cr = clamp(Math.round(r), 0, 255);
        const cg = clamp(Math.round(g), 0, 255);
        const cb = clamp(Math.round(b), 0, 255);
        return `#${((1 << 24) + (cr << 16) + (cg << 8) + cb).toString(16).slice(1)}`;
    }

    function adjustColor(hex, percent) {
        const { r, g, b } = parseHexColor(hex);
        const delta = Math.round(255 * percent);
        return rgbToHex(r + delta, g + delta, b + delta);
    }

    function mixColors(hex1, hex2, t) {
        const c1 = parseHexColor(hex1);
        const c2 = parseHexColor(hex2);
        return rgbToHex(
            lerp(c1.r, c2.r, t),
            lerp(c1.g, c2.g, t),
            lerp(c1.b, c2.b, t)
        );
    }

    function getLightingState() {
        const mode = TIME_MODES[timeModeIndex];
        let phase = 0;
        if (mode === 'day') phase = 0;
        else if (mode === 'sunset') phase = 0.52;
        else if (mode === 'night') phase = 1.0;
        else {
            phase = (Math.sin(dayCycleClock * 0.25 - Math.PI / 2) + 1) * 0.5;
        }

        const isNight = phase > 0.72;
        const isSunset = phase > 0.35 && phase <= 0.72;

        let bgTop = '#0c223b';
        let bgBottom = '#071324';
        let ambientTint = '#ffffff';
        let tintStrength = 0;
        let lightIntensity = 1.0;

        if (phase <= 0.5) {
            const t = phase * 2;
            bgTop = mixColors('#0f2942', '#3b1d38', t);
            bgBottom = mixColors('#081526', '#1f1024', t);
            ambientTint = '#fb923c';
            tintStrength = t * 0.22;
            lightIntensity = lerp(1.0, 0.88, t);
        } else {
            const t = (phase - 0.5) * 2;
            bgTop = mixColors('#3b1d38', '#050811', t);
            bgBottom = mixColors('#1f1024', '#020409', t);
            ambientTint = '#1e3a8a';
            tintStrength = lerp(0.22, 0.36, t);
            lightIntensity = lerp(0.88, 0.58, t);
        }

        return {
            mode,
            phase,
            isNight,
            isSunset,
            bgTop,
            bgBottom,
            ambientTint,
            tintStrength,
            lightIntensity,
            windowGlow: phase > 0.45 ? clamp((phase - 0.4) * 1.8, 0.2, 1.0) : 0
        };
    }

    function shadeFacet(baseHex, brightnessDelta = 0) {
        const light = getLightingState();
        let shaded = adjustColor(baseHex, brightnessDelta * light.lightIntensity - (1 - light.lightIntensity) * 0.22);
        if (light.tintStrength > 0.01) {
            shaded = mixColors(shaded, light.ambientTint, light.tintStrength);
        }
        return shaded;
    }

    function getCountrySovereignColor(country) {
        if (country && country.militaryColor) return country.militaryColor;
        if (country && Array.isArray(country.flag) && country.flag.length > 0) {
            const flat = country.flag.flat ? country.flag.flat() : country.flag;
            const valid = flat.filter(c => c && c !== '#000000' && c !== '#111111' && c !== '#ffffff');
            if (valid.length > 0) return valid[0];
            return flat[0] || '#e11d48';
        }
        return '#e11d48';
    }

    function isCountryOwner(country) {
        if (!country) return false;
        if (window.NetworkEngine && typeof window.NetworkEngine.canControlCountry === 'function') {
            return window.NetworkEngine.canControlCountry(country.id);
        }
        return !window.isViewingAsSpectator;
    }

    // =========================================================================
    // 3. محرك التحويل والإسقاط ثلاثي الأبعاد (3D World <-> 2D Screen)
    // =========================================================================
    function axialToWorld(q, r) {
        const wx = HEX_RADIUS * Math.sqrt(3) * (q + r * 0.5);
        const wy = HEX_RADIUS * 1.5 * r;
        return { wx, wy };
    }

    function project3D(wx, wy, wz = 0) {
        const cosY = Math.cos(camera.yaw);
        const sinY = Math.sin(camera.yaw);
        const rx = wx * cosY - wy * sinY;
        const ry = wx * sinY + wy * cosY;

        const sinP = Math.sin(camera.pitch);
        const cosP = Math.cos(camera.pitch);

        const sx = (canvas ? canvas.width * 0.5 : 500) + camera.x + rx * camera.zoom;
        const sy = (canvas ? canvas.height * 0.5 : 400) + camera.y + (ry * sinP - wz * cosP) * camera.zoom;
        const depth = ry * cosP + wz * sinP * 0.25;

        return { x: sx, y: sy, depth, rx, ry };
    }

    function screenToWorldPlane(px, py, planeZ = 0) {
        if (!canvas) return { wx: 0, wy: 0 };
        const sinP = Math.sin(camera.pitch);
        const cosP = Math.cos(camera.pitch);

        const rx = (px - canvas.width * 0.5 - camera.x) / camera.zoom;
        const ry = ((py - canvas.height * 0.5 - camera.y) / camera.zoom + planeZ * cosP) / Math.max(0.15, sinP);

        const cosY = Math.cos(-camera.yaw);
        const sinY = Math.sin(-camera.yaw);
        const wx = rx * cosY - ry * sinY;
        const wy = rx * sinY + ry * cosY;
        return { wx, wy };
    }

    function worldToAxial(wx, wy) {
        const q = (Math.sqrt(3) / 3 * wx - 1 / 3 * wy) / HEX_RADIUS;
        const r = (2 / 3 * wy) / HEX_RADIUS;
        return hexRound(q, r);
    }

    function hexRound(q, r) {
        let s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
        else if (rDiff > sDiff) rr = -rq - rs;
        return { q: rq, r: rr };
    }

    function getHexDist(a, b) {
        return Math.max(
            Math.abs(a.q - b.q),
            Math.abs(a.r - b.r),
            Math.abs((-a.q - a.r) - (-b.q - b.r))
        );
    }

    function pointInPolygon2D(px, py, pts) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x,
                yi = pts[i].y;
            const xj = pts[j].x,
                yj = pts[j].y;
            const intersect = ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / ((yj - yi) || 0.00001) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // =========================================================================
    // 4. أدوات الرسم الهندسي ثلاثي الأبعاد منخفض المضلعات (Low-Poly 3D Primitives)
    // =========================================================================
    function fillPoly2D(pts, fillStyle, strokeStyle = null, lineWidth = 1) {
        if (!pts || pts.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }
    }

    function drawGroundShadow3D(wx, wy, wz, radiusX, radiusY = radiusX, alpha = 0.24) {
        const p = project3D(wx + radiusX * 0.18, wy + radiusY * 0.22, wz);
        const rx = radiusX * camera.zoom;
        const ry = radiusY * Math.sin(camera.pitch) * camera.zoom;
        if (rx < 1 || ry < 0.5) return;

        ctx.save();
        ctx.fillStyle = `rgba(5, 8, 18, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawBox3D(wx, wy, wz, w, d, h, localAngle, wallColor, roofColor, opts = {}) {
        const hw = w * 0.5;
        const hd = d * 0.5;
        const cosA = Math.cos(localAngle || 0);
        const sinA = Math.sin(localAngle || 0);

        const localCorners = [
            { x: -hw, y: -hd },
            { x: hw, y: -hd },
            { x: hw, y: hd },
            { x: -hw, y: hd }
        ];

        const bottom3D = [];
        const top3D = [];
        for (let i = 0; i < 4; i++) {
            const lx = localCorners[i].x;
            const ly = localCorners[i].y;
            const worldX = wx + lx * cosA - ly * sinA;
            const worldY = wy + lx * sinA + ly * cosA;
            bottom3D.push(project3D(worldX, worldY, wz));
            top3D.push(project3D(worldX, worldY, wz + h));
        }

        if (opts.shadow !== false) {
            drawGroundShadow3D(wx, wy, wz, Math.max(hw, hd) * 1.15, Math.max(hw, hd) * 1.15, 0.22);
        }

        const walls = [];
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            const b0 = bottom3D[i];
            const b1 = bottom3D[next];
            const t1 = top3D[next];
            const t0 = top3D[i];

            const avgRy = (b0.ry + b1.ry) * 0.5;
            const cross = (b1.x - b0.x) * (t0.y - b0.y) - (b1.y - b0.y) * (t0.x - b0.x);
            if (cross < 0 || avgRy > -2) {
                const wallNormalAngle = (localAngle || 0) + i * (Math.PI * 0.5) + camera.yaw;
                const sunDot = Math.cos(wallNormalAngle - 0.85);
                const shade = sunDot * 0.16;
                walls.push({
                    depth: (b0.depth + b1.depth + t0.depth + t1.depth) * 0.25,
                    pts: [b0, b1, t1, t0],
                    shade,
                    b0,
                    b1,
                    t1,
                    t0,
                    faceIndex: i,
                    widthScreen: Math.hypot(b1.x - b0.x, b1.y - b0.y)
                });
            }
        }

        walls.sort((a, b) => a.depth - b.depth);

        const light = getLightingState();
        walls.forEach(wFace => {
            const fColor = shadeFacet(wallColor, wFace.shade);
            fillPoly2D(wFace.pts, fColor, 'rgba(15, 23, 42, 0.24)', 0.7);

            if (opts.windows && wFace.widthScreen > 5 * camera.zoom) {
                const rows = opts.windowRows || Math.max(1, Math.min(6, Math.floor(h / 4.5)));
                const cols = opts.windowCols || Math.max(1, Math.min(4, Math.floor(w / 4.5)));
                const winColor = light.windowGlow > 0.1 ?
                    ((wFace.faceIndex + rows) % 2 === 0 ? '#fde047' : '#38bdf8') :
                    (opts.windowColor || '#38bdf8');
                const winAlpha = light.windowGlow > 0.1 ? (0.68 + light.windowGlow * 0.3) : 0.45;

                ctx.save();
                ctx.fillStyle = winColor;
                ctx.globalAlpha = winAlpha;
                for (let r = 0; r < rows; r++) {
                    const v0 = (r + 0.28) / (rows + 0.3);
                    const v1 = (r + 0.72) / (rows + 0.3);
                    for (let c = 0; c < cols; c++) {
                        const u0 = (c + 0.25) / (cols + 0.2);
                        const u1 = (c + 0.75) / (cols + 0.2);
                        const p00 = bilerp2D(wFace.b0, wFace.b1, wFace.t0, wFace.t1, u0, v0);
                        const p10 = bilerp2D(wFace.b0, wFace.b1, wFace.t0, wFace.t1, u1, v0);
                        const p11 = bilerp2D(wFace.b0, wFace.b1, wFace.t0, wFace.t1, u1, v1);
                        const p01 = bilerp2D(wFace.b0, wFace.b1, wFace.t0, wFace.t1, u0, v1);
                        fillPoly2D([p00, p10, p11, p01], winColor);
                    }
                }
                ctx.restore();
            }
        });

        const rCol = roofColor || adjustColor(wallColor, 0.15);
        if (opts.roofType === 'gabled') {
            const roofH = opts.roofHeight || h * 0.55;
            const ridge0 = project3D(wx - hw * cosA, wy - hw * sinA, wz + h + roofH);
            const ridge1 = project3D(wx + hw * cosA, wy + hw * sinA, wz + h + roofH);

            const roofFaces = [
                { pts: [top3D[0], top3D[1], ridge1, ridge0], shade: 0.16 },
                { pts: [top3D[2], top3D[3], ridge0, ridge1], shade: -0.14 },
                { pts: [top3D[1], top3D[2], ridge1], shade: -0.05, isWall: true },
                { pts: [top3D[3], top3D[0], ridge0], shade: 0.08, isWall: true }
            ];
            roofFaces.sort((a, b) => avgDepth(a.pts) - avgDepth(b.pts));
            roofFaces.forEach(rf => {
                const base = rf.isWall ? wallColor : rCol;
                fillPoly2D(rf.pts, shadeFacet(base, rf.shade), 'rgba(0,0,0,0.18)', 0.6);
            });
        } else if (opts.roofType === 'pyramid') {
            const roofH = opts.roofHeight || h * 0.6;
            const apex = project3D(wx, wy, wz + h + roofH);
            const faces = [];
            for (let i = 0; i < 4; i++) {
                const next = (i + 1) % 4;
                const shade = (i === 0 || i === 3) ? 0.15 : -0.15;
                faces.push({
                    pts: [top3D[i], top3D[next], apex],
                    depth: (top3D[i].depth + top3D[next].depth + apex.depth) / 3,
                    shade
                });
            }
            faces.sort((a, b) => a.depth - b.depth);
            faces.forEach(f => {
                fillPoly2D(f.pts, shadeFacet(rCol, f.shade), 'rgba(0,0,0,0.18)', 0.6);
            });
        } else {
            fillPoly2D(top3D, shadeFacet(rCol, 0.18), 'rgba(255,255,255,0.14)', 0.7);
        }
    }

    function bilerp2D(b0, b1, t0, t1, u, v) {
        const bx = lerp(b0.x, b1.x, u);
        const by = lerp(b0.y, b1.y, u);
        const tx = lerp(t0.x, t1.x, u);
        const ty = lerp(t0.y, t1.y, u);
        return { x: lerp(bx, tx, v), y: lerp(by, ty, v) };
    }

    function avgDepth(pts) {
        let s = 0;
        for (let i = 0; i < pts.length; i++) s += pts[i].depth;
        return s / pts.length;
    }

    function drawPrism3D(wx, wy, wz, radiusBottom, radiusTop, h, sides, wallColor, roofColor, coneHeight = 0) {
        const bottomPts = [];
        const topPts = [];
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const cosA = Math.cos(a);
            const sinA = Math.sin(a);
            bottomPts.push(project3D(wx + cosA * radiusBottom, wy + sinA * radiusBottom, wz));
            topPts.push(project3D(wx + cosA * radiusTop, wy + sinA * radiusTop, wz + h));
        }

        const faces = [];
        for (let i = 0; i < sides; i++) {
            const next = (i + 1) % 6 % sides;
            const nIdx = (i + 1) % sides;
            const b0 = bottomPts[i];
            const b1 = bottomPts[nIdx];
            const t1 = topPts[nIdx];
            const t0 = topPts[i];
            const midAngle = ((i + 0.5) / sides) * Math.PI * 2 + camera.yaw;
            const shade = Math.cos(midAngle - 0.8) * 0.18;
            faces.push({
                depth: (b0.depth + b1.depth + t0.depth + t1.depth) * 0.25,
                pts: [b0, b1, t1, t0],
                shade
            });
        }

        faces.sort((a, b) => a.depth - b.depth);
        faces.forEach(f => {
            fillPoly2D(f.pts, shadeFacet(wallColor, f.shade), 'rgba(0,0,0,0.12)', 0.5);
        });

        const rCol = roofColor || adjustColor(wallColor, 0.18);
        if (coneHeight > 0) {
            const apex = project3D(wx, wy, wz + h + coneHeight);
            const coneFaces = [];
            for (let i = 0; i < sides; i++) {
                const next = (i + 1) % sides;
                const midAngle = ((i + 0.5) / sides) * Math.PI * 2 + camera.yaw;
                const shade = Math.cos(midAngle - 0.8) * 0.2;
                coneFaces.push({
                    depth: (topPts[i].depth + topPts[next].depth + apex.depth) / 3,
                    pts: [topPts[i], topPts[next], apex],
                    shade
                });
            }
            coneFaces.sort((a, b) => a.depth - b.depth);
            coneFaces.forEach(cf => {
                fillPoly2D(cf.pts, shadeFacet(rCol, cf.shade), 'rgba(0,0,0,0.12)', 0.5);
            });
        } else if (radiusTop > 0.2) {
            fillPoly2D(topPts, shadeFacet(rCol, 0.2), 'rgba(255,255,255,0.14)', 0.6);
        }
    }

    // =========================================================================
    // 5. توليد التضاريس السداسية القابلة للتوسع (60% يابسة / 40% بحر)
    // =========================================================================
    function generateExpandableHexWorld(country) {
        let totalClustersEstimate = 0;
        if (country && country.buildings) {
            Object.entries(country.buildings).forEach(([k, count]) => {
                if (!['bird', 'animal', 'plane_50', 'plane_100', 'plane_200', 'plane_400', 'train_cart_20', 'train_cart_40', 'train_cart_100', 'train_cart_200'].includes(k)) {
                    const c = Number(count || 0);
                    if (c > 0) {
                        totalClustersEstimate += Math.ceil(c / 4);
                    }
                }
            });
        }

        baseGridRadius = Math.max(7, Math.min(14, Math.ceil(Math.sqrt(totalClustersEstimate * 2.1) + 4)));
        const radius = baseGridRadius + extraExpansionRings;

        hexMesh = [];
        hexMap.clear();

        const rawCells = [];
        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);
            for (let r = r1; r <= r2; r++) {
                const ring = getHexDist({ q: 0, r: 0 }, { q, r });
                const angle = Math.atan2(r + q * 0.5, q * 0.866);
                const directionalGradient = (q * 0.82 + r * 1.05) / Math.max(1, radius);
                const wave1 = Math.sin(q * 0.42 - r * 0.35) * 0.22;
                const wave2 = Math.cos(r * 0.48 + q * 0.25) * 0.16;
                const bayIndent = Math.exp(-Math.pow(angle + 2.1, 2) * 1.8) * 0.38;
                const peninsula = Math.exp(-Math.pow(angle - 0.5, 2) * 2.2) * 0.25;

                const centerBoost = ring <= 2 ? 0.65 : (ring <= 4 ? 0.25 : 0);
                const score = directionalGradient + wave1 + wave2 - bayIndent + peninsula + centerBoost;

                rawCells.push({ q, r, ring, score });
            }
        }

        const sortedByScore = [...rawCells].sort((a, b) => a.score - b.score);
        const waterTargetCount = Math.floor(rawCells.length * 0.40);
        const waterCell = sortedByScore[waterTargetCount];
        const waterThreshold = (waterCell && typeof waterCell.score === "number") ? waterCell.score : -0.15;
        const sandCell = sortedByScore[Math.min(rawCells.length - 1, waterTargetCount + Math.floor(rawCells.length * 0.085))];
        const sandThreshold = (sandCell && typeof sandCell.score === "number") ? sandCell.score : 0.05;

        rawCells.forEach(cell => {
            const { q, r, ring, score } = cell;
            const { wx, wy } = axialToWorld(q, r);
            const hNoise = hash2D(q, r, 11);
            const bNoise = biomeNoise(q, r);

            let type = 'grass';
            let elevation = 10;
            let subType = 'plain';

            if (ring <= 1) {
                type = 'grass';
                elevation = ring === 0 ? 18 : 14;
            } else if (score < waterThreshold) {
                type = 'water';
                const depthFactor = clamp((waterThreshold - score) * 2.4, 0.15, 1.5);
                elevation = 0;
                subType = depthFactor > 0.85 ? 'deep_water' : (depthFactor > 0.4 ? 'mid_water' : 'shallow_water');
            } else if (score < sandThreshold) {
                type = 'sand';
                elevation = 4.8 + hNoise * 1.8;
                subType = 'beach';
            } else {
                type = 'grass';
                const inlandFactor = clamp((score - sandThreshold) * 1.7, 0, 2.0);
                elevation = 9.0 + inlandFactor * 8.5 + (bNoise - 0.5) * 6.0;
                if (elevation > 18.5 && ring >= 4) {
                    subType = 'mountain';
                } else if (elevation > 14.5 && ring >= 3) {
                    subType = 'highland';
                }
            }

            let foliage = null;
            if (type === 'grass' && ring > 1) {
                if (subType === 'mountain' && hNoise < 0.55) foliage = 'mountain_peak';
                else if (bNoise > 0.58 && hNoise < 0.52) foliage = 'pine_forest';
                else if (bNoise > 0.42 && hNoise < 0.35) foliage = 'oak_grove';
                else if (hNoise < 0.16) foliage = 'boulders';
            } else if (type === 'sand' && hNoise < 0.25) {
                foliage = 'palm_trees';
            }

            const hexObj = {
                q,
                r,
                ring,
                wx,
                wy,
                type,
                subType,
                height: elevation,
                isCitadel: false,
                cluster: null,
                hasRoad: false,
                hasRail: false,
                isLighthouse: false,
                foliage,
                biomeVal: bNoise,
                hashVal: hNoise,
                centerBump: (hNoise - 0.5) * 2.5
            };

            hexMesh.push(hexObj);
            hexMap.set(`${q},${r}`, hexObj);
        });

        const citadelHex = hexMap.get('0,0') || hexMesh.find(h => h.type === 'grass');
        if (citadelHex) {
            citadelHex.type = 'grass';
            citadelHex.isCitadel = true;
            citadelHex.height = 17.5;
            citadelHex.hasRoad = true;
            citadelHex.foliage = null;
        }

        const coastalSand = hexMesh.filter(h => h.type === 'sand' && getWaterNeighbors(h).length >= 2);
        if (coastalSand.length > 0) {
            coastalSand.sort((a, b) => b.ring - a.ring);
            coastalSand[0].isLighthouse = true;
            coastalSand[0].foliage = null;
        }

        distributeUrbanDistricts(country, citadelHex);
        initLivingWorldAgents(country, citadelHex);
    }

    function getNeighbors(hex) {
        const dirs = [
            { dq: 1, dr: 0 }, { dq: 1, dr: -1 }, { dq: 0, dr: -1 },
            { dq: -1, dr: 0 }, { dq: -1, dr: 1 }, { dq: 0, dr: 1 }
        ];
        const res = [];
        for (const d of dirs) {
            const n = hexMap.get(`${hex.q + d.dq},${hex.r + d.dr}`);
            if (n) res.push(n);
        }
        return res;
    }

    function getWaterNeighbors(hex) {
        return getNeighbors(hex).filter(n => n.type === 'water');
    }

    function getDistrictZone(id) {
        if (['municipality', 'governorate', 'palace', 'police_headquarters'].includes(id)) return 'sovereign_ring';
        if (['skyscrapers', 'residential_towers', 'hotel', 'mall', 'showroom', 'apartments'].includes(id)) return 'cbd_ring';
        if (['medical_city', 'hospital', 'dispensary', 'clinic', 'university', 'educational_complex', 'school', 'classroom', 'police_station', 'fire_station'].includes(id)) return 'civic_ring';
        if (['house_large', 'house', 'shop_large', 'shop', 'markets', 'park', 'theme_park'].includes(id)) return 'residential_ring';
        if (['train_station', 'train_station_large', 'cargo_carrier'].includes(id)) return 'transit_ring';
        if (['farm', 'production_farm', 'poultry_farm', 'poultry_complex', 'livestock_farm', 'livestock_complex'].includes(id)) return 'agri_ring';
        return 'industrial_ring';
    }

    function distributeUrbanDistricts(country, citadelHex) {
        if (!country || !country.buildings || !citadelHex) return;

        const embeddedOrMobileIds = new Set([
            'bird', 'animal',
            'plane_50', 'plane_100', 'plane_200', 'plane_400',
            'train_cart_20', 'train_cart_40', 'train_cart_100', 'train_cart_200'
        ]);

        const categories = [];
        if (window.BuildingsEngine && Array.isArray(window.BuildingsEngine.RESOURCES_LIST)) {
            window.BuildingsEngine.RESOURCES_LIST.forEach(res => {
                if (embeddedOrMobileIds.has(res.id)) return;
                const owned = Number(country.buildings[res.id] || 0);
                if (owned > 0) {
                    categories.push({
                        id: res.id,
                        name: res.name,
                        icon: res.icon || '🏛️',
                        stage: res.stage || 1,
                        revenue: res.revenue || 0,
                        count: owned,
                        zone: getDistrictZone(res.id),
                        isMarine: ['boat', 'ship', 'cargo_ship_large'].includes(res.id),
                        isCoastalPier: ['marina', 'seaport', 'water_desalination', 'resort'].includes(res.id)
                    });
                }
            });
        }

        const zonePriority = {
            sovereign_ring: 1,
            cbd_ring: 2,
            civic_ring: 3,
            residential_ring: 4,
            transit_ring: 5,
            agri_ring: 6,
            industrial_ring: 7
        };
        categories.sort((a, b) => (zonePriority[a.zone] || 5) - (zonePriority[b.zone] || 5));

        const availableLand = hexMesh.filter(h => h.type === 'grass' && !h.isCitadel);
        availableLand.sort((a, b) => getHexDist(a, citadelHex) - getHexDist(b, citadelHex));

        const shoreLand = hexMesh.filter(h => (h.type === 'sand' || h.type === 'grass') && !h.isCitadel && !h.isLighthouse && getWaterNeighbors(h).length > 0);
        shoreLand.sort((a, b) => getHexDist(a, citadelHex) - getHexDist(b, citadelHex));

        const deepWater = hexMesh.filter(h => h.type === 'water');
        deepWater.sort((a, b) => getHexDist(a, citadelHex) - getHexDist(b, citadelHex));

        const usedHexes = new Set([`${citadelHex.q},${citadelHex.r}`]);

        function claimNextHex(list) {
            for (let i = 0; i < list.length; i++) {
                const h = list[i];
                const key = `${h.q},${h.r}`;
                if (!usedHexes.has(key) && !h.isLighthouse) {
                    usedHexes.add(key);
                    return h;
                }
            }
            return null;
        }

        categories.forEach(item => {
            let remaining = item.count;
            const maxPerHex = ['skyscrapers', 'intl_airport', 'regional_airport', 'nuclear_reactor', 'medical_city', 'industrial_authority', 'seaport', 'governorate', 'university', 'theme_park'].includes(item.id) ? 2 : 5;

            while (remaining > 0) {
                const clusterSize = Math.min(maxPerHex, remaining);
                let targetHex = null;

                if (item.isMarine) {
                    targetHex = claimNextHex(deepWater);
                } else if (item.isCoastalPier) {
                    targetHex = claimNextHex(shoreLand) || claimNextHex(availableLand);
                } else {
                    targetHex = claimNextHex(availableLand) || claimNextHex(shoreLand);
                }

                if (targetHex) {
                    targetHex.cluster = {
                        id: item.id,
                        name: item.name,
                        icon: item.icon,
                        stage: item.stage,
                        revenue: item.revenue,
                        count: clusterSize,
                        totalOwned: item.count,
                        isMarine: item.isMarine,
                        isCoastalPier: item.isCoastalPier
                    };
                    targetHex.foliage = null;

                    if (!item.isMarine) {
                        targetHex.hasRoad = true;
                    }
                }
                remaining -= clusterSize;
            }
        });

        roadEdges = buildArterialRoadNetwork(citadelHex);
        railPath = buildRailwayLoop(country, citadelHex);
    }

    function buildArterialRoadNetwork(citadelHex) {
        const roadHexes = hexMesh.filter(h => h.hasRoad);
        if (roadHexes.length <= 1) return [];

        const visited = new Set([`${citadelHex.q},${citadelHex.r}`]);
        const queue = [citadelHex];
        const edges = [];
        const edgeSet = new Set();

        function addEdge(a, b, isMain = true) {
            const k1 = `${a.q},${a.r}-${b.q},${b.r}`;
            const k2 = `${b.q},${b.r}-${a.q},${a.r}`;
            if (edgeSet.has(k1) || edgeSet.has(k2)) return;
            edgeSet.add(k1);
            edges.push({ from: a, to: b, isMain });
        }

        while (queue.length > 0) {
            const curr = queue.shift();
            const neighbors = getNeighbors(curr).filter(n => n.hasRoad && !visited.has(`${n.q},${n.r}`));
            neighbors.sort((a, b) => getHexDist(a, citadelHex) - getHexDist(b, citadelHex));

            for (const next of neighbors) {
                visited.add(`${next.q},${next.r}`);
                addEdge(curr, next, curr.ring <= 2);
                queue.push(next);
            }
        }

        roadHexes.forEach(h => {
            const key = `${h.q},${h.r}`;
            if (!visited.has(key)) {
                let bestTarget = citadelHex;
                let bestDist = Infinity;
                roadHexes.forEach(cand => {
                    if (visited.has(`${cand.q},${cand.r}`)) {
                        const d = getHexDist(h, cand);
                        if (d < bestDist) {
                            bestDist = d;
                            bestTarget = cand;
                        }
                    }
                });
                visited.add(key);
                addEdge(bestTarget, h, false);
            }
        });

        roadHexes.forEach(h => {
            if (h.ring >= 2 && h.ring <= 4) {
                const roadNeighbors = getNeighbors(h).filter(n => n.hasRoad && n.ring === h.ring);
                if (roadNeighbors.length > 0 && (Math.abs(h.q + h.r) % 2 === 0)) {
                    addEdge(h, roadNeighbors[0], false);
                }
            }
        });

        return edges;
    }

    function buildRailwayLoop(country, citadelHex) {
        const b = (country && country.buildings) ? country.buildings : {};
        const hasRail = (Number(b.train_station || 0) + Number(b.train_station_large || 0)) > 0;
        if (!hasRail) return [];

        const stationHexes = hexMesh.filter(h => h.cluster && (h.cluster.id === 'train_station' || h.cluster.id === 'train_station_large'));
        const ringCandidates = hexMesh.filter(h => h.type === 'grass' && h.ring >= 2 && h.ring <= 4);

        if (ringCandidates.length < 4) return [];

        const loopPts = [...stationHexes];
        ringCandidates.forEach(h => {
            if (loopPts.length < 10 && !loopPts.includes(h) && (Math.abs(h.q * 3 + h.r) % 3 === 0)) {
                loopPts.push(h);
            }
        });

        loopPts.sort((a, b) => {
            const angA = Math.atan2(a.wy - citadelHex.wy, a.wx - citadelHex.wx);
            const angB = Math.atan2(b.wy - citadelHex.wy, b.wx - citadelHex.wx);
            return angA - angB;
        });

        loopPts.forEach(h => { h.hasRail = true; });
        return loopPts;
    }

    function initLivingWorldAgents(country, citadelHex) {
        const b = (country && country.buildings) ? country.buildings : {};
        const sovColor = getCountrySovereignColor(country);

        roadVehicles = [];
        if (roadEdges.length > 0) {
            const vehicleCount = clamp(roadEdges.length * 2, 6, 48);
            const palette = [sovColor, '#f8fafc', '#38bdf8', '#fbbf24', '#ef4444', '#10b981', '#a855f7'];
            for (let i = 0; i < vehicleCount; i++) {
                const edge = roadEdges[i % roadEdges.length];
                roadVehicles.push({
                    edge,
                    t: Math.random(),
                    dir: i % 2 === 0 ? 1 : -1,
                    speed: 0.0045 + Math.random() * 0.004,
                    type: i % 5 === 0 ? 'truck' : (i % 7 === 0 ? 'bus' : 'car'),
                    color: palette[i % palette.length]
                });
            }
        }

        railTrains = [];
        if (railPath.length >= 3) {
            const isBullet = Number(b.train_station_large || 0) > 0 || Number(b.train_cart_100 || 0) > 0 || Number(b.train_cart_200 || 0) > 0;
            const totalCarts = Number(b.train_cart_20 || 0) + Number(b.train_cart_40 || 0) + Number(b.train_cart_100 || 0) + Number(b.train_cart_200 || 0);
            const carriages = clamp(totalCarts > 0 ? Math.ceil(totalCarts / 2) : 3, 2, 5);
            railTrains.push({
                progress: 0,
                speed: isBullet ? 0.012 : 0.007,
                isBullet,
                carriages,
                color: isBullet ? '#f8fafc' : sovColor
            });
        }

        skyAircraft = [];
        const totalPlanes = Number(b.plane_50 || 0) + Number(b.plane_100 || 0) + Number(b.plane_200 || 0) + Number(b.plane_400 || 0);
        const hasAirport = Number(b.regional_airport || 0) > 0 || Number(b.intl_airport || 0) > 0;
        const planeAgentsCount = hasAirport ? clamp(Math.max(2, Math.ceil(totalPlanes / 2)), 2, 7) : (totalPlanes > 0 ? 2 : 0);

        for (let i = 0; i < planeAgentsCount; i++) {
            const isJumbo = Number(b.plane_200 || 0) + Number(b.plane_400 || 0) > 0 && (i % 2 === 0);
            skyAircraft.push({
                angle: (i / planeAgentsCount) * Math.PI * 2,
                orbitRadiusX: (baseGridRadius + extraExpansionRings) * HEX_RADIUS * (0.55 + (i % 3) * 0.16),
                orbitRadiusY: (baseGridRadius + extraExpansionRings) * HEX_RADIUS * (0.45 + (i % 2) * 0.18),
                altitude: 82 + (i % 3) * 16,
                speed: 0.008 + (i % 2) * 0.003,
                isJumbo,
                color: sovColor,
                trail: []
            });
        }

        seaVessels = [];
        const waterHexes = hexMesh.filter(h => h.type === 'water' && !h.cluster);
        const totalBoats = Number(b.boat || 0) + Number(b.ship || 0) + Number(b.cargo_ship_large || 0);
        const activeSeaCount = waterHexes.length > 4 ? clamp(Math.max(3, totalBoats), 3, 12) : 0;

        for (let i = 0; i < activeSeaCount; i++) {
            const h1 = waterHexes[(i * 3) % waterHexes.length];
            const h2 = waterHexes[(i * 7 + 5) % waterHexes.length];
            if (h1 && h2 && h1 !== h2) {
                let vType = 'boat';
                if (Number(b.cargo_ship_large || 0) > 0 && i % 3 === 0) vType = 'cargo_ship_large';
                else if (Number(b.ship || 0) > 0 && i % 2 === 0) vType = 'ship';

                seaVessels.push({
                    from: h1,
                    to: h2,
                    t: Math.random(),
                    dir: 1,
                    speed: 0.0018 + Math.random() * 0.0015,
                    type: vType,
                    color: sovColor
                });
            }
        }

        skyClouds = [];
        const mapSpan = (baseGridRadius + extraExpansionRings) * HEX_RADIUS * 1.5;
        for (let i = 0; i < 6; i++) {
            skyClouds.push({
                wx: (Math.random() - 0.5) * mapSpan * 1.4,
                wy: (Math.random() - 0.5) * mapSpan * 1.4,
                wz: 98 + (i % 3) * 15,
                scale: 0.8 + Math.random() * 0.6,
                speedX: 0.14 + Math.random() * 0.1,
                speedY: 0.06 + Math.random() * 0.05,
                span: mapSpan
            });
        }

        birdFlocks = [];
        const flockCount = Number(b.bird || 0) > 0 ? 4 : 2;
        for (let i = 0; i < flockCount; i++) {
            birdFlocks.push({
                angle: Math.random() * Math.PI * 2,
                radius: 85 + i * 50,
                wz: 50 + i * 10,
                speed: 0.015 + i * 0.003,
                count: 5
            });
        }

        smokeParticles = [];
    }

    // =========================================================================
    // 6. تهيئة مشهد العاصمة والأدوات التفاعلية (Init & HUD Setup)
    // =========================================================================
    function init() {
        canvas = document.getElementById('capital-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        const btnBack = document.getElementById('btn-back-from-capital');
        if (btnBack) {
            btnBack.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                openWorldScreen('table');
            };
        }

        const btnZoomIn = document.getElementById('cap-zoom-in');
        if (btnZoomIn) btnZoomIn.onclick = () => adjustZoom(0.22);

        const btnZoomOut = document.getElementById('cap-zoom-out');
        if (btnZoomOut) btnZoomOut.onclick = () => adjustZoom(-0.22);

        const btnZoomReset = document.getElementById('cap-zoom-reset');
        if (btnZoomReset) btnZoomReset.onclick = () => resetCamera();

        injectEnhancedCameraHUD();
        setupCapitalLandscapeUI();

        if (!isInitialized) {
            attachInputs();
            isInitialized = true;
        }
    }

    function openWorldScreen(targetTabKey) {
        close();
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const dash = document.getElementById('game-dashboard');
        if (dash) dash.classList.add('active');

        if (window.renderNationsTable) {
            window.renderNationsTable();
        }

        if (targetTabKey) {
            const btnMap = {
                table: 'btn-view-table',
                charts: 'btn-view-charts',
                chronicle: 'btn-view-chronicle',
                analytics: 'btn-view-analytics',
                worldbank: 'btn-view-worldbank',
                trade: 'btn-view-trade',
                exchange: 'btn-view-exchange',
                war: 'btn-view-war'
            };
            const targetBtn = document.getElementById(btnMap[targetTabKey]);
            if (targetBtn) targetBtn.click();
        }
    }

    function injectEnhancedCameraHUD() {
        const controlsBox = document.querySelector('.capital-floating-controls');
        if (!controlsBox || document.getElementById('cap-rot-left')) return;

        const extraButtons = [
            { id: 'cap-rot-left', text: '↺', title: 'تدوير الكاميرا يساراً', cls: 'btn-secondary', onClick: () => { camera.targetYaw -= Math.PI / 6; } },
            { id: 'cap-rot-right', text: '↻', title: 'تدوير الكاميرا يميناً', cls: 'btn-secondary', onClick: () => { camera.targetYaw += Math.PI / 6; } },
            { id: 'cap-pitch-toggle', text: '📐', title: 'تبديل زاوية الكاميرا', cls: 'btn-secondary', onClick: togglePitchPreset },
            { id: 'cap-time-toggle', text: '☀️', title: 'تبديل الإضاءة والوقت', cls: 'btn-accent', onClick: cycleTimeOfDay },
            { id: 'cap-badges-toggle', text: '🏷️', title: 'إظهار/إخفاء أيقونات المباني', cls: 'btn-primary', onClick: () => { showBuildingBadges = !showBuildingBadges; } },
            { id: 'cap-expand-grid', text: '🗺️+', title: 'توسيع الرقعة السداسية', cls: 'btn-secondary', onClick: () => expandGrid(1) },
            { id: 'cap-fullscreen-btn', text: '⛶', title: 'ملء الشاشة وإخفاء شريط المتصفح', cls: 'btn-accent', onClick: () => { if (window.toggleGameFullscreen) window.toggleGameFullscreen(); } }
        ];

        extraButtons.forEach(cfg => {
            const btn = document.createElement('button');
            btn.id = cfg.id;
            btn.className = `btn ${cfg.cls} btn-sm`;
            btn.title = cfg.title;
            btn.textContent = cfg.text;
            btn.onclick = cfg.onClick;
            controlsBox.appendChild(btn);
        });
    }

    function setupCapitalLandscapeUI() {
        // أزرار الشريط السفلي السريع (Bottom Icon Dock)
        const dockBtns = document.querySelectorAll('.cap-dock-btn');
        dockBtns.forEach(btn => {
            btn.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                const action = btn.getAttribute('data-dock-action');
                handleDockAction(action);
            };
        });

        // أزرار الشريط العلوي بعد انتهاء الشراء: (الانتقال للسنة الجديدة) و(الانتقال للحرب)
        const btnNextYearCap = document.getElementById('btn-cap-next-year');
        if (btnNextYearCap) {
            btnNextYearCap.onclick = () => {
                if (typeof window.triggerPlayerTurnDecision === "function") {
                    window.triggerPlayerTurnDecision("READY_YEAR");
                }
            };
        }

        const btnGoWarCap = document.getElementById('btn-cap-go-war');
        if (btnGoWarCap) {
            btnGoWarCap.onclick = () => {
                if (typeof window.triggerPlayerTurnDecision === "function") {
                    window.triggerPlayerTurnDecision("READY_WAR");
                }
            };
        }

        const milPill = document.getElementById('cap-pill-mil');
        if (milPill) {
            milPill.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                openMilitaryFromCapital();
            };
        }

        // النقر على شارة المرحلة أو اسم الدولة في الأعلى يفتح نافذة القلعة السيادية والترقية
        const headerBadge = document.getElementById('cap-header-nation-box');
        if (headerBadge) {
            headerBadge.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                const citadelHex = hexMap.get('0,0') || hexMesh.find(h => h.isCitadel);
                if (citadelHex) openCitadelInspector(citadelHex);
            };
        }

        // النقر على كبسولة السيولة/البنك يفتح درج الخزينة والطاقة
        const cashPill = document.getElementById('cap-pill-cash');
        if (cashPill) {
            cashPill.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                toggleDrawer('cap-drawer-economy');
            };
        }

        // النقر على كبسولة الكهرباء أو الماء يفتح درج القطاعات
        const utilPills = ['cap-pill-elec', 'cap-pill-water', 'cap-pill-workers'];
        utilPills.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = () => {
                    if (window.GameSFX) window.GameSFX.playClick();
                    if (id === 'cap-pill-workers') {
                        currentBuildCategory = 'housing';
                        filterBySectorId = null;
                        openDrawer('cap-drawer-build');
                    } else {
                        toggleDrawer('cap-drawer-sectors');
                    }
                };
            }
        });

        // أزرار إغلاق الأدراج والنوافذ المنبثقة
        document.querySelectorAll('.cap-drawer-close').forEach(btn => {
            btn.onclick = () => {
                closeAllDrawers();
            };
        });

        const btnCloseInspector = document.getElementById('btn-close-cap-inspector');
        if (btnCloseInspector) {
            btnCloseInspector.onclick = () => {
                closeInspectorPopup();
            };
        }

        const btnToggleTopbar = document.getElementById('btn-toggle-cap-topbar');
        const btnRestoreTopbar = document.getElementById('btn-restore-cap-topbar');
        const capTopbar = document.getElementById('cap-landscape-topbar');

        if (btnToggleTopbar && capTopbar) {
            btnToggleTopbar.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                capTopbar.classList.add('topbar-collapsed');
                if (btnRestoreTopbar) btnRestoreTopbar.style.display = 'inline-flex';
                setTimeout(resizeCanvas, 30);
            };
        }

        if (btnRestoreTopbar && capTopbar) {
            btnRestoreTopbar.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                capTopbar.classList.remove('topbar-collapsed');
                btnRestoreTopbar.style.display = 'none';
                setTimeout(resizeCanvas, 30);
            };
        }
    }

    function handleDockAction(action) {
        closeInspectorPopup();
        if (action === 'build') {
            filterBySectorId = null;
            toggleDrawer('cap-drawer-build');
        } else if (action === 'sectors') {
            toggleDrawer('cap-drawer-sectors');
        } else if (action === 'economy') {
            toggleDrawer('cap-drawer-economy');
        } else if (action === 'military') {
            closeAllDrawers();
            openMilitaryFromCapital();
        } else if (action === 'war') {
            closeAllDrawers();
            openWorldScreen('war');
        } else if (action === 'world') {
            closeAllDrawers();
            openWorldScreen('table');
        } else if (action === 'dossier') {
            closeAllDrawers();
            if (window.CountryViewController && typeof window.CountryViewController.openDetailedDossier === 'function') {
                window.CountryViewController.openDetailedDossier(currentCountry);
            }
        }
    }

    function openMilitaryFromCapital() {
        if (!currentCountry) return;
        if (!isCountryOwner(currentCountry)) {
            if (window.showGameToast) window.showGameToast("🔒 قيادة الجيش خاصة بصاحب الدولة فقط!", "🛡️");
            return;
        }
        close();
        document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
        const milScreen = document.getElementById("military-screen");
        if (milScreen) milScreen.classList.add("active");

        const nameEl = document.getElementById("mil-country-name");
        if (nameEl) nameEl.textContent = "🎖️ القيادة العامة للجيش - " + currentCountry.name;

        const fundsEl = document.getElementById("mil-disposable-funds");
        if (fundsEl) fundsEl.textContent = "$" + Number(currentCountry.disposableRevenue || 0).toLocaleString();

        const popEl = document.getElementById("mil-population-count");
        if (popEl) popEl.textContent = Number(currentCountry.unemployed || 0).toLocaleString() + " متاح للتجنيد";

        if (window.MilitaryView) {
            if (typeof window.MilitaryView.show === "function") window.MilitaryView.show(currentCountry);
            else if (typeof window.MilitaryView.open === "function") window.MilitaryView.open(currentCountry);
            else if (typeof window.MilitaryView.render === "function") window.MilitaryView.render(currentCountry);
        }
        if (typeof window.showMilitaryScreen === "function") {
            window.showMilitaryScreen(currentCountry);
        }
    }

    function toggleDrawer(drawerId) {
        if (activeDrawerId === drawerId) {
            closeAllDrawers();
        } else {
            openDrawer(drawerId);
        }
    }

    function hideTooltip() {
        const tooltip = document.getElementById('capital-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
            tooltip.innerHTML = '';
        }
    }

    function openDrawer(drawerId) {
        closeInspectorPopup();
        hideTooltip();
        const drawers = ['cap-drawer-build', 'cap-drawer-sectors', 'cap-drawer-economy'];
        drawers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === drawerId) {
                    el.style.display = 'flex';
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                    el.style.display = 'none';
                }
            }
        });
        activeDrawerId = drawerId;

        // تحديث تمييز أزرار الشريط السفلي
        document.querySelectorAll('.cap-dock-btn').forEach(btn => {
            const act = btn.getAttribute('data-dock-action');
            const match = (drawerId === 'cap-drawer-build' && act === 'build') ||
                (drawerId === 'cap-drawer-sectors' && act === 'sectors') ||
                (drawerId === 'cap-drawer-economy' && act === 'economy');
            if (match) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        if (drawerId === 'cap-drawer-build') renderVisualBuildDrawer();
        else if (drawerId === 'cap-drawer-sectors') renderVisualSectorsDrawer();
        else if (drawerId === 'cap-drawer-economy') renderVisualEconomyDrawer();
    }

    function closeAllDrawers() {
        ['cap-drawer-build', 'cap-drawer-sectors', 'cap-drawer-economy'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active');
                el.style.display = 'none';
            }
        });
        document.querySelectorAll('.cap-dock-btn').forEach(btn => btn.classList.remove('active'));
        activeDrawerId = null;
        hideTooltip();
    }

    function closeInspectorPopup() {
        const popup = document.getElementById('cap-inspector-popup');
        if (popup) {
            popup.classList.remove('active');
            popup.style.display = 'none';
        }
        selectedHex = null;
        hideTooltip();
    }

    // =========================================================================
    // 7. التفاعل المباشر بالضغط على المباني والأراضي داخل المشهد ثلاثي الأبعاد
    // =========================================================================
    function handleHexTap(hex) {
        hideTooltip();
        if (activeDrawerId) {
            closeAllDrawers();
            return;
        }
        if (!hex || !currentCountry) {
            closeInspectorPopup();
            return;
        }
        if (window.GameSFX) window.GameSFX.playClick();
        selectedHex = hex;
        closeAllDrawers();

        // تحريك الكاميرا بنعومة نحو الخلية المختارة
        const cosY = Math.cos(camera.yaw);
        const sinY = Math.sin(camera.yaw);
        const rx = hex.wx * cosY - hex.wy * sinY;
        const ry = hex.wx * sinY + hex.wy * cosY;
        camera.targetX = -rx * camera.zoom * 0.45;
        camera.targetY = 20 - ry * Math.sin(camera.pitch) * camera.zoom * 0.45;

        if (hex.isCitadel) {
            openCitadelInspector(hex);
        } else if (hex.cluster && hex.cluster.count > 0) {
            openBuildingInspector(hex);
        } else {
            openEmptyTileInspector(hex);
        }
    }

    // أ. نافذة القلعة السيادية والترقية والبنك (عند الضغط على القصر الملكي في وسط العاصمة)
    function openCitadelInspector(hex) {
        closeAllDrawers();
        hideTooltip();
        const popup = document.getElementById('cap-inspector-popup');
        const body = document.getElementById('cap-inspector-body');
        if (!popup || !body || !currentCountry) return;

        const isOwner = isCountryOwner(currentCountry);
        const currentStage = Number(currentCountry.stage) || 1;
        const comp = window.BuildingsEngine ? window.BuildingsEngine.checkStageCompletion(currentCountry, currentStage) : { ownedTypes: 0, totalTypes: 12, isComplete: false, missing: [] };
        const pct = comp.totalTypes > 0 ? Math.round((comp.ownedTypes / comp.totalTypes) * 100) : 0;
        const bankVal = Number(currentCountry.bank !== undefined ? currentCountry.bank : (currentCountry.bankBalance || 0));
        const popVal = Number(currentCountry.population || 0);
        const unempVal = Math.max(0, popVal - Number(currentCountry.employed || 0));

        body.innerHTML = `
            <div class="cap-insp-header">
                <div class="cap-insp-icon-big" style="background:linear-gradient(180deg,#fbbf24,#b45309);">👑</div>
                <div class="cap-insp-title-wrap">
                    <h4>القلعة السيادية - ${currentCountry.name}</h4>
                    <span class="cap-insp-sub">${currentCountry.stageName || ('المرحلة ' + currentStage)}</span>
                </div>
            </div>

            <div class="cap-stage-progress-box">
                <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:900; margin-bottom:4px;">
                    <span style="color:#fde047;">🏆 تقدم المرحلة ${currentStage}</span>
                    <span style="color:#38bdf8;">${comp.ownedTypes} / ${comp.totalTypes} منشأة (${pct}%)</span>
                </div>
                <div class="cap-progress-track">
                    <div class="cap-progress-fill" style="width:${pct}%;"></div>
                </div>
                ${isOwner && currentStage < 5 ? `
                    <button type="button" id="btn-insp-upgrade-stage" class="btn ${comp.isComplete ? 'btn-primary btn-pulse-upgrade' : 'btn-secondary'} btn-sm" style="width:100%; margin-top:8px;">
                        ${comp.isComplete ? '✨ ترقية الدولة إلى المرحلة ' + (currentStage + 1) + ' الآن!' : '🔒 أكمل منشآت المرحلة ' + currentStage + ' للترقية'}
                    </button>
                ` : ''}
            </div>

            <div class="cap-insp-chips-grid">
                <div class="cap-insp-chip">
                    <span class="chip-ico">💵</span>
                    <div>
                        <small>السيولة المتاحة</small>
                        <strong class="text-emerald">$${Number(currentCountry.disposableRevenue || 0).toLocaleString()}</strong>
                    </div>
                </div>
                <div class="cap-insp-chip">
                    <span class="chip-ico">🏦</span>
                    <div>
                        <small>البنك الوطني</small>
                        <strong class="text-gold">$${bankVal.toLocaleString()}</strong>
                    </div>
                </div>
                <div class="cap-insp-chip">
                    <span class="chip-ico">👥</span>
                    <div>
                        <small>السكان (العمال)</small>
                        <strong class="text-purple">${popVal.toLocaleString()} (👷${unempVal.toLocaleString()})</strong>
                    </div>
                </div>
                <div class="cap-insp-chip">
                    <span class="chip-ico">⭐</span>
                    <div>
                        <small>المؤشر العام</small>
                        <strong class="text-cyan">${Number(currentCountry.generalIndex || 0).toLocaleString()}</strong>
                    </div>
                </div>
            </div>

            <div class="cap-insp-actions-row">
                ${isOwner ? `
                    <button type="button" id="btn-insp-open-build" class="btn btn-primary btn-sm" style="flex:1;">🏗️ قائمة البناء</button>
                    <button type="button" id="btn-insp-open-bank" class="btn btn-accent btn-sm" style="flex:1;">🏦 الخزينة والبنك</button>
                    <button type="button" id="btn-insp-open-mil" class="btn btn-military btn-sm" style="flex:1;">🎖️ الجيش</button>
                ` : `
                    <button type="button" id="btn-insp-donate-ally" class="btn btn-primary btn-sm" style="width:100%;">🎁 إرسال منحة مالية لدولة ${currentCountry.name}</button>
                `}
            </div>
        `;

        popup.style.display = 'block';
        popup.style.display = 'block';
        popup.classList.add('active');

        const btnUpg = document.getElementById('btn-insp-upgrade-stage');
        if (btnUpg) {
            btnUpg.onclick = () => {
                const res = window.BuildingsEngine.upgradeToStage(currentCountry, currentStage + 1, window.currentWorld);
                if (window.showGameToast) window.showGameToast(res.msg, res.success ? "🎉" : "⚠️");
                if (res.success) {
                    currentBuildStageTab = Number(currentCountry.stage) || 1;
                    refreshHUDAndMap();
                    closeInspectorPopup();
                    if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(currentCountry);
                }
            };
        }

        const btnOpenBuild = document.getElementById('btn-insp-open-build');
        if (btnOpenBuild) {
            btnOpenBuild.onclick = () => {
                closeInspectorPopup();
                openDrawer('cap-drawer-build');
            };
        }

        const btnOpenBank = document.getElementById('btn-insp-open-bank');
        if (btnOpenBank) {
            btnOpenBank.onclick = () => {
                closeInspectorPopup();
                openDrawer('cap-drawer-economy');
            };
        }

        const btnOpenMil = document.getElementById('btn-insp-open-mil');
        if (btnOpenMil) {
            btnOpenMil.onclick = () => {
                closeInspectorPopup();
                openMilitaryFromCapital();
            };
        }

        const btnDonateAlly = document.getElementById('btn-insp-donate-ally');
        if (btnDonateAlly) {
            btnDonateAlly.onclick = () => {
                closeInspectorPopup();
                if (window.CountryViewController && typeof window.CountryViewController.openDonationModal === 'function') {
                    window.CountryViewController.openDonationModal();
                }
            };
        }
    }

    // ب. نافذة المنشأة التفاعلية (عند الضغط على أي مبنى قائم في العاصمة 3D)
    function openBuildingInspector(hex) {
        closeAllDrawers();
        hideTooltip();
        const popup = document.getElementById('cap-inspector-popup');
        const body = document.getElementById('cap-inspector-body');
        if (!popup || !body || !currentCountry || !hex.cluster) return;

        const c = hex.cluster;
        const res = window.BuildingsEngine ? window.BuildingsEngine.getResource(c.id) : null;
        if (!res) return;

        const isOwner = isCountryOwner(currentCountry);
        const totalOwned = Number(currentCountry.buildings?.[res.id] || 0);
        const canAfford = Number(currentCountry.disposableRevenue || 0) >= res.price;
        const prereq = window.BuildingsEngine.checkPrerequisites(currentCountry, res.id);
        const childUnits = window.BuildingsEngine.getChildUnitsForParent ? window.BuildingsEngine.getChildUnitsForParent(res.id) : [];

        // تحديد الاختصار الذكي للنظام المرتبط بالمنشأة ("كل حسب الاحتياج")
        let systemShortcutHtml = '';
        if (isOwner) {
            if (['police_station', 'police_headquarters'].includes(res.id)) {
                systemShortcutHtml = `<button type="button" id="btn-insp-sys-shortcut" data-sys="military" class="btn btn-military btn-sm" style="width:100%; margin-top:6px;">🎖️ دخول قيادة الجيش والترسانة ➔</button>`;
            } else if (['oil_well', 'oil_field', 'gas_well', 'fuel_station', 'gas_station_shop', 'power_generator', 'power_plant', 'solar_farm', 'wind_station', 'nuclear_reactor'].includes(res.id)) {
                systemShortcutHtml = `<button type="button" id="btn-insp-sys-shortcut" data-sys="economy" class="btn btn-accent btn-sm" style="width:100%; margin-top:6px;">⚡ فتح منظومة الطاقة والوقود ➔</button>`;
            } else if (['marina', 'seaport', 'shop', 'shop_large', 'showroom', 'markets', 'mall'].includes(res.id)) {
                systemShortcutHtml = `<button type="button" id="btn-insp-sys-shortcut" data-sys="trade" class="btn btn-accent btn-sm" style="width:100%; margin-top:6px;">🚢 فتح التجارة والأسواق العالمية ➔</button>`;
            } else {
                systemShortcutHtml = `<button type="button" id="btn-insp-sys-shortcut" data-sys="sectors" class="btn btn-secondary btn-sm" style="width:100%; margin-top:6px;">🎯 فحص توازن القطاعات الـ 16 ➔</button>`;
            }
        }

        // عرض أيقونات التأثير القطاعي بصرياً
        let sectorPillsHtml = '';
        if (res.sectorEffects) {
            Object.entries(res.sectorEffects).forEach(([sKey, sVal]) => {
                const meta = SECTOR_META[sKey] || { name: sKey, icon: '⚙️' };
                const cls = sVal > 0 ? 'pill-pos' : 'pill-neg';
                sectorPillsHtml += `<span class="cap-mini-effect-pill ${cls}">${meta.icon} ${sVal > 0 ? '+' + sVal : sVal} ${meta.name}</span>`;
            });
        }

        // عرض الوحدات الفرعية التابعة للمبنى (مثل الطيور، المواشي، السفن، الطائرات، عربات القطار)
        let childUnitsHtml = '';
        if (isOwner && childUnits.length > 0) {
            childUnitsHtml = `<div class="cap-subunits-box"><div class="cap-subunits-title">📦 الوحدات العاملة داخل ${res.name}:</div>`;
            childUnits.forEach(sub => {
                const subOwned = Number(currentCountry.buildings?.[sub.id] || 0);
                const subPrereq = window.BuildingsEngine.checkPrerequisites(currentCountry, sub.id);
                const subAfford = Number(currentCountry.disposableRevenue || 0) >= sub.price;
                childUnitsHtml += `
                    <div class="cap-subunit-row">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:1.3rem;">${sub.icon}</span>
                            <div>
                                <strong style="font-size:0.82rem; color:#fffbeb;">${sub.name} (×${subOwned})</strong>
                                <span style="display:block; font-size:0.7rem; color:#34d399;">💵 $${sub.price} | 📈 +$${sub.revenue}/سنة</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button type="button" class="btn btn-primary btn-sm btn-buy-subunit" data-subid="${sub.id}" ${(!subPrereq.satisfied || !subAfford) ? 'disabled' : ''}>➕ شراء</button>
                            <button type="button" class="btn btn-danger btn-sm btn-demolish-subunit" data-subid="${sub.id}" ${subOwned <= 0 ? 'disabled' : ''}>➖</button>
                        </div>
                    </div>
                `;
            });
            childUnitsHtml += `</div>`;
        }

        const popBadge = res.populationType === 'add' ?
            `🏠 +${res.populationValue} سكان` :
            (res.populationType === 'workforce' ? `👷 ${res.populationValue} عامل` : '🤖 آلي');

        body.innerHTML = `
            <div class="cap-insp-header">
                <div class="cap-insp-icon-big">${res.icon}</div>
                <div class="cap-insp-title-wrap">
                    <h4>${res.name} <span class="badge badge-gold" style="font-size:0.75rem; padding:2px 8px;">×${totalOwned}</span></h4>
                    <span class="cap-insp-sub">${res.stage === 'clean_energy' ? '🌱 طاقة نظيفة' : ('المرحلة ' + res.stage)}</span>
                </div>
            </div>

            <div class="cap-insp-chips-grid">
                <div class="cap-insp-chip">
                    <span class="chip-ico">💵</span>
                    <div>
                        <small>تكلفة البناء</small>
                        <strong class="text-gold">$${res.price.toLocaleString()}</strong>
                    </div>
                </div>
                <div class="cap-insp-chip">
                    <span class="chip-ico">${res.revenue >= 0 ? '📈' : '🔧'}</span>
                    <div>
                        <small>العائد السنوي</small>
                        <strong class="${res.revenue >= 0 ? 'text-emerald' : 'text-red'}">${res.revenue >= 0 ? '+$' + res.revenue : '-$' + Math.abs(res.revenue)}</strong>
                    </div>
                </div>
                <div class="cap-insp-chip">
                    <span class="chip-ico">${res.populationType === 'add' ? '🏠' : '👷'}</span>
                    <div>
                        <small>السكان / العمالة</small>
                        <strong class="text-purple">${popBadge}</strong>
                    </div>
                </div>
                <div class="cap-insp-chip">
                    <span class="chip-ico">📊</span>
                    <div>
                        <small>إجمالي عائد النوع</small>
                        <strong class="text-cyan">${(res.revenue * totalOwned) >= 0 ? '+$' + (res.revenue * totalOwned).toLocaleString() : '-$' + Math.abs(res.revenue * totalOwned).toLocaleString()}</strong>
                    </div>
                </div>
            </div>

            <div class="cap-mini-effects-wrap">
                ${sectorPillsHtml || '<span class="cap-mini-effect-pill">✨ عائد اقتصادي مباشر</span>'}
            </div>

            ${childUnitsHtml}

            ${isOwner ? `
                <div class="cap-insp-actions-row" style="margin-top:8px;">
                    <button type="button" id="btn-insp-buy-more" class="btn ${prereq.satisfied && canAfford ? 'btn-primary' : 'btn-secondary'} btn-sm" style="flex:2;" ${(!prereq.satisfied || !canAfford) ? 'disabled' : ''}>
                        ➕ بناء ${res.icon} إضافي ($${res.price.toLocaleString()})
                    </button>
                    <button type="button" id="btn-insp-demolish-one" class="btn btn-danger btn-sm" style="flex:1;" ${totalOwned <= 0 ? 'disabled' : ''}>
                        ➖ إزالة
                    </button>
                </div>
                ${systemShortcutHtml}
            ` : ''}
        `;

        popup.classList.add('active');

        const btnBuyMore = document.getElementById('btn-insp-buy-more');
        if (btnBuyMore) {
            btnBuyMore.onclick = () => {
                executeCapitalBuild(res.id, hex);
            };
        }

        const btnDemolishOne = document.getElementById('btn-insp-demolish-one');
        if (btnDemolishOne) {
            btnDemolishOne.onclick = () => {
                executeCapitalDemolish(res.id, hex);
            };
        }

        body.querySelectorAll('.btn-buy-subunit').forEach(btn => {
            btn.onclick = () => {
                const subId = btn.getAttribute('data-subid');
                executeCapitalBuild(subId, hex);
            };
        });

        body.querySelectorAll('.btn-demolish-subunit').forEach(btn => {
            btn.onclick = () => {
                const subId = btn.getAttribute('data-subid');
                executeCapitalDemolish(subId, hex);
            };
        });

        const btnSysShortcut = document.getElementById('btn-insp-sys-shortcut');
        if (btnSysShortcut) {
            btnSysShortcut.onclick = () => {
                const sys = btnSysShortcut.getAttribute('data-sys');
                closeInspectorPopup();
                if (sys === 'military') openMilitaryFromCapital();
                else if (sys === 'economy') openDrawer('cap-drawer-economy');
                else if (sys === 'trade') openWorldScreen('trade');
                else if (sys === 'sectors') openDrawer('cap-drawer-sectors');
            };
        }
    }

    // ج. عند الضغط على أرض أو شاطئ أو بحر فارغ في المشهد ثلاثي الأبعاد
    function openEmptyTileInspector(hex) {
        closeInspectorPopup();
        hideTooltip();
        if (!isCountryOwner(currentCountry)) return;

        if (hex.type === 'water') {
            currentBuildCategory = 'transport';
        } else if (hex.type === 'sand') {
            currentBuildCategory = 'all';
        } else {
            currentBuildCategory = 'recommended';
        }
        filterBySectorId = null;
        openDrawer('cap-drawer-build');
    }

    // تنفيذ عملية الشراء مباشرة من العاصمة وتحديث المشهد ثلاثي الأبعاد فوراً
    function executeCapitalBuild(resourceId, focusHex = null) {
        if (!currentCountry || !isCountryOwner(currentCountry)) return;
        if (window.GameSFX) window.GameSFX.playClick();

        const res = window.BuildingsEngine.purchaseResource(currentCountry, resourceId);
        if (!res.success) {
            if (window.showGameToast) window.showGameToast(res.msg, "⚠️");
            return;
        }

        if (window.showGameToast) {
            window.showGameToast(`${res.msg} (المتبقي: $${Number(currentCountry.disposableRevenue || 0).toLocaleString()})`, "🏗️");
        }

        refreshHUDAndMap();
        if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(currentCountry);

        if (activeDrawerId === 'cap-drawer-build') {
            renderVisualBuildDrawer();
        } else if (focusHex) {
            const updatedHex = hexMesh.find(h => h.cluster && h.cluster.id === (focusHex.cluster ? focusHex.cluster.id : resourceId)) || focusHex;
            if (updatedHex && updatedHex.cluster) openBuildingInspector(updatedHex);
        }
    }

    // تنفيذ عملية الإزالة مباشرة من العاصمة وتحديث المشهد ثلاثي الأبعاد فوراً
    function executeCapitalDemolish(resourceId, focusHex = null) {
        if (!currentCountry || !isCountryOwner(currentCountry)) return;
        if (window.GameSFX) window.GameSFX.playClick();

        const res = window.BuildingsEngine.demolishResource(currentCountry, resourceId);
        if (!res.success) {
            if (window.showGameToast) window.showGameToast(res.msg, "⚠️");
            return;
        }

        if (window.showGameToast) {
            window.showGameToast(res.msg, "🔨");
        }

        refreshHUDAndMap();
        if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(currentCountry);

        if (activeDrawerId === 'cap-drawer-build') {
            renderVisualBuildDrawer();
        } else if (focusHex) {
            const updatedHex = hexMesh.find(h => h.cluster && h.cluster.id === resourceId);
            if (updatedHex && updatedHex.cluster) {
                openBuildingInspector(updatedHex);
            } else {
                closeInspectorPopup();
            }
        }
    }

    // =========================================================================
    // 8. الأدراج البصرية المعتمدة على الرموز والأشكال (Visual Icon Drawers)
    // =========================================================================

    // أ. درج البناء البصري بالبطاقات والأيقونات (بديل الجدول النصي الطويل)
    function renderVisualBuildDrawer() {
        const container = document.getElementById('cap-build-drawer-content');
        if (!container || !currentCountry || !window.BuildingsEngine) return;

        const isOwner = isCountryOwner(currentCountry);
        if (!isOwner) {
            container.innerHTML = `<div style="padding:20px; text-align:center; color:#fde047; font-weight:900;">👁️ أنت في وضع المشاهدة الدبلوماسية لدولة ${currentCountry.name}</div>`;
            return;
        }

        const countryStage = Number(currentCountry.stage) || 1;
        const cash = Number(currentCountry.disposableRevenue || 0);
        const unemployed = Math.max(0, Number(currentCountry.population || 0) - Number(currentCountry.employed || 0));
        const recommendedIds = window.BuildingsEngine.getSmartRecommendations ? window.BuildingsEngine.getSmartRecommendations(currentCountry) : [];

        // شريط المراحل + زر الترقية السريع
        const stageComp = window.BuildingsEngine.checkStageCompletion(currentCountry, countryStage);
        const stagesList = [
            { tab: 1, label: "🏕️ م1" },
            { tab: 2, label: "🏘️ م2" },
            { tab: 3, label: "🏭 م3" },
            { tab: 4, label: "🏙️ م4" },
            { tab: 5, label: "🚀 م5" },
            { tab: "clean_energy", label: "🌱 طاقة نظيفة" }
        ];

        const stageTabsHtml = stagesList.map(st => {
            const isLockedStage = typeof st.tab === 'number' && st.tab > countryStage;
            const isActive = String(currentBuildStageTab) === String(st.tab) && !filterBySectorId && currentBuildCategory !== 'recommended';
            return `
                <button type="button" class="cap-stage-pill-btn ${isActive ? 'active' : ''}" data-stagetab="${st.tab}">
                    ${isLockedStage ? '🔒 ' : ''}${st.label}
                </button>
            `;
        }).join('');

        // شريط التصنيفات البصرية بالرموز
        const cats = Object.values(window.BuildingsEngine.VISUAL_CATEGORIES || {});
        const catTabsHtml = cats.map(c => {
            const isActive = !filterBySectorId && currentBuildCategory === c.id;
            return `
                <button type="button" class="cap-cat-pill-btn ${isActive ? 'active' : ''}" data-catid="${c.id}">
                    <span>${c.icon}</span> <span>${c.name}</span>
                </button>
            `;
        }).join('');

        // فلترة الموارد المعروضة
        let resources = window.BuildingsEngine.RESOURCES_LIST.filter(res => {
            if (filterBySectorId) {
                return res.sectorEffects && Number(res.sectorEffects[filterBySectorId] || 0) > 0;
            }
            if (currentBuildCategory === 'recommended') {
                return recommendedIds.includes(res.id);
            }
            const stageMatch = currentBuildStageTab === 'clean_energy' ?
                (res.stage === 'clean_energy' || res.category === 'clean_energy') :
                Number(res.stage) === Number(currentBuildStageTab);
            if (!stageMatch) return false;
            if (currentBuildCategory !== 'all') {
                return window.BuildingsEngine.getVisualCategory(res.id) === currentBuildCategory;
            }
            return true;
        });

        if (currentBuildCategory === 'recommended' && resources.length === 0) {
            resources = window.BuildingsEngine.RESOURCES_LIST.filter(r => Number(r.stage) === countryStage);
        }

        // بناء بطاقات المنشآت البصرية المعتمدة على الرموز والأشكال
        const cardsHtml = resources.map(res => {
            const owned = Number(currentCountry.buildings?.[res.id] || 0);
            const prereq = window.BuildingsEngine.checkPrerequisites(currentCountry, res.id);
            const canAfford = cash >= res.price;
            const hasWorkers = res.populationType !== 'workforce' || unemployed >= res.populationValue;
            const canBuildNow = prereq.satisfied && canAfford && hasWorkers;
            const isRecommended = recommendedIds.includes(res.id);

            // شارات الرموز المختصرة (بدون جمل نصية طويلة)
            const popChip = res.populationType === 'add' ?
                `<span class="v-chip v-chip-pop" title="يزيد السكان">🏠 +${res.populationValue}</span>` :
                (res.populationType === 'workforce' ? `<span class="v-chip ${hasWorkers ? 'v-chip-work' : 'v-chip-deficit'}" title="يحتاج عمال">👷 ${res.populationValue}</span>` : '');

            let sectorChips = '';
            if (res.sectorEffects) {
                Object.entries(res.sectorEffects).forEach(([sKey, sVal]) => {
                    const meta = SECTOR_META[sKey] || { icon: '⚙️', name: sKey };
                    const cls = sVal > 0 ? 'v-chip-pos' : 'v-chip-neg';
                    sectorChips += `<span class="v-chip ${cls}" title="${meta.name}">${meta.icon}${sVal > 0 ? '+' + sVal : sVal}</span>`;
                });
            }

            // تمثيل الشروط المسبقة بالرموز بدلاً من النصوص
            let prereqVisualHtml = '';
            if (!prereq.satisfied) {
                const reqVis = window.BuildingsEngine.getPrerequisiteVisuals ? window.BuildingsEngine.getPrerequisiteVisuals(res, currentCountry) : [];
                if (typeof res.stage === 'number' && res.stage > countryStage) {
                    prereqVisualHtml = `<div class="v-card-lock-banner">🔒 يفتح في المرحلة ${res.stage}</div>`;
                } else if (reqVis.length > 0) {
                    const iconsStr = reqVis.map(rv => `<span class="${rv.owned ? 'req-ok' : 'req-miss'}">${rv.icon} ${rv.name}</span>`).join(res.prerequisiteMode === 'OR' ? ' أو ' : ' + ');
                    prereqVisualHtml = `<div class="v-card-lock-banner">🔒 يتطلب: ${iconsStr}</div>`;
                } else {
                    prereqVisualHtml = `<div class="v-card-lock-banner">🔒 ${prereq.reason}</div>`;
                }
            } else if (!hasWorkers) {
                prereqVisualHtml = `<div class="v-card-lock-banner" style="color:#fda4af;">👷 ابنِ بيتاً 🏠 لتوفير عمال!</div>`;
            }

            return `
                <div class="visual-bldg-card ${canBuildNow ? 'card-buildable' : 'card-locked'} ${isRecommended ? 'card-recommended' : ''}">
                    ${isRecommended ? '<span class="v-card-rec-ribbon">💡 مقترح</span>' : ''}
                    <div class="v-card-top">
                        <div class="v-card-icon-box">${res.icon}</div>
                        <div class="v-card-title-col">
                            <div class="v-card-name">${res.name}</div>
                            <div class="v-card-owned-row">
                                <span class="v-owned-badge ${owned > 0 ? 'has-owned' : ''}">مملوك: ${owned}</span>
                                ${res.capacityBase > 0 ? `<span class="v-cap-badge">📦 سعة ${res.capacityBase}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="v-card-metrics-row">
                        <span class="v-metric-price ${canAfford ? 'price-ok' : 'price-short'}">💵 $${res.price.toLocaleString()}</span>
                        <span class="v-metric-rev ${res.revenue >= 0 ? 'rev-pos' : 'rev-neg'}">${res.revenue >= 0 ? '📈 +$' + res.revenue : '🔧 -$' + Math.abs(res.revenue)}/سنة</span>
                    </div>

                    <div class="v-card-chips-flow">
                        ${popChip}
                        ${sectorChips}
                    </div>

                    ${prereqVisualHtml}

                    <div class="v-card-actions">
                        <button type="button" class="btn ${canBuildNow ? 'btn-primary' : 'btn-secondary'} btn-sm btn-v-buy" data-id="${res.id}" ${!canBuildNow ? 'disabled' : ''}>
                            ➕ بناء
                        </button>
                        ${owned > 0 ? `<button type="button" class="btn btn-danger btn-sm btn-v-demolish" data-id="${res.id}" title="إزالة واسترداد $${res.price}">➖</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        const filterBannerHtml = filterBySectorId ? `
            <div class="cap-sector-filter-alert">
                <span>🎯 المنشآت التي ترفع قطاع <strong>${SECTOR_META[filterBySectorId]?.icon || ''} ${SECTOR_META[filterBySectorId]?.name || filterBySectorId}</strong></span>
                <button type="button" id="btn-clear-sector-filter" class="btn btn-secondary btn-sm">✕ عرض الكل</button>
            </div>
        ` : '';

        container.innerHTML = `
            <div class="cap-build-toolbar">
                <div class="cap-stages-scroll">
                    ${stageTabsHtml}
                    ${stageComp.isComplete && countryStage < 5 ? `
                        <button type="button" id="btn-drawer-upgrade-stage" class="btn btn-primary btn-sm btn-pulse-upgrade">✨ ترقية للمرحلة ${countryStage + 1}</button>
                    ` : ''}
                </div>
                <div class="cap-cats-scroll">
                    ${catTabsHtml}
                </div>
            </div>
            ${filterBannerHtml}
            <div class="visual-bldg-cards-grid">
                ${cardsHtml || '<div style="padding:20px; text-align:center; color:#cbd5e1;">لا توجد منشآت في هذا الفلتر حالياً.</div>'}
            </div>
        `;

        // ربط الأحداث
        container.querySelectorAll('.cap-stage-pill-btn').forEach(btn => {
            btn.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                const st = btn.getAttribute('data-stagetab');
                currentBuildStageTab = st === 'clean_energy' ? 'clean_energy' : Number(st);
                if (currentBuildCategory === 'recommended') currentBuildCategory = 'all';
                filterBySectorId = null;
                renderVisualBuildDrawer();
            };
        });

        container.querySelectorAll('.cap-cat-pill-btn').forEach(btn => {
            btn.onclick = () => {
                if (window.GameSFX) window.GameSFX.playClick();
                currentBuildCategory = btn.getAttribute('data-catid');
                filterBySectorId = null;
                renderVisualBuildDrawer();
            };
        });

        const btnClearFilter = document.getElementById('btn-clear-sector-filter');
        if (btnClearFilter) {
            btnClearFilter.onclick = () => {
                filterBySectorId = null;
                renderVisualBuildDrawer();
            };
        }

        const btnUpgStage = document.getElementById('btn-drawer-upgrade-stage');
        if (btnUpgStage) {
            btnUpgStage.onclick = () => {
                const res = window.BuildingsEngine.upgradeToStage(currentCountry, countryStage + 1, window.currentWorld);
                if (window.showGameToast) window.showGameToast(res.msg, res.success ? "🎉" : "⚠️");
                if (res.success) {
                    currentBuildStageTab = Number(currentCountry.stage) || 1;
                    refreshHUDAndMap();
                    renderVisualBuildDrawer();
                    if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(currentCountry);
                }
            };
        }

        container.querySelectorAll('.btn-v-buy').forEach(btn => {
            btn.onclick = () => {
                executeCapitalBuild(btn.getAttribute('data-id'));
            };
        });

        container.querySelectorAll('.btn-v-demolish').forEach(btn => {
            btn.onclick = () => {
                executeCapitalDemolish(btn.getAttribute('data-id'));
            };
        });
    }

    // ب. درج القطاعات الـ 16 البصري (مع ميزة الضغط على أي قطاع خاسر لبناء المنشأة التي تغذيه فوراً)
    function renderVisualSectorsDrawer() {
        const container = document.getElementById('cap-sectors-drawer-content');
        if (!container || !currentCountry) return;

        const isOwner = isCountryOwner(currentCountry);
        const sectorsList = Object.entries(SECTOR_META).map(([id, meta]) => {
            const val = Number(currentCountry.sectors?.[id] || 0);
            return { id, name: meta.name, icon: meta.icon, val };
        });

        sectorsList.sort((a, b) => a.val - b.val);

        const cardsHtml = sectorsList.map(item => {
            let statusCls = 'sec-neutral';
            let statusIcon = '🟡';
            if (item.val < 0) {
                statusCls = 'sec-deficit';
                statusIcon = '🔴';
            } else if (item.val > 0) {
                statusCls = 'sec-surplus';
                statusIcon = '🟢';
            }
            const pct = clamp(((item.val + 25) / 50) * 100, 8, 100);

            return `
                <div class="cap-visual-sector-card ${statusCls}" data-sector="${item.id}" title="اضغط لعرض المباني التي تغذي قطاع ${item.name}">
                    <div class="sec-card-top">
                        <span class="sec-ico">${item.icon}</span>
                        <span class="sec-name">${item.name}</span>
                        <span class="sec-val">${item.val > 0 ? '+' + item.val : item.val}</span>
                    </div>
                    <div class="sec-bar-track">
                        <div class="sec-bar-fill" style="width:${pct}%;"></div>
                    </div>
                    <div class="sec-card-foot">
                        <span>${statusIcon} ${item.val < 0 ? 'يحتاج دعم' : (item.val > 0 ? 'فائض ممتاز' : 'متوازن')}</span>
                        ${isOwner ? '<span class="sec-fix-link">🏗️ ابْنِ الآن ➔</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="font-size:0.82rem; color:#fde68a; margin-bottom:8px; font-weight:800;">
                💡 اضغط على أي قطاع باللون الأحمر 🔴 لفتح المباني التي ترفعه مباشرةً!
            </div>
            <div class="cap-visual-sectors-grid">
                ${cardsHtml}
            </div>
        `;

        if (isOwner) {
            container.querySelectorAll('.cap-visual-sector-card').forEach(card => {
                card.onclick = () => {
                    if (window.GameSFX) window.GameSFX.playClick();
                    filterBySectorId = card.getAttribute('data-sector');
                    openDrawer('cap-drawer-build');
                };
            });
        }
    }

    // ج. درج الخزينة والبنك والطاقة البصري
    function renderVisualEconomyDrawer() {
        const container = document.getElementById('cap-economy-drawer-content');
        if (!container || !currentCountry) return;

        const isOwner = isCountryOwner(currentCountry);
        const b = currentCountry.buildings || {};
        const e = currentCountry.energy || {};
        const bankVal = Number(currentCountry.bank !== undefined ? currentCountry.bank : (currentCountry.bankBalance || 0));
        const wbVal = Math.max(0, Number(currentCountry.worldBankFund !== undefined ? currentCountry.worldBankFund : (currentCountry.worldBankDeposit || 0)));

        const oilWells = Number(b.oil_well || 0) + Number(b.oil_field || 0);
        const fuelStations = Number(b.fuel_station || 0);
        const gasWells = Number(b.gas_well || 0);
        const gasShops = Number(b.gas_station_shop || 0);

        container.innerHTML = `
            <div class="cap-econ-visual-layout">
                <div class="cap-econ-panel">
                    <h4>🏦 الخزينة والبنك المركزي</h4>
                    <div class="cap-econ-Vaults-grid">
                        <div class="cap-vault-box">
                            <span class="v-ico">💵</span>
                            <small>السيولة الجاهزة</small>
                            <strong class="text-emerald">$${Number(currentCountry.disposableRevenue || 0).toLocaleString()}</strong>
                        </div>
                        <div class="cap-vault-box">
                            <span class="v-ico">📈</span>
                            <small>العائد السنوي</small>
                            <strong class="text-gold">$${Number(currentCountry.budget || 0).toLocaleString()}</strong>
                        </div>
                        <div class="cap-vault-box">
                            <span class="v-ico">🏦</span>
                            <small>البنك الوطني</small>
                            <strong class="text-cyan">$${bankVal.toLocaleString()}</strong>
                        </div>
                        <div class="cap-vault-box">
                            <span class="v-ico">🌐</span>
                            <small>مدخرات البنك الدولي</small>
                            <strong class="text-purple">$${wbVal.toLocaleString()}</strong>
                        </div>
                    </div>
                    ${isOwner ? `
                        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                            <button type="button" id="btn-cap-withdraw-all" class="btn btn-primary btn-sm" ${bankVal <= 0 ? 'disabled' : ''}>💰 سحب رصيد البنك ($${bankVal.toLocaleString()})</button>
                            <button type="button" id="btn-cap-wb-emergency" class="btn btn-danger btn-sm" ${wbVal <= 0 ? 'disabled' : ''}>🚨 سحب طوارئ الدولي</button>
                            <button type="button" id="btn-cap-donate-open" class="btn btn-accent btn-sm">🎁 إرسال منحة لدولة</button>
                        </div>
                    ` : ''}
                </div>

                <div class="cap-econ-panel">
                    <h4>🛢️ محطات الطاقة والوقود</h4>
                    <div class="cap-econ-Vaults-grid">
                        <div class="cap-vault-box">
                            <span class="v-ico">🛢️</span>
                            <small>آبار وحقول النفط (${oilWells})</small>
                            <strong class="text-gold">${Number(e.oilStock || 0).toLocaleString()} برميل</strong>
                        </div>
                        <div class="cap-vault-box">
                            <span class="v-ico">⛽</span>
                            <small>محطات الوقود (${fuelStations})</small>
                            <strong class="text-orange">${Number(e.fuelAmount || 0).toLocaleString()} لتر</strong>
                        </div>
                        <div class="cap-vault-box">
                            <span class="v-ico">🔥</span>
                            <small>آبار الغاز (${gasWells})</small>
                            <strong class="text-cyan">${Number(e.gasStock || 0).toLocaleString()} م³</strong>
                        </div>
                        <div class="cap-vault-box">
                            <span class="v-ico">🧪</span>
                            <small>محلات الغاز (${gasShops})</small>
                            <strong class="text-emerald">${Number(e.gasCylinders || 0).toLocaleString()} أسطوانة</strong>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <button type="button" id="btn-cap-go-worldbank" class="btn btn-secondary btn-sm" style="flex:1;">🏦 البنك الدولي</button>
                        <button type="button" id="btn-cap-go-trade" class="btn btn-secondary btn-sm" style="flex:1;">🚢 القوافل والتجارة</button>
                        <button type="button" id="btn-cap-go-exchange" class="btn btn-secondary btn-sm" style="flex:1;">💎 البورصة العالمية</button>
                    </div>
                </div>
            </div>
        `;

        const btnWAll = document.getElementById('btn-cap-withdraw-all');
        if (btnWAll) {
            btnWAll.onclick = () => {
                if (bankVal <= 0) return;
                currentCountry.disposableRevenue = Number(currentCountry.disposableRevenue || 0) + bankVal;
                currentCountry.bank = 0;
                currentCountry.bankBalance = 0;
                refreshHUDAndMap();
                renderVisualEconomyDrawer();
                if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(currentCountry);
                if (window.showGameToast) window.showGameToast(`تم سحب $${bankVal.toLocaleString()} إلى السيولة المتاحة!`, "💰");
            };
        }

        const btnWbEmerg = document.getElementById('btn-cap-wb-emergency');
        if (btnWbEmerg) {
            btnWbEmerg.onclick = () => {
                if (wbVal <= 0) return;
                if (window.EconomyEngine && typeof window.EconomyEngine.emergencyWithdrawFromWorldBank === 'function') {
                    const r = window.EconomyEngine.emergencyWithdrawFromWorldBank(currentCountry, wbVal);
                    if (window.showGameToast) window.showGameToast(r.msg, r.success ? "🚨" : "⚠️");
                } else {
                    currentCountry.worldBankFund = 0;
                    currentCountry.disposableRevenue = Number(currentCountry.disposableRevenue || 0) + wbVal;
                    if (window.showGameToast) window.showGameToast(`تم سحب $${wbVal.toLocaleString()} من مدخرات البنك الدولي!`, "🚨");
                }
                refreshHUDAndMap();
                renderVisualEconomyDrawer();
                if (window.NetworkEngine) window.NetworkEngine.syncCountryChanges(currentCountry);
            };
        }

        const btnDonate = document.getElementById('btn-cap-donate-open');
        if (btnDonate) {
            btnDonate.onclick = () => {
                closeAllDrawers();
                if (window.CountryViewController && typeof window.CountryViewController.openDonationModal === 'function') {
                    window.CountryViewController.openDonationModal();
                }
            };
        }

        const btnGoWB = document.getElementById('btn-cap-go-worldbank');
        if (btnGoWB) btnGoWB.onclick = () => openWorldScreen('worldbank');

        const btnGoTrade = document.getElementById('btn-cap-go-trade');
        if (btnGoTrade) btnGoTrade.onclick = () => openWorldScreen('trade');

        const btnGoEx = document.getElementById('btn-cap-go-exchange');
        if (btnGoEx) btnGoEx.onclick = () => openWorldScreen('exchange');
    }

    function togglePitchPreset() {
        if (camera.targetPitch > 0.78) {
            camera.targetPitch = 0.46;
        } else if (camera.targetPitch < 0.55) {
            camera.targetPitch = 0.62;
        } else {
            camera.targetPitch = 0.88;
        }
    }

    function cycleTimeOfDay() {
        timeModeIndex = (timeModeIndex + 1) % TIME_MODES.length;
        const mode = TIME_MODES[timeModeIndex];
        const btn = document.getElementById('cap-time-toggle');
        const icons = { day: '☀️', sunset: '🌅', night: '🌙', auto: '⏱️' };
        if (btn) btn.textContent = icons[mode] || '☀️';
    }

    function expandGrid(ringsToAdd = 1) {
        extraExpansionRings = clamp(extraExpansionRings + ringsToAdd, 0, 10);
        if (currentCountry) {
            generateExpandableHexWorld(currentCountry);
            updateHUD(currentCountry);
            if (window.showGameToast) {
                window.showGameToast(`تم توسيع العاصمة إلى ${hexMesh.length} خلية سداسية!`, '🗺️');
            }
        }
    }

    function isTouchInsideOverlayUI(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return !!target.closest('.cap-bottom-drawer, .cap-inspector-card, .cap-bottom-dock, .capital-floating-controls, #btn-restore-cap-topbar');
    }

    function attachInputs() {
        const wrapper = document.getElementById('capital-canvas-wrapper');
        if (!wrapper) return;

        wrapper.addEventListener('contextmenu', e => e.preventDefault());

        wrapper.addEventListener('mousedown', e => {
            if (isTouchInsideOverlayUI(e.target) || e.target !== canvas) return;
            camera.isDragging = true;
            pointerDownPos = { x: e.clientX, y: e.clientY };
            pointerMovedDist = 0;

            if (e.button === 2 || e.button === 1 || e.shiftKey) {
                camera.dragMode = 'orbit';
            } else {
                camera.dragMode = 'pan';
            }
            camera.lastMouseX = e.clientX;
            camera.lastMouseY = e.clientY;
        });

        window.addEventListener('mousemove', e => {
            const capScreen = document.getElementById('capital-screen');
            if (!capScreen || !capScreen.classList.contains('active')) return;

            if (camera.isDragging) {
                const dx = e.clientX - camera.lastMouseX;
                const dy = e.clientY - camera.lastMouseY;
                pointerMovedDist += Math.hypot(dx, dy);
                camera.lastMouseX = e.clientX;
                camera.lastMouseY = e.clientY;

                if (camera.dragMode === 'orbit') {
                    camera.targetYaw += dx * 0.0075;
                    camera.targetPitch = clamp(camera.targetPitch + dy * 0.0055, camera.minPitch, camera.maxPitch);
                } else {
                    camera.targetX += dx;
                    camera.targetY += dy;
                }
            } else if (e.target === canvas) {
                handleHover(e.clientX, e.clientY);
            }
        });

        window.addEventListener('mouseup', e => {
            if (camera.isDragging && pointerMovedDist < 9 && e.target === canvas) {
                handleHover(e.clientX, e.clientY);
                if (hoveredHex) {
                    handleHexTap(hoveredHex);
                } else {
                    closeInspectorPopup();
                }
            }
            camera.isDragging = false;
        });

        wrapper.addEventListener('wheel', e => {
            if (isTouchInsideOverlayUI(e.target)) return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.14 : -0.14;
            adjustZoom(delta, e.clientX, e.clientY);
        }, { passive: false });

        // دعم كامل للمس المتعدد والنقر على الهواتف دون تعطيل التمرير داخل الأدراج والقوائم
        wrapper.addEventListener('touchstart', e => {
            if (isTouchInsideOverlayUI(e.target) || e.target !== canvas) {
                camera.isDragging = false;
                return;
            }
            hideTooltip();
            if (e.touches.length === 1) {
                camera.isDragging = true;
                camera.dragMode = 'pan';
                pointerDownPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                pointerMovedDist = 0;
                camera.lastMouseX = e.touches[0].clientX;
                camera.lastMouseY = e.touches[0].clientY;
                handleHover(e.touches[0].clientX, e.touches[0].clientY, true);
            } else if (e.touches.length === 2) {
                camera.isDragging = true;
                camera.dragMode = 'pinch';
                pointerMovedDist = 99;
                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                camera.touchDist = Math.hypot(dx, dy);
                camera.touchAngle = Math.atan2(dy, dx);
            }
        }, { passive: true });

        wrapper.addEventListener('touchmove', e => {
            if (isTouchInsideOverlayUI(e.target) || !camera.isDragging) return;
            if (e.cancelable) e.preventDefault();

            if (e.touches.length === 1 && camera.dragMode === 'pan') {
                const dx = e.touches[0].clientX - camera.lastMouseX;
                const dy = e.touches[0].clientY - camera.lastMouseY;
                pointerMovedDist += Math.hypot(dx, dy);
                camera.targetX += dx * 1.1;
                camera.targetY += dy * 1.1;
                camera.lastMouseX = e.touches[0].clientX;
                camera.lastMouseY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                const dx = e.touches[1].clientX - e.touches[0].clientX;
                const dy = e.touches[1].clientY - e.touches[0].clientY;
                const dist = Math.hypot(dx, dy);
                const angle = Math.atan2(dy, dx);

                if (camera.touchDist > 10) {
                    const scaleDelta = (dist - camera.touchDist) * 0.006;
                    camera.targetZoom = clamp(camera.targetZoom + scaleDelta, camera.minZoom, camera.maxZoom);

                    let dAngle = angle - camera.touchAngle;
                    if (dAngle > Math.PI) dAngle -= Math.PI * 2;
                    if (dAngle < -Math.PI) dAngle += Math.PI * 2;
                    camera.targetYaw += dAngle * 0.7;
                }
                camera.touchDist = dist;
                camera.touchAngle = angle;
            }
        }, { passive: false });

        wrapper.addEventListener('touchend', e => {
            if (camera.isDragging && pointerMovedDist < 12 && e.target === canvas) {
                if (hoveredHex) {
                    handleHexTap(hoveredHex);
                } else {
                    closeInspectorPopup();
                }
            }
            camera.isDragging = false;
        });

        window.addEventListener('resize', resizeCanvas);
    }

    function adjustZoom(delta, mouseX, mouseY) {
        const prev = camera.targetZoom;
        camera.targetZoom = clamp(camera.targetZoom + delta, camera.minZoom, camera.maxZoom);
        if (mouseX !== undefined && mouseY !== undefined && canvas) {
            const rect = canvas.getBoundingClientRect();
            const mx = mouseX - rect.left - canvas.width * 0.5;
            const my = mouseY - rect.top - canvas.height * 0.5;
            const ratio = camera.targetZoom / prev - 1;
            camera.targetX -= mx * ratio;
            camera.targetY -= my * ratio;
        }
    }

    function resetCamera() {
        camera.targetX = 0;
        camera.targetY = 18;
        camera.targetZoom = 1.26;
        camera.targetYaw = -0.32;
        camera.targetPitch = 0.62;
    }

    function updateCameraPhysics() {
        const smooth = 0.18;
        camera.x = lerp(camera.x, camera.targetX, smooth);
        camera.y = lerp(camera.y, camera.targetY, smooth);
        camera.zoom = lerp(camera.zoom, camera.targetZoom, smooth);
        camera.yaw = lerp(camera.yaw, camera.targetYaw, smooth);
        camera.pitch = lerp(camera.pitch, camera.targetPitch, smooth);
    }

    function resizeCanvas() {
        if (!canvas || !canvas.parentElement) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = Math.max(300, rect.width);
        canvas.height = Math.max(240, rect.height);
    }

    function handleHover(clientX, clientY, isTouch = false) {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        let found = null;
        for (let i = hexMesh.length - 1; i >= 0; i--) {
            const h = hexMesh[i];
            if (h._topCorners2D && pointInPolygon2D(mx, my, h._topCorners2D)) {
                found = h;
                break;
            }
        }

        if (!found) {
            const worldPt = screenToWorldPlane(mx, my, 8);
            const ax = worldToAxial(worldPt.wx, worldPt.wy);
            found = hexMap.get(`${ax.q},${ax.r}`) || null;
        }

        hoveredHex = found;
        const tooltip = document.getElementById('capital-tooltip');
        if (!tooltip) return;

        const inspPopup = document.getElementById('cap-inspector-popup');
        const isInspOpen = inspPopup && inspPopup.classList.contains('active');

        if (isTouch || camera.isDragging || activeDrawerId || isInspOpen || !hoveredHex) {
            tooltip.style.display = 'none';
            return;
        }

        if (hoveredHex) {
            tooltip.style.display = 'block';
            const tx = Math.min(canvas.width - 220, mx + 14);
            const ty = Math.min(canvas.height - 90, my + 14);
            tooltip.style.left = `${Math.max(10, tx)}px`;
            tooltip.style.top = `${Math.max(10, ty)}px`;

            if (hoveredHex.isCitadel) {
                tooltip.innerHTML = `<div style="color:#fde047;">👑 القلعة السيادية (اضغط للخزينة والترقية)</div>`;
            } else if (hoveredHex.cluster && hoveredHex.cluster.count > 0) {
                const c = hoveredHex.cluster;
                tooltip.innerHTML = `
                    <div style="color:#fde047;">${c.icon} ${c.name} (×${c.totalOwned})</div>
                    <div style="font-size:0.75rem; color:#34d399;">👆 اضغط للبناء الإضافي أو الإدارة</div>
                `;
            } else if (hoveredHex.isLighthouse) {
                tooltip.innerHTML = `<div style="color:#fde047;">🚨 المنارة البحرية السيادية</div>`;
            } else {
                if (hoveredHex.type === 'water') {
                    tooltip.innerHTML = `<span style="color:#38bdf8;">🌊 مياه إقليمية (اضغط لبناء السفن 🚢)</span>`;
                } else if (hoveredHex.type === 'sand') {
                    tooltip.innerHTML = `<span style="color:#facc15;">🏖️ ساحل بحري (اضغط لبناء الموانئ والمنتجعات ⚓)</span>`;
                } else {
                    tooltip.innerHTML = `<span style="color:#4ade80;">🌱 أرض جاهزة للبناء (اضغط للتشييد 🏗️)</span>`;
                }
            }
        } else {
            tooltip.style.display = 'none';
        }
    }

    function computeHexTopCorners(hex, wzOverride) {
        const wz = wzOverride !== undefined ? wzOverride : hex.height;
        const corners = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i - 30);
            const vx = hex.wx + HEX_RADIUS * Math.cos(angle);
            const vy = hex.wy + HEX_RADIUS * Math.sin(angle);
            let vz = wz;

            if (hex.type === 'water') {
                vz += Math.sin(animClock * 2.1 + vx * 0.032 + vy * 0.032) * 1.5;
            }
            corners.push(project3D(vx, vy, vz));
        }
        return corners;
    }

    function drawLowPolyHexTile(hex) {
        const isHov = hex === hoveredHex;
        const isSel = hex === selectedHex;
        const baseDepthZ = -10;

        let wz = hex.height;
        if (hex.type === 'water') {
            wz = Math.sin(animClock * 1.8 + hex.q * 0.55 + hex.r * 0.65) * 1.4;
        }

        const topCorners = computeHexTopCorners(hex, wz);
        hex._topCorners2D = topCorners;

        const bottomCorners = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i - 30);
            const vx = hex.wx + HEX_RADIUS * Math.cos(angle);
            const vy = hex.wy + HEX_RADIUS * Math.sin(angle);
            bottomCorners.push(project3D(vx, vy, baseDepthZ));
        }

        let topBase = '#4d7c0f';
        let cliffColor = '#334155';

        if (hex.type === 'water') {
            const shimmer = Math.sin(animClock * 2.4 + hex.q * 0.7 - hex.r * 0.5) * 0.04;
            if (hex.subType === 'deep_water') {
                topBase = adjustColor('#0369a1', shimmer + (hex.hashVal - 0.5) * 0.06);
            } else if (hex.subType === 'mid_water') {
                topBase = adjustColor('#0284c7', shimmer + (hex.hashVal - 0.5) * 0.06);
            } else {
                topBase = adjustColor('#0ea5e9', shimmer + (hex.hashVal - 0.5) * 0.06);
            }
            cliffColor = '#0c4a6e';
        } else if (hex.type === 'sand') {
            topBase = mixColors('#eab308', '#d97706', hex.biomeVal);
            cliffColor = '#78350f';
        } else {
            if (hex.subType === 'mountain') {
                topBase = mixColors('#475569', '#3f6212', hex.biomeVal * 0.6);
            } else if (hex.subType === 'highland') {
                topBase = mixColors('#3f6212', '#15803d', hex.biomeVal);
            } else {
                topBase = mixColors('#4d7c0f', '#166534', hex.biomeVal);
            }
            if (hex.cluster && !hex.cluster.isMarine) {
                topBase = mixColors(topBase, '#475569', 0.34);
            } else if (hex.isCitadel) {
                topBase = '#475569';
            }
            cliffColor = '#443325';
        }

        for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            const t0 = topCorners[i];
            const t1 = topCorners[next];
            const b1 = bottomCorners[next];
            const b0 = bottomCorners[i];

            if ((t0.ry + t1.ry) * 0.5 > hex.wx * Math.sin(camera.yaw) + hex.wy * Math.cos(camera.yaw) - 4) {
                const edgeNormal = ((60 * i) * Math.PI / 180) + camera.yaw;
                const sideShade = Math.cos(edgeNormal - 0.8) * 0.16 - 0.12;
                fillPoly2D([t0, t1, b1, b0], shadeFacet(cliffColor, sideShade), 'rgba(0,0,0,0.2)', 0.6);
            }
        }

        const centerZ = hex.type === 'water' ?
            wz + Math.cos(animClock * 2.2 + hex.q - hex.r) * 1.1 :
            (hex.cluster || hex.isCitadel ? wz : wz + hex.centerBump);
        const centerPt = project3D(hex.wx, hex.wy, centerZ);

        for (let i = 0; i < 6; i++) {
            const next = (i + 1) % 6;
            const triShade = ((i % 3) - 1) * 0.045;
            let facetCol = shadeFacet(topBase, triShade);

            if (isHov) facetCol = mixColors(facetCol, '#38bdf8', 0.38);
            else if (isSel) facetCol = mixColors(facetCol, '#fde047', 0.35);

            fillPoly2D(
                [centerPt, topCorners[i], topCorners[next]],
                facetCol,
                hex.type === 'water' ? 'rgba(186, 230, 253, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                0.55
            );
        }

        if (hex.type === 'water') {
            for (let i = 0; i < 6; i++) {
                const nAngle = (Math.PI / 180) * (60 * i);
                const nwx = hex.wx + HEX_RADIUS * Math.sqrt(3) * Math.cos(nAngle);
                const nwy = hex.wy + HEX_RADIUS * Math.sqrt(3) * Math.sin(nAngle);
                const nAxial = worldToAxial(nwx, nwy);
                const nHex = hexMap.get(`${nAxial.q},${nAxial.r}`);
                if (nHex && nHex.type !== 'water') {
                    const next = (i + 1) % 6;
                    const foamPulse = (Math.sin(animClock * 3.2 + hex.q + i) + 1) * 0.5;
                    ctx.save();
                    ctx.strokeStyle = `rgba(240, 249, 255, ${0.38 + foamPulse * 0.45})`;
                    ctx.lineWidth = (1.6 + foamPulse * 1.9) * camera.zoom;
                    ctx.beginPath();
                    ctx.moveTo(topCorners[i].x, topCorners[i].y);
                    ctx.lineTo(topCorners[next].x, topCorners[next].y);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        if (isHov || isSel) {
            ctx.save();
            ctx.strokeStyle = isSel ? '#fde047' : '#38bdf8';
            ctx.lineWidth = 2.6 * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(topCorners[0].x, topCorners[0].y);
            for (let i = 1; i < 6; i++) ctx.lineTo(topCorners[i].x, topCorners[i].y);
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
    }

    function getRoadBezierPoints(fromHex, toHex) {
        const z1 = fromHex.height + 0.35;
        const z2 = toHex.height + 0.35;
        const mx = (fromHex.wx + toHex.wx) * 0.5;
        const my = (fromHex.wy + toHex.wy) * 0.5;
        const mz = Math.max(z1, z2) + 0.4;

        const dx = toHex.wx - fromHex.wx;
        const dy = toHex.wy - fromHex.wy;
        const curveSign = ((fromHex.q * 3 + toHex.r * 7) % 2 === 0 ? 1 : -1) * 0.14;
        const cx = mx - dy * curveSign;
        const cy = my + dx * curveSign;

        return {
            p0: { wx: fromHex.wx, wy: fromHex.wy, wz: z1 },
            p1: { wx: cx, wy: cy, wz: mz },
            p2: { wx: toHex.wx, wy: toHex.wy, wz: z2 }
        };
    }

    function evalQuadratic3D(bz, t) {
        const inv = 1 - t;
        return {
            wx: inv * inv * bz.p0.wx + 2 * inv * t * bz.p1.wx + t * t * bz.p2.wx,
            wy: inv * inv * bz.p0.wy + 2 * inv * t * bz.p1.wy + t * t * bz.p2.wy,
            wz: inv * inv * bz.p0.wz + 2 * inv * t * bz.p1.wz + t * t * bz.p2.wz
        };
    }

    function renderArterialRoadsAndTraffic() {
        if (!roadEdges || roadEdges.length === 0) return;
        const light = getLightingState();

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        roadEdges.forEach(edge => {
            const bz = getRoadBezierPoints(edge.from, edge.to);
            const s0 = project3D(bz.p0.wx, bz.p0.wy, bz.p0.wz);
            const s1 = project3D(bz.p1.wx, bz.p1.wy, bz.p1.wz);
            const s2 = project3D(bz.p2.wx, bz.p2.wy, bz.p2.wz);

            ctx.strokeStyle = shadeFacet('#1e293b', -0.1);
            ctx.lineWidth = (edge.isMain ? 8.2 : 6.4) * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(s0.x, s0.y);
            ctx.quadraticCurveTo(s1.x, s1.y, s2.x, s2.y);
            ctx.stroke();

            ctx.strokeStyle = shadeFacet('#334155', 0);
            ctx.lineWidth = (edge.isMain ? 5.6 : 4.2) * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(s0.x, s0.y);
            ctx.quadraticCurveTo(s1.x, s1.y, s2.x, s2.y);
            ctx.stroke();

            ctx.strokeStyle = light.isNight ? 'rgba(253, 224, 71, 0.55)' : 'rgba(248, 250, 252, 0.35)';
            ctx.lineWidth = 1.0 * camera.zoom;
            ctx.setLineDash([3 * camera.zoom, 4 * camera.zoom]);
            ctx.beginPath();
            ctx.moveTo(s0.x, s0.y);
            ctx.quadraticCurveTo(s1.x, s1.y, s2.x, s2.y);
            ctx.stroke();
            ctx.setLineDash([]);
        });

        roadVehicles.forEach(v => {
            v.t += v.speed * v.dir;
            if (v.t > 1) {
                v.t = 1;
                v.dir = -1;
            } else if (v.t < 0) {
                v.t = 0;
                v.dir = 1;
            }

            const bz = getRoadBezierPoints(v.edge.from, v.edge.to);
            const pos = evalQuadratic3D(bz, v.t);
            const nextPos = evalQuadratic3D(bz, clamp(v.t + 0.04 * v.dir, 0, 1));
            const angle = Math.atan2(nextPos.wy - pos.wy, nextPos.wx - pos.wx);

            const laneOffset = 1.6 * v.dir;
            const vx = pos.wx - Math.sin(angle) * laneOffset;
            const vy = pos.wy + Math.cos(angle) * laneOffset;

            if (v.type === 'truck') {
                drawBox3D(vx, vy, pos.wz, 4.6, 2.2, 2.4, angle, '#e2e8f0', '#94a3b8', { shadow: false });
                drawBox3D(vx + Math.cos(angle) * 1.8, vy + Math.sin(angle) * 1.8, pos.wz, 2.0, 2.1, 2.0, angle, v.color, v.color, { shadow: false });
            } else if (v.type === 'bus') {
                drawBox3D(vx, vy, pos.wz, 5.2, 2.2, 2.3, angle, '#fbbf24', '#fef08a', { shadow: false });
            } else {
                drawBox3D(vx, vy, pos.wz, 3.4, 1.8, 1.5, angle, v.color, adjustColor(v.color, 0.2), { shadow: false });
            }
        });

        ctx.restore();
    }

    function renderRailwayAndTrains() {
        if (!railPath || railPath.length < 3) return;

        ctx.save();
        const pts2D = railPath.map(h => project3D(h.wx, h.wy, h.height + 0.5));
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4.2 * camera.zoom;
        ctx.beginPath();
        ctx.moveTo(pts2D[0].x, pts2D[0].y);
        for (let i = 1; i < pts2D.length; i++) ctx.lineTo(pts2D[i].x, pts2D[i].y);
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.8 * camera.zoom;
        ctx.setLineDash([2.5 * camera.zoom, 3.5 * camera.zoom]);
        ctx.beginPath();
        ctx.moveTo(pts2D[0].x, pts2D[0].y);
        for (let i = 1; i < pts2D.length; i++) ctx.lineTo(pts2D[i].x, pts2D[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        const n = railPath.length;
        railTrains.forEach(train => {
            train.progress = (train.progress + train.speed) % n;

            for (let c = 0; c <= train.carriages; c++) {
                const idxFloat = (train.progress - c * 0.22 + n * 10) % n;
                const i0 = Math.floor(idxFloat);
                const i1 = (i0 + 1) % n;
                const frac = idxFloat - i0;

                const h0 = railPath[i0];
                const h1 = railPath[i1];
                const wx = lerp(h0.wx, h1.wx, frac);
                const wy = lerp(h0.wy, h1.wy, frac);
                const wz = lerp(h0.height, h1.height, frac) + 0.6;
                const angle = Math.atan2(h1.wy - h0.wy, h1.wx - h0.wx);

                const isEngine = c === 0;
                const col = isEngine ? (train.isBullet ? '#38bdf8' : '#ef4444') : train.color;
                drawBox3D(wx, wy, wz, isEngine ? 7.2 : 6.2, 2.8, 3.2, angle, col, '#f8fafc', {
                    windows: true,
                    windowRows: 1,
                    windowCols: 3
                });
            }
        });
    }

    function drawSovereignCitadel3D(hex, sovColor) {
        const { wx, wy, height: wz } = hex;

        drawPrism3D(wx, wy, wz, 29, 27, 5, 8, '#475569', '#64748b', 0);

        const towerOffsets = [
            { dx: -15, dy: -15 },
            { dx: 15, dy: -15 },
            { dx: 15, dy: 15 },
            { dx: -15, dy: 15 }
        ];

        drawBox3D(wx, wy, wz + 5, 28, 28, 10, 0, '#64748b', '#94a3b8', { windows: true, windowRows: 1, windowCols: 4 });

        towerOffsets.forEach(t => {
            drawPrism3D(wx + t.dx, wy + t.dy, wz + 5, 5.5, 5.0, 18, 8, '#94a3b8', sovColor, 9);
        });

        drawBox3D(wx, wy, wz + 15, 16, 16, 18, 0, '#e2e8f0', sovColor, {
            roofType: 'pyramid',
            roofHeight: 11,
            windows: true,
            windowRows: 3,
            windowCols: 3
        });

        const poleBase = project3D(wx, wy, wz + 42);
        const poleTop = project3D(wx, wy, wz + 66);

        ctx.save();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = Math.max(2, 2.6 * camera.zoom);
        ctx.beginPath();
        ctx.moveTo(poleBase.x, poleBase.y);
        ctx.lineTo(poleTop.x, poleTop.y);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(poleTop.x, poleTop.y, 3 * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        drawSovereignWavingFlag(poleTop.x, poleTop.y, 28 * camera.zoom, 18 * camera.zoom);
    }

    function drawSovereignWavingFlag(x, y, width, height) {
        const rows = 3;
        const cols = 4;
        const cellW = width / cols;
        const cellH = height / rows;
        const flagMatrix = currentCountry ? currentCountry.flag : null;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const wave = Math.sin(animClock * 4.0 + c * 0.85 + r * 0.35) * (2.5 * camera.zoom);
                const drawX = x + c * cellW;
                const drawY = y + r * cellH + wave;

                let color = '#e11d48';
                if (Array.isArray(flagMatrix) && flagMatrix.length === 12) {
                    color = flagMatrix[r * cols + c] || '#e11d48';
                } else if (Array.isArray(flagMatrix) && Array.isArray(flagMatrix[r]) && flagMatrix[r][c]) {
                    color = flagMatrix[r][c];
                }

                ctx.fillStyle = color;
                ctx.fillRect(drawX, drawY, cellW + 0.8, cellH + 0.8);

                const shade = (Math.cos(animClock * 4.0 + c * 0.85) + 1) * 0.14;
                ctx.fillStyle = `rgba(0, 0, 0, ${shade})`;
                ctx.fillRect(drawX, drawY, cellW + 0.8, cellH + 0.8);
            }
        }
    }

    function drawDistrictCluster3D(hex, sovColor) {
        const cluster = hex.cluster;
        if (!cluster) return;

        const count = cluster.count;
        const R = HEX_RADIUS * 0.46;

        const localOffsets = count === 1 ? [{ dx: 0, dy: 0 }] :
            count === 2 ? [{ dx: -R * 0.55, dy: -R * 0.2 }, { dx: R * 0.55, dy: R * 0.25 }] : [
                { dx: 0, dy: -R * 0.15 },
                { dx: -R * 0.68, dy: R * 0.35 },
                { dx: R * 0.68, dy: R * 0.35 },
                { dx: -R * 0.52, dy: -R * 0.62 },
                { dx: R * 0.52, dy: -R * 0.62 }
            ].slice(0, count);

        const items = localOffsets.map((off, idx) => {
            const wx = hex.wx + off.dx;
            const wy = hex.wy + off.dy;
            const proj = project3D(wx, wy, hex.height);
            return { wx, wy, wz: hex.height, idx, depth: proj.depth };
        });

        items.sort((a, b) => a.depth - b.depth);

        items.forEach(item => {
            renderBuilding3DModel(item.wx, item.wy, item.wz, cluster.id, sovColor, hex, item.idx);
        });
    }

    // رسم الأيقونات والشارات العائمة فوق المباني ثلاثية الأبعاد لتسهيل اللعب البصري
    function drawFloatingBuildingBadges() {
        if (!showBuildingBadges || camera.zoom < 0.62) return;

        ctx.save();
        hexMesh.forEach(hex => {
            if (!hex.isCitadel && !hex.cluster) return;

            const isSel = hex === selectedHex || hex === hoveredHex;
            const floatOffset = Math.sin(animClock * 2.5 + hex.q + hex.r) * 2.2;
            const zHeight = hex.isCitadel ? hex.height + 52 : (hex.cluster.isMarine ? 14 : hex.height + 24);
            const pt = project3D(hex.wx, hex.wy, zHeight);

            const label = hex.isCitadel ? '👑 القلعة' : `${hex.cluster.icon} ×${hex.cluster.count}`;
            ctx.font = `900 ${Math.round(clamp(11 * camera.zoom, 10, 15))}px Cairo, sans-serif`;
            const textWidth = ctx.measureText(label).width;
            const padX = 8 * camera.zoom;
            const boxW = textWidth + padX * 2;
            const boxH = 20 * clamp(camera.zoom, 0.85, 1.25);
            const bx = pt.x - boxW * 0.5;
            const by = pt.y - boxH * 0.5 + floatOffset;

            ctx.fillStyle = isSel ? 'rgba(251, 191, 36, 0.96)' : 'rgba(17, 12, 32, 0.84)';
            ctx.strokeStyle = isSel ? '#ffffff' : '#fbbf24';
            ctx.lineWidth = isSel ? 2.2 : 1.4;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(bx, by, boxW, boxH, 999);
            } else {
                ctx.rect(bx, by, boxW, boxH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = isSel ? '#1e1b4b' : '#fffbeb';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, pt.x, by + boxH * 0.52);
        });
        ctx.restore();
    }

    function spawnSmoke(wx, wy, wz, color = 'rgba(226, 232, 240, 0.55)', size = 3.2) {
        if (smokeParticles.length > 160 || Math.random() > 0.18) return;
        smokeParticles.push({
            wx: wx + (Math.random() - 0.5) * 2,
            wy: wy + (Math.random() - 0.5) * 2,
            wz,
            vx: 0.08 + Math.random() * 0.06,
            vy: -0.04,
            vz: 0.22 + Math.random() * 0.12,
            radius: size,
            alpha: 0.65,
            color
        });
    }

    // =========================================================================
    // تجسيد كافة المنشآت الـ 72 بالكامل
    // =========================================================================
    function renderBuilding3DModel(wx, wy, wz, id, sovColor, hex, subIdx = 0) {
        const localRot = ((hex.q * 3 + hex.r * 5 + subIdx) % 4) * (Math.PI * 0.5);

        switch (id) {
            case 'house':
                {
                    drawBox3D(wx, wy, wz, 10.0, 8.5, 6.8, localRot, '#fef3c7', sovColor, {
                        roofType: 'gabled',
                        roofHeight: 4.8,
                        windows: true,
                        windowRows: 1,
                        windowCols: 2
                    });
                    break;
                }

            case 'house_large':
                {
                    drawBox3D(wx, wy, wz, 12.0, 10.0, 10.5, localRot, '#e2e8f0', sovColor, {
                        roofType: 'gabled',
                        roofHeight: 5.5,
                        windows: true,
                        windowRows: 2,
                        windowCols: 2
                    });
                    break;
                }

            case 'palace':
                {
                    drawBox3D(wx, wy, wz, 15.5, 12.5, 9.5, localRot, '#fef9c3', '#d97706', {
                        windows: true,
                        windowRows: 2,
                        windowCols: 3
                    });
                    drawPrism3D(wx, wy, wz + 9.5, 5.5, 0.5, 7.0, 8, '#fbbf24', '#fde047', 3.2);
                    break;
                }

            case 'apartments':
                {
                    const h = 19 + (subIdx % 2) * 4;
                    drawBox3D(wx, wy, wz, 11.0, 11.0, h, localRot, '#cbd5e1', '#475569', {
                        windows: true,
                        windowRows: 4,
                        windowCols: 2
                    });
                    drawBox3D(wx, wy, wz + h, 5, 5, 2.5, localRot, '#64748b', sovColor, { shadow: false });
                    break;
                }

            case 'hotel':
                {
                    drawBox3D(wx, wy, wz, 13.5, 10.5, 24, localRot, '#f8fafc', sovColor, {
                        windows: true,
                        windowRows: 5,
                        windowCols: 3,
                        windowColor: '#38bdf8'
                    });
                    drawBox3D(wx + 6, wy + 5, wz, 6.5, 4.5, 0.7, 0, '#0284c7', '#38bdf8', { shadow: false });
                    break;
                }

            case 'residential_towers':
                {
                    const h = 32 + (subIdx % 3) * 5;
                    drawBox3D(wx, wy, wz, 11.5, 11.5, h, localRot, '#334155', '#0ea5e9', {
                        windows: true,
                        windowRows: 6,
                        windowCols: 3,
                        windowColor: '#7dd3fc'
                    });
                    drawPrism3D(wx, wy, wz + h, 4.8, 2.0, 4.8, 6, sovColor, '#fde047', 0);
                    break;
                }

            case 'skyscrapers':
                {
                    drawBox3D(wx, wy, wz, 15.5, 15.5, 25, 0, '#1e293b', '#38bdf8', {
                        windows: true,
                        windowRows: 5,
                        windowCols: 4,
                        windowColor: '#38bdf8'
                    });
                    drawBox3D(wx, wy, wz + 25, 11.5, 11.5, 19, Math.PI / 4, '#0f172a', '#38bdf8', {
                        windows: true,
                        windowRows: 4,
                        windowCols: 3,
                        windowColor: '#7dd3fc',
                        shadow: false
                    });
                    drawPrism3D(wx, wy, wz + 44, 5.0, 0.8, 12, 6, '#38bdf8', sovColor, 10);

                    const beaconPt = project3D(wx, wy, wz + 66);
                    const pulse = (Math.sin(animClock * 5 + subIdx) + 1) * 0.5;
                    ctx.fillStyle = `rgba(244, 63, 94, ${0.4 + pulse * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(beaconPt.x, beaconPt.y, (2.2 + pulse * 1.8) * camera.zoom, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }

            case 'municipality':
                {
                    drawBox3D(wx, wy, wz, 15.5, 11.5, 10.5, 0, '#f1f5f9', '#64748b', {
                        windows: true,
                        windowRows: 2,
                        windowCols: 4
                    });
                    drawPrism3D(wx, wy, wz + 10.5, 5.2, 2.0, 6.2, 8, sovColor, '#fde047', 4);
                    break;
                }

            case 'governorate':
                {
                    drawBox3D(wx, wy, wz, 22.5, 16.5, 12.5, 0, '#f8fafc', '#cbd5e1', {
                        windows: true,
                        windowRows: 3,
                        windowCols: 5
                    });
                    drawPrism3D(wx, wy, wz + 12.5, 7.8, 2.5, 9.5, 10, '#fbbf24', '#fef08a', 6);
                    break;
                }

            case 'police_station':
            case 'police_headquarters':
                {
                    const isHQ = id === 'police_headquarters';
                    const h = isHQ ? 16.5 : 10.0;
                    drawBox3D(wx, wy, wz, isHQ ? 15.5 : 11.5, isHQ ? 13.5 : 9.5, h, localRot, '#1e3a8a', '#3b82f6', {
                        windows: true,
                        windowRows: isHQ ? 3 : 2,
                        windowCols: 3
                    });
                    const sirenPt = project3D(wx, wy, wz + h + 2);
                    ctx.fillStyle = Math.floor(animClock * 4) % 2 === 0 ? '#38bdf8' : '#f43f5e';
                    ctx.beginPath();
                    ctx.arc(sirenPt.x, sirenPt.y, 2.4 * camera.zoom, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }

            case 'fire_station':
                {
                    drawBox3D(wx, wy, wz, 12.5, 10.0, 9.5, localRot, '#dc2626', '#f8fafc', {
                        windows: true,
                        windowRows: 2,
                        windowCols: 2
                    });
                    drawBox3D(wx + 4, wy - 3, wz + 9.5, 3.8, 3.8, 7.2, 0, '#b91c1c', '#fde047', { shadow: false });
                    break;
                }

            case 'shop':
            case 'shop_large':
                {
                    const isLarge = id === 'shop_large';
                    drawBox3D(wx, wy, wz, isLarge ? 12.5 : 9.5, isLarge ? 10.5 : 8.5, isLarge ? 11.0 : 7.5, localRot, '#fffbeb', '#f59e0b', {
                        windows: true,
                        windowRows: isLarge ? 2 : 1,
                        windowCols: 2
                    });
                    break;
                }

            case 'showroom':
            case 'markets':
            case 'mall':
                {
                    const w = id === 'mall' ? 19.5 : 14.5;
                    const h = id === 'mall' ? 13.5 : 10.0;
                    drawBox3D(wx, wy, wz, w, w * 0.8, h, localRot, '#f8fafc', '#0284c7', {
                        windows: true,
                        windowRows: 2,
                        windowCols: 4,
                        windowColor: '#38bdf8'
                    });
                    drawPrism3D(wx, wy, wz + h, w * 0.28, 1.5, 4.8, 8, '#38bdf8', '#bae6fd', 2);
                    break;
                }

            case 'park':
                {
                    drawPrism3D(wx, wy, wz, 7.0, 7.0, 2.2, 8, '#cbd5e1', '#38bdf8', 0);
                    const jetH = 3.8 + Math.sin(animClock * 4 + subIdx) * 1.2;
                    drawPrism3D(wx, wy, wz + 2.2, 1.8, 0.4, jetH, 6, '#7dd3fc', '#e0f2fe', 0);
                    drawLowPolyTree3D(wx - 8, wy - 6, wz, 'oak', 0.95);
                    drawLowPolyTree3D(wx + 8, wy + 5, wz, 'pine', 1.0);
                    break;
                }

            case 'theme_park':
                {
                    drawPrism3D(wx - 7, wy + 5, wz, 6.5, 6.5, 5.5, 8, '#f43f5e', '#fde047', 5);
                    drawFerrisWheel3D(wx + 4, wy - 2, wz, sovColor);
                    break;
                }

            case 'resort':
                {
                    drawBox3D(wx - 4, wy - 3, wz, 9.5, 7.5, 6.8, localRot, '#fffbeb', '#0ea5e9', {
                        roofType: 'pyramid',
                        roofHeight: 4.2,
                        windows: true
                    });
                    drawBox3D(wx + 5, wy + 4, wz, 8.5, 5.2, 0.8, 0, '#06b6d4', '#67e8f9', { shadow: false });
                    drawLowPolyTree3D(wx + 8, wy - 5, wz, 'palm', 1.05);
                    break;
                }

            case 'clinic':
            case 'dispensary':
            case 'hospital':
            case 'medical_city':
                {
                    const heights = { clinic: 8.5, dispensary: 12.5, hospital: 21, medical_city: 29 };
                    const widths = { clinic: 10.5, dispensary: 13.5, hospital: 15.5, medical_city: 20.5 };
                    const h = heights[id] || 12;
                    const w = widths[id] || 12;

                    drawBox3D(wx, wy, wz, w, w * 0.82, h, 0, '#f8fafc', '#e2e8f0', {
                        windows: true,
                        windowRows: Math.max(1, Math.floor(h / 5)),
                        windowCols: 3,
                        windowColor: '#38bdf8'
                    });

                    drawBox3D(wx, wy, wz + h, 4.8, 1.6, 1.8, 0, '#ef4444', '#f87171', { shadow: false });
                    drawBox3D(wx, wy, wz + h, 1.6, 4.8, 1.8, 0, '#ef4444', '#f87171', { shadow: false });
                    break;
                }

            case 'classroom':
            case 'school':
            case 'educational_complex':
            case 'university':
                {
                    const isUni = id === 'university' || id === 'educational_complex';
                    const h = isUni ? 14.5 : 9.5;
                    const w = isUni ? 17.5 : 12.0;
                    drawBox3D(wx, wy, wz, w, w * 0.75, h, localRot, '#fef3c7', sovColor, {
                        roofType: isUni ? 'flat' : 'gabled',
                        roofHeight: 4.8,
                        windows: true,
                        windowRows: isUni ? 3 : 2,
                        windowCols: 3
                    });
                    if (isUni) {
                        drawPrism3D(wx, wy, wz + h, 5.8, 2.0, 6.8, 8, sovColor, '#fbbf24', 4.2);
                    }
                    break;
                }

            case 'farm':
            case 'production_farm':
            case 'poultry_farm':
            case 'poultry_complex':
            case 'livestock_farm':
            case 'livestock_complex':
                {
                    const isComplex = id.includes('complex') || id === 'production_farm';
                    drawBox3D(wx + 3, wy + 3, wz, 13.5, 10.5, 0.8, 0, '#ca8a04', '#eab308', { shadow: false });
                    drawPrism3D(wx - 6, wy - 4, wz, 3.4, 3.4, isComplex ? 13.5 : 9.5, 8, '#cbd5e1', sovColor, 3.5);
                    drawBox3D(wx - 1, wy - 4, wz, isComplex ? 11.5 : 9.0, 7.5, isComplex ? 8.0 : 5.8, 0, '#9a3412', sovColor, {
                        roofType: 'gabled',
                        roofHeight: 3.8
                    });

                    if (id.includes('poultry') && Number((currentCountry && currentCountry.buildings && currentCountry.buildings.bird) || 0) > 0) {
                        for (let bIdx = 0; bIdx < 3; bIdx++) {
                            const bx = wx + 2 + Math.sin(animClock * 3 + bIdx * 2) * 3.5;
                            const by = wy + 2 + Math.cos(animClock * 2.5 + bIdx) * 2.5;
                            drawBox3D(bx, by, wz + 0.8, 1.4, 1.4, 1.4, 0, '#ffffff', '#ef4444', { shadow: false });
                        }
                    } else if (id.includes('livestock') && Number((currentCountry && currentCountry.buildings && currentCountry.buildings.animal) || 0) > 0) {
                        for (let aIdx = 0; aIdx < 3; aIdx++) {
                            const ax = wx + 2 + Math.cos(animClock * 1.4 + aIdx * 2) * 4.0;
                            const ay = wy + 2 + Math.sin(animClock * 1.2 + aIdx) * 3.0;
                            drawBox3D(ax, ay, wz + 0.8, 2.6, 1.6, 1.8, aIdx, '#451a03', '#78350f', { shadow: false });
                        }
                    }
                    break;
                }

            case 'water_well':
                {
                    drawPrism3D(wx, wy, wz, 5.0, 5.0, 3.8, 8, '#64748b', '#0284c7', 0);
                    drawBox3D(wx, wy, wz + 8.0, 8.5, 8.5, 1.0, 0, '#78350f', sovColor, {
                        roofType: 'pyramid',
                        roofHeight: 4.8,
                        shadow: false
                    });
                    break;
                }

            case 'water_pump':
            case 'water_desalination':
                {
                    const isDesal = id === 'water_desalination';
                    drawBox3D(wx - 4, wy, wz, isDesal ? 13.5 : 9.5, 8.5, 7.5, 0, '#e2e8f0', '#0284c7', { windows: true });
                    drawPrism3D(wx + 5, wy - 2, wz, 2.4, 2.4, 9.5, 6, '#94a3b8', '#94a3b8', 0);
                    drawPrism3D(wx + 5, wy - 2, wz + 9.5, 5.5, 5.5, 6.2, 10, '#0284c7', '#38bdf8', 2);
                    break;
                }

            case 'handicrafts':
            case 'workshop':
                {
                    const isWS = id === 'workshop';
                    drawBox3D(wx, wy, wz, isWS ? 12.5 : 10.0, 9.0, isWS ? 8.5 : 6.5, localRot, '#b45309', sovColor, {
                        roofType: 'gabled',
                        roofHeight: 3.8,
                        windows: true
                    });
                    if (isWS) {
                        drawPrism3D(wx + 4, wy - 3, wz + 8.5, 1.6, 1.3, 7, 6, '#334155', '#1e293b', 0);
                        spawnSmoke(wx + 4, wy - 3, wz + 15.5, 'rgba(203, 213, 225, 0.45)', 2.2);
                    }
                    break;
                }

            case 'power_generator':
            case 'power_plant':
                {
                    const isPlant = id === 'power_plant';
                    drawBox3D(wx, wy, wz, isPlant ? 16.5 : 11.5, 11.5, isPlant ? 12.5 : 8.5, 0, '#475569', '#f59e0b', {
                        windows: true,
                        windowRows: 2,
                        windowCols: 3
                    });
                    if (isPlant) {
                        drawPrism3D(wx + 5, wy - 3, wz + 12.5, 2.0, 1.5, 11, 8, '#334155', '#ef4444', 0);
                        spawnSmoke(wx + 5, wy - 3, wz + 23.5, 'rgba(148, 163, 184, 0.5)', 3.0);
                    }
                    break;
                }

            case 'factory':
            case 'factory_large':
            case 'industrial_authority':
                {
                    const scale = id === 'industrial_authority' ? 1.45 : (id === 'factory_large' ? 1.22 : 1.0);
                    drawBox3D(wx, wy, wz, 14.5 * scale, 11.5 * scale, 10.5 * scale, 0, '#7f1d1d', '#991b1b', {
                        roofType: 'gabled',
                        roofHeight: 3.8 * scale,
                        windows: true,
                        windowRows: 2,
                        windowCols: 3
                    });
                    const stackZ = wz + 10.5 * scale;
                    const stackH = 12.5 * scale;
                    drawPrism3D(wx + 4 * scale, wy - 3 * scale, stackZ, 2.0 * scale, 1.4 * scale, stackH, 8, '#334155', '#1e293b', 0);
                    drawPrism3D(wx - 3 * scale, wy - 3 * scale, stackZ, 1.8 * scale, 1.3 * scale, stackH * 0.85, 8, '#475569', '#1e293b', 0);
                    spawnSmoke(wx + 4 * scale, wy - 3 * scale, stackZ + stackH, 'rgba(148, 163, 184, 0.55)', 3.2 * scale);
                    break;
                }

            case 'oil_well':
            case 'oil_field':
                {
                    drawPrism3D(wx - 5, wy + 2, wz, 4.8, 4.8, 7.5, 8, '#1e293b', '#fbbf24', 0);
                    drawPumpjack3D(wx + 3, wy - 1, wz, sovColor, subIdx);
                    if (id === 'oil_field') {
                        drawPrism3D(wx + 7, wy + 4, wz, 1.4, 1.0, 14.5, 6, '#475569', '#f97316', 0);
                        const flarePt = project3D(wx + 7, wy + 4, wz + 16);
                        const flicker = 3.2 + Math.sin(animClock * 9 + subIdx) * 1.4;
                        ctx.fillStyle = '#f97316';
                        ctx.beginPath();
                        ctx.arc(flarePt.x, flarePt.y, flicker * camera.zoom, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    break;
                }

            case 'gas_well':
                {
                    drawPrism3D(wx - 3, wy, wz, 5.8, 5.8, 9.5, 10, '#e2e8f0', '#38bdf8', 3);
                    drawPrism3D(wx + 5, wy - 2, wz, 1.2, 0.9, 13.5, 6, '#64748b', '#fb923c', 0);
                    const flarePt = project3D(wx + 5, wy - 2, wz + 15);
                    ctx.fillStyle = '#fb923c';
                    ctx.beginPath();
                    ctx.arc(flarePt.x, flarePt.y, (2.8 + Math.sin(animClock * 8) * 1.0) * camera.zoom, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }

            case 'fuel_station':
            case 'gas_station_shop':
                {
                    drawBox3D(wx, wy, wz, 12.5, 8.5, 1.2, localRot, '#475569', '#94a3b8', { shadow: true });
                    drawBox3D(wx, wy, wz + 6.8, 13.5, 9.5, 1.8, localRot, sovColor, '#f8fafc', { shadow: false });
                    drawBox3D(wx - 3, wy, wz + 1.2, 4.2, 4.2, 5.6, localRot, '#e2e8f0', '#cbd5e1', { shadow: false });
                    break;
                }

            case 'solar_farm':
                {
                    const glint = (Math.sin(animClock * 2.5 + subIdx) + 1) * 0.12;
                    const panelCol = adjustColor('#0284c7', glint);
                    drawBox3D(wx - 4, wy - 3, wz, 8.0, 6.0, 2.2, 0.3, '#334155', panelCol, {});
                    drawBox3D(wx + 4, wy + 3, wz, 8.0, 6.0, 2.2, 0.3, '#334155', panelCol, {});
                    break;
                }

            case 'wind_station':
                {
                    drawWindTurbine3D(wx, wy, wz, subIdx);
                    break;
                }

            case 'nuclear_reactor':
                {
                    drawPrism3D(wx - 4, wy - 2, wz, 8.8, 5.8, 20, 12, '#94a3b8', '#475569', 0);
                    drawPrism3D(wx + 6, wy + 4, wz, 6.8, 3.2, 10.5, 10, '#cbd5e1', '#10b981', 5);
                    spawnSmoke(wx - 4, wy - 2, wz + 20.5, 'rgba(248, 250, 252, 0.72)', 5.0);
                    break;
                }

            case 'marina':
            case 'seaport':
                {
                    const isPort = id === 'seaport';
                    drawBox3D(wx, wy, wz, isPort ? 18.5 : 13.5, 10.5, 3.0, localRot, '#64748b', '#94a3b8', {});
                    if (isPort) {
                        drawBox3D(wx - 4, wy, wz + 3, 5.2, 3.8, 3.4, 0, '#ef4444', '#f87171', { shadow: false });
                        drawBox3D(wx + 2, wy, wz + 3, 5.2, 3.8, 3.4, 0, '#0284c7', '#38bdf8', { shadow: false });
                        drawBox3D(wx + 6, wy - 2, wz + 3, 2.4, 2.4, 15.5, 0, '#f59e0b', '#fbbf24', { shadow: false });
                        drawBox3D(wx + 2, wy - 2, wz + 16.5, 12.5, 2.0, 1.8, 0, '#fbbf24', '#fde047', { shadow: false });
                    }
                    break;
                }

            case 'boat':
            case 'ship':
            case 'cargo_ship_large':
                {
                    const floatZ = Math.sin(animClock * 2.3 + hex.q + subIdx) * 1.4;
                    drawVessel3D(wx, wy, floatZ, id, sovColor, animClock * 0.15 + subIdx);
                    break;
                }

            case 'regional_airport':
            case 'intl_airport':
                {
                    const isIntl = id === 'intl_airport';
                    drawBox3D(wx, wy + 4, wz, isIntl ? 27 : 21, 7.5, 0.8, 0, '#1e293b', '#0f172a', {});
                    drawBox3D(wx - 4, wy - 4, wz, isIntl ? 15.5 : 11.5, 7.5, 8.0, 0, '#e2e8f0', sovColor, {
                        windows: true,
                        windowRows: 2,
                        windowCols: 4,
                        windowColor: '#38bdf8'
                    });
                    drawPrism3D(wx + 7, wy - 5, wz, 2.5, 3.4, isIntl ? 18.5 : 13.5, 8, '#f8fafc', '#0284c7', 3);
                    break;
                }

            case 'train_station':
            case 'train_station_large':
            case 'cargo_carrier':
                {
                    const isBig = id === 'train_station_large';
                    drawBox3D(wx, wy, wz, isBig ? 17.5 : 13.5, 10.5, isBig ? 11.5 : 8.5, localRot, '#cbd5e1', sovColor, {
                        roofType: 'gabled',
                        roofHeight: 4.2,
                        windows: true,
                        windowRows: 2,
                        windowCols: 3
                    });
                    break;
                }

            default:
                {
                    drawBox3D(wx, wy, wz, 10.5, 9.0, 8.5, localRot, '#e2e8f0', sovColor, {
                        roofType: 'gabled',
                        roofHeight: 4.2,
                        windows: true
                    });
                    break;
                }
        }
    }

    function drawWindTurbine3D(wx, wy, wz, seed = 0) {
        drawGroundShadow3D(wx, wy, wz, 5, 5, 0.2);
        const basePt = project3D(wx, wy, wz);
        const hubPt = project3D(wx, wy, wz + 23);

        ctx.save();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = Math.max(2, 2.8 * camera.zoom);
        ctx.beginPath();
        ctx.moveTo(basePt.x, basePt.y);
        ctx.lineTo(hubPt.x, hubPt.y);
        ctx.stroke();

        const bladeLen = 11.5 * camera.zoom;
        const baseAngle = animClock * 4.2 + seed * 1.7;
        for (let i = 0; i < 3; i++) {
            const a = baseAngle + (i * Math.PI * 2) / 3;
            const bx = hubPt.x + Math.cos(a) * bladeLen;
            const by = hubPt.y + Math.sin(a) * bladeLen * 0.82;
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = Math.max(1.5, 2.0 * camera.zoom);
            ctx.beginPath();
            ctx.moveTo(hubPt.x, hubPt.y);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(hubPt.x, hubPt.y, 2.4 * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawPumpjack3D(wx, wy, wz, sovColor, seed = 0) {
        const basePt = project3D(wx, wy, wz);
        const pivotPt = project3D(wx, wy, wz + 8.5);
        const tilt = Math.sin(animClock * 3.8 + seed) * 0.42;

        const leftPt = project3D(wx - Math.cos(tilt) * 5.5, wy, wz + 8.5 + Math.sin(tilt) * 4.5);
        const rightPt = project3D(wx + Math.cos(tilt) * 5.5, wy, wz + 8.5 - Math.sin(tilt) * 4.5);
        const wellPt = project3D(wx + 5.5, wy, wz);

        ctx.save();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2.4 * camera.zoom;
        ctx.beginPath();
        ctx.moveTo(basePt.x - 3 * camera.zoom, basePt.y);
        ctx.lineTo(pivotPt.x, pivotPt.y);
        ctx.lineTo(basePt.x + 3 * camera.zoom, basePt.y);
        ctx.stroke();

        ctx.strokeStyle = sovColor;
        ctx.lineWidth = 3.0 * camera.zoom;
        ctx.beginPath();
        ctx.moveTo(leftPt.x, leftPt.y);
        ctx.lineTo(rightPt.x, rightPt.y);
        ctx.stroke();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.4 * camera.zoom;
        ctx.beginPath();
        ctx.moveTo(rightPt.x, rightPt.y);
        ctx.lineTo(wellPt.x, wellPt.y);
        ctx.stroke();
        ctx.restore();
    }

    function drawFerrisWheel3D(wx, wy, wz, sovColor) {
        const baseL = project3D(wx - 4, wy, wz);
        const baseR = project3D(wx + 4, wy, wz);
        const center = project3D(wx, wy, wz + 14.5);
        const radius = 10.0 * camera.zoom;

        ctx.save();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.2 * camera.zoom;
        ctx.beginPath();
        ctx.moveTo(baseL.x, baseL.y);
        ctx.lineTo(center.x, center.y);
        ctx.lineTo(baseR.x, baseR.y);
        ctx.stroke();

        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.0 * camera.zoom;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        const cabinColors = [sovColor, '#38bdf8', '#4ade80', '#f43f5e', '#fbbf24', '#c084fc'];
        for (let i = 0; i < 6; i++) {
            const a = animClock * 1.4 + (i * Math.PI * 2) / 6;
            const cx = center.x + Math.cos(a) * radius;
            const cy = center.y + Math.sin(a) * radius;
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1 * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(cx, cy);
            ctx.stroke();

            ctx.fillStyle = cabinColors[i % cabinColors.length];
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5 * camera.zoom, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawVessel3D(wx, wy, wz, type, sovColor, angle = 0) {
        const scale = type === 'cargo_ship_large' ? 1.45 : (type === 'ship' ? 1.1 : 0.75);
        const wakePt = project3D(wx - Math.cos(angle) * 6 * scale, wy - Math.sin(angle) * 6 * scale, wz);
        ctx.save();
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
        ctx.lineWidth = 2.0 * camera.zoom;
        ctx.beginPath();
        ctx.arc(wakePt.x, wakePt.y, 4.5 * scale * camera.zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        drawBox3D(wx, wy, wz, 11 * scale, 4.8 * scale, 2.8 * scale, angle, '#1e293b', '#475569', { shadow: false });
        if (type === 'boat') {
            drawPrism3D(wx, wy, wz + 2.5, 3.0, 0.3, 7.5, 4, '#f8fafc', sovColor, 0);
        } else {
            drawBox3D(wx - Math.cos(angle) * 2.5 * scale, wy - Math.sin(angle) * 2.5 * scale, wz + 2.8 * scale, 3.5 * scale, 3.8 * scale, 3.8 * scale, angle, '#f8fafc', '#38bdf8', { shadow: false });
            drawBox3D(wx + Math.cos(angle) * 2.0 * scale, wy + Math.sin(angle) * 2.0 * scale, wz + 2.8 * scale, 4.2 * scale, 3.4 * scale, 2.4 * scale, angle, sovColor, '#fbbf24', { shadow: false });
        }
    }

    function drawLighthouse3D(hex, sovColor) {
        const { wx, wy, height: wz } = hex;
        drawPrism3D(wx, wy, wz, 5.5, 3.4, 19, 8, '#f8fafc', sovColor, 4.2);
        const topPt = project3D(wx, wy, wz + 19);

        const beamAngle = animClock * 1.8;
        const bx = topPt.x + Math.cos(beamAngle) * 58 * camera.zoom;
        const by = topPt.y + Math.sin(beamAngle) * 34 * camera.zoom;

        ctx.save();
        const grad = ctx.createLinearGradient(topPt.x, topPt.y, bx, by);
        grad.addColorStop(0, 'rgba(253, 224, 71, 0.65)');
        grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(topPt.x, topPt.y);
        ctx.lineTo(bx - 12 * camera.zoom, by - 8 * camera.zoom);
        ctx.lineTo(bx + 12 * camera.zoom, by + 8 * camera.zoom);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function drawNaturalFoliageCluster3D(hex) {
        const { wx, wy, height: wz, foliage } = hex;
        if (!foliage) return;

        if (foliage === 'mountain_peak') {
            drawPrism3D(wx, wy, wz, 22, 6, 16, 6, '#475569', '#f8fafc', 9);
        } else if (foliage === 'pine_forest') {
            drawLowPolyTree3D(wx - 6, wy - 4, wz, 'pine', 1.05);
            drawLowPolyTree3D(wx + 6, wy + 3, wz, 'pine', 0.90);
            drawLowPolyTree3D(wx + 1, wy - 6, wz, 'pine', 0.82);
        } else if (foliage === 'oak_grove') {
            drawLowPolyTree3D(wx - 5, wy + 2, wz, 'oak', 1.05);
            drawLowPolyTree3D(wx + 5, wy - 3, wz, 'oak', 0.88);
        } else if (foliage === 'palm_trees') {
            drawLowPolyTree3D(wx - 4, wy, wz, 'palm', 1.05);
            drawLowPolyTree3D(wx + 5, wy + 3, wz, 'palm', 0.86);
        } else if (foliage === 'boulders') {
            drawPrism3D(wx - 4, wy + 2, wz, 4.5, 2.2, 4.0, 5, '#64748b', '#94a3b8', 1.5);
            drawPrism3D(wx + 4, wy - 2, wz, 3.2, 1.6, 3.0, 5, '#475569', '#64748b', 1.0);
        }
    }

    function drawLowPolyTree3D(wx, wy, wz, style = 'pine', scale = 1.0) {
        drawGroundShadow3D(wx, wy, wz, 3.8 * scale, 3.8 * scale, 0.18);
        drawPrism3D(wx, wy, wz, 1.1 * scale, 0.9 * scale, 3.2 * scale, 5, '#5c4033', '#3e2723', 0);

        if (style === 'pine') {
            drawPrism3D(wx, wy, wz + 2.8 * scale, 4.2 * scale, 0.4, 6.5 * scale, 6, '#15803d', '#166534', 2.0 * scale);
            drawPrism3D(wx, wy, wz + 6.5 * scale, 3.2 * scale, 0.2, 5.5 * scale, 6, '#22c55e', '#15803d', 2.0 * scale);
        } else if (style === 'palm') {
            drawPrism3D(wx, wy, wz + 3.0 * scale, 0.9 * scale, 0.7 * scale, 5.5 * scale, 5, '#78350f', '#92400e', 0);
            drawPrism3D(wx, wy, wz + 8.0 * scale, 4.8 * scale, 1.2 * scale, 2.2 * scale, 6, '#65a30d', '#84cc16', 1.2 * scale);
        } else {
            drawPrism3D(wx, wy, wz + 3.0 * scale, 4.5 * scale, 2.5 * scale, 5.5 * scale, 7, '#16a34a', '#4ade80', 2.5 * scale);
        }
    }

    // =========================================================================
    // 9. رسم السفن والطائرات والغيوم وحلقة العرض الرئيسية
    // =========================================================================
    function updateAndRenderSeaVessels() {
        const sovColor = getCountrySovereignColor(currentCountry);
        seaVessels.forEach(vessel => {
            vessel.t += vessel.speed * vessel.dir;
            if (vessel.t > 1) {
                vessel.t = 1;
                vessel.dir = -1;
            } else if (vessel.t < 0) {
                vessel.t = 0;
                vessel.dir = 1;
            }

            const wx = lerp(vessel.from.wx, vessel.to.wx, vessel.t);
            const wy = lerp(vessel.from.wy, vessel.to.wy, vessel.t);
            const wz = Math.sin(animClock * 2.2 + vessel.t * 10) * 1.2;
            const angle = Math.atan2(
                (vessel.to.wy - vessel.from.wy) * vessel.dir,
                (vessel.to.wx - vessel.from.wx) * vessel.dir
            );

            drawVessel3D(wx, wy, wz, vessel.type, sovColor, angle);
        });
    }

    function updateAndRenderSmokeParticles() {
        for (let i = smokeParticles.length - 1; i >= 0; i--) {
            const p = smokeParticles[i];
            p.wx += p.vx;
            p.wy += p.vy;
            p.wz += p.vz;
            p.radius += 0.035;
            p.alpha -= 0.008;

            if (p.alpha <= 0.02) {
                smokeParticles.splice(i, 1);
                continue;
            }

            const pt = project3D(p.wx, p.wy, p.wz);
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, p.radius * camera.zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function updateAndRenderAirspace() {
        birdFlocks.forEach(flock => {
            flock.angle += flock.speed;
            const cx = Math.cos(flock.angle) * flock.radius;
            const cy = Math.sin(flock.angle) * flock.radius;

            ctx.save();
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1.3 * camera.zoom;
            for (let i = 0; i < flock.count; i++) {
                const bx = cx + (i - 2) * 5;
                const by = cy + Math.abs(i - 2) * 4;
                const pt = project3D(bx, by, flock.wz + Math.sin(animClock * 6 + i) * 1.5);
                const wing = Math.sin(animClock * 9 + i) * 2.5 * camera.zoom;
                ctx.beginPath();
                ctx.moveTo(pt.x - 3 * camera.zoom, pt.y - wing);
                ctx.lineTo(pt.x, pt.y);
                ctx.lineTo(pt.x + 3 * camera.zoom, pt.y - wing);
                ctx.stroke();
            }
            ctx.restore();
        });

        skyAircraft.forEach(plane => {
            plane.angle += plane.speed;
            const wx = Math.cos(plane.angle) * plane.orbitRadiusX;
            const wy = Math.sin(plane.angle) * plane.orbitRadiusY;
            const wz = plane.altitude + Math.sin(plane.angle * 2) * 5;

            const heading = Math.atan2(
                Math.cos(plane.angle) * plane.orbitRadiusY, -Math.sin(plane.angle) * plane.orbitRadiusX
            );

            drawGroundShadow3D(wx, wy, 6, 7, 4, 0.16);

            plane.trail.push({ wx, wy, wz });
            if (plane.trail.length > 18) plane.trail.shift();

            if (plane.trail.length > 2) {
                ctx.save();
                ctx.strokeStyle = 'rgba(248, 250, 252, 0.32)';
                ctx.lineWidth = (plane.isJumbo ? 2.4 : 1.5) * camera.zoom;
                ctx.beginPath();
                const p0 = project3D(plane.trail[0].wx, plane.trail[0].wy, plane.trail[0].wz);
                ctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < plane.trail.length; i++) {
                    const pi = project3D(plane.trail[i].wx, plane.trail[i].wy, plane.trail[i].wz);
                    ctx.lineTo(pi.x, pi.y);
                }
                ctx.stroke();
                ctx.restore();
            }

            const scale = plane.isJumbo ? 1.35 : 0.95;
            const fusL = project3D(wx - Math.cos(heading) * 6 * scale, wy - Math.sin(heading) * 6 * scale, wz);
            const fusR = project3D(wx + Math.cos(heading) * 7 * scale, wy + Math.sin(heading) * 7 * scale, wz);
            const wingL = project3D(wx - Math.sin(heading) * 8 * scale, wy + Math.cos(heading) * 8 * scale, wz);
            const wingR = project3D(wx + Math.sin(heading) * 8 * scale, wy - Math.cos(heading) * 8 * scale, wz);

            ctx.save();
            ctx.strokeStyle = plane.color || '#38bdf8';
            ctx.lineWidth = 3.2 * scale * camera.zoom;
            ctx.beginPath();
            ctx.moveTo(wingL.x, wingL.y);
            ctx.lineTo(wingR.x, wingR.y);
            ctx.stroke();

            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 4.0 * scale * camera.zoom;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(fusL.x, fusL.y);
            ctx.lineTo(fusR.x, fusR.y);
            ctx.stroke();
            ctx.restore();
        });

        skyClouds.forEach(cloud => {
            cloud.wx += cloud.speedX;
            cloud.wy += cloud.speedY;
            if (cloud.wx > cloud.span) cloud.wx = -cloud.span;
            if (cloud.wy > cloud.span) cloud.wy = -cloud.span;

            const pt = project3D(cloud.wx, cloud.wy, cloud.wz);
            const r = 16 * cloud.scale * camera.zoom;
            ctx.save();
            ctx.fillStyle = 'rgba(248, 250, 252, 0.16)';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            ctx.arc(pt.x + r * 0.7, pt.y + r * 0.1, r * 0.78, 0, Math.PI * 2);
            ctx.arc(pt.x - r * 0.65, pt.y + r * 0.15, r * 0.72, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    function renderLoop() {
        animClock += 0.035;
        dayCycleClock += 0.012;
        updateCameraPhysics();

        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const light = getLightingState();
        const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGrad.addColorStop(0, light.bgTop);
        skyGrad.addColorStop(1, light.bgBottom);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < hexMesh.length; i++) {
            const h = hexMesh[i];
            const p = project3D(h.wx, h.wy, h.height);
            h._sortDepth = p.depth;
        }
        hexMesh.sort((a, b) => a._sortDepth - b._sortDepth);

        for (let i = 0; i < hexMesh.length; i++) {
            drawLowPolyHexTile(hexMesh[i]);
        }

        renderArterialRoadsAndTraffic();
        renderRailwayAndTrains();
        updateAndRenderSeaVessels();

        const sovColor = getCountrySovereignColor(currentCountry);
        for (let i = 0; i < hexMesh.length; i++) {
            const hex = hexMesh[i];
            if (hex.isCitadel) {
                drawSovereignCitadel3D(hex, sovColor);
            } else if (hex.cluster) {
                drawDistrictCluster3D(hex, sovColor);
            } else if (hex.isLighthouse) {
                drawLighthouse3D(hex, sovColor);
            } else if (hex.foliage) {
                drawNaturalFoliageCluster3D(hex);
            }
        }

        updateAndRenderSmokeParticles();
        updateAndRenderAirspace();
        drawFloatingBuildingBadges();
        drawCompassGizmo();

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function drawCompassGizmo() {
        if (!canvas) return;
        const cx = canvas.width - 38;
        const cy = 38;
        const r = 20;

        ctx.save();
        ctx.fillStyle = 'rgba(24, 18, 43, 0.82)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const nx = cx - Math.sin(camera.yaw) * (r - 5);
        const ny = cy - Math.cos(camera.yaw) * (r - 5);
        const sx = cx + Math.sin(camera.yaw) * (r - 5);
        const sy = cy + Math.cos(camera.yaw) * (r - 5);

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9px Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', nx, ny);
        ctx.restore();
    }

    // تحديث الشريط العلوي البصري (HUD) في مشهد العاصمة
    function updateHUD(country) {
        if (!country) return;
        const isOwner = isCountryOwner(country);

        const titleEl = document.getElementById('cap-country-name');
        if (titleEl) titleEl.textContent = country.name || 'الدولة السيادية';

        const subEl = document.getElementById('cap-country-subtitle');
        if (subEl) {
            const stNum = Number(country.stage) || 1;
            subEl.textContent = `🏆 م${stNum}` + (isOwner ? '' : ' 👁️');
        }

        // رسم مصغر للعلم في شريط العاصمة العلوي (يدعم مصفوفة أحادية أو ثنائية)
        const miniFlag = document.getElementById('cap-mini-flag');
        if (miniFlag && Array.isArray(country.flag)) {
            miniFlag.innerHTML = '';
            const flatFlag = Array.isArray(country.flag[0]) ? country.flag.flat() : country.flag;
            flatFlag.slice(0, 12).forEach(col => {
                const d = document.createElement('div');
                d.style.background = col || '#e11d48';
                miniFlag.appendChild(d);
            });
        }

        const cashEl = document.getElementById('cap-val-cash');
        if (cashEl) cashEl.textContent = `$${Number(country.disposableRevenue || 0).toLocaleString()}`;

        const bgtEl = document.getElementById('cap-val-budget');
        if (bgtEl) {
            const bgt = Number(country.budget || 0);
            bgtEl.textContent = `${bgt >= 0 ? '+$' + bgt.toLocaleString() : '-$' + Math.abs(bgt).toLocaleString()}/س`;
        }

        const pop = Number(country.population || 0);
        const emp = Number(country.employed || 0);
        const unemp = Math.max(0, pop - emp);
        country.unemployed = unemp;

        const wrkEl = document.getElementById('cap-val-workers');
        if (wrkEl) {
            wrkEl.textContent = pop === 0 ? '0 (ابنِ 🏠)' : `${pop.toLocaleString()} (👷${unemp.toLocaleString()})`;
        }

        const elecVal = Number(country.sectors?.electricity || 0);
        const elecEl = document.getElementById('cap-val-elec');
        const elecPill = document.getElementById('cap-pill-elec');
        if (elecEl) elecEl.textContent = elecVal > 0 ? `+${elecVal}` : `${elecVal}`;
        if (elecPill) elecPill.classList.toggle('pill-alert-red', elecVal < 0);

        const waterVal = Number(country.sectors?.water || 0);
        const waterEl = document.getElementById('cap-val-water');
        const waterPill = document.getElementById('cap-pill-water');
        if (waterEl) waterEl.textContent = waterVal > 0 ? `+${waterVal}` : `${waterVal}`;
        if (waterPill) waterPill.classList.toggle('pill-alert-red', waterVal < 0);

        const idxEl = document.getElementById('cap-val-index');
        if (idxEl) idxEl.textContent = `${Number(country.generalIndex || 0).toLocaleString()}`;

        if (window.MilitaryEngine && typeof window.MilitaryEngine.refreshMilitaryStats === "function") {
            window.MilitaryEngine.refreshMilitaryStats(country);
        }
        const milPower = (country.military && typeof country.military.totalPower === "number") ?
            country.military.totalPower :
            (Number(country.militaryPower) || 0);
        const milUnits = (country.military && typeof country.military.totalUnits === "number") ?
            country.military.totalUnits :
            (Number(country.militaryUnitsCount) || 0);
        const milEl = document.getElementById('cap-val-mil');
        if (milEl) milEl.textContent = `${Number(milPower).toLocaleString()} (${milUnits} جيش)`;

        if (typeof window.updateAllTurnDecisionButtons === "function") {
            window.updateAllTurnDecisionButtons();
        }
    }

    function refreshHUDAndMap() {
        if (!currentCountry) return;
        generateExpandableHexWorld(currentCountry);
        updateHUD(currentCountry);
        if (activeDrawerId === 'cap-drawer-build') renderVisualBuildDrawer();
        else if (activeDrawerId === 'cap-drawer-sectors') renderVisualSectorsDrawer();
        else if (activeDrawerId === 'cap-drawer-economy') renderVisualEconomyDrawer();
    }

    function open(country) {
        if (!country) return;
        currentCountry = country;
        window.currentViewingCountry = country;
        window.isViewingAsSpectator = !isCountryOwner(country);
        currentBuildStageTab = Number(country.stage) || 1;

        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const capScreen = document.getElementById('capital-screen');
        if (capScreen) capScreen.classList.add('active');

        init();
        resizeCanvas();
        resetCamera();
        closeAllDrawers();
        closeInspectorPopup();
        generateExpandableHexWorld(country);
        updateHUD(country);

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        renderLoop();
    }

    function close() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        hoveredHex = null;
        selectedHex = null;
        closeAllDrawers();
        closeInspectorPopup();
        const tooltip = document.getElementById('capital-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }

    return {
        init,
        open,
        close,
        refreshHUDAndMap,
        updateHUD,
        expandGrid,
        resetCamera,
        openDrawer,
        closeAllDrawers,
        setTimeOfDay: (modeIdx) => { timeModeIndex = clamp(modeIdx, 0, TIME_MODES.length - 1); }
    };
})();
