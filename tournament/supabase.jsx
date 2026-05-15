// =====================================================================
// supabase.jsx — DB layer for tournament page (ADR-011)
// =====================================================================
// Tables (existing):
//   - tournaments (sport JSONB, config JSONB, pointsSystem JSONB, ...)
//   - tournament_teams (badge JSONB, roster JSONB, studentIds BIGINT[])
//   - tournament_matches (groupId, isBye, isThirdPlace, winnerId, ...)
//   - tournament_events (team string, player, scorer, assist, minute)
//   - tournament_ratings (rating 1-5, UNIQUE(matchId, playerId))
// =====================================================================

const SB_URL = 'https://oytfhgqhibbcsqbnvwyv.supabase.co/rest/v1';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dGZoZ3FoaWJiY3NxYm52d3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjgwNDgsImV4cCI6MjA5MDgwNDA0OH0.oX2f-gCIBn8cHvNbgYIrnFc5JeUXtQ_i0AreSqgBWJs';

function tdbHeaders(extra = {}) {
  return {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
    ...extra,
  };
}

async function tdbRequest(method, path, body, headers = {}) {
  const r = await fetch(`${SB_URL}/${path}`, {
    method,
    headers: tdbHeaders(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${r.status}`);
  }
  if (method === 'GET' || headers.Prefer?.includes('return=representation')) {
    return r.json().catch(() => null);
  }
  return null;
}

const tdbGet    = (p) => tdbRequest('GET', p, null);
const tdbInsert = (table, data) => tdbRequest('POST', table, data, { Prefer: 'return=representation' });
const tdbPatch  = (table, id, data) => tdbRequest('PATCH', `${table}?id=eq.${id}`, data);
const tdbDelete = (table, q) => tdbRequest('DELETE', `${table}?${q}`, null);

// =====================================================================
// SHAPE ADAPTERS — DB row → prototype-shape (and back)
// =====================================================================
// Prototype expects a tournament with nested teams, fixtures, bracket,
// participants. DB normalizes those into separate tables. These adapters
// hide the difference from React components.

/** Convert a DB match row into the prototype's match object shape. */
function matchFromDb(row, teamsById) {
  const home = row.homeTeamId ? teamsById.get(row.homeTeamId) : null;
  const away = row.awayTeamId ? teamsById.get(row.awayTeamId) : null;
  return {
    id: row.id,
    home: home || (row.isBye ? { id: 'BYE', name: '—', bye: true } : null),
    away: away || (row.isBye ? { id: 'BYE', name: '—', bye: true } : null),
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    played: !!row.played,
    round: row.round,
    slot: row.slot,
    winner: row.winnerId ? teamsById.get(row.winnerId) : null,
    date: row.date,
    time: row.time,
    venue: row.venue,
    isBye: !!row.isBye,
    isThirdPlace: !!row.isThirdPlace,
    groupId: row.groupId,
  };
}

/** Convert a DB team row into prototype shape. */
function teamFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    badge: row.badge,
    roster: row.roster || [],
    studentIds: row.studentIds || [],
    logo: row.badge?.url || null,   // prototype reads team.logo
  };
}

/** Build a full prototype-shape tournament from DB rows. */
function tournamentFromDb(t, teams, matches, events, ratings = []) {
  const teamObjs = teams.map(teamFromDb);
  const teamsById = new Map(teamObjs.map(x => [x.id, x]));
  const eventsByMatch = new Map();
  events.forEach(e => {
    if (!eventsByMatch.has(e.matchId)) eventsByMatch.set(e.matchId, []);
    eventsByMatch.get(e.matchId).push(e);
  });
  const ratingsByMatch = new Map();
  ratings.forEach(r => {
    if (!ratingsByMatch.has(r.matchId)) ratingsByMatch.set(r.matchId, {});
    ratingsByMatch.get(r.matchId)[r.playerId] = r.rating;
  });
  const matchObjs = matches.map(m => {
    const mo = matchFromDb(m, teamsById);
    mo.events = eventsByMatch.get(m.id) || [];
    mo.ratings = ratingsByMatch.get(m.id) || {};
    return mo;
  });

  // Group matches: league → fixtures (rounds), knockout → bracket,
  // league_knockout → fixtures only (bracket generated later after league ends),
  // groups_knockout → groups[] each with fixtures + optional knockout bracket
  let fixtures = null, bracket = null, groups = null;

  const buildRoundedFixtures = (arr) => {
    const byRound = {};
    arr.filter(m => !m.isThirdPlace).forEach(m => {
      const r = m.round || 1;
      if (!byRound[r]) byRound[r] = [];
      byRound[r].push(m);
    });
    return Object.keys(byRound).sort((a, b) => +a - +b).map(k => byRound[k]);
  };

  const buildBracket = (arr) => {
    const main = arr.filter(m => !m.isThirdPlace);
    const third = arr.find(m => m.isThirdPlace) || null;
    const byRound = {};
    main.forEach(m => {
      const r = m.round || 1;
      if (!byRound[r]) byRound[r] = [];
      byRound[r].push(m);
    });
    const rounds = Object.keys(byRound).sort((a, b) => +a - +b).map(k => byRound[k]);
    return { rounds, thirdPlace: third };
  };

  if (t.type === 'league') {
    fixtures = buildRoundedFixtures(matchObjs);
  } else if (t.type === 'knockout') {
    bracket = buildBracket(matchObjs);
  } else if (t.type === 'league_knockout') {
    // League phase matches have groupId=null; knockout bracket matches will have
    // groupId='knockout' once that phase is generated. Until then fixtures only.
    const leagueMatches = matchObjs.filter(m => m.groupId !== 'knockout');
    const knockoutMatches = matchObjs.filter(m => m.groupId === 'knockout');
    fixtures = buildRoundedFixtures(leagueMatches);
    if (knockoutMatches.length) bracket = buildBracket(knockoutMatches);
  } else if (t.type === 'groups_knockout') {
    const ARABIC_LABELS = ['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
    const groupMatches = matchObjs.filter(m => m.groupId && m.groupId !== 'knockout');
    const knockoutMatches = matchObjs.filter(m => !m.groupId || m.groupId === 'knockout');
    const groupIds = [...new Set(groupMatches.map(m => m.groupId))].sort();
    groups = groupIds.map((gid, gi) => {
      const gm = groupMatches.filter(m => m.groupId === gid);
      const teamSet = new Set();
      const participants = [];
      gm.forEach(m => {
        if (m.home && !m.home.bye && !teamSet.has(m.home.id)) {
          teamSet.add(m.home.id); participants.push(m.home);
        }
        if (m.away && !m.away.bye && !teamSet.has(m.away.id)) {
          teamSet.add(m.away.id); participants.push(m.away);
        }
      });
      return {
        id: gid,
        label: `المجموعة ${ARABIC_LABELS[gi] || (gi + 1)}`,
        participants,
        fixtures: buildRoundedFixtures(gm),
      };
    });
    if (knockoutMatches.length) bracket = buildBracket(knockoutMatches);
  }

  return {
    id:               t.id,
    name:             t.name,
    sport:            t.sport,                   // already JSONB object
    competitionType:  t.competitionType,
    type:             t.type,
    status:           t.status,
    config:           t.config || {},
    pointsSystem:     t.pointsSystem || {},
    createdAt:        t.createdAt,
    participants:     teamObjs,
    fixtures,
    bracket,
    groups,
    _dbTeams:         teams,                     // raw rows for diff-on-save
    _dbMatches:       matches,
    _dbEvents:        events,
  };
}

// =====================================================================
// PUBLIC API — used by app.jsx
// =====================================================================

/** Load all tournaments (with their teams, matches, events, ratings) for the dashboard. */
async function tdbList() {
  const ts = await tdbGet('tournaments?select=*&order=createdAt.desc');
  if (!ts || !ts.length) return [];
  const ids = ts.map(t => t.id).join(',');
  const [teams, matches, events] = await Promise.all([
    tdbGet(`tournament_teams?select=*&tournamentId=in.(${ids})&order=id.asc`),
    tdbGet(`tournament_matches?select=*&tournamentId=in.(${ids})&order=round.asc,slot.asc`),
    tdbGet(`tournament_events?select=*&tournamentId=in.(${ids})&order=id.asc`),
  ]);
  let ratings = [];
  if (matches && matches.length) {
    const matchIds = matches.map(m => m.id).join(',');
    ratings = await tdbGet(`tournament_ratings?matchId=in.(${matchIds})`) || [];
  }
  // Map each rating to its tournamentId via the matches list for efficient filtering
  const matchTournamentMap = new Map((matches || []).map(m => [m.id, m.tournamentId]));
  return ts.map(t => tournamentFromDb(
    t,
    (teams || []).filter(x => x.tournamentId === t.id),
    (matches || []).filter(x => x.tournamentId === t.id),
    (events || []).filter(x => x.tournamentId === t.id),
    ratings.filter(r => matchTournamentMap.get(r.matchId) === t.id),
  ));
}

/** Reload a single tournament after a mutation. */
async function tdbGetOne(id) {
  const [t, teams, matches, events] = await Promise.all([
    tdbGet(`tournaments?select=*&id=eq.${id}`).then(r => r?.[0]),
    tdbGet(`tournament_teams?select=*&tournamentId=eq.${id}&order=id.asc`),
    tdbGet(`tournament_matches?select=*&tournamentId=eq.${id}&order=round.asc,slot.asc`),
    tdbGet(`tournament_events?select=*&tournamentId=eq.${id}&order=id.asc`),
  ]);
  if (!t) return null;
  let ratings = [];
  if (matches && matches.length) {
    const matchIds = matches.map(m => m.id).join(',');
    ratings = await tdbGet(`tournament_ratings?matchId=in.(${matchIds})`) || [];
  }
  return tournamentFromDb(t, teams || [], matches || [], events || [], ratings);
}

/** Create a new tournament from wizard draft. Inserts tournament + teams + matches. */
async function tdbCreate(draft, programId) {
  // 1) tournament row
  const tInsert = await tdbInsert('tournaments', {
    programId,
    name:            draft.name,
    sport:           draft.sport,                 // JSONB
    competitionType: draft.competitionType,
    type:            draft.type,
    status:          'active',
    config:          draft.config || {},
    pointsSystem:    draft.pointsSystem || {},
  });
  const tournamentRow = Array.isArray(tInsert) ? tInsert[0] : tInsert;
  const tournamentId = tournamentRow.id;

  // 2) teams (track local-id → db-id mapping for matches step)
  const teamRows = (draft.participants || []).map(p => ({
    tournamentId,
    name:       p.name,
    color:      p.color || null,
    badge:      p.badge || null,
    roster:     p.roster || [],
    studentIds: (p.roster || []).map(r => r.studentId).filter(Boolean),
  }));
  const insertedTeams = teamRows.length
    ? await tdbInsert('tournament_teams', teamRows)
    : [];
  // Map from local participant.id (string like "id_1234") to DB id
  const localToDbTeamId = new Map();
  (draft.participants || []).forEach((p, i) => {
    if (insertedTeams[i]) localToDbTeamId.set(p.id, insertedTeams[i].id);
  });

  // 3) matches (flatten fixtures + bracket + thirdPlace)
  const matchRows = [];
  if ((draft.type === 'league' || draft.type === 'league_knockout') && draft.fixtures) {
    draft.fixtures.forEach((round, ri) => {
      round.forEach((m, mi) => {
        matchRows.push({
          tournamentId,
          round: m.round || ri + 1,
          slot:  mi,
          homeTeamId: localToDbTeamId.get(m.home?.id) || null,
          awayTeamId: localToDbTeamId.get(m.away?.id) || null,
          played:    false,
          isBye:     !!(m.home?.bye || m.away?.bye),
          isThirdPlace: false,
          groupId:   null,
        });
      });
    });
  }
  if (draft.type === 'groups_knockout' && draft.groups) {
    draft.groups.forEach((group) => {
      group.fixtures.forEach((round, ri) => {
        round.forEach((m, mi) => {
          matchRows.push({
            tournamentId,
            round: ri + 1,
            slot:  mi,
            homeTeamId: localToDbTeamId.get(m.home?.id) || null,
            awayTeamId: localToDbTeamId.get(m.away?.id) || null,
            played:    false,
            isBye:     !!(m.home?.bye || m.away?.bye),
            isThirdPlace: false,
            groupId:   group.id,
          });
        });
      });
    });
  }
  if (draft.type === 'knockout' && draft.bracket) {
    draft.bracket.rounds.forEach((round, ri) => {
      round.forEach((m, mi) => {
        matchRows.push({
          tournamentId,
          round: ri + 1,
          slot:  m.slot ?? mi,
          homeTeamId: localToDbTeamId.get(m.home?.id) || null,
          awayTeamId: localToDbTeamId.get(m.away?.id) || null,
          played:    false,
          isBye:     !!(m.home?.bye || m.away?.bye),
          isThirdPlace: false,
        });
      });
    });
    if (draft.bracket.thirdPlace) {
      matchRows.push({
        tournamentId,
        round: 0,
        slot:  0,
        homeTeamId: null,
        awayTeamId: null,
        played:    false,
        isBye:     false,
        isThirdPlace: true,
      });
    }
  }
  if (matchRows.length) {
    await tdbInsert('tournament_matches', matchRows);
  }

  return tdbGetOne(tournamentId);
}

/** Update tournament metadata (name, status, config, etc.) — does NOT touch teams/matches. */
async function tdbUpdateMeta(tournament) {
  const patch = {};
  ['name','status','config','pointsSystem','sport','competitionType','type'].forEach(k => {
    if (tournament[k] !== undefined) patch[k] = tournament[k];
  });
  await tdbPatch('tournaments', tournament.id, patch);
  return tdbGetOne(tournament.id);
}

/** Save a single match: score, played flag, schedule, plus replace its events list. */
async function tdbSaveMatch(match, events) {
  const patch = {
    homeScore:  match.homeScore,
    awayScore:  match.awayScore,
    winnerId:   match.winner?.id || null,
    played:     !!match.played,
    date:       match.date || null,
    time:       match.time || null,
    venue:      match.venue || null,
  };
  await tdbPatch('tournament_matches', match.id, patch);
  // Replace events for this match (delete-then-insert is simpler than diffing)
  await tdbDelete('tournament_events', `matchId=eq.${match.id}`);
  if (events && events.length) {
    await tdbInsert('tournament_events', events.map(e => ({
      matchId:      match.id,
      tournamentId: e.tournamentId,
      type:         e.type,
      subtype:      e.subtype || null,
      team:         e.team || null,        // 'home' | 'away'
      player:       e.player || null,
      scorer:       e.scorer || null,
      assist:       e.assist || null,
      minute:       e.minute || null,
    })));
  }
}

/** Advance a team into the next-round match slot (knockout). */
async function tdbAdvanceTeam(matchId, side, teamId) {
  const patch = side === 'home' ? { homeTeamId: teamId } : { awayTeamId: teamId };
  await tdbPatch('tournament_matches', matchId, patch);
}

/** Upsert player ratings for a single match. ratings = {playerId: 1-5, ...} */
async function tdbSaveRatings(matchId, ratings) {
  if (!matchId || !ratings) return;
  const rows = Object.entries(ratings)
    .filter(([, v]) => v > 0)
    .map(([playerId, rating]) => ({ matchId, playerId, rating }));
  if (!rows.length) return;
  await tdbRequest('POST', 'tournament_ratings', rows, {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

/** Delete a tournament (cascades teams, matches, events, ratings). */
async function tdbDeleteTournament(id) {
  const matches = await tdbRequest('GET', `tournament_matches?tournamentId=eq.${id}&select=id`);
  if (Array.isArray(matches) && matches.length) {
    const ids = matches.map(m => m.id).join(',');
    await tdbDelete('tournament_ratings', `matchId=in.(${ids})`);
  }
  await tdbDelete('tournament_events',  `tournamentId=eq.${id}`);
  await tdbDelete('tournament_matches', `tournamentId=eq.${id}`);
  await tdbDelete('tournament_teams',   `tournamentId=eq.${id}`);
  await tdbDelete('tournaments',        `id=eq.${id}`);
}

/** Pull program subscriptions to seed the participants picker.
 *  Note: subscriptions table has no `isArchived` column — filter by
 *  status='نشط' instead. */
async function tdbLoadParticipants(programId) {
  if (!programId) return [];
  const rows = await tdbGet(
    `subscriptions?select=studentId,studentName,phone,groupName,category&programId=eq.${programId}&order=studentName.asc`
  );
  return (rows || []).map(r => ({
    studentId: r.studentId,
    name:      r.studentName,
    phone:     r.phone,
    group:     r.groupName,
    category:  r.category,
  }));
}

/** Pull the active programs list for the wizard's program picker. */
async function tdbLoadPrograms() {
  const rows = await tdbGet(`programs?select=id,name,startDate,endDate,status&order=id.desc`);
  return rows || [];
}

// Export
window.TDB = {
  list:            tdbList,
  getOne:          tdbGetOne,
  create:          tdbCreate,
  updateMeta:      tdbUpdateMeta,
  saveMatch:       tdbSaveMatch,
  saveRatings:     tdbSaveRatings,
  advanceTeam:     tdbAdvanceTeam,
  deleteTournament: tdbDeleteTournament,
  loadParticipants: tdbLoadParticipants,
  loadPrograms:     tdbLoadPrograms,
};
