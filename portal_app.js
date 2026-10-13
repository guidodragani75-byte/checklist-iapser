/**
 * PORTAL DE LEGAJO DIGITAL HyS - IAPSER ART
 * Lógica de cliente: Gestión de 452 establecimientos, actividades modulares,
 * codificación normalizada de archivos y subida directa a Google Drive / Sheets.
 */

// URL oficial por defecto del Webhook de Google Apps Script
const DEFAULT_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxJf_ebJ4MZRcbrSSn-K-PJCRZNAUSSfCkRt3LM8gDeKz-o47cQ3bjvXnFcE8-RjsFu/exec';

// Claves de LocalStorage
const STORAGE_KEYS = {
  LEGAJO_DB: 'iapser_legajo_actividades_v1',
  WEBHOOK_URL: 'hys_sheets_webhook_url',
  DRIVE_ROOT_ID: 'iapser_drive_root_id',
  CURRENT_EST_ID: 'hys_current_est_id',
  CUSTOM_ACTIVITIES: 'iapser_custom_activities_v1'
};

// Catálogo maestro de actividades
const CATALOGO_ACTIVIDADES = {
  confeccion_rgrl: {
    id: 'confeccion_rgrl',
    codigo: 'RGRL',
    nombre: 'Confección de RGRL',
    subtitulo: 'Relevamiento General de Riesgos Laborales (Dec. 351/79)',
    icono: '📋',
    color: '#1e40af',
    permiteMultiples: false,
    esChecklist: true
  },
  confeccion_rar: {
    id: 'confeccion_rar',
    codigo: 'RAR',
    nombre: 'Confección de RAR',
    subtitulo: 'Relevamiento de Agentes de Riesgo (Nómina de expuestos SRT)',
    icono: '👥',
    color: '#0369a1',
    permiteMultiples: false
  },
  muestra_agua: {
    id: 'muestra_agua',
    codigo: 'AGUA_TOMA',
    nombre: 'Muestra de Agua (Toma in situ)',
    subtitulo: 'Fase 1: Muestreo preventor en sede y remisión a laboratorio',
    icono: '💧',
    color: '#0284c7',
    esAguaEtapa1: true,
    permiteMultiples: false
  },
  analisis_agua: {
    id: 'analisis_agua',
    codigo: 'AGUA_PROTOCOLO',
    nombre: 'Análisis de Agua (Protocolo)',
    subtitulo: 'Fase 2: Dictamen de Laboratorio (Físico-Químico y Bacteriológico)',
    icono: '🔬',
    color: '#0f766e',
    esAguaEtapa2: true,
    permiteMultiples: false
  },
  medicion_pat: {
    id: 'medicion_pat',
    codigo: 'PAT',
    nombre: 'Puesta a Tierra (PAT)',
    subtitulo: 'Protocolo Res. SRT 900/15 y continuidad de masas',
    icono: '⚡',
    color: '#b45309',
    permiteMultiples: false
  },
  medicion_ruido: {
    id: 'medicion_ruido',
    codigo: 'RUIDO',
    nombre: 'Medición de Ruido',
    subtitulo: 'Protocolo Res. SRT 85/12 en puestos y áreas operativas',
    icono: '🔊',
    color: '#b91c1c',
    permiteMultiples: false
  },
  medicion_iluminacion: {
    id: 'medicion_iluminacion',
    codigo: 'ILUM',
    nombre: 'Medición de Iluminación',
    subtitulo: 'Protocolo Res. SRT 84/12 y evaluación de luxes por puesto',
    icono: '💡',
    color: '#d97706',
    permiteMultiples: false
  },
  res_886: {
    id: 'res_886',
    codigo: 'RES886',
    nombre: 'Ergonomía Res. 886/15 SRT',
    subtitulo: 'Evaluación ergonómica inicial y planillas por puesto de trabajo',
    icono: '🪑',
    color: '#7c3aed',
    permiteMultiples: true // Varios puestos en el mismo establecimiento
  },
  capacitaciones: {
    id: 'capacitaciones',
    codigo: 'CAPACITACION',
    nombre: 'Capacitaciones HyS',
    subtitulo: 'Cursos y charlas preventivas dictadas al personal',
    icono: '🎓',
    color: '#4338ca',
    permiteMultiples: true // Varios temas en distintas fechas
  },
  carga_fuego: {
    id: 'carga_fuego',
    codigo: 'CARGA_FUEGO',
    nombre: 'Evaluación de Carga de Fuego',
    subtitulo: 'Memoria de cálculo térmico y potencial extintor (Dec. 351/79)',
    icono: '🔥',
    color: '#c2410c',
    permiteMultiples: false
  },
  simulacro: {
    id: 'simulacro',
    codigo: 'SIMULACRO',
    nombre: 'Simulacro de Evacuación',
    subtitulo: 'Práctica de emergencia, tiempos de respuesta y plan de mejora',
    icono: '🚨',
    color: '#be123c',
    permiteMultiples: true
  }
};

// Estado global de la aplicación
const AppState = {
  establecimientos: {},
  establecimientoSeleccionado: null,
  actividadesRegistradas: {}, // estId -> array de actividades
  filtroTexto: '',
  filtroOrganismo: '',
  filtroLocalidad: '',
  customActivities: [],
  estaSincronizando: false
};

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  cargarEstablecimientos();
  cargarLegajoLocal();
  renderFiltrosOrganismos();
  renderFiltrosLocalidades();
  renderListaEstablecimientos();
  
  // Seleccionar por defecto el primer establecimiento o el que venga en URL
  const urlParams = new URLSearchParams(window.location.search);
  const paramEstId = urlParams.get('estId') || localStorage.getItem(STORAGE_KEYS.CURRENT_EST_ID);
  
  if (paramEstId && AppState.establecimientos[paramEstId]) {
    seleccionarEstablecimiento(paramEstId);
  } else {
    const firstKey = Object.keys(AppState.establecimientos)[0];
    if (firstKey) seleccionarEstablecimiento(firstKey);
  }

  setupEventListeners();
});

function initStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL)) {
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, DEFAULT_SHEETS_WEBHOOK_URL);
  }
}

function getWebhookUrl() {
  return localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || DEFAULT_SHEETS_WEBHOOK_URL;
}

