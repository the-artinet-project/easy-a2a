/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview A2A Builder
 *
 * This module provides a fluent builder API for constructing A2A agents and
 * execution engines. It enables declarative definition of multi-step agent
 * workflows with type-safe step composition and automatic execution orchestration.
 */

import {
  Step,
  MessageSendParams,
  TextPart,
  StepOutput,
  StepOutputWithForwardArgs,
  StepParams,
  EngineBuilder,
  StepWithKind,
  FilePart,
  DataPart,
  OutArgsOf,
  A2AService,
  A2AClient,
  AgentBuilder,
  getContent,
} from "@artinet/sdk";
import { AgentRelayConfig, AgentType, AgentRelay } from "@artinet/agent-relay";
import openai, { ClientOptions, OpenAI } from "openai";
import { toolifyAgents } from "./tools.js";
import { Task } from "@a2a-js/sdk";

type AIClient = OpenAI;
/**
 * @class AIStepArgs
 * @description AI step arguments
 * @property {OpenAI} openaiClient - OpenAI instance
 * @property {Object} settings - AI step settings
 * @property {Object} body - AI step body
 * @property {Object} options - AI step options
 */
export interface AIStepArgs {
  client: AIClient;
  settings?: {
    //defaults to true
    includeHistory?: boolean;
    includeArgs?: boolean;
    includeContent?: boolean;
    disableAgents?: boolean;
  };
  body?: openai.ChatCompletionCreateParamsNonStreaming;
  options?: openai.RequestOptions;
  agents?: AgentRelay | AgentType;
}

/**
 * Creates a session messages array from the given messages, task, args, and content.
 *
 * @param messages - The messages to create the session messages from.
 * @param task - The task to create the session messages from.
 * @param args - The args to create the session messages from.
 * @param content - The content to create the session messages from.
 */
function createSession(
  messages?: openai.ChatCompletionCreateParams["messages"],
  task?: Task,
  args?: readonly unknown[],
  content?: string
) {
  const historicalMessages = task?.history
    ?.map((message) => {
      const content = getContent(message);
      if (
        !content ||
        content === "" ||
        content === "{}" ||
        content === "[]" ||
        content === "null" ||
        content === "undefined"
      )
        return undefined;
      return {
        role:
          message.role === "agent" ? ("assistant" as const) : ("user" as const),
        content: content,
      };
    })
    .filter((message) => message !== undefined);
  const argumentsMessage = args
    ? [{ role: "system" as const, content: JSON.stringify(args) }]
    : [];
  const contentMessage = content
    ? [{ role: "user" as const, content: content }]
    : [];
  const sessionMessages = [
    ...(messages ?? []),
    ...(historicalMessages ?? []),
    ...argumentsMessage,
    ...contentMessage,
  ];
  return sessionMessages;
}

/**
 * Creates an AI step from the given step arguments.
 *
 * @param stepArgs - The step arguments to create the AI step from.
 * @returns A step that can be used to invoke an AI with tools and A2A agents.
 */
export function aiStep(
  stepArgs: AIStepArgs
): Step<
  MessageSendParams,
  TextPart["text"],
  readonly unknown[],
  readonly unknown[],
  StepOutput<TextPart["text"]>
> {
  return async (params: StepParams<MessageSendParams, readonly unknown[]>) => {
    const {
      client,
      settings = {
        includeHistory: true,
        includeArgs: true,
        includeContent: true,
        disableAgents: false,
      },
      body = { model: "openai/gpt-4o", messages: [] },
      options,
    } = stepArgs;

    let completion: openai.ChatCompletion | undefined;

    const messages = createSession(
      body?.messages,
      settings.includeHistory
        ? (params.context.State().task as Task)
        : undefined,
      settings.includeArgs ? params.args : undefined,
      settings.includeContent ? params.content : undefined
    );

    const agentList = stepArgs.agents ? toolifyAgents(stepArgs.agents) : [];

    if (!agentList.length || settings.disableAgents) {
      completion = await client.chat.completions.create(
        {
          ...body,
          messages: messages,
        },
        options
      );
    } else {
      const runner = client.chat.completions.runTools(
        {
          ...body,
          messages: messages,
          tools: agentList,
        },
        options
      );
      completion = await runner.finalChatCompletion();
    }

    return {
      parts: completion.choices[0].message.content ?? "",
      args: [completion],
    };
  };
}

