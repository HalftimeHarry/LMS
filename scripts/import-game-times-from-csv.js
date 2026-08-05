#!/usr/bin/env node
/**
 * import-game-times-from-csv.js
 *
 * Imports kickoff times from the provided CSV into the live game_odds collection.
 * The CSV values are interpreted as Eastern Time (EST) and converted to UTC before
 * being written to PocketBase.
 *
 * Usage:
 *   node scripts/import-game-times-from-csv.js
 */

import dotenv from 'dotenv';

dotenv.config();

const PB_URL = process.env.PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASS = process.env.POCKETBASE_ADMIN_PASSWORD;

const CSV = String.raw`1,Wed,September 9,New England Patriots,,@,Seattle Seahawks,,8:20 PM
1,Thu,September 10,San Francisco 49ers,,@,Los Angeles Rams,,8:35 PM
1,Sun,September 13,Chicago Bears,,@,Carolina Panthers,,1:00 PM
1,Sun,September 13,Tampa Bay Buccaneers,,@,Cincinnati Bengals,,1:00 PM
1,Sun,September 13,Baltimore Ravens,,@,Indianapolis Colts,,1:00 PM
1,Sun,September 13,New Orleans Saints,,@,Detroit Lions,,1:00 PM
1,Sun,September 13,Buffalo Bills,,@,Houston Texans,,1:00 PM
1,Sun,September 13,Cleveland Browns,,@,Jacksonville Jaguars,,1:00 PM
1,Sun,September 13,New York Jets,,@,Tennessee Titans,,1:00 PM
1,Sun,September 13,Atlanta Falcons,,@,Pittsburgh Steelers,,1:00 PM
1,Sun,September 13,Green Bay Packers,,@,Minnesota Vikings,,4:25 PM
1,Sun,September 13,Washington Commanders,,@,Philadelphia Eagles,,4:25 PM
1,Sun,September 13,Miami Dolphins,,@,Las Vegas Raiders,,4:25 PM
1,Sun,September 13,Arizona Cardinals,,@,Los Angeles Chargers,,4:25 PM
1,Sun,September 13,Dallas Cowboys,,@,New York Giants,,8:20 PM
1,Mon,September 14,Denver Broncos,,@,Kansas City Chiefs,,8:15 PM
2,Thu,September 17,Detroit Lions,,@,Buffalo Bills,,8:15 PM
2,Sun,September 20,Carolina Panthers,,@,Atlanta Falcons,,1:00 PM
2,Sun,September 20,Minnesota Vikings,,@,Chicago Bears,,1:00 PM
2,Sun,September 20,Cincinnati Bengals,,@,Houston Texans,,1:00 PM
2,Sun,September 20,Pittsburgh Steelers,,@,New England Patriots,,1:00 PM
2,Sun,September 20,Green Bay Packers,,@,New York Jets,,1:00 PM
2,Sun,September 20,Philadelphia Eagles,,@,Tennessee Titans,,1:00 PM
2,Sun,September 20,New Orleans Saints,,@,Baltimore Ravens,,1:00 PM
2,Sun,September 20,Cleveland Browns,,@,Tampa Bay Buccaneers,,1:00 PM
2,Sun,September 20,Jacksonville Jaguars,,@,Denver Broncos,,4:05 PM
2,Sun,September 20,Las Vegas Raiders,,@,Los Angeles Chargers,,4:05 PM
2,Sun,September 20,Seattle Seahawks,,@,Arizona Cardinals,,4:25 PM
2,Sun,September 20,Washington Commanders,,@,Dallas Cowboys,,4:25 PM
2,Sun,September 20,Miami Dolphins,,@,San Francisco 49ers,,4:25 PM
2,Sun,September 20,Indianapolis Colts,,@,Kansas City Chiefs,,8:20 PM
2,Mon,September 21,New York Giants,,@,Los Angeles Rams,,8:15 PM
3,Thu,September 24,Atlanta Falcons,,@,Green Bay Packers,,8:15 PM
3,Sun,September 27,Los Angeles Chargers,,@,Buffalo Bills,,1:00 PM
3,Sun,September 27,Carolina Panthers,,@,Cleveland Browns,,1:00 PM
3,Sun,September 27,Houston Texans,,@,Indianapolis Colts,,1:00 PM
3,Sun,September 27,New York Jets,,@,Detroit Lions,,1:00 PM
3,Sun,September 27,New England Patriots,,@,Jacksonville Jaguars,,1:00 PM
3,Sun,September 27,Kansas City Chiefs,,@,Miami Dolphins,,1:00 PM
3,Sun,September 27,Tennessee Titans,,@,New York Giants,,1:00 PM
3,Sun,September 27,Cincinnati Bengals,,@,Pittsburgh Steelers,,1:00 PM
3,Sun,September 27,Seattle Seahawks,,@,Washington Commanders,,1:00 PM
3,Sun,September 27,Arizona Cardinals,,@,San Francisco 49ers,,4:05 PM
3,Sun,September 27,Minnesota Vikings,,@,Tampa Bay Buccaneers,,4:05 PM
3,Sun,September 27,Baltimore Ravens,,@,Dallas Cowboys,,4:25 PM
3,Sun,September 27,Las Vegas Raiders,,@,New Orleans Saints,,4:25 PM
3,Sun,September 27,Los Angeles Rams,,@,Denver Broncos,,8:20 PM
3,Mon,September 28,Philadelphia Eagles,,@,Chicago Bears,,8:15 PM
4,Thu,October 1,Pittsburgh Steelers,,@,Cleveland Browns,,8:15 PM
4,Sun,October 4,Indianapolis Colts,,@,Washington Commanders,,9:30 AM
4,Sun,October 4,New England Patriots,,@,Buffalo Bills,,1:00 PM
4,Sun,October 4,New York Jets,,@,Chicago Bears,,1:00 PM
4,Sun,October 4,Jacksonville Jaguars,,@,Cincinnati Bengals,,1:00 PM
4,Sun,October 4,Dallas Cowboys,,@,Houston Texans,,1:00 PM
4,Sun,October 4,Arizona Cardinals,,@,New York Giants,,1:00 PM
4,Sun,October 4,Los Angeles Rams,,@,Philadelphia Eagles,,1:00 PM
4,Sun,October 4,Tennessee Titans,,@,Baltimore Ravens,,1:00 PM
4,Sun,October 4,Green Bay Packers,,@,Tampa Bay Buccaneers,,1:00 PM
4,Sun,October 4,Miami Dolphins,,@,Minnesota Vikings,,4:05 PM
4,Sun,October 4,Kansas City Chiefs,,@,Las Vegas Raiders,,4:25 PM
4,Sun,October 4,Los Angeles Chargers,,@,Seattle Seahawks,,4:25 PM
4,Sun,October 4,Denver Broncos,,@,San Francisco 49ers,,4:25 PM
4,Sun,October 4,Detroit Lions,,@,Carolina Panthers,,8:20 PM
4,Mon,October 5,Atlanta Falcons,,@,New Orleans Saints,,8:15 PM
5,Thu,October 8,Tampa Bay Buccaneers,,@,Dallas Cowboys,,8:15 PM
5,Sun,October 11,Philadelphia Eagles,,@,Jacksonville Jaguars,,9:30 AM
5,Sun,October 11,Cincinnati Bengals,,@,Miami Dolphins,,1:00 PM
5,Sun,October 11,Minnesota Vikings,,@,New Orleans Saints,,1:00 PM
5,Sun,October 11,Las Vegas Raiders,,@,New England Patriots,,1:00 PM
5,Sun,October 11,Cleveland Browns,,@,New York Jets,,1:00 PM
5,Sun,October 11,Houston Texans,,@,Tennessee Titans,,1:00 PM
5,Sun,October 11,Indianapolis Colts,,@,Pittsburgh Steelers,,1:00 PM
5,Sun,October 11,New York Giants,,@,Washington Commanders,,1:00 PM
5,Sun,October 11,Denver Broncos,,@,Los Angeles Chargers,,4:05 PM
5,Sun,October 11,Detroit Lions,,@,Arizona Cardinals,,4:25 PM
5,Sun,October 11,Chicago Bears,,@,Green Bay Packers,,4:25 PM
5,Sun,October 11,San Francisco 49ers,,@,Seattle Seahawks,,4:25 PM
5,Sun,October 11,Baltimore Ravens,,@,Atlanta Falcons,,8:20 PM
5,Mon,October 12,Buffalo Bills,,@,Los Angeles Rams,,8:15 PM
6,Thu,October 15,Seattle Seahawks,,@,Denver Broncos,,8:15 PM
6,Sun,October 18,Houston Texans,,@,Jacksonville Jaguars,,9:30 AM
6,Sun,October 18,Chicago Bears,,@,Atlanta Falcons,,1:00 PM
6,Sun,October 18,Baltimore Ravens,,@,Cleveland Browns,,1:00 PM
6,Sun,October 18,Tennessee Titans,,@,Indianapolis Colts,,1:00 PM
6,Sun,October 18,New York Jets,,@,New England Patriots,,1:00 PM
6,Sun,October 18,New Orleans Saints,,@,New York Giants,,1:00 PM
6,Sun,October 18,Carolina Panthers,,@,Philadelphia Eagles,,1:00 PM
6,Sun,October 18,Pittsburgh Steelers,,@,Tampa Bay Buccaneers,,1:00 PM
6,Sun,October 18,Arizona Cardinals,,@,Los Angeles Rams,,4:05 PM
6,Sun,October 18,Los Angeles Chargers,,@,Kansas City Chiefs,,4:25 PM
6,Sun,October 18,Buffalo Bills,,@,Las Vegas Raiders,,4:25 PM
6,Sun,October 18,Dallas Cowboys,,@,Green Bay Packers,,8:20 PM
6,Mon,October 19,Washington Commanders,,@,San Francisco 49ers,,8:15 PM
7,Thu,October 22,New England Patriots,,@,Chicago Bears,,8:15 PM
7,Sun,October 25,Pittsburgh Steelers,,@,New Orleans Saints,,9:30 AM
7,Sun,October 25,San Francisco 49ers,,@,Atlanta Falcons,,1:00 PM
7,Sun,October 25,Tampa Bay Buccaneers,,@,Carolina Panthers,,1:00 PM
7,Sun,October 25,New York Giants,,@,Houston Texans,,1:00 PM
7,Sun,October 25,Indianapolis Colts,,@,Minnesota Vikings,,1:00 PM
7,Sun,October 25,Miami Dolphins,,@,New York Jets,,1:00 PM
7,Sun,October 25,Cleveland Browns,,@,Tennessee Titans,,1:00 PM
7,Sun,October 25,Cincinnati Bengals,,@,Baltimore Ravens,,1:00 PM
7,Sun,October 25,Denver Broncos,,@,Arizona Cardinals,,4:05 PM
7,Sun,October 25,Green Bay Packers,,@,Detroit Lions,,4:25 PM
7,Sun,October 25,Los Angeles Rams,,@,Las Vegas Raiders,,4:25 PM
7,Sun,October 25,Kansas City Chiefs,,@,Seattle Seahawks,,8:20 PM
7,Mon,October 26,Dallas Cowboys,,@,Philadelphia Eagles,,8:15 PM
8,Thu,October 29,Carolina Panthers,,@,Green Bay Packers,,8:15 PM
8,Sun,November 1,Baltimore Ravens,,@,Buffalo Bills,,1:00 PM
8,Sun,November 1,Tennessee Titans,,@,Cincinnati Bengals,,1:00 PM
8,Sun,November 1,Arizona Cardinals,,@,Dallas Cowboys,,1:00 PM
8,Sun,November 1,Minnesota Vikings,,@,Detroit Lions,,1:00 PM
8,Sun,November 1,Indianapolis Colts,,@,Jacksonville Jaguars,,1:00 PM
8,Sun,November 1,Las Vegas Raiders,,@,New York Jets,,1:00 PM
8,Sun,November 1,Cleveland Browns,,@,Pittsburgh Steelers,,1:00 PM
8,Sun,November 1,Atlanta Falcons,,@,Tampa Bay Buccaneers,,1:00 PM
8,Sun,November 1,Los Angeles Chargers,,@,Los Angeles Rams,,4:05 PM
8,Sun,November 1,Kansas City Chiefs,,@,Denver Broncos,,4:25 PM
8,Sun,November 1,New England Patriots,,@,Miami Dolphins,,4:25 PM
8,Sun,November 1,Philadelphia Eagles,,@,Washington Commanders,,8:20 PM
8,Mon,November 2,Chicago Bears,,@,Seattle Seahawks,,8:15 PM
9,Thu,November 5,Jacksonville Jaguars,,@,Baltimore Ravens,,8:15 PM
9,Sun,November 8,Cincinnati Bengals,,@,Atlanta Falcons,,9:30 AM
9,Sun,November 8,Denver Broncos,,@,Carolina Panthers,,1:00 PM
9,Sun,November 8,Dallas Cowboys,,@,Indianapolis Colts,,1:00 PM
9,Sun,November 8,New York Jets,,@,Kansas City Chiefs,,1:00 PM
9,Sun,November 8,Detroit Lions,,@,Miami Dolphins,,1:00 PM
9,Sun,November 8,Cleveland Browns,,@,New Orleans Saints,,1:00 PM
9,Sun,November 8,New York Giants,,@,Philadelphia Eagles,,1:00 PM
9,Sun,November 8,Los Angeles Rams,,@,Washington Commanders,,1:00 PM
9,Sun,November 8,Houston Texans,,@,Los Angeles Chargers,,4:05 PM
9,Sun,November 8,Las Vegas Raiders,,@,San Francisco 49ers,,4:05 PM
9,Sun,November 8,Green Bay Packers,,@,New England Patriots,,4:25 PM
9,Sun,November 8,Arizona Cardinals,,@,Seattle Seahawks,,4:25 PM
9,Sun,November 8,Tampa Bay Buccaneers,,@,Chicago Bears,,8:20 PM
9,Mon,November 9,Buffalo Bills,,@,Minnesota Vikings,,8:15 PM
10,Thu,November 12,Washington Commanders,,@,New York Giants,,8:15 PM
10,Sun,November 15,New England Patriots,,@,Detroit Lions,,9:30 AM
10,Sun,November 15,Kansas City Chiefs,,@,Atlanta Falcons,,1:00 PM
10,Sun,November 15,Houston Texans,,@,Cleveland Browns,,1:00 PM
10,Sun,November 15,Miami Dolphins,,@,Indianapolis Colts,,1:00 PM
10,Sun,November 15,Minnesota Vikings,,@,Green Bay Packers,,1:00 PM
10,Sun,November 15,Carolina Panthers,,@,New Orleans Saints,,1:00 PM
10,Sun,November 15,Buffalo Bills,,@,New York Jets,,1:00 PM
10,Sun,November 15,Jacksonville Jaguars,,@,Tennessee Titans,,1:00 PM
10,Sun,November 15,Los Angeles Rams,,@,Arizona Cardinals,,4:05 PM
10,Sun,November 15,Seattle Seahawks,,@,Las Vegas Raiders,,4:05 PM
10,Sun,November 15,San Francisco 49ers,,@,Dallas Cowboys,,4:25 PM
10,Sun,November 15,Pittsburgh Steelers,,@,Cincinnati Bengals,,8:20 PM
10,Mon,November 16,Los Angeles Chargers,,@,Baltimore Ravens,,8:15 PM
11,Thu,November 19,Indianapolis Colts,,@,Houston Texans,,8:15 PM
11,Sun,November 22,Miami Dolphins,,@,Buffalo Bills,,1:00 PM
11,Sun,November 22,Baltimore Ravens,,@,Carolina Panthers,,1:00 PM
11,Sun,November 22,New Orleans Saints,,@,Chicago Bears,,1:00 PM
11,Sun,November 22,Tennessee Titans,,@,Dallas Cowboys,,1:00 PM
11,Sun,November 22,Tampa Bay Buccaneers,,@,Detroit Lions,,1:00 PM
11,Sun,November 22,Arizona Cardinals,,@,Kansas City Chiefs,,1:00 PM
11,Sun,November 22,Jacksonville Jaguars,,@,New York Giants,,1:00 PM
11,Sun,November 22,New York Jets,,@,Los Angeles Chargers,,4:05 PM
11,Sun,November 22,Las Vegas Raiders,,@,Denver Broncos,,4:25 PM
11,Sun,November 22,Pittsburgh Steelers,,@,Philadelphia Eagles,,4:25 PM
11,Sun,November 22,Minnesota Vikings,,@,San Francisco 49ers,,8:20 PM
11,Mon,November 23,Cincinnati Bengals,,@,Washington Commanders,,8:15 PM
12,Wed,November 25,Green Bay Packers,,@,Los Angeles Rams,,8:00 PM
12,Thu,November 26,Chicago Bears,,@,Detroit Lions,,1:00 PM
12,Thu,November 26,Philadelphia Eagles,,@,Dallas Cowboys,,4:30 PM
12,Thu,November 26,Kansas City Chiefs,,@,Buffalo Bills,,8:20 PM
12,Fri,November 27,Denver Broncos,,@,Pittsburgh Steelers,,3:00 PM
12,Sun,November 29,New Orleans Saints,,@,Cincinnati Bengals,,1:00 PM
12,Sun,November 29,Las Vegas Raiders,,@,Cleveland Browns,,1:00 PM
12,Sun,November 29,New York Giants,,@,Indianapolis Colts,,1:00 PM
12,Sun,November 29,Baltimore Ravens,,@,Houston Texans,,1:00 PM
12,Sun,November 29,New York Jets,,@,Miami Dolphins,,1:00 PM
12,Sun,November 29,Atlanta Falcons,,@,Minnesota Vikings,,1:00 PM
12,Sun,November 29,Tennessee Titans,,@,Jacksonville Jaguars,,4:05 PM
12,Sun,November 29,Washington Commanders,,@,Arizona Cardinals,,4:25 PM
12,Sun,November 29,Seattle Seahawks,,@,San Francisco 49ers,,4:25 PM
12,Sun,November 29,New England Patriots,,@,Los Angeles Chargers,,8:20 PM
12,Mon,November 30,Carolina Panthers,,@,Tampa Bay Buccaneers,,8:15 PM
13,Thu,December 3,Kansas City Chiefs,,@,Los Angeles Rams,,8:15 PM
13,Sun,December 6,Detroit Lions,,@,Atlanta Falcons,,1:00 PM
13,Sun,December 6,Jacksonville Jaguars,,@,Chicago Bears,,1:00 PM
13,Sun,December 6,Cincinnati Bengals,,@,Cleveland Browns,,1:00 PM
13,Sun,December 6,Green Bay Packers,,@,New Orleans Saints,,1:00 PM
13,Sun,December 6,San Francisco 49ers,,@,New York Giants,,1:00 PM
13,Sun,December 6,Washington Commanders,,@,Tennessee Titans,,1:00 PM
13,Sun,December 6,Los Angeles Chargers,,@,Tampa Bay Buccaneers,,1:00 PM
13,Sun,December 6,Philadelphia Eagles,,@,Arizona Cardinals,,4:05 PM
13,Sun,December 6,Miami Dolphins,,@,Denver Broncos,,4:05 PM
13,Sun,December 6,Carolina Panthers,,@,Minnesota Vikings,,4:25 PM
13,Sun,December 6,Buffalo Bills,,@,New England Patriots,,4:25 PM
13,Sun,December 6,Houston Texans,,@,Pittsburgh Steelers,,8:20 PM
13,Mon,December 7,Dallas Cowboys,,@,Seattle Seahawks,,8:15 PM
14,Thu,December 10,Minnesota Vikings,,@,New England Patriots,,8:15 PM
14,Sun,December 13,New Orleans Saints,,@,Carolina Panthers,,1:00 PM
14,Sun,December 13,Atlanta Falcons,,@,Cleveland Browns,,1:00 PM
14,Sun,December 13,Tennessee Titans,,@,Detroit Lions,,1:00 PM
14,Sun,December 13,Chicago Bears,,@,Miami Dolphins,,1:00 PM
14,Sun,December 13,Denver Broncos,,@,New York Jets,,1:00 PM
14,Sun,December 13,Indianapolis Colts,,@,Philadelphia Eagles,,1:00 PM
14,Sun,December 13,Tampa Bay Buccaneers,,@,Baltimore Ravens,,1:00 PM
14,Sun,December 13,Houston Texans,,@,Washington Commanders,,1:00 PM
14,Sun,December 13,Los Angeles Chargers,,@,Las Vegas Raiders,,4:05 PM
14,Sun,December 13,Kansas City Chiefs,,@,Cincinnati Bengals,,4:25 PM
14,Sun,December 13,New York Giants,,@,Seattle Seahawks,,4:25 PM
14,Sun,December 13,Los Angeles Rams,,@,San Francisco 49ers,,4:25 PM
14,Sun,December 13,Buffalo Bills,,@,Green Bay Packers,,8:20 PM
14,Mon,December 14,Pittsburgh Steelers,,@,Jacksonville Jaguars,,8:15 PM
15,Thu,December 17,San Francisco 49ers,,@,Los Angeles Chargers,,8:15 PM
15,Sat,December 19,Seattle Seahawks,,@,Philadelphia Eagles,,5:00 PM
15,Sat,December 19,Chicago Bears,,@,Buffalo Bills,,8:20 PM
15,Sun,December 20,Cincinnati Bengals,,@,Carolina Panthers,,1:00 PM
15,Sun,December 20,Miami Dolphins,,@,Green Bay Packers,,1:00 PM
15,Sun,December 20,Jacksonville Jaguars,,@,Houston Texans,,1:00 PM
15,Sun,December 20,Cleveland Browns,,@,New York Giants,,1:00 PM
15,Sun,December 20,Indianapolis Colts,,@,Tennessee Titans,,1:00 PM
15,Sun,December 20,Baltimore Ravens,,@,Pittsburgh Steelers,,1:00 PM
15,Sun,December 20,New Orleans Saints,,@,Tampa Bay Buccaneers,,1:00 PM
15,Sun,December 20,Atlanta Falcons,,@,Washington Commanders,,1:00 PM
15,Sun,December 20,New York Jets,,@,Arizona Cardinals,,4:05 PM
15,Sun,December 20,Denver Broncos,,@,Las Vegas Raiders,,4:25 PM
15,Sun,December 20,Dallas Cowboys,,@,Los Angeles Rams,,4:25 PM
15,Sun,December 20,Detroit Lions,,@,Minnesota Vikings,,8:20 PM
15,Mon,December 21,New England Patriots,,@,Kansas City Chiefs,,8:15 PM
16,Thu,December 24,Houston Texans,,@,Philadelphia Eagles,,8:15 PM
16,Fri,December 25,Green Bay Packers,,@,Chicago Bears,,1:00 PM
16,Fri,December 25,Buffalo Bills,,@,Denver Broncos,,4:30 PM
16,Fri,December 25,Los Angeles Rams,,@,Seattle Seahawks,,8:15 PM
16,Sun,December 27,Tampa Bay Buccaneers,,@,Atlanta Falcons,,1:00 PM
16,Sun,December 27,Cincinnati Bengals,,@,Indianapolis Colts,,1:00 PM
16,Sun,December 27,Los Angeles Chargers,,@,Miami Dolphins,,1:00 PM
16,Sun,December 27,Washington Commanders,,@,Minnesota Vikings,,1:00 PM
16,Sun,December 27,Arizona Cardinals,,@,New Orleans Saints,,1:00 PM
16,Sun,December 27,New England Patriots,,@,New York Jets,,1:00 PM
16,Sun,December 27,Carolina Panthers,,@,Pittsburgh Steelers,,1:00 PM
16,Sun,December 27,Cleveland Browns,,@,Baltimore Ravens,,1:00 PM
16,Sun,December 27,Tennessee Titans,,@,Las Vegas Raiders,,4:05 PM
16,Sun,December 27,San Francisco 49ers,,@,Kansas City Chiefs,,4:25 PM
16,Sun,December 27,Jacksonville Jaguars,,@,Dallas Cowboys,,8:20 PM
16,Mon,December 28,New York Giants,,@,Detroit Lions,,8:15 PM
17,Thu,December 31,Baltimore Ravens,,@,Cincinnati Bengals,,8:15 PM
17,Sun,January 3,New Orleans Saints,,@,Atlanta Falcons,,1:00 PM
17,Sun,January 3,Seattle Seahawks,,@,Carolina Panthers,,1:00 PM
17,Sun,January 3,Indianapolis Colts,,@,Cleveland Browns,,1:00 PM
17,Sun,January 3,New York Giants,,@,Dallas Cowboys,,1:00 PM
17,Sun,January 3,Washington Commanders,,@,Jacksonville Jaguars,,1:00 PM
17,Sun,January 3,Buffalo Bills,,@,Miami Dolphins,,1:00 PM
17,Sun,January 3,Denver Broncos,,@,New England Patriots,,1:00 PM
17,Sun,January 3,Minnesota Vikings,,@,New York Jets,,1:00 PM
17,Sun,January 3,Pittsburgh Steelers,,@,Tennessee Titans,,1:00 PM
17,Sun,January 3,Kansas City Chiefs,,@,Los Angeles Chargers,,1:00 PM
17,Sun,January 3,Los Angeles Rams,,@,Tampa Bay Buccaneers,,1:00 PM
17,Sun,January 3,Las Vegas Raiders,,@,Arizona Cardinals,,4:05 PM
17,Sun,January 3,Detroit Lions,,@,Chicago Bears,,4:25 PM
17,Sun,January 3,Philadelphia Eagles,,@,San Francisco 49ers,,8:20 PM
17,Mon,January 4,Houston Texans,,@,Green Bay Packers,,8:15 PM
18,Sun,January 10,New York Jets,,@,Buffalo Bills,,1:00 PM
18,Sun,January 10,Atlanta Falcons,,@,Carolina Panthers,,1:00 PM
18,Sun,January 10,Cleveland Browns,,@,Cincinnati Bengals,,1:00 PM
18,Sun,January 10,Jacksonville Jaguars,,@,Indianapolis Colts,,1:00 PM
18,Sun,January 10,San Francisco 49ers,,@,Arizona Cardinals,,1:00 PM
18,Sun,January 10,Los Angeles Chargers,,@,Denver Broncos,,1:00 PM
18,Sun,January 10,Detroit Lions,,@,Green Bay Packers,,1:00 PM
18,Sun,January 10,Tennessee Titans,,@,Houston Texans,,1:00 PM
18,Sun,January 10,Las Vegas Raiders,,@,Kansas City Chiefs,,1:00 PM
18,Sun,January 10,Chicago Bears,,@,Minnesota Vikings,,1:00 PM
18,Sun,January 10,Tampa Bay Buccaneers,,@,New Orleans Saints,,1:00 PM
18,Sun,January 10,Miami Dolphins,,@,New England Patriots,,1:00 PM
18,Sun,January 10,Philadelphia Eagles,,@,New York Giants,,1:00 PM
18,Sun,January 10,Seattle Seahawks,,@,Los Angeles Rams,,1:00 PM
18,Sun,January 10,Pittsburgh Steelers,,@,Baltimore Ravens,,1:00 PM
18,Sun,January 10,Dallas Cowboys,,@,Washington Commanders,,1:00 PM`;

