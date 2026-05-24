/* ═══════════════════════════════════════════════════════════
   ASTRA-LOGICA — Space Event Tracker  |  main.js
   Fixed: corrupt UTF-16 Copilot garbage removed, map fixed,
   dashboard data fixed, all -- dash issues resolved.
   ═══════════════════════════════════════════════════════════ */

const API = "http://localhost:5000/api";

// ── Starfield ────────────────────────────────────────────────
(function initStars() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let stars = [];
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      o: Math.random() * 0.6 + 0.1,
      s: Math.random() * 0.4 + 0.05,
      d: Math.random() < 0.5 ? 1 : -1,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.o += 0.003 * s.d;
      if (s.o > 0.8 || s.o < 0.05) s.d *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,215,240,${s.o})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", resize);
  resize();
  draw();
})();

// ── Clock ────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById("clock");
  if (el) el.textContent = new Date().toUTCString().replace("GMT", "UTC");
}
setInterval(updateClock, 1000);
updateClock();

// ── Navigation ───────────────────────────────────────────────
const navItems = document.querySelectorAll(".nav-item");
const pages    = document.querySelectorAll(".page");

function showPage(pageId) {
  pages.forEach(p => p.classList.remove("active"));
  navItems.forEach(n => n.classList.remove("active"));
  document.getElementById("page-" + pageId)?.classList.add("active");
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add("active");

  if (pageId === "dashboard")    loadDashboard();
  if (pageId === "events")       loadEvents(1);
  if (pageId === "eclipses")     loadEclipses("both", 1);
  if (pageId === "meteorites")   loadMeteors(1);
  if (pageId === "comets")       loadComets();
  if (pageId === "conjunctions") loadConjunctions();
  if (pageId === "observations") loadObservations();
  if (pageId === "locations")    loadLocations();
  if (pageId === "visibility")   loadVisibility();
  if (pageId === "admin")        loadAdminPage();
  // map: user clicks "Load Map" button manually
}

navItems.forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    showPage(item.dataset.page);
    if (window.innerWidth < 900) {
      document.getElementById("sidebar").classList.remove("open");
    }
  });
});

document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// ── API helpers ───────────────────────────────────────────────
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.error("Fetch error:", url, err);
    return null;
  }
}

