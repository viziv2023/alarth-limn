/**
 * ============================================================================
 * aiEngine.js - محرك الذكاء الاصطناعي الاستراتيجي المتكامل (10 منافسين بعقليات ومستويات متنوعة)
 * ============================================================================
 * المزايا والقدرات التفاعلية للمنافسين الـ 10:
 * 1. 10 شخصيات وعقليات استراتيجية مختلفة (إمبراطوري عسكري، تاجر اقتصادي، دبلوماسي متحالف،
 *    صقر انتهازي، قلعة دفاعية، قطب طاقة، نهضوي علمي، أمير حرب، مصرفي دولي، توسعي متوازن).
 * 2. 4 مستويات ذكاء ومهارة متدرجة (مبتدئ، متمرس، خبير، أسطوري/عظيم).
 * 3. بناء ذكي للمنشآت السكنية والخدمية والإنتاجية والترقية التلقائية عبر المراحل الـ 5.
 * 4. تسليح وتجنيد متكامل (قوات برية، بحرية، جوية، دفاع جوي وصواريخ) وتصنيع أسلحة سيادية.
 * 5. شراء المنتجات والنقاط من الدول الأخرى عبر سوق التجارة والبورصة لسد العجز وتنشيط اقتصاد اللاعب.
 * 6. نظام دبلوماسي وتحالفات حية (إرسال واستقبال عروض تحالف مشترك، منح مالية، وقروض سيادية).
 * 7. شن هجمات وحروب حقيقية تفاعلية (مع حلفاء الذكاء الاصطناعي) ضد الدول الأخرى أو ضد اللاعب،
 *    واتخاذ قرارات دفاعية ذكية عند تعرضهم للهجوم (خوض المعركة مع إسناد الحلفاء، دفع الجزية، أو الاستسلام التكتيكي).
 * 8. تفاعل حي في ديوان محادثات الروم والرد التلقائي الذكي على رسائل اللاعب.
 */

class AIEngine {
  static PERSONAS = [
    {
      id: "imperial_warlord",
      title: "إمبراطوري عسكري ⚔️",
      icon: "⚔️",
      countryName: "إمبراطورية الحديد",
      leaderName: "المارشال تيمور",
      skillLevel: "أسطوري",
      skillMultiplier: 1.35,
      flag: ["#991b1b", "#991b1b", "#991b1b", "#991b1b", "#111111", "#fbbf24", "#fbbf24", "#111111", "#991b1b", "#991b1b", "#991b1b", "#991b1b"],
      militaryColor: "#ef4444",
      aggression: 0.88,
      diplomacy: 0.35,
      tradeFocus: 0.45,
      militaryBudgetRatio: 0.58,
      preferredBranches: ["ground", "air", "defense"],
      desc: "يركز على بناء جيش جرار وشن حملات عسكرية لفرض الجزية والهيمنة."
    },
    {
      id: "merchant_tycoon",
      title: "تاجر اقتصادي 🚢",
      icon: "🚢",
      countryName: "جمهورية البندقية الذهبية",
      leaderName: "التاجر لورنزو",
      skillLevel: "خبير",
      skillMultiplier: 1.25,
      flag: ["#0369a1", "#0369a1", "#0369a1", "#0369a1", "#ffffff", "#f59e0b", "#f59e0b", "#ffffff", "#0284c7", "#0284c7", "#0284c7", "#0284c7"],
      militaryColor: "#0ea5e9",
      aggression: 0.25,
      diplomacy: 0.85,
      tradeFocus: 0.95,
      militaryBudgetRatio: 0.28,
      preferredBranches: ["naval", "defense", "air"],
      desc: "يبرم صفقات شراء وتصدير المنتجات بكثافة، ويبني الأسواق والموانئ والأساطيل."
    },
    {
      id: "diplomatic_coalition",
      title: "دبلوماسي متحالف 🤝",
      icon: "🤝",
      countryName: "اتحاد السلام السيادي",
      leaderName: "السفير الحكيم",
      skillLevel: "خبير",
      skillMultiplier: 1.20,
      flag: ["#15803d", "#15803d", "#15803d", "#15803d", "#ffffff", "#34d399", "#34d399", "#ffffff", "#166534", "#166534", "#166534", "#166534"],
      militaryColor: "#10b981",
      aggression: 0.20,
      diplomacy: 0.96,
      tradeFocus: 0.80,
      militaryBudgetRatio: 0.32,
      preferredBranches: ["defense", "ground", "air"],
      desc: "يبني شبكة تحالفات دفاعية وهجومية قوية، ويدعم حلفاءه بالمنح والجيوش."
    },
    {
      id: "opportunist_hawk",
      title: "صقر انتهازي 🦅",
      icon: "🦅",
      countryName: "مملكة الصقور الجارحة",
      leaderName: "القائد شاهين",
      skillLevel: "أسطوري",
      skillMultiplier: 1.30,
      flag: ["#b45309", "#b45309", "#b45309", "#b45309", "#111111", "#fde047", "#fde047", "#111111", "#78350f", "#78350f", "#78350f", "#78350f"],
      militaryColor: "#f59e0b",
      aggression: 0.78,
      diplomacy: 0.55,
      tradeFocus: 0.65,
      militaryBudgetRatio: 0.50,
      preferredBranches: ["air", "ground", "naval"],
      desc: "يراقب الدول الغنية ضعيفة الدفاع ليباغتها بهجمات خاطفة، ويتحالف مع الأقوياء."
    },
    {
      id: "energy_baron",
      title: "قطب الطاقة والنفط 🛢️",
      icon: "🛢️",
      countryName: "إمارة الطاقة العظمى",
      leaderName: "الشيخ منصور",
      skillLevel: "خبير",
      skillMultiplier: 1.25,
      flag: ["#047857", "#047857", "#047857", "#047857", "#ffffff", "#111111", "#111111", "#ffffff", "#b91c1c", "#b91c1c", "#b91c1c", "#b91c1c"],
      militaryColor: "#14b8a6",
      aggression: 0.40,
      diplomacy: 0.78,
      tradeFocus: 0.88,
      militaryBudgetRatio: 0.38,
      preferredBranches: ["defense", "air", "naval"],
      desc: "يحتكر إنتاج النفط والغاز والكهرباء، ويشتري المنتجات الزراعية والصناعية ويمنح القروض."
    },
    {
      id: "fortress_guardian",
      title: "قلعة دفاعية 🛡️",
      icon: "🛡️",
      countryName: "حصن الجبل المنيع",
      leaderName: "الجنرال صخر",
      skillLevel: "متمرس",
      skillMultiplier: 1.15,
      flag: ["#334155", "#334155", "#334155", "#334155", "#38bdf8", "#ffffff", "#ffffff", "#38bdf8", "#1e293b", "#1e293b", "#1e293b", "#1e293b"],
      militaryColor: "#64748b",
      aggression: 0.30,
      diplomacy: 0.70,
      tradeFocus: 0.60,
      militaryBudgetRatio: 0.46,
      preferredBranches: ["defense", "ground", "air"],
      desc: "يبني ترسانة دفاعية وصاروخية هائلة، ويلبي نداء الحلفاء لصد أي غزو."
    },
    {
      id: "tech_industrialist",
      title: "صناعي نهضوي 🏭",
      icon: "🏭",
      countryName: "اتحاد التكنولوجيا والصناعة",
      leaderName: "المهندس آصف",
      skillLevel: "خبير",
      skillMultiplier: 1.22,
      flag: ["#4338ca", "#4338ca", "#4338ca", "#4338ca", "#ffffff", "#38bdf8", "#38bdf8", "#ffffff", "#312e81", "#312e81", "#312e81", "#312e81"],
      militaryColor: "#6366f1",
      aggression: 0.45,
      diplomacy: 0.68,
      tradeFocus: 0.85,
      militaryBudgetRatio: 0.40,
      preferredBranches: ["air", "defense", "ground"],
      desc: "يتسابق للترقية إلى المراحل المتقدمة، ويبتكر ويصدر الأسلحة والمنتجات الصناعية."
    },
    {
      id: "naval_admiral",
      title: "أدميرال البحار ⚓",
      icon: "⚓",
      countryName: "مملكة المحيط الأطلسي",
      leaderName: "الأدميرال بارباروس",
      skillLevel: "متمرس",
      skillMultiplier: 1.18,
      flag: ["#1d4ed8", "#1d4ed8", "#1d4ed8", "#1d4ed8", "#fde047", "#ffffff", "#ffffff", "#fde047", "#1e3a8a", "#1e3a8a", "#1e3a8a", "#1e3a8a"],
      militaryColor: "#3b82f6",
      aggression: 0.68,
      diplomacy: 0.50,
      tradeFocus: 0.75,
      militaryBudgetRatio: 0.48,
      preferredBranches: ["naval", "air", "ground"],
      desc: "يسيطر على الملاحة والموانئ والأساطيل البحرية وحاملات الطائرات."
    },
    {
      id: "global_banker",
      title: "مصرفي ومستثمر دولي 🏦",
      icon: "🏦",
      countryName: "جمهورية الذهب والمصارف",
      leaderName: "المستشار قارون",
      skillLevel: "متمرس",
      skillMultiplier: 1.15,
      flag: ["#7e22ce", "#7e22ce", "#7e22ce", "#7e22ce", "#fde047", "#fde047", "#fde047", "#fde047", "#581c87", "#581c87", "#581c87", "#581c87"],
      militaryColor: "#a855f7",
      aggression: 0.32,
      diplomacy: 0.82,
      tradeFocus: 0.90,
      militaryBudgetRatio: 0.34,
      preferredBranches: ["defense", "air", "ground"],
      desc: "يمول الدول بالقروض السيادية، ويشتري الفوائض من الدول الأخرى لتعظيم مؤشره العام."
    },
    {
      id: "Blitz_commander",
      title: "قائد الصاعقة البرية 🚀",
      icon: "🚀",
      countryName: "دولة الرعد القطبي",
      leaderName: "الجنرال رعد",
      skillLevel: "مبتدئ",
      skillMultiplier: 1.05,
      flag: ["#be123c", "#be123c", "#be123c", "#be123c", "#ffffff", "#111111", "#111111", "#ffffff", "#881337", "#881337", "#881337", "#881337"],
      militaryColor: "#ec4899",
      aggression: 0.72,
      diplomacy: 0.42,
      tradeFocus: 0.55,
      militaryBudgetRatio: 0.52,
      preferredBranches: ["ground", "defense", "air"],
      desc: "مندفع عسكرياً، يحب عقد تحالفات ثنائية وشن غزوات مفاجئة."
    }
  ];

