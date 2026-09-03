// dsh-0-tools — browser half (injected into the DSH web client).
//
// Responsibilities (CLIENT side only — this file is referenced by the
// cordis.patch.yml `client` list and loaded by dsh-client-runtime):
//  - Left footer toolbar (sidebar.footer.action), from left to right:
//      * blue onboarding button  — ONLY when the managed zai provider is NOT
//        configured (authoritative check against DSH official /api
//        settings.describe + credentials.describe; the old DOM sniffing
//        approach is gone)
//      * pricing badge           — ONLY while a DeepSeek model is selected
//      * "?" help center button  — always on
//  - Settings tab "零号工具" (settings.section slot):
//      ① 零门槛小白帮助中心 ② 零费用API配置中心 ③ 零失控费用管控中心
//  - Help center loads remote JSON (ai-yukin.github.io/dsh-0-tools/help.json)
//    with a built-in fallback, so copy can be updated without releasing a new
//    plugin version.
//  - v1.5.0: all config reads/writes go through DSH's official same-origin
//    /api RPC channel (settings.* / credentials.*) — the self-hosted
//    127.0.0.1:3090-3099 service is retired (it had no origin check and was
//    proven exploitable by any web page; the official channel has a loopback
//    trust fence, atomic writes, input validation and revision fencing).
//  - All plugin UI is tagged with data-dsh-0-tools-ui so it can be found and
//    excluded from any generic DOM scans.

