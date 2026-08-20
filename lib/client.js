// dsh-0-tools — browser half (injected into the DSH web client).
//
// Responsibilities (CLIENT side only — this file is referenced by the
// cordis.patch.yml `client` list and loaded by dsh-client-runtime):
//  - Left footer toolbar (sidebar.footer.action), from left to right:
//      * blue onboarding button  — ONLY when the managed zai provider is NOT
//        configured (authoritative check against host GET /status; the old DOM
//        sniffing approach is gone)
//      * pricing badge           — ONLY while a DeepSeek model is selected
//      * "?" help center button  — always on
//  - Settings tab "零号工具" (settings.section slot):
//      ① 零门槛小白帮助中心 ② 零费用API配置中心 ③ 零失控费用管控中心
//  - Help center loads remote JSON (ai-yukin.github.io/dsh-0-tools/help.json)
//    with a built-in fallback, so copy can be updated without releasing a new
//    plugin version.
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

		const PLUGIN_PORTS = [3090, 3091, 3092, 3093, 3094, 3095, 3096, 3097, 3098, 3099];
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
			return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
		}

		function apiFetch(path, opts) {
			const attempt = (idx) => {
				if (idx >= PLUGIN_PORTS.length) {
					return Promise.reject(new Error("未找到零号工具本地服务，请重启 DeepSeek Harness 后重试。"));
				}
				const port = PLUGIN_PORTS[idx];
				return fetch("http://127.0.0.1:" + port + path, opts)
					.then((r) => {
						if (!r.ok) return Promise.reject(new Error("插件服务返回 " + r.status));
						return r.json();
					})
					.catch((err) => {
						if (err instanceof SyntaxError) return Promise.reject(err);
						return attempt(idx + 1);
					});
			};
			return attempt(0);
		}

		function openExternal(url) {
			try {
				window.open(url, "_blank", "noopener,noreferrer");
			} catch (e) {
				window.location.href = url;
			}
		}

		// ---------- configuration status (authoritative: host GET /status) ----------
		function useConfigured() {
			const [configured, setConfigured] = _react.useState(false);
			const [loaded, setLoaded] = _react.useState(false);
			const [revision, setRevision] = _react.useState(0);
			_react.useEffect(() => {
				let alive = true;
				const tick = () => {
					apiFetch("/status")
						.then((d) => {
							if (!alive) return;
							setConfigured(!!d.configured);
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
			return { configured, loaded, refresh };
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
			const lower = text.toLowerCase();
			if (lower.includes("deepseek")) return true;
			if (lower.includes("v4") || lower.includes("-v")) return true;
			return /deepseek/i.test(text);
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
				const timer = setInterval(scan, 1000);
				window.addEventListener("dsh:modelchange", scan);
				return () => {
					alive = false;
					clearInterval(timer);
					window.removeEventListener("dsh:modelchange", scan);
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

		function ConfigForm(props) {
			const [key, setKey] = _react.useState("");
			const [busy, setBusy] = _react.useState(false);
			const [err, setErr] = _react.useState("");
			const [done, setDone] = _react.useState(false);
			const submit = () => {
				if (!key.trim()) {
					setErr("请先填入你的智谱 API Key");
					return;
				}
				setBusy(true);
				setErr("");
				apiFetch("/configure", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ key: key.trim() })
				})
					.then((d) => {
						setBusy(false);
						if (d.ok) {
							setDone(true);
							props.onDone();
						} else {
							setErr(d.error || "配置失败，请重试");
						}
					})
					.catch((e) => {
						setBusy(false);
						setErr(String((e && e.message) || e));
					});
			};
			if (done) {
				return (0, react_jsx_runtime.jsx)("div", {
					style: { color: "#30a46c", fontWeight: 600 },
					children: "\u2714 配置成功！免费模型已接入，关闭本窗口后即可在模型列表选择「智谱 GLM」系列。"
				});
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "10px" },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: { fontWeight: 600, marginBottom: "4px" }, children: "1. 注册并获取免费 Key" }),
							(0, react_jsx_runtime.jsx)("div", { children: "前往" }),
							(0, react_jsx_runtime.jsx)("a", {
								href: PLATFORM_URL,
								target: "_blank",
								rel: "noreferrer",
								style: { color: "#2563eb" },
								children: "智谱开放平台（open.bigmodel.cn）"
							}),
							(0, react_jsx_runtime.jsx)("div", { children: "免费注册 → 控制台 → API Keys → 创建新密钥（形如 1a2b3c…）" })
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: { fontWeight: 600, marginBottom: "4px" }, children: "2. 粘贴 API Key" }),
							(0, react_jsx_runtime.jsx)("input", {
								type: "password",
								style: INPUT_STYLE,
								placeholder: "粘贴你的智谱 API Key",
								value: key,
								onChange: (e) => setKey(e.target.value)
							})
						]
					}),
					err ? (0, react_jsx_runtime.jsx)("div", { style: { color: "#e5484d", fontSize: "12px" }, children: err }) : null,
					(0, react_jsx_runtime.jsx)("div", {
						style: { display: "flex", gap: "8px" },
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: { ...BTN_PRIMARY, opacity: busy ? 0.6 : 1 },
								disabled: busy,
								onClick: submit,
								children: busy ? "配置中…" : "一键配置免费模型"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: BTN_OUTLINE,
								onClick: props.onCancel,
								children: "取消"
							})
						]
					})
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

		function ConfigModal(props) {
			return (0, react_jsx_runtime.jsx)(ModalFrame, {
				title: "免费模型·一键配置",
				onClose: props.onClose,
				footer: (0, react_jsx_runtime.jsx)("a", {
					href: "#",
					onClick: (e) => {
						e.preventDefault();
						props.onClose();
						openSettingsZeroTools();
					},
					style: { fontSize: "13px", color: "#3a3d42" },
					children: "帮助中心"
				}),
				children: (0, react_jsx_runtime.jsx)(ConfigForm, {
					onDone: props.onDone,
					onCancel: props.onClose
				})
			});
		}

		// ---------- help center (remote JSON + built-in fallback) ----------
		const DEFAULT_HELP = {
			version: "2026-08-20.4",
			updatedAt: "2026-08-20",
			official: [
				{ title: "DeepSeek Harness 官网", url: "https://www.deepseek.com/harness/" },
				{ title: "DeepSeek 开放平台（官方 API 控制台）", url: DS_PLATFORM_URL },
				{ title: "DeepSeek API 文档（官方 API 介绍资料）", url: API_DOCS_URL },
				{ title: "到智谱开放平台获取零费用 API Key", url: PLATFORM_URL }
			],
			selected: [
				{ title: "DSH 插件精选（awesome 站）", url: "https://awesome-dsh-plugin.com/zh" },
				{ title: "DSH 社区插件（GitHub 站）", url: "https://github.com/topics/dsh-plugin" }
			]
		};

		function useHelpData() {
			const [data, setData] = _react.useState(DEFAULT_HELP);
			const [source, setSource] = _react.useState("local");
			_react.useEffect(() => {
				let alive = true;
				fetchWithTimeout(HELP_URL, 6000)
					.then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
					.then((j) => {
						if (!alive || !j || typeof j !== "object") return;
						const merged = {
							version: typeof j.version === "string" ? j.version : DEFAULT_HELP.version,
							updatedAt: typeof j.updatedAt === "string" ? j.updatedAt : DEFAULT_HELP.updatedAt,
							official: Array.isArray(j.official) ? j.official : DEFAULT_HELP.official,
							selected: Array.isArray(j.selected) ? j.selected : DEFAULT_HELP.selected
						};
						setData(merged);
						setSource("remote");
						try {
							localStorage.setItem("dsh-0-tools:help-version", merged.version);
						} catch (e) {
							/* ignore */
						}
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

		// 帮助链接列：单列链接列表，已读置灰。
		function HelpLinkList(props) {
			return (0, react_jsx_runtime.jsx)("div", {
				style: { display: "flex", flexDirection: "column", gap: "8px" },
				children: props.items.map((l) => (0, react_jsx_runtime.jsx)("a", {
					href: l.url,
					target: "_blank",
					rel: "noreferrer",
					onClick: () => props.markRead(l.url),
					style: props.read[l.url]
						? { color: "#9a9fa6", textDecoration: "none" }
						: { color: "#3a3d42", textDecoration: "underline" },
					children: "\u2022 " + l.title
				}, l.url))
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
			const [tab, setTab] = _react.useState("official");
			const items = tab === "official" ? data.official : data.selected;
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "10px" },
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						style: { color: "#81858C", fontSize: "12px" },
						children: "帮助内容版本 " + data.version + "（" + (source === "remote" ? "已同步最新" : "离线内置") + "）"
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						style: { display: "flex", gap: "4px" },
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: { ...TAB_BTN_BASE, color: tab === "official" ? "#0F1115" : "#81858C", background: tab === "official" ? "#f2f3f5" : "transparent" },
								onClick: () => setTab("official"),
								children: "官方资料"
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: { ...TAB_BTN_BASE, color: tab === "selected" ? "#0F1115" : "#81858C", background: tab === "selected" ? "#f2f3f5" : "transparent" },
								onClick: () => setTab("selected"),
								children: "精选资料"
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
				const update = () => {
					const h = new Date().getHours();
					setPeak((h >= 9 && h < 12) || (h >= 14 && h < 18));
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
			const [open, setOpen] = _react.useState(false);
			const collapsed = useSidebarCollapsed();
			return (0, react_jsx_runtime.jsxs)(_react.Fragment, {
				children: [
					(0, react_jsx_runtime.jsx)(FooterRowButton, {
						icon: KEY_SVG,
						label: "点此处配置API免费模型",
						title: "一键配置智谱免费模型（GLM-4.7-Flash 文本 + GLM-4V-Flash 图片）",
						onClick: () => setOpen(true),
						collapsed
					}),
					open ? (0, react_jsx_runtime.jsx)(ConfigModal, {
						onClose: () => setOpen(false),
						onDone: () => {
							setOpen(false);
							props.onDone();
						}
					}) : null
				]
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
			const mo = new MutationObserver(() => patch());
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

		function UninstallZone(props) {
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
				apiFetch("/uninstall", { method: "POST" })
					.then((d) => {
						setBusy(false);
						setConfirming(false);
						if (d.ok) {
							setMsg("\u2714 已卸载：智谱 provider 与密钥已清除，默认模型已切回 DeepSeek 官方模型。");
							props.onDone();
						} else {
							setMsg("卸载失败：" + (d.error || "未知错误"));
						}
					})
					.catch((e) => {
						setBusy(false);
						setConfirming(false);
						setMsg("卸载失败：" + String((e && e.message) || e));
					});
			};
			// 未确认态：黑色 pill；二次确认态：纯红底白字（同形状同字号）。
			const uninstallBtnStyle = confirming
				? { border: "none", borderRadius: "16px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "#e5484d", cursor: "pointer" }
				: { border: "none", borderRadius: "16px", padding: "7px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "#111", cursor: "pointer" };
			return (0, react_jsx_runtime.jsxs)("div", {
				style: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" },
				children: [
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: { ...uninstallBtnStyle, opacity: busy ? 0.6 : 1 },
						disabled: busy,
						onClick: run,
						children: confirming ? "再次点击确认卸载" : (busy ? "卸载中…" : "一键卸载免费模型")
					}),
					msg ? (0, react_jsx_runtime.jsx)("div", { style: { fontSize: "12px", color: msg.indexOf("\u2714") === 0 ? "#30a46c" : "#e5484d" }, children: msg }) : null
				]
			});
		}

		function SettingsSection(props) {
			const { configured, loaded, refresh } = useConfigured();
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
					// ② 零费用·API配置中心
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2461 零费用·API配置中心" }),
							configured
								? (0, react_jsx_runtime.jsxs)("div", {
									style: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" },
									children: [
										(0, react_jsx_runtime.jsx)("div", { style: { color: "#30a46c", fontWeight: 600 }, children: "\u2714 已接通智谱双免费模型（GLM-4.7-Flash 文本 + GLM-4V-Flash 图片）" }),
										(0, react_jsx_runtime.jsx)("div", { style: CARD_TEXT, children: "当前默认模型已切换为智谱 GLM-4.7-Flash，可在模型列表选择使用。若不再需要，可一键卸载切回 DeepSeek；卸载后清除智谱 provider 配置与密钥，默认模型切回 DeepSeek 官方模型，需要时可再点「一键配置」装回。" }),
										(0, react_jsx_runtime.jsx)(UninstallZone, { onDone: refresh })
									]
								})
								: (0, react_jsx_runtime.jsxs)("div", {
									style: { display: "flex", flexDirection: "column", gap: "10px" },
									children: [
										(0, react_jsx_runtime.jsx)("div", { style: CARD_SUB, children: "为什么推荐零费用接入？" }),
										(0, react_jsx_runtime.jsx)("div", { style: CARD_TEXT, children: "DeepSeek 官方 API 无永久免费模型，需充值才能调用；智谱 Flash 系列（GLM-4.7-Flash 文本 / GLM-4V-Flash 图片）永久免费、不耗余额，足够日常使用。粘贴 API Key 一键接入，零费用先用起来。" }),
										(0, react_jsx_runtime.jsx)("div", { style: { ...CARD_TEXT, background: "#f2f3f5", padding: "8px 10px", borderRadius: "8px" }, children: "⚠️ 高峰时段智谱免费模型可能报错（厂商侧服务过载，与账号无关），稍后重试或空闲时段使用更顺畅。" }),
										(0, react_jsx_runtime.jsx)(ConfigForm, {
											onDone: refresh,
											onCancel: () => { /* 设置页内配置不需要关闭 */ }
										})
									]
								})
						]
					}),
					// ③ 零失控·费用管控中心
					(0, react_jsx_runtime.jsxs)("div", {
						style: CARD,
						children: [
							(0, react_jsx_runtime.jsx)("div", { style: CARD_TITLE, children: "\u2462 零失控·费用管控中心" }),
							(0, react_jsx_runtime.jsx)("div", {
								style: CARD_TEXT,
								children: "DeepSeek 官方按时段计费：北京时间 09:00-12:00、14:00-18:00 为高峰时段，以原价计算，其余为空闲时段，享受半价优惠。界面左下角「时段价格提醒条」只在你选中 DeepSeek 模型时出现，实时提示当前处于高峰时段还是空闲时段，是原价还是半价，做到心里有数、拒绝失控。"
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
			const { configured, refresh } = useConfigured();
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
					!configured ? (0, react_jsx_runtime.jsx)(FreeApiButton, { onDone: refresh }) : null,
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