  static ensureWorldStructures(world) {
    if (!world) return;
    if (!Array.isArray(world.alliances)) world.alliances = [];
    if (!Array.isArray(world.tradeDeals)) world.tradeDeals = [];
    if (!Array.isArray(world.sovereignLoans)) world.sovereignLoans = [];
    if (!Array.isArray(world.tributes)) world.tributes = [];
    if (!Array.isArray(world.aiTurnLogs)) world.aiTurnLogs = [];
  }

  static getPlayerCountry(world) {
    world = world || window.currentWorld;
    if (!world || !Array.isArray(world.countries)) return null;
    const myCid = (window.NetworkEngine && typeof window.NetworkEngine.getMyCountryId === "function")
      ? window.NetworkEngine.getMyCountryId()
      : null;
    if (myCid) {
      const found = world.countries.find(c => String(c.id) === String(myCid));
      if (found) return found;
    }
    const human = world.countries.find(c => !c.isAI);
    return human || world.countries[0] || null;
  }

  static isAICountry(country) {
    if (!country) return false;
    if (country.isAI) return true;
    if (country.aiPersona) return true;
    if (String(country.ownerPlayerId || "").startsWith("ai_bot_")) return true;
    return false;
  }

  static getPersonaForCountry(country) {
    if (!country) return this.PERSONAS[0];
    if (country.aiPersona && typeof country.aiPersona === "object") {
      return country.aiPersona;
    }
    const matched = this.PERSONAS.find(p => p.id === country.aiPersonaId || p.countryName === country.name);
    if (matched) {
      country.aiPersona = Object.assign({}, matched);
      return country.aiPersona;
    }
    // تعيين عقلية تلقائية بناءً على ترتيب الدولة
    let hash = 0;
    const str = String(country.id || country.name || "");
    for (let i = 0; i < str.length; i++) hash += str.charCodeAt(i);
    const chosen = this.PERSONAS[hash % this.PERSONAS.length];
    country.aiPersona = Object.assign({}, chosen);
    country.aiPersonaId = chosen.id;
    return country.aiPersona;
  }

  // =========================================================================
  // 1. إدارة التحالفات والعلاقات الدبلوماسية (Alliances & Relations)
  // =========================================================================
  static initCountryRelations(country, world) {
    if (!country.aiRelations || typeof country.aiRelations !== "object") {
      country.aiRelations = {};
    }
    if (!world || !Array.isArray(world.countries)) return;
    world.countries.forEach(other => {
      if (String(other.id) === String(country.id)) return;
      if (country.aiRelations[other.id] === undefined) {
        country.aiRelations[other.id] = 50; // علاقة محايدة (0 إلى 100)
      }
    });
  }

  static adjustRelation(world, countryAId, countryBId, delta) {
    if (!world || !Array.isArray(world.countries)) return;
    const cA = world.countries.find(c => String(c.id) === String(countryAId));
    const cB = world.countries.find(c => String(c.id) === String(countryBId));
    if (cA) {
      if (!cA.aiRelations) cA.aiRelations = {};
      cA.aiRelations[countryBId] = Math.max(0, Math.min(100, (Number(cA.aiRelations[countryBId]) || 50) + delta));
    }
    if (cB) {
      if (!cB.aiRelations) cB.aiRelations = {};
      cB.aiRelations[countryAId] = Math.max(0, Math.min(100, (Number(cB.aiRelations[countryAId]) || 50) + delta));
    }
  }

  static getRelation(countryA, countryBId) {
    if (!countryA || !countryA.aiRelations) return 50;
    return Number(countryA.aiRelations[countryBId] ?? 50);
  }

  static areAllied(world, countryAId, countryBId) {
    world = world || window.currentWorld;
    if (!world || !Array.isArray(world.alliances)) return false;
    return world.alliances.some(al =>
      al.active !== false &&
      ((String(al.countryAId) === String(countryAId) && String(al.countryBId) === String(countryBId)) ||
       (String(al.countryAId) === String(countryBId) && String(al.countryBId) === String(countryAId)))
    );
  }

  static getAlliesOf(world, countryId) {
    world = world || window.currentWorld;
    if (!world || !Array.isArray(world.alliances)) return [];
    const alliesIds = [];
    world.alliances.forEach(al => {
      if (al.active === false) return;
      if (String(al.countryAId) === String(countryId)) alliesIds.push(al.countryBId);
      else if (String(al.countryBId) === String(countryId)) alliesIds.push(al.countryAId);
    });
    return (world.countries || []).filter(c => alliesIds.some(id => String(id) === String(c.id)));
  }

  static createAlliance(world, countryA, countryB, durationYears = 5) {
    this.ensureWorldStructures(world);
    if (!countryA || !countryB || String(countryA.id) === String(countryB.id)) {
      return { success: false, msg: "بيانات الدول غير صالحة للتحالف!" };
    }
    if (this.areAllied(world, countryA.id, countryB.id)) {
      return { success: false, msg: `يوجد تحالف عسكري ودفاعي قائم بالفعل بين [${countryA.name}] و [${countryB.name}]!` };
    }

    const alliance = {
      id: "ally_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      countryAId: countryA.id,
      countryAName: countryA.name,
      countryBId: countryB.id,
      countryBName: countryB.name,
      createdYear: world.year || 1,
      remainingYears: durationYears,
      active: true
    };
    world.alliances.push(alliance);
    this.adjustRelation(world, countryA.id, countryB.id, 30);

    const msg = `🛡️ تم إبرام معاهدة تحالف مشترك ودفاع متبادل بين [${countryA.name}] و [${countryB.name}] لمدة ${durationYears} سنوات!`;
    if (window.ChronicleManager && typeof window.ChronicleManager.addSystemNotification === "function") {
      window.ChronicleManager.addSystemNotification(msg);
    }
    return { success: true, msg, alliance };
  }

  static breakAlliance(world, countryAId, countryBId) {
    if (!world || !Array.isArray(world.alliances)) return;
    world.alliances = world.alliances.filter(al =>
      !((String(al.countryAId) === String(countryAId) && String(al.countryBId) === String(countryBId)) ||
        (String(al.countryAId) === String(countryBId) && String(al.countryBId) === String(countryAId)))
    );
    this.adjustRelation(world, countryAId, countryBId, -35);
  }

  // =========================================================================
  // 2. توليد المنافسين بالذكاء الاصطناعي (حتى 10 لاعبين بشخصيات ومستويات متنوعة)
  // =========================================================================
  static populateWorldWithAICompetitors(world, targetTotalPlayers = 10) {
    world = world || window.currentWorld;
    if (!world) return [];
    this.ensureWorldStructures(world);

    const existingCount = Array.isArray(world.countries) ? world.countries.length : 0;
    const needed = Math.max(0, targetTotalPlayers - existingCount);
    const createdList = [];

    for (let i = 0; i < needed; i++) {
      const rival = this.spawnSingleAINation(world);
      if (rival) createdList.push(rival);
    }

    // تحديث التجارة والمؤشرات لجميع الدول
    if (window.TradeManager && typeof window.TradeManager.recalculateCountriesTrade === "function") {
      window.TradeManager.recalculateCountriesTrade(world);
    }
    if (typeof window.renderNationsTable === "function") {
      window.renderNationsTable();
    }
    if (window.StorageManager && typeof window.StorageManager.autoSave === "function") {
      window.StorageManager.autoSave(world);
    }

    return createdList;
  }

