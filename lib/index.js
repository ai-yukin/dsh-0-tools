// dsh-0-tools — host half (Cordis plugin entry, runs in Node).
//
// Responsibilities (HOST side only — this file is `main` in package.json and
// is loaded by dsh as a host Cordis plugin bundle):
//  - Open a loopback-only HTTP endpoint that the browser half (./client) calls
//    to persist the free-model configuration into DeepSeek Harness's own config
//    files (~/.dsh/.credentials.yaml + ~/.dsh/settings.yaml), so a beginner
//    never touches YAML or environment variables.
//  - Report configuration status (`GET /status`): whether the managed zai
//    provider is present in settings.yaml. The browser half uses this as the
//    single authoritative source for showing/hiding the onboarding entry —
//    DOM sniffing of the model picker was proven unreliable and is dropped.
//  - Uninstall (`POST /uninstall`): remove the managed provider + its
//    credential and switch the default model back to DeepSeek official, so the
//    zero-cost experiment can be fully rolled back in one click.
//  - The endpoint is bound on 127.0.0.1:3090..3099 (first free port wins).

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PLUGIN_PORTS = [3090, 3091, 3092, 3093, 3094, 3095, 3096, 3097, 3098, 3099];

function dshHome() {
	return path.join(os.homedir(), ".dsh");
}
function settingsFile() {
	return path.join(dshHome(), "settings.yaml");
}
function credentialsFile() {
	return path.join(dshHome(), ".credentials.yaml");
}

/** Best-effort timestamped backup before any write. */
function backupIfExists(p) {
	try {
		if (fs.existsSync(p)) {
			const ts = new Date().toISOString().replace(/[:.]/g, "-");
			fs.copyFileSync(p, p + ".bak." + ts);
		}
	} catch (e) {
		/* best-effort backup */
	}
}

/**
 * Write / replace a credential under `refs:` in .credentials.yaml (default
 * ZAI_API_KEY). DSH's own credential parser only accepts keys indented under
 * `refs:` — appending at top level corrupts the v1 layout (unknown top-level
 * key) and the whole document is rejected. This version always targets the
 * `refs:` block, scaffolding `version: 1` + `refs:` when the file is missing
 * or has no refs section.
 */
function writeCredential(key, envName = "ZAI_API_KEY") {
	const p = credentialsFile();
	backupIfExists(p);
	const raw = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
	const lines = raw.replace(/\r\n/g, "\n").split("\n");

	// 1) locate the top-level `refs:` line.
	let refsIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		if (/^refs:[ \t]*$/.test(lines[i])) {
			refsIdx = i;
			break;
		}
	}

	// 2) no refs section: scaffold it (preserve existing content, ensure version: 1).
	if (refsIdx < 0) {
		let out = raw.replace(/\s+$/, "");
		if (out && !out.endsWith("\n")) out += "\n";
		if (!/^version:[ \t]*/m.test(raw)) {
			out += (out ? "\n" : "") + "version: 1\n";
		}
		out += "refs:\n  " + envName + ": " + key + "\n";
		fs.writeFileSync(p, out);
		return;
	}

	// 3) within the refs block, replace an existing entry for envName.
	let replaced = false;
	for (let i = refsIdx + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "") continue;
		if (/^[ \t]/.test(line)) {
			if (new RegExp("^[ \\t]{1,}" + envName + "\\s*:").test(line)) {
				lines[i] = "  " + envName + ": " + key;
				replaced = true;
				break;
			}
			continue;
		}
		break; // back to a top-level line → end of refs block
	}

	// 4) not found: append as a new 2-space-indented child at the end of refs.
	if (!replaced) {
		let insertAt = refsIdx + 1;
		while (insertAt < lines.length) {
			const line = lines[insertAt];
			if (line.trim() === "" || /^[ \t]/.test(line)) {
				insertAt++;
			} else {
				break;
			}
		}
		lines.splice(insertAt, 0, "  " + envName + ": " + key);
	}
	fs.writeFileSync(p, lines.join("\n"));
}

/** Remove the credential line for envName from `refs:` (uninstall). */
function removeCredential(envName = "ZAI_API_KEY") {
	const p = credentialsFile();
	if (!fs.existsSync(p)) return;
	backupIfExists(p);
	const lines = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").split("\n");
	const next = lines.filter((l) => !new RegExp("^[ \\t]{1,}" + envName + "\\s*:").test(l));
	fs.writeFileSync(p, next.join("\n"));
}

