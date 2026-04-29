# AI SDK Provider Documentation

This document outlines the AI providers integrated into Aynite using the Vercel AI SDK and their respective API contracts (initialization patterns).

## Core SDK Packages
- `ai`: Core SDK for streaming and tool execution.
- `@ai-sdk/openai`: Provider for OpenAI and OpenAI-compatible APIs (Ollama, local proxies).
- `@ai-sdk/anthropic`: Provider for Claude models.
- `@ai-sdk/google`: Provider for Gemini models.
- `@ai-sdk/deepseek`: Dedicated provider for DeepSeek models (supports reasoning/thinking mode).

---

## Provider API Contracts

### 1. OpenAI (Standard & Compatible)
Used for official OpenAI models and generic proxies (Ollama, LiteLLM, etc.).

**Package:** `@ai-sdk/openai`
**Contract:**
```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: string,        // Required for official, optional for some local proxies
  baseURL: string,       // Optional (defaults to api.openai.com/v1)
  headers: Record<string, string>, // Optional custom headers
});

// Model usage (Chat Completions)
const model = openai.chat('model-id');
```

### 2. Anthropic
Used for Claude 3, 3.5, and 4 models.

**Package:** `@ai-sdk/anthropic`
**Contract:**
```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  apiKey: string,        // Required
  baseURL: string,       // Optional (defaults to api.anthropic.com)
  headers: Record<string, string>, // Optional
});

// Model usage
const model = anthropic('model-id');
```

### 3. Google (Gemini)
Used for Gemini 1.5 Flash, Pro, and newer models.

**Package:** `@ai-sdk/google`
**Contract:**
```typescript
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: string,        // Required
  baseURL: string,       // Optional
});

// Model usage
const model = google('model-id');
```

### 4. DeepSeek
Dedicated provider optimized for DeepSeek's specific protocol (Thinking mode/Reasoning).

**Package:** `@ai-sdk/deepseek`
**Contract:**
```typescript
import { createDeepSeek } from '@ai-sdk/deepseek';

const deepseek = createDeepSeek({
  apiKey: string,        // Required
  baseURL: string,       // Optional (defaults to api.deepseek.com)
});

// Model usage
const model = deepseek('model-id');
```

---

## Configuration Options (`ai.json`)

The IDE reads from `~/.aynite/config/ai.json`. Each provider configuration supports the following fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `apiKey` | `string` | API key for authentication. |
| `url` | `string` | Base URL for the API (e.g., `http://localhost:11434` for Ollama). |
| `model` | `string` | The model identifier (e.g., `gpt-4o`, `deepseek-chat`). |
| `compatibility` | `string` | For generic providers, defines the protocol (`openai`, `anthropic`, `google`). |
| `contextWindow` | `number` | (Optional) Max tokens for context. |

## Tool Schema Pattern

To ensure compatibility across all providers (especially DeepSeek and Ollama), tools should be defined using the **`inputSchema`** pattern:

```typescript
{
  description: 'Description of the tool',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      argName: { type: 'string', description: 'Arg description' }
    },
    required: ['argName']
  }),
  execute: async (args) => { ... }
}
```
