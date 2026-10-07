# dsh-0-tools (No.0 Tools)

[简体中文](./README.md) · [English](./README.en.md)

## What is dsh-0-tools

dsh-0-tools is designed for users with zero programming experience who are using DeepSeek Harness (hereinafter referred to as DSH) for the first time. It features "Zero Barrier, Zero Cost, Zero Loss of Control, Zero Confusion", aiming to help beginners get a better user experience.

## Main Features

1. **[Zero Barrier]** One-click installation of DSH and this tool, with automatic desktop shortcut creation;
2. **[Zero Cost]** One-click access to multiple permanently free large models accessible in China (Zhipu AI / SiliconFlow / iFlytek Spark / OpenRouter / ...), with automatic health monitoring and intelligent timeout prompts after configuration;
3. **[Zero Loss of Control]** If you choose to call the DeepSeek official model API, the DSH interface will display real-time reminders of whether it's peak hours (full price) or off-peak hours (half price);
4. **[Zero Confusion]** The beginner help center aggregates DSH official documentation and community-selected resources for quick onboarding.

## Current Version & Compatibility

- Current version: **v1.10.0**
- Compatible DSH version: **≥ `0.1.7`** (verified with `0.1.7-rc.2`)
- **System Requirements**: One-click installation scripts support **Windows 10 / Windows 11** (`install.bat`) and **macOS / Linux** (`install.sh`); the plugin core code itself is cross-platform. Users who have manually installed DSH can install the plugin manually via `dsh plugin --profile web add /path/to/dsh-0-tools`.

## Free Model List

dsh-0-tools currently integrates 4 permanently free large models. We recommend configuring all of them — when one model is busy or reporting errors, you'll have more faster and more stable free models to choose from, achieving "the more models, the more switching options":

| Model | Provider | Features |
|-------|----------|----------|
| GLM-4.7-Flash + GLM-4V-Flash | Zhipu AI | Text + image understanding, permanently free |
| Qwen3-8B (15+ models under 9B) | SiliconFlow | Permanently free, direct access in China, 128K context, supports tool calling |
| Spark Lite | iFlytek Spark | Permanently free, strong Chinese understanding |
| OpenRouter Free Pool | OpenRouter | Automatically routes dozens of free models, automatically bypasses when one is delisted |

> Each model provides a dedicated illustrated tutorial page. Click "Guide Tutorial" in "① Zero Cost · Free Model Manager Center" to view step-by-step registration instructions.

## Installation & Usage (Illustrated Steps)

### Step 0: Get the Source Code (Important — Don't Skip)

`install.bat` / `install.sh` **do not download anything by themselves** — they simply install
"the folder where the script itself lives" into DSH. So you must have the complete plugin
source directory before running either script.

**Recommended (gets the latest version)**:

```bash
# 1. Clone the repository (recommended — always the latest version)
git clone https://github.com/ai-yukin/dsh-0-tools.git

# 2. Enter the directory and confirm you can see lib/ and install.bat
cd dsh-0-tools
```

You can also click **Code → Download ZIP** on the GitHub page and unzip it,
or grab the prebuilt archive from **Releases → `dsh-0-tools-vX.Y.Z.zip`** (generated
automatically by GitHub Actions on every `v*` tag).

> **If GitHub is unstable from mainland China**, use the Gitee mirror (synced with GitHub):
> ```bash
> git clone https://gitee.com/ai-yukin/dsh-0-tools.git
> ```

**To check whether you have the latest version**: open `package.json` in that directory and
look at the `"version"` field. The current latest version is stated at the top of this document
under "Current Version & Compatibility".

> ⚠️ **Do not download `install.bat` alone.** It requires `lib/`, `cordis.patch.yml`,
> `help.json` and other files in the same directory; a missing file breaks the installation.

### Step 1: Run the One-Click Installation Script

- **Windows users**: Double-click to run `install.bat`
- **macOS / Linux users**: Run `chmod +x install.sh && ./install.sh` in the terminal

#### Windows Version (install.bat)

