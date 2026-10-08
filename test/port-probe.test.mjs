// 端口探测端到端实测（对齐 lib/index.js 与 lib/client.js 的真实语义）
//
// 真实失效场景复盘：
//   host 端从 3095 起找空闲端口，最多试 20 个；旧版浏览器只探 3095-3099。
//   当 3095-3099 被**非本插件的本地服务**占住（其他软件 / 残留端口 / 端口转发），
//   本实例的真实代理就落到 3100+ —— 旧浏览器探不到 → 报no_proxy → 测速静默失效。
//   （若那5 个端口上恰好是别的 DSH 实例的代理，旧代码能连上，功能不受影响；
//     真正打不中的是「占位者不是健康代理」这一类。）
import http from "node:http";

// ---- 与 lib/index.js 一致 ----
const DEFAULT_PORT = 3095;
const MAX_PORT_TRIES = 20;

// ---- 与 lib/client.js 一致（v1.11.0 修改后）----
const HEALTH_PROXY_PORT_START = 3095;
const HEALTH_PROXY_PORT_COUNT = 20;
const HEALTH_PROXY_PORTS = Array.from(
	{ length: HEALTH_PROXY_PORT_COUNT },
	(_, i) => HEALTH_PROXY_PORT_START + i
);

function listen(p, handler) {
	return new Promise((resolve, reject) => {
		const s = http.createServer(handler);
		s.on("error", reject);
		s.listen(p, "127.0.0.1", () => resolve(s));
	});
}
// 真实 health proxy：对 OPTIONS 回 204（与 lib/index.js 完全相同）
const proxyHandler = (req, res) => {
	if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
	res.writeHead(404, { "Content-Type": "application/json" });
	res.end(JSON.stringify({ error: "not found" }));
};
// 占位者（别的本地服务）：对 OPTIONS 回 200/405，绝不是 204
const decoyHandler = (req, res) => { res.writeHead(200); res.end("ok"); };

// ---- 被测探测函数（与 lib/client.js 一致）----
function probeHealthProxy() {
	return Promise.any(HEALTH_PROXY_PORTS.map(async (p) => {
		const r = await fetch("http://127.0.0.1:" + p + "/ping", {
			method: "OPTIONS",
			signal: AbortSignal.timeout(1000)
		});
		if (r.status !== 204) throw new Error("not health proxy: " + p);
		return p;
	})).then((p) => p).catch(() => null);
}
// 旧版探测（仅探 5 个端口，顺序），用于对照证明旧代码真的会失手
function probeHealthProxyOld() {
	const OLD = [3095, 3096, 3097, 3098, 3099];
	return (async () => {
		for (const p of OLD) {
			try {
				const r = await fetch("http://127.0.0.1:" + p + "/ping", {
					method: "OPTIONS", signal: AbortSignal.timeout(1000)
				});
				if (r.ok || r.status === 204) return p;
			} catch { /* next */ }
		}
		return null;
	})();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, expected, got, extra = "") {
	const ok = got === expected;
	results.push({ name, ok });
	console.log(`${ok ? "PASS" : "FAIL"} | ${name} | 期望=${expected} 实得=${got}${extra}`);
}

// 场景构造：前 blockLow 个端口放占位者，其后放 count 个真实代理
async function run(name, { blockLow, count }) {
	const servers = [];
	for (let i = 0; i < blockLow; i++) {
		servers.push(await listen(DEFAULT_PORT + i, decoyHandler));
	}
	let realAt = null;
	for (let i = 0; i < count; i++) {
		const p = DEFAULT_PORT + blockLow + i;
		servers.push(await listen(p, proxyHandler));
		if (realAt === null) realAt = p;
	}
	try {
		const t0 = Date.now();
		const got = await probeHealthProxy();
		const ms = Date.now() - t0;
		check(name, realAt, got, ` 耗时=${ms}ms`);
	} finally {
		for (const s of servers) s.close();
		await sleep(120);
	}
}

console.log("端口范围对齐检查:");
console.log("  host 端扫描 :", DEFAULT_PORT, "..", DEFAULT_PORT + MAX_PORT_TRIES - 1);
console.log("  client 端探测:", HEALTH_PROXY_PORTS[0], "..", HEALTH_PROXY_PORTS[HEALTH_PROXY_PORTS.length - 1]);
console.log("  对齐:", (DEFAULT_PORT === HEALTH_PROXY_PORTS[0]
	&& MAX_PORT_TRIES === HEALTH_PROXY_PORTS.length) ? "YES" : "NO");
console.log("");

// 正常场景：3095 空着 → 直接命中
await run("正常：3095 空闲", { blockLow: 0, count: 1 });
// 旧代码刚好还够用的边界：占位 4个，真实代理在 3099
await run("占位 4 个 → 真实代理 3099（旧代码上限内）", { blockLow: 4, count: 1 });
// 旧代码开始失手的边界：占位 5 个 → 真实代理 3100
await run("占位 5 个 → 真实代理 3100（旧代码必失）", { blockLow: 5, count: 1 });
await run("占位 12 个 → 真实代理 3107", { blockLow: 12, count: 1 });
await run("占位 19 个 → 真实代理 3114（范围上界）", { blockLow: 19, count: 1 });

// 对照：同一场景下旧代码不仅探不到，还会误连到占位者
//   旧判定 `r.ok || r.status === 204` —— r.ok 对 HTTP 200 也为 true，
//   所以任何回 200 的无关本地服务都会被当成"健康代理"，随后浏览器会把
//   baseURL / modelId / apiKeyEnv 发给这个不相干的服务。
{
	const servers = [];
	for (let i = 0; i < 5; i++) servers.push(await listen(DEFAULT_PORT + i, decoyHandler));
	servers.push(await listen(DEFAULT_PORT + 5, proxyHandler));
	try {
		const oldGot = await probeHealthProxyOld();
		// 旧代码误连到 3095（占位者），真实代理在 3100 它找不到 —— 双重失效
		check("对照·旧代码在占位 5 个时（会误连到 3095，且找不到真代理 3100）",
			DEFAULT_PORT, oldGot, "  ← 探错目标 = 凭据外泄风险 + 测速失效");
	} finally { for (const s of servers) s.close(); await sleep(120); }
}

// 误连测试：全是占位者，没有任何真实代理 → 必须返回 null，绝不误连
{
	const servers = [];
	for (let i = 0; i < 6; i++) servers.push(await listen(DEFAULT_PORT + i, decoyHandler));
	try {
		const got = await probeHealthProxy();
		check("全是占位者(回200) → 应返回 null 而非误连", null, got);
	} finally { for (const s of servers) s.close(); await sleep(120); }
}

console.log("");
const failed = results.filter((r) => !r.ok);
console.log(`总计 ${results.length} 个场景，通过 ${results.length - failed.length}，失败 ${failed.length}`);
process.exit(failed.length ? 1 : 0);