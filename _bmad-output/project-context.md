---
project_name: 'SD-Tool'
user_name: 'SUGA'
date: '2026-05-09'
sections_completed: ['technology_stack', 'critical_implementation_rules']
existing_patterns_found: 12
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| 层级 | 技术 | 详情 |
|------|------|------|
| **标记** | HTML5 | 语义化标签, `lang="zh-CN"` |
| **样式** | CSS3 | 自定义属性 (Obsidian 暗色主题), 约 600 行 |
| **脚本** | Vanilla JavaScript (ES6+) | ES6 `class`, `const`/`let`, 箭头函数, 模板字面量 |
| **图形** | HTML5 Canvas 2D API | 双画布架构 (主画布 + 小地图), `devicePixelRatio` HiDPI 适配 |
| **存储** | `localStorage` | 单键: `sd-tool-model`, JSON 序列化 |
| **文件 I/O** | FileReader + Blob API | JSON 导出/导入 |
| **依赖** | **零外部依赖** | 无 `package.json`, 无 npm, 无构建工具, 无框架 |

---

## Critical Implementation Rules

### 1. 架构模式 — 基于类的模块化设计

项目中**每个文件定义一个 ES6 类**, 通过 `SDToolApp` 主控制器进行依赖注入组装:

| 类文件 | 职责 |
|--------|------|
| `js/app.js` — `SDToolApp` | 应用控制器, 协调各子系统, 暴露 `window.app` 全局引用 |
| `js/data-model.js` — `SDModel` | 数据模型: nodes[], connections[], selectedId/Type |
| `js/canvas-renderer.js` — `CanvasRenderer` | Canvas 2D 渲染: 网格、节点、连线、箭头、小地图 |
| `js/interaction.js` — `InteractionHandler` | 鼠标/键盘/触摸输入处理 + 状态机 |
| `js/ui.js` — `UIManager` | DOM UI 管理: 属性面板、模态框、模块列表、上下文菜单 |
| `js/persistence.js` — `PersistenceManager` | localStorage 保存/加载 + JSON 文件导入/导出 |
| `js/undo-redo.js` — `UndoRedoManager` | 基于完整模型快照的撤销/重做 (最大 200 步) |

**规则**: 新增功能必须作为某个现有类的方法添加, 或创建新类并通过 `SDToolApp` 构造函数注入。**不存在模块导入/导出** — 所有脚本通过 `index.html` 中的 `<script>` 标签按依赖顺序加载。

### 2. 脚本加载顺序 (index.html 中 `<script>` 的顺序)

```
js/constants.js    → NODE_TYPE_CONFIG, DEFAULTS, 工具函数
js/utils.js        → generateId(), fmtNum(), clamp(), findNodeAt(), findConnectionAt()
js/data-model.js   → SDModel 类
js/canvas-renderer.js → CanvasRenderer 类
js/interaction.js  → InteractionHandler 类
js/ui.js           → UIManager 类
js/persistence.js  → PersistenceManager 类
js/undo-redo.js    → UndoRedoManager 类
js/app.js          → SDToolApp 类 (最后加载, 依赖所有以上)
```

**规则**: 新增 JS 文件必须按依赖顺序插入到此序列中。全局使用的工具函数放在 `utils.js` 中。配置常量放在 `constants.js` 中。

### 3. 数据模型 — 平坦结构

`SDModel` 使用**平坦数组结构**, 无嵌套:

```javascript
nodes: [
  { id: 'n_xxx', type: 'stock' | 'source-sink', name, x, y, value, rate, isSource, unit, description }
]
connections: [
  { id: 'c_xxx', fromId, toId, name, flowRate, direction: 'positive' | 'negative', flowType: 'variable' | 'constant' }
]
```

**规则**:
- 节点 ID 前缀: `n_` + 8 位 hex
- 连线 ID 前缀: `c_` + 8 位 hex
- 节点类型只有两种: `'stock'` 和 `'source-sink'`
- 连线方向: `'positive'` (正反馈) 或 `'negative'` (负反馈)
- 流量类型: `'variable'` (可变流量, 倒三角) 或 `'constant'` (不变流量, 圆圈)
- 模型更新通过 `model.updateNode(id, { field: value })` / `model.updateConnection(id, { field: value })` 使用对象展开

### 4. 序列化与撤销/重做

- `SDModel.toJSON()` 完整序列化为 `{ nodes, connections }` (仅导出数据, 不含 selectedId/selectedType)
- `SDModel.fromJSON(data)` 从 JSON 数据重建模型
- `UndoRedoManager` 存储**完整的模型快照** (无命令模式), 最大 200 步
- 所有修改操作 (创建/删除/编辑节点或连线) 必须调用 `undoRedo.pushState()`

