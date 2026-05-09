/**
 * SD-Tool 画布交互处理
 * 处理鼠标、键盘、触摸事件
 */

class InteractionHandler {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this.renderer = app.renderer;
    this.model = app.model;

    // 状态机
    this.mode = 'idle'; // idle | dragging_node | panning | connecting
    this.dragTarget = null;      // 拖拽的节点
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panStartOffsetX = 0;
    this.panStartOffsetY = 0;
    this.connectFromId = null;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.hoveredNodeId = null;

    this.init();
  }

  init() {
    // 鼠标事件
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));

    // 滚轮缩放
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

    // 键盘事件
    window.addEventListener('keydown', this.onKeyDown.bind(this));

    // 触摸事件 (移动端)
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onTouchEnd.bind(this));

    // 防止上下文菜单干扰
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // 拖放 (从模块面板拖入)
    this.initDrop();
  }

  // ===== 鼠标按下 =====

  onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // 中键或Alt+左键: 平移
      e.preventDefault();
      this.mode = 'panning';
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.panStartOffsetX = this.renderer.offsetX;
      this.panStartOffsetY = this.renderer.offsetY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0) {
      // 左键
      const world = this.renderer.s2w(e.offsetX, e.offsetY);
      const node = findNodeAt(world.x, world.y, this.model.nodes);
      const conn = findConnectionAt(world.x, world.y, this.model.connections, this.model.nodes);

      if (node) {
        // 点击节点
        if (this.connectFromId && node.id !== this.connectFromId) {
          // 正在连线模式: 完成连线
          this.finishConnection(this.connectFromId, node.id);
          return;
        }

        this.mode = 'dragging_node';
        this.dragTarget = node;
        this.dragOffsetX = node.x - world.x;
        this.dragOffsetY = node.y - world.y;
        this.model.selectNode(node.id);
        this.app.ui.showProperties('node');
        this.canvas.style.cursor = 'grabbing';
      } else if (conn) {
        // 点击连线
        this.mode = 'idle';
        this.model.selectConnection(conn.id);
        this.app.ui.showProperties('connection');
      } else {
        // 点击空白
        this.mode = 'idle';
        this.model.clearSelection();
        this.app.ui.hideProperties();
        if (this.connectFromId) {
          this.cancelConnecting();
        }
      }
    }
  }

  // ===== 鼠标移动 =====

  onMouseMove(e) {
    this.lastMouseX = e.offsetX;
    this.lastMouseY = e.offsetY;

    const world = this.renderer.s2w(e.offsetX, e.offsetY);

    // 更新鼠标坐标显示
    this.app.ui.updateCoords(world.x, world.y);

    // 连接模式下的临时线
    if (this.connectFromId) {
      this.renderer.setConnectMousePos(e.offsetX, e.offsetY);
    }

    // 悬停检测
    const hovered = findNodeAt(world.x, world.y, this.model.nodes);
    if (this.mode === 'idle' || this.mode === 'connecting') {
      this.updateHoverCursor(hovered, world);
    }

    switch (this.mode) {
      case 'dragging_node': {
        if (this.dragTarget) {
          this.dragTarget.x = world.x + this.dragOffsetX;
          this.dragTarget.y = world.y + this.dragOffsetY;
        }
        break;
      }
      case 'panning': {
        this.renderer.offsetX = this.panStartOffsetX + (e.clientX - this.panStartX);
        this.renderer.offsetY = this.panStartOffsetY + (e.clientY - this.panStartY);
        break;
      }
      case 'connecting': {
        // 悬停在节点上时高亮
        break;
      }
    }
  }

  // ===== 鼠标释放 =====

  onMouseUp(e) {
    if (this.mode === 'dragging_node') {
      this.dragTarget = null;
    }
    if (this.mode === 'panning' || this.mode === 'dragging_node') {
      this.mode = 'idle';
      this.canvas.style.cursor = this.connectFromId ? 'crosshair' : 'default';
    }
  }

  // ===== 滚轮缩放 =====

  onWheel(e) {
    e.preventDefault();

    const zoomFactor = 1.08;
    const oldZoom = this.renderer.zoom;

    // Zoom in/out
    let newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
    newZoom = clamp(newZoom, 0.1, 5);

    // 以鼠标位置为中心缩放
    const zoomRatio = newZoom / oldZoom;
    this.renderer.offsetX = e.offsetX - (e.offsetX - this.renderer.offsetX) * zoomRatio;
    this.renderer.offsetY = e.offsetY - (e.offsetY - this.renderer.offsetY) * zoomRatio;
    this.renderer.zoom = newZoom;

    this.app.ui.updateZoomLevel();
  }

  // ===== 键盘 =====

  onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;

    // Delete: 删除选中元素（仅当焦点不在可编辑元素上时触发）
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.model.selectedId && !this.isEditableFocused()) {
        e.preventDefault();
        this.deleteSelected();
        return;
      }
    }

    // Escape: 取消操作（仅当焦点不在可编辑元素上时触发）
    if (e.key === 'Escape' && !this.isEditableFocused()) {
      if (this.connectFromId) this.cancelConnecting();
      else this.model.clearSelection();
      this.app.ui.hideProperties();
      return;
    }

    // Ctrl+S: 保存
    if (ctrl && e.key === 's') {
      e.preventDefault();
      this.app.persistence.saveModel();
      return;
    }

    // Ctrl+Z: 撤销
    if (ctrl && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.app.undoRedo.undo();
      return;
    }

    // Ctrl+Y / Ctrl+Shift+Z: 重做
    if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      this.app.undoRedo.redo();
      return;
    }

    // Ctrl+N: 新建
    if (ctrl && e.key === 'n') {
      e.preventDefault();
      this.app.newModel();
      return;
    }

    // + / - : 缩放（仅当焦点不在可编辑元素上时触发，避免干扰数字输入）
    if ((e.key === '=' || e.key === '+') && !this.isEditableFocused()) {
      e.preventDefault();
      this.zoomAtCenter(1.15);
      return;
    }
    if (e.key === '-' && !this.isEditableFocused()) {
      e.preventDefault();
      this.zoomAtCenter(1 / 1.15);
      return;
    }
    if (e.key === '0' && !this.isEditableFocused()) {
      e.preventDefault();
      this.renderer.zoom = 1;
      this.app.ui.updateZoomLevel();
      return;
    }
  }

  // ===== 触摸事件 (移动端支持) =====

  onTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const world = this.renderer.s2w(x, y);
      const node = findNodeAt(world.x, world.y, this.model.nodes);

      if (node) {
        e.preventDefault();
        this.mode = 'dragging_node';
        this.dragTarget = node;
        this.dragOffsetX = node.x - world.x;
        this.dragOffsetY = node.y - world.y;
        this.model.selectNode(node.id);
        this.app.ui.showProperties('node');
      } else {
        this.mode = 'panning';
        this.panStartX = touch.clientX;
        this.panStartY = touch.clientY;
        this.panStartOffsetX = this.renderer.offsetX;
        this.panStartOffsetY = this.renderer.offsetY;
      }

      this.lastMouseX = x;
      this.lastMouseY = y;
    }
  }

  onTouchMove(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (this.mode === 'dragging_node' && this.dragTarget) {
        const world = this.renderer.s2w(x, y);
        this.dragTarget.x = world.x + this.dragOffsetX;
        this.dragTarget.y = world.y + this.dragOffsetY;
      } else if (this.mode === 'panning') {
        this.renderer.offsetX = this.panStartOffsetX + (touch.clientX - this.panStartX);
        this.renderer.offsetY = this.panStartOffsetY + (touch.clientY - this.panStartY);
      }
    }
  }

  onTouchEnd(e) {
    this.mode = 'idle';
    this.dragTarget = null;
  }

  // ===== 拖放到画布 =====

  initDrop() {
    const paletteItems = document.querySelectorAll('.palette-item[draggable]');
    const canvasContainer = document.getElementById('canvas-container');

    paletteItems.forEach(item => {
      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', item.dataset.type);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', e => {
        item.classList.remove('dragging');
      });
    });

    canvasContainer.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    canvasContainer.addEventListener('drop', e => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (type) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = this.renderer.s2w(sx, sy);
        this.app.createNodeWithModal(type, world.x, world.y);
      }
    });
  }

  // ===== 连接操作 =====

  /** 开始连线模式 */
  startConnecting(nodeId) {
    this.connectFromId = nodeId;
    this.mode = 'connecting';
    this.canvas.style.cursor = 'crosshair';
    this.renderer.setConnectMousePos(this.lastMouseX, this.lastMouseY);
    this.app.ui.hideProperties();
  }

  /** 完成连线 */
  finishConnection(fromId, toId) {
    // 防止自连
    if (fromId === toId) {
      this.cancelConnecting();
      return;
    }
    // 防止重复连线
    if (this.model.findConnection(fromId, toId)) {
      this.cancelConnecting();
      return;
    }
    this.app.createConnection(fromId, toId);
    this.cancelConnecting();
  }

  /** 取消连线 */
  cancelConnecting() {
    this.connectFromId = null;
    this.mode = 'idle';
    this.canvas.style.cursor = 'default';
    this.renderer.clearConnectMousePos();
  }

  // ===== 删除操作 =====

  deleteSelected() {
    if (!this.model.selectedId) return;
    if (this.model.selectedType === 'node') {
      this.app.deleteNode(this.model.selectedId);
    } else if (this.model.selectedType === 'connection') {
      this.app.deleteConnection(this.model.selectedId);
    }
  }

  // ===== 辅助方法 =====

  zoomAtCenter(factor) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const oldZoom = this.renderer.zoom;
    const newZoom = clamp(oldZoom * factor, 0.1, 5);
    const ratio = newZoom / oldZoom;
    this.renderer.offsetX = cx - (cx - this.renderer.offsetX) * ratio;
    this.renderer.offsetY = cy - (cy - this.renderer.offsetY) * ratio;
    this.renderer.zoom = newZoom;
    this.app.ui.updateZoomLevel();
  }

  /** 检查当前焦点是否在可编辑元素上（输入框、文本域、下拉框等） */
  isEditableFocused() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  updateHoverCursor(hovered, world) {
    const newHoveredId = hovered ? hovered.id : null;
    if (hovered) {
      this.canvas.style.cursor = this.connectFromId ? 'pointer' : 'grab';
    } else {
      const conn = findConnectionAt(world.x, world.y, this.model.connections, this.model.nodes, 10);
      this.canvas.style.cursor = conn ? 'pointer' : (this.connectFromId ? 'crosshair' : 'default');
    }
    this.hoveredNodeId = newHoveredId;
  }
}