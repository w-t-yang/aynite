# AI SDK Provider Documentation

This document outlines the AI providers integrated into Aynite using the Vercel AI SDK and their respective API contracts.

---

## 1. Core SDK Packages & Integration

Aynite uses the following core packages to provide a unified interface for multiple AI models.

| Package | Purpose | Documentation |
| :--- | :--- | :--- |
| `ai` | Core SDK for streaming and tools | [Core AI SDK](https://sdk.vercel.ai/docs) |
| `@ai-sdk/openai` | OpenAI & Compatible (Ollama) | [OpenAI Provider](https://sdk.vercel.ai/providers/ai-sdk-providers/openai) |
| `@ai-sdk/anthropic` | Anthropic Models (Claude) | [Anthropic Provider](https://sdk.vercel.ai/providers/ai-sdk-providers/anthropic) |
| `@ai-sdk/google` | Google Gemini Models | [Google Provider](https://sdk.vercel.ai/providers/ai-sdk-providers/google-generative-ai) |
| `@ai-sdk/deepseek` | DeepSeek (Reasoning Models) | [DeepSeek Provider](https://sdk.vercel.ai/providers/ai-sdk-providers/deepseek) |

---

## 2. Initialization Contracts (Input)

### Standard Models
Basic initialization for standard chat models.

```typescript
// OpenAI / Compatible
const model = createOpenAI({ apiKey, baseURL }).chat('model-id');

// Anthropic
const model = createAnthropic({ apiKey })('model-id');

// Google (Gemini)
const model = createGoogleGenerativeAI({ apiKey })('model-id');

// DeepSeek
const model = createDeepSeek({ apiKey })('model-id');
```

### Thinking Mode (Reasoning)
Modern models (Gemini 2.0/3.0, DeepSeek, OpenAI o1) can output their "thought process" before the final answer.

#### Google Gemini Thinking
To enable thinking in Gemini models, use the `thinkingConfig`:
```typescript
const result = await streamText({
  model: google('gemini-2.0-flash-thinking'),
  prompt: '...',
  providerOptions: {
    google: {
      thinkingConfig: {
        thinkingLevel: 'high', // 'minimal' | 'low' | 'medium' | 'high'
      },
    },
  },
});
```

#### DeepSeek Thinking
DeepSeek models (like `deepseek-reasoner` or `v3-pro`) handle thinking automatically via the `@ai-sdk/deepseek` provider without extra flags.

---

## 3. SDK Response Contracts (Output)

### `streamText` Full Stream Parts
When using `result.fullStream`, the SDK emits standardized parts regardless of the provider.

| Part Type | Content | Description |
| :--- | :--- | :--- |
| `text-delta` | `text: string` | New snippet of the final answer. |
| `reasoning-delta` | `reasoning: string` | New snippet of the **Thought Process**. (Gemini, DeepSeek, OpenAI o-series) |
| `tool-call` | `toolCallId`, `args` | Request to execute a specific tool. |
| `tool-result` | `toolCallId`, `result` | The output from a tool execution. |
| `error` | `error: any` | Fatal error during generation. |

---

## 4. Extended Provider List

### Cloud & Enterprise Providers
- **Azure OpenAI** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/azure)
- **AWS Bedrock** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/amazon-bedrock)
- **Google Vertex AI** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/google-vertex-ai)
- **Mistral** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/mistral)

### High-Performance / Specialized Providers
- **Groq** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/groq)
- **Cerebras** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/cerebras)
- **Fireworks** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/fireworks)
- **Together.ai** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/together-ai)

### Aggregators & Search
- **OpenRouter** [Doc](https://sdk.vercel.ai/providers/community-providers/openrouter)
- **Perplexity** [Doc](https://sdk.vercel.ai/providers/ai-sdk-providers/perplexity)

### Local & Edge
- **Ollama** [Doc](https://sdk.vercel.ai/providers/community-providers/ollama)
- **Cloudflare Workers AI** [Doc](https://sdk.vercel.ai/providers/community-providers/cloudflare-workers-ai)