/**
 * A builder for constructing OpenAI API compatible A2A agents.
 *
 * This builder extends the EngineBuilder to add methods for adding AI steps and A2A agents.
 *
 * @template TInboundArgs - The type of inbound arguments to the step. This is the type of the arguments passed to the step.
 * @extends EngineBuilder<MessageSendParams, TInboundArgs>
 * @example
 * ```typescript
 * const builder = new OpenaiEngineBuilder(new OpenAI({ apiKey: "your-api-key" }));
 * builder.ai("Always tell the user what type of tools you have available to you.");
 * builder.addStep(aiStep({ body: { model: "gpt-4o-mini", messages: [{ role: "system", content: "You are a helpful assistant." }] } }));
 * ```
 */
export class OpenaiEngineBuilder<
  TInboundArgs extends readonly unknown[] = []
> extends EngineBuilder<MessageSendParams, TInboundArgs> {
  constructor(
    private readonly aiClient: AIClient,
    steps?: Array<StepWithKind<any, any, any, any, any, any>>,
    private readonly agents?: AgentRelay | AgentType
  ) {
    super(steps);
  }
  override addStep<
    TPart extends
      | DataPart["data"]
      | FilePart["file"]
      | TextPart["text"] = TextPart["text"],
    TForwardArgs extends readonly unknown[] = [],
    TOutput extends
      | StepOutput<TPart>
      | StepOutputWithForwardArgs<TPart, TForwardArgs>
      | Array<TPart>
      | TPart = StepOutput<TPart>,
    TKind extends "text" | "file" | "data" = "text"
  >(
    step: StepWithKind<
      MessageSendParams,
      TPart,
      TInboundArgs,
      TForwardArgs,
      TOutput,
      TKind
    >
  ) {
    let steps: Array<StepWithKind<any, any, any, any, any, any>> = [];
    try {
      steps = this.build();
    } catch (error) {}
    return new OpenaiEngineBuilder<OutArgsOf<TOutput>>(
      this.aiClient,
      [...steps, step],
      this.agents
    );
  }
  ai(
    body: openai.ChatCompletionCreateParamsNonStreaming | string,
    options?: openai.RequestOptions & {
      includeHistory?: boolean;
      includeArgs?: boolean;
      includeContent?: boolean;
    }
  ) {
    return this.addStep({
      step: aiStep({
        body:
          typeof body === "string"
            ? {
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: body }],
              }
            : body,
        options,
        settings: {
          includeHistory: options?.includeHistory ?? true,
          includeArgs: options?.includeArgs ?? true,
          includeContent: options?.includeContent ?? true,
        },
        client: this.aiClient,
        agents: this.agents,
      }),
      kind: "text",
    });
  }
}

function createAgentArgs(
  agents: AgentRelay | AgentRelayConfig | AgentType | undefined
) {
  if (agents === undefined) {
    return undefined;
  }
  let relay: AgentRelay | null = null;
  let agent: AgentType | undefined = undefined;
  if (agents instanceof AgentRelay) {
    relay = agents;
  } else if (agents instanceof A2AService || agents instanceof A2AClient) {
    agent = agents;
  } else if (
    agents !== null &&
    typeof agents === "object" &&
    "callerId" in agents
  ) {
    relay = new AgentRelay(agents);
  }
  return relay ?? agent;
}

/**
 * Creates an A2A agent builder from the given client and agents.
 *
 * @param client - The client to use for the agent.
 * @param agents - The agents to use for the agent. This can be an AgentRelay, A2AService, A2AClient, or an AgentRelayConfig.
 * @returns The A2A agent builder.
 */
export const AIAgentBuilder = (
  client: AIClient | ClientOptions,
  agents?: AgentRelay | AgentRelayConfig | AgentType
) => {
  return new OpenaiEngineBuilder(
    client instanceof OpenAI ? client : new OpenAI(client),
    undefined,
    createAgentArgs(agents)
  );
};
