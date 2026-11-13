/** Katalog Connector Hub. `available: false` = kartu tampil tetapi belum bisa dikonfigurasi. */
export type ConnectorCategory = "ai" | "webhook" | "whatsapp" | "email";

export const AI_PROVIDERS = [
  "gemini",
  "openai",
  "anthropic",
  "deepseek",
  "openrouter",
  "custom",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_INFO: Record<
  AiProvider,
  {
    type: `ai_${AiProvider}`;
    title: string;
    description: string;
    defaultModel: string;
    keyHint: string;
    /** Endpoint bawaan (API kompatibel OpenAI / Gemini / Anthropic). Kosong = wajib diisi user. */
    defaultBaseUrl: string;
    /** User boleh mengganti base URL (proxy, gateway, self-host). */
    baseUrlEditable: boolean;
  }
> = {
  gemini: {
    type: "ai_gemini",
    title: "Google Gemini",
    description: "Rekomendasi awal. Gunakan API key dari Google AI Studio.",
    defaultModel: "gemini-2.5-flash",
    keyHint: "AIza…",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    baseUrlEditable: false,
  },
  openai: {
    type: "ai_openai",
    title: "OpenAI",
    description: "Model GPT melalui API key OpenAI.",
    defaultModel: "gpt-4.1-mini",
    keyHint: "sk-…",
    defaultBaseUrl: "https://api.openai.com/v1",
    baseUrlEditable: true,
  },
  anthropic: {
    type: "ai_anthropic",
    title: "Anthropic",
    description: "Model Claude melalui API key Anthropic.",
    defaultModel: "claude-haiku-5-5",
    keyHint: "sk-ant-…",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    baseUrlEditable: false,
  },
  deepseek: {
    type: "ai_deepseek",
    title: "DeepSeek",
    description: "Model DeepSeek (chat/reasoner) melalui API key platform DeepSeek.",
    defaultModel: "deepseek-chat",
    keyHint: "sk-…",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    baseUrlEditable: true,
  },
  openrouter: {
    type: "ai_openrouter",
    title: "OpenRouter",
    description: "Satu key untuk banyak model. Nama model berformat vendor/model.",
    defaultModel: "openai/gpt-4o-mini",
    keyHint: "sk-or-…",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    baseUrlEditable: true,
  },
  custom: {
    type: "ai_custom",
    title: "Custom (OpenAI-compatible)",
    description:
      "Endpoint apa pun yang kompatibel dengan API OpenAI (Groq, Together, Ollama, vLLM, LiteLLM, dll).",
    defaultModel: "",
    keyHint: "key dari penyedia Anda",
    defaultBaseUrl: "",
    baseUrlEditable: true,
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
