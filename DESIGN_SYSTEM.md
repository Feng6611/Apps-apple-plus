# App Store Region Switcher 设计系统

> 版本 2.0 | 最后更新：2025-11-10

## 设计原则

### 核心价值
- **克制**：无阴影、小圆角、少装饰
- **清晰**：靠间距和边框分隔，不靠视觉噪音
- **简洁**：只保留必要元素
- **顺眼**：布局平衡，视觉呼吸感强

---

## 布局系统

### 容器结构
```
┌─────────────────────────────────────┐
│ Panel (16px padding)                │
│ ┌─────────────────────────────────┐ │
│ │ Header (标题 + 链接)             │ │
│ └─────────────────────────────────┘ │
│              ↓ 16px                 │
│ ┌─────────────────────────────────┐ │
│ │ 当前区域 + 语言                  │ │
│ └─────────────────────────────────┘ │
│              ↓ 16px                 │
│ ┌─────────────────────────────────┐ │
│ │ 搜索框                          │ │
│ │         ↓ 12px                  │ │
│ │ 区域列表 (可滚动)               │ │
│ │         ↓ 16px                  │ │
│ │ 底部设置 + 保存按钮             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 间距规则
```css
--space-xs: 4px;    /* 图标与文本 */
--space-sm: 8px;    /* 列表项内部元素 */
--space-md: 12px;   /* 输入框到列表 */
--space-lg: 16px;   /* 主要区块间距 */
--space-xl: 20px;   /* 容器内边距 */
```

**使用原则**：
- 同一卡片内元素：8-12px
- 不同功能区块：16px
- 容器内边距：16-20px

### 圆角规则
```css
--radius-sm: 4px;   /* 列表项 hover */
--radius-md: 6px;   /* 按钮、输入框 */
--radius-lg: 8px;   /* 卡片容器 */
```

**原则**：小圆角，克制使用，仅为缓和边缘

---

## 色彩系统

### 简化色板
```css
/* 主色 */
--primary: #007aff;         /* iOS 蓝 */
--primary-hover: #0051d5;   /* 悬停 */

/* 背景 */
--bg-page: #f5f5f7;         /* 页面底色 */
--bg-card: #ffffff;         /* 卡片/白色区域 */
--bg-hover: #f9f9f9;        /* 悬停背景 */

/* 边框 */
--border-light: #e5e5e5;    /* 主要边框 */
--border-medium: #d1d1d1;   /* 输入框边框 */
--border-focus: #007aff;    /* 焦点边框 */

/* 文本 */
--text-primary: #1d1d1f;    /* 主要文本 */
--text-secondary: #86868b;  /* 次要文本 */
--text-tertiary: #aeaeb2;   /* 占位符/禁用 */
```

**配色原则**：
- 只有一种蓝色
- 灰色只分 3 档：浅边框、中边框、深文本
- 背景只有页面色和卡片色

---

## 字体系统

### 字体族
```css
font-family: -apple-system, BlinkMacSystemFont, sans-serif;
```

### 字号 + 字重
| 元素        | 大小 | 字重 | 颜色           | 用途               |
| ----------- | ---- | ---- | -------------- | ------------------ |
| 页面标题    | 20px | 600  | text-primary   | AppStoreSwitcher   |
| 当前区域    | 15px | 500  | text-primary   | United States (US) |
| 列表项文本  | 14px | 400  | text-primary   | China (CN)         |
| 按钮文本    | 13px | 500  | primary/white  | 保存设置           |
| 链接文本    | 13px | 400  | primary        | apps.apple.com     |
| 分组标题    | 11px | 600  | text-secondary | PINNED             |
| 占位符/提示 | 13px | 400  | text-tertiary  | 搜索区域           |

**字重原则**：
- 600：只用于标题和分组
- 500：强调的交互元素（按钮、当前区域）
- 400：所有正文

---

## 视觉原则

### 无阴影设计
**不使用 box-shadow**，改用：
- **边框**：1px 实线边框分隔区域
- **背景色**：白色卡片 vs 浅灰页面
- **间距**：充足的留白创造层级

### 焦点样式
```css
/* 焦点使用边框，不用阴影 */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

---

## 组件规范

### 1. Header 区域
```css
/* 布局 */
display: flex;
justify-content: space-between;
align-items: center;
padding-bottom: 16px;

/* 标题 */
font-size: 20px;
font-weight: 600;
color: var(--text-primary);

/* 链接 */
font-size: 13px;
color: var(--primary);
text-decoration: none;
```

### 2. 当前区域卡片
```css
display: flex;
justify-content: space-between;
align-items: center;
padding: 12px 16px;
background: var(--bg-card);
border: 1px solid var(--border-light);
border-radius: 6px;
```

### 3. 搜索框
```css
width: 100%;
padding: 8px 12px;
border: 1px solid var(--border-medium);
border-radius: 6px;
background: var(--bg-card);
font-size: 14px;

/* 焦点态 */
border-color: var(--border-focus);
outline: 2px solid var(--primary);
outline-offset: -1px;
```

### 4. 区域列表
```css
/* 容器 */
max-height: 280px;
overflow-y: auto;
margin: 12px 0;

/* 列表项 */
padding: 10px 12px;
border-radius: 4px;
cursor: pointer;

/* 悬停态 */
background: var(--bg-hover);
```

### 5. 单选按钮
```css
/* 外圈 */
width: 18px;
height: 18px;
border-radius: 50%;
border: 1.5px solid var(--border-medium);

/* 选中 */
border-color: var(--primary);
border-width: 5px;  /* 实心填充效果 */
```