const MONTHS = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

function normalizeTeamName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const TEAM_ALIASES = {
  'newenglandpatriots': 'NE',
  'patriots': 'NE',
  'seattleseahawks': 'SEA',
  'seahawks': 'SEA',
  'losangelesrams': 'LAR',
  'rams': 'LAR',
  'sanfrancisco49ers': 'SF',
  '49ers': 'SF',
  'losangeleschargers': 'LAC',
  'chargers': 'LAC',
  'losangeleschargers': 'LAC',
  'buffalo bills': 'BUF',
  'bills': 'BUF',
  'dolphins': 'MIA',
  'jets': 'NYJ',
  'ravens': 'BAL',
  'bengals': 'CIN',
  'browns': 'CLE',
  'steelers': 'PIT',
  'texans': 'HOU',
  'colts': 'IND',
  'jaguars': 'JAX',
  'titans': 'TEN',
  'broncos': 'DEN',
  'chiefs': 'KC',
  'raiders': 'LV',
  'cowboys': 'DAL',
  'giants': 'NYG',
  'eagles': 'PHI',
  'commanders': 'WAS',
  'saints': 'NO',
  'falcons': 'ATL',
  'panthers': 'CAR',
  'bears': 'CHI',
  'lions': 'DET',
  'vikings': 'MIN',
  'packers': 'GB',
  'cardinals': 'ARI',
  'buccaneers': 'TB',
  'saints': 'NO',
  'niners': 'SF',
  'chargers': 'LAC',
};

