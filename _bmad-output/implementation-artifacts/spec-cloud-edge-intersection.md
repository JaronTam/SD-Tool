---
title: 'getNodeEdgePoint 云形精确求交'
type: 'fix'
created: '2026-05-15'
status: 'done'
baseline_commit: '8c5607dd68c0b1e60f29b1216e74b8cb29a5ee8c'
context: ['_bmad-output/project-context.md']
---

<frozen-after-approval>

## Intent

**Problem:** `getNodeEdgePoint` 对 `source-sink`（云形）节点使用圆形近似（半径 `NODE_RADIUS * 0.78`），但实际云形由极坐标曲线 `r(θ) = R * (0.75 + 0.25 * sin(3θ))` 绘制。连线端点位置与视觉云形边缘不重合，尤其在内凹处连线会明显穿入节点内部。

**Approach:** 将云形边缘求交改为与绘制形状一致的计算：在射线方向角 θ 处，取极坐标曲线的实际半径作为交点距离。

## Boundaries & Constraints

**Always:**
- 仅修改 `js/canvas-renderer.js` 的 `getNodeEdgePoint` 方法中 `source-sink` 分支
- 不影响 `stock`（矩形）的求交逻辑
- 不影响其他任何文件
- 不添加第三方依赖

**Never:**
- 不修改绘制函数 `drawSourceSinkNode` 的云形公式
- 不改变 `getNodeEdgePoint` 的函数签名

## I/O & Edge-Case Matrix

| Scenario | Input | Expected Output |
|----------|-------|----------------|
| 云形节点正上方连线 | dir=(0,-1), center=(cx,cy) | 交点 = (cx, cy - r*(0.75+0.25*sin(3*3π/2))) |
| 云形节点右侧连线 | dir=(1,0), center=(cx,cy) | 交点 = (cx + r*(0.75+0.25*sin(0)), cy) |
| 云形节点 45° 连线 | dir=(√2/2, √2/2) | 交点 = (cx+dirX*r*(0.75+0.25*sin(3*π/4)), cy+dirY*r*(...)) |
| 方向向量为零 | dir=(0,0) | 不执行（调用方保证 dist>0，零向量不会传入） |

</frozen-after-approval>

## Code Map

- `js/canvas-renderer.js:296-316` — `getNodeEdgePoint` 方法，source-sink 分支当前用固定半径 `r * 0.78`

## Tasks & Acceptance

**Execution:**
- [x] `js/canvas-renderer.js:309-314` — 云形边缘求交改为极坐标曲线求交

**Acceptance:**
- Given 云形源/汇节点，when 从不同方向连接/绘制连线，then 连线端点准确落在视觉云形边缘上