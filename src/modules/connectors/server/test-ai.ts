import { generateText } from "ai";
import { buildModel, describeAiError } from "@/lib/ai";
import type { AiProvider } from "@/modules/connectors/registry";

/** Panggilan minimal ke penyedia untuk memastikan key & model valid. Server-side saja. */
export async function testAiConnection(
  provider: AiProvider,
  apiKey: string,
  modelId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await generateText({
      model: buildModel(provider, apiKey, modelId),
      prompt: "Balas dengan satu kata: pong",
      maxOutputTokens: 16,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(15_000),
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeAiError(error, apiKey) };
  }
}