/* ============ Provider catalog the plugin owns ============
 * One provider (zai / 智谱), registered through dsh-llm-pi-ai so it can
 * declare image input for GLM-4V-Flash. DeepSeek is intentionally NOT managed
 * here — dsh ships its own built-in DeepSeek adapter (route deepseek-official).
 */

const MANAGED_PROVIDERS = [
	{
		key: "zai",
		apiKeyEnv: "ZAI_API_KEY",
		extraLines: "",
		models: [
			{ id: "glm-4.7-flash", name: "智谱 GLM-4.7-Flash（文本）", input: ["text"] },
			{ id: "glm-4v-flash", name: "智谱 GLM-4V-Flash（图片理解）", input: ["text", "image"] }
		]
	}
];

/* DeepSeek official route + a safe flash model to fall back to after uninstall. */
const DEEPSEEK_FALLBACK = { provider: "deepseek-official", model: "deepseek-v4-flash" };

/**
 * Render one provider block at 4-space indent (a sibling key under
 * `llm-pi-ai.providers`). Uses BLOCK-SEQUENCE YAML for `input:` — schemastery
 * parses inline `[text, image]` as a *string*, which silently drops the
 * "image" modality. Block style (`- text\n- image`) is unambiguous.
 */
function renderProviderBlock(p) {
	const topExtras = [];
	if (p.displayName) topExtras.push(`      displayName: ${p.displayName}`);
	if (p.api) topExtras.push(`      api: ${p.api}`);
	if (p.baseURL) topExtras.push(`      baseURL: ${p.baseURL}`);
	const modelLines = p.models.map((m) => {
		const inputItems = m.input.map((x) => `            - ${x}`).join("\n");
		const modelExtras = [];
		if (m.contextWindow) modelExtras.push(`          contextWindow: ${m.contextWindow}`);
		if (m.maxTokens) modelExtras.push(`          maxTokens: ${m.maxTokens}`);
		const modelExtraStr = modelExtras.length ? "\n" + modelExtras.join("\n") : "";
		return `        - id: ${m.id}\n          name: ${m.name}${modelExtraStr}\n          input:\n${inputItems}`;
	}).join("\n");
	const extra = p.extraLines ? p.extraLines : "";
	const topExtraStr = topExtras.length ? "\n" + topExtras.join("\n") : "";
	return `    ${p.key}:\n      apiKeyEnv: ${p.apiKeyEnv}${topExtraStr}\n${extra}      models:\n${modelLines}\n`;
}

/** Render the `agent-default-model:` section pointing at a provider/model. */
function renderAgentDefaultBlock(sel) {
	return `\nagent-default-model:\n  provider: ${sel.provider}\n  model: ${sel.model}\n`;
}

/** Remove a top-level YAML section (header + indented body). */
function removeSection(text, header) {
	const re = new RegExp("^[ \\t]*" + header + ":[ \\t]*\\n(?:[ \\t].*\\n|\\n)*", "m");
	return text.replace(re, "");
}

/** Rewrite the agent-default-model section to the given selection. */
function writeAgentDefault(sel) {
	const p = settingsFile();
	backupIfExists(p);
	let text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
	text = removeSection(text, "agent-default-model");
	text = text.replace(/\s*$/, "") + renderAgentDefaultBlock(sel);
	fs.writeFileSync(p, text);
}

/* Registry of provider types this plugin can install/uninstall. The remote
 * freeModels card may only reference keys in here — new provider *types*
 * (with their own credential env + wire protocol) need a release to register,
 * while new models on an existing type can be pushed purely via remote
 * help.json. */
const REGISTRY = {
	zai: { key: "zai", apiKeyEnv: "ZAI_API_KEY" }
};

/** Whether `llm-pi-ai.providers.<key>` is present in settings.yaml. */
function hasProvider(key) {
	try {
		const p = settingsFile();
		if (!fs.existsSync(p)) return false;
		const text = fs.readFileSync(p, "utf8");
		// locate llm-pi-ai: top-level section, then look for a providers: > key: indented chain
		const m = text.match(/^llm-pi-ai:[ \t]*\r?\n(?:[ \t].*\r?\n|\r?\n)*/m);
		if (!m) return false;
		const body = m[0];
		return /^[ \t]+providers:[ \t]*\r?\n/m.test(body) && new RegExp("^[ \\t]{2,}" + key + ":[ \\t]*\\r?\\n", "m").test(body);
	} catch (e) {
		return false;
	}
}

