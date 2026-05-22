/**
 * Server-side EmailJS REST API helper.
 *
 * Uses the private key so calls are authenticated and don't count against
 * the public rate limit. All keys are read from env at call time so the
 * module is safe to import in any server context.
 *
 * Returns silently when EMAILJS_SERVICE_ID or EMAILJS_WELCOME_TEMPLATE_ID
 * are not configured — safe to call in development without real keys.
 */

import { env } from '$env/dynamic/private';

const EMAILJS_API = 'https://api.emailjs.com/api/v1.0/email/send';

interface SendOptions {
	templateId: string;
	params:     Record<string, string>;
}

async function send({ templateId, params }: SendOptions): Promise<void> {
	const serviceId  = env.EMAILJS_SERVICE_ID;
	const publicKey  = env.PUBLIC_EMAILJS_PUBLIC_KEY ?? process.env.PUBLIC_EMAILJS_PUBLIC_KEY;
	const privateKey = env.EMAILJS_PRIVATE_KEY;

	// Skip silently when not configured (dev / CI)
	if (!serviceId || !publicKey || !privateKey) return;

	const res = await fetch(EMAILJS_API, {
		method:  'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			service_id:      serviceId,
			template_id:     templateId,
			user_id:         publicKey,
			accessToken:     privateKey,
			template_params: params,
		}),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		// Log but don't throw — a failed welcome email should not block registration
		console.error(`[emailjs] send failed (${res.status}):`, body);
	}
}

/**
 * Send the welcome email to a newly registered user.
 *
 * Template variables sent:
 *   {{name}}     — user's display name
 *   {{to_email}} — user's email address (EmailJS "To Email" field)
 *   {{app_url}}  — base URL of the app (e.g. https://lmspool.com)
 */
export async function sendWelcomeEmail(opts: {
	displayName: string;
	email:       string;
	appUrl:      string;
}): Promise<void> {
	const templateId = env.EMAILJS_WELCOME_TEMPLATE_ID;
	if (!templateId) return;

	await send({
		templateId,
		params: {
			name:     opts.displayName,
			to_email: opts.email,
			app_url:  opts.appUrl,
		},
	});
}
