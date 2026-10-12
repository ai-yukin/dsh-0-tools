# Changelog

This file records how dsh-0-tools has evolved. **The README describes only the current state** —
read it to learn what the tool does today; read this to find out when a feature was added and why.

Installers and release notes for each version: [Releases](https://github.com/ai-yukin/dsh-0-tools/releases).

---

## What's New in v1.16.3

**After you switch to the new iFlytek key, the red "model retired" notice now clears itself.**

The notice used to appear whenever an iFlytek provider was configured at all — which
stayed true after you pasted the new key, so it kept showing and made it look like the
switch had failed. It now compares the model actually in your settings: the notice stays
while the old model is still configured and disappears once the new one is in place,
replaced by a single "讯飞星火模型已经完成更新" line.

**Also tidied up the settings page structure:**

- The help center and the about panel are merged into one card (they answered the same
  questions, so splitting them forced needless scrolling and showed the version twice);
- The help center is now a single block: project / version / author / WeChat / feedback on
  one line, with DSH official resources and API Key backup below;
- Added "关注作者公众号", which shows a QR code;
- "精选资料" is now "工具资料", listing only the repository and the issue tracker.

## What's New in v1.16.0

**iFlytek Spark has a new model — existing users need to authorize their current key once (about 2 minutes).**

iFlytek delisted the previous free model (Spark Lite). The currently-free model is
**Spark-X2.5-1.7B** (1M context, 0 CNY per million tokens).
**The old and new credential systems are unrelated**, and the plugin cannot rewrite your
config automatically — you need to authorize on the official site and paste the new key back.

**Full illustrated guide (with a way to tell which page you need)**:
[Existing users](https://ai-yukin.github.io/dsh-0-tools/guide/xinghuo-upgrade.html) ·
[New users](https://ai-yukin.github.io/dsh-0-tools/guide/xinghuo.html)

**Three steps (existing users)**:

| Step | What to do |
|---|---|
| 1 | Log in, open the left sidebar **「模型服务」→「API Key 管理」**, find the key you already have, click **「授权管理」** |
| 2 | Tick **`Spark-X2.5-1.7B`** in the dialog, then click **「确认授权」** |
| 3 | Back on the list, click **「复制」** for that row, and paste the `ak-`-prefixed key into the config center |

⚠️ **Do not tick `Spark-X2.5` (293B)** — that one **costs money** (0.96 CNY per million input
tokens). The free one is `Spark-X2.5-1.7B`; the two sit right next to each other in the list,
so it's easy to click the wrong one.

> If you already followed the earlier guide, no need to undo anything — authorizing an extra
> model does no harm; just tick it.

> v1.16.0 does not change the DSH compatibility range (still `0.1.5` through `0.2.x`); all v1.15.0 and earlier capabilities are retained.

## What's New in v1.15.0

**Saying out loud that you need a new key.**

If you still had iFlytek configured after it was delisted, nothing told you so — the plugin
can't rewrite your config, and automatic routing quietly routed around it. Everything
"looked fine" while you were actually not using that model at all.

This release adds three layers of notice: the footer's new-version badge now **states the
reason** (not just a version number); the config center shows a **red box** for anyone still
configured with iFlytek, with a button straight to the guide; and the guide is split into
**two pages** (new users / existing users) so you can pick the right one — existing users take
about 2 minutes, with no re-registration and no new key.

> v1.15.0 does not change the DSH compatibility range (still `0.1.5` through `0.2.x`); all v1.14.0 and earlier capabilities are retained.

## What's New in v1.14.0

iFlytek's free model `Spark Lite` has been **delisted** (thanks to the report in
[Issue #2](https://github.com/ai-yukin/dsh-0-tools/issues/2)). The plugin now uses the
currently-free **Spark-X2.5-1.7B** (1M native context, 0 CNY per million tokens).

| Change | To |
|---|---|
| **Model** | `Spark Lite` (delisted) → **`Spark-X2.5-1.7B`** |
| **Endpoint** | → `https://maas-api.cn-huabei-1.xf-yun.com/v2` |
| **Model ID** | → `spark-x2.5-1.7b` |
| **Key format** | → a single `ak-`-prefixed string (no longer an `APIKey:APISecret` pair). The plugin auto-detects it — **just paste the new key** |
| **Capability ranking** | Re-ordered to match the new model's real ability, so **automatic switching picks models in the right order** |

⚠️ **If you configured iFlytek Spark before v1.14.0**: the plugin **will not rewrite your local
configuration automatically**, because the old and new credential systems are unrelated — you need
to replace the key manually (about 2 minutes). Until you do, automatic switching routes around the
unusable Spark provider — **everything looks fine in the UI, but you have not actually been using iFlytek**.

> v1.14.0 does not change the DSH compatibility range (still `0.1.5` through `0.2.x`); all v1.13.0 and v1.12.0 capabilities are retained.

## What's New in v1.13.0

Built around two ideas: **no interruption** and **no forgetting**.

| Capability | Details |
|------|------|
| **No interruption: switches now say why** | When the current model runs out of quota, gets its key rejected, times out, hits a rate limit, or returns a server error, the plugin switches to the best available model and tells you **which one you were on, why it stopped working, and what you are on now**. The notice stays up for 60 seconds instead of 10 — the old 10-second window was too short to actually notice. |
| **No forgetting: switch log survives restarts** | Every automatic switch is recorded with time, reason, and direction. The config center shows the last 10 entries for up to a week. Free models commonly "work in the morning, run out by afternoon" — you need to see **how many times you were switched today and which channel needs more quota**, not a toast that vanishes. |
| **No forgetting: automatic routing on by default** | Previously you had to go turn it on in settings. Now it is on for new installs, with a one-time note explaining why it is on and how to turn it off. **If you explicitly chose manual switching, you stay on manual** — your choice is never overridden by a default. |
| **No forgetting: errors stop being silent** | After a switch, the plugin points at the next actionable step (re-test in the config center) instead of just reporting a fait accompli. |

> v1.13.0 does not change the DSH compatibility range (still `0.1.5` through `0.2.x`) or the health-check criteria.
> All five v1.12.0 capabilities (version check, latency persistence, config rollback, error guard, DSH version display) are retained.

## What's New in v1.12.0

| Capability | Details |
|---|---|
| **Automatic update check** | The plugin compares its version against the published one remotely. When a new release exists, a `⬆ 有新版 vX.X.X` badge appears in the footer, links straight to the Release page, and lists what changed. Click `✕` to stop being reminded about that version — a newer release will remind you again. No forced pop-ups; upgrading is your call. |
| **Speed-check history survives restarts** | The last five latency samples per model are persisted, so reopening DSH reuses them instead of starting from scratch. They expire after 24 hours — free-model quota state changes daily, so yesterday's verdict is worthless. |
| **Automatic rollback on failed writes** | Adding a free model takes three writes (credential → provider config → default model). If a later step fails, the earlier ones are rolled back automatically and you get a clear message, instead of a half-applied configuration. |
| **Global error guard** | Any error inside the plugin is captured, rate-limited to once per 60 seconds, logged to the console under an `[dsh-0-tools]` prefix, and stored locally with context. It does **not** swallow errors — DSH's own error reporting is unaffected. |
| **DSH version display** | The About card now shows the DSH version actually running alongside the verified support range, saving a round-trip when diagnosing compatibility. |

> **On "upgrade your DSH"**: this plugin only announces new releases of **itself**.
> DSH is DeepSeek's upstream software — a plugin has no standing to ask you to upgrade it.
> `v1.12.0` supports both DSH `0.1.x` and `0.2.x`, so **you do not need to upgrade DSH to use this plugin**.
