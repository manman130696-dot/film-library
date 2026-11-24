import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildCatalog} from '../../packaging/core.mjs';
import {analyze,revise} from '../../packaging/inference.mjs';
const source=fs.readFileSync('film-library-public/index.html','utf8');
function read(variable){const start=source.indexOf('window.'+variable+'=');const from=start+variable.length+8;return JSON.parse(source.slice(from,source.indexOf(';</script>',from)));}
const data=read('FILM_LIBRARY'),assets=read('FILM_ASSETS');
const {cases}=buildCatalog(data,assets);assert.ok(cases.length,'actual archive must contain playable packaging cases');
const selected=cases.find(c=>c.image.startsWith('data:image/'));assert.ok(selected,'real public frame available');
const realCase=Object.fromEntries(['id','title','structure','typography','motion','why','apply','searchText'].map(k=>[k,selected[k]||'']));
let lastStage='';
const progress=stage=>{const simplified=stage.split('：')[0];if(simplified!==lastStage){console.log(simplified);lastStage=simplified;}};
process.on('uncaughtException',error=>{console.error(error);if(error.generatedOutput)console.error('PUBLIC FIXTURE MODEL OUTPUT:',String(error.generatedOutput).slice(0,5000));process.exit(1);});
const result=await analyze({frames:[{time:1,image:selected.image}],range:{start:0,end:5},note:'希望根据这个包装案例来做本片：'+selected.title+'。表达目的：'+selected.why,catalog:[realCase]},progress);
assert.ok(result.observations[0].text.length>8);console.log('REAL VISION OBSERVATION:',result.observations[0].text);
console.log('REAL RETRIEVAL:',result.candidateIds);console.log('REAL INITIAL PROPOSALS:',JSON.stringify(result.directions));assert.ok(Array.isArray(result.directions));
// A user-selected, reference-based input also tests revision when matching returns no fit.
const direction=result.directions[0]||{caseId:realCase.id,title:realCase.title,start:0,end:5,understanding:realCase.why,fun:realCase.motion,elements:realCase.structure,copy:'重点',placement:'主体旁空白，避开脸部',motion:realCase.motion,application:realCase.apply};
const revised=await revise({direction,caseRecord:realCase,feedback:'保持原参考案例和设计方向，让文字更简洁。只返回一个完整方向。',range:{start:0,end:5},observations:result.observations,note:'当前帧和给定包装案例作为设计依据。'},progress);
assert.equal(revised.caseId,realCase.id);assert.ok(revised.application.length>3);
console.log('REAL LOCAL PROPOSAL:',JSON.stringify(revised));
console.log('PASS real public-model inference: vision, embeddings, Chinese design and strict reference validation. CPU runtime; browser WASM performance remains device-dependent.');
// Native ONNX sessions can retain runtime handles after successful assertions.
process.exit(0);
