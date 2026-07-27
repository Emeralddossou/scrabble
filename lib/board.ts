import type { Multiplier } from './types';
const key=(r:number,c:number)=>`${r}:${c}`;
const symmetric=(pairs:Array<[number,number]>)=>{const out=new Set<string>();for(const[r,c]of pairs){[[r,c],[r,14-c],[14-r,c],[14-r,14-c],[c,r],[c,14-r],[14-c,r],[14-c,14-r]].forEach(([a,b])=>out.add(key(a,b)));}return out;};
const TW=symmetric([[0,0],[0,7]]);const DW=symmetric([[1,1],[2,2],[3,3],[4,4]]);const TL=symmetric([[1,5],[5,5],[5,1]]);const DL=symmetric([[0,3],[2,6],[3,7],[6,6],[6,2]]);
export function multiplierAt(row:number,col:number):Multiplier{if(row===7&&col===7)return'ST';const k=key(row,col);if(TW.has(k))return'TW';if(DW.has(k))return'DW';if(TL.has(k))return'TL';if(DL.has(k))return'DL';return null;}
