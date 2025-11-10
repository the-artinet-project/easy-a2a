import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from "@jest/globals";
import {
  TaskStatusUpdateEvent,
  Context,
  Message,
  MessageSendParams,
  createAgent,
  TaskState,
  Task,
  UpdateEvent,
} from "@artinet/sdk";
import {
  AgentExecutor,
  RequestContext,
  ExecutionEventBus,
} from "@a2a-js/sdk/server";
import { convertExecutor } from "../src/index.js";
jest.setTimeout(10000);

class TestExecutor implements AgentExecutor {
  private cancelledTasks = new Set<string>();
  public async cancelTask(
    taskId: string,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    console.log(`[Executor] Received cancellation request for task: ${taskId}`);
    this.cancelledTasks.add(taskId);
  }

  public async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const { taskId, contextId } = requestContext;
    eventBus.publish({
      kind: "task",
      id: taskId,
      contextId,
      status: { state: "submitted", timestamp: new Date().toISOString() },
    });

    for (let i = 0; i < 5; i++) {
      if (this.cancelledTasks.has(taskId)) {
        console.log(`[Executor] Aborting task ${taskId} due to cancellation.`);
        const cancelledUpdate: TaskStatusUpdateEvent = {
          kind: "status-update",
          taskId: taskId,
          contextId: contextId,
          status: { state: "canceled", timestamp: new Date().toISOString() },
          final: true,
        };
        eventBus.publish(cancelledUpdate);
        eventBus.finished();
        this.cancelledTasks.delete(taskId);
        return;
      }
      switch (i) {
        case 1:
          eventBus.publish({
            kind: "status-update",
            taskId,
            contextId,
            status: { state: "working", timestamp: new Date().toISOString() },
            final: false,
          });
          break;
        case 2:
          eventBus.publish({
            kind: "artifact-update",
            taskId,
            contextId,
            artifact: {
              artifactId: "result.txt",
              parts: [{ kind: "text", text: "First result." }],
            },
          });
        default:
          break;
      }
      console.log(`[Executor] Working on step ${i + 1} for task ${taskId}...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log(
      `[Executor] Task ${taskId} finished all steps without cancellation.`
    );

    // If not canceled, finish the work and publish the completed state.
    const finalUpdate: TaskStatusUpdateEvent = {
      kind: "status-update",
      taskId,
      contextId,
      status: { state: "completed", timestamp: new Date().toISOString() },
      final: true,
    };
    eventBus.publish(finalUpdate);
    eventBus.finished();
  }
}
const contextId = "123";
const testMessage: Message = {
  taskId: contextId,
  contextId: contextId,
  parts: [{ kind: "text", text: "test" }],
  messageId: "123",
  kind: "message",
  role: "user",
};

describe("Conversion", () => {
  const agent = createAgent({
    engine: convertExecutor(new TestExecutor()),
    agentCard: {
      description: "Test Agent",
      name: "Test Agent",
      capabilities: {
        extensions: [{ uri: "text-processing" }],
        streaming: true,
        pushNotifications: true,
      },
      protocolVersion: "0.3.0",
      defaultInputModes: ["text"],
      defaultOutputModes: ["text"],
      skills: [
        {
          id: "text-processing",
          name: "Text Processing",
          description: "Text Processing",
          tags: [],
        },
      ],
      version: "1.0.0",
      url: "https://test.com",
    },
  });

  beforeEach(() => {});

  afterEach(async () => {});

  it("should convert an AgentExecutor to an AgentEngine", () => {
    const executor = new TestExecutor();
    const engine = convertExecutor(executor);
    expect(engine).toBeDefined();
  });
  it("should execute a task", async () => {
    const result = await agent.sendMessage({ message: testMessage });
    expect(result as Task).toBeDefined();
    expect((result as Task).status.state).toEqual(TaskState.completed);
  });
  it("should stream a task", async () => {
    const generator = agent.streamMessage({ message: testMessage });
    const result: UpdateEvent[] = [];
    for await (const message of generator) {
      result.push(message);
    }
    expect(result).toBeDefined();
    expect(result.length).toEqual(4);
  });
});
