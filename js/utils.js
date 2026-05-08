/**
 * SD-Tool 工具函数
 */

/** 生成唯一ID */
function generateId() {
  return 'el_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

/** 两点间距离 */
function distance(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 点到线段的距离 */
function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

/** 屏幕坐标转世界坐标 */
function screenToWorld(sx, sy, offsetX, offsetY, zoom) {
  return {
    x: (sx - offsetX) / zoom,
    y: (sy - offsetY) / zoom
  };
}

/** 世界坐标转屏幕坐标 */
function worldToScreen(wx, wy, offsetX, offsetY, zoom) {
  return {
    x: wx * zoom + offsetX,
    y: wy * zoom + offsetY
  };
}

/** 限制数值范围 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/** 角度归一化 (弧度) */
function normalizeAngle(a) {
  while (a < -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/** 矩形是否包含点 */
function rectContains(rx, ry, rw, rh, px, py) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/** 点为圆心的圆是否包含点 */
function circleContains(cx, cy, r, px, py) {
  return distance(cx, cy, px, py) <= r;
}

/** 查找点在哪个Node上 (世界坐标) */
function findNodeAt(worldX, worldY, nodes) {
  const HIT_RADIUS = 60;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (circleContains(n.x, n.y, HIT_RADIUS, worldX, worldY)) {
      return n;
    }
  }
  return null;
}

/** 查找点在哪个连线附近 (世界坐标, 阈值) */
function findConnectionAt(worldX, worldY, connections, nodes, threshold = 8) {
  for (let i = connections.length - 1; i >= 0; i--) {
    const conn = connections[i];
    const fromNode = nodes.find(n => n.id === conn.fromId);
    const toNode = nodes.find(n => n.id === conn.toId);
    if (!fromNode || !toNode) continue;
    const dist = pointToSegmentDist(worldX, worldY, fromNode.x, fromNode.y, toNode.x, toNode.y);
    if (dist <= threshold) {
      return conn;
    }
  }
  return null;
}

/** 判断两个节点是否重叠 */
function nodesOverlap(a, b) {
  const minDist = 100;
  return distance(a.x, a.y, b.x, b.y) < minDist;
}

/** 合并两个对象（浅层） */
function mergeObjects(base, overrides) {
  return Object.assign({}, base, overrides);
}

/** 防抖 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** 格式化数字 */
function fmtNum(n, decimals = 2) {
  if (Math.abs(n) >= 1e6) return n.toExponential(decimals);
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(decimals);
  return Number(n.toFixed(decimals)).toString();
}