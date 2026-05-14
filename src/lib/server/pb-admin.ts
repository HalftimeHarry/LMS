import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

/**
 * Returns a PocketBase instance authenticated as superuser (PocketBase v0.23+).
 * Use for server-side data fetching where collection rules block the request.
 */
export async function pbAdmin(): Promise<PocketBase> {
	const pb = new PocketBase(PUBLIC_POCKETBASE_URL);
	// Disable auto-cancellation — safe for server-side Promise.all usage
	pb.autoCancellation(false);
	// PocketBase v0.23+ replaced pb.admins with _superusers collection
	await pb.collection('_superusers').authWithPassword(
		env.POCKETBASE_ADMIN_EMAIL,
		env.POCKETBASE_ADMIN_PASSWORD
	);
	return pb;
}
