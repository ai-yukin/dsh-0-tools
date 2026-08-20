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

/** Write / replace the ZAI_API_KEY line in .credentials.yaml. */
function writeCredential(key) {
	const p = credentialsFile();
	backupIfExists(p);
	let text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
	const lines = text.split("\n");
	let replaced = false;
	for (let i = 0; i < lines.length; i++) {
		if (/^\s*ZAI_API_KEY\s*:/.test(lines[i])) {
			lines[i] = "ZAI_API_KEY: " + key;
			replaced = true;
			break;
		}
	}
	if (!replaced) {
		if (text.length && !text.endsWith("\n")) text += "\n";
		lines.push("ZAI_API_KEY: " + key);
	}
	fs.writeFileSync(p, lines.join("\n"));
}

/** Remove the ZAI_API_KEY line from .credentials.yaml (uninstall). */
function removeZaiCredential() {
	const p = credentialsFile();
	if (!fs.existsSync(p)) return;
	backupIfExists(p);
	const lines = fs.readFileSync(p, "utf8").split("\n").filter((l) => !/^\s*ZAI_API_KEY\s*:/.test(l));
	fs.writeFileSync(p, lines.join("\n"));
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
	const modelLines = p.models.map((m) => {
		const inputItems = m.input.map((x) => `            - ${x}`).join("\n");
		return `        - id: ${m.id}\n          name: ${m.name}\n          input:\n${inputItems}`;
	}).join("\n");
	const extra = p.extraLines ? p.extraLines : "";
	return `    ${p.key}:\n      apiKeyEnv: ${p.apiKeyEnv}\n${extra}      models:\n${modelLines}\n`;
}

/** Render the whole `llm-pi-ai:` section (the managed zai provider). */
function renderLlmPiAiBlock() {
	return `\nllm-pi-ai:\n  providers:\n` + MANAGED_PROVIDERS.map(renderProviderBlock).join("");
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

/** Rewrite the llm-pi-ai section with the canonical managed providers. */
function writeProviderConfig() {
	const p = settingsFile();
	backupIfExists(p);
	let text = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
	text = removeSection(text, "llm-pi-ai");
	text = text.replace(/\s*$/, "") + renderLlmPiAiBlock();
	fs.writeFileSync(p, text);
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

/** Whether the managed zai provider is present in settings.yaml. */
function hasZaiProvider() {
	try {
		const p = settingsFile();
		if (!fs.existsSync(p)) return false;
		const text = fs.readFileSync(p, "utf8");
		// locate llm-pi-ai: top-level section, then look for a providers: > zai: indented chain
		const m = text.match(/^llm-pi-ai:[ \t]*\r?\n(?:[ \t].*\r?\n|\r?\n)*/m);
		if (!m) return false;
		const body = m[0];
		return /^[ \t]+providers:[ \t]*\r?\n/m.test(body) && /^[ \t]{2,}zai:[ \t]*\r?\n/m.test(body);
	} catch (e) {
		return false;
	}
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
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true, port: boundPort, configured: hasZaiProvider() }));
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
					writeCredential(key.trim());
					writeProviderConfig();
					writeAgentDefault({ provider: "zai", model: "glm-4.7-flash" });
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
			try {
				removeZaiCredential();
				const p = settingsFile();
				if (fs.existsSync(p)) {
					backupIfExists(p);
					let text = fs.readFileSync(p, "utf8");
					text = removeSection(text, "llm-pi-ai");
					text = removeSection(text, "agent-default-model");
					text = text.replace(/\s*$/, "") + renderAgentDefaultBlock(DEEPSEEK_FALLBACK);
					fs.writeFileSync(p, text);
				}
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: true, configured: false }));
			} catch (e) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
			}
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
