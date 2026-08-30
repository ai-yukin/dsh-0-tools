# dsh-0-tools No.0 Tools

[English](./README.en.md) · [简体中文](./README.md)

## What Is No.0 Tools

No.0 Tools is designed for users with no programming background who are trying DeepSeek Harness (DSH) for the first time. It offers "Zero Threshold, Zero Cost, Zero Loss of Control" and aims to give zero-baseline users a better experience.

## Key Features

1. **Zero Threshold** — One-click installation of DSH and this tool.
2. **Zero Cost** — One-click configuration of free API models for DSH (as of v1.6.0: Zhipu GLM + the OpenRouter free model pool).
3. **Zero Loss of Control** — When calling the DeepSeek model API, the DSH UI shows real-time pricing (full price or half price).
4. **Zero Threshold** — A help center with curated, trustworthy sources to help beginners master DSH faster.

> **New in v1.6.0**: an "OpenRouter Free Model Pool" card in the Config Center — paste one OpenRouter API key (free signup, no card required) to hook up OpenRouter's official free-models router (`openrouter/free`): every request auto-picks from the live free pool (~27 models, dynamically updated), automatically routing around retired ones, so a free model is always available. Note: conversations on the free channel may be retained by model vendors for training — do not feed it trade secrets or personal data; the free tier is rate-limited (roughly 50 requests/day at zero balance, community-measured).

## Version & Compatibility

