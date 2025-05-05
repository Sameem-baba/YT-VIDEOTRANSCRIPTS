// import { api } from "@/convex/_generated/api";
import { ChatAnthropic } from "@langchain/anthropic";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";
import {
	END,
	MemorySaver,
	MessagesAnnotation,
	START,
	StateGraph,
} from "@langchain/langgraph";
import SYSTEM_MESSAGE from "@/constants/systemMessage";
import {
	AIMessage,
	BaseMessage,
	HumanMessage,
	SystemMessage,
	trimMessages,
} from "@langchain/core/messages";
import {
	ChatPromptTemplate,
	MessagesPlaceholder,
} from "@langchain/core/prompts";

const trimmer = trimMessages({
	maxTokens: 10,
	strategy: "last",
	tokenCounter: (msgs) => msgs.length,
	includeSystem: true,
	allowPartial: false,
	startOn: "human",
});

const toolClient = new wxflows({
	endpoint: process.env.WXFLOWS_ENDPOINT || "",
	apikey: process.env.WXFLOWS_APIKEY,
});

const tools = await toolClient.lcTools;
const toolNode = new ToolNode(tools);

const initialiseModel = () => {
	const model = new ChatAnthropic({
		model: "claude-3-5-sonnet-20241022",
		anthropicApiKey: process.env.ANTHROPIC_API_KEY,
		temperature: 0.7,
		maxTokens: 4096,
		streaming: true,
		clientOptions: {
			defaultHeaders: {
				"anthropic-beta": "prompt-caching-2024-07-31",
			},
		},
		callbacks: [
			{
				handleLLMStart: async () => {
					console.log("LLM started");
				},
				handleLLMEnd: async (output) => {
					console.log("LLM ended");
					const usage = output.llmOutput?.usage;
					if (usage) {
					}
				},
			},
		],
	}).bindTools(tools);

	return model;
};

const shouldContinue = async (state: typeof MessagesAnnotation.State) => {
	const messages = state.messages;
	const lastMessage = messages[messages.length - 1] as AIMessage;

	if (lastMessage.tool_calls?.length) {
		return "tools";
	}

	if (lastMessage.content && lastMessage._getType() === "tool") {
		return "agent";
	}

	return END;
};

const createWorkflow = () => {
	const model = initialiseModel();

	const stateGraph = new StateGraph(MessagesAnnotation)
		.addNode("agent", async (state) => {
			const systemMessage = SYSTEM_MESSAGE;

			const promptTemplate = ChatPromptTemplate.fromMessages([
				new SystemMessage(systemMessage, {
					cache_control: { type: "ephemeral" },
				}),
				new MessagesPlaceholder("messages"),
			]);

			const trimmedMessages = await trimmer.invoke(state.messages);

			const prompt = await promptTemplate.invoke({ messages: trimmedMessages });

			const response = await model.invoke(prompt);

			return { messages: [response] };
		})
		.addEdge(START, "agent")
		.addNode("tools", toolNode)
		.addConditionalEdges("agent", shouldContinue)
		.addEdge("tools", "agent");

	return stateGraph;
};

function addCachingHeaders(messages: BaseMessage[]) {
	if (!messages.length) return messages;

	const cachedMessages = [...messages];

	const addCache = (message: BaseMessage) => {
		message.content = [
			{
				type: "text",
				text: message.content as string,
				cache_control: { type: "ephemeral" },
			},
		];
	};

	addCache(cachedMessages.at(-1)!);

	let humanCount = 0;
	for (let i = cachedMessages.length - 1; i >= 0; i--) {
		if (cachedMessages[i] instanceof HumanMessage) {
			humanCount++;
			if (humanCount === 2) {
				addCache(cachedMessages[i]);
				break;
			}
		}
	}

	return cachedMessages;
}

export async function submitQuestion(messages: BaseMessage[], chatId: string) {
	addCachingHeaders(messages);
	const workflow = createWorkflow();

	const checkpointer = new MemorySaver();
	const app = workflow.compile({ checkpointer });

	const stream = await app.streamEvents(
		{ messages },
		{
			version: "v2",
			configurable: {
				thread_id: chatId,
			},
			streamMode: "messages",
			runId: chatId,
		}
	);

	return stream;
}