const TEAM_NAME_TO_ABBR = {
  'arizonacardinals': 'ARI',
  'atlantafalcons': 'ATL',
  'baltimoreravens': 'BAL',
  'buffalobills': 'BUF',
  'carolinapanthers': 'CAR',
  'chicagobears': 'CHI',
  'cincinnatibengals': 'CIN',
  'clevelandbrowns': 'CLE',
  'dallascowboys': 'DAL',
  'denverbroncos': 'DEN',
  'detroitlions': 'DET',
  'greenbaypackers': 'GB',
  'houstontexans': 'HOU',
  'indianapoliscolts': 'IND',
  'jacksonvillejaguars': 'JAX',
  'kansascitychiefs': 'KC',
  'lasvegasraiders': 'LV',
  'losangeleschargers': 'LAC',
  'losangelesrams': 'LAR',
  'miamidolphins': 'MIA',
  'minnesotavikings': 'MIN',
  'newenglandpatriots': 'NE',
  'neworleanssaints': 'NO',
  'newyorkgiants': 'NYG',
  'newyorkjets': 'NYJ',
  'philadelphiaeagles': 'PHI',
  'pittsburghsteelers': 'PIT',
  'sanfrancisco49ers': 'SF',
  'seattleseahawks': 'SEA',
  'tampabaybuccaneers': 'TB',
  'tennesseetitans': 'TEN',
  'washingtoncommanders': 'WAS',
};