function fmt(val, decimals = 2) {
  if (val == null || val === "") return "\u2014";
  const n = parseFloat(val);
  return isNaN(n) ? val : n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtDate(d) {
  if (!d) return "\u2014";
  let dateStr = String(d).trim();
  const match = dateStr.match(/^(\d{1,4})-(\d{2})-(\d{2})$/);
  if (match) dateStr = `${match[1].padStart(4,"0")}-${match[2]}-${match[3]}`;
  const date = new Date(dateStr + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return "\u2014";
  const year = date.getUTCFullYear();
  if (year < 0) return dateStr;
  return date.toLocaleDateString("en-GB", {
    year:"numeric", month:"short", day:"numeric", timeZone:"UTC"
  });
}

function typeBadge(type) {
  const map = {
    "Solar Eclipse":         ["solar",  "Solar Eclipse"],
    "Lunar Eclipse":         ["lunar",  "Lunar Eclipse"],
    "Meteorite Impact":      ["meteor", "Meteorite"],
    "Planetary Conjunction": ["conj",   "Conjunction"],
    "Comet Approach":        ["comet",  "Comet"],
  };
  const [cls, label] = map[type] || ["meteor", type];
  return `<span class="type-badge type-${cls}">${label}</span>`;
}

// ── DASHBOARD ─────────────────────────────────────────────────
let chartTimeline = null;
let chartTypes    = null;

async function loadDashboard() {
  const data = await fetchJSON(`${API}/stats`);
  if (!data) return;

  const typeMap = {};
  (data.by_type || []).forEach(t => { typeMap[t.type_name] = t.count; });

  document.getElementById("stat-solar").textContent  = (typeMap["Solar Eclipse"]         || 0).toLocaleString();
  document.getElementById("stat-lunar").textContent  = (typeMap["Lunar Eclipse"]         || 0).toLocaleString();
  document.getElementById("stat-meteor").textContent = (typeMap["Meteorite Impact"]      || 0).toLocaleString();
  document.getElementById("stat-comet").textContent  = (typeMap["Comet Approach"]        || 0).toLocaleString();
  document.getElementById("stat-conj").textContent   = (typeMap["Planetary Conjunction"] || 0).toLocaleString();
  document.getElementById("stat-total").textContent  = (data.total || 0).toLocaleString();

  const ms = data.meteorite_mass || {};
  document.getElementById("mass-stats").innerHTML = `
    <div class="info-item"><div class="info-item-label">Avg Mass</div><div class="info-item-value">${fmt(ms.avg_mass)} g</div></div>
    <div class="info-item"><div class="info-item-label">Max Mass</div><div class="info-item-value">${fmt(ms.max_mass)} g</div></div>
  `;

  const mg = data.eclipse_magnitude || {};
  document.getElementById("mag-stats").innerHTML = `
    <div class="info-item"><div class="info-item-label">Avg Magnitude</div><div class="info-item-value">${fmt(mg.avg_mag, 3)}</div></div>
    <div class="info-item"><div class="info-item-label">Max Magnitude</div><div class="info-item-value">${fmt(mg.max_mag, 3)}</div></div>
  `;

  const decades  = data.by_decade || [];
  const sampled  = decades.filter((_, i) => i % 20 === 0 || i === decades.length - 1);
  const tlLabels = sampled.map(d => d.decade + "s");
  const tlData   = sampled.map(d => d.count);

  if (chartTimeline) chartTimeline.destroy();
  chartTimeline = new Chart(document.getElementById("chart-timeline").getContext("2d"), {
    type: "bar",
    data: {
      labels: tlLabels,
      datasets: [{ label:"Events", data:tlData, backgroundColor:"rgba(245,166,35,0.25)", borderColor:"#f5a623", borderWidth:1, borderRadius:3 }]
    },
    options: {
      responsive:true,
      plugins:{ legend:{display:false}, tooltip:{backgroundColor:"#0c1020",borderColor:"#1e2d4a",borderWidth:1} },
      scales:{
        x:{grid:{color:"rgba(30,45,74,0.4)"},ticks:{color:"#5c7299",font:{family:"Space Mono"}}},
        y:{grid:{color:"rgba(30,45,74,0.4)"},ticks:{color:"#5c7299",font:{family:"Space Mono"}}}
      }
    }
  });

  const donutLabels = (data.by_type||[]).map(t=>t.type_name);
  const donutData   = (data.by_type||[]).map(t=>t.count);
  const donutColors = ["#f5a623","#7eb3f5","#e06030","#a78bfa","#34d399"];

  if (chartTypes) chartTypes.destroy();
  chartTypes = new Chart(document.getElementById("chart-types").getContext("2d"), {
    type:"doughnut",
    data:{
      labels:donutLabels,
      datasets:[{ data:donutData, backgroundColor:donutColors.map(c=>c+"30"), borderColor:donutColors, borderWidth:2, hoverOffset:6 }]
    },
    options:{
      responsive:true, cutout:"68%",
      plugins:{
        legend:{position:"bottom",labels:{color:"#5c7299",font:{family:"Space Mono",size:10},padding:14}},
        tooltip:{backgroundColor:"#0c1020",borderColor:"#1e2d4a",borderWidth:1}
      }
    }
  });
}

// ── ALL EVENTS ────────────────────────────────────────────────
let evtPage=1, evtType="", evtSearch="";

document.getElementById("btn-filter").addEventListener("click", () => {
  evtType   = document.getElementById("filter-type").value;
  evtSearch = document.getElementById("filter-search").value;
  loadEvents(1);
});

async function loadEvents(page) {
  evtPage = page;
  const params = new URLSearchParams({ page, per_page:20 });
  if (evtType)   params.append("type", evtType);
  if (evtSearch) params.append("search", evtSearch);
  const data = await fetchJSON(`${API}/events?${params}`);
  if (!data) return;

  document.getElementById("events-tbody").innerHTML = data.events.map((e,i) => `
    <tr>
      <td style="color:var(--text-dim)">${(page-1)*20+i+1}</td>
      <td>${e.event_name}</td>
      <td>${fmtDate(e.event_date)}</td>
      <td>${typeBadge(e.type_name)}</td>
      <td><button class="btn-view" onclick="openModal(${e.event_id})">View &rarr;</button></td>
      <td>
        <button class="btn-action btn-edit" onclick="openEditEvent(${e.event_id})" title="Edit">&#9998;</button>
        <button class="btn-action btn-danger" onclick="confirmDeleteEvent(${e.event_id},'${e.event_name.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')" title="Delete">&#10005;</button>
      </td>
    </tr>
  `).join("");
  renderPagination("events-pagination", data.page, data.pages, p => loadEvents(p));
}

// ── ECLIPSES ──────────────────────────────────────────────────
let eclFilter="both", eclPage=1;

["ecl-all","ecl-solar","ecl-lunar"].forEach(id => {
  document.getElementById(id).addEventListener("click", function() {
    document.querySelectorAll("[data-eclipse]").forEach(b => b.classList.remove("active-filter"));
    this.classList.add("active-filter");
    eclFilter = this.dataset.eclipse;
    loadEclipses(eclFilter, 1);
  });
});

async function loadEclipses(filter, page) {
  eclPage = page;
  const params = new URLSearchParams({ page });
  if (filter !== "both") params.append("type", filter);
  const data = await fetchJSON(`${API}/eclipses?${params}`);
  if (!data) return;

  document.getElementById("eclipse-tbody").innerHTML = data.data.map(e => `
    <tr>
      <td>${fmtDate(e.event_date)}</td>
      <td>${typeBadge(e.event_name)}</td>
      <td><code style="color:var(--accent)">${e.eclipse_type || "\u2014"}</code></td>
      <td>${fmt(e.magnitude,4)}</td>
      <td>${fmt(e.gamma,4)}</td>
      <td>${e.eclipse_time || "\u2014"}</td>
      <td style="font-size:11px">${[e.latitude,e.longitude].filter(v=>v!=null&&v!=="").join(", ")||"\u2014"}</td>
    </tr>
  `).join("");
  renderPagination("eclipse-pagination", data.page, data.pages, p => loadEclipses(eclFilter, p));
}

// ── METEORITES ────────────────────────────────────────────────
let meteorPage=1, meteorSearch="";

document.getElementById("btn-meteor-search").addEventListener("click", () => {
  meteorSearch = document.getElementById("meteor-search").value;
  loadMeteors(1);
});
document.getElementById("meteor-search").addEventListener("keydown", e => {
  if (e.key === "Enter") { meteorSearch = e.target.value; loadMeteors(1); }
});

async function loadMeteors(page) {
  meteorPage = page;
  const params = new URLSearchParams({ page, per_page:30 });
  if (meteorSearch) params.append("search", meteorSearch);
  params.append("type", "Meteorite Impact");
  const data = await fetchJSON(`${API}/events?${params}`);
  if (!data) return;

  document.getElementById("meteor-tbody").innerHTML = data.events.map(e => `
    <tr>
      <td>${e.event_name}</td>
      <td>${e.event_date ? e.event_date.split("-")[0] : "\u2014"}</td>
      <td>${e.mass_g != null ? fmt(e.mass_g) : "\u2014"}</td>
      <td><code style="color:var(--text-dim)">${e.met_lat != null ? e.met_lat : "\u2014"}</code></td>
      <td><code style="color:var(--text-dim)">${e.met_lon != null ? e.met_lon : "\u2014"}</code></td>
    </tr>
  `).join("");
  renderPagination("meteor-pagination", data.page, data.pages, p => loadMeteors(p));
}

// ── COMETS ────────────────────────────────────────────────────
async function loadComets() {
  const data = await fetchJSON(`${API}/comets`);
  if (!data) return;
  document.getElementById("comet-tbody").innerHTML = data.map(c => `
    <tr>
      <td style="color:#a78bfa;font-weight:700">${c.event_name}</td>
      <td>${fmt(c.perihelion_dist_au,4)} AU</td>
      <td>${c.aphelion_dist_au!=null ? fmt(c.aphelion_dist_au,2)+" AU" : "\u2014"}</td>
      <td>${c.period_years!=null ? fmt(c.period_years,1)+" yr" : "\u2014"}</td>
      <td>${fmtDate(c.event_date)}</td>
    </tr>
  `).join("");
}

// ── CONJUNCTIONS ──────────────────────────────────────────────
async function loadConjunctions() {
  const data = await fetchJSON(`${API}/conjunctions`);
  if (!data) return;
  document.getElementById("conj-tbody").innerHTML = data.map(c => `
    <tr>
      <td style="color:var(--conj);font-weight:700">${c.event_name}</td>
      <td>${fmtDate(c.event_date)}</td>
      <td>${c.event_time || "\u2014"}</td>
      <td><span style="color:var(--accent)">${c.planet1 || "\u2014"}</span></td>
      <td><span style="color:var(--accent)">${c.planet2 || "\u2014"}</span></td>
      <td>${c.separation_angle!=null ? fmt(c.separation_angle,3)+"&deg;" : "\u2014"}</td>
    </tr>
  `).join("");
}

// ── OBSERVATIONS ──────────────────────────────────────────────
async function loadObservations() {
  const data = await fetchJSON(`${API}/observations`);
  if (!data) return;
  renderObservations(data);
}

function renderObservations(data) {
  const list = document.getElementById("obs-list");
  if (!data.length) { list.innerHTML='<p style="color:var(--text-dim)">No observations recorded yet.</p>'; return; }
  list.innerHTML = data.map(o => `
    <div class="obs-entry">
      <div class="obs-entry-main">
        <div class="obs-entry-event">Event #${o.event_id} &mdash; ${o.event_name||""}</div>
        <div class="obs-entry-name">${o.observer_name}</div>
        <div class="obs-entry-date">${fmtDate(o.observation_date)}</div>
        ${o.notes?`<div class="obs-entry-notes">"${o.notes}"</div>`:""}
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn-action btn-edit" onclick="openEditObservation(${o.observation_id},${o.event_id},'${(o.observer_name||"").replace(/'/g,"\\'").replace(/"/g,"&quot;")}','${o.observation_date||""}','${(o.notes||"").replace(/'/g,"\\'").replace(/"/g,"&quot;").replace(/\n/g," ")}')" title="Edit">&#9998;</button>
        <button class="btn-del" onclick="deleteObs(${o.observation_id})">&#10005;</button>
      </div>
    </div>
  `).join("");
}

document.getElementById("btn-add-obs").addEventListener("click", async () => {
  const eid=document.getElementById("obs-event-id").value;
  const name=document.getElementById("obs-name").value;
  const date=document.getElementById("obs-date").value;
  const notes=document.getElementById("obs-notes").value;
  const msg=document.getElementById("obs-msg");
  if (!eid||!name||!date) { msg.style.color="#ef4444"; msg.textContent="Please fill in Event ID, Observer Name, and Date."; return; }
  try {
    const res=await fetch(`${API}/observations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_id:parseInt(eid),observer_name:name,observation_date:date,notes})});
    const data=await res.json();
    if(res.ok){
      msg.style.color="#34d399"; msg.textContent="&#10004; Observation recorded!";
      ["obs-event-id","obs-name","obs-notes"].forEach(id=>document.getElementById(id).value="");
      setTimeout(()=>{msg.textContent="";},3000);
      loadObservations();
    } else { msg.style.color="#ef4444"; msg.textContent="Error: "+(data.error||"Unknown error"); }
  } catch(e) { msg.style.color="#ef4444"; msg.textContent="Network error \u2014 is the backend running?"; }
});

async function deleteObs(id) {
  await fetch(`${API}/observations/${id}`,{method:"DELETE"});
  loadObservations();
}

// ── MAP (Leaflet — fixed) ─────────────────────────────────────
let leafletMap = null;

document.getElementById("btn-load-map").addEventListener("click", loadMap);

async function loadMap() {
  if (leafletMap) { leafletMap.invalidateSize(); return; }

  const data = await fetchJSON(`${API}/meteorites/map?limit=200`);
  if (!data || !data.length) { alert("No meteorite data available for mapping."); return; }

  document.getElementById("map-placeholder").style.display = "none";
  const mapDiv = document.getElementById("google-map");
  mapDiv.style.display = "block";

  // Dark-themed Leaflet map
  leafletMap = L.map(mapDiv, { center:[20,0], zoom:2 });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains:"abcd", maxZoom:19
  }).addTo(leafletMap);

  // Plot meteorite markers with scaled size
  data.forEach(m => {
    const lat = parseFloat(m.latitude);
    const lon = parseFloat(m.longitude);
    if (isNaN(lat) || isNaN(lon)) return;
    const sz = Math.min(14, Math.max(6, Math.log10((m.mass_g||1)+1)*2));
    const icon = L.divIcon({
      className:"",
      html:`<div style="width:${sz}px;height:${sz}px;background:#f5a623;border-radius:50%;opacity:0.78;border:1px solid #ffcc66;box-shadow:0 0 5px #f5a62377;cursor:pointer"></div>`,
      iconSize:[sz,sz], iconAnchor:[sz/2,sz/2]
    });
    L.marker([lat,lon],{icon})
      .addTo(leafletMap)
      .bindPopup(`<b style="color:#f5a623">${m.name}</b><br>Year: ${m.year||"Unknown"}<br>Mass: ${m.mass_g!=null?fmt(m.mass_g)+" g":"Unknown"}`);
  });

  // Fill sidebar table (first 50)
  document.getElementById("map-tbody").innerHTML = data.slice(0,50).map(m=>`
    <tr>
      <td>${m.name}</td>
      <td>${m.year!=null?m.year:"\u2014"}</td>
      <td>${m.mass_g!=null?fmt(m.mass_g):"\u2014"}</td>
      <td><code style="color:var(--text-dim)">${m.latitude}</code></td>
      <td><code style="color:var(--text-dim)">${m.longitude}</code></td>
    </tr>
  `).join("");

  setTimeout(()=>leafletMap.invalidateSize(),200);
}

// ── MODAL ─────────────────────────────────────────────────────
async function openModal(eventId) {
  const data = await fetchJSON(`${API}/events/${eventId}`);
  if (!data) return;
  let extra = "";
  if (data.eclipse_type) {
    extra=`
      <div class="modal-field"><div class="modal-field-label">Eclipse Kind</div><div class="modal-field-value">${data.eclipse_type}</div></div>
      <div class="modal-field"><div class="modal-field-label">Magnitude</div><div class="modal-field-value">${fmt(data.magnitude,4)}</div></div>
      <div class="modal-field"><div class="modal-field-label">Gamma</div><div class="modal-field-value">${fmt(data.gamma,4)}</div></div>
      <div class="modal-field"><div class="modal-field-label">Time (UTC)</div><div class="modal-field-value">${data.eclipse_time||"\u2014"}</div></div>
      <div class="modal-field"><div class="modal-field-label">Latitude</div><div class="modal-field-value">${data.ec_lat!=null?data.ec_lat:"\u2014"}</div></div>
      <div class="modal-field"><div class="modal-field-label">Longitude</div><div class="modal-field-value">${data.ec_lon!=null?data.ec_lon:"\u2014"}</div></div>`;
  } else if (data.mass_g!=null) {
    extra=`
      <div class="modal-field"><div class="modal-field-label">Mass</div><div class="modal-field-value">${fmt(data.mass_g)} g</div></div>
      <div class="modal-field"><div class="modal-field-label">Year</div><div class="modal-field-value">${data.met_year||"\u2014"}</div></div>
      <div class="modal-field"><div class="modal-field-label">Latitude</div><div class="modal-field-value">${data.met_lat!=null?data.met_lat:"\u2014"}</div></div>
      <div class="modal-field"><div class="modal-field-label">Longitude</div><div class="modal-field-value">${data.met_lon!=null?data.met_lon:"\u2014"}</div></div>`;
  } else if (data.planet1) {
    extra=`
      <div class="modal-field"><div class="modal-field-label">Planet 1</div><div class="modal-field-value">${data.planet1}</div></div>
      <div class="modal-field"><div class="modal-field-label">Planet 2</div><div class="modal-field-value">${data.planet2}</div></div>
      <div class="modal-field"><div class="modal-field-label">Separation</div><div class="modal-field-value">${fmt(data.separation_angle,3)}&deg;</div></div>
      <div class="modal-field"><div class="modal-field-label">Time</div><div class="modal-field-value">${data.conj_time||"\u2014"}</div></div>`;
  } else if (data.perihelion_dist_au!=null) {
    extra=`
      <div class="modal-field"><div class="modal-field-label">Perihelion (AU)</div><div class="modal-field-value">${fmt(data.perihelion_dist_au,5)}</div></div>
      <div class="modal-field"><div class="modal-field-label">Aphelion (AU)</div><div class="modal-field-value">${data.aphelion_dist_au!=null?fmt(data.aphelion_dist_au,2):"\u2014"}</div></div>
      <div class="modal-field"><div class="modal-field-label">Period (yr)</div><div class="modal-field-value">${data.period_years!=null?fmt(data.period_years,1):"\u2014"}</div></div>`;
  }

  const obsHtml = data.observations?.length
    ? data.observations.map(o=>`<div class="obs-entry" style="margin-top:8px"><div class="obs-entry-main"><div class="obs-entry-name">${o.observer_name}</div><div class="obs-entry-date">${fmtDate(o.observation_date)}</div>${o.notes?`<div class="obs-entry-notes">"${o.notes}"</div>`:""}</div></div>`).join("")
    : `<p style="color:var(--text-dim);font-size:12px">No observations yet.</p>`;

  document.getElementById("modal-content").innerHTML=`
    <div class="modal-title">${data.event_name}</div>
    <div class="modal-date">${typeBadge(data.type_name)} &nbsp; ${fmtDate(data.event_date)}</div>
    <div class="modal-grid">${extra}</div>
    <h4 style="margin:18px 0 8px;font-size:12px;letter-spacing:1px;color:var(--text-dim)">OBSERVATIONS</h4>
    ${obsHtml}`;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

document.getElementById("modal-close").addEventListener("click", ()=>document.getElementById("modal-overlay").classList.add("hidden"));
document.getElementById("modal-overlay").addEventListener("click", e=>{if(e.target.id==="modal-overlay")document.getElementById("modal-overlay").classList.add("hidden");});

// ── PAGINATION ────────────────────────────────────────────────
function renderPagination(id, cur, total, onPage) {
  const el = document.getElementById(id);
  if (!el) return;
  let h = `<button class="page-btn" ${cur<=1?"disabled":""} onclick="(${onPage.toString()})(${cur-1})">&larr; Prev</button>`;
  for (let i=Math.max(1,cur-2);i<=Math.min(total,cur+2);i++) {
    h+=`<button class="page-btn ${i===cur?"current":""}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
  }
  h+=`<button class="page-btn" ${cur>=total?"disabled":""} onclick="(${onPage.toString()})(${cur+1})">Next &rarr;</button>`;
  h+=`<span style="color:var(--text-dim);font-size:11px;margin-left:8px">Page ${cur} of ${total}</span>`;
  el.innerHTML = h;
}

// ── GLOBAL SEARCH ─────────────────────────────────────────────
let searchTimeout;
const searchInput   = document.getElementById("global-search");
const searchResults = document.getElementById("search-results");

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 2) { searchResults.classList.add("hidden"); return; }
  searchTimeout = setTimeout(async () => {
    const data = await fetchJSON(`${API}/search?q=${encodeURIComponent(q)}`);
    if (!data||!data.length) { searchResults.classList.add("hidden"); return; }
    searchResults.innerHTML = data.map(e=>`
      <div class="search-item" onclick="openModal(${e.event_id});searchResults.classList.add('hidden');searchInput.value='';">
        ${e.event_name}<span class="search-type-badge">${e.type_name}</span>
        <span style="float:right;color:var(--text-dim);font-size:10px">${fmtDate(e.event_date)}</span>
      </div>`).join("");
    searchResults.classList.remove("hidden");
  }, 300);
});
document.addEventListener("click", e=>{
  if(!searchInput.contains(e.target)&&!searchResults.contains(e.target)) searchResults.classList.add("hidden");
});

// ── CRUD MODAL ────────────────────────────────────────────────
const crudOverlay = document.getElementById("crud-modal-overlay");
const crudTitle   = document.getElementById("crud-modal-title");
const crudFields  = document.getElementById("crud-form-fields");
const crudForm    = document.getElementById("crud-form");
const crudMsg     = document.getElementById("crud-msg");
let crudCallback  = null;

function openCrudModal(title, fields, callback) {
  crudTitle.textContent = title;
  crudMsg.textContent = "";
  crudFields.innerHTML = fields.map(f=>`
    <div class="form-group"><label>${f.label}</label>
    ${f.type==="select"
      ?`<select id="crud-${f.name}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:9px 12px;color:var(--text);font-family:var(--font-mono);font-size:12px;outline:none">${f.options.map(o=>`<option value="${o.value}" ${o.value==f.value?"selected":""}>${o.label}</option>`).join("")}</select>`
      :`<input type="${f.type||"text"}" id="crud-${f.name}" value="${f.value||""}" placeholder="${f.placeholder||""}" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:9px 12px;color:var(--text);font-family:var(--font-mono);font-size:12px;outline:none">`
    }</div>`).join("");
  crudCallback = callback;
  crudOverlay.classList.remove("hidden");
}

function closeCrudModal() { crudOverlay.classList.add("hidden"); crudCallback=null; }
document.getElementById("crud-modal-close").addEventListener("click", closeCrudModal);
document.getElementById("crud-cancel-btn").addEventListener("click", closeCrudModal);
crudOverlay.addEventListener("click", e=>{ if(e.target===crudOverlay) closeCrudModal(); });

crudForm.addEventListener("submit", async e=>{
  e.preventDefault();
  if (crudCallback) {
    const inputs = crudFields.querySelectorAll("input,select");
    const data={};
    inputs.forEach(inp=>{ data[inp.id.replace("crud-","")]=inp.value; });
    await crudCallback(data);
  }
});

// ── CONFIRMATION DIALOG ───────────────────────────────────────
const confirmOverlay = document.getElementById("confirm-modal-overlay");
let confirmResolve = null;
function confirmAction(title, msg) {
  return new Promise(resolve=>{
    document.getElementById("confirm-title").textContent=title;
    document.getElementById("confirm-msg").textContent=msg;
    confirmOverlay.classList.remove("hidden");
    confirmResolve=resolve;
  });
}
document.getElementById("confirm-yes").addEventListener("click",()=>{ confirmOverlay.classList.add("hidden"); if(confirmResolve) confirmResolve(true); });
document.getElementById("confirm-no").addEventListener("click",()=>{ confirmOverlay.classList.add("hidden"); if(confirmResolve) confirmResolve(false); });
confirmOverlay.addEventListener("click",e=>{ if(e.target===confirmOverlay){ confirmOverlay.classList.add("hidden"); if(confirmResolve) confirmResolve(false); } });

// ── EVENT CRUD ────────────────────────────────────────────────
let eventTypesCache=null;
async function getEventTypes() {
  if (!eventTypesCache) eventTypesCache=await fetchJSON(`${API}/event-types`);
  return eventTypesCache||[];
}

document.getElementById("btn-new-event").addEventListener("click", async ()=>{
  const types=await getEventTypes();
  const opts=[{value:"",label:"Select Type"},...types.map(t=>({value:t.type_id,label:t.type_name}))];
  openCrudModal("Create New Event",[
    {name:"event_name",label:"Event Name",placeholder:"e.g. Total Solar Eclipse 2024"},
    {name:"event_date",label:"Event Date",type:"date"},
    {name:"type_id",label:"Event Type",type:"select",options:opts,value:""},
    {name:"description",label:"Description",placeholder:"Brief description..."},
  ],async data=>{
    if(!data.event_name){crudMsg.style.color="#ef4444";crudMsg.textContent="Event name is required.";return;}
    const body={event_name:data.event_name,event_date:data.event_date||null,description:data.description||""};
    if(data.type_id) body.type_id=parseInt(data.type_id);
    try{
      const res=await fetch(`${API}/events`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Event created!";setTimeout(()=>{closeCrudModal();loadEvents(evtPage);},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
});

async function openEditEvent(eventId) {
  const ev=await fetchJSON(`${API}/events/${eventId}`);
  if(!ev) return;
  const types=await getEventTypes();
  const opts=[{value:"",label:"Select Type"},...types.map(t=>({value:t.type_id,label:t.type_name}))];
  openCrudModal("Edit Event",[
    {name:"event_name",label:"Event Name",value:ev.event_name},
    {name:"event_date",label:"Event Date",type:"date",value:ev.event_date||""},
    {name:"type_id",label:"Event Type",type:"select",options:opts,value:ev.type_id||""},
    {name:"description",label:"Description",value:ev.description||""},
  ],async data=>{
    if(!data.event_name){crudMsg.style.color="#ef4444";crudMsg.textContent="Event name is required.";return;}
    const body={event_name:data.event_name,event_date:data.event_date||null,description:data.description||""};
    if(data.type_id) body.type_id=parseInt(data.type_id);
    try{
      const res=await fetch(`${API}/events/${eventId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Updated!";eventTypesCache=null;setTimeout(()=>{closeCrudModal();loadEvents(evtPage);},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
}

async function confirmDeleteEvent(eventId, eventName) {
  const ok=await confirmAction("Delete Event",`Delete "${eventName}"? This also removes all related records.`);
  if(!ok) return;
  try{ await fetch(`${API}/events/${eventId}`,{method:"DELETE"}); loadEvents(evtPage); }
  catch(e){ console.error("Delete failed:",e); }
}

// ── OBSERVATION EDIT ──────────────────────────────────────────
function openEditObservation(obsId,eventId,name,date,notes) {
  openCrudModal("Edit Observation",[
    {name:"event_id",label:"Event ID",type:"number",value:eventId},
    {name:"observer_name",label:"Observer Name",value:name},
    {name:"observation_date",label:"Date",type:"date",value:date},
    {name:"notes",label:"Notes",value:notes},
  ],async data=>{
    if(!data.event_id||!data.observer_name||!data.observation_date){crudMsg.style.color="#ef4444";crudMsg.textContent="Event ID, name, and date are required.";return;}
    try{
      const res=await fetch(`${API}/observations/${obsId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_id:parseInt(data.event_id),observer_name:data.observer_name,observation_date:data.observation_date,notes:data.notes})});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Updated!";setTimeout(()=>{closeCrudModal();loadObservations();},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
}

// ── LOCATIONS CRUD ────────────────────────────────────────────
async function loadLocations() {
  const data=await fetchJSON(`${API}/locations`);
  if(!data) return;
  document.getElementById("locations-tbody").innerHTML=data.map((loc,i)=>`
    <tr>
      <td style="color:var(--text-dim)">${i+1}</td>
      <td>${loc.country||"\u2014"}</td>
      <td style="color:var(--accent);font-weight:700">${loc.city||"\u2014"}</td>
      <td><code style="color:var(--text-dim)">${loc.latitude!=null?loc.latitude:"\u2014"}</code></td>
      <td><code style="color:var(--text-dim)">${loc.longitude!=null?loc.longitude:"\u2014"}</code></td>
      <td>
        <button class="btn-action btn-edit" onclick="openEditLocation(${loc.location_id},'${(loc.country||"").replace(/'/g,"\\'")}','${(loc.city||"").replace(/'/g,"\\'")}','${loc.latitude!=null?loc.latitude:""}','${loc.longitude!=null?loc.longitude:""}')" title="Edit">&#9998;</button>
        <button class="btn-action btn-danger" onclick="confirmDeleteLocation(${loc.location_id},'${(loc.city||"").replace(/'/g,"\\'")}')" title="Delete">&#10005;</button>
      </td>
    </tr>`).join("");
}

document.getElementById("btn-new-location").addEventListener("click",()=>{
  openCrudModal("Add New Location",[
    {name:"country",label:"Country",placeholder:"e.g. Pakistan"},
    {name:"city",label:"City",placeholder:"e.g. Karachi"},
    {name:"latitude",label:"Latitude",type:"number",placeholder:"e.g. 24.8607"},
    {name:"longitude",label:"Longitude",type:"number",placeholder:"e.g. 67.0011"},
  ],async data=>{
    if(!data.country||!data.city){crudMsg.style.color="#ef4444";crudMsg.textContent="Country and city are required.";return;}
    const body={country:data.country,city:data.city};
    if(data.latitude) body.latitude=parseFloat(data.latitude);
    if(data.longitude) body.longitude=parseFloat(data.longitude);
    try{
      const res=await fetch(`${API}/locations`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Location added!";setTimeout(()=>{closeCrudModal();loadLocations();},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
});

function openEditLocation(locId,country,city,lat,lon) {
  openCrudModal("Edit Location",[
    {name:"country",label:"Country",value:country},
    {name:"city",label:"City",value:city},
    {name:"latitude",label:"Latitude",type:"number",value:lat},
    {name:"longitude",label:"Longitude",type:"number",value:lon},
  ],async data=>{
    if(!data.country||!data.city){crudMsg.style.color="#ef4444";crudMsg.textContent="Country and city are required.";return;}
    const body={country:data.country,city:data.city};
    if(data.latitude) body.latitude=parseFloat(data.latitude);
    if(data.longitude) body.longitude=parseFloat(data.longitude);
    try{
      const res=await fetch(`${API}/locations/${locId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Updated!";setTimeout(()=>{closeCrudModal();loadLocations();},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
}

async function confirmDeleteLocation(locId,cityName) {
  const ok=await confirmAction("Delete Location",`Delete "${cityName}"?`);
  if(!ok) return;
  try{ await fetch(`${API}/locations/${locId}`,{method:"DELETE"}); loadLocations(); }
  catch(e){ console.error(e); }
}

// ── VISIBILITY PAGE ───────────────────────────────────────────
async function loadVisibility() {
  const tf=document.getElementById("vis-filter-event-type").value;
  const data=await fetchJSON(`${API}/visibility?`+(tf?`type=${encodeURIComponent(tf)}`:""));
  if(!data) return;
  const tbody=document.getElementById("visibility-tbody");
  if(!data.length){
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:40px">No visibility records found.</td></tr>`;
  } else {
    tbody.innerHTML=data.map((v,i)=>`
      <tr>
        <td style="color:var(--text-dim)">${i+1}</td>
        <td style="color:var(--text);font-weight:600">${v.event_name}</td>
        <td style="color:var(--accent)">${v.city||"\u2014"}</td>
        <td>${v.country||"\u2014"}</td>
        <td><span class="status-badge ${v.visibility_status==="Visible"?"badge-visible":"badge-not-visible"}">${v.visibility_status||"Visible"}</span></td>
        <td>
          <button class="btn-action btn-edit" onclick="openEditVisibility(${v.event_id},${v.location_id},'${(v.visibility_status||"Visible").replace(/'/g,"\\'")}','${v.event_name.replace(/'/g,"\\'")}')" title="Edit">&#9998;</button>
          <button class="btn-action btn-danger" onclick="deleteVisibility(${v.event_id},${v.location_id})" title="Delete">&#10005;</button>
        </td>
      </tr>`).join("");
  }
  const stats=await fetchJSON(`${API}/visibility/stats`);
  if(stats){
    document.getElementById("vis-stats-list").innerHTML=stats.map(s=>`
      <div class="vis-stat-pill"><span>&#128205; ${s.city}, ${s.country}</span><strong>${s.visible_events}</strong><span style="color:var(--text-dim)">events</span></div>
    `).join("")||'<p style="color:var(--text-dim);font-size:12px">No stats yet.</p>';
  }
}
document.getElementById("btn-vis-filter").addEventListener("click",loadVisibility);

document.getElementById("btn-new-visibility").addEventListener("click",async()=>{
  const locs=await fetchJSON(`${API}/locations`);
  const locOpts=[{value:"",label:"Select Location"},...(locs||[]).map(l=>({value:l.location_id,label:`${l.city}, ${l.country}`}))];
  openCrudModal("Add Visibility Record",[
    {name:"event_id",label:"Event ID",type:"number",placeholder:"Enter event ID"},
    {name:"location_id",label:"Location",type:"select",options:locOpts},
    {name:"visibility_status",label:"Status",type:"select",options:[{value:"Visible",label:"Visible"},{value:"Not Visible",label:"Not Visible"},{value:"Partial",label:"Partial"}]},
  ],async data=>{
    if(!data.event_id||!data.location_id){crudMsg.style.color="#ef4444";crudMsg.textContent="Event ID and Location required.";return;}
    try{
      const res=await fetch(`${API}/visibility`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_id:parseInt(data.event_id),location_id:parseInt(data.location_id),visibility_status:data.visibility_status})});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Added!";setTimeout(()=>{closeCrudModal();loadVisibility();},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
});

function openEditVisibility(eid,lid,status,ename) {
  openCrudModal(`Edit Visibility \u2014 ${ename}`,[
    {name:"visibility_status",label:"Visibility Status",type:"select",options:[{value:"Visible",label:"Visible"},{value:"Not Visible",label:"Not Visible"},{value:"Partial",label:"Partial"}],value:status}
  ],async data=>{
    try{
      const res=await fetch(`${API}/visibility/${eid}/${lid}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({visibility_status:data.visibility_status})});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Updated!";setTimeout(()=>{closeCrudModal();loadVisibility();},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
}

async function deleteVisibility(eid,lid) {
  const ok=await confirmAction("Remove Visibility Record","Remove this record?");
  if(!ok) return;
  await fetch(`${API}/visibility/${eid}/${lid}`,{method:"DELETE"});
  loadVisibility();
}

// ── ADMIN PANEL ───────────────────────────────────────────────
async function loadAdminPage() { await loadAdminTypes(); await loadAdminStats(); }

async function loadAdminTypes() {
  const types=await fetchJSON(`${API}/event-types`);
  if(!types) return;
  document.getElementById("admin-types-tbody").innerHTML=types.map(t=>`
    <tr>
      <td style="color:var(--text-dim)">${t.type_id}</td>
      <td style="color:var(--accent);font-weight:700">${t.type_name}</td>
      <td style="color:var(--text-dim);font-size:11px">${t.description?t.description.substring(0,50)+"\u2026":"\u2014"}</td>
      <td>
        <button class="btn-action btn-edit" onclick="openEditEventType(${t.type_id},'${t.type_name.replace(/'/g,"\\'")}','${(t.description||"").replace(/'/g,"\\'").replace(/\n/g," ")}')" title="Edit">&#9998;</button>
        <button class="btn-action btn-danger" onclick="confirmDeleteEventType(${t.type_id},'${t.type_name.replace(/'/g,"\\'")}')" title="Delete">&#10005;</button>
      </td>
    </tr>`).join("");
}

async function loadAdminStats() {
  const stats=await fetchJSON(`${API}/stats`);
  if(!stats) return;
  const items=[
    {label:"TOTAL EVENTS",val:(stats.total||0).toLocaleString()},
    {label:"EVENT TYPES",val:stats.by_type?.length||0},
    ...(stats.by_type||[]).map(t=>({label:t.type_name.toUpperCase(),val:t.count.toLocaleString()})),
    {label:"AVG METEORITE MASS",val:stats.meteorite_mass?.avg_mass?Math.round(stats.meteorite_mass.avg_mass).toLocaleString()+" g":"\u2014"},
    {label:"MAX METEORITE MASS",val:stats.meteorite_mass?.max_mass?Math.round(stats.meteorite_mass.max_mass).toLocaleString()+" g":"\u2014"},
    {label:"AVG ECLIPSE MAG",val:stats.eclipse_magnitude?.avg_mag?parseFloat(stats.eclipse_magnitude.avg_mag).toFixed(3):"\u2014"},
  ];
  document.getElementById("admin-db-stats").innerHTML=items.map(item=>`
    <div class="admin-stat-item"><span class="lbl">${item.label}</span><span class="val">${item.val}</span></div>`).join("");
}

document.getElementById("btn-admin-refresh-stats").addEventListener("click",loadAdminStats);

document.getElementById("btn-admin-new-type").addEventListener("click",()=>{
  openCrudModal("Add Event Type",[
    {name:"type_name",label:"Type Name",placeholder:"e.g. Aurora Borealis"},
    {name:"description",label:"Description",placeholder:"Brief description..."},
  ],async data=>{
    if(!data.type_name){crudMsg.style.color="#ef4444";crudMsg.textContent="Type name required.";return;}
    try{
      const res=await fetch(`${API}/event-types`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type_name:data.type_name,description:data.description})});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Created!";eventTypesCache=null;setTimeout(()=>{closeCrudModal();loadAdminTypes();},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
});

function openEditEventType(typeId,typeName,description) {
  openCrudModal("Edit Event Type",[
    {name:"type_name",label:"Type Name",value:typeName},
    {name:"description",label:"Description",value:description},
  ],async data=>{
    try{
      const res=await fetch(`${API}/event-types/${typeId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({type_name:data.type_name,description:data.description})});
      const result=await res.json();
      if(res.ok){crudMsg.style.color="#34d399";crudMsg.textContent="&#10004; Updated!";eventTypesCache=null;setTimeout(()=>{closeCrudModal();loadAdminTypes();},1000);}
      else{crudMsg.style.color="#ef4444";crudMsg.textContent=result.error||"Error.";}
    }catch(e){crudMsg.style.color="#ef4444";crudMsg.textContent="Network error.";}
  });
}

async function confirmDeleteEventType(typeId,typeName) {
  const ok=await confirmAction("Delete Event Type",`Delete "${typeName}"? Events will be unlinked.`);
  if(!ok) return;
  await fetch(`${API}/event-types/${typeId}`,{method:"DELETE"});
  eventTypesCache=null; loadAdminTypes();
}

// ── Admin Quick-Add forms ─────────────────────────────────────
document.getElementById("btn-admin-add-eclipse").addEventListener("click",async()=>{
  const name=document.getElementById("adm-ecl-name").value.trim();
  const msg=document.getElementById("adm-ecl-msg");
  if(!name){msg.style.color="#ef4444";msg.textContent="Event name required.";return;}
  try{
    const res=await fetch(`${API}/admin/eclipse`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      event_name:name, event_date:document.getElementById("adm-ecl-date").value||null,
      type_id:parseInt(document.getElementById("adm-ecl-type").value),
      eclipse_type:document.getElementById("adm-ecl-kind").value.trim()||null,
      magnitude:document.getElementById("adm-ecl-mag").value?parseFloat(document.getElementById("adm-ecl-mag").value):null,
      gamma:document.getElementById("adm-ecl-gamma").value?parseFloat(document.getElementById("adm-ecl-gamma").value):null,
      eclipse_time:document.getElementById("adm-ecl-time").value||null,
      latitude:document.getElementById("adm-ecl-lat").value||null,
      longitude:document.getElementById("adm-ecl-lon").value||null,
    })});
    const data=await res.json();
    if(res.ok){msg.style.color="#34d399";msg.textContent=`&#10004; Eclipse created! (ID: ${data.event_id})`;["adm-ecl-name","adm-ecl-date","adm-ecl-kind","adm-ecl-mag","adm-ecl-gamma","adm-ecl-time","adm-ecl-lat","adm-ecl-lon"].forEach(id=>document.getElementById(id).value="");setTimeout(()=>msg.textContent="",4000);}
    else{msg.style.color="#ef4444";msg.textContent=data.error||"Error.";}
  }catch(e){msg.style.color="#ef4444";msg.textContent="Network error.";}
});

