/**
 * Model provider abstraction.
 *
 * Reads AI_PROVIDER from the environment to select between Anthropic and
 * Google Vertex AI. Both providers and their default models can be fully
 * controlled through environment variables — no code changes required when
 * switching.
 *
 * Environment variables:
 *
 *   AI_PROVIDER              "anthropic" (default) | "vertex"
 *   AI_GENERATION_MODEL      Override the generation model ID
 *   AI_EDIT_MODEL            Override the lightweight edit model ID
 *
 * Anthropic (default):
 *   ANTHROPIC_API_KEY        Required
 *   Default models: claude-3-5-sonnet-20241022 / claude-3-5-haiku-20241022
 *
 * Google Vertex AI:
 *   GOOGLE_VERTEX_PROJECT    GCP project ID (required)
 *   GOOGLE_VERTEX_LOCATION   GCP region or "global" — default "global"
 *                            Note: some models (e.g. gemini-2.5-pro) are
 *                            only available via the global endpoint.
 *   Default models: gemini-2.5-pro / gemini-2.5-flash
 *
 *   Credentials — choose one of:
 *     Option A — Service account JSON file (local dev):
 *       GOOGLE_APPLICATION_CREDENTIALS  absolute path to the .json file
 *
 *     Option B — Individual fields (deployment / Vercel):
 *       GOOGLE_CLIENT_EMAIL    client_email from the service account JSON
 *       GOOGLE_PRIVATE_KEY     private_key from the service account JSON
 *                              (newlines can be either literal \n or \\n)
 *       GOOGLE_PRIVATE_KEY_ID  private_key_id (optional)
 */

import { anthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import type { LanguageModel } from "ai";

type Provider = "anthropic" | "vertex";

function resolveProvider(): Provider {
  const raw = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase().trim();
  if (raw === "vertex") return "vertex";
  if (raw !== "anthropic") {
    console.warn(
      `[model] Unknown AI_PROVIDER "${raw}", falling back to "anthropic".`,
    );
  }
  return "anthropic";
}

// Lazily created Vertex provider — avoids touching Google credentials unless
// the provider is actually "vertex".
let _vertexProvider: ReturnType<typeof createVertex> | null = null;

function getVertexProvider() {
  if (_vertexProvider) return _vertexProvider;

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? "global";

  if (!project) {
    throw new Error(
      "[model] GOOGLE_VERTEX_PROJECT is required when AI_PROVIDER=vertex",
    );
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  // Handle both literal newlines and escaped \n sequences in the private key
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const privateKeyId = process.env.GOOGLE_PRIVATE_KEY_ID;

  // When GOOGLE_APPLICATION_CREDENTIALS is set, google-auth-library picks it
  // up automatically — no explicit credentials needed.
  const hasExplicitCreds = !!(clientEmail && privateKey);

  _vertexProvider = createVertex({
    project,
    location,
    ...(hasExplicitCreds
      ? {
          googleAuthOptions: {
            credentials: {
              client_email: clientEmail!,
              private_key: privateKey!,
              ...(privateKeyId ? { private_key_id: privateKeyId } : {}),
            },
          },
        }
      : {}),
  });

  return _vertexProvider;
}

const DEFAULTS = {
  anthropic: {
    generation: "claude-sonnet-4-6",
    edit: "claude-haiku-4-5-20251001",
  },
  vertex: {
    generation: "gemini-3.1-pro-preview",
    edit: "gemini-3.1-flash-lite-preview",
  },
};

/**
 * Returns the model used for full video generation (research → script → audio).
 * Controlled by AI_PROVIDER + AI_GENERATION_MODEL.
 */
export function getGenerationModel(): LanguageModel {
  const provider = resolveProvider();
  const modelId =
    process.env.AI_GENERATION_MODEL ?? DEFAULTS[provider].generation;

  if (provider === "vertex") {
    return getVertexProvider()(modelId);
  }
  return anthropic(modelId);
}

/**
 * Returns the lightweight model used for edits (edit_narration, generate_style_component).
 * Controlled by AI_PROVIDER + AI_EDIT_MODEL.
 */
export function getEditModel(): LanguageModel {
  const provider = resolveProvider();
  const modelId = process.env.AI_EDIT_MODEL ?? DEFAULTS[provider].edit;

  if (provider === "vertex") {
    return getVertexProvider()(modelId);
  }
  return anthropic(modelId);
}