/** Whether a credential env name is present under refs: in .credentials.yaml. */
function hasCredential(envName) {
	try {
		const p = credentialsFile();
		if (!fs.existsSync(p)) return false;
		const text = fs.readFileSync(p, "utf8");
		return new RegExp("^[ \\t]{1,}" + envName + "\\s*:", "m").test(text);
	} catch (e) {
		return false;
	}
}

/** List every provider key present under `llm-pi-ai.providers` (dynamic scan,
 * so providers that were configured before this plugin registered them — or
 * added by a future release — still show a status). */
function listProviders() {
	try {
		const p = settingsFile();
		if (!fs.existsSync(p)) return [];
		const text = fs.readFileSync(p, "utf8");
		const m = text.match(/^llm-pi-ai:[ \t]*\r?\n(?:[ \t].*\r?\n|\r?\n)*/m);
		if (!m) return [];
		const out = [];
		const re = /^[ \t]{4}([A-Za-z0-9_.-]+):[ \t]*\r?\n/gm;
		let mm;
		while ((mm = re.exec(m[0]))) out.push(mm[1]);
		return out;
	} catch (e) {
		return [];
	}
}

/** Read the `apiKeyEnv:` line from a provider block (needed to resolve the
 * credential key for status checks of dynamically-discovered providers). */