document.getElementById("btn-admin-add-meteorite").addEventListener("click",async()=>{
  const name=document.getElementById("adm-met-name").value.trim();
  const msg=document.getElementById("adm-met-msg");
  if(!name){msg.style.color="#ef4444";msg.textContent="Meteorite name required.";return;}
  const types=await getEventTypes();
  const mType=types.find(t=>t.type_name==="Meteorite Impact");
  if(!mType){msg.style.color="#ef4444";msg.textContent="Meteorite Impact type not found.";return;}
  const year=document.getElementById("adm-met-year").value;
  try{
    const res=await fetch(`${API}/admin/meteorite`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      event_name:name,event_date:year?`${year}-01-01`:null,type_id:mType.type_id,met_name:name,
      mass_g:document.getElementById("adm-met-mass").value?parseFloat(document.getElementById("adm-met-mass").value):null,
      year:year?parseInt(year):null,
      latitude:document.getElementById("adm-met-lat").value||null,
      longitude:document.getElementById("adm-met-lon").value||null,
    })});
    const data=await res.json();
    if(res.ok){msg.style.color="#34d399";msg.textContent=`&#10004; Meteorite created! (ID: ${data.event_id})`;["adm-met-name","adm-met-year","adm-met-mass","adm-met-lat","adm-met-lon"].forEach(id=>document.getElementById(id).value="");setTimeout(()=>msg.textContent="",4000);}
    else{msg.style.color="#ef4444";msg.textContent=data.error||"Error.";}
  }catch(e){msg.style.color="#ef4444";msg.textContent="Network error.";}
});

