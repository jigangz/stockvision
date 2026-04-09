# StockVision v0.3.0 Bugfix Plan

> 用户反馈 bugs，按大项目 workflow 逐条记录，确认需求后执行。
> 创建时间: 2026-04-09

## 状态: 收集需求中（用户逐条确认）

---

## BUG-1: 后端服务未响应 / 连续失败99次
**截图表现**: 右侧面板 "暂无行情数据"，底部状态栏红点 "MockAdapter"
**根因**: 
- 开发模式下 Python FastAPI 后端需要手动启动 (`cd python && python main.py`)
- 生产模式下 Tauri sidecar 自动启动，但需要先 build sidecar binary
- `useHealthMonitor.ts` 轮询 `localhost:8899/api/health/status`，连接不上就累计 failures
**修复方向**: 自己看着修（用户说的）
**用户确认**: ✅ 已确认

---

## BUG-2: 股票显示问题（多个子问题）
**截图分析**:
- **左上角** `000001 平安银行`: Agent 已修为动态绑定 chartStore + quotesStore ✅ 但需验证是否生效
- **右上角** `000001 --`: StockInfoPanel header 没显示股票名称（quote 未加载时显示 "--"）
- **右上角** `000001 · SH`: SH/SZ 是反的！000001 是深圳平安银行，应该是 SZ
- **底部右下角** `StockVision v0.3.0`: 版本号是静态的，这个不需要变（正常）

### 子问题详细:

#### BUG-2a: 右上角没显示股票名称
**位置**: `src/components/chart/StockInfoPanel.tsx` line 52
**根因**: `{q ? q.name : '--'}` — 当 quotes 还没从 API 加载时 q 为 undefined
**修复**: Agent 已加了 useEffect 在 currentCode 变化时重新 fetch

#### BUG-2b: SH/SZ 反了
**位置**: 
1. `src/stores/chartStore.ts` line 26: `currentMarket: 'SH'` — 默认值写错了，000001 应该是 SZ
2. `src/hooks/useKeyboardShortcuts.ts` line 13: `{ code: '000001', market: 'SH' }` — 也写错了
**修复**: 
- chartStore 默认值改为 `'SZ'`
- STOCK_LIST 里所有 000xxx/002xxx/300xxx 改为 SZ，6xxxxx 改为 SH
- `setCode()` 应该自动根据股票代码推断 market（和 WatchlistSidebar 一样的逻辑）

#### BUG-2c: 右上角 `000001 · SH` 面板位置
**位置**: `src/components/layout/InfoPanel.tsx` line 43
**显示**: `{currentCode} · {currentMarket}` — 读的 chartStore 是对的，只是 market 值本身错了
**修复**: 修好 BUG-2b 就自动修好

#### BUG-2d: 左上角股票名不随切换变化
**位置**: `src/components/layout/TopNav.tsx`
**根因**: 之前是 hardcoded `000001 平安银行`，Agent 已修为动态读 store
**修复**: Agent 已完成，需验证

**用户确认**: ✅ 已确认，等用户继续说剩余 bugs

---

## BUG-3: 坐标设置 — 最高最低位置 + 手动范围不准确
**截图分析**:
- 自动模式下 Y 轴正常
- 手动模式设 最低价=1, 最高价=120 → Y 轴实际显示 -10 到 150，不是精确的 1~120
- 坐标设置 dialog 里：最低价在上面、最高价在下面 → 用户要求反过来（最高在上、最低在下）

### 子问题:

#### BUG-3a: 手动坐标范围不准确
**位置**: PriceScaleDialog 组件 + 设置 price scale range 的逻辑
**根因**: Lightweight Charts 的 `priceScale().applyOptions({ autoScale: false })` + 手动 `setVisiblePriceRange()` 可能有 padding/margin，导致实际显示范围比设定值大
**修复**: 调查 LW Charts 的 `setVisiblePriceRange({minValue, maxValue})` 是否精确，如果有 margin 需要补偿

#### BUG-3b: 坐标设置 dialog 布局
**位置**: PriceScaleDialog 组件
**根因**: dialog 里 最低价 input 在上面，最高价 input 在下面
**修复**: 交换位置 — 最高价放上面，最低价放下面（更直觉）

**用户确认**: ✅ 已确认

---

## BUG-4: 画线右键功能（通达信风格）
**截图参考**: 通达信右键画线菜单有三项：
1. **编辑画线** — 选中画线后可以拖动端点修改位置
2. **删除画线** — 删除选中的画线
3. **锁定画线** — 锁定画线使其不可编辑/移动