// Cargar catálogo de 452 establecimientos desde datos_precargados.js
function cargarEstablecimientos() {
  let list = {};
  
  // 1. Tomar catálogo completo de 452 sedes
  if (typeof PRELOADED_ESTABLECIMIENTOS !== 'undefined') {
    Object.keys(PRELOADED_ESTABLECIMIENTOS).forEach(key => {
      list[key] = { ...PRELOADED_ESTABLECIMIENTOS[key] };
    });
  }

  // 2. Si hay relevamientos completos en PRELOADED_SURVEYS, enriquecer datos
  if (typeof PRELOADED_SURVEYS !== 'undefined') {
    Object.keys(PRELOADED_SURVEYS).forEach(key => {
      const survey = PRELOADED_SURVEYS[key];
      if (list[key]) {
        list[key] = { ...list[key], ...survey };
      } else {
        list[key] = { ...survey };
      }
    });
  }

  // 3. Normalizar nombres y campos clave
  Object.keys(list).forEach(id => {
    const est = list[id];
    est.id = id;
    est.organismo = (est.organismo || est.razonSocial || 'ORGANISMO PROVINCIAL').trim();
    est.nombreEstablecimiento = (est.nombreEstablecimiento || est.domicilio || 'Sede N° ' + (est.nroEstab || '')).trim();
    est.domicilio = (est.domicilio || est.direccion || 'Sin domicilio registrado').trim();
    est.localidad = (est.localidad || 'Entre Ríos').trim();
    est.nroEstab = (est.nroEstab || '').toString().trim();
    est.cuit = (est.cuit || '30-67119808-1').trim();
  });

  AppState.establecimientos = list;
}

function cargarLegajoLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEGAJO_DB);
    if (raw) {
      AppState.actividadesRegistradas = JSON.parse(raw);
    } else {
      AppState.actividadesRegistradas = {};
    }
  } catch (e) {
    console.error('Error cargando legajo local:', e);
    AppState.actividadesRegistradas = {};
  }

  try {
    const rawCustom = localStorage.getItem(STORAGE_KEYS.CUSTOM_ACTIVITIES);
    if (rawCustom) {
      AppState.customActivities = JSON.parse(rawCustom);
    }
  } catch (e) {
    AppState.customActivities = [];
  }
}

function guardarLegajoLocal() {
  try {
    localStorage.setItem(STORAGE_KEYS.LEGAJO_DB, JSON.stringify(AppState.actividadesRegistradas));
  } catch (e) {
    console.error('Error guardando legajo local:', e);
  }
}

// ==================== CODIFICACIÓN DE ARCHIVOS ====================
function sanitizeText(text) {
  if (!text) return '';
  return text.toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function obtenerAbreviaturaOrganismo(org) {
  const s = (org || '').toUpperCase();
  if (s.includes('POLICIA') || s.includes('JEFATURA')) return 'POL';
  if (s.includes('SALUD')) return 'SALUD';
  if (s.includes('GOBIERNO')) return 'GOB';
  if (s.includes('ATER') || s.includes('TRIBUTARIA')) return 'ATER';
  if (s.includes('UADER') || s.includes('UNIVERSIDAD')) return 'UADER';
  if (s.includes('JUBILACION')) return 'CJPER';
  if (s.includes('TRIBUNAL')) return 'TCER';
  if (s.includes('ALIMENTACION') || s.includes('ICAB')) return 'ICAB';
  if (s.includes('ENERGIA')) return 'ENERGIA';
  if (s.includes('PRODUCCION') || s.includes('URDINARRAIN')) return 'EPPE';
  return sanitizeText(s.substring(0, 8)).toUpperCase() || 'ORG';
}

function generarCodigoArchivo(org, nroEstab, actividadId, fecha, detalle, ext) {
  const orgAbbr = obtenerAbreviaturaOrganismo(org);
  let cleanNro = sanitizeText(nroEstab || '000');
  while (cleanNro.length < 3 && !isNaN(cleanNro)) cleanNro = '0' + cleanNro;

  const actInfo = CATALOGO_ACTIVIDADES[actividadId];
  const actCode = actInfo ? actInfo.codigo : sanitizeText(actividadId).toUpperCase();

  let fechaStr = (fecha || '').replace(/[^0-9]/g, '');
  if (!fechaStr || fechaStr.length < 8) {
    const d = new Date();
    fechaStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  const cleanDet = sanitizeText(detalle || 'Informe');
  const cleanExt = (ext || 'pdf').replace(/^\./, '');

  return `${orgAbbr}_${cleanNro}_${actCode}_${fechaStr}_${cleanDet}.${cleanExt}`;
}

// ==================== INTERFAZ Y RENDERIZADO ====================

function renderFiltrosOrganismos() {
  const select = document.getElementById('filtro-organismo');
  if (!select) return;

  const orgs = new Set();
  Object.values(AppState.establecimientos).forEach(e => {
    if (e.organismo) orgs.add(e.organismo);
  });

  const sortedOrgs = Array.from(orgs).sort();
  select.innerHTML = '<option value="">Todos los Organismos (' + sortedOrgs.length + ')</option>';
  sortedOrgs.forEach(org => {
    const opt = document.createElement('option');
    opt.value = org;
    opt.textContent = org;
    select.appendChild(opt);
  });
}

function renderFiltrosLocalidades() {
  const select = document.getElementById('filtro-localidad');
  if (!select) return;

  const locs = new Set();
  Object.values(AppState.establecimientos).forEach(e => {
    if (e.localidad && e.localidad !== 'Entre Ríos') locs.add(e.localidad);
  });

  const sortedLocs = Array.from(locs).sort();
  select.innerHTML = '<option value="">Todas las Localidades (' + sortedLocs.length + ')</option>';
  sortedLocs.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    select.appendChild(opt);
  });
}