- If **DSH is already installed** on your computer: the script will automatically detect and skip the installation, directly completing the installation of this tool;
- If **DSH is not installed** yet: the script will automatically scan the runtime environment, fill in missing dependencies, and then automatically install DSH;
- After successful installation, the script will automatically **create a "DeepSeek Harness" shortcut on your desktop**.

> Tip: `install.bat` is a plain text script. You can right-click → "Open with → Notepad" to view all content before running (content is transparent and auditable). Scripts downloaded from the internet don't have digital signatures, and Windows may pop up a SmartScreen prompt ("Windows protected your PC"). Click "More info → Run anyway" — this is Windows' unified prompt for unsigned scripts, not a virus warning.

### Step 2: Open the DSH Interface

Double-click the "DeepSeek Harness" shortcut on your desktop, and the browser will automatically open the DSH web interface. When you haven't configured any free models yet, a popup will automatically guide you through configuration; you can also click the "Configure Free Model" button in the bottom-left corner of the DSH interface to enter the same configuration interface.

![DSH Main Interface - Popup guiding free model configuration](screenshots/1.png)

### Step 3: Get and Install API Key

We recommend configuring all the following free models — the more free models, the more switching options! Click the "Guide Tutorial" button on each model card below, follow the steps to register and copy the API Key (for iFlytek, you need to copy both APIKey and APISecret, concatenated with an English colon), and paste it into the "Paste any model API Key here for automatic recognition" box, then click "Auto-recognize API Key and install free model with one click" to automatically install the free model.

![Free Model Configuration Center - Four model cards + large paste box](screenshots/2.png)

> Configured models will show a ✅ mark and provide "One-click uninstall model" (with secondary confirmation); unconfigured models show "Guide Tutorial →" link.

### Step 4: Intelligent Health Monitoring + Timeout Prompts, Zero Cost More Transparent

After configuring free models, dsh-0-tools' "Free Model Manager Center" helps you pick a faster, more reliable available model:

- **Quota-friendly triggering (changed to on-demand in v1.10)**: A minimal `max_tokens=1` health-check request is sent only at three key moments — ① when you open DSH; ② when you resume activity after being idle for more than 30 minutes; ③ when you manually click "Re-test". **No longer runs every minute automatically**, saving about 99% of your free model quota compared with the old version;
- **Median-based judgment**: Records the last 5 response times and takes the **median after discarding the highest and lowest values**, so an occasional hiccup won't drag the overall status into "Timeout";
- **Status criteria**: median < 8 seconds = Normal (🟢), 8-15 seconds = Slow (🟡), > 15 seconds or timeout = Timeout (🔴);
- **Smart recommendation (not just speed)**: Ranks by a composite score of speed × 40% + model capability × 60%, avoiding recommending a model that is "fast but weak";
- **Timeout prompt**: When the current model times out, the bottom of the sidebar displays "Zhipu🔴Timeout, recommend switching to iFlytek". The status bar is for display only and cannot be clicked;
- **Quota exhaustion is now detected directly** (new in v1.10): When the free quota runs out (HTTP 402) or the API key becomes invalid, the plugin **immediately** marks that model as unavailable and shows the reason, instead of misreporting "out of credit" as "available";
- **Optional auto-switching** (new in v1.10): Enable "Auto-switch" in the settings tab, and when the current model is unavailable 2 consecutive times, the plugin switches to the highest-scoring available model and clearly tells you which one it switched to; a 5-minute cooldown prevents ping-pong. **Disabled by default** — you decide whether to hand over control.

![Free Model Manager Center - Status Indicator](screenshots/3.png)


### Step 5: Using Paid DeepSeek Models

If you decide to use paid services and have already applied for and purchased a DeepSeek model API, you can click "Settings" in the bottom-left corner of the DSH interface, find "Models", click "Edit" next to DeepSeek, and enter your DeepSeek model API key.

![DeepSeek Model API Key Configuration](screenshots/5.png)

### Step 6: DeepSeek Billing Reminder

When you switch to and select a DeepSeek official model in the DSH interface, the bottom-left corner of the interface will display a real-time billing reminder. Based on the peak/off-peak hours of DeepSeek official API calls, it will prompt "Current peak hours, API at full price" or "Current off-peak hours, API at half price", providing you with "Zero Loss of Control" cost protection.