**当前状态**: Agent 已创建了 `DrawingContextMenu.tsx`，但菜单项是：撤销上一步、删除选中、清除所有、取消
**需要改为**: 匹配通达信：
- 右键需要先选中一条画线（点击画线附近区域判定命中）
- 菜单项：编辑画线 / 删除画线 / 锁定画线
- 编辑 = 进入拖动模式（端点可拖）
- 锁定 = toggle 锁定状态，锁定后不能移动/编辑
- 如果没有选中画线，右键可以显示：撤销上一步 / 清除所有画线

**用户确认**: ✅ 已确认

---

## BUG-5: 上下键功能（通达信 zoom in/out）
**截图分析**:
- 图1：正常视图，K线+右侧信息面板+两个指标 section
- 图2：按↑之后，右侧信息面板收起/缩窄，K线区域变大，指标 section 缩小，看到更多 K线 细节
- 图3：继续按↑，全屏 K线模式，右侧面板完全隐藏，指标 section 也隐藏，只有 K线+MA 占满屏幕

**通达信的↑↓行为**:
- **↑ (上键)**: zoom in — 逐步放大 K线 区域
  - 第一次↑: 隐藏右侧信息面板，K线区域横向变宽
  - 第二次↑: 隐藏底部指标 section，K线 占满纵向空间
  - 效果：K线 全屏模式
- **↓ (下键)**: zoom out — 逐步恢复
  - 逆序恢复：先显示指标 section，再显示右侧面板
  
**当前状态**: 上下键被映射为切换股票（STOCK_LIST 上下遍历），需要改为 zoom in/out

**修复**:
- 移除上下键的股票切换功能（或改到其他快捷键）
- ↑: 逐步隐藏面板 (level 0→1→2)
  - level 0: 正常布局
  - level 1: 隐藏右侧 InfoPanel/StockInfoPanel
  - level 2: 再隐藏指标 sections，K线全屏
- ↓: 逐步恢复 (level 2→1→0)
- chartStore 加 `zoomLevel: 0|1|2` 状态

**用户确认**: ✅ 已确认

---

## BUG-6: 指标系统大改（多 section + 参数调整）

### 截图分析（通达信参考）：
- 通达信有 **两个独立的指标 section**（中间 + 底部），每个 section 可以独立选择不同指标
- 图1：中间 section 显示 WR(10,6)，底部 section 显示 RSI(6,12,24)
- 图2：中间 CCI(14)，底部 EMV(14,9) — 两个 section 各自独立
- 图3：右键点指标区域弹出参数调整 dialog — `[KDJ]指标参数调整 (日线)`，可改天数参数

### 当前状态：
- 现在只有 **1个指标 section**（底部）+ 1个 tab bar
- Agent 已做了参数调整 dialog（双击/右键 tab），但逻辑需要改

### 需要实现：

#### BUG-6a: 两个独立指标 section
- **中间 section**（成交量区域下方 or 替代成交量）：独立选择指标，独立 tab bar
- **底部 section**：独立选择指标，独立 tab bar
- 点击某个 section 激活它，再点 tab bar 切换该 section 的指标
- 两个 section 可以显示不同指标（如中间 WR、底部 RSI）

#### BUG-6b: 右键指标区域弹参数调整
- 右键点击指标图表区域 → 弹出参数调整 dialog
- dialog 标题：`[KDJ]指标参数调整 (日线)`
- 显示所有可调参数（如 KDJ 的三个天数: 9, 3, 3）
- 按钮：应用所有周期 / 恢复成缺省 / 关闭
- 几乎所有指标都要支持参数自定义

#### BUG-6c: 指标区域顶部显示当前参数值
- 通达信在指标图顶部显示：`WR(10,6) WR1: 20.17 WR2: 23.31`
- 包含：指标名(参数) + 各条线当前值
- 颜色对应各条线的颜色

**用户确认**: ✅ 已确认

---

## BUG-7: 右下角版本号 hardcoded
**截图表现**: 显示 `StockVision v0.1.0`，实际已经是 v0.3.0
**位置**: `src/components/layout/StatusBar.tsx` line 30
**根因**: 版本号写死为 `v0.1.0`，从来没更新过
**修复**: 从 `package.json` 动态读取版本号，或用 Vite 的 `import.meta.env` 注入
**用户确认**: ✅ 已确认

---

## 额外 bug（截图发现）

### BUG-X1: 底部时间轴显示 NaN
- **底部时间轴**: 显示 `NaN/NaN/NaN/星期undefined` — 日期解析有问题
- 需要调查 InfoTooltip 或 crosshair 相关的时间格式化逻辑

### BUG-X2: StatusBar 连接状态 hardcoded
- 红点 + "MockAdapter" 是写死的 (`connected: false`, text: `MockAdapter`)
- 应该读 healthMonitor 的实际状态
