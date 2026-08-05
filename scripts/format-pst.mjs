import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb.admins.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);

const records = await pb.collection('game_odds').getFullList({
  filter: 'week = 1',
  sort: 'game_time_stamp',
  fields: 'id,game_time_stamp,gameTime,notes'
});

for (const r of records) {
  const d = new Date(r.game_time_stamp ?? r.gameTime);
  const pst = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(d);
  console.log(`${pst}\t${r.notes || ''}`);
}