![DeepSeek Billing Reminder - Peak hours full price](screenshots/4.png)

> DeepSeek official billing rules (effective from 2026-08-23): Weekends (Saturday/Sunday) are uniformly off-peak pricing all day, no longer distinguishing peak/valley; only weekdays (Monday-Friday) implement peak/valley tiered billing — peak hours (9:00-12:00, 14:00-18:00) at full price, remaining off-peak hours at half price.

## China Mirror Download Address

This repository provides a Gitee mirror for users in mainland China, now available:

- **GitHub main repository**: `https://github.com/ai-yukin/dsh-0-tools`
- **Gitee mirror**: `https://gitee.com/ai-yukin/dsh-0-tools`

Notes:

- This repository uses **GitHub as the main source repository**, with Gitee as the domestic mirror. The mirror is synced automatically by GitHub Actions (triggered by any push to `main`), keeping content consistent with the main repository;
- Gitee now uses `main` as its **only** branch — the legacy `master` branch has been deleted — so the README shown on its landing page is always the latest;
- Domestic users are recommended to download from Gitee for more stable access speed;
- If you need to report issues or suggestions, please submit them in the Issues of the GitHub main repository.

> **Three ways to get the source code** (all deliver the same latest version):
>
> | Method | Command / Location | Best for |
> |---|---|---|
> | Git clone | `git clone https://github.com/ai-yukin/dsh-0-tools.git` | You want to upgrade later with `git pull` |
> | Release archive | **Releases** on the right of the GitHub repo → download `dsh-0-tools-vX.Y.Z.zip` | One-off install, no Git needed |
> | Gitee mirror | `git clone https://gitee.com/ai-yukin/dsh-0-tools.git` | GitHub is slow/unstable from mainland China |
>
> The Release archive is generated automatically by GitHub Actions when a `v*` tag is pushed.
> It contains a top-level `dsh-0-tools-vX.Y.Z/` directory — **run the install script from inside the extracted directory**.

## Compatibility

This plugin has been developed and verified against the following DSH versions:

| DSH Version | Status |
|-------------|--------|
| `0.1.7-rc.2` | Verified and adapted (page loading / pricing bar / model selector / settings tab / official configuration channel / web authentication) |
| `0.1.1-rc.2` | Verified and adapted (page loading / pricing bar / model selector / settings tab / official configuration channel) |


## Directory Structure

```
dsh-0-tools/
├── lib/
│   ├── index.js     # host side: local health monitoring proxy server (127.0.0.1:3095), bypasses browser CORS
│   └── client.js    # browser side: bottom-left toolbar + settings tab "dsh-0-tools" + read/write config via official /api
├── guide/                # v1.8.0 added: 4 dedicated illustrated tutorial pages for free models
│   ├── zai.html              # Zhipu AI tutorial
│   ├── openrouter-free.html  # OpenRouter tutorial
│   ├── siliconflow.html       # SiliconFlow tutorial
│   ├── xinghuo.html          # iFlytek Spark tutorial
│   └── images/               # tutorial screenshots
├── screenshots/           # README screenshots
├── cordis.patch.yml       # web profile injection declaration
├── package.json
├── help.json              # help center online data source (hosted on GitHub Pages, supports remote hot-update model list)
├── install.bat            # Windows one-click install + start + verify
├── install.sh             # macOS / Linux one-click install + start + verify
├── .github/workflows/     # CI: Gitee mirror sync + Release auto-packaging
├── VERSION_UPDATE_CHECKLIST.md  # release checklist (version sync points, regression items)
├── CONTRIBUTING.md
└── LICENSE
```

> The zip attached to Releases contains `lib/`, `guide/`, `screenshots/`, `cordis.patch.yml`, `package.json`, `help.json`, the install scripts and the READMEs.
> `.github/`, `article/`, `draft_*/` and leftover debug files are not packaged.

## Mechanism Explanation


