/**
 * PORTAL DE LEGAJO DIGITAL HyS - IAPSER ART
 * Versión 2.0: Arquitectura modular con 3 vistas especializadas:
 * 1) Ficha & Carga por Sede (operativo)
 * 2) Matriz de Cumplimiento Anual (grilla con cantidades y filtro de año)
 * 3) Repositorio Global de Documentos (auditoría y archivos en Drive)
 */

// URL oficial por defecto del Webhook de Google Apps Script
const DEFAULT_SHEETS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxJf_ebJ4MZRcbrSSn-K-PJCRZNAUSSfCkRt3LM8gDeKz-o47cQ3bjvXnFcE8-RjsFu/exec';

// Claves de LocalStorage
const STORAGE_KEYS = {
  LEGAJO_DB: 'iapser_legajo_actividades_v1',
  WEBHOOK_URL: 'hys_sheets_webhook_url',
  DRIVE_ROOT_ID: 'iapser_drive_root_id',
  CURRENT_EST_ID: 'hys_current_est_id',
  CUSTOM_ACTIVITIES: 'iapser_custom_activities_v1',
  MODULO_ACTIVO: 'iapser_modulo_activo_v1',
  CARPETAS_MENSUALES: 'iapser_carpetas_mensuales_v1',
  PARENT_MENSUAL_URL: 'iapser_parent_mensual_url'
};

// Catálogo maestro de actividades
const CATALOGO_ACTIVIDADES = {
  constancia_visita: {
    id: 'constancia_visita',
    codigo: 'CV',
    nombre: 'Constancia de Visita (CV)',
    subtitulo: 'Formulario oficial SRT de constancia de visita firmado in situ por las partes',
    icono: '📝',
    color: '#0284c7',
    permiteMultiples: true
  },
  informe_tecnico: {
    id: 'informe_tecnico',
    codigo: 'INFORME',
    nombre: 'Informe Técnico',
    subtitulo: 'Informe técnico pericial de relevamiento, desvíos y mejoras recomendadas',
    icono: '📄',
    color: '#0f766e',
    permiteMultiples: true
  },
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
  moduloActivo: 'ficha', // 'ficha' | 'matriz' | 'repositorio'
  establecimientos: {},
  establecimientoSeleccionado: null,
  actividadesRegistradas: {}, // estId -> array de actividades
  carpetasMensuales: {}, // key -> { key: "2026-10", label: "2026-10 (Octubre)", url: "...", id: "..." }
  parentMensualUrl: '',
  
  // Filtros Vista 1 (Ficha)
  filtroTexto: '',
  filtroOrganismo: '',
  filtroLocalidad: '',
  
  // Filtros Vista 2 (Matriz)
  matrizAnio: '2026',
  matrizFiltroOrg: '',
  matrizFiltroLoc: '',
  matrizFiltroTexto: '',

  // Filtros Vista 3 (Repositorio)
  repoFiltroOrg: '',
  repoFiltroAct: '',
  repoFiltroMes: '',
  repoFiltroTexto: '',

  customActivities: [],
  estaSincronizando: false
};

const MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parsearAnioMesCliente(fecha) {
  const now = new Date();
  let anio = now.getFullYear();
  let mes = now.getMonth() + 1;
  if (fecha) {
    const s = String(fecha).trim();
    if (s.includes('-')) {
      const p = s.split('-');
      if (p.length >= 2) {
        const y = parseInt(p[0], 10);
        const m = parseInt(p[1], 10);
        if (!isNaN(y) && y > 2000 && !isNaN(m) && m >= 1 && m <= 12) {
          anio = y; mes = m;
        }
      }
    } else if (s.includes('/')) {
      const p2 = s.split('/');
      if (p2.length >= 3) {
        const y2 = parseInt(p2[2], 10);
        const m2 = parseInt(p2[1], 10);
        if (!isNaN(y2) && y2 > 2000 && !isNaN(m2) && m2 >= 1 && m2 <= 12) {
          anio = y2; mes = m2;
        }
      }
    }
  }
  const mesStr = (mes < 10 ? '0' : '') + mes;
  const mesNombre = MESES_NOMBRES[mes - 1] || 'Mes';
  return {
    key: `${anio}-${mesStr}`,
    label: `${anio}-${mesStr} (${mesNombre})`,
    anio: anio,
    mes: mes
  };
}

function guardarCarpetasMensualesLocal() {
  try {
    localStorage.setItem(STORAGE_KEYS.CARPETAS_MENSUALES, JSON.stringify(AppState.carpetasMensuales));
    if (AppState.parentMensualUrl) {
      localStorage.setItem(STORAGE_KEYS.PARENT_MENSUAL_URL, AppState.parentMensualUrl);
    }
  } catch(e) {}
}

function cargarCarpetasMensualesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CARPETAS_MENSUALES);
    if (raw) AppState.carpetasMensuales = JSON.parse(raw);
    const pUrl = localStorage.getItem(STORAGE_KEYS.PARENT_MENSUAL_URL);
    if (pUrl) AppState.parentMensualUrl = pUrl;
  } catch(e) {}
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  cargarCarpetasMensualesLocal();
  cargarEstablecimientos();
  cargarLegajoLocal();
  renderFiltrosOrganismos();
  renderFiltrosLocalidades();
  renderListaEstablecimientos();

  // Restaurar módulo activo si fue guardado
  const savedModulo = localStorage.getItem(STORAGE_KEYS.MODULO_ACTIVO);
  if (savedModulo && ['ficha', 'matriz', 'repositorio'].includes(savedModulo)) {
    cambiarModulo(savedModulo, false);
  } else {
    cambiarModulo('ficha', false);
  }

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
  consultarCarpetasMensualesDrive();
});

function initStorage() {
  const current = (localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || '').trim();
  if (!current || !current.startsWith('https://script.google.com/macros/s/') || !current.includes('/exec')) {
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, DEFAULT_SHEETS_WEBHOOK_URL);
  }
}

function getWebhookUrl() {
  const custom = (localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || '').trim();
  if (custom && custom.startsWith('https://script.google.com/macros/s/') && custom.includes('/exec')) {
    return custom;
  }
  // Si en localStorage había un Script ID o una URL incompleta, restablecer a la oficial
  try {
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, DEFAULT_SHEETS_WEBHOOK_URL);
  } catch(e) {}
  return DEFAULT_SHEETS_WEBHOOK_URL;
}

// ==================== CONTROLADOR DE MÓDULOS (TABS) ====================
function cambiarModulo(moduloId, guardar = true) {
  AppState.moduloActivo = moduloId;
  if (guardar) localStorage.setItem(STORAGE_KEYS.MODULO_ACTIVO, moduloId);

  // Ocultar todas las vistas
  document.querySelectorAll('.modulo-vista').forEach(el => el.classList.add('hidden'));

  // Desactivar botones de tab
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active', 'border-b-2', 'border-amber-400', 'text-amber-300', 'bg-white/10');
    btn.classList.add('text-white/80');
  });

  // Activar vista y tab correspondiente
  const targetView = document.getElementById(`vista-${moduloId}`);
  const targetTab = document.getElementById(`tab-btn-${moduloId}`);

  if (targetView) targetView.classList.remove('hidden');
  if (targetTab) {
    targetTab.classList.add('active', 'border-b-2', 'border-amber-400', 'text-amber-300', 'bg-white/10');
    targetTab.classList.remove('text-white/80');
  }

  // Renderizar contenido según la vista
  if (moduloId === 'matriz') {
    renderFiltrosMatriz();
    renderMatrizAnual();
  } else if (moduloId === 'repositorio') {
    renderFiltrosRepositorio();
    renderRepositorioGlobal();
  } else if (moduloId === 'ficha') {
    if (AppState.establecimientoSeleccionado) {
      renderFichaEstablecimiento(AppState.establecimientoSeleccionado);
      renderPanelActividades(AppState.establecimientoSeleccionado);
    }
  }
}

// Cargar catálogo de 452 establecimientos desde datos_precargados.js
function cargarEstablecimientos() {
  let list = {};
  
  if (typeof PRELOADED_ESTABLECIMIENTOS !== 'undefined') {
    Object.keys(PRELOADED_ESTABLECIMIENTOS).forEach(key => {
      list[key] = { ...PRELOADED_ESTABLECIMIENTOS[key] };
    });
  }

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

// Extraer año de una cadena de fecha YYYY-MM-DD o DD/MM/YYYY
function extraerAnioDeFecha(fechaStr) {
  if (!fechaStr) return '';
  const s = String(fechaStr).trim();
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts[0].length === 4) return parts[0];
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3 && parts[2].length === 4) return parts[2];
  }
  const match = s.match(/(20\d\d)/);
  return match ? match[1] : '';
}

function normalizarTipoActividad(str) {
  if (!str) return 'confeccion_rgrl';
  const s = String(str).toLowerCase().trim();

  // RGRL
  if (s === 'rgrl' || s === 'confeccion_rgrl' || s.includes('rgrl') || s.includes('relevamiento general')) {
    return 'confeccion_rgrl';
  }
  // RAR
  if (s === 'rar' || s === 'confeccion_rar' || s.includes('rar') || s.includes('agentes de riesgo')) {
    return 'confeccion_rar';
  }
  // Constancia de Visita
  if (s === 'cv' || s === 'constancia_visita' || s.includes('constancia') || s.includes('visita')) {
    return 'constancia_visita';
  }
  // Informe Técnico
  if (s === 'informe' || s === 'informe_tecnico' || s.includes('informe')) {
    return 'informe_tecnico';
  }
  // Muestra de Agua (Toma)
  if (s === 'muestra_agua' || s === 'agua_toma' || s === 'toma_muestra' || (s.includes('agua') && (s.includes('toma') || s.includes('muestra')))) {
    return 'muestra_agua';
  }
  // Análisis de Agua (Protocolo)
  if (s === 'analisis_agua' || s === 'agua_protocolo' || s === 'agua_lab' || s === 'protocolo_lab' || (s.includes('agua') && (s.includes('protocolo') || s.includes('analisis') || s.includes('laboratorio')))) {
    return 'analisis_agua';
  }
  // PAT
  if (s === 'medicion_pat' || s === 'pat' || s.includes('puesta a tierra') || s.includes('pat')) {
    return 'medicion_pat';
  }
  // Ruido
  if (s === 'medicion_ruido' || s === 'ruido' || s.includes('ruido')) {
    return 'medicion_ruido';
  }
  // Iluminación
  if (s === 'medicion_iluminacion' || s === 'ilum' || s.includes('iluminaci')) {
    return 'medicion_iluminacion';
  }
  // Ergonomía
  if (s === 'res_886' || s === 'ergonomia' || s.includes('886') || s.includes('ergonom')) {
    return 'res_886';
  }
  // Capacitaciones
  if (s === 'capacitaciones' || s === 'capacitacion' || s.includes('capacita')) {
    return 'capacitaciones';
  }

  // Coincidencia con clave directa o catálogo
  if (CATALOGO_ACTIVIDADES[s]) return s;
  for (const [key, val] of Object.entries(CATALOGO_ACTIVIDADES)) {
    if (s.includes(key) || s.includes(val.codigo.toLowerCase()) || s.includes(val.nombre.toLowerCase())) {
      return key;
    }
  }

  return s;
}

function obtenerEstablecimientoDesdeChecklistDB(id, nroEstab) {
  try {
    if (!window._cachedEstablecimientosDB) {
      const raw = localStorage.getItem('hys_establecimientos_db');
      window._cachedEstablecimientosDB = raw ? JSON.parse(raw) : {};
    }
    const db = window._cachedEstablecimientosDB;
    if (id && db[id]) return db[id];
    if (nroEstab) {
      const cleanNro = String(nroEstab).trim();
      for (const key of Object.keys(db)) {
        if (db[key] && String(db[key].nroEstab).trim() === cleanNro) return db[key];
      }
    }
  } catch(e) {}
  return null;
}

