import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizeWord } from '@/domain/scrabble/rules';

let dictionaryCache: Set<string> | undefined;
let wordsByLengthCache: Map<number, string[]> | undefined;

export async function getDictionary(): Promise<ReadonlySet<string>> {
  if (dictionaryCache) return dictionaryCache;
  const dictionaryPath = path.join(process.cwd(), 'data', 'ods.txt');
  let content: string;
  try {
    content = await readFile(dictionaryPath, 'utf8');
  } catch {
    throw new Error(`Dictionnaire ODS introuvable : ${dictionaryPath}`);
  }
  const words = content
    .split(/\r?\n/)
    .map((word) => normalizeWord(word.trim()))
    .filter(Boolean);
  if (words.length < 1000) throw new Error('Le dictionnaire ODS est invalide ou incomplet.');
  dictionaryCache = new Set(words);
  wordsByLengthCache = words.reduce((index, word) => {
    const list = index.get(word.length) ?? [];
    list.push(word);
    index.set(word.length, list);
    return index;
  }, new Map<number, string[]>());
  return dictionaryCache;
}

export async function wordsByLength(length: number): Promise<readonly string[]> {
  await getDictionary();
  return wordsByLengthCache?.get(length) ?? [];
}
