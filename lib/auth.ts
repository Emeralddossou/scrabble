import { cookies } from 'next/headers';
import { SignJWT,jwtVerify } from 'jose';
import { randomBytes,scrypt as scryptCb,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { SessionUser } from './types';
const scrypt=promisify(scryptCb),COOKIE='scrabble_session';
const secret=()=>new TextEncoder().encode(process.env.AUTH_SECRET??'development-only-change-this-secret-now');
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return`${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){const[salt,hex]=stored.split(':');if(!salt||!hex)return false;const key=await scrypt(password,salt,64) as Buffer,expected=Buffer.from(hex,'hex');return key.length===expected.length&&timingSafeEqual(key,expected);}
export function validatePassword(p:string){return p.length>=10&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p)&&/[^A-Za-z0-9]/.test(p);}
export async function createSession(user:SessionUser){const token=await new SignJWT(user).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('7d').sign(secret());(await cookies()).set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:604800});}
export async function clearSession(){(await cookies()).delete(COOKIE);}
export async function currentUser():Promise<SessionUser|null>{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;try{const{payload}=await jwtVerify(token,secret());return{id:Number(payload.id),username:String(payload.username)};}catch{return null;}}
