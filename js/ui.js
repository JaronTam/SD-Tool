/**
 * SD-Tool UI管理
 * 属性面板、模态对话框、上下文菜单、工具栏操作
 */

class UIManager {
  constructor(app) {
    this.app = app;
    this.model = app.model;

    // DOM 引用
    this.propPanel = document.getElementById('property-panel');
    this.propContent = document.getElementById('property-panel-content');
    this.moduleList = document.getElementById('module-list');
    this.contextMenu = document.getElementById('context-menu');
    this.coordsDisplay = document.getElementById('coords-display');
    this.zoomLevel = document.getElementById('zoom-level');
    this.modalOverlay = document.getElementById('modal-overlay');
    this.modalDialog = document.getElementById('modal-dialog');

    this.init();
  }

  init() {
    // 关闭属性面板按钮
    document.getElementById('btn-close-props').addEventListener('click', () => this.hideProperties());

    // 工具栏按钮
    document.getElementById('btn-new').addEventListener('click', () => this.app.newModel());
    document.getElementById('btn-save').addEventListener('click', () => this.app.persistence.saveModel());
    document.getElementById('btn-load').addEventListener('click', () => this.app.persistence.loadModel());
    document.getElementById('btn-undo').addEventListener('click', () => this.app.undoRedo.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.app.undoRedo.redo());
    document.getElementById('btn-zoom-in').addEventListener('click', () => this.zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => this.zoomOut());
    document.getElementById('btn-fit').addEventListener('click', () => this.fitToScreen());
    document.getElementById('btn-help').addEventListener('click', () => this.showHelp());

    // 上下文菜单项
    this.contextMenu.querySelectorAll('li[data-action]').forEach(li => {
      li.addEventListener('click', (e) => {
        this.handleContextAction(li.dataset.action);
        this.hideContextMenu();
      });
    });

    // 隐藏上下文菜单
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // 右键菜单
    this.app.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY);
    });
  }

  // ===== 属性面板 =====

  showProperties(type) {
    this.propPanel.classList.remove('collapsed');
    const el = this.model.getSelected();
    if (!el) return;

    if (type === 'node') {
      this.renderNodeProperties(el);
    } else if (type === 'connection') {
      this.renderConnectionProperties(el);
    }
  }

  hideProperties() {
    this.propPanel.classList.add('collapsed');
  }

  renderNodeProperties(node) {
    const config = NODE_TYPE_CONFIG[node.type];
    let html = '<div class="props-group"><label>类型</label>';
    html += `<input type="text" value="${config.label}" disabled></div>`;

    // 名称
    html += `<div class="props-group"><label>名称</label>`;
    html += `<input type="text" id="prop-name" value="${this.escapeHtml(node.name)}" data-field="name"></div>`;

    if (node.type === 'stock') {
      // 存量: value
      html += `<div class="props-row">`;
      html += `<div class="props-group"><label>存量值</label>`;
      html += `<input type="number" id="prop-value" value="${node.value}" step="10" data-field="value"></div>`;
      html += `<div class="props-group"><label>单位</label>`;
      html += `<input type="text" id="prop-unit" value="${this.escapeHtml(node.unit || '')}" data-field="unit"></div>`;
      html += `</div>`;
    } else if (node.type === 'source-sink') {
      // 源/汇: isSource, rate
      html += `<div class="props-group"><label>角色</label>`;
      html += `<select id="prop-isSource" data-field="isSource">`;
      html += `<option value="true" ${node.isSource ? 'selected' : ''}>源 (Source) - 产生输入</option>`;
      html += `<option value="false" ${!node.isSource ? 'selected' : ''}>汇 (Sink) - 吸收输出</option>`;
      html += `</select></div>`;
      html += `<div class="props-row">`;
      html += `<div class="props-group"><label>速率</label>`;
      html += `<input type="number" id="prop-rate" value="${node.rate}" step="10" data-field="rate"></div>`;
      html += `<div class="props-group"><label>单位</label>`;
      html += `<input type="text" id="prop-unit" value="${this.escapeHtml(node.unit || '')}" data-field="unit"></div>`;
      html += `</div>`;
    }

    // 描述
    html += `<div class="props-group"><label>描述</label>`;
    html += `<textarea id="prop-description" data-field="description">${this.escapeHtml(node.description || '')}</textarea></div>`;

    // 位置
    html += `<div class="props-row">`;
    html += `<div class="props-group"><label>X</label>`;
      html += `<input type="number" id="prop-x" value="${Math.round(node.x)}" step="10" data-field="x"></div>`;
    html += `<div class="props-group"><label>Y</label>`;
      html += `<input type="number" id="prop-y" value="${Math.round(node.y)}" step="10" data-field="y"></div>`;
    html += `</div>`;

    // 操作按钮
    html += `<div class="props-group">`;
    html += `<button class="btn-danger" id="btn-delete-node" style="width:100%; padding:8px; margin-top:8px; border:1px solid #f06070; background:transparent; color:#f06070; border-radius:4px; cursor:pointer;">🗑️ 删除模块</button>`;
    html += `</div>`;

    // 从该节点开始连线
    html += `<div class="props-group">`;
    html += `<button id="btn-connect-from" style="width:100%; padding:8px; border:1px solid #f0a860; background:transparent; color:#f0a860; border-radius:4px; cursor:pointer;">🔗 从此模块连线</button>`;
    html += `</div>`;

    this.propContent.innerHTML = html;

    // 绑定事件
    this.bindPropsInputEvents(node);

    document.getElementById('btn-delete-node').addEventListener('click', () => {
      this.app.deleteNode(node.id);
    });
    document.getElementById('btn-connect-from').addEventListener('click', () => {
      this.app.interaction.startConnecting(node.id);
    });
  }

  renderConnectionProperties(conn) {
    const fromNode = this.model.getNode(conn.fromId);
    const toNode = this.model.getNode(conn.toId);
    const fromName = fromNode ? fromNode.name : '(已删除)';
    const toName = toNode ? toNode.name : '(已删除)';
    const dirLabel = conn.direction === 'negative' ? '负反馈 (−)' : '正反馈 (+)';

    let html = '';

    // 方向展示
    html += `<div class="conn-arrow">`;
    html += `<span class="from-to">${this.escapeHtml(fromName)}</span>`;
    html += `<span class="arrow-icon">→</span>`;
    html += `<span class="from-to">${this.escapeHtml(toName)}</span>`;
    html += `</div>`;

    // 名称
    html += `<div class="props-group"><label>名称</label>`;
    html += `<input type="text" id="prop-name" value="${this.escapeHtml(conn.name || '')}" data-field="name"></div>`;

    // 流量速率
    html += `<div class="props-group"><label>流量速率</label>`;
      html += `<input type="number" id="prop-flowRate" value="${conn.flowRate}" step="10" data-field="flowRate"></div>`;

    // 反馈方向 (正/负)
    html += `<div class="props-group"><label>反馈方向</label>`;
    html += `<select id="prop-direction" data-field="direction">`;
    html += `<option value="positive" ${conn.direction === 'positive' ? 'selected' : ''}>正反馈 (+) - 更多带来更多</option>`;
    html += `<option value="negative" ${conn.direction === 'negative' ? 'selected' : ''}>负反馈 (−) - 更多带来更少</option>`;
    html += `</select></div>`;

    // 流量类型 (可变/不变)
    html += `<div class="props-group"><label>流量类型</label>`;
    html += `<select id="prop-flowType" data-field="flowType">`;
    html += `<option value="variable" ${conn.flowType === 'variable' ? 'selected' : ''}>可变流量 ▽ - 速率可随时间变化</option>`;
    html += `<option value="constant" ${conn.flowType === 'constant' ? 'selected' : ''}>不变流量 ◯ - 速率恒定</option>`;
    html += `</select></div>`;

    // 删除
    html += `<div class="props-group">`;
    html += `<button id="btn-delete-conn" style="width:100%; padding:8px; border:1px solid #f06070; background:transparent; color:#f06070; border-radius:4px; cursor:pointer;">🗑️ 删除连线</button>`;
    html += `</div>`;

    this.propContent.innerHTML = html;

    this.bindPropsInputEvents(conn);

    document.getElementById('btn-delete-conn').addEventListener('click', () => {
      this.app.deleteConnection(conn.id);
    });
  }

  /** 为属性面板的输入控件绑定变更事件（使用替换克隆节点清除旧监听器，避免重复绑定） */
  bindPropsInputEvents(target) {
    const inputs = this.propContent.querySelectorAll('input[data-field], select[data-field], textarea[data-field]');
    inputs.forEach(input => {
      // 清除旧监听器: 克隆节点并替换原节点
      const clone = input.cloneNode(true);
      input.parentNode.replaceChild(clone, input);

      const field = clone.dataset.field;
      clone.addEventListener('change', () => {
        let value = clone.value;
        if (clone.type === 'number') value = parseFloat(value);
        if (field === 'isSource') value = value === 'true';

        if (this.model.selectedType === 'node') {
          this.model.updateNode(target.id, { [field]: value });
        } else if (this.model.selectedType === 'connection') {
          this.model.updateConnection(target.id, { [field]: value });
        }
      });
    });
  }

  // ===== 上下文菜单 =====

  showContextMenu(x, y) {
    this.contextMenu.classList.remove('hidden');
    this.contextMenu.style.left = x + 'px';
    this.contextMenu.style.top = y + 'px';

    // 右键点击的节点也选中（需先选中，后续菜单项判断才能反映当前选中状态）
    const world = this.app.renderer.s2w(
      x - this.app.canvas.getBoundingClientRect().left,
      y - this.app.canvas.getBoundingClientRect().top
    );
    const node = findNodeAt(world.x, world.y, this.model.nodes);
    if (node) {
      this.model.selectNode(node.id);
    }

    // 根据是否有选中元素显示不同菜单项
    const hasSelected = this.model.selectedId !== null;
    const isConnecting = this.app.interaction.connectFromId !== null;

    this.contextMenu.querySelectorAll('li[data-action]').forEach(li => {
      const action = li.dataset.action;
      if (action === 'edit') li.style.display = hasSelected ? '' : 'none';
      if (action === 'connect') li.style.display = this.model.selectedType === 'node' && !isConnecting ? '' : 'none';
      if (action === 'duplicate') li.style.display = this.model.selectedType === 'node' ? '' : 'none';
      if (action === 'delete') li.style.display = hasSelected ? '' : 'none';
    });
  }

  hideContextMenu() {
    this.contextMenu.classList.add('hidden');
  }

  handleContextAction(action) {
    switch (action) {
      case 'edit': {
        if (this.model.selectedId) {
          this.showProperties(this.model.selectedType);
        }
        break;
      }
      case 'connect': {
        if (this.model.selectedType === 'node') {
          this.app.interaction.startConnecting(this.model.selectedId);
        }
        break;
      }
      case 'duplicate': {
        if (this.model.selectedType === 'node') {
          const node = this.model.getNode(this.model.selectedId);
          if (node) {
            const newNode = this.app.createNode(node.type, node.x + 150, node.y + 50);
            // 复制属性
            this.model.updateNode(newNode.id, {
              name: node.name + ' (副本)',
              value: node.value,
              rate: node.rate,
              isSource: node.isSource,
              unit: node.unit,
              description: node.description
            });
          }
        }
        break;
      }
      case 'delete': {
        if (this.model.selectedType === 'node') {
          this.app.deleteNode(this.model.selectedId);
        } else if (this.model.selectedType === 'connection') {
          this.app.deleteConnection(this.model.selectedId);
        }
        break;
      }
    }
  }

  // ===== 模块列表 =====

  updateModuleList() {
    const list = this.moduleList;
    list.innerHTML = '';

    this.model.nodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'module-list-item';
      if (node.id === this.model.selectedId && this.model.selectedType === 'node') {
        item.classList.add('selected');
      }

      const config = NODE_TYPE_CONFIG[node.type];
      item.innerHTML = `
        <span class="module-list-name">${config.icon} ${this.escapeHtml(node.name)}</span>
        <span class="module-list-type">${this.escapeHtml(config.label)}</span>
      `;

      item.addEventListener('click', () => {
        this.model.selectNode(node.id);
        this.showProperties('node');
        // 居中显示该节点
        this.app.renderer.offsetX = this.app.canvas.width / 2 - node.x * this.app.renderer.zoom;
        this.app.renderer.offsetY = this.app.canvas.height / 2 - node.y * this.app.renderer.zoom;
        this.updateModuleList();
      });

      item.addEventListener('dblclick', () => {
        this.model.selectNode(node.id);
        this.showNodeEditModal(node);
      });

      list.appendChild(item);
    });
  }

  // ===== 模态对话框 =====

  showModal(title, contentHtml, buttons) {
    document.getElementById('modal-dialog').innerHTML = `
      <h2>${title}</h2>
      <div class="modal-content">${contentHtml}</div>
      <div class="modal-actions">${buttons}</div>
    `;
    this.modalOverlay.classList.remove('hidden');
  }

  hideModal() {
    this.modalOverlay.classList.add('hidden');
  }

  /** 编辑节点模态 */
  showNodeEditModal(node) {
    const config = NODE_TYPE_CONFIG[node.type];
    let fieldsHtml = '';

    fieldsHtml += `<div class="props-group"><label>名称</label>`;
    fieldsHtml += `<input type="text" id="modal-name" value="${this.escapeHtml(node.name)}"></div>`;

    if (node.type === 'stock') {
      fieldsHtml += `<div class="props-row">`;
      fieldsHtml += `<div class="props-group"><label>存量值</label>`;
      fieldsHtml += `<input type="number" id="modal-value" value="${node.value}" step="10"></div>`;
      fieldsHtml += `<div class="props-group"><label>单位</label>`;
      fieldsHtml += `<input type="text" id="modal-unit" value="${this.escapeHtml(node.unit || '')}"></div>`;
      fieldsHtml += `</div>`;
    } else {
      fieldsHtml += `<div class="props-group"><label>角色</label>`;
      fieldsHtml += `<select id="modal-isSource">`;
      fieldsHtml += `<option value="true" ${node.isSource ? 'selected' : ''}>源 (Source)</option>`;
      fieldsHtml += `<option value="false" ${!node.isSource ? 'selected' : ''}>汇 (Sink)</option>`;
      fieldsHtml += `</select></div>`;
      fieldsHtml += `<div class="props-row">`;
      fieldsHtml += `<div class="props-group"><label>速率</label>`;
      fieldsHtml += `<input type="number" id="modal-rate" value="${node.rate}" step="10"></div>`;
      fieldsHtml += `<div class="props-group"><label>单位</label>`;
      fieldsHtml += `<input type="text" id="modal-unit" value="${this.escapeHtml(node.unit || '')}"></div>`;
      fieldsHtml += `</div>`;
    }

    fieldsHtml += `<div class="props-group"><label>描述</label>`;
    fieldsHtml += `<textarea id="modal-description">${this.escapeHtml(node.description || '')}</textarea></div>`;

    const buttons = `
      <button class="btn-cancel" onclick="app.ui.hideModal()">取消</button>
      <button class="btn-primary" id="btn-modal-save">保存</button>
    `;

    this.showModal(`编辑 ${config.label}`, fieldsHtml, buttons);

    document.getElementById('btn-modal-save').addEventListener('click', () => {
      const updates = {
        name: document.getElementById('modal-name').value,
        description: document.getElementById('modal-description').value,
        unit: document.getElementById('modal-unit').value
      };
      if (node.type === 'stock') {
        updates.value = parseFloat(document.getElementById('modal-value').value) || 0;
      } else {
        updates.rate = parseFloat(document.getElementById('modal-rate').value) || 0;
        updates.isSource = document.getElementById('modal-isSource').value === 'true';
      }
      this.model.updateNode(node.id, updates);
      this.hideModal();
      this.updateModuleList();
    });
  }

  /** 创建节点时的模态 (拖入画布后弹出) */
  showCreateNodeModal(type, x, y) {
    const config = NODE_TYPE_CONFIG[type];
    const defaults = type === 'stock' ? DEFAULTS.stock : DEFAULTS.sourceSink;
    let fieldsHtml = '';

    fieldsHtml += `<div class="props-group"><label>模块类型</label>`;
    fieldsHtml += `<input type="text" value="${config.label}" disabled></div>`;

    fieldsHtml += `<div class="props-group"><label>名称</label>`;
    fieldsHtml += `<input type="text" id="modal-name" value="${defaults.name}"></div>`;

    if (type === 'stock') {
      fieldsHtml += `<div class="props-row">`;
      fieldsHtml += `<div class="props-group"><label>存量值</label>`;
      fieldsHtml += `<input type="number" id="modal-value" value="${defaults.value}" step="10"></div>`;
      fieldsHtml += `<div class="props-group"><label>单位</label>`;
      fieldsHtml += `<input type="text" id="modal-unit" value="${defaults.unit}"></div>`;
      fieldsHtml += `</div>`;
    } else {
      fieldsHtml += `<div class="props-group"><label>角色</label>`;
      fieldsHtml += `<select id="modal-isSource">`;
      fieldsHtml += `<option value="true" selected>源 (Source) - 产生输入</option>`;
      fieldsHtml += `<option value="false">汇 (Sink) - 吸收输出</option>`;
      fieldsHtml += `</select></div>`;
      fieldsHtml += `<div class="props-row">`;
      fieldsHtml += `<div class="props-group"><label>速率</label>`;
      fieldsHtml += `<input type="number" id="modal-rate" value="${defaults.rate}" step="10"></div>`;
      fieldsHtml += `<div class="props-group"><label>单位</label>`;
      fieldsHtml += `<input type="text" id="modal-unit" value="${defaults.unit}"></div>`;
      fieldsHtml += `</div>`;
    }

    fieldsHtml += `<div class="props-group"><label>描述</label>`;
    fieldsHtml += `<textarea id="modal-description">${defaults.description}</textarea></div>`;

    const buttons = `
      <button class="btn-cancel" onclick="app.ui.hideModal()">取消</button>
      <button class="btn-primary" id="btn-modal-create">创建</button>
    `;

    this.showModal('创建模块', fieldsHtml, buttons);

    document.getElementById('btn-modal-create').addEventListener('click', () => {
      const node = this.app.createNode(type, x, y);
      const updates = {
        name: document.getElementById('modal-name').value || defaults.name,
        description: document.getElementById('modal-description').value,
        unit: document.getElementById('modal-unit').value
      };
      if (type === 'stock') {
        updates.value = parseFloat(document.getElementById('modal-value').value) || 0;
      } else {
        updates.rate = parseFloat(document.getElementById('modal-rate').value) || 0;
        updates.isSource = document.getElementById('modal-isSource').value === 'true';
      }
      this.model.updateNode(node.id, updates);
      this.hideModal();
      this.updateModuleList();
      this.model.selectNode(node.id);
      this.showProperties('node');
    });
  }

  /** 帮助对话框 */
  showHelp() {
    const html = `
      <div class="help-section">
        <h3>🎯 系统动力学模拟工具</h3>
        <p>SD-Tool 用于构建和可视化系统动力学模型。模型由 <b>存量</b>、<b>源/汇</b> 和 <b>流量连线</b> 组成。</p>
      </div>
      <div class="help-section">
        <h3>🧱 模块</h3>
        <ul>
          <li><b>存量 (Stock)</b>: 方框表示, 记录某个变量的数量/水平</li>
          <li><b>源 (Source)</b>: 云形表示, 产生存量输入</li>
          <li><b>汇 (Sink)</b>: 云形表示, 吸收存量输出</li>
        </ul>
      </div>
      <div class="help-section">
        <h3>🔗 连线与流量</h3>
        <ul>
          <li>从左侧面板拖入模块, 或在画布上右键选择</li>
          <li>选中模块后点击属性面板中的"从此模块连线"</li>
          <li><b>正反馈 (+)</b>: 橙色箭头, 更多→更多</li>
          <li><b>负反馈 (−)</b>: 红色箭头, 更多→更少</li>
          <li><b>可变流量</b>: 倒三角▽, <b>不变流量</b>: 圆圈◯</li>
        </ul>
      </div>
      <div class="help-section">
        <h3>⌨️ 快捷键</h3>
        <ul>
          <li><kbd>拖拽</kbd> 模块: 移动位置</li>
          <li><kbd>Alt+拖拽</kbd> / <kbd>中键拖拽</kbd>: 平移画布</li>
          <li><kbd>滚轮</kbd>: 缩放画布 (0.1x ~ 5x)</li>
          <li><kbd>Ctrl+S</kbd>: 保存模型</li>
          <li><kbd>Ctrl+Z</kbd>: 撤销</li>
          <li><kbd>Ctrl+Y</kbd>: 重做</li>
          <li><kbd>Ctrl+N</kbd>: 新建模型</li>
          <li><kbd>Delete</kbd>: 删除选中元素</li>
          <li><kbd>Esc</kbd>: 取消/取消选择</li>
          <li><kbd>+/=</kbd> <kbd>-</kbd>: 缩放</li>
        </ul>
      </div>
    `;

    const buttons = `<button class="btn-primary" onclick="app.ui.hideModal()">知道了</button>`;
    this.showModal('帮助', html, buttons);
  }

  // ===== 坐标和缩放显示 =====

  updateCoords(worldX, worldY) {
    this.coordsDisplay.textContent = `${Math.round(worldX)}, ${Math.round(worldY)}`;
  }

  updateZoomLevel() {
    this.zoomLevel.textContent = Math.round(this.app.renderer.zoom * 100) + '%';
  }

  // ===== 缩放操作 =====

  zoomIn() {
    this.app.interaction.zoomAtCenter(1.2);
  }

  zoomOut() {
    this.app.interaction.zoomAtCenter(1 / 1.2);
  }

  fitToScreen() {
    const nodes = this.model.nodes;
    if (nodes.length === 0) return;

    // 计算包围盒
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
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
    const dpr = window.devicePixelRatio || 1;
    const canvasW = this.app.canvas.width / dpr;
    const canvasH = this.app.canvas.height / dpr;

    const zoomX = canvasW / worldW;
    const zoomY = canvasH / worldH;
    const zoom = Math.min(zoomX, zoomY, 2);

    this.app.renderer.zoom = zoom;
    this.app.renderer.offsetX = canvasW / 2 - ((minX + maxX) / 2) * zoom;
    this.app.renderer.offsetY = canvasH / 2 - ((minY + maxY) / 2) * zoom;

    this.updateZoomLevel();
  }

  // ===== 辅助 =====

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}