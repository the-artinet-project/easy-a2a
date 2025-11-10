# @artinet/a2a

An easy-to-use SDK for creating Agent2Agent (A2A) agents with OpenAI-compatible APIs.

## Overview

`@artinet/a2a` provides a fluent builder for constructing multi-step AI agents with type-safe composition and automatic execution orchestration. Build agents that can communicate with other agents and easily manage complex multi-agent interactions.

## Installation

```bash
npm install @artinet/a2a
```

## Quick Start

```typescript
import { AIAgentBuilder } from "@artinet/a2a";

// Create an AI agent with OpenAI
const agent = AIAgentBuilder({ apiKey: "your-api-key" })
  .ai("You are a helpful assistant.")
  .createAgent({
    agentCard: "MyAgent",
  });

// Send a message
const result = await agent.sendMessage("Hello!");
```

## Features

- **Fluent Builder API**: Define your agents behaviour with chainable methods
- **Multi-Agent Orchestration**: Connect to other agents via the [`AgentRelay`](https://github.com/the-artinet-project/agent-relay).
- **Tool Integration**: Automatically convert A2A agents into OpenAI-compatible function tools
- **Executor Conversion**: Convert A2A executors into AgentEngine for advanced workflows

## Multi-Agent Example

```typescript
import { AgentBuilder } from "@artinet/sdk";
import { AIAgentBuilder } from "@artinet/a2a";

// Create helper agents
const echoAgent = AgentBuilder()
  .text(({ content }) => content ?? "No content")
  .createAgent({ agentCard: "EchoAgent" });

const testAgent = AgentBuilder()
  .text(({ content }) => "Hello, World!")
  .createAgent({ agentCard: "TestAgent" });

// Expose them to your AI Agent
const aiAgent = AIAgentBuilder(
  { apiKey: "your-api-key" },
  {
    callerId: "main-agent",
    agents: new Map([
      ["echo-agent", echoAgent],
      ["test-agent", testAgent],
    ]),
  }
)
  .text(() => "Message Recieved")
  .ai("Use your agents to fulfill the request.")
  .createAgent({ agentCard: "MainAgent" });

// The AI agent can now call or be called by other A2A agents
await aiAgent.sendMessage("Echo this message using the echo agent");
```

## API

### `AIAgentBuilder(client, agents?)`

Creates a new agent builder with an OpenAI client and optional agent relay.

**Parameters:**

- `client`: OpenAI instance or ClientOptions
- `agents?`: `AgentRelay`, `AgentRelayConfig`, or `A2AClient`, `Agent` for multi-agent communication

### `.ai(body, options?)`

Adds an AI step to the agent workflow.

**Parameters:**

- `body`: System prompt string or full `ChatCompletionCreateParams`
- `options?`: Request options including `history`/`args`/`content` inclusion settings

### `aiStep(stepArgs)`

Creates a custom AI step with fine-grained control over execution.

### `convertExecutor(executor)`

Converts an `AgentExecutor`(from @a2a-js/sdk) into an `AgentEngine`.

## License

Apache-2.0

## Resources

- [GitHub Repository](https://github.com/the-artinet-project/artinet-sdk)
- [Issue Tracker](https://github.com/the-artinet-project/artinet-sdk/issues)
