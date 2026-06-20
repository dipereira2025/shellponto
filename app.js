let db=null,currentUser=null,currentProfile=null,currentStore=null;
let stores=[],employees=[],reportRows=[],currentLocation=null,currentDistance=null,photoBlob=null;

const $=id=>document.getElementById(id);
function cfg(){const c=window.SHELL_GESTAO_CONFIG||{};return{url:localStorage.getItem("SUPABASE_URL")||c.SUPABASE_URL||"",key:localStorage.getItem("SUPABASE_KEY")||c.SUPABASE_ANON_KEY||""}}
function connect(){const c=cfg(); if(!c.url||!c.key) return null; db=supabase.createClient(c.url,c.key); return db}
function show(el,msg,type=""){el.className="status "+type;el.innerText=msg;el.classList.remove("hidden")}
function saveConfig(){localStorage.setItem("SUPABASE_URL",$("cfgUrl").value.trim());localStorage.setItem("SUPABASE_KEY",$("cfgKey").value.trim());connect();alert("Configuração salva")}
function initFields(){const c=cfg();$("cfgUrl").value=c.url;$("cfgKey").value=c.key}
function isAdmin(){return currentProfile && ["super_admin","manager"].includes(currentProfile.role)}
function isSuper(){return currentProfile && currentProfile.role==="super_admin"}

async function login(){
  connect(); if(!db)return show($("loginMsg"),"Configure o Supabase primeiro.","err");
  const {data,error}=await db.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPass").value});
  if(error)return show($("loginMsg"),"Erro: "+error.message,"err");
  currentUser=data.user; await loadProfile();
}
async function logout(){if(db)await db.auth.signOut();location.reload()}
async function checkSession(){connect();if(!db)return;const{data}=await db.auth.getUser();if(data.user){currentUser=data.user;await loadProfile()}}

async function loadProfile(){
  const {data,error}=await db.from("profiles").select("*, stores(*)").eq("id",currentUser.id).single();
  if(error||!data)return show($("loginMsg"),"Usuário sem perfil ativo. Cadastre o perfil no Supabase.","err");
  if(!data.active)return show($("loginMsg"),"Usuário bloqueado. Fale com o administrador.","err");
  currentProfile=data; currentStore=data.stores;
  $("configCard").classList.add("hidden");$("loginCard").classList.add("hidden");$("appCard").classList.remove("hidden");
  $("userTitle").innerText=`${data.name} | ${roleLabel(data.role)}`;
  $("userStore").innerText=currentStore?`Loja: ${currentStore.name}`:"Sem loja vinculada";
  if(isAdmin()) document.querySelectorAll(".adminOnly").forEach(e=>e.classList.remove("hidden"));
  if(isSuper()) document.querySelectorAll(".superOnly").forEach(e=>e.classList.remove("hidden"));
  await loadStores(); await loadEmployees(); await loadMyPunches(); await loadOccurrences(); await loadChecklists(); await loadDashboard();
}
function roleLabel(r){return{employee:"Funcionário",manager:"Gerente",super_admin:"Super Admin"}[r]||r}
function openTab(tab){["dashboard","ponto","meus","checklist","ocorrencias","relatorios","funcionarios","lojas"].forEach(id=>$(id).classList.add("hidden"));["tabDashboard","tabPonto","tabMeus","tabChecklist","tabOcorrencias","tabRelatorios","tabFuncionarios","tabLojas"].forEach(id=>$(id).classList.remove("active"));$(tab).classList.remove("hidden");$("tab"+tab.charAt(0).toUpperCase()+tab.slice(1)).classList.add("active")}

