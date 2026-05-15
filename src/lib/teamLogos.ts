/**
 * NFL team logo URLs via ESPN CDN.
 * Logos provided by ESPN. All logos are trademarks of their respective teams.
 *
 * Usage:
 *   import { teamLogoUrl } from '$lib/teamLogos';
 *   <img src={teamLogoUrl('MIA')} alt="Miami Dolphins" />
 */

// ESPN CDN abbreviation overrides — most match the standard NFL abbrev lowercased,
// but a handful differ.
const ESPN_ABBREV: Record<string, string> = {
	ARI: 'ari',
	ATL: 'atl',
	BAL: 'bal',
	BUF: 'buf',
	CAR: 'car',
	CHI: 'chi',
	CIN: 'cin',
	CLE: 'cle',
	DAL: 'dal',
	DEN: 'den',
	DET: 'det',
	GB:  'gb',
	HOU: 'hou',
	IND: 'ind',
	JAX: 'jax',
	KC:  'kc',
	LAC: 'lac',
	LAR: 'lar',
	LV:  'lv',
	MIA: 'mia',
	MIN: 'min',
	NE:  'ne',
	NO:  'no',
	NYG: 'nyg',
	NYJ: 'nyj',
	PHI: 'phi',
	PIT: 'pit',
	SEA: 'sea',
	SF:  'sf',
	TB:  'tb',
	TEN: 'ten',
	WAS: 'wsh', // ESPN uses 'wsh' not 'was'
};

const BASE = 'https://a.espncdn.com/i/teamlogos/nfl/500';

export function teamLogoUrl(abbreviation: string): string {
	const espn = ESPN_ABBREV[abbreviation?.toUpperCase()] ?? abbreviation?.toLowerCase();
	return `${BASE}/${espn}.png`;
}
