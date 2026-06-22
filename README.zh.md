# llm-advisor-mcp

[![npm version](https://img.shields.io/npm/v/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![npm downloads](https://img.shields.io/npm/dm/llm-advisor-mcp)](https://www.npmjs.com/package/llm-advisor-mcp)
[![CI](https://github.com/Daichi-Kudo/llm-advisor-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Daichi-Kudo/llm-advisor-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 20.19](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[![Glama MCP server](https://glama.ai/mcp/servers/Daichi-Kudo/llm-advisor-mcp/badge)](https://glama.ai/mcp/servers/Daichi-Kudo/llm-advisor-mcp)

[English](README.md) | [日本語](README.ja.md) | **中文**

**为你的AI助手提供实时的LLM/VLM知识。** 价格、基准测试和推荐——每小时刷新（数据新鲜度取决于上游源），无需等待训练周期。

LLM存在知识截止。问Claude"现在最好的编程模型是什么？"它无法用最新数据回答。这个MCP服务器通过将实时模型智能直接输入AI助手的上下文窗口来解决这个问题。

- **零配置** — 无需API密钥，无需注册。一条命令即可安装。
- **低Token消耗** — 紧凑的Markdown表格（约300 tokens），而非原始JSON（约3,000 tokens）。你的上下文窗口很宝贵。
- **7+个实时数据源** — OpenRouter定价/元数据，加上SWE-bench、LM Arena Elo、OpenCompass VLM、Aider Polyglot、BFCL V4智能体基准测试和静态速度/延迟数据，融合为统一视图。

---

## 使用场景

- **"现在最好的编程模型是什么？"** — `list_top_models` 使用 `coding` 类别
- **"比较Claude、GPT和Gemini"** — `compare_models` 并排比较
- **"找便宜的1M上下文模型"** — `recommend_model` 预算约束推荐
- **"模型X的基准测试是什么？"** — `get_model_info` 含百分位数排名
- **"找$2/1M以下的视觉模型"** — `search_models` 自然语言搜索
- **"Anthropic有什么模型？"** — `list_providers` 按提供商浏览
- **"10万次调用要花多少钱？"** — `estimate_cost` 月度预算规划

---

## 快速开始

### Claude Code

```bash
claude mcp add llm-advisor -- npx -y llm-advisor-mcp
```

### Claude Code (Windows)

```bash
claude mcp add llm-advisor -- cmd /c npx -y llm-advisor-mcp
```

### Claude Desktop / Cursor / Windsurf

添加到你的MCP配置文件：

```json
{
  "mcpServers": {
    "llm-advisor": {
      "command": "npx",
      "args": ["-y", "llm-advisor-mcp"]
    }
  }
}
```

完成。无需API密钥，无需 `.env` 文件。

### 兼容的客户端

| 客户端 | 支持 | 安装方式 |
|--------|------|----------|
| Claude Code | Yes | `claude mcp add` |
| Claude Desktop | Yes | JSON配置 |
| Cursor | Yes | JSON配置 |
| Windsurf | Yes | JSON配置 |
| 任何MCP客户端 | Yes | stdio传输 |

---

## 工具

### `get_model_info`

获取特定模型的详细规格：定价、基准测试、百分位数排名、能力、即用API代码示例和成本估算。

**参数**

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `model` | string | 是 | — | 模型ID或部分名称（如 `"claude-sonnet-4"`, `"gpt-5"`） |
| `include_api_example` | boolean | 否 | `true` | 包含即用的代码片段 |
| `api_format` | enum | 否 | `openai_sdk` | `openai_sdk`, `curl` 或 `python_requests` |
| `include_cost_estimate` | boolean | 否 | `true` | 包含常见使用模式的成本估算 |

### `list_top_models`

按类别列出排名靠前的模型。包含发布日期以了解新鲜度。支持与 `recommend_model` 相同的价格/能力过滤器。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `category` | enum | 是 | — | `coding`, `math`, `vision`, `general`, `cost-effective`, `open-source`, `speed`, `context-window`, `reasoning`, `quality` |
| `limit` | number | 否 | `10` | 结果数量（1-20） |
| `min_context` | number | 否 | — | 最小上下文窗口（tokens） |
| `min_release_date` | string | 否 | — | `YYYY-MM-DD`，排除此日期之前发布的模型 |
| `max_input_price` | number | 否 | — | 最高输入价格（USD/1M tokens） |
| `max_output_price` | number | 否 | — | 最高输出价格（USD/1M tokens） |
| `require_vision` | boolean | 否 | — | 需要图像输入支持 |
| `require_tools` | boolean | 否 | — | 需要工具/函数调用支持 |
| `require_open_source` | boolean | 否 | — | 需要开源许可证 |

### `compare_models`

2-5个模型并排比较。最佳值自动**加粗**显示。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `models` | string[] | 是 | — | 2-5个模型ID或部分名称 |

### `recommend_model`

个性化的前3名推荐。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `use_case` | enum | 是 | — | `coding`, `math`, `general`, `vision`, `creative`, `reasoning`, `cost-effective` |
| `max_input_price` | number | 否 | — | 最高输入价格（USD/1M tokens） |
| `max_output_price` | number | 否 | — | 最高输出价格（USD/1M tokens） |
| `min_context` | number | 否 | — | 最小上下文窗口（tokens） |
| `require_vision` | boolean | 否 | — | 需要图像输入支持 |
| `require_tools` | boolean | 否 | — | 需要工具/函数调用支持 |
| `require_open_source` | boolean | 否 | — | 需要开源许可证 |
| `min_release_date` | string | 否 | — | `YYYY-MM-DD`，排除旧模型 |

### `search_models`

按名称、提供商或自然语言描述搜索模型。结果按文本相关性排名，可选类别打破平局和价格/能力过滤器。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `query` | string | 是 | — | 搜索查询（如 `"cheap vision model"`, `"claude"`） |
| `category` | enum | 否 | — | 可选类别，用于排名结果 |
| `limit` | number | 否 | `10` | 结果数量（1-20） |
| 过滤器 | various | 否 | — | `max_input_price`, `max_output_price`, `min_context`, `require_vision`, `require_tools`, `require_open_source` |

### `list_providers`

浏览所有LLM/VLM提供商，显示模型数量、价格范围和最便宜的模型。可按提供商名称筛选。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `provider` | string | 否 | — | 按提供商名称筛选（如 `"anthropic"`, `"openai"`） |

### `list_model_slugs`

查找提供商特定的模型标识符。给定模型名称，返回OpenRouter ID以及Bedrock、Groq、Together、Fireworks、DeepInfra等推理提供商的slug。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `model` | string | 否 | — | 按模型名称筛选（如 `"claude"`, `"gpt"`） |
| `provider` | string | 否 | — | 按目标提供商筛选（如 `"bedrock"`, `"groq"`） |

### `estimate_cost`

计算任何模型的估算API成本。指定输入/输出tokens数量和可选的月度调用量。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `model` | string | 是 | — | 模型ID或部分名称 |
| `input_tokens` | number | 否 | `10000` | 每次调用的平均输入tokens |
| `output_tokens` | number | 否 | `2000` | 每次调用的平均输出tokens |
| `monthly_calls` | number | 否 | — | 月度API调用估算（如 `30000` 约1000/天） |

### `list_new_models`

显示最近发布的模型。按发布日期筛选。

| 名称 | 类型 | 必需 | 默认 | 描述 |
|------|------|------|------|------|
| `max_age_days` | number | 否 | `90` | 最大天数 |
| `limit` | number | 否 | `10` | 结果数量 |
| 过滤器 | various | 否 | — | `min_context`, `max_input_price`, `max_output_price` |

---

## 数据源

所有数据实时从免费的公共API获取。无需认证。

| 来源 | 数据 | 模型数 | 缓存TTL |
|------|------|--------|---------|
| [OpenRouter](https://openrouter.ai/api/v1/models) | 定价、上下文长度、模态、发布日期 | 300+ | 1小时 |
| [SWE-bench](https://github.com/SWE-bench/swe-bench.github.io) | 编程基准测试（Verified排行榜） | 30+ | 6小时 |
| [LM Arena](https://lmarena.ai) | 人类偏好Elo评分 | 314+ | 6小时 |
| [OpenCompass VLM](https://opencompass.org.cn) | 视觉基准测试：MMMU, MMBench, OCRBench, AI2D, MathVista | 284+ | 6小时 |
| [Aider Polyglot](https://aider.chat/docs/leaderboards/) | 多语言编程通过率 | 63+ | 6小时 |
| [BFCL V4](https://gorilla.cs.berkeley.edu/leaderboard.html) | 智能体函数调用基准测试（总体准确率） | 109+ | 6小时 |
| [静态速度数据](https://whatllm.org) | 输出tokens/秒和首Token延迟（内置包中） | 26+ | 24小时 |

---

## 新模型检测

当新模型发布时，它会以不同的速度出现在不同的数据源中：

| 数据 | 来源 | 自动检测？ | 延迟 |
|------|------|-----------|------|
| 定价、上下文、模态、发布日期 | OpenRouter（实时） | ✅ 是 — 从列出所有当前模型的OpenRouter API获取 | ≤1小时 |
| 能力（工具、视觉、推理） | OpenRouter（实时） | ✅ 是 — 从 `supported_parameters` 确定 | ≤1小时 |
| SWE-bench分数 | SWE-bench（实时） | ✅ 是 — 如果基准测试添加了该模型 | ≤6小时 |
| Arena Elo | LM Arena（实时） | ✅ 是 — 如果Arena添加了该模型 | ≤6小时 |
| VLM基准测试 | OpenCompass（实时） | ✅ 是 — 如果OpenCompass添加了该模型 | ≤6小时 |
| Aider Polyglot通过率 | Aider（实时） | ✅ 是 — 如果Aider添加了该模型 | ≤6小时 |
| BFCL V4智能体分数 | BFCL（实时） | ✅ 是 — 如果BFCL添加了该模型 | ≤6小时 |
| 输出速度（tok/s） | 静态数据 + 启发式估计 | ✅ 是 — 40+个模型实测，**其他所有模型**基于定价和系列名估计 | ≤1小时 |
| 首Token延迟 | 静态数据 + 启发式估计 | ✅ 是 — 同上，适用于每个模型 | ≤1小时 |
| 提供商slug | 启发式生成 | ✅ 是 — 从模型ID使用命名约定自动生成 | ≤1小时 |
| 跨提供商定价比较 | 已知数据 + 启发式估计 | ✅ 是 — 10+个模型已知，**其他所有模型**使用提供商标记模式自动估计 | ≤1小时 |

**总结：** 所有数据点现在都可以为新模型自动检测。定价、能力、基准测试分数、速度估计、提供商slug和跨提供商定价都会自动出现。

---

## HTTP 传输（远程服务器）

默认情况下，服务器通过 stdio（标准输入/输出）运行，这是适用于 Claude Code、Cursor 和 Claude Desktop 等本地工具的标准 MCP 传输方式。
要作为远程 HTTP 服务器运行，设置 `MCP_HTTP_PORT` 或 `PORT` 环境变量：

```bash
# 在端口 3456 上启动 HTTP 服务器
MCP_HTTP_PORT=3456 npx -y llm-advisor-mcp

# 或使用 PORT（适用于云平台）
PORT=8080 npx -y llm-advisor-mcp
```

HTTP 模式下，服务器暴露以下端点：

| 端点 | 描述 |
|------|------|
| `POST /mcp` | MCP JSON-RPC 端点，用于工具调用 |
| `GET /mcp` | SSE 流式端点（用于 Streamable HTTP） |
| `GET /health` | 健康检查：`{"status":"ok","tools":10}` |

**兼容客户端：** 任何支持 Streamable HTTP 传输的 MCP 客户端。

---

## 上下文成本

| 组件 | Tokens |
|------|--------|
| 所有10个工具定义 | ~2,500 |
| 典型工具响应 | ~250-400 |

---

## 架构

```
┌──────────────────────────────────────────────┐
│              MCP Client (Claude, etc.)        │
└──────────┬───────────────────────────────────┘
           │ stdio (JSON-RPC)
┌──────────▼───────────────────────────────────┐
│            llm-advisor-mcp server             │
│                                               │
│  ┌─────────┐  ┌───────────┐  ┌────────────┐  │
│  │  Tools   │  │ Registry  │  │   Cache    │  │
│  │ (9 tools)│──│ (unified) │──│ (in-memory)│  │
│  └─────────┘  └───────────┘  └────────────┘  │
│                     │                         │
│        ┌────────────┼────────────┐            │
│        ▼            ▼            ▼            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Normalizer│ │Percentile│ │ Fetchers │      │
│  │(slug map)│ │ (7 cats) │ │(7 sources│      │
│  └──────────┘ └──────────┘ └──────────┘      │
└──────────────────────────────────────────────┘
           │           │           │
     OpenRouter    SWE-bench    Arena / VLM / Aider
                                BFCL / Speed
```

- **TypeScript + ESM** — 单一入口点，`tsup` 构建
- **内存缓存** — 基于TTL（价格1小时，基准测试6小时），stale-while-revalidate策略
- **跨源标准化** — 将不一致的模型名称映射到规范ID
- **百分位数计算** — 7个类别排名（coding, math, general, vision, cost efficiency, speed, agentic）
- **新鲜度评分** — 推荐算法对最近发布的模型给予加分
- **运行时依赖极少** — 仅 `@modelcontextprotocol/sdk` 和 `zod`

---

## 路线图

| 版本 | 状态 | 亮点 |
|------|------|------|
| v0.1 | 完成 | `get_model_info` + `list_top_models`（OpenRouter） |
| v0.2 | 完成 | `compare_models` + `recommend_model` + SWE-bench + Arena Elo |
| v0.3 | 完成 | VLM基准测试 + Aider Polyglot + 百分位数排名 + 43个测试 |
| v0.4 | 完成 | 发布日期筛选、新鲜度评分、复合基准测试分数 + 126个测试 |
| v0.5 | **当前** | `search_models`, `list_providers`, `estimate_cost`, `list_new_models`, `list_model_slugs`, BFCL V4, 速度数据, 质量指数 + **9个工具, 7个数据源** |
| v1.0 | 计划 | 社区贡献, 每周数据快照 |

---

## 开发

```bash
git clone https://github.com/Daichi-Kudo/llm-advisor-mcp.git
cd llm-advisor-mcp
npm install
npm run build       # 类型检查 + tsup构建
npm run dev         # 使用tsx运行（热重载）
npm test            # 运行126个单元测试
```

### 项目结构

```
src/
  index.ts              # 服务器入口点
  types.ts              # 共享类型定义
  tools/                # 9个工具
    model-info.ts       # get_model_info
    list-top.ts         # list_top_models
    compare.ts          # compare_models
    recommend.ts        # recommend_model
    search.ts           # search_models
    providers.ts        # list_providers
    estimate.ts         # estimate_cost
    new-models.ts       # list_new_models
    slugs.ts            # list_model_slugs
    formatters.ts       # Markdown输出格式化器
  data/
    registry.ts         # 统一模型注册表
    cache.ts            # 内存TTL缓存
    normalizer.ts       # 跨源名称标准化
    percentiles.ts      # 百分位数计算（7个类别）
    fetchers/           # 7个数据获取器
      openrouter.ts     # OpenRouter API
      swe-bench.ts      # SWE-bench排行榜
      arena.ts          # LM Arena Elo评分
      vlm-leaderboard.ts # OpenCompass VLM基准测试
      aider.ts          # Aider Polyglot评分
      bfcl.ts           # BFCL V4（智能体基准测试）
      speed.ts          # 静态速度/延迟数据
    static/
      api-examples.ts   # API代码片段模板
```

---

## 许可证

[MIT](LICENSE) — 由 [Cognisant LLC](https://cognisant.io) 开发
