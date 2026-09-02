// dsh-0-tools — host half (Cordis plugin entry, runs in Node).
//
// v1.8.3: RE-ENABLE HOST HALF FOR HEALTH-CHECK PROXY ONLY.
//
// The browser half (client.js) runs inside the DSH web UI at
// http://127.0.0.1:3080/.  When it tries to fetch() third-party LLM
// APIs (zhipu / openrouter / qianfan / xinghuo) directly for health
// pings, the browser's CORS policy blocks the request because the API
// origins are different from 127.0.0.1:3080.  Result: every ping
// fails, every model shows "不可用" even though actual chat (which goes
// through DSH's Node backend) works fine.
//
// Fix: this host half starts a tiny loopback HTTP proxy on
// 127.0.0.1:PORT (default 3095, auto-increments if occupied) that
// accepts POST /ping with {baseURL, apiKey, modelId} and performs the
// fetch from Node (no CORS), returning latency ms or null.  The browser
// half pings this local proxy instead of the third-party API directly.
//
// All config I/O (settings / credentials) STILL goes through the
// official DSH /api RPC channel in the browser half — this proxy is
// read-only health-check only, never writes config.

import http from "node:http";

const PING_TIMEOUT_MS = 15000;
const DEFAULT_PORT = 3095;
const MAX_PORT_TRIES = 20;

function startHealthProxy(logger) {
	let port = DEFAULT_PORT;
	let server = null;

	function tryListen(p) {
		return new Promise((resolve, reject) => {
			const s = http.createServer((req, res) => {
				// CORS: allow only 127.0.0.1 / localhost origins
				const origin = req.headers.origin || "";
				const allowed = origin.startsWith("http://127.0.0.1:") ||
					origin.startsWith("http://localhost:");
				if (allowed) {
					res.setHeader("Access-Control-Allow-Origin", origin);
					res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
					res.setHeader("Access-Control-Allow-Headers", "Content-Type");
				}
				if (req.method === "OPTIONS") {
					res.writeHead(204);
					res.end();
					return;
				}
				if (req.method !== "POST" || req.url !== "/ping") {
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "not found" }));
					return;
				}
				let body = "";
				req.on("data", (chunk) => { body += chunk; });
				req.on("end", async () => {
					try {
						const { baseURL, apiKey, modelId } = JSON.parse(body);
						if (!baseURL || !apiKey || !modelId) {
							res.writeHead(400, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ error: "missing params" }));
							return;
						}
						const start = Date.now();
						const controller = new AbortController();
						const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
						try {
							const r = await fetch(baseURL.replace(/\/+$/, "") + "/chat/completions", {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									"Authorization": "Bearer " + apiKey,
								},
								body: JSON.stringify({
									model: modelId,
									messages: [{ role: "user", content: "hi" }],
									max_tokens: 1,
									stream: false,
								}),
								signal: controller.signal,
							});
							clearTimeout(timer);
							const latency = Date.now() - start;
							if (r.ok) {
								res.writeHead(200, { "Content-Type": "application/json" });
								res.end(JSON.stringify({ ok: true, latency }));
							} else {
								const text = await r.text().catch(() => "");
								res.writeHead(200, { "Content-Type": "application/json" });
								res.end(JSON.stringify({ ok: false, latency, status: r.status, body: text.slice(0, 200) }));
							}
						} catch (e) {
							clearTimeout(timer);
							res.writeHead(200, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ ok: false, latency: null, error: String(e && e.message || e) }));
						}
					} catch (e) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "invalid json" }));
					}
				});
			});
			s.on("error", (err) => {
				if (err.code === "EADDRINUSE") {
					s.close();
					resolve(null);
				} else {
					reject(err);
				}
			});
			s.listen(p, "127.0.0.1", () => {
				server = s;
				resolve(p);
			});
		});
	}

	return (async () => {
		for (let i = 0; i < MAX_PORT_TRIES; i++) {
			const p = await tryListen(port + i);
			if (p) {
				if (logger && logger.info) {
					logger.info(`dsh-0-tools: health-check proxy listening on http://127.0.0.1:${p}/ping`);
				}
				return { port: p, server };
			}
		}
		if (logger && logger.warn) {
			logger.warn("dsh-0-tools: could not start health-check proxy (all ports in use)");
		}
		return null;
	})();
}

export async function apply(ctx) {
	// Start the loopback health-check proxy (read-only, no config writes).
	const proxy = await startHealthProxy(ctx.logger);
	if (proxy) {
		// Store port on context so browser half could discover it if needed,
		// but browser half uses a fixed port list with fallback.
		ctx.dsh0toolsHealthProxyPort = proxy.port;
	}

	if (ctx.logger && ctx.logger.info) {
		ctx.logger.info("dsh-0-tools: host half loaded (v1.8.3 health-check proxy); all config I/O still goes through official DSH /api channel in browser half");
	}
}