- Current version: **v1.6.0**
- Compatible DSH versions: **≥ `0.1.1`** (v1.5.0 switched to DSH's official config channel, raising the minimum supported version — see the compatibility notice below)
- **System requirements**: Windows 10 / Windows 11 only. macOS and Linux are not supported at this time.

## Installation & Usage

### Step 1: Double-click install.bat

- If **DSH is already installed**: the script detects it and skips installation, then installs this tool directly.
- If **DSH is not installed**: the script scans the environment, installs any missing prerequisites, then installs DSH automatically.
- After a successful install, a **"DeepSeek Harness" desktop shortcut** is created automatically.

> Note: install.bat is a plain-text script — right-click it and choose "Open with → Notepad" to review its full content before running. Scripts downloaded from the internet are unsigned, so Windows may show a SmartScreen warning ("Windows protected your PC"); click "More info → Run anyway". This is a standard Windows prompt for unsigned scripts, not a virus warning.

### Step 2: Open the DSH interface

Double-click the "DeepSeek Harness" desktop shortcut. The browser opens the DSH web UI, where you'll see the "Click Here to Configure Free API Models" button at the bottom left.

![DSH main UI](screenshots/1.png)

### Step 3: Enter the Zero-Cost API Config Center

Click the button to open the **Zero-Cost API Config Center**, which lists the free models currently available.

![Zero-Cost API Config Center](screenshots/2.png)

### Step 4: Apply for and fill in your API Key

Follow the guide in the Zero-Cost API Config Center to register on the corresponding platform and obtain a free model API Key. Fill it in and enable it. You can install one or more free models.

![Model picker dropdown](screenshots/3.png)

### Step 5: Switch to a free model and use DSH at zero cost

Once configured, return to the DSH UI and select your free model in the model picker to start using DSH for free.

### Step 6: Use the paid DeepSeek model

If you decide to go paid and have already applied for a DeepSeek model API, click "Settings" at the bottom left of the DSH UI, find "Models", click "Edit" on DeepSeek, and enter your DeepSeek API key.

### Step 7: DeepSeek pricing reminder

When you switch to a DeepSeek model in the DSH UI, a real-time reminder appears at the bottom left. Based on DeepSeek's official API peak/off-peak schedule, it shows either "API is charged at full price during peak hours" or "API is charged at half price during off-peak hours", providing "Zero Loss of Control" fee protection.

![Peak hours: full price](screenshots/4.png)

![Off-peak hours: half price](screenshots/5.png)

## Domestic Mirror (Gitee)

A Gitee mirror is provided for users in mainland China and is now live:

- **Gitee mirror**: `https://gitee.com/ai-yukin/dsh-0-tools`

Notes:

- This repository uses **GitHub as the primary source** (`https://github.com/ai-yukin/dsh-0-tools`); Gitee is a domestic mirror kept consistent with the primary repository.
- The mirror is maintained by manual sync. Updates to the primary repository will be reflected on the mirror shortly after. For the latest version, please refer to the GitHub primary repository.
- For issues or suggestions, please file them in the Issues section of the GitHub primary repository.

## Compatibility

This plugin is developed and verified against the following DSH versions:

| DSH Version | Status |
|------|------|
| `0.1.1-rc.2` | Tested & verified (page load / pricing bar / model picker / settings tab / official config channel) |

> **v1.5.0 compatibility notice**: This version uses DSH's official same-origin config channel (`/api` RPC), relying on its atomic writes, input validation and revision fencing. The minimum supported DSH version is therefore **raised to `0.1.1`**. The previously declared `0.1.0-rc.7` baseline was never really verified and is no longer promised. If your DSH is older than `0.1.1`, upgrade DSH first before installing this plugin (check your version with `dsh --version`; check the latest with `npm view @deepseek-ai/dsh versions`). If DSH releases a new major version (e.g., `0.2.x`), check this plugin's Release notes for compatibility before upgrading.

## Project Structure

```
dsh-0-tools/
├── lib/
│   ├── index.js     # host side: no-op stub since v1.5.0 (config I/O moved to the browser half via the official channel)
│   └── client.js    # browser side: bottom-left toolbar + "No.0 Tools" settings tab + config read/write via official /api
├── cordis.patch.yml # web profile injection declaration
├── package.json
├── help.json        # online data source for the help center (hosted on GitHub Pages)
└── install.bat      # one-click install + launch + verify
```

## How It Works

> **v1.5.0 architecture change**: Earlier versions (≤ v1.4.x) had the host side open a local `127.0.0.1:3090~3099` service and rewrite config files with regexes. That self-hosted service had no origin check (any local web page could trigger writes — proven exploitable in the security audit), and raw regex writes raced DSH's own atomic writes and silently dropped unknown fields. Since v1.5.0 all of it goes through **DSH's official same-origin config channel**, eliminating those security and data risks; the host side is now just an empty stub.

- **Config status detection**: The browser side calls the official `settings.describe` + `credentials.describe` to check whether `llm-pi-ai.providers.zai` exists and whether its credential is configured, as the source of truth; it polls every 5 seconds to refresh the UI.
- **One-click config**: Via the official channel in sequence — `credentials.set` writes the `ZAI_API_KEY` credential, `settings.mutate` writes the `llm-pi-ai.providers.zai` provider block, and `settings.update` switches the default model to Zhipu `glm-4.7-flash` using merge semantics (so user-set fields like `reasoningEffort` are preserved, not wiped).
- **One-click uninstall**: Removes the zai provider block and its credential via the official channel; only if the default model previously pointed at zai does it restore the original default recorded before configuration, otherwise it leaves your current selection untouched.
- **Stale-config cleanup**: The Config Center detects locally retained providers that have been retired/removed (dynamically reading each provider's `apiKeyEnv` instead of relying on a static local list), shows a "stale residue" notice, and offers one-click cleanup so orphaned configs can always be removed.
- **Settings tab**: Injected via the `settings.section` slot (the same mechanism official plugins use), id `dsh-0-tools`, tab name "No.0 Tools".
- **Help center**: Fetches `https://ai-yukin.github.io/dsh-0-tools/help.json` and runs it through a unified `filterRemotePayload` sanitizer (URLs forced to https, text fields reject control chars/newlines, model ids and credential names pass character whitelists) before it reaches the UI or the config chain; falls back to bundled data on failure or non-compliant entries. Both the installable model list and the retired model list are driven by this remote data, so adding or retiring models requires no plugin reinstall.

## Disclaimer

- This plugin is a **third-party community plugin**, not affiliated with DeepSeek or Zhipu AI; the official vendors do not provide support for it.
- When using this plugin to connect to third-party model services, please comply with the respective platform's terms of service and pricing policies.
- This project is open-sourced under the MIT License. Users assume all risk of usage.

## License

[MIT](LICENSE) © 2026 ai-yukin
