# dsh-0-tools No.0 Tools

[English](./README.en.md) · [简体中文](./README.md)

## What Is No.0 Tools

No.0 Tools is designed for users with no programming background who are trying DeepSeek Harness (DSH) for the first time. It offers "Zero Threshold, Zero Cost, Zero Loss of Control" and aims to give zero-baseline users a better experience.

## Key Features

1. **Zero Threshold** — One-click installation of DSH and this tool.
2. **Zero Cost** — One-click configuration of free API models for DSH (currently Zhipu GLM).
3. **Zero Loss of Control** — When calling the DeepSeek model API, the DSH UI shows real-time pricing (full price or half price).
4. **Zero Threshold** — A help center with curated, trustworthy sources to help beginners master DSH faster.

## Version & Compatibility

- Current version: **v1.5.0**
- Compatible DSH versions: `0.1.0-rc.7` – `0.1.1-rc.2`
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
| `0.1.0-rc.7` | Development baseline (peerDependency `^0.1.0-rc.7`) |
| `0.1.1-rc.2` | Tested & verified (page load / pricing bar / model picker / settings tab) |

> Before installing, make sure your DSH version is within `0.1.0-rc.7` – `0.1.1-rc.2` (check the latest version with `npm view @deepseek-ai/dsh versions`). If DSH releases a new major version (e.g., `0.2.x`), check this plugin's Release notes for compatibility before upgrading.

## Project Structure

```
dsh-0-tools/
├── lib/
│   ├── index.js     # host side: loopback service on 127.0.0.1:3090~3099 (/status /configure /uninstall)
│   └── client.js    # browser side: bottom-left toolbar + "No.0 Tools" settings tab
├── cordis.patch.yml # web profile injection declaration
├── package.json
├── help.json        # online data source for the help center (hosted on GitHub Pages)
└── install.bat      # one-click install + launch + verify
```

## How It Works

- **Config status detection**: The host side reads `~/.dsh/settings.yaml` and checks whether `llm-pi-ai.providers.zai` exists, using it as the source of truth; the browser side polls `GET /status` every 5 seconds.
- **One-click config**: `POST /configure` writes the `ZAI_API_KEY` credential and the `llm-pi-ai.providers.zai` provider block, and switches the default model to Zhipu `glm-4.7-flash`.
- **One-click uninstall**: `POST /uninstall` removes the zai provider block and credential, and switches the default model back to DeepSeek official `deepseek-official / deepseek-v4-flash`.
- **Stale-config cleanup**: The Config Center detects locally retained providers that have been retired/removed (e.g., a free model you once configured that is no longer available), shows a "stale residue" notice, and offers one-click cleanup so orphaned configs can always be removed.
- **Settings tab**: Injected via the `settings.section` slot (the same mechanism official plugins use), id `dsh-0-tools`, tab name "No.0 Tools".
- **Help center**: Fetches `https://ai-yukin.github.io/dsh-0-tools/help.json` and compares versions; falls back to bundled data on failure. Both the installable model list and the retired model list are driven by this remote data, so adding or retiring models requires no plugin reinstall.

## Disclaimer

- This plugin is a **third-party community plugin**, not affiliated with DeepSeek or Zhipu AI; the official vendors do not provide support for it.
- When using this plugin to connect to third-party model services, please comply with the respective platform's terms of service and pricing policies.
- This project is open-sourced under the MIT License. Users assume all risk of usage.

## License

[MIT](LICENSE) © 2026 ai-yukin
