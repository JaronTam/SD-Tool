/**
 * SD-Tool Canvas渲染器
 * 负责将所有模型元素绘制到Canvas上
 */

class CanvasRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas.getContext('2d');

    // 视口状态
    this.offsetX = 0;
    this.offsetY = 0;
    this.zoom = 1;

    // 绘制常量
    this.NODE_RADIUS = 60;
    this.NODE_WIDTH = 120;
    this.NODE_HEIGHT = 80;
    this.GRID_SIZE = 40;
    this.ARROW_SIZE = 12;
    this.FONT = '12px "Segoe UI", system-ui, sans-serif';
    this.FONT_SMALL = '10px "Segoe UI", system-ui, sans-serif';
    this.FONT_TITLE = 'bold 13px "Segoe UI", system-ui, sans-serif';
  }

  // ===== 视口操作 =====

  setViewport(offsetX, offsetY, zoom) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.zoom = zoom;
  }

  // ===== 坐标转换 =====

  w2s(wx, wy) {
    return {
      x: wx * this.zoom + this.offsetX,
      y: wy * this.zoom + this.offsetY
    };
  }

  s2w(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.zoom,
      y: (sy - this.offsetY) / this.zoom
    };
  }

  // ===== 主绘制入口 =====

  render(model, connectingFromId) {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // 清屏 (canvas 使用 DPR 缩放，需用 CSS 像素坐标)
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, width / dpr, height / dpr);

    // 绘制网格
    this.drawGrid();

    // 绘制连线 (先画连线，再画节点，保证节点在上层)
    this.drawConnections(model.connections, model.nodes, model.selectedId, connectingFromId);

    // 绘制节点
    this.drawNodes(model.nodes, model.selectedId);

    // 绘制连线中的半成品线 (正在进行连线操作)
    if (connectingFromId) {
      this.drawConnectingLine(model, connectingFromId);
    }

    // 更新小地图
    this.updateMinimap(model);
  }

  // ===== 网格 =====

  drawGrid() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const gridSize = this.GRID_SIZE * this.zoom;

    // 动态调整网格间距
    let step = gridSize;
    while (step < 20) step *= 2;
    while (step > 120) step /= 2;

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    const startX = this.offsetX % step;
    const startY = this.offsetY % step;

    for (let x = startX; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = startY; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  // ===== 节点绘制 =====

  drawNodes(nodes, selectedId) {
    for (const node of nodes) {
      this.drawNode(node, node.id === selectedId);
    }
  }

  drawNode(node, isSelected) {
    const ctx = this.ctx;
    const pos = this.w2s(node.x, node.y);
    const config = NODE_TYPE_CONFIG[node.type];
    const color = config.color;

    ctx.save();

    // 选中态光晕
    if (isSelected) {
      ctx.shadowColor = '#5b9cfa';
      ctx.shadowBlur = 20 * this.zoom;
    }

    if (node.type === 'stock') {
      this.drawStockNode(pos, node, color, isSelected);
    } else if (node.type === 'source-sink') {
      this.drawSourceSinkNode(pos, node, color, isSelected);
    }

    ctx.restore();
  }

  /** 存量 - 矩形 */
  drawStockNode(pos, node, color, isSelected) {
    const ctx = this.ctx;
    const w = this.NODE_WIDTH * this.zoom;
    const h = this.NODE_HEIGHT * this.zoom;
    const r = 8 * this.zoom;
    const x = pos.x - w / 2;
    const y = pos.y - h / 2;

    // 填充
    ctx.fillStyle = 'rgba(30, 30, 46, 0.92)';
    ctx.strokeStyle = isSelected ? '#5b9cfa' : color;
    ctx.lineWidth = isSelected ? 3 * this.zoom : 2 * this.zoom;
    this.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // 标题栏
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 22 * this.zoom);

    // 标题文字
    ctx.fillStyle = '#fff';
    ctx.font = this.scaledFont(this.FONT_SMALL);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('存量', pos.x, y + 11 * this.zoom);

    // 名称
    ctx.fillStyle = '#e0e0e8';
    ctx.font = this.scaledFont(this.FONT_TITLE);
    const titleY = y + 42 * this.zoom;
    ctx.fillText(this.truncateText(ctx, node.name, w - 12), pos.x, titleY);

    // 数值
    ctx.fillStyle = '#f0a860';
    ctx.font = this.scaledFont('bold 16px "Segoe UI", system-ui, sans-serif');
    const valY = y + 64 * this.zoom;
    let valStr = fmtNum(node.value, 2);
    if (node.unit) valStr += ' ' + node.unit;
    ctx.fillText(valStr, pos.x, valY);
  }

  /** 源/汇 - 云形 (用多个圆模拟) */
  drawSourceSinkNode(pos, node, color, isSelected) {
    const ctx = this.ctx;
    const r = this.NODE_RADIUS * this.zoom;
    const z = this.zoom;

    // 云形轮廓：用贝塞尔曲线
    const label = node.isSource ? '源' : '汇';

    ctx.fillStyle = 'rgba(30, 30, 46, 0.92)';
    ctx.strokeStyle = isSelected ? '#5b9cfa' : color;
    ctx.lineWidth = isSelected ? 3 * z : 2 * z;
    ctx.beginPath();

    // 云形粗略轮廓
    const cx = pos.x, cy = pos.y;
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const rr = r * (0.75 + 0.25 * (Math.sin(angle * 3) * 0.5 + 0.5));
      const sx = cx + Math.cos(angle) * rr;
      const sy = cy + Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 标签
    ctx.fillStyle = color;
    ctx.font = this.scaledFont(this.FONT_SMALL);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy - 20 * z);

    // 名称
    ctx.fillStyle = '#e0e0e8';
    ctx.font = this.scaledFont(this.FONT_TITLE);
    ctx.fillText(this.truncateText(ctx, node.name, r * 1.3), cx, cy + 2 * z);

    // 速率
    ctx.fillStyle = '#f0a860';
    ctx.font = this.scaledFont('bold 14px "Segoe UI", system-ui, sans-serif');
    let rateStr = fmtNum(node.rate, 2);
    if (node.unit) rateStr += ' ' + node.unit;
    ctx.fillText(rateStr, cx, cy + 22 * z);
  }

  // ===== 连线绘制 =====

  drawConnections(connections, nodes, selectedId, connectingFromId) {
    for (const conn of connections) {
      const fromNode = nodes.find(n => n.id === conn.fromId);
      const toNode = nodes.find(n => n.id === conn.toId);
      if (!fromNode || !toNode) continue;
      this.drawConnection(conn, fromNode, toNode, conn.id === selectedId);
    }
  }

  drawConnection(conn, fromNode, toNode, isSelected) {
    const ctx = this.ctx;
    const fromPos = this.w2s(fromNode.x, fromNode.y);
    const toPos = this.w2s(toNode.x, toNode.y);

    ctx.save();

    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) { ctx.restore(); return; }

    const ux = dx / dist;
    const uy = dy / dist;

    // 从源节点边缘开始
    const fromEdge = this.getNodeEdgePoint(fromNode, fromPos, ux, uy);
    // 到目标节点边缘结束
    const toEdge = this.getNodeEdgePoint(toNode, toPos, -ux, -uy);

    // 线条
    ctx.strokeStyle = conn.direction === 'negative' ? '#f06070' : '#f0a860';
    ctx.lineWidth = isSelected ? 3 * this.zoom : 2 * this.zoom;
    ctx.setLineDash([]);

    if (isSelected) {
      ctx.shadowColor = '#f0a860';
      ctx.shadowBlur = 10 * this.zoom;
    }

    ctx.beginPath();
    ctx.moveTo(fromEdge.x, fromEdge.y);
    ctx.lineTo(toEdge.x, toEdge.y);
    ctx.stroke();

    // 箭头
    this.drawArrow(toEdge, ux, uy, conn.direction);

    // 流量标识 (可变流量/不变流量)
    const midX = (fromEdge.x + toEdge.x) / 2;
    const midY = (fromEdge.y + toEdge.y) / 2;
    this.drawFlowIndicator(midX, midY, ux, uy, conn);

    // 标签
    if (conn.name || conn.flowRate) {
      this.drawConnectionLabel(midX, midY, ux, uy, conn);
    }

    ctx.restore();
  }

  /** 计算节点边缘点 */
  getNodeEdgePoint(node, centerPos, dirX, dirY) {
    if (node.type === 'stock') {
      const hw = (this.NODE_WIDTH * this.zoom) / 2;
      const hh = (this.NODE_HEIGHT * this.zoom) / 2;
      // 射线与矩形交点
      if (Math.abs(dirX * hh) > Math.abs(dirY * hw)) {
        const t = hw / Math.abs(dirX);
        return { x: centerPos.x + dirX * t, y: centerPos.y + dirY * t };
      } else {
        const t = hh / Math.abs(dirY);
        return { x: centerPos.x + dirX * t, y: centerPos.y + dirY * t };
      }
    } else {
      // 云形节点：使用与 drawSourceSinkNode 相同的极坐标曲线
      // rr = r * (0.75 + 0.25 * (sin(3θ) * 0.5 + 0.5))
      const R = this.NODE_RADIUS * this.zoom;
      const angle = Math.atan2(dirY, dirX);
      const cloudR = R * (0.75 + 0.25 * (Math.sin(angle * 3) * 0.5 + 0.5));
      return {
        x: centerPos.x + dirX * cloudR,
        y: centerPos.y + dirY * cloudR
      };
    }
  }

  /** 绘制箭头及正/负反馈标识 */
  drawArrow(toEdge, ux, uy, direction) {
    const ctx = this.ctx;
    const arrowSize = this.ARROW_SIZE * this.zoom;

    // 箭头
    const angle = Math.atan2(uy, ux);
    ctx.fillStyle = direction === 'negative' ? '#f06070' : '#f0a860';
    ctx.beginPath();
    ctx.moveTo(toEdge.x, toEdge.y);
    ctx.lineTo(
      toEdge.x - arrowSize * Math.cos(angle - Math.PI / 7),
      toEdge.y - arrowSize * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      toEdge.x - arrowSize * Math.cos(angle + Math.PI / 7),
      toEdge.y - arrowSize * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fill();

    // + / - 标识在箭头旁边
    const sign = direction === 'negative' ? '−' : '+';
    const signSize = 14 * this.zoom;
    ctx.fillStyle = direction === 'negative' ? '#f06070' : '#4ecb8c';
    ctx.font = this.scaledFont(`bold ${12 + 4 * this.zoom}px "Segoe UI", system-ui, sans-serif`);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const signX = toEdge.x - (arrowSize + signSize * 0.6) * ux;
    const signY = toEdge.y - (arrowSize + signSize * 0.6) * uy;
    ctx.fillText(sign, signX, signY);
  }

  /** 流量指示器: 可变流量=倒三角, 不变流量=圆圈 */
  drawFlowIndicator(midX, midY, ux, uy, conn) {
    const ctx = this.ctx;
    const z = this.zoom;
    const indicatorSize = 10 * z;

    // 垂直方向偏移到线旁
    const perpX = -uy;
    const perpY = ux;
    const offset = 18 * z;
    const cx = midX + perpX * offset;
    const cy = midY + perpY * offset;

    const isConstant = conn.flowType === 'constant';

    ctx.fillStyle = 'rgba(30, 30, 46, 0.8)';
    ctx.strokeStyle = '#a0a0b8';
    ctx.lineWidth = 1.5 * z;

    if (!isConstant) {
      // 可变流量: 倒三角形 ▽
      ctx.beginPath();
      ctx.moveTo(cx, cy - indicatorSize);
      ctx.lineTo(cx - indicatorSize, cy + indicatorSize * 0.6);
      ctx.lineTo(cx + indicatorSize, cy + indicatorSize * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 不变流量: 圆圈 ◯
      ctx.beginPath();
      ctx.arc(cx, cy, indicatorSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  /** 连线标签 */
  drawConnectionLabel(midX, midY, ux, uy, conn) {
    const ctx = this.ctx;
    const z = this.zoom;
    const perpX = -uy;
    const perpY = ux;
    const offset = -16 * z;

    const lx = midX + perpX * offset;
    const ly = midY + perpY * offset;

    ctx.fillStyle = '#a0a0b8';
    ctx.font = this.scaledFont(this.FONT_SMALL);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let label = conn.name || '';
    if (conn.flowRate !== undefined) {
      label += (label ? ' ' : '') + fmtNum(conn.flowRate, 2);
    }
    ctx.fillText(label, lx, ly);
  }

  /** 正在进行连线时的临时线 */
  drawConnectingLine(model, connectingFromId) {
    // 这个在 interaction.js 中通过全局鼠标位置协作
    if (!this._connectMouseX) return;
    const fromNode = model.getNode(connectingFromId);
    if (!fromNode) return;

    const ctx = this.ctx;
    const fromPos = this.w2s(fromNode.x, fromNode.y);
    const toPos = { x: this._connectMouseX, y: this._connectMouseY };

    ctx.save();
    ctx.strokeStyle = '#5b9cfa';
    ctx.lineWidth = 2 * this.zoom;
    ctx.setLineDash([8 * this.zoom, 6 * this.zoom]);
    ctx.lineDashOffset = performance.now() / 100;

    ctx.beginPath();
    ctx.moveTo(fromPos.x, fromPos.y);
    ctx.lineTo(toPos.x, toPos.y);
    ctx.stroke();
    ctx.restore();
  }

  // ===== 小地图 =====

  updateMinimap(model) {
    const mc = this.minimapCanvas;
    const mctx = this.minimapCtx;
    const mw = mc.width;
    const mh = mc.height;

    mctx.clearRect(0, 0, mw, mh);

    if (model.nodes.length === 0) return;

    // 计算所有节点的包围盒
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of model.nodes) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
    }

    const padding = 150;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scale = Math.min(mw / worldW, mh / worldH, 1);

    // 绘制背景
    mctx.fillStyle = 'rgba(30, 30, 46, 0.9)';
    mctx.fillRect(0, 0, mw, mh);

    // 绘制节点
    for (const node of model.nodes) {
      const mx = (node.x - minX) * scale;
      const my = (node.y - minY) * scale;
      mctx.fillStyle = NODE_TYPE_CONFIG[node.type].color;
      mctx.beginPath();
      mctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      mctx.fill();
    }

    // 绘制连线
    mctx.strokeStyle = 'rgba(240, 168, 96, 0.5)';
    mctx.lineWidth = 0.5;
    for (const conn of model.connections) {
      const fn = model.getNode(conn.fromId);
      const tn = model.getNode(conn.toId);
      if (!fn || !tn) continue;
      mctx.beginPath();
      mctx.moveTo((fn.x - minX) * scale, (fn.y - minY) * scale);
      mctx.lineTo((tn.x - minX) * scale, (tn.y - minY) * scale);
      mctx.stroke();
    }

    // 绘制视口框
    const vpX = -this.offsetX / this.zoom;
    const vpY = -this.offsetY / this.zoom;
    const vpW = this.canvas.width / this.zoom;
    const vpH = this.canvas.height / this.zoom;

    mctx.strokeStyle = '#5b9cfa';
    mctx.lineWidth = 1;
    mctx.strokeRect(
      (vpX - minX) * scale,
      (vpY - minY) * scale,
      vpW * scale,
      vpH * scale
    );
  }

  // ===== 辅助方法 =====

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  scaledFont(fontStr) {
    // 根据 zoom 缩放字体
    return fontStr.replace(/(\d+)px/, (_, size) => {
      const s = Math.max(8, Math.min(48, parseInt(size) * this.zoom));
      return s + 'px';
    });
  }

  truncateText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '…';
  }

  /** 设置连接鼠标位置 (用于临时线) */
  setConnectMousePos(x, y) {
    this._connectMouseX = x;
    this._connectMouseY = y;
  }

  /** 清除连接鼠标位置 */
  clearConnectMousePos() {
    this._connectMouseX = null;
    this._connectMouseY = null;
  }
}