// ==================== VISTA 1: FICHA & CARGA POR SEDE ====================

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

  renderListaEstablecimientos();
  renderFichaEstablecimiento(est);
  renderPanelActividades(est);
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
        <button onclick="abrirModalCarpetasMensuales()" class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition" title="Ver carpetas mensuales en Drive">
          <i class="fa-solid fa-folder-open text-amber-700"></i>
          <span>Carpetas Mensuales</span>
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

  Object.values(CATALOGO_ACTIVIDADES).forEach(cat => {
    const card = crearTarjetaActividad(cat, est, actsEst);
    grid.appendChild(card);
  });

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
  const registros = actsEst.filter(a => {
    const actNorm = normalizarTipoActividad(a.tipoActividad);
    return actNorm === cat.id || a.tipoActividad === cat.id;
  });
  const tieneRegistros = registros.length > 0;
  const ultimoRegistro = tieneRegistros ? registros[registros.length - 1] : null;
  const tieneArchivo = Boolean(ultimoRegistro && (ultimoRegistro.fileUrl || ultimoRegistro.fileName));
  const fileUrlFinal = ultimoRegistro ? (ultimoRegistro.fileUrl || ultimoRegistro.monthFolderUrl || '') : '';

  let estadoTexto = 'Pendiente';
  let estadoClase = 'badge-pendiente';

  if (tieneRegistros) {
    if (cat.id === 'muestra_agua') {
      const tieneAnalisis = actsEst.some(a => normalizarTipoActividad(a.tipoActividad) === 'analisis_agua');
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
  } else if (cat.id === 'confeccion_rgrl') {
    // Si no tiene registros en actividades, verificar si está realizado en el checklist
    let rgrlHecho = (est.rgrl === 'Realizado' || est.rgrlRealizado || est.rgrl_completado);
    if (!rgrlHecho && est.data && (est.data.checklist || est.data.preguntas)) rgrlHecho = true;
    if (!rgrlHecho) {
      const estDb = obtenerEstablecimientoDesdeChecklistDB(est.id, est.nroEstab);
      if (estDb && (estDb.rgrl === 'Realizado' || estDb.data || estDb.fecha)) rgrlHecho = true;
    }
    if (rgrlHecho) {
      estadoTexto = 'Completado (Checklist)';
      estadoClase = 'badge-completo';
    }
  }

  const card = document.createElement('div');
  card.className = 'activity-card bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition flex flex-col justify-between';

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

          ${tieneArchivo ? `
            <div class="mt-2 pt-2 border-t border-slate-200/70">
              <div class="flex items-center justify-between gap-2 p-1.5 px-2 bg-white rounded-lg border border-slate-200 hover:border-emerald-400 transition shadow-2xs">
                <div class="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                  <i class="fa-solid fa-file-pdf text-red-600 text-sm shrink-0"></i>
                  <div class="overflow-hidden min-w-0">
                    <div class="text-[11px] font-mono font-bold text-slate-800 truncate" title="${escapeHtml(ultimoRegistro.fileName || 'Documento adjunto')}">
                      ${escapeHtml(ultimoRegistro.fileName || 'Documento adjunto')}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  ${fileUrlFinal ? `
                    <a href="${fileUrlFinal}" target="_blank" onclick="event.stopPropagation()" class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 transition shadow-2xs" title="Abrir y ver documento en Google Drive">
                      <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                      <span>Abrir</span>
                    </a>
                  ` : `
                    <button onclick="event.stopPropagation(); abrirModalSubirArchivoParaRegistro('${ultimoRegistro.id}', '${est.id}', '${cat.id}')" class="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 transition shadow-2xs" title="Subir archivo a Google Drive">
                      <i class="fa-solid fa-cloud-arrow-up text-[9px]"></i>
                      <span>Subir a Drive</span>
                    </button>
                    <button onclick="event.stopPropagation(); abrirModalDocumentosActividad('${cat.id}')" class="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] flex items-center gap-1 shrink-0 transition" title="Ver detalles del documento">
                      <i class="fa-solid fa-circle-info text-[9px]"></i>
                      <span>Ver</span>
                    </button>
                  `}
                  <button onclick="event.stopPropagation(); eliminarDocumentoActividad('${ultimoRegistro.id}', '${est.id}')" class="p-1 px-1.5 rounded bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 text-[10px] transition shrink-0" title="Eliminar documento y limpiar registro">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            </div>
          ` : ''}

          ${cat.permiteMultiples && registros.length > 1 ? `
            <div class="flex items-center justify-between text-[11px] font-semibold text-purple-700 pt-1 border-t border-slate-200/50 mt-1">
              <span><i class="fa-solid fa-layer-group mr-1"></i>${registros.length} registros cargados</span>
              <button onclick="event.stopPropagation(); abrirModalDocumentosActividad('${cat.id}')" class="text-[11px] text-purple-800 hover:text-purple-950 font-bold underline">
                Ver todos (${registros.length})
              </button>
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
      ${tieneArchivo ? `
        ${registros.length > 1 ? `
          <button onclick="abrirModalDocumentosActividad('${cat.id}')" class="btn-action flex-1 text-center py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs" title="Ver los ${registros.length} documentos subidos">
            <i class="fa-solid fa-folder-open text-white"></i>
            <span>Ver Documentos (${registros.length})</span>
          </button>
        ` : `
          ${fileUrlFinal ? `
            <a href="${fileUrlFinal}" target="_blank" class="btn-action flex-1 text-center py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs" title="Ver documento subido en Google Drive">
              <i class="fa-solid fa-eye text-white"></i>
              <span>Ver Documento</span>
            </a>
          ` : `
            <button onclick="abrirModalDocumentosActividad('${cat.id}')" class="btn-action flex-1 text-center py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs" title="Ver detalles del documento">
              <i class="fa-solid fa-eye text-white"></i>
              <span>Ver Documento</span>
            </button>
          `}
          <button onclick="eliminarDocumentoActividad('${ultimoRegistro.id}', '${est.id}')" class="btn-action px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded font-semibold text-xs transition flex items-center gap-1 shrink-0" title="Eliminar documento y limpiar registro">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        `}
        <button onclick="abrirModalRegistrarActividad('${cat.id}')" class="btn-action px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-semibold text-xs transition flex items-center gap-1" title="${cat.permiteMultiples ? 'Subir otro documento para esta actividad' : 'Reemplazar o volver a subir documento'}">
          <i class="fa-solid ${cat.permiteMultiples ? 'fa-plus' : 'fa-cloud-arrow-up'}"></i>
          <span>${cat.permiteMultiples ? 'Nuevo' : 'Subir'}</span>
        </button>
      ` : `
        <button onclick="abrirModalRegistrarActividad('${cat.id}')" class="btn-action flex-1 text-center py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-xs">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span>Registrar / Subir</span>
        </button>
      `}

      ${cat.esChecklist ? `
        <button onclick="abrirChecklistRGRL('${est.id}')" class="btn-action px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition" title="Ir al Checklist interactivo RGRL">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </button>
      ` : ''}
    </div>
  `;

  return card;
}

function abrirModalDocumentosActividad(catId) {
  const est = AppState.establecimientoSeleccionado;
  if (!est) return;

  const cat = CATALOGO_ACTIVIDADES[catId] || {
    id: catId,
    nombre: catId,
    icono: '📄',
    codigo: 'DOC'
  };

  const modal = document.getElementById('modal-historial-actividad');
  if (!modal) return;

  const acts = (AppState.actividadesRegistradas[est.id] || []).filter(a => a.tipoActividad === catId);

  document.getElementById('modal-hist-icono').innerHTML = cat.icono || '📄';
  document.getElementById('modal-hist-titulo').textContent = `Documentos: ${cat.nombre}`;
  document.getElementById('modal-hist-subtitulo').textContent = `${est.nombreEstablecimiento} (N° ${est.nroEstab || 'S/N'})`;
  document.getElementById('modal-hist-contador').textContent = `${acts.length} documento(s) registrado(s)`;

  const btnNuevo = document.getElementById('modal-hist-btn-nuevo');
  if (btnNuevo) {
    btnNuevo.onclick = () => {
      cerrarModal('modal-historial-actividad');
      abrirModalRegistrarActividad(catId);
    };
  }

  const container = document.getElementById('modal-hist-lista');
  if (!container) return;
  container.innerHTML = '';

  if (acts.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
        No hay documentos subidos para esta actividad en este establecimiento.
      </div>
    `;
  } else {
    // Mostrar del más reciente al más antiguo
    const reversed = [...acts].reverse();
    reversed.forEach((act) => {
      const fAct = act.fechaActividad || 'S/F';
      const mInfo = parsearAnioMesCliente(fAct);
      const mFUrl = act.monthFolderUrl || (AppState.carpetasMensuales[mInfo.key] ? AppState.carpetasMensuales[mInfo.key].url : '');
      const fileUrl = act.fileUrl || mFUrl || '';

      const card = document.createElement('div');
      card.className = 'bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3';
      card.innerHTML = `
        <div class="space-y-1 flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="badge-completo text-[10px] font-bold px-2 py-0.5 rounded-full">
              ${escapeHtml(act.estadoActividad || 'Completado')}
            </span>
            <span class="text-xs font-semibold text-slate-900">
              <i class="fa-regular fa-calendar text-slate-400 mr-1"></i>${fAct}
            </span>
            ${act.preventor ? `<span class="text-[11px] text-slate-500 truncate"><i class="fa-solid fa-user-shield text-[10px] text-slate-400 mr-1"></i>${escapeHtml(act.preventor)}</span>` : ''}
          </div>

          ${act.detalle ? `
            <div class="text-xs text-slate-700 font-medium">
              <span class="text-slate-400">Detalle:</span> ${escapeHtml(act.detalle)}
            </div>
          ` : ''}

          <div class="flex items-center gap-1.5 text-xs font-mono font-bold text-blue-900 truncate">
            <i class="fa-solid fa-file-pdf text-red-600 text-sm shrink-0"></i>
            <span class="truncate" title="${escapeHtml(act.fileName || 'Documento')}">${escapeHtml(act.fileName || 'Documento sin nombre')}</span>
          </div>

          ${act.observaciones ? `
            <div class="text-[11px] text-slate-500 italic truncate" title="${escapeHtml(act.observaciones)}">
              ${escapeHtml(act.observaciones)}
            </div>
          ` : ''}
        </div>

        <div class="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          ${fileUrl ? `
            <a href="${fileUrl}" target="_blank" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>Ver en Drive</span>
            </a>
          ` : `
            <span class="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded text-[11px] font-semibold">
              <i class="fa-solid fa-clock mr-1"></i>Guardado Local
            </span>
          `}
          ${mFUrl ? `
            <a href="${mFUrl}" target="_blank" class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-xs flex items-center gap-1.5 transition" title="Abrir carpeta mensual de Drive">
              <i class="fa-solid fa-folder-open text-amber-700"></i>
              <span>Mes</span>
            </a>
          ` : ''}
          <button onclick="eliminarDocumentoActividad('${act.id}', '${est.id}')" class="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 font-bold text-xs flex items-center gap-1.5 transition" title="Eliminar este documento y registro">
            <i class="fa-solid fa-trash-can"></i>
            <span>Eliminar</span>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  modal.classList.remove('hidden');
}

/**
 * Elimina un documento y limpia su registro del establecimiento y vistas.
 * Envía notificación al backend Google Apps Script para enviarlo a la papelera en Drive
 * y borrar la fila de la hoja de cálculo 'Legajo_Actividades_Archivos'.
 */
async function eliminarDocumentoActividad(regId, estId) {
  if (!regId) return;

  const confirmacion = confirm('¿Estás seguro de que deseas eliminar este documento y limpiar su registro?\n\nEsta acción removerá el registro del establecimiento y enviará el archivo a la papelera de Drive.');
  if (!confirmacion) return;

  // 1. Localizar el registro y establecimiento correspondiente
  let targetEstId = estId;
  let targetItem = null;

  if (targetEstId && AppState.actividadesRegistradas[targetEstId]) {
    targetItem = AppState.actividadesRegistradas[targetEstId].find(a => 
      a.id === regId || (a.fileId && a.fileId === regId) || (a.fileName && a.fileName === regId)
    );
  }

  if (!targetItem) {
    for (const [eId, acts] of Object.entries(AppState.actividadesRegistradas)) {
      const found = acts.find(a => 
        a.id === regId || (a.fileId && a.fileId === regId) || (a.fileName && a.fileName === regId)
      );
      if (found) {
        targetItem = found;
        targetEstId = eId;
        break;
      }
    }
  }

  if (!targetItem) {
    mostrarToast('⚠️ No se encontró el registro para eliminar.');
    return;
  }

  // 2. Limpiar el registro del estado local y persistir
  AppState.actividadesRegistradas[targetEstId] = (AppState.actividadesRegistradas[targetEstId] || []).filter(a => a !== targetItem);
  guardarLegajoLocal();

  // 3. Actualizar vistas locales de inmediato
  const estActual = AppState.establecimientoSeleccionado;
  if (estActual && estActual.id === targetEstId) {
    renderPanelActividades(estActual);
    actualizarIndicadorLegajo(targetEstId);
    actualizarProgresoGeneral();
  } else if (AppState.establecimientos[targetEstId]) {
    actualizarIndicadorLegajo(targetEstId);
    actualizarProgresoGeneral();
  }

  // Si el modal de historial de actividades está abierto para esta actividad, actualizarlo
  const modalHist = document.getElementById('modal-historial-actividad');
  if (modalHist && !modalHist.classList.contains('hidden')) {
    if (estActual && estActual.id === targetEstId) {
      abrirModalDocumentosActividad(targetItem.tipoActividad);
    } else {
      cerrarModal('modal-historial-actividad');
    }
  }

  renderRepositorioGlobal(false);
  renderMatrizAnual();
  renderDashboard();

  mostrarToast(`🗑️ Documento "${targetItem.fileName || 'adjunto'}" y registro eliminados.`);

  // 4. Sincronizar eliminación en Google Apps Script (Drive papelera + Sheet fila)
  const webhookUrl = getWebhookUrl();
  if (webhookUrl && !webhookUrl.includes('TU_WEBHOOK_URL_AQUI')) {
    const estObj = AppState.establecimientos[targetEstId] || {};
    try {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          tipoOperacion: 'eliminar_actividad_documento',
          registroId: targetItem.id || regId,
          fileId: targetItem.fileId || '',
          fileName: targetItem.fileName || '',
          establecimiento: estObj.nombreEstablecimiento || '',
          nroEstab: estObj.nroEstab || '',
          tipoActividad: targetItem.tipoActividad || ''
        })
      }).then(r => r.json()).then(res => {
        if (res && res.status === 'success') {
          console.log('✅ Eliminación sincronizada en Google Sheets y Drive:', res);
        }
      }).catch(err => {
        console.warn('Aviso sincronización remota eliminación:', err);
      });
    } catch (errPost) {
      console.warn('Error al solicitar eliminación remota:', errPost);
    }
  }
}
window.eliminarDocumentoActividad = eliminarDocumentoActividad;

// ==================== VISTA 2: MATRIZ DE CUMPLIMIENTO ANUAL ====================

function renderFiltrosMatriz() {
  const selectOrg = document.getElementById('matriz-filtro-org');
  const selectLoc = document.getElementById('matriz-filtro-loc');

  if (selectOrg && selectOrg.children.length <= 1) {
    const orgs = new Set();
    Object.values(AppState.establecimientos).forEach(e => {
      if (e.organismo) orgs.add(e.organismo);
    });
    Array.from(orgs).sort().forEach(org => {
      const opt = document.createElement('option');
      opt.value = org;
      opt.textContent = org;
      selectOrg.appendChild(opt);
    });
  }

  if (selectLoc && selectLoc.children.length <= 1) {
    const locs = new Set();
    Object.values(AppState.establecimientos).forEach(e => {
      if (e.localidad && e.localidad !== 'Entre Ríos') locs.add(e.localidad);
    });
    Array.from(locs).sort().forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc;
      selectLoc.appendChild(opt);
    });
  }
}

function renderMatrizAnual() {
  const tbody = document.getElementById('matriz-tabla-body');
  const counterSpan = document.getElementById('matriz-contador');
  if (!tbody) return;

  const anio = AppState.matrizAnio;
  const orgFiltro = AppState.matrizFiltroOrg;
  const locFiltro = AppState.matrizFiltroLoc;
  const textFiltro = AppState.matrizFiltroTexto.toLowerCase().trim();

  // Filtrar establecimientos
  const establecimientosFiltrados = Object.values(AppState.establecimientos).filter(e => {
    if (orgFiltro && e.organismo !== orgFiltro) return false;
    if (locFiltro && e.localidad !== locFiltro) return false;
    if (textFiltro) {
      const match = (e.organismo && e.organismo.toLowerCase().includes(textFiltro)) ||
                    (e.nombreEstablecimiento && e.nombreEstablecimiento.toLowerCase().includes(textFiltro)) ||
                    (e.domicilio && e.domicilio.toLowerCase().includes(textFiltro)) ||
                    (e.localidad && e.localidad.toLowerCase().includes(textFiltro)) ||
                    (e.nroEstab && e.nroEstab.toString().includes(textFiltro));
      if (!match) return false;
    }
    return true;
  });

  if (counterSpan) {
    counterSpan.textContent = `Mostrando ${establecimientosFiltrados.length} de ${Object.keys(AppState.establecimientos).length} sedes (${anio === 'todos' ? 'Histórico Completo' : 'Año ' + anio})`;
  }

  // Métricas del resumen en cabecera
  let totalActividadesPeriodo = 0;
  let sedesConAlMenosUnaActividad = 0;
  const conteoPorColumna = {};
  Object.keys(CATALOGO_ACTIVIDADES).forEach(k => conteoPorColumna[k] = 0);

  tbody.innerHTML = '';

  if (establecimientosFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="19" class="text-center py-8 text-slate-400 text-xs">
          No se encontraron sedes que coincidan con los filtros aplicados.
        </td>
      </tr>
    `;
    actualizarKPIsMatriz(0, 0, 0);
    return;
  }

  establecimientosFiltrados.forEach(e => {
    const acts = AppState.actividadesRegistradas[e.id] || [];
    
    // Filtrar actividades correspondientes al año seleccionado
    const actsPeriodo = acts.filter(a => {
      if (anio === 'todos') return true;
      const anioAct = extraerAnioDeFecha(a.fechaActividad);
      return anioAct === anio;
    });

    // Conteo por cada actividad técnica
    const conteoSede = {};
    Object.keys(CATALOGO_ACTIVIDADES).forEach(k => conteoSede[k] = 0);

    actsPeriodo.forEach(a => {
      const actNorm = normalizarTipoActividad(a.tipoActividad);
      if (conteoSede[actNorm] !== undefined) {
        conteoSede[actNorm]++;
      } else if (conteoSede[a.tipoActividad] !== undefined) {
        conteoSede[a.tipoActividad]++;
      }
    });

    // Verificación RGRL: Si no tiene actividad registrada explícita, verificar en datos de Checklist
    if (conteoSede['confeccion_rgrl'] === 0) {
      let rgrlHecho = false;
      let rgrlFecha = '';

      if (e.rgrl === 'Realizado' || e.rgrlRealizado || e.rgrl_completado) {
        rgrlHecho = true;
        rgrlFecha = e.fecha || e.fechaRgrl || '';
      } else if (e.data && (e.data.checklist || e.data.preguntas || (e.data.establecimiento && e.data.establecimiento.fecha))) {
        rgrlHecho = true;
        rgrlFecha = (e.data.establecimiento && e.data.establecimiento.fecha) || e.fecha || '';
      } else {
        const estDb = obtenerEstablecimientoDesdeChecklistDB(e.id, e.nroEstab);
        if (estDb && (estDb.rgrl === 'Realizado' || estDb.data || estDb.fecha)) {
          rgrlHecho = true;
          rgrlFecha = estDb.fecha || (estDb.data && estDb.data.establecimiento && estDb.data.establecimiento.fecha) || '';
        }
      }

      if (rgrlHecho) {
        const anioRgrl = extraerAnioDeFecha(rgrlFecha);
        if (anio === 'todos' || !anioRgrl || anioRgrl === anio) {
          conteoSede['confeccion_rgrl'] = 1;
        }
      }
    }

    // Calcular total de actividades de la sede en el período y sumar a columnas
    let totalSedePeriodo = 0;
    Object.keys(CATALOGO_ACTIVIDADES).forEach(k => {
      const cant = conteoSede[k] || 0;
      totalSedePeriodo += cant;
      conteoPorColumna[k] += cant;
    });

    if (totalSedePeriodo > 0) sedesConAlMenosUnaActividad++;
    totalActividadesPeriodo += totalSedePeriodo;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-blue-50/40 border-b border-slate-100 text-xs transition cursor-pointer';
    tr.onclick = (event) => {
      // Si hizo clic en un botón no cambiamos, sino vamos a la ficha de la sede
      if (event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A') {
        irAFichaEstablecimiento(e.id);
      }
    };

    let cellsHtml = `
      <td class="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap bg-white sticky left-0 z-10 border-r border-slate-200">
        ${e.nroEstab ? `#${e.nroEstab}` : '-'}
      </td>
      <td class="py-2.5 px-3 font-semibold text-slate-900 max-w-[200px] truncate" title="${escapeHtml(e.nombreEstablecimiento)}">
        ${escapeHtml(e.nombreEstablecimiento)}
      </td>
      <td class="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title="${escapeHtml(e.organismo)}">
        ${escapeHtml(e.organismo)}
      </td>
      <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap">
        ${escapeHtml(e.localidad)}
      </td>
    `;

    // Columnas de actividades con badge numérico
    Object.keys(CATALOGO_ACTIVIDADES).forEach(k => {
      const count = conteoSede[k] || 0;
      let badgeHtml = '';

      if (count === 0) {
        badgeHtml = `<span class="text-slate-300 font-mono text-[11px]">0</span>`;
      } else if (count === 1) {
        badgeHtml = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs shadow-xs">1</span>`;
      } else {
        badgeHtml = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-900 font-extrabold text-xs shadow-xs">${count}</span>`;
      }

      cellsHtml += `<td class="py-2.5 px-2 text-center whitespace-nowrap">${badgeHtml}</td>`;
    });

    // Columna Total
    cellsHtml += `
      <td class="py-2.5 px-3 text-center font-bold whitespace-nowrap ${totalSedePeriodo > 0 ? 'text-blue-900 bg-blue-50/50' : 'text-slate-300'}">
        ${totalSedePeriodo}
      </td>
      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <button onclick="irAFichaEstablecimiento('${e.id}')" class="text-xs text-blue-700 hover:text-blue-900 font-semibold p-1 hover:bg-blue-100 rounded" title="Abrir Ficha de la sede">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </td>
    `;

    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });

  const totalSedes = establecimientosFiltrados.length;
  actualizarKPIsMatriz(totalActividadesPeriodo, sedesConAlMenosUnaActividad, totalSedes);
}