  static spawnSingleAINation(world, forcedPersonaId = null) {
    world = world || window.currentWorld;
    if (!world) return null;
    this.ensureWorldStructures(world);

    const existingNames = new Set((world.countries || []).map(c => String(c.name).trim()));
    const existingPersonaIds = new Set((world.countries || []).filter(c => c.aiPersonaId).map(c => c.aiPersonaId));

    let persona = null;
    if (forcedPersonaId) {
      persona = this.PERSONAS.find(p => p.id === forcedPersonaId);
    }
    if (!persona) {
      persona = this.PERSONAS.find(p => !existingPersonaIds.has(p.id) && !existingNames.has(p.countryName));
    }
    if (!persona) {
      persona = this.PERSONAS[world.countries.length % this.PERSONAS.length];
    }

    let nationName = persona.countryName;
    if (existingNames.has(nationName)) {
      nationName = `${persona.countryName} (${world.countries.length + 1})`;
    }

    const botCountry = new window.Country(nationName, [...persona.flag]);
    botCountry.id = "ai_cnt_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 10000);
    botCountry.isAI = true;
    botCountry.aiPersonaId = persona.id;
    botCountry.aiPersona = Object.assign({}, persona);
    botCountry.ownerPlayerId = "ai_bot_" + persona.id + "_" + Math.floor(Math.random() * 1000);
    botCountry.ownerPlayerName = `${persona.leaderName} (${persona.title})`;
    botCountry.militaryColor = persona.militaryColor;
    botCountry.year = world.year || 1;

    // منح تأسيس أولي متوازن يتناسب مع سنة العالم الحالية ومستوى ذكاء البوت
    const currentYr = Math.max(1, Number(world.year) || 1);
    const baseCash = Math.round((200 + (currentYr - 1) * 180) * (persona.skillMultiplier || 1.1));
    botCountry.disposableRevenue = baseCash;

    world.addCountry(botCountry);
    this.initCountryRelations(botCountry, world);

    // تنفيذ دورة تأسيسية فورية ليبني بيوته ومنشآته وجيشه ولا يبدأ فارغاً
    this.executeAIEconomicAndMilitaryBuild(botCountry, world, true);

    return botCountry;
  }

  // =========================================================================
  // 3. الدورة الكاملة للذكاء الاصطناعي في كل سنة مالية (اقتصاد، تجارة، تحالفات، هجوم)
  // =========================================================================
  static processAllAITurns(world, options = {}) {
    world = world || window.currentWorld;
    if (!world || !Array.isArray(world.countries)) return { warAttackers: [], logs: [] };
    this.ensureWorldStructures(world);

    // تحديث مدة التحالفات السارية
    world.alliances = (world.alliances || []).filter(al => {
      if (al.active === false) return false;
      al.remainingYears = (Number(al.remainingYears) || 5) - 1;
      return al.remainingYears > 0;
    });

    const aiCountries = world.countries.filter(c => this.isAICountry(c));
    if (aiCountries.length === 0) return { warAttackers: [], logs: [] };

    const turnLogs = [];
    const warAttackers = [];

    // المرحلة أ: البناء العمراني، سحب السيولة، ترقية المراحل، وبناء المنشآت لكل منافس حسب عقليته
    aiCountries.forEach(bot => {
      this.initCountryRelations(bot, world);
      const buildSummary = this.executeAIEconomicAndMilitaryBuild(bot, world, false);
      if (buildSummary) turnLogs.push(buildSummary);
    });

    // المرحلة ب: التجارة الدولية وشراء المنتجات والنقاط من الدول الأخرى (بما فيها دولة اللاعب!)
    const tradeLogs = this.executeAITradeAndMarketPurchases(aiCountries, world);
    turnLogs.push(...tradeLogs);

    // المرحلة ج: التحالفات الدبلوماسية، المنح المالية، والقروض السيادية
    const diploLogs = this.executeAIDiplomacyAndAlliances(aiCountries, world);
    turnLogs.push(...diploLogs);

    // المرحلة د: تقييم شن الهجمات والحروب (بين دول الذكاء الاصطناعي أو ضد اللاعب)
    if (options.allowWar !== false && (world.year || 1) >= 2) {
      const warEvents = this.evaluateAndExecuteAIWars(aiCountries, world);
      turnLogs.push(...warEvents.logs);
      warAttackers.push(...warEvents.playerTargetedAttacks);
    }

    // المرحلة هـ: رسائل دبلوماسية وتفاعلية في شات الروم
    this.emitAIDiplomaticChatMessages(aiCountries, world, turnLogs);

    // حفظ سجل أحداث هذه الجولة لعرضه للاعب
    world.aiTurnLogs = turnLogs.slice(0, 25);

    return {
      warAttackers,
      logs: turnLogs
    };
  }

  // =========================================================================
  // 4. البناء الذكي للمنشآت والترقية والتسليح حسب عقلية ومستوى كل منافس
  // =========================================================================
  static executeAIEconomicAndMilitaryBuild(bot, world, isInitialSetup = false) {
    if (!bot || !window.BuildingsEngine) return null;
    const persona = this.getPersonaForCountry(bot);

    // 1. إدارة الخزينة والبنك والاقتراض الذكي عند الحاجة
    if (Number(bot.disposableRevenue || 0) < 120 && Number(bot.bank || 0) > 0) {
      if (window.EconomyEngine && typeof window.EconomyEngine.withdrawAllFromBank === "function") {
        window.EconomyEngine.withdrawAllFromBank(bot);
      } else {
        bot.disposableRevenue = (Number(bot.disposableRevenue) || 0) + Number(bot.bank || 0);
        bot.bank = 0;
      }
    }

    // سحب مدخرات الطوارئ إن كانت الدولة في خطر عسكري أو تحتاج سيولة للترقية
    if (!isInitialSetup && Number(bot.disposableRevenue || 0) < 80 && Number(bot.worldBankFund || 0) > 150) {
      if (window.EconomyEngine && typeof window.EconomyEngine.emergencyWithdrawFromWorldBank === "function") {
        window.EconomyEngine.emergencyWithdrawFromWorldBank(bot);
      }
    }

    // مكافأة كفاءة الإدارة حسب مستوى الذكاء (مبتدئ / متمرس / خبير / أسطوري)
    if (!isInitialSetup && persona.skillMultiplier > 1.0) {
      const bonus = Math.floor((Number(bot.budget) || 40) * (persona.skillMultiplier - 1.0));
      if (bonus > 0) {
        bot.disposableRevenue = (Number(bot.disposableRevenue) || 0) + bonus;
      }
    }

    // 2. تخصيص الميزانية الصارم بين الجيش والاقتصاد قبل أي شراء حتى يبني جيشاً قوياً منذ السنة الأولى!
    const totalAvailableCash = Number(bot.disposableRevenue || 0);
    const milRatio = isInitialSetup ? Math.max(0.35, persona.militaryBudgetRatio * 0.8) : persona.militaryBudgetRatio;
    const reservedMilBudget = Math.floor(totalAvailableCash * milRatio);
    const maxCivilianSpend = Math.max(0, totalAvailableCash - reservedMilBudget);
    const cashFloorForMilitary = reservedMilBudget;

    // 3. ضمان وجود سكن كافٍ وعمال وتجنيد
    this.ensureHousingAndWorkforce(bot);

    // 4. بناء المنشآت ذات العائد الموجب أولاً ضمن الميزانية المدنية المسموحة فقط (مع تجنب استنزاف ميزانية الجيش أو بناء المنشآت ذات التكلفة التشغيلية السالبة إلا عند الوفرة)
    const currentStage = Number(bot.stage) || 1;
    const stageCheck = window.BuildingsEngine.checkStageCompletion(bot, currentStage);
    if (!stageCheck.isComplete && Number(bot.disposableRevenue || 0) > cashFloorForMilitary + 50) {
      const stageItems = window.BuildingsEngine.RESOURCES_LIST.filter(r =>
        Number(r.stage) === currentStage &&
        Number(bot.buildings?.[r.id] || 0) === 0 &&
        (Number(r.revenue || 0) >= 0 || Number(bot.budget || 0) > Math.abs(Number(r.revenue || 0)) * 2.5)
      );
      stageItems.sort((a, b) => a.price - b.price);

      stageItems.forEach(item => {
        if (
          Number(bot.buildings?.[item.id] || 0) === 0 &&
          (Number(bot.disposableRevenue || 0) - item.price) >= cashFloorForMilitary
        ) {
          this.ensureHousingForBuilding(bot, item);
          if ((Number(bot.disposableRevenue || 0) - item.price) >= cashFloorForMilitary) {
            window.BuildingsEngine.purchaseResource(bot, item.id);
          }
        }
      });
    }

    // فحص الترقية للمرحلة التالية
    const afterCheck = window.BuildingsEngine.checkStageCompletion(bot, currentStage);
    if (afterCheck.isComplete && currentStage < 5) {
      const upgRes = window.BuildingsEngine.upgradeToStage(bot, currentStage + 1, world);
      if (upgRes && upgRes.success && window.ChronicleManager) {
        window.ChronicleManager.addSystemNotification(`🏆 ارتقت دولة [${bot.name}] بقيادة (${persona.leaderName}) إلى المرحلة ${bot.stage}: ${bot.stageName}!`);
      }
    }

    // 5. بناء منشآت اقتصادية تخصصية تولد فوائض للتجارة والتصدير بما تبقى من الميزانية المدنية
    const remainingCivBudget = Math.max(0, Number(bot.disposableRevenue || 0) - cashFloorForMilitary);
    if (remainingCivBudget >= 30) {
      this.spendEconomicBudgetSmartly(bot, persona, remainingCivBudget);
    }

    // 6. تجنيد وتسليح الجيش بالميزانية العسكرية المحجوزة بالكامل!
    const availableForMil = Number(bot.disposableRevenue || 0);
    this.spendMilitaryBudgetSmartly(bot, persona, availableForMil, world);

    // 7. تحديث المؤشرات النهائية
    if (window.MilitaryEngine && typeof window.MilitaryEngine.syncCountryWithMilitary === "function") {
      window.MilitaryEngine.syncCountryWithMilitary(bot);
    }
    return null;
  }

