import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog, validateDirections, Session, makePrompt, rankVectors, toLocalImageBlob } from '../packaging/core.mjs';

const example = { id:'real', videoId:'film', start:2, end:4, title:'重点花字', tags:['包装'], structure:'文字位于人物右侧', motion:'文字逐字出现', why:'突出当前重点', apply:'用短词标记重点' };
const proposal = { caseId:'real', title:'逐字重点提示', start:1, end:3, understanding:'把需要观众记住的重点变成可读文字', fun:'让短词随主体动作轻微弹出', elements:'短词与小型引导线', placement:'主体旁边空白处，避开脸部', motion:'依次出现，停留读清后淡出', application:'根据画面空白安排短词并保持主体清晰' };
test('only playable packaging references are admitted',()=>{
 const data={videos:[{id:'film',title:'测试作品',preview:'preview.mp4',previewDuration:10}],cases:[example,{...example,id:'past',end:12},{...example,id:'broll',tags:['B镜'],title:'轮子特写',motion:'镜头跟随轮子'},{...example,id:'bad',start:-1}]};
 const out=buildCatalog(data,{});
 assert.deepEqual(out.cases.map(c=>c.id),['real']);
 assert.equal(out.unavailable,2);
});
test('model output cannot fabricate or duplicate case references',()=>{
 assert.throws(()=>validateDirections(JSON.stringify({directions:[{...proposal,caseId:'invented'}]}),[example],{start:0,end:5}),/案例/);
 assert.throws(()=>validateDirections(JSON.stringify({directions:[proposal,proposal]}),[example],{start:0,end:5}),/重复/);
 assert.throws(()=>validateDirections(JSON.stringify({directions:[{...proposal,end:50}]}),[example],{start:0,end:5}),/范围/);
});
test('zero suitable proposals remains zero, malformed output is an error',()=>{
 assert.deepEqual(validateDirections('{"directions":[]}',[example],{start:0,end:5}),[]);
 assert.throws(()=>validateDirections('cannot run',[example],{start:0,end:5}),/格式/);
 assert.equal(validateDirections('```json\n'+JSON.stringify({directions:[proposal]})+'\n```',[example],{start:0,end:5})[0].caseId,'real');
});
test('confirmation belongs to the exact selected revision',()=>{
 const s=new Session();
 s.setDirections([proposal,{...proposal,caseId:'other'}]);
 assert.throws(()=>s.confirm(),/选择/);
 s.select(0);s.confirm();assert.equal(s.isConfirmed(),true);
 s.edit({elements:'圆形标注'});assert.equal(s.isConfirmed(),false);
 s.confirm();s.select(1);assert.equal(s.isConfirmed(),false);
 s.reset();assert.equal(s.selected,null);assert.equal(s.directions.length,0);
});
test('final prompt preserves exact user text and selected case, excludes sound',()=>{
 const text=makePrompt({...proposal,copy:'<重点>原样保留'},example,'图生视频');
 assert.ok(text.includes('<重点>原样保留'));
 assert.ok(text.includes('重点花字'));
 assert.ok(text.includes('图生视频'));
 assert.ok(text.includes('不生成声音'));
 assert.ok(!text.includes('配乐建议'));
});
test('semantic ranking is based on actual vectors, not a fixed result list',()=>{
 const out=rankVectors([1,0],[[0,1],[1,0],[0.5,0.5]]);
 assert.deepEqual(out.map(x=>x.index),[1,2,0]);
});
test('frame decoding stays local and rejects network addresses',async()=>{
 const blob=toLocalImageBlob('data:image/jpeg;base64,AQID');
 assert.equal(blob.type,'image/jpeg');assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[1,2,3]);
 assert.throws(()=>toLocalImageBlob('https://example.com/private-frame.jpg'),/本机/);
});
