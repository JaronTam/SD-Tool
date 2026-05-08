/**
 * SD-Tool 持久化: 本地存储保存/加载模型
 */

class PersistenceManager {
  constructor(app) {
    this.app = app;
    this.model = app.model;
    this.storageKey = 'sd-tool-model';
  }

  /** 保存模型到 localStorage */
  saveModel() {
    const data = this.model.toJSON();
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      this.showToast('模型已保存到本地');
    } catch (e) {
      this.showToast('保存失败: ' + e.message, 'error');
    }
  }

  /** 从 localStorage 加载模型 */
  loadModel() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        this.showToast('没有已保存的模型', 'warn');
        return;
      }
      const data = JSON.parse(raw);
      if (!data || !data.nodes) {
        this.showToast('无效的模型数据', 'error');
        return;
      }
      this.model.fromJSON(data);
      this.app.ui.updateModuleList();
      this.app.ui.hideProperties();
      this.showToast('模型已加载');
    } catch (e) {
      this.showToast('加载失败: ' + e.message, 'error');
    }
  }

  /** 导出模型为 JSON 文件下载 */
  exportToFile() {
    const data = this.model.toJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sd-model-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('模型已导出');
  }

  /** 从 JSON 文件导入模型 */
  importFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.model.fromJSON(data);
        this.app.ui.updateModuleList();
        this.app.ui.hideProperties();
        this.showToast('模型已导入');
      } catch (err) {
        this.showToast('无效的模型文件', 'error');
      }
    };
    reader.readAsText(file);
  }

  /** 检查是否有已保存的模型 */
  hasSavedModel() {
    return localStorage.getItem(this.storageKey) !== null;
  }

  /** Toast 提示 */
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast toast-' + type + ' visible';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.className = 'toast';
    }, 2000);
  }
}