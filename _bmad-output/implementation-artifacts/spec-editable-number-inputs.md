---
title: '属性面板数值字段改为可键盘输入的数字输入框'
type: 'bugfix'
created: '2026-05-09'
baseline_commit: '0fea6c7d6f4552e06deb61742b78b19e2ae2f153'
status: 'done'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval>

## Intent

**Problem:** 属性面板（如节点存量值、速率、坐标 X/Y、连线流量速率）使用 `type="number"` 的 `<input>` 元素，但全局键盘快捷键拦截了数字相关按键（`+`、`-`、`0`），导致用户无法通过键盘直接输入数字，仅能依赖上下箭头步进微调。同时，全局快捷键也可能干扰编辑操作。

**Approach:** 在 `InteractionHandler.onKeyDown` 中，对所有不与 Ctrl/Meta 组合且可能干扰 `<input>`/`<textarea>` 编辑的按键（`+`、`=`、`-`、`0`、`Escape`）添加焦点检查守卫 `!isEditableFocused()`。Backspace/Delete 已在上一轮修复中加上守卫，保持不变。Ctrl/Meta 组合键（Ctrl+S/Z/Y/N）不受影响——它们在编辑时触发是合理的。

## Boundaries & Constraints

**Always:**
- 保留 `type="number"` 上的 `step` 属性，以维持上下箭头步进行为
- 使用已有的 `isEditableFocused()` 方法（`document.activeElement` 检查）
- 不修改 `bindPropsInputEvents` 中的 `change` 事件逻辑
- 保持所有现有快捷键行为不变（仅当焦点不在可编辑元素时触发数字相关快捷键）

**Ask First:**
- 无

**Never:**
- 不将 `type="number"` 改为 `type="text"`（保留原生步进）
- 不引入第三方数字输入组件
- 不修改 CSS 或 HTML 结构

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| 焦点在数值 `<input>` 中按 `+` | 输入"100"，按 `+` | 字符 `+` 被正常输入（作为正号前缀），画布不缩放 | N/A |
| 焦点在数值 `<input>` 中按 `-` | 输入"50"，按 `-` | 字符 `-` 被正常输入（作为负号前缀），画布不缩放 | N/A |
| 焦点在数值 `<input>` 中按 `0` | 输入"10"，按 `0` | "100" 显示，画布不重置缩放 | N/A |
| 焦点在 `<textarea>` 中按 `Escape` | 正在编辑描述文字 | Escape 事件冒泡，但不应触发取消选择/关闭面板 | N/A |
| 焦点不在任何可编辑元素时按 `+` | 画布空闲 | 画布放大 15%（现有行为不变） | N/A |
| 焦点不在任何可编辑元素时按 `0` | 画布空闲 | 缩放重置为 100%（现有行为不变） | N/A |
| 焦点在 `<select>` 元素中 | 下拉角色选择器已展开 | 号码/Shift 键按浏览器默认行为处理，不触发快捷键 | N/A |

</frozen-after-approval>

## Code Map

- `js/interaction.js` -- `InteractionHandler.onKeyDown()` 方法，全局键盘快捷键分发。需要在此处对 `+`、`=`、`-`、`0`、`Escape` 添加 `isEditableFocused()` 守卫
- `js/ui.js` -- `UIManager.renderNodeProperties()` / `renderConnectionProperties()` 生成属性面板 HTML，使用 `type="number"` 的 `<input>`。无需修改

## Tasks & Acceptance

**Execution:**
- [x] `js/interaction.js` -- 在 `onKeyDown` 中，对 `+`/`=`/`-`/`0`/`Escape` 快捷键添加 `!this.isEditableFocused()` 守卫条件 -- 防止在可编辑元素中编辑时触发全局快捷键

**Acceptance Criteria:**
- Given 属性面板打开且数值 `<input>` 获得焦点，when 按 `+` 键，then 字符被输入到 input 中，画布不缩放
- Given 属性面板打开且数值 `<input>` 获得焦点，when 按 `-` 键，then 字符被输入（作为负号），画布不缩放
- Given 属性面板打开且数值 `<input>` 获得焦点，when 按 `0` 键，then "0" 被添加到输入值，画布缩放不重置
- Given 属性面板打开且 `<textarea>` 获得焦点，when 按 `Escape` 键，then 选择不被取消，属性面板保持打开
- Given 画布空闲且无任何可编辑元素获得焦点，when 按 `+`/`-`/`0`，then 缩放行为与修复前完全一致

## Design Notes

`isEditableFocused()` 已在上一轮修复中实现，检查 `document.activeElement` 的 `tagName` 是否为 `input`/`textarea`/`select`，以及 `isContentEditable` 属性。本次修复复用同一方法。

修改模式：在每个受影响的快捷键分支条件中追加 `&& !this.isEditableFocused()`。

Ctrl/Meta 组合键（Ctrl+S/Z/Y/N）保留原样不加守卫——这些是主动操作，即使在编辑时触发也是用户有意的行为。

## Verification

**Manual checks (no CLI):**
- 在浏览器中打开 `index.html`，创建 Stock 节点，点击显示属性面板
- 点击存量值输入框，键入 `-150` 验证 `-` 键不被拦截
- 键入 `0.5` 验证 `0` 不被拦截
- 点击描述 textarea，按 Escape 验证面板不关闭
- 点击画布空白处，按 `+`/`-`/`0` 验证缩放功能正常
- 选中模块后在画布上按 Backspace 验证删除仍正常工作（无焦点干扰）

## Suggested Review Order

**键盘快捷键守卫逻辑 (核心)**

- 入口点：新增 `isEditableFocused()` 方法，所有快捷键守卫的单一依赖
  [`interaction.js:403`](../../js/interaction.js#L403)

- Delete/Backspace 添加焦点守卫，防止编辑时误删元素
  [`interaction.js:190`](../../js/interaction.js#L190)

- Escape 添加焦点守卫，防止文本域编辑时意外关闭面板
  [`interaction.js:195`](../../js/interaction.js#L195)

- `+`/`=`/`-` 缩放快捷键添加焦点守卫，允许数值输入框正常接收这些字符
  [`interaction.js:233`](../../js/interaction.js#L233)

- `0` 重置缩放添加焦点守卫，允许数值输入框输入 0
  [`interaction.js:241`](../../js/interaction.js#L241)

**数值输入步长**

- 属性面板和模态框中所有 `type="number"` 输入框的 `step` 统一为 `10`
  [`ui.js:92`](../../js/ui.js#L92)

**附带修复 (fitToScreen)**

- `fitToScreen()` 使用 `devicePixelRatio` 修正高 DPI 下的包围盒计算
  [`ui.js:556`](../../js/ui.js#L556)
