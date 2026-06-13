# 群星 Stellaris · 科技树可视化

> 🤖 **本项目全程由 [GLM-5.2](https://huggingface.co/zai-org)（智谱）自主完成。**
> 从游戏数据解析、ELK 布局算法、暗色科幻风前端到 GitHub Pages 部署，全流程由 AI 自主开发，用于测试 AI 编码能力。

把 Stellaris（群星）全部 **662 个科技**按学科 / 层级 / 前置关系精美可视化的静态网页。
采用游戏目录的**官方简体中文**本地化与原始图标素材，深色科幻风界面。

![preview](tools/shots/01-physics.png)

## 特性

- 🌌 **深色科幻风**：深空黑背景 + 星点漂浮 + 学科色辉光，贴近游戏内研究界面
- 🎋 **三大学科切换**：物理学（162）/ 社会学（311）/ 工程学（189），ELK 分层算法自动布局
- 🔗 **完整前置关系**：582 条科技树边，含 13 个「任一前置」OR 组，hover 高亮关联连线
- 🔍 **搜索 + 多维筛选**：按中文名/ID 搜索，按层级(T0–T5)、13 个子类别、稀有/危险/起始/可逆向 筛选
- 📋 **详情面板**：点击节点看成本（数值+原宏）、权重、官方中文描述、前置/解锁、实际游戏效果、DLC 来源
- 🎁 **可重复科技**：默认折叠，可展开
- 📐 **精准严谨**：成本/权重宏全部解析为真实数值（如 `@tier5cost3 → 24000`），数据源自游戏文件交叉验证

## 快速开始

数据已预构建，直接起一个本地服务器即可（前端用 ES Modules + fetch，需 http 服务而非 file://）：

```bash
cd public
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 从游戏数据重新构建

游戏更新或想刷新数据时，重新跑构建管线（**游戏目录只读，绝不修改**）：

```bash
# 1. 解析科技定义/宏/本地化，DDS→PNG 雪碧图，输出 public/data 与 public/assets
python3 build.py

# 2. ELK 布局预计算（需 elkjs）
npm install elkjs
node tools/layout.js

# 3. 一致性校验（可选）
python3 tools/verify.py
```

游戏目录默认读取（`~` 会在运行时展开为你的家目录）：
```
~/.local/share/Steam/steamapps/common/Stellaris/
```
如路径不同，设环境变量 `STELLARIS_PATH`，或改 `build.py` 顶部的 `GAME`。

## 数据来源（全部官方，只读）

| 用途 | 游戏目录路径 |
|------|-------------|
| 科技定义 | `common/technology/*.txt` |
| 层级 / 类别 | `common/technology/tier/`、`category/` |
| 成本权重宏 | `common/scripted_variables/*.txt` |
| 简中本地化 | `localisation/simp_chinese/*.yml` |
| 科技图标 | `gfx/interface/icons/technologies/*.dds` |

## 技术栈

- **构建**：Python 3 + Pillow（DDS 解码 / 雪碧图）、自研 Paradox 脚本递归解析器
- **布局**：ELK.js（layered 算法，构建时预计算坐标，浏览器零运行时成本）
- **前端**：原生 JS + ES Modules，HTML 节点 + SVG 边 + CSS transform 缩放平移，无框架无打包

## 项目结构

```
StellarisTechTree/
├─ build.py                # 数据构建管线
├─ tools/
│  ├─ layout.js            # ELK 布局预计算
│  ├─ verify.py            # 一致性校验
│  ├─ screenshot.js        # 截图（开发用，需 playwright）
│  └─ verify-dom.js        # DOM 确定性验证（开发用）
├─ public/                 # ← 用 http.server 指向这里
│  ├─ index.html
│  ├─ css/{main,graph}.css
│  ├─ js/{app,graph,detail-panel,search-filter,starfield}.js
│  ├─ data/*.json          # build.py 生成
│  └─ assets/*.png         # 雪碧图
└─ package.json
```

## 操作

- **拖拽**空白处平移，**滚轮**缩放（围绕鼠标）
- 点击节点看详情；详情面板里的前置/解锁链接可跳转
- 顶部搜索框支持中文名与 `tech_` ID
- 左侧栏按层级 / 类别 / 标记筛选

> 数据源自 Stellaris 游戏文件，仅供学习与游戏辅助展示。
