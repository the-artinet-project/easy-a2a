/**
 * Copyright 2025 The Artinet Project
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  TaskQueryParams,
  TaskIdParams,
  Agent,
  A2AClient,
  createMessageSendParams,
  A2AService,
} from "@artinet/sdk";
import {
  AgentRelay,
  AgentRelayRequest,
  AgentType,
  CancelRelayTaskRequest,
  GetRelayTaskRequest,
  SearchRelayRequest,
} from "@artinet/agent-relay";
import { zodFunction } from "openai/helpers/zod";
import { z } from "zod";

export function toolifyAgentInstance(agent: Agent) {
  return [
    zodFunction({
      name: "message-send",
      parameters: z.object({ message: z.string() }),
      function: async (args: { message: string }) =>
        await agent.sendMessage(createMessageSendParams(args.message)),
      description: `Send a message to the agent. This will send the message to the agent and return the result.`,
    }),
    zodFunction({
      name: "get-agent-card",
      parameters: z.object({}),
      function: async () => {
        return await agent.agentCard;
      },
      description:
        "Retrieve the agent's AgentCard which contains information about the agent's capabilities, skills, default input/output modes, and other information.",
    }),
    zodFunction({
      name: "tasks-get",
      parameters: z.object({
        id: z.string(),
      }),
      function: async (args: TaskQueryParams) => await agent.getTask(args),
      description:
        "Retrieve the current state of a task by passing its ID and optional history length",
    }),
    zodFunction({
      name: "tasks-cancel",
      parameters: z.object({ id: z.string() }),
      function: async (args: TaskIdParams) => await agent.cancelTask(args),
      description:
        "Cancel a task by passing its ID. This will cancel the task and return information about the cancelled task.",
    }),
  ];
}
export type AgentInstanceTool = ReturnType<typeof toolifyAgentInstance>;

export function toolifyClient(agent: A2AClient) {
  return [
    zodFunction({
      name: "message-send",
      parameters: z.object({ message: z.string() }),
      function: async (args: { message: string }) =>
        await agent.sendMessage(createMessageSendParams(args.message)),
      description: `Send a message to the agent. This will send the message to the agent and return the result.`,
    }),
    zodFunction({
      name: "get-agent-card",
      parameters: z.object({}),
      function: async () => await agent.agentCard(),
      description:
        "Retrieve the agent's AgentCard which contains information about the agent's capabilities, skills, default input/output modes, and other information.",
    }),
    zodFunction({
      name: "tasks-get",
      parameters: z.object({
        id: z.string(),
      }),
      function: async (args: TaskQueryParams) => await agent.getTask(args),
      description:
        "Retrieve the current state of a task by passing its ID and optional history length",
    }),
    zodFunction({
      name: "tasks-cancel",
      parameters: z.object({ id: z.string() }),
      function: async (args: TaskIdParams) => await agent.cancelTask(args),
      description:
        "Cancel a task by passing its ID. This will cancel the task and return information about the cancelled task.",
    }),
  ];
}
export type ClientInstanceTool = ReturnType<typeof toolifyClient>;

export type AgentTool = AgentInstanceTool | ClientInstanceTool;

export function toolifyAgentRelay(relay: AgentRelay) {
  return [
    zodFunction({
      name: "relay-message-send",
      parameters: z.object({
        agentId: z.string(),
        message: z.string(),
      }),
      function: async (args: { agentId: string; message: string }) =>
        await relay.sendMessage({
          agentId: args.agentId,
          messageSendParams: createMessageSendParams(args.message),
        }),
      description: `Send a message to an agent via the relay. This will send the message to the agent indicated by the agentId and return the result. `,
    }),
    zodFunction({
      name: "relay-tasks-get",
      parameters: z.object({
        agentId: z.string(),
        taskQuery: z.object({
          id: z.string(),
        }),
      }),
      function: async (args: GetRelayTaskRequest) => await relay.getTask(args),
    }),
    zodFunction({
      name: "relay-tasks-cancel",
      parameters: z.object({
        agentId: z.string(),
        taskId: z.object({
          id: z.string(),
        }),
      }),
      function: async (args: CancelRelayTaskRequest) =>
        await relay.cancelTask(args),
    }),
    zodFunction({
      name: "relay-agents-get-card-all",
      parameters: z.object({}),
      function: async () => await relay.getAgentCards(),
      description:
        "Get all the agent cards from the relay. This will return an array of AgentCard objects.",
    }),
    zodFunction({
      name: "relay-agents-get-ids",
      parameters: z.object({}),
      function: async () => await relay.getAgentIds(),
      description:
        "Get the ids of all the agents from the relay. This will return an array of strings.",
    }),
    zodFunction({
      name: "relay-agents-search",
      parameters: z.object({
        query: z.string(),
      }),
      function: async (args: SearchRelayRequest) =>
        await relay.searchAgents(args),
    }),
    zodFunction({
      name: "relay-agents-get-card",
      parameters: z.object({
        agentId: z.string(),
      }),
      function: async (args: AgentRelayRequest) =>
        await relay.getAgentCard(args),
      description:
        "Get the agent card from the relay for the given agentId. This will return an AgentCard object.",
    }),
  ];
}
export type AgentRelayTool = ReturnType<typeof toolifyAgentRelay>;

export function toolifyAgents(agents: AgentRelay | AgentType) {
  if (agents instanceof AgentRelay) {
    return toolifyAgentRelay(agents);
  } else if (agents instanceof A2AService) {
    return toolifyAgentInstance(agents);
  } else if (agents instanceof A2AClient) {
    return toolifyClient(agents);
  }
  throw new Error("Invalid agents type");
}
