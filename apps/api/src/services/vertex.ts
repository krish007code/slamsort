import { GoogleGenAI } from '@google/genai';

/** Lazy ADC-backed client; only the guarded local route may invoke it. */
export function createVertexClient() {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  const model = process.env.GEMINI_MODEL;
  if (!project || !location || !model || [project, location, model].some((value) => value.includes('<'))) {
    throw new Error('Explicit project, supported location and model configuration are required.');
  }
  return { client: new GoogleGenAI({ vertexai: true, project, location }), model };
}