### 6. 主按钮
```css
padding: 8px 16px;
border: none;
border-radius: 6px;
background: var(--primary);
color: white;
font-size: 13px;
font-weight: 500;
cursor: pointer;

/* 悬停 */
background: var(--primary-hover);

/* 禁用 */
background: var(--bg-hover);
color: var(--text-tertiary);
opacity: 0.6;
```

### 7. 分组标题
```css
font-size: 11px;
font-weight: 600;
color: var(--text-secondary);
text-transform: uppercase;
letter-spacing: 0.5px;
margin: 16px 0 8px;
```

### 8. 分割线
```css
border: none;
border-top: 1px solid var(--border-light);
margin: 16px 0;
```

---

## 交互规范

### 动画
```css
/* 统一过渡 */
transition: all 0.2s ease;
```

**原则**：所有过渡 0.2s，不需要复杂动效

### 状态样式
| 状态     | 视觉变化         | 示例                       |
| -------- | ---------------- | -------------------------- |
| **默认** | -                | 初始样式                   |
| **悬停** | 背景色变化       | bg-card → bg-hover         |
| **焦点** | 2px 蓝色 outline | outline: 2px solid primary |
| **激活** | 背景加深         | primary → primary-hover    |
| **禁用** | 降低透明度       | opacity: 0.5               |

### 焦点样式
```css
/* 键盘导航时显示 */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* 鼠标点击不显示 */
:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 尺寸规范

### 容器
- **Popup 宽度**：380px (固定)
- **Sidepanel 宽度**：400px (固定)
- **内边距**：20px (四周统一)

### 高度
- **输入框**：36px (含边框)
- **列表项**：40px (含内边距)
- **按钮**：32px
- **最小高度**：Popup 480px

### 滚动区域
```css
/* 列表可滚动，其他固定 */
.regions-list {
  max-height: 280px;  /* Popup */
  max-height: calc(100vh - 280px);  /* Sidepanel */
  overflow-y: auto;
}
```

---

## 文案规范

### 标题
- **简洁**：不超过 3 个词
- **无句号**：标题不加标点

### 按钮文案
- **动词开头**：保存设置、切换区域
- **简短**：2-4 个字

### 提示文案
- **友好**：使用第二人称
- **具体**：说明原因和解决方案

### 错误消息
- **清晰**：说明错误原因
- **可操作**：提供下一步建议

---

## 无障碍规范

### 语义化 HTML
```html
<button type="button" aria-label="切换显示模式">
<input type="search" placeholder="搜索区域" />
<h1>AppStoreSwitcher</h1>
```

### 焦点可见性
- 所有交互元素必须有 `:focus-visible` 样式
- Tab 键导航顺序合理

### 颜色对比度
- **正文**：4.5:1 (WCAG AA)
- **大文本/图标**：3:1 (WCAG AA)

### 屏幕阅读器
- 图标按钮必须有 `aria-label`
- 状态变化通过 `aria-live` 通知

---

## 暗色模式（未来支持）

### 色彩映射
```css
@media (prefers-color-scheme: dark) {
  --primary: #0a84ff;
  --gray-950: #f5f5f7;
  --gray-900: #e5e5e7;
  --gray-800: #d1d1d6;
  --surface: #1c1c1e;
  --border: #38383a;
  --background: #000000;
}
```

---

## 设计决策记录

### 为什么选择蓝色作为主色？
- Apple 设计语言中的系统蓝色
- 表示链接和可点击元素的通用认知
- 与白色/灰色搭配对比度高

### 为什么使用 10px 圆角？
- 接近 iOS / macOS 系统组件风格
- 柔和但不过度圆润
- 与小元素（按钮 7px）形成层级

### 为什么列表项间距只有 1px？
- 悬停时通过背景色区分，无需大间距
- 提高信息密度，减少滚动
- 配合 6px 圆角营造紧凑感

### 为什么侧边栏背景更深？
- 与 Popup 形成视觉差异
- 在浏览器侧边栏环境中更舒适
- 减少大面积白色对眼睛的刺激

---

## 开发指南

### CSS 变量使用
优先使用 CSS 变量而非硬编码：
```css
/* ❌ 不推荐 */
color: #0066cc;

/* ✅ 推荐 */
color: var(--primary);
```

### 命名规范
```css
/* BEM 命名法 */
.panel__header { }           /* 区块 + 元素 */
.window-mode-toggle { }      /* 组件名 */
.window-mode-toggle__icon { } /* 组件 + 元素 */
.regions-list--disabled { }  /* 修饰符 */
```

### 代码组织
1. 布局属性 (display, position, flex)
2. 盒模型 (width, padding, margin)
3. 视觉样式 (background, border, shadow)
4. 字体属性 (font-size, color)
5. 其他 (transition, cursor)

---

## 设计资源

### 开发工具
- **浏览器**：Chrome DevTools 颜色对比度检查器
- **测试**：macOS VoiceOver / NVDA 屏幕阅读器
- **验证**：WAVE 无障碍检查工具

### 参考资料
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [WCAG 2.1 规范](https://www.w3.org/WAI/WCAG21/quickref/)
- [SF Symbols](https://developer.apple.com/sf-symbols/)

---

## 版本历史

| 版本 | 日期       | 变更                           |
| ---- | ---------- | ------------------------------ |
| 1.0  | 2025-11-10 | 初始版本，基于现有实现提取规范 |


