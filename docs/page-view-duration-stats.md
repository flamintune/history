# 页面浏览时长统计功能设计方案

## 1. 需求背景

为了更全面地了解用户的网页浏览行为，我们需要新增一个功能，用于统计用户在每个独立页面上的总浏览时长。这将帮助用户分析他们在特定文章、产品或内容上花费的时间，从而提供更精细的数据洞察。

## 2. 核心思路

我们将采用“心跳埋点”的方式来统计页面浏览时长。具体思路如下：

- **页面激活状态跟踪**：当用户切换到某个浏览器标签页时，我们认为该页面处于“激活”状态。
- **定时心跳**：对于激活的页面，内容脚本（Content Script）会每隔一个固定的时间间隔（例如 5 秒）向后台脚本（Background Script）发送一个“心跳”事件。
- **会话管理**：
  - 当页面首次激活时，开始一个新的“浏览会话”。
  - 当用户切换到其他标签页、关闭标签页或浏览器窗口时，页面变为“非激活”状态，当前会话结束。
  - 每次心跳都会更新当前会话的持续时间。
- **数据聚合**：后台脚本负责接收心跳事件，并将同个页面的所有会话时长进行累加，从而得到总的浏览时长。

## 3. 技术方案

### 3.1. 数据结构定义 (`lib/types.ts`)

我们需要定义两个新的接口来描述页面浏览数据：

```typescript
// 用于记录单次页面浏览会话
export interface PageViewSession {
  startTime: number; // 会话开始时间戳
  endTime: number;   // 会话结束时间戳
  heartbeats: number; // 心跳次数
}

// 用于聚合单个页面的所有浏览数据
export interface PageView {
  url: string; // 页面 URL
  sessions: PageViewSession[]; // 浏览会话列表
  totalDuration: number; // 总浏览时长（秒）
}
```

### 3.2. 数据存储 (`lib/storage-manager.ts`)

- 新增一个存储键 `page-views`。
- 实现以下函数：
  - `getAllPageViews(): Promise<PageView[]>`: 获取所有页面的浏览数据。
  - `savePageViewSession(url: string, session: PageViewSession): Promise<void>`: 保存或更新一个页面的浏览会话。该函数会查找具有相同 `url` 的 `PageView` 对象，如果不存在则创建，然后将新的 `session` 添加到 `sessions` 数组，并更新 `totalDuration`。
  - `clearAllPageViews(): Promise<void>`: 清除所有页面浏览数据。

### 3.3. 前端埋点 (`entrypoints/content.ts`)

- **职责**：监控页面可见性，并在页面可见时发送心跳。
- **实现逻辑**：
  1. 使用 `document.addEventListener('visibilitychange', ...)` 来监听页面的可见性变化。
  2. 当 `document.visibilityState` 变为 `visible` 时：
     - 记录会话开始时间 `startTime`。
     - 使用 `setInterval` 启动一个心跳计时器，每 5 秒向后台发送一次 `PAGE_HEARTBEAT` 消息，并携带 `url`。
  3. 当 `document.visibilityState` 变为 `hidden` 时：
     - 清除心跳计时器。
     - 记录会话结束时间 `endTime`。
     - 计算心跳次数。
     - 向后台发送 `PAGE_VIEW_SESSION` 消息，包含 `url` 和整个 `PageViewSession` 对象。
  4. 使用 `window.addEventListener('beforeunload', ...)` 作为补充，确保在页面关闭前也能发送最后的会话数据。

### 3.4. 后台处理 (`entrypoints/background.ts`)

- **职责**：监听并处理来自内容脚本的消息。
- **实现逻辑**：
  - 在 `main` 函数中，使用 `browser.runtime.onMessage.addListener(...)` 注册一个消息监听器。
  - 当收到 `PAGE_VIEW_SESSION` 类型的消息时，调用 `storage-manager.ts` 中的 `savePageViewSession` 函数，将接收到的会话数据持久化到存储中。

### 3.5. UI 展示 (`entrypoints/popup/App.tsx`)

- **职责**：在插件的弹出窗口中展示统计数据。
- **实现逻辑**：
  1. 在 `App.tsx` 中添加一个新的标签页（Tab），命名为“浏览时长”。
  2. 创建一个新的 React 组件 `PageViewList.tsx`，用于展示页面浏览时长列表。
  3. 创建一个新的 React Hook `usePageViewStats.ts`，该 Hook 负责从存储中加载 `PageView` 数据，并按总时长降序排序。
  4. `PageViewList.tsx` 组件使用 `usePageViewStats` Hook 获取数据，并以列表形式渲染每个页面的 URL 和格式化后的总浏览时长（例如 `xx 分 xx 秒`）。

## 4. 方案评估

### 优点

- **准确性高**：只在页面对用户可见时才进行计时，避免了对后台标签页的无效统计。
- **性能影响小**：心跳间隔（5秒）相对较长，内容脚本逻辑简单，对页面性能影响可忽略不计。
- **数据完整性**：通过监听 `visibilitychange` 和 `beforeunload` 事件，能覆盖大部分用户场景，确保数据尽可能完整。

### 缺点

- **存储开销**：如果用户浏览大量不同页面，存储的 `PageView` 对象可能会增多。但由于只存储聚合数据而非原始心跳，总体开销可控。
- **无法覆盖所有情况**：如果浏览器崩溃，最后一次的浏览会话数据可能会丢失。

## 5. 实现步骤

1.  **[完成]** 在 `docs` 目录创建本设计文档。
2.  在 `lib/types.ts` 中添加 `PageViewSession` 和 `PageView` 接口。
3.  在 `lib/storage-manager.ts` 中实现页面浏览数据的增、查、删功能。
4.  创建并实现 `entrypoints/content.ts`，完成心跳逻辑。
5.  在 `wxt.config.ts` 中注册新的内容脚本。
6.  在 `entrypoints/background.ts` 中添加消息监听器以处理会话数据。
7.  创建 `hooks/usePageViewStats.ts` Hook。
8.  创建 `components/PageViewList.tsx` UI 组件。
9.  修改 `entrypoints/popup/App.tsx`，集成新的标签页和组件。

## 6. 测试计划

- **单元测试**：
  - 测试 `storage-manager.ts` 中数据存取逻辑的正确性。
- **功能测试**：
  - 打开一个页面，保持激活状态，检查后台是否能正确累加时长。
  - 在多个标签页之间切换，验证计时器是否只在当前激活的页面上工作。
  - 关闭一个标签页，重新打开插件，检查该页面的浏览时长是否被正确记录。
  - 测试 `Clear All Data` 功能是否能清除页面浏览数据。
- **UI 测试**：
  - 验证弹出窗口中的“浏览时长”列表是否能正确显示数据，并按时长排序。
  - 验证时长格式化是否正确。