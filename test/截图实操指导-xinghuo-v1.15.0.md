# 讯飞教程页截图实操指导（v1.15.0 · 两页共 10 张）

v1.15.0 把讯飞教程拆成两页，各页流程**不同**、互不重叠：

| 页面 | 面向谁 | 步数 |
|---|---|---|
| `guide/xinghuo.html` | **没配置过讯飞的新用户** | 6 步 |
| `guide/xinghuo-upgrade.html` | **已创建过 API Key 的老用户** | 5 步 |

存放位置：`guide/images/xinghuo/`（6 张）与 `guide/images/xinghuo-upgrade/`（4 张）

---

## 一、新用户页 `images/xinghuo/`（6 张）

| # | 文件名 | 页面 | 必须拍到 |
|---|---|---|---|
| 1 | `01-讯飞开放平台登录页.png` | xfyun.cn 首页 | 「立即注册」+ 微信扫码登录入口 |
| 2 | `02-模型广场SparkX2.5-1.7B.png` | 模型广场列表 | Spark-X2.5-1.7B 卡片 +「1M」「0 元/百万 tokens」标注 |
| 3 | `03-模型详情页API调用.png` | 模型详情页 | 上下文 1M、定价 0 元、「API 调用」按钮 |
| 4 | `04-创建APIKey.png` | API 调用弹窗第一步 | 「+ 创建 API Key」按钮与新建表单 |
| 5 | `05-开通服务.png` | 同弹窗 | 那句「暂未开通模型服务」+ 协议复选框 +「开通服务」按钮 |
| 6 | `06-调用示例与APIKey.png` | 第二步调用示例 | API Key（`ak-` 开头）、Model ID、接口地址 +「复制」 |

---

## 二、老用户页 `images/xinghuo-upgrade/`（4 张）

| # | 文件名 | 页面 | 必须拍到 |
|---|---|---|---|
| 1 | `01-模型详情页API调用按钮.png` | 模型详情页 | 「API 调用」按钮 + 卡片「0 元」标注 |
| 2 | `02-选择APIKey弹窗.png` | API 调用弹窗第一步 | **已有 Key 列表** + 那句「该 API Key 暂未开通模型服务」 |
| 3 | `03-开通服务.png` | 同弹窗 | 协议复选框 +「开通服务」按钮 |
| 4 | `04-调用示例与APIKey.png` | 第二步调用示例 | 同新用户第 6 张 |

⭐ **第 2 张是老用户页最关键的一张** —— 用户就是被这句话卡住的，
截图里必须完整显示「该 API Key 暂未开通模型服务，点击下方「开通服务」按钮即可开通并正常调用。」

---

## 三、替换方式

占位框：

```html
<div class="shot-pending">
  <span class="shot-name">images/xinghuo/01-xxx.png</span>
  <div class="shot-what">待补截图：……</div>
</div>
```

整块换成一行（`.step-img` 样式已定义，不必额外加 class）：

```html
<img src="images/xinghuo/01-xxx.png" alt="说明文字" class="step-img">
```

---

## 四、截图纪律

### 必须打码

**API Key 是唯一必须打码的东西**，出现在第 6 张（或第 4 张）。

- 从 `ak-` 开始到结束**整串盖住**
- 不要只盖中间几个字符 —— 官方示例是 `ak-f30b1********fc84b82e86a` 这种两头露出来的形式
- 用**实心**黑/灰色块或马赛克，**不要半透明**（压缩后可能透出来）

> 弹窗里 Key 列表本身就是 `**********` 脱敏显示的（讯飞自己脱敏的），可直接拍。

### 画面要求

- 浏览器窗口宽度约 **1400–1600px**，与旧教程页比例一致
- 关键按钮/字段用红框或箭头标出（推荐）
- 不含书签栏、其他标签页标题、桌面壁纸

### 内容准确性

若页面上显示的**接口地址 / Model ID / API Key 三项**与教程页核对表不符，
说明开通的不是 Spark-X2.5-1.7B，**先别截图**，回模型广场重新确认。

⚠️ 特别提醒：模型广场里还有一个**同名的 Spark-X2.5（293B）**，那个**要收费**
（输入 0.96 元/百万 tokens）。要拍的是 **1.7B** 版本，卡片上标着「1M」和「0 元」。

---

## 五、拍完自查

```bash
# 1. 两页都应无占位框（各输出 0）
grep -c 'shot-pending' guide/xinghuo.html
grep -c 'shot-pending' guide/xinghuo-upgrade.html

# 2. 图片齐全
ls guide/images/xinghuo/ guide/images/xinghuo-upgrade/

# 3. 跨页互链正确（各有 1 处指向对方）
grep -c 'xinghuo-upgrade.html' guide/xinghuo.html
grep -c 'xinghuo\.html' guide/xinghuo-upgrade.html

# 4. 回归测试
python test/test-v1140.py
```

---

## 六、两页流程口述版（拍摄时对照）

**新用户（6 步）**
1. 注册登录讯飞开放平台（微信扫码，**无需实名**）
2. 进星辰 MaaS 模型广场 → 找 Spark-X2.5-1.7B（标「1M」「0 元」）→ 点「API 调用」
3. 弹窗第一步「选择 API Key」→ 点「+ 创建 API Key」→ 填名称 → 提交
4. 勾选协议 → 点「开通服务」
5. 第二步调用示例 → 复制 `ak-` 开头的 Key
6. 核对三项（接口地址 / Model ID / API Key）

**老用户（5 步）**
1. 登录 → 模型广场 → Spark-X2.5-1.7B → 点「API 调用」
2. 弹窗第一步 → **选中自己原来那个 Key** → 看到「暂未开通模型服务」提示
3. 勾选协议 → 点「开通服务」
4. 第二步 → 复制 `ak-` 开头的 Key
5. 核对三项

⭐ **老用户的核心认知**：「Key 存在」≠「已开通模型」。
两个 Key（2025 年的、2026 年的）都可能显示「暂未开通」，都要点一次「开通服务」。

---

## 七、平台入口备忘

- 讯飞开放平台（注册登录）：`https://www.xfyun.cn/`
- 星辰 MaaS 模型广场：`https://maas.xfyun.cn/modelSquare`
- Spark-X2.5-1.7B 详情页：`https://maas.xfyun.cn/modelSquare/base/2624338063517705?sort=0&inputValue=&userSelectCategoryList=&userSelectCategory=%255B%255D`
- ❌ `console.xfyun.cn/services/bm35`（Spark Lite 服务页，已下架）

官方文档：`https://www.xfyun.cn/doc/spark/产品使用说明.html`