document.getElementById("btn-admin-add-conjunction").addEventListener("click",async()=>{
  const name=document.getElementById("adm-conj-name").value.trim();
  const msg=document.getElementById("adm-conj-msg");
  if(!name){msg.style.color="#ef4444";msg.textContent="Event name required.";return;}
  const types=await getEventTypes();
  const cType=types.find(t=>t.type_name==="Planetary Conjunction");
  if(!cType){msg.style.color="#ef4444";msg.textContent="Planetary Conjunction type not found.";return;}
  try{
    const res=await fetch(`${API}/admin/conjunction`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      event_name:name,event_date:document.getElementById("adm-conj-date").value||null,type_id:cType.type_id,
      planet1:document.getElementById("adm-conj-p1").value.trim()||null,
      planet2:document.getElementById("adm-conj-p2").value.trim()||null,
      separation_angle:document.getElementById("adm-conj-sep").value?parseFloat(document.getElementById("adm-conj-sep").value):null,
      event_time:document.getElementById("adm-conj-time").value||null,
    })});
    const data=await res.json();
    if(res.ok){msg.style.color="#34d399";msg.textContent=`&#10004; Conjunction created! (ID: ${data.event_id})`;["adm-conj-name","adm-conj-date","adm-conj-p1","adm-conj-p2","adm-conj-sep","adm-conj-time"].forEach(id=>document.getElementById(id).value="");setTimeout(()=>msg.textContent="",4000);}
    else{msg.style.color="#ef4444";msg.textContent=data.error||"Error.";}
  }catch(e){msg.style.color="#ef4444";msg.textContent="Network error.";}
});

