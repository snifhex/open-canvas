import { ChatOpenAI } from "@langchain/openai";
import { OpenCanvasGraphAnnotation, OpenCanvasGraphReturnType } from "../state";
import { FOLLOWUP_ARTIFACT_PROMPT } from "../prompts";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ensureStoreInConfig, formatReflections } from "../../utils";
import { Reflections } from "@/types";

/**
 * Generate a followup message after generating or updating an artifact.
 */
export const generateFollowup = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const smallModel = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
    maxTokens: 250,
  });

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections, {
        onlyContent: true,
      })
    : "No reflections found.";

  const recentArtifact = state.artifacts[state.artifacts.length - 1];
  const formattedPrompt = FOLLOWUP_ARTIFACT_PROMPT.replace(
    "{artifactContent}",
    recentArtifact.content
  )
    .replace("{reflections}", memoriesAsString)
    .replace(
      "{conversation}",
      state.messages
        .map(
          (msg) => `<${msg._getType()}>\n${msg.content}\n</${msg._getType()}>`
        )
        .join("\n\n")
    );

  // TODO: Include the chat history as well.
  const response = await smallModel.invoke([
    { role: "user", content: formattedPrompt },
  ]);

  return {
    messages: [response],
  };
};
