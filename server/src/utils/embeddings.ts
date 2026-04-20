import { ai } from '@/utils/gemini';

const EMBEDDING_MODEL = 'text-embedding-004';

export async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: [{ parts: [{ text }] }],
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('[embeddings] No embedding values returned');
  }

  return values;
}