  static ensureHousingAndWorkforce(bot) {
    if (!bot || !window.BuildingsEngine) return;
    const housingOptions = ["skyscrapers", "residential_towers", "hotel", "apartments", "palace", "house_large", "house"];
    let unemployed = Math.max(0, Number(bot.population || 0) - Number(bot.employed || 0));

    let guard = 0;
    while (unemployed < 8 && guard < 6) {
      guard++;
      let built = false;
      for (const hId of housingOptions) {
        const res = window.BuildingsEngine.getResource(hId);
        if (!res) continue;
        if (Number(res.stage) <= (Number(bot.stage) || 1) && Number(bot.disposableRevenue || 0) >= res.price) {
          const r = window.BuildingsEngine.purchaseResource(bot, hId);
          if (r && r.success) {
            built = true;
            break;
          }
        }
      }
      if (!built) break;
      unemployed = Math.max(0, Number(bot.population || 0) - Number(bot.employed || 0));
    }
  }

  static ensureHousingForBuilding(bot, targetBuilding) {
    if (!targetBuilding || targetBuilding.populationType !== "workforce") return;
    const needed = Number(targetBuilding.populationValue || 0);
    let unemployed = Math.max(0, Number(bot.population || 0) - Number(bot.employed || 0));
    let guard = 0;
    while (unemployed < needed && guard < 5) {
      guard++;
      const houseId = (Number(bot.stage) >= 3 && Number(bot.disposableRevenue) >= 400 + targetBuilding.price) ? "apartments"
        : ((Number(bot.stage) >= 2 && Number(bot.disposableRevenue) >= 80 + targetBuilding.price) ? "house_large" : "house");
      const r = window.BuildingsEngine.purchaseResource(bot, houseId);
      if (!r || !r.success) break;
      unemployed = Math.max(0, Number(bot.population || 0) - Number(bot.employed || 0));
    }
  }

  static spendEconomicBudgetSmartly(bot, persona, maxSpend) {
    if (!bot || !window.BuildingsEngine || maxSpend <= 15) return;
    let spent = 0;
    const stage = Number(bot.stage) || 1;

    // أولويات المنشآت حسب العقلية
    const priorityIds = [];
    if (persona.id === "merchant_tycoon" || persona.id === "global_banker") {
      priorityIds.push("mall", "seaport", "intl_airport", "markets", "regional_airport", "marina", "shop_large", "shop", "boat", "ship", "cargo_carrier");
    } else if (persona.id === "energy_baron") {
      priorityIds.push("oil_field", "oil_well", "gas_well", "fuel_station", "gas_station_shop", "power_plant", "solar_farm", "wind_station", "water_well");
    } else if (persona.id === "tech_industrialist") {
      priorityIds.push("industrial_authority", "factory_large", "university", "factory", "educational_complex", "workshop", "school", "handicrafts", "classroom");
    } else if (persona.id === "naval_admiral") {
      priorityIds.push("seaport", "cargo_ship_large", "marina", "ship", "boat", "farm", "water_well");
    } else {
      priorityIds.push("factory", "oil_well", "markets", "production_farm", "livestock_farm", "poultry_farm", "farm", "shop", "clinic", "water_well");
    }

    // أيضاً سد العجوزات الحادة في الكهرباء والماء
    if (Number(bot.sectors?.water || 0) < 0) {
      priorityIds.unshift("water_desalination", "water_pump", "water_well");
    }
    if (Number(bot.sectors?.electricity || 0) < 0) {
      priorityIds.unshift("power_plant", "wind_station", "solar_farm", "power_generator");
    }

    for (let round = 0; round < 5; round++) {
      let boughtInRound = false;
      for (const bId of priorityIds) {
        const res = window.BuildingsEngine.getResource(bId);
        if (!res) continue;
        if (typeof res.stage === "number" && res.stage > stage) continue;
        if (spent + res.price > maxSpend || Number(bot.disposableRevenue || 0) < res.price) continue;

        this.ensureHousingForBuilding(bot, res);
        const purchase = window.BuildingsEngine.purchaseResource(bot, bId);
        if (purchase && purchase.success) {
          spent += res.price;
          boughtInRound = true;
          // إذا بنى مزرعة دواجن أو مواشي، يشتري معها طيوراً أو حيوانات لرفع العائد
          if (bId === "poultry_farm" || bId === "poultry_complex") {
            for (let k = 0; k < 5; k++) window.BuildingsEngine.purchaseResource(bot, "bird");
          } else if (bId === "livestock_farm" || bId === "livestock_complex") {
            for (let k = 0; k < 3; k++) window.BuildingsEngine.purchaseResource(bot, "animal");
          }
          break;
        }
      }
      if (!boughtInRound) break;
    }
  }

  static spendMilitaryBudgetSmartly(bot, persona, maxSpend, world) {
    if (!bot || !window.MilitaryEngine || !window.MilitaryData || maxSpend < 50) return;

    // التأكد من وجود سكان للتجنيد
    this.ensureHousingAndWorkforce(bot);

    // اختيار الوحدات القتالية المفضلة حسب شخصية البوت وميزانيته
    const branches = persona.preferredBranches || ["ground", "air", "naval", "defense"];
    let spent = 0;

    for (let step = 0; step < 8; step++) {
      const cash = Number(bot.disposableRevenue || 0);
      if (cash < 50 || spent >= maxSpend) break;

      const branch = branches[step % branches.length];
      const branchUnits = (window.MilitaryData.getUnitsByBranch(branch) || []).filter(u =>
        Number(u.power || 0) > 0 && u.price <= (cash * 0.85) && u.price <= (maxSpend - spent)
      );

      if (branchUnits.length === 0) {
        // fallback لأي وحدة مقاتلة متاحة
        const allAffordable = (window.MilitaryData.UNITS || []).filter(u =>
          Number(u.power || 0) > 0 && u.price <= cash && u.price <= (maxSpend - spent)
        );
        if (allAffordable.length === 0) break;
        allAffordable.sort((a, b) => b.power - a.power);
        const chosen = allAffordable[0];
        this.ensureHousingAndWorkforce(bot);
        const res = window.MilitaryEngine.purchaseUnit(bot, chosen.id, 1);
        if (res && res.success) spent += chosen.price;
        else break;
      } else {
        // اختيار أقوى وحدة مناسبة للميزانية
        branchUnits.sort((a, b) => b.power - a.power);
        const topPool = branchUnits.slice(0, Math.min(3, branchUnits.length));
        const chosen = topPool[Math.floor(Math.random() * topPool.length)];
        const qty = (cash >= chosen.price * 3 && chosen.price <= 600) ? 2 : 1;

        this.ensureHousingAndWorkforce(bot);
        const res = window.MilitaryEngine.purchaseUnit(bot, chosen.id, qty);
        if (res && res.success) {
          spent += chosen.price * qty;
        }
      }
    }

    // ابتكار وتصنيع سلاح سيادي خاص للدول الصناعية أو العسكرية المتقدمة
    if (
      (persona.id === "tech_industrialist" || persona.id === "imperial_warlord" || persona.id === "opportunist_hawk") &&
      (Number(bot.stage) >= 2 || Number(world?.year || 1) >= 4) &&
      (!Array.isArray(bot.customUnits) || bot.customUnits.length < 2) &&
      Number(bot.disposableRevenue || 0) >= 1200
    ) {
      this.forgeCustomSovereignWeaponForAI(bot, persona);
    }
  }

  static forgeCustomSovereignWeaponForAI(bot, persona) {
    if (!bot || !window.WeaponForge) return;
    if (!Array.isArray(bot.customUnits)) bot.customUnits = [];
    const customId = "custom_ai_" + bot.id + "_" + (bot.customUnits.length + 1);
    if (bot.customUnits.some(u => u.id === customId)) return;

    const branch = (persona.preferredBranches && persona.preferredBranches[0]) || "ground";
    const weaponNames = {
      ground: `دبابة ${bot.name} السيادية`,
      air: `مقاتلة صقر ${bot.name}`,
      naval: `مدمرة ${bot.name} الشبحية`,
      defense: `منظومة درع ${bot.name}`
    };

    const customUnit = {
      id: customId,
      name: weaponNames[branch] || `سلاح ${bot.name} المبتكر`,
      branch: branch === "defense" ? "defense" : branch,
      price: 900,
      crew: 2,
      power: 18,
      range: 360,
      combatRange: 360,
      ammo: 4,
      fuel: 1,
      targetDomains: ["ground", "naval", "air"],
      isCustom: true,
      creatorCountryId: bot.id,
      creatorCountryName: bot.name
    };

    bot.customUnits.push(customUnit);
    if (typeof window.WeaponForge.registerUnitToGame === "function") {
      window.WeaponForge.registerUnitToGame(customUnit);
    }
    if (window.MilitaryEngine) {
      window.MilitaryEngine.purchaseUnit(bot, customUnit.id, 2);
    }
  }