- **Configuration status determination**: The browser side calls official `settings.describe` + `credentials.describe` to determine whether `llm-pi-ai.providers.{provider}` exists and whether its credentials are configured, as the authoritative source; polls every 5 seconds to refresh the interface. When the credential service is temporarily unavailable, status is treated as "unknown" rather than "configured", preventing the UI from falsely showing all-green (fixed in v1.10).
- **One-click configuration**: Sequentially writes credentials via official `credentials.set`, writes provider configuration section via `settings.mutate`, and switches the default model to the corresponding free model via `settings.update` with merge semantics (merge semantics ensure user-set fields like `reasoningEffort` are not erased).
- **One-click uninstall**: Clears the provider configuration section and corresponding credentials via official channels; only when the default model previously pointed to that provider, restores to the original default model recorded before configuration, otherwise keeps the user's current selection unchanged.
- **API Key auto-recognition**: Automatically identifies which model a Key belongs to based on prefix/format (`sk-or-v1-` → OpenRouter, `sk-` (non-sk-or-v1-) → SiliconFlow, `APIKey:APISecret` format or 32-bit hex → iFlytek Spark, long string with dots → Zhipu AI), and automatically invokes the one-click configuration process after recognition.
- **Free Model Manager Center (on-demand health checks)**: Health checks run only at three moments — "open DSH / resume activity after 30+ minutes idle / manually click Re-test" — no longer every 60 seconds in the background, saving about 99% of free quota. Records the last 5 response times and takes the **median after discarding the highest and lowest** as the judgment basis; single-check timeout is 15 seconds.
- **Health-check error classification**: The host side classifies errors by HTTP status code + response body patterns into `quota_exhausted` (402 / insufficient balance / quota used up), `auth_failed` (401/403), `rate_limited` (429), `model_unavailable` (404), `server_error` (5xx), `timeout`. **Definitive failures (quota exhausted / auth failed / model unavailable) are marked unavailable immediately**, with no wasted retries (fixed in v1.10 — the old version lumped 402 into `unknown` and misreported it as "available").
- **Smart recommendation and auto-switching**: Composite score = speed score × 40% + capability score × 60% (capability score can be overridden by remote `help.json`'s `capabilityScore`). Auto-switching is an **opt-in, disabled-by-default** feature; when enabled, it switches to the highest-scoring available model only after the current model is unavailable 2 consecutive times, with a 5-minute cooldown and an explicit notification to the user.
- **Invalid residual cleanup**: The configuration center detects whether there are residual delisted/invalid model providers locally (dynamically reads their `apiKeyEnv`, no longer relying on local static lists), provides an "invalid residual" prompt in the interface and offers one-click cleanup, avoiding orphan configurations that cannot be deleted.
- **Settings tab**: Injected via `settings.section` slot (same mechanism as official plugins), id is `dsh-0-tools`, tab name is "dsh-0-tools".
- **Help Center**: Fetches `https://ai-yukin.github.io/dsh-0-tools/help.json`, passes through a unified filter `filterRemotePayload` for field-by-field security checks (URL enforces https, text rejects control characters/newlines, model id and credential name use character whitelist) before entering the interface and configuration chain; falls back to built-in data on failure or non-compliance; both the configurable model list and delisted model list are driven by this remote data, allowing adding or delisting models without reinstalling the plugin.
- **Tutorial page hosting**: Tutorial pages are uniformly hosted on GitHub Pages (`https://ai-yukin.github.io/dsh-0-tools/guide/`). Domestic users can download the source code from the Gitee mirror repository and view tutorials locally.

## Disclaimer

- This plugin is a **third-party community plugin**, not affiliated with DeepSeek, Zhipu AI, SiliconFlow, iFlytek, or OpenRouter in any way. Officials do not provide support for it.
- When using this plugin to access third-party model services, please comply with the corresponding platform's terms of service and fee policies on your own.
- Conversation content through free model channels may be retained by model vendors for training. Do not enter sensitive content such as business secrets or personal privacy through these channels.
- This project is open source under the MIT license, and users assume usage risks at their own discretion.

## License

[MIT](LICENSE) © 2026 ai-yukin
