// =====================================================================
// data.jsx — seed data + helpers for بطولة (Tournament Manager)
// =====================================================================

// ----- Saudi names pool (boys / academy participants) -----
const SAUDI_NAMES = [
  "عبدالله العتيبي", "محمد القحطاني", "فيصل الدوسري", "سعود الشهري",
  "خالد الحربي", "ناصر الزهراني", "تركي السبيعي", "ياسر الغامدي",
  "بدر المالكي", "عمر العنزي", "ماجد الشمري", "فهد الرشيدي",
  "سلطان البقمي", "راكان المطيري", "عبدالعزيز الحارثي", "زياد الجهني",
  "وليد العمري", "هتان الفيفي", "أيمن الثبيتي", "مشاري الخالدي",
  "ريان الصاعدي", "أنس البلوي", "حمد الأحمدي", "صالح الشعيبي",
  "ثامر العصيمي", "بسام الزايدي", "علي الأسمري", "حسام النفيعي",
  "عبدالرحمن الصبحي", "نواف العوفي", "إبراهيم الحازمي", "مهند الذبياني"
];

const SAUDI_TEAMS = [
  "فريق النسور", "فريق الصقور", "فريق الأسود", "فريق الفهود",
  "فريق الشعلة", "فريق الفجر", "فريق العاصفة", "فريق البرق",
  "فريق النجوم", "فريق القمم", "فريق التحدي", "فريق العزم",
  "فريق الإقدام", "فريق الرواد", "فريق الأبطال", "فريق المجد"
];

// ----- Sport options -----
const SPORTS = [
  { id: "football", name: "كرة قدم", emoji: "⚽", team: true },
  { id: "volleyball", name: "كرة طائرة", emoji: "🏐", team: true },
  { id: "tabletennis", name: "تنس طاولة", emoji: "🏓", team: false },
  { id: "basketball", name: "كرة سلة", emoji: "🏀", team: true },
];

// ----- Helpers -----
const uid = (() => { let i = 1000; return () => `id_${++i}`; })();

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeParticipants(names) {
  return names.map(n => ({ id: uid(), name: n }));
}

// ----- Round-robin generator (circle method) -----
function generateLeagueFixtures(participants, doubleRound = false) {
  const teams = [...participants];
  if (teams.length % 2 === 1) teams.push({ id: "BYE", name: "—", bye: true });
  const n = teams.length;
  const rounds = [];
  const half = n / 2;
  let arr = [...teams];

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a.id !== "BYE" && b.id !== "BYE") {
        round.push({
          id: uid(),
          home: r % 2 === 0 ? a : b,
          away: r % 2 === 0 ? b : a,
          homeScore: null, awayScore: null,
          played: false, round: r + 1,
        });
      }
    }
    rounds.push(round);
    // rotate
    arr = [arr[0], ...arr.slice(-1), ...arr.slice(1, -1)];
  }

  if (doubleRound) {
    const second = rounds.map((round, ri) => round.map(m => ({
      ...m, id: uid(), home: m.away, away: m.home,
      round: rounds.length + ri + 1, homeScore: null, awayScore: null, played: false,
    })));
    return [...rounds, ...second];
  }
  return rounds;
}

// ----- Knockout bracket generator -----
function generateBracket(participants, thirdPlace = false) {
  // pad to next power of 2 with byes
  let n = 1;
  while (n < participants.length) n *= 2;
  const seeds = [...participants];
  while (seeds.length < n) seeds.push({ id: `BYE_${seeds.length}`, name: "—", bye: true });

  const rounds = [];
  // round 1
  const r1 = [];
  for (let i = 0; i < n / 2; i++) {
    r1.push({
      id: uid(), round: 1, slot: i,
      home: seeds[i * 2], away: seeds[i * 2 + 1],
      homeScore: null, awayScore: null, winner: null, played: false,
    });
  }
  rounds.push(r1);

  // subsequent rounds (empty)
  let count = n / 4;
  let r = 2;
  while (count >= 1) {
    const round = [];
    for (let i = 0; i < count; i++) {
      round.push({
        id: uid(), round: r, slot: i,
        home: null, away: null,
        homeScore: null, awayScore: null, winner: null, played: false,
      });
    }
    rounds.push(round);
    count /= 2; r++;
  }

  return { rounds, thirdPlace: thirdPlace ? {
    id: uid(), round: -1, slot: 0,
    home: null, away: null, homeScore: null, awayScore: null, winner: null, played: false,
  } : null };
}