function resolveTeamId(teamName, teamMap, abbrToId) {
  const normalized = normalizeTeamName(teamName);

  const direct = teamMap.get(normalized);
  if (direct) return direct;

  const aliasAbbr = TEAM_ALIASES[normalized] || TEAM_NAME_TO_ABBR[normalized];
  if (aliasAbbr) {
    const byAlias = abbrToId.get(aliasAbbr.toUpperCase());
    if (byAlias) return byAlias;
  }

  // Fallback for values like "Chicago Bears" -> "bears"
  const mascotToken = normalized.replace(/.*?(cardinals|falcons|ravens|bills|panthers|bears|bengals|browns|cowboys|broncos|lions|packers|texans|colts|jaguars|chiefs|raiders|chargers|rams|dolphins|vikings|patriots|saints|giants|jets|eagles|steelers|49ers|seahawks|buccaneers|titans|commanders)$/u, '$1');
  if (mascotToken && mascotToken !== normalized) {
    const fallbackAbbr = TEAM_ALIASES[mascotToken];
    if (fallbackAbbr) {
      return abbrToId.get(fallbackAbbr.toUpperCase());
    }
  }

  return null;
}

async function auth() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const data = await res.json();
  if (!res.ok || !data?.token) {
    throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  }
  return data.token;
}