document.getElementById("btn-admin-add-comet").addEventListener("click",async()=>{
  const name=document.getElementById("adm-com-name").value.trim();
  const msg=document.getElementById("adm-com-msg");
  if(!name){msg.style.color="#ef4444";msg.textContent="Comet name required.";return;}
  const types=await getEventTypes();
  const cType=types.find(t=>t.type_name==="Comet Approach");
  if(!cType){msg.style.color="#ef4444";msg.textContent="Comet Approach type not found.";return;}
  try{
    const res=await fetch(`${API}/admin/comet`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      event_name:name,event_date:document.getElementById("adm-com-date").value||null,type_id:cType.type_id,
      perihelion_dist_au:document.getElementById("adm-com-peri").value?parseFloat(document.getElementById("adm-com-peri").value):null,
      aphelion_dist_au:document.getElementById("adm-com-aph").value?parseFloat(document.getElementById("adm-com-aph").value):null,
      period_years:document.getElementById("adm-com-period").value?parseFloat(document.getElementById("adm-com-period").value):null,
    })});
    const data=await res.json();
    if(res.ok){msg.style.color="#34d399";msg.textContent=`&#10004; Comet created! (ID: ${data.event_id})`;["adm-com-name","adm-com-date","adm-com-peri","adm-com-aph","adm-com-period"].forEach(id=>document.getElementById(id).value="");setTimeout(()=>msg.textContent="",4000);}
    else{msg.style.color="#ef4444";msg.textContent=data.error||"Error.";}
  }catch(e){msg.style.color="#ef4444";msg.textContent="Network error.";}
});

// ── INIT ──────────────────────────────────────────────────────
showPage("dashboard");