// ----- League standings calculator -----
function computeStandings(participants, fixtures, points = { win: 3, draw: 1, loss: 0 }, tiebreak = "gd") {
  const table = {};
  participants.forEach(p => {
    table[p.id] = {
      id: p.id, name: p.name,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, gd: 0, points: 0,
    };
  });
  fixtures.flat().forEach(m => {
    if (!m.played) return;
    const h = table[m.home.id], a = table[m.away.id];
    if (!h || !a) return;
    h.played++; a.played++;
    h.goalsFor += m.homeScore; h.goalsAgainst += m.awayScore;
    a.goalsFor += m.awayScore; a.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.won++; a.lost++;
      h.points += points.win; a.points += points.loss;
    } else if (m.homeScore < m.awayScore) {
      a.won++; h.lost++;
      a.points += points.win; h.points += points.loss;
    } else {
      h.drawn++; a.drawn++;
      h.points += points.draw; a.points += points.draw;
    }
    h.gd = h.goalsFor - h.goalsAgainst;
    a.gd = a.goalsFor - a.goalsAgainst;
  });
  return Object.values(table).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (tiebreak === "gd") {
      if (y.gd !== x.gd) return y.gd - x.gd;
      return y.goalsFor - x.goalsFor;
    } else {
      if (y.goalsFor !== x.goalsFor) return y.goalsFor - x.goalsFor;
      return y.gd - x.gd;
    }
  });
}

// =====================================================================
// SEED TOURNAMENTS
// =====================================================================