  // =========================================================================
  // 5. التبادل التجاري وشراء المنتجات والنقاط والأسلحة بين الدول (Trade & Market)
  // =========================================================================
  static executeAITradeAndMarketPurchases(aiCountries, world) {
    const logs = [];
    if (!window.TradeManager || !world) return logs;

    const allCountries = world.getAllCountries() || [];
    const playerCountry = this.getPlayerCountry(world);
    const sectorKeys = Object.keys(window.TradeManager.sectorMetadata || {});

    // 1. قيام دول الذكاء الاصطناعي بشراء المنتجات والنقاط من الدول الأخرى (مع إعطاء أولوية لشراء فوائض اللاعب والدول الحليفة!)
    aiCountries.forEach(buyerBot => {
      const persona = this.getPersonaForCountry(buyerBot);
      if (Math.random() > (persona.tradeFocus + 0.45)) return;

      // البحث عن القطاعات التي تعاني فيها دولة البوت من عجز أو انخفاض
      const neededSectors = sectorKeys.filter(secKey => {
        const pts = window.TradeManager.getSectorPoints(buyerBot, secKey);
        return pts < 0 || (persona.tradeFocus >= 0.55 && pts < 15);
      });

      if (neededSectors.length === 0) return;

      // ترتيب القطاعات الأكثر عجزاً أولاً
      neededSectors.sort((a, b) =>
        window.TradeManager.getSectorPoints(buyerBot, a) - window.TradeManager.getSectorPoints(buyerBot, b)
      );

      for (const secKey of neededSectors.slice(0, 2)) {
        // تجنب تكرار نفس الصفقة في نفس القطاع لنفس المستورد بكثرة
        const existingDealsCount = (world.tradeDeals || []).filter(
          d => String(d.importerId) === String(buyerBot.id) && d.sectorKey === secKey
        ).length;
        if (existingDealsCount >= 2) continue;

        // البحث عن الدول المصدرة التي تملك فائضاً >= 2 نقطة
        const candidates = allCountries.filter(exp => {
          if (String(exp.id) === String(buyerBot.id)) return false;
          const surplus = window.TradeManager.getSectorPoints(exp, secKey);
          return surplus >= 2;
        });

        if (candidates.length === 0) continue;

        // تفضيل الشراء من اللاعب البشري (إذا كان لديه فائض) أو من الحلفاء أو الأرخص سعراً
        candidates.sort((a, b) => {
          const aIsPlayer = playerCountry && String(a.id) === String(playerCountry.id) ? 1 : 0;
          const bIsPlayer = playerCountry && String(b.id) === String(playerCountry.id) ? 1 : 0;
          if (aIsPlayer !== bIsPlayer) return bIsPlayer - aIsPlayer;

          const relA = this.getRelation(buyerBot, a.id);
          const relB = this.getRelation(buyerBot, b.id);
          return relB - relA;
        });

        const exporter = candidates[0];
        const expSurplus = window.TradeManager.getSectorPoints(exporter, secKey);
        const deficit = Math.abs(Math.min(0, window.TradeManager.getSectorPoints(buyerBot, secKey)));
        const pointsToBuy = Math.max(2, Math.min(Math.floor(expSurplus * 0.6), deficit > 0 ? deficit : 8, 25));

        const unitPrice = window.TradeManager.calculateDynamicPointPrice(exporter, secKey, buyerBot, world);
        const duration = Math.floor(Math.random() * 3) + 2; // 2 إلى 4 سنوات

        const dealRes = window.TradeManager.createDeal(world, exporter.id, buyerBot.id, secKey, pointsToBuy, duration, unitPrice);
        if (dealRes && dealRes.success) {
          this.adjustRelation(world, buyerBot.id, exporter.id, 8);
          const secName = window.TradeManager.sectorMetadata[secKey]?.name || secKey;
          const totalVal = Math.round(pointsToBuy * unitPrice);
          const logMsg = `🚢 صفقة تجارية: اشترت [${buyerBot.name}] ${pointsToBuy} نقطة في قطاع (${secName}) من دولة [${exporter.name}] بقيمة $${totalVal.toLocaleString()}/سنة!`;
          logs.push(logMsg);

          if (playerCountry && String(exporter.id) === String(playerCountry.id)) {
            if (window.showGameToast) {
              window.showGameToast(`🚢 اشترت دولة [${buyerBot.name}] منتجات ونقاط (${secName}) من دولتك بقيمة $${totalVal.toLocaleString()} سنوياً!`, "💰");
            }
          }
          break; // صفقة واحدة لكل بوت في السنة تكفي لعدم الإغراق
        }
      }
    });

    // 2. قيام الدول التجارية الغنية بتصدير فوائضها للدول التي تعاني من عجز (بما فيها دولة اللاعب إذا كانت تعاني من عجز!)
    aiCountries.forEach(exporterBot => {
      const persona = this.getPersonaForCountry(exporterBot);
      if (persona.tradeFocus < 0.7) return;

      for (const secKey of sectorKeys) {
        const mySurplus = window.TradeManager.getSectorPoints(exporterBot, secKey);
        if (mySurplus < 12) continue;

        const needyCountries = allCountries.filter(imp => {
          if (String(imp.id) === String(exporterBot.id)) return false;
          const pts = window.TradeManager.getSectorPoints(imp, secKey);
          return pts < -2 && (Number(imp.budget || 0) > 30 || Number(imp.disposableRevenue || 0) > 100);
        });

        if (needyCountries.length === 0) continue;
        const targetImp = needyCountries[Math.floor(Math.random() * needyCountries.length)];
        const alreadyHasDeal = (world.tradeDeals || []).some(
          d => String(d.exporterId) === String(exporterBot.id) && String(d.importerId) === String(targetImp.id) && d.sectorKey === secKey
        );
        if (alreadyHasDeal) continue;

        const pts = Math.min(10, Math.floor(mySurplus * 0.4), Math.abs(window.TradeManager.getSectorPoints(targetImp, secKey)));
        if (pts < 2) continue;

        const price = window.TradeManager.calculateDynamicPointPrice(exporterBot, secKey, targetImp, world);
        const res = window.TradeManager.createDeal(world, exporterBot.id, targetImp.id, secKey, pts, 3, price);
        if (res && res.success) {
          this.adjustRelation(world, exporterBot.id, targetImp.id, 6);
          const secName = window.TradeManager.sectorMetadata[secKey]?.name || secKey;
          logs.push(`📦 تصدير منتجات: صدّرت [${exporterBot.name}] ${pts} نقطة (${secName}) إلى [${targetImp.name}] بسعر $${price}/نقطة.`);
          break;
        }
      }
    });

    // 3. صفقات شراء وبيع الأسلحة بين دول الذكاء الاصطناعي أو مع اللاعب
    aiCountries.forEach(sellerBot => {
      if (!Array.isArray(sellerBot.customUnits) || sellerBot.customUnits.length === 0) return;
      const customU = sellerBot.customUnits[0];
      const ownedQty = Number(sellerBot.military?.inventory?.[customU.id] || 0);
      if (ownedQty <= 1) return;

      const potentialBuyers = aiCountries.filter(b =>
        String(b.id) !== String(sellerBot.id) &&
        Number(b.disposableRevenue || 0) >= customU.price &&
        this.getRelation(sellerBot, b.id) >= 45
      );
      if (potentialBuyers.length > 0 && Math.random() < 0.35) {
        const buyer = potentialBuyers[0];
        buyer.disposableRevenue -= customU.price;
        sellerBot.disposableRevenue = (Number(sellerBot.disposableRevenue) || 0) + customU.price;
        sellerBot.military.inventory[customU.id] -= 1;
        if (!buyer.military.inventory) buyer.military.inventory = {};
        buyer.military.inventory[customU.id] = (Number(buyer.military.inventory[customU.id]) || 0) + 1;
        if (window.MilitaryEngine) {
          window.MilitaryEngine.syncCountryWithMilitary(sellerBot);
          window.MilitaryEngine.syncCountryWithMilitary(buyer);
        }
        logs.push(`🎖️ صفقة سلاح سيادي: اشترت [${buyer.name}] سلاح [${customU.name}] من [${sellerBot.name}] مقابل $${customU.price.toLocaleString()}!`);
      }
    });

    return logs;
  }