function renderListaEstablecimientos() {
  const container = document.getElementById('lista-establecimientos');
  const counterSpan = document.getElementById('contador-establecimientos');
  if (!container) return;

  const textFilter = AppState.filtroTexto.toLowerCase().trim();
  const orgFilter = AppState.filtroOrganismo;
  const locFilter = AppState.filtroLocalidad;

  const filtered = Object.values(AppState.establecimientos).filter(e => {
    if (orgFilter && e.organismo !== orgFilter) return false;
    if (locFilter && e.localidad !== locFilter) return false;
    if (textFilter) {
      const match = (e.organismo && e.organismo.toLowerCase().includes(textFilter)) ||
                    (e.nombreEstablecimiento && e.nombreEstablecimiento.toLowerCase().includes(textFilter)) ||
                    (e.domicilio && e.domicilio.toLowerCase().includes(textFilter)) ||
                    (e.localidad && e.localidad.toLowerCase().includes(textFilter)) ||
                    (e.nroEstab && e.nroEstab.toString().includes(textFilter)) ||
                    (e.cuit && e.cuit.includes(textFilter));
      if (!match) return false;
    }
    return true;
  });

  if (counterSpan) {
    counterSpan.textContent = `Mostrando ${filtered.length} de ${Object.keys(AppState.establecimientos).length} sedes`;
  }

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-slate-400 text-sm">No se encontraron establecimientos coincidentes.</div>';
    return;
  }

  const selectedId = AppState.establecimientoSeleccionado ? AppState.establecimientoSeleccionado.id : null;

  filtered.forEach(e => {
    const acts = AppState.actividadesRegistradas[e.id] || [];
    const countDocs = acts.filter(a => a.fileUrl || a.fileName).length;
    const isSelected = e.id === selectedId;

    const div = document.createElement('div');
    div.className = `est-card-item ${isSelected ? 'active' : ''}`;
    div.onclick = () => seleccionarEstablecimiento(e.id);

    div.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="font-semibold text-xs text-blue-900 tracking-tight leading-snug">
          ${e.nroEstab ? `<span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded mr-1">#${e.nroEstab}</span>` : ''}
          ${escapeHtml(e.nombreEstablecimiento)}
        </div>
        ${countDocs > 0 ? `<span class="badge-doc text-[10px]"><i class="fa-solid fa-folder"></i> ${countDocs}</span>` : ''}
      </div>
      <div class="text-[11px] text-slate-500 mt-1 truncate">
        <i class="fa-solid fa-building text-[10px] text-slate-400 mr-1"></i>${escapeHtml(e.organismo)}
      </div>
      <div class="text-[11px] text-slate-500 truncate">
        <i class="fa-solid fa-location-dot text-[10px] text-slate-400 mr-1"></i>${escapeHtml(e.domicilio)} (${escapeHtml(e.localidad)})
      </div>
    `;
    container.appendChild(div);
  });
}

function seleccionarEstablecimiento(estId) {
  const est = AppState.establecimientos[estId];
  if (!est) return;

  AppState.establecimientoSeleccionado = est;
  localStorage.setItem(STORAGE_KEYS.CURRENT_EST_ID, estId);

  // Actualizar clase activa en la lista
  const cards = document.querySelectorAll('.est-card-item');
  cards.forEach(card => card.classList.remove('active'));
  // Re-render lista ligera para resaltar
  renderListaEstablecimientos();

  renderFichaEstablecimiento(est);
  renderPanelActividades(est);
  renderTablaDocumentos(est);
}

function renderFichaEstablecimiento(est) {
  const headerCard = document.getElementById('ficha-header');
  if (!headerCard) return;

  const acts = AppState.actividadesRegistradas[est.id] || [];
  const countDocs = acts.filter(a => a.fileUrl || a.fileName).length;
  const countRealizadas = acts.length;

  headerCard.innerHTML = `
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div>
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <span class="bg-blue-900 text-white font-bold text-xs px-2.5 py-0.5 rounded-full">
            Establecimiento N° ${est.nroEstab || 'S/N'}
          </span>
          <span class="bg-slate-200 text-slate-700 font-medium text-xs px-2.5 py-0.5 rounded-full">
            CUIT: ${est.cuit || '30-67119808-1'}
          </span>
          <span class="bg-emerald-100 text-emerald-800 font-medium text-xs px-2.5 py-0.5 rounded-full">
            IAPSER ART
          </span>
        </div>
        <h2 class="text-xl font-bold text-slate-900 leading-snug">
          ${escapeHtml(est.nombreEstablecimiento)}
        </h2>
        <div class="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span><i class="fa-solid fa-building text-slate-400 mr-1.5"></i><strong>Organismo:</strong> ${escapeHtml(est.organismo)}</span>
          <span><i class="fa-solid fa-location-dot text-slate-400 mr-1.5"></i><strong>Domicilio:</strong> ${escapeHtml(est.domicilio)}, ${escapeHtml(est.localidad)}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button onclick="abrirChecklistRGRL('${est.id}')" class="btn-primary text-xs flex items-center gap-2 shadow-sm">
          <i class="fa-solid fa-clipboard-check"></i>
          <span>Abrir Checklist RGRL (Dec. 351/79)</span>
        </button>
        <button onclick="sincronizarConSheets()" class="btn-secondary text-xs flex items-center gap-2" title="Sincronizar historial con Google Sheets">
          <i class="fa-solid fa-arrows-rotate ${AppState.estaSincronizando ? 'fa-spin' : ''}"></i>
          <span>Sincronizar Drive</span>
        </button>
      </div>
    </div>

    <!-- Barra de métricas del establecimiento -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/80">
      <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
        <div class="text-[11px] font-medium text-slate-500 uppercase">Actividades Registradas</div>
        <div class="text-lg font-bold text-blue-900">${countRealizadas}</div>
      </div>
      <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
        <div class="text-[11px] font-medium text-slate-500 uppercase">Archivos en Drive</div>
        <div class="text-lg font-bold text-emerald-700">${countDocs}</div>
      </div>
      <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
        <div class="text-[11px] font-medium text-slate-500 uppercase">Estado General</div>
        <div class="text-sm font-bold text-slate-700 mt-0.5">
          ${countRealizadas > 3 ? '<span class="text-emerald-600">● En cumplimiento</span>' : (countRealizadas > 0 ? '<span class="text-amber-600">● En proceso</span>' : '<span class="text-slate-400">● Sin iniciar</span>')}
        </div>
      </div>
      <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center">
        <div class="text-[11px] font-medium text-slate-500 uppercase">Última Visita</div>
        <div class="text-sm font-semibold text-slate-800 mt-0.5">
          ${obtenerUltimaFechaVisita(acts)}
        </div>
      </div>
    </div>
  `;
}

function obtenerUltimaFechaVisita(acts) {
  if (!acts || acts.length === 0) return 'Sin registros';
  const dates = acts.map(a => a.fechaActividad).filter(f => !!f);
  if (dates.length === 0) return 'Sin fecha';
  dates.sort().reverse();
  return dates[0];
}

function renderPanelActividades(est) {
  const grid = document.getElementById('grid-actividades');
  if (!grid) return;

  grid.innerHTML = '';
  const actsEst = AppState.actividadesRegistradas[est.id] || [];

  // 1. Renderizar actividades fijas del catálogo
  Object.values(CATALOGO_ACTIVIDADES).forEach(cat => {
    const card = crearTarjetaActividad(cat, est, actsEst);
    grid.appendChild(card);
  });

  // 2. Renderizar actividades dinámicas si existen
  AppState.customActivities.forEach(custom => {
    const card = crearTarjetaActividad({
      id: custom.id,
      codigo: sanitizeText(custom.nombre).toUpperCase(),
      nombre: custom.nombre,
      subtitulo: custom.subtitulo || 'Actividad adicional personalizada',
      icono: '📌',
      color: '#475569',
      permiteMultiples: true
    }, est, actsEst);
    grid.appendChild(card);
  });

  // 3. Tarjeta para agregar nueva actividad
  const addCard = document.createElement('div');
  addCard.className = 'activity-card-add flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition text-center text-slate-500 hover:text-blue-700';
  addCard.onclick = () => abrirModalNuevaActividadPersonalizada();
  addCard.innerHTML = `
    <i class="fa-solid fa-plus-circle text-2xl mb-2"></i>
    <div class="font-bold text-xs">Nueva Actividad</div>
    <div class="text-[11px] text-slate-400">Dar de alta otro tipo de actividad técnica</div>
  `;
  grid.appendChild(addCard);
}

function crearTarjetaActividad(cat, est, actsEst) {
  // Filtrar actividades registradas correspondientes a este tipo
  const registros = actsEst.filter(a => a.tipoActividad === cat.id);
  const tieneRegistros = registros.length > 0;
  const ultimoRegistro = tieneRegistros ? registros[registros.length - 1] : null;

  let estadoTexto = 'Pendiente';
  let estadoClase = 'badge-pendiente';

  if (tieneRegistros) {
    if (cat.id === 'muestra_agua') {
      // Verificar si ya se cargó el análisis de agua (etapa 2)
      const tieneAnalisis = actsEst.some(a => a.tipoActividad === 'analisis_agua');
      if (tieneAnalisis) {
        estadoTexto = 'Muestra + Lab. Completo';
        estadoClase = 'badge-completo';
      } else {
        estadoTexto = 'Muestra tomada (Espera Lab.)';
        estadoClase = 'badge-proceso';
      }
    } else if (ultimoRegistro.estadoActividad === 'No Apto' || ultimoRegistro.estadoActividad === 'Vencido') {
      estadoTexto = ultimoRegistro.estadoActividad;
      estadoClase = 'badge-alerta';
    } else {
      estadoTexto = ultimoRegistro.estadoActividad || 'Completado';
      estadoClase = 'badge-completo';
    }
  }

  const card = document.createElement('div');
  card.className = 'activity-card bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex flex-col justify-between';

  // Contenido de la tarjeta
  card.innerHTML = `
    <div>
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-lg flex items-center justify-center text-lg shadow-sm" style="background-color: ${cat.color}15; color: ${cat.color};">
            ${cat.icono}
          </div>
          <div>
            <h4 class="font-bold text-sm text-slate-900 leading-tight">${escapeHtml(cat.nombre)}</h4>
            <div class="text-[10px] text-slate-400 font-mono tracking-tight">${cat.codigo}</div>
          </div>
        </div>
        <span class="${estadoClase} text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
          ${estadoTexto}
        </span>
      </div>

      <p class="text-[11px] text-slate-500 line-clamp-2 mb-3">
        ${escapeHtml(cat.subtitulo)}
      </p>

      ${tieneRegistros ? `
        <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-xs text-slate-700 space-y-1 mb-3">
          <div class="flex justify-between items-center text-[11px]">
            <span class="text-slate-500"><i class="fa-regular fa-calendar mr-1"></i>Última fecha:</span>
            <strong class="text-slate-900">${ultimoRegistro.fechaActividad || 'S/F'}</strong>
          </div>
          ${ultimoRegistro.detalle ? `
            <div class="text-[11px] text-slate-600 truncate" title="${escapeHtml(ultimoRegistro.detalle)}">
              <span class="text-slate-400">Detalle:</span> ${escapeHtml(ultimoRegistro.detalle)}
            </div>
          ` : ''}
          ${ultimoRegistro.fileName ? `
            <div class="text-[10px] font-mono text-blue-700 truncate" title="${escapeHtml(ultimoRegistro.fileName)}">
              <i class="fa-solid fa-paperclip mr-1"></i>${escapeHtml(ultimoRegistro.fileName)}
            </div>
          ` : ''}
          ${cat.permiteMultiples && registros.length > 1 ? `
            <div class="text-[10px] font-semibold text-purple-700 pt-0.5">
              + ${registros.length - 1} registro(s) adicional(es)
            </div>
          ` : ''}
        </div>
      ` : `
        <div class="bg-slate-50/60 p-2.5 rounded-lg border border-dashed border-slate-200 text-center text-[11px] text-slate-400 mb-3">
          Sin registros para este establecimiento
        </div>
      `}
    </div>

    <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
      <button onclick="abrirModalRegistrarActividad('${cat.id}')" class="btn-action flex-1 text-center py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded font-semibold text-xs transition">
        <i class="fa-solid fa-cloud-arrow-up mr-1"></i>${tieneRegistros && cat.permiteMultiples ? 'Agregar otro' : 'Registrar / Subir'}
      </button>
      ${cat.esChecklist ? `
        <button onclick="abrirChecklistRGRL('${est.id}')" class="btn-action px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition" title="Ir al Checklist interactivo">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </button>
      ` : ''}
    </div>
  `;

  return card;
}

function renderTablaDocumentos(est) {
  const tbody = document.getElementById('tabla-documentos-body');
  if (!tbody) return;

  const acts = AppState.actividadesRegistradas[est.id] || [];
  tbody.innerHTML = '';

  if (acts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-slate-400 text-xs">
          <i class="fa-regular fa-folder-open text-2xl mb-2 block"></i>
          Aún no se han registrado actividades ni subido documentos para este establecimiento.
        </td>
      </tr>
    `;
    return;
  }

  acts.slice().reverse().forEach((a, index) => {
    const cat = CATALOGO_ACTIVIDADES[a.tipoActividad] || { nombre: a.tipoActividad, icono: '📌', codigo: 'ACT' };
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/70 border-b border-slate-100 text-xs text-slate-700';

    tr.innerHTML = `
      <td class="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
        ${a.fechaActividad || 'S/F'}
      </td>
      <td class="py-2.5 px-3">
        <div class="flex items-center gap-1.5 font-medium">
          <span>${cat.icono}</span>
          <span>${escapeHtml(cat.nombre)}</span>
        </div>
      </td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        <span class="badge-completo text-[10px] px-2 py-0.5 rounded-full font-bold">
          ${escapeHtml(a.estadoActividad || 'Completado')}
        </span>
      </td>
      <td class="py-2.5 px-3 max-w-xs truncate" title="${escapeHtml(a.detalle || '')}">
        ${escapeHtml(a.detalle || '-')}
      </td>
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate" title="${escapeHtml(a.fileName || '')}">
        ${a.fileName ? `<i class="fa-solid fa-file-pdf text-red-500 mr-1"></i>${escapeHtml(a.fileName)}` : '<span class="text-slate-400">Sin archivo adjunto</span>'}
      </td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        ${a.fileUrl ? `
          <a href="${a.fileUrl}" target="_blank" class="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold underline text-xs">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver en Drive
          </a>
        ` : (a.fileName ? `<span class="text-amber-600 text-[10px] font-semibold"><i class="fa-solid fa-clock"></i> Guardado Local</span>` : '-')}
      </td>
      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <button onclick="eliminarActividad('${est.id}', '${a.id || index}')" class="text-slate-400 hover:text-red-600 p-1" title="Eliminar este registro">
          <i class="fa-regular fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==================== MODALES Y CARGA DE DOCUMENTOS ====================

let currentActividadModal = null;
let archivoSeleccionadoBase64 = null;
let archivoSeleccionadoMeta = null;

function abrirModalRegistrarActividad(actividadId) {
  const est = AppState.establecimientoSeleccionado;
  if (!est) {
    alert('Por favor selecciona un establecimiento primero.');
    return;
  }

  currentActividadModal = actividadId;
  archivoSeleccionadoBase64 = null;
  archivoSeleccionadoMeta = null;

  const cat = CATALOGO_ACTIVIDADES[actividadId] || {
    id: actividadId,
    nombre: actividadId,
    icono: '📌',
    subtitulo: 'Actividad personalizada'
  };

  const modal = document.getElementById('modal-registro-actividad');
  if (!modal) return;

  document.getElementById('modal-act-titulo').textContent = `Registrar ${cat.nombre}`;
  document.getElementById('modal-act-subtitulo').textContent = `${est.nombreEstablecimiento} (N° ${est.nroEstab || 'S/N'})`;
  document.getElementById('modal-act-icono').innerHTML = cat.icono;

  // Fecha por defecto: hoy
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('act-fecha').value = today;
  document.getElementById('act-preventor').value = localStorage.getItem('hys_ultimo_preventor') || '';

  // Configurar campos dinámicos específicos según la actividad
  configurarCamposDinamicosModal(cat, est);

  // Reset uploader
  resetUploaderUI();
  actualizarPreviewNombreArchivo();

  modal.classList.remove('hidden');
}

function configurarCamposDinamicosModal(cat, est) {
  const container = document.getElementById('campos-dinamicos-actividad');
  if (!container) return;

  container.innerHTML = '';

  if (cat.id === 'muestra_agua' || cat.id === 'analisis_agua') {
    container.innerHTML = `
      <div class="mb-3">
        <label class="block text-xs font-bold text-slate-700 mb-1">Fase del Relevamiento de Agua:</label>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <label class="flex items-center gap-2 p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
            <input type="radio" name="agua_fase" value="toma_muestra" ${cat.id === 'muestra_agua' ? 'checked' : ''} onchange="cambiarFaseAgua('toma_muestra')">
            <span>1° Toma de Muestra (In situ)</span>
          </label>
          <label class="flex items-center gap-2 p-2 rounded border border-slate-200 cursor-pointer hover:bg-slate-50">
            <input type="radio" name="agua_fase" value="protocolo_lab" ${cat.id === 'analisis_agua' ? 'checked' : ''} onchange="cambiarFaseAgua('protocolo_lab')">
            <span>2° Protocolo de Laboratorio</span>
          </label>
        </div>
      </div>
      <div id="agua-campos-extra" class="space-y-3">
        <!-- Rellenado dinámicamente -->
      </div>
    `;
    cambiarFaseAgua(cat.id === 'analisis_agua' ? 'protocolo_lab' : 'toma_muestra');
  } else if (cat.id === 'res_886') {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Puesto de Trabajo Evaluado *</label>
          <input type="text" id="campo-puesto-erg" class="input-text text-xs" placeholder="Ej: Operador de PC / Chofer / Maestranza" oninput="actualizarPreviewNombreArchivo()" required>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Nivel de Riesgo Inicial</label>
          <select id="campo-nivel-erg" class="input-select text-xs">
            <option value="Nivel 1 (Tolerable)">Nivel 1 (Tolerable)</option>
            <option value="Nivel 2 (Moderado)">Nivel 2 (Moderado)</option>
            <option value="Nivel 3 (No Tolerable)">Nivel 3 (No Tolerable - Requiere Adecuación)</option>
          </select>
        </div>
      </div>
    `;
  } else if (cat.id === 'capacitaciones') {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div class="sm:col-span-2">
          <label class="block text-xs font-bold text-slate-700 mb-1">Tema Dictado *</label>
          <input type="text" id="campo-tema-cap" class="input-text text-xs" placeholder="Ej: Uso seguro de extintores / Ergonomía / Riesgo Eléctrico" oninput="actualizarPreviewNombreArchivo()" required>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Cantidad Asistentes</label>
          <input type="number" id="campo-asistentes-cap" class="input-text text-xs" placeholder="Ej: 15" min="1">
        </div>
      </div>
    `;
  } else if (cat.id === 'medicion_pat') {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Cantidad de Electrodos/Jabalinas</label>
          <input type="number" id="campo-pat-jabalinas" class="input-text text-xs" placeholder="Ej: 4" min="1" oninput="actualizarPreviewNombreArchivo()">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Dictamen Técnico</label>
          <select id="campo-pat-dictamen" class="input-select text-xs">
            <option value="Conforme (< 10 Ohms)">Conforme (&lt; 10 Ohms según Res. SRT 900/15)</option>
            <option value="No Conforme (> 10 Ohms)">No Conforme (&gt; 10 Ohms - Requiere Adecuación)</option>
            <option value="Con Observaciones">Con Observaciones (Falta continuidad en masas)</option>
          </select>
        </div>
      </div>
    `;
  } else if (cat.id === 'medicion_ruido' || cat.id === 'medicion_iluminacion') {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Puntos o Sectores Evaluados</label>
          <input type="text" id="campo-med-puntos" class="input-text text-xs" placeholder="Ej: Talleres / Guardia / Administración" oninput="actualizarPreviewNombreArchivo()">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Conclusión del Protocolo</label>
          <select id="campo-med-dictamen" class="input-select text-xs">
            <option value="Dentro de los límites legales">Dentro de los límites legales SRT</option>
            <option value="Excede límites normativos">Excede límites normativos</option>
            <option value="Cumplimiento parcial">Cumplimiento parcial</option>
          </select>
        </div>
      </div>
    `;
  } else {
    // Genérico
    container.innerHTML = `
      <div class="mb-3">
        <label class="block text-xs font-bold text-slate-700 mb-1">Detalle o Descripción de la Actividad</label>
        <input type="text" id="campo-detalle-generico" class="input-text text-xs" placeholder="Ej: Informe técnico / Memoria de cálculo / Conclusiones" oninput="actualizarPreviewNombreArchivo()">
      </div>
    `;
  }
}

function cambiarFaseAgua(fase) {
  const extra = document.getElementById('agua-campos-extra');
  if (!extra) return;

  if (fase === 'toma_muestra') {
    currentActividadModal = 'muestra_agua';
    extra.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Punto de Muestreo in situ</label>
          <input type="text" id="campo-agua-punto" class="input-text text-xs" placeholder="Ej: Canilla cocina / Tanque de reserva" oninput="actualizarPreviewNombreArchivo()">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Estado del Proceso</label>
          <select id="campo-agua-estado" class="input-select text-xs">
            <option value="Muestra Tomada (Remitida a Lab)">Muestra Tomada (Remitida a Lab)</option>
            <option value="Muestra Tomada en Espera de Retiro">Muestra Tomada en Espera de Retiro</option>
          </select>
        </div>
      </div>
    `;
  } else {
    currentActividadModal = 'analisis_agua';
    extra.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Laboratorio de Análisis</label>
          <input type="text" id="campo-agua-lab" class="input-text text-xs" placeholder="Ej: Lab. Bromatología / Lab. Central">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Resultado Bacteriológico</label>
          <select id="campo-agua-res-bac" class="input-select text-xs">
            <option value="APTO">APTO (Potable)</option>
            <option value="NO APTO">NO APTO (Contaminado)</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Resultado Físico-Químico</label>
          <select id="campo-agua-res-fq" class="input-select text-xs">
            <option value="APTO">APTO</option>
            <option value="NO APTO">NO APTO</option>
          </select>
        </div>
      </div>
    `;
  }
  actualizarPreviewNombreArchivo();
}

function obtenerDetalleActualParaCodificacion() {
  const pErg = document.getElementById('campo-puesto-erg');
  if (pErg && pErg.value.trim()) return pErg.value.trim();

  const tCap = document.getElementById('campo-tema-cap');
  if (tCap && tCap.value.trim()) return tCap.value.trim();

  const aPunto = document.getElementById('campo-agua-punto');
  if (aPunto && aPunto.value.trim()) return aPunto.value.trim();

  const aLab = document.getElementById('campo-agua-lab');
  if (aLab && aLab.value.trim()) return 'Lab_' + aLab.value.trim();

  const mPts = document.getElementById('campo-med-puntos');
  if (mPts && mPts.value.trim()) return mPts.value.trim();

  const gen = document.getElementById('campo-detalle-generico');
  if (gen && gen.value.trim()) return gen.value.trim();

  return 'Informe';
}

function actualizarPreviewNombreArchivo() {
  const est = AppState.establecimientoSeleccionado;
  if (!est) return;

  const fechaVal = document.getElementById('act-fecha') ? document.getElementById('act-fecha').value : '';
  const detalleVal = obtenerDetalleActualParaCodificacion();
  const ext = archivoSeleccionadoMeta ? archivoSeleccionadoMeta.ext : 'pdf';

  const codigo = generarCodigoArchivo(est.organismo, est.nroEstab, currentActividadModal, fechaVal, detalleVal, ext);

  const prevFileName = document.getElementById('preview-filename');
  const prevFolder = document.getElementById('preview-folder');

  if (prevFileName) prevFileName.textContent = codigo;
  if (prevFolder) {
    const orgFolder = est.organismo;
    const estFolder = (est.nroEstab ? `Estab_${est.nroEstab} - ` : '') + est.nombreEstablecimiento;
    prevFolder.textContent = `Drive Raíz / ${orgFolder} / ${estFolder} /`;
  }
}

function resetUploaderUI() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const infoBox = document.getElementById('file-selected-info');
  const progressBox = document.getElementById('upload-progress-box');
  const btnSubmit = document.getElementById('btn-guardar-actividad');

  if (fileInput) fileInput.value = '';
  if (infoBox) infoBox.classList.add('hidden');
  if (progressBox) progressBox.classList.add('hidden');
  if (dropzone) dropzone.classList.remove('hidden');
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i>Guardar y Subir a Google Drive';
  }
}

function setupEventListeners() {
  // Búsqueda instantánea
  const searchInput = document.getElementById('buscar-establecimiento');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.filtroTexto = e.target.value;
      renderListaEstablecimientos();
    });
  }

  // Filtro organismo
  const orgSelect = document.getElementById('filtro-organismo');
  if (orgSelect) {
    orgSelect.addEventListener('change', (e) => {
      AppState.filtroOrganismo = e.target.value;
      renderListaEstablecimientos();
    });
  }

  // Filtro localidad
  const locSelect = document.getElementById('filtro-localidad');
  if (locSelect) {
    locSelect.addEventListener('change', (e) => {
      AppState.filtroLocalidad = e.target.value;
      renderListaEstablecimientos();
    });
  }

  // Uploader Drag and Drop
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('border-blue-500', 'bg-blue-50/50');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('border-blue-500', 'bg-blue-50/50');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-blue-500', 'bg-blue-50/50');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        procesarArchivoSeleccionado(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        procesarArchivoSeleccionado(e.target.files[0]);
      }
    });
  }
}

function procesarArchivoSeleccionado(file) {
  // Validar tamaño máximo recomendado (25 MB)
  const maxMb = 25;
  if (file.size > maxMb * 1024 * 1024) {
    alert(`⚠️ El archivo seleccionado pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB. El límite recomendado para subida a Google Apps Script es de ${maxMb} MB para evitar que Google corte la conexión por timeout. Si es posible, comprime el PDF antes de subirlo.`);
  }

  let ext = 'pdf';
  if (file.name.lastIndexOf('.') !== -1) {
    ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
  }

  archivoSeleccionadoMeta = {
    originalName: file.name,
    size: file.size,
    type: file.type || 'application/pdf',
    ext: ext
  };

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target.result;
    // Extraer solo la parte base64 sin el encabezado data:...;base64,
    const commaIndex = result.indexOf(',');
    archivoSeleccionadoBase64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;

    mostrarArchivoSeleccionadoUI(file);
    actualizarPreviewNombreArchivo();
  };
  reader.readAsDataURL(file);
}

function mostrarArchivoSeleccionadoUI(file) {
  const dropzone = document.getElementById('dropzone');
  const infoBox = document.getElementById('file-selected-info');
  const nameLabel = document.getElementById('file-info-name');
  const sizeLabel = document.getElementById('file-info-size');

  if (dropzone) dropzone.classList.add('hidden');
  if (infoBox) infoBox.classList.remove('hidden');

  if (nameLabel) nameLabel.textContent = file.name;
  if (sizeLabel) sizeLabel.textContent = `${(file.size / 1024).toFixed(1)} KB`;
}

function quitarArchivoSeleccionado() {
  archivoSeleccionadoBase64 = null;
  archivoSeleccionadoMeta = null;
  resetUploaderUI();
  actualizarPreviewNombreArchivo();
}

function cerrarModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
}

// ==================== ENVÍO Y GUARDADO A GOOGLE DRIVE / APPS SCRIPT ====================

async function guardarActividadYSubir() {
  const est = AppState.establecimientoSeleccionado;
  if (!est) return;

  const fecha = document.getElementById('act-fecha').value;
  if (!fecha) {
    alert('Por favor indica la fecha de realización de la actividad.');
    return;
  }

  const preventor = document.getElementById('act-preventor').value.trim();
  if (preventor) localStorage.setItem('hys_ultimo_preventor', preventor);

  const detalle = obtenerDetalleActualParaCodificacion();
  const observaciones = document.getElementById('act-obs') ? document.getElementById('act-obs').value.trim() : '';

  // Determinar estado de la actividad
  let estado = 'Completado';
  if (currentActividadModal === 'muestra_agua') {
    estado = 'Muestra Tomada (En Análisis)';
  } else if (currentActividadModal === 'analisis_agua') {
    const resBac = document.getElementById('campo-agua-res-bac') ? document.getElementById('campo-agua-res-bac').value : 'APTO';
    const resFq = document.getElementById('campo-agua-res-fq') ? document.getElementById('campo-agua-res-fq').value : 'APTO';
    estado = (resBac === 'APTO' && resFq === 'APTO') ? 'Apto (Potable)' : 'No Apto';
  } else if (currentActividadModal === 'medicion_pat') {
    const dic = document.getElementById('campo-pat-dictamen') ? document.getElementById('campo-pat-dictamen').value : '';
    if (dic.includes('No Conforme')) estado = 'No Conforme';
    else if (dic.includes('Observaciones')) estado = 'Con Observaciones';
    else estado = 'Conforme';
  }

  const ext = archivoSeleccionadoMeta ? archivoSeleccionadoMeta.ext : 'pdf';
  const codedFileName = generarCodigoArchivo(est.organismo, est.nroEstab, currentActividadModal, fecha, detalle, ext);

  // UI: Mostrar progreso
  const progressBox = document.getElementById('upload-progress-box');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressLabel = document.getElementById('upload-progress-label');
  const btnSubmit = document.getElementById('btn-guardar-actividad');

  if (progressBox) progressBox.classList.remove('hidden');
  if (btnSubmit) btnSubmit.disabled = true;

  animarProgreso(progressBar, progressLabel, 15, 'Preparando metadatos y codificación...');

  const payload = {
    tipoOperacion: 'upload_actividad_documento',
    tipoActividad: currentActividadModal,
    fechaActividad: fecha,
    estadoActividad: estado,
    detalle: detalle,
    preventor: preventor,
    observaciones: observaciones,
    fileBase64: archivoSeleccionadoBase64 || '',
    originalFileName: archivoSeleccionadoMeta ? archivoSeleccionadoMeta.originalName : '',
    mimeType: archivoSeleccionadoMeta ? archivoSeleccionadoMeta.type : 'application/pdf',
    establecimiento: {
      id: est.id,
      organismo: est.organismo,
      razonSocial: est.razonSocial || est.organismo,
      nombreEstablecimiento: est.nombreEstablecimiento,
      domicilio: est.domicilio,
      localidad: est.localidad,
      nroEstab: est.nroEstab,
      cuit: est.cuit
    }
  };

  animarProgreso(progressBar, progressLabel, 45, 'Transmitiendo a Google Drive y Google Sheets...');

  let driveUrl = '';
  let driveFileId = '';
  let registroId = 'ACT_' + Date.now();

  try {
    const webhookUrl = getWebhookUrl();
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    animarProgreso(progressBar, progressLabel, 85, 'Procesando confirmación del servidor...');
    const result = await response.json();

    if (result && result.status === 'success') {
      driveUrl = result.fileUrl || '';
      driveFileId = result.fileId || '';
      registroId = result.registroId || registroId;
    } else {
      console.warn('Respuesta no exitosa de Apps Script:', result);
    }
  } catch (err) {
    console.warn('No se pudo conectar inmediatamente con Google Apps Script (se guardará localmente):', err);
  }

  animarProgreso(progressBar, progressLabel, 100, '¡Guardado completado!');

  // Guardar en la base de datos local
  if (!AppState.actividadesRegistradas[est.id]) {
    AppState.actividadesRegistradas[est.id] = [];
  }

  const nuevoRegistro = {
    id: registroId,
    tipoActividad: currentActividadModal,
    fechaActividad: fecha,
    estadoActividad: estado,
    detalle: detalle,
    preventor: preventor,
    observaciones: observaciones,
    fileName: codedFileName,
    fileUrl: driveUrl,
    fileId: driveFileId,
    timestamp: new Date().toISOString()
  };

  AppState.actividadesRegistradas[est.id].push(nuevoRegistro);
  guardarLegajoLocal();

  // Actualizar la interfaz
  setTimeout(() => {
    cerrarModal('modal-registro-actividad');
    seleccionarEstablecimiento(est.id);
    mostrarToast('Actividad y documento guardados exitosamente.');
  }, 600);
}

function animarProgreso(bar, label, targetPercent, text) {
  if (bar) bar.style.width = targetPercent + '%';
  if (label) label.textContent = `${targetPercent}% - ${text}`;
}

function eliminarActividad(estId, regId) {
  if (!confirm('¿Estás seguro de eliminar este registro del historial local de este establecimiento?')) {
    return;
  }
  const list = AppState.actividadesRegistradas[estId] || [];
  AppState.actividadesRegistradas[estId] = list.filter((a, idx) => a.id !== regId && String(idx) !== String(regId));
  guardarLegajoLocal();
  seleccionarEstablecimiento(estId);
  mostrarToast('Registro eliminado del legajo.');
}

// ==================== SINCRONIZACIÓN CON GOOGLE SHEETS ====================

async function sincronizarConSheets() {
  const est = AppState.establecimientoSeleccionado;
  if (!est) return;

  AppState.estaSincronizando = true;
  renderFichaEstablecimiento(est);

  try {
    const url = `${getWebhookUrl()}?action=get_legajo_establecimiento&nroEstab=${encodeURIComponent(est.nroEstab || '')}&nombreEstab=${encodeURIComponent(est.nombreEstablecimiento)}&organismo=${encodeURIComponent(est.organismo)}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json && json.status === 'success' && Array.isArray(json.actividades)) {
      if (json.actividades.length > 0) {
        // Mapear registros de Google Sheet a estructura local
        const mapped = json.actividades.map(row => ({
          id: row['ID Registro'] || ('ACT_' + Date.now()),
          tipoActividad: normalizarActividadDesdeSheet(row['Tipo Actividad']),
          fechaActividad: row['Fecha Actividad'] || '',
          estadoActividad: row['Estado'] || 'Completado',
          detalle: row['Detalle / Puesto / Tema'] || '',
          fileName: row['Nombre Archivo'] || '',
          fileUrl: row['URL Google Drive'] || '',
          fileId: row['ID Drive'] || '',
          preventor: row['Preventor Responsable'] || '',
          observaciones: row['Observaciones'] || ''
        }));

        AppState.actividadesRegistradas[est.id] = mapped;
        guardarLegajoLocal();
        mostrarToast(`Sincronizados ${mapped.length} registros desde Google Drive/Sheets.`);
      } else {
        mostrarToast('No se encontraron registros previos en Google Sheets para esta sede.');
      }
    }
  } catch (err) {
    console.warn('Error sincronizando con Sheets:', err);
    mostrarToast('No se pudo conectar con Google Sheets. Mostrando datos locales.');
  } finally {
    AppState.estaSincronizando = false;
    renderFichaEstablecimiento(est);
    renderPanelActividades(est);
    renderTablaDocumentos(est);
  }
}

