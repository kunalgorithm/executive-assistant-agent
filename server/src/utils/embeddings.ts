import path from 'path';
import fs from 'fs';
import { pipeline, env as hfEnv, layer_norm, type Tensor } from '@huggingface/transformers';
import { env } from '@/utils/env';
import { logger } from '@/utils/log';

const EMBEDDING_MODEL = 'nomic-ai/nomic-embed-text-v1.5';
const EXPECTED_DIMENSIONS = 768;
const MAX_LOAD_RETRIES = 2;

const cacheDir = env.HF_CACHE_DIR || path.resolve(process.cwd(), '.hf-cache');
hfEnv.cacheDir = cacheDir;

type ExtractorPipeline = Awaited<ReturnType<typeof pipeline>>;

let extractor: ExtractorPipeline | null = null;

function clearModelCache(): void {
  const modelCacheDir = path.join(cacheDir, 'nomic-ai');
  if (fs.existsSync(modelCacheDir)) {
    logger.warn('Clearing model cache', { path: modelCacheDir });
    fs.rmSync(modelCacheDir, { recursive: true, force: true });
  }
}

/** Load the model and verify it produces a valid embedding */
async function loadAndVerify(): Promise<ExtractorPipeline> {
  const ext = await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'fp16' });

  // Smoke-test: generate a real embedding and validate shape
  const output = (await ext('search_document: health check', { pooling: 'mean' })) as Tensor;
  const dims = output.dims;
  if (dims.length !== 2 || dims[1] !== EXPECTED_DIMENSIONS) {
    throw new Error(`Embedding shape mismatch: expected [1, ${EXPECTED_DIMENSIONS}], got [${dims.join(', ')}]`);
  }

  return ext;
}

async function getExtractor(): Promise<ExtractorPipeline> {
  if (extractor) return extractor;

  for (let attempt = 1; attempt <= MAX_LOAD_RETRIES; attempt++) {
    try {
      logger.info(`Loading ${EMBEDDING_MODEL} (attempt ${attempt}/${MAX_LOAD_RETRIES})...`);
      extractor = await loadAndVerify();
      logger.info('Embedding model loaded and verified');
      return extractor;
    } catch (err) {
      logger.error('Failed to load embedding model', { attempt, error: String(err) });
      extractor = null;
      clearModelCache();
      if (attempt === MAX_LOAD_RETRIES) throw err;
    }
  }

  throw new Error('Unreachable: embedding model load exhausted retries');
}

/** Call at server startup to download/verify the model eagerly */
export async function warmupEmbeddings(): Promise<void> {
  try {
    await getExtractor();
  } catch (err) {
    logger.error('Embedding model warmup failed. embeddings will retry on first use', { error: String(err) });
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = (await ext(`search_document: ${text}`, { pooling: 'mean' })) as Tensor;
  const normalized = layer_norm(output, [output.dims[1]!]).normalize(2, -1);
  return normalized.tolist()[0] as number[];
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const output = (await ext(`search_query: ${text}`, { pooling: 'mean' })) as Tensor;
  const normalized = layer_norm(output, [output.dims[1]!]).normalize(2, -1);
  return normalized.tolist()[0] as number[];
}

export function buildProfileContext(user: { title?: string | null; bio?: string | null; tags: string[] }): string {
  const parts: string[] = [];
  if (user.title) parts.push(user.title);
  if (user.bio) parts.push(user.bio);
  if (user.tags.length) parts.push(user.tags.join(', '));
  return parts.join('. ');
}
