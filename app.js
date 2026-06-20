let db = null;
let currentUser = null;
let currentProfile = null;
let currentLocation = null;
let currentDistance = null;
let photoBlob = null;
let reportRows = [];

function $(id){ return document.getElementById(id); }

function getConfig(){
  const c = window.SHELL_PONTO_CONFIG || {};
  return {
    url: localStorage.getItem("SUPABASE_URL") || c.SUPABASE_URL || "",
    key: localStorage.getItem("SUPABASE_KEY") || c.SUPABASE_ANON_KEY || "",
    lat: Number(localStorage.getItem("STORE_LATITUDE") || c.STORE_LATITUDE || 0),
    lon: Number(localStorage.getItem("STORE_LONGITUDE") || c.STORE_LONGITUDE || 0),
    radius: Number(localStorage.getItem("ALLOWED_RADIUS_METERS") || c.ALLOWED_RADIUS_METERS || 120),
    store: localStorage.getItem("STORE_NAME") || c.STORE_NAME || "Shell Café"
  };
}

function initConfigFields(){
  const c = getConfig();
  $("cfgUrl").value = c.url;
  $("cfgKey").value = c.key;
  $("cfgLat").value = c.lat || "";
  $("cfgLon").value = c.lon || "";
  $("cfgRadius").value = c.radius;
  $("cfgStore").value = c.store;
  $("storeInfo").innerText = `${c.store} | Raio permitido: ${c.radius}m`;
}

function connect(){
  const c = getConfig();
  if(!c.url || !c.key) return null;
  db = supabase.createClient(c.url, c.key);
  return db;
}

function saveConfig(){
  localStorage.setItem("SUPABASE_URL", $("cfgUrl").value.trim());
  localStorage.setItem("SUPABASE_KEY", $("cfgKey").value.trim());
  localStorage.setItem("STORE_LATITUDE", $("cfgLat").value.trim());
  localStorage.setItem("STORE_LONGITUDE", $("cfgLon").value.trim());
  localStorage.setItem("ALLOWED_RADIUS_METERS", $("cfgRadius").value.trim());
  localStorage.setItem("STORE_NAME", $("cfgStore").value.trim());
  connect();
  initConfigFields();
  alert("Configuração salva.");
}

function show(el, msg, type=""){
  el.className = "status " + type;
  el.innerText = msg;
  el.classList.remove("hidden");
}

function hide(el){ el.classList.add("hidden"); }

async function login(){
  connect();
  if(!db) return show($("loginMsg"), "Configure o Supabase primeiro.", "err");
  const email = $("loginEmail").value.trim();
  const password = $("loginPass").value;

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if(error) return show($("loginMsg"), "Erro: " + error.message, "err");

  currentUser = data.user;
  await loadProfile();
}

async function logout(){
  if(db) await db.auth.signOut();
  location.reload();
}

async function checkSession(){
  connect();
  if(!db) return;
  const { data } = await db.auth.getUser();
  if(data.user){
    currentUser = data.user;
    await loadProfile();
  }
}

async function loadProfile(){
  const { data, error } = await db.from("profiles").select("*").eq("id", currentUser.id).single();
  if(error || !data){
    show($("loginMsg"), "Usuário sem perfil. Cadastre o UID dele na tabela profiles.", "err");
    return;
  }

  currentProfile = data;
  $("configCard").classList.add("hidden");
  $("loginCard").classList.add("hidden");
  $("appCard").classList.remove("hidden");
  $("userTitle").innerText = `${data.name} | ${data.role === "admin" ? "Administrador" : "Funcionário"}`;

  if(data.role === "admin"){
    $("tabRelatorios").classList.remove("hidden");
    $("tabFuncionarios").classList.remove("hidden");
    await loadEmployees();
    await loadReport();
  }

  await loadMyPunches();
}

function openTab(tab){
  ["ponto","meus","relatorios","funcionarios"].forEach(id => $(id).classList.add("hidden"));
  ["tabPonto","tabMeus","tabRelatorios","tabFuncionarios"].forEach(id => $(id).classList.remove("active"));
  $(tab).classList.remove("hidden");
  $("tab" + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add("active");
}

function distanceInMeters(lat1, lon1, lat2, lon2){
  const R = 6371000;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function captureLocation(){
  const c = getConfig();
  if(!navigator.geolocation) return show($("geoMsg"), "Seu navegador não suporta GPS.", "err");

  show($("geoMsg"), "Capturando localização...", "warn");
  navigator.geolocation.getCurrentPosition(pos => {
    currentLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    currentDistance = distanceInMeters(currentLocation.latitude, currentLocation.longitude, c.lat, c.lon);
    const type = currentDistance <= c.radius ? "ok" : "err";
    show($("geoMsg"), `Localização capturada. Distância da loja: ${Math.round(currentDistance)}m`, type);
  }, () => {
    show($("geoMsg"), "Não consegui pegar a localização. Autorize o GPS.", "err");
  }, { enableHighAccuracy:true, timeout:12000 });
}

async function startCamera(){
  const video = $("video");
  const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"user" }, audio:false });
  video.srcObject = stream;
}

function takePhoto(){
  const video = $("video");
  const canvas = $("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    photoBlob = blob;
    $("photoPreview").src = URL.createObjectURL(blob);
    $("photoPreview").classList.remove("hidden");
    show($("punchMsg"), "Selfie capturada.", "ok");
  }, "image/jpeg", 0.85);
}

