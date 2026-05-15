/**
 * SD-Tool 撤销/重做系统（命令模式）
 * 存储增量命令而非全量快照，大幅降低内存占用
 */

class UndoRedoManager {
  constructor(model) {
    this.model = model;
    this.stack = [];
    this.pointer = -1;
    this.maxSize = 200;
  }

  /**
   * 推送一个命令到撤销栈
   * @param {Object} command - { type, ...data }
   *   create-node:    { type: 'create-node', nodeData: {...} }
   *   delete-node:    { type: 'delete-node', nodeData: {...}, connectionsData: [...] }
   *   create-connection: { type: 'create-connection', connData: {...} }
   *   delete-connection: { type: 'delete-connection', connData: {...} }
   */
  pushState(command) {
    // 如果指针不在栈顶, 截断未来的命令
    if (this.pointer < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.pointer + 1);
    }

    this.stack.push({ command });
    this.pointer++;

    // 限制栈大小
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
      this.pointer--;
    }
  }

  /** 撤销：执行当前命令的反向操作 */
  undo() {
    if (this.pointer < 0) return false;

    const entry = this.stack[this.pointer];
    const cmd = entry.command;

    switch (cmd.type) {
      case 'create-node':
        // 反向：移除节点（级联删除关联连线）
        this.model.deleteNode(cmd.nodeData.id);
        break;

      case 'delete-node':
        // 反向：恢复节点及其连线
        this._restoreNode(cmd.nodeData, cmd.connectionsData);
        break;

      case 'create-connection':
        // 反向：移除连线
        this.model.deleteConnection(cmd.connData.id);
        break;

      case 'delete-connection':
        // 反向：恢复连线
        this.model.connections.push(this._clone(cmd.connData));
        break;

      default:
        console.warn('UndoRedoManager: unknown command type', cmd.type);
        return false;
    }

    this.pointer--;
    return true;
  }

  /** 重做：执行当前命令的正向操作 */
  redo() {
    if (this.pointer >= this.stack.length - 1) return false;

    this.pointer++;
    const entry = this.stack[this.pointer];
    const cmd = entry.command;

    switch (cmd.type) {
      case 'create-node':
        // 正向：重建节点
        this.model.nodes.push(this._clone(cmd.nodeData));
        break;

      case 'delete-node':
        // 正向：再次删除节点
        this.model.deleteNode(cmd.nodeData.id);
        break;

      case 'create-connection':
        // 正向：重建连线
        this.model.connections.push(this._clone(cmd.connData));
        break;

      case 'delete-connection':
        // 正向：再次删除连线
        this.model.deleteConnection(cmd.connData.id);
        break;

      default:
        console.warn('UndoRedoManager: unknown command type', cmd.type);
        return false;
    }

    return true;
  }

  /** 清除所有历史 */
  clear() {
    this.stack = [];
    this.pointer = -1;
  }

  /** 是否可以撤销 */
  canUndo() {
    return this.pointer >= 0;
  }

  /** 是否可以重做 */
  canRedo() {
    return this.pointer < this.stack.length - 1;
  }

  /** 获取历史记录信息 */
  getHistoryInfo() {
    return {
      total: this.stack.length,
      current: this.pointer + 1,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  // ---- 内部方法 ----

  /** 深拷贝对象（仅处理 JSON 安全数据） */
  _clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** 恢复被删除的节点及其连线 */
  _restoreNode(nodeData, connectionsData) {
    this.model.nodes.push(this._clone(nodeData));
    if (connectionsData && connectionsData.length > 0) {
      for (const conn of connectionsData) {
        this.model.connections.push(this._clone(conn));
      }
    }
  }
}