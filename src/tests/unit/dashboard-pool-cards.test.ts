import { describe, expect, it } from 'vitest';
import { createDashboardController } from '$lib/controllers';
import { DashboardProvider } from '$lib/providers/DashboardProvider';
import { formatCountdownDisplay, resolveCardCountdownDisplay, resolveStatusLabelText } from '$lib/utils';

describe('DashboardProvider', () => {
	it('builds LMS card state with registration and pick deadlines', () => {
		const card = DashboardProvider.buildPoolCardViewModel({
			type: 'lms',
			season: { id: 'season-1', secondHalfEnabled: true, secondHalfStartWeek: 6 },
			currentWeek: {
				week: 1,
				status: 'open',
				entryDeadline: '2026-09-09T20:40:00.000Z',
				pickDeadline: '2026-09-09T20:50:00.000Z'
			},
			week6Week: null,
			now: new Date('2026-09-01T00:00:00.000Z').getTime(),
			entries: [],
			myEntryCount: 0,
			userHasEntry: false,
			shStartWeek: 6
		});

		expect(card.registrationLabel).toBe('Registration open');
		expect(card.picksLabel).toBe('Picks open');
		expect(card.footerMessage).toContain('Picks are open');
	});

	it('builds Second Half card state before Week 6 as registration-only', () => {
		const card = DashboardProvider.buildPoolCardViewModel({
			type: 'second_half',
			season: { id: 'season-1', secondHalfEnabled: true, secondHalfStartWeek: 6 },
			currentWeek: {
				week: 1,
				status: 'open',
				entryDeadline: '2026-09-09T20:40:00.000Z',
				pickDeadline: '2026-09-09T20:50:00.000Z'
			},
			week6Week: {
				week: 6,
				status: 'open',
				entryDeadline: '2026-10-15T20:35:00.000Z',
				pickDeadline: '2026-10-15T20:45:00.000Z'
			},
			now: new Date('2026-09-01T00:00:00.000Z').getTime(),
			entries: [],
			myEntryCount: 0,
			userHasEntry: false,
			shStartWeek: 6
		});

		expect(card.registrationLabel).toBe('Registration open');
		expect(card.picksLabel).toBe('Picks pending');
		expect(card.picksLive).toBe(false);
		expect(card.footerMessage).toContain('Registration is open');
	});

	it('uses a placeholder value when a countdown is not active', () => {
		expect(formatCountdownDisplay(0, false)).toBe('—');
		expect(formatCountdownDisplay(5_000, true)).toBe('00:00:05');
	});

	it('uses the registration countdown for the pending Second Half row', () => {
		const countdown = resolveCardCountdownDisplay({
			isSecondHalfPending: true,
			registrationDiffMs: 30_000,
			registrationLive: true,
			picksDiffMs: 5_000,
			picksLive: false
		});

		expect(countdown).toBe('00:00:30');
	});

	it('keeps the registration status label visible for pool cards', () => {
		expect(resolveStatusLabelText(true, 'Registration open')).toBe('Registration open');
		expect(resolveStatusLabelText(false, 'Registration open')).toBe('Registration open');
	});

	it('uses pool-specific entry state for the Second Half card when the user only has LMS entries', () => {
		const controller = createDashboardController({
			seasonGroups: [{
				season: { id: 'season-1', secondHalfEnabled: true, secondHalfStartWeek: 6 },
				entries: [{ id: 'entry-1', season: 'season-1', entryType: 'lms', status: 'active' }]
			}],
			selectedSeasonId: 'season-1',
			currentWeekBySeason: {
				'season-1': {
					week: 1,
					status: 'open',
					entryDeadline: '2026-09-09T20:40:00.000Z',
					pickDeadline: '2026-09-09T20:50:00.000Z'
				}
			},
			week6BySeason: {
				'season-1': {
					week: 6,
					status: 'open',
					entryDeadline: '2026-10-15T20:35:00.000Z',
					pickDeadline: '2026-10-15T20:45:00.000Z'
				}
			},
			entries: [{ id: 'entry-1', season: 'season-1', entryType: 'lms', status: 'active' }],
			now: new Date('2026-09-01T00:00:00.000Z').getTime()
		});

		const secondHalfCard = controller.cardGroups[0].secondHalfCard;
		expect(secondHalfCard).not.toBeNull();
		expect(secondHalfCard?.footerMessage).toContain('Registration is open');
		expect(secondHalfCard?.ctaHref).toBe('/dashboard/entries/new');
	});
});
