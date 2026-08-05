import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb.admins.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);

const recordId = process.argv[2];
const newTime = process.argv[3];

if (!recordId || !newTime) {
  console.error('Usage: node scripts/fix-one-game-time.mjs <recordId> <newTime>');
  process.exit(1);
}

const record = await pb.collection('game_odds').update(recordId, {
  game_time_stamp: newTime,
});
console.log(JSON.stringify(record, null, 2));