function normalizarActividadDesdeSheet(str) {
  if (!str) return 'confeccion_rgrl';
  const s = str.toLowerCase();
  for (const [key, val] of Object.entries(CATALOGO_ACTIVIDADES)) {
    if (s.includes(key) || s.includes(val.codigo.toLowerCase()) || s.includes(val.nombre.toLowerCase())) {
      return key;
    }
  }
  return str;
}

// ==================== ENLACE DIRECTO CON CHECKLIST RGRL (DEC 351/79) ====================

function abrirChecklistRGRL(estId) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_EST_ID, estId);
  window.open(`index.html?estId=${encodeURIComponent(estId)}`, '_blank');
}

// ==================== ACTIVIDADES PERSONALIZADAS ====================

function abrirModalNuevaActividadPersonalizada() {
  const modal = document.getElementById('modal-nueva-actividad-custom');
  if (modal) modal.classList.remove('hidden');
}

function guardarNuevaActividadPersonalizada() {
  const nombre = document.getElementById('custom-act-nombre').value.trim();
  const subtitulo = document.getElementById('custom-act-subtitulo').value.trim();

  if (!nombre) {
    alert('Por favor ingresa un nombre para la actividad.');
    return;
  }

  const id = 'custom_' + sanitizeText(nombre).toLowerCase();
  AppState.customActivities.push({
    id: id,
    nombre: nombre,
    subtitulo: subtitulo || 'Actividad adicional según necesidad'
  });

  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_ACTIVITIES, JSON.stringify(AppState.customActivities));
  } catch(e) {}

  cerrarModal('modal-nueva-actividad-custom');
  if (AppState.establecimientoSeleccionado) {
    renderPanelActividades(AppState.establecimientoSeleccionado);
  }
  mostrarToast(`Actividad "${nombre}" agregada al catálogo.`);
}

