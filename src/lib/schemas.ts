import { z } from 'zod';

export const entryTypeSchema = z.enum(['lms', 'second_half']);
export type EntryType = z.infer<typeof entryTypeSchema>;

export const seasonSchema = z.object({
	name:                    z.string().min(2, 'Name must be at least 2 characters'),
	year:                    z.coerce.number().int().min(2020).max(2040),
	lmsEntryFee:             z.coerce.number().positive('LMS entry fee must be positive'),
	secondHalfEntryFee:      z.coerce.number().positive('Second half entry fee must be positive'),
	// LMS always 1 pick/week (pick the loser). Second Half picks winners; default 1, can be 2 or 3.
	secondHalfPicksPerWeek:  z.coerce.number().int().min(1).max(3).default(1),
	paymentDeadline:         z.string().optional(),
	regularSeasonOnly:       z.boolean().default(true),
	notes:                   z.string().optional(),
	// Pool toggles — admin can independently open/close each pool
	lmsEnabled:              z.boolean().default(true),
	secondHalfEnabled:       z.boolean().default(true),
	// Week number when 2nd Half registration opens (default 6)
	secondHalfStartWeek:     z.coerce.number().int().min(1).max(18).default(6),
	// Week number when 2nd Half picks increase to secondHalfPicksPerWeek (default 10)
	secondHalfPicksStartWeek: z.coerce.number().int().min(1).max(18).default(10),
	// Shared operating cost deducted proportionally from each pool's payout (default 0)
	maintenanceFee: z.coerce.number().min(0).default(0),
});

export const entryRequestSchema = z.object({
	seasonId:   z.string().min(1, 'Season is required'),
	entryType:  entryTypeSchema,
	entryName:  z.string().min(2, 'Entry name must be at least 2 characters').max(50),
	referredBy: z.string().max(50).optional()
});

export const adminCreateEntriesSchema = z.object({
	seasonId:      z.string().min(1, 'Season is required'),
	userId:        z.string().min(1, 'Player is required'),
	entryType:     entryTypeSchema,
	count:         z.coerce.number().int().min(1).max(20).default(1),
	baseName:      z.string().min(2, 'Entry name must be at least 2 characters').max(50),
	referredBy:    z.string().max(50).optional(),
	complimentary: z.coerce.boolean().default(false)
});

export const paymentSchema = z.object({
	entryId:       z.string().min(1),
	paymentMethod: z.enum(['check', 'venmo', 'paypal', 'zelle', 'cash', 'free'])
});

// LMS: exactly 1 team (the one you think will lose)
// Second Half: 1–3 teams (the ones you think will win), count enforced by season config
export const submitPickSchema = z.object({
	entryId:     z.string().min(1, 'Entry is required'),
	weekId:      z.string().min(1, 'Week is required'),
	entryType:   entryTypeSchema,
	teamIds:     z.array(z.string().min(1)).min(1, 'At least one team is required').max(3)
});

export const recordPickResultSchema = z.object({
	pickId:  z.string().min(1),
	teamId:  z.string().min(1),
	result:  z.enum(['pending', 'correct', 'incorrect']),
	notes:   z.string().optional()
});

export type SubmitPickSchema       = z.infer<typeof submitPickSchema>;
export type RecordPickResultSchema = z.infer<typeof recordPickResultSchema>;

export type SeasonSchema             = z.infer<typeof seasonSchema>;
export type EntryRequestSchema       = z.infer<typeof entryRequestSchema>;
export type AdminCreateEntriesSchema = z.infer<typeof adminCreateEntriesSchema>;
export type PaymentSchema            = z.infer<typeof paymentSchema>;
