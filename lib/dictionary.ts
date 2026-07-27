import { readFile } from 'node:fs/promises';
import path from 'node:path';
let cache:Set<string>|null=null;
export async function getDictionary(){if(cache)return cache;const raw=await readFile(path.join(process.cwd(),'data','ods.txt'),'utf8');cache=new Set(raw.split(/\r?\n/).map(w=>w.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()).filter(Boolean));return cache;}