async function registerPunch(){
  const c = getConfig();
  if(!currentLocation) return show($("punchMsg"), "Capture a localização primeiro.", "err");
  if(currentDistance > c.radius) return show($("punchMsg"), `Bloqueado. Você está a ${Math.round(currentDistance)}m da loja.`, "err");
  if(!photoBlob) return show($("punchMsg"), "Tire uma selfie primeiro.", "err");

  show($("punchMsg"), "Registrando ponto...", "warn");
  const type = $("punchType").value;
  const filePath = `${currentUser.id}/${Date.now()}-${type}.jpg`;

  const up = await db.storage.from("ponto-selfies").upload(filePath, photoBlob, {
    contentType: "image/jpeg",
    upsert: false
  });
  if(up.error) return show($("punchMsg"), "Erro ao enviar selfie: " + up.error.message, "err");

  const { error } = await db.from("time_punches").insert([{
    user_id: currentUser.id,
    type,
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    distance_meters: Math.round(currentDistance),
    selfie_path: filePath,
    note: $("punchNote").value.trim(),
    device_info: navigator.userAgent
  }]);

  if(error) return show($("punchMsg"), "Erro ao registrar: " + error.message, "err");

  await db.from("audit_logs").insert([{
    actor_id: currentUser.id,
    action: "register_punch",
    entity: "time_punches",
    details: { type, distance_meters: Math.round(currentDistance) }
  }]);

  $("punchNote").value = "";
  photoBlob = null;
  $("photoPreview").classList.add("hidden");
  show($("punchMsg"), "Ponto registrado com sucesso.", "ok");
  await loadMyPunches();
}

function labelType(t){
  return {
    entrada:"Entrada",
    saida_intervalo:"Saída intervalo",
    volta_intervalo:"Volta intervalo",
    saida:"Saída"
  }[t] || t;
}

async function loadMyPunches(){
  if(!currentUser) return;
  const { data } = await db.from("time_punches")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("punched_at", { ascending:false })
    .limit(100);

  $("myPunchesTable").innerHTML = (data || []).map(r => `
    <tr>
      <td>${new Date(r.punched_at).toLocaleString("pt-BR")}</td>
      <td>${labelType(r.type)}</td>
      <td>${r.distance_meters || "-"}m</td>
      <td>${r.note || "-"}</td>
    </tr>
  `).join("");
}

async function loadEmployees(){
  const { data } = await db.from("profiles").select("*").order("name");
  const rows = data || [];

  $("employeesTable").innerHTML = rows.map(e => `
    <tr>
      <td>${e.name}</td><td>${e.email || ""}</td><td>${e.shift || ""}</td><td>${e.position || ""}</td><td>${e.role}</td><td>${e.active ? "Ativo" : "Inativo"}</td>
    </tr>
  `).join("");

  $("filterEmployee").innerHTML = '<option value="">Todos</option>' + rows.map(e => `<option value="${e.id}">${e.name}</option>`).join("");
}

async function saveEmployee(){
  const obj = {
    id: $("empUid").value.trim(),
    name: $("empName").value.trim(),
    email: $("empEmail").value.trim(),
    shift: $("empShift").value,
    position: $("empPosition").value.trim(),
    role: $("empRole").value,
    active: true
  };

  if(!obj.id || !obj.name || !obj.email) return alert("Informe UID, nome e e-mail.");

  const { error } = await db.from("profiles").upsert([obj]);
  if(error) return alert("Erro: " + error.message);

  $("empUid").value = ""; $("empName").value = ""; $("empEmail").value = "";
  await loadEmployees();
  alert("Funcionário salvo.");
}

async function loadReport(){
  let query = db.from("time_punches")
    .select("*, profiles:user_id(name,email,shift,position)")
    .order("punched_at", { ascending:false })
    .limit(1000);

  const emp = $("filterEmployee").value;
  const start = $("filterStart").value;
  const end = $("filterEnd").value;

  if(emp) query = query.eq("user_id", emp);
  if(start) query = query.gte("punched_at", start + "T00:00:00");
  if(end) query = query.lte("punched_at", end + "T23:59:59");

  const { data, error } = await query;
  if(error) return alert("Erro: " + error.message);

  reportRows = data || [];
  $("kpiTotal").innerText = reportRows.length;
  $("kpiEntrada").innerText = reportRows.filter(r => r.type === "entrada").length;
  $("kpiSaida").innerText = reportRows.filter(r => r.type === "saida").length;

  $("reportTable").innerHTML = reportRows.map(r => `
    <tr>
      <td>${new Date(r.punched_at).toLocaleString("pt-BR")}</td>
      <td>${r.profiles?.name || ""}<br><span class="small">${r.profiles?.email || ""}</span></td>
      <td>${r.profiles?.shift || ""}</td>
      <td>${labelType(r.type)}</td>
      <td>${r.distance_meters || "-"}m</td>
      <td>${r.note || "-"}</td>
    </tr>
  `).join("");
}

function exportCSV(){
  const rows = [["Data/Hora","Funcionário","Email","Turno","Tipo","Distância","Obs"]];
  reportRows.forEach(r => rows.push([
    new Date(r.punched_at).toLocaleString("pt-BR"),
    r.profiles?.name || "",
    r.profiles?.email || "",
    r.profiles?.shift || "",
    labelType(r.type),
    r.distance_meters || "",
    r.note || ""
  ]));

  const csv = rows.map(row => row.map(c => `"${String(c).replaceAll('"','""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio-ponto-shell-cafe.csv";
  a.click();
  URL.revokeObjectURL(url);
}

initConfigFields();
checkSession();