### 5. Canvas 渲染系统

- **双画布**: 主画布 (`#diagram-canvas`) + 小地图 (`#minimap-canvas`)
- **视口**: `offsetX`, `offsetY`, `zoom` (0.1–5x) 存储在 `CanvasRenderer` 上
- **坐标转换**: `w2s(wx, wy)` 世界→屏幕, `s2w(sx, sy)` 屏幕→世界
- **绘制顺序** (在 `render()` 中固定): 网格 → 连线 → 节点 → 临时连线 → 小地图
- **节点几何**:
  - `stock`: 矩形圆角, 宽度 120×zoom, 高度 80×zoom, 圆角半径 8×zoom
  - `source-sink`: 云形 (16段多边形模拟), 半径 60×zoom
- **字体缩放**: 通过 `scaledFont(fontStr)` 方法 — 解析 CSS font 中的 px 值乘以 zoom, 限制在 8–48px

**规则**: 修改节点外观时, 所有尺寸必须乘以 `this.zoom` 以确保缩放一致。使用 `NODE_TYPE_CONFIG[node.type]` 获取颜色/图标/标签, 不要硬编码。

### 6. 交互状态机

`InteractionHandler.mode` 使用字符串状态:

| 状态 | 含义 |
|------|------|
| `'idle'` | 空闲, 等待输入 |
| `'dragging_node'` | 拖拽节点移动 |
| `'panning'` | 平移画布 (Alt+拖拽 或 中键拖拽) |
| `'connecting'` | 正在进行连线操作 (从某节点拖出线) |

**规则**:
- 所有状态转换必须显式设置 `this.mode`
- 拖拽完成后必须将 `mode` 重置为 `'idle'`
- `dragTarget` / `connectFromId` 在操作完成后必须清空

### 7. DOM 事件模式

- **窗体事件** 绑定在 `window` 上 (`mousemove`, `mouseup`, `keydown`, `touchmove`) 以处理画布外的鼠标释放
- **画布事件** 绑定在 `this.canvas` 上 (`mousedown`, `wheel`, `touchstart`, `contextmenu`)
- 所有事件处理器使用 `.bind(this)` 绑定
- 右键菜单通过 `window` 上的 `click` 事件处理隐藏

### 8. 命中检测

- `findNodeAt(wx, wy, nodes)` — 基于节点类型的几何检测
  - `stock`: 矩形包围盒
  - `source-sink`: 圆形包围盒 (半径约 45 像素)
- `findConnectionAt(wx, wy, connections, nodes, threshold=10)` — 点到线段的距离检测

### 9. UI 属性面板

- 属性面板通过 `renderNodeProperties(node)` / `renderConnectionProperties(conn)` 动态渲染 HTML
- 输入控件使用 `data-field` 属性标识要更新的字段名
- `change` 事件触发 `model.updateNode()` / `model.updateConnection()`
- 数值字段使用 `parseFloat()`, 布尔字段 (`isSource`) 需特殊转换
- 所有用户文本必须通过 `UIManager.escapeHtml()` 转义, 防止 XSS

### 10. 全局命名约定

- CSS 类: kebab-case (`property-panel`, `module-list-item`)
- JS 变量/函数: camelCase (`draggingNode`, `fitToScreen`)
- JS 类: PascalCase (`CanvasRenderer`, `UIManager`)
- DOM ID: kebab-case (`property-panel`, `modal-overlay`)
- 常量: UPPER_SNAKE_CASE (`NODE_TYPE_CONFIG`, `DEFAULTS`)
- 私有方法前缀: 无 (项目不使用私有字段前缀)

### 11. 新增文件检查清单

添加新文件时:
- [ ] 在 `index.html` 中添加 `<script>` 或 `<link>` 标签, 按正确的依赖顺序
- [ ] 如果新增全局函数, 放在 `utils.js` 中
- [ ] 如果新增配置常量, 放在 `constants.js` 中
- [ ] 如果需要新的 CSS, 在 `css/style.css` 末尾添加
- [ ] 通过 `app` (即 `window.app`) 访问应用实例
- [ ] 检查 `WARNING_ShutdownIfNotSet` 误触发

### 12. 项目入口

`window.onload` → 初始化 `new SDToolApp()` → 挂载到 `window.app = app` → `app.init()` 设置 Canvas + 加载模型 + 启动渲染循环 (基于 `requestAnimationFrame`)