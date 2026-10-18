import { prisma } from "./prisma";

const r3=(v:number)=>Math.round((v+Number.EPSILON)*1000)/1000;
const n=(v:any)=>Number(v||0);
async function shop(){ const s=await prisma.shop.findFirst(); if(!s) throw new Error("Aucun commerce Saraya configuré."); return s; }
function since(days:number){ return new Date(Date.now()-Math.max(1,Math.min(365,days))*86400000); }

export const analyticsToolDefinitions:any[] = [
 {type:"function",function:{name:"get_last_shift",description:"Retourne les faits vérifiés détaillés du dernier shift enregistré: recette, caisse, ticket, ventes, stock physique, corrections et métriques. À utiliser pour une question factuelle sur le dernier shift.",parameters:{type:"object",properties:{},additionalProperties:false}}},
 {type:"function",function:{name:"analyse_last_shift_expert",description:"Analyse déterministe complète du dernier shift. Retourne dans un seul résultat toutes les données nécessaires à une analyse propriétaire: ventes détaillées et classements, consommations physiques, corrections classées, café, chicha, caisse/dépenses et ratios calculables. Utiliser pour les demandes larges comme analyse le dernier shift, que dois-je surveiller, qu'est-ce qui s'est passé.",parameters:{type:"object",properties:{},additionalProperties:false}}},
 {type:"function",function:{name:"analyse_sales",description:"Analyse déterministe des ventes sur une période: quantités et chiffre ticket par produit/catégorie.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},required:["days"],additionalProperties:false}}},
 {type:"function",function:{name:"analyse_stock",description:"Stock maître actuel et consommations physiques récentes. Ne déduit pas les causes d'un écart.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},required:["days"],additionalProperties:false}}},
 {type:"function",function:{name:"analyse_cafe",description:"Analyse déterministe café: cafés vendus et coffee beans consommés. Permet de comparer activité/consommation.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},required:["days"],additionalProperties:false}}},
 {type:"function",function:{name:"analyse_chicha",description:"Analyse déterministe chicha: normales, personnel et tombac consommé.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},required:["days"],additionalProperties:false}}},
 {type:"function",function:{name:"analyse_consumption",description:"Analyse les consommations physiques et corrections enregistrées; utile pour écarts de stock et articles à surveiller.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:365}},required:["days"],additionalProperties:false}}},
 {type:"function",function:{name:"compare_periods",description:"Compare deux périodes consécutives de même durée sur recettes, ticket, corrections, ventes café et chicha. La période récente est comparée à la période précédente.",parameters:{type:"object",properties:{days:{type:"integer",minimum:1,maximum:180}},required:["days"],additionalProperties:false}}}
];

export async function executeAnalyticsTool(name:string,args:any={}){
 const s=await shop(); const days=Math.max(1,Math.min(365,Number(args.days||7))); const start=since(days);
 if(name==="get_last_shift"){
  const x=await prisma.shift.findFirst({where:{shopId:s.id,status:"RECORDED"},orderBy:{recordedAt:"desc"},include:{worker:true,corrections:true,metrics:true,saleLines:true,stockLines:true}});
  if(!x) return {found:false};
  const metrics=Object.fromEntries(x.metrics.map(m=>[m.metricCode,{value:n(m.value),unit:m.unit}]));
  return {found:true,id:x.id,recordedAt:(x.recordedAt||x.closedAt).toISOString(),worker:x.worker?.name||null,recetteFinale:n(x.recetteFinale),cashCaisse:n(x.cashCaisse),ticketTotal:n(x.ticketTotal),correctionsRetenues:n(x.acceptedCorrectionTotal),depenses:n(x.expenseTotal),staffSalaire:n(x.staffSalary),ramiGames:n(x.ramiGames),sales:x.saleLines.map(l=>({category:l.category,product:l.normalizedProductName||l.rawProductName,quantity:l.quantity,total:n(l.lineTotal)})),stock:x.stockLines.map(l=>({item:l.normalizedItemName||l.rawItemName,start:l.startQty,ajout:l.addedQty,fin:l.endQty,consumed:l.consumedQty,unit:l.unit})),corrections:x.corrections.map(c=>({code:c.correctionCode,expected:c.expectedQty,actual:c.actualConsumedQty,difference:c.differenceQty,amount:n(c.acceptedAmount),decision:c.decision})),metrics};
 }
 if(name==="analyse_last_shift_expert"){
  const x=await prisma.shift.findFirst({where:{shopId:s.id,status:"RECORDED"},orderBy:{recordedAt:"desc"},include:{worker:true,corrections:{include:{item:true}},metrics:true,saleLines:true,stockLines:true,expenses:true}});
  if(!x) return {found:false};
  const metric=(code:string)=>r3(x.metrics.filter(m=>m.metricCode===code).reduce((a,m)=>a+n(m.value),0));
  const coffeeSold=metric("COFFEE_SOLD"), beans=metric("COFFEE_BEANS_CONSUMED");
  const chichaNormal=metric("CHICHA_NORMAL"), chichaPersonnel=metric("CHICHA_PERSONNEL"), tombac=metric("TOMBAC_CONSUMED");
  const sales=x.saleLines.map(l=>({category:l.category,product:l.normalizedProductName||l.rawProductName,quantity:r3(l.quantity),unitPrice:l.unitPrice==null?null:n(l.unitPrice),total:l.lineTotal==null?null:r3(n(l.lineTotal))}));
  const byQuantity=[...sales].sort((a,b)=>b.quantity-a.quantity);
  const byRevenue=[...sales].filter(a=>a.total!=null).sort((a,b)=>(b.total||0)-(a.total||0));
  const corrections=x.corrections.map(c=>({item:c.item?.name||c.correctionCode,code:c.correctionCode,expected:c.expectedQty==null?null:r3(c.expectedQty),actual:c.actualConsumedQty==null?null:r3(c.actualConsumedQty),difference:c.differenceQty==null?null:r3(c.differenceQty),automaticAmount:r3(n(c.automaticAmount)),acceptedAmount:r3(n(c.acceptedAmount)),decision:c.decision})).sort((a,b)=>Math.abs(b.acceptedAmount)-Math.abs(a.acceptedAmount));
  const stock=x.stockLines.map(l=>({item:l.normalizedItemName||l.rawItemName,unit:l.unit,start:l.startQty,added:l.addedQty,end:l.endQty,consumed:l.consumedQty==null?null:r3(l.consumedQty)}));

  // V6.1: compare the latest shift with prior recorded shifts only. The backend computes
  // the reference and flags unusual ratios; OpenAI only interprets these trusted facts.
  const prior=await prisma.shift.findMany({
    where:{shopId:s.id,status:"RECORDED",id:{not:x.id}},
    orderBy:{recordedAt:"desc"},take:10,include:{metrics:true}
  });
  const priorRatio=(soldCode:string,consumedCode:string)=>{
    const ratios=prior.map(sh=>{
      const sold=sh.metrics.filter(m=>m.metricCode===soldCode).reduce((a,m)=>a+n(m.value),0);
      const consumed=sh.metrics.filter(m=>m.metricCode===consumedCode).reduce((a,m)=>a+n(m.value),0);
      return sold>0?consumed/sold:null;
    }).filter((v):v is number=>v!=null && Number.isFinite(v));
    return ratios.length?{shiftCount:ratios.length,average:r3(ratios.reduce((a,v)=>a+v,0)/ratios.length),min:r3(Math.min(...ratios)),max:r3(Math.max(...ratios))}:null;
  };
  const coffeeHistory=priorRatio("COFFEE_SOLD","COFFEE_BEANS_CONSUMED");
  const chichaHistory=priorRatio("CHICHA_NORMAL","TOMBAC_CONSUMED");
  const coffeeCurrent=coffeeSold>0?r3(beans/coffeeSold):null;
  const chichaCurrent=chichaNormal>0?r3(tombac/chichaNormal):null;
  const anomaly=(label:string,current:number|null,ref:any)=>{
    if(current==null||!ref||ref.shiftCount<2||ref.average<=0) return null;
    const multiple=r3(current/ref.average), percent=r3((current-ref.average)/ref.average*100);
    // No arbitrary business threshold: outside the actually observed prior range is factual.
    if(current>ref.max||current<ref.min) return {metric:label,current,historicalAverage:ref.average,historicalMin:ref.min,historicalMax:ref.max,comparisonMultiple:multiple,percentVsAverage:percent,reason:"hors de la plage observée des shifts précédents"};
    return null;
  };
  const anomalies=[anomaly("gramsPerCoffee",coffeeCurrent,coffeeHistory),anomaly("gramsPerNormalChicha",chichaCurrent,chichaHistory)].filter(Boolean);
  return {
    found:true, scope:"single_last_recorded_shift", shiftId:x.id, recordedAt:(x.recordedAt||x.closedAt).toISOString(), worker:x.worker?.name||null,
    finance:{recetteFinale:r3(n(x.recetteFinale)),cashCaisse:r3(n(x.cashCaisse)),ramiGames:r3(n(x.ramiGames)),ramiValue:r3(n(x.ramiValue)),ticketTotal:r3(n(x.ticketTotal)),acceptedCorrections:r3(n(x.acceptedCorrectionTotal)),expenses:r3(n(x.expenseTotal)),staffSalary:r3(n(x.staffSalary))},
    sales:{lines:sales,totalArticles:r3(sales.reduce((a,v)=>a+v.quantity,0)),ticketRevenue:r3(sales.reduce((a,v)=>a+(v.total||0),0)),topByQuantity:byQuantity.slice(0,5),topByRevenue:byRevenue.slice(0,5)},
    stock:{lines:stock,largestPhysicalConsumption:[...stock].filter(v=>v.consumed!=null).sort((a,b)=>Math.abs(b.consumed||0)-Math.abs(a.consumed||0)).slice(0,8)},
    corrections:{lines:corrections,totalAccepted:r3(corrections.reduce((a,v)=>a+v.acceptedAmount,0)),largest:corrections.slice(0,5)},
    cafe:{sold:coffeeSold,beansConsumed:beans,beansUnit:"g",gramsPerCoffee:coffeeCurrent},
    chicha:{normal:chichaNormal,personnel:chichaPersonnel,total:r3(chichaNormal+chichaPersonnel),tombacConsumed:tombac,tombacUnit:"g",gramsPerNormalChicha:chichaCurrent},
    historicalReference:{priorRecordedShifts:prior.length,coffeeGramsPerCoffee:coffeeHistory,chichaGramsPerNormalChicha:chichaHistory},
    anomalies,
    missingBusinessData:["coûts matière / coûts d'achat","marges par produit","données de fréquentation/occupation","horaires de vente détaillés si non enregistrés"],
    interpretationRules:["Les corrections ne sont pas du chiffre d'affaires ticket.","Un écart ne prouve pas sa cause: signaler ce qui mérite vérification sans accuser ni inventer.","Comparer séparément volume vendu, consommation physique, ticket et recette finale."]
  };
 }
 if(name==="analyse_stock"){
  const [items,moves]=await Promise.all([prisma.item.findMany({where:{archivedAt:null},orderBy:{name:"asc"}}),prisma.stockMovement.findMany({where:{source:"RECETTE",createdAt:{gte:start}},include:{item:true},orderBy:{createdAt:"desc"}})]);
  return {periodDays:days,current:items.map(i=>({item:i.name,quantity:r3(i.quantity),unit:i.unit})),physicalConsumption:moves.map(m=>({item:m.item.name,quantity:r3(Math.abs(m.quantity)),unit:m.item.unit,at:m.createdAt.toISOString()}))};
 }
 if(name==="analyse_sales"){
  const rows=await prisma.shiftSaleLine.findMany({where:{shift:{shopId:s.id,status:"RECORDED",recordedAt:{gte:start}}}}); const map=new Map<string,{product:string,category:string,quantity:number,total:number}>();
  for(const x of rows){const k=`${x.category}|${x.normalizedProductName||x.rawProductName}`; const a=map.get(k)||{product:x.normalizedProductName||x.rawProductName,category:x.category,quantity:0,total:0};a.quantity+=x.quantity;a.total+=n(x.lineTotal);map.set(k,a)}
  return {periodDays:days,lines:[...map.values()].map(x=>({...x,quantity:r3(x.quantity),total:r3(x.total)})).sort((a,b)=>b.quantity-a.quantity),totalQuantity:r3(rows.reduce((a,x)=>a+x.quantity,0)),ticketRevenue:r3(rows.reduce((a,x)=>a+n(x.lineTotal),0))};
 }
 if(name==="analyse_cafe"||name==="analyse_chicha"){
  const codes=name==="analyse_cafe"?["COFFEE_SOLD","COFFEE_BEANS_CONSUMED"]:["CHICHA_NORMAL","CHICHA_PERSONNEL","TOMBAC_CONSUMED"];
  const ms=await prisma.shiftMetric.findMany({where:{shift:{shopId:s.id,status:"RECORDED",recordedAt:{gte:start}},metricCode:{in:codes}}}); const sum=(c:string)=>r3(ms.filter(m=>m.metricCode===c).reduce((a,m)=>a+n(m.value),0));
  if(name==="analyse_cafe"){const sold=sum("COFFEE_SOLD"),beans=sum("COFFEE_BEANS_CONSUMED");return {periodDays:days,coffeeSold:sold,beansConsumed:beans,beansUnit:"g",gramsPerCoffee:sold>0?r3(beans/sold):null};}
  const normal=sum("CHICHA_NORMAL"),personnel=sum("CHICHA_PERSONNEL"),tombac=sum("TOMBAC_CONSUMED");return {periodDays:days,chichaNormal:normal,chichaPersonnel:personnel,chichaTotal:r3(normal+personnel),tombacConsumed:tombac,tombacUnit:"g",gramsPerNormalChicha:normal>0?r3(tombac/normal):null};
 }
 if(name==="analyse_consumption"){
  const [moves,corr]=await Promise.all([prisma.stockMovement.findMany({where:{source:"RECETTE",createdAt:{gte:start}},include:{item:true}}),prisma.shiftCorrection.findMany({where:{shift:{shopId:s.id,status:"RECORDED",recordedAt:{gte:start}}},include:{item:true}})]);
  const cm=new Map<string,{item:string,quantity:number,unit:string}>(); for(const m of moves){const a=cm.get(m.itemId)||{item:m.item.name,quantity:0,unit:m.item.unit};a.quantity+=Math.abs(m.quantity);cm.set(m.itemId,a)}
  return {periodDays:days,physicalConsumption:[...cm.values()].map(x=>({...x,quantity:r3(x.quantity)})),corrections:corr.map(c=>({item:c.item?.name||c.correctionCode,expected:c.expectedQty,actual:c.actualConsumedQty,difference:c.differenceQty,acceptedAmount:n(c.acceptedAmount),decision:c.decision})),acceptedCorrectionTotal:r3(corr.reduce((a,c)=>a+n(c.acceptedAmount),0))};
 }
 if(name==="compare_periods"){
  const d=Math.min(180,days),cut=new Date(Date.now()-d*86400000),prev=new Date(Date.now()-2*d*86400000);
  const summarize=async(from:Date,to:Date)=>{const shifts=await prisma.shift.findMany({where:{shopId:s.id,status:"RECORDED",recordedAt:{gte:from,lt:to}},include:{metrics:true}});const metric=(c:string)=>r3(shifts.flatMap(x=>x.metrics).filter(m=>m.metricCode===c).reduce((a,m)=>a+n(m.value),0));return {shifts:shifts.length,recette:r3(shifts.reduce((a,x)=>a+n(x.recetteFinale),0)),ticket:r3(shifts.reduce((a,x)=>a+n(x.ticketTotal),0)),corrections:r3(shifts.reduce((a,x)=>a+n(x.acceptedCorrectionTotal),0)),coffeeSold:metric("COFFEE_SOLD"),chichaNormal:metric("CHICHA_NORMAL"),chichaPersonnel:metric("CHICHA_PERSONNEL")};};
  return {periodDays:d,recent:await summarize(cut,new Date()),previous:await summarize(prev,cut),note:"Comparer les valeurs brutes; ne pas inventer de causalité."};
 }
 throw new Error(`Outil analytics inconnu: ${name}`);
}
