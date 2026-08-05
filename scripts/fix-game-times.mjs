import dotenv from 'dotenv';
import PocketBase from 'pocketbase';

dotenv.config();

const pb = new PocketBase(process.env.PUBLIC_POCKETBASE_URL);
await pb.admins.authWithPassword(process.env.POCKETBASE_ADMIN_EMAIL, process.env.POCKETBASE_ADMIN_PASSWORD);

const SCHEDULE = [
  { week: 1, games: [
    { away: 'NE',  home: 'SEA', time: '2026-09-09T20:20:00Z' },
    { away: 'SF',  home: 'LAR', time: '2026-09-10T00:35:00Z' },
    { away: 'CHI', home: 'CAR', time: '2026-09-13T17:00:00Z' },
    { away: 'TB',  home: 'CIN', time: '2026-09-13T17:00:00Z' },
    { away: 'BAL', home: 'IND', time: '2026-09-13T17:00:00Z' },
    { away: 'BUF', home: 'HOU', time: '2026-09-13T17:00:00Z' },
    { away: 'NO',  home: 'DET', time: '2026-09-13T17:00:00Z' },
    { away: 'NYJ', home: 'TEN', time: '2026-09-13T17:00:00Z' },
    { away: 'ATL', home: 'PIT', time: '2026-09-13T17:00:00Z' },
    { away: 'CLE', home: 'JAX', time: '2026-09-13T17:00:00Z' },
    { away: 'ARI', home: 'LAC', time: '2026-09-13T20:25:00Z' },
    { away: 'GB',  home: 'MIN', time: '2026-09-13T20:25:00Z' },
    { away: 'MIA', home: 'LV',  time: '2026-09-13T20:25:00Z' },
    { away: 'WAS', home: 'PHI', time: '2026-09-13T20:25:00Z' },
    { away: 'DAL', home: 'NYG', time: '2026-09-14T00:20:00Z' },
    { away: 'DEN', home: 'KC',  time: '2026-09-15T00:15:00Z' },
  ]},
  { week: 2, games: [
    { away: 'DET', home: 'BUF', time: '2026-09-17T00:15:00Z' },
    { away: 'MIN', home: 'CHI', time: '2026-09-20T17:00:00Z' },
    { away: 'PHI', home: 'TEN', time: '2026-09-20T17:00:00Z' },
    { away: 'GB',  home: 'NYJ', time: '2026-09-20T17:00:00Z' },
    { away: 'CAR', home: 'ATL', time: '2026-09-20T17:00:00Z' },
    { away: 'NO',  home: 'BAL', time: '2026-09-20T17:00:00Z' },
    { away: 'CIN', home: 'HOU', time: '2026-09-20T17:00:00Z' },
    { away: 'CLE', home: 'TB',  time: '2026-09-20T17:00:00Z' },
    { away: 'PIT', home: 'NE',  time: '2026-09-20T17:00:00Z' },
    { away: 'LV',  home: 'LAC', time: '2026-09-20T20:05:00Z' },
    { away: 'JAX', home: 'DEN', time: '2026-09-20T20:05:00Z' },
    { away: 'WAS', home: 'DAL', time: '2026-09-20T20:25:00Z' },
    { away: 'SEA', home: 'ARI', time: '2026-09-20T20:25:00Z' },
    { away: 'MIA', home: 'SF',  time: '2026-09-20T20:25:00Z' },
    { away: 'IND', home: 'KC',  time: '2026-09-21T00:20:00Z' },
    { away: 'NYG', home: 'LAR', time: '2026-09-22T00:15:00Z' },
  ]},
  { week: 3, games: [
    { away: 'ATL', home: 'GB',  time: '2026-09-24T00:15:00Z' },
    { away: 'KC',  home: 'MIA', time: '2026-09-27T17:00:00Z' },
    { away: 'HOU', home: 'IND', time: '2026-09-27T17:00:00Z' },
    { away: 'TEN', home: 'NYG', time: '2026-09-27T17:00:00Z' },
    { away: 'NE',  home: 'JAX', time: '2026-09-27T17:00:00Z' },
    { away: 'CIN', home: 'PIT', time: '2026-09-27T17:00:00Z' },
    { away: 'CAR', home: 'CLE', time: '2026-09-27T17:00:00Z' },
    { away: 'NYJ', home: 'DET', time: '2026-09-27T17:00:00Z' },
    { away: 'SEA', home: 'WAS', time: '2026-09-27T17:00:00Z' },
    { away: 'LAC', home: 'BUF', time: '2026-09-27T17:00:00Z' },
    { away: 'MIN', home: 'TB',  time: '2026-09-27T20:05:00Z' },
    { away: 'ARI', home: 'SF',  time: '2026-09-27T20:05:00Z' },
    { away: 'BAL', home: 'DAL', time: '2026-09-27T20:25:00Z' },
    { away: 'LV',  home: 'NO',  time: '2026-09-27T20:25:00Z' },
    { away: 'LAR', home: 'DEN', time: '2026-09-28T00:20:00Z' },
    { away: 'PHI', home: 'CHI', time: '2026-09-29T00:15:00Z' },
  ]},
  { week: 4, games: [
    { away: 'PIT', home: 'CLE', time: '2026-10-01T00:15:00Z' },
    { away: 'IND', home: 'WAS', time: '2026-10-04T13:30:00Z' },
    { away: 'TEN', home: 'BAL', time: '2026-10-04T17:00:00Z' },
    { away: 'ARI', home: 'NYG', time: '2026-10-04T17:00:00Z' },
    { away: 'JAX', home: 'CIN', time: '2026-10-04T17:00:00Z' },
    { away: 'NE',  home: 'BUF', time: '2026-10-04T17:00:00Z' },
    { away: 'DAL', home: 'HOU', time: '2026-10-04T17:00:00Z' },
    { away: 'LAR', home: 'PHI', time: '2026-10-04T17:00:00Z' },
    { away: 'GB',  home: 'TB',  time: '2026-10-04T17:00:00Z' },
    { away: 'NYJ', home: 'CHI', time: '2026-10-04T17:00:00Z' },
    { away: 'MIA', home: 'MIN', time: '2026-10-04T20:05:00Z' },
    { away: 'DEN', home: 'SF',  time: '2026-10-04T20:25:00Z' },
    { away: 'LAC', home: 'SEA', time: '2026-10-04T20:25:00Z' },
    { away: 'KC',  home: 'LV',  time: '2026-10-04T20:25:00Z' },
    { away: 'DET', home: 'CAR', time: '2026-10-05T00:20:00Z' },
    { away: 'ATL', home: 'NO',  time: '2026-10-06T00:15:00Z' },
  ]},
  { week: 5, games: [
    { away: 'TB',  home: 'DAL', time: '2026-10-08T00:15:00Z' },
    { away: 'PHI', home: 'JAX', time: '2026-10-11T13:30:00Z' },
    { away: 'LV',  home: 'NE',  time: '2026-10-11T17:00:00Z' },
    { away: 'HOU', home: 'TEN', time: '2026-10-11T17:00:00Z' },
    { away: 'CLE', home: 'NYJ', time: '2026-10-11T17:00:00Z' },
    { away: 'IND', home: 'PIT', time: '2026-10-11T17:00:00Z' },
    { away: 'CIN', home: 'MIA', time: '2026-10-11T17:00:00Z' },
    { away: 'MIN', home: 'NO',  time: '2026-10-11T17:00:00Z' },
    { away: 'NYG', home: 'WAS', time: '2026-10-11T17:00:00Z' },
    { away: 'DEN', home: 'LAC', time: '2026-10-11T20:05:00Z' },
    { away: 'CHI', home: 'GB',  time: '2026-10-11T20:25:00Z' },
    { away: 'DET', home: 'ARI', time: '2026-10-11T20:25:00Z' },
    { away: 'SF',  home: 'SEA', time: '2026-10-11T20:25:00Z' },
    { away: 'BAL', home: 'ATL', time: '2026-10-12T00:20:00Z' },
    { away: 'BUF', home: 'LAR', time: '2026-10-13T00:15:00Z' },
  ]},
  { week: 6, games: [
    { away: 'SEA', home: 'DEN', time: '2026-10-15T00:15:00Z' },
    { away: 'HOU', home: 'JAX', time: '2026-10-18T13:30:00Z' },
    { away: 'NYJ', home: 'NE',  time: '2026-10-18T17:00:00Z' },
    { away: 'PIT', home: 'TB',  time: '2026-10-18T17:00:00Z' },
    { away: 'CAR', home: 'PHI', time: '2026-10-18T17:00:00Z' },
    { away: 'CHI', home: 'ATL', time: '2026-10-18T17:00:00Z' },
    { away: 'TEN', home: 'IND', time: '2026-10-18T17:00:00Z' },
    { away: 'NO',  home: 'NYG', time: '2026-10-18T17:00:00Z' },
    { away: 'BAL', home: 'CLE', time: '2026-10-18T17:00:00Z' },
    { away: 'ARI', home: 'LAR', time: '2026-10-18T20:05:00Z' },
    { away: 'LAC', home: 'KC',  time: '2026-10-18T20:25:00Z' },
    { away: 'BUF', home: 'LV',  time: '2026-10-18T20:25:00Z' },
    { away: 'DAL', home: 'GB',  time: '2026-10-19T00:20:00Z' },
    { away: 'WAS', home: 'SF',  time: '2026-10-20T00:15:00Z' },
  ]},
  { week: 7, games: [
    { away: 'NE',  home: 'CHI', time: '2026-10-22T00:15:00Z' },
    { away: 'PIT', home: 'NO',  time: '2026-10-25T13:30:00Z' },
    { away: 'CLE', home: 'TEN', time: '2026-10-25T17:00:00Z' },
    { away: 'MIA', home: 'NYJ', time: '2026-10-25T17:00:00Z' },
    { away: 'IND', home: 'MIN', time: '2026-10-25T17:00:00Z' },
    { away: 'CIN', home: 'BAL', time: '2026-10-25T17:00:00Z' },
    { away: 'NYG', home: 'HOU', time: '2026-10-25T17:00:00Z' },
    { away: 'TB',  home: 'CAR', time: '2026-10-25T17:00:00Z' },
    { away: 'SF',  home: 'ATL', time: '2026-10-25T17:00:00Z' },
    { away: 'DEN', home: 'ARI', time: '2026-10-25T20:05:00Z' },
    { away: 'LAR', home: 'LV',  time: '2026-10-25T20:25:00Z' },
    { away: 'GB',  home: 'DET', time: '2026-10-25T20:25:00Z' },
    { away: 'KC',  home: 'SEA', time: '2026-10-26T00:20:00Z' },
    { away: 'DAL', home: 'PHI', time: '2026-10-27T00:15:00Z' },
  ]},
  { week: 8, games: [
    { away: 'CAR', home: 'GB',  time: '2026-10-29T00:15:00Z' },
    { away: 'TEN', home: 'CIN', time: '2026-11-01T17:00:00Z' },
    { away: 'IND', home: 'JAX', time: '2026-11-01T17:00:00Z' },
    { away: 'CLE', home: 'PIT', time: '2026-11-01T17:00:00Z' },
    { away: 'BAL', home: 'BUF', time: '2026-11-01T17:00:00Z' },
    { away: 'ATL', home: 'TB',  time: '2026-11-01T17:00:00Z' },
    { away: 'MIN', home: 'DET', time: '2026-11-01T17:00:00Z' },
    { away: 'ARI', home: 'DAL', time: '2026-11-01T17:00:00Z' },
    { away: 'LV',  home: 'NYJ', time: '2026-11-01T17:00:00Z' },
    { away: 'LAC', home: 'LAR', time: '2026-11-01T20:05:00Z' },
    { away: 'KC',  home: 'DEN', time: '2026-11-01T20:25:00Z' },
    { away: 'NE',  home: 'MIA', time: '2026-11-01T20:25:00Z' },
    { away: 'PHI', home: 'WAS', time: '2026-11-02T00:20:00Z' },
    { away: 'CHI', home: 'SEA', time: '2026-11-03T00:15:00Z' },
  ]},
  { week: 9, games: [
    { away: 'JAX', home: 'BAL', time: '2026-11-05T00:15:00Z' },
    { away: 'CIN', home: 'ATL', time: '2026-11-08T13:30:00Z' },
    { away: 'NYJ', home: 'KC',  time: '2026-11-08T17:00:00Z' },
    { away: 'CLE', home: 'NO',  time: '2026-11-08T17:00:00Z' },
    { away: 'DEN', home: 'CAR', time: '2026-11-08T17:00:00Z' },
    { away: 'DAL', home: 'IND', time: '2026-11-08T17:00:00Z' },
    { away: 'DET', home: 'MIA', time: '2026-11-08T17:00:00Z' },
    { away: 'NYG', home: 'PHI', time: '2026-11-08T17:00:00Z' },
    { away: 'LAR', home: 'WAS', time: '2026-11-08T17:00:00Z' },
    { away: 'LV',  home: 'SF',  time: '2026-11-08T20:05:00Z' },
    { away: 'HOU', home: 'LAC', time: '2026-11-08T20:05:00Z' },
    { away: 'ARI', home: 'SEA', time: '2026-11-08T20:25:00Z' },
    { away: 'GB',  home: 'NE',  time: '2026-11-08T20:25:00Z' },
    { away: 'TB',  home: 'CHI', time: '2026-11-09T00:20:00Z' },
    { away: 'BUF', home: 'MIN', time: '2026-11-10T00:15:00Z' },
  ]},
  { week: 10, games: [
    { away: 'WAS', home: 'NYG', time: '2026-11-12T00:15:00Z' },
    { away: 'NE',  home: 'DET', time: '2026-11-15T13:30:00Z' },
    { away: 'BUF', home: 'NYJ', time: '2026-11-15T17:00:00Z' },
    { away: 'MIA', home: 'IND', time: '2026-11-15T17:00:00Z' },
    { away: 'KC',  home: 'ATL', time: '2026-11-15T17:00:00Z' },
    { away: 'MIN', home: 'GB',  time: '2026-11-15T17:00:00Z' },
    { away: 'JAX', home: 'TEN', time: '2026-11-15T17:00:00Z' },
    { away: 'HOU', home: 'CLE', time: '2026-11-15T17:00:00Z' },
    { away: 'CAR', home: 'NO',  time: '2026-11-15T17:00:00Z' },
    { away: 'LAR', home: 'ARI', time: '2026-11-15T20:05:00Z' },
    { away: 'SEA', home: 'LV',  time: '2026-11-15T20:05:00Z' },
    { away: 'SF',  home: 'DAL', time: '2026-11-15T20:25:00Z' },
    { away: 'PIT', home: 'CIN', time: '2026-11-16T00:20:00Z' },
    { away: 'LAC', home: 'BAL', time: '2026-11-17T00:15:00Z' },
  ]},
  { week: 11, games: [
    { away: 'IND', home: 'HOU', time: '2026-11-19T00:15:00Z' },
    { away: 'ARI', home: 'KC',  time: '2026-11-22T17:00:00Z' },
    { away: 'TB',  home: 'DET', time: '2026-11-22T17:00:00Z' },
    { away: 'JAX', home: 'NYG', time: '2026-11-22T17:00:00Z' },
    { away: 'MIA', home: 'BUF', time: '2026-11-22T17:00:00Z' },
    { away: 'TEN', home: 'DAL', time: '2026-11-22T17:00:00Z' },
    { away: 'BAL', home: 'CAR', time: '2026-11-22T17:00:00Z' },
    { away: 'NO',  home: 'CHI', time: '2026-11-22T17:00:00Z' },
    { away: 'NYJ', home: 'LAC', time: '2026-11-22T20:05:00Z' },
    { away: 'PIT', home: 'PHI', time: '2026-11-22T20:25:00Z' },
    { away: 'LV',  home: 'DEN', time: '2026-11-22T20:25:00Z' },
    { away: 'MIN', home: 'SF',  time: '2026-11-23T00:20:00Z' },
    { away: 'CIN', home: 'WAS', time: '2026-11-24T00:15:00Z' },
  ]},
  { week: 12, games: [
    { away: 'GB',  home: 'LAR', time: '2026-11-26T01:00:00Z' },
    { away: 'CHI', home: 'DET', time: '2026-11-26T18:00:00Z' },
    { away: 'PHI', home: 'DAL', time: '2026-11-26T21:30:00Z' },
    { away: 'KC',  home: 'BUF', time: '2026-11-27T01:20:00Z' },
    { away: 'DEN', home: 'PIT', time: '2026-11-27T20:00:00Z' },
    { away: 'BAL', home: 'HOU', time: '2026-11-29T17:00:00Z' },
    { away: 'NO',  home: 'CIN', time: '2026-11-29T17:00:00Z' },
    { away: 'NYJ', home: 'MIA', time: '2026-11-29T17:00:00Z' },
    { away: 'ATL', home: 'MIN', time: '2026-11-29T17:00:00Z' },
    { away: 'NYG', home: 'IND', time: '2026-11-29T17:00:00Z' },
    { away: 'LV',  home: 'CLE', time: '2026-11-29T17:00:00Z' },
    { away: 'TEN', home: 'JAX', time: '2026-11-29T20:05:00Z' },
    { away: 'WAS', home: 'ARI', time: '2026-11-29T20:25:00Z' },
    { away: 'SEA', home: 'SF',  time: '2026-11-29T20:25:00Z' },
    { away: 'NE',  home: 'LAC', time: '2026-11-30T01:20:00Z' },
    { away: 'CAR', home: 'TB',  time: '2026-12-01T01:15:00Z' },
  ]},
  { week: 13, games: [
    { away: 'KC',  home: 'LAR', time: '2026-12-03T01:15:00Z' },
    { away: 'WAS', home: 'ARI', time: '2026-12-06T17:00:00Z' },
    { away: 'DET', home: 'ATL', time: '2026-12-06T17:00:00Z' },
    { away: 'LAC', home: 'TB',  time: '2026-12-06T17:00:00Z' },
    { away: 'WAS', home: 'TEN', time: '2026-12-06T17:00:00Z' },
    { away: 'CIN', home: 'CLE', time: '2026-12-06T17:00:00Z' },
    { away: 'SF',  home: 'NYG', time: '2026-12-06T17:00:00Z' },
    { away: 'GB',  home: 'NO',  time: '2026-12-06T17:00:00Z' },
    { away: 'JAX', home: 'CHI', time: '2026-12-06T17:00:00Z' },
    { away: 'PHI', home: 'ARI', time: '2026-12-06T20:05:00Z' },
    { away: 'MIA', home: 'DEN', time: '2026-12-06T20:05:00Z' },
    { away: 'CAR', home: 'MIN', time: '2026-12-06T20:25:00Z' },
    { away: 'BUF', home: 'NE',  time: '2026-12-06T20:25:00Z' },
    { away: 'HOU', home: 'PIT', time: '2026-12-07T01:20:00Z' },
    { away: 'DAL', home: 'SEA', time: '2026-12-08T01:15:00Z' },
  ]},
  { week: 14, games: [
    { away: 'MIN', home: 'NE',  time: '2026-12-10T01:15:00Z' },
    { away: 'DEN', home: 'NYJ', time: '2026-12-13T17:00:00Z' },
    { away: 'ATL', home: 'CLE', time: '2026-12-13T17:00:00Z' },
    { away: 'CHI', home: 'MIA', time: '2026-12-13T17:00:00Z' },
    { away: 'HOU', home: 'WAS', time: '2026-12-13T17:00:00Z' },
    { away: 'NO',  home: 'CAR', time: '2026-12-13T17:00:00Z' },
    { away: 'IND', home: 'PHI', time: '2026-12-13T17:00:00Z' },
    { away: 'TB',  home: 'BAL', time: '2026-12-13T17:00:00Z' },
    { away: 'TEN', home: 'DET', time: '2026-12-13T17:00:00Z' },
    { away: 'LAC', home: 'LV',  time: '2026-12-13T20:05:00Z' },
    { away: 'KC',  home: 'CIN', time: '2026-12-13T20:25:00Z' },
    { away: 'LAR', home: 'SF',  time: '2026-12-13T20:25:00Z' },
    { away: 'NYG', home: 'SEA', time: '2026-12-13T20:25:00Z' },
    { away: 'BUF', home: 'GB',  time: '2026-12-14T01:20:00Z' },
    { away: 'PIT', home: 'JAX', time: '2026-12-15T01:15:00Z' },
  ]},
  { week: 15, games: [
    { away: 'SF',  home: 'LAC', time: '2026-12-17T01:15:00Z' },
    { away: 'SEA', home: 'PHI', time: '2026-12-19T22:00:00Z' },
    { away: 'CHI', home: 'BUF', time: '2026-12-20T01:20:00Z' },
    { away: 'JAX', home: 'HOU', time: '2026-12-20T17:00:00Z' },
    { away: 'BAL', home: 'PIT', time: '2026-12-20T17:00:00Z' },
    { away: 'CLE', home: 'NYG', time: '2026-12-20T17:00:00Z' },
    { away: 'IND', home: 'TEN', time: '2026-12-20T17:00:00Z' },
    { away: 'MIA', home: 'GB',  time: '2026-12-20T17:00:00Z' },
    { away: 'NO',  home: 'TB',  time: '2026-12-20T17:00:00Z' },
    { away: 'CIN', home: 'CAR', time: '2026-12-20T17:00:00Z' },
    { away: 'ATL', home: 'WAS', time: '2026-12-20T17:00:00Z' },
    { away: 'NYJ', home: 'ARI', time: '2026-12-20T20:05:00Z' },
    { away: 'DAL', home: 'LAR', time: '2026-12-20T20:25:00Z' },
    { away: 'DEN', home: 'LV',  time: '2026-12-20T20:25:00Z' },
    { away: 'DET', home: 'MIN', time: '2026-12-21T01:20:00Z' },
    { away: 'NE',  home: 'KC',  time: '2026-12-22T01:15:00Z' },
  ]},
  { week: 16, games: [
    { away: 'HOU', home: 'PHI', time: '2026-12-24T01:15:00Z' },
    { away: 'GB',  home: 'CHI', time: '2026-12-25T18:00:00Z' },
    { away: 'BUF', home: 'DEN', time: '2026-12-25T21:30:00Z' },
    { away: 'LAR', home: 'SEA', time: '2026-12-26T01:15:00Z' },
    { away: 'TB',  home: 'ATL', time: '2026-12-27T17:00:00Z' },
    { away: 'WAS', home: 'MIN', time: '2026-12-27T17:00:00Z' },
    { away: 'CAR', home: 'PIT', time: '2026-12-27T17:00:00Z' },
    { away: 'CIN', home: 'IND', time: '2026-12-27T17:00:00Z' },
    { away: 'NE',  home: 'NYJ', time: '2026-12-27T17:00:00Z' },
    { away: 'CLE', home: 'BAL', time: '2026-12-27T17:00:00Z' },
    { away: 'LAC', home: 'MIA', time: '2026-12-27T17:00:00Z' },
    { away: 'ARI', home: 'LV',  time: '2026-12-27T20:05:00Z' },
    { away: 'SF',  home: 'KC',  time: '2026-12-27T20:25:00Z' },
    { away: 'JAX', home: 'DAL', time: '2026-12-28T01:20:00Z' },
    { away: 'NYG', home: 'DET', time: '2026-12-29T01:15:00Z' },
  ]},
  { week: 17, games: [
    { away: 'BAL', home: 'CIN', time: '2026-12-31T01:15:00Z' },
    { away: 'LAR', home: 'TB',  time: '2027-01-03T17:00:00Z' },
    { away: 'DEN', home: 'NE',  time: '2027-01-03T17:00:00Z' },
    { away: 'KC',  home: 'LAC', time: '2027-01-03T17:00:00Z' },
    { away: 'WAS', home: 'JAX', time: '2027-01-03T17:00:00Z' },
    { away: 'BUF', home: 'MIA', time: '2027-01-03T17:00:00Z' },
    { away: 'PIT', home: 'TEN', time: '2027-01-03T17:00:00Z' },
    { away: 'MIN', home: 'NYJ', time: '2027-01-03T17:00:00Z' },
    { away: 'NO',  home: 'ATL', time: '2027-01-03T17:00:00Z' },
    { away: 'SEA', home: 'CAR', time: '2027-01-03T17:00:00Z' },
    { away: 'IND', home: 'CLE', time: '2027-01-03T17:00:00Z' },
    { away: 'NYG', home: 'DAL', time: '2027-01-03T17:00:00Z' },
    { away: 'LV',  home: 'ARI', time: '2027-01-03T20:05:00Z' },
    { away: 'DET', home: 'CHI', time: '2027-01-03T20:25:00Z' },
    { away: 'PHI', home: 'SF',  time: '2027-01-04T01:20:00Z' },
    { away: 'HOU', home: 'GB',  time: '2027-01-05T01:15:00Z' },
  ]},
  { week: 18, games: [
    { away: 'NYJ', home: 'BUF', time: '2027-01-10T17:00:00Z' },
    { away: 'JAX', home: 'IND', time: '2027-01-10T17:00:00Z' },
    { away: 'LV',  home: 'KC',  time: '2027-01-10T17:00:00Z' },
    { away: 'TEN', home: 'HOU', time: '2027-01-10T17:00:00Z' },
    { away: 'LAC', home: 'DEN', time: '2027-01-10T17:00:00Z' },
    { away: 'MIA', home: 'NE',  time: '2027-01-10T17:00:00Z' },
    { away: 'CLE', home: 'CIN', time: '2027-01-10T17:00:00Z' },
    { away: 'PIT', home: 'BAL', time: '2027-01-10T17:00:00Z' },
    { away: 'CHI', home: 'MIN', time: '2027-01-10T17:00:00Z' },
    { away: 'DET', home: 'GB',  time: '2027-01-10T17:00:00Z' },
    { away: 'DAL', home: 'WAS', time: '2027-01-10T17:00:00Z' },
    { away: 'TB',  home: 'NO',  time: '2027-01-10T17:00:00Z' },
    { away: 'PHI', home: 'NYG', time: '2027-01-10T17:00:00Z' },
    { away: 'SEA', home: 'LAR', time: '2027-01-10T17:00:00Z' },
    { away: 'ATL', home: 'CAR', time: '2027-01-10T17:00:00Z' },
    { away: 'SF',  home: 'ARI', time: '2027-01-10T17:00:00Z' },
  ]},
];

