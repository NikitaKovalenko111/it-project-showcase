import test from 'node:test'
import assert from 'node:assert/strict'
import {loadTs} from './load-ts.mjs'
const {studentProjectsReducer:reducer}=await import(await loadTs(new URL('../src/store/reducers/studentProjectsReducer.ts',import.meta.url)))
test('pending like is scoped to its project and clears on success or failure',()=>{
 let state=reducer(undefined,{type:'init'})
 state=reducer(state,{type:'studentProjects/LIKE_STUDENT_PROJECT_REQUEST',payload:{id:'a'}})
 state=reducer(state,{type:'studentProjects/LIKE_STUDENT_PROJECT_REQUEST',payload:{id:'b'}})
 assert.deepEqual(state.pendingLikes,['a','b']);assert.equal(state.loading,false)
 state=reducer(state,{type:'studentProjects/LIKE_STUDENT_PROJECT_SUCCESS',payload:{project:{id:'a',likesCount:1,likedByMe:true}}})
 assert.deepEqual(state.pendingLikes,['b'])
 state=reducer(state,{type:'studentProjects/LIKE_STUDENT_PROJECT_FAILURE',payload:{id:'b',error:'Ошибка'}})
 assert.deepEqual(state.pendingLikes,[])
})