async function getAll(token, collection, { filter, sort, fields } = {}) {
  const items = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (filter) params.set('filter', filter);
    if (sort) params.set('sort', sort);
    if (fields) params.set('fields', fields);

    const res = await fetch(`${PB_URL}/api/collections/${collection}/records?${params.toString()}`, {
      headers: { Authorization: token },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`GET ${collection} failed: ${JSON.stringify(data)}`);
    }

    const batch = data.items ?? [];
    items.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return items;
}

async function patchRecord(token, collection, id, body) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PATCH ${collection}/${id} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

function parseCsvRows(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(',').map((cell) => cell.trim());
      if (cells.length < 9) return null;
      return {
        week: Number.parseInt(cells[0], 10),
        day: cells[1],
        dateText: cells[2],
        away: cells[3],
        home: cells[6],
        timeText: cells[8],
      };
    })
    .filter(Boolean);
}

function parseGmtOffsetToMinutes(offsetLabel) {
  // Example labels: GMT-4, GMT-05:00, GMT+0
  const match = String(offsetLabel || '').match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    throw new Error(`Unexpected timezone offset label: ${offsetLabel}`);
  }

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = Number.parseInt(match[3] || '0', 10);
  return sign * (hours * 60 + minutes);
}

function getEasternOffsetMinutes(utcMillis) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcMillis));

  const offsetPart = parts.find((part) => part.type === 'timeZoneName')?.value;
  if (!offsetPart) {
    throw new Error('Could not determine America/New_York offset');
  }

  return parseGmtOffsetToMinutes(offsetPart);
}