// --- Tournament 1: Football League (in progress, ~60% played) ---
function buildFootballLeague() {
  // Roster pool — each team gets a slice of distinct names
  const ROSTER_POOL = [
    "أحمد العمري", "محمد السلمي", "خالد القحطاني", "عبدالعزيز الزهراني",
    "فهد الشهري", "سلطان الدوسري", "ياسر الحربي", "ناصر العتيبي",
    "تركي الغامدي", "بدر السبيعي", "مشاري المطيري", "راكان الشمري",
    "عبدالرحمن الأحمدي", "وليد الرشيدي", "نواف البقمي", "زياد الخالدي",
    "عمر العنزي", "سعد الجهني", "حسن المالكي", "ماجد القرني",
    "علي البلوي", "عبدالله الثقفي", "هشام الحارثي", "صالح الشريف",
    "بسام الأنصاري", "إياد القرشي", "ريان السهيمي", "طلال الفيفي",
    "أنس الدهاسي", "كريم الحسيني", "محمود السيد", "يوسف العامر",
    "عدنان النعيمي", "غازي الفالح", "مهند العتيق", "أيمن الصاعدي",
    "زاهر الشلاحي", "فيصل الجابري", "نايف الخضر", "حمدان السبيهين",
    "وائل العبيد", "خليل الصاوي", "حازم الجميل", "سامي الزاير",
    "إبراهيم النجار", "رامي الكناني", "كنان البكري", "عثمان الزياد",
    "عاصم الباهلي", "تامر الكعبي", "بلال الهاشمي", "محسن الطيب",
    "زكي العواد", "ضياء الفرحاني", "مرزوق الفهيد", "بندر القباني",
    "حازم البطين", "أديب القشاش", "صدام الدباس", "هاني البشيري",
    "خالد العنبري", "صلاح الفايدي", "نزار الجاسم", "ضيف الله الزعبي",
    "عبدالكريم الطليان", "تركي البكري", "عمار العبوسي", "غيث المنذري",
    "زكريا الفروخ", "نجم العلي", "هلال الجار الله", "ضيف العامري",
    "مازن الجمعان", "أيمن الخميس", "فواز السديس", "ريّان الزرقا",
    "وحيد الدبيس", "غيث الجابر", "جابر السلمان", "سعد البخاري",
    "محسن الكثيري", "أمجد البلوي", "ياسين الناشي", "بكر الحربية",
    "نواف العياضة", "غازي العمري", "مهدي الفقيه", "خالد الحجار",
    "ثامر العسيري", "نهار العتيبي", "زاهد العنزي", "غازي الزغلول",
    "زهير الحجاج", "عبد المجيد الفايز", "مساعد الكساب", "بدر الصمعاني",
    "ذيب الكلابي", "رهام البدري", "هيثم الزاير", "مهيدي السعيدان",
  ];

  const teamNames = ["النسور", "الصقور", "الأسود", "الفهود", "الشعلة", "الفجر", "العاصفة", "البرق"];
  const PER_TEAM = 14;

  // Build participants with rosters
  let cursor = 0;
  const participants = teamNames.map((tn) => {
    const slice = ROSTER_POOL.slice(cursor, cursor + PER_TEAM);
    cursor += PER_TEAM;
    return {
      id: uid(),
      name: tn,
      roster: slice.map(n => ({ id: uid(), name: n })),
    };
  });

  const fixtures = generateLeagueFixtures(participants, true);
  const flat = fixtures.flat();
  const playedCount = Math.floor(flat.length * 0.6);

  // Deterministic-ish RNG (so demo is stable per session)
  let seed = 42;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  // Build a base date 3 weeks ago, schedule matches across rounds
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 21);
  const venues = ["ملعب رقم ١", "ملعب رقم ٢", "الملعب الرئيسي", "ملعب التدريب"];
  const times = ["16:00", "17:30", "19:00", "20:30"];
  let dayOffset = 0;
  fixtures.forEach((round, ri) => {
    round.forEach((m, mi) => {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + dayOffset + Math.floor(mi / 2));
      m.date = d.toISOString().slice(0, 10);
      m.time = times[(ri + mi) % times.length];
      m.venue = venues[(ri + mi) % venues.length];
    });
    dayOffset += Math.ceil(round.length / 2) + 2;
  });

  for (let i = 0; i < playedCount; i++) {
    const m = flat[i];
    // realistic football scores
    const scoreDist = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4];
    const hs = pick(scoreDist);
    const as = pick(scoreDist);
    m.homeScore = hs;
    m.awayScore = as;
    m.played = true;

    const homeRoster = participants.find(p => p.id === m.home.id)?.roster || [];
    const awayRoster = participants.find(p => p.id === m.away.id)?.roster || [];

    // Lineups: 11 starters from each roster
    const shuffleArr = (arr) => {
      const a = [...arr];
      for (let j = a.length - 1; j > 0; j--) {
        const k = Math.floor(rnd() * (j + 1));
        [a[j], a[k]] = [a[k], a[j]];
      }
      return a;
    };
    const homeStarters = shuffleArr(homeRoster).slice(0, 11);
    const awayStarters = shuffleArr(awayRoster).slice(0, 11);
    m.lineups = {
      home: homeStarters.map(p => p.id),
      away: awayStarters.map(p => p.id),
    };

    // Events: goals
    const events = [];
    const usedMinutes = new Set();
    const newMinute = () => {
      let minute;
      let tries = 0;
      do {
        minute = 1 + Math.floor(rnd() * 90);
        tries++;
      } while (usedMinutes.has(minute) && tries < 20);
      usedMinutes.add(minute);
      return minute;
    };

    const addGoals = (count, side, starters) => {
      for (let g = 0; g < count; g++) {
        const scorer = pick(starters);
        // Assist: ~60% chance, different player
        const others = starters.filter(p => p.id !== scorer.id);
        const hasAssist = rnd() < 0.6 && others.length > 0;
        const assist = hasAssist ? pick(others) : null;
        // 10% penalty, 5% own goal
        const r = rnd();
        const subtype = r < 0.05 ? "own" : r < 0.15 ? "penalty" : "normal";
        events.push({
          id: uid(),
          type: "goal",
          team: side,
          scorer: scorer.name,
          assist: subtype === "penalty" || subtype === "own" ? null : (assist ? assist.name : null),
          subtype,
          minute: newMinute(),
        });
      }
    };
    addGoals(hs, "home", homeStarters);
    addGoals(as, "away", awayStarters);

    // Cards: 0-4 yellows, 0-1 red roughly
    const yCount = Math.floor(rnd() * 4);
    for (let c = 0; c < yCount; c++) {
      const side = rnd() < 0.5 ? "home" : "away";
      const players = side === "home" ? homeStarters : awayStarters;
      const player = pick(players);
      events.push({
        id: uid(),
        type: "card",
        team: side,
        player: player.name,
        color: "yellow",
        minute: newMinute(),
      });
    }
    if (rnd() < 0.18) {
      const side = rnd() < 0.5 ? "home" : "away";
      const players = side === "home" ? homeStarters : awayStarters;
      const player = pick(players);
      events.push({
        id: uid(),
        type: "card",
        team: side,
        player: player.name,
        color: "red",
        minute: newMinute(),
      });
    }
    events.sort((a, b) => (a.minute || 0) - (b.minute || 0));
    m.events = events;

    // Ratings: 6.0-9.5 with bias toward 6.5-7.5
    const ratings = {};
    [...homeStarters, ...awayStarters].forEach(pl => {
      // distribute: most 6-7, some 7-8, few 8-9
      const r = rnd();
      let rating;
      if (r < 0.6) rating = 3 + Math.floor(rnd() * 2);     // 3-4 stars (~6-7)
      else if (r < 0.9) rating = 4;                          // 4 stars
      else rating = 5;                                       // top ★★★★★
      ratings[pl.id] = rating;
    });
    m.ratings = ratings;
  }

  return {
    id: "demo_football",
    name: "بطولة الموسم — كرة قدم",
    sport: SPORTS[0],
    competitionType: "team",
    type: "league",
    status: "active",
    participants,
    config: {
      doubleRound: true,
      points: { win: 3, draw: 1, loss: 0 },
      tiebreak: "gd",
    },
    fixtures,
    bracket: null,
    pointsSystem: {
      mode: "perMatch",
      win: 10, draw: 5, loss: 2,
      first: 100, second: 60, third: 40,
    },
    progress: 60,
  };
}

