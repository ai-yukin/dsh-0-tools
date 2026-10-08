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
// accepts POST /ping with {baseURL, modelId, apiKeyEnv} and reads the
// actual API key from ~/.dsh/.credentials.yaml (DSH's credential store),
// then performs the fetch from Node (no CORS), returning latency ms or null.
// The browser half never sees the API key plaintext (DSH's credentials.describe
// intentionally omits the value for security), so the proxy resolves it server-side.
//
// All config I/O (settings / credentials) STILL goes through the
// official DSH /api RPC channel in the browser half — this proxy is
// read-only health-check only, never writes config.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PING_TIMEOUT_MS = 15000;
// The browser half discovers the port by probing the same range this side
// scans. Keep the two in sync: lib/client.js builds HEALTH_PROXY_PORTS from
// HEALTH_PROXY_PORT_START (3095) + HEALTH_PROXY_PORT_COUNT (20).
// v1.11.0: they now match, so opening a 6th concurrent DSH instance no longer
// leaves health checks silently dead (browser used to probe only 5 ports).
const DEFAULT_PORT = 3095;
const MAX_PORT_TRIES = 20;

// v1.10.0: 把 provider 的 HTTP 失败翻译成语义化错误类型。
// 实测依据（2026-10-05，四个 provider 真实探测）：
//   siliconflow     → 402 {"code":30001,"message":"your account balance is insufficient"}
//   openrouter-free → 402 {"error":{"message":"Insufficient credits..."}}
//   xinghuo         → 200 / zai → 200
// 402 是免费模型「额度耗尽」的主信号，旧实现只认 429/401/5xx，
// 402 会掉进 unknown，于是 UI 无法区分「真可用」与「额度已用尽」。
function classifyPingError(status, bodyText) {
	const body = String(bodyText || "").toLowerCase();

	// 额度 / 余额 / 计费耗尽 —— 优先级最高：这类失败最容易被误判成"可用"
	const quotaHints = [
		"insufficient", "insufficient_quota", "insufficient credits",
		"balance is insufficient", "account balance", "quota", "exceeded your current quota",
		"billing", "arrears", "余额不足", "额度不足", "额度已用尽", "欠费"
	];
	if (status === 402 || quotaHints.some((h) => body.includes(h))) return "quota_exhausted";

	// 认证失败
	if (status === 401 || status === 403) return "auth_failed";

	// 限流 / 请求过多
	if (status === 429) return "rate_limited";

	// 模型不存在或无权限（区别于认证失败：Key 有效，但这个模型用不了）
	if (status === 404) return "model_unavailable";

	// 上游服务错误（含反向代理返回的 5xx）
	if (status >= 500) return "server_error";

	// 请求超时
	if (body.includes("timeout") || body.includes("timed out")) return "timeout";

	return "unknown";
}

// Minimal YAML parser for ~/.dsh/.credentials.yaml (format is simple:
//   version: 1
//   refs:
//     KEY_NAME: key_value
// We only need the refs map.)
function readCredentials() {
	const credPath = path.join(os.homedir(), ".dsh", ".credentials.yaml");
	try {
		const text = fs.readFileSync(credPath, "utf-8");
		const refs = {};
		let inRefs = false;
		for (const line of text.split(/\r?\n/)) {
			if (/^refs:\s*$/.test(line)) { inRefs = true; continue; }
			if (inRefs) {
				const m = line.match(/^\s{2}([A-Z0-9_]+):\s*(.+?)\s*$/);
				if (m) refs[m[1]] = m[2];
				else if (line && !line.startsWith(" ") && !line.startsWith("#")) inRefs = false;
			}
		}
		return refs;
	} catch (e) {
		return {};
	}
}

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
						const { baseURL, modelId, apiKeyEnv } = JSON.parse(body);
						if (!baseURL || !modelId || !apiKeyEnv) {
							res.writeHead(400, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ error: "missing params" }));
							return;
						}
						// Read API key from DSH credential store (server-side, never exposed to browser)
						const creds = readCredentials();
						const apiKey = creds[apiKeyEnv];
						if (!apiKey) {
							res.writeHead(200, { "Content-Type": "application/json" });
							res.end(JSON.stringify({ ok: false, latency: null, error: "api key not found in credentials: " + apiKeyEnv }));
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
								// v1.10.0: 先做服务端分类，浏览器端不必再猜。
								// 关键修正：402（余额/额度不足）在旧实现里会落入 unknown，
								// 导致「测速显示正常但实际对话报额度用尽」。免费模型的主要
								// 失效原因正是余额耗尽，必须单独可辨。
								res.writeHead(200, { "Content-Type": "application/json" });
								res.end(JSON.stringify({
									ok: false,
									latency,
									status: r.status,
									errorType: classifyPingError(r.status, text),
									body: text.slice(0, 200)
								}));
							}
} catch (e) {
						clearTimeout(timer);
						const msg = String((e && e.message) || e);
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({
							ok: false,
							latency: null,
							errorType: classifyPingError(0, msg),
							error: msg.slice(0, 200)
						}));
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
	// The browser half finds it by probing DEFAULT_PORT..DEFAULT_PORT+MAX_PORT_TRIES-1,
	// so no port hand-off through ctx is needed.
	await startHealthProxy(ctx.logger);

	if (ctx.logger && ctx.logger.info) {
		ctx.logger.info("dsh-0-tools: host half loaded (v1.8.3 health-check proxy; API key read server-side from ~/.dsh/.credentials.yaml)");
	}
}