async function loadStores(){
  let q=db.from("stores").select("*").order("name");
  if(!isSuper() && currentProfile.store_id) q=q.eq("id",currentProfile.store_id);
  const {data}=await q; stores=data||[];
  fillStoreSelects(); renderStores();
}
function fillStoreSelects(){
  const ids=["checkStore","occStore","filterStore","empStore"];
  ids.forEach(id=>{if(!$(id))return; const first=id==="filterStore"?'<option value="">Todas</option>':""; $(id).innerHTML=first+stores.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")});
  if(currentProfile.store_id){["checkStore","occStore","empStore"].forEach(id=>{$(id).value=currentProfile.store_id})}
}
async function seedStores(){
  const defaults=["Shell Café Samambaia Norte","Shell Café Samambaia Sul","Shell Café Riacho Fundo II","Shell Café QS 07","Point do Café Setor O"].map(name=>({name,reference:"Ajustar endereço/CEP",radius_meters:150,active:true}));
  const {error}=await db.from("stores").insert(defaults); if(error)return alert(error.message); await loadStores();
}
async function saveStore(){
  const obj={name:$("storeName").value.trim(),reference:$("storeCep").value.trim(),radius_meters:Number($("storeRadius").value||150),latitude:$("storeLat").value?Number($("storeLat").value):null,longitude:$("storeLon").value?Number($("storeLon").value):null,active:$("storeActive").value==="true"};
  if(!obj.name)return alert("Informe o nome da loja");
  const{error}=await db.from("stores").insert([obj]); if(error)return alert(error.message); await loadStores(); alert("Loja salva")
}
function renderStores(){
  if(!$("storesTable"))return;
  $("storesTable").innerHTML=stores.map(s=>`<tr><td>${s.name}</td><td>${s.reference||""}</td><td>${s.radius_meters||150}m</td><td>${s.latitude&&s.longitude?`${s.latitude}, ${s.longitude}`:"Não definido"}</td><td>${s.active?"Ativa":"Inativa"}</td></tr>`).join("");
}

async function loadEmployees(){
  let q=db.from("profiles").select("*, stores(name)").order("name");
  if(currentProfile?.role==="manager") q=q.eq("store_id",currentProfile.store_id);
  const{data}=await q; employees=data||[];
  $("employeesTable").innerHTML=employees.map(e=>`<tr><td>${e.name}</td><td>${e.email||""}</td><td>${e.stores?.name||""}</td><td>${e.shift||""}</td><td>${e.position||""}</td><td>${roleLabel(e.role)}</td><td>${e.active?"Ativo":"Bloqueado"}</td></tr>`).join("");
  $("filterEmployee").innerHTML='<option value="">Todos</option>'+employees.map(e=>`<option value="${e.id}">${e.name}</option>`).join("");
}
async function createUserFromAdmin(){
  const payload={name:$("empName").value.trim(),email:$("empEmail").value.trim(),password:$("empPassword").value,store_id:$("empStore").value,shift:$("empShift").value,position:$("empPosition").value.trim(),role:$("empRole").value,active:$("empActive").value==="true"};
  if(!payload.name||!payload.email||!payload.password||!payload.store_id)return alert("Preencha nome, e-mail, senha e loja");
  const {data:session}=await db.auth.getSession();
  const res=await fetch("/api/admin-users",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.session.access_token},body:JSON.stringify(payload)});
  const out=await res.json().catch(()=>({error:"Erro inesperado"}));
  if(!res.ok)return alert("Erro: "+(out.error||"não foi possível criar"));
  await loadEmployees(); alert("Usuário criado com sucesso");
}

