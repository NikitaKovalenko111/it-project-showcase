import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTs } from './load-ts.mjs'
const {toCase,fromCase,fromUser,collectPages}=await import(await loadTs(new URL('../src/api/backend.ts',import.meta.url)))
test('backend DTO maps criterion maximum, auth roles and dates',()=>{
 const project=fromCase({case_id:'c',company_id:'co',title:'Example',summary:'Short',full_brief:'Brief',work_format:'remote',participation_mode:'team',status:'published',due_at:'2027-01-02T12:00:00Z',evaluation_criteria:[{criterion_id:'q',name:'Quality',max_score:25}],type:'contest'})
 assert.equal(project.deadlineDate,'2027-01-02');assert.equal(project.status,'open')
 const dto=toCase(project);assert.deepEqual(dto.evaluation_criteria,[{name:'Quality',max_score:25,ordinal:1}]);assert.equal(dto.company_id,'co');assert.equal(dto.work_format,'remote');assert.ok(!('weight' in dto.evaluation_criteria[0]))
 assert.equal(fromUser({user_id:'u',roles:['student','admin'],username:'a',status:'blocked'}).role,'admin')
})
test('cursor lists collect every page and reject repeated cursor',async()=>{
 let calls=0
 const items=await collectPages(async params=>({data:++calls===1?{items:[1],meta:{has_more:true,next_cursor:'next'}}:{items:[2],meta:{has_more:false}}}))
 assert.deepEqual(items,[1,2]);assert.equal(calls,2)
 await assert.rejects(()=>collectPages(async()=>({data:{items:[],meta:{has_more:true,next_cursor:'same'}}})),/курсор/)
})
const {evaluationTotal}=await import(await loadTs(new URL('../src/utils/evaluation.ts',import.meta.url)))
test('new criteria sum individual maxima without weights',()=>{assert.equal(evaluationTotal([{id:'a',maxScore:25,weight:100},{id:'b',maxScore:5,weight:1}],{a:100,b:3}),28)})

test('server roles and moderation map without exposing unpublished cases',()=>{
 assert.equal(fromUser({roles:['company_representative'],user_id:'co'}).role,'company')
 assert.equal(fromUser({roles:['university_staff'],user_id:'staff'}).role,'curator')
 const draft=fromCase({case_id:'draft',status:'draft',evaluation_criteria:[]})
 assert.equal(draft.isModerated,false);assert.equal(draft.moderationStatus,'pending')
})
const {collectNumbered}=await import(await loadTs(new URL('../src/api/backend.ts',import.meta.url)))
test('page lists collect more than one hundred items',async()=>{
 const rows=await collectNumbered(async({page})=>({data:{items:page===1?Array.from({length:100},(_,i)=>i):[100],meta:{total:101}}}))
 assert.equal(rows.length,101);assert.equal(rows[100],100)
})
const {formatDate}=await import(await loadTs(new URL('../src/utils/date.ts',import.meta.url)))
test('nullable server deadlines do not display Invalid Date',()=>{assert.equal(formatDate(null),'Не указан');assert.equal(formatDate('invalid'),'Не указан')})
