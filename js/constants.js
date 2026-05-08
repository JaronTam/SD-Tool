/**
 * SD-Tool 全局常量
 * 系统动力学模拟工具
 */

// ===== 节点类型 =====
const NODE_TYPES = {
  STOCK: 'stock',
  SOURCE_SINK: 'source-sink'
};

// ===== 流量类型 =====
const FLOW_TYPES = {
  INFLOW: 'inflow',       // 正反馈输入
  OUTFLOW: 'outflow'      // 负反馈输出
};

// ===== 反馈类型 =====
const FEEDBACK_TYPES = {
  POSITIVE: 'positive',   // 正反馈 +
  NEGATIVE: 'negative'    // 负反馈 -
};

// ===== 颜色常量 =====
const COLORS = {
  // 节点颜色
  STOCK_FILL: 'rgba(91, 155, 250, 0.2)',
  STOCK_STROKE: '#5b9cfa',
  STOCK_STROKE_ACTIVE: '#8db8ff',
  STOCK_TEXT: '#cdd6f4',

  SOURCE_SINK_FILL: 'rgba(240, 168, 96, 0.2)',
  SOURCE_SINK_STROKE: '#f0a860',
  SOURCE_SINK_STROKE_ACTIVE: '#f5c080',
  SOURCE_SINK_TEXT: '#f0c080',

  // 连线颜色
  CONNECTION_STROKE: '#6c7086',
  CONNECTION_STROKE_HOVER: '#a6adc8',
  CONNECTION_POSITIVE: '#4ecb8c',
  CONNECTION_NEGATIVE: '#f06070',
  CONNECTION_SELECTED: '#f0a860',
  TEMP_CONN: '#f0a860',

  // 小地图
  MINIMAP_BG: 'rgba(30, 30, 46, 0.85)',
  MINIMAP_VIEWPORT: 'rgba(240, 168, 96, 0.25)',

  // 通用
  GRID: 'rgba(255,255,255,0.04)',
  GRID_MAJOR: 'rgba(255,255,255,0.07)',
  SELECTION_BOX: 'rgba(91, 155, 250, 0.15)',
  SELECTION_BOX_STROKE: '#5b9cfa',

  // 阴影
  SHADOW: 'rgba(0,0,0,0.4)',
};

// ===== 尺寸常量 =====
const SIZES = {
  STOCK_WIDTH: 140,
  STOCK_HEIGHT: 80,
  SOURCE_SINK_WIDTH: 120,
  SOURCE_SINK_HEIGHT: 72,
  CONNECTION_HIT_RADIUS: 10,
  CORNER_RADIUS: 6,
  CLOUD_RADIUS: 8,
  HANDLE_SIZE: 8,
  GRID_SIZE: 24,
  GRID_MAJOR_INTERVAL: 6,
  ARROW_SIZE: 8,
  FONT_SIZE: 10,
  MIN_NODE_SIZE: 60,
  MAX_NODE_SIZE: 300,
};

// ===== 临时连线颜色 =====
const TEMP_CONN_COLOR = '#f0a860';

// ===== Toast 时长 =====
const TOAST_DURATION = 2000;

// ===== 键盘快捷键 =====
const KEY_BINDINGS = {
  SAVE: { key: 's', ctrl: true },
  NEW: { key: 'n', ctrl: true },
  UNDO: { key: 'z', ctrl: true },
  REDO: { key: 'y', ctrl: true },
  DELETE: { key: 'Delete', ctrl: false },
  BACKSPACE: { key: 'Backspace', ctrl: false },
  SELECT_ALL: { key: 'a', ctrl: true },
  ZOOM_IN: { key: '=', ctrl: true },
  ZOOM_OUT: { key: '-', ctrl: true },
  ZOOM_FIT: { key: '0', ctrl: true },
};

// ===== 导出支持 =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NODE_TYPES,
    FLOW_TYPES,
    FEEDBACK_TYPES,
    COLORS,
    SIZES,
    TEMP_CONN_COLOR,
    TOAST_DURATION,
    KEY_BINDINGS
  };
}