function actualizarKPIsMatriz(totalActs, sedesConAct, totalSedes) {
  const kpiActs = document.getElementById('matriz-kpi-total-acts');
  const kpiSedes = document.getElementById('matriz-kpi-sedes-cobertura');
  const kpiPct = document.getElementById('matriz-kpi-pct-cobertura');

  const pct = totalSedes > 0 ? Math.round((sedesConAct / totalSedes) * 100) : 0;

  if (kpiActs) kpiActs.textContent = totalActs;
  if (kpiSedes) kpiSedes.textContent = `${sedesConAct} de ${totalSedes}`;
  if (kpiPct) kpiPct.textContent = `${pct}%`;
}

function irAFichaEstablecimiento(estId) {
  cambiarModulo('ficha');
  seleccionarEstablecimiento(estId);
}

// Exportación a Excel / CSV con BOM
function exportarMatrizCSV() {
  const anio = AppState.matrizAnio;
  const establecimientos = Object.values(AppState.establecimientos);

  const activityHeaders = Object.values(CATALOGO_ACTIVIDADES).map(cat => cat.nombre);
  const headers = [
    'N° Estab',
    'Organismo',
    'Nombre Establecimiento',
    'Localidad',
    ...activityHeaders,
    'Total Realizado'
  ];

  let csvContent = '\uFEFF'; // BOM para que Excel abra UTF-8 con tildes correctamente
  csvContent += headers.map(h => `"${h}"`).join(';') + '\r\n';

  establecimientos.forEach(e => {
    const acts = AppState.actividadesRegistradas[e.id] || [];
    const actsPeriodo = acts.filter(a => {
      if (anio === 'todos') return true;
      return extraerAnioDeFecha(a.fechaActividad) === anio;
    });

    const conteoSede = {};
    Object.keys(CATALOGO_ACTIVIDADES).forEach(k => conteoSede[k] = 0);
    actsPeriodo.forEach(a => {
      if (conteoSede[a.tipoActividad] !== undefined) conteoSede[a.tipoActividad]++;
    });

    const row = [
      e.nroEstab || '',
      e.organismo || '',
      e.nombreEstablecimiento || '',
      e.localidad || '',
      ...Object.keys(CATALOGO_ACTIVIDADES).map(k => conteoSede[k] || 0),
      actsPeriodo.length
    ];

    csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Matriz_Cumplimiento_HyS_${anio}_IAPSER.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  mostrarToast(`Matriz ${anio} exportada a CSV para Excel.`);
}

// ==================== VISTA 3: REPOSITORIO GLOBAL DE DOCUMENTOS ====================

function renderFiltrosRepositorio() {
  const selectOrg = document.getElementById('repo-filtro-org');
  const selectAct = document.getElementById('repo-filtro-act');

  if (selectOrg && selectOrg.children.length <= 1) {
    const orgs = new Set();
    Object.values(AppState.establecimientos).forEach(e => {
      if (e.organismo) orgs.add(e.organismo);
    });
    Array.from(orgs).sort().forEach(org => {
      const opt = document.createElement('option');
      opt.value = org;
      opt.textContent = org;
      selectOrg.appendChild(opt);
    });
  }

  if (selectAct && selectAct.children.length <= 1) {
    Object.values(CATALOGO_ACTIVIDADES).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icono} ${cat.nombre}`;
      selectAct.appendChild(opt);
    });
  }
}

function renderRepositorioGlobal(rebuildMonthFilter = true) {
  const tbody = document.getElementById('repo-tabla-body');
  const counterSpan = document.getElementById('repo-contador');
  if (!tbody) return;

  const orgFiltro = AppState.repoFiltroOrg;
  const actFiltro = AppState.repoFiltroAct;
  const mesFiltro = AppState.repoFiltroMes;
  const textFiltro = AppState.repoFiltroTexto.toLowerCase().trim();

  // Aplanar todos los registros de todos los establecimientos
  let todosLosRegistros = [];
  Object.keys(AppState.actividadesRegistradas).forEach(estId => {
    const est = AppState.establecimientos[estId];
    if (!est) return;
    const acts = AppState.actividadesRegistradas[estId] || [];
    acts.forEach(a => {
      const mInfo = parsearAnioMesCliente(a.fechaActividad);
      todosLosRegistros.push({
        ...a,
        estId: estId,
        organismo: est.organismo,
        nombreEstablecimiento: est.nombreEstablecimiento,
        nroEstab: est.nroEstab,
        localidad: est.localidad,
        monthKey: a.monthKey || mInfo.key,
        monthLabel: a.monthLabel || mInfo.label,
        monthFolderUrl: a.monthFolderUrl || (AppState.carpetasMensuales[mInfo.key] ? AppState.carpetasMensuales[mInfo.key].url : '')
      });
    });
  });

  // Reconstruir selector de meses si es necesario
  if (rebuildMonthFilter) {
    actualizarSelectorMesesRepositorio(todosLosRegistros);
  }

  // Actualizar etiqueta del botón de carpeta mensual
  actualizarBotonCarpetaMes();

  // Ordenar cronológicamente descendente (más recientes primero)
  todosLosRegistros.sort((a, b) => {
    const fA = a.fechaActividad || '';
    const fB = b.fechaActividad || '';
    return fB.localeCompare(fA);
  });

  // Aplicar filtros
  const filtrados = todosLosRegistros.filter(r => {
    if (orgFiltro && r.organismo !== orgFiltro) return false;
    if (actFiltro && normalizarTipoActividad(r.tipoActividad) !== normalizarTipoActividad(actFiltro)) return false;
    if (mesFiltro && r.monthKey !== mesFiltro) return false;
    if (textFiltro) {
      const match = (r.organismo && r.organismo.toLowerCase().includes(textFiltro)) ||
                    (r.nombreEstablecimiento && r.nombreEstablecimiento.toLowerCase().includes(textFiltro)) ||
                    (r.fileName && r.fileName.toLowerCase().includes(textFiltro)) ||
                    (r.detalle && r.detalle.toLowerCase().includes(textFiltro)) ||
                    (r.preventor && r.preventor.toLowerCase().includes(textFiltro)) ||
                    (r.nroEstab && r.nroEstab.toString().includes(textFiltro)) ||
                    (r.monthLabel && r.monthLabel.toLowerCase().includes(textFiltro));
      if (!match) return false;
    }
    return true;
  });

  if (counterSpan) {
    counterSpan.textContent = `Mostrando ${filtrados.length} de ${todosLosRegistros.length} documentos cargados`;
  }

  tbody.innerHTML = '';

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-10 text-slate-400 text-xs">
          <i class="fa-regular fa-folder-open text-3xl mb-2 block text-slate-300"></i>
          No se encontraron documentos o registros que coincidan con los filtros aplicados.
        </td>
      </tr>
    `;
    return;
  }

  filtrados.forEach((r, idx) => {
    const actNorm = normalizarTipoActividad(r.tipoActividad);
    const cat = CATALOGO_ACTIVIDADES[actNorm] || CATALOGO_ACTIVIDADES[r.tipoActividad] || { nombre: r.tipoActividad, icono: '📌', codigo: 'ACT' };
    const mInfo = parsearAnioMesCliente(r.fechaActividad);
    const mFolderUrl = r.monthFolderUrl || (AppState.carpetasMensuales[mInfo.key] ? AppState.carpetasMensuales[mInfo.key].url : '');

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs text-slate-700 transition';

    tr.innerHTML = `
      <td class="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
        ${r.fechaActividad || 'S/F'}
      </td>
      <td class="py-2.5 px-3">
        <div class="font-bold text-blue-900">
          ${r.nroEstab ? `<span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded mr-1">#${r.nroEstab}</span>` : ''}
          ${escapeHtml(r.nombreEstablecimiento)}
        </div>
        <div class="text-[11px] text-slate-500 truncate max-w-xs">${escapeHtml(r.organismo)} (${escapeHtml(r.localidad)})</div>
      </td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        <div class="flex items-center gap-1.5 font-medium">
          <span>${cat.icono}</span>
          <span>${escapeHtml(cat.nombre)}</span>
        </div>
      </td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        <span class="badge-completo text-[10px] px-2 py-0.5 rounded-full font-bold">
          ${escapeHtml(r.estadoActividad || 'Completado')}
        </span>
      </td>
      <td class="py-2.5 px-3 max-w-xs truncate" title="${escapeHtml(r.detalle || '')}">
        ${escapeHtml(r.detalle || '-')}
      </td>
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-700 max-w-xs truncate" title="${escapeHtml(r.fileName || '')}">
        ${r.fileName ? `<i class="fa-solid fa-file-pdf text-red-500 mr-1"></i>${escapeHtml(r.fileName)}` : '<span class="text-slate-400">Sin archivo adjunto</span>'}
      </td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        ${r.fileUrl ? `
          <a href="${r.fileUrl}" target="_blank" class="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold underline text-xs">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Archivo
          </a>
        ` : (r.fileName ? `
          <div class="inline-flex items-center gap-1.5">
            <span class="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold" title="Documento registrado localmente.">
              <i class="fa-solid fa-clock"></i> Guardado Local
            </span>
            <button onclick="abrirModalSubirArchivoParaRegistro('${r.id}', '${r.estId}', '${r.tipoActividad}')" class="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs transition" title="Subir archivo a Google Drive">
              <i class="fa-solid fa-cloud-arrow-up"></i> Subir a Drive
            </button>
          </div>
        ` : '-')}
      </td>
      <td class="py-2.5 px-3 whitespace-nowrap">
        ${mFolderUrl ? `
          <a href="${mFolderUrl}" target="_blank" class="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-1 rounded text-[10px] font-bold transition" title="Abrir Carpeta Mensual en Drive (sin subcarpetas)">
            <i class="fa-solid fa-folder-open text-amber-700"></i> ${escapeHtml(mInfo.key)}
          </a>
        ` : `
          <button onclick="abrirCarpetaMensualParaClave('${mInfo.key}')" class="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-2 py-1 rounded text-[10px] font-semibold transition" title="Ver en carpetas mensuales">
            <i class="fa-solid fa-folder text-slate-400"></i> ${escapeHtml(mInfo.key)}
          </button>
        `}
      </td>
      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <div class="inline-flex items-center gap-1.5 justify-end">
          <button onclick="irAFichaEstablecimiento('${r.estId}')" class="text-xs text-blue-700 hover:text-blue-900 font-semibold p-1.5 hover:bg-blue-50 rounded" title="Ver ficha completa">
            <i class="fa-solid fa-arrow-right mr-1"></i> Ficha
          </button>
          <button onclick="eliminarDocumentoActividad('${r.id || r.fileId || r.fileName}', '${r.estId}')" class="text-xs text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition" title="Eliminar documento y limpiar registro">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarSelectorMesesRepositorio(todosLosRegistros) {
  const selectMes = document.getElementById('repo-filtro-mes');
  if (!selectMes) return;

  const currentVal = AppState.repoFiltroMes;

  // Recopilar meses únicos
  const monthMap = {};
  todosLosRegistros.forEach(r => {
    if (r.monthKey) {
      if (!monthMap[r.monthKey]) {
        monthMap[r.monthKey] = { label: r.monthLabel || r.monthKey, count: 0 };
      }
      monthMap[r.monthKey].count++;
    }
  });

  // Agregar también meses registrados en AppState.carpetasMensuales
  Object.keys(AppState.carpetasMensuales).forEach(k => {
    if (!monthMap[k]) {
      monthMap[k] = { label: AppState.carpetasMensuales[k].label || k, count: 0 };
    }
  });

  // Si no hay meses todavía, agregar mes actual por defecto
  const mActual = parsearAnioMesCliente(new Date().toISOString().substring(0, 10));
  if (!monthMap[mActual.key]) {
    monthMap[mActual.key] = { label: mActual.label, count: 0 };
  }

  const sortedKeys = Object.keys(monthMap).sort().reverse();

  selectMes.innerHTML = `<option value="">Todos los Meses (${todosLosRegistros.length})</option>`;
  sortedKeys.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = `${monthMap[k].label} (${monthMap[k].count})`;
    if (k === currentVal) opt.selected = true;
    selectMes.appendChild(opt);
  });
}

function actualizarBotonCarpetaMes() {
  const btn = document.getElementById('btn-abrir-carpeta-mes-repo');
  const label = document.getElementById('label-abrir-carpeta-mes-repo');
  if (!btn || !label) return;

  if (AppState.repoFiltroMes) {
    const data = AppState.carpetasMensuales[AppState.repoFiltroMes];
    const lbl = data ? data.label : AppState.repoFiltroMes;
    label.textContent = `Abrir Carpeta ${lbl} en Drive`;
    btn.title = `Abrir carpeta mensual ${lbl} en Google Drive (sin subcarpetas)`;
  } else {
    label.textContent = `Carpetas Mensuales en Drive`;
    btn.title = `Ver y abrir carpetas mensuales en Google Drive`;
  }
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

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('act-fecha').value = today;
  document.getElementById('act-preventor').value = localStorage.getItem('hys_ultimo_preventor') || '';

  configurarCamposDinamicosModal(cat, est);
  resetUploaderUI();
  actualizarPreviewNombreArchivo();

  modal.classList.remove('hidden');
}

function configurarCamposDinamicosModal(cat, est) {
  const container = document.getElementById('campos-dinamicos-actividad');
  if (!container) return;

  container.innerHTML = '';

  if (cat.id === 'constancia_visita') {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Número o Tipo de Visita *</label>
          <select id="campo-cv-visita" class="input-select text-xs" onchange="actualizarPreviewNombreArchivo()" required>
            <option value="Visita 1">Visita 1 (Relevamiento Inicial)</option>
            <option value="Visita 2">Visita 2 (Seguimiento / Semestral)</option>
            <option value="Visita 3">Visita 3</option>
            <option value="Visita de Seguimiento">Visita de Seguimiento</option>
            <option value="Visita Extraordinaria">Visita Extraordinaria / Auditoría</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Representante Sede (Firmante in situ)</label>
          <input type="text" id="campo-cv-firmante" class="input-text text-xs" placeholder="Ej: Director / Encargado de Sede">
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Resultado de la Visita</label>
          <select id="campo-cv-estado" class="input-select text-xs">
            <option value="Firmada in situ">Firmada in situ (Conforme)</option>
            <option value="Firmada con Desvíos">Firmada in situ (Con Desvíos Notificados)</option>
            <option value="Completada sin firma">Completada sin firma (Remitida digital)</option>
            <option value="Sede Cerrada">Sede Cerrada / No atendida</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Motivo / Temario de la Visita</label>
          <input type="text" id="campo-cv-motivo" class="input-text text-xs" placeholder="Ej: Relevamiento anual HyS" oninput="actualizarPreviewNombreArchivo()">
        </div>
      </div>
    `;
  } else if (cat.id === 'informe_tecnico') {
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Tipo o Carácter del Informe *</label>
          <select id="campo-informe-tipo" class="input-select text-xs" onchange="actualizarPreviewNombreArchivo()" required>
            <option value="Relevamiento Inicial">Informe de Relevamiento Inicial</option>
            <option value="Seguimiento y Mejoras">Informe de Seguimiento y Mejoras</option>
            <option value="Pericial Siniestro">Informe Pericial / Siniestro</option>
            <option value="Diagnostico Condiciones">Informe Diagnóstico de Condiciones</option>
            <option value="Dictamen Tecnico">Dictamen Técnico Especial</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Instancia / Visita de Referencia</label>
          <input type="text" id="campo-informe-visita-ref" class="input-text text-xs" placeholder="Ej: Visita 1 / Solicitud ART" oninput="actualizarPreviewNombreArchivo()">
        </div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Conclusión / Dictamen del Informe</label>
          <select id="campo-informe-estado" class="input-select text-xs">
            <option value="Con Desvíos">Con Desvíos (Plan de Acción sugerido)</option>
            <option value="Sin Desvíos">Sin Desvíos (Condiciones adecuadas)</option>
            <option value="En Adecuación">En Adecuación / Seguimiento</option>
            <option value="Informe Notificado">Informe Emitido y Notificado</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Cantidad de Desvíos Detectados</label>
          <input type="number" id="campo-informe-cant-desvios" class="input-text text-xs" placeholder="Ej: 0" min="0">
        </div>
      </div>
    `;
  } else if (cat.id === 'muestra_agua' || cat.id === 'analisis_agua') {
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
      <div id="agua-campos-extra" class="space-y-3"></div>
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
  const cvVis = document.getElementById('campo-cv-visita');
  const cvMot = document.getElementById('campo-cv-motivo');
  if (cvVis && cvVis.value.trim()) {
    const mot = cvMot && cvMot.value.trim() ? '_' + cvMot.value.trim() : '';
    return sanitizeText(cvVis.value.trim() + mot);
  }

  const infTipo = document.getElementById('campo-informe-tipo');
  const infRef = document.getElementById('campo-informe-visita-ref');
  if (infTipo && infTipo.value.trim()) {
    const ref = infRef && infRef.value.trim() ? '_' + infRef.value.trim() : '';
    return sanitizeText(infTipo.value.trim() + ref);
  }

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
  const badgeFecha = document.getElementById('act-fecha-detectada-badge');
  const badgeOcr = document.getElementById('act-ocr-loading-badge');

  if (fileInput) fileInput.value = '';
  if (infoBox) infoBox.classList.add('hidden');
  if (progressBox) progressBox.classList.add('hidden');
  if (dropzone) dropzone.classList.remove('hidden');
  if (badgeFecha) badgeFecha.classList.add('hidden');
  if (badgeOcr) badgeOcr.classList.add('hidden');
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i>Guardar y Subir a Google Drive';
  }
}

function setupEventListeners() {
  // Filtros Vista 1 (Ficha)
  const searchInput = document.getElementById('buscar-establecimiento');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.filtroTexto = e.target.value;
      renderListaEstablecimientos();
    });
  }

  const orgSelect = document.getElementById('filtro-organismo');
  if (orgSelect) {
    orgSelect.addEventListener('change', (e) => {
      AppState.filtroOrganismo = e.target.value;
      renderListaEstablecimientos();
    });
  }

  const locSelect = document.getElementById('filtro-localidad');
  if (locSelect) {
    locSelect.addEventListener('change', (e) => {
      AppState.filtroLocalidad = e.target.value;
      renderListaEstablecimientos();
    });
  }

  // Filtros Vista 2 (Matriz)
  const anioSelect = document.getElementById('matriz-filtro-anio');
  if (anioSelect) {
    anioSelect.addEventListener('change', (e) => {
      AppState.matrizAnio = e.target.value;
      renderMatrizAnual();
    });
  }

  const matrizOrgSelect = document.getElementById('matriz-filtro-org');
  if (matrizOrgSelect) {
    matrizOrgSelect.addEventListener('change', (e) => {
      AppState.matrizFiltroOrg = e.target.value;
      renderMatrizAnual();
    });
  }

  const matrizLocSelect = document.getElementById('matriz-filtro-loc');
  if (matrizLocSelect) {
    matrizLocSelect.addEventListener('change', (e) => {
      AppState.matrizFiltroLoc = e.target.value;
      renderMatrizAnual();
    });
  }

  const matrizSearch = document.getElementById('matriz-buscar-texto');
  if (matrizSearch) {
    matrizSearch.addEventListener('input', (e) => {
      AppState.matrizFiltroTexto = e.target.value;
      renderMatrizAnual();
    });
  }

  // Filtros Vista 3 (Repositorio)
  const repoSearch = document.getElementById('repo-buscar-texto');
  if (repoSearch) {
    repoSearch.addEventListener('input', (e) => {
      AppState.repoFiltroTexto = e.target.value;
      renderRepositorioGlobal();
    });
  }

  const repoOrg = document.getElementById('repo-filtro-org');
  if (repoOrg) {
    repoOrg.addEventListener('change', (e) => {
      AppState.repoFiltroOrg = e.target.value;
      renderRepositorioGlobal();
    });
  }

  const repoAct = document.getElementById('repo-filtro-act');
  if (repoAct) {
    repoAct.addEventListener('change', (e) => {
      AppState.repoFiltroAct = e.target.value;
      renderRepositorioGlobal(false);
    });
  }

  const repoMes = document.getElementById('repo-filtro-mes');
  if (repoMes) {
    repoMes.addEventListener('change', (e) => {
      AppState.repoFiltroMes = e.target.value;
      renderRepositorioGlobal(false);
      actualizarBotonCarpetaMes();
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

  // Listener para cambios manuales en la fecha de la actividad
  const inputFecha = document.getElementById('act-fecha');
  if (inputFecha) {
    inputFecha.addEventListener('change', () => {
      const badge = document.getElementById('act-fecha-detectada-badge');
      const badgeTxt = document.getElementById('act-fecha-detectada-txt');
      if (inputFecha.value && badge && badgeTxt) {
        const partes = inputFecha.value.split('-');
        if (partes.length === 3) {
          const fechaFmt = `${partes[2]}/${partes[1]}/${partes[0]}`;
          badge.className = 'mt-1.5 p-1.5 px-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-center justify-between gap-1 transition';
          badgeTxt.innerHTML = `✏️ Fecha seleccionada: <strong>${fechaFmt}</strong>.`;
          badge.classList.remove('hidden');
        }
      }
    });
  }
}

function procesarArchivoSeleccionado(file) {
  const maxMb = 25;
  if (file.size > maxMb * 1024 * 1024) {
    alert(`⚠️ El archivo pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB. El límite recomendado para subida a Google Apps Script es de ${maxMb} MB. Si es posible, comprime el PDF antes de subirlo.`);
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
  reader.onload = async (e) => {
    const result = e.target.result;
    const commaIndex = result.indexOf(',');
    archivoSeleccionadoBase64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;

    mostrarArchivoSeleccionadoUI(file);
    actualizarPreviewNombreArchivo();

    // 1. Análisis preliminar por nombre y cabeceras
    analizarYCargarFechaArchivo(file, archivoSeleccionadoBase64);

    // 2. Análisis profundo por OCR / texto en el interior del documento
    try {
      let arrayBuffer = null;
      if (typeof file.arrayBuffer === 'function') {
        arrayBuffer = await file.arrayBuffer();
      }
      await procesarOcrYTextoDeArchivo(file, arrayBuffer);
    } catch (errOcr) {
      console.warn('Aviso OCR:', errOcr);
    }
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

/**
 * Decodifica de forma segura un fragmento inicial de un string Base64 a texto ASCII/Latin-1
 */
function decodificarFragmentoBase64(base64Str, maxChars = 120000) {
  if (!base64Str) return '';
  try {
    const end = Math.min(base64Str.length, maxChars);
    const validLen = end - (end % 4);
    if (validLen <= 0) return '';
    return atob(base64Str.substring(0, validLen));
  } catch (err) {
    return '';
  }
}

/**
 * Decodifica de forma segura la cola final de un string Base64 (útil para trailers y metadatos de PDF)
 */
function decodificarColaBase64(base64Str, maxChars = 40000) {
  if (!base64Str) return '';
  try {
    const start = Math.max(0, base64Str.length - maxChars);
    const alignedStart = start - (start % 4);
    const chunk = base64Str.substring(alignedStart);
    const validLen = chunk.length - (chunk.length % 4);
    if (validLen <= 0) return '';
    return atob(chunk.substring(0, validLen));
  } catch (err) {
    return '';
  }
}

/**
 * Analiza el nombre, contenido y metadatos del archivo para extraer la fecha técnica del documento
 */
function extraerFechaDeArchivo(file, base64Str) {
  const meses = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
    noviembre: '11', diciembre: '12',
    ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
    jul: '07', ago: '08', sep: '09', set: '09', oct: '10', nov: '11', dic: '12'
  };

  const nombre = file && file.name ? file.name : '';

  // 1. Análisis del NOMBRE DEL ARCHIVO (prioridad alta: suele reflejar la fecha que asignó el usuario)
  if (nombre) {
    // Patrón ISO: YYYY-MM-DD / YYYY_MM_DD / YYYY.MM.DD
    let m = nombre.match(/(202[0-9])[-_./](0[1-9]|1[0-2])[-_./]([0-2][0-9]|3[01])/);
    if (m) {
      return { fecha: `${m[1]}-${m[2]}-${m[3]}`, origen: 'nombre del archivo' };
    }

    // Patrón Latino: DD-MM-YYYY / DD_MM_YYYY / DD.MM.YYYY
    m = nombre.match(/([0-2]?[0-9]|3[01])[-_./](0?[1-9]|1[0-2])[-_./](202[0-9])/);
    if (m) {
      const d = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      return { fecha: `${m[3]}-${mo}-${d}`, origen: 'nombre del archivo' };
    }

    // Patrón Corto: DD-MM-YY (ej: 14-04-26)
    m = nombre.match(/([0-2]?[0-9]|3[01])[-_./](0?[1-9]|1[0-2])[-_./](2[0-9])\b/);
    if (m) {
      const d = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      return { fecha: `20${m[3]}-${mo}-${d}`, origen: 'nombre del archivo' };
    }

    // Patrón Compacto: YYYYMMDD (ej: 20260414)
    m = nombre.match(/(202[0-9])(0[1-9]|1[0-2])([0-2][0-9]|3[01])/);
    if (m) {
      return { fecha: `${m[1]}-${m[2]}-${m[3]}`, origen: 'nombre del archivo' };
    }

    // Mes en texto en el nombre: ej "14 de abril 2026", "14_abril_2026", "abril_2026"
    m = nombre.match(/([0-2]?[0-9]|3[01])?[-_\s]*(?:de[-_\s]*)?([a-zA-Z]{3,10})[-_\s]*(?:de[-_\s]*)?(202[0-9])/i);
    if (m && meses[m[2].toLowerCase()]) {
      const d = m[1] ? m[1].padStart(2, '0') : '01';
      const mo = meses[m[2].toLowerCase()];
      return { fecha: `${m[3]}-${mo}-${d}`, origen: 'nombre del archivo' };
    }
  }

  // 2. Análisis del CONTENIDO Y METADATOS INTERNOS DEL ARCHIVO
  if (base64Str) {
    const headerText = decodificarFragmentoBase64(base64Str, 120000);
    const trailerText = decodificarColaBase64(base64Str, 40000);
    const sample = headerText + '\n' + trailerText;

    // A. Metadatos directos de PDF: /CreationDate (D:YYYYMMDD...) o /ModDate
    let mPdf = sample.match(/\/(?:CreationDate|ModDate)\s*\(\s*D:?(202[0-9])(0[1-9]|1[0-2])([0-2][0-9]|3[01])/i);
    if (mPdf) {
      return { fecha: `${mPdf[1]}-${mPdf[2]}-${mPdf[3]}`, origen: 'metadatos PDF' };
    }

    // B. Texto del documento con encabezado de fecha: "Fecha: DD/MM/YYYY" o "Fecha de visita: DD/MM/YYYY"
    let mFechaDoc = sample.match(/fecha[^\d\n\r]{0,35}([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9])/i);
    if (mFechaDoc) {
      const d = mFechaDoc[1].padStart(2, '0');
      const mo = mFechaDoc[2].padStart(2, '0');
      return { fecha: `${mFechaDoc[3]}-${mo}-${d}`, origen: 'texto del documento' };
    }

    // C. Expresión formal en español: "14 de abril de 2026" o "a los 14 días del mes de abril de 2026"
    let mTextoMes = sample.match(/([0-2]?[0-9]|3[01])\s+(?:d[ií]as\s+del\s+mes\s+de|de)\s+([a-zA-Z]+)\s+(?:del\s+a[ñn]o\s+|de\s+)?(202[0-9])/i);
    if (mTextoMes && meses[mTextoMes[2].toLowerCase()]) {
      const d = mTextoMes[1].padStart(2, '0');
      const mo = meses[mTextoMes[2].toLowerCase()];
      return { fecha: `${mTextoMes[3]}-${mo}-${d}`, origen: 'texto del documento' };
    }

    // D. Cualquier fecha válida DD/MM/YYYY presente en el cuerpo
    let mGeneral = headerText.match(/\b([0-2]?[0-9]|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](202[0-9])\b/);
    if (mGeneral) {
      const d = mGeneral[1].padStart(2, '0');
      const mo = mGeneral[2].padStart(2, '0');
      return { fecha: `${mGeneral[3]}-${mo}-${d}`, origen: 'contenido del documento' };
    }
  }

  // 3. Fallback: Fecha de última modificación del archivo en el dispositivo
  if (file && file.lastModified) {
    const modDate = new Date(file.lastModified);
    if (!isNaN(modDate.getTime())) {
      const yyyy = modDate.getFullYear();
      if (yyyy >= 2020 && yyyy <= 2030) {
        const mm = String(modDate.getMonth() + 1).padStart(2, '0');
        const dd = String(modDate.getDate()).padStart(2, '0');
        return { fecha: `${yyyy}-${mm}-${dd}`, origen: 'archivo (última modificación)' };
      }
    }
  }

  return null;
}

/**
 * Ejecuta el análisis inteligente del archivo y auto-completa el campo de fecha,
 * dejando habilitada la opción de modificarla libremente.
 */
function analizarYCargarFechaArchivo(file, base64Str) {
  const detectado = extraerFechaDeArchivo(file, base64Str);
  const inputFecha = document.getElementById('act-fecha');
  const badge = document.getElementById('act-fecha-detectada-badge');
  const badgeTxt = document.getElementById('act-fecha-detectada-txt');

  if (!inputFecha) return;

  if (detectado && detectado.fecha) {
    inputFecha.value = detectado.fecha;
    actualizarPreviewNombreArchivo();

    if (badge && badgeTxt) {
      const partes = detectado.fecha.split('-');
      const fechaFmt = `${partes[2]}/${partes[1]}/${partes[0]}`;
      badge.className = 'mt-1.5 p-1.5 px-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center justify-between gap-1 transition';
      badgeTxt.innerHTML = `✨ Fecha detectada (${detectado.origen}): <strong>${fechaFmt}</strong>. Puedes modificarla si lo deseas.`;
      badge.classList.remove('hidden');
    }
    mostrarToast(`✨ Fecha detectada del documento: ${detectado.fecha}`);
  }
}

/**
 * Permite al usuario volver a la fecha de hoy con un solo clic si lo prefiere.
 */
function restablecerFechaHoy() {
  const inputFecha = document.getElementById('act-fecha');
  const badge = document.getElementById('act-fecha-detectada-badge');
  const ocrBadge = document.getElementById('act-ocr-loading-badge');
  if (inputFecha) {
    inputFecha.value = new Date().toISOString().slice(0, 10);
    actualizarPreviewNombreArchivo();
  }
  if (badge) badge.classList.add('hidden');
  if (ocrBadge) ocrBadge.classList.add('hidden');
  mostrarToast('📅 Fecha restablecida a hoy.');
}
window.restablecerFechaHoy = restablecerFechaHoy;

/**
 * Busca fechas técnicas válidas dentro de un texto extraído por OCR o capa digital de PDF
 */
function buscarFechasEnTexto(fullText) {
  if (!fullText) return null;

  const meses = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
    noviembre: '11', diciembre: '12',
    ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
    jul: '07', ago: '08', sep: '09', set: '09', oct: '10', nov: '11', dic: '12'
  };

  const clean = fullText.replace(/\r/g, ' ').replace(/\n+/g, ' ');

  // 1. Patrón con palabras clave de fecha o localidad (alta probabilidad en actas e informes)
  const regexConContexto = /(?:fecha|visita|relevamiento|acta|emisi[oó]n|d[ií]a|paran[aá]|concordia|gualeguaych[uú])[^\d]{0,25}([0-2]?[0-9]|3[01])\s*(?:[\/\-\.])\s*(0?[1-9]|1[0-2])\s*(?:[\/\-\.])\s*(202[0-9])/i;
  let match = clean.match(regexConContexto);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    if (parseInt(d, 10) >= 1 && parseInt(d, 10) <= 31 && parseInt(m, 10) >= 1 && parseInt(m, 10) <= 12) {
      return `${y}-${m}-${d}`;
    }
  }

  // 2. Patrón en letras: "14 de abril de 2026" o "a los 14 días del mes de abril de 2026"
  const regexLetras = /([0-2]?[0-9]|3[01])\s+(?:d[ií]as\s+del\s+mes\s+de|de)\s+([a-zA-Z]+)\s+(?:del?\s+)?(?:a[ñn]o\s+)?(202[0-9])/i;
  match = clean.match(regexLetras);
  if (match && meses[match[2].toLowerCase()]) {
    const d = match[1].padStart(2, '0');
    const m = meses[match[2].toLowerCase()];
    const y = match[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Patrón numérico general DD/MM/YYYY
  const regexNum = /\b([0-2]?[0-9]|3[01])\s*(?:[\/\-\.])\s*(0?[1-9]|1[0-2])\s*(?:[\/\-\.])\s*(202[0-9])\b/;
  match = clean.match(regexNum);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    if (parseInt(d, 10) >= 1 && parseInt(d, 10) <= 31 && parseInt(m, 10) >= 1 && parseInt(m, 10) <= 12) {
      return `${y}-${m}-${d}`;
    }
  }

  return null;
}

/**
 * Procesa el interior del documento (PDF o Imagen) mediante extracción de texto digital y OCR (Tesseract.js)
 */
async function procesarOcrYTextoDeArchivo(file, arrayBuffer) {
  const loadingBadge = document.getElementById('act-ocr-loading-badge');
  const loadingTxt = document.getElementById('act-ocr-loading-txt');
  const badge = document.getElementById('act-fecha-detectada-badge');
  const badgeTxt = document.getElementById('act-fecha-detectada-txt');
  const inputFecha = document.getElementById('act-fecha');

  let fechaEncontrada = null;
  let origenOcr = '';

  try {
    const isPdf = (file.type === 'application/pdf') || (file.name && file.name.toLowerCase().endsWith('.pdf'));
    const isImage = (file.type && file.type.startsWith('image/')) || (file.name && /\.(jpg|jpeg|png|webp|bmp)$/i.test(file.name));

    // A. Si es PDF, intentar lectura de texto digital con PDF.js
    if (isPdf && arrayBuffer && window.pdfjsLib) {
      try {
        if (loadingBadge) loadingBadge.classList.remove('hidden');
        if (loadingTxt) loadingTxt.textContent = 'Analizando texto en el interior del PDF...';

        const typedArray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        const maxPags = Math.min(pdf.numPages, 3);
        let extractedText = '';

        for (let p = 1; p <= maxPags; p++) {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const pText = textContent.items.map(it => it.str).join(' ');
          extractedText += pText + ' ';
        }

        if (extractedText.trim().length > 30) {
          const f = buscarFechasEnTexto(extractedText);
          if (f) {
            fechaEncontrada = f;
            origenOcr = 'interior del PDF (texto digital)';
          }
        }

        // B. Si el PDF no tiene capa de texto digital (es un escaneo), ejecutar OCR sobre la Página 1
        if (!fechaEncontrada && window.Tesseract) {
          if (loadingTxt) loadingTxt.textContent = 'Escaneo detectado: Ejecutando OCR en el interior del PDF...';

          const page1 = await pdf.getPage(1);
          const viewport = page1.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page1.render({ canvasContext: context, viewport: viewport }).promise;

          const ocrResult = await Tesseract.recognize(canvas, 'spa', {
            logger: m => {
              if (m.status === 'recognizing text' && loadingTxt) {
                loadingTxt.textContent = `OCR en progreso: ${Math.round((m.progress || 0) * 100)}%`;
              }
            }
          });

          if (ocrResult && ocrResult.data && ocrResult.data.text) {
            const fOcr = buscarFechasEnTexto(ocrResult.data.text);
            if (fOcr) {
              fechaEncontrada = fOcr;
              origenOcr = 'OCR en el interior del documento escaneado';
            }
          }
        }
      } catch (errPdf) {
        console.warn('Aviso en análisis de PDF:', errPdf);
      }
    }

    // C. Si es una imagen directa (JPG, PNG), ejecutar OCR con Tesseract.js
    if (!fechaEncontrada && isImage && window.Tesseract) {
      if (loadingBadge) loadingBadge.classList.remove('hidden');
      if (loadingTxt) loadingTxt.textContent = 'Ejecutando OCR sobre la imagen...';

      const ocrResult = await Tesseract.recognize(file, 'spa', {
        logger: m => {
          if (m.status === 'recognizing text' && loadingTxt) {
            loadingTxt.textContent = `OCR en progreso: ${Math.round((m.progress || 0) * 100)}%`;
          }
        }
      });

      if (ocrResult && ocrResult.data && ocrResult.data.text) {
        const fImg = buscarFechasEnTexto(ocrResult.data.text);
        if (fImg) {
          fechaEncontrada = fImg;
          origenOcr = 'OCR en el interior de la imagen';
        }
      }
    }
  } catch (errGlobal) {
    console.warn('Aviso en proceso OCR:', errGlobal);
  } finally {
    if (loadingBadge) loadingBadge.classList.add('hidden');
  }

  // Si encontramos la fecha en el interior del documento, actualizar UI
  if (fechaEncontrada && inputFecha) {
    inputFecha.value = fechaEncontrada;
    actualizarPreviewNombreArchivo();

    if (badge && badgeTxt) {
      const partes = fechaEncontrada.split('-');
      const fechaFmt = `${partes[2]}/${partes[1]}/${partes[0]}`;
      badge.className = 'mt-1.5 p-1.5 px-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center justify-between gap-1 transition';
      badgeTxt.innerHTML = `✨ Fecha detectada por <strong>OCR</strong> (${origenOcr}): <strong>${fechaFmt}</strong>. Puedes modificarla si lo deseas.`;
      badge.classList.remove('hidden');
    }
    mostrarToast(`✨ Fecha detectada por OCR: ${fechaEncontrada}`);
  }
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

  const preventor = document.getElementById('act-preventor') ? document.getElementById('act-preventor').value.trim() : '';
  if (preventor) localStorage.setItem('hys_ultimo_preventor', preventor);

  const obsElem = document.getElementById('act-obs');
  const observaciones = obsElem ? obsElem.value.trim() : '';

  const detalle = obtenerDetalleActualParaCodificacion();
  let estado = 'Completado';
  let obsFinal = observaciones;
  if (currentActividadModal === 'constancia_visita') {
    const stCv = document.getElementById('campo-cv-estado');
    estado = stCv ? stCv.value : 'Firmada in situ';
    const firmante = document.getElementById('campo-cv-firmante') ? document.getElementById('campo-cv-firmante').value.trim() : '';
    if (firmante) {
      obsFinal = (obsFinal ? obsFinal + ' | ' : '') + 'Firmado por: ' + firmante;
    }
  } else if (currentActividadModal === 'informe_tecnico') {
    const stInf = document.getElementById('campo-informe-estado');
    estado = stInf ? stInf.value : 'Completado';
    const cantD = document.getElementById('campo-informe-cant-desvios') ? document.getElementById('campo-informe-cant-desvios').value.trim() : '';
    if (cantD) {
      obsFinal = (obsFinal ? obsFinal + ' | ' : '') + 'Desvíos detectados: ' + cantD;
    }
  } else if (currentActividadModal === 'muestra_agua') {
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

  const progressBox = document.getElementById('upload-progress-box');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressLabel = document.getElementById('upload-progress-label');
  const btnSubmit = document.getElementById('btn-guardar-actividad');

  if (progressBox) progressBox.classList.remove('hidden');
  if (btnSubmit) btnSubmit.disabled = true;

  animarProgreso(progressBar, progressLabel, 15, 'Preparando metadatos y codificación...');

  let cleanB64 = (archivoSeleccionadoBase64 || '').trim();
  if (cleanB64.includes(',')) {
    cleanB64 = cleanB64.substring(cleanB64.indexOf(',') + 1);
  }
  cleanB64 = cleanB64.replace(/\s+/g, '');

  const payload = {
    tipoOperacion: 'upload_actividad_documento',
    tipoActividad: currentActividadModal,
    fechaActividad: fecha,
    estadoActividad: estado,
    detalle: detalle,
    preventor: preventor,
    observaciones: obsFinal,
    fileBase64: cleanB64,
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
  let monthFolderUrl = '';
  let monthFolderId = '';
  let monthKey = '';
  let monthLabel = '';
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
      monthFolderUrl = result.monthFolderUrl || '';
      monthFolderId = result.monthFolderId || '';
      monthKey = result.monthKey || '';
      monthLabel = result.monthLabel || '';

      if (monthFolderUrl && monthKey) {
        AppState.carpetasMensuales[monthKey] = {
          key: monthKey,
          label: monthLabel || monthKey,
          url: monthFolderUrl,
          id: monthFolderId
        };
        if (result.parentMensualUrl) {
          AppState.parentMensualUrl = result.parentMensualUrl;
        }
        guardarCarpetasMensualesLocal();
      }
    } else {
      console.warn('Respuesta no exitosa de Apps Script:', result);
      mostrarToast('⚠️ Aviso del servidor: ' + ((result && result.message) || 'Guardado local'));
    }
  } catch (err) {
    console.warn('No se pudo conectar inmediatamente con Google Apps Script (se guardará localmente):', err);
    mostrarToast('⚠️ Conexión no disponible. Se guardó copia local.');
  }

  animarProgreso(progressBar, progressLabel, 100, '¡Guardado completado!');

  if (!AppState.actividadesRegistradas[est.id]) {
    AppState.actividadesRegistradas[est.id] = [];
  }

  const mInfo = parsearAnioMesCliente(fecha);
  const mFUrl = monthFolderUrl || (AppState.carpetasMensuales[mInfo.key] ? AppState.carpetasMensuales[mInfo.key].url : '');

  const nuevoRegistro = {
    id: registroId,
    tipoActividad: currentActividadModal,
    fechaActividad: fecha,
    estadoActividad: estado,
    detalle: detalle,
    preventor: preventor,
    observaciones: obsFinal,
    fileName: codedFileName,
    fileUrl: driveUrl,
    fileId: driveFileId,
    monthFolderUrl: mFUrl,
    monthKey: monthKey || mInfo.key,
    monthLabel: monthLabel || mInfo.label,
    timestamp: new Date().toISOString()
  };

  AppState.actividadesRegistradas[est.id].push(nuevoRegistro);
  guardarLegajoLocal();

  setTimeout(() => {
    cerrarModal('modal-registro-actividad');
    seleccionarEstablecimiento(est.id);
    renderRepositorioGlobal(true);
    renderMatrizAnual();
    renderDashboard();
    if (driveUrl) {
      mostrarToast(`✓ Subido a Google Drive y carpeta mensual: ${mInfo.label}`);
    } else {
      mostrarToast(`✓ Guardado localmente en sede ${est.nroEstab ? '#' + est.nroEstab : ''}`);
    }
  }, 600);
}
window.guardarActividadYSubir = guardarActividadYSubir;

function abrirModalSubirArchivoParaRegistro(registroId, estId, tipoActividad) {
  seleccionarEstablecimiento(estId);
  const actNorm = normalizarTipoActividad(tipoActividad);
  abrirModalRegistrarActividad(actNorm);

  const acts = AppState.actividadesRegistradas[estId] || [];
  const reg = acts.find(a => a.id === registroId || a.fileName === registroId);
  if (reg && reg.fechaActividad) {
    const inputFecha = document.getElementById('act-fecha');
    if (inputFecha) {
      inputFecha.value = reg.fechaActividad;
      actualizarPreviewNombreArchivo();
    }
  }
  mostrarToast('📂 Selecciona el archivo para subirlo a Google Drive.');
}
window.abrirModalSubirArchivoParaRegistro = abrirModalSubirArchivoParaRegistro;

function renderDashboard() {
  if (AppState.moduloActivo === 'matriz') {
    renderMatrizAnual();
  }
}
window.renderDashboard = renderDashboard;

function actualizarIndicadorLegajo(targetEstId) {
  const est = AppState.establecimientos[targetEstId];
  if (est && AppState.moduloActivo === 'ficha') {
    renderFichaEstablecimiento(est);
  }
}
window.actualizarIndicadorLegajo = actualizarIndicadorLegajo;

function actualizarProgresoGeneral() {
  // No-op de seguridad
}
window.actualizarProgresoGeneral = actualizarProgresoGeneral;

function animarProgreso(bar, label, targetPercent, text) {
  if (bar) bar.style.width = targetPercent + '%';
  if (label) label.textContent = `${targetPercent}% - ${text}`;
}

// ==================== SINCRONIZACIÓN CON GOOGLE SHEETS ====================

function mapearFilaActividad(row) {
  if (!row) return null;
  const fAct = row['Fecha Actividad'] ? String(row['Fecha Actividad']).split('T')[0] : '';
  const mInfo = parsearAnioMesCliente(fAct);
  const mUrl = row['URL Carpeta Mensual'] || (AppState.carpetasMensuales[mInfo.key] ? AppState.carpetasMensuales[mInfo.key].url : '');
  if (mUrl && mInfo.key) {
    AppState.carpetasMensuales[mInfo.key] = {
      key: mInfo.key,
      label: mInfo.label,
      url: mUrl,
      id: ''
    };
  }
  return {
    id: row['ID Registro'] || ('ACT_' + Math.random().toString(36).substring(2, 9)),
    tipoActividad: normalizarActividadDesdeSheet(row['Tipo Actividad']),
    fechaActividad: fAct,
    estadoActividad: row['Estado'] || 'Completado',
    detalle: row['Detalle / Puesto / Tema'] || '',
    fileName: row['Nombre Archivo'] || '',
    fileUrl: row['URL Google Drive'] || '',
    fileId: row['ID Drive'] || '',
    preventor: row['Preventor Responsable'] || '',
    observaciones: row['Observaciones'] || '',
    monthFolderUrl: mUrl,
    monthKey: mInfo.key,
    monthLabel: mInfo.label
  };
}

function encontrarEstablecimiento(nro, nom, org) {
  const sNro = nro ? String(nro).trim().toLowerCase() : '';
  const sNom = nom ? String(nom).trim().toLowerCase() : '';
  const sOrg = org ? String(org).trim().toLowerCase() : '';

  if (sNro) {
    const found = AppState.establecimientos.find(e => e.nroEstab && String(e.nroEstab).trim().toLowerCase() === sNro);
    if (found) return found;
  }
  if (sNom) {
    const found = AppState.establecimientos.find(e => {
      const eNom = String(e.nombreEstablecimiento || '').trim().toLowerCase();
      return eNom === sNom || (sNom.length > 5 && eNom.includes(sNom)) || (eNom.length > 5 && sNom.includes(eNom));
    });
    if (found) return found;
  }
  if (sOrg) {
    const found = AppState.establecimientos.find(e => String(e.organismo || '').trim().toLowerCase() === sOrg);
    if (found) return found;
  }
  return null;
}

async function sincronizarConSheets() {
  const est = AppState.establecimientoSeleccionado;
  AppState.estaSincronizando = true;

  // Actualizar spinners visuales en todos los botones de sincronización
  const allSyncBtns = document.querySelectorAll('.btn-sync-action, #btn-sync-repo-global, #btn-sync-ficha');
  allSyncBtns.forEach(btn => {
    btn.disabled = true;
    const icon = btn.querySelector('i');
    if (icon) icon.classList.add('fa-spin');
  });

  if (est) {
    renderFichaEstablecimiento(est);
  }

  try {
    mostrarToast('⏳ Sincronizando con Google Sheets y Google Drive...');

    // Si hay un establecimiento seleccionado, sincronizamos esa sede.
    // Si no hay seleccionado (estamos en Repositorio Global, Matriz o Dashboard), sincronizamos TODO.
    const isGlobal = !est;
    const url = isGlobal 
      ? `${getWebhookUrl()}?action=get_todos_legajos`
      : `${getWebhookUrl()}?action=get_legajo_establecimiento&nroEstab=${encodeURIComponent(est.nroEstab || '')}&nombreEstab=${encodeURIComponent(est.nombreEstablecimiento)}&organismo=${encodeURIComponent(est.organismo)}`;

    const res = await fetch(url);
    const json = await res.json();

    // 1. Verificación si la versión desplegada en Google Apps Script está desactualizada
    if (json && json.status === 'success' && !Array.isArray(json.actividades) && json.establecimientos) {
      mostrarModalVersionDesactualizada();
      return;
    }

    // 2. Si recibimos actividades válidas
    if (json && json.status === 'success' && Array.isArray(json.actividades)) {
      if (json.actividades.length > 0) {
        if (isGlobal) {
          let totalMapped = 0;
          json.actividades.forEach(row => {
            const mappedItem = mapearFilaActividad(row);
            if (!mappedItem) return;
            totalMapped++;

            const targetEst = encontrarEstablecimiento(
              row['N° Estab'] || row['Nro Estab'],
              row['Nombre Establecimiento'],
              row['Organismo']
            );
            const estKey = targetEst ? targetEst.id : ('est_' + (row['N° Estab'] || 'gen'));

            if (!AppState.actividadesRegistradas[estKey]) {
              AppState.actividadesRegistradas[estKey] = [];
            }

            const idx = AppState.actividadesRegistradas[estKey].findIndex(a => 
              a.id === mappedItem.id || 
              (a.fileName && mappedItem.fileName && a.fileName === mappedItem.fileName)
            );
            if (idx >= 0) {
              AppState.actividadesRegistradas[estKey][idx] = mappedItem;
            } else {
              AppState.actividadesRegistradas[estKey].push(mappedItem);
            }
          });

          guardarCarpetasMensualesLocal();
          guardarLegajoLocal();
          renderRepositorioGlobal(true);
          renderMatrizAnual();
          renderDashboard();
          mostrarToast(`✅ Sincronizados ${totalMapped} registros globales desde Google Sheets.`);
        } else {
          const mapped = json.actividades.map(mapearFilaActividad).filter(Boolean);
          guardarCarpetasMensualesLocal();
          AppState.actividadesRegistradas[est.id] = mapped;
          guardarLegajoLocal();
          renderRepositorioGlobal(true);
          renderPanelActividades(est);
          renderMatrizAnual();
          mostrarToast(`✅ Sincronizados ${mapped.length} registros para ${est.nombreEstablecimiento}.`);
        }
      } else {
        mostrarToast(isGlobal 
          ? 'No se encontraron registros en Google Sheets (Hoja Legajo vacía).' 
          : 'No se encontraron registros previos en Google Sheets para esta sede.');
      }
    } else {
      mostrarToast('⚠️ Respuesta inesperada de Google Sheets. Verificá la configuración del Webhook.');
    }

    // Sincronizar también carpetas mensuales desde Drive
    try {
      await cargarCarpetasMensualesDesdeDrive();
    } catch(e) {}

  } catch (err) {
    console.warn('Error sincronizando con Sheets:', err);
    mostrarToast('❌ No se pudo conectar con Google Sheets: ' + err.message);
  } finally {
    AppState.estaSincronizando = false;
    allSyncBtns.forEach(btn => {
      btn.disabled = false;
      const icon = btn.querySelector('i');
      if (icon) icon.classList.remove('fa-spin');
    });
    if (est) {
      renderFichaEstablecimiento(est);
      renderPanelActividades(est);
    }
  }
}

function mostrarModalVersionDesactualizada() {
  const modal = document.getElementById('modal-desactualizado-apps-script');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    alert(
      '⚠️ ATENCIÓN: El Webhook de Google Apps Script necesita actualizarse.\n\n' +
      'La URL actual respondió correctamente, pero está ejecutando una versión previa que todavía no incluye la función de sincronización de legajos y carpetas Drive.\n\n' +
      'Pasos para solucionarlo en 1 minuto:\n' +
      '1. Abrí tu proyecto en Google Apps Script (script.google.com)\n' +
      '2. Copiá y pegá el código completo del archivo "codigo_google_apps_script.js"\n' +
      '3. Hacé clic en "Implementar" > "Administrar implementaciones"\n' +
      '4. Hacé clic en el lápiz (Editar), elegí "Versión: Nueva versión" y pulsá "Implementar".'
    );
  }
}

function cerrarModalVersionDesactualizada() {
  const modal = document.getElementById('modal-desactualizado-apps-script');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function normalizarActividadDesdeSheet(str) {
  if (!str) return 'confeccion_rgrl';
  const s = str.toLowerCase().trim();
  if (s.includes('constancia') || s === 'cv' || s.startsWith('cv_') || s.startsWith('cv ') || s.includes('visita')) {
    return 'constancia_visita';
  }
  if (s.includes('informe') || s === 'inf' || s.startsWith('informe_') || s.startsWith('informe ')) {
    return 'informe_tecnico';
  }
  for (const [key, val] of Object.entries(CATALOGO_ACTIVIDADES)) {
    if (s.includes(key) || s.includes(val.codigo.toLowerCase()) || s.includes(val.nombre.toLowerCase())) {
      return key;
    }
  }
  return str;
}

// ==================== ENLACE DIRECTO CON CHECKLIST RGRL ====================

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

// ==================== GESTIÓN DE CARPETAS MENSUALES DRIVE ====================


function abrirModalCarpetasMensuales() {
  const modal = document.getElementById('modal-carpetas-mensuales');
  const container = document.getElementById('lista-carpetas-mensuales-modal');
  if (!modal || !container) return;

  container.innerHTML = '';

  // Contar documentos por mes a partir de todas las actividades cargadas
  const conteoMeses = {};
  Object.values(AppState.actividadesRegistradas).forEach(acts => {
    acts.forEach(a => {
      const mInfo = parsearAnioMesCliente(a.fechaActividad);
      if (!conteoMeses[mInfo.key]) {
        conteoMeses[mInfo.key] = { label: mInfo.label, count: 0, docsConUrl: 0 };
      }
      conteoMeses[mInfo.key].count++;
      if (a.fileUrl) conteoMeses[mInfo.key].docsConUrl++;
    });
  });

  // Asegurar que los meses presentes en AppState.carpetasMensuales aparezcan
  Object.keys(AppState.carpetasMensuales).forEach(k => {
    if (!conteoMeses[k]) {
      conteoMeses[k] = { label: AppState.carpetasMensuales[k].label || k, count: 0, docsConUrl: 0 };
    }
  });

  // Si no hay meses aún, incluir el mes actual
  const mActual = parsearAnioMesCliente(new Date().toISOString().substring(0, 10));
  if (!conteoMeses[mActual.key]) {
    conteoMeses[mActual.key] = { label: mActual.label, count: 0, docsConUrl: 0 };
  }

  const sortedKeys = Object.keys(conteoMeses).sort().reverse();

  sortedKeys.forEach(k => {
    const info = conteoMeses[k];
    const folderData = AppState.carpetasMensuales[k] || {};
    const url = folderData.url || '';

    const card = document.createElement('div');
    card.className = 'flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm';
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <div>
          <div class="font-bold text-slate-800 text-xs">${escapeHtml(info.label)}</div>
          <div class="text-[11px] text-slate-500">
            ${info.count} informe(s) relevados • ${info.docsConUrl} con archivo directo
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${url ? `
          <a href="${url}" target="_blank" class="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>Abrir en Drive</span>
          </a>
        ` : `
          <button onclick="abrirCarpetaMensualParaClave('${k}')" class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-xs flex items-center gap-1.5 transition">
            <i class="fa-brands fa-google-drive text-blue-600"></i>
            <span>Ver en Drive</span>
          </button>
        `}
      </div>
    `;
    container.appendChild(card);
  });

  modal.classList.remove('hidden');
}

function abrirCarpetaMensualSeleccionada() {
  const mesSeleccionado = AppState.repoFiltroMes;
  if (mesSeleccionado && AppState.carpetasMensuales[mesSeleccionado] && AppState.carpetasMensuales[mesSeleccionado].url) {
    window.open(AppState.carpetasMensuales[mesSeleccionado].url, '_blank');
  } else if (mesSeleccionado) {
    abrirCarpetaMensualParaClave(mesSeleccionado);
  } else {
    if (AppState.parentMensualUrl) {
      window.open(AppState.parentMensualUrl, '_blank');
    } else {
      abrirModalCarpetasMensuales();
    }
  }
}

function abrirCarpetaMensualParaClave(monthKey) {
  const data = AppState.carpetasMensuales[monthKey];
  if (data && data.url) {
    window.open(data.url, '_blank');
    return;
  }
  if (AppState.parentMensualUrl) {
    window.open(AppState.parentMensualUrl, '_blank');
  } else {
    abrirModalCarpetasMensuales();
    mostrarToast(`La carpeta para el mes ${monthKey} se generará automáticamente en Google Drive al subir el primer archivo.`);
  }
}

function abrirCarpetaParentMensualDrive() {
  if (AppState.parentMensualUrl) {
    window.open(AppState.parentMensualUrl, '_blank');
  } else {
    window.open('https://drive.google.com/drive/search?q=Carpetas_Mensuales', '_blank');
  }
}

async function consultarCarpetasMensualesDrive() {
  try {
    const url = `${getWebhookUrl()}?action=get_carpetas_mensuales`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.status === 'success') {
      if (json.parentMensualUrl) {
        AppState.parentMensualUrl = json.parentMensualUrl;
      }
      if (Array.isArray(json.carpetas)) {
        json.carpetas.forEach(c => {
          const match = c.name.match(/^(\d{4}-\d{2})/);
          const key = match ? match[1] : c.name;
          AppState.carpetasMensuales[key] = {
            key: key,
            label: c.name,
            url: c.url,
            id: c.id
          };
        });
        guardarCarpetasMensualesLocal();
        actualizarBotonCarpetaMes();
        renderRepositorioGlobal(false);
      }
    }
  } catch(e) {
    // Silencioso si no hay red
  }
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
