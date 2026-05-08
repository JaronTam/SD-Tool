/**
 * SD-Tool 主应用
 * 系统动力学模拟工具 - 无限画布建模
 */

class SDToolApp {
  constructor() {
    // Canvas
    this.canvas = document.getElementById('canvas-main');
    this.minimap = document.getElementById('minimap');

    // 核心模块
    this.model = new SDModel();
    this.renderer = new CanvasRenderer(this.canvas, this.minimap);
    this.undoRedo = new UndoRedoManager(this.model);
    this.persistence = new PersistenceManager(this);
    this.interaction = new InteractionHandler(this);
    this.ui = new UIManager(this);

    // 动画循环
    this._rafId = null;
    this._lastTime = 0;

    // 调试模式
    this.debug = false;

    this.init();
  }

  init() {
    // 初始化 Canvas 大小
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // 初始状态快照
    this.undoRedo.clear();

    // 启动渲染循环
    this._lastTime = performance.now();
    this.loop(this._lastTime);

    // 自动加载上次模型
    if (this.persistence.hasSavedModel()) {
      this.persistence.loadModel();
    }

    // 全局引用
    window.app = this;

    console.log('SD-Tool initialized. Canvas:', this.canvas.width, 'x', this.canvas.height);
  }

  /** 渲染循环 */
  loop(time) {
    this._rafId = requestAnimationFrame((t) => this.loop(t));

    // 渲染
    this.renderer.render(this.model, this.interaction.connectFromId);

    // 更新 UI
    this._updateTools();
  }

  /** 更新工具栏按钮状态 */
  _updateTools() {
    const canUndo = this.undoRedo.canUndo();
    const canRedo = this.undoRedo.canRedo();
    document.getElementById('btn-undo').disabled = !canUndo;
    document.getElementById('btn-redo').disabled = !canRedo;
  }

  // ===== 画布大小 =====

  resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';

    const ctx = this.canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 小地图固定大小
    const minimapSize = 150;
    this.minimap.width = minimapSize;
    this.minimap.height = minimapSize;
    this.minimap.style.width = minimapSize + 'px';
    this.minimap.style.height = minimapSize + 'px';
  }

  // ===== 新建模型 =====

  newModel() {
    if (this.model.nodes.length > 0 || this.model.connections.length > 0) {
      if (!confirm('确定要新建模型吗? 当前未保存的更改将丢失。')) return;
    }
    this.model.clear();
    this.undoRedo.clear();
    this.renderer.offsetX = 0;
    this.renderer.offsetY = 0;
    this.renderer.zoom = 1;
    this.ui.hideProperties();
    this.ui.updateModuleList();
    this.ui.updateZoomLevel();
  }

  // ===== 节点 CRUD =====

  /** 直接创建节点（不弹对话框，用于恢复/复制等场景） */
  createNode(type, x, y) {
    const node = this.model.createNode(type, x, y);
    this.undoRedo.pushState('创建模块');
    this.ui.updateModuleList();
    return node;
  }

  /** 创建节点并弹出配置对话框 */
  createNodeWithModal(type, x, y) {
    this.ui.showCreateNodeModal(type, x, y);
  }

  /** 删除节点以及相连的连线 */
  deleteNode(nodeId) {
    this.model.deleteNode(nodeId);
    this.undoRedo.pushState('删除模块');
    this.ui.hideProperties();
    this.ui.updateModuleList();
  }

  // ===== 连线 CRUD =====

  /** 创建连线并弹出属性面板 */
  createConnection(fromId, toId) {
    const conn = this.model.createConnection(fromId, toId);
    this.undoRedo.pushState('创建连线');
    // 选中连线并展示属性
    this.model.selectConnection(conn.id);
    this.ui.showProperties('connection');
    return conn;
  }

  /** 删除连线 */
  deleteConnection(connId) {
    this.model.deleteConnection(connId);
    this.undoRedo.pushState('删除连线');
    this.ui.hideProperties();
  }
}

// ===== 应用启动 =====

document.addEventListener('DOMContentLoaded', () => {
  new SDToolApp();
});