function distanceInMeters(lat1,lon1,lat2,lon2){const R=6371000,toRad=v=>v*Math.PI/180,dLat=toRad(lat2-lat1),dLon=toRad(lon2-lon1),a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
function captureLocation(){
  if(!navigator.geolocation)return show($("geoMsg"),"Navegador sem GPS.","err");
  show($("geoMsg"),"Capturando localização...","warn");
  navigator.geolocation.getCurrentPosition(pos=>{
    currentLocation={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
    if(currentStore?.latitude&&currentStore?.longitude){currentDistance=distanceInMeters(currentLocation.latitude,currentLocation.longitude,currentStore.latitude,currentStore.longitude);show($("geoMsg"),`Distância da loja: ${Math.round(currentDistance)}m`, currentDistance>(currentStore.radius_meters||150)?"warn":"ok")}
    else{currentDistance=null;show($("geoMsg"),"Localização capturada. Coordenadas da loja ainda não foram configuradas.","warn")}
  },()=>show($("geoMsg"),"Autorize o GPS do navegador.","err"),{enableHighAccuracy:true,timeout:12000})
}
async function startCamera(){const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});$("video").srcObject=stream}
function takePhoto(){const v=$("video"),c=$("canvas");c.width=v.videoWidth||640;c.height=v.videoHeight||480;c.getContext("2d").drawImage(v,0,0,c.width,c.height);c.toBlob(b=>{photoBlob=b;$("photoPreview").src=URL.createObjectURL(b);$("photoPreview").classList.remove("hidden");show($("punchMsg"),"Selfie capturada.","ok")},"image/jpeg",.85)}
function labelType(t){return{entrada:"Entrada",saida_intervalo:"Saída intervalo",volta_intervalo:"Volta intervalo",saida:"Saída"}[t]||t}
async function registerPunch(){
  if(!currentLocation) captureLocation();
  show($("punchMsg"),"Registrando ponto...","warn");
  let selfie_path=null,type=$("punchType").value;
  if(photoBlob){const path=`${currentUser.id}/${Date.now()}-${type}.jpg`;const up=await db.storage.from("ponto-selfies").upload(path,photoBlob,{contentType:"image/jpeg",upsert:false});if(!up.error) selfie_path=path}
  const {error}=await db.from("time_punches").insert([{user_id:currentUser.id,store_id:currentProfile.store_id,type,latitude:currentLocation?.latitude||null,longitude:currentLocation?.longitude||null,distance_meters:currentDistance?Math.round(currentDistance):null,outside_area:currentDistance&&currentStore?.radius_meters?currentDistance>currentStore.radius_meters:false,selfie_path,note:$("punchNote").value.trim(),device_info:navigator.userAgent}]);
  if(error)return show($("punchMsg"),"Erro: "+error.message,"err");
  $("punchNote").value="";photoBlob=null;$("photoPreview").classList.add("hidden");show($("punchMsg"),"Ponto registrado.","ok");await loadMyPunches();await loadDashboard();
}
async function loadMyPunches(){
  const{data}=await db.from("time_punches").select("*, stores(name)").eq("user_id",currentUser.id).order("punched_at",{ascending:false}).limit(100);
  $("myPunchesTable").innerHTML=(data||[]).map(r=>`<tr><td>${new Date(r.punched_at).toLocaleString("pt-BR")}</td><td>${labelType(r.type)}</td><td>${r.stores?.name||""}</td><td>${r.distance_meters?`${r.distance_meters}m`:"-"}</td><td>${r.note||"-"}</td></tr>`).join("")
}

const CHECKLISTS={
  chegada:["Se trajar adequadamente sem esquecer a touca","Conferência de caixa inicial","Olhar celular/WhatsApp para orientações do plantão anterior","Conferir máquina de café limpa e funcionando","Realizar 360 na loja","Realizar degelo dos produtos necessários","Limpeza mínima do período","Reposição em gôndolas, freezer e estufa","Contagem dos produtos por área"],
  durante_turno:["Manter loja limpa","Repor mercadorias","Conferir validade dos produtos","Organizar estufa e freezer","Atender pendências do turno","Registrar ocorrência se necessário"],
  passagem_turno:["Registrar ocorrências do turno","Informar produtos críticos","Informar divergências","Deixar caixa conferido","Avisar pendências ao próximo turno","Finalizar checklist"]
};
$("checkType").addEventListener("change",renderChecklistItems);
function renderChecklistItems(){const type=$("checkType").value;$("checkItems").innerHTML=CHECKLISTS[type].map((txt,i)=>`<label class="check-item"><input type="checkbox" class="checkItem" data-text="${txt}"> ${txt}</label>`).join("")}
async function saveChecklist(){
  const items=[...document.querySelectorAll(".checkItem")].map(i=>({text:i.dataset.text,done:i.checked}));
  const done=items.filter(i=>i.done).length,total=items.length;
  const{error}=await db.from("operational_checklists").insert([{store_id:$("checkStore").value,user_id:currentUser.id,type:$("checkType").value,items,notes:$("checkNotes").value.trim(),completed_count:done,total_count:total}]);
  if(error)return alert(error.message);$("checkNotes").value="";renderChecklistItems();await loadChecklists();alert("Checklist salvo")
}
async function loadChecklists(){
  let q=db.from("operational_checklists").select("*, stores(name), profiles(name)").order("created_at",{ascending:false}).limit(50);
  if(currentProfile?.role==="manager")q=q.eq("store_id",currentProfile.store_id);
  if(currentProfile?.role==="employee")q=q.eq("user_id",currentUser.id);
  const{data}=await q;
  $("checkTable").innerHTML=(data||[]).map(r=>`<tr><td>${new Date(r.created_at).toLocaleString("pt-BR")}</td><td>${r.stores?.name||""}</td><td>${r.type}</td><td>${r.profiles?.name||""}</td><td>${r.completed_count}/${r.total_count}</td></tr>`).join("")
}