  // =========================================================================
  // 6. الدبلوماسية، التحالفات المشتركة، المنح المالية، والقروض السيادية
  // =========================================================================
  static executeAIDiplomacyAndAlliances(aiCountries, world) {
    const logs = [];
    const playerCountry = this.getPlayerCountry(world);

    aiCountries.forEach(bot => {
      const persona = this.getPersonaForCountry(bot);
      const currentAllies = this.getAlliesOf(world, bot.id);

      // 1. تشكيل تحالفات بين دول الذكاء الاصطناعي أو عرض تحالف على اللاعب
      if (currentAllies.length < 2 && Math.random() < (persona.diplomacy * 0.45)) {
        const candidates = (world.countries || []).filter(other =>
          String(other.id) !== String(bot.id) &&
          !this.areAllied(world, bot.id, other.id) &&
          this.getRelation(bot, other.id) >= 48
        );

        if (candidates.length > 0) {
          // ترتيب حسب التقارب في العلاقة والقوة
          candidates.sort((a, b) => this.getRelation(bot, b.id) - this.getRelation(bot, a.id));
          const partner = candidates[0];

          // إذا كان الشريك هو اللاعب البشري، نتحقق إن كانت العلاقة طيبة ونعرض عليه التحالف أو نبرمه إذا كان ودياً
          if (playerCountry && String(partner.id) === String(playerCountry.id)) {
            if (this.getRelation(bot, playerCountry.id) >= 55 && !world.pendingPlayerAllianceOffer) {
              world.pendingPlayerAllianceOffer = {
                fromCountryId: bot.id,
                fromCountryName: bot.name,
                leaderName: persona.leaderName,
                personaTitle: persona.title,
                year: world.year
              };
              logs.push(`🤝 عرض تحالف دبلوماسي: تعرض دولة [${bot.name}] بقيادة (${persona.leaderName}) معاهدة تحالف مشترك مع دولتك [${playerCountry.name}]!`);
            }
          } else {
            // تحالف بين دولتين من الذكاء الاصطناعي
            const partnerPersona = this.getPersonaForCountry(partner);
            if (partnerPersona.diplomacy >= 0.40 || Math.random() < 0.6) {
              const res = this.createAlliance(world, bot, partner, 5);
              if (res && res.success) {
                logs.push(res.msg);
              }
            }
          }
        }
      }

      // 2. إرسال منح مالية للحلفاء المتعثرين أو تقديم قرض سيادي عبر البنك الدولي
      const richCash = Number(bot.disposableRevenue || 0);
      if (richCash > 800 && persona.diplomacy >= 0.65 && Math.random() < 0.35) {
        const allies = this.getAlliesOf(world, bot.id);
        const needyAlly = allies.find(a => Number(a.disposableRevenue || 0) < 150);
        if (needyAlly && window.EconomyEngine && typeof window.EconomyEngine.sendDonation === "function") {
          const aidAmount = Math.min(300, Math.floor(richCash * 0.2));
          const aidRes = window.EconomyEngine.sendDonation(bot, needyAlly, aidAmount);
          if (aidRes && aidRes.success) {
            this.adjustRelation(world, bot.id, needyAlly.id, 15);
            logs.push(`🎁 دعم تحالف: قدمت [${bot.name}] منحة مالية بقيمة $${aidAmount.toLocaleString()} لحليفتها [${needyAlly.name}]!`);
          }
        }
      }

      // 3. منح قروض سيادية للدول التي تحتاج سيولة (خاصة المصرفي الدولي وقطب الطاقة)
      if ((persona.id === "global_banker" || persona.id === "energy_baron" || persona.tradeFocus >= 0.85) &&
          Number(bot.disposableRevenue || 0) >= 1000 &&
          window.WorldBankManager &&
          Math.random() < 0.30) {
        const borrowers = (world.countries || []).filter(c =>
          String(c.id) !== String(bot.id) &&
          Number(c.disposableRevenue || 0) < 250 &&
          Number(c.budget || 0) >= 80 &&
          !(world.sovereignLoans || []).some(l => String(l.borrowerId) === String(c.id))
        );
        if (borrowers.length > 0) {
          const targetBorrower = borrowers[0];
          const loanAmt = Math.min(500, Math.floor(Number(bot.disposableRevenue) * 0.25));
          if (loanAmt >= 100) {
            const loanRes = window.WorldBankManager.issueSovereignLoan(world, bot.id, targetBorrower.id, loanAmt, 4, "revenue");
            if (loanRes && loanRes.success) {
              this.adjustRelation(world, bot.id, targetBorrower.id, 10);
              logs.push(`🏦 قرض سيادي: أقرضت [${bot.name}] دولة [${targetBorrower.name}] مبلغ $${loanAmt.toLocaleString()} يسدد على 4 سنوات.`);
            }
          }
        }
      }
    });

    return logs;
  }

  // =========================================================================
  // 7. شن الهجمات والحروب التفاعلية (AI War & Coalition Attacks)
  // =========================================================================
  static evaluateAndExecuteAIWars(aiCountries, world) {
    const logs = [];
    const playerTargetedAttacks = [];
    if (!window.WarEngine || !world) return { logs, playerTargetedAttacks };

    const playerCountry = this.getPlayerCountry(world);
    const allCountries = world.getAllCountries() || [];

    // نرتب دول الذكاء الاصطناعي حسب النزعة الهجومية والقوة العسكرية
    const potentialAttackers = [...aiCountries].filter(bot => {
      const power = window.WarEngine.getStandingArmyPower(bot);
      const units = window.WarEngine.getStandingArmyCount(bot);
      return units >= 2 && power >= 1.5;
    });

    potentialAttackers.sort((a, b) => {
      const pA = this.getPersonaForCountry(a);
      const pB = this.getPersonaForCountry(b);
      return (pB.aggression * window.WarEngine.getStandingArmyPower(b)) -
             (pA.aggression * window.WarEngine.getStandingArmyPower(a));
    });

    let warsLaunchedThisYear = 0;
    const maxWarsPerYear = 2; // حد أقصى حربين في السنة الواحدة لمنع الفوضى

    for (const attacker of potentialAttackers) {
      if (warsLaunchedThisYear >= maxWarsPerYear) break;

      const persona = this.getPersonaForCountry(attacker);
      // احتمالية شن هجوم تعتمد على عدوانية الشخصية
      const attackChance = persona.aggression * 0.55;
      if (Math.random() > attackChance) continue;

      const myPower = window.WarEngine.getStandingArmyPower(attacker);
      const myAllies = this.getAlliesOf(world, attacker.id).filter(a => window.WarEngine.getStandingArmyCount(a) > 0);
      const alliesPower = myAllies.reduce((s, a) => s + window.WarEngine.getStandingArmyPower(a) * 0.5, 0);
      const totalOffensivePower = myPower + alliesPower;

      // البحث عن هدف مناسب (غير حليف، وليس بينهما معاهدة جزية نشطة)
      const targets = allCountries.filter(def => {
        if (String(def.id) === String(attacker.id)) return false;
        if (this.areAllied(world, attacker.id, def.id)) return false;
        const alreadyPayingTribute = (world.tributes || []).some(
          t => String(t.defenderId) === String(def.id) && t.yearsRemaining > 0
        );
        if (alreadyPayingTribute) return false;

        const defPower = window.WarEngine.getStandingArmyPower(def);
        const defAllies = this.getAlliesOf(world, def.id);
        const defTotalPower = defPower + defAllies.reduce((s, a) => s + window.WarEngine.getStandingArmyPower(a) * 0.5, 0);

        // المهاجم يهاجم إذا كانت قوته مع حلفائه تفوق أو تقارب قوة الهدف (أو إذا كان عدوانياً جداً)
        const requiredRatio = persona.aggression >= 0.75 ? 0.75 : 1.05;
        return totalOffensivePower >= Math.max(1.2, defTotalPower * requiredRatio);
      });

      if (targets.length === 0) continue;

      // اختيار الهدف بذكاء وتنويع بين منافسي الذكاء الاصطناعي واللاعب البشري
      targets.sort((a, b) => {
        const scoreA = (Number(a.bank || 0) + Number(a.disposableRevenue || 0) + Number(a.worldBankFund || 0) + Number(a.budget || 0)) / Math.max(2.0, window.WarEngine.getStandingArmyPower(a) + 1) - this.getRelation(attacker, a.id) * 1.5 + (Math.random() * 40);
        const scoreB = (Number(b.bank || 0) + Number(b.disposableRevenue || 0) + Number(b.worldBankFund || 0) + Number(b.budget || 0)) / Math.max(2.0, window.WarEngine.getStandingArmyPower(b) + 1) - this.getRelation(attacker, b.id) * 1.5 + (Math.random() * 40);
        return scoreB - scoreA;
      });

      let targetDefender = targets[0];
      // لضمان اشتعال الحروب بين دول الذكاء الاصطناعي أيضاً وعدم استهداف اللاعب وحده في كل مرة
      if (playerCountry && String(targetDefender.id) === String(playerCountry.id)) {
        const aiTargets = targets.filter(t => String(t.id) !== String(playerCountry.id));
        const shouldTargetAIInstead = (world.year || 1) <= 2 || playerTargetedAttacks.length > 0 || (aiTargets.length > 0 && Math.random() < 0.65);
        if (shouldTargetAIInstead && aiTargets.length > 0) {
          targetDefender = aiTargets[0];
        }
      }
      warsLaunchedThisYear++;
      this.adjustRelation(world, attacker.id, targetDefender.id, -30);

      // تجهيز قوات المهاجم وحلفائه
      const atkForces = this.buildMobilizedForcesForAI(attacker, persona.aggression >= 0.75 ? 1.0 : 0.85);
      const atkCoalition = [{ country: attacker, forces: atkForces }];
      myAllies.forEach(ally => {
        const allyForces = this.buildMobilizedForcesForAI(ally, 0.5);
        if (Object.keys(allyForces).length > 0) {
          atkCoalition.push({ country: ally, forces: allyForces });
        }
      });

      // إذا كان المستهدف هو اللاعب البشري -> نفتح له نافذة التحذير والخيارات الثلاثة (الاستسلام / الجزية / خوض المعركة الحية)!
      if (playerCountry && String(targetDefender.id) === String(playerCountry.id) && playerTargetedAttacks.length === 0) {
        playerTargetedAttacks.push({
          attacker: attacker,
          defender: targetDefender,
          atkCoalition: atkCoalition
        });
        logs.push(`🚨 إعلان حرب: حشدت دولة [${attacker.name}] بقيادة (${persona.leaderName}) جيوشها للهجوم على دولتك [${targetDefender.name}]!`);
      } else if (this.isAICountry(targetDefender)) {
        // حرب بين دولتين من الذكاء الاصطناعي -> نحسمها تكتيكياً ونعلن نتائجها وغنائمها في العالم والشات!
        const aiWarLog = this.resolveAIvsAIWar(attacker, targetDefender, atkCoalition, world);
        if (aiWarLog) logs.push(aiWarLog);
      }
    }

    return { logs, playerTargetedAttacks };
  }

