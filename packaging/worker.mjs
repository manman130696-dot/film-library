import {analyze,revise} from './inference.mjs';
// Download models with GET only; user frames never enter a network request.
const baseFetch=self.fetch.bind(self);
self.fetch=(resource,options)=>{
  const method=options?.method||(resource instanceof Request?resource.method:'GET');
  if(!['GET','HEAD'].includes(method.toUpperCase()))throw Error('本机分析禁止发送上传请求。');
  return baseFetch(resource,options);
};
let busy=false;
self.onmessage=async({data})=>{
  const {id,type,input}=data;
  if(busy)return;
  busy=true;
  const progress=message=>self.postMessage({id,type:'progress',message});
  try{const result=await(type==='revise'?revise(input,progress):analyze(input,progress));self.postMessage({id,type:'result',result});}
  catch(error){self.postMessage({id,type:'error',message:error?.message||'本机分析没有完成，请检查模型下载和浏览器支持后重试。'});}
  finally{busy=false;}
};
