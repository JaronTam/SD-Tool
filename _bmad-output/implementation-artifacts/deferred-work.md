## Deferred from: quick-dev (2026-05-14)

- [ ] **[Defer] 优化代码实现** — 待安全审查完成后，基于审计发现进行针对性代码优化。已从 2026-05-15 quick-dev 中拆分出，等待安全审查执行。

## Deferred from: code review (2026-05-09)

- [x] **[Defer] 撤销栈全量快照内存占用** — `js/undo-redo.js`。`maxSize` 为 200，每次存储完整 `model.toJSON()` 快照。大模型可能 OOM。建议改用增量式操作记录（command pattern）。✅ 已改造为命令模式 (spec-undo-command-pattern.md)
- [x] **[Defer] `getNodeEdgePoint` 云形固定 0.78 半径偏移** — `js/canvas-renderer.js:309`。连线从云形边缘出发时使用固定比值，高缩放级别下可能偏移。建议改用射线-云形精确求交。✅ 已改为与 drawSourceSinkNode 一致的极坐标曲线 (spec-cloud-edge-intersection.md)
- [ ] **[Defer] 触摸交互缺少双指缩放** — `js/interaction.js:253-304`。移动端无捏合缩放手势支持。需添加二指触控处理。