import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SmoobuClient } from "../src/smoobu-client.js";
import { previewRates, updateRates, listRates, checkApartmentAvailability } from "../src/tools/rates.js";
import { listReservationMessages, listThreads, htmlToText, sendReservationMessage } from "../src/tools/messages.js";
import { listGuests } from "../src/tools/guests.js";
import { listAddons } from "../src/tools/addons.js";
import { listWebhooks, getWebhook } from "../src/tools/webhooks.js";
import { getPriceElement } from "../src/tools/price-elements.js";
import { updateReservation, listReservations } from "../src/tools/reservations.js";
import { validateDate, validateTimeFormat, validatePositiveInt, validateNonNegativeNumber } from "../src/validation.js";
const request = vi.fn(); const mutate = vi.fn(); const checkAvailability = vi.fn();
const client = {request,mutate,checkAvailability} as unknown as SmoobuClient;
beforeEach(()=>{vi.resetAllMocks(); request.mockResolvedValue({}); mutate.mockResolvedValue({success:true});});
const plan = { apartments:[1,2], operations:[{dates:["2026-12-01:2026-12-03", "2026-12-05"], daily_price:120, min_length_of_stay:2}] };
describe("documented rates contract",()=>{
  it("previews without any network and posts exact payload",async()=>{
    expect(previewRates(plan)).toMatchObject({method:"POST",payload:plan,affectedDaysPerApartment:4}); expect(request).not.toHaveBeenCalled(); expect(mutate).not.toHaveBeenCalled();
    await updateRates(client,plan); expect(mutate).toHaveBeenCalledWith("POST","/api/rates",plan);
  });
  it.each([
    {}, {apartments:[],operations:plan.operations}, {apartments:[true],operations:plan.operations}, {apartments:[1,1],operations:plan.operations},
    {apartments:[{id:1,priceItems:[{date:"2026-12-01",price:1}]}]}, {apartments:[1],operations:[]},
    {apartments:[1],operations:[{dates:["2026-02-29"],daily_price:1}]}, {apartments:[1],operations:[{dates:["2026-12-03:2026-12-01"],daily_price:1}]},
    {apartments:[1],operations:[{dates:["2026-12-01"],available:1}]}, {apartments:[1],operations:[{dates:["2026-12-01"],daily_price:Infinity}]},
    {apartments:[1],operations:[{dates:["2026-12-01"]}]}, {apartments:[1],operations:[{dates:["2026-12-01"],min_length_of_stay:0}]},
    {apartments:[1],operations:[{dates:["2026-12-01:2026-12-03","2026-12-02"],daily_price:1}]},
  ])("rejects invalid/legacy input without network %#",async params=>{
    expect(await updateRates(client,params)).toMatchObject({code:"VALIDATION_ERROR"}); expect(mutate).not.toHaveBeenCalled();
  });
  it("permits minimum only with explicit warning",()=>{expect(previewRates({apartments:[1],operations:[{dates:["2026-12-01"],min_length_of_stay:2}]})).toHaveProperty("warnings");});
  it("requires rate apartment IDs and preserves data envelope",async()=>{
    expect(await listRates(client,{startDate:"2026-12-01",endDate:"2026-12-03"})).toMatchObject({code:"VALIDATION_ERROR"});
    request.mockResolvedValue({data:{1:{"2026-12-01":{price:null,min_length_of_stay:null,available:0}}}});
    const result = await listRates(client,{startDate:"2026-12-01",endDate:"2026-12-03",apartments:[1]}); expect(result).toHaveProperty("data"); expect(request).toHaveBeenCalledWith("/api/rates",{start_date:"2026-12-01",end_date:"2026-12-03",apartments:[1]});
  });
  it("resolves real customer id; fails closed on invalid user",async()=>{
    request.mockResolvedValueOnce({id:42}); await checkApartmentAvailability(client,{apartmentId:1,arrivalDate:"2026-12-01",departureDate:"2026-12-03"}); expect(checkAvailability).toHaveBeenCalledWith({customerId:42,apartments:[1],arrivalDate:"2026-12-01",departureDate:"2026-12-03"});
    request.mockResolvedValueOnce({id:0}); expect(await checkApartmentAvailability(client,{apartmentId:1,arrivalDate:"2026-12-01",departureDate:"2026-12-03"})).toMatchObject({code:"INVALID_RESPONSE"}); expect(checkAvailability).toHaveBeenCalledTimes(1);
  });
});
describe("messages and read contracts",()=>{
  it("supports both HTML aliases, numeric direction, next page and false filter",async()=>{
    request.mockResolvedValue({page:1,page_count:2,page_size:25,total_items:26,messages:[{id:1,subject:"hi",message:"",messageHtml:"<p>Hello &amp; bye</p><script>bad()</script>",type:1},{id:2,htmlMessage:"<b>Alias</b>",type:2}]});
    const result = await listReservationMessages(client,{reservationId:1,onlyRelatedToGuest:false}); expect(request).toHaveBeenCalledWith("/api/reservations/1/messages",{page:1,onlyRelatedToGuest:false}); expect(result).toMatchObject({nextPage:2,messages:[{message:"Hello & bye",type:1,contentSource:"html-fallback"},{message:"Alias",type:2}]});
  });
  it("caps content explicitly, defaults thread page size, preserves unread aggregate",async()=>{
    request.mockResolvedValue({page_number:1,page_size:25,page_count:1,total_threads:1,unread_messages:99,threads:[{booking:{id:1,guest_name:"Guest"},apartment:{id:2,name:"House"},latest_message:{id:3,text_content:"x".repeat(150),html_content:"",created_at:"date"}}]});
    expect(await listThreads(client,{maxContentChars:100})).toMatchObject({unreadMessages:99,nextPage:null,threads:[{latestMessage:{textContent:"x".repeat(100),contentTruncated:true,originalContentLength:150}}]}); expect(request).toHaveBeenCalledWith("/api/threads",{page_number:1,page_size:25});
  });
  it("does not throw on invalid HTML code points",()=>{expect(htmlToText("<style>bad</style>&#x110000; &#128512;")).toBe("� 😀");});
  it("rejects undocumented template id and allows omitted subject",async()=>{
    expect(await sendReservationMessage(client,{reservationId:1,body:"hello",templateId:1})).toMatchObject({code:"VALIDATION_ERROR"}); expect(mutate).not.toHaveBeenCalled();
    await sendReservationMessage(client,{reservationId:1,body:"hello"}); expect(mutate).toHaveBeenCalledWith("POST","/api/reservations/1/messages/send-message-to-guest",{messageBody:"hello"});
  });
  it("uses documented guest pagination casing",async()=>{request.mockResolvedValue({pageCount:3,pageSize:25,totalItems:51,page:2,guests:[]});expect(await listGuests(client,{page:2})).toMatchObject({totalItems:51,pageCount:3});expect(request).toHaveBeenCalledWith("/api/guests",{page:2,pageSize:25});});
  it("uses addon path, price-element detail and key-visible webhook paths",async()=>{
    await listAddons(client,{apartmentId:2});expect(request).toHaveBeenLastCalledWith("/api/addons/2");
    await getPriceElement(client,{reservationId:1,elementId:2});expect(request).toHaveBeenLastCalledWith("/api/reservations/1/price-elements/2");
    request.mockResolvedValueOnce({webhooks:[{id:1,webhookUrl:"https://user:pass@hooks.example/secret?token=secret",createdAt:"now"}]});
    const result=await listWebhooks(client);expect(JSON.stringify(result)).not.toMatch(/secret|pass|user:/);expect(result).toMatchObject({webhooks:[{callbackOrigin:"https://hooks.example"}]});
    request.mockResolvedValueOnce({id:1,webhookUrl:"https://hooks.example/path",createdAt:"now"});await getWebhook(client,{webhookId:1});expect(request).toHaveBeenLastCalledWith("/api/users/webhooks/1");
  });
  it("rejects unsupported booking edits and uses documented guest field names",async()=>{
    expect(await updateReservation(client,{reservationId:1,arrivalDate:"2026-12-01"})).toMatchObject({code:"VALIDATION_ERROR"});expect(await updateReservation(client,{reservationId:1,email:"a@b.com"})).toMatchObject({code:"VALIDATION_ERROR"});expect(mutate).not.toHaveBeenCalled();await updateReservation(client,{reservationId:1,guestEmail:"a@b.com"});expect(mutate).toHaveBeenCalledWith("PUT","/api/reservations/1",{guestEmail:"a@b.com"});
  });
  it("retains requested related and price fields",async()=>{
    request.mockResolvedValue({page:1,page_count:1,page_size:25,total_items:1,bookings:[{id:1,apartment:{id:2,name:"House"},priceElements:[{id:3}],related:[4]}]});expect(await listReservations(client,{includePriceElements:true,includeRelated:true})).toMatchObject({bookings:[{priceElements:[{id:3}],related:[4]}]});
  });
});
describe("strict validation",()=>{
  it.each(["2026-02-29","2026-04-31","2026-13-01"])("rejects impossible date %s",v=>expect(validateDate(v,"date")).not.toBeNull());
  it.each(["24:00","12:60","99:99"])("rejects invalid time %s",v=>expect(validateTimeFormat(v,"time")).not.toBeNull());
  it.each([true,"1",NaN,Infinity,Number.MAX_SAFE_INTEGER+1])("rejects noninteger/coerced id %s",v=>expect(validatePositiveInt(v,"id")).not.toBeNull());
  it.each([true,"1",NaN,Infinity])("rejects invalid money %s",v=>expect(validateNonNegativeNumber(v,"price")).not.toBeNull());
});