// ==================== TABLERO GENERAL DE MÉTRICAS ====================

function abrirModalTableroGeneral() {
  const modal = document.getElementById('modal-tablero-general');
  if (!modal) return;

  const totalEst = Object.keys(AppState.establecimientos).length;
  let totalDocs = 0;
  let totalActs = 0;
  const conteoPorActividad = {};

  Object.values(AppState.actividadesRegistradas).forEach(acts => {
    totalActs += acts.length;
    acts.forEach(a => {
      if (a.fileUrl || a.fileName) totalDocs++;
      const cat = CATALOGO_ACTIVIDADES[a.tipoActividad];
      const nom = cat ? cat.nombre : a.tipoActividad;
      conteoPorActividad[nom] = (conteoPorActividad[nom] || 0) + 1;
    });
  });

  document.getElementById('metric-total-sedes').textContent = totalEst;
  document.getElementById('metric-total-acts').textContent = totalActs;
  document.getElementById('metric-total-docs').textContent = totalDocs;

  const listContainer = document.getElementById('metric-lista-actividades');
  if (listContainer) {
    listContainer.innerHTML = '';
    const sorted = Object.entries(conteoPorActividad).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      listContainer.innerHTML = '<div class="text-xs text-slate-400 py-4 text-center">Aún no hay actividades registradas en el sistema.</div>';
    } else {
      sorted.forEach(([nombre, count]) => {
        const pct = Math.min(100, Math.round((count / totalEst) * 100));
        const div = document.createElement('div');
        div.className = 'space-y-1';
        div.innerHTML = `
          <div class="flex justify-between text-xs">
            <span class="font-semibold text-slate-700">${escapeHtml(nombre)}</span>
            <span class="font-bold text-blue-900">${count} sedes (${pct}%)</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div class="bg-blue-600 h-2 rounded-full" style="width: ${pct}%"></div>
          </div>
        `;
        listContainer.appendChild(div);
      });
    }
  }

  modal.classList.remove('hidden');
}

// ==================== CONFIGURACIÓN ====================

function abrirModalConfiguracion() {
  const modal = document.getElementById('modal-configuracion');
  if (!modal) return;

  document.getElementById('config-webhook-url').value = getWebhookUrl();
  document.getElementById('config-drive-id').value = localStorage.getItem(STORAGE_KEYS.DRIVE_ROOT_ID) || '';
  modal.classList.remove('hidden');
}

function guardarConfiguracion() {
  const url = document.getElementById('config-webhook-url').value.trim();
  const driveId = document.getElementById('config-drive-id').value.trim();

  if (url) localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, url);
  if (driveId) localStorage.setItem(STORAGE_KEYS.DRIVE_ROOT_ID, driveId);

  cerrarModal('modal-configuracion');
  mostrarToast('Configuración guardada exitosamente.');
}

// ==================== UTILIDADES ====================

function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function mostrarToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 transition transform translate-y-20 opacity-0';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i> <span>${escapeHtml(msg)}</span>`;
  toast.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}
