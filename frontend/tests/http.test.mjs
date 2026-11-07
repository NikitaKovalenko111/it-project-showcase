import test from 'node:test'
import assert from 'node:assert/strict'
import {AxiosError} from 'axios'
import {loadTs} from './load-ts.mjs'
const {createHttpClient}=await import(await loadTs(new URL('../src/api/httpClient.ts',import.meta.url)))
function setup(status=401){let token='old',refreshes=0,clears=0;const client=createHttpClient({baseURL:'/api/v1',timeoutMs:100,tokenStore:{get:()=>token,set:v=>token=v,clear:()=>{clears++;token=null}},getRefreshToken:()=> 'refresh',saveRefreshToken:()=>{},onUnauthorized:()=>{},refreshTokens:async()=>{refreshes++;await Promise.resolve();return {access_token:'new',refresh_token:'rotated'}}});client.defaults.adapter=async config=>{const response={status,statusText:'Error',headers:{},data:{error:{message:'Denied'}},config};if(config.headers.Authorization==='Bearer new')return {...response,status:200,data:{ok:true}};throw new AxiosError('Denied','ERR_BAD_REQUEST',config,undefined,response)};return {client,counts:()=>({refreshes,clears})}}
test('parallel expired requests share one refresh, including auth/me',async()=>{const {client,counts}=setup();const responses=await Promise.all([client.get('/auth/me'),client.get('/cases')]);assert.ok(responses.every(r=>r.data.ok));assert.deepEqual(counts(),{refreshes:1,clears:0})})
test('permission failure never rotates tokens',async()=>{const {client,counts}=setup(403);await assert.rejects(()=>client.get('/users'),/Denied/);assert.deepEqual(counts(),{refreshes:0,clears:0})})
test('wrong login password does not refresh an unrelated session',async()=>{const {client,counts}=setup();await assert.rejects(()=>client.post('/auth/login',{}),/Denied/);assert.deepEqual(counts(),{refreshes:0,clears:0})})
