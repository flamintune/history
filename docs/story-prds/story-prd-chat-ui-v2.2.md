### **Story PRD (v2.2 - 真正生产级架构): 将浏览器新标签页改造为 Chat UI**

#### 1. 用户故事 (User Story)

作为一名用户，我希望插件的首页（新标签页）能被改造成一个 Chat UI。在这个界面中，我可以通过聊天的方式与我的浏览历史进行交互、命令打开新网页，并与 AI 进行通用交流，从而获得一个统一、高效的 "All-in-One" 浏览与信息管理体验。

#### 2. 验收标准 (Acceptance Criteria)

1.  **UI 位置**: 打开一个新的浏览器标签页 (`chrome://newtab`) 时，会显示全新的 Chat UI 界面。
2.  **聊天输入**: 界面底部有一个固定的文本输入框和发送按钮。
3.  **消息展示**: 用户的消息和 AI 的回复会以对话气泡的形式，按时间顺序显示。
4.  **历史查询**: 当用户输入 `/history` 或 `/search [关键词]` 等指令时，AI 能查询历史记录并返回结果。
5.  **网页打开**: 当用户输入 `/open [URL]` 指令时，在新标签页中打开该网址。
6.  **通用对话**: 对非指令输入，返回通用 AI 回复。
7.  **【新增】帮助指令**: 用户输入 `/help` 时，应能看到所有可用指令的列表及其功能描述。

#### 3. 技术实施方案 (Technical Implementation Plan) - **已再次重构**

本次方案采纳了关于指令解耦、富文本展示、动态注册和测试策略的全部建议，旨在构建一个真正可扩展、可维护、高质量的生产级应用。

**第一步：重构核心类型 (Type Definition)**

*   **文件**: `lib/types.ts`
*   **核心改造**:
    *   `ChatMessage`: `content` 字段的类型将是 `string | React.ReactNode`，以支持渲染自定义 React 组件。
    *   `CommandResult`: 新增类型，作为指令执行的统一返回格式，`{ type: 'message' | 'error'; content: string | React.ReactNode }`。
    *   `Command`: `execute` 方法的签名变更为 `(args: string[]) => Promise<CommandResult>`，强制所有指令返回一个 `CommandResult` 对象，实现逻辑与视图状态的解耦。

**第二步：建立指令的动态注册机制 (Command Auto-Registration)**

*   **目的**: 实现指令的“即插即用”，消除手动注册的维护成本和冲突风险。
*   **新建目录**: `commands/`
*   **约定**: 该目录下的每个 `.ts` 文件都必须 `export default` 一个 `Command` 对象。
*   **实现**: 
    *   在 `lib/command-manager.ts` 中，利用 `wxt` (Vite) 提供的 `import.meta.glob` 功能，在初始化时自动扫描 `commands/` 目录下的所有 `*.ts` 文件，并动态导入，将其默认导出的指令对象注册到一个内部的 `Map` 中。
    *   **内置指令**: `/help` 指令将作为 `command-manager` 的一个内置方法实现，它会遍历 `Map` 并格式化所有指令的 `name` 和 `description`。

**第三步：重构指令处理器 (Command Manager)**

*   **文件**: `lib/command-manager.ts`
*   **核心改造**:
    1.  `executeCommand` 方法现在 `await` 指令的 `execute` 并接收一个 `CommandResult` 对象。
    2.  它不再直接操作 `zustand` store，而是将 `CommandResult` 返回给调用它的上层（`useChat` hook）。
    3.  如果解析不到指令，它会调用 `aiService` 并返回一个标准的消息结果。
    4.  `try...catch` 逻辑依然保留，用于捕获指令执行期间的异常，并将其包装成一个 `error` 类型的 `CommandResult` 返回。

**第四步：升级 Hooks 和 UI 组件**

*   **`hooks/useChat.ts`**: 
    *   现在是唯一与 `zustand` store 交互的地方。它负责调用 `commandManager.executeCommand`，获取 `CommandResult`，然后根据结果的 `type` 和 `content` 调用 `store.addMessage`。
*   **`components/chat/ChatMessage.tsx`**: 
    *   必须修改渲染逻辑，能够判断 `message.content` 是 `string` 还是 `React.ReactNode`，并正确地渲染它。

**第五步：实现富文本指令 (`/history`)**

*   **文件**: `commands/history.ts`
*   **实现**: 
    1.  `execute` 方法调用 `historyService` 获取历史数据。
    2.  它不会返回一个巨大的字符串，而是创建一个新的 React 组件，例如 `HistoryListComponent`。
    3.  这个组件负责将历史记录渲染成一个带链接的列表 (`<ul><li><a>...</a></li></ul>`)。
    4.  最终返回 `{ type: 'message', content: <HistoryListComponent items={...} /> }`。

**第六步：【新增】完整的测试策略 (Testing Strategy)**

*   **目的**: 确保代码质量，预防回归缺陷，提升重构信心。
*   **技术选型**: `vitest` + `@testing-library/react`。
*   **单元测试 (Unit Tests)**:
    *   **范围**: `services/*`, `lib/command-manager.ts`, 以及 `commands/` 目录下的每一个独立指令。
    *   **目标**: 验证纯逻辑的正确性。例如，`historyService` 能否正确调用 API，指令能否正确处理参数并返回预期的 `CommandResult`。
*   **组件测试 (Component Tests)**:
    *   **范围**: `components/chat/*` 下的所有UI组件。
    *   **目标**: 验证组件在不同 `props` 和 `store` 状态下的渲染是否正确。例如，`ChatMessage` 能否正确渲染字符串、React 节点和错误状态；`ChatInput` 在 `isLoading` 时是否被禁用。

#### 4. 将受影响的文件 (Affected Files) - **已更新**

*   **【修改】** `lib/types.ts`
*   **【修改】** `lib/command-manager.ts`
*   **【新建】** `commands/` (目录)
*   **【新建】** `commands/history.ts` (示例指令)
*   **【新建】** `commands/open.ts` (示例指令)
*   **【修改】** `hooks/useChat.ts`
*   **【修改】** `components/chat/ChatMessage.tsx`
*   **【保持】** `stores/chatStore.ts` (结构基本不变)
*   **【保持】** `services/*` (逻辑不变，仅被调用)