window.__ModuleLoader__.load({
	id: "dsh-0-tools",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let _react = require("react");

		// 内置智谱双免费模型规格（与旧 host 半 MANAGED_PROVIDERS 对齐）。
		// 远程 help.json 卡片可整体覆盖 models（新增模型零发版）；新增 provider
		// *类型* 需在远程卡片携带 credentialRef 字段（见 FreeInstallForm）。
		const BUILTIN_PROVIDER_SPECS = {
			zai: {
				apiKeyEnv: "ZAI_API_KEY",
				displayName: "智谱",
				api: "openai-completions",
				baseURL: "https://open.bigmodel.cn/api/paas/v4",
				models: [
					{ id: "glm-4.7-flash", name: "智谱 GLM-4.7-Flash（文本）", input: ["text"] },
					{ id: "glm-4v-flash", name: "智谱 GLM-4V-Flash（图片理解）", input: ["text", "image"] }
				]
			},
			// v1.6.0：OpenRouter 免费模型池（离线兜底；远程卡片同值可热更覆盖）。
			"openrouter-free": {
				apiKeyEnv: "OPENROUTER_API_KEY",
				displayName: "OpenRouter Free",
				api: "openai-completions",
				baseURL: "https://openrouter.ai/api/v1",
				compat: { thinkingFormat: "openrouter" },
				models: [
					{ id: "openrouter/auto", name: "OpenRouter 免费池（自动挑选）", input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 }
				]
			},
			// v1.8.4：硅基流动 SiliconFlow（9B以下15+款小模型永久免费，国内直连，OpenAI兼容）。
			"siliconflow": {
				apiKeyEnv: "SILICONFLOW_API_KEY",
				displayName: "硅基流动",
				api: "openai-completions",
				baseURL: "https://api.siliconflow.cn/v1",
				models: [
					{ id: "Qwen/Qwen3-8B", name: "硅基流动 Qwen3-8B（永久免费）", input: ["text"], contextWindow: 128000, maxTokens: 8192 }
				]
			},
			// v1.8.0：讯飞星火 Spark Lite（永久免费，2QPS）。
			"xinghuo": {
				apiKeyEnv: "XINGHUO_API_KEY",
				displayName: "讯飞星火",
				api: "openai-completions",
				baseURL: "https://spark-api-open.xf-yun.com/v1",
				models: [
					{ id: "spark-lite", name: "讯飞星火 Lite（永久免费）", input: ["text"], contextWindow: 8000, maxTokens: 2048 }
				]
			}
		};
		// 官方回落默认（卸载且无用户快照时；与 DSH agent-default-model 的
		// composition base 保持一致）。
		const OFFICIAL_FALLBACK = { provider: "deepseek-official", model: "deepseek-v4-flash" };
		const HELP_URL = "https://ai-yukin.github.io/dsh-0-tools/help.json";

		// v1.8.3: 教程页双链接智能选择（Gitee优先，国内访问快；Gitee不可用时自动fallback到GitHub）
		const GITEE_GUIDE_BASE = "https://ai-yukin.gitee.io/dsh-0-tools/guide/";
		const GITHUB_GUIDE_BASE = "https://ai-yukin.github.io/dsh-0-tools/guide/";
		let _guideUseGitee = true;
		function guideUrl(type) { return (_guideUseGitee ? GITEE_GUIDE_BASE : GITHUB_GUIDE_BASE) + type + ".html"; }
		// 启动时检测Gitee Pages可用性
		fetch("https://ai-yukin.gitee.io/dsh-0-tools/help.json", { method: "HEAD", mode: "no-cors" })
			.then(function() { _guideUseGitee = true; })
			.catch(function() { _guideUseGitee = false; });
		const PRICING_URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
		const PLATFORM_URL = "https://open.bigmodel.cn";
		const DS_PLATFORM_URL = "https://platform.deepseek.com";
		const API_DOCS_URL = "https://api-docs.deepseek.com/zh-cn";
		const UI_MARKER = "data-dsh-0-tools-ui";

		// ---------- tiny helpers ----------
		function fetchWithTimeout(url, ms) {
			const ctrl = new AbortController();
			const timer = setTimeout(() => ctrl.abort(), ms);
			return fetch(url, { signal: ctrl.signal, cache: "no-store" }).finally(() => clearTimeout(timer));
		}

		// ---------- DSH official same-origin RPC channel ----------
		// v1.5.0 起配置读写全部走 DSH 官方 /api 通道（settings.* / credentials.* /
		// llm.*），不再依赖自建 127.0.0.1:3090-3099 服务：官方通道有回环信任
		// 栅栏（伪造 Origin / cross-site 请求被 403 拒绝）、原子写、输入校验与
		// revision 防冲突，且写 agent-default-model 是合并语义——用户已设置的
		// reasoningEffort 等未提及键自动保留。同源 fetch 天然 UTF-8（阶段0实测
		// 命令行通道会 GBK 乱码落盘，此处无此问题）。
		let _rpcSeq = 0;
		function dshApi(method, payload) {
			const rpcId = "dsh-0-tools-" + (++_rpcSeq) + "-" + Date.now();
			return fetch("/api/" + method, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				cache: "no-store",
				body: JSON.stringify({ type: "client-request", rpcId: rpcId, method: method, payload: payload || {} })
			}).then((r) => {
				return r.text().then((text) => {
					let env = null;
					try { env = JSON.parse(text); } catch (e) { /* non-JSON error body */ }
					if (!env || env.type !== "server-response") {
						throw new Error("DSH 官方通道未就绪（HTTP " + r.status + "），请确认 DeepSeek Harness 正常运行。");
					}
					const res = env.result;
					if (res && res.ok) return res.value;
					// 错误体透传：官方 message 是可直接展示的人话（如
					// settings-rejected 的校验原因、settings-conflict 的版本冲突），
					// 截断上限防误爆。
					const err = (res && res.error) || {};
					let msg = String(err.message || err.code || ("DSH 服务错误（HTTP " + r.status + "）"));
					if (msg.length > 160) msg = msg.slice(0, 160) + "…";
					throw new Error(msg);
				});
			});
		}

		// 读取 agent-default-model 的用户层值（卸载恢复与配置前快照用）。
		function readAgentDefault() {
			return dshApi("settings.describe", {}).then((desc) => {
				const ns = desc && desc.namespaces ? desc.namespaces.find((n) => n.ns === "agent-default-model") : null;
				const u = ns && ns.user;
				return u && u.provider && u.model ? { provider: u.provider, model: u.model } : null;
			}).catch(() => null);
		}
		// v1.8.2: 模块级「自动安装免费模型」核心链（识别Key→写凭据→注册provider→设为默认模型）。
		// 由引导弹窗、设置页、右下角浮动提示共用；freeModels 由调用方传入（内置或远程均可）。
		function doAutoInstall(modelType, apiKey, freeModels) {
			const fms = Array.isArray(freeModels) ? freeModels : [];
			const modelItem = fms.find((m) => m && m.type === modelType) || null;
			const spec = BUILTIN_PROVIDER_SPECS[modelType];
			const credRef = (modelItem && modelItem.credentialRef) || (spec && spec.apiKeyEnv) || (modelType.toUpperCase() + "_API_KEY");
			const models = (modelItem && Array.isArray(modelItem.models) && modelItem.models.length) ? modelItem.models : (spec && spec.models);
			if (!models || !models.length) {
				return Promise.reject(new Error("模型配置缺失，请手动配置"));
			}
			const providerValue = { apiKeyEnv: credRef, models: models };
			if (modelItem && modelItem.displayName) providerValue.displayName = modelItem.displayName;
			if (modelItem && modelItem.api) providerValue.api = modelItem.api;
			if (modelItem && modelItem.baseURL) providerValue.baseURL = modelItem.baseURL;
			if (spec && spec.api && !modelItem.api) providerValue.api = spec.api;
			if (spec && spec.baseURL && !modelItem.baseURL) providerValue.baseURL = spec.baseURL;
			if (modelItem && modelItem.compat && modelItem.compat.thinkingFormat) providerValue.compat = { thinkingFormat: modelItem.compat.thinkingFormat };
			return readAgentDefault()
				.then((prev) => {
					if (prev && prev.provider !== modelType) savePrevDefaultSnapshot(prev);
					return dshApi("credentials.set", { ref: credRef, value: apiKey });
				})
				.then(() => dshApi("settings.mutate", {
					ns: "llm-pi-ai",
					ops: [{ op: "set", path: ["providers", modelType], value: providerValue }]
				}))
				.then(() => dshApi("settings.update", {
					ns: "agent-default-model",
					patch: { provider: modelType, model: models[0].id }
				}))
				.then(() => ({ modelName: modelItem ? (modelItem.title || modelType) : modelType, modelCount: fms.length }));
		}

		// v1.8.2: 识别 key 属于哪个免费模型（前缀/格式匹配）。
		function identifyKeyModel(raw) {
			if (raw.indexOf("sk-or-v1-") === 0) return "openrouter-free";
			// v1.8.4：硅基流动 API Key 格式 sk- + 40-60位字母数字（排除OpenRouter的sk-or-v1-前缀）
			if (raw.indexOf("sk-") === 0 && raw.indexOf("sk-or-v1-") !== 0 && raw.length >= 40 && raw.length <= 65) return "siliconflow";
			if (/^[0-9a-f]{32}$/i.test(raw)) return "xinghuo";
			// v1.8.3修复：智谱 API Key 格式为 {id}.{secret}（中间带点号），旧正则只匹配纯字母数字导致识别失败
			if (/^[a-zA-Z0-9._-]{20,}$/.test(raw) && raw.length >= 24) return "zai";
			return null;
		}


		// 配置前默认模型快照（卸载时恢复用户原选择；仅当当前默认不指向本
		// provider 时才记录，避免重复配置覆盖掉真正的"原值"）。
		const PREV_DEFAULT_KEY = "dsh-0-tools:prev-default-model";
		function savePrevDefaultSnapshot(v) {
			try { if (v) localStorage.setItem(PREV_DEFAULT_KEY, JSON.stringify({ provider: v.provider, model: v.model, savedAt: Date.now() })); } catch (e) { /* ignore */ }
		}
		function loadPrevDefaultSnapshot() {
			try {
				const raw = localStorage.getItem(PREV_DEFAULT_KEY);
				const v = raw ? JSON.parse(raw) : null;
				return v && v.provider && v.model ? { provider: v.provider, model: v.model } : null;
			} catch (e) { return null; }
		}

		// 合成全量 provider 状态 dict（与旧 host GET /status 等价）：
		// settings.describe 读 llm-pi-ai.providers 全部键（含本插件未注册的
		// 动态发现条目），credentials.describe 查各 apiKeyEnv 凭据状态。
		function readProviderStatus() {
			return dshApi("settings.describe", {}).then((desc) => {
				const ns = desc && desc.namespaces ? desc.namespaces.find((n) => n.ns === "llm-pi-ai") : null;
				const providers = (ns && ns.user && ns.user.providers) || {};
				const keys = Object.keys(providers);
				if (!keys.length) return {};
				const envs = keys.map((k) => (providers[k] && providers[k].apiKeyEnv) || "");
				return dshApi("credentials.describe", { refs: envs }).then((cred) => {
					const credMap = (cred && cred.credentials) || {};
					const out = {};
					for (let i = 0; i < keys.length; i++) {
						const env = envs[i];
						out[keys[i]] = !!(env && credMap[env] && credMap[env].configured);
					}
					return out;
				});
			});
		}

		function openExternal(url) {
			try {
				window.open(url, "_blank", "noopener,noreferrer");
			} catch (e) {
				window.location.href = url;
			}
		}

		// ---------- configuration status (authoritative: DSH official /api) ----------
		// 返回全量 provider 状态 dict { zai: bool, ... }，供
		// ② 配置中心逐条渲染"已接入"标记与页脚入口显隐判断。
		// v1.5.0：数据源改为官方 settings.describe + credentials.describe（经
		// readProviderStatus 合成），5 秒轮询保留（DSH 热感知磁盘改动已实证，
		// 后续可升级为事件订阅，此处保持 UI 行为不变）。
		function useConfigured() {
			const [status, setStatus] = _react.useState({});
			const [loaded, setLoaded] = _react.useState(false);
			const [revision, setRevision] = _react.useState(0);
			_react.useEffect(() => {
				let alive = true;
				const tick = () => {
					readProviderStatus()
						.then((s) => {
							if (!alive) return;
							setStatus(s || {});
							setLoaded(true);
						})
						.catch(() => {
							if (alive) setLoaded(true);
						});
				};
				tick();
				const timer = setInterval(tick, 5000);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [revision]);
			const refresh = () => setRevision((v) => v + 1);
			const hasAnyInstalled = Object.values(status).some(Boolean);
			return { status, loaded, hasAnyInstalled, refresh };
		}
		// ---------- v1.8.0: free model health monitor (智能路由引擎) ----------
		// 后台定期对所有已配置的免费模型发 max_tokens=1 极小请求测速，
		// 记录最近 5 次响应时间取平均，状态判定：<3000ms=可用 / 3000-8000ms=较慢 / >8000ms或超时=不可用。
		// 提供 getFastestAvailable() 获取最快可用模型，switchToModel() 一键切换。
		const HEALTH_CHECK_INTERVAL = 60000; // 60秒测速一次
		const HEALTH_LATENCY_OK = 3000;       // <3s = 可用
		const HEALTH_LATENCY_SLOW = 8000;     // 3-8s = 较慢，>8s = 不可用
		const HEALTH_TIMEOUT = 15000;          // 单次测速超时 15s
		const HEALTH_HISTORY_SIZE = 5;         // 保留最近 5 次测速结果

		// 全局测速状态：{ providerKey: { latencies: [number], lastChecked: number, status: "ok"|"slow"|"unavailable", avgLatency: number, consecutiveUnavailable: number } }
		const _healthState = {};
		let _healthTimer = null;
		let _healthAutoMode = true; // v1.8.0: 自动切换默认开启（配置多个免费模型后自动绕开故障）
		const HEALTH_AUTO_KEY = "dsh-0-tools:health-auto-mode";
		const AUTO_SWITCH_THRESHOLD = 2; // v1.8.0修正：连续2次不可用才自动切换

		function loadHealthAutoMode() {
			// v1.8.3修复：新用户 localStorage 无此 key 时默认开启自动切换
			try {
				const raw = localStorage.getItem(HEALTH_AUTO_KEY);
				_healthAutoMode = raw === null ? true : raw === "1";
			} catch (e) { _healthAutoMode = true; }
		}
		function saveHealthAutoMode(v) {
			_healthAutoMode = v;
			try { localStorage.setItem(HEALTH_AUTO_KEY, v ? "1" : "0"); } catch (e) { /* ignore */ }
		}

		// v1.8.3修复：测速通过本地 Node 代理（127.0.0.1:3095）发请求，绕过浏览器 CORS 跨域限制
		// 旧版直接从浏览器 fetch 第三方 API，被 CORS 拦截导致所有模型测速失败显示"不可用"
		const HEALTH_PROXY_PORTS = [3095, 3096, 3097, 3098, 3099];
		let _healthProxyPort = null;
		let _healthProxyProbePromise = null;

		function probeHealthProxy() {
			if (_healthProxyPort) return Promise.resolve(_healthProxyPort);
			if (_healthProxyProbePromise) return _healthProxyProbePromise;
			_healthProxyProbePromise = (async () => {
				for (const p of HEALTH_PROXY_PORTS) {
					try {
						const r = await fetch("http://127.0.0.1:" + p + "/ping", {
							method: "OPTIONS",
							signal: AbortSignal.timeout(1000)
						});
						if (r.ok || r.status === 204) {
							_healthProxyPort = p;
							return p;
						}
					} catch (e) { /* port not listening, try next */ }
				}
				return null;
			})().finally(() => { _healthProxyProbePromise = null; });
			return _healthProxyProbePromise;
		}

		// 对单个 provider 发一次测速请求（max_tokens=1），通过本地 Node 代理绕过 CORS
		// v1.8.3 修正：浏览器端读不到 API Key 明文（DSH credentials.describe 出于安全不返回 value），
		// 所以只传 baseURL/modelId/apiKeyEnv，由代理服务器从 ~/.dsh/.credentials.yaml 读取真实 Key。
		function pingProvider(providerKey) {
			return new Promise((resolve) => {
				dshApi("settings.describe", {}).then((desc) => {
					const ns = desc && desc.namespaces ? desc.namespaces.find((n) => n.ns === "llm-pi-ai") : null;
					const block = ns && ns.user && ns.user.providers && ns.user.providers[providerKey];
					if (!block || !block.baseURL || !block.apiKeyEnv) {
						resolve(null);
						return;
					}
					const modelId = block.models && block.models[0] && block.models[0].id;
					if (!modelId) { resolve(null); return; }

					return probeHealthProxy().then((proxyPort) => {
						if (!proxyPort) {
							resolve(null);
							return;
						}
						const reqBody = { baseURL: block.baseURL, modelId: modelId, apiKeyEnv: block.apiKeyEnv };
						return fetch("http://127.0.0.1:" + proxyPort + "/ping", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(reqBody),
							signal: AbortSignal.timeout(HEALTH_TIMEOUT + 2000)
						}).then((r) => r.json()).then((data) => {
							if (data && data.ok && typeof data.latency === "number") {
								resolve(data.latency);
							} else {
								resolve(null);
							}
						}).catch((e) => {
							_healthProxyPort = null;
							resolve(null);
						});
					});
			}).catch(() => resolve(null));
		});
	}

		// 更新单个 provider 的测速状态
		function updateHealthState(providerKey, latency) {
			if (!_healthState[providerKey]) {
				_healthState[providerKey] = { latencies: [], lastChecked: 0, status: "unknown", avgLatency: 0, consecutiveUnavailable: 0 };
			}
			const s = _healthState[providerKey];
			s.lastChecked = Date.now();
			if (latency !== null && latency !== undefined) {
				s.latencies.push(latency);
				if (s.latencies.length > HEALTH_HISTORY_SIZE) s.latencies.shift();
				s.avgLatency = Math.round(s.latencies.reduce((a, b) => a + b, 0) / s.latencies.length);
				if (s.avgLatency < HEALTH_LATENCY_OK) { s.status = "ok"; s.consecutiveUnavailable = 0; }
				else if (s.avgLatency < HEALTH_LATENCY_SLOW) { s.status = "slow"; s.consecutiveUnavailable = 0; }
				else { s.status = "unavailable"; s.consecutiveUnavailable = (s.consecutiveUnavailable || 0) + 1; }
			} else {
				// 测速失败：连续失败计数+1
				s.consecutiveUnavailable = (s.consecutiveUnavailable || 0) + 1;
				if (s.latencies.length === 0 || s.consecutiveUnavailable >= AUTO_SWITCH_THRESHOLD) s.status = "unavailable";
			}
		}

		// 对所有已配置的免费模型执行一轮测速
		function runHealthCheck() {
			// v1.8.0修正：动态读取已配置的 provider，不硬编码免费模型列表（远程热更新新增模型时自动适配）
			return readProviderStatus().then((status) => {
				const configured = Object.keys(status).filter((p) => status[p]);
				if (!configured.length) return;
				return Promise.all(configured.map((p) => pingProvider(p).then((latency) => {
					updateHealthState(p, latency);
				})));
				// v1.8.5: 移除自动切换，改为用户手动点击切换（避免打断用户当前对话）
			}).catch(() => { /* ignore */ });
		}

		// 启动后台测速定时器
		function startHealthMonitor() {
			loadHealthAutoMode();
			if (_healthTimer) return;
			runHealthCheck(); // 立即执行一次
			_healthTimer = setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);
		}

		// 获取当前最快的可用免费模型
		function getFastestAvailable() {
			// v1.8.0修正：从 _healthState 动态读取所有有测速数据的 provider，不硬编码列表
			let best = null;
			for (const p in _healthState) {
				const s = _healthState[p];
				if (s && s.status === "ok" && s.avgLatency > 0) {
					if (!best || s.avgLatency < best.avgLatency) {
						best = { provider: p, avgLatency: s.avgLatency, status: s.status };
					}
				}
			}
			return best;
		}

		// 获取当前默认模型是否是免费模型
		function getCurrentDefaultModel() {
			return dshApi("settings.describe", {}).then((desc) => {
				const ns = desc && desc.namespaces ? desc.namespaces.find((n) => n.ns === "agent-default-model") : null;
				const u = ns && ns.user;
				return u && u.provider && u.model ? { provider: u.provider, model: u.model } : null;
			}).catch(() => null);
		}

		// 切换到指定模型
		function switchToModel(providerKey, modelId) {
			return dshApi("settings.update", {
				ns: "agent-default-model",
				patch: { provider: providerKey, model: modelId }
			});
		}

		// v1.8.5: 通过 DOM 模拟点击切换当前对话模型（不刷新页面）
		function switchCurrentConversationModel(provider) {
			console.log("[dsh-0-tools] 开始切换当前对话模型，目标 provider:", provider);
			return new Promise((resolve, reject) => {
				try {
					// 1. 找到模型选择器触发按钮（尝试多种方式）
					let trigger = document.querySelector("._7KE1Ra_triggerLabel");
					if (!trigger) {
						// 尝试通过其他方式找到触发按钮
						const allSpans = document.querySelectorAll("span");
						for (const span of allSpans) {
							if (span.className && span.className.includes && span.className.includes("triggerLabel")) {
								trigger = span;
								break;
							}
						}
					}
					if (!trigger) {
						reject(new Error("未找到模型选择器触发按钮"));
						return;
					}
					console.log("[dsh-0-tools] 找到触发按钮:", trigger.textContent);

					// 2. 点击触发按钮的父元素（展开下拉列表）
					let clickTarget = trigger.parentElement;
					// 向上找，直到找到可点击的按钮元素
					while (clickTarget && clickTarget.tagName !== "BUTTON" && clickTarget.parentElement) {
						clickTarget = clickTarget.parentElement;
					}
					console.log("[dsh-0-tools] 点击目标:", clickTarget.tagName, clickTarget.className);
					clickTarget.click();

					// 3. 等待下拉列表出现（重试3次）
					let retryCount = 0;
					const tryFindAndClick = () => {
						setTimeout(() => {
							try {
								// 检查下拉列表是否出现
								const groups = document.querySelectorAll("._7KE1Ra_group");
								console.log("[dsh-0-tools] 找到分组数量:", groups.length, "重试次数:", retryCount);

								if (groups.length === 0) {
									// 下拉列表没出现，重试
									if (retryCount < 3) {
										retryCount++;
										console.log("[dsh-0-tools] 下拉列表未出现，重试点击触发按钮");
										clickTarget.click();
										tryFindAndClick();
									} else {
										reject(new Error("下拉列表未出现，重试3次失败"));
									}
									return;
								}

								// 4. 找到包含目标 provider 的分组
								let targetGroup = null;
								for (const group of groups) {
									const ariaLabelledby = group.getAttribute("aria-labelledby") || "";
									console.log("[dsh-0-tools] 分组 aria-labelledby:", ariaLabelledby);
									if (ariaLabelledby.includes("-" + provider)) {
										targetGroup = group;
										break;
									}
								}

								if (!targetGroup) {
									reject(new Error("未找到模型分组: " + provider + "，可用分组: " + Array.from(groups).map(g => g.getAttribute("aria-labelledby")).join(", ")));
									return;
								}
								console.log("[dsh-0-tools] 找到目标分组");

								// 5. 在分组里找到第一个模型选项
								const option = targetGroup.querySelector("._7KE1Ra_option");
								if (!option) {
									reject(new Error("未找到模型选项"));
									return;
								}
								const modelName = option.querySelector("._7KE1Ra_modelName");
								console.log("[dsh-0-tools] 找到模型选项:", modelName ? modelName.textContent : "未知");

								// 6. 点击模型选项
								option.click();
								console.log("[dsh-0-tools] 已点击模型选项");

								// 7. 等待切换完成
								setTimeout(() => {
									console.log("[dsh-0-tools] 切换完成");
									resolve();
								}, 500);
							} catch (e) {
								reject(e);
							}
						}, 400);
					};
					tryFindAndClick();
				} catch (e) {
					reject(e);
				}
			});
		}

		// 一键切换到最快可用模型
		function switchToFastest() {
			const best = getFastestAvailable();
			if (!best) return Promise.reject(new Error("当前没有可用的免费模型"));
			// 获取该 provider 的第一个模型 ID
			return dshApi("settings.describe", {}).then((desc) => {
				const ns = desc && desc.namespaces ? desc.namespaces.find((n) => n.ns === "llm-pi-ai") : null;
				const block = ns && ns.user && ns.user.providers && ns.user.providers[best.provider];
				const modelId = block && block.models && block.models[0] && block.models[0].id;
				if (!modelId) throw new Error("模型配置缺失");
				return switchToModel(best.provider, modelId).then(() => ({ provider: best.provider, model: modelId, avgLatency: best.avgLatency }));
			});
		}

		// React Hook：订阅健康监测状态（供 UI 组件使用）
		function useHealthMonitor() {
			const [tick, setTick] = _react.useState(0);
			_react.useEffect(() => {
				startHealthMonitor();
				// 每 10 秒刷新一次 UI（比测速频率高，让状态变化及时反映）
				const uiTimer = setInterval(() => setTick((v) => v + 1), 10000);
				return () => clearInterval(uiTimer);
			}, []);
			return {
				state: _healthState,
				autoMode: _healthAutoMode,
				setAutoMode: saveHealthAutoMode,
				getFastest: getFastestAvailable,
				switchFastest: switchToFastest,
				refresh: () => { runHealthCheck(); setTick((v) => v + 1); }
			};
		}


		// ---------- DeepSeek model awareness (trimmed; zai DOM sniffing removed) ----------
		function getModelSelectorText() {
			const parts = [];
			// 新版 DSH 模型选择器是带 aria-label 的 trigger 按钮（如
			// "选择模型，当前 DeepSeek-V4-Pro，推理等级 High"）。
			// 页面存在多个 *_trigger 按钮（设置/访问模式等），须筛选 aria-label 以「选择模型」开头的那个。
			const triggers = document.querySelectorAll('button[class*="_trigger"]');
			for (const t of triggers) {
				const label = (t.getAttribute("aria-label") || "").trim();
				if (label && label.indexOf("选择模型") === 0) {
					parts.push(label);
					break;
				}
			}
			if (parts.length === 0) {
				const sel = document.querySelector('[data-testid="model-selector"], [class*="model-selector"], [class*="modelSelector"]');
				if (sel) parts.push(sel.textContent);
				const menu = document.querySelector('[role="menu"] [role="menuitem"][aria-checked="true"], [class*="model-picker"] [class*="selected"]');
				if (menu) parts.push(menu.textContent);
				const footer = document.querySelector('[class*="footer"] [class*="model"], [class*="sidebar"] [class*="model"]');
				if (footer && footer.textContent && footer.textContent.trim().length > 0 && footer.textContent.trim().length < 60) parts.push(footer.textContent);
			}
			return parts.join(" ").trim();
		}

		function isDeepSeekText(text) {
			if (!text) return false;
			return text.toLowerCase().includes("deepseek");
		}

		function useModelPricingState() {
			const [state, setState] = _react.useState("none");
			_react.useEffect(() => {
				let alive = true;
				const scan = () => {
					if (!alive) return;
					const text = getModelSelectorText();
					const next = isDeepSeekText(text) ? "deepseek" : "none";
					setState((prev) => (prev === next ? prev : next));
				};
				scan();
				// v1.5.0：删除了 dsh:modelchange 监听——DSH 全源码无任何
				// dispatchEvent 派发该事件，属臆造事件名（计价条实际一直靠
				// 下面的轮询驱动）。DOM 扫描周期从 1s 放宽到 2s，足以覆盖
				// 用户切换模型的感知延迟，降低常驻开销。
				const timer = setInterval(scan, 2000);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, []);
			return state;
		}

		// ---------- pricing badge ----------
		// 组件定义已移至 footer buttons 段，统一复用 FooterButton 样式。

		// ---------- shared modal frame ----------
		const MODAL_MASK = {
			position: "fixed",
			inset: "0",
			background: "rgba(0,0,0,0.45)",
			zIndex: 99990,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: "24px"
		};
		const MODAL_BOX = {
			background: "#fff",
			borderRadius: "16px",
			boxShadow: "0 16px 48px rgba(0,0,0,0.24)",
			maxWidth: "560px",
			width: "100%",
			maxHeight: "86vh",
			display: "flex",
			flexDirection: "column",
			overflow: "hidden"
		};
		const MODAL_HEAD = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			padding: "14px 18px",
			borderBottom: "1px solid #ececf1",
			fontSize: "15px",
			fontWeight: 600,
			color: "#111"
		};
		const MODAL_BODY = {
			padding: "16px 18px",
			overflowY: "auto",
			fontSize: "13px",
			color: "#333",
			lineHeight: "1.7"
		};
		const MODAL_FOOT = {
			padding: "12px 18px",
			borderTop: "1px solid #ececf1",
			display: "flex",
			justifyContent: "flex-end",
			gap: "8px"
		};
		const CLOSE_X = {
			border: "none",
			background: "transparent",
			cursor: "pointer",
			fontSize: "16px",
			color: "#666",
			lineHeight: "1"
		};

		function ModalFrame(props) {
			return (0, react_jsx_runtime.jsx)("div", {
				style: MODAL_MASK,
				onClick: (e) => {
					if (e.target === e.currentTarget) props.onClose();
				},
				children: (0, react_jsx_runtime.jsx)("div", {
					style: MODAL_BOX,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							style: MODAL_HEAD,
							children: [
								(0, react_jsx_runtime.jsx)("span", { children: props.title }),
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: CLOSE_X,
									"aria-label": "关闭",
									onClick: props.onClose,
									children: "\u2715"
								})
							]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							style: MODAL_BODY,
							children: props.children
						}),
						props.footer ? (0, react_jsx_runtime.jsx)("div", {
							style: MODAL_FOOT,
							children: props.footer
						}) : null
					]
				})
			});
		}

		// ---------- onboarding wizard (configure free models) ----------
		const INPUT_STYLE = {
			boxSizing: "border-box",
			width: "100%",
			border: "1px solid #d5d5dd",
			borderRadius: "8px",
			padding: "8px 10px",
			fontSize: "13px",
			lineHeight: "20px",
			color: "#111"
		};
		const BTN_PRIMARY = {
			border: "none",
			borderRadius: "16px",
			padding: "7px 16px",
			fontSize: "13px",
			fontWeight: 600,
			color: "#fff",
			background: "#2563eb",
			cursor: "pointer"
		};
		const BTN_DANGER = {
			border: "1px solid #f0c4c4",
			borderRadius: "16px",
			padding: "7px 16px",
			fontSize: "13px",
			fontWeight: 600,
			color: "#e5484d",
			background: "#fff",
			cursor: "pointer"
		};
		const BTN_OUTLINE = {
			border: "1px solid #d5d5dd",
			borderRadius: "16px",
			padding: "7px 16px",
			fontSize: "13px",
			color: "#444",
			background: "#fff",
			cursor: "pointer"
		};

		// 通用免费模型安装表单：由远程 freeModels 条目驱动（endpoint / keyPrefix /
		// models 均可配置），安装成功后仅提示"已接入"，不再宣称"已设为默认模型"。
		function FreeInstallForm(props) {
			const { item, onDone } = props;
			const [key, setKey] = _react.useState("");
			const [busy, setBusy] = _react.useState(false);
			const [err, setErr] = _react.useState("");
			const [done, setDone] = _react.useState(false);
			const submit = () => {
				const raw = key.trim();
				if (!raw) {
					setErr("请先粘贴你的 API Key");
					return;
				}
				if (item.keyPrefix && raw.indexOf(item.keyPrefix) !== 0) {
					setErr("API Key 应以 " + item.keyPrefix + " 开头，请确认后重试");
					return;
				}
				// 编码/注入自检：禁止换行与替换字符（阶段0实测：坏字节会被
				// 官方通道照存不误，必须在写入前拦截）。
				if (/[\r\n\uFFFD]/.test(raw)) {
					setErr("API Key 中包含换行或非法字符，请检查粘贴内容后重试");
					return;
				}
				// 凭据引用解析：远程卡片 credentialRef > 内置规格 > 拒绝。
				const spec = BUILTIN_PROVIDER_SPECS[item.type];
				const credRef = item.credentialRef || (spec && spec.apiKeyEnv) || "";
				if (!credRef) {
					setErr("该模型类型暂不支持（缺少凭据配置声明），请更新插件后重试");
					return;
				}
				setBusy(true);
				setErr("");
				// 远程卡片可携带 models；缺省回落内置规格。
				const models = Array.isArray(item.models) && item.models.length ? item.models : (spec && spec.models);
				// v1.6.0：OpenRouter 类卡片携带路由级字段（api/baseURL/
				// displayName/compat，已过 filterRemotePayload 枚举白名单安检），
				// 智谱卡片不带这些字段，provider 块结构与 v1.5.0 完全一致。
				const providerValue = { apiKeyEnv: credRef, models: models };
				if (item.displayName) providerValue.displayName = item.displayName;
				if (item.api) providerValue.api = item.api;
				if (item.baseURL) providerValue.baseURL = item.baseURL;
				if (item.compat && item.compat.thinkingFormat) providerValue.compat = { thinkingFormat: item.compat.thinkingFormat };
				// 依次：① 记录配置前默认（供卸载恢复）→ ② 写凭据 →
				// ③ 写 provider 块 → ④ 切默认模型（merge 语义，reasoningEffort
				// 等用户已设键自动保留）。
				readAgentDefault()
					.then((prev) => {
						if (prev && prev.provider !== item.type) savePrevDefaultSnapshot(prev);
						return dshApi("credentials.set", { ref: credRef, value: raw });
					})
					.then(() => dshApi("settings.mutate", {
						ns: "llm-pi-ai",
						ops: [{ op: "set", path: ["providers", item.type], value: providerValue }]
					}))
					.then(() => dshApi("settings.update", {
						ns: "agent-default-model",
						patch: { provider: item.type, model: models[0].id }
					}))
					.then(() => {
						setBusy(false);
						setDone(true);
						props.onDone && props.onDone();
					})
					.catch((e) => {
						setBusy(false);
						setErr(String((e && e.message) || e));
					});
			};
			if (done) {
				return (0, react_jsx_runtime.jsx)("div", {
					style: { color: "#30a46c", fontWeight: 600, lineHeight: "20px" },
					children: "\u2714 安装成功！已接入「" + item.title + "」，可在模型列表中选择使用。"
				});
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "10px", background: "#f7f8fa", border: "1px solid #ececf1", borderRadius: "10px", padding: "12px" },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						style: { fontSize: "12px", lineHeight: "20px", color: "#444" },
						children: item.desc
					}),
					(0, react_jsx_runtime.jsx)("input", {
						type: "password",
						style: INPUT_STYLE,
						placeholder: item.keyPlaceholder || "粘贴你的 API Key",
						value: key,
						onChange: (e) => setKey(e.target.value)
					}),
					err ? (0, react_jsx_runtime.jsx)("div", { style: { color: "#e5484d", fontSize: "12px" }, children: err }) : null,
					(0, react_jsx_runtime.jsxs)("div", {
						style: { display: "flex", gap: "8px", alignItems: "center" },
						children: [
							(0, react_jsx_runtime.jsx)("a", {
								href: guideUrl(item.type),
								target: "_blank",
								rel: "noreferrer",
								style: { ...BTN_PRIMARY, background: "#6b7280", textDecoration: "none", flex: "1", textAlign: "center" },
								children: "引导教程"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: { ...BTN_PRIMARY, opacity: busy ? 0.6 : 1, flex: "1" },
								disabled: busy,
								onClick: submit,
								children: busy ? "安装中…" : "确认配置"
							})
						]
					}),
					item.note ? (0, react_jsx_runtime.jsx)("div", {
						style: { fontSize: "11px", lineHeight: "16px", color: "#9a9fa6" },
						children: item.note
					}) : null
				]
			});
		}

		// 通用卸载：适用于任意 provider（含远程 retired 清单里的失效残留）。
		// 动态读取该 provider 块的 apiKeyEnv（v1.4 及以前依赖本地静态
		// REGISTRY，导致 openrouter 残留一键清理必失败——v1.5.0 修复）。
		// 默认模型保护：仅当当前默认指向被卸载者时，恢复配置前快照（无快照
		// 回落官方默认），否则保持用户当前选择不动。
		function uninstallProvider(providerKey) {
			let credRef = null;
			return dshApi("settings.describe", {})
				.then((desc) => {
					const llm = desc && desc.namespaces ? desc.namespaces.find((n) => n.ns === "llm-pi-ai") : null;
					const block = llm && llm.user && llm.user.providers && llm.user.providers[providerKey];
					credRef = (block && block.apiKeyEnv) || null;
					const adm = desc && desc.namespaces ? desc.namespaces.find((n) => n.ns === "agent-default-model") : null;
					const cur = adm && adm.user;
					const pointsAt = !!(cur && cur.provider === providerKey);
					const chain = dshApi("settings.mutate", {
						ns: "llm-pi-ai",
						ops: [{ op: "unset", path: ["providers", providerKey] }]
					});
					if (pointsAt) {
						const restore = loadPrevDefaultSnapshot() || OFFICIAL_FALLBACK;
						return chain
							.then(() => dshApi("settings.update", { ns: "agent-default-model", patch: { provider: restore.provider, model: restore.model } }))
							.then(() => true);
					}
					return chain.then(() => false);
				})
				.then((restored) => {
					const tail = credRef ? dshApi("credentials.unset", { ref: credRef }) : Promise.resolve();
					return tail.then(() => restored);
				});
		}

		// 通用已接入状态 + 一键卸载（provider 参数化，沿用二段确认交互）。
		// 卸载成功提示按真实行为描述：仅当默认模型指向被卸载者时才恢复
		// 配置前的原默认模型，否则保持用户当前选择。
		function FreeInstalledZone(props) {
			const { item, onDone } = props;
			const [busy, setBusy] = _react.useState(false);
			const [confirming, setConfirming] = _react.useState(false);
			const [msg, setMsg] = _react.useState("");
			const run = () => {
				if (!confirming) {
					setConfirming(true);
					return;
				}
				setBusy(true);
				setMsg("");
				uninstallProvider(item.type)
					.then((restored) => {
						setBusy(false);
						setConfirming(false);
						setMsg("\u2714 已卸载：该模型的 provider 配置与密钥已清除。" + (restored ? "默认模型已恢复为你配置前的选择。" : "默认模型未指向它，保持你的当前选择不变。"));
						props.onDone && props.onDone();
					})
					.catch((e) => {
						setBusy(false);
						setConfirming(false);
						setMsg("卸载失败：" + String((e && e.message) || e));
					});
			};
			const uninstallBtnStyle = confirming
				? { border: "none", borderRadius: "16px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "#e5484d", cursor: "pointer" }
				: { border: "none", borderRadius: "16px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "#111", cursor: "pointer" };
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						style: { color: "#30a46c", fontWeight: 600, lineHeight: "20px" },
						children: "\u2714 已接入免费模型，可在模型列表中选择使用。"
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: { ...uninstallBtnStyle, opacity: busy ? 0.6 : 1 },
						disabled: busy,
						onClick: run,
						children: confirming ? "再次点击确认卸载" : (busy ? "卸载中…" : "一键卸载该免费模型")
					}),
					msg ? (0, react_jsx_runtime.jsx)("div", { style: { fontSize: "12px", color: msg.indexOf("\u2714") === 0 ? "#30a46c" : "#e5484d" }, children: msg }) : null
				]
			});
		}

		// ---------- v1.8.0: onboarding modal (首次启动免费模型引导弹窗) ----------
		// 检测到没有任何免费模型配置时自动弹出，4个大按钮跳专属教程页。
		const ONBOARDING_SHOWN_KEY = "dsh-0-tools:onboarding-shown-session";
		// v1.8.1: 用户点「以后不再提醒」后永久静默引导弹窗（不再自动弹出）。
		const ONBOARDING_DISMISS_KEY = "dsh-0-tools:onboarding-dismissed";


		const GUIDE_MODELS = [
			{ key: "zai", name: "智谱 GLM", desc: "文本+图片理解，永久免费", color: "#2563eb", url: guideUrl("zai") },
			{ key: "siliconflow", name: "硅基流动", desc: "Qwen3-8B等15+款小模型永久免费", color: "#7c3aed", url: guideUrl("siliconflow") },
			{ key: "xinghuo", name: "讯飞星火", desc: "Spark Lite，中文理解强", color: "#2563eb", url: guideUrl("xinghuo") },
			{ key: "openrouter-free", name: "OpenRouter", desc: "免费池自动挑选数十款", color: "#2563eb", url: guideUrl("openrouter-free") }
		];

		function OnboardingModal(props) {
			const { onClose, freeModels, configuredStatus, onInstallKey, installMsg, onDismiss } = props;
			const models = freeModels || [];
			const totalCount = models.length;
			const configuredCount = models.filter((m) => configuredStatus && configuredStatus[m.type]).length;
			const [keyInput, setKeyInput] = _react.useState("");
			const [uninstallTarget, setUninstallTarget] = _react.useState(null);
			const [uninstallBusy, setUninstallBusy] = _react.useState(false);
			// 模型显示名映射（优先用 shortName，无则从 title 提取）
			const getModelName = (item) => {
				if (item.shortName) return item.shortName;
				if (item.title) {
					return item.title.replace(/（.*$/g, "").replace(/一键配置.*/g, "").trim();
				}
				return item.type;
			};
			const handleUninstall = (m) => {
				if (uninstallTarget !== m.type) {
					setUninstallTarget(m.type);
					return;
				}
				setUninstallBusy(true);
				uninstallProvider(m.type)
					.then(() => {
						setUninstallBusy(false);
						setUninstallTarget(null);
						props.onConfigured && props.onConfigured();
					})
					.catch((e) => {
						setUninstallBusy(false);
						setUninstallTarget(null);
					});
			};
			return (0, react_jsx_runtime.jsx)(ModalFrame, {
				title: (0, react_jsx_runtime.jsxs)(_react.Fragment, {
					children: [
						(0, react_jsx_runtime.jsx)("span", { style: { marginRight: "10px" }, children: "🚀 一键配置免费模型" }),
						(0, react_jsx_runtime.jsx)("span", {
							style: {
								display: "inline-block", padding: "1px 8px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
								color: configuredCount >= totalCount && totalCount > 0 ? "#2e7d32" : "#6b7280",
								background: configuredCount >= totalCount && totalCount > 0 ? "#f0fdf4" : "#f2f3f5",
								verticalAlign: "middle"
							},
							children: "[已配置 " + configuredCount + "/" + totalCount + " 个免费模型]"
						})
					]
				}),
				onClose: onClose,
				footer: (0, react_jsx_runtime.jsxs)("div", {
					style: { display: "flex", gap: "8px", justifyContent: "space-between", width: "100%" },
					children: [
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: { ...BTN_OUTLINE, color: "#9a9fa6", borderColor: "#d9dde3" },
							onClick: onDismiss,
							children: "以后不再提醒"
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: BTN_OUTLINE,
							onClick: onClose,
							children: "稍后再说"
						})
					]
				}),
				children: (0, react_jsx_runtime.jsxs)("div", {
					style: { display: "flex", flexDirection: "column", gap: "12px" },
					children: [
						// 说明文案（截图3原文）
						(0, react_jsx_runtime.jsx)("div", {
							style: { fontSize: "13px", color: "#555", lineHeight: "1.7" },
							children: "建议配齐以下所有免费模型，免费模型数越多，切换选择更多！点击以下模型卡片「引导教程」，跟着一步步注册复制 API Key，并粘贴在「在此处粘贴任意模型 API Key 都将自动识别」框内，点击「自动识别 API Key 一键安装免费大模型」将自动安装免费模型。"
						}),
						// 模型卡片 2×2（复选框样式：紫色边框空框=未配置 / 绿色勾选=已配置）
						(0, react_jsx_runtime.jsx)("div", {
							style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
							children: models.map((m) => {
								const isConfigured = configuredStatus && configuredStatus[m.type];
								const confirming = uninstallTarget === m.type;
								return (0, react_jsx_runtime.jsxs)("div", {
									key: m.type,
									style: {
										display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
										padding: "10px 12px", borderRadius: "10px", border: "1px solid " + (isConfigured ? "#c8e6c9" : "#e0e0e8"),
										background: isConfigured ? "#f1f8f2" : "#fafbfc",
										transition: "all 0.15s"
									},
									children: [
										(0, react_jsx_runtime.jsxs)("span", { style: { display: "flex", alignItems: "center", gap: "7px" }, children: [
											// 复选框：未配置=紫色边框空框；已配置=绿色勾选
											(0, react_jsx_runtime.jsx)("span", {
												style: {
													width: "16px", height: "16px", borderRadius: "4px", flex: "none",
													display: "inline-flex", alignItems: "center", justifyContent: "center",
													boxSizing: "border-box",
													background: isConfigured ? "#2e7d32" : "#fff",
													border: "2px solid " + (isConfigured ? "#2e7d32" : "#7c6ff0"),
													fontSize: "11px", lineHeight: "1", color: "#fff", fontWeight: 700
												},
												children: isConfigured ? "\u2713" : ""
											}),
											(0, react_jsx_runtime.jsx)("span", { style: { fontSize: "14px", fontWeight: 700, color: "#111" }, children: getModelName(m) })
										]}),
										isConfigured
											? (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												disabled: uninstallBusy,
												onClick: () => handleUninstall(m),
												style: {
													border: "none", borderRadius: "14px", padding: "5px 12px", fontSize: "12px", fontWeight: 600,
													color: confirming ? "#fff" : "#e5484d", background: confirming ? "#e5484d" : "#fff6f6",
													cursor: "pointer", flex: "none", border: confirming ? "none" : "1px solid #f0c4c4"
												},
												children: confirming ? "再次点击确认卸载" : "一键卸载模型"
											})
											: (0, react_jsx_runtime.jsx)("a", {
												href: guideUrl(m.type), target: "_blank", rel: "noreferrer",
												style: { fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "none", cursor: "pointer", flex: "none" },
												children: "引导教程 →"
											})
									]
								});
							})
						}),
						// 大粘贴框
						(0, react_jsx_runtime.jsx)("input", {
							type: "text",
							style: {
								...INPUT_STYLE,
								padding: "12px 14px",
								fontSize: "13px",
								borderRadius: "10px",
								borderColor: "#2563eb",
								textAlign: "center"
							},
							placeholder: "在此处粘贴任意模型 API Key 都将自动识别",
							value: keyInput,
							onChange: (e) => setKeyInput(e.target.value)
						}),
						// 蓝色大按钮
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => onInstallKey && onInstallKey(keyInput),
							style: {
								...BTN_PRIMARY,
								width: "100%",
								padding: "12px",
								fontSize: "14px",
								borderRadius: "10px"
							},
							children: "自动识别 API Key 一键安装免费大模型"
						}),
						installMsg ? (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: "12px",
								color: installMsg.indexOf("✅") === 0 || installMsg.indexOf("✔") === 0 ? "#30a46c" : (installMsg.indexOf("⚠️") === 0 || installMsg.indexOf("ℹ️") === 0 ? "#f5a623" : "#e5484d"),
								textAlign: "center",
								lineHeight: "1.5"
							},
							children: installMsg
						}) : null
					]
				})
			});
		}// ---------- v1.8.0: model status indicator (侧边栏模型状态指示器) ----------
		// 已配置免费模型且当前默认是免费模型时显示，点击一键切最快。
		function ModelStatusIndicator(props) {
			const { health, currentProvider, onSwitch, freeModelTypes } = props;
			const [switching, setSwitching] = _react.useState(false);
			const [msg, setMsg] = _react.useState("");
			// v1.8.3: 从远程 help.json 获取模型简称（支持热更新新增模型）
			const { data: helpData } = useHelpData();
			const freeModels = (helpData && helpData.freeModels) ? helpData.freeModels : [];
			const currentModelItem = freeModels.find((m) => m && m.type === currentProvider);
			const currentModelName = (currentModelItem && currentModelItem.shortName) || currentProvider || "当前模型";

			const s = currentProvider ? health.state[currentProvider] : null;
			// v1.8.0修正：从 freeModelTypes 动态判断，不硬编码列表
			const isFreeModel = currentProvider && freeModelTypes && freeModelTypes.indexOf(currentProvider) >= 0;
			if (!isFreeModel || !s) return null;

			const statusColor = s.status === "ok" ? "#30a46c" : (s.status === "slow" ? "#f5a623" : "#e5484d");
			const statusText = s.status === "ok" ? "🟢" : (s.status === "slow" ? "🟡" : "🔴");
			// v1.8.0修正：不显示具体毫秒数，只显示状态文字，避免用户只配最快的
			const statusLabel = s.status === "ok" ? "响应正常" : (s.status === "slow" ? "响应较慢" : "响应超时");
			const slowWarning = s.status === "slow" || s.status === "unavailable";

			const handleClick = () => {
				if (switching) return;
				// v1.8.5: 只有响应超时时才允许点击切换
				if (s.status !== "unavailable") return;
				setSwitching(true);
				setMsg("正在切换…");
				// 先切换默认模型到最快可用，再通过 DOM 模拟点击切换当前对话模型（不刷新页面）
				health.switchFastest().then((result) => {
					setMsg("✅ 已切换默认模型，正在切换当前对话…");
					return switchCurrentConversationModel(result.provider);
				}).then(() => {
					setMsg("✅ 切换完成");
					setSwitching(false);
					setTimeout(() => setMsg(""), 3000);
				}).catch((e) => {
					setSwitching(false);
					setMsg("⚠️ " + String((e && e.message) || e));
					setTimeout(() => setMsg(""), 4000);
				});
			};

			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "2px", width: "100%" },
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: handleClick,
						disabled: switching,
						style: {
							display: "flex", alignItems: "center", justifyContent: "flex-start",
							width: "100%", padding: "6px 10px", borderRadius: "8px",
							border: "1px solid " + (s.status === "unavailable" ? "#f5c6c6" : (s.status === "slow" ? "#f5d7a0" : "#c8e6c9")),
							background: s.status === "unavailable" ? "#fff0f0" : (s.status === "slow" ? "#fff8e1" : "#f1f8f2"),
							cursor: switching ? "wait" : (s.status === "unavailable" ? "pointer" : "default"),
							fontSize: "11px", color: "#333", transition: "all 0.15s"
						},
						children: [
							(0, react_jsx_runtime.jsxs)("span", { style: { display: "flex", alignItems: "center", gap: "4px" }, children: [
								(0, react_jsx_runtime.jsx)("span", { children: statusText }),
								(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600 }, children: switching ? "切换中…" : (s.status === "unavailable" ? currentModelName + "：" + statusLabel + "，点击切换" : currentModelName + "：" + statusLabel) })
							]}),
						]
					}),
					msg ? (0, react_jsx_runtime.jsx)("div", { style: { fontSize: "10px", color: msg.indexOf("✅") === 0 ? "#30a46c" : "#e5484d", padding: "0 4px" }, children: msg }) : null
				]
			});
		}

		// 打开 DSH 设置弹窗并导航到「零号工具」页签（帮助中心入口所在）。
		function openSettingsZeroTools() {
			const triggers = document.querySelectorAll('button[class*="trigger"]');
			for (const t of triggers) {
				if ((t.textContent || "").indexOf("设置") >= 0) {
					t.click();
					break;
				}
			}
			setTimeout(() => {
				const labels = document.querySelectorAll('[class*="navLabel"]');
				for (const el of labels) {
					if ((el.textContent || "").trim() === "零号工具") {
						const cell = el.closest('[class*="navCell"]');
						if (cell) cell.click();
						break;
					}
				}
			}, 200);
		}

		// ---------- help center (remote JSON + built-in fallback) ----------
		const PLUGIN_VERSION = "1.8.4";
		const DEFAULT_HELP = {
			version: "2026-08-30.1",
			updatedAt: "2026-08-30",
			official: [
				{ title: "DeepSeek Harness 官网", url: "https://www.deepseek.com/harness/" },
				{ title: "DeepSeek 开放平台（官方 API 控制台）", url: DS_PLATFORM_URL },
				{ title: "DeepSeek API 文档（官方 API 介绍资料）", url: API_DOCS_URL }
			],
			selected: [
				{ title: "零号工具 dsh-0-tools（GitHub）", url: "https://github.com/ai-yukin/dsh-0-tools" },
				{ title: "DSH Plugin 广场（腾讯站）", url: "https://skillhub.cn/plugins" },
				{ title: "DSH 插件精选（awesome 站）", url: "https://awesome-dsh-plugin.com/zh" }
			],
			freeModels: [
				{
					type: "zai",
					title: "智谱",
					shortName: "智谱",
					desc: "GLM-4.7-Flash+GLM-4V-Flash",
					keysLabel: "智谱开放平台获取 API Key ↗",
					keysUrl: PLATFORM_URL,
					keyPlaceholder: "粘贴你的智谱 API Key"
				},
				{
					type: "openrouter-free",
					title: "OpenRouter",
					shortName: "OpenRouter",
					desc: "OpenRouter 免费池",
					keysLabel: "OpenRouter 获取 API Key ↗",
					keysUrl: "https://openrouter.ai/keys",
					keyPlaceholder: "粘贴你的 OpenRouter API Key（sk-or-v1- 开头）",
					keyPrefix: "sk-or-v1-",
					credentialRef: "OPENROUTER_API_KEY",
					displayName: "OpenRouter Free",
					api: "openai-completions",
					baseURL: "https://openrouter.ai/api/v1",
					compat: { thinkingFormat: "openrouter" },
					models: [
						{ id: "openrouter/auto", name: "OpenRouter 免费池（自动挑选）", input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 }
					]
				},
				{
					type: "siliconflow",
					title: "硅基流动",
					shortName: "硅基流动",
					desc: "Qwen3-8B等15+款9B以下小模型永久免费",
					keysLabel: "硅基流动控制台获取 API Key ↗",
					keysUrl: "https://cloud.siliconflow.cn/me/account/ak",
					keyPlaceholder: "粘贴你的硅基流动 API Key",
					keyPrefix: "sk-",
					credentialRef: "SILICONFLOW_API_KEY",
					displayName: "硅基流动",
					api: "openai-completions",
					baseURL: "https://api.siliconflow.cn/v1",
					models: [
						{ id: "Qwen/Qwen3-8B", name: "硅基流动 Qwen3-8B（永久免费）", input: ["text"], contextWindow: 128000, maxTokens: 8192 }
					]
				},
				{
					type: "xinghuo",
					title: "讯飞",
					shortName: "讯飞",
					desc: "讯飞星火 Spark Lite",
					keysLabel: "讯飞星火控制台获取 API Key ↗",
					keysUrl: "https://console.xfyun.cn/services/bm35",
					keyPlaceholder: "粘贴你的讯飞星火 API Key",
					credentialRef: "XINGHUO_API_KEY",
					displayName: "讯飞星火",
					api: "openai-completions",
					baseURL: "https://spark-api-open.xf-yun.com/v1",
					models: [
						{ id: "spark-lite", name: "讯飞星火 Lite（永久免费）", input: ["text"], contextWindow: 8000, maxTokens: 2048 }
					]
				}
			],
			// 已下线/失效模型清单（远程热更）：曾经可配置、现已停止服务支持的 provider。
			// 若用户的本地配置中仍残留对应 provider，② 配置中心会渲染「失效残留」
			// 清理区，提供一键卸载，避免出现既无法使用又无法删除的孤儿配置。
			retired: [
				{
					type: "openrouter",
					title: "OpenRouter Ox-Alpha",
					reason: "该免费模型已失效（官方 404 下线），不再支持一键配置；若你此前已接入，建议一键清理其配置与密钥。"
				}
			]
		};

		// ---------- remote payload filter (filterRemotePayload) ----------
		// v1.5.0 安检：远程 help.json 是热更通道（模型清单/下线清单/文案均
		// 由它驱动），一旦托管仓库被攻破，恶意数据会直达 UI 渲染与
		// settings.mutate 落库。这里在入口统一过滤：
		//   - 所有 URL 强制 https:（堵 javascript:/http: 钓鱼与降级）
		//   - 展示文本拒绝换行/制表/替换符/尖括号并限长（堵注入与排版破坏）
		//   - 模型 id、credentialRef 等结构字段走字符白名单（它们最终会进
		//     官方通道写配置，是最敏感入口）
		//   - 不合格条目丢弃，数组整体为空时回落内置数据
		function remoteIsSafeUrl(u) {
			if (typeof u !== "string" || u.length > 300) return false;
			try { return new URL(u).protocol === "https:"; } catch (e) { return false; }
		}
		function remoteSafeText(v, max) {
			return typeof v === "string" && v.length <= max && !/[\r\n\t\uFFFD<>]/.test(v);
		}
		function remoteSafeModelId(v) {
			// 允许斜杠与冒号：OpenRouter 命名规范为 vendor/model 与 :free 后缀。
			return typeof v === "string" && /^[A-Za-z0-9_.\-/:]{1,64}$/.test(v);
		}
		function remoteSafeCredentialRef(v) {
			return typeof v === "string" && /^[A-Z][A-Z0-9_]{1,63}$/.test(v);
		}
		function remoteFilterLink(l) {
			return l && remoteSafeText(l.title, 80) && remoteIsSafeUrl(l.url)
				? { title: l.title, url: l.url, badge: !!l.badge }
				: null;
		}
		const REMOTE_MODALITIES = ["text", "image", "audio", "video"];
		// v1.6.0：OpenRouter 类卡片携带路由级字段（api/baseURL/compat/
		// displayName），全部走枚举白名单——api 限定 DSH llm-pi-ai 合法协议、
		// baseURL 强制 https、compat 只认 thinkingFormat 枚举，不放宽既有规则。
		const REMOTE_API_PROTOCOLS = ["openai-completions", "openai-responses", "anthropic-messages"];
		const REMOTE_THINKING_FORMATS = ["openai", "deepseek", "openrouter", "together", "zai", "qwen", "string-thinking", "ant-ling"];
		function remoteFilterModel(m) {
			if (!m || !remoteSafeModelId(m.id) || !remoteSafeText(m.name, 80)) return null;
			const input = Array.isArray(m.input) ? m.input.filter((x) => REMOTE_MODALITIES.indexOf(x) >= 0) : [];
			if (!input.length) return null;
			const out = { id: m.id, name: m.name, input: input };
			if (m.contextWindow !== undefined) {
				if (typeof m.contextWindow !== "number" || !Number.isInteger(m.contextWindow) || m.contextWindow < 1 || m.contextWindow > 10000000) return null;
				out.contextWindow = m.contextWindow;
			}
			if (m.maxTokens !== undefined) {
				if (typeof m.maxTokens !== "number" || !Number.isInteger(m.maxTokens) || m.maxTokens < 1 || m.maxTokens > 1000000) return null;
				out.maxTokens = m.maxTokens;
			}
			return out;
		}
		function remoteFilterFreeModel(it) {
			if (!it || typeof it.type !== "string" || !/^[a-z][a-z0-9-]{0,31}$/.test(it.type)) return null;
			if (it.credentialRef !== undefined && !remoteSafeCredentialRef(it.credentialRef)) return null;
			if (it.keyPrefix !== undefined && !(typeof it.keyPrefix === "string" && it.keyPrefix.length <= 32 && !/[\s]/.test(it.keyPrefix))) return null;
			if (it.displayName !== undefined && !remoteSafeText(it.displayName, 40)) return null;
			if (it.api !== undefined && REMOTE_API_PROTOCOLS.indexOf(it.api) < 0) return null;
			if (it.baseURL !== undefined && !remoteIsSafeUrl(it.baseURL)) return null;
			if (it.compat !== undefined) {
				const c = it.compat;
				if (!c || typeof c !== "object" || Array.isArray(c)) return null;
				const keys = Object.keys(c);
				if (keys.indexOf("thinkingFormat") < 0) return null;
				for (const k of keys) {
					if (k !== "thinkingFormat") return null;
					if (REMOTE_THINKING_FORMATS.indexOf(c[k]) < 0) return null;
				}
			}
			if (it.models !== undefined) {
				if (!Array.isArray(it.models)) return null;
				const models = it.models.map(remoteFilterModel).filter(Boolean);
				if (!models.length) return null;
				it = { ...it, models: models };
			}
			if (it.keysUrl !== undefined && !remoteIsSafeUrl(it.keysUrl)) return null;
			return it;
		}
		function remoteFilterRetired(r) {
			return r && typeof r.type === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(r.type) && remoteSafeText(r.title, 60) && remoteSafeText(r.reason, 160)
				? { type: r.type, title: r.title, reason: r.reason }
				: null;
		}
		function filterRemotePayload(j) {
			const out = {};
			out.version = remoteSafeText(j.version, 40) ? j.version : DEFAULT_HELP.version;
			out.updatedAt = remoteSafeText(j.updatedAt, 40) ? j.updatedAt : DEFAULT_HELP.updatedAt;
			const links = (arr) => (Array.isArray(arr) ? arr.map(remoteFilterLink).filter(Boolean) : []);
			out.official = links(j.official);
			out.selected = links(j.selected);
			if (!out.official.length) out.official = DEFAULT_HELP.official;
			if (!out.selected.length) out.selected = DEFAULT_HELP.selected;
			// v1.8.2: freeModels 合并——以内置同 type 条目为基底（保住 api/baseURL/models/credentialRef 等配置字段），
			// 远程的 title/shortName/desc/keysLabel/keysUrl/keyPlaceholder 覆盖其上（热更新显示文案）。
			// 这样无论远程 help.json 是否加载成功、加载前后渲染都一致，不再出现"内置旧版→远程新版"的内容闪变（双弹窗）。
			out.freeModels = Array.isArray(j.freeModels)
				? j.freeModels.map(remoteFilterFreeModel).filter(Boolean).map((rm) => {
						const base = (DEFAULT_HELP.freeModels || []).find((dm) => dm && dm.type === rm.type) || {};
						return { ...base, ...rm };
				  })
				: [];
			if (!out.freeModels.length) out.freeModels = DEFAULT_HELP.freeModels;
			out.retired = Array.isArray(j.retired) ? j.retired.map(remoteFilterRetired).filter(Boolean) : [];
			return out;
		}

		function useHelpData() {
			const [data, setData] = _react.useState(DEFAULT_HELP);
			const [source, setSource] = _react.useState("local");
			_react.useEffect(() => {
				let alive = true;
				fetchWithTimeout(HELP_URL, 6000)
					.then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
					.then((j) => {
						if (!alive || !j || typeof j !== "object") return;
						// 远程数据一律过 filterRemotePayload 安检再进 UI/配置链。
						const merged = filterRemotePayload(j);
						setData(merged);
						setSource("remote");
					})
					.catch(() => {
						if (alive) setSource("local");
					});
				return () => {
					alive = false;
				};
			}, []);
			return { data, source };
		}

		// 链接已读/未读：localStorage 记录，已读置灰。
		function useReadLinks() {
			const [read, setRead] = _react.useState(() => {
				try {
					const raw = localStorage.getItem("dsh-0-tools:read-links");
					return raw ? JSON.parse(raw) : {};
				} catch (e) {
					return {};
				}
			});
			const markRead = (url) => {
				const next = { ...read, [url]: true };
				setRead(next);
				try {
					localStorage.setItem("dsh-0-tools:read-links", JSON.stringify(next));
				} catch (e) {
					/* ignore */
				}
			};
			return { read, markRead };
		}

		// 绿色 New 标记（置顶热门条目专用）。
		function NewBadge() {
			return (0, react_jsx_runtime.jsx)("span", {
				style: { display: "inline-block", marginLeft: "6px", padding: "1px 6px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, lineHeight: "16px", color: "#fff", background: "#30a46c", verticalAlign: "middle" },
				children: "New"
			});
		}

		// 配置中心单个免费模型条目：可展开/收拢的文字链接，行内带已接入状态与 New 标记。


		// 远程已下线/失效 provider 的残留清理区（3b）：仅当本地仍配置了 retired
		// 中某个 provider（status[key] 为真）时渲染。复用 FreeInstalledZone 的
		// 二段确认卸载交互，item 仅需 type/title 两字段即可驱动一键卸载。
		function RetiredResidueZone(props) {
			const { retired, status, refresh } = props;
			const list = (retired || []).filter((r) => !!status[r.type]);
			if (!list.length) return null;
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "10px", background: "#fff6f6", border: "1px solid #f0c4c4", borderRadius: "10px", padding: "12px" },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						style: { fontSize: "13px", fontWeight: 600, color: "#e5484d" },
						children: "已下线模型 · 失效残留"
					}),
					list.map((r) => (0, react_jsx_runtime.jsxs)("div", {
						style: { display: "flex", flexDirection: "column", gap: "6px" },
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								style: { fontSize: "12px", lineHeight: "18px", color: "#9c3b3f" },
								children: r.title + "：" + r.reason
							}),
							(0, react_jsx_runtime.jsx)(FreeInstalledZone, { item: { type: r.type, title: r.title }, onDone: refresh })
						]
					}, "retired-" + r.type))
				]
			});
		}

		// ② 零费用·API配置中心：理念介绍 + 全部免费模型条目（由远程 freeModels
		// 驱动，新增模型零发版）+ 已下线模型失效残留清理区（由远程 retired 驱动）。
		function FreeConfigCenter(props) {
			const { items, retired, status, refresh } = props;
			const list = items || [];
			const totalCount = list.length;
			const installedCount = list.filter((m) => status[m.type]).length;
			// v1.8.2: 大粘贴框「自动识别 API Key 一键安装」状态
			const [pasteKey, setPasteKey] = _react.useState("");
			const [pasteMsg, setPasteMsg] = _react.useState("");
			const [pasting, setPasting] = _react.useState(false);

			// v1.8.3: 从教程页跳转过来时自动填充 Key（localStorage 传递）
			_react.useEffect(() => {
				try {
					const saved = localStorage.getItem("dsh-0-tools:autofill-key");
					if (saved && saved.length >= 16) {
						setPasteKey(saved);
						setPasteMsg("✅ 已从教程页自动填入 API Key，请点击下方按钮安装");
						localStorage.removeItem("dsh-0-tools:autofill-key");
						setTimeout(() => setPasteMsg(""), 5000);
					}
				} catch (e) { /* ignore */ }
			}, []);
			// v1.8.2: 模型卡片「一键卸载」二次确认状态
			const [uninstallTarget, setUninstallTarget] = _react.useState(null);
			const [uninstallBusy, setUninstallBusy] = _react.useState(false);
			// v1.8.2: 粘贴框一键识别安装
			const handlePasteInstall = () => {
				const raw = (pasteKey || "").trim();
				if (!raw || raw.length < 16 || raw.length > 200) {
					setPasteMsg("⚠️ 请先在输入框粘贴有效的 API Key（长度需 16-200 字符）");
					setTimeout(() => setPasteMsg(""), 4000);
					return;
				}
				const matchedType = identifyKeyModel(raw);
				if (!matchedType) {
					setPasteMsg("⚠️ 无法识别这个 API Key 属于哪个模型，请检查是否复制正确");
					setTimeout(() => setPasteMsg(""), 4000);
					return;
				}
				if (status && status[matchedType]) {
					setPasteMsg("ℹ️ 该模型已配置过了，无需重复配置");
					setTimeout(() => setPasteMsg(""), 4000);
					return;
				}
				setPasting(true);
				setPasteMsg("");
				doAutoInstall(matchedType, raw, list)
					.then((r) => {
						setPasting(false);
						setPasteMsg("✅ 已自动配置「" + r.modelName + "」，已接入 " + (installedCount + 1) + "/" + r.modelCount + " 个免费模型");
						setTimeout(() => setPasteMsg(""), 5000);
						setTimeout(() => refresh(), 300);
					})
					.catch((e) => {
						setPasting(false);
						setPasteMsg("⚠️ 配置失败：" + String((e && e.message) || e));
						setTimeout(() => setPasteMsg(""), 5000);
					});
			};

			// v1.8.2: 模型卡片一键卸载（二次确认）
			const handleCardUninstall = (m) => {
				if (uninstallTarget !== m.type) {
					setUninstallTarget(m.type);
					return;
				}
				setUninstallBusy(true);
				uninstallProvider(m.type)
					.then(() => {
						setUninstallBusy(false);
						setUninstallTarget(null);
						setTimeout(() => refresh(), 300);
					})
					.catch(() => {
						setUninstallBusy(false);
						setUninstallTarget(null);
					});
			};

			// 模型显示名映射：优先用短名（智谱/硅基流动/OpenRouter/讯飞），无短名时回退 title
			const getModelName = (item) => {
				if (item.shortName) return item.shortName;
				if (item.title) {
					return item.title.replace(/（.*$/g, "").replace(/一键配置.*/g, "").trim();
				}
				return item.type;
			};

			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "12px" },
				children: [
					// 一键配置免费模型 区块（对照手绘稿2：标题+完整说明+卡片+粘贴框+大按钮）
					(0, react_jsx_runtime.jsxs)("div", {
						style: { background: installedCount >= totalCount && totalCount > 0 ? "#f0fdf4" : "#f7f9fc", border: "1px solid " + (installedCount >= totalCount && totalCount > 0 ? "#bbf7d0" : "#e3e8ef"), borderRadius: "10px", padding: "12px" },
						children: [
							// 子标题：一键配置免费模型 [已配置X/N个免费模型]
							(0, react_jsx_runtime.jsxs)("div", {
								style: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "6px" },
								children: [
									(0, react_jsx_runtime.jsx)("span", { style: { fontSize: "14px", fontWeight: 700, color: "#111" }, children: "一键配置免费模型" }),
									(0, react_jsx_runtime.jsx)("span", {
										style: {
											display: "inline-block", padding: "1px 8px", borderRadius: "10px", fontSize: "12px", fontWeight: 600,
											color: installedCount >= totalCount && totalCount > 0 ? "#2e7d32" : "#6b7280",
											background: installedCount >= totalCount && totalCount > 0 ? "#f0fdf4" : "#f2f3f5"
										},
										children: "[已配置 " + installedCount + "/" + totalCount + " 个免费模型]"
									})
								]
							}),
							// 完整说明文案（截图3原文）
							(0, react_jsx_runtime.jsx)("div", {
								style: { fontSize: "12px", color: "#555", lineHeight: "1.6" },
								children: "建议配齐以下所有免费模型，免费模型数越多，切换选择更多！点击以下模型卡片「引导教程」，跟着一步步注册复制 API Key，并粘贴在「在此处粘贴任意模型 API Key 都将自动识别」框内，点击「自动识别 API Key 一键安装免费大模型」将自动安装免费模型。"
							}),
							// 模型卡片网格（复选框样式 + 一键卸载二次确认 / 引导教程）
							(0, react_jsx_runtime.jsx)("div", {
								style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "10px" },
								children: list.map((m) => {
									const isConfigured = !!status[m.type];
									const confirming = uninstallTarget === m.type;
									const guideHref = guideUrl(m.type);
									return (0, react_jsx_runtime.jsxs)("div", {
										key: m.type,
										style: {
											display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between",
											padding: "9px 12px", borderRadius: "8px",
											background: isConfigured ? "#f1f8f2" : "#fafbfc",
											border: "1px solid " + (isConfigured ? "#c8e6c9" : "#e0e0e8"),
											transition: "all 0.15s"
										},
										children: [
											(0, react_jsx_runtime.jsxs)("span", { style: { display: "flex", alignItems: "center", gap: "7px", fontSize: "13px" }, children: [
												(0, react_jsx_runtime.jsx)("span", {
													style: {
														width: "16px", height: "16px", borderRadius: "4px", flex: "none",
														display: "inline-flex", alignItems: "center", justifyContent: "center",
														boxSizing: "border-box",
														background: isConfigured ? "#2e7d32" : "#fff",
														border: "2px solid " + (isConfigured ? "#2e7d32" : "#7c6ff0"),
														fontSize: "11px", lineHeight: "1", color: "#fff", fontWeight: 700
													},
													children: isConfigured ? "\u2713" : ""
												}),
												(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 700, color: "#333" }, children: getModelName(m) })
											]}),
											isConfigured
												? (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													disabled: uninstallBusy,
													onClick: () => handleCardUninstall(m),
													style: {
														border: "none", borderRadius: "14px", padding: "4px 11px", fontSize: "12px", fontWeight: 600,
														color: confirming ? "#fff" : "#e5484d", background: confirming ? "#e5484d" : "#fff6f6",
														cursor: "pointer", flex: "none", border: confirming ? "none" : "1px solid #f0c4c4"
													},
													children: confirming ? "再次点击确认卸载" : "一键卸载模型"
												})
												: (0, react_jsx_runtime.jsx)("a", {
													href: guideHref, target: "_blank", rel: "noreferrer",
													style: { fontSize: "12px", color: "#2563eb", fontWeight: 600, textDecoration: "none", cursor: "pointer", flex: "none" },
													children: "引导教程 →"
												})
										]
									});
								})
							}),
							// 大粘贴框
							(0, react_jsx_runtime.jsx)("input", {
								type: "text",
								style: {
									boxSizing: "border-box", width: "100%",
									padding: "11px 14px", fontSize: "13px",
									borderRadius: "10px", border: "1px solid #2563eb",
									textAlign: "center", marginTop: "10px",
									lineHeight: "20px", color: "#111"
								},
								placeholder: "在此处粘贴任意模型 API Key 都将自动识别",
								value: pasteKey,
								onChange: (e) => setPasteKey(e.target.value)
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: handlePasteInstall,
								disabled: pasting,
								style: {
									...BTN_PRIMARY, width: "100%",
									padding: "12px", fontSize: "14px",
									borderRadius: "10px", marginTop: "8px",
									opacity: pasting ? 0.6 : 1,
									cursor: pasting ? "wait" : "pointer"
								},
								children: pasting ? "正在自动识别并安装…" : "自动识别 API Key 一键安装免费大模型"
							}),
							pasteMsg ? (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: "12px", textAlign: "center", lineHeight: "1.5", marginTop: "4px",
									color: pasteMsg.indexOf("✅") === 0 ? "#30a46c" : (pasteMsg.indexOf("ℹ️") === 0 || pasteMsg.indexOf("⚠️") === 0 ? "#f5a623" : "#e5484d")
								},
								children: pasteMsg
							}) : null,

						]
					}),
					(0, react_jsx_runtime.jsx)(RetiredResidueZone, { retired: retired, status: status, refresh: refresh })
				]});
		}

		// ---------- footer buttons ----------
		// 三个插件按钮（帮助 / 配置免费模型 / 计价提醒条）统一对齐 DSH 自带「设置」按钮：
		// 同一 FOOT_SETTING 基础规格（宽 calc(100%+4px)、高42px、圆角12px、字号14px/22px、
		// padding 0 10px 0 8px、gap 8px），hover 深灰底 var(--dsw-alias-interactive-bg-hover)，
		// 前置 16px 图标（stroke=currentColor 跟随主题）；折叠态隐藏文字只留图标（对齐设置按钮 rail 态）。
		const FOOT_SETTING = {
			boxSizing: "border-box",
			cursor: "pointer",
			width: "calc(100% + 4px)",
			height: "42px",
			color: "var(--dsw-alias-label-primary)",
			background: "transparent",
			border: "none",
			borderRadius: "12px",
			flex: "none",
			alignItems: "center",
			gap: "8px",
			margin: "4px -2px",
			padding: "0 10px 0 8px",
			fontFamily: "inherit",
			fontSize: "14px",
			lineHeight: "22px",
			display: "flex",
			overflow: "hidden",
			whiteSpace: "nowrap"
		};
		// 三〇叠码图标（帮助，16px 同齿轮）。
		const TRI_CIRCLE_SVG = [
			'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">',
			'<circle cx="6.5" cy="16" r="5.5"/>',
			'<circle cx="17.5" cy="16" r="5.5"/>',
			'<circle cx="12" cy="7.5" r="5.5"/>',
			'</svg>'
		].join("");
		// 钥匙图标（配置免费模型：配 API Key）。
		const KEY_SVG = [
			'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
			'<circle cx="7.5" cy="15.5" r="4.5"/>',
			'<path d="M10.8 12.2 20 3M15 8l3 3M18 5l2 2"/>',
			'</svg>'
		].join("");
		// 计价提醒表盘图标（随时段变化）：高峰=红色指向十点整（🕙），空闲=绿色指向七点整（🕖）。
		// 外圈圆 + 分针（12点方向）+ 时针；颜色硬编码，侧边栏折叠态仍按时段显示颜色。
		const PEAK_CLOCK_SVG = [
			'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e5484d" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">',
			'<circle cx="12" cy="12" r="9"/>',
			'<path d="M12 12 12 4.5"/>',
			'<path d="M12 12 7.24 9.25"/>',
			'</svg>'
		].join("");
		const OFFPEAK_CLOCK_SVG = [
			'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#30a46c" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">',
			'<circle cx="12" cy="12" r="9"/>',
			'<path d="M12 12 12 4.5"/>',
			'<path d="M12 12 9.25 16.76"/>',
			'</svg>'
		].join("");

		// 折叠适配 hook：跟随 DSH 侧边栏折叠态。
		// 信号来源：①DSH 折叠时会给「设置」按钮加 rail class（VOzbGW_rail，纯图标态）；
		// ②footerActions 祖先链上出现含 collapsed 的 class。任一生效即视为已折叠。
		function useSidebarCollapsed() {
			const [collapsed, setCollapsed] = _react.useState(false);
			_react.useEffect(() => {
				const detect = () => {
					const triggers = document.querySelectorAll('button[class*="_trigger"]');
					for (const t of triggers) {
						if ((t.className || "").indexOf("rail") >= 0) return true;
					}
					const fa = document.querySelector('[class*="footerActions"]');
					if (fa) {
						let el = fa.parentElement;
						while (el && el !== document.body) {
							if (el.className && typeof el.className === "string" && el.className.indexOf("collapsed") >= 0) return true;
							el = el.parentElement;
						}
					}
					return false;
				};
				setCollapsed(detect());
				const mo = new MutationObserver(() => setCollapsed(detect()));
				mo.observe(document.body, { attributes: true, childList: true, subtree: true, attributeFilter: ["class"] });
				return () => mo.disconnect();
			}, []);
			return collapsed;
		}

		// 通用页脚行按钮：图标 + 可选文字，整宽对齐设置按钮；折叠态变 36×36 纯图标。
		function FooterRowButton(props) {
			const [hovered, setHovered] = _react.useState(false);
			const { icon, label, title, onClick, collapsed } = props;
			return (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				style: {
					...FOOT_SETTING,
					...(collapsed ? { width: "36px", height: "36px", margin: "4px auto", padding: "0", justifyContent: "center" } : {}),
					background: hovered ? "var(--dsw-alias-interactive-bg-hover)" : "transparent"
				},
				title: title || label,
				onClick,
				onMouseEnter: () => setHovered(true),
				onMouseLeave: () => setHovered(false),
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						style: { display: "inline-flex", flex: "none", color: "currentColor" },
						dangerouslySetInnerHTML: { __html: icon }
					}),
					collapsed ? null : (0, react_jsx_runtime.jsx)("span", { children: label })
				]
			});
		}

		function PricingBadge(props) {
			const [peak, setPeak] = _react.useState(true);
			_react.useEffect(() => {
				// DeepSeek 峰谷按北京时间计价，本机时区不等于北京时区时
				// （出国/时区设置异常），旧实现会给出错误的峰谷提示。
				// v1.5.0 起固定按 Asia/Shanghai 取小时与星期。
				const beijingParts = () => {
					const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hour: "numeric", weekday: "short", hour12: false });
					const parts = {};
					for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
					return { h: parseInt(parts.hour, 10) % 24, dow: parts.weekday };
				};
				const update = () => {
					const { h, dow } = beijingParts();
					// 2026-08-23 起生效的官方规则：周末（周六/周日）全天统一低谷价，不再区分峰谷；
					// 仅工作日（周一至周五）执行峰谷分段计费。
					const isWeekend = dow === "Sat" || dow === "Sun";
					setPeak(!isWeekend && ((h >= 9 && h < 12) || (h >= 14 && h < 18)));
				};
				update();
				const timer = setInterval(update, 60000);
				return () => clearInterval(timer);
			}, []);
			const collapsed = useSidebarCollapsed();
			const text = peak ? "当前高峰时段API为原价" : "当前空闲时段API为半价";
			const title = peak
				? "当前为DeepSeek高峰时段，API费用按原价计，点击查看官方说明。"
				: "当前为DeepSeek空闲时段，API费用按半价计，点击查看官方说明。";
			return (0, react_jsx_runtime.jsx)(FooterRowButton, {
				icon: peak ? PEAK_CLOCK_SVG : OFFPEAK_CLOCK_SVG,
				label: text,
				title,
				onClick: () => openExternal(PRICING_URL),
				collapsed
			});
		}



		function HelpButton() {
			const collapsed = useSidebarCollapsed();
			return (0, react_jsx_runtime.jsx)(FooterRowButton, {
				icon: TRI_CIRCLE_SVG,
				label: "帮助",
				title: "打开小白帮助中心",
				onClick: openSettingsZeroTools,
				collapsed
			});
		}

		// ---------- settings nav icon patch ----------
		// DSH's SettingsRoot.navIcon(id) only maps models / agent-presets / plugins
		// to dedicated glyphs; every other section id falls back to the settings
		// gear (same as "通用设置"). There is no registration-level icon hook, so
		// we patch the rendered nav DOM instead: find our section's nav cell by its
		// label text and swap the gear out for the 「零号工具」三〇叠码 SVG mark. Self-contained in
		// the plugin, survives DSH upgrades (it degrades to the gear if the DOM
		// layout ever changes).
		const SECTION_NAV_NAMES = ["零号工具"];
		let _navIconPatchInstalled = false;

		function installSettingsNavIconPatch() {
			if (_navIconPatchInstalled) return;
			_navIconPatchInstalled = true;
			const patch = () => {
				const labels = document.querySelectorAll('[class*="navLabel"]');
				for (const el of labels) {
					const text = (el.textContent || "").trim();
					if (!SECTION_NAV_NAMES.includes(text)) continue;
					const cell = el.closest('[class*="navCell"]');
					if (!cell) continue;
					// idempotent guard: skip if a navicon has already been installed in this cell
					if (cell.querySelector("[data-dsh-0-tools-navicon]")) continue;
					const icon = cell.querySelector('[class*="navIcon"]');
					if (!icon) continue;
					icon.style.display = "none";
					const rep = document.createElement("span");
					rep.setAttribute("data-dsh-0-tools-navicon", "1");
					rep.setAttribute(UI_MARKER, "1");
					rep.style.display = "inline-flex";
					rep.style.flex = "none";
					rep.style.color = "currentColor";
					rep.innerHTML = ['<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">', '<circle cx="6.5" cy="16" r="5.5"/>', '<circle cx="17.5" cy="16" r="5.5"/>', '<circle cx="12" cy="7.5" r="5.5"/>', '</svg>'].join("");
					icon.after(rep);
				}
			};
			patch();
			// v1.5.0：rAF 节流 + 幂等短路。聊天流式输出等场景会高频触发
			// MutationObserver，此前每次变动都全量 querySelectorAll；现在
			// 每帧至多跑一次，且图标已就位时 patch 内部 O(1) 短路退出。
			let scheduled = false;
			const mo = new MutationObserver(() => {
				if (scheduled) return;
				scheduled = true;
				requestAnimationFrame(() => {
					scheduled = false;
					patch();
				});
			});
			mo.observe(document.body, { childList: true, subtree: true });
		}

		// ---------- settings tab: 零号工具 ----------
		// 排版对齐 DSH Agent 预设灰阶：卡片标题 15px/600/#0F1115；正文 13px/400/#61666B；
		// 分组小标题 12px/600/#81858C；卡片边框 0.8px rgba(0,0,0,0.1) 圆角12px。
		const SECTION_WRAP = { display: "flex", flexDirection: "column", gap: "14px", maxWidth: "680px" };
		const CARD = { border: "0.8px solid rgba(0,0,0,0.1)", borderRadius: "12px", padding: "14px 16px", background: "#fff" };
		const CARD_TITLE = { fontSize: "15px", fontWeight: 600, lineHeight: "21px", color: "#0F1115", marginBottom: "8px" };
		const CARD_TEXT = { fontSize: "13px", lineHeight: "20.15px", color: "#61666B" };
		const CARD_SUB = { fontSize: "12px", fontWeight: 600, letterSpacing: "0.72px", color: "#81858C" };
		const HL = { fontWeight: 600, color: "#0F1115", background: "#f2f3f5", padding: "2px 6px", borderRadius: "6px" };

		// ---------- v1.8.0修复: 恢复被误删的帮助中心组件 ----------
		function HelpLinkList(props) {
			return (0, react_jsx_runtime.jsx)("div", {
				style: { display: "flex", flexDirection: "column", gap: "8px" },
				children: props.items.map((l) => {
					return (0, react_jsx_runtime.jsxs)("div", {
						children: [
							(0, react_jsx_runtime.jsx)("a", {
								href: l.url,
								target: "_blank",
								rel: "noreferrer",
								onClick: () => props.markRead(l.url),
								style: props.read[l.url]
									? { color: "#9a9fa6", textDecoration: "none" }
									: { color: "#3a3d42", textDecoration: "underline" },
								children: "• " + l.title
							}, l.url),
							l.badge ? (0, react_jsx_runtime.jsx)(NewBadge, {}) : null
						]
					}, "link-" + l.title);
				})
			});
		}

		// 帮助内容：官方资料 / 精选资料 标签页切换
		const TAB_BTN_BASE = {
			border: "none",
			background: "transparent",
			cursor: "pointer",
			fontSize: "13px",
			fontWeight: 600,
			lineHeight: "21px",
			padding: "5px 12px",
			borderRadius: "8px",
			color: "#81858C",
			fontFamily: "inherit"
		};

		function HelpContent() {
			const { data, source } = useHelpData();
			const { read, markRead } = useReadLinks();
			const [tab, setTab] = _react.useState("selected");
			const items = tab === "selected" ? data.selected : data.official;
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "10px" },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						style: { fontSize: "12px" },
						children: [
							(0, react_jsx_runtime.jsxs)("span", {
								style: { color: "#2D6CDF" },
								children: "当前零号工具版本：v" + PLUGIN_VERSION
							}),
							(0, react_jsx_runtime.jsx)("span", {
								style: { color: "#81858C" },
								children: "　·　帮助内容版本 " + data.version + "（" + (source === "remote" ? "已同步最新" : "离线内置") + "）"
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						style: { display: "flex", gap: "4px" },
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: { ...TAB_BTN_BASE, color: tab === "selected" ? "#0F1115" : "#81858C", background: tab === "selected" ? "#f2f3f5" : "transparent" },
								onClick: () => setTab("selected"),
								children: "精选资料"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: { ...TAB_BTN_BASE, color: tab === "official" ? "#0F1115" : "#81858C", background: tab === "official" ? "#f2f3f5" : "transparent" },
								onClick: () => setTab("official"),
								children: "官方资料"
							})
						]
					}),
					(0, react_jsx_runtime.jsx)(HelpLinkList, { items: items, read: read, markRead: markRead })
				]
			});
		}

		function SettingsSection(props) {
			const { health } = props;
			const { status, loaded, refresh } = useConfigured();
			const { data } = useHelpData();
			return (0, react_jsx_runtime.jsxs)("div", {
				style: SECTION_WRAP,
				children: [
					// ① 零费用·免费模型管家中心（v1.8.0：智能路由+健康监测）
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2460 零费用·免费模型管家中心" }),
							(0, react_jsx_runtime.jsx)("div", {
								style: { fontSize: "12px", color: "#81858C", lineHeight: "1.6", marginBottom: "10px" },
								children: "为什么推荐免费模型？DeepSeek 官方 API 没有永久免费模型，需充值才能用；零号工具不仅接入了多款免费模型，还将自动测模型状态，帮你切换最快模型。"
							}),
							(0, react_jsx_runtime.jsx)(FreeConfigCenter, { items: data.freeModels, retired: data.retired, status: status, refresh: refresh, health: health })
						]
					}),
					// ② 零门槛·小白帮助中心
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2461 零门槛·小白帮助中心" }),
							(0, react_jsx_runtime.jsx)(HelpContent, {})
						]
					}),
					// ③ 零失控·费用管控中心
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2462 零失控·费用管控中心" }),
							(0, react_jsx_runtime.jsx)("div", {
								style: CARD_TEXT,
								children: "DeepSeek 官方按时段计费：工作日高峰时段（9-12 点、14-18 点）原价，其余空闲时段半价；周末全天按低谷价计费。选中 DeepSeek 模型时，左下角会实时提示当前是高峰还是空闲、原价还是半价，拒绝失控。"
							}),
							(0, react_jsx_runtime.jsx)("a", {
								href: PRICING_URL,
								target: "_blank",
								rel: "noreferrer",
								style: { color: "#3a3d42", display: "inline-block", marginTop: "6px", fontSize: "13px", textDecoration: "underline" },
								children: "查看 DeepSeek API 官方资费说明 \u2192"
							})
						]
					})
				]
			});
		}

		// ---------- footer assembly (left to right) ----------
		function FooterActions(props) {
			const { wide, health, currentProvider, onOpenOnboarding, onSwitch, freeModelTypes } = props;
			const { loaded, hasAnyInstalled, status } = useConfigured();
			const pricingState = useModelPricingState();
			const collapsed = useSidebarCollapsed();
			// v1.8.0: 只要还有免费模型未配置就显示"🔑 配置免费模型"小入口（点击弹引导弹窗）
			// 修正：不再用 hasAnyInstalled（它含DeepSeek官方等非免费模型），改用免费模型配置情况判断
			const anyFreeConfigured = freeModelTypes.some((t) => status[t]);
			const showConfigEntry = loaded ? !anyFreeConfigured : false;
			// 已配置免费模型且当前默认是免费模型时显示模型状态指示器
			// v1.8.0修正：从 freeModelTypes 动态判断
			const isFreeModel = currentProvider && freeModelTypes && freeModelTypes.indexOf(currentProvider) >= 0;
			const showModelStatus = hasAnyInstalled && isFreeModel && health;
			return (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: collapsed ? "center" : "flex-start",
					flexDirection: collapsed ? "column" : "row",
					gap: collapsed ? "2px" : "0",
					flexWrap: "wrap",
					marginBottom: "-4px",
					width: "100%"
				},
				children: [
					showConfigEntry ? (0, react_jsx_runtime.jsx)(FooterRowButton, {
						icon: KEY_SVG,
						label: "配置免费模型",
						title: "在「① 零费用·免费模型管家中心」一键接入免费模型",
						onClick: onOpenOnboarding,
						collapsed: collapsed
					}) : null,
					showModelStatus ? (0, react_jsx_runtime.jsx)(ModelStatusIndicator, {
						health: health,
						currentProvider: currentProvider,
						onSwitch: onSwitch,
						freeModelTypes: freeModelTypes
					}) : null,
					pricingState === "deepseek" ? (0, react_jsx_runtime.jsx)(PricingBadge, { wide: wide }) : null
				]
			});
		}

		// ---------- plugin entry ----------
		// v1.8.0: FooterActions 包装组件——管理健康监测、当前模型、引导弹窗状态
		function FooterActionsWrapper(props) {
			const health = useHealthMonitor();
			const { loaded, hasAnyInstalled, status: configuredStatus, refresh } = useConfigured();
			const { data: helpData } = useHelpData();
			// v1.8.0修正：从 freeModels 动态获取免费模型类型列表，不硬编码
			const freeModelTypes = (helpData && helpData.freeModels) ? helpData.freeModels.map((m) => m.type) : [];
			const [currentProvider, setCurrentProvider] = _react.useState(null);
			const [showOnboarding, setShowOnboarding] = _react.useState(false);
			const [onboardingShown, setOnboardingShown] = _react.useState(false);
			// v1.8.3: 粘贴框安装状态（剪贴板自动嗅探已废弃，统一用大粘贴框+大按钮）
			const [configuring, setConfiguring] = _react.useState(false);
			const [configMsg, setConfigMsg] = _react.useState("");

			// 获取当前默认模型 provider
			_react.useEffect(() => {
				const fetchCurrent = () => {
					getCurrentDefaultModel().then((m) => {
						setCurrentProvider(m ? m.provider : null);
					}).catch(() => {});
				};
				fetchCurrent();
				const timer = setInterval(fetchCurrent, 5000);
				return () => clearInterval(timer);
			}, []);

			// 首次启动自动弹引导弹窗（未配置免费模型时；用户点过「以后不再提醒」则静默）
			_react.useEffect(() => {
				if (loaded && !hasAnyInstalled && !onboardingShown) {
					let dismissed = false;
					try { dismissed = localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1"; } catch (e) { /* ignore */ }
					if (!dismissed) {
						setShowOnboarding(true);
						setOnboardingShown(true);
					}
				}
			}, [loaded, hasAnyInstalled, onboardingShown]);


			// v1.8.3: 检测 URL 参数 autofill（从教程页跳转过来时自动填充 Key 并打开设置页）
			_react.useEffect(() => {
				try {
					const url = new URL(window.location.href);
					const autofill = url.searchParams.get("autofill");
					if (autofill && autofill.length >= 16 && autofill.length <= 500) {
						// 写入 localStorage，FreeConfigCenter 读取后自动填充
						localStorage.setItem("dsh-0-tools:autofill-key", autofill);
						// 清除 URL 参数（避免刷新时重复触发）
						url.searchParams.delete("autofill");
						window.history.replaceState({}, "", url.toString());
						// 延迟打开设置页（等 DSH 渲染完成）
						setTimeout(() => {
							openSettingsZeroTools();
						}, 500);
					}
				} catch (e) { /* ignore */ }
			}, []);

			// 设置弹窗监听：每次打开设置弹窗时自动导航到「零号工具」标签（v1.8.3修复：
			// 原逻辑用持久 class 标记"已导航"，导致设置弹窗关闭再打开后不再跳转。
			// 新逻辑：检测 role=dialog 的设置弹窗从隐藏→可见，即导航一次；用户手动切换不受影响）
			_react.useEffect(() => {
				let observer = null;
				let lastDialogVisible = false;
				const tryNavigate = () => {
					// 只在设置弹窗（role=dialog 且含"零号工具"导航项）内查找
					const dialogs = document.querySelectorAll('[role="dialog"]');
					for (const dialog of dialogs) {
						const labels = dialog.querySelectorAll('[class*="navLabel"]');
						let found = false;
						for (const el of labels) {
							if ((el.textContent || "").trim() === "零号工具") {
								found = true;
								const cell = el.closest('[class*="navCell"]');
								if (cell) {
									// 无条件点击：弹窗刚打开时默认在"通用设置"，点击切到"零号工具"；
									// 若已记忆为"零号工具"，再点一次无害（已在目标页）
									cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
									cell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
									cell.click();
								}
								break;
							}
						}
						if (found) return;
					}
				};
				try {
					observer = new MutationObserver(() => {
						const dialogs = document.querySelectorAll('[role="dialog"]');
						let anyVisible = false;
						for (const dialog of dialogs) {
							const r = dialog.getBoundingClientRect();
							if (r.width > 0 && r.height > 0) { anyVisible = true; break; }
						}
						if (anyVisible && !lastDialogVisible) {
							// 设置弹窗刚打开 → 延迟导航（等导航栏渲染完成）
							setTimeout(tryNavigate, 120);
							setTimeout(tryNavigate, 400);
						}
						lastDialogVisible = anyVisible;
					});
					observer.observe(document.body, { childList: true, subtree: true });
				} catch (e) { /* ignore */ }
				return () => { if (observer) observer.disconnect(); };
			}, []);
			const handleSwitch = () => {
				// 切换后刷新当前模型状态
				setTimeout(() => {
					getCurrentDefaultModel().then((m) => setCurrentProvider(m ? m.provider : null)).catch(() => {});
				}, 500);
			};

			// v1.8.2: 识别 key 属于哪个模型（根据前缀/格式）
// v1.8.2: 从引导弹窗粘贴框安装：识别 → 安装 → 提示
			const installKeyFromInput = (key) => {
				const raw = (key || "").trim();
				if (!raw || raw.length < 16 || raw.length > 200) {
					setConfigMsg("⚠️ 请先在输入框粘贴有效的 API Key（长度需 16-200 字符）");
					setTimeout(() => setConfigMsg(""), 4000);
					return;
				}
				const matchedType = identifyKeyModel(raw);
				if (!matchedType) {
					setConfigMsg("⚠️ 无法识别这个 API Key 属于哪个模型，请检查是否复制正确");
					setTimeout(() => setConfigMsg(""), 4000);
					return;
				}
				if (configuredStatus && configuredStatus[matchedType]) {
					setConfigMsg("ℹ️ 该模型已配置过了，无需重复配置");
					setTimeout(() => setConfigMsg(""), 4000);
					return;
				}
				setConfiguring(true);
				setConfigMsg("");
				doAutoInstall(matchedType, raw, helpData && helpData.freeModels ? helpData.freeModels : [])
					.then((r) => {
						setConfiguring(false);
						setConfigMsg("✅ 已自动配置「" + r.modelName + "」，已接入 " + (helpData && helpData.freeModels ? helpData.freeModels.filter((m) => m.type === matchedType || (configuredStatus && configuredStatus[m.type])).length : 1) + "/" + r.modelCount + " 个免费模型");
						setTimeout(() => {
							getCurrentDefaultModel().then((m) => setCurrentProvider(m ? m.provider : null)).catch(() => {});
						}, 500);
						setTimeout(() => setConfigMsg(""), 6000);
					})
					.catch((e) => {
						setConfiguring(false);
						setConfigMsg("⚠️ 配置失败：" + String((e && e.message) || e));
						setTimeout(() => setConfigMsg(""), 5000);
					});
			};

			// v1.8.0: 用户主动点击"我已复制好Key"时读取剪贴板识别（不持续监听，避免权限弹窗吓到小白）
return (0, react_jsx_runtime.jsxs)(_react.Fragment, {
				children: [
					(0, react_jsx_runtime.jsx)(FooterActions, {
						wide: props.wide,
						health: health,
						currentProvider: currentProvider,
						onOpenOnboarding: () => setShowOnboarding(true),
						onSwitch: handleSwitch,
						freeModelTypes: freeModelTypes
					}),
					showOnboarding ? (0, react_jsx_runtime.jsx)(OnboardingModal, {
						onClose: () => setShowOnboarding(false),
						onDismiss: () => {
							try { localStorage.setItem(ONBOARDING_DISMISS_KEY, "1"); } catch (e) { /* ignore */ }
							setShowOnboarding(false);
						},
						freeModels: helpData && helpData.freeModels ? helpData.freeModels : [],
						configuredStatus: configuredStatus,
						onInstallKey: installKeyFromInput,
						installMsg: configMsg,
						onConfigured: refresh
					}) : null,
				]
			});
		}

		// v1.8.0: SettingsSection 包装组件——传入 health
		function SettingsSectionWrapper(props) {
			const health = useHealthMonitor();
			return (0, react_jsx_runtime.jsx)(SettingsSection, { health: health });
		}

		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-0-tools-footer",
				order: 10
			}, FooterActionsWrapper));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-0-tools",
				order: 90,
				label: () => "零号工具"
			}, SettingsSectionWrapper));
			installSettingsNavIconPatch();
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
