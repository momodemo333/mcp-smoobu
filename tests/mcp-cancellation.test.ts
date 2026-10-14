import { expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
it("MCP cancellation during shared quota wait prevents a later mutation POST",async()=>{
 let mutations=0;let rateLimited!:()=>void;const seen429=new Promise<void>(resolve=>rateLimited=resolve);
 const api=createServer((req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.method==="POST") {mutations++;res.end(JSON.stringify({success:true}));}
  else {res.statusCode=429;res.setHeader("Retry-After","1");res.end('{}');rateLimited();}
 });
 await new Promise<void>(resolve=>api.listen(0,"127.0.0.1",resolve));
 const client=new Client({name:"cancel-regression",version:"1"});
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve(".staging/modernisation-2026-10-14/index.js")],env:{PATH:process.env.PATH??"",SMOOBU_API_KEY:"fake-key",SMOOBU_API_SECRET:"fake-secret",SMOOBU_ALLOW_WRITES:"true",SMOOBU_WRITE_CATEGORIES:"rates",SMOOBU_API_URL:"http://127.0.0.1:"+(api.address() as AddressInfo).port},stderr:"pipe"}));
  const readController=new AbortController();const reading=client.callTool({name:"get_user",arguments:{}},undefined,{signal:readController.signal}).catch(()=>null);
  await seen429;await sleep(50);readController.abort();await reading;
  const controller=new AbortController();const writing=client.callTool({name:"update_rates",arguments:{apartments:[1],operations:[{dates:["2026-12-01"],daily_price:1}]}},undefined,{signal:controller.signal});
  const rejected=expect(writing).rejects.toBeDefined();await sleep(100);controller.abort();await rejected;
  await sleep(1200);expect(mutations).toBe(0);
 }finally{await client.close();await new Promise<void>(resolve=>api.close(()=>resolve()));}
});
