## Deferred from: code review (2026-05-09)

- [ ] **[Defer] 撤销栈全量快照内存占用** — `js/undo-redo.js`。`maxSize` 为 200，每次存储完整 `model.toJSON()` 快照。大模型可能 OOM。建议改用增量式操作记录（command pattern）。
- [ ] **[Defer] `getNodeEdgePoint` 云形固定 0.78 半径偏移** — `js/canvas-renderer.js:309`。连线从云形边缘出发时使用固定比值，高缩放级别下可能偏移。建议改用射线-云形精确求交。
- [ ] **[Defer] 触摸交互缺少双指缩放** — `js/interaction.js:253-304`。移动端无捏合缩放手势支持。需添加二指触控处理。