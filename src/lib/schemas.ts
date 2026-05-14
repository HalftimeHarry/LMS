import { z } from 'zod';

export const entryTypeSchema = z.enum(['lms', 'second_half']);
export type EntryType = z.infer<typeof entryTypeSchema>;

export const seasonSchema = z.object({
	name:                 z.string().min(2, 'Name must be at least 2 characters'),
	year:                 z.coerce.number().int().min(2020).max(2040),
	lmsEntryFee:          z.coerce.number().positive('LMS entry fee must be positive'),
	secondHalfEntryFee:   z.coerce.number().positive('Second half entry fee must be positive'),
	paymentDeadline:      z.string().optional(),
	firstPickDeadline:    z.string().optional(),
	regularSeasonOnly:    z.boolean().default(true),
	notes:                z.string().optional()
});

export const entryRequestSchema = z.object({
	seasonId:   z.string().min(1, 'Season is required'),
	entryType:  entryTypeSchema,
	entryName:  z.string().min(2, 'Entry name must be at least 2 characters').max(50),
	referredBy: z.string().max(50).optional()
});

export const adminCreateEntriesSchema = z.object({
	seasonId:   z.string().min(1, 'Season is required'),
	userId:     z.string().min(1, 'Player is required'),
	entryType:  entryTypeSchema,
	count:      z.coerce.number().int().min(1).max(20).default(1),
	baseName:   z.string().min(2, 'Entry name must be at least 2 characters').max(50),
	referredBy: z.string().max(50).optional()
});

export const paymentSchema = z.object({
	entryId:       z.string().min(1),
	paymentMethod: z.enum(['check', 'venmo', 'paypal', 'zelle', 'cash'])
});

export type SeasonSchema             = z.infer<typeof seasonSchema>;
export type EntryRequestSchema       = z.infer<typeof entryRequestSchema>;
export type AdminCreateEntriesSchema = z.infer<typeof adminCreateEntriesSchema>;
export type PaymentSchema            = z.infer<typeof paymentSchema>;
