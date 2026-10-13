// ==================== GESTOR MULTI-ESTABLECIMIENTO ====================

const DEFAULT_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxJf_ebJ4MZRcbrSSn-K-PJCRZNAUSSfCkRt3LM8gDeKz-o47cQ3bjvXnFcE8-RjsFu/exec';

// Mapa unificado de los 10 Organismos Provinciales oficiales con su CUIT tributario
const ORGANISMO_CUIT_MAP = {
  'JEFATURA DE POLICIA': { cuit: '30-67119808-1', org: 'JEFATURA DE POLICIA DE LA PROVINCIA DE ENTRE RIOS' },
  'MINISTERIO DE SALUD': { cuit: '30-67119808-1', org: 'MINISTERIO DE SALUD DE LA PROVINCIA DE ENTRE RIOS' },
  'MINISTERIO DE GOBIERNO': { cuit: '30-67119808-1', org: 'MINISTERIO DE GOBIERNO Y TRABAJO DE LA PROVINCIA DE ENTRE RÍOS' },
  'UNIVERSIDAD AUT': { cuit: '30-70755845-1', org: 'UNIVERSIDAD AUTÓNOMA DE ENTRE RÍOS' },
  'UADER': { cuit: '30-70755845-1', org: 'UNIVERSIDAD AUTÓNOMA DE ENTRE RÍOS' },
  'ADMINISTRADORA TRIBUTARIA': { cuit: '30-71171714-3', org: 'ADMINISTRADORA TRIBUTARIA DE LA PROVINCIA DE ENTRE RÍOS' },
  'ATER': { cuit: '30-71171714-3', org: 'ADMINISTRADORA TRIBUTARIA DE LA PROVINCIA DE ENTRE RÍOS' },
  'CAJA DE JUBILACIONES': { cuit: '30-65392098-9', org: 'CAJA DE JUBILACIONES Y PENSIONES DE ENTRE RIOS' },
  'TRIBUNAL DE CUENTAS': { cuit: '30-67610996-6', org: 'TRIBUNAL DE CUENTAS DE ENTRE RIOS' },
  'INSTITUTO DE CONTROL DE ALIMENTACION': { cuit: '30-71239854-8', org: 'INSTITUTO DE CONTROL DE ALIMENTACION Y BROMATOLOGIA' },
  'ICAB': { cuit: '30-71239854-8', org: 'INSTITUTO DE CONTROL DE ALIMENTACION Y BROMATOLOGIA' },
  'ENTE DE PROMOCION': { cuit: '30-70838186-5', org: 'ENTE DE PROMOCION DE LA PRODUCCION Y EL EMPLEO DE URDINARRAIN' },
  'SECRETARIA DE ENERGIA': { cuit: '30-67119808-1', org: 'DIRECCION DE ADMINISTRACION SECRETARIA DE ENERGIA DE E.RIOS' }
};

function normalizarProvincia(p) {
  if (!p) return 'Entre Ríos';
  const s = p.trim().toUpperCase();
  if (s.includes('E.RIOS') || s.includes('ENTRE R') || s.includes('ERIOS')) return 'Entre Ríos';
  if (s.includes('C.A.B.A') || s.includes('CABA') || s.includes('BUENOS AIRES') || s.includes('CAPITAL')) return 'C.A.B.A.';
  if (s.includes('STA') || s.includes('SANTA FE')) return 'Santa Fe';
  if (s.includes('CORDOBA') || s.includes('CÓRDOBA')) return 'Córdoba';
  return p.trim();
}