  static buildMobilizedForcesForAI(country, ratio = 1.0) {
    const forces = {};
    if (!country || !country.military || !country.military.inventory) return forces;
    const inv = country.military.inventory;
    Object.keys(inv).forEach(uid => {
      if (window.WarEngine && !window.WarEngine.isCombatUnit(uid)) return;
      const avail = Math.max(0, Math.floor(Number(inv[uid] || 0)));
      if (avail > 0) {
        const cnt = Math.max(1, Math.ceil(avail * ratio));
        forces[uid] = Math.min(avail, cnt);
      }
    });
    return forces;
  }

  /**
   * اتخاذ قرار ذكي عندما يهاجم اللاعب دولة تابعة للذكاء الاصطناعي
   * يختار بين: (CONFRONT خوض المعركة مع إسناد الحلفاء) أو (PAY_TRIBUTE دفع الجزية) أو (SURRENDER الاستسلام)
   */
  static decideAIDefenderResponse(attackerCountry, defenderCountry, atkCoalition, world) {
    world = world || window.currentWorld;
    const persona = this.getPersonaForCountry(defenderCountry);

    // حساب قوة الهجوم القادمة
    let incomingPower = 0;
    (atkCoalition || []).forEach(m => {
      const summary = window.WarEngine.calculateForcesSummary(m.forces || {});
      incomingPower += summary.totalPower;
    });

    // حساب قوة المدافع وحلفائه
    const myStandingUnits = window.WarEngine.getStandingArmyCount(defenderCountry);
    const myStandingPower = window.WarEngine.getStandingArmyPower(defenderCountry);
    const defAllies = this.getAlliesOf(world, defenderCountry.id).filter(a =>
      !(atkCoalition || []).some(m => String(m.country.id) === String(a.id)) &&
      window.WarEngine.getStandingArmyCount(a) > 0
    );

    const alliesSupportPower = defAllies.reduce((s, a) => s + window.WarEngine.getStandingArmyPower(a) * 0.5, 0);
    const totalDefPower = myStandingPower + alliesSupportPower;

    // إذا لم يكن لدى الدولة المدافعة أي جيش مقاتل
    if (myStandingUnits <= 0 && defAllies.length === 0) {
      // إذا كان لديها سيولة تدفع الجزية، وإلا تستسلم
      const tribAmt = window.WarEngine.calculateTributeOfferAmount(defenderCountry);
      if (tribAmt > 0 && persona.aggression < 0.7) {
        return { decision: "PAY_TRIBUTE", defCoalition: [{ country: defenderCountry, forces: {} }] };
      }
      return { decision: "SURRENDER", defCoalition: [{ country: defenderCountry, forces: {} }] };
    }

    const powerRatio = totalDefPower / Math.max(1, incomingPower);

    // القادة العسكريون والمدافعون يقاتلون حتى لو كانت كفتهم أضعف قليلاً
    const fightThreshold = persona.aggression >= 0.7 || persona.id === "fortress_guardian" ? 0.35 : 0.55;

    if (powerRatio >= fightThreshold) {
      const defForces = this.buildMobilizedForcesForAI(defenderCountry, 1.0);
      const defCoalition = [{ country: defenderCountry, forces: defForces }];
      defAllies.forEach(ally => {
        const allyForces = this.buildMobilizedForcesForAI(ally, 0.5);
        if (Object.keys(allyForces).length > 0) {
          defCoalition.push({ country: ally, forces: allyForces });
        }
      });
      return {
        decision: "CONFRONT",
        defCoalition,
        alliesJoined: defAllies.map(a => a.name)
      };
    }

    // إذا كان الهجوم ساحقاً جداً (أكثر من ضعفي أو ثلاثة أضعاف قوة المدافع)
    if (persona.tradeFocus >= 0.75 || persona.diplomacy >= 0.75) {
      return { decision: "PAY_TRIBUTE", defCoalition: [{ country: defenderCountry, forces: {} }] };
    }

    return { decision: "SURRENDER", defCoalition: [{ country: defenderCountry, forces: {} }] };
  }

  /**
   * حسم المعارك التي تقع بين دول الذكاء الاصطناعي وتطبيق الخسائر والجزية
   */
  static resolveAIvsAIWar(attacker, defender, atkCoalition, world) {
    const defDecision = this.decideAIDefenderResponse(attacker, defender, atkCoalition, world);
    const allyNames = atkCoalition.length > 1 ? ` (بإسناد حلفائها: ${atkCoalition.slice(1).map(m => m.country.name).join("، ")})` : "";

    if (defDecision.decision === "PAY_TRIBUTE") {
      const out = window.WarEngine.executeDefenderPayTribute(atkCoalition, defDecision.defCoalition, world);
      const msg = `⚔️💰 حرب دبلوماسية: زحف جيش [${attacker.name}]${allyNames} نحو [${defender.name}]، فاضطرت [${defender.name}] لدفع جزية فورية ($${Number(out.amount || 0).toLocaleString()}) وتوقيع معاهدة جزية خمسية!`;
      if (window.ChronicleManager) window.ChronicleManager.addSystemNotification(msg);
      return msg;
    }

    if (defDecision.decision === "SURRENDER") {
      const out = window.WarEngine.executeDefenderSurrender(atkCoalition, defDecision.defCoalition, world);
      const msg = `🏳️ اجتياح عسكري: استسلمت دولة [${defender.name}] أمام زحف جيش [${attacker.name}]${allyNames} وصودرت غنائم بقيمة $${Number(out.seizedAmount || 0).toLocaleString()}!`;
      if (window.ChronicleManager) window.ChronicleManager.addSystemNotification(msg);
      return msg;
    }

    // معركة ميدانية بين الطرفين
    const defCoalition = defDecision.defCoalition;
    let atkPower = 0;
    atkCoalition.forEach(m => { atkPower += window.WarEngine.calculateForcesSummary(m.forces).totalPower; });
    let defPower = 0;
    defCoalition.forEach(m => { defPower += window.WarEngine.calculateForcesSummary(m.forces).totalPower; });

    const atkRoll = atkPower * (0.85 + Math.random() * 0.35);
    const defRoll = defPower * (0.90 + Math.random() * 0.35); // أفضلية طفيفة للأرض

    const atkWon = atkRoll >= defRoll;
    const winnerLossRatio = 0.20 + Math.random() * 0.15;
    const loserLossRatio = 0.55 + Math.random() * 0.25;

    atkCoalition.forEach(m => {
      const ratio = atkWon ? winnerLossRatio : loserLossRatio;
      const losses = {};
      Object.keys(m.forces || {}).forEach(uid => {
        losses[uid] = Math.floor(Number(m.forces[uid] || 0) * ratio);
      });
      window.WarEngine.applyBattleLosses(m.country, losses);
    });

    defCoalition.forEach(m => {
      const ratio = atkWon ? loserLossRatio : winnerLossRatio;
      const losses = {};
      Object.keys(m.forces || {}).forEach(uid => {
        losses[uid] = Math.floor(Number(m.forces[uid] || 0) * ratio);
      });
      window.WarEngine.applyBattleLosses(m.country, losses);
    });

    if (atkWon) {
      const out = window.WarEngine.resolveCoalitionPostBattleVictory(atkCoalition, defCoalition, world, "FULL", "FULL");
      const msg = `🔥 معركة كبرى: انتصر تحالف [${attacker.name}]${allyNames} على جيش [${defender.name}] وفرض جزية خمسية ($${Number(out.amount || 0).toLocaleString()})!`;
      if (window.ChronicleManager) window.ChronicleManager.addSystemNotification(msg);
      return msg;
    } else {
      const defAlliesText = defCoalition.length > 1 ? ` وحلفائها (${defCoalition.slice(1).map(m => m.country.name).join("، ")})` : "";
      const msg = `🛡️ صمود أسطوري: تمكن جيش [${defender.name}]${defAlliesText} من سحق ودحر الحملة الغازية لدولة [${attacker.name}]!`;
      if (window.ChronicleManager) window.ChronicleManager.addSystemNotification(msg);
      return msg;
    }
  }

