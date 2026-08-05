import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb.admins.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);
const records = await pb.collection('game_odds').getFullList({
  filter: 'week = 1',
  sort: 'game_time_stamp',
  fields: 'id,week,game_time_stamp,gameTime,season,homeTeam,awayTeam,notes'
});
console.log(JSON.stringify(records, null, 2));
