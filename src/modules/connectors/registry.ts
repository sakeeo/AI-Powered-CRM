/** Katalog Connector Hub. `available: false` = kartu tampil tetapi belum bisa dikonfigurasi. */
export type ConnectorCategory = "ai" | "webhook" | "whatsapp" | "email";

export const AI_PROVIDERS = ["gemini", "openai", "anthropic", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_INFO: Record<
  AiProvider,
  {
    type: `ai_${AiProvider}`;
    title: string;
    description: string;
    defaultModel: string;
    keyHint: string;
  }
> = {
  gemini: {
    type: "ai_gemini",
    title: "Google Gemini",
    description: "Rekomendasi awal. Gunakan API key dari Google AI Studio.",
    defaultModel: "gemini-2.5-flash",
    keyHint: "AIza…",
  },
  openai: {
    type: "ai_openai",
    title: "OpenAI",
    description: "Model GPT melalui API key OpenAI.",
    defaultModel: "gpt-4.1-mini",
    keyHint: "sk-…",
  },
  anthropic: {
    type: "ai_anthropic",
    title: "Anthropic",
    description: "Model Claude melalui API key Anthropic.",
    defaultModel: "claude-haiku-5-5",
    keyHint: "sk-ant-…",
  },
  openrouter: {
    type: "ai_openrouter",
    title: "OpenRouter",
    description: "Satu key untuk banyak model. Nama model berformat vendor/model.",
    defaultModel: "openai/gpt-4o-mini",
    keyHint: "sk-or-…",
  },
};

export const AI_TYPES = AI_PROVIDERS.map((p) => AI_PROVIDER_INFO[p].type);
export function providerFromType(type: string): AiProvider | null {
  return AI_PROVIDERS.find((p) => AI_PROVIDER_INFO[p].type === type) ?? null;
}

/** Kartu non-AI yang akan diaktifkan pada plan berikutnya. */
export const FUTURE_CONNECTORS: {
  category: ConnectorCategory;
  title: string;
  description: string;
  note: string;
}[] = [
  {
    category: "whatsapp",
    title: "WhatsApp Business",
    description: "Kirim dan terima pesan pelanggan dari satu inbox.",
    note: "Tersedia di Phase 2",
  },
];
