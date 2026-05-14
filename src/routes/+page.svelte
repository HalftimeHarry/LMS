<script lang="ts">
	import { pb } from '$lib';

	let status = $state<'checking' | 'connected' | 'error'>('checking');
	let errorMsg = $state('');

	async function checkConnection() {
		try {
			await pb.health.check();
			status = 'connected';
		} catch (e) {
			status = 'error';
			errorMsg = e instanceof Error ? e.message : String(e);
		}
	}

	checkConnection();
</script>

<main>
	<h1>LMS</h1>

	<section>
		<h2>PocketBase</h2>
		{#if status === 'checking'}
			<p>Connecting to <code>{pb.baseURL}</code>…</p>
		{:else if status === 'connected'}
			<p>✅ Connected to <code>{pb.baseURL}</code></p>
		{:else}
			<p>❌ Connection failed: {errorMsg}</p>
		{/if}
	</section>
</main>