function easternLocalToUtcIso(year, monthIndex, day, hour, minute) {
  // Convert local ET wall time into an exact UTC instant (handles DST by iterating offset).
  let utcMillis = Date.UTC(year, monthIndex, day, hour, minute);

  for (let i = 0; i < 3; i++) {
    const offsetMinutes = getEasternOffsetMinutes(utcMillis);
    const nextUtcMillis = Date.UTC(year, monthIndex, day, hour, minute) - offsetMinutes * 60 * 1000;
    if (nextUtcMillis === utcMillis) break;
    utcMillis = nextUtcMillis;
  }

  return new Date(utcMillis).toISOString();
}

function parseDateForRow(row, seasonStartYear) {
  const [monthName, dayText] = row.dateText.split(' ');
  const monthIndex = MONTHS[monthName];
  const day = Number.parseInt(dayText, 10);
  if (!Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    throw new Error(`Could not parse date from ${row.dateText}`);
  }

  const year = monthIndex === MONTHS.January ? seasonStartYear + 1 : seasonStartYear;
  const [timeValue, meridiem] = row.timeText.split(' ');
  const [hourRaw, minuteRaw] = timeValue.split(':');
  let hour = Number.parseInt(hourRaw, 10);
  const minute = Number.parseInt(minuteRaw, 10);
  const meridian = (meridiem || '').toUpperCase();

  if (meridian === 'PM' && hour !== 12) hour += 12;
  if (meridian === 'AM' && hour === 12) hour = 0;

  return easternLocalToUtcIso(year, monthIndex, day, hour, minute);
}

