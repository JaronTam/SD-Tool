/**
 * SD-Tool 数据模型
 * 系统动力学模型由 Node（存量/源/汇）和 Connection（流量）组成
 */

// ===== 默认值 =====
const DEFAULTS = {
  stock: {
    name: '存量',
    type: 'stock',
    value: 100,
    unit: '',
    description: ''
  },
  sourceSink: {
    name: '源/汇',
    type: 'source-sink',
    isSource: true,
    rate: 10,
    unit: '',
    description: ''
  },
  connection: {
    name: '',
    flowRate: 1,
    direction: 'positive',
    flowType: 'variable', // 'variable' | 'constant'
  }
};

// ===== 主数据模型 =====
class SDModel {
  constructor() {
    this.nodes = [];           // 所有模块
    this.connections = [];    // 所有连线
    this.selectedId = null;   // 当前选中元素ID (node.id 或 conn.id)
    this.selectedType = null; // 'node' | 'connection' | null
  }

  // ---- Node 操作 ----

  /** 创建节点 */
  createNode(type, x, y) {
    const defaults = type === 'stock' ? DEFAULTS.stock : DEFAULTS.sourceSink;
    const node = {
      id: generateId(),
      type: type,
      name: defaults.name,
      x: x,
      y: y,
      value: type === 'stock' ? defaults.value : undefined,
      isSource: type === 'source-sink' ? true : undefined,
      rate: type === 'source-sink' ? defaults.rate : undefined,
      unit: defaults.unit,
      description: defaults.description
    };
    this.nodes.push(node);
    return node;
  }

  /** 更新节点 */
  updateNode(id, props) {
    const node = this.nodes.find(n => n.id === id);
    if (node) Object.assign(node, props);
  }

  /** 删除节点 */
  deleteNode(id) {
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.connections = this.connections.filter(c => c.fromId !== id && c.toId !== id);
    if (this.selectedId === id && this.selectedType === 'node') {
      this.clearSelection();
    }
  }

  /** 获取节点 */
  getNode(id) {
    return this.nodes.find(n => n.id === id);
  }

  // ---- Connection 操作 ----

  /** 创建连线 */
  createConnection(fromId, toId) {
    const conn = {
      id: generateId(),
      fromId: fromId,
      toId: toId,
      name: DEFAULTS.connection.name,
      flowRate: DEFAULTS.connection.flowRate,
      direction: DEFAULTS.connection.direction, // 'positive' | 'negative'
      flowType: DEFAULTS.connection.flowType // 'variable' | 'constant'
    };
    this.connections.push(conn);
    return conn;
  }

  /** 更新连线 */
  updateConnection(id, props) {
    const conn = this.connections.find(c => c.id === id);
    if (conn) Object.assign(conn, props);
  }

  /** 删除连线 */
  deleteConnection(id) {
    this.connections = this.connections.filter(c => c.id !== id);
    if (this.selectedId === id && this.selectedType === 'connection') {
      this.clearSelection();
    }
  }

  /** 获取连线 */
  getConnection(id) {
    return this.connections.find(c => c.id === id);
  }

  /** 查找两个节点间的连线 */
  findConnection(fromId, toId) {
    return this.connections.find(c => c.fromId === fromId && c.toId === toId);
  }

  // ---- 选择操作 ----

  /** 选择节点 */
  selectNode(id) {
    this.selectedId = id;
    this.selectedType = 'node';
  }

  /** 选择连线 */
  selectConnection(id) {
    this.selectedId = id;
    this.selectedType = 'connection';
  }

  /** 清除选择 */
  clearSelection() {
    this.selectedId = null;
    this.selectedType = null;
  }

  /** 获取选中元素 */
  getSelected() {
    if (!this.selectedId) return null;
    if (this.selectedType === 'node') return this.getNode(this.selectedId);
    if (this.selectedType === 'connection') return this.getConnection(this.selectedId);
    return null;
  }

  // ---- 序列化 ----

  /** 导出模型为JSON对象 */
  toJSON() {
    return {
      version: 1,
      nodes: this.nodes.map(n => ({ ...n })),
      connections: this.connections.map(c => ({ ...c }))
    };
  }

  /** 从JSON对象导入模型 */
  fromJSON(data) {
    this.nodes = (data.nodes || []).map(n => ({ ...n }));
    this.connections = (data.connections || []).map(c => ({ ...c }));
    this.clearSelection();
  }

  /** 清空整个模型 */
  clear() {
    this.nodes = [];
    this.connections = [];
    this.clearSelection();
  }

  /** 获取模型统计 */
  getStats() {
    return {
      nodeCount: this.nodes.length,
      stockCount: this.nodes.filter(n => n.type === 'stock').length,
      sourceSinkCount: this.nodes.filter(n => n.type === 'source-sink').length,
      connectionCount: this.connections.length
    };
  }
}

// ===== 模块类型定义 =====
const NODE_TYPE_CONFIG = {
  stock: {
    label: '存量 (Stock)',
    shape: 'rectangle',
    color: '#5b9cfa',
    fields: ['name', 'value', 'unit', 'description'],
    icon: '▣'
  },
  'source-sink': {
    label: '源/汇 (Source/Sink)',
    shape: 'cloud',
    color: '#4ecb8c',
    fields: ['name', 'isSource', 'rate', 'unit', 'description'],
    icon: '☁'
  }
};