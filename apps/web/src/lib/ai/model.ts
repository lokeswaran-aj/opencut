/**
 * Model provider — Google Vertex AI (Gemini).
 *
 * Environment variables:
 *
 *   GOOGLE_VERTEX_PROJECT    GCP project ID (required)
 *   GOOGLE_VERTEX_LOCATION   GCP region or "global" — default "global"
 *                            Note: gemini-3.1-pro/flash preview models require "global"
 *   AI_GENERATION_MODEL      Override the generation model ID
 *   AI_EDIT_MODEL            Override the lightweight edit model ID
 *
 *   Credentials — choose one of (checked in order):
 *
 *     Option A — Full service account JSON, base64-encoded (recommended for Coolify/Docker):
 *       GOOGLE_SERVICE_ACCOUNT_JSON  base64 of the entire service-account .json file
 *       Generate with: cat service-account-key.json | base64 | tr -d '\n'
 *
 *     Option B — Individual fields:
 *       GOOGLE_CLIENT_EMAIL    client_email from the service account JSON
 *       GOOGLE_PRIVATE_KEY     private_key from the service account JSON
 *                              (newlines can be either literal \n or \\n)
 *       GOOGLE_PRIVATE_KEY_ID  private_key_id (optional)
 *
 *     Option C — Service account JSON file (local dev):
 *       GOOGLE_APPLICATION_CREDENTIALS  absolute path to the .json file
 */

import { createVertex } from "@ai-sdk/google-vertex";
import type { LanguageModel } from "ai";

const DEFAULT_GENERATION_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_EDIT_MODEL = "gemini-3.1-flash-lite-preview";

let _vertexProvider: ReturnType<typeof createVertex> | null = null;

function getVertexProvider() {
  if (_vertexProvider) return _vertexProvider;

  const project = process.env.GOOGLE_VERTEX_PROJECT;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? "global";

  if (!project) {
    throw new Error("[model] GOOGLE_VERTEX_PROJECT is required");
  }

  // Option A: full service account JSON base64-encoded — most reliable for
  // container deployments because it avoids all newline/escaping issues with
  // the private key field.
  const serviceAccountB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountB64) {
    const json = JSON.parse(Buffer.from(serviceAccountB64, "base64").toString("utf-8"));
    _vertexProvider = createVertex({
      project,
      location,
      googleAuthOptions: { credentials: json },
    });
    return _vertexProvider;
  }

  // Option B: individual credential fields
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const privateKeyId = process.env.GOOGLE_PRIVATE_KEY_ID;
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

/** Full video code generation — Gemini 3.1 Pro */
export function getGenerationModel(): LanguageModel {
  const modelId = process.env.AI_GENERATION_MODEL ?? DEFAULT_GENERATION_MODEL;
  return getVertexProvider()(modelId);
}

/** Lightweight edits — Gemini 3.1 Flash Lite */
export function getEditModel(): LanguageModel {
  const modelId = process.env.AI_EDIT_MODEL ?? DEFAULT_EDIT_MODEL;
  return getVertexProvider()(modelId);
}