async function main() {
  if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASS) {
    throw new Error('Missing PUBLIC_POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, or POCKETBASE_ADMIN_PASSWORD');
  }

  const token = await auth();

  const teams = await getAll(token, 'nfl_teams');
  const teamMap = new Map();
  const abbrToId = new Map();
  for (const team of teams) {
    const normalizedName = normalizeTeamName(team.name);
    const normalizedFullName = normalizeTeamName(team.fullName || team.name);
    teamMap.set(normalizedName, team.id);
    teamMap.set(normalizedFullName, team.id);
    if (team.abbreviation) {
      const abbr = team.abbreviation.toUpperCase();
      teamMap.set(abbr, team.id);
      teamMap.set(abbr.toLowerCase(), team.id);
      abbrToId.set(abbr, team.id);
    }
    const alias = TEAM_ALIASES[normalizedName] || TEAM_ALIASES[normalizedFullName];
    if (alias) {
      teamMap.set(alias, team.id);
      teamMap.set(alias.toLowerCase(), team.id);
    }
  }

  const seasons = await getAll(token, 'seasons');
  const season = seasons.find((item) => item.status === 'active' || item.status === 'open') || seasons[0];
  if (!season) throw new Error('No season found');
  const seasonStartYear = Number.parseInt((season.name.match(/(\d{4})/) || [])[0] || '2026', 10);

  const records = await getAll(token, 'game_odds', { filter: `season = "${season.id}"`, sort: 'week' });

  const recordMap = new Map();
  for (const record of records) {
    const key = `${record.week}:${record.homeTeam}:${record.awayTeam}`;
    recordMap.set(key, record);
  }

  const rows = parseCsvRows(CSV);
  let updated = 0;
  let missing = 0;
  let failed = 0;

  for (const row of rows) {
    const homeId = resolveTeamId(row.home, teamMap, abbrToId);
    const awayId = resolveTeamId(row.away, teamMap, abbrToId);
    if (!homeId || !awayId) {
      console.warn(`Missing team mapping: ${row.away} @ ${row.home}`);
      missing++;
      continue;
    }

    const key = `${row.week}:${homeId}:${awayId}`;
    const record = recordMap.get(key);
    if (!record) {
      console.warn(`No matching game_odds record found for week ${row.week}: ${row.away} @ ${row.home}`);
      missing++;
      continue;
    }

    const gameTimeStamp = parseDateForRow(row, seasonStartYear);
    try {
      await patchRecord(token, 'game_odds', record.id, {
        game_time_stamp: gameTimeStamp,
      });
      updated++;
      if (updated <= 5) {
        console.log(`Updated ${row.week} ${row.away} @ ${row.home} -> ${gameTimeStamp}`);
      }
    } catch (error) {
      failed++;
      console.warn(`Failed ${row.week} ${row.away} @ ${row.home}: ${error.message}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}, missing: ${missing}, failed: ${failed}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  if (error?.status != null) console.error(`status=${error.status}`);
  if (error?.url) console.error(`url=${error.url}`);
  if (error?.data) console.error(`data=${JSON.stringify(error.data)}`);
  if (error?.stack) console.error(error.stack);
  process.exit(1);
});