// --- Tournament 2: Table Tennis Knockout (completed) ---
function buildTableTennisKO() {
  const participants = makeParticipants([
    "عبدالله العتيبي", "محمد القحطاني", "فيصل الدوسري", "سعود الشهري",
    "خالد الحربي", "ناصر الزهراني", "تركي السبيعي", "ياسر الغامدي",
    "بدر المالكي", "عمر العنزي", "ماجد الشمري", "فهد الرشيدي",
    "سلطان البقمي", "راكان المطيري", "عبدالعزيز الحارثي", "زياد الجهني"
  ]);
  const bracket = generateBracket(participants, true);

  // simulate full play - winners advance
  function simulate(round, idx) {
    const m = round[idx];
    if (m.home && m.away && !m.home.bye && !m.away.bye) {
      const hs = Math.floor(Math.random() * 4);
      const as = hs === 3 ? Math.floor(Math.random() * 3) : (Math.random() < 0.5 ? 3 : Math.floor(Math.random() * 3));
      // ensure one is 3 (best of 5)
      if (hs < 3 && as < 3) { (Math.random() < 0.5 ? (m.homeScore = 3) : (m.awayScore = 3)); }
      m.homeScore = m.homeScore ?? hs;
      m.awayScore = m.awayScore ?? as;
      if (m.homeScore === m.awayScore) m.homeScore = 3;
      m.winner = m.homeScore > m.awayScore ? m.home : m.away;
      m.played = true;
    } else if (m.home?.bye) { m.winner = m.away; m.played = true; }
    else if (m.away?.bye) { m.winner = m.home; m.played = true; }
  }

  bracket.rounds[0].forEach((_, i) => simulate(bracket.rounds[0], i));
  for (let r = 1; r < bracket.rounds.length; r++) {
    for (let i = 0; i < bracket.rounds[r].length; i++) {
      bracket.rounds[r][i].home = bracket.rounds[r - 1][i * 2].winner;
      bracket.rounds[r][i].away = bracket.rounds[r - 1][i * 2 + 1].winner;
      simulate(bracket.rounds[r], i);
    }
  }
  // 3rd place (semifinal losers)
  const semiR = bracket.rounds[bracket.rounds.length - 2];
  if (bracket.thirdPlace && semiR.length === 2) {
    const loserA = semiR[0].winner === semiR[0].home ? semiR[0].away : semiR[0].home;
    const loserB = semiR[1].winner === semiR[1].home ? semiR[1].away : semiR[1].home;
    bracket.thirdPlace.home = loserA; bracket.thirdPlace.away = loserB;
    bracket.thirdPlace.homeScore = 3; bracket.thirdPlace.awayScore = 1;
    bracket.thirdPlace.winner = loserA;
    bracket.thirdPlace.played = true;
  }

  return {
    id: "demo_tt",
    name: "كأس بارع — تنس طاولة",
    sport: SPORTS[2],
    competitionType: "individual",
    type: "knockout",
    status: "completed",
    participants,
    config: {
      participantCount: 16,
      seeding: "auto",
      thirdPlace: true,
      bestOf: 5,
    },
    fixtures: null,
    bracket,
    pointsSystem: {
      mode: "endOnly",
      win: 0, draw: 0, loss: 0,
      first: 100, second: 60, third: 40,
    },
    progress: 100,
  };
}

window.TournamentData = {
  SPORTS, SAUDI_NAMES, SAUDI_TEAMS,
  uid, shuffle, makeParticipants,
  generateLeagueFixtures, generateBracket, computeStandings,
  buildFootballLeague, buildTableTennisKO,
};