function formatLocalidad(loc) {
  if (!loc) return 'Entre Ríos';
  let s = loc.trim();
  if (!s) return 'Entre Ríos';
  if (s.toUpperCase() === 'C.A.B.A.' || s.toUpperCase() === 'CABA') return 'C.A.B.A.';
  const mapAccents = {
    'PARANA': 'Paraná',
    'GUALEGUAYCHU': 'Gualeguaychú',
    'NOGOYA': 'Nogoyá',
    'CHAJARI': 'Chajarí',
    'COLON': 'Colón',
    'FEDERACION': 'Federación',
    'RAMIREZ': 'General Ramírez',
    'GENERAL RAMIREZ': 'General Ramírez',
    'CONCEPCION DEL URUGUAY': 'Concepción del Uruguay',
    'ROSARIO DEL TALA': 'Rosario del Tala',
    'ORO VERDE': 'Oro Verde',
    'LA PAZ': 'La Paz',
    'SAN SALVADOR': 'San Salvador',
    'SANTA ELENA': 'Santa Elena',
    'SAN JOSE': 'San José',
    'ISLAS DEL IBICUY': 'Islas del Ibicuy',
    'VILLA ELISA': 'Villa Elisa',
    'VILLA PARANACITO': 'Villa Paranacito',
    'SAN JOSE DE FELICIANO': 'San José de Feliciano',
    'HERNANDARIAS': 'Hernandarias',
    'VIALE': 'Viale',
    'CRESPO': 'Crespo',
    'DIAMANTE': 'Diamante',
    'VICTORIA': 'Victoria',
    'VILLAGUAY': 'Villaguay',
    'CONCORDIA': 'Concordia',
    'GUALEGUAY': 'Gualeguay',
    'FEDERAL': 'Federal',
    'BASAVILBASO': 'Basavilbaso'
  };
  const up = s.toUpperCase();
  if (mapAccents[up]) return mapAccents[up];
  return s.toLowerCase().split(' ').map((w, idx) => {
    if (idx > 0 && ['de', 'del', 'la', 'las', 'el', 'los', 'y'].includes(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function normalizarEstablecimiento(est) {
  if (!est) return null;
  let rawOrg = (est.organismo || est.razonSocial || '').trim();
  let rawNom = (est.nombreEstablecimiento || '').trim();
  let dom = (est.domicilio || est.direccion || '').trim();
  let loc = formatLocalidad(est.localidad || 'Entre Ríos');
  let prov = normalizarProvincia(est.provincia || 'Entre Ríos');
  let nro = (est.nroEstab || '').toString().trim();

  // Filtrar registros basura como 'Empresa', 'Sin Organismo' o filas totalmente vacías
  const lowerOrg = rawOrg.toLowerCase();
  if (lowerOrg === 'empresa' || lowerOrg === 'sin organismo' || (!rawOrg && !dom && !nro)) {
    return null;
  }

  // Buscar coincidencia en el catálogo oficial de CUITs y Organismos
  let matchedCuit = (est.cuit || '').trim();
  let matchedOrg = rawOrg;
  for (const [pattern, info] of Object.entries(ORGANISMO_CUIT_MAP)) {
    if (rawOrg.toUpperCase().includes(pattern.toUpperCase())) {
      matchedCuit = info.cuit;
      matchedOrg = info.org;
      break;
    }
  }

  // Si no tiene nombre específico de establecimiento o es genérico, generar nombre profesional
  let finalNom = rawNom;
  if (!finalNom || finalNom.toLowerCase().includes('sin nombre') || finalNom.toLowerCase() === 'empresa' || finalNom === '[Completar Nombre]') {
    if (dom && loc && loc !== 'Entre Ríos') {
      finalNom = `${dom} (${loc})`;
    } else if (dom) {
      finalNom = dom;
    } else if (nro) {
      finalNom = `Dependencia N° ${nro} - ${loc}`;
    } else {
      finalNom = `Dependencia ${loc}`;
    }
  }

  est.organismo = matchedOrg;
  est.razonSocial = matchedOrg;
  est.cuit = matchedCuit;
  est.nombreEstablecimiento = finalNom;
  est.domicilio = dom;
  est.direccion = dom;
  est.localidad = loc;
  est.provincia = prov;
  est.nroEstab = nro;
  return est;
}

var establecimientosDB = {};
var currentEstId = 'est_sheet_180';
var currentEstRowIndex = null;

function getEstTitle(est) {
  if (!est) return 'Establecimiento';
  const nro = est.nroEstab ? `[N° ${est.nroEstab}] ` : '';
  const org = est.organismo || est.razonSocial || 'Organismo';
  const nom = est.nombreEstablecimiento ? ` — ${est.nombreEstablecimiento}` : '';
  const dom = (est.domicilio || est.direccion) ? ` (${est.domicilio || est.direccion})` : '';
  const fecha = est.fecha ? ` [🗓️ ${est.fecha}]` : '';
  return `${nro}${org}${nom}${dom}${fecha}`;
}

function getSheetsUrl() {
  return localStorage.getItem('hys_sheets_webhook_url') || DEFAULT_SHEETS_WEBHOOK_URL;
}

window.handleGoogleSheetsGvizData = function(json) {
  const btn = document.querySelector('.btn-load-sheets');
  if (btn && btn.getAttribute('data-prev-text')) {
    btn.textContent = btn.getAttribute('data-prev-text');
    btn.removeAttribute('data-prev-text');
  }
  try {
    const table = json.table || {};
    const rows = table.rows || [];
    if (rows.length === 0) {
      alert('ℹ️ La hoja "Establecimientos" en tu Google Sheet está vacía.');
      return;
    }
    let count = 0;
    rows.forEach((r, idx) => {
      const c = r.c || [];
      const org = c[0] ? String(c[0].v !== null ? c[0].v : '').trim() : '';
      const nom = c[1] ? String(c[1].v !== null ? c[1].v : '').trim() : '';
      const dom = c[2] ? String(c[2].v !== null ? c[2].v : '').trim() : '';
      const cp  = c[3] ? String(c[3].v !== null ? c[3].v : '').trim() : '';
      const loc = c[4] ? String(c[4].v !== null ? c[4].v : '').trim() : '';
      const prov= c[5] ? String(c[5].v !== null ? c[5].v : 'Entre Ríos').trim() : 'Entre Ríos';
      const nro = c[6] ? String(c[6].v !== null ? c[6].v : '').trim() : '';

      if (org || dom || nro) {
        const estId = 'est_sheet_' + (idx + 2);
        const prev = establecimientosDB[estId] || {};
        const preloaded = (typeof PRELOADED_SURVEYS !== 'undefined') ? PRELOADED_SURVEYS[estId] : null;
        let item = {
          id: estId,
          rowIndex: idx + 2,
          nroEstab: (preloaded ? preloaded.nroEstab : (prev.nroEstab || nro)),
          organismo: org,
          razonSocial: org,
          nombreEstablecimiento: (preloaded ? preloaded.nombreEstablecimiento : (prev.nombreEstablecimiento || nom)),
          domicilio: (preloaded ? preloaded.domicilio : (prev.domicilio || dom)),
          direccion: (preloaded ? preloaded.direccion : (prev.direccion || dom)),
          cp: (preloaded ? preloaded.cp : (prev.cp || cp)),
          localidad: (preloaded ? preloaded.localidad : (prev.localidad || loc)),
          provincia: (preloaded ? preloaded.provincia : (prev.provincia || prov)),
          cuit: (preloaded ? preloaded.cuit : (prev.cuit || '')),
          art: 'IAPSER ART',
          fecha: (preloaded ? preloaded.fecha : (prev.fecha || '')),
          impactadoSheets: Boolean(prev.impactadoSheets || (preloaded && preloaded.impactadoSheets)),
          sectores: (preloaded && preloaded.sectores) ? preloaded.sectores : (prev.sectores || []),
          cargaFuegoDetalle: (preloaded && preloaded.cargaFuegoDetalle) ? preloaded.cargaFuegoDetalle : (prev.cargaFuegoDetalle || []),
          data: (preloaded ? preloaded.data : (prev.data || null))
        };
        item = normalizarEstablecimiento(item);
        if (item) {
          count++;
          establecimientosDB[estId] = item;
        }
      }
    });
    saveEstablecimientosDB();
    poblarSelectoresFiltros();
    renderEstablecimientosSelect();
    poblarDirectorioCuitSelect();
    poblarDirectorioProvinciaSelect();
    poblarDirectorioLocalidadSelect();
    renderDirectorioSedesList();
    alert(`✅ ¡Sincronización exitosa!\n\nSe cargaron los ${count} establecimientos reales desde tu Google Sheet.\n\nPodés buscarlos y seleccionarlos en el desplegable superior.`);
  } catch(err) {
    alert('❌ Error al procesar los establecimientos de Google Sheets: ' + err.message);
  }
};

function cargarEstablecimientosDesdeSheets() {
  const btn = document.querySelector('.btn-load-sheets') || (typeof event !== 'undefined' && event ? event.target : null);
  if (btn) {
    btn.setAttribute('data-prev-text', btn.textContent);
    btn.textContent = '⏳ Cargando de Sheets...';
  }

  const oldScript = document.getElementById('gviz-jsonp-script');
  if (oldScript) oldScript.remove();

  const script = document.createElement('script');
  script.id = 'gviz-jsonp-script';
  script.src = 'https://docs.google.com/spreadsheets/d/1-eQvCHv3LB6C2ydjY_fXwWEY67e5vbE4GNWIBKSrMfE/gviz/tq?sheet=Establecimientos&tqx=responseHandler:handleGoogleSheetsGvizData';
  script.onerror = function() {
    if (btn && btn.getAttribute('data-prev-text')) {
      btn.textContent = btn.getAttribute('data-prev-text');
      btn.removeAttribute('data-prev-text');
    }
    alert('⚠️ No se pudo conectar con la planilla de Google Sheets. Verificá tu conexión a internet.');
  };
  document.body.appendChild(script);
}

// ==================== BÚSQUEDA Y FILTRADO MULTI-COLUMNA ====================
let filtroCuitActivo = '';
let filtroLocalidadActiva = '';
let filtroTextoEstablecimiento = '';

function onFiltroCuitChange(cuit) {
  filtroCuitActivo = (cuit || '').trim();
  poblarSelectorLocalidades();
  renderEstablecimientosSelect();
}

function onFiltroLocalidadChange(loc) {
  filtroLocalidadActiva = (loc || '').trim();
  renderEstablecimientosSelect();
}

function onFiltroTextoChange(txt) {
  filtroTextoEstablecimiento = (txt || '').toLowerCase().trim();
  renderEstablecimientosSelect();
}

// Compatibilidad hacia atrás
function filtrarEstablecimientos(txt) {
  onFiltroTextoChange(txt);
}

function limpiarFiltrosEstablecimiento() {
  filtroCuitActivo = '';
  filtroLocalidadActiva = '';
  filtroTextoEstablecimiento = '';

  const selCuit = document.getElementById('filtro-cuit');
  if (selCuit) selCuit.value = '';

  const inpTxt = document.getElementById('filtro-busqueda-texto');
  if (inpTxt) inpTxt.value = '';

  poblarSelectorLocalidades();
  const selLoc = document.getElementById('filtro-localidad');
  if (selLoc) selLoc.value = '';

  renderEstablecimientosSelect();
}

// Poblar selector de CUITs / Organismos
function poblarSelectoresFiltros() {
  const selCuit = document.getElementById('filtro-cuit');
  if (!selCuit) return;

  const cuitsMap = new Map();
  // Recorrer todos los establecimientos para recopilar Organismos con su CUIT tributario
  Object.keys(establecimientosDB).forEach(id => {
    const est = establecimientosDB[id];
    if (!est) return;
    const norm = normalizarEstablecimiento(est);
    if (!norm) return;
    const org = norm.organismo;
    const cuit = norm.cuit;
    if (!cuitsMap.has(org)) {
      cuitsMap.set(org, { cuit: cuit, org: org, count: 0 });
    }
    cuitsMap.get(org).count++;
  });

  const currVal = selCuit.value || filtroCuitActivo;
  selCuit.innerHTML = '<option value="">🏢 Todos los CUITs / Organismos</option>';

  // Ordenar alfabéticamente por organismo
  const sorted = Array.from(cuitsMap.entries()).sort((a, b) => a[1].org.localeCompare(b[1].org, 'es'));
  sorted.forEach(([orgName, info]) => {
    const opt = document.createElement('option');
    opt.value = orgName;
    const cuitLabel = info.cuit ? `${info.cuit} — ` : '';
    opt.textContent = `${cuitLabel}${info.org} (${info.count} sedes)`;
    if (orgName === currVal) opt.selected = true;
    selCuit.appendChild(opt);
  });

  poblarSelectorLocalidades();
  poblarDirectorioCuitSelect();
  poblarDirectorioProvinciaSelect();
  poblarDirectorioLocalidadSelect();
}

// Poblar localidades condicionadas por el CUIT seleccionado
function poblarSelectorLocalidades() {
  const selLoc = document.getElementById('filtro-localidad');
  if (!selLoc) return;

  const locsMap = new Map();
  Object.keys(establecimientosDB).forEach(id => {
    const est = establecimientosDB[id];
    if (!est) return;
    const norm = normalizarEstablecimiento(est);
    if (!norm) return;
    
    // Condicionar por CUIT / Organismo activo si está seleccionado
    if (filtroCuitActivo) {
      const matchCuit = (norm.cuit && norm.cuit === filtroCuitActivo) ||
                        (norm.organismo === filtroCuitActivo || norm.razonSocial === filtroCuitActivo);
      if (!matchCuit) return;
    }

    const loc = (norm.localidad || '').trim();
    if (loc) {
      locsMap.set(loc, (locsMap.get(loc) || 0) + 1);
    }
  });

  const prevLoc = filtroLocalidadActiva;
  selLoc.innerHTML = '<option value="">📍 Todas las localidades</option>';

  const sortedLocs = Array.from(locsMap.keys()).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  let stillValid = false;

  sortedLocs.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = `${loc} (${locsMap.get(loc)})`;
    if (loc === prevLoc) {
      opt.selected = true;
      stillValid = true;
    }
    selLoc.appendChild(opt);
  });

  if (!stillValid) {
    filtroLocalidadActiva = '';
    selLoc.value = '';
  }
}

// Menú desplegable de herramientas secundarias
function toggleMenuOpciones(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('dropdown-menu-opciones');
  if (menu) {
    menu.classList.toggle('show');
  }
}

function closeMenuOpciones() {
  const menu = document.getElementById('dropdown-menu-opciones');
  if (menu) {
    menu.classList.remove('show');
  }
}

window.addEventListener('click', (e) => {
  const menu = document.getElementById('dropdown-menu-opciones');
  const btn = document.querySelector('.btn-action-more');
  if (menu && menu.classList.contains('show')) {
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.classList.remove('show');
    }
  }
});

// ==================== DIRECTORIO DE SEDES POR CUIT Y RAZÓN SOCIAL ====================
let directorioCuitActivo = '';
let directorioProvinciaActiva = '';
let directorioLocalidadActiva = '';
let directorioFiltroEstado = ''; // '' = todos, 'con_check' = relevados, 'sin_check' = pendientes
let directorioFiltroTexto = '';

function onDirectorioCuitChange(cuit) {
  directorioCuitActivo = (cuit || '').trim();
  poblarDirectorioLocalidadSelect();
  renderDirectorioSedesList();
}

function onDirectorioProvinciaChange(prov) {
  directorioProvinciaActiva = (prov || '').trim();
  poblarDirectorioLocalidadSelect();
  renderDirectorioSedesList();
}

function onDirectorioLocalidadChange(loc) {
  directorioLocalidadActiva = (loc || '').trim();
  renderDirectorioSedesList();
}

function onDirectorioEstadoChange(estado) {
  directorioFiltroEstado = (estado || '').trim();
  renderDirectorioSedesList();
}

function onDirectorioTextoChange(txt) {
  directorioFiltroTexto = (txt || '').toLowerCase().trim();
  renderDirectorioSedesList();
}

function limpiarFiltrosDirectorio() {
  directorioCuitActivo = '';
  directorioProvinciaActiva = '';
  directorioLocalidadActiva = '';
  directorioFiltroEstado = '';
  directorioFiltroTexto = '';

  const selCuit = document.getElementById('directorio-sel-cuit');
  if (selCuit) selCuit.value = '';

  const selProv = document.getElementById('directorio-sel-provincia');
  if (selProv) selProv.value = '';

  const selLoc = document.getElementById('directorio-sel-localidad');
  if (selLoc) selLoc.value = '';

  const selEst = document.getElementById('directorio-filtro-estado');
  if (selEst) selEst.value = '';

  const inpTxt = document.getElementById('directorio-filtro-texto');
  if (inpTxt) inpTxt.value = '';

  poblarDirectorioCuitSelect();
  poblarDirectorioProvinciaSelect();
  poblarDirectorioLocalidadSelect();
  renderDirectorioSedesList();
}

function poblarDirectorioCuitSelect() {
  const selCuit = document.getElementById('directorio-sel-cuit');
  if (!selCuit) return;

  const cuitsMap = new Map();
  let totalSedes = 0;
  Object.keys(establecimientosDB).forEach(id => {
    const est = establecimientosDB[id];
    if (!est) return;
    const norm = normalizarEstablecimiento(est);
    if (!norm) return;
    const org = norm.organismo;
    const cuit = norm.cuit;
    if (!cuitsMap.has(org)) {
      cuitsMap.set(org, { cuit: cuit, org: org, count: 0 });
    }
    cuitsMap.get(org).count++;
    totalSedes++;
  });

  const currVal = selCuit.value || directorioCuitActivo;
  selCuit.innerHTML = `<option value="">🏢 Todos los CUITs / Organismos (${totalSedes} sedes)</option>`;

  const sorted = Array.from(cuitsMap.entries()).sort((a, b) => a[1].org.localeCompare(b[1].org, 'es'));

  sorted.forEach(([orgName, info]) => {
    const opt = document.createElement('option');
    opt.value = orgName;
    const cuitLabel = info.cuit ? `${info.cuit} — ` : '';
    opt.textContent = `${cuitLabel}${info.org} (${info.count} sedes)`;
    if (orgName === currVal) opt.selected = true;
    selCuit.appendChild(opt);
  });
}

function poblarDirectorioProvinciaSelect() {
  const selProv = document.getElementById('directorio-sel-provincia');
  if (!selProv) return;

  const provMap = new Map();
  let total = 0;
  Object.keys(establecimientosDB).forEach(id => {
    const est = establecimientosDB[id];
    if (!est) return;
    const norm = normalizarEstablecimiento(est);
    if (!norm) return;
    const prov = norm.provincia || 'Entre Ríos';
    provMap.set(prov, (provMap.get(prov) || 0) + 1);
    total++;
  });

  const currVal = selProv.value || directorioProvinciaActiva;
  selProv.innerHTML = `<option value="">🌐 Todas las Provincias (${total})</option>`;

  const sorted = Array.from(provMap.entries()).sort((a, b) => {
    if (a[0] === 'Entre Ríos') return -1;
    if (b[0] === 'Entre Ríos') return 1;
    return a[0].localeCompare(b[0], 'es');
  });

  sorted.forEach(([provName, count]) => {
    const opt = document.createElement('option');
    opt.value = provName;
    opt.textContent = `${provName} (${count})`;
    if (provName === currVal) opt.selected = true;
    selProv.appendChild(opt);
  });
}

function poblarDirectorioLocalidadSelect() {
  const selLoc = document.getElementById('directorio-sel-localidad');
  if (!selLoc) return;

  const locMap = new Map();
  let total = 0;

  Object.keys(establecimientosDB).forEach(id => {
    const est = establecimientosDB[id];
    if (!est) return;
    const norm = normalizarEstablecimiento(est);
    if (!norm) return;

    // Si hay CUIT seleccionado, filtrar localidades de ese CUIT
    if (directorioCuitActivo) {
      const matchOrg = (norm.organismo === directorioCuitActivo || norm.razonSocial === directorioCuitActivo || (norm.cuit && norm.cuit === directorioCuitActivo));
      if (!matchOrg) return;
    }
    // Si hay Provincia seleccionada, filtrar localidades de esa Provincia
    if (directorioProvinciaActiva) {
      if ((norm.provincia || 'Entre Ríos') !== directorioProvinciaActiva) return;
    }

    const loc = norm.localidad || 'Entre Ríos';
    locMap.set(loc, (locMap.get(loc) || 0) + 1);
    total++;
  });

  const currVal = selLoc.value || directorioLocalidadActiva;
  selLoc.innerHTML = `<option value="">📍 Todas las Localidades (${total})</option>`;

  const sorted = Array.from(locMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));

  let foundCurr = false;
  sorted.forEach(([locName, count]) => {
    const opt = document.createElement('option');
    opt.value = locName;
    opt.textContent = `${locName} (${count})`;
    if (locName.toLowerCase() === currVal.toLowerCase()) {
      opt.selected = true;
      foundCurr = true;
    }
    selLoc.appendChild(opt);
  });

  if (!foundCurr && currVal) {
    directorioLocalidadActiva = '';
    selLoc.value = '';
  }
}

function getSedeKey(est) {
  const org = String(est.organismo || est.razonSocial || '').trim();
  const nro = String(est.nroEstab || '').trim();
  const dom = String(est.domicilio || est.direccion || '').trim().toLowerCase();
  const loc = String(est.localidad || '').trim().toLowerCase();
  if (nro && nro !== 's/n') return `${org}__nro_${nro}`;
  return `${org}__dom_${dom}_${loc}`;
}

function esNombreGenerico(nom, dom, nro, loc) {
  if (!nom) return true;
  const s = nom.trim().toLowerCase();
  if (s.includes('sin nombre') || s === 'empresa' || s === '[completar nombre]') return true;
  if (s.startsWith('dependencia') || s.startsWith('establecimiento n°')) return true;
  // Si coincide con la dirección o la dirección con localidad
  if (dom && s.startsWith(dom.trim().toLowerCase())) return true;
  return false;
}

function renderDirectorioSedesList() {
  const tbody = document.getElementById('directorio-tbody-sedes');
  const badgeStats = document.getElementById('directorio-stats-badge');
  const badgeNav = document.getElementById('badge-sedes-count');
  const selEstado = document.getElementById('directorio-filtro-estado');
  if (!tbody) return;

  // Agrupar registros de establecimientos por sede física única dentro de su organismo
  const sedesMap = new Map();
  const filterTxt = (directorioFiltroTexto || '').toLowerCase().trim();

  Object.keys(establecimientosDB).forEach(id => {
    const rawEst = establecimientosDB[id];
    if (!rawEst) return;
    const est = normalizarEstablecimiento(rawEst);
    if (!est) return;

    // Sincronizar con datos vivos del formulario si este establecimiento es el activo
    let liveNom = (id === currentEstId && document.getElementById('f_nombre_establecimiento')?.value?.trim()) ? document.getElementById('f_nombre_establecimiento').value.trim() : '';
    let liveFecha = (id === currentEstId && document.getElementById('f_fecha')?.value?.trim()) ? document.getElementById('f_fecha').value.trim() : '';

    let estNom = liveNom || (est.nombreEstablecimiento || (est.data && est.data.establecimiento && est.data.establecimiento.nombreEstablecimiento) || '').trim();
    let estFecha = liveFecha || (est.fecha || (est.data && est.data.establecimiento && est.data.establecimiento.fecha) || '').trim();

    if (estNom) est.nombreEstablecimiento = estNom;
    if (estFecha) est.fecha = estFecha;

    // 1. Filtro por CUIT u Organismo seleccionado en el directorio
    if (directorioCuitActivo) {
      const matchOrg = (est.organismo === directorioCuitActivo || est.razonSocial === directorioCuitActivo || (est.cuit && est.cuit === directorioCuitActivo));
      if (!matchOrg) return;
    }

    // 2. Filtro por Provincia
    if (directorioProvinciaActiva) {
      if ((est.provincia || 'Entre Ríos') !== directorioProvinciaActiva) return;
    }

    // 3. Filtro por Localidad
    if (directorioLocalidadActiva) {
      if ((est.localidad || '').toLowerCase() !== directorioLocalidadActiva.toLowerCase()) return;
    }

    const key = getSedeKey(est);
    if (!sedesMap.has(key)) {
      sedesMap.set(key, {
        baseId: id,
        organismo: est.organismo,
        nombreEstablecimientoCatalogo: estNom || (est.domicilio ? `${est.domicilio} (${est.localidad})` : 'Establecimiento sin nombre'),
        nroEstab: est.nroEstab,
        domicilio: est.domicilio || est.direccion || '',
        localidad: est.localidad || 'Entre Ríos',
        provincia: est.provincia || 'Entre Ríos',
        cuit: est.cuit || '',
        relevamientos: []
      });
    }

    const sedeObj = sedesMap.get(key);

    const tieneContenido = Boolean(est.data || estFecha || est.impactadoSheets || (typeof PRELOADED_SURVEYS !== 'undefined' && PRELOADED_SURVEYS[id]));
    if (tieneContenido) {
      // Obtener el nombre del relevamiento (el que consignó el preventor en el checklist)
      let nomChecklist = '';
      if (id === currentEstId && liveNom) {
        nomChecklist = liveNom;
      } else if (est.data?.establecimiento?.nombreEstablecimiento) {
        nomChecklist = est.data.establecimiento.nombreEstablecimiento.trim();
      } else if (typeof PRELOADED_SURVEYS !== 'undefined' && PRELOADED_SURVEYS[id]) {
        nomChecklist = (PRELOADED_SURVEYS[id].data?.establecimiento?.nombreEstablecimiento || PRELOADED_SURVEYS[id].nombreEstablecimiento || '').trim();
      } else if (estNom && !esNombreGenerico(estNom, est.domicilio, est.nroEstab, est.localidad)) {
        nomChecklist = estNom;
      }

      sedeObj.relevamientos.push({
        id: id,
        fecha: estFecha || 'Fecha sin consignar',
        nombreChecklist: nomChecklist,
        impactadoSheets: Boolean(est.impactadoSheets),
        esPrecargado: Boolean(typeof PRELOADED_SURVEYS !== 'undefined' && PRELOADED_SURVEYS[id])
      });
    }
  });

  // Filtro por texto libre
  const allSedesArray = Array.from(sedesMap.values()).filter(sede => {
    if (!filterTxt) return true;
    const conNom = sede.relevamientos.find(r => r.nombreChecklist && r.nombreChecklist.trim());
    const nomCheck = conNom ? conNom.nombreChecklist.toLowerCase() : '';
    const nomCat = (sede.nombreEstablecimientoCatalogo || '').toLowerCase();
    const nro = String(sede.nroEstab || '').toLowerCase();
    const loc = String(sede.localidad || '').toLowerCase();
    const dom = String(sede.domicilio || '').toLowerCase();
    const org = String(sede.organismo || '').toLowerCase();
    const prov = String(sede.provincia || '').toLowerCase();
    return nomCheck.includes(filterTxt) || nomCat.includes(filterTxt) || nro.includes(filterTxt) || loc.includes(filterTxt) || dom.includes(filterTxt) || org.includes(filterTxt) || prov.includes(filterTxt);
  });

  const totalSedes = allSedesArray.length;
  const conRelCount = allSedesArray.filter(s => s.relevamientos.length > 0).length;
  const sinRelCount = totalSedes - conRelCount;

  // Actualizar selector de estado con las cantidades dinámicas
  if (selEstado && selEstado.options && selEstado.options.length >= 3) {
    selEstado.options[0].textContent = `📋 Todos (${totalSedes})`;
    selEstado.options[1].textContent = `✅ Con checklist (${conRelCount})`;
    selEstado.options[2].textContent = `⏳ Pendientes (${sinRelCount})`;
  }

  // Filtrar según el estado seleccionado (con_check o sin_check)
  let sedesArray = allSedesArray;
  if (directorioFiltroEstado === 'con_check') {
    sedesArray = sedesArray.filter(s => s.relevamientos.length > 0);
  } else if (directorioFiltroEstado === 'sin_check') {
    sedesArray = sedesArray.filter(s => s.relevamientos.length === 0);
  }

  // Ordenar: primero las que tienen número de establecimiento ordenadas numéricamente
  sedesArray.sort((a, b) => {
    const na = parseInt(a.nroEstab, 10);
    const nb = parseInt(b.nroEstab, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    const nameA = (a.relevamientos.find(r => r.nombreChecklist)?.nombreChecklist || a.nombreEstablecimientoCatalogo || '');
    const nameB = (b.relevamientos.find(r => r.nombreChecklist)?.nombreChecklist || b.nombreEstablecimientoCatalogo || '');
    return nameA.localeCompare(nameB, 'es');
  });

  if (badgeStats) {
    badgeStats.textContent = `${totalSedes} sedes (${conRelCount} relevadas, ${sinRelCount} pendientes)`;
  }
  if (badgeNav) {
    badgeNav.textContent = `${totalSedes} Sedes`;
  }

  tbody.innerHTML = '';

  if (sedesArray.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:36px 16px; color:#64748b;">
          <div style="font-size: 28px; margin-bottom: 6px;">🔍</div>
          <strong style="font-size: 13px; color: #334155;">No se encontraron establecimientos</strong>
          <p style="font-size: 11px; margin: 4px 0 0 0;">Probá cambiando el filtro de estado, CUIT, provincia o localidad, o limpiando la búsqueda.</p>
        </td>
      </tr>
    `;
    return;
  }

  sedesArray.forEach(sede => {
    const tr = document.createElement('tr');

    const nroBadge = sede.nroEstab 
      ? `<span class="directorio-nro-badge">N° ${escHtml(sede.nroEstab)}</span>` 
      : '<span class="directorio-nro-badge" style="background:#f1f5f9;color:#64748b;border-color:#e2e8f0;">S/N</span>';
    
    // REGLA CLARA:
    // Si tiene checklist: el nombre es el que relevó el preventor en el checklist.
    // Si no tiene checklist: el nombre es el del catálogo (dirección o nombre provisorio).
    let nombreAMostrar = '';
    if (sede.relevamientos.length > 0) {
      const conNom = sede.relevamientos.find(r => r.nombreChecklist && r.nombreChecklist.trim());
      nombreAMostrar = conNom ? conNom.nombreChecklist.trim() : sede.nombreEstablecimientoCatalogo;
    } else {
      nombreAMostrar = sede.nombreEstablecimientoCatalogo;
    }

    const nomSede = escHtml(nombreAMostrar || 'Establecimiento sin nombre');
    const locSede = escHtml(sede.localidad || 'Entre Ríos');
    const provSede = (sede.provincia && sede.provincia !== 'Entre Ríos') ? ` (${escHtml(sede.provincia)})` : '';
    const domSede = escHtml(sede.domicilio || '—');

    let relevamientosHtml = '';
    let accionHtml = '';

    if (sede.relevamientos.length > 0) {
      const btns = sede.relevamientos.map(r => {
        const icon = r.impactadoSheets ? '☁️' : (r.esPrecargado ? '⭐' : '📝');
        return `<button type="button" class="btn-directorio-ver" onclick="abrirRelevamientoDirectorio('${r.id}')" title="Ver relevamiento completo del ${escHtml(r.fecha)}">👁️ ${icon} ${escHtml(r.fecha)}</button>`;
      }).join('');
      relevamientosHtml = `<div class="directorio-rel-cell">${btns}</div>`;

      // Si ya tiene relevamiento, el botón de acción permite abrir una nueva visita
      accionHtml = `
        <div style="text-align:center;">
          <button type="button" class="btn-directorio-nuevo" onclick="iniciarNuevoRelevamientoDirectorio('${sede.baseId}')" title="Cargar una nueva visita en fecha distinta para esta sede">
            💾 + Nueva Visita
          </button>
        </div>
      `;
    } else {
      relevamientosHtml = '<div style="text-align:center;"><span class="directorio-sin-relevamiento">⏳ Sin checklist</span></div>';

      // Si no tiene relevamiento, botón directo para cargarlo
      accionHtml = `
        <div style="text-align:center;">
          <button type="button" class="btn-directorio-cargar-check" onclick="cargarChecklistSedePendiente('${sede.baseId}')" title="Comenzar a cargar el checklist de este establecimiento">
            📝 Cargar Checklist
          </button>
        </div>
      `;
    }

    tr.innerHTML = `
      <td style="text-align:center;">${nroBadge}</td>
      <td>
        <div class="directorio-nom-sede">${nomSede}</div>
      </td>
      <td>
        <span style="font-size:11px;font-weight:600;color:#0369a1;">📍 ${locSede}${provSede}</span>
      </td>
      <td>
        <span class="directorio-dom-sede">${domSede}</span>
      </td>
      <td>${relevamientosHtml}</td>
      <td>${accionHtml}</td>
    `;

    tbody.appendChild(tr);
  });
}

function cargarChecklistSedePendiente(baseId) {
  if (!establecimientosDB[baseId]) return;
  const est = establecimientosDB[baseId];

  // Si no tiene fecha cargada, asignar la fecha de hoy
  if (!est.fecha) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    est.fecha = `${dd}/${mm}/${yyyy}`;
  }

  cambiarEstablecimiento(baseId);
  switchModule('mod-check');
  resaltarElemento('f_nombre_establecimiento');

  const statEl = document.getElementById('save-status');
  if (statEl) {
    statEl.textContent = `📝 Completando checklist: ${est.nombreEstablecimiento} (${est.localidad})`;
    statEl.style.color = '#0284c7';
    setTimeout(() => { statEl.textContent = '💾 Guardado local activo'; statEl.style.color = ''; }, 3500);
  }
}

function abrirRelevamientoDirectorio(estId) {
  if (!establecimientosDB[estId]) return;
  cambiarEstablecimiento(estId);
  switchModule('mod-check');
  resaltarElemento('f_nombre_establecimiento');
}

function iniciarNuevoRelevamientoDirectorio(baseId) {
  const estBase = establecimientosDB[baseId];
  if (!estBase) return;
  
  // Abrir el modal de nuevo checklist preseleccionando esta sede
  abrirModalNuevoChecklist();
  const selExistente = document.getElementById('modal_sel_existente');
  if (selExistente) {
    selExistente.value = baseId;
    actualizarInfoSedeModal(baseId);
  }
}

// Nota: PRELOADED_SURVEYS y PRELOADED_ESTABLECIMIENTOS se cargan desde datos_precargados.js

function initEstablecimientos() {
  try {
    const raw = localStorage.getItem('hys_establecimientos_db');
    if (raw) establecimientosDB = JSON.parse(raw);
  } catch(e) {
    establecimientosDB = {};
  }

  // 1. Incorporar todo el catálogo oficial de 452 establecimientos de Google Sheets
  if (typeof PRELOADED_ESTABLECIMIENTOS !== 'undefined') {
    Object.keys(PRELOADED_ESTABLECIMIENTOS).forEach(id => {
      const norm = normalizarEstablecimiento(PRELOADED_ESTABLECIMIENTOS[id]);
      if (norm) {
        if (!establecimientosDB[id]) {
          establecimientosDB[id] = norm;
        } else {
          // Asegurar datos oficiales normalizados
          establecimientosDB[id].organismo = norm.organismo;
          establecimientosDB[id].razonSocial = norm.razonSocial;
          establecimientosDB[id].cuit = norm.cuit;
          if (!establecimientosDB[id].nombreEstablecimiento) {
            establecimientosDB[id].nombreEstablecimiento = norm.nombreEstablecimiento;
          }
        }
      }
    });
  }

  // 2. Pre-cargar y asegurar los 15 relevamientos técnicos oficiales analizados
  if (typeof PRELOADED_SURVEYS !== 'undefined') {
    Object.keys(PRELOADED_SURVEYS).forEach(id => {
      const preloadedRaw = PRELOADED_SURVEYS[id];
      const normPreloaded = normalizarEstablecimiento(JSON.parse(JSON.stringify(preloadedRaw)));
      if (normPreloaded) {
        const officialChecklistName = preloadedRaw.data?.establecimiento?.nombreEstablecimiento || preloadedRaw.nombreEstablecimiento;
        if (establecimientosDB[id] && establecimientosDB[id].data) {
          establecimientosDB[id] = Object.assign(normPreloaded, establecimientosDB[id]);
          if (officialChecklistName && (!establecimientosDB[id].nombreEstablecimiento || esNombreGenerico(establecimientosDB[id].nombreEstablecimiento, establecimientosDB[id].domicilio, establecimientosDB[id].nroEstab, establecimientosDB[id].localidad))) {
            establecimientosDB[id].nombreEstablecimiento = officialChecklistName;
            if (establecimientosDB[id].data && establecimientosDB[id].data.establecimiento) {
              establecimientosDB[id].data.establecimiento.nombreEstablecimiento = officialChecklistName;
            }
          }
        } else {
          establecimientosDB[id] = normPreloaded;
        }
      }
    });
  }

  // 3. Sanitizar base: eliminar registros basura como 'Empresa', vacíos o corruptos
  Object.keys(establecimientosDB).forEach(id => {
    const est = establecimientosDB[id];
    const norm = normalizarEstablecimiento(est);
    if (!norm) {
      delete establecimientosDB[id];
    } else {
      establecimientosDB[id] = norm;
    }
  });

  // Eliminar establecimiento dummy est_1 si ya tenemos establecimientos reales
  const realKeys = Object.keys(establecimientosDB).filter(k => k !== 'est_1');
  if (realKeys.length > 0 && establecimientosDB['est_1']) {
    delete establecimientosDB['est_1'];
  }

  const lastActive = localStorage.getItem('hys_current_est_id');
  if (lastActive && establecimientosDB[lastActive]) {
    currentEstId = lastActive;
  } else if (!currentEstId || !establecimientosDB[currentEstId]) {
    currentEstId = 'est_sheet_180'; // Seleccionar Comisaría 3ra por defecto
  }
  saveEstablecimientosDB();

  // Limpiar capacitaciones automáticas residuales si solo tenían las 3 por defecto
  Object.keys(establecimientosDB).forEach(k => {
    const est = establecimientosDB[k];
    if (est && est.data && est.data.programacion && Array.isArray(est.data.programacion.capacitacion)) {
      const caps = est.data.programacion.capacitacion;
      if (caps.length === 3 && (caps[0].tema || '').includes('extintores') && !caps[0].month) {
        est.data.programacion.capacitacion = [];
      }
    }
  });

  const keys = Object.keys(establecimientosDB);
  if (keys.length === 0) {
    establecimientosDB['est_sheet_180'] = {
      id: 'est_sheet_180',
      organismo: 'JEFATURA DE POLICIA DE LA PROVINCIA DE ENTRE RIOS',
      razonSocial: 'JEFATURA DE POLICIA DE LA PROVINCIA DE ENTRE RIOS',
      nombreEstablecimiento: 'Comisaría 3ra - Div. Montada, Canes y Bomberos',
      direccion: 'Alejandro Carbó 841',
      domicilio: 'Alejandro Carbó 841',
      cp: '3100',
      localidad: 'Paraná',
      provincia: 'Entre Ríos',
      nroEstab: '56',
      cuit: '30-67119808-1',
      art: 'IAPSER ART',
      fecha: '',
      data: null
    };
    currentEstId = 'est_sheet_180';
    saveEstablecimientosDB();
  } else {
    currentEstId = (establecimientosDB[currentEstId]) ? currentEstId : (establecimientosDB['est_sheet_180'] ? 'est_sheet_180' : keys[0]);
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramEst = urlParams.get('est') || urlParams.get('estId') || localStorage.getItem('hys_current_est_id');
  if (paramEst && establecimientosDB[paramEst]) {
    currentEstId = paramEst;
  }

  poblarSelectoresFiltros();
  renderEstablecimientosSelect();
  cargarEstablecimiento(currentEstId, false);
  poblarDirectorioCuitSelect();
  poblarDirectorioProvinciaSelect();
  poblarDirectorioLocalidadSelect();
  renderDirectorioSedesList();
}

function renderEstablecimientosSelect() {
  const sel = document.getElementById('sel-establecimiento');
  const countBadge = document.getElementById('count-estab-filtrados');
  if (!sel) return;
  sel.innerHTML = '';
  
  const filterTxt = (filtroTextoEstablecimiento || '').toLowerCase().trim();
  let matchesCount = 0;

  const preloadedGroup = document.createElement('optgroup');
  preloadedGroup.label = '⭐ Informes técnicos relevados (listos)';
  
  const othersGroup = document.createElement('optgroup');
  othersGroup.label = '🏢 Establecimientos de la planilla';

  const preloadedIds = (typeof PRELOADED_SURVEYS !== 'undefined') ? Object.keys(PRELOADED_SURVEYS) : [];
  const preloadedSet = new Set(preloadedIds);

  function matchesFilters(est, id) {
    if (!est) return false;

    // 1. Filtro CUIT / Organismo
    if (filtroCuitActivo) {
      const matchCuit = (est.cuit && est.cuit === filtroCuitActivo) ||
                        (est.organismo === filtroCuitActivo || est.razonSocial === filtroCuitActivo);
      if (!matchCuit) return false;
    }

    // 2. Filtro Localidad
    if (filtroLocalidadActiva) {
      const estLoc = (est.localidad || '').trim().toLowerCase();
      if (estLoc !== filtroLocalidadActiva.toLowerCase()) return false;
    }

    // 3. Filtro Texto rápido (Nombre, Dirección, Nro de establecimiento, etc.)
    if (filterTxt) {
      const title = getEstTitle(est).toLowerCase();
      const loc = (est.localidad || '').toLowerCase();
      const nro = String(est.nroEstab || '').toLowerCase();
      const dom = String(est.domicilio || est.direccion || '').toLowerCase();
      const nom = String(est.nombreEstablecimiento || '').toLowerCase();
      if (!title.includes(filterTxt) && !loc.includes(filterTxt) && !nro.includes(filterTxt) && !dom.includes(filterTxt) && !nom.includes(filterTxt)) {
        return false;
      }
    }

    return true;
  }

  // Orden prioritario de los analizados
  const priorityOrder = ["est_sheet_146", "est_sheet_148", "est_sheet_157", "est_sheet_158", "est_sheet_167", "est_sheet_170", "est_sheet_173", "est_sheet_175", "est_sheet_180", "est_sheet_182", "est_sheet_183", "est_sheet_232", "est_sheet_241", "est_sheet_243", "est_sheet_245"];
  
  priorityOrder.forEach(id => {
    if (establecimientosDB[id]) {
      const est = establecimientosDB[id];
      if (matchesFilters(est, id)) {
        matchesCount++;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = '⭐ ' + getEstTitle(est);
        if (id === currentEstId) opt.selected = true;
        preloadedGroup.appendChild(opt);
      }
    }
  });

  // Los demás establecimientos
  Object.keys(establecimientosDB).forEach(id => {
    if (!preloadedSet.has(id)) {
      const est = establecimientosDB[id];
      if (matchesFilters(est, id)) {
        matchesCount++;
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = getEstTitle(est);
        if (id === currentEstId) opt.selected = true;
        othersGroup.appendChild(opt);
      }
    }
  });

  if (preloadedGroup.children.length > 0) sel.appendChild(preloadedGroup);
  if (othersGroup.children.length > 0) sel.appendChild(othersGroup);

  if (countBadge) {
    countBadge.textContent = matchesCount;
  }

  if (matchesCount === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— Sin coincidencias con los filtros aplicados —';
    sel.appendChild(opt);
  } else {
    // Si el establecimiento seleccionado actualmente está en la lista visible, seleccionarlo
    if (sel.querySelector(`option[value="${currentEstId}"]`)) {
      sel.value = currentEstId;
    }
  }

  // Actualizar el chip de la barra superior
  const topChip = document.getElementById('topbar-current-estab');
  if (topChip && establecimientosDB[currentEstId]) {
    const estAct = establecimientosDB[currentEstId];
    const shortTitle = `📍 ${estAct.nombreEstablecimiento || estAct.organismo || 'Sede'} (N° ${estAct.nroEstab || 'S/N'})`;
    topChip.textContent = shortTitle;
    topChip.title = getEstTitle(estAct);
  }
}

function saveEstablecimientosDB() {
  try {
    localStorage.setItem('hys_establecimientos_db', JSON.stringify(establecimientosDB));
  } catch(e) {}
}

function cambiarEstablecimiento(newId) {
  if (!establecimientosDB[newId]) return;
  guardarEstablecimientoActual();
  currentEstId = newId;
  localStorage.setItem('hys_current_est_id', newId);
  cargarEstablecimiento(newId, true);
  renderEstablecimientosSelect();
}

function setModalTab(tab) {
  const panelExistente = document.getElementById('modal-panel-existente');
  const panelNuevo = document.getElementById('modal-panel-nuevo');
  const tabBtnExistente = document.getElementById('tab-btn-sel-existente');
  const tabBtnNuevo = document.getElementById('tab-btn-crear-nuevo');

  if (tab === 'existente') {
    if (panelExistente) panelExistente.style.display = 'block';
    if (panelNuevo) panelNuevo.style.display = 'none';
    if (tabBtnExistente) tabBtnExistente.classList.add('active');
    if (tabBtnNuevo) tabBtnNuevo.classList.remove('active');
  } else {
    if (panelExistente) panelExistente.style.display = 'none';
    if (panelNuevo) panelNuevo.style.display = 'block';
    if (tabBtnExistente) tabBtnExistente.classList.remove('active');
    if (tabBtnNuevo) tabBtnNuevo.classList.add('active');
    setTimeout(() => document.getElementById('modal_nuevo_nom')?.focus(), 150);
  }
}

function abrirModalNuevoChecklist() {
  const modal = document.getElementById('nuevo-est-modal');
  if (!modal) return;

  setModalTab('existente');

  // Inicializar fecha de relevamiento con la fecha de hoy (formato YYYY-MM-DD)
  const fechaInput = document.getElementById('modal_nuevo_fecha');
  if (fechaInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    fechaInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // Llenar selector de sedes existentes
  const sel = document.getElementById('modal_sel_existente');
  if (sel) {
    sel.innerHTML = '';
    const ids = Object.keys(establecimientosDB);
    ids.forEach(id => {
      const est = establecimientosDB[id];
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = getEstTitle(est);
      if (id === currentEstId) opt.selected = true;
      sel.appendChild(opt);
    });
    actualizarInfoSedeModal(sel.value || currentEstId);
  }

  modal.classList.add('show');
}

function abrirModalCrearSede() {
  const modal = document.getElementById('nuevo-est-modal');
  if (!modal) return;
  setModalTab('nuevo');
  modal.classList.add('show');
}

function abrirModalNuevoEstablecimiento() {
  abrirModalNuevoChecklist();
}

function closeNuevoEstModal() {
  const modal = document.getElementById('nuevo-est-modal');
  if (modal) modal.classList.remove('show');
}

function actualizarInfoSedeModal(estId) {
  const preview = document.getElementById('modal_sede_preview');
  if (!preview) return;
  const est = establecimientosDB[estId];
  if (!est) {
    preview.innerHTML = '<em>Seleccioná una sede de la lista.</em>';
    return;
  }
  const org = est.organismo || est.razonSocial || 'JEFATURA DE POLICIA DE LA PROVINCIA DE ENTRE RIOS';
  const nom = est.nombreEstablecimiento || '[Sin nombre asignado]';
  const dom = est.domicilio || est.direccion || 'Sin dirección registrada';
  const loc = est.localidad || 'Paraná';
  const nro = est.nroEstab ? `N° Estab: <strong>${est.nroEstab}</strong>` : 'N° Estab: <em>S/N</em>';
  const cuit = est.cuit || '30-67119808-1';

  preview.innerHTML = `
    <div style="font-weight:bold;font-size:11px;color:#0b3d63;margin-bottom:2px;">🏢 ${escHtml(org)}</div>
    <div>📍 <strong>${escHtml(nom)}</strong> &nbsp;|&nbsp; ${nro} &nbsp;|&nbsp; <strong>${escHtml(loc)}</strong></div>
    <div style="margin-top:2px;color:#475569;">🏠 <strong>Dirección:</strong> ${escHtml(dom)} &nbsp;|&nbsp; <strong>CUIT:</strong> ${escHtml(cuit)}</div>
  `;
}

function confirmarNuevoChecklistSedeExistente() {
  const sel = document.getElementById('modal_sel_existente');
  const chosenId = sel ? sel.value : currentEstId;
  const estBase = establecimientosDB[chosenId];
  if (!estBase) {
    alert('⚠️ Por favor seleccioná un establecimiento del listado.');
    return;
  }

  // Obtener fecha del input del modal
  let fechaInput = document.getElementById('modal_nuevo_fecha')?.value || '';
  let fechaFormatted = '';
  if (fechaInput) {
    const parts = fechaInput.split('-');
    if (parts.length === 3) {
      fechaFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
      fechaFormatted = fechaInput;
    }
  } else {
    fechaFormatted = new Date().toLocaleDateString('es-AR');
  }

  // SIEMPRE generar una nueva instancia de checklist con checks en blanco, diferenciada por fecha
  const targetId = 'est_' + (estBase.nroEstab || 'sede') + '_' + Date.now();
  establecimientosDB[targetId] = {
    id: targetId,
    rowIndex: estBase.rowIndex || null,
    organismo: estBase.organismo || estBase.razonSocial || '',
    razonSocial: estBase.organismo || estBase.razonSocial || '',
    nombreEstablecimiento: estBase.nombreEstablecimiento || '',
    domicilio: estBase.domicilio || estBase.direccion || '',
    direccion: estBase.domicilio || estBase.direccion || '',
    nroEstab: estBase.nroEstab || '',
    cp: estBase.cp || '',
    localidad: estBase.localidad || 'Paraná',
    provincia: estBase.provincia || 'Entre Ríos',
    cuit: estBase.cuit || '30-67119808-1',
    art: estBase.art || 'IAPSER ART',
    fecha: fechaFormatted,
    impactadoSheets: false,
    sectores: (estBase.sectores && Array.isArray(estBase.sectores) && estBase.sectores.length > 0)
      ? [...estBase.sectores]
      : ['Planta Baja - Hall Acceso', 'Planta Baja - Guardia', 'Planta Baja - Pasillo Oficinas', 'Piso 1 - Pasillo Común', 'Sector Cocina / Depósito'],
    cargaFuegoDetalle: [],
    data: null // 100% en blanco
  };

  currentEstId = targetId;
  currentEstRowIndex = estBase.rowIndex || null;
  localStorage.setItem('hys_current_est_id', targetId);
  saveEstablecimientosDB();

  const org = estBase.organismo || estBase.razonSocial || '';
  const nom = estBase.nombreEstablecimiento || '';
  const dom = estBase.domicilio || estBase.direccion || '';
  const nro = estBase.nroEstab || '';
  const cp = estBase.cp || '';
  const loc = estBase.localidad || 'Paraná';
  const prov = estBase.provincia || 'Entre Ríos';
  const cuit = estBase.cuit || '30-67119808-1';
  const art = estBase.art || 'IAPSER ART';

  // Resetear todo el formulario a blanco absoluto
  resetFormularioNuevo(org, cuit, art);

  // Cargar datos de la sede elegida
  if (document.getElementById('f_razonsocial')) document.getElementById('f_razonsocial').value = org;
  if (document.getElementById('f_nombre_establecimiento')) document.getElementById('f_nombre_establecimiento').value = nom;
  if (document.getElementById('f_direccion')) document.getElementById('f_direccion').value = dom;
  if (document.getElementById('f_nro_estab')) document.getElementById('f_nro_estab').value = nro;
  if (document.getElementById('f_cp')) document.getElementById('f_cp').value = cp;
  if (document.getElementById('f_localidad')) document.getElementById('f_localidad').value = loc;
  if (document.getElementById('f_provincia')) document.getElementById('f_provincia').value = prov;
  if (document.getElementById('f_fecha')) document.getElementById('f_fecha').value = fechaFormatted;

  // Sectores para esta nueva visita
  currentSectores = [...establecimientosDB[targetId].sectores];
  renderSectoresChips();
  actualizarDatalistSectores();

  // Sincronizar planilla de extintores horizontal
  if (document.getElementById('ext_empresa')) document.getElementById('ext_empresa').value = org;
  if (document.getElementById('ext_area')) document.getElementById('ext_area').value = nom;
  if (document.getElementById('ext_fecha')) document.getElementById('ext_fecha').value = fechaFormatted;

  // Guardar estado limpio
  guardarEstablecimientoActual();
  renderEstablecimientosSelect();
  aplicarBloqueoImpactadoSheets();

  // Actualizar labels de cabecera
  const titleDisp = org + (nom ? ' — ' + nom : '');
  document.querySelectorAll('.mh-rs-label').forEach(el => el.textContent = ' — ' + titleDisp);

  closeNuevoEstModal();
  switchModule('mod-check');
  resaltarElemento('f_nombre_establecimiento');

  const statEl = document.getElementById('save-status');
  if (statEl) {
    statEl.textContent = '✨ Nuevo checklist en blanco: ' + nom + ' (' + fechaFormatted + ')';
    statEl.style.color = '#16a34a';
    setTimeout(() => { statEl.textContent = '💾 Guardado local activo'; statEl.style.color = ''; }, 3500);
  }
}

function iniciarNuevoChecklistParaEstablecimientoActual() {
  abrirModalNuevoChecklist();
}

function confirmarCrearNuevoEstablecimiento() {
  const org = (document.getElementById('modal_nuevo_org')?.value || 'JEFATURA DE POLICIA DE LA PROVINCIA DE ENTRE RIOS').trim();
  const nom = (document.getElementById('modal_nuevo_nom')?.value || '').trim();
  const nro = (document.getElementById('modal_nuevo_nro')?.value || '').trim();
  const dom = (document.getElementById('modal_nuevo_dom')?.value || '').trim();
  const loc = (document.getElementById('modal_nuevo_loc')?.value || 'Paraná').trim();
  const tamano = document.getElementById('modal_nuevo_tamano')?.value || '3';

  if (!nom) {
    alert('⚠️ Por favor ingresá el Nombre de la Sede / Dependencia (ej: Comisaría 5ta).');
    document.getElementById('modal_nuevo_nom')?.focus();
    return;
  }

  guardarEstablecimientoActual();

  const newId = 'est_' + Date.now();
  establecimientosDB[newId] = {
    id: newId,
    rowIndex: null,
    organismo: org,
    razonSocial: org,
    nombreEstablecimiento: nom,
    domicilio: dom,
    direccion: dom,
    nroEstab: nro,
    cp: '',
    localidad: loc,
    provincia: 'Entre Ríos',
    cuit: '30-67119808-1',
    art: 'IAPSER ART',
    fecha: new Date().toLocaleDateString('es-AR'),
    data: null
  };

  currentEstId = newId;
  localStorage.setItem('hys_current_est_id', newId);
  saveEstablecimientosDB();

  resetFormularioNuevo(org, '30-67119808-1', 'IAPSER ART');
  document.getElementById('f_razonsocial').value = org;
  document.getElementById('f_nombre_establecimiento').value = nom;
  document.getElementById('f_direccion').value = dom;
  document.getElementById('f_nro_estab').value = nro;
  document.getElementById('f_localidad').value = loc;
  document.getElementById('f_fecha').value = new Date().toLocaleDateString('es-AR');
  if (document.getElementById('f_tamano_estab')) {
    document.getElementById('f_tamano_estab').value = tamano;
  }
  actualizarTareasSegunTamano();

  // Sincronizar planilla de extintores
  if (document.getElementById('ext_empresa')) document.getElementById('ext_empresa').value = org;
  if (document.getElementById('ext_area')) document.getElementById('ext_area').value = nom;
  if (document.getElementById('ext_fecha')) document.getElementById('ext_fecha').value = new Date().toLocaleDateString('es-AR');

  // Guardar ficha limpia
  guardarEstablecimientoActual();
  renderEstablecimientosSelect();

  // Actualizar labels de cabecera en todas las páginas
  const titleDisp = org + ' — ' + nom;
  document.querySelectorAll('.mh-rs-label').forEach(el => el.textContent = ' — ' + titleDisp);

  closeNuevoEstModal();
  switchModule('mod-check');
  resaltarElemento('f_nombre_establecimiento');

  const statEl = document.getElementById('save-status');
  if (statEl) {
    statEl.textContent = '✨ Sede creada: ' + nom;
    statEl.style.color = '#15803d';
    setTimeout(() => { statEl.textContent = '💾 Guardado local activo'; statEl.style.color = ''; }, 3500);
  }
}

function crearNuevoEstablecimiento() {
  abrirModalCrearSede();
}

function eliminarEstablecimientoActual() {
  const keys = Object.keys(establecimientosDB);
  if (keys.length <= 1) {
    alert('⚠️ No se puede eliminar el único establecimiento cargado.');
    return;
  }
  const est = establecimientosDB[currentEstId];
  if (confirm(`¿Estás seguro de que deseas eliminar el establecimiento "${getEstTitle(est)}"? Esta acción no se puede deshacer.`)) {
    delete establecimientosDB[currentEstId];
    currentEstId = Object.keys(establecimientosDB)[0];
    saveEstablecimientosDB();
    renderEstablecimientosSelect();
    cargarEstablecimiento(currentEstId, true);
  }
}

function guardarEstablecimientoActual() {
  if (!currentEstId || !establecimientosDB[currentEstId]) return;
  const currentData = collectAllData();
  const estInfo = currentData.establecimiento || {};
  
  const fNom = document.getElementById('f_nombre_establecimiento')?.value?.trim();
  const fFecha = document.getElementById('f_fecha')?.value?.trim();
  const fDom = document.getElementById('f_direccion')?.value?.trim();
  const fNro = document.getElementById('f_nro_estab')?.value?.trim();
  const fLoc = document.getElementById('f_localidad')?.value?.trim();
  const fProv = document.getElementById('f_provincia')?.value?.trim();
  const fOrg = document.getElementById('f_razonsocial')?.value?.trim();
  const fCuit = document.getElementById('f_cuit')?.value?.trim();

  establecimientosDB[currentEstId].organismo = fOrg || estInfo.organismo || estInfo.razonSocial || '';
  establecimientosDB[currentEstId].razonSocial = fOrg || estInfo.organismo || estInfo.razonSocial || '';
  establecimientosDB[currentEstId].nombreEstablecimiento = fNom || estInfo.nombreEstablecimiento || '';
  establecimientosDB[currentEstId].domicilio = fDom || estInfo.domicilio || estInfo.direccion || '';
  establecimientosDB[currentEstId].direccion = fDom || estInfo.domicilio || estInfo.direccion || '';
  establecimientosDB[currentEstId].cp = estInfo.cp || '';
  establecimientosDB[currentEstId].localidad = fLoc || estInfo.localidad || '';
  establecimientosDB[currentEstId].provincia = fProv || estInfo.provincia || '';
  establecimientosDB[currentEstId].nroEstab = fNro || estInfo.nroEstab || '';
  establecimientosDB[currentEstId].cuit = fCuit || estInfo.cuit || '';
  establecimientosDB[currentEstId].art = estInfo.art || 'IAPSER ART';
  establecimientosDB[currentEstId].fecha = fFecha || estInfo.fecha || '';
  establecimientosDB[currentEstId].sectores = currentSectores;
  establecimientosDB[currentEstId].cargaFuegoDetalle = (typeof getCargaFuegoTableData === 'function') ? getCargaFuegoTableData() : [];
  establecimientosDB[currentEstId].data = currentData;
  saveEstablecimientosDB();
}

function cargarEstablecimiento(estId, showAlert) {
  // Solo inicializar con datos precargados si este ID aún no existe en establecimientosDB
  if (typeof PRELOADED_SURVEYS !== 'undefined' && PRELOADED_SURVEYS[estId]) {
    if (!establecimientosDB[estId]) {
      establecimientosDB[estId] = JSON.parse(JSON.stringify(PRELOADED_SURVEYS[estId]));
    }
  }

  const est = establecimientosDB[estId];
  if (!est) return;
  currentEstId = estId;
  currentEstRowIndex = est.rowIndex || null;

  if (est.data) {
    restoreFromData(est.data);
  } else {
    resetFormularioNuevo(est.organismo || est.razonSocial, est.cuit, est.art);
    if (est.nombreEstablecimiento) document.getElementById('f_nombre_establecimiento').value = est.nombreEstablecimiento;
    if (est.domicilio || est.direccion) document.getElementById('f_direccion').value = est.domicilio || est.direccion;
    if (est.nroEstab) document.getElementById('f_nro_estab').value = est.nroEstab;
    if (est.cp) document.getElementById('f_cp').value = est.cp;
    if (est.localidad) document.getElementById('f_localidad').value = est.localidad;
    if (est.provincia) document.getElementById('f_provincia').value = est.provincia;

    if (est.sectores && Array.isArray(est.sectores) && est.sectores.length > 0) {
      currentSectores = est.sectores;
    } else {
      currentSectores = ['Planta Baja - Hall Acceso', 'Planta Baja - Guardia', 'Planta Baja - Pasillo Oficinas', 'Piso 1 - Pasillo Común', 'Sector Cocina / Depósito'];
    }
    renderSectoresChips();
    actualizarDatalistSectores();

    if (est.cargaFuegoDetalle && Array.isArray(est.cargaFuegoDetalle)) {
      cargaFuegoData = est.cargaFuegoDetalle;
    } else {
      cargaFuegoData = [];
    }
    renderCargaFuegoTable();
  }

  const titleDisp = (est.organismo || est.razonSocial || '') + (est.nombreEstablecimiento ? ' — ' + est.nombreEstablecimiento : '');
  document.querySelectorAll('.mh-rs-label').forEach(el => el.textContent = titleDisp ? ' — ' + titleDisp : '');

  // Actualizar el chip de la barra superior
  const topChip = document.getElementById('topbar-current-estab');
  if (topChip) {
    const shortTitle = `📍 ${est.nombreEstablecimiento || est.organismo || 'Sede'} (N° ${est.nroEstab || 'S/N'})`;
    topChip.textContent = shortTitle;
    topChip.title = getEstTitle(est);
  }

  // Sincronizar cabecera de la planilla de extintores
  if (document.getElementById('ext_empresa')) document.getElementById('ext_empresa').value = est.organismo || est.razonSocial || '';
  if (document.getElementById('ext_area')) document.getElementById('ext_area').value = est.nombreEstablecimiento || '';
  if (document.getElementById('ext_fecha')) document.getElementById('ext_fecha').value = est.fecha || document.getElementById('f_fecha')?.value || new Date().toLocaleDateString('es-AR');
  if (document.getElementById('ext_controlador')) document.getElementById('ext_controlador').value = document.getElementById('f_relevador')?.value || '';

  // Aplicar bloqueo de Págs 1 a 5 si este relevamiento ya fue impactado en Sheets
  aplicarBloqueoImpactadoSheets();

  if (showAlert) {
    const statEl = document.getElementById('save-status');
    if (statEl) {
      statEl.textContent = '📂 Establecimiento cargado: ' + (est.organismo || est.razonSocial);
      statEl.style.color = '#0b3d63';
      setTimeout(() => { statEl.textContent = '💾 Guardado local activo'; statEl.style.color = ''; }, 3000);
    }
  }
}

// ==================== BLOQUEO DE AUDITORÍA POST-IMPACTO EN SHEETS ====================
function aplicarBloqueoImpactadoSheets() {
  const est = establecimientosDB[currentEstId];
  const isLocked = Boolean(est && est.impactadoSheets);

  // Mostrar u ocultar banner en Página 1
  const banner = document.getElementById('banner-impactado-sheets');
  if (banner) {
    banner.style.display = isLocked ? 'flex' : 'none';
  }

  // Deshabilitar o habilitar inputs, selects, textareas y radios de Páginas 1 a 5
  const relPages = ['#page-1', '#page-2', '#page-3', '#page-4', '#page-5'];
  relPages.forEach(sel => {
    const page = document.querySelector(sel);
    if (!page) return;

    if (isLocked) {
      page.classList.add('checklist-rel-locked');
    } else {
      page.classList.remove('checklist-rel-locked');
    }

    // Afectar campos de entrada, ignorando el buscador de la barra superior
    page.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id === 'filtro-establecimiento') return;
      el.disabled = isLocked;
    });

    page.querySelectorAll('.causa-checks input[type=checkbox]').forEach(el => {
      el.disabled = isLocked;
    });
  });

  // Asegurar que Páginas 6 a 10 (Plan de Acción y Programación) permanezcan SIEMPRE editables
  const progPages = ['#page-6', '#page-7', '#page-8', '#page-9', '#page-10'];
  progPages.forEach(sel => {
    const page = document.querySelector(sel);
    if (!page) return;
    page.classList.remove('checklist-rel-locked');
    page.querySelectorAll('input, select, textarea, button').forEach(el => {
      el.disabled = false;
    });
  });
}

function desbloquearRelevamientoConConfirmacion() {
  const ok = confirm(
    '⚠️ ATENCIÓN: Este relevamiento ya fue impactado en Google Sheets.\n\n' +
    '¿Desea desbloquear las Páginas 1 a 5 para modificar las respuestas o datos generales?\n\n' +
    'Nota: Si realiza modificaciones en el relevamiento, recuerde volver a hacer clic en "☁️ Guardar en Sheets" para sincronizar los cambios.'
  );
  if (ok) {
    if (establecimientosDB[currentEstId]) {
      establecimientosDB[currentEstId].impactadoSheets = false;
      saveEstablecimientosDB();
      aplicarBloqueoImpactadoSheets();
      alert('🔓 Relevamiento desbloqueado. Ya podés editar las respuestas de las Páginas 1 a 5.');
    }
  }
}

function resetFormularioNuevo(rs, cuit, art) {
  document.getElementById('f_razonsocial').value = rs || '';
  document.getElementById('f_nombre_establecimiento').value = '';
  document.getElementById('f_cuit').value = cuit || '';
  document.getElementById('f_art').value = art || 'IAPSER ART';
  document.getElementById('f_direccion').value = '';
  document.getElementById('f_nro_estab').value = '';
  document.getElementById('f_cp').value = '';
  document.getElementById('f_localidad').value = '';
  document.getElementById('f_provincia').value = 'Entre Ríos';
  document.getElementById('f_fecha').value = '';
  document.getElementById('f_relevador').value = '';
  document.getElementById('f_actividad').value = '';
  document.querySelectorAll('input[name="inmueble_tipo"]').forEach(r => r.checked = false);
  document.getElementById('f_inmueble_cond').value = '';
  document.getElementById('f_suptotal').value = '';
  document.getElementById('f_supcubierta').value = '';
  document.getElementById('f_plantas').value = '';
  document.getElementById('f_dottotal').value = '';
  document.getElementById('f_dotadm').value = '';
  document.getElementById('f_dotprod').value = '';
  document.getElementById('f_dototros').value = '';
  document.getElementById('f_condiciones').value = '';

  document.querySelectorAll('.citem input[type=radio]').forEach(r => r.checked = false);
  document.querySelectorAll('.citem').forEach(c => c.classList.remove('answered-S', 'answered-N', 'answered-NC'));
  document.querySelectorAll('.citem-causa').forEach(c => c.classList.remove('show'));
  document.querySelectorAll('.causa-checks input[type=checkbox]').forEach(c => c.checked = false);

  toggleProfBox('prof_hys', false);
  toggleProfBox('prof_med', false);

  document.getElementById('f_observaciones').value = '';
  Object.keys(planEdits).forEach(k => delete planEdits[k]);
  
  schedMedData = [];
  schedErgData = [];
  schedVisData = [];
  schedCapData = [];

  Object.keys(ganttCellState).forEach(k => delete ganttCellState[k]);

  if (document.getElementById('f_tamano_estab')) {
    document.getElementById('f_tamano_estab').value = '3';
    actualizarTareasSegunTamano();
  }
  extTableData = [];
  renderExtintoresTable();

  currentSectores = ['Planta Baja - Hall Acceso', 'Planta Baja - Guardia', 'Planta Baja - Pasillo Oficinas', 'Piso 1 - Pasillo Común', 'Sector Cocina / Depósito'];
  renderSectoresChips();
  actualizarDatalistSectores();
  cargaFuegoData = [];
  renderCargaFuegoTable();

  refreshPlan();
  renderSchedTables();
  buildGanttFromPage8();
}

// Reactividad al editar nombre, fecha y datos del establecimiento en el checklist
document.addEventListener('DOMContentLoaded', () => {
  const syncFields = ['f_nombre_establecimiento', 'f_fecha', 'f_direccion', 'f_nro_estab', 'f_localidad', 'f_razonsocial', 'f_cuit'];
  syncFields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.addEventListener('input', () => {
        if (currentEstId && establecimientosDB[currentEstId]) {
          const val = el.value.trim();
          if (fieldId === 'f_nombre_establecimiento') {
            establecimientosDB[currentEstId].nombreEstablecimiento = val;
            const org = establecimientosDB[currentEstId].organismo || establecimientosDB[currentEstId].razonSocial || '';
            const titleDisp = org + (val ? ' — ' + val : '');
            document.querySelectorAll('.mh-rs-label').forEach(lbl => lbl.textContent = titleDisp ? ' — ' + titleDisp : '');
          } else if (fieldId === 'f_fecha') {
            establecimientosDB[currentEstId].fecha = val;
          } else if (fieldId === 'f_direccion') {
            establecimientosDB[currentEstId].domicilio = val;
            establecimientosDB[currentEstId].direccion = val;
          } else if (fieldId === 'f_nro_estab') {
            establecimientosDB[currentEstId].nroEstab = val;
          } else if (fieldId === 'f_localidad') {
            establecimientosDB[currentEstId].localidad = val;
          } else if (fieldId === 'f_razonsocial') {
            establecimientosDB[currentEstId].organismo = val;
            establecimientosDB[currentEstId].razonSocial = val;
          } else if (fieldId === 'f_cuit') {
            establecimientosDB[currentEstId].cuit = val;
          }
          saveEstablecimientosDB();
          renderEstablecimientosSelect();
        }
      });
    }
  });
});

const N_MONTHS = 12;

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleLogoStyle() {
  alert('El logo se encuentra en su versión de máximo contraste corporativo (azul marino y cian sobre fondo blanco transparente), optimizado para impresión y pantalla.');
}

function marcarTodo(val, containerEl) {
  const scope = containerEl || document;
  scope.querySelectorAll('.citem').forEach(citem => {
    const radio = citem.querySelector(`:scope > .citem-row input[type=radio][value="${val}"]`);
    if (radio) {
      radio.checked = true;
      citem.classList.remove('answered-S','answered-N','answered-NC');
      citem.classList.add('answered-' + val);
      const causaDiv = citem.querySelector(':scope > .citem-causa');
      if (causaDiv) causaDiv.classList.toggle('show', val === 'N');
    }
  });

  if (val === 'S') {
    const q1 = document.querySelector('input[name="q1"]:checked');
    if (q1 && q1.value === 'S') toggleProfBox('prof_hys', true);
    const q2 = document.querySelector('input[name="q2"]:checked');
    if (q2 && q2.value === 'S') toggleProfBox('prof_med', true);
  } else {
    toggleProfBox('prof_hys', false);
    toggleProfBox('prof_med', false);
  }

  refreshAll();
  triggerAutoSave();
}

function marcarSeccion(btn, val) {
  const page = btn.closest('.page');
  const secHdr = btn.closest('.section-hdr-row');
  if (!page || !secHdr) return;
  
  let el = secHdr.nextElementSibling;
  while (el && !el.classList.contains('section-hdr-row') && !el.matches('h2') && !el.classList.contains('footer-page')) {
    if (el.classList.contains('citem')) {
      const radio = el.querySelector(`:scope > .citem-row input[type=radio][value="${val}"]`);
      if (radio) {
        radio.checked = true;
        el.classList.remove('answered-S','answered-N','answered-NC');
        el.classList.add('answered-' + val);
        const causaDiv = el.querySelector(':scope > .citem-causa');
        if (causaDiv) causaDiv.classList.toggle('show', val === 'N');
      }
    }
    el = el.nextElementSibling;
  }

  refreshAll();
  triggerAutoSave();
}

function getGanttMonths() {
  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const months = [];
  const now = new Date();
  let startYear = now.getFullYear();
  let startMonth = now.getMonth();

  const fechaVal = document.getElementById('f_fecha')?.value;
  if (fechaVal) {
    const parts = fechaVal.split('/');
    if (parts.length === 3) {
      const parsedYear = parseInt(parts[2], 10);
      const parsedMonth = parseInt(parts[1], 10) - 1;
      if (!isNaN(parsedYear) && !isNaN(parsedMonth) && parsedMonth >= 0 && parsedMonth <= 11) {
        startYear = parsedYear;
        startMonth = parsedMonth;
      }
    }
  }

  for (let i = 0; i < N_MONTHS; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const mNum = d.getMonth();
    const yNum = d.getFullYear();
    const mStr = String(mNum + 1).padStart(2, '0');
    months.push({
      idx: i,
      val: `${yNum}-${mStr}`,
      mesStr: mesesNombres[mNum],
      yearStr: String(yNum)
    });
  }
  return months;
}

function genMonthSelectOptions(selectedVal) {
  const months = getGanttMonths();
  let opts = '<option value="">— Mes —</option>';
  months.forEach(m => {
    const sel = (selectedVal === m.val) ? ' selected' : '';
    opts += `<option value="${m.val}"${sel}>${m.mesStr} ${m.yearStr}</option>`;
  });
  return opts;
}

function toggleProfBox(boxId, isSi) {
  const box = document.getElementById(boxId);
  if (box) box.classList.toggle('show', isSi);
}

let uid = 0;
document.querySelectorAll('.citem').forEach(el => {
  el.dataset.id = 'item_' + (uid++);
  const causasAttr = el.dataset.causas;
  if (causasAttr) {
    let checksDiv = el.querySelector('.causa-checks');
    if (!checksDiv) {
      const cDiv = document.createElement('div');
      cDiv.className = 'citem-causa';
      cDiv.innerHTML = '<span class="citem-causa-label">Causa/s detectada/s:</span><div class="causa-checks"></div>';
      el.appendChild(cDiv);
      checksDiv = cDiv.querySelector('.causa-checks');
    }
    if (checksDiv) {
      checksDiv.innerHTML = '';
      causasAttr.split('|').forEach(c => {
        const lbl = document.createElement('label');
        const cb  = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = c;
        cb.addEventListener('change', () => { refreshPlan(); triggerAutoSave(); });
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(' ' + c));
        checksDiv.appendChild(lbl);
      });
    }
  }
});

document.body.addEventListener('change', e => {
  if (e.target.type === 'radio' && e.target.name && e.target.name.startsWith('q')) {
    const citem = e.target.closest('.citem');
    if (!citem) return;
    citem.classList.remove('answered-S','answered-N','answered-NC');
    citem.classList.add('answered-' + e.target.value);
    
    const causaDiv = citem.querySelector('.citem-causa');
    if (causaDiv) causaDiv.classList.toggle('show', e.target.value === 'N');
    
    refreshAll();
    triggerAutoSave();
  }
});

document.body.addEventListener('input', e => {
  triggerAutoSave();
});

function getCheckedCausas(el) {
  return Array.from(el.querySelectorAll('.causa-checks input[type=checkbox]:checked')).map(b => b.value);
}

function getNoItems() {
  const items = [];
  document.querySelectorAll('.citem').forEach(el => {
    const radios = el.querySelectorAll(':scope > .citem-row input[type=radio]');
    let val = null;
    radios.forEach(r => { if (r.checked) val = r.value; });
    if (val === 'N') {
      const eje = el.dataset.eje;
      if (!eje) return;
      const labelNode = el.querySelector(':scope > .citem-row .citem-label');
      const label = labelNode ? labelNode.childNodes[0].textContent.trim() : '';
      items.push({
        id: el.dataset.id,
        eje: eje,
        form: el.dataset.form || '',
        label: label,
        que: el.dataset.que || '',
        como: el.dataset.comoDefault || '',
        causas: getCheckedCausas(el)
      });
    }
  });
  return items;
}

// Plan Consolidado
const planContainers = {
  documental:      'plan-documental',
  mediciones:      'plan-mediciones',
  ergonomia:       'plan-ergonomia',
  infraestructura: 'plan-infraestructura',
  formacion:       'plan-formacion',
  organizacional:  'plan-organizacional',
  condiciones:     'plan-condiciones'
};

const planEdits = {};

document.body.addEventListener('input', e => {
  if (e.target.classList.contains('plan-input')) {
    const id = e.target.dataset.id;
    const field = e.target.dataset.field;
    planEdits[id] = planEdits[id] || {};
    planEdits[id][field] = (e.target.innerText !== undefined ? e.target.innerText : e.target.value || '').trim();
    triggerAutoSave();
  }
});

function refreshPlan() {
  const noItems = getNoItems();
  const groups = {};
  Object.keys(planContainers).forEach(k => groups[k] = []);
  
  noItems.forEach(r => {
    if (groups[r.eje] !== undefined) groups[r.eje].push(r);
  });

  Object.keys(groups).forEach(eje => {
    const container = document.getElementById(planContainers[eje]);
    if (!container) return;
    const rows = groups[eje];
    if (rows.length === 0) {
      container.innerHTML = '<div class="plan-empty">Sin acciones pendientes.</div>';
      return;
    }
    let html = '<table class="plan-table"><tr><th class="col-item">Ítem</th><th class="col-causa">Causa/s</th><th class="col-que">Qué</th><th class="col-como">Cómo</th></tr>';
    rows.forEach(r => {
      const qVal = (planEdits[r.id]?.que !== undefined) ? planEdits[r.id].que : r.que;
      const cVal = (planEdits[r.id]?.como !== undefined) ? planEdits[r.id].como : r.como;
      const causaStr = (planEdits[r.id]?.causa !== undefined) ? planEdits[r.id].causa : (r.causas.length ? r.causas.join(' / ') : '—');
      html += `<tr>
        <td><strong>${escHtml(r.label)}</strong></td>
        <td style="font-size:8.2px;color:#7a1a1a;">${escHtml(causaStr)}</td>
        <td><div class="plan-input" contenteditable="true" data-id="${r.id}" data-field="que">${escHtml(qVal)}</div></td>
        <td><div class="plan-input" contenteditable="true" data-id="${r.id}" data-field="como">${escHtml(cVal)}</div></td>
      </tr>`;
    });
    html += '</table>';
    container.innerHTML = html;
  });
}

// Programación
let schedMedData = [];
let schedErgData = [];
let schedVisData = [];
let schedCapData = [];

function syncSchedFromChecklist(showAlert) {
  const noItems = getNoItems();

  // 1. Mediciones
  const medNo = noItems.filter(r => r.eje === 'mediciones');
  const validMedIds = new Set(medNo.map(m => m.id));
  schedMedData = schedMedData.filter(row => {
    if (!row.origId || String(row.origId).startsWith('manual_')) return true;
    return validMedIds.has(row.origId);
  });
  medNo.forEach(m => {
    const exists = schedMedData.some(row => row.origId === m.id);
    if (!exists) {
      schedMedData.push({ origId: m.id, label: m.label, sector: '', obs: '', month: '' });
    }
  });

  // 2. Ergonomía
  const ergNo = noItems.filter(r => r.eje === 'ergonomia');
  if (ergNo.length > 0) {
    if (schedErgData.length === 0) {
      schedErgData.push({ isAuto: true, sector: 'Producción / Operativo', puesto: 'Operarios línea principal', obs: 'Res. SRT 886/15', month: '' });
    }
  } else {
    schedErgData = schedErgData.filter(e => !e.isAuto && (e.sector || e.puesto || e.month));
  }

  // 3. Visitas de campo
  const visNo = noItems.filter(r => r.eje === 'condiciones' || r.form === 'visita');
  const validVisIds = new Set(visNo.map(v => v.id));
  schedVisData = schedVisData.filter(row => {
    if (!row.origId || String(row.origId).startsWith('manual_')) return true;
    return validVisIds.has(row.origId);
  });
  visNo.forEach(v => {
    const exists = schedVisData.some(row => row.origId === v.id);
    if (!exists) {
      schedVisData.push({ origId: v.id, label: v.que || v.label, sector: '', obs: '', month: '' });
    }
  });

  // 4. Capacitaciones: se mantienen las que el usuario agregue manualmente (inicia vacía)

  renderSchedTables();
  buildGanttFromPage8();
  triggerAutoSave();

  if (showAlert) {
    alert('✅ Programación y Cronograma sincronizados exitosamente con el relevamiento.\n\n• Desvíos ("NO") incorporados.\n• Ítems cambiados a "SÍ" o "NC" fueron removidos.\n• Filas manuales, sectores y observaciones fueron conservados.');
  }
}

function limpiarProgramacion() {
  if (confirm('¿Deseas vaciar las tablas de programación y reiniciar el cronograma?')) {
    schedMedData = [];
    schedErgData = [];
    schedVisData = [];
    schedCapData = [];
    Object.keys(ganttCellState).forEach(k => delete ganttCellState[k]);
    renderSchedTables();
    buildGanttFromPage8();
    triggerAutoSave();
  }
}

function updateSchedMonth(type, idx, newMonth) {
  let list = (type === 'med') ? schedMedData : (type === 'erg') ? schedErgData : (type === 'vis') ? schedVisData : schedCapData;
  const item = list[idx];
  if (!item) return;
  const oldMonth = item.month;
  item.month = newMonth;
  if (oldMonth && oldMonth !== newMonth) {
    const months = getGanttMonths();
    const oldIdx = months.findIndex(m => m.val === oldMonth);
    if (oldIdx !== -1) {
      Object.keys(ganttCellState).forEach(k => {
        if ((item.label && k.includes(item.label)) || (item.tema && k.includes(item.tema)) || (type === 'erg' && k.includes('ergonómico'))) {
          ganttCellState[k]?.delete(oldIdx);
        }
      });
    }
  }
  buildGanttFromPage8();
  triggerAutoSave();
}

document.body.addEventListener('input', e => {
  if (e.target.classList.contains('sched-cell-edit')) {
    const type = e.target.dataset.type;
    const idx = parseInt(e.target.dataset.idx, 10);
    const field = e.target.dataset.field;
    const val = (e.target.innerText !== undefined ? e.target.innerText : e.target.textContent || '').trim();
    if (type === 'med' && schedMedData[idx]) {
      schedMedData[idx][field] = val;
      if (field === 'label' || field === 'sector') buildGanttFromPage8();
    } else if (type === 'erg' && schedErgData[idx]) {
      schedErgData[idx][field] = val;
      if (field === 'sector' || field === 'puesto') buildGanttFromPage8();
    } else if (type === 'vis' && schedVisData[idx]) {
      schedVisData[idx][field] = val;
      if (field === 'label' || field === 'sector') buildGanttFromPage8();
    } else if (type === 'cap' && schedCapData[idx]) {
      schedCapData[idx][field] = val;
      if (field === 'tema' || field === 'dest') buildGanttFromPage8();
    }
    triggerAutoSave();
  }
});

function renderSchedTables() {
  const tbMed = document.getElementById('sched-mediciones');
  if (tbMed) {
    if (schedMedData.length === 0) {
      tbMed.innerHTML = '<tr><td colspan="5" class="sched-empty">Sin mediciones pendientes. Podés agregar con el botón inferior o sincronizar desde el checklist.</td></tr>';
    } else {
      let h = '';
      schedMedData.forEach((row, i) => {
        h += `<tr>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="med" data-idx="${i}" data-field="label" data-placeholder="Medición">${escHtml(row.label || '')}</div></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="med" data-idx="${i}" data-field="sector" data-placeholder="Sector / área">${escHtml(row.sector || '')}</div></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="med" data-idx="${i}" data-field="obs" data-placeholder="Observación">${escHtml(row.obs || '')}</div></td>
          <td><select class="month-sel" onchange="updateSchedMonth('med', ${i}, this.value)">${genMonthSelectOptions(row.month)}</select></td>
          <td class="no-print" style="white-space:nowrap;">
            <button class="btn-dup-row" title="Duplicar para otro sector" onclick="dupMedRow(${i})">+ Sector</button>
            <button class="btn-del-row" title="Eliminar" onclick="delMedRow(${i})">✕</button>
          </td>
        </tr>`;
      });
      tbMed.innerHTML = h;
    }
  }

  const tbErg = document.getElementById('sched-ergonomia');
  if (tbErg) {
    if (schedErgData.length === 0) {
      tbErg.innerHTML = '<tr><td colspan="5" class="sched-empty">Sin evaluaciones ergonómicas cargadas.</td></tr>';
    } else {
      let h = '';
      schedErgData.forEach((row, i) => {
        h += `<tr>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="erg" data-idx="${i}" data-field="sector" data-placeholder="Sector / área">${escHtml(row.sector || '')}</div></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="erg" data-idx="${i}" data-field="puesto" data-placeholder="Puesto/s de trabajo">${escHtml(row.puesto || '')}</div></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="erg" data-idx="${i}" data-field="obs" data-placeholder="Observación">${escHtml(row.obs || '')}</div></td>
          <td><select class="month-sel" onchange="updateSchedMonth('erg', ${i}, this.value)">${genMonthSelectOptions(row.month)}</select></td>
          <td class="no-print"><button class="btn-del-row" title="Eliminar" onclick="delErgRow(${i})">✕</button></td>
        </tr>`;
      });
      tbErg.innerHTML = h;
    }
  }

  const tbVis = document.getElementById('sched-visitas');
  if (tbVis) {
    if (schedVisData.length === 0) {
      tbVis.innerHTML = '<tr><td colspan="5" class="sched-empty">Sin visitas de campo pendientes. Podés agregar con el botón inferior o sincronizar desde el checklist.</td></tr>';
    } else {
      let h = '';
      schedVisData.forEach((row, i) => {
        h += `<tr>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="vis" data-idx="${i}" data-field="label" data-placeholder="Acción en visita">${escHtml(row.label || '')}</div></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="vis" data-idx="${i}" data-field="sector" data-placeholder="Sector / área">${escHtml(row.sector || '')}</div></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="vis" data-idx="${i}" data-field="obs" data-placeholder="Observación">${escHtml(row.obs || '')}</div></td>
          <td><select class="month-sel" onchange="updateSchedMonth('vis', ${i}, this.value)">${genMonthSelectOptions(row.month)}</select></td>
          <td class="no-print" style="white-space:nowrap;">
            <button class="btn-dup-row" title="Duplicar para otro sector" onclick="dupVisRow(${i})">+ Sector</button>
            <button class="btn-del-row" title="Eliminar" onclick="delVisRow(${i})">✕</button>
          </td>
        </tr>`;
      });
      tbVis.innerHTML = h;
    }
  }

  const tbCap = document.getElementById('sched-capac');
  if (tbCap) {
    if (schedCapData.length === 0) {
      tbCap.innerHTML = '<tr><td colspan="7" class="sched-empty">Sin capacitaciones programadas. Podés agregar con el botón inferior (+ Agregar tema de capacitación).</td></tr>';
    } else {
      let h = '';
      schedCapData.forEach((row, i) => {
        h += `<tr>
          <td style="text-align:center;color:#888;font-size:8.5px">${i+1}</td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="cap" data-idx="${i}" data-field="tema" data-placeholder="Tema / contenido">${escHtml(row.tema || '')}</div></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="cap" data-idx="${i}" data-field="dest" data-placeholder="Destinatarios">${escHtml(row.dest || '')}</div></td>
          <td>
            <select onchange="schedCapData[${i}].modal=this.value;triggerAutoSave()">
              <option value="">— Modalidad —</option>
              <option${row.modal==='Presencial'?' selected':''}>Presencial</option>
              <option${row.modal==='Teórico-práctica'?' selected':''}>Teórico-práctica</option>
              <option${row.modal==='Virtual / e-learning'?' selected':''}>Virtual / e-learning</option>
              <option${row.modal==='Taller'?' selected':''}>Taller</option>
            </select>
          </td>
          <td><select class="month-sel" onchange="updateSchedMonth('cap', ${i}, this.value)">${genMonthSelectOptions(row.month)}</select></td>
          <td><div contenteditable="true" class="sched-cell-edit" data-type="cap" data-idx="${i}" data-field="resp" data-placeholder="Responsable">${escHtml(row.resp || '')}</div></td>
          <td class="no-print"><button class="btn-del-row" title="Eliminar" onclick="delCapRow(${i})">✕</button></td>
        </tr>`;
      });
      tbCap.innerHTML = h;
    }
  }
}

function dupMedRow(idx) {
  const orig = schedMedData[idx];
  schedMedData.splice(idx + 1, 0, { origId: orig.origId, label: orig.label, sector: '', obs: '', month: '' });
  renderSchedTables();
  triggerAutoSave();
}
function delMedRow(idx) {
  schedMedData.splice(idx, 1);
  renderSchedTables();
  buildGanttFromPage8();
  triggerAutoSave();
}
function addMedRowManual() {
  schedMedData.push({ origId: 'manual_' + Date.now(), label: 'Nueva medición técnica', sector: '', obs: '', month: '' });
  renderSchedTables();
  triggerAutoSave();
}

function addErgRow(sec, pue, obs) {
  schedErgData.push({ sector: sec || '', puesto: pue || '', obs: obs || 'Res. SRT 886/15', month: '' });
  renderSchedTables();
  triggerAutoSave();
}
function delErgRow(idx) {
  schedErgData.splice(idx, 1);
  renderSchedTables();
  buildGanttFromPage8();
  triggerAutoSave();
}

function dupVisRow(idx) {
  const orig = schedVisData[idx];
  schedVisData.splice(idx + 1, 0, { origId: orig.origId, label: orig.label, sector: '', obs: '', month: '' });
  renderSchedTables();
  triggerAutoSave();
}
function delVisRow(idx) {
  schedVisData.splice(idx, 1);
  renderSchedTables();
  buildGanttFromPage8();
  triggerAutoSave();
}
function addVisRowManual() {
  schedVisData.push({ origId: 'manual_' + Date.now(), label: 'Recorrido de inspección en sede', sector: '', obs: '', month: '' });
  renderSchedTables();
  triggerAutoSave();
}

function addCapacRowManual() {
  schedCapData.push({ tema: '', dest: '', modal: 'Presencial', month: '', resp: 'Servicio HyS' });
  renderSchedTables();
  triggerAutoSave();
}
function delCapRow(idx) {
  schedCapData.splice(idx, 1);
  renderSchedTables();
  buildGanttFromPage8();
  triggerAutoSave();
}

// Gantt
const ganttCellState = {};

function buildGanttFromPage8(showAlert) {
  const thead = document.getElementById('gantt-thead');
  const tbody = document.getElementById('gantt-tbody');
  if (!thead || !tbody) return;

  const months = getGanttMonths();
  const monthVals = months.map(m => m.val);

  let theadHtml = '<tr><th class="gantt-th-desarrollo">DESARROLLO</th>';
  months.forEach((m, i) => {
    const colorCls = (i < 3) ? 'gantt-m-yellow' : 'gantt-m-green';
    theadHtml += `<th class="gantt-th-month ${colorCls}">${m.mesStr}<br>${m.yearStr}</th>`;
  });
  theadHtml += '</tr>';
  thead.innerHTML = theadHtml;

  let tbodyHtml = '';
  const planTasks = [];

  // Mediciones técnicas
  schedMedData.forEach(m => {
    if (m.label) {
      const nom = m.sector ? `- Medición: ${m.label} (${m.sector})` : `- Medición: ${m.label}`;
      planTasks.push({ text: nom, month: m.month });
    }
  });

  // Evaluaciones ergonómicas
  schedErgData.forEach(e => {
    const secPue = [e.sector && e.sector, e.puesto && e.puesto].filter(Boolean).join(' - ');
    const nom = secPue ? `- Ergonomía: ${secPue} (Res. 886/15)` : '- Estudio ergonómico por puesto (Res. 886/15)';
    planTasks.push({ text: nom, month: e.month });
  });

  // Capacitaciones (solo las programadas por el usuario)
  schedCapData.forEach(c => {
    if (c.tema) {
      const nom = c.dest ? `- Capacitación: ${c.tema} (${c.dest})` : `- Capacitación: ${c.tema}`;
      planTasks.push({ text: nom, month: c.month });
    }
  });

  const currentKeys = new Set();
  planTasks.forEach((t, rowIdx) => currentKeys.add('plan_' + rowIdx + '_' + t.text));

  planTasks.forEach((t, rowIdx) => {
    const rowKey = 'plan_' + rowIdx + '_' + t.text;
    ganttCellState[rowKey] = ganttCellState[rowKey] || new Set();

    if (t.month) {
      const mIdx = monthVals.indexOf(t.month);
      if (mIdx !== -1) ganttCellState[rowKey].add(mIdx);
    }

    let cellsHtml = '';
    months.forEach((m, cIdx) => {
      const isMarked = ganttCellState[rowKey].has(cIdx);
      cellsHtml += `<td class="gantt-cell${isMarked?' marked':''}" onclick="toggleGanttCell('${rowKey}', ${cIdx}, this)"></td>`;
    });

    tbodyHtml += `<tr>
      <td class="gantt-task-name" contenteditable="true" title="${escHtml(t.text)}">${escHtml(t.text)}</td>
      ${cellsHtml}
    </tr>`;
  });

  tbodyHtml += `<tr class="gantt-divider-row">
    <td class="gantt-td-desarrollo">DESARROLLO</td>
    ${months.map((m, i) => {
      const colorCls = (i < 3) ? 'gantt-m-yellow' : 'gantt-m-green';
      return `<td class="gantt-td-month ${colorCls}">${m.mesStr}<br>${m.yearStr}</td>`;
    }).join('')}
  </tr>`;

  const visTasks = [];
  visTasks.push({ text: '- Recorrido por establecimiento identificando nuevos desvíos', month: '' });

  schedVisData.forEach(v => {
    if (v.label) {
      const nom = v.sector ? `- ${v.label} (${v.sector})` : `- ${v.label}`;
      visTasks.push({ text: nom, month: v.month });
    }
  });

  visTasks.forEach((t, rowIdx) => currentKeys.add('vis_' + rowIdx + '_' + t.text));

  Object.keys(ganttCellState).forEach(k => {
    if (!currentKeys.has(k)) {
      delete ganttCellState[k];
    }
  });

  visTasks.forEach((t, rowIdx) => {
    const rowKey = 'vis_' + rowIdx + '_' + t.text;
    ganttCellState[rowKey] = ganttCellState[rowKey] || new Set();

    if (t.month) {
      const mIdx = monthVals.indexOf(t.month);
      if (mIdx !== -1) ganttCellState[rowKey].add(mIdx);
    }

    let cellsHtml = '';
    months.forEach((m, cIdx) => {
      const isMarked = ganttCellState[rowKey].has(cIdx);
      cellsHtml += `<td class="gantt-cell${isMarked?' marked':''}" onclick="toggleGanttCell('${rowKey}', ${cIdx}, this)"></td>`;
    });

    tbodyHtml += `<tr>
      <td class="gantt-task-name" contenteditable="true" title="${escHtml(t.text)}">${escHtml(t.text)}</td>
      ${cellsHtml}
    </tr>`;
  });

  tbody.innerHTML = tbodyHtml;

  if (showAlert) {
    alert('✅ Cronograma Anual actualizado desde las tablas de programación.');
  }
}

function toggleGanttCell(rowKey, cIdx, td) {
  ganttCellState[rowKey] = ganttCellState[rowKey] || new Set();
  if (ganttCellState[rowKey].has(cIdx)) {
    ganttCellState[rowKey].delete(cIdx);
    td.classList.remove('marked');
  } else {
    ganttCellState[rowKey].add(cIdx);
    td.classList.add('marked');
  }
  triggerAutoSave();
}

function ganttAddManualRow(sec) {
  const nom = prompt('Ingrese el nombre de la tarea a incorporar al cronograma:');
  if (!nom || !nom.trim()) return;
  
  if (sec === 'plan') {
    schedMedData.push({ origId: 'manual_' + Date.now(), label: nom.trim(), sector: '', obs: '', month: '' });
  } else {
    schedVisData.push({ origId: 'manual_' + Date.now(), label: nom.trim(), sector: '', obs: '', month: '' });
  }
  renderSchedTables();
  buildGanttFromPage8();
  triggerAutoSave();
}

function collectAllData() {
  const inmRadio = document.querySelector('input[name="inmueble_tipo"]:checked');
  const hysRadio = document.querySelector('input[name="q1"]:checked');
  const medRadio = document.querySelector('input[name="q2"]:checked');
  const comRadio = document.querySelector('input[name="q3"]:checked');
  const hysModRadio = document.querySelector('input[name="hys_mod"]:checked');

  const respuestas = [];
  document.querySelectorAll('.citem').forEach(el => {
    const checkedR = el.querySelector(':scope > .citem-row input[type=radio]:checked');
    const labelNode = el.querySelector(':scope > .citem-row .citem-label');
    const label = labelNode ? labelNode.childNodes[0].textContent.trim() : '';
    respuestas.push({
      id: el.dataset.id || '',
      eje: el.dataset.eje || '',
      label: label,
      valor: checkedR ? checkedR.value : '',
      causas: getCheckedCausas(el)
    });
  });

  const ganttSerialized = {};
  Object.keys(ganttCellState).forEach(k => {
    ganttSerialized[k] = Array.from(ganttCellState[k]);
  });

  return {
    version: '1.5',
    timestamp: new Date().toISOString(),
    establecimiento: {
      organismo: document.getElementById('f_razonsocial')?.value || '',
      razonSocial: document.getElementById('f_razonsocial')?.value || '',
      nombreEstablecimiento: document.getElementById('f_nombre_establecimiento')?.value || '',
      domicilio: document.getElementById('f_direccion')?.value || '',
      direccion: document.getElementById('f_direccion')?.value || '',
      cp: document.getElementById('f_cp')?.value || '',
      localidad: document.getElementById('f_localidad')?.value || '',
      provincia: document.getElementById('f_provincia')?.value || '',
      nroEstab: document.getElementById('f_nro_estab')?.value || '',
      rowIndex: currentEstRowIndex || '',
      cuit: document.getElementById('f_cuit')?.value || '',
      art: document.getElementById('f_art')?.value || '',
      fecha: document.getElementById('f_fecha')?.value || '',
      relevadoPor: document.getElementById('f_relevador')?.value || '',
      actividad: document.getElementById('f_actividad')?.value || '',
      inmueble: inmRadio ? inmRadio.value : '',
      inmuebleCondicion: document.getElementById('f_inmueble_cond')?.value || '',
      supTotal: document.getElementById('f_suptotal')?.value || '',
      supCubierta: document.getElementById('f_supcubierta')?.value || '',
      plantas: document.getElementById('f_plantas')?.value || '',
      dotTotal: document.getElementById('f_dottotal')?.value || '',
      dotAdm: document.getElementById('f_dotadm')?.value || '',
      dotProd: document.getElementById('f_dotprod')?.value || '',
      dotOtros: document.getElementById('f_dototros')?.value || '',
      condicionesGenerales: document.getElementById('f_condiciones')?.value || '',
      tamano: document.getElementById('f_tamano_estab')?.value || '3'
    },
    profesionales: {
      hysRespuesta: hysRadio ? hysRadio.value : '',
      hysNombre: document.getElementById('hys_nom')?.value || '',
      hysMatricula: document.getElementById('hys_mat')?.value || '',
      hysTelefono: document.getElementById('hys_tel')?.value || '',
      hysModalidad: hysModRadio ? hysModRadio.value : '',
      hysEmail: document.getElementById('hys_email')?.value || '',
      medRespuesta: medRadio ? medRadio.value : '',
      medNombre: document.getElementById('med_nom')?.value || '',
      medMatricula: document.getElementById('med_mat')?.value || '',
      medTelefono: document.getElementById('med_tel')?.value || '',
      comiteMixto: comRadio ? comRadio.value : ''
    },
    respuestas: respuestas,
    observaciones: document.getElementById('f_observaciones')?.value || '',
    controlGestion: {
      rgrl: document.getElementById('ctrl_rgrl')?.value || 'No realizado',
      rar: document.getElementById('ctrl_rar')?.value || 'Sin nómina',
      svcc: document.getElementById('ctrl_svcc')?.value || 'N/A',
      rgi: document.getElementById('ctrl_rgi')?.value || 'No',
      rgiDesc: document.getElementById('ctrl_rgi_desc')?.value || '',
      capVisitaFecha: document.getElementById('ctrl_cap_fecha')?.value || '',
      capVisitaTemario: document.getElementById('ctrl_cap_temario')?.value || '',
      capVisita: (document.getElementById('ctrl_cap_fecha')?.value || '') + (document.getElementById('ctrl_cap_temario')?.value ? ' - ' + document.getElementById('ctrl_cap_temario').value : ''),
      res886: (schedErgData || []).map(e => e.puesto).filter(Boolean).join(', ') || 'Sin evaluaciones ergonómicas',
      extintores: getExtintoresSummary(),
      capPlanificada: (schedCapData || []).map(c => c.tema).filter(Boolean).join(' | '),
      tomaAgua: getMedicionCount('agua'),
      medIlum: getMedicionCount('ilum'),
      medRuido: getMedicionCount('ruido'),
      medPat: getMedicionCount('pat'),
      otrasMed: getMedicionCount('otras'),
      simulacro: document.querySelector('input[name="q26"]:checked')?.value === 'S' ? 'Sí' : 'No',
      cargaFuego: document.querySelector('input[name="q28"]:checked')?.value === 'S' ? 'Sí' : 'No'
    },
    sectores: currentSectores,
    cargaFuegoDetalle: (typeof getCargaFuegoTableData === 'function') ? getCargaFuegoTableData() : [],
    extintoresDetalle: getExtintoresTableData(),
    planTeorico: currentPlanTeorico || getPlanTeoricoDefault(),
    planEdits: planEdits,
    programacion: {
      mediciones: schedMedData,
      ergonomia: schedErgData,
      visitas: schedVisData,
      capacitacion: schedCapData
    },
    ganttCells: ganttSerialized
  };
}

function restoreFromData(data) {
  if (!data) return;
  const est = data.establecimiento || {};
  if (est.organismo || est.razonSocial) {
    document.getElementById('f_razonsocial').value = est.organismo || est.razonSocial;
    const titleDisp = (est.organismo || est.razonSocial) + (est.nombreEstablecimiento ? ' — ' + est.nombreEstablecimiento : '');
    document.querySelectorAll('.mh-rs-label').forEach(el => el.textContent = ' — ' + titleDisp);
  }
  if (est.nombreEstablecimiento) document.getElementById('f_nombre_establecimiento').value = est.nombreEstablecimiento;
  if (est.domicilio || est.direccion) document.getElementById('f_direccion').value = est.domicilio || est.direccion;
  if (est.nroEstab) document.getElementById('f_nro_estab').value = est.nroEstab;
  if (est.cp) document.getElementById('f_cp').value = est.cp;
  if (est.localidad) document.getElementById('f_localidad').value = est.localidad;
  if (est.provincia) document.getElementById('f_provincia').value = est.provincia;
  if (est.cuit) document.getElementById('f_cuit').value = est.cuit;
  if (est.art) document.getElementById('f_art').value = est.art;
  if (est.fecha) document.getElementById('f_fecha').value = est.fecha;
  if (est.relevadoPor) document.getElementById('f_relevador').value = est.relevadoPor;
  if (est.actividad) document.getElementById('f_actividad').value = est.actividad;
  if (est.inmueble) {
    const r = document.querySelector(`input[name="inmueble_tipo"][value="${est.inmueble}"]`);
    if (r) r.checked = true;
  }
  if (est.inmuebleCondicion) document.getElementById('f_inmueble_cond').value = est.inmuebleCondicion;
  if (est.supTotal) document.getElementById('f_suptotal').value = est.supTotal;
  if (est.supCubierta) document.getElementById('f_supcubierta').value = est.supCubierta;
  if (est.plantas) document.getElementById('f_plantas').value = est.plantas;
  if (est.dotTotal) document.getElementById('f_dottotal').value = est.dotTotal;
  if (est.dotAdm) document.getElementById('f_dotadm').value = est.dotAdm;
  if (est.dotProd) document.getElementById('f_dotprod').value = est.dotProd;
  if (est.dotOtros) document.getElementById('f_dototros').value = est.dotOtros;
  if (est.condicionesGenerales) document.getElementById('f_condiciones').value = est.condicionesGenerales;

  if (est.tamano && document.getElementById('f_tamano_estab')) {
    document.getElementById('f_tamano_estab').value = est.tamano;
  }
  actualizarTareasSegunTamano();

  // Restaurar sectores
  if (data.sectores && Array.isArray(data.sectores) && data.sectores.length > 0) {
    currentSectores = data.sectores;
  } else if (data.extintoresDetalle && Array.isArray(data.extintoresDetalle) && data.extintoresDetalle.length > 0) {
    const extraidos = [...new Set(data.extintoresDetalle.map(e => (e.ubicacion || '').trim()).filter(Boolean))];
    currentSectores = extraidos.length > 0 ? extraidos : ['Planta Baja - Hall Acceso', 'Planta Baja - Guardia', 'Planta Baja - Pasillo Oficinas', 'Piso 1 - Pasillo Común', 'Sector Cocina / Depósito'];
  } else {
    currentSectores = ['Planta Baja - Hall Acceso', 'Planta Baja - Guardia', 'Planta Baja - Pasillo Oficinas', 'Piso 1 - Pasillo Común', 'Sector Cocina / Depósito'];
  }
  renderSectoresChips();
  actualizarDatalistSectores();

  // Restaurar Carga de Fuego detallada
  if (data.cargaFuegoDetalle && Array.isArray(data.cargaFuegoDetalle)) {
    cargaFuegoData = data.cargaFuegoDetalle;
  } else {
    cargaFuegoData = [];
  }
  renderCargaFuegoTable();

  // Restaurar tabla de extintores detallada
  if (data.extintoresDetalle && Array.isArray(data.extintoresDetalle) && data.extintoresDetalle.length > 0) {
    extTableData = data.extintoresDetalle;
  } else {
    extTableData = [];
  }
  renderExtintoresTable();

  // Sincronizar datos de cabecera de extintores si están vacíos
  const extEmpresa = document.getElementById('ext_empresa');
  if (extEmpresa && !extEmpresa.value) {
    extEmpresa.value = est.organismo || est.razonSocial || '';
  }
  const extControlador = document.getElementById('ext_controlador');
  if (extControlador && !extControlador.value) {
    extControlador.value = est.relevadoPor || '';
  }
  const extFecha = document.getElementById('ext_fecha');
  if (extFecha && !extFecha.value) {
    extFecha.value = est.fecha || '';
  }

  const prof = data.profesionales || {};
  if (prof.hysNombre) document.getElementById('hys_nom').value = prof.hysNombre;
  if (prof.hysMatricula) document.getElementById('hys_mat').value = prof.hysMatricula;
  if (prof.hysTelefono) document.getElementById('hys_tel').value = prof.hysTelefono;
  if (prof.hysEmail) document.getElementById('hys_email').value = prof.hysEmail;
  if (prof.hysModalidad) {
    const r = document.querySelector(`input[name="hys_mod"][value="${prof.hysModalidad}"]`);
    if (r) r.checked = true;
  }
  if (prof.medNombre) document.getElementById('med_nom').value = prof.medNombre;
  if (prof.medMatricula) document.getElementById('med_mat').value = prof.medMatricula;
  if (prof.medTelefono) document.getElementById('med_tel').value = prof.medTelefono;

  if (data.respuestas && Array.isArray(data.respuestas)) {
    data.respuestas.forEach(r => {
      const citem = document.querySelector(`.citem[data-id="${r.id}"]`);
      if (citem && r.valor) {
        const radio = citem.querySelector(`input[type=radio][value="${r.valor}"]`);
        if (radio) {
          radio.checked = true;
          citem.classList.remove('answered-S','answered-N','answered-NC');
          citem.classList.add('answered-' + r.valor);
          const causaDiv = citem.querySelector(':scope > .citem-causa');
          if (causaDiv) causaDiv.classList.toggle('show', r.valor === 'N');
        }
        if (r.causas && Array.isArray(r.causas)) {
          citem.querySelectorAll('.causa-checks input[type=checkbox]').forEach(cb => {
            cb.checked = r.causas.includes(cb.value);
          });
        }
      }
    });
  }

  // Restaurar Visita 1 y Control Gestión
  const ctrl = data.controlGestion || {};
  if (ctrl.rgrl && document.getElementById('ctrl_rgrl')) document.getElementById('ctrl_rgrl').value = ctrl.rgrl;
  if (ctrl.rar && document.getElementById('ctrl_rar')) document.getElementById('ctrl_rar').value = ctrl.rar;
  if (ctrl.svcc && document.getElementById('ctrl_svcc')) document.getElementById('ctrl_svcc').value = ctrl.svcc;
  if (ctrl.rgi && document.getElementById('ctrl_rgi')) {
    document.getElementById('ctrl_rgi').value = ctrl.rgi;
    toggleRgiBox(ctrl.rgi);
  }
  if (ctrl.rgiDesc && document.getElementById('ctrl_rgi_desc')) document.getElementById('ctrl_rgi_desc').value = ctrl.rgiDesc;
  if (ctrl.capVisitaFecha && document.getElementById('ctrl_cap_fecha')) document.getElementById('ctrl_cap_fecha').value = ctrl.capVisitaFecha;
  if (ctrl.capVisitaTemario && document.getElementById('ctrl_cap_temario')) document.getElementById('ctrl_cap_temario').value = ctrl.capVisitaTemario;

  if (data.planTeorico) {
    currentPlanTeorico = data.planTeorico;
  }

  const q1Si = document.querySelector('input[name="q1"]:checked')?.value === 'S';
  toggleProfBox('prof_hys', q1Si);
  const q2Si = document.querySelector('input[name="q2"]:checked')?.value === 'S';
  toggleProfBox('prof_med', q2Si);

  if (data.observaciones) document.getElementById('f_observaciones').value = data.observaciones;
  if (data.planEdits) Object.assign(planEdits, data.planEdits);

  const prog = data.programacion || {};
  if (prog.mediciones) schedMedData = prog.mediciones;
  if (prog.ergonomia) schedErgData = prog.ergonomia;
  if (prog.visitas) schedVisData = prog.visitas;
  if (prog.capacitacion) schedCapData = prog.capacitacion;

  if (data.ganttCells) {
    Object.keys(data.ganttCells).forEach(k => {
      ganttCellState[k] = new Set(data.ganttCells[k]);
    });
  }

  evaluarSVCCEnVivo();
  actualizarMatrizPlanVsRealidad();
  refreshPlan();
  renderSchedTables();
  buildGanttFromPage8();
}

let autoSaveTimer = null;
function triggerAutoSave() {
  clearTimeout(autoSaveTimer);
  const statEl = document.getElementById('save-status');
  if (statEl) {
    statEl.textContent = '✏️ Editando...';
    statEl.style.color = '#b3660f';
  }
  autoSaveTimer = setTimeout(() => {
    guardarEstablecimientoActual();
    if (statEl) {
      statEl.textContent = '💾 Guardado local activo';
      statEl.style.color = '#276749';
    }
  }, 1000);
}

function descargarJSON() {
  guardarEstablecimientoActual();
  const data = collectAllData();
  const str = JSON.stringify(data, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nom = (data.establecimiento?.nombreEstablecimiento || data.establecimiento?.organismo || data.establecimiento?.razonSocial || 'Relevamiento').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `Relevamiento_HyS_${nom}_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function cargarJSON(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      restoreFromData(data);
      guardarEstablecimientoActual();
      renderEstablecimientosSelect();
      alert('✅ Relevamiento cargado exitosamente desde el archivo.');
    } catch(err) {
      alert('❌ Error al procesar el archivo JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function enviarAGoogleSheets() {
  guardarEstablecimientoActual();
  const est = establecimientosDB[currentEstId];
  if (est && est.impactadoSheets) {
    abrirConfirmarModificacionModal();
    return;
  }
  const savedUrl = getSheetsUrl();
  if (savedUrl) {
    ejecutarEnvioSheets(savedUrl);
  } else {
    openSheetsModal();
  }
}

function abrirConfirmarModificacionModal() {
  const modal = document.getElementById('modal-confirmar-modificacion-sheets');
  const desc = document.getElementById('modal-confirmar-desc');
  const est = establecimientosDB[currentEstId];
  if (!modal || !est) return;

  const nom = est.nombreEstablecimiento || est.organismo || est.razonSocial || 'Establecimiento';
  const loc = est.localidad || 'Entre Ríos';
  const nro = est.nroEstab ? `N° ${est.nroEstab}` : 'S/N';
  const fecha = est.fecha || document.getElementById('f_fecha')?.value || 'Fecha no registrada';

  if (desc) {
    desc.innerHTML = `El relevamiento para <strong>${escHtml(nom)}</strong> (${escHtml(loc)}, ${escHtml(nro)}) correspondiente a la visita del <strong>${escHtml(fecha)}</strong> ya fue sincronizado previamente en tu planilla de Google Sheets.`;
  }
  modal.classList.add('show');
}

function closeConfirmarModificacionModal() {
  const modal = document.getElementById('modal-confirmar-modificacion-sheets');
  if (modal) modal.classList.remove('show');
}

function confirmarSobreescrituraSheets() {
  closeConfirmarModificacionModal();
  const savedUrl = getSheetsUrl();
  if (savedUrl) {
    ejecutarEnvioSheets(savedUrl);
  } else {
    openSheetsModal();
  }
}

function derivarANuevoRelevamientoDesdeSheets() {
  closeConfirmarModificacionModal();
  abrirModalNuevoChecklist();
}

function openSheetsModal() {
  const modal = document.getElementById('sheets-modal');
  const input = document.getElementById('sheets-url-input');
  if (input) input.value = getSheetsUrl();
  if (modal) modal.classList.add('show');
}

function closeSheetsModal() {
  const modal = document.getElementById('sheets-modal');
  if (modal) modal.classList.remove('show');
}

function guardarUrlSheetsYEnviar() {
  const input = document.getElementById('sheets-url-input');
  const url = input ? input.value.trim() : '';
  if (!url || !url.startsWith('http')) {
    alert('⚠️ Por favor ingresá una URL válida de Google Apps Script Web App (termina en /exec).');
    return;
  }
  localStorage.setItem('hys_sheets_webhook_url', url);
  closeSheetsModal();
  ejecutarEnvioSheets(url);
}

function ejecutarEnvioSheets(url) {
  const payload = collectAllData();
  const btn = document.querySelector('.btn-sheets');
  const prevText = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = '⏳ Guardando en Sheets...';
    btn.disabled = true;
  }

  fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(() => {
    if (establecimientosDB[currentEstId]) {
      establecimientosDB[currentEstId].impactadoSheets = true;
      saveEstablecimientosDB();
      aplicarBloqueoImpactadoSheets();
    }
    if (btn) {
      btn.textContent = '✅ Guardado';
      setTimeout(() => {
        btn.textContent = prevText;
        btn.disabled = false;
      }, 4000);
    }
    alert('✅ ¡Datos enviados exitosamente a tu planilla de Google Sheets ("Informes IAPSER")!\n\n• Hoja "Establecimientos": datos del organismo y se actualizó el "Nombre_establecimiento".\n• Hojas "Respuestas_Checklist" y "Programacion_Acciones" registradas con éxito.\n\n🔒 El Relevamiento Inicial (Págs 1 a 5) ha quedado bloqueado para resguardar la auditoría legal. Únicamente están habilitadas las Páginas 6 a 10 (Plan de Acción y Programación).');
  })
  .catch(err => {
    if (btn) {
      btn.textContent = prevText;
      btn.disabled = false;
    }
    alert('❌ Error al enviar a Google Sheets: ' + err.message + '\nVerificá tu conexión a internet o la configuración del Webhook.');
  });
}

function refreshAll() {
  refreshPlan();
  const noCount = getNoItems().length;
  const bDesvios = document.getElementById('badge-desvios');
  if (bDesvios) bDesvios.textContent = noCount + ' desvíos';
  evaluarSVCCEnVivo();
  actualizarMatrizPlanVsRealidad();
}

// ==================== NUEVO SISTEMA DE MENÚS Y NAVEGACIÓN MODULAR ====================
let currentViewMode = 'modules'; // 'modules' o 'document'
let currentModuleId = 'mod-sedes';
let currentPlanTeorico = null;

function setViewMode(mode) {
  currentViewMode = mode;
  const btnMod = document.getElementById('btn-mode-mod');
  const btnDoc = document.getElementById('btn-mode-doc');
  
  if (mode === 'modules') {
    document.body.classList.add('view-mode-modules');
    if (btnMod) btnMod.classList.add('active');
    if (btnDoc) btnDoc.classList.remove('active');
    switchModule(currentModuleId);
  } else {
    document.body.classList.remove('view-mode-modules');
    if (btnMod) btnMod.classList.remove('active');
    if (btnDoc) btnDoc.classList.add('active');
    // En modo documento se muestran todas las páginas
    document.querySelectorAll('.page').forEach(p => p.classList.add('active-module-page'));
  }
}

function switchModule(modId) {
  // Guardar siempre el estado del establecimiento actual antes de cambiar de módulo
  guardarEstablecimientoActual();
  currentModuleId = modId;
  
  // Actualizar botones de navegación
  document.querySelectorAll('.nav-module-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mod === modId);
  });

  // Alternar pantallas de módulos independientes como el Directorio
  document.querySelectorAll('.module-view-screen').forEach(el => {
    const match = (el.dataset.module === modId);
    el.style.display = match ? 'block' : 'none';
  });

  if (currentViewMode === 'modules') {
    document.querySelectorAll('.page').forEach(p => {
      const match = (p.dataset.module === modId);
      p.classList.toggle('active-module-page', match);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Si estamos en modo documento continuo y se elige mod-sedes, pasar a modo módulos
    if (modId === 'mod-sedes') {
      setViewMode('modules');
      return;
    }
    // Modo documento continuo: scroll hasta la primera página de ese módulo
    const targetPage = document.querySelector(`.page[data-module="${modId}"]`);
    if (targetPage) {
      targetPage.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (modId === 'mod-sedes') {
    renderDirectorioSedesList();
  } else if (modId === 'mod-plan') {
    actualizarMatrizPlanVsRealidad();
    buildGanttFromPage8();
  }
}

// ==================== PANEL LATERAL DE TAREAS POR VISITA ====================
function togglePanelLateralTareas(forceState) {
  const panel = document.getElementById('panel-lateral-tareas');
  const overlay = document.getElementById('panel-lateral-overlay');
  if (!panel) return;

  const shouldOpen = (typeof forceState === 'boolean') ? forceState : !panel.classList.contains('open');
  if (shouldOpen) {
    panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
  } else {
    panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }
}

// ==================== NAVEGACIÓN DIRECTA A TAREAS VISITA 1 Y POSTERIORES ====================
function irATareaV1(tarea) {
  if (window.innerWidth < 992) {
    togglePanelLateralTareas(false);
  }

  switch (tarea) {
    case 'predio':
      switchModule('mod-check');
      resaltarElemento('f_nombre_establecimiento');
      break;
    case 'rgrl':
      switchModule('mod-check');
      resaltarElemento('ctrl_rgrl');
      break;
    case 'rar':
      switchModule('mod-check');
      resaltarElemento('ctrl_rar');
      break;
    case 'svcc':
      switchModule('mod-check');
      resaltarElemento('ctrl_svcc');
      break;
    case 'ergo':
      switchModule('mod-check');
      resaltarElemento('citem_ergo');
      break;
    case 'fuego':
      switchModule('mod-check');
      resaltarElemento('citem_fuego');
      break;
    case 'extintores':
      switchModule('mod-check');
      resaltarElemento('citem_matafuegos');
      break;
    case 'rgi':
      switchModule('mod-check');
      resaltarElemento('ctrl_rgi');
      break;
    case 'agua':
      switchModule('mod-check');
      resaltarElemento('citem_agua');
      break;
    case 'capacitacion':
      switchModule('mod-check');
      resaltarElemento('ctrl_cap_fecha');
      break;
    case 'cap_anual':
      switchModule('mod-plan');
      resaltarElemento('page-6');
      break;
    case 'mediciones':
      switchModule('mod-plan');
      resaltarElemento('sched-mediciones');
      break;
    case 'simulacro':
      switchModule('mod-plan');
      resaltarElemento('page-7');
      break;
    case 'gantt':
      switchModule('mod-plan');
      resaltarElemento('gantt-table');
      break;
    case 'matriz':
      switchModule('mod-plan');
      resaltarElemento('page-pt');
      break;
  }
}

function resaltarElemento(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('task-focus-glow');
    setTimeout(() => {
      el.classList.remove('task-focus-glow');
    }, 2800);
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      try { el.focus(); } catch(e) {}
    }
  }, 120);
}

// ==================== EVALUACIÓN EN VIVO SVCC & RGI ====================
function evaluarSVCCEnVivo() {
  const rgrlVal = document.getElementById('ctrl_rgrl')?.value || '';
  const rarVal = document.getElementById('ctrl_rar')?.value || '';
  const svccSel = document.getElementById('ctrl_svcc');
  const alertBox = document.getElementById('svcc-live-alert');
  const badgeV1 = document.getElementById('badge-v1-status');

  const rgrlCancer = rgrlVal.toLowerCase().includes('cancer');
  const rarCancer = rarVal.toLowerCase().includes('cancer');

  if (rgrlCancer && !rarCancer) {
    if (alertBox) {
      alertBox.innerHTML = '<div class="box-inconsistencia">⚠️ INCONSISTENCIA CRÍTICA: El RGRL declara sustancias cancerígenas, pero el RAR no declara expuestos a cancerígenos. Deben ajustarse de inmediato.</div>';
    }
    if (badgeV1) {
      badgeV1.textContent = '⚠️ Inconsistencia';
      badgeV1.style.background = '#ef4444';
    }
  } else if (!rgrlCancer && rarCancer) {
    if (alertBox) {
      alertBox.innerHTML = '<div class="box-inconsistencia">⚠️ INCONSISTENCIA CRÍTICA: El RAR declara personal expuesto a cancerígenos, pero el RGRL no los tiene identificados. Deben coincidir.</div>';
    }
    if (badgeV1) {
      badgeV1.textContent = '⚠️ Inconsistencia';
      badgeV1.style.background = '#ef4444';
    }
  } else if (rgrlCancer && rarCancer) {
    if (alertBox) {
      alertBox.innerHTML = '<div class="box-svcc-ok">✅ CORRESPONDE SVCC (Res. SRT 81/19): Ambos instrumentos coinciden en presencia de cancerígenos. Verificar estado de presentación oficial.</div>';
    }
    if (svccSel && svccSel.value === 'N/A') {
      svccSel.value = 'Pendiente carga';
    }
    if (badgeV1) {
      badgeV1.textContent = 'SVCC Corresponde';
      badgeV1.style.background = '#f59e0b';
    }
  } else {
    if (alertBox) alertBox.innerHTML = '';
    if (svccSel && svccSel.value !== 'N/A') {
      svccSel.value = 'N/A';
    }
    if (badgeV1) {
      badgeV1.textContent = 'OK';
      badgeV1.style.background = 'rgba(255,255,255,0.25)';
    }
  }

  // Sincronizar automáticamente con las preguntas clásicas del checklist si están presentes
  const q29Si = document.querySelector('input[name="q29"][value="S"]');
  const q29No = document.querySelector('input[name="q29"][value="N"]');
  if (rgrlVal.startsWith('Con RGRL') && q29Si) q29Si.checked = true;
  else if (rgrlVal.startsWith('No') && q29No) q29No.checked = true;

  const q30Si = document.querySelector('input[name="q30"][value="S"]');
  const q30No = document.querySelector('input[name="q30"][value="N"]');
  if (rarVal.startsWith('Con expuestos') && q30Si) q30Si.checked = true;
  else if (rarVal.startsWith('Sin nómina') && q30No) q30No.checked = true;

  const q31Si = document.querySelector('input[name="q31"][value="S"]');
  const q31No = document.querySelector('input[name="q31"][value="N"]');
  if (svccSel?.value === 'Cargada' && q31Si) q31Si.checked = true;
  else if (svccSel?.value === 'Pendiente carga' && q31No) q31No.checked = true;
}

function toggleRgiBox(val) {
  const box = document.getElementById('rgi-live-box');
  if (box) {
    if (val === 'Sí') {
      box.style.display = 'block';
      box.classList.add('rgi-alerta');
      document.getElementById('ctrl_rgi_desc')?.focus();
    } else {
      box.style.display = 'none';
      box.classList.remove('rgi-alerta');
    }
  }
}

// ==================== CÁLCULO DE MEDICIONES Y AUXILIARES ====================
function getMedicionCount(tipo) {
  if (!schedMedData || !Array.isArray(schedMedData)) return 0;
  return schedMedData.filter(m => {
    const lbl = (m.label || '').toLowerCase();
    if (tipo === 'agua') return lbl.includes('agua') || lbl.includes('potab');
    if (tipo === 'ilum') return lbl.includes('ilum') || lbl.includes('luz');
    if (tipo === 'ruido') return lbl.includes('ruido') || lbl.includes('sono');
    if (tipo === 'pat') return lbl.includes('tierra') || lbl.includes('pat');
    if (tipo === 'otras') return !lbl.includes('agua') && !lbl.includes('ilum') && !lbl.includes('ruido') && !lbl.includes('tierra');
    return false;
  }).length;
}

// ==================== HOJA DE RUTA VISITA 1 SEGÚN TAMAÑO ====================
function actualizarTareasSegunTamano() {
  const tamano = document.getElementById('f_tamano_estab')?.value || '3';
  const badgeCf = document.getElementById('badge-task-cf');
  const descCf = document.getElementById('desc-task-cf');
  const boxCf = document.getElementById('box-task-cf');

  // Sedes 1, 2 y 3 (Destacamentos, Puestos Viales, Comisarías estándar / administrativas):
  // Carga de Fuego se realiza en Visita 1
  if (['1', '2', '3'].includes(tamano)) {
    if (badgeCf) {
      badgeCf.textContent = 'Visita 1';
      badgeCf.style.background = '#dcfce7';
      badgeCf.style.color = '#15803d';
    }
    if (descCf) {
      descCf.textContent = 'Cálculo directo en Visita 1 (modelo simplificado para sedes pequeñas o administrativas).';
    }
    if (boxCf) boxCf.style.borderColor = '#16a34a';
  } else {
    // Sedes 4 y 5 (Jefaturas grandes, Complejos, Institutos):
    // Complejidad alta / múltiples sectores: en Visita 1 se relevan planos y depósitos, cálculo diferido
    if (badgeCf) {
      badgeCf.textContent = 'Diferida a Visita Posterior';
      badgeCf.style.background = '#fef3c7';
      badgeCf.style.color = '#b45309';
    }
    if (descCf) {
      descCf.textContent = 'Complejidad alta / múltiples sectores. En Visita 1 se relevan planos y depósitos; cálculo en visita posterior.';
    }
    if (boxCf) boxCf.style.borderColor = '#f59e0b';
  }

  if (currentPlanTeorico && currentPlanTeorico.tareas && currentPlanTeorico.tareas.cargaFuego) {
    if (['1', '2', '3'].includes(tamano)) {
      currentPlanTeorico.tareas.cargaFuego.meta = 'Cálculo directo en Visita 1 (sede pequeña/administrativa)';
    } else {
      currentPlanTeorico.tareas.cargaFuego.meta = 'Diferida a visita posterior (relevar sectores y planos en Visita 1)';
    }
  }
  actualizarMatrizPlanVsRealidad();
}

// ==================== GESTIÓN DE SECTORES / ÁREAS DEL ESTABLECIMIENTO ====================
let currentSectores = [];
let cargaFuegoData = [];

function getSectoresActuales() {
  return currentSectores;
}

function setSectoresActuales(sectores) {
  if (Array.isArray(sectores)) {
    const set = new Set();
    currentSectores = [];
    sectores.forEach(s => {
      const trimmed = (s || '').trim();
      if (trimmed && !set.has(trimmed.toLowerCase())) {
        set.add(trimmed.toLowerCase());
        currentSectores.push(trimmed);
      }
    });
    renderSectoresChips();
    actualizarDatalistSectores();
  }
}

function agregarSector(nombre) {
  const nom = (nombre || '').trim();
  if (!nom) return;
  const existe = currentSectores.some(s => s.toLowerCase() === nom.toLowerCase());
  if (!existe) {
    currentSectores.push(nom);
    renderSectoresChips();
    actualizarDatalistSectores();
    triggerAutoSave();
  }
}

function eliminarSector(idx) {
  if (idx >= 0 && idx < currentSectores.length) {
    currentSectores.splice(idx, 1);
    renderSectoresChips();
    actualizarDatalistSectores();
    triggerAutoSave();
  }
}

function agregarSectorDesdeInput() {
  const inp = document.getElementById('inp-nuevo-sector');
  if (!inp) return;
  const val = inp.value.trim();
  if (!val) return;
  agregarSector(val);
  inp.value = '';
  inp.focus();
}

function autoDetectarSectoresDesdeExtintores(silent) {
  const data = getExtintoresTableData();
  let count = 0;
  data.forEach(d => {
    const u = (d.ubicacion || '').trim();
    if (u && !currentSectores.some(s => s.toLowerCase() === u.toLowerCase())) {
      currentSectores.push(u);
      count++;
    }
  });
  renderSectoresChips();
  actualizarDatalistSectores();
  if (count > 0) {
    triggerAutoSave();
  }
  if (!silent) {
    alert(`⚡ Se detectaron y agregaron ${count} nuevo(s) sector(es) desde la tabla de extintores.`);
  }
}

function renderSectoresChips() {
  const cont = document.getElementById('sectores-chips-container');
  const badge = document.getElementById('sectores-count-badge');
  if (badge) badge.textContent = currentSectores.length;
  if (!cont) return;
  cont.innerHTML = '';
  
  if (currentSectores.length === 0) {
    cont.innerHTML = '<span style="font-size:8.5px;color:#94a3b8;font-style:italic;">No hay sectores registrados aún. Escribí un sector y hacé click en "➕ Agregar Sector" o "⚡ Auto-detectar".</span>';
    return;
  }

  currentSectores.forEach((sec, idx) => {
    const chip = document.createElement('span');
    chip.className = 'sector-chip';
    chip.innerHTML = `
      <span>🏢 ${escHtml(sec)}</span>
      <button type="button" class="sector-chip-btn-del" title="Eliminar este sector" onclick="eliminarSector(${idx})">×</button>
    `;
    cont.appendChild(chip);
  });
}

function actualizarDatalistSectores() {
  const dl = document.getElementById('dl-sectores');
  if (!dl) return;
  dl.innerHTML = '';
  currentSectores.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    dl.appendChild(opt);
  });
}

function handleUbicacionChange(input) {
  const val = (input.value || '').trim();
  if (val && !currentSectores.some(s => s.toLowerCase() === val.toLowerCase())) {
    agregarSector(val);
  }
}

// ==================== CÁLCULO Y EVALUACIÓN DE CARGA DE FUEGO POR SECTOR ====================
function getCargaFuegoTableData() {
  const rows = [];
  const trs = document.querySelectorAll('#tbody-carga-fuego tr.cf-row');
  trs.forEach(tr => {
    const sector = tr.querySelector('.cf-inp-sector')?.value || '';
    const superficie = parseFloat(tr.querySelector('.cf-inp-sup')?.value) || 0;
    const material = tr.querySelector('.cf-sel-mat')?.value || 'Papelería / Archivo';
    const cargaEst = tr.querySelector('.cf-inp-carga')?.value || '';
    const extintores = tr.querySelector('.cf-inp-ext')?.value || '';
    rows.push({ sector, superficie, material, cargaEst, extintores });
  });
  return rows;
}

function renderCargaFuegoTable() {
  const tbody = document.getElementById('tbody-carga-fuego');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!cargaFuegoData || cargaFuegoData.length === 0) {
    if (currentSectores && currentSectores.length > 0) {
      cargaFuegoData = currentSectores.map(s => ({
        sector: s,
        superficie: 45,
        material: 'Papelería / Archivo',
        cargaEst: '25 kg/m²',
        extintores: '1 unidad ABC 5kg'
      }));
    } else {
      cargaFuegoData = [
        { sector: 'Planta Baja - Hall Acceso', superficie: 40, material: 'Papelería / Archivo', cargaEst: '15 kg/m²', extintores: '1 unidad ABC 5kg' },
        { sector: 'Planta Baja - Guardia', superficie: 30, material: 'Mobiliario / Equipos', cargaEst: '25 kg/m²', extintores: '1 unidad ABC 5kg' },
        { sector: 'Planta Baja - Pasillo Oficinas', superficie: 80, material: 'Papelería / Archivo', cargaEst: '20 kg/m²', extintores: '1 unidad ABC 5kg' }
      ];
    }
  }

  cargaFuegoData.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'cf-row';
    tr.innerHTML = `
      <td style="border:1px solid #cbd5e1;padding:2px 4px;">
        <input type="text" class="field-line cf-inp-sector" list="dl-sectores" value="${escHtml(row.sector)}" placeholder="Sector" style="width:100%;font-size:8.5px;" onchange="triggerAutoSave()">
      </td>
      <td style="border:1px solid #cbd5e1;padding:2px 4px;">
        <input type="number" class="field-line cf-inp-sup" value="${row.superficie || ''}" min="1" placeholder="m²" style="width:100%;font-size:8.5px;text-align:right;" oninput="actualizarReqCargaFuego(this); triggerAutoSave()">
      </td>
      <td style="border:1px solid #cbd5e1;padding:2px 4px;">
        <select class="field-line cf-sel-mat" style="width:100%;font-size:8.5px;" onchange="actualizarCargaEstMat(this); triggerAutoSave()">
          <option value="Papelería / Archivo" ${row.material === 'Papelería / Archivo' ? 'selected' : ''}>Papelería / Archivo</option>
          <option value="Mobiliario / Equipos" ${row.material === 'Mobiliario / Equipos' ? 'selected' : ''}>Mobiliario / Equipos</option>
          <option value="Plásticos / Cables" ${row.material === 'Plásticos / Cables' ? 'selected' : ''}>Plásticos / Cables</option>
          <option value="Depósito General" ${row.material === 'Depósito General' ? 'selected' : ''}>Depósito General</option>
          <option value="Taller / Combustibles" ${row.material === 'Taller / Combustibles' ? 'selected' : ''}>Taller / Combustibles</option>
          <option value="Otro" ${row.material === 'Otro' ? 'selected' : ''}>Otro</option>
        </select>
      </td>
      <td style="border:1px solid #cbd5e1;padding:2px 4px;">
        <input type="text" class="field-line cf-inp-carga" value="${escHtml(row.cargaEst || '25 kg/m²')}" placeholder="kg/m²" style="width:100%;font-size:8.5px;" onchange="triggerAutoSave()">
      </td>
      <td style="border:1px solid #cbd5e1;padding:2px 4px;">
        <input type="text" class="field-line cf-inp-ext" value="${escHtml(row.extintores || '1 unidad ABC 5kg')}" placeholder="Extintores requeridos" style="width:100%;font-size:8.5px;font-weight:bold;color:#b45309;" onchange="triggerAutoSave()">
      </td>
      <td class="no-print" style="border:1px solid #cbd5e1;text-align:center;padding:2px;">
        <button type="button" class="btn-ext-del" onclick="eliminarFilaCargaFuego(${idx})" title="Eliminar fila">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarReqCargaFuego(supInput) {
  const tr = supInput.closest('tr');
  if (!tr) return;
  const sup = parseFloat(supInput.value) || 0;
  const reqInput = tr.querySelector('.cf-inp-ext');
  if (reqInput && sup > 0) {
    const unidades = Math.max(1, Math.ceil(sup / 200));
    reqInput.value = `${unidades} unid. ABC 5kg (1 c/200m²)`;
  }
}

function actualizarCargaEstMat(sel) {
  const tr = sel.closest('tr');
  if (!tr) return;
  const cargaInp = tr.querySelector('.cf-inp-carga');
  if (!cargaInp) return;
  const m = sel.value;
  if (m === 'Papelería / Archivo') cargaInp.value = '25 kg/m²';
  else if (m === 'Mobiliario / Equipos') cargaInp.value = '20 kg/m²';
  else if (m === 'Plásticos / Cables') cargaInp.value = '35 kg/m²';
  else if (m === 'Depósito General') cargaInp.value = '40 kg/m²';
  else if (m === 'Taller / Combustibles') cargaInp.value = '60 kg/m²';
}

function agregarFilaCargaFuego(datos) {
  cargaFuegoData = getCargaFuegoTableData();
  cargaFuegoData.push(datos || {
    sector: '',
    superficie: '',
    material: 'Papelería / Archivo',
    cargaEst: '25 kg/m²',
    extintores: '1 unidad ABC 5kg'
  });
  renderCargaFuegoTable();
  triggerAutoSave();
}

function eliminarFilaCargaFuego(idx) {
  cargaFuegoData = getCargaFuegoTableData();
  if (idx >= 0 && idx < cargaFuegoData.length) {
    cargaFuegoData.splice(idx, 1);
    renderCargaFuegoTable();
    triggerAutoSave();
  }
}

function sincronizarSectoresConCargaFuego() {
  if (!currentSectores || currentSectores.length === 0) {
    autoDetectarSectoresDesdeExtintores(true);
  }
  if (!currentSectores || currentSectores.length === 0) {
    alert('ℹ️ No hay sectores dados de alta aún. Podés registrarlos en la planilla de Extintores.');
    return;
  }
  const currentRows = getCargaFuegoTableData();
  const existingMap = new Map();
  currentRows.forEach(r => {
    if (r.sector) existingMap.set(r.sector.toLowerCase(), r);
  });

  const newRows = [];
  currentSectores.forEach(s => {
    if (existingMap.has(s.toLowerCase())) {
      newRows.push(existingMap.get(s.toLowerCase()));
    } else {
      newRows.push({
        sector: s,
        superficie: 45,
        material: 'Papelería / Archivo',
        cargaEst: '25 kg/m²',
        extintores: '1 unidad ABC 5kg'
      });
    }
  });

  cargaFuegoData = newRows;
  renderCargaFuegoTable();
  triggerAutoSave();
  alert(`✅ Se sincronizaron ${newRows.length} sectores con la evaluación de Carga de Fuego.`);
}

// ==================== TABLA TÉCNICA DE EXTINTORES (INSPECCIÓN IN SITU & FOTOS) ====================
let extTableData = [];

function getExtintoresTableData() {
  const rows = [];
  const trs = document.querySelectorAll('#ext-table-tbody tr.ext-data-row');
  trs.forEach((tr, idx) => {
    const ubicacion = tr.querySelector('.ext-inp-ubicacion')?.value || '';
    const nroSerie = tr.querySelector('.ext-inp-serie')?.value || '';
    const agente = tr.querySelector('.ext-sel-agente')?.value || 'ABC';
    const capacidad = tr.querySelector('.ext-sel-capacidad')?.value || '5 kg';
    const vencimiento = tr.querySelector('.ext-inp-vencimiento')?.value || '';
    
    const getChk = (col) => tr.querySelector(`input[name="ext_chk_${idx}_${col}"]:checked`)?.value || 'S';
    
    const foto1 = tr.getAttribute('data-foto1') || '';
    const foto2 = tr.getAttribute('data-foto2') || '';

    rows.push({
      ubicacion,
      nroSerie,
      agente,
      capacidad,
      vencimiento,
      presurizado: getChk('pres'),
      buenasCond: getChk('cond'),
      enSuLugar: getChk('lugar'),
      precintoOk: getChk('prec'),
      soporteFirme: getChk('sop'),
      cartelesVisibles: getChk('cart'),
      accesoLibre: getChk('acc'),
      foto1,
      foto2
    });
  });
  return rows;
}

function renderExtintoresTable() {
  const tbody = document.getElementById('ext-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!extTableData || extTableData.length === 0) {
    extTableData = [
      { ubicacion: 'Planta Baja - Hall Acceso', nroSerie: '', agente: 'ABC', capacidad: '5 kg', vencimiento: '', presurizado: 'S', buenasCond: 'S', enSuLugar: 'S', precintoOk: 'S', soporteFirme: 'S', cartelesVisibles: 'S', accesoLibre: 'S', foto1: '', foto2: '' },
      { ubicacion: 'Planta Baja - Guardia', nroSerie: '', agente: 'ABC', capacidad: '5 kg', vencimiento: '', presurizado: 'S', buenasCond: 'S', enSuLugar: 'S', precintoOk: 'S', soporteFirme: 'S', cartelesVisibles: 'S', accesoLibre: 'S', foto1: '', foto2: '' },
      { ubicacion: 'Planta Baja - Pasillo Oficinas', nroSerie: '', agente: 'ABC', capacidad: '5 kg', vencimiento: '', presurizado: 'S', buenasCond: 'S', enSuLugar: 'S', precintoOk: 'S', soporteFirme: 'S', cartelesVisibles: 'S', accesoLibre: 'S', foto1: '', foto2: '' },
      { ubicacion: 'Piso 1 - Pasillo Común', nroSerie: '', agente: 'ABC', capacidad: '5 kg', vencimiento: '', presurizado: 'S', buenasCond: 'S', enSuLugar: 'S', precintoOk: 'S', soporteFirme: 'S', cartelesVisibles: 'S', accesoLibre: 'S', foto1: '', foto2: '' },
      { ubicacion: 'Sector Cocina / Depósito', nroSerie: '', agente: 'ABC', capacidad: '5 kg', vencimiento: '', presurizado: 'S', buenasCond: 'S', enSuLugar: 'S', precintoOk: 'S', soporteFirme: 'S', cartelesVisibles: 'S', accesoLibre: 'S', foto1: '', foto2: '' }
    ];
  }

  extTableData.forEach((d, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'ext-data-row';
    tr.setAttribute('data-idx', idx);
    if (d.foto1) tr.setAttribute('data-foto1', d.foto1);
    if (d.foto2) tr.setAttribute('data-foto2', d.foto2);

    const renderRadioPair = (col, val) => `
      <td style="border:1px solid #000;text-align:center;padding:2px 0;">
        <input type="radio" name="ext_chk_${idx}_${col}" value="S" ${val !== 'N' ? 'checked' : ''} onchange="triggerAutoSave()">
      </td>
      <td style="border:1px solid #000;text-align:center;padding:2px 0;">
        <input type="radio" name="ext_chk_${idx}_${col}" value="N" ${val === 'N' ? 'checked' : ''} onchange="triggerAutoSave()">
      </td>
    `;

    tr.innerHTML = `
      <td style="border:1px solid #000;padding:2px;"><input type="text" class="ext-inp ext-inp-ubicacion" list="dl-sectores" value="${escHtml(d.ubicacion)}" placeholder="Piso / Sector" onchange="handleUbicacionChange(this); triggerAutoSave()"></td>
      <td style="border:1px solid #000;padding:2px;"><input type="text" class="ext-inp ext-inp-serie" value="${escHtml(d.nroSerie)}" placeholder="N° Serie" onchange="triggerAutoSave()"></td>
      <td style="border:1px solid #000;padding:2px;">
        <select class="ext-sel ext-sel-agente" onchange="triggerAutoSave()">
          <option value="ABC" ${d.agente === 'ABC' ? 'selected' : ''}>ABC</option>
          <option value="CO2" ${d.agente === 'CO2' ? 'selected' : ''}>CO2</option>
          <option value="Agua" ${d.agente === 'Agua' ? 'selected' : ''}>Agua</option>
          <option value="HCFC" ${d.agente === 'HCFC' ? 'selected' : ''}>HCFC / Halón</option>
          <option value="K" ${d.agente === 'K' ? 'selected' : ''}>Acetato K</option>
        </select>
      </td>
      <td style="border:1px solid #000;padding:2px;">
        <select class="ext-sel ext-sel-capacidad" onchange="triggerAutoSave()">
          <option value="5 kg" ${d.capacidad === '5 kg' ? 'selected' : ''}>5 kg</option>
          <option value="10 kg" ${d.capacidad === '10 kg' ? 'selected' : ''}>10 kg</option>
          <option value="2.5 kg" ${d.capacidad === '2.5 kg' ? 'selected' : ''}>2.5 kg</option>
          <option value="1 kg" ${d.capacidad === '1 kg' ? 'selected' : ''}>1 kg</option>
          <option value="50 kg" ${d.capacidad === '50 kg' ? 'selected' : ''}>50 kg</option>
          <option value="Otro" ${d.capacidad === 'Otro' ? 'selected' : ''}>Otro</option>
        </select>
      </td>
      <td style="border:1px solid #000;padding:2px;"><input type="text" class="ext-inp ext-inp-vencimiento" value="${escHtml(d.vencimiento)}" placeholder="mm/aaaa" onchange="triggerAutoSave()"></td>
      ${renderRadioPair('pres', d.presurizado)}
      ${renderRadioPair('cond', d.buenasCond)}
      ${renderRadioPair('lugar', d.enSuLugar)}
      ${renderRadioPair('prec', d.precintoOk)}
      ${renderRadioPair('sop', d.soporteFirme)}
      ${renderRadioPair('cart', d.cartelesVisibles)}
      ${renderRadioPair('acc', d.accesoLibre)}
      <td class="no-print" style="border:1px solid #000;text-align:center;padding:2px;">
        <div class="ext-actions-cell">
          <label class="ext-photo-btn" title="Foto 1: Marbete / Etiqueta">
            📷 Marbete
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="handleExtintorFoto(${idx}, 'foto1', this)">
          </label>
          ${d.foto1 ? `<img src="${d.foto1}" class="ext-photo-thumb" title="Click para ver foto de etiqueta" onclick="verFotoModal('${d.foto1}')">` : ''}
          <label class="ext-photo-btn" title="Foto 2: Ubicación / Cartel / Acceso">
            📷 Acceso
            <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="handleExtintorFoto(${idx}, 'foto2', this)">
          </label>
          ${d.foto2 ? `<img src="${d.foto2}" class="ext-photo-thumb" title="Click para ver foto de acceso" onclick="verFotoModal('${d.foto2}')">` : ''}
          <button type="button" class="btn-ext-del" onclick="eliminarFilaExtintor(${idx})" title="Eliminar este extintor">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function agregarFilaExtintor(datos) {
  extTableData = getExtintoresTableData();
  extTableData.push(datos || {
    ubicacion: '',
    nroSerie: '',
    agente: 'ABC',
    capacidad: '5 kg',
    vencimiento: '',
    presurizado: 'S',
    buenasCond: 'S',
    enSuLugar: 'S',
    precintoOk: 'S',
    soporteFirme: 'S',
    cartelesVisibles: 'S',
    accesoLibre: 'S',
    foto1: '',
    foto2: ''
  });
  renderExtintoresTable();
  triggerAutoSave();
}

function eliminarFilaExtintor(idx) {
  extTableData = getExtintoresTableData();
  if (idx >= 0 && idx < extTableData.length) {
    extTableData.splice(idx, 1);
    renderExtintoresTable();
    triggerAutoSave();
  }
}

function marcarTodosExtintoresSi() {
  document.querySelectorAll('#ext-table-tbody input[type=radio][value="S"]').forEach(r => r.checked = true);
  triggerAutoSave();
}

function handleExtintorFoto(idx, tipoFoto, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    extTableData = getExtintoresTableData();
    if (extTableData[idx]) {
      extTableData[idx][tipoFoto] = e.target.result;
      renderExtintoresTable();
      triggerAutoSave();
    }
  };
  reader.readAsDataURL(file);
}

function verFotoModal(src) {
  const w = window.open('');
  if (w) {
    w.document.write(`<title>Foto Extintor</title><body style="margin:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;"><img src="${src}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body>`);
  }
}

function getExtintoresSummary() {
  const rows = getExtintoresTableData();
  if (rows && rows.length > 0) {
    const conDesvio = rows.filter(r => r.presurizado === 'N' || r.buenasCond === 'N' || r.enSuLugar === 'N' || r.precintoOk === 'N' || r.soporteFirme === 'N' || r.cartelesVisibles === 'N' || r.accesoLibre === 'N').length;
    if (conDesvio > 0) {
      return `Relevado (${rows.length} extintores, ${conDesvio} con desvío)`;
    }
    return `Relevado (${rows.length} extintores - 100% OK)`;
  }
  const q24Ans = document.querySelector('input[name="q24"]:checked')?.value;
  return q24Ans === 'S' ? 'Extintores al día' : 'Pendiente de control';
}

function getPlanTeoricoDefault() {
  return {
    estado: 'Asignado según actividad',
    tareas: {
      rgrl: { aplica: true, meta: 'Confeccionar y presentar ante ART' },
      rar: { aplica: true, meta: 'Nómina completa de trabajadores' },
      svcc: { aplica: false, meta: 'Verificar presencia de cancerígenos' },
      res886: { aplica: true, meta: 'Planilla 1 y 2 en puestos operativos' },
      rgi: { aplica: true, meta: 'Inspección de condiciones críticas' },
      capVisita: { aplica: true, meta: '1 charla de inducción in situ' },
      extintores: { aplica: true, meta: 'Control trimestral / semestral' },
      capPlanificada: { aplica: true, meta: 'Cumplir cronograma anual' },
      tomaAgua: { aplica: true, meta: '1 análisis físico-químico y bacteriológico' },
      medIlum: { aplica: true, meta: 'Protocolo Res. SRT 84/12' },
      medRuido: { aplica: false, meta: 'Protocolo Res. SRT 85/12 (si > 80 dBA)' },
      medPat: { aplica: true, meta: 'Protocolo Res. SRT 900/15 (continuidad y jabalinas)' },
      otrasMed: { aplica: false, meta: 'Según contaminantes específicos' },
      simulacro: { aplica: true, meta: '1 ejercicio anual de evacuación' },
      cargaFuego: { aplica: true, meta: 'Memoria de cálculo Dec. 351 Anexo VII' }
    }
  };
}

// ==================== MATRIZ PLAN TEÓRICO VS REALIDAD ====================
function actualizarMatrizPlanVsRealidad() {
  const tbody = document.getElementById('pt-tbody');
  if (!tbody) return;

  const data = collectAllData();
  const ctrl = data.controlGestion || {};
  const pt = currentPlanTeorico || getPlanTeoricoDefault();
  const t = pt.tareas || {};

  const items = [
    { n: 1, name: 'RGRL (Res. SRT 463/09)', teorico: t.rgrl?.meta || 'Obligatorio anual', real: ctrl.rgrl, status: ctrl.rgrl.includes('RGRL') ? 'ok' : 'pend' },
    { n: 2, name: 'RAR (Res. SRT 37/10)', teorico: t.rar?.meta || 'Nómina de expuestos', real: ctrl.rar, status: ctrl.rar.includes('expuestos') ? 'ok' : 'pend' },
    { n: 3, name: 'SVCC (Res. SRT 81/19)', teorico: t.svcc?.meta || 'Solo si hay cancerígenos', real: ctrl.svcc, status: ctrl.svcc.includes('INCONSISTENCIA') ? 'alert' : (ctrl.svcc === 'Cargada' ? 'ok' : (ctrl.svcc === 'N/A' ? 'na' : 'pend')) },
    { n: 4, name: 'Resolución SRT 886/15 (Ergonomía)', teorico: t.res886?.meta || 'Puestos con riesgo ergonómico', real: ctrl.res886, status: ctrl.res886.includes('Sin') ? 'pend' : 'ok' },
    { n: 5, name: 'Riesgos graves e inminentes', teorico: 'Monitoreo preventivo', real: ctrl.rgi + (ctrl.rgiDesc ? ' (' + ctrl.rgiDesc + ')' : ''), status: ctrl.rgi === 'Sí' ? 'alert' : 'ok' },
    { n: 6, name: 'Capacitación en ocasión de visita', teorico: t.capVisita?.meta || '1 capacitación in situ', real: ctrl.capVisita || 'Sin registrar', status: ctrl.capVisita ? 'ok' : 'pend' },
    { n: 7, name: 'Control de extintores', teorico: t.extintores?.meta || '100% extintores vigentes', real: ctrl.extintores, status: ctrl.extintores.includes('Relevado') ? 'ok' : 'pend' },
    { n: 8, name: 'Capacitación planificada', teorico: t.capPlanificada?.meta || 'Plan anual', real: ctrl.capPlanificada || 'Sin plan cargado', status: ctrl.capPlanificada ? 'ok' : 'pend' },
    { n: 9, name: 'Toma de muestras de agua', teorico: t.tomaAgua?.meta || '1 muestra de agua', real: ctrl.tomaAgua + ' muestra/s programada/s', status: ctrl.tomaAgua > 0 ? 'ok' : (t.tomaAgua?.aplica ? 'pend' : 'na') },
    { n: 10, name: 'Medición de iluminación', teorico: t.medIlum?.meta || 'Protocolo Res. SRT 84/12', real: ctrl.medIlum + ' punto/s asignado/s', status: ctrl.medIlum > 0 ? 'ok' : 'pend' },
    { n: 11, name: 'Medición de ruido', teorico: t.medRuido?.meta || 'Protocolo Res. SRT 85/12 (si > 80 dBA)', real: ctrl.medRuido + ' puesto/s asignado/s', status: ctrl.medRuido > 0 ? 'ok' : (t.medRuido?.aplica ? 'pend' : 'na') },
    { n: 12, name: 'Medición de puesta a tierra', teorico: t.medPat?.meta || 'Protocolo Res. SRT 900/15 (continuidad y jabalinas)', real: ctrl.medPat + ' toma/s asignada/s', status: ctrl.medPat > 0 ? 'ok' : 'pend' },
    { n: 13, name: 'Otras mediciones técnicas', teorico: t.otrasMed?.meta || 'A requerimiento', real: ctrl.otrasMed + ' mediciones', status: ctrl.otrasMed > 0 ? 'ok' : 'na' },
    { n: 14, name: 'Simulacro de evacuación', teorico: t.simulacro?.meta || '1 anual', real: ctrl.simulacro === 'Sí' ? 'Ejecutado / Previsto' : 'Pendiente', status: ctrl.simulacro === 'Sí' ? 'ok' : 'pend' },
    { n: 15, name: 'Estudio de carga de fuego', teorico: t.cargaFuego?.meta || 'Estudio térmico', real: ctrl.cargaFuego === 'Sí' ? 'Calculada' : 'Pendiente', status: ctrl.cargaFuego === 'Sí' ? 'ok' : 'pend' }
  ];

  tbody.innerHTML = '';
  let okCount = 0;
  items.forEach(it => {
    if (it.status === 'ok') okCount++;
    const tr = document.createElement('tr');
    
    let badgeClass = 'badge-pt-pend';
    let badgeText = 'Pendiente';
    if (it.status === 'ok') { badgeClass = 'badge-pt-ok'; badgeText = 'Cumplido'; }
    else if (it.status === 'alert') { badgeClass = 'badge-pt-alert'; badgeText = '⚠️ Alerta'; }
    else if (it.status === 'na') { badgeClass = 'badge-pt-na'; badgeText = 'No Aplica'; }

    tr.innerHTML = `
      <td style="font-weight:bold;text-align:center;">${it.n}</td>
      <td><strong>${it.name}</strong></td>
      <td style="color:#334155;">${it.teorico}</td>
      <td><strong>${it.real}</strong></td>
      <td><span class="badge-pt ${badgeClass}">${badgeText}</span></td>
    `;
    tbody.appendChild(tr);
  });

  const badgePt = document.getElementById('badge-pt-status');
  if (badgePt) {
    badgePt.textContent = `${okCount}/15 Ajustados`;
  }
}

// ==================== INICIALIZACIÓN ====================
initEstablecimientos();
renderExtintoresTable();
renderSectoresChips();
actualizarDatalistSectores();
renderCargaFuegoTable();
actualizarTareasSegunTamano();
syncSchedFromChecklist();
buildGanttFromPage8();
function imprimirPlanillaExtintores() {
  document.body.classList.add('print-only-extintores');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('print-only-extintores');
  }, 1000);
}

evaluarSVCCEnVivo();
actualizarMatrizPlanVsRealidad();

setViewMode('modules');
switchModule('mod-sedes');