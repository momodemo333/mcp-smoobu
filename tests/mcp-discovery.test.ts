import { afterAll, beforeAll, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
const api = createServer((req,res)=>{
  calls.push({method:req.method,path:req.url});res.setHeader("Content-Type","application/json");
  if(req.url==="/api/me")res.end(JSON.stringify({id:42}));
  else if(req.url==="/booking/checkApartmentAvailability"){let body="";req.on("data",chunk=>body+=chunk);req.on("end",()=>{bodies.push(JSON.parse(body));res.end(JSON.stringify({availableApartments:[1]}));});}
  else {res.statusCode=500;res.end(JSON.stringify({detail:"not a fixture"}));}
});
const calls: Array<{method?:string;path?:string}> = [];const bodies: unknown[]=[];
let client: Client;
beforeAll(async()=>{
  await new Promise<void>(resolve=>api.listen(0,"127.0.0.1",resolve));
  const port=(api.address() as AddressInfo).port;
  client=new Client({name:"local-contract-test",version:"1"});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve(".staging/modernisation-2026-10-14/index.js")],env:{PATH:process.env.PATH ?? "",SMOOBU_API_KEY:"fake-test-key",SMOOBU_API_SECRET:"fake-test-secret",SMOOBU_API_URL:"http://127.0.0.1:"+port,SMOOBU_ALLOW_WRITES:"false"},stderr:"pipe"}));
});
afterAll(async()=>{await client?.close();await new Promise<void>(resolve=>api.close(()=>resolve()));});
it("discovers 29 tools, excludes undocumented tools, exposes strict rates schema",async()=>{
  const result=await client.listTools();expect(result.tools).toHaveLength(29);
  const names=result.tools.map(t=>t.name);expect(names).toContain("get_webhook");expect(names).toContain("preview_rates");expect(names).not.toContain("create_guest");expect(names).not.toContain("list_online_check_ins");
  const rates=result.tools.find(t=>t.name==="update_rates")!;expect(rates.inputSchema.required).toEqual(expect.arrayContaining(["apartments","operations"]));expect(JSON.stringify(rates.inputSchema)).not.toContain("priceItems");expect(rates.annotations?.destructiveHint).toBe(true);
});
it("returns MCP isError for invalid schema, permissions and unknown tools",async()=>{
  const before=calls.length;
  expect((await client.callTool({name:"update_rates",arguments:{apartments:[{id:1,priceItems:[]}]}})).isError).toBe(true);
  expect((await client.callTool({name:"update_rates",arguments:{apartments:[1],operations:[{dates:["2026-12-01"],daily_price:1}]}})).isError).toBe(true);
  expect((await client.callTool({name:"create_guest",arguments:{firstName:"test"}})).isError).toBe(true);
  expect((await client.callTool({name:"send_reservation_message",arguments:{reservationId:1,body:"hello",templateId:3}})).isError).toBe(true);
  expect(calls).toHaveLength(before);
});
it("preview and diagnostics are pure; availability reads use account id in read-only mode",async()=>{
  const before=calls.length;
  expect((await client.callTool({name:"preview_rates",arguments:{apartments:[1],operations:[{dates:["2026-12-01"],daily_price:1}]}})).isError).not.toBe(true);
  const diagnostic=await client.callTool({name:"get_capabilities",arguments:{}});expect(JSON.stringify(diagnostic)).not.toContain("fake-test");expect(calls).toHaveLength(before);
  const result=await client.callTool({name:"check_apartment_availability",arguments:{apartmentId:1,arrivalDate:"2026-12-01",departureDate:"2026-12-02"}});expect(result.isError).not.toBe(true);expect(calls.slice(before)).toEqual([{method:"GET",path:"/api/me"},{method:"POST",path:"/booking/checkApartmentAvailability"}]);expect(bodies).toEqual([{arrivalDate:"2026-12-01",departureDate:"2026-12-02",apartments:[1],customerId:42}]);
});
