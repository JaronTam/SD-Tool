/**
 * SD-Tool 撤销/重做系统
 */

class UndoRedoManager {
  constructor(model) {
    this.model = model;
    this.stack = [];
    this.pointer = -1;
    this.maxSize = 200;
    this.commandInProgress = null; // 用于批量操作
  }

  /** 推送一个状态快照 */
  pushState(actionLabel = '') {
    // 如果指针不在栈顶, 截断未来的 states
    if (this.pointer < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.pointer + 1);
    }

    const snapshot = this.model.toJSON();
    this.stack.push({ snapshot, label: actionLabel });
    this.pointer++;

    // 限制栈大小
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
      this.pointer--;
    }
  }

  /** 撤销 */
  undo() {
    if (this.pointer < 0) return false;

    // 如果当前是最新状态, 先保存当前状态
    if (this.pointer === this.stack.length - 1) {
      const current = this.model.toJSON();
      this.stack.push({ snapshot: current, label: '(撤销前状态)' });
      // pointer 仍然指向新 push 的栈顶 - 1, 即我们想要恢复的状态
      this.pointer = this.stack.length - 2;
    } else {
      this.pointer--;
    }

    if (this.pointer < 0) {
      this.pointer = 0;
      return false;
    }

    this.model.fromJSON(this.stack[this.pointer].snapshot);
    return true;
  }

  /** 重做 */
  redo() {
    if (this.pointer >= this.stack.length - 1) return false;
    this.pointer++;
    this.model.fromJSON(this.stack[this.pointer].snapshot);
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
}