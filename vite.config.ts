import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: true
	},
	test: {
		// Run in Node — no browser needed for unit/integration tests
		environment: 'node',
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html'],
			include: ['src/lib/**', 'src/routes/**/*.server.ts']
		},
		alias: [
			// SvelteKit $env shims — must come before the $lib catch-all
			{ find: '$env/static/public',   replacement: '/workspaces/LMS/src/tests/__mocks__/env-static-public.ts' },
			{ find: '$env/dynamic/private', replacement: '/workspaces/LMS/src/tests/__mocks__/env-dynamic-private.ts' },
			// Mock pb-admin so tests never hit a real PocketBase instance
			{ find: '$lib/server/pb-admin', replacement: '/workspaces/LMS/src/tests/__mocks__/pb-admin.ts' },
			// General $lib and $app shims
			{ find: /^\$lib\/server\/(.*)$/, replacement: '/workspaces/LMS/src/lib/server/$1' },
			{ find: /^\$lib(.*)$/,           replacement: '/workspaces/LMS/src/lib$1' },
			{ find: '$app/forms',            replacement: '/workspaces/LMS/src/tests/__mocks__/app-forms.ts' },
			{ find: '$app/navigation',       replacement: '/workspaces/LMS/src/tests/__mocks__/app-navigation.ts' },
			{ find: '$app/stores',           replacement: '/workspaces/LMS/src/tests/__mocks__/app-stores.ts' },
			// SvelteKit redirect/fail are real — no mock needed
			{ find: /^\.\$types$/,           replacement: '/workspaces/LMS/src/tests/__mocks__/types.ts' }
		]
	}
});
