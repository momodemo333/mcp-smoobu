import { expect, it, vi } from "vitest";
import { SmoobuClient } from "../src/smoobu-client.js";
import { listReservationMessages, listThreads } from "../src/tools/messages.js";
import { listGuests } from "../src/tools/guests.js";
import { listReservations } from "../src/tools/reservations.js";
import { getCustomPlaceholder } from "../src/tools/placeholders.js";
const options={apiKey:"fake-key",apiSecret:"fake-secret",baseUrl:"https://example.invalid",allowWrites:true};
it.each(["", "{}", "null", '{"success":false}'])("rejects ambiguous rates confirmation %s without retry", async body=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(body));
 expect(await new SmoobuClient({...options,fetch:fetcher}).mutate("POST","/api/rates",{})).toMatchObject({code:"INVALID_RESPONSE",message:expect.stringContaining("unknown")});expect(fetcher).toHaveBeenCalledTimes(1);
});
it("rejects undocumented mutation 204",async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(null,{status:204}));expect(await new SmoobuClient({...options,fetch:fetcher}).mutate("DELETE","/api/reservations/1")).toMatchObject({code:"INVALID_RESPONSE"});expect(fetcher).toHaveBeenCalledTimes(1);});
it.each([
 ["POST","/api/rates",{success:true}], ["DELETE","/api/reservations/1",{success:true}], ["POST","/api/reservations",{id:42}],
 ["PUT","/api/reservations/1",{status:200,title:"Resource updated successfully",detail:""}],
 ["POST","/api/reservations/1/price-elements",{status:201,title:"Resource created successfully",detail:{id:42}}],
 ["POST","/api/reservations/1/price-elements/2",{status:200,title:"Resource updated successfully",detail:""}],
 ["DELETE","/api/reservations/1/price-elements/2",{status:200,title:"Resource deleted successfully",detail:""}],
 ["POST","/api/reservations/1/messages/send-message-to-guest",{status:201,title:"Resource created successfully",detail:""}],
] as const)("requires documented %s %s confirmation",async(method,path,body)=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(body))).mockResolvedValueOnce(new Response("{}"));const client=new SmoobuClient({...options,fetch:fetcher});expect(await client.mutate(method,path,{})).toEqual(body);expect(await client.mutate(method,path,{})).toMatchObject({code:"INVALID_RESPONSE"});expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([listReservationMessages,listThreads,listGuests,listReservations])("rejects missing list metadata instead of claiming no results",async handler=>{
 for(const value of [{},null,{messages:[],threads:[],guests:[],bookings:[]},{page:1,page_size:25,page_count:0,total_items:0}]){
  const client={request:vi.fn().mockResolvedValue(value)} as unknown as SmoobuClient;
  expect(await handler(client,{reservationId:1})).toMatchObject({code:"INVALID_RESPONSE"});
 }
});
it("preserves genuine empty page with required metadata",async()=>{
 const client={request:vi.fn().mockResolvedValue({page:1,page_size:25,page_count:0,total_items:0,messages:[]})} as unknown as SmoobuClient;
 expect(await listReservationMessages(client,{reservationId:1})).toMatchObject({messages:[],nextPage:null,totalItems:0});
});
it("flattens documented translations envelope and forwards the same signal twice",async()=>{
 const controller=new AbortController();const request=vi.fn().mockResolvedValueOnce({id:1,key:"test"}).mockResolvedValueOnce({translations:[{id:2,locale:"fr",value:"bonjour"}]});
 expect(await getCustomPlaceholder({request} as unknown as SmoobuClient,{customPlaceholderId:1},controller.signal)).toMatchObject({translations:[{id:2,locale:"fr",value:"bonjour"}]});
 expect(request).toHaveBeenNthCalledWith(1,"/api/custom-placeholders/1",undefined,controller.signal);expect(request).toHaveBeenNthCalledWith(2,"/api/custom-placeholders/1/translations",undefined,controller.signal);
});
