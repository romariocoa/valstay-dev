import { ChangeEvent, FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, BedDouble, Building2, CalendarDays, Download, Eye, EyeOff, FileSpreadsheet, Hotel, Info, LayoutDashboard, Lock, LogOut, MoreVertical, Pencil, Phone, Plus, Power, Send, Trash2, Upload, User, Users, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getClient } from '../lib/supabase';
import { PuchiMascot } from './PuchiMascot';

type Session={token:string;organizationName:string;displayName:string};
type Worker={id:string;dni:string;name:string;first_name:string;paternal_surname:string;maternal_surname:string;phone:string;position:string;project:string;active:boolean};
type LinkedHotel={link_id:string;tenant_id:string;name:string;status:string;contact_phone:string|null};
type Assignment={id:string;hotel:string;check_in_date:string;check_out_date:string;workers:{name:string;dni:string;status:string}[]};
type Data={workers:Worker[];hotels:LinkedHotel[];available_hotels:{id:string;name:string}[];assignments:Assignment[]};
const KEY='valstay_empresa_beta_session';
const field='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-500';
const iosOverlay='fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center';
const iosSheet='max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl sm:pb-6';
const iosGroup='mx-4 grid gap-2.5';
const iosField='w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none focus:border-amber-500 placeholder:text-slate-300';
const iosFieldLabel='mb-1 block text-xs font-semibold text-slate-500';
const iosPill='mx-4 mt-5 flex items-center justify-center gap-2 rounded-full bg-amber-500 py-3.5 text-[15px] font-bold text-slate-900 active:bg-amber-600 disabled:opacity-40';
const iosDetailGroup='mx-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white';
const iosDetailRow='flex items-center gap-3 px-4 py-3';
function addDays(dateStr:string,days:number):string{if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))return'';const d=new Date(dateStr+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function diffDays(from:string,to:string):number{if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))return 0;return Math.max(0,Math.round((new Date(to+'T12:00:00').getTime()-new Date(from+'T12:00:00').getTime())/86400000))}
function fmtDate(dateStr:string):string{return new Date(dateStr+'T12:00:00').toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric'})}
function waNumber(phone:string):string{const digits=(phone||'').replace(/\D/g,'');return digits.length===9&&digits.startsWith('9')?`51${digits}`:digits}
function daysInRange(start:string,end:string):Date[]{const days:Date[]=[];const cur=new Date(start+'T12:00:00');const last=new Date(end+'T12:00:00');while(cur<=last){days.push(new Date(cur));cur.setDate(cur.getDate()+1)}return days}
type ValuationStay={status?:string;check_in_date:string;check_out_date:string|null;baja_start_date:string|null;baja_end_date:string|null;worker_type?:string|null;guest_name?:string|null;guest_dni?:string|null;room_number?:string|null};
function buildValuationRows(stays:ValuationStay[],days:Date[],tarifas:Record<string,number>){
 const lastCompletedNight=new Date();lastCompletedNight.setDate(lastCompletedNight.getDate()-1);lastCompletedNight.setHours(12,0,0,0);
 const guestMap=new Map<string,ValuationStay[]>();
 for(const stay of stays){const dni=stay.guest_dni||`sin-dni-${Math.random()}`;const workerType=stay.worker_type||'obrero';const key=`${dni}_${workerType}`;if(!guestMap.has(key))guestMap.set(key,[]);guestMap.get(key)!.push(stay)}
 let item=1;
 const cargoLabel:Record<string,string>={obrero:'OBRERO',empleado:'EMPLEADO',staff:'STAFF'};
 return Array.from(guestMap.values()).map(guestStays=>{
  const first=guestStays[0];const workerType=first.worker_type||'obrero';const tarifa=tarifas[workerType]??tarifas.obrero;
  const dayVals=days.map(day=>{
   for(const stay of guestStays){
    const checkIn=new Date(stay.check_in_date+'T12:00:00');
    const scheduledCheckOut=stay.check_out_date?new Date(stay.check_out_date+'T12:00:00'):null;
    const checkOut=(stay.status==='active'||stay.status==='baja')&&(!scheduledCheckOut||scheduledCheckOut<lastCompletedNight)?lastCompletedNight:scheduledCheckOut;
    const bajaStart=stay.baja_start_date?new Date(stay.baja_start_date+'T12:00:00'):null;
    const bajaEnd=stay.baja_end_date?new Date(stay.baja_end_date+'T12:00:00'):null;
    if(day<checkIn)continue;
    if(checkOut!==null&&day>checkOut)continue;
    if(bajaStart&&bajaEnd&&day>=bajaStart&&day<=bajaEnd)continue;
    return '1';
   }
   return '';
  });
  const cant=dayVals.filter(v=>v==='1').length;
  return{item:item++,nombre:(first.guest_name||'').toUpperCase(),cargo:cargoLabel[workerType]||workerType.toUpperCase(),dni:first.guest_dni||'',roomNumber:first.room_number||'',dayVals,cant,tarifa,total:cant*tarifa};
 });
}

export function EnterpriseBeta(){
 const [session,setSession]=useState<Session|null>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [showPassword,setShowPassword]=useState(false),[rememberUser,setRememberUser]=useState(()=>Boolean(localStorage.getItem('valstay_empresa_remembered_user')));
 const [auth,setAuth]=useState(()=>({username:localStorage.getItem('valstay_empresa_remembered_user')||'',password:''}));
 const [data,setData]=useState<Data|null>(null),[worker,setWorker]=useState({dni:'',first_name:'',paternal_surname:'',maternal_surname:'',phone:'',position:'',project:''});
 const [selected,setSelected]=useState<string[]>([]),[trip,setTrip]=useState({hotel:'',checkIn:'',checkOut:'',days:14,notes:''});
 const [filters,setFilters]=useState({dni:'',name:'',phone:'',position:'',project:'',hotel:'',active:''});
 const [pageSize,setPageSize]=useState(25);
 const [page,setPage]=useState(1);
 const [showAddWorker,setShowAddWorker]=useState(false);
 const [showAssign,setShowAssign]=useState(false);
 const [lastAssignment,setLastAssignment]=useState<{hotelName:string;hotelPhone:string|null;checkIn:string;checkOut:string;days:number;notes:string;workers:Worker[]}|null>(null);
 const [hotelDetail,setHotelDetail]=useState<{tenant_id:string;name:string;contact_phone:string|null;rooms_total:number;rooms_available:number;workers_here:number;razon_social:string|null;ruc:string|null;direccion:string|null;cuenta_bancaria:string|null;cci:string|null;n_detraccion:string|null;fiscal_email:string|null}|null>(null);
 const [showValuation,setShowValuation]=useState(false);
 const [valuation,setValuation]=useState(()=>{const today=new Date();const lastNight=new Date(today);lastNight.setDate(lastNight.getDate()-1);const pad=(n:number)=>String(n).padStart(2,'0');return{startDate:`${lastNight.getFullYear()}-${pad(lastNight.getMonth()+1)}-01`,endDate:`${lastNight.getFullYear()}-${pad(lastNight.getMonth()+1)}-${pad(lastNight.getDate())}`,obrero:'41.20',empleado:'48',staff:'65.50'}});
 const [valuationBusy,setValuationBusy]=useState(false);
 const [showImport,setShowImport]=useState(false);
 const [importSheet,setImportSheet]=useState<{headers:string[];rows:string[][]}|null>(null);
 const [importMap,setImportMap]=useState({dni:'',first_name:'',paternal_surname:'',maternal_surname:'',phone:'',position:'',project:''});
 const [importResult,setImportResult]=useState('');
 const fileInputRef=useRef<HTMLInputElement>(null);
 const [menuFor,setMenuFor]=useState<string|null>(null);
 const [menuPos,setMenuPos]=useState<{top:number;left:number}|null>(null);
 const [editWorker,setEditWorker]=useState<Worker|null>(null);
 const openWorkerMenu=(e:MouseEvent,id:string)=>{const r=e.currentTarget.getBoundingClientRect();setMenuPos({top:r.bottom+4,left:Math.max(8,r.right-144)});setMenuFor(m=>m===id?null:id)};
 const [section,setSection]=useState<'home'|'workers'|'hotels'|'assignments'|'tracking'>('home');
 const load=async(s=session)=>{if(!s)return;const{data:d,error}=await getClient().rpc('enterprise_dashboard',{p_token:s.token});if(error)setMessage(error.message);else setData(d as Data)};
 useEffect(()=>{void load()},[session?.token]);
 useEffect(()=>{if(!data)return;setSelected(c=>c.filter(id=>{const w=data.workers.find(x=>x.id===id);return w?.active&&workerHotel(w).hotel==='Por asignarse'}))},[data]);
 useEffect(()=>{setPage(1)},[filters,pageSize]);
 const login=async(e:FormEvent)=>{e.preventDefault();setBusy(true);const{data:d,error}=await getClient().rpc('login_enterprise_beta',{p_username:auth.username,p_password:auth.password});setBusy(false);if(error||!d?.[0])return setMessage(error?.message||'No se pudo ingresar');const r=d[0],s={token:r.token,organizationName:r.organization_name,displayName:r.display_name};localStorage.setItem(KEY,JSON.stringify(s));if(rememberUser)localStorage.setItem('valstay_empresa_remembered_user',auth.username.toLowerCase().trim());else localStorage.removeItem('valstay_empresa_remembered_user');setSession(s)};
 const addWorker=async(e:FormEvent)=>{e.preventDefault();if(!session)return;setBusy(true);const{error}=await getClient().rpc('enterprise_add_worker',{p_token:session.token,p_dni:worker.dni,p_first_name:worker.first_name,p_paternal_surname:worker.paternal_surname,p_maternal_surname:worker.maternal_surname,p_phone:worker.phone,p_position:worker.position,p_project:worker.project});setBusy(false);if(error)return setMessage(error.message);setWorker({dni:'',first_name:'',paternal_surname:'',maternal_surname:'',phone:'',position:'',project:''});setShowAddWorker(false);await load()};
 const link=async(id:string)=>{if(!session)return;setBusy(true);const{error}=await getClient().rpc('enterprise_request_hotel_link',{p_token:session.token,p_tenant:id});setBusy(false);if(error)setMessage(error.message);else await load()};
 const openHotelDetail=async(h:LinkedHotel)=>{if(!session)return;setBusy(true);const{data:res,error}=await getClient().rpc('enterprise_hotel_overview',{p_token:session.token,p_tenant:h.tenant_id});setBusy(false);if(error)return setMessage(error.message);const o=res as{rooms_total:number;rooms_available:number;workers_here:number;razon_social:string|null;ruc:string|null;direccion:string|null;cuenta_bancaria:string|null;cci:string|null;n_detraccion:string|null;fiscal_email:string|null};setHotelDetail({tenant_id:h.tenant_id,name:h.name,contact_phone:h.contact_phone,...o})};
 const openValuation=async()=>{if(!session||!hotelDetail)return;setBusy(true);const{data:res,error}=await getClient().rpc('enterprise_hotel_valuation_rates',{p_token:session.token,p_tenant:hotelDetail.tenant_id});setBusy(false);if(error)return setMessage(error.message);const r=res as{obrero_rate:number;empleado_rate:number;staff_rate:number};setValuation(v=>({...v,obrero:String(r.obrero_rate),empleado:String(r.empleado_rate),staff:String(r.staff_rate)}));setShowValuation(true)};
 const prepareValuation=async():Promise<{days:Date[];rows:ReturnType<typeof buildValuationRows>}|null>=>{
  if(!session||!hotelDetail)return null;
  if(!valuation.startDate||!valuation.endDate||valuation.endDate<valuation.startDate){setMessage('Selecciona un rango de fechas válido.');return null}
  const[{data:stays,error:staysErr}]=await Promise.all([
   getClient().rpc('enterprise_hotel_stays',{p_token:session.token,p_tenant:hotelDetail.tenant_id,p_start_date:valuation.startDate,p_end_date:valuation.endDate}),
   getClient().rpc('enterprise_save_hotel_valuation_rates',{p_token:session.token,p_tenant:hotelDetail.tenant_id,p_obrero:Number(valuation.obrero)||0,p_empleado:Number(valuation.empleado)||0,p_staff:Number(valuation.staff)||0}),
  ]);
  if(staysErr){setMessage(staysErr.message);return null}
  const days=daysInRange(valuation.startDate,valuation.endDate);
  const tarifas={obrero:Number(valuation.obrero)||0,empleado:Number(valuation.empleado)||0,staff:Number(valuation.staff)||0};
  const rows=buildValuationRows((stays as ValuationStay[])||[],days,tarifas);
  return{days,rows};
 };
 const downloadValuationExcel=async()=>{setValuationBusy(true);const prep=await prepareValuation();setValuationBusy(false);if(!prep||!hotelDetail||!session)return;const{days,rows}=prep;
  const MONTHS_ES=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const DOW=['D','L','M','X','J','V','S'];
  const FIXED=6;
  type CellStyleOpts={bg?:string;bold?:boolean;align?:'left'|'center'|'right';size?:number;color?:string;rotate?:number};
  const cellStyle=(o:CellStyleOpts={})=>{const s:Record<string,unknown>={font:{bold:!!o.bold,sz:o.size??9,name:'Calibri',color:o.color?{rgb:o.color}:undefined},alignment:{horizontal:o.align??'left',vertical:'center',wrapText:false,textRotation:o.rotate},border:{top:{style:'thin',color:{auto:1}},bottom:{style:'thin',color:{auto:1}},left:{style:'thin',color:{auto:1}},right:{style:'thin',color:{auto:1}}}};if(o.bg)s.fill={patternType:'solid',fgColor:{rgb:o.bg},bgColor:{indexed:64}};return s};
  const ws:XLSX.WorkSheet={};
  const set=(r:number,c:number,v:string|number,style?:Record<string,unknown>)=>{const ref=XLSX.utils.encode_cell({r,c});const cell:Record<string,unknown>={t:typeof v==='number'?'n':'s',v};if(style)cell.s=style;ws[ref]=cell as unknown as XLSX.CellObject};
  const merges:{s:{r:number;c:number};e:{r:number;c:number}}[]=[];

  const providerRows:[string,string][]=[
   ['DATOS PROVEEDOR:',hotelDetail.razon_social||''],
   ['NOMBRE COMERCIAL:',hotelDetail.name||''],
   ['RAZON SOCIAL:',hotelDetail.razon_social||''],
   ['RUBRO:','HOSPEDAJE'],
   ['RUC:',hotelDetail.ruc||''],
   ['DIRECCIÓN:',hotelDetail.direccion||''],
   ['CONTACTO:',hotelDetail.razon_social||''],
   ['N° DE TELEFONO:',hotelDetail.contact_phone||''],
   ['CORREO ELECTRONICO:',hotelDetail.fiscal_email||''],
   ['CUENTA DE AHORRO:',hotelDetail.cuenta_bancaria||''],
   ['CUENTA INTERBANCARIA:',hotelDetail.cci||''],
   ['CUENTA DE DETRACCION:',hotelDetail.n_detraccion||''],
   ['PERIODO DE VALORIZACIÓN:',`DEL ${fmtDate(valuation.startDate).toUpperCase()} AL ${fmtDate(valuation.endDate).toUpperCase()}`],
  ];
  providerRows.forEach(([label,value],i)=>{
   set(i,0,label,cellStyle({bold:true,size:9}));merges.push({s:{r:i,c:0},e:{r:i,c:1}});
   set(i,2,value,label==='NOMBRE COMERCIAL:'?cellStyle({bg:'FFFF00',bold:true,size:9}):cellStyle({size:9,color:label==='CORREO ELECTRONICO:'?'0563C1':undefined}));merges.push({s:{r:i,c:2},e:{r:i,c:4}});
  });

  const monthBandRow=providerRows.length+1,dowRow=monthBandRow+1,headerRow=dowRow+1,dataStartRow=headerRow+1;
  const bands:{label:string;start:number;end:number}[]=[];
  {let curKey='',start=FIXED;
   days.forEach((d,i)=>{const key=`${d.getFullYear()}-${d.getMonth()}`;const col=FIXED+i;if(key!==curKey){if(curKey!=='')bands.push({label:MONTHS_ES[days[i-1].getMonth()],start,end:col-1});curKey=key;start=col}});
   bands.push({label:MONTHS_ES[days[days.length-1].getMonth()],start,end:FIXED+days.length-1});
  }
  bands.forEach((b,i)=>{const color=i%2===0?'808000':'FFFF00';set(monthBandRow,b.start,b.label,cellStyle({bg:color,bold:true,align:'center',size:9,color:'FFFFFF'}));if(b.end>b.start)merges.push({s:{r:monthBandRow,c:b.start},e:{r:monthBandRow,c:b.end}})});

  const fixedHeaders=['ITEM','DNI','APELLIDOS Y NOMBRES','CARGO','Nº HAB','HABITACION'];
  fixedHeaders.forEach((h,c)=>set(headerRow,c,h,cellStyle({bg:'0070C0',bold:true,align:'center',size:8,color:'FFFFFF'})));
  const tailStart=FIXED+days.length;
  ['TOTAL DE DÍAS','PRECIO UNITARIO SIN IGV S/','TOTAL S/.'].forEach((h,i)=>set(headerRow,tailStart+i,h,cellStyle({bg:'0070C0',bold:true,align:'center',size:8,color:'FFFFFF'})));
  days.forEach((d,i)=>{
   const col=FIXED+i,isSunday=d.getDay()===0;
   set(dowRow,col,DOW[d.getDay()],cellStyle({bg:isSunday?'FFFF00':'D9D9D9',bold:true,align:'center',size:8}));
   const dateLabel=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
   set(headerRow,col,dateLabel,cellStyle({bg:isSunday?'FFFF00':'0070C0',bold:true,align:'center',size:7,color:isSunday?'000000':'FFFFFF',rotate:90}));
  });

  rows.forEach((row,ri)=>{
   const r=dataStartRow+ri;
   set(r,0,row.item,cellStyle({align:'center',size:8}));
   set(r,1,row.dni,cellStyle({align:'center',size:8}));
   set(r,2,row.nombre,cellStyle({align:'left',size:8}));
   set(r,3,row.cargo,cellStyle({align:'left',size:8}));
   set(r,4,row.roomNumber,cellStyle({align:'center',size:8}));
   set(r,5,row.roomNumber,cellStyle({align:'center',size:8}));
   row.dayVals.forEach((v,ci)=>set(r,FIXED+ci,v==='1'?1:'',cellStyle({align:'center',size:8})));
   set(r,tailStart,row.cant,cellStyle({align:'center',bold:true,size:8}));
   set(r,tailStart+1,row.tarifa,cellStyle({align:'center',size:8}));
   set(r,tailStart+2,row.total,cellStyle({align:'right',bold:true,size:8}));
  });

  const totalsRow=dataStartRow+rows.length;
  const dayTotals=days.map((_,ci)=>rows.reduce((acc,r)=>acc+(r.dayVals[ci]==='1'?1:0),0));
  dayTotals.forEach((v,ci)=>set(totalsRow,FIXED+ci,v,cellStyle({bg:'00B0F0',bold:true,align:'center',size:8})));
  const totalDiasGrand=rows.reduce((a,r)=>a+r.cant,0);
  const grandTotal=rows.reduce((a,r)=>a+r.total,0);
  set(totalsRow,tailStart,'TOTAL A FACTURAR',cellStyle({bg:'92D050',bold:true,align:'center',size:8}));
  merges.push({s:{r:totalsRow,c:tailStart},e:{r:totalsRow,c:tailStart+1}});
  set(totalsRow,tailStart+2,`S/. ${grandTotal.toFixed(2)}`,cellStyle({bg:'92D050',bold:true,align:'right',size:9}));
  const grandDaysRow=totalsRow+1;
  set(grandDaysRow,FIXED,totalDiasGrand,cellStyle({bg:'92D050',bold:true,align:'center',size:9}));

  const igv=grandTotal*0.18,finalTotal=grandTotal+igv;
  const boxRow=grandDaysRow+2;
  ([['SUBTOTAL',grandTotal],['IGV 18%',igv],['TOTAL',finalTotal]] as [string,number][]).forEach(([label,val],i)=>{
   set(boxRow+i,tailStart,label,cellStyle({bg:'D9D9D9',bold:true,align:'left',size:9}));
   merges.push({s:{r:boxRow+i,c:tailStart},e:{r:boxRow+i,c:tailStart+1}});
   set(boxRow+i,tailStart+2,`S/. ${val.toFixed(2)}`,cellStyle({bg:'D9D9D9',bold:true,align:'right',size:9}));
  });

  ws['!merges']=merges;
  ws['!cols']=[{wch:6},{wch:11},{wch:26},{wch:11},{wch:8},{wch:10},...days.map(()=>({wch:4})),{wch:9},{wch:12},{wch:12}];
  const rowInfos:XLSX.RowInfo[]=[];rowInfos[headerRow]={hpt:60};ws['!rows']=rowInfos;
  ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:boxRow+2,c:tailStart+2}});
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Valorización');
  XLSX.writeFile(wb,`valorizacion_${hotelDetail.name.replace(/[^a-z0-9]+/gi,'_')}_${valuation.startDate}_al_${valuation.endDate}.xlsx`,{cellStyles:true});
 };
 const downloadValuationPdf=async()=>{setValuationBusy(true);const prep=await prepareValuation();setValuationBusy(false);if(!prep||!hotelDetail||!session)return;const{days,rows}=prep;
  const{jsPDF}=await import('jspdf');
  const{default:autoTable}=await import('jspdf-autotable');
  const grandTotal=rows.reduce((a,r)=>a+r.total,0);
  const totalCant=rows.reduce((a,r)=>a+r.cant,0);
  const doc=new jsPDF({orientation:'landscape',format:'a4',unit:'mm'});
  const pageW=doc.internal.pageSize.getWidth();
  const margin=12;let y=margin;
  doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(hotelDetail.name.toUpperCase(),pageW/2,y+5,{align:'center'});
  doc.setFontSize(11);doc.setTextColor(60,60,60);doc.text('VALORIZACIÓN DE PERSONAL',pageW/2,y+12,{align:'center'});doc.setTextColor(0,0,0);
  y+=20;
  doc.setFillColor(184,204,228);doc.roundedRect(margin,y-1,pageW-margin*2,8,1,1,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);
  doc.text(`EMPRESA: ${session.organizationName}   |   DEL ${fmtDate(valuation.startDate).toUpperCase()} AL ${fmtDate(valuation.endDate).toUpperCase()}`,pageW/2,y+4.5,{align:'center'});
  y+=12;
  const usable=pageW-margin*2;
  const W_NUM=6,W_NAME=45,W_CARGO=18,W_DNI=16,W_CANT=8,W_TAR=14,W_TOT=18;
  const fixedW=W_NUM+W_NAME+W_CARGO+W_DNI,tailW=W_CANT+W_TAR+W_TOT;
  const dayW=Math.max(5,(usable-fixedW-tailW)/days.length);
  const head=[['N°','NOMBRES Y APELLIDOS','CARGO','DNI',...days.map(d=>`${d.getDate()}`),'CANT','TARIFA','TOTAL']];
  const dayTotals=days.map((_,i)=>rows.reduce((acc,r)=>acc+(r.dayVals[i]==='1'?1:0),0));
  const body=[...rows.map(r=>[`${r.item}`,r.nombre,r.cargo,r.dni,...r.dayVals,`${r.cant}`,`S/ ${r.tarifa.toFixed(2)}`,`S/ ${r.total.toFixed(2)}`]),['','TOTAL','','',...dayTotals.map(s=>s>0?`${s}`:''),`${totalCant}`,'',`S/ ${grandTotal.toFixed(2)}`]];
  const totalsRowIdx=body.length-1;
  autoTable(doc,{startY:y,head,body,margin:{left:margin,right:margin},theme:'grid',styles:{fontSize:6,cellPadding:{top:1.2,bottom:1.2,left:0.8,right:0.8},valign:'middle',overflow:'ellipsize'},headStyles:{fillColor:[184,204,228],textColor:[0,0,0],fontStyle:'bold',halign:'center',fontSize:6},columnStyles:{0:{halign:'center',cellWidth:W_NUM},1:{halign:'left',cellWidth:W_NAME},2:{halign:'center',cellWidth:W_CARGO,fontSize:5.5,overflow:'visible'},3:{halign:'center',cellWidth:W_DNI},...Object.fromEntries(days.map((_,i)=>[4+i,{halign:'center',cellWidth:dayW,cellPadding:{top:1.2,bottom:1.2,left:0.3,right:0.3}}])),[4+days.length]:{halign:'center',cellWidth:W_CANT},[4+days.length+1]:{halign:'right',cellWidth:W_TAR},[4+days.length+2]:{halign:'right',cellWidth:W_TOT}},didParseCell:(data)=>{if(data.section==='body'){const isDayCol=data.column.index>=4&&data.column.index<4+days.length;if(data.row.index===totalsRowIdx){data.cell.styles.fillColor=[217,217,217];data.cell.styles.fontStyle='bold';data.cell.styles.halign=isDayCol?'center':data.column.index<=1?'center':'right'}else if(isDayCol&&data.cell.raw==='1'){data.cell.styles.fillColor=[146,208,80];data.cell.styles.fontStyle='bold'}}}});
  const totalPages=doc.getNumberOfPages();
  for(let p=1;p<=totalPages;p++){doc.setPage(p);const pageH=doc.internal.pageSize.getHeight();doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(120,120,120);doc.text(`Generado por ValStay Empresa · ${session.organizationName}`,pageW-margin,pageH-5.5,{align:'right'})}
  doc.save(`valorizacion_${hotelDetail.name.replace(/[^a-z0-9]+/gi,'_')}_${valuation.startDate}_al_${valuation.endDate}.pdf`);
 };
 const send=async(e:FormEvent)=>{e.preventDefault();if(!session)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(trip.checkIn)||!/^\d{4}-\d{2}-\d{2}$/.test(trip.checkOut)||trip.checkOut<=trip.checkIn)return setMessage('Selecciona fechas válidas; la salida debe ser posterior al ingreso.');setBusy(true);const{error}=await getClient().rpc('enterprise_send_assignment',{p_token:session.token,p_tenant:trip.hotel,p_worker_ids:selected,p_check_in:trip.checkIn,p_check_out:trip.checkOut,p_notes:trip.notes});setBusy(false);if(error)return setMessage(error.message);const hotel=data?.hotels.find(h=>h.tenant_id===trip.hotel);setLastAssignment({hotelName:hotel?.name||'',hotelPhone:hotel?.contact_phone||null,checkIn:trip.checkIn,checkOut:trip.checkOut,days:trip.days,notes:trip.notes,workers:allWorkers.filter(w=>selected.includes(w.id))});setSelected([]);setTrip({hotel:'',checkIn:'',checkOut:'',days:14,notes:''});setShowAssign(false);setMessage('Trabajadores enviados como reservaciones.');await load()};
 const workerHotel=(w:Worker):{hotel:string;status?:string}=>{const list=data?.assignments||[];for(let i=list.length-1;i>=0;i--){const entry=list[i].workers?.find(x=>x.dni===w.dni);if(entry&&entry.status==='reviewed')return{hotel:list[i].hotel,status:entry.status}}return{hotel:'Por asignarse'}};
 const toggleWorkerActive=async(w:Worker)=>{if(!session)return;setBusy(true);const{error}=await getClient().rpc('enterprise_toggle_worker',{p_token:session.token,p_worker_id:w.id,p_active:!w.active});setBusy(false);if(error)return setMessage(error.message);await load()};
 const saveEditWorker=async(e:FormEvent)=>{e.preventDefault();if(!session||!editWorker)return;setBusy(true);const{error}=await getClient().rpc('enterprise_update_worker',{p_token:session.token,p_worker_id:editWorker.id,p_dni:editWorker.dni,p_first_name:editWorker.first_name,p_paternal_surname:editWorker.paternal_surname,p_maternal_surname:editWorker.maternal_surname,p_phone:editWorker.phone,p_position:editWorker.position,p_project:editWorker.project});setBusy(false);if(error)return setMessage(error.message);setEditWorker(null);await load()};
 const deleteWorker=async(w:Worker)=>{if(!session)return;setMenuFor(null);if(!confirm(`¿Eliminar a "${w.name}"? Esta acción no se puede deshacer.`))return;setBusy(true);const{error}=await getClient().rpc('enterprise_delete_worker',{p_token:session.token,p_worker_id:w.id});setBusy(false);if(error)return setMessage(error.message);await load()};
 const exportWorkers=()=>{const rows=filteredWorkers.map(w=>{const wh=workerHotel(w);return{DNI:w.dni,Nombres:w.first_name,'Apellido paterno':w.paternal_surname,'Apellido materno':w.maternal_surname,'Nombre completo':w.name,'Teléfono':w.phone,Cargo:w.position,Proyecto:w.project,Estado:w.active?'Activo':'Inactivo','Hotel asignado':wh.hotel}});const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Trabajadores');XLSX.writeFile(wb,`trabajadores_${(session?.organizationName||'empresa').replace(/[^a-z0-9]+/gi,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`)};
 const closeImport=()=>{setShowImport(false);setImportSheet(null);setImportMap({dni:'',first_name:'',paternal_surname:'',maternal_surname:'',phone:'',position:'',project:''});setImportResult('')};
 const onImportFile=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''}) as string[][];const headers=(raw[0]||[]).map(h=>String(h||'').trim());const rows=raw.slice(1).filter(r=>r.some(c=>String(c||'').trim()!==''));const guess=(...keys:string[])=>{const idx=headers.findIndex(h=>keys.some(k=>h.toLowerCase().includes(k)));return idx>=0?String(idx):''};setImportMap({dni:guess('dni'),first_name:guess('nombres','nombre','name'),paternal_surname:guess('paterno','apellido1','apellido_p'),maternal_surname:guess('materno','apellido2','apellido_m'),phone:guess('tel','celular','phone'),position:guess('cargo','puesto','position'),project:guess('proyecto','project')});setImportSheet({headers,rows});setImportResult('')};
 const runImport=async()=>{if(!session||!importSheet)return;if(importMap.dni===''||importMap.first_name===''){setMessage('Selecciona al menos las columnas DNI y Nombres.');return}const dniIdx=Number(importMap.dni),firstIdx=Number(importMap.first_name),paternalIdx=importMap.paternal_surname===''?-1:Number(importMap.paternal_surname),maternalIdx=importMap.maternal_surname===''?-1:Number(importMap.maternal_surname),phoneIdx=importMap.phone===''?-1:Number(importMap.phone),positionIdx=importMap.position===''?-1:Number(importMap.position),projectIdx=importMap.project===''?-1:Number(importMap.project);const payload=importSheet.rows.map(r=>({dni:String(r[dniIdx]||''),first_name:String(r[firstIdx]||''),paternal_surname:paternalIdx>=0?String(r[paternalIdx]||''):'',maternal_surname:maternalIdx>=0?String(r[maternalIdx]||''):'',phone:phoneIdx>=0?String(r[phoneIdx]||''):'',position:positionIdx>=0?String(r[positionIdx]||''):'',project:projectIdx>=0?String(r[projectIdx]||''):''}));setBusy(true);const{data:res,error}=await getClient().rpc('enterprise_import_workers',{p_token:session.token,p_rows:payload});setBusy(false);if(error)return setMessage(error.message);const r=res as{inserted:number;updated:number;skipped:number};setImportResult(`Listo: ${r.inserted} nuevos, ${r.updated} actualizados${r.skipped?`, ${r.skipped} omitidos por datos inválidos`:''}.`);await load()};
 const allWorkers=data?.workers||[];
 const uniquePositions=Array.from(new Set(allWorkers.map(w=>w.position).filter(Boolean)));
 const uniqueProjects=Array.from(new Set(allWorkers.map(w=>w.project).filter(Boolean)));
 const uniqueHotels=Array.from(new Set(allWorkers.map(w=>workerHotel(w).hotel)));
 const filteredWorkers=allWorkers.filter(w=>{const wh=workerHotel(w);return(!filters.dni||w.dni.includes(filters.dni))&&(!filters.name||w.name.toLowerCase().includes(filters.name.toLowerCase()))&&(!filters.phone||(w.phone||'').includes(filters.phone))&&(!filters.position||w.position===filters.position)&&(!filters.project||w.project===filters.project)&&(!filters.hotel||wh.hotel===filters.hotel)&&(!filters.active||(filters.active==='active'?w.active:!w.active))});
 const menuWorker=menuFor?allWorkers.find(w=>w.id===menuFor)||null:null;
 const pageCount=Math.max(1,Math.ceil(filteredWorkers.length/pageSize));
 const pagedWorkers=filteredWorkers.slice((page-1)*pageSize,page*pageSize);
 const assignmentMessage=lastAssignment?`🏢 *${session?.organizationName}*\nNueva asignación de personal\n\n🏨 Hospedaje: ${lastAssignment.hotelName}\n📅 Ingreso: ${fmtDate(lastAssignment.checkIn)}\n📅 Salida: ${fmtDate(lastAssignment.checkOut)} (${lastAssignment.days} día${lastAssignment.days===1?'':'s'})\n\n👥 Trabajadores:\n${lastAssignment.workers.map(w=>`• ${w.name} — DNI ${w.dni}${w.position?` (${w.position})`:''}`).join('\n')}${lastAssignment.notes?`\n\n📝 Notas: ${lastAssignment.notes}`:''}\n\nEnviado desde ValStay Empresa`:'';
 if(!session)return <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-4 py-10" style={{background:'radial-gradient(circle at 16% 12%, #1c2333 0%, transparent 30%), radial-gradient(circle at 84% 82%, #3a2a0d 0%, transparent 28%), linear-gradient(145deg, #050708 0%, #020405 52%, #000101 100%)'}}>
  <div className="pointer-events-none absolute -left-24 top-[18%] h-72 w-72 rounded-full bg-slate-500/10 blur-3xl"/><div className="pointer-events-none absolute -right-20 bottom-[12%] h-80 w-80 rounded-full bg-amber-500/10 blur-3xl"/><div className="pointer-events-none absolute inset-0 opacity-[0.045]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)',backgroundSize:'48px 48px'}}/>
  <div className="relative z-10 flex w-full max-w-sm flex-1 flex-col items-center justify-center"><div className="relative -mb-4"><img src="/logovalstay.png" alt="ValStay Empresa" className="h-72 w-72 object-contain" style={{filter:'brightness(0.72) contrast(1.4) saturate(1.25) drop-shadow(0 12px 24px rgba(0,0,0,.55))'}}/><PuchiMascot className="pointer-events-none absolute left-1/2 top-[6.6rem] z-10 w-40 -translate-x-1/2 drop-shadow-[0_8px_12px_rgba(0,0,0,.65)]"/><span className="absolute bottom-11 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-600/50 bg-black/80 px-4 py-1 text-sm font-black uppercase tracking-[.18em] text-amber-400">Empresa</span></div>
  <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/85 shadow-2xl shadow-black/80 backdrop-blur-xl"><div className="px-8 pb-6 pt-8"><h2 className="mb-1 text-center text-2xl font-bold text-white">Bienvenido</h2><p className="mb-7 text-center text-sm text-zinc-500">Inicia sesión para continuar</p>
  <form onSubmit={login} className="space-y-5">
  <div><label className="mb-2 block text-sm font-semibold text-zinc-300">Usuario</label><div className="relative"><User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"/><input required className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 py-3.5 pl-12 pr-4 text-sm text-zinc-100 outline-none focus:border-amber-700/70" placeholder="Nombre de usuario" value={auth.username} onChange={e=>setAuth({...auth,username:e.target.value})}/></div></div>
  <div><label className="mb-2 block text-sm font-semibold text-zinc-300">Contraseña</label><div className="relative"><Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"/><input required type={showPassword?'text':'password'} className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 py-3.5 pl-12 pr-12 text-sm text-zinc-100 outline-none focus:border-amber-700/70" placeholder="••••••••" value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})}/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500">{showPassword?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button></div></div>
  <label className="flex items-center gap-2 text-sm text-zinc-400"><input type="checkbox" checked={rememberUser} onChange={e=>setRememberUser(e.target.checked)} className="h-4 w-4 accent-amber-600"/>Recordar mi usuario</label>{message&&<div className="flex gap-2 rounded-xl border border-red-800/60 bg-red-950/50 px-4 py-3 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0"/>{message}</div>}
  <button type="submit" disabled={busy} className="w-full rounded-xl py-4 font-bold text-white disabled:opacity-60" style={{background:'linear-gradient(135deg,#d97706 0%,#78350f 100%)'}}>{busy?'Verificando...':'Ingresar'}</button></form><div className="mt-6 border-t border-zinc-800 pt-5 text-center"><p className="text-xs text-zinc-600">Cuenta proporcionada por ValStay</p><div className="mt-3 flex items-center justify-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-500"/><span className="text-sm text-zinc-500">Sistema en línea</span></div></div></div></div></div><p className="relative z-10 text-sm text-slate-400/70">© {new Date().getFullYear()} ValStay &nbsp;|&nbsp; By Rch</p></main>;
 return <main className="min-h-screen bg-slate-100"><header className="sticky top-0 z-30 bg-slate-900 shadow-sm"><div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/15"><Building2 className="h-5 w-5 text-amber-400"/></div><div><b className="block leading-tight text-white">{session.organizationName}</b><p className="text-xs text-slate-400">ValStay Empresa</p></div><button onClick={()=>{localStorage.removeItem(KEY);setSession(null)}} className="ml-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4"/>Salir</button></div><div className="overflow-x-auto px-3 pb-3"><nav className="mx-auto flex w-max min-w-full items-center justify-start gap-1 rounded-2xl bg-white/5 p-1.5 sm:min-w-0 sm:max-w-3xl sm:justify-center">{([{id:'home',label:'Inicio',icon:LayoutDashboard},{id:'workers',label:'Trabajadores',icon:Users},{id:'hotels',label:'Hospedajes',icon:Hotel},{id:'assignments',label:'Asignaciones',icon:Send},{id:'tracking',label:'Seguimiento',icon:CalendarDays}] as const).map(item=><button key={item.id} onClick={()=>setSection(item.id)} className={`flex min-w-max items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:flex-1 ${section===item.id?'bg-amber-500 text-slate-900 shadow-sm':'text-slate-400 hover:bg-white/10 hover:text-white'}`}><item.icon className={`h-4 w-4 ${section===item.id?'stroke-[2.5]':''}`}/>{item.label}</button>)}</nav></div></header><div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-2">{message&&<p className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 lg:col-span-2">{message}</p>}
 {section==='home'&&<section className="lg:col-span-2"><div className="mb-5"><h1 className="text-2xl font-black">Panel de empresa</h1><p className="text-sm text-slate-500">Resumen de trabajadores y hospedajes conectados.</p></div><div className="grid gap-4 sm:grid-cols-3"><button onClick={()=>setSection('workers')} className="rounded-2xl border-l-4 border-amber-500 bg-white p-5 text-left shadow-sm"><Users className="mb-4 text-slate-900"/><p className="text-3xl font-black">{data?.workers.length||0}</p><p className="text-sm text-slate-500">Trabajadores</p></button><button onClick={()=>setSection('hotels')} className="rounded-2xl border-l-4 border-amber-500 bg-white p-5 text-left shadow-sm"><Hotel className="mb-4 text-slate-900"/><p className="text-3xl font-black">{data?.hotels.filter(h=>h.status==='accepted').length||0}</p><p className="text-sm text-slate-500">Hospedajes vinculados</p></button><button onClick={()=>setSection('tracking')} className="rounded-2xl border-l-4 border-amber-500 bg-white p-5 text-left shadow-sm"><CalendarDays className="mb-4 text-slate-900"/><p className="text-3xl font-black">{data?.assignments.length||0}</p><p className="text-sm text-slate-500">Asignaciones enviadas</p></button></div></section>}
 {section==='workers'&&<section className="rounded-2xl bg-white p-5 lg:col-span-2"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="flex gap-2 font-black"><Users className="text-slate-900"/>Trabajadores ({filteredWorkers.length}/{allWorkers.length})</h2><div className="flex flex-wrap gap-2"><button type="button" disabled={!selected.length} onClick={()=>setShowAssign(true)} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-40"><Send className="h-4 w-4"/>Asignar{selected.length?` (${selected.length})`:''}</button><button type="button" onClick={exportWorkers} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4"/>Exportar</button><button type="button" onClick={()=>setShowImport(true)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Upload className="h-4 w-4"/>Importar</button><button type="button" onClick={()=>setShowAddWorker(true)} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4"/>Agregar trabajador</button></div></div>
  <div className="mt-2 grid gap-2 sm:grid-cols-7"><input className={field} placeholder="Filtrar DNI" value={filters.dni} onChange={e=>setFilters({...filters,dni:e.target.value.replace(/\D/g,'')})}/><input className={field} placeholder="Filtrar nombre" value={filters.name} onChange={e=>setFilters({...filters,name:e.target.value})}/><input className={field} placeholder="Filtrar teléfono" value={filters.phone} onChange={e=>setFilters({...filters,phone:e.target.value})}/><select className={field} value={filters.position} onChange={e=>setFilters({...filters,position:e.target.value})}><option value="">Todos los cargos</option>{uniquePositions.map(p=><option key={p} value={p}>{p}</option>)}</select><select className={field} value={filters.project} onChange={e=>setFilters({...filters,project:e.target.value})}><option value="">Todos los proyectos</option>{uniqueProjects.map(p=><option key={p} value={p}>{p}</option>)}</select><select className={field} value={filters.hotel} onChange={e=>setFilters({...filters,hotel:e.target.value})}><option value="">Todos los hoteles</option>{uniqueHotels.map(h=><option key={h} value={h}>{h}</option>)}</select><select className={field} value={filters.active} onChange={e=>setFilters({...filters,active:e.target.value})}><option value="">Activos e inactivos</option><option value="active">Solo activos</option><option value="inactive">Solo inactivos</option></select></div>
  <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="py-2 pr-2"></th><th className="py-2 pr-2">#</th><th className="py-2 pr-2">DNI</th><th className="py-2 pr-2">Nombres</th><th className="py-2 pr-2">Teléfono</th><th className="py-2 pr-2">Cargo</th><th className="py-2 pr-2">Proyecto</th><th className="py-2 pr-2">Hotel asignado</th><th className="py-2 pr-2">Estado</th><th className="py-2 pr-2"></th></tr></thead><tbody>{pagedWorkers.map((w,i)=>{const wh=workerHotel(w);return <tr key={w.id} className={`border-b last:border-0 ${w.active?'':'opacity-50'}`}><td className="py-2 pr-2"><input type="checkbox" disabled={!w.active||wh.hotel!=='Por asignarse'} title={!w.active?'Activa al trabajador para poder asignarlo':wh.hotel!=='Por asignarse'?`Ya está asignado a ${wh.hotel}`:undefined} checked={selected.includes(w.id)} onChange={e=>setSelected(c=>e.target.checked?[...c,w.id]:c.filter(x=>x!==w.id))}/></td><td className="py-2 pr-2 text-slate-500">{(page-1)*pageSize+i+1}</td><td className="py-2 pr-2 font-mono">{w.dni}</td><td className="py-2 pr-2 font-bold">{w.name}</td><td className="py-2 pr-2">{w.phone||'—'}</td><td className="py-2 pr-2">{w.position||'—'}</td><td className="py-2 pr-2">{w.project||'—'}</td><td className={`py-2 pr-2 ${wh.hotel==='Por asignarse'?'font-semibold text-amber-600':'font-semibold text-slate-900'}`}>{wh.hotel}</td><td className="py-2 pr-2"><button type="button" disabled={busy} onClick={()=>void toggleWorkerActive(w)} className={`rounded-full border px-3 py-1 text-xs font-bold disabled:opacity-50 ${w.active?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-slate-100 text-slate-500'}`}>{w.active?'Activo':'Inactivo'}</button></td><td className="py-2 pr-2"><button type="button" onClick={e=>openWorkerMenu(e,w.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreVertical className="h-4 w-4"/></button></td></tr>})}{!pagedWorkers.length&&<tr><td colSpan={10} className="py-6 text-center text-slate-400">Sin resultados</td></tr>}</tbody></table></div>
  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm"><label className="flex items-center gap-2 text-slate-500">Mostrar<select className="rounded-lg border border-slate-200 px-2 py-1 font-semibold text-slate-700" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>por página</label><div className="flex items-center gap-2"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 disabled:opacity-40">Anterior</button><span className="text-slate-500">Página {page} de {pageCount}</span><button type="button" disabled={page>=pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 disabled:opacity-40">Siguiente</button></div></div></section>}
 {menuWorker&&menuPos&&<><div className="fixed inset-0 z-40" onClick={()=>setMenuFor(null)}/><div className="fixed z-50 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" style={{top:menuPos.top,left:menuPos.left}}><button type="button" onClick={()=>{setEditWorker(menuWorker);setMenuFor(null)}} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4"/>Editar</button><button type="button" onClick={()=>{setMenuFor(null);void toggleWorkerActive(menuWorker)}} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Power className="h-4 w-4"/>{menuWorker.active?'Desactivar':'Activar'}</button><button type="button" onClick={()=>void deleteWorker(menuWorker)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/>Eliminar</button></div></>}
 {section==='hotels'&&<section className="rounded-2xl bg-white p-5 lg:col-span-2"><h2 className="mb-4 flex gap-2 font-black"><Hotel className="text-slate-900"/>Hospedajes</h2>{data?.hotels.map(h=><div key={h.link_id} className="mb-2 flex items-center justify-between rounded-xl border p-3"><b className="text-sm">{h.name}</b><div className="flex items-center gap-3">{h.status==='accepted'?<button type="button" onClick={()=>void openHotelDetail(h)} className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"><Info className="h-3.5 w-3.5"/>Ver detalles</button>:<span className="text-xs font-bold uppercase text-amber-600">{h.status}</span>}</div></div>)}{data?.available_hotels.map(h=><button key={h.id} onClick={()=>void link(h.id)} className="mb-2 flex w-full justify-between rounded-xl border p-3 text-sm font-bold">{h.name}<Plus className="h-4 w-4 text-slate-900"/></button>)}</section>}
 {section==='assignments'&&<section className="rounded-2xl bg-white p-5 lg:col-span-2"><h2 className="mb-2 flex gap-2 font-black"><Send className="text-slate-900"/>Nueva asignación</h2><p className="mb-4 text-sm text-slate-500">Selecciona trabajadores primero en la sección Trabajadores.</p><form onSubmit={send} className="grid gap-3 md:grid-cols-5"><select required className={field} value={trip.hotel} onChange={e=>setTrip({...trip,hotel:e.target.value})}><option value="">Hospedaje vinculado</option>{data?.hotels.filter(h=>h.status==='accepted').map(h=><option key={h.tenant_id} value={h.tenant_id}>{h.name}</option>)}</select><div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha de entrada</label><input required type="date" className={field} value={trip.checkIn} onChange={e=>{const checkIn=e.target.value;setTrip({...trip,checkIn,checkOut:checkIn?addDays(checkIn,trip.days):trip.checkOut})}}/></div><div><label className="mb-1 block text-xs font-semibold text-slate-500">Días</label><input required type="number" min={1} className={field} value={trip.days} onChange={e=>{const days=Math.max(1,Number(e.target.value)||1);setTrip({...trip,days,checkOut:trip.checkIn?addDays(trip.checkIn,days):trip.checkOut})}}/></div><div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha de salida</label><input required type="date" className={field} value={trip.checkOut} onChange={e=>{const checkOut=e.target.value;setTrip({...trip,checkOut,days:trip.checkIn&&checkOut?Math.max(1,diffDays(trip.checkIn,checkOut)):trip.days})}}/></div><input className={field} placeholder="Comentarios" value={trip.notes} onChange={e=>setTrip({...trip,notes:e.target.value})}/><button disabled={!selected.length||busy} className="rounded-xl bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-40 md:col-span-5">Enviar {selected.length||''} trabajador(es)</button></form></section>}
 {section==='tracking'&&<section className="rounded-2xl bg-white p-5 lg:col-span-2"><h2 className="mb-4 font-black">¿Dónde están mis trabajadores?</h2><div className="grid gap-3 md:grid-cols-2">{data?.assignments.map(a=><article key={a.id} className="rounded-xl border p-4"><b>{a.hotel}</b><p className="text-xs text-slate-500">{a.check_in_date} — {a.check_out_date}</p>{a.workers?.map(w=><div key={w.dni} className="mt-2 flex text-sm"><b>{w.name}</b><span className="ml-auto text-xs text-slate-500">{w.status==='reviewed'?'Asignado':w.status==='discarded'?'Rechazado':'Pendiente'}</span></div>)}</article>)}</div></section>}</div>
 {showAddWorker&&<div className={iosOverlay}><div className={iosSheet}>
  <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden"/>
  <div className="flex items-start justify-between px-5 pt-4"><div><h3 className="text-xl font-bold text-slate-900">Agregar trabajador</h3><p className="mt-0.5 text-sm text-slate-400">Se agrega a la lista de Trabajadores</p></div><button type="button" onClick={()=>setShowAddWorker(false)} className="rounded-full bg-slate-100 p-1.5 text-slate-500"><X className="h-4 w-4"/></button></div>
  <form onSubmit={addWorker} className="mt-4 space-y-4 pb-2">
    <div><p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Identificación</p><div className={iosGroup}><div><label className={iosFieldLabel}>DNI</label><input required autoFocus inputMode="numeric" className={iosField} placeholder="12345678" value={worker.dni} onChange={e=>setWorker({...worker,dni:e.target.value.replace(/\D/g,'')})}/></div></div></div>
    <div><p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre completo</p><div className={iosGroup}>
      <div><label className={iosFieldLabel}>Nombres</label><input required className={iosField} placeholder="Carlos" value={worker.first_name} onChange={e=>setWorker({...worker,first_name:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Ap. paterno</label><input className={iosField} placeholder="Quispe" value={worker.paternal_surname} onChange={e=>setWorker({...worker,paternal_surname:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Ap. materno</label><input className={iosField} placeholder="Mamani" value={worker.maternal_surname} onChange={e=>setWorker({...worker,maternal_surname:e.target.value})}/></div>
    </div></div>
    <div><p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto y asignación</p><div className={iosGroup}>
      <div><label className={iosFieldLabel}>Teléfono</label><input className={iosField} placeholder="987 654 321" value={worker.phone} onChange={e=>setWorker({...worker,phone:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Cargo</label><input className={iosField} placeholder="Obrero" value={worker.position} onChange={e=>setWorker({...worker,position:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Proyecto</label><input className={iosField} placeholder="Torre Central" value={worker.project} onChange={e=>setWorker({...worker,project:e.target.value})}/></div>
    </div></div>
    <button disabled={busy} className={iosPill}><Plus className="h-4 w-4"/>{busy?'Agregando...':'Agregar trabajador'}</button>
  </form>
 </div></div>}
 {showAssign&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl bg-white p-5"><div className="mb-1 flex items-center justify-between"><h3 className="flex gap-2 font-black"><Send className="text-amber-600"/>Nueva asignación</h3><button type="button" onClick={()=>setShowAssign(false)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5"/></button></div><p className="mb-4 text-sm text-slate-500">Enviando {selected.length} trabajador(es) seleccionado(s).</p><form onSubmit={send} className="grid gap-3"><select required autoFocus className={field} value={trip.hotel} onChange={e=>setTrip({...trip,hotel:e.target.value})}><option value="">Hospedaje vinculado</option>{data?.hotels.filter(h=>h.status==='accepted').map(h=><option key={h.tenant_id} value={h.tenant_id}>{h.name}</option>)}</select><div className="grid gap-3 sm:grid-cols-3"><div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha de entrada</label><input required type="date" className={field} value={trip.checkIn} onChange={e=>{const checkIn=e.target.value;setTrip({...trip,checkIn,checkOut:checkIn?addDays(checkIn,trip.days):trip.checkOut})}}/></div><div><label className="mb-1 block text-xs font-semibold text-slate-500">Días</label><input required type="number" min={1} className={field} value={trip.days} onChange={e=>{const days=Math.max(1,Number(e.target.value)||1);setTrip({...trip,days,checkOut:trip.checkIn?addDays(trip.checkIn,days):trip.checkOut})}}/></div><div><label className="mb-1 block text-xs font-semibold text-slate-500">Fecha de salida</label><input required type="date" className={field} value={trip.checkOut} onChange={e=>{const checkOut=e.target.value;setTrip({...trip,checkOut,days:trip.checkIn&&checkOut?Math.max(1,diffDays(trip.checkIn,checkOut)):trip.days})}}/></div></div><input className={field} placeholder="Comentarios" value={trip.notes} onChange={e=>setTrip({...trip,notes:e.target.value})}/><button disabled={!selected.length||busy} className="mt-1 rounded-xl bg-slate-900 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-40">Enviar {selected.length||''} trabajador(es)</button></form></div></div>}
 {lastAssignment&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl bg-white p-5"><div className="mb-1 flex items-center justify-between"><h3 className="flex gap-2 font-black"><Send className="text-amber-600"/>Avisar al hospedaje</h3><button type="button" onClick={()=>setLastAssignment(null)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5"/></button></div><p className="mb-3 text-sm text-slate-500">¿Enviar esta asignación a <b>{lastAssignment.hotelName}</b> por WhatsApp?</p><pre className="mb-4 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{assignmentMessage}</pre>{!lastAssignment.hotelPhone&&<p className="mb-3 text-xs font-semibold text-amber-600">Este hospedaje no tiene teléfono de contacto registrado.</p>}<div className="flex gap-2"><button type="button" onClick={()=>setLastAssignment(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600">Ahora no</button>{lastAssignment.hotelPhone&&<a href={`https://wa.me/${waNumber(lastAssignment.hotelPhone)}?text=${encodeURIComponent(assignmentMessage)}`} target="_blank" rel="noopener noreferrer" onClick={()=>setLastAssignment(null)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-2.5 text-sm font-bold text-white">Enviar por WhatsApp</a>}</div></div></div>}
 {showImport&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-2xl bg-white p-5"><div className="mb-1 flex items-center justify-between"><h3 className="flex gap-2 font-black"><Upload className="text-amber-600"/>Importar trabajadores</h3><button type="button" onClick={closeImport} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5"/></button></div><p className="mb-4 text-sm text-slate-500">Sube un Excel (.xlsx) y elige qué columna del archivo corresponde a cada dato. Si el DNI ya existe, se actualiza; si no, se crea.</p>
  {!importSheet&&<label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-sm font-semibold text-slate-500 hover:border-amber-400 hover:text-amber-600"><Upload className="h-6 w-6"/>Seleccionar archivo .xlsx<input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>void onImportFile(e)}/></label>}
  {importSheet&&<><div className="grid gap-3 sm:grid-cols-4">{([['dni','DNI *'],['first_name','Nombres *'],['paternal_surname','Apellido paterno'],['maternal_surname','Apellido materno'],['phone','Teléfono'],['position','Cargo'],['project','Proyecto']] as const).map(([key,label])=><div key={key}><label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label><select className={field} value={importMap[key]} onChange={e=>setImportMap({...importMap,[key]:e.target.value})}><option value="">No importar</option>{importSheet.headers.map((h,idx)=><option key={idx} value={idx}>{h||`Columna ${idx+1}`}</option>)}</select></div>)}</div>
  <p className="mt-3 text-xs text-slate-500">{importSheet.rows.length} fila(s) detectada(s) en el archivo.</p>
  {importMap.dni!==''&&importMap.first_name!==''&&<div className="mt-2 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr className="border-b bg-slate-50 text-slate-500"><th className="px-2 py-1.5">DNI</th><th className="px-2 py-1.5">Nombres</th><th className="px-2 py-1.5">Ap. paterno</th><th className="px-2 py-1.5">Ap. materno</th><th className="px-2 py-1.5">Teléfono</th><th className="px-2 py-1.5">Cargo</th><th className="px-2 py-1.5">Proyecto</th></tr></thead><tbody>{importSheet.rows.slice(0,5).map((r,i)=><tr key={i} className="border-b last:border-0"><td className="px-2 py-1.5">{r[Number(importMap.dni)]}</td><td className="px-2 py-1.5">{r[Number(importMap.first_name)]}</td><td className="px-2 py-1.5">{importMap.paternal_surname!==''?r[Number(importMap.paternal_surname)]:'—'}</td><td className="px-2 py-1.5">{importMap.maternal_surname!==''?r[Number(importMap.maternal_surname)]:'—'}</td><td className="px-2 py-1.5">{importMap.phone!==''?r[Number(importMap.phone)]:'—'}</td><td className="px-2 py-1.5">{importMap.position!==''?r[Number(importMap.position)]:'—'}</td><td className="px-2 py-1.5">{importMap.project!==''?r[Number(importMap.project)]:'—'}</td></tr>)}</tbody></table></div>}
  {importResult&&<p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{importResult}</p>}
  <div className="mt-4 flex gap-2"><button type="button" onClick={closeImport} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600">{importResult?'Cerrar':'Cancelar'}</button>{!importResult&&<button type="button" disabled={busy||importMap.dni===''||importMap.first_name===''} onClick={()=>void runImport()} className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy?'Importando...':`Importar ${importSheet.rows.length} fila(s)`}</button>}</div></>}
 </div></div>}
 {hotelDetail&&!showValuation&&<div className={iosOverlay}><div className={iosSheet}>
  <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden"/>
  <div className="flex items-start justify-between px-5 pt-4"><div><h3 className="text-xl font-bold text-slate-900">{hotelDetail.name}</h3><p className="mt-0.5 text-sm text-slate-400">Detalle del hospedaje</p></div><button type="button" onClick={()=>setHotelDetail(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500"><X className="h-4 w-4"/></button></div>
  <div className="mt-4 px-4"><div className={iosDetailGroup}>
    <div className={iosDetailRow}><Phone className="h-4 w-4 shrink-0 text-slate-400"/><span className="flex-1 text-[15px] text-slate-500">Teléfono</span><span className="text-[15px] font-semibold text-slate-900">{hotelDetail.contact_phone||'No registrado'}</span></div>
    <div className={iosDetailRow}><BedDouble className="h-4 w-4 shrink-0 text-slate-400"/><span className="flex-1 text-[15px] text-slate-500">Habitaciones disponibles</span><span className="text-[15px] font-semibold text-slate-900">{hotelDetail.rooms_available} / {hotelDetail.rooms_total}</span></div>
    <div className={iosDetailRow}><Users className="h-4 w-4 shrink-0 text-slate-400"/><span className="flex-1 text-[15px] text-slate-500">Trabajadores ahí</span><span className="text-[15px] font-semibold text-slate-900">{hotelDetail.workers_here}</span></div>
  </div></div>
  <button type="button" disabled={busy} onClick={()=>void openValuation()} className={iosPill}><FileSpreadsheet className="h-4 w-4"/>Generar valorización</button>
 </div></div>}
 {showValuation&&hotelDetail&&<div className={iosOverlay}><div className={iosSheet}>
  <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden"/>
  <div className="flex items-start justify-between px-5 pt-4"><div><h3 className="text-xl font-bold text-slate-900">Generar valorización</h3><p className="mt-0.5 text-sm text-slate-400">{hotelDetail.name} · solo tus trabajadores</p></div><button type="button" onClick={()=>setShowValuation(false)} className="rounded-full bg-slate-100 p-1.5 text-slate-500"><X className="h-4 w-4"/></button></div>
  <div className="mt-4 space-y-4 px-4 pb-2">
    <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Periodo</p><div className={`${iosGroup} grid-cols-2`}>
      <div><label className={iosFieldLabel}>Desde</label><input type="date" className={iosField} value={valuation.startDate} onChange={e=>setValuation({...valuation,startDate:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Hasta</label><input type="date" className={iosField} value={valuation.endDate} onChange={e=>setValuation({...valuation,endDate:e.target.value})}/></div>
    </div></div>
    <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Tarifas por día (S/)</p><div className={`${iosGroup} grid-cols-3`}>
      <div><label className={iosFieldLabel}>Obrero</label><input type="number" step="0.01" className={iosField} value={valuation.obrero} onChange={e=>setValuation({...valuation,obrero:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Empleado</label><input type="number" step="0.01" className={iosField} value={valuation.empleado} onChange={e=>setValuation({...valuation,empleado:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Staff</label><input type="number" step="0.01" className={iosField} value={valuation.staff} onChange={e=>setValuation({...valuation,staff:e.target.value})}/></div>
    </div></div>
    <div className="mx-4 mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={valuationBusy} onClick={()=>void downloadValuationExcel()} className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 py-3.5 text-[15px] font-bold text-white active:bg-emerald-700 disabled:opacity-40"><Download className="h-4 w-4"/>Excel</button><button type="button" disabled={valuationBusy} onClick={()=>void downloadValuationPdf()} className="flex items-center justify-center gap-2 rounded-full bg-red-600 py-3.5 text-[15px] font-bold text-white active:bg-red-700 disabled:opacity-40"><FileSpreadsheet className="h-4 w-4"/>PDF</button></div>
    {valuationBusy&&<p className="mt-2 text-center text-xs text-slate-400">Generando...</p>}
  </div>
 </div></div>}
 {editWorker&&<div className={iosOverlay}><div className={iosSheet}>
  <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden"/>
  <div className="flex items-start justify-between px-5 pt-4"><div><h3 className="text-xl font-bold text-slate-900">Editar trabajador</h3><p className="mt-0.5 text-sm text-slate-400">{editWorker.name}</p></div><button type="button" onClick={()=>setEditWorker(null)} className="rounded-full bg-slate-100 p-1.5 text-slate-500"><X className="h-4 w-4"/></button></div>
  <form onSubmit={saveEditWorker} className="mt-4 space-y-4 pb-2">
    <div><p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Identificación</p><div className={iosGroup}><div><label className={iosFieldLabel}>DNI</label><input required autoFocus inputMode="numeric" className={iosField} value={editWorker.dni} onChange={e=>setEditWorker({...editWorker,dni:e.target.value.replace(/\D/g,'')})}/></div></div></div>
    <div><p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre completo</p><div className={iosGroup}>
      <div><label className={iosFieldLabel}>Nombres</label><input required className={iosField} value={editWorker.first_name} onChange={e=>setEditWorker({...editWorker,first_name:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Ap. paterno</label><input className={iosField} value={editWorker.paternal_surname} onChange={e=>setEditWorker({...editWorker,paternal_surname:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Ap. materno</label><input className={iosField} value={editWorker.maternal_surname} onChange={e=>setEditWorker({...editWorker,maternal_surname:e.target.value})}/></div>
    </div></div>
    <div><p className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto y asignación</p><div className={iosGroup}>
      <div><label className={iosFieldLabel}>Teléfono</label><input className={iosField} value={editWorker.phone} onChange={e=>setEditWorker({...editWorker,phone:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Cargo</label><input className={iosField} value={editWorker.position} onChange={e=>setEditWorker({...editWorker,position:e.target.value})}/></div>
      <div><label className={iosFieldLabel}>Proyecto</label><input className={iosField} value={editWorker.project} onChange={e=>setEditWorker({...editWorker,project:e.target.value})}/></div>
    </div></div>
    <button disabled={busy} className={iosPill}><Pencil className="h-4 w-4"/>{busy?'Guardando...':'Guardar cambios'}</button>
  </form>
 </div></div>}
 </main>
}
