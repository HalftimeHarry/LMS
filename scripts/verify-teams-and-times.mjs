import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb.admins.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);

const records = await pb.collection('game_odds').getFullList({
  filter: 'week = 1',
  sort: 'game_time_stamp',
  fields: 'id,week,game_time_stamp,gameTime,homeTeam,awayTeam',
  expand: 'homeTeam,awayTeam'
});

const teams = await pb.collection('teams').getFullList({ fields: 'id,abbreviation,name' });
const teamMap = new Map(teams.map(t => [t.id, t.abbreviation]));

for (const r of records) {
  const homeAbbr = teamMap.get(r.homeTeam) || r.homeTeam;
  const awayAbbr = teamMap.get(r.awayTeam) || r.awayTeam;
  console.log(`${awayAbbr}@${homeAbbr} :: ${r.game_time_stamp ?? r.gameTime}`);
}