function toUtcFromEt(raw) {
  const [datePart, timePart] = raw.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.replace('Z', '').split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, ss);
  const isDst = (m >= 3 && m <= 10) || (m === 11 && d > 1) || (m === 12 && d > 1);
  const offsetMs = isDst ? 4 * 60 * 60 * 1000 : 5 * 60 * 60 * 1000;
  const dt = new Date(utcMs - offsetMs);
  return dt.toISOString();
}

function to_pb(value) {
  return value.replace('T', ' ').slice(0, 23) + 'Z';
}

const teams = await pb.collection('nfl_teams').getFullList({ fields: 'id,abbreviation' });
const teamMap = new Map(teams.map((t) => [t.abbreviation, t.id]));
const records = await pb.collection('game_odds').getFullList({ fields: 'id,week,homeTeam,awayTeam,game_time_stamp,gameTime' });

let updated = 0;
let skipped = 0;
let unmatched = 0;

for (const record of records) {
  const weekGames = SCHEDULE.find((w) => w.week === Number(record.week));
  if (!weekGames) continue;
  const match = weekGames.games.find((g) => {
    const homeId = teamMap.get(g.home);
    const awayId = teamMap.get(g.away);
    return homeId && awayId && homeId === record.homeTeam && awayId === record.awayTeam;
  });
  if (!match) {
    unmatched++;
    continue;
  }
  const desired = to_pb(toUtcFromEt(match.time));
  const current = record.game_time_stamp ?? record.gameTime;
  if (current === desired) {
    skipped++;
    continue;
  }
  await pb.collection('game_odds').update(record.id, { game_time_stamp: desired });
  updated++;
}

console.log(JSON.stringify({ updated, skipped, unmatched, total: records.length }, null, 2));
