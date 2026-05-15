---
title: '撤销栈从全量快照迁移至增量命令模式'
type: 'refactor'
created: '2026-05-15'
status: 'done'
baseline_commit: '8c5607dd68c0b1e60f29b1216e74b8cb29a5ee8c'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval>

## Intent

**Problem:** `UndoRedoManager` 每次 `pushState()` 调用 `model.toJSON()` 存储完整模型快照，栈大小 200。当模型包含大量节点和连线时，200 份完整快照会导致严重内存占用乃至 OOM。

**Approach:** 将全量快照栈改造为增量命令栈。`pushState` 不再存储 `model.toJSON()`，而是接收一个命令对象（含类型与增量数据）。`undo()` 对当前命令执行反向操作，`redo()` 重新执行正向操作。内存占用从 O(模型 × 栈深) 降至 O(平均单操作数据 × 栈深)。

## Boundaries & Constraints

**Always:**
- 保持 `pushState` 接口对外签名兼容（仍可在操作后调用，但参数改为命令对象）
- 保持 `undo()` / `redo()` / `canUndo()` / `canRedo()` / `clear()` / `getHistoryInfo()` 公共接口不变
- 撤销栈最大深度保持 200
- 保持当前 4 种操作均可撤销：创建节点、删除节点、创建连线、删除连线
- 删除节点时一并记录其关联连线数据，undo 时完整恢复
- 所有 JS 文件不使用 import/export，通过 `<script>` 标签加载

**Ask First:**
- 属性面板编辑操作（updateNode/updateConnection）是否纳入撤销栈 — 当前编辑不调用 pushState

**Never:**
- 不改变 `SDModel` 或 `SDToolApp` 的公共接口
- 不添加第三方依赖
- 不修改 HTML 或 CSS

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 创建节点后 undo | 创建 Stock 节点，pushState | undo 删除该节点（及其后添加的连线），redo 从命令数据重建 | N/A |
| 删除带连线的节点后 undo | 节点有 2 条连线，deleteNode + pushState | undo 恢复节点和 2 条连线，redo 再次删除 | N/A |
| 连续操作后 undo | 创建→创建→删除，栈指针在最后 | undo 回退到删除前；再次 undo 回退到第二次创建前 | N/A |
| 在历史中间操作后 pushState | 3 个命令，undo 1 步到第 2 个，然后新建节点 | 第 3 个及之后被截断，新命令追加为第 3 个 | N/A |
| 空栈 undo/redo | 栈为空 | canUndo=false, canRedo=false，undo/redo 返回 false | N/A |
| 栈满 200 后推入 | 201 次 pushState | 最旧命令被移出，pointer 调整 | N/A |
| undo 后 redo | undo 1 步，然后 redo | 模型回到 undo 前状态 | N/A |

</frozen-after-approval>

## Code Map

- `js/undo-redo.js` — `UndoRedoManager` 类。核心改造目标：栈存储结构从 `{snapshot, label}` 改为 `{command, label}`，undo/redo 通过执行命令的正反向操作实现
- `js/app.js` — 4 处 `pushState` 调用点需改为传入命令对象（createNode/deleteNode/createConnection/deleteConnection）

## Tasks & Acceptance

**Execution:**
- [x] `js/undo-redo.js` — 重新设计内部栈结构，将 `{snapshot, label}` 替换为 `{command, label}`，command 包含 type、正向操作数据、反向操作所需数据 — 核心改造
- [x] `js/undo-redo.js` — 重写 `undo()` 基于当前命令的反向操作恢复模型状态 — 核心逻辑
- [x] `js/undo-redo.js` — 重写 `redo()` 基于当前命令的正向操作重放 — 核心逻辑
- [x] `js/undo-redo.js` — 更新 `pushState(command)` 签名，接收命令对象而非仅 label 字符串 — 接口变更
- [x] `js/app.js` — 更新 4 处 `pushState` 调用，传入包含增量数据的命令对象 — 适配新接口

**Acceptance Criteria:**
- Given 栈为空，when `canUndo()`，then 返回 false
- Given 创建 1 个节点，when `undo()`，then 该节点从模型中移除，`canUndo()` 变为 false
- Given 执行 undo 后，when `redo()`，then 节点恢复，与创建时数据完全一致
- Given 创建带 2 条连线的节点后执行 `deleteNode` + pushState，when `undo()`，then 节点和 2 条连线完整恢复
- Given 栈中有 3 条命令且指针在中间（undo 过 1 次），when 执行新 pushState，then 指针之后的旧命令被截断
- Given 栈深度达到 200，when 推入第 201 条命令，then 最旧的命令被移除，canUndo 仍为 true

## Design Notes

**命令对象结构：**

```js
// 创建节点
{ type: 'create-node', data: { nodeId: 'n_xxx' } }
// undo: deleteNode(nodeId)
// redo: createNodeFromData(nodeData) — 需要存储完整节点数据

// 删除节点
{ type: 'delete-node', data: { node: {...}, connections: [...] } }
// undo: 恢复 node + connections 到模型
// redo: deleteNode(node.id)

// 创建连线
{ type: 'create-connection', data: { connId: 'c_xxx' } }
// undo: deleteConnection(connId)
// redo: 需要存储完整连线数据

// 删除连线
{ type: 'delete-connection', data: { conn: {...} } }
// undo: push conn 回 connections 数组
// redo: deleteConnection(conn.id)
```

**创建操作的数据存储策略**：对于 create-node 和 create-connection 命令，需要在 pushState 时捕获已创建对象的完整数据（在 model 中找到该对象并深拷贝），以便 redo 可以重建。这比全量快照小得多（仅存储单个对象而非整个模型）。

**接口兼容**：`pushState(command)` 签名为 `{ type, data }`，其中 data 包含操作所需增量数据。调用方在 pushState 前已完成模型变更，只需传入标识信息，由 UndoRedoManager 在内部捕获所需数据。

## Verification

**Manual checks (no CLI):**
- 浏览器打开 `index.html`，执行以下操作序列并验证：
  1. 创建 Stock 节点 → Ctrl+Z 撤销 → 节点消失 → Ctrl+Y 重做 → 节点恢复
  2. 创建 2 个节点，用连线连接 → 删除源节点 → Ctrl+Z → 节点和连线恢复
  3. 连续创建 5 个节点 → 撤销 3 步 → 新建节点 → 验证被截断的历史（redo 按钮应不可用）
  4. 在空画布上 Ctrl+Z/Ctrl+Y → 无变化，无报错
- 检查浏览器控制台无错误输出