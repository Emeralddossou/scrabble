import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizeWord } from '@/domain/scrabble/rules';

let dictionaryCache: Set<string> | undefined;
let wordsByLengthCache: Map<number, string[]> | undefined;
let dictionaryLoading: Promise<ReadonlySet<string>> | undefined;

export async function getDictionary(): Promise<ReadonlySet<string>> {
  if (dictionaryCache) return dictionaryCache;
  dictionaryLoading ??= loadDictionary().catch((error: unknown) => {
    dictionaryLoading = undefined;
    throw error;
  });
  return dictionaryLoading;
}

async function loadDictionary(): Promise<ReadonlySet<string>> {
  const dictionaryPath = path.join(process.cwd(), 'data', 'ods.txt');
  let content: string;
  try {
    content = await readFile(dictionaryPath, 'utf8');
  } catch {
    throw new Error(`Dictionnaire ODS introuvable : ${dictionaryPath}`);
  }
  const words: string[] = [];
  const index = new Map<number, string[]>();
  for (const rawWord of content.split(/\r?\n/)) {
    const word = normalizeWord(rawWord.trim());
    if (!word) continue;
    words.push(word);
    const byLength = index.get(word.length) ?? [];
    byLength.push(word);
    index.set(word.length, byLength);
  }
  if (words.length < 1000) throw new Error('Le dictionnaire ODS est invalide ou incomplet.');
  dictionaryCache = new Set(words);
  wordsByLengthCache = index;
  return dictionaryCache;
}

export async function wordsByLength(length: number): Promise<readonly string[]> {
  await getDictionary();
  return wordsByLengthCache?.get(length) ?? [];
}