async function saveOccurrence(){
  const text=$("occText").value.trim(); if(!text)return alert("Descreva a ocorrência");
  const{error}=await db.from("occurrences").insert([{store_id:$("occStore").value,user_id:currentUser.id,category:$("occCategory").value,description:text}]);
  if(error)return alert(error.message);$("occText").value="";await loadOccurrences();alert("Ocorrência registrada")
}
async function loadOccurrences(){
  let q=db.from("occurrences").select("*, stores(name), profiles(name)").order("created_at",{ascending:false}).limit(100);
  if(currentProfile?.role==="manager")q=q.eq("store_id",currentProfile.store_id);
  if(currentProfile?.role==="employee")q=q.eq("store_id",currentProfile.store_id);
  const{data}=await q;
  $("occTable").innerHTML=(data||[]).map(r=>`<tr><td>${new Date(r.created_at).toLocaleString("pt-BR")}</td><td>${r.stores?.name||""}</td><td>${r.category}</td><td>${r.profiles?.name||""}</td><td>${r.description}</td></tr>`).join("")
}

async function loadReport(){
  let q=db.from("time_punches").select("*, profiles:user_id(name,email,shift,position), stores(name)").order("punched_at",{ascending:false}).limit(1000);
  if(currentProfile.role==="manager")q=q.eq("store_id",currentProfile.store_id);
  if($("filterStore").value)q=q.eq("store_id",$("filterStore").value);
  if($("filterEmployee").value)q=q.eq("user_id",$("filterEmployee").value);
  if($("filterStart").value)q=q.gte("punched_at",$("filterStart").value+"T00:00:00");
  if($("filterEnd").value)q=q.lte("punched_at",$("filterEnd").value+"T23:59:59");
  const{data,error}=await q;if(error)return alert(error.message);reportRows=data||[];
  $("reportTable").innerHTML=reportRows.map(r=>`<tr><td>${new Date(r.punched_at).toLocaleString("pt-BR")}</td><td>${r.profiles?.name||""}</td><td>${r.stores?.name||""}</td><td>${r.profiles?.shift||""}</td><td>${labelType(r.type)}</td><td>${r.distance_meters?`${r.distance_meters}m`:"-"}</td><td>${r.outside_area?'<span class="danger">Fora da área</span>':'<span class="good">Ok</span>'}</td><td>${r.note||""}</td></tr>`).join("")
}
function exportCSV(){
  const rows=[["Data/Hora","Funcionário","Loja","Turno","Tipo","Distância","Status","Obs"]];
  reportRows.forEach(r=>rows.push([new Date(r.punched_at).toLocaleString("pt-BR"),r.profiles?.name||"",r.stores?.name||"",r.profiles?.shift||"",labelType(r.type),r.distance_meters||"",r.outside_area?"Fora da área":"Ok",r.note||""]));
  const csv=rows.map(row=>row.map(c=>`"${String(c).replaceAll('"','""')}"`).join(";")).join("\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="relatorio-ponto-shell-cafe-v4.csv";a.click();URL.revokeObjectURL(url)
}
async function loadDashboard(){
  const today=new Date();today.setHours(0,0,0,0);
  let emp=employees.filter(e=>e.active), q=db.from("time_punches").select("*, stores(name)").gte("punched_at",today.toISOString());
  if(currentProfile?.role==="manager")q=q.eq("store_id",currentProfile.store_id);
  if(currentProfile?.role==="employee")q=q.eq("store_id",currentProfile.store_id);
  const{data}=await q;const punches=data||[];
  $("dashEmployees").innerText=emp.length;$("dashPunches").innerText=punches.length;$("dashOutside").innerText=punches.filter(p=>p.outside_area).length;
  const lastByUser={}; punches.sort((a,b)=>new Date(a.punched_at)-new Date(b.punched_at)).forEach(p=>lastByUser[p.user_id]=p.type);
  $("dashWorking").innerText=Object.values(lastByUser).filter(t=>["entrada","volta_intervalo"].includes(t)).length;
  $("storeDash").innerHTML=stores.map(s=>{const sp=punches.filter(p=>p.store_id===s.id);const outside=sp.filter(p=>p.outside_area).length;return`<div class="store-card"><h3>${s.name}</h3><p>Registros hoje: <strong>${sp.length}</strong></p><p>Fora da área: <strong>${outside}</strong></p></div>`}).join("")
}

initFields();renderChecklistItems();checkSession();