function getProviderApiKeyEnv(key) {
	try {
		const p = settingsFile();
		if (!fs.existsSync(p)) return null;
		const text = fs.readFileSync(p, "utf8");
		const re = new RegExp("^[ \\t]{4}" + key + ":[ \\t]*\\r?\\n(?:[ \\t]{5,}[^\\r\\n]*\\r?\\n|\\r?\\n)*", "m");
		const block = text.match(re);
		if (!block) return null;
		const env = block[0].match(/^[ \t]{6}apiKeyEnv:[ \t]*([^\s#]+)/m);
		return env ? env[1] : null;
	} catch (e) {
		return null;
	}
}

/** Regex matching exactly ONE provider block: the `    key:` line plus its
 * body (≥5-space indented lines or blank lines). Sibling providers at exactly
 * 4-space indent are NOT consumed — this is what keeps sibling providers from
 * clobbering each other. */
function providerBlockRe(providerKey) {
	return new RegExp("^    " + providerKey + ":[ \\t]*\\r?\\n(?:(?:[ \\t]{5,}[^\\r\\n]*\\r?\\n)|(?:\\r?\\n))*", "m");
}

/**
 * Remove ONE provider block under `llm-pi-ai.providers`, keeping every sibling
 * provider intact. Opposite of upsertProviderBlock.
 */
function removeProviderBlock(providerKey) {
	const p = settingsFile();
	if (!fs.existsSync(p)) return;
	backupIfExists(p);
	let text = fs.readFileSync(p, "utf8");
	text = text.replace(providerBlockRe(providerKey), "");
	fs.writeFileSync(p, text);
}

/**
 * Insert or replace ONE provider block under `llm-pi-ai.providers`, keeping
 * every sibling provider intact (zai stays). Safely scaffolds the
 * `llm-pi-ai: > providers:` chain when missing.
 */
function upsertProviderBlock(providerKey, blockText) {
	const p = settingsFile();
	backupIfExists(p);
	let text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
	// 1) drop any previous block for this provider key (siblings untouched)
	text = text.replace(providerBlockRe(providerKey), "");
	// 2) build/ensure llm-pi-ai > providers scaffold
	const topRe = /^llm-pi-ai:[ \t]*\r?\n(?:[ \t].*\r?\n|\r?\n)*/m;
	let top = text.match(topRe);
	if (!top) {
		text = text.replace(/\s*$/, "") + "\nllm-pi-ai:\n  providers:\n" + blockText;
		fs.writeFileSync(p, text);
		return;
	}
	let section = top[0];
	if (!/^[ \t]+providers:[ \t]*\r?\n/m.test(section)) {
		section = section.replace(/^llm-pi-ai:[ \t]*\r?\n/m, "llm-pi-ai:\n  providers:\n");
		text = text.replace(topRe, section);
		top = text.match(topRe);
		section = top[0];
	}
	// 3) insert blockText right after the providers: line within the section
	const providersRe = /^[ \t]+providers:[ \t]*\r?\n/m;
	const inserted = section.replace(providersRe, (m) => m + blockText);
	text = text.replace(topRe, inserted);
	fs.writeFileSync(p, text);
}

/** Cordis plugin entry — mounts the loopback config endpoint. */
export function apply(ctx) {
	let server = null;
	let boundPort = null;

	const handler = (req, res) => {
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");

		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		if (req.method === "GET" && req.url === "/status") {
			const status = {};
			const keys = new Set([...Object.keys(REGISTRY), ...listProviders()]);
			for (const key of keys) {
				const env = REGISTRY[key] ? REGISTRY[key].apiKeyEnv : getProviderApiKeyEnv(key);
				status[key] = !!(env && hasProvider(key) && hasCredential(env));
			}
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true, port: boundPort, configured: !!status.zai, ...status }));
			return;
		}

		if (req.method === "POST" && req.url === "/configure") {
			let body = "";
			req.on("data", (c) => {
				body += c;
				if (body.length > 1e6) req.destroy();
			});
			req.on("end", () => {
				try {
					const parsed = JSON.parse(body);
					const key = parsed && parsed.key;
					if (!key || typeof key !== "string" || !key.trim()) {
						throw new Error("缺少有效的智谱 API Key");
					}
					// model list may be carried by the remote card; fall back to the built-in spec.
					const base = MANAGED_PROVIDERS[0];
					const models = Array.isArray(parsed.models) && parsed.models.length ? parsed.models : base.models;
					writeCredential(key.trim(), base.apiKeyEnv);
					upsertProviderBlock(base.key, renderProviderBlock({ ...base, models }));
					writeAgentDefault({ provider: base.key, model: models[0].id });
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true, configured: true }));
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
				}
			});
			return;
		}

		if (req.method === "POST" && req.url === "/uninstall") {
			let body = "";
			req.on("data", (c) => {
				body += c;
				if (body.length > 1e6) req.destroy();
			});
			req.on("end", () => {
				try {
					const parsed = JSON.parse(body || "{}");
					const provider = (parsed && parsed.provider) || "zai";
					const reg = REGISTRY[provider];
					if (!reg) throw new Error("未知的 provider: " + provider);
					removeCredential(reg.apiKeyEnv);
					removeProviderBlock(provider);
					// Default-model protection: only switch back to DeepSeek when the
					// current default points at the provider being uninstalled,
					// otherwise leave the user's current selection untouched.
					const p = settingsFile();
					if (fs.existsSync(p)) {
						let text = fs.readFileSync(p, "utf8");
						const dm = text.match(/^agent-default-model:[ \t]*\r?\n(?:[ \t].*\r?\n|\r?\n)*/m);
						const pointsAt = dm && new RegExp("^[ \\t]+provider:[ \\t]*" + provider + "\\s*$", "m").test(dm[0]);
						if (pointsAt) {
							backupIfExists(p);
							text = removeSection(text, "agent-default-model");
							text = text.replace(/\s*$/, "") + renderAgentDefaultBlock(DEEPSEEK_FALLBACK);
							fs.writeFileSync(p, text);
						}
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: true, provider }));
				} catch (e) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
				}
			});
			return;
		}

		if (req.method === "GET" && req.url === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true, port: boundPort }));
			return;
		}
		res.writeHead(404);
		res.end();
	};

	const tryBind = (idx) => {
		if (idx >= PLUGIN_PORTS.length) {
			if (ctx.logger && ctx.logger.warn) {
				ctx.logger.warn("dsh-0-tools: 无法绑定本地配置端口 3090-3099");
			}
			return;
		}
		const port = PLUGIN_PORTS[idx];
		server = http.createServer(handler);
		server.on("error", (err) => {
			if (err && err.code === "EADDRINUSE") {
				tryBind(idx + 1);
				return;
			}
			if (ctx.logger && ctx.logger.error) ctx.logger.error(err);
		});
		server.listen(port, "127.0.0.1", () => {
			boundPort = port;
			if (ctx.logger && ctx.logger.info) {
				ctx.logger.info("dsh-0-tools: 本地配置服务已启动于 127.0.0.1:" + port);
			}
		});
	};
	tryBind(0);

	ctx.effect(() => () => {
		if (server) {
			try {
				server.close();
			} catch (e) {
				/* ignore */
			}
		}
	});
}
