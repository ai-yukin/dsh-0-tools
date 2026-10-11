# 讯飞教程页截图实操指导（v1.14.0）

旧教程页的 9 张 Spark Lite 截图**已全部失效**（模型下架，页面结构也变了），
现在 `guide/xinghuo.html` 里是 6 个 `.shot-pending` 占位框，等实拍后替换。

---

## 一、要拍哪6 张

| # | 文件名 | 页面 | 必须拍到 |
|---|---|---|---|
| 1 | `01-星辰MaaS登录页.png` | maas.xfyun.cn 登录页 | 手机号登录入口、"免费版"标识 |
| 2 | `02-模型广场限时免费列表.png` | 模型广场列表 | "限时免费"筛选器 + Spark-X2.5-1.7B 卡片 |
| 3 | `03-SparkX2.5-1.7B详情页.png` | 模型详情页 | 免费到期时间 + "API 调用"按钮 |
| 4 | `04-API调用配置弹窗.png` | "API 调用"弹窗 | API 名称输入框 + 应用下拉（含"前往创建应用"） |
| 5 | `05-创建应用表单.png` | 创建应用表单 | 应用名称/描述字段 + "提交"按钮 |
| 6 | `06-推理服务页APIKey.png` | 推理服务列表 | **API Key（ak- 开头）、Model ID、接口地址三列** + "复制"按钮 |

存放位置：`guide/images/xinghuo/`（该目录已保留，现为空）

---

## 二、替换方式

占位框长这样：

```html
<div class="shot-pending">
  <span class="shot-name">images/xinghuo/01-星辰MaaS登录页.png</span>
  <div class="shot-what">待补截图：……</div>
</div>
```

**整块换成一行 `img`**（`.step-img` 样式已定义好，不必额外加 class）：

```html
<img src="images/xinghuo/01-星辰MaaS登录页.png" alt="星辰MaaS登录页" class="step-img">
```

`.shot-name` 里写的文件名就是应该保存的文件名，对齐即可。

---

## 三、截图纪律（重要）

### 必须打码

**API Key 是唯一必须打码的东西。** 它就在第 6 张图里。

- 覆盖范围：从 `ak-` 开始到结束，**整串盖住**
- 不要只盖中间几个字符 —— 讯飞 Key 是 `ak-f30b1********fc84b82e86a` 这种形式，两头露出来也等于泄露
- 打码用纯色块或马赛克都行，**别用半透明**（截图压缩后可能透出来）

>建议做法：先完整截图 → 打开图片编辑器 → 用实心黑/灰色矩形盖住 Key → 保存。
>旧教程页的 9 张图都是打码后才入库的，保持同一标准。

### 画面要求

- **浏览器窗口宽度约 1400–1600px**，与旧教程页比例一致
- 页面**从上往下完整显示**，不要滚动截半截
- 关键按钮/字段用红框或箭头标出来（可选但推荐，用户扫一眼就知道要点哪）
- 不要包含浏览器书签栏、其他标签页标题、桌面壁纸

### 内容准确性

第 6 张图是**最关键**的（用户照着它抄 Key），必须清楚拍到：

- API Key 是 `ak-` 开头
- Model ID 是 `spark-x2.5-1.7b`
- 接口地址是 `https://maas-api.cn-huabei-1.xf-yun.com/v2`

**如果这三个和你页面上显示的不一样**，说明开通的不是 1.7B 这个模型，
**先别截图**，回第 2 步在模型广场重新确认选的是哪个模型。

---

## 四、拍完后的自查

```bash
# 1. 确认 6 张图都在
ls guide/images/xinghuo/

# 2. 确认教程页已无占位框（应输出 0）
grep -c 'shot-pending' guide/xinghuo.html

# 3. 确认没有指向已删除的旧图
grep -o 'images/xinghuo/[0-9-]*[^"]*\.png' guide/xinghuo.html

# 4. 跑回归测试（包含教程页相关断言）
python test/test-v1140.py
```

第2 项输出不是 0，说明还有占位框没换掉。

---

## 五、平台入口备忘

-星辰 MaaS 平台（本次要用）：`https://maas.xfyun.cn/modelSquare`
- Spark-X2.5-1.7B 详情页：`https://maas.xfyun.cn/modelSquare/base/2624338063517705?sort=0&inputValue=&userSelectCategoryList=&userSelectCategory=%255B%255D`
- ❌ 讯飞开放平台 `console.xfyun.cn` —— **不是这个**，Spark Lite 在那里已下架，两平台密钥不通用

官方文档：`https://www.xfyun.cn/doc/spark/产品使用说明.html`

---

## 六、六个步骤的口述版（拍摄时对照用）

1. **注册登录星辰 MaaS 平台** —— 手机号注册，默认免费版，**无需实名认证**
2. **模型广场找Spark-X2.5-1.7B** —— 筛"限时免费"或搜索，点"API 调用"
3. **开通模型并关联应用** —— 填 API 名称，选已有应用或点"前往创建应用"，确定
4. **创建应用** —— 名称/描述随意，提交，无审核
5. **推理服务页复制 API Key** —— 自动跳转或手动点左侧"推理服务"，复制 `ak-` 开头那个
6. **核对三项** —— 接口地址 / Model ID / API Key 逐项比对教程页里的表