  // =========================================================================
  // 8. التفاعل الحي في محادثات الروم والرد على رسائل اللاعب
  // =========================================================================
  static emitAIDiplomaticChatMessages(aiCountries, world, turnLogs) {
    if (!world || !Array.isArray(aiCountries) || aiCountries.length === 0) return;
    const playerCountry = this.getPlayerCountry(world);

    // اختيار قائد أو اثنين للتعليق في شات الروم على مجريات السنة الحالية
    const speakers = [...aiCountries].sort(() => Math.random() - 0.5).slice(0, 2);
    speakers.forEach(bot => {
      if (Math.random() > 0.65) return;
      const persona = this.getPersonaForCountry(bot);
      const myPower = window.WarEngine ? window.WarEngine.getStandingArmyPower(bot) : 0;
      const pName = playerCountry ? playerCountry.name : "الدول المجاورة";

      let phrases = [];
      if (persona.aggression >= 0.75) {
        phrases = [
          `⚔️ جيش [${bot.name}] وصلت قوته إلى (${myPower})! من يجرؤ على الوقوف في طريقنا؟`,
          `⚠️ نحذر الدول الضعيفة: إما التحالف معنا أو الاستعداد لدفع الجزية!`,
          `🦅 عيون صقورنا ترقب ثروات [${pName}]... حصّنوا قلاعكم جيداً!`
        ];
      } else if (persona.tradeFocus >= 0.8) {
        phrases = [
          `🚢 أسواق [${bot.name}] مفتوحة لتبادل وشراء كافة المنتجات والنقاط الفائضة!`,
          `💎 نبحث عن شركاء تجاريين جدد لرفع المؤشر العام وعملة الدولة.`,
          `🏦 خزائننا جاهزة لتمويل الصفقات التجارية الكبرى مع [${pName}]!`
        ];
      } else if (persona.diplomacy >= 0.8) {
        phrases = [
          `🤝 ندعو قائد [${pName}] وبقية الدول لعقد معاهدة تحالف ودفاع مشترك!`,
          `🛡️ القوة في الاتحاد! حلفاؤنا ينعمون بالأمان والازدهار الاقتصادي.`,
          `🌟 نتمنى سنة مالية مزدهرة لجميع الدول المسالمة في المجلس.`
        ];
      } else {
        phrases = [
          `🏗️ نواصل تطوير البنية التحتية والمصانع في العاصمة للانتقال للمرحلة القادمة!`,
          `🛡️ قواتنا المسلحة في أهبة الاستعداد لحماية حدود [${bot.name}].`
        ];
      }

      const chosenText = phrases[Math.floor(Math.random() * phrases.length)];
      world.addChatMessage({
        senderId: bot.ownerPlayerId || ("ai_" + bot.id),
        senderName: `${persona.leaderName} (${persona.title})`,
        countryId: bot.id,
        countryName: bot.name,
        flag: bot.flag,
        text: chosenText,
        year: world.year || 1,
        isSystem: false,
        timestamp: Date.now()
      });
    });
  }

  /**
   * التفاعل الفوري عندما يرسل اللاعب رسالة في شات الروم
   */
  static handlePlayerChatMessage(text, world) {
    world = world || window.currentWorld;
    if (!world || !text) return;
    const aiCountries = (world.countries || []).filter(c => this.isAICountry(c));
    if (aiCountries.length === 0) return;

    const playerCountry = this.getPlayerCountry(world);
    const clean = String(text).trim();

    setTimeout(() => {
      // 1. إذا طلب اللاعب تحالفاً في الشات
      if (clean.includes("تحالف") || clean.includes("حليف") || clean.includes("دفاع")) {
        const diploBots = aiCountries.filter(b => !this.areAllied(world, b.id, playerCountry?.id));
        if (diploBots.length > 0 && playerCountry) {
          diploBots.sort((a, b) => this.getPersonaForCountry(b).diplomacy - this.getPersonaForCountry(a).diplomacy);
          const responder = diploBots[0];
          const persona = this.getPersonaForCountry(responder);
          this.createAlliance(world, responder, playerCountry, 5);
          world.addChatMessage({
            senderId: responder.ownerPlayerId,
            senderName: `${persona.leaderName} (${persona.title})`,
            countryId: responder.id,
            countryName: responder.name,
            flag: responder.flag,
            text: `🤝 نرحب بدعوتك يا قائد [${playerCountry.name}]! وقعنا معك رسمياً معاهدة تحالف ودفاع مشترك لمدة 5 سنوات، وسنقف معك في أي حرب!`,
            year: world.year || 1,
            isSystem: false,
            timestamp: Date.now()
          });
          if (window.showGameToast) {
            window.showGameToast(`🤝 استجابت دولة [${responder.name}] وأبرمت معك تحالفاً مشتركاً!`, "🛡️");
          }
          if (window.ChronicleManager) window.ChronicleManager.render(world, true);
          return;
        }
      }

      // 2. إذا طلب اللاعب تجارة أو شراء منتجات
      if (clean.includes("تجار") || clean.includes("صفق") || clean.includes("شراء") || clean.includes("منتج")) {
        const tradeBots = aiCountries.filter(b => this.getPersonaForCountry(b).tradeFocus >= 0.6);
        if (tradeBots.length > 0 && playerCountry && window.TradeManager) {
          const responder = tradeBots[Math.floor(Math.random() * tradeBots.length)];
          const persona = this.getPersonaForCountry(responder);
          // محاولة شراء أي فائض لدى اللاعب فوراً
          const sectorKeys = Object.keys(window.TradeManager.sectorMetadata || {});
          const playerSurplusSec = sectorKeys.find(k => window.TradeManager.getSectorPoints(playerCountry, k) >= 3);
          let replyText = `🚢 أهلاً بك يا قائد [${playerCountry.name}]! نحن في [${responder.name}] جاهزون لاستيراد أي فائض في قطاعاتك وتزويدك بما ينقصك في تاب التجارة.`;

          if (playerSurplusSec) {
            const avail = window.TradeManager.getSectorPoints(playerCountry, playerSurplusSec);
            const qty = Math.min(8, Math.max(2, Math.floor(avail * 0.5)));
            const price = window.TradeManager.calculateDynamicPointPrice(playerCountry, playerSurplusSec, responder, world);
            const dealRes = window.TradeManager.createDeal(world, playerCountry.id, responder.id, playerSurplusSec, qty, 3, price);
            if (dealRes && dealRes.success) {
              const secName = window.TradeManager.sectorMetadata[playerSurplusSec]?.name || playerSurplusSec;
              replyText = `🚢 استجابة فورية لطلبك التجاري: اشترينا من دولتك [${playerCountry.name}] عدد ${qty} نقاط (${secName}) بسعر $${price} للنقطة لمدة 3 سنوات!`;
              if (window.showGameToast) window.showGameToast(replyText, "🚢");
            }
          }

          world.addChatMessage({
            senderId: responder.ownerPlayerId,
            senderName: `${persona.leaderName} (${persona.title})`,
            countryId: responder.id,
            countryName: responder.name,
            flag: responder.flag,
            text: replyText,
            year: world.year || 1,
            isSystem: false,
            timestamp: Date.now()
          });
          if (window.ChronicleManager) window.ChronicleManager.render(world, true);
          return;
        }
      }

      // 3. إذا طلب اللاعب قرضاً أو منحة مالية
      if (clean.includes("قرض") || clean.includes("منح") || clean.includes("مساعد") || clean.includes("مال")) {
        const richBots = aiCountries.filter(b => Number(b.disposableRevenue || 0) >= 300);
        if (richBots.length > 0 && playerCountry) {
          richBots.sort((a, b) => Number(b.disposableRevenue) - Number(a.disposableRevenue));
          const donor = richBots[0];
          const persona = this.getPersonaForCountry(donor);
          const gift = Math.min(250, Math.floor(Number(donor.disposableRevenue) * 0.25));
          if (gift >= 50 && window.EconomyEngine) {
            window.EconomyEngine.sendDonation(donor, playerCountry, gift);
            world.addChatMessage({
              senderId: donor.ownerPlayerId,
              senderName: `${persona.leaderName} (${persona.title})`,
              countryId: donor.id,
              countryName: donor.name,
              flag: donor.flag,
              text: `💰 دعماً للعلاقات المشتركة، حولت خزينة [${donor.name}] منحة مالية فورية بقيمة $${gift.toLocaleString()} إلى خزينة دولتك [${playerCountry.name}]!`,
              year: world.year || 1,
              isSystem: false,
              timestamp: Date.now()
            });
            if (window.showGameToast) window.showGameToast(`💰 وصلتك منحة مالية بقيمة $${gift.toLocaleString()} من [${donor.name}]!`, "🎁");
            if (window.ChronicleManager) window.ChronicleManager.render(world, true);
            if (window.renderNationsTable) window.renderNationsTable();
            return;
          }
        }
      }

      // 4. إذا هدد اللاعب بالحرب أو التحدي
      if (clean.includes("حرب") || clean.includes("احذر") || clean.includes("هجوم") || clean.includes("غزو")) {
        const warBots = aiCountries.filter(b => this.getPersonaForCountry(b).aggression >= 0.6);
        const responder = warBots.length > 0 ? warBots[0] : aiCountries[0];
        const persona = this.getPersonaForCountry(responder);
        const pwr = window.WarEngine ? window.WarEngine.getStandingArmyPower(responder) : 0;
        world.addChatMessage({
          senderId: responder.ownerPlayerId,
          senderName: `${persona.leaderName} (${persona.title})`,
          countryId: responder.id,
          countryName: responder.name,
          flag: responder.flag,
          text: `⚔️ تهديدك لا يخيفنا يا قائد [${playerCountry ? playerCountry.name : ''}]! جيشنا بقوة (${pwr}) جاهز للميدان في غرفة الحرب!`,
          year: world.year || 1,
          isSystem: false,
          timestamp: Date.now()
        });
        if (window.ChronicleManager) window.ChronicleManager.render(world, true);
      }
    }, 650);
  }
}

window.AIEngine = AIEngine;
