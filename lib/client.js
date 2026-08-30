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
					{ id: "openrouter/free", name: "OpenRouter 免费池（自动挑选）", input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 }
				]
			}
		};
		// 官方回落默认（卸载且无用户快照时；与 DSH agent-default-model 的
		// composition base 保持一致）。
		const OFFICIAL_FALLBACK = { provider: "deepseek-official", model: "deepseek-v4-flash" };
		const HELP_URL = "https://ai-yukin.github.io/dsh-0-tools/help.json";
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
					setErr("Key 应以 " + item.keyPrefix + " 开头，请确认后重试");
					return;
				}
				// 编码/注入自检：禁止换行与替换字符（阶段0实测：坏字节会被
				// 官方通道照存不误，必须在写入前拦截）。
				if (/[\r\n\uFFFD]/.test(raw)) {
					setErr("Key 中包含换行或非法字符，请检查粘贴内容后重试");
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
					(0, react_jsx_runtime.jsx)("a", {
						href: item.keysUrl,
						target: "_blank",
						rel: "noreferrer",
						style: { color: "#2563eb", fontSize: "12px", display: "inline-block", width: "fit-content" },
						children: item.keysLabel
					}),
					(0, react_jsx_runtime.jsx)("input", {
						type: "password",
						style: INPUT_STYLE,
						placeholder: item.keyPlaceholder || "粘贴你的 API Key",
						value: key,
						onChange: (e) => setKey(e.target.value)
					}),
					err ? (0, react_jsx_runtime.jsx)("div", { style: { color: "#e5484d", fontSize: "12px" }, children: err }) : null,
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: { ...BTN_PRIMARY, opacity: busy ? 0.6 : 1 },
						disabled: busy,
						onClick: submit,
						children: busy ? "安装中…" : "一键配置免费模型"
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
		const PLUGIN_VERSION = "1.6.1";
		const DEFAULT_HELP = {
			version: "2026-08-30.1",
			updatedAt: "2026-08-30",
			official: [
				{ title: "DeepSeek Harness 官网", url: "https://www.deepseek.com/harness/" },
				{ title: "DeepSeek 开放平台（官方 API 控制台）", url: DS_PLATFORM_URL },
				{ title: "DeepSeek API 文档（官方 API 介绍资料）", url: API_DOCS_URL },
				{ title: "到智谱开放平台获取零费用 API Key", url: PLATFORM_URL }
			],
			selected: [
				{ title: "零号工具 dsh-0-tools（GitHub）", url: "https://github.com/ai-yukin/dsh-0-tools" },
				{ title: "DSH Plugin 广场（腾讯站）", url: "https://skillhub.cn/plugins" },
				{ title: "DSH 插件精选（awesome 站）", url: "https://awesome-dsh-plugin.com/zh" },
				{ title: "DSH 社区插件（GitHub 站）", url: "https://github.com/topics/dsh-plugin" }
			],
			freeModels: [
				{
					type: "zai",
					title: "智谱 GLM 双免费模型一键配置",
					desc: "智谱 Flash 系列永久免费：GLM-4.7-Flash（文本）+ GLM-4V-Flash（图片理解），不耗余额，足够日常使用。粘贴 API Key 一键接入。",
					keysLabel: "智谱开放平台获取 Key ↗",
					keysUrl: PLATFORM_URL,
					keyPlaceholder: "粘贴你的智谱 API Key",
					note: "高峰时段智谱免费模型可能报错（厂商侧服务过载，与账号无关），稍后重试或空闲时段使用更顺畅。"
				},
				{
					type: "openrouter-free",
					title: "OpenRouter 免费模型池（一个 Key 通吃数十款）",
					desc: "OpenRouter 官方免费模型路由器：每次请求自动从当前可用的免费模型池（约 27 款、动态更新）中挑选一款执行。你不需要指定具体模型——某款下架会自动绕开、换用其他免费模型，无需改任何配置，随时都有免费模型可用。",
					keysLabel: "OpenRouter 获取 Key ↗",
					keysUrl: "https://openrouter.ai/keys",
					keyPlaceholder: "粘贴你的 OpenRouter API Key（sk-or-v1- 开头）",
					keyPrefix: "sk-or-v1-",
					credentialRef: "OPENROUTER_API_KEY",
					displayName: "OpenRouter Free",
					api: "openai-completions",
					baseURL: "https://openrouter.ai/api/v1",
					compat: { thinkingFormat: "openrouter" },
					models: [
						{ id: "openrouter/free", name: "OpenRouter 免费池（自动挑选）", input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 }
					],
					note: "需零号工具 v1.6.0 及以上版本；旧版本安装时会提示配置不被支持。⚠️ 免费通道的对话内容可能被模型厂商留存用于训练，请勿在此通道输入商业机密、个人隐私等敏感内容。免费档限速较低（零余额约每天 50 次请求，社区实测值），高峰期可能排队或报错，稍后重试即可。每次回答可能来自池中不同的模型（自动挑选）。"
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
			out.freeModels = Array.isArray(j.freeModels) ? j.freeModels.map(remoteFilterFreeModel).filter(Boolean) : [];
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
		// 展开后按安装状态显示 安装表单(FreeInstallForm) 或 已接入+卸载(FreeInstalledZone)。
		function FreeModelRow(props) {
			const { item, installed, onDone } = props;
			const [open, setOpen] = _react.useState(false);
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "8px" },
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: { display: "flex", alignItems: "center", cursor: "pointer", color: "#2563eb", fontWeight: 600, fontSize: "13px", userSelect: "none", flexWrap: "wrap", gap: "6px", lineHeight: "20px" },
						onClick: () => setOpen((v) => !v),
						children: [
							(0, react_jsx_runtime.jsx)("span", { children: (open ? "\u25be " : "\u25b8 ") + item.title }),
							item.badge ? (0, react_jsx_runtime.jsx)(NewBadge, {}) : null,
							installed ? (0, react_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "#30a46c", fontWeight: 600 }, children: "\u25cf 已接入" }) : null
						]
					}),
					open
						? (installed
							? (0, react_jsx_runtime.jsx)(FreeInstalledZone, { item: item, onDone: onDone })
							: (0, react_jsx_runtime.jsx)(FreeInstallForm, { item: item, onDone: onDone }))
						: null
				]
			});
		}

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
			const installedCount = list.filter((m) => status[m.type]).length;
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "12px" },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						style: { ...CARD_TEXT, background: "#f2f3f5", padding: "8px 10px", borderRadius: "8px" },
						children: [
							(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600, color: "#0F1115" }, children: "为什么推荐零费用接入？" }),
							" DeepSeek 官方 API 无永久免费模型，需充值才能调用；这里汇总当前可一键接入的免费模型，零费用先用起来，随时可一键卸载。"
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						style: { fontSize: "12px", lineHeight: "18px", color: "#61666B" },
						children: installedCount > 0
							? "已接入 " + installedCount + " 个免费模型，点击条目可查看状态或卸载。"
							: "暂未接入免费模型，点击下方条目展开配置。"
					}),
					list.map((item) => (0, react_jsx_runtime.jsx)(FreeModelRow, {
						item: item,
						installed: !!status[item.type],
						onDone: refresh
					}, "fm-" + item.type)),
					(0, react_jsx_runtime.jsx)(RetiredResidueZone, { retired: retired, status: status, refresh: refresh })
				]
			});
		}

		// 帮助链接列：普通条目为外链（已读置灰，可带 New 标记）。
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
								children: "\u2022 " + l.title
							}, l.url),
							l.badge ? (0, react_jsx_runtime.jsx)(NewBadge, {}) : null
						]
					}, "link-" + l.title);
				})
			});
		}

		// 帮助内容：官方资料 / 精选资料 标签页切换（模仿手绘示意），支持远程更新。
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

		function HelpModal(props) {
			return (0, react_jsx_runtime.jsx)(ModalFrame, {
				title: "零门槛小白帮助中心",
				onClose: props.onClose,
				children: (0, react_jsx_runtime.jsx)(HelpContent, {})
			});
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

		function FreeApiButton(props) {
			const collapsed = useSidebarCollapsed();
			return (0, react_jsx_runtime.jsx)(FooterRowButton, {
				icon: KEY_SVG,
				label: "点此处配置API免费模型",
				title: "在「零费用·API配置中心」一键接入免费模型",
				onClick: openSettingsZeroTools,
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

		function SettingsSection(props) {
			const { status, loaded, refresh } = useConfigured();
			const { data } = useHelpData();
			return (0, react_jsx_runtime.jsxs)("div", {
				style: SECTION_WRAP,
				children: [
					// ① 零门槛·小白帮助中心
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2460 零门槛·小白帮助中心" }),
							(0, react_jsx_runtime.jsx)(HelpContent, {})
						]
					}),
					// ② 零费用·API配置中心（远程 freeModels 驱动，新增免费模型零发版）
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2461 零费用·API配置中心" }),
							(0, react_jsx_runtime.jsx)(FreeConfigCenter, { items: data.freeModels, retired: data.retired, status: status, refresh: refresh })
						]
					}),
					// ③ 零失控·费用管控中心
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2462 零失控·费用管控中心" }),
							(0, react_jsx_runtime.jsx)("div", {
								style: CARD_TEXT,
								children: "DeepSeek 官方按时段计费：工作日（周一至周五）北京时间 09:00-12:00、14:00-18:00 为高峰时段，以原价计算，其余为空闲时段，享受半价优惠；周末（周六、周日）全天统一按低谷价计费，不再区分峰谷时段。界面左下角「时段价格提醒条」只在你选中 DeepSeek 模型时出现，实时提示当前处于高峰时段还是空闲时段，是原价还是半价，做到心里有数、拒绝失控。"
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
			const { wide } = props;
			const { loaded, hasAnyInstalled } = useConfigured();
			// 提示条显隐：仅当没有任何免费模型已配置时显示；loaded 门控避免首次
			// 状态加载完成前闪现引导按钮（status 初始为空对象）。
			// v1.6.1 修复：旧逻辑只检查智谱(status.zai)，导致仅接入 OpenRouter
			// 时提示条仍错误显示；改为检查全量 provider 是否有任一已接入。
			const showHint = loaded ? !hasAnyInstalled : false;
			const pricingState = useModelPricingState();
			const collapsed = useSidebarCollapsed();
			return (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: collapsed ? "center" : "flex-start",
					flexDirection: collapsed ? "column" : "row",
					gap: collapsed ? "2px" : "6px",
					flexWrap: "wrap",
					marginBottom: "-4px"
				},
				children: [
					showHint ? (0, react_jsx_runtime.jsx)(FreeApiButton, {}) : null,
					pricingState === "deepseek" ? (0, react_jsx_runtime.jsx)(PricingBadge, { wide: wide }) : null,
					(0, react_jsx_runtime.jsx)(HelpButton, {})
				]
			});
		}

		// ---------- plugin entry ----------
		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-0-tools-footer",
				order: 10
			}, FooterActions));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-0-tools",
				order: 90,
				label: () => "零号工具"
			}, SettingsSection));
			installSettingsNavIconPatch();
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		return module.exports;
	}
});
