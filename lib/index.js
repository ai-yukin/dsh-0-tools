// dsh-0-tools — host half (Cordis plugin entry, runs in Node).
//
// v1.5.0: THE HOST HALF IS NOW A DELIBERATE NO-OP.
//
// History: through v1.4.x this file ran a loopback HTTP server on
// 127.0.0.1:3090-3099 (GET /status, POST /configure, POST /uninstall) and
// hand-edited ~/.dsh/settings.yaml + ~/.dsh/.credentials.yaml with regex
// surgery. That design had three proven defects:
//
//   1. Security: the server had no origin check and answered CORS `*`,
//      so ANY web page the user visited could rewrite their config or
//      replace credentials (demonstrated live during the v1.5.0 phase-0
//      audit: a forged cross-origin POST was accepted and written).
//   2. Concurrency: raw fs.writeFileSync with no lock raced against
//      DSH's own atomic settings writes, and each write left a
//      timestamped .bak (60+ accumulated on real machines).
//   3. Data loss: wholesale section rewrites silently dropped keys the
//      plugin did not know about (e.g. agent-default-model's
//      reasoningEffort).
//
// All of those responsibilities moved to the browser half (./client.js),
// which now talks to DSH's official same-origin /api RPC channel
// (settings.mutate / settings.update / credentials.set / credentials.unset /
// settings.describe / credentials.describe). The official channel has a
// loopback trust fence, atomic locked writes, input validation, revision
// fencing, and merge semantics for agent-default-model.
//
// This file must still exist and export a valid Cordis `apply` because
// the web profile's patch layer (cordis.patch.yml) loads this package as
// a host plugin bundle; the browser half is picked up separately via the
// package's dsh.client declaration.

export function apply(ctx) {
	// Intentionally empty: no host-side responsibilities remain.
	// (Keep a logger trace so operators can confirm the stub loaded.)
	if (ctx.logger && ctx.logger.info) {
		ctx.logger.info("dsh-0-tools: host half is a no-op stub (v1.5.0+); all config I/O goes through the official DSH /api channel");
	}
}
