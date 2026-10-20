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
  PARENT_MENSUAL_URL: 'iapser_parent_mensual_url',
  SUPERFICIES_DB: 'iapser_superficies_db',
  SHEET_SUPERFICIES_URL: 'iapser_sheet_superficies_url'
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
  superficies: {}, // estId -> { idSede, nroEstab, superficie, requiereMediciones }
  sheetSuperficiesUrl: 'https://docs.google.com/spreadsheets/d/1-eQvCHv3LB6C2ydjY_fXwWEY67e5vbE4GNWIBKSrMfE/edit#gid=1756568834',
  
  // Filtros Vista 1 (Ficha)
  filtroTexto: '',
  filtroOrganismo: '',
  filtroLocalidad: '',
  
  // Filtros Vista 2 (Matriz)
  matrizAnio: '2026',
  matrizMes: 'todos', // 'todos' | '01'...'12'
  matrizModoVista: 'actividades', // 'actividades' | 'meses'
  matrizFiltroOrg: '',
  matrizFiltroLoc: '',
  matrizFiltroTexto: '',
  matrizFiltroDocs: '',

  // Filtros Vista 3 (Repositorio)
  repoFiltroOrg: '',
  repoFiltroAct: '',
  repoFiltroMes: '',
  repoFiltroTexto: '',

  customActivities: [],
  estaSincronizando: false,
  vistaActividadesModo: (typeof localStorage !== 'undefined' && localStorage.getItem('hys_vista_actividades_modo')) || 'cards' // 'cards' | 'grilla'
};
if (typeof window !== 'undefined') {
  window.AppState = AppState;
}

const MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Convertir cualquier fecha (DD/MM/AAAA, YYYY-MM-DD, YYYY-DD-MM, YYYYMMDD, texto) a formato ISO YYYY-MM-DD
function convertirDdmmaaaAIso(fechaStr) {
  if (!fechaStr) return '';
  let s = String(fechaStr).trim().split('T')[0].split(' ')[0].trim();
  if (s === '' || s === 'S/F') return '';

  // 1. Caso YYYY-something-something (ej: 2026-09-30 o 2026-30-09)
  const mIso = s.match(/^(\d{4})[-_\.\/](\d{1,2})[-_\.\/](\d{1,2})/);
  if (mIso) {
    const y = mIso[1];
    const p1 = parseInt(mIso[2], 10);
    const p2 = parseInt(mIso[3], 10);
    if (p1 > 12 && p2 <= 12) {
      // YYYY-DD-MM -> convertir a YYYY-MM-DD
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
    return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
  }

  // 2. Caso DD/MM/YYYY o DD-MM-YYYY
  const mDmy = s.match(/^(\d{1,2})[-_\.\/](\d{1,2})[-_\.\/](\d{4})/);
  if (mDmy) {
    const p1 = parseInt(mDmy[1], 10);
    const p2 = parseInt(mDmy[2], 10);
    const y = mDmy[3];
    if (p1 <= 12 && p2 > 12) {
      // MM/DD/YYYY -> YYYY-MM-DD
      return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
    // DD/MM/YYYY -> YYYY-MM-DD
    return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
  }

  // 3. Compacto de 8 dígitos: YYYYMMDD o YYYYDDMM (ej: 20263009 o 20260930)
  const m8Iso = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m8Iso) {
    const y = m8Iso[1];
    const p1 = parseInt(m8Iso[2], 10);
    const p2 = parseInt(m8Iso[3], 10);
    if (p1 > 12 && p2 <= 12) {
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
    return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
  }

  // 4. Compacto latino de 8 dígitos: DDMMYYYY
  const m8Dmy = s.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (m8Dmy) {
    return `${m8Dmy[3]}-${m8Dmy[2]}-${m8Dmy[1]}`;
  }

  // 5. Expresión formal con nombre de mes en español (ej: "30 de septiembre de 2026")
  const mesesMap = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
    noviembre: '11', diciembre: '12'
  };
  const mTxt = s.match(/([0-2]?[0-9]|3[01])\s+(?:de\s+)?([a-zA-Z]+)\s+(?:de\s+)?(202[0-9]|203[0-9])/i);
  if (mTxt && mesesMap[mTxt[2].toLowerCase()]) {
    const d = mTxt[1].padStart(2, '0');
    const mo = mesesMap[mTxt[2].toLowerCase()];
    return `${mTxt[3]}-${mo}-${d}`;
  }

  return s;
}
window.normalizarTipoActividad = normalizarTipoActividad;
window.convertirDdmmaaaAIso = convertirDdmmaaaAIso;

function parsearAnioMesCliente(fecha) {
  if (!fecha || String(fecha).trim() === '' || String(fecha).trim() === 'S/F') {
    return {
      key: '',
      label: 'Sin Fecha',
      anio: null,
      mes: null
    };
  }

  const iso = convertirDdmmaaaAIso(fecha);
  let anio = null;
  let mes = null;

  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const p = iso.split('-');
    anio = parseInt(p[0], 10);
    mes = parseInt(p[1], 10);
  } else {
    // Si contiene nombre de mes en español o año suelto
    const s = String(fecha).toLowerCase();
    const mesesMap = {
      enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
      julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
      noviembre: 11, diciembre: 12
    };
    for (const [mNombre, mNum] of Object.entries(mesesMap)) {
      if (s.includes(mNombre)) {
        mes = mNum;
        break;
      }
    }
    const matchYear = String(fecha).match(/\b(202[0-9]|203[0-9])\b/);
    if (matchYear) anio = parseInt(matchYear[1], 10);
  }

  if (!anio || !mes || isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return {
      key: '',
      label: 'Sin Fecha',
      anio: null,
      mes: null
    };
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
window.parsearAnioMesCliente = parsearAnioMesCliente;

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

  // 1. Configurar escuchadores de eventos inmediatamente para asegurar que los filtros funcionen siempre
  setupEventListeners();

  // 2. Restaurar módulo activo si fue guardado
  const savedModulo = localStorage.getItem(STORAGE_KEYS.MODULO_ACTIVO);
  if (savedModulo && ['ficha', 'matriz', 'repositorio'].includes(savedModulo)) {
    cambiarModulo(savedModulo, false);
  } else {
    cambiarModulo('ficha', false);
  }

  // 3. Seleccionar por defecto el establecimiento guardado o el primero del listado
  const urlParams = new URLSearchParams(window.location.search);
  const paramEstId = urlParams.get('estId') || localStorage.getItem(STORAGE_KEYS.CURRENT_EST_ID);
  
  if (paramEstId && AppState.establecimientos[paramEstId]) {
    seleccionarEstablecimiento(paramEstId);
  } else {
    const firstKey = Object.keys(AppState.establecimientos)[0];
    if (firstKey) {
      seleccionarEstablecimiento(firstKey);
    } else {
      deseleccionarEstablecimiento();
    }
  }

  consultarCarpetasMensualesDrive();

  // Sincronización automática con Google Sheets en segundo plano al iniciar
  setTimeout(() => {
    sincronizarConSheets(true).catch(e => console.warn('Aviso sincronización automática Sheets:', e));
  }, 1200);
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

  // Cargar superficies precargadas/guardadas localmente
  try {
    const rawSup = localStorage.getItem(STORAGE_KEYS.SUPERFICIES_DB);
    if (rawSup) {
      AppState.superficies = JSON.parse(rawSup);
    }
  } catch (e) {
    AppState.superficies = {};
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

    // Asignar superficie y requerimiento de mediciones
    const supInfo = AppState.superficies[id] || (est.nroEstab ? AppState.superficies[est.nroEstab] : null);
    if (supInfo && supInfo.superficie) {
      est.superficie = supInfo.superficie;
      est.requiereMediciones = (Number(est.superficie) >= 1000);
    } else {
      est.superficie = '';
      est.requiereMediciones = false;
    }
  });

  AppState.establecimientos = list;
}

function cargarLegajoLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LEGAJO_DB);
    if (raw) {
      AppState.actividadesRegistradas = JSON.parse(raw);
      // Auto-sanear y normalizar fechas invertidas (YYYY-DD-MM) en memoria local
      Object.values(AppState.actividadesRegistradas).forEach(list => {
        if (Array.isArray(list)) {
          list.forEach(a => {
            if (a && a.fechaActividad) {
              const fNorm = convertirDdmmaaaAIso(a.fechaActividad);
              if (fNorm && fNorm !== a.fechaActividad) {
                a.fechaActividad = fNorm;
                const mInfo = parsearAnioMesCliente(fNorm);
                a.monthKey = mInfo.key;
                a.monthLabel = mInfo.label;
              }
            }
          });
        }
      });
    } else {
      AppState.actividadesRegistradas = {};
    }
  } catch (e) {
    console.error('Error cargando legajo local:', e);
    AppState.actividadesRegistradas = {};
  }

  // Pre-cargar actividades técnicas desde PRELOADED_SURVEYS si no existen aún en el legajo
  if (typeof PRELOADED_SURVEYS !== 'undefined') {
    Object.keys(PRELOADED_SURVEYS).forEach(estKey => {
      const surv = PRELOADED_SURVEYS[estKey];
      if (!surv) return;

      if (!AppState.actividadesRegistradas[estKey]) {
        AppState.actividadesRegistradas[estKey] = [];
      }

      const fechaIso = surv.fecha ? (convertirDdmmaaaAIso(surv.fecha) || '2026-05-15') : '2026-05-15';
      const prevNom = (surv.data && surv.data.profesionales && surv.data.profesionales.hysNombre) || (surv.relevadoPor || 'Lic. Milva Trossero Luzzi');
      const orgAbbr = obtenerAbreviaturaOrganismo(surv.organismo || 'POL');
      const nroE = (surv.nroEstab || '0').toString().padStart(3, '0');

      // 1. Informe Técnico precargado
      const yaTieneInforme = AppState.actividadesRegistradas[estKey].some(a => normalizarTipoActividad(a.tipoActividad) === 'informe_tecnico');
      if (!yaTieneInforme) {
        AppState.actividadesRegistradas[estKey].push({
          id: 'ACT_PRE_' + estKey + '_INF',
          tipoActividad: 'informe_tecnico',
          fechaActividad: fechaIso,
          estadoActividad: 'Completado',
          detalle: 'Relevamiento Inicial HyS (Informe Técnico)',
          preventor: prevNom,
          observaciones: 'Relevamiento técnico inicial de condiciones edilicias, riesgos y mejoras.',
          fileName: `${orgAbbr}_${nroE}_INFORME_20260515_Informe.pdf`,
          fileUrl: '',
          timestamp: new Date().toISOString()
        });
      }

      // 2. RGRL precargado
      const yaTieneRgrl = AppState.actividadesRegistradas[estKey].some(a => normalizarTipoActividad(a.tipoActividad) === 'confeccion_rgrl');
      if (!yaTieneRgrl) {
        AppState.actividadesRegistradas[estKey].push({
          id: 'ACT_PRE_' + estKey + '_RGRL',
          tipoActividad: 'confeccion_rgrl',
          fechaActividad: fechaIso,
          estadoActividad: 'Completado',
          detalle: 'RGRL Inicial Dec. 351/79',
          preventor: prevNom,
          observaciones: 'Relevamiento General de Riesgos Laborales inicial.',
          fileName: `${orgAbbr}_${nroE}_RGRL_20260515_Informe.pdf`,
          fileUrl: '',
          timestamp: new Date().toISOString()
        });
      }
    });
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

  let fechaStr = '';
  if (fecha) {
    const s = String(fecha).trim();
    if (s.includes('/')) {
      const p = s.split('/');
      if (p.length >= 3) {
        fechaStr = `${p[2]}${p[1].padStart(2, '0')}${p[0].padStart(2, '0')}`;
      }
    } else if (s.includes('-')) {
      const p = s.split('-');
      if (p.length >= 3) {
        fechaStr = `${p[0]}${p[1].padStart(2, '0')}${p[2].padStart(2, '0')}`;
      }
    } else {
      fechaStr = s.replace(/[^0-9]/g, '');
    }
  }

  if (!fechaStr || fechaStr.length < 8) {
    const d = new Date();
    fechaStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  }

  const cleanDet = sanitizeText(detalle || 'Informe');
  const cleanExt = (ext || 'pdf').replace(/^\./, '');

  return `${orgAbbr}_${cleanNro}_${actCode}_${fechaStr}_${cleanDet}.${cleanExt}`;
}

// Formatear cualquier fecha a DD/MM/AAAA
function formatearFechaDdmmaaa(fechaStr) {
  if (!fechaStr) return 'S/F';
  const iso = convertirDdmmaaaAIso(fechaStr);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const p = iso.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
  }
  return String(fechaStr).trim();
}
window.formatearFechaDdmmaaa = formatearFechaDdmmaaa;

// Extraer año de cualquier cadena de fecha
function extraerAnioDeFecha(fechaStr) {
  if (!fechaStr) return '';
  const s = String(fechaStr).trim();
  const m4 = s.match(/\b(202[0-9]|203[0-9])\b/);
  if (m4) return m4[1];
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
window.extraerAnioDeFecha = extraerAnioDeFecha;

function normalizarTipoActividad(str) {
  if (!str) return '';
  const s = String(str).toLowerCase().trim();

  // 1. RAR (Evaluar antes de RGRL para no confundir por Res. 463)
  if (s === 'rar' || s === 'confeccion_rar' || /\b(?:confeccion_)?rar\b/i.test(s) || s.includes('agentes de riesgo') || s.includes('expuestos') || s.includes('relevamiento de agentes')) {
    return 'confeccion_rar';
  }
  // 2. RGRL
  if (s === 'rgrl' || s === 'confeccion_rgrl' || /\b(?:confeccion_)?rgrl\b/i.test(s) || s.includes('relevamiento general')) {
    return 'confeccion_rgrl';
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
window.normalizarTipoActividad = normalizarTipoActividad;

/**
 * Obtiene todas las actividades pertenecientes a un establecimiento,
 * buscando por ID de sede, número de establecimiento o metadatos de sede.
 */
function normalizarTextoComparar(txt) {
  if (!txt) return '';
  return txt.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function sonOrganismosCoincidentes(orgA, orgB) {
  const a = normalizarTextoComparar(orgA);
  const b = normalizarTextoComparar(orgB);
  if (!a || !b) return false;
  if (a === b) return true;
  // Abreviaturas comunes
  const abbrA = obtenerAbreviaturaOrganismo(orgA).toLowerCase();
  const abbrB = obtenerAbreviaturaOrganismo(orgB).toLowerCase();
  if (abbrA && abbrB && abbrA === abbrB && abbrA !== 'org') return true;
  return a.includes(b) || b.includes(a);
}

function obtenerActividadesDeSede(e) {
  if (!e) return [];
  const mapUnique = new Map();

  function agregarActividad(a) {
    if (!a) return;
    const aFechaIso = convertirDdmmaaaAIso(a.fechaActividad) || a.fechaActividad;
    if (aFechaIso && aFechaIso !== a.fechaActividad) {
      a.fechaActividad = aFechaIso;
      const mI = parsearAnioMesCliente(aFechaIso);
      a.monthKey = mI.key;
      a.monthLabel = mI.label;
    }
    const key = (a.id && String(a.id).trim()) 
      ? String(a.id).trim() 
      : (a.fileName ? String(a.fileName).trim() : `${normalizarTipoActividad(a.tipoActividad)}_${aFechaIso}`);
    if (!mapUnique.has(key)) {
      mapUnique.set(key, a);
    }
  }

  const sId = (e.id || '').trim();
  const sOrg = (e.organismo || e.razonSocial || '').trim();
  const sNro = (e.nroEstab || '').toString().trim();
  const sNom = (e.nombreEstablecimiento || '').trim();

  // 1. Por ID directo de la sede (solo si coincide con esta sede)
  if (sId && AppState.actividadesRegistradas[sId]) {
    const actsDirect = AppState.actividadesRegistradas[sId];
    if (Array.isArray(actsDirect)) {
      actsDirect.forEach(agregarActividad);
    }
  }

  // 2. Búsqueda en el resto del almacén EXIGIENDO coincidencia estricta de Organismo
  Object.entries(AppState.actividadesRegistradas).forEach(([key, list]) => {
    if (key === sId || !Array.isArray(list)) return;
    list.forEach(a => {
      if (!a) return;
      const aOrg = (a.organismo || (a.establecimiento && a.establecimiento.organismo) || '').trim();
      const aNro = (a.nroEstab || (a.establecimiento && a.establecimiento.nroEstab) || '').toString().trim();
      const aId = (a.estId || (a.establecimiento && a.establecimiento.id) || '').trim();
      const aNom = (a.nombreEstablecimiento || (a.establecimiento && a.establecimiento.nombreEstablecimiento) || '').trim();

      // Regla de oro: El organismo debe coincidir obligatoriamente
      if (!sonOrganismosCoincidentes(sOrg, aOrg)) {
        return;
      }

      // Dentro del mismo organismo, verificar si pertenece a esta sede específica
      if (sId && aId && sId === aId) {
        agregarActividad(a);
      } else if (sNro && aNro && sNro === aNro) {
        agregarActividad(a);
      } else if (!sNro && sNom && aNom && normalizarTextoComparar(sNom) === normalizarTextoComparar(aNom)) {
        agregarActividad(a);
      }
    });
  });

  return Array.from(mapUnique.values());
}
window.obtenerActividadesDeSede = obtenerActividadesDeSede;

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
    if (orgFilter && e.organismo !== orgFilter && !sonOrganismosCoincidentes(e.organismo, orgFilter)) return false;
    if (locFilter && e.localidad !== locFilter) return false;
    if (textFilter) {
      const match = (e.organismo && e.organismo.toLowerCase().includes(textFilter)) ||
                    (e.nombreEstablecimiento && e.nombreEstablecimiento.toLowerCase().includes(textFilter)) ||
                    (e.domicilio && e.domicilio.toLowerCase().includes(textFilter)) ||
                    (e.localidad && e.localidad.toLowerCase().includes(textFilter)) ||
                    (e.nroEstab && String(e.nroEstab).toLowerCase().includes(textFilter)) ||
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
    const acts = obtenerActividadesDeSede(e);
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
window.renderListaEstablecimientos = renderListaEstablecimientos;

function seleccionarEstablecimiento(estId) {
  const est = AppState.establecimientos[estId];
  if (!est) return;

  AppState.establecimientoSeleccionado = est;
  localStorage.setItem(STORAGE_KEYS.CURRENT_EST_ID, estId);

  renderListaEstablecimientos();
  renderFichaEstablecimiento(est);
  renderPanelActividades(est);
}

function deseleccionarEstablecimiento() {
  AppState.establecimientoSeleccionado = null;
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_EST_ID);
  } catch(e) {}

  document.querySelectorAll('.est-card-item').forEach(el => {
    el.classList.remove('active', 'border-blue-600', 'bg-blue-50/70');
  });

  const headerCard = document.getElementById('ficha-header');
  if (headerCard) {
    headerCard.innerHTML = `
      <div class="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
        <div class="w-14 h-14 rounded-2xl bg-blue-100 text-blue-900 mx-auto flex items-center justify-center text-2xl mb-3 shadow-xs">
          <i class="fa-solid fa-building-circle-check"></i>
        </div>
        <h3 class="text-base font-bold text-slate-800">Ningún establecimiento seleccionado</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Seleccioná un establecimiento del directorio de la izquierda para ver su legajo, registrar visitas, mediciones y subir documentos técnicos.
        </p>
      </div>
    `;
  }

  const grid = document.getElementById('grid-actividades');
  if (grid) grid.innerHTML = '';

  const tablaGrilla = document.getElementById('tabla-actividades-grilla-container');
  if (tablaGrilla) {
    tablaGrilla.innerHTML = '';
    tablaGrilla.classList.add('hidden');
  }

  const contActividades = document.getElementById('contenedor-actividades-sede');
  if (contActividades) contActividades.classList.add('hidden');
}
window.deseleccionarEstablecimiento = deseleccionarEstablecimiento;

function renderFichaEstablecimiento(est) {
  const headerCard = document.getElementById('ficha-header');
  if (!headerCard) return;

  const acts = obtenerActividadesDeSede(est);
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

      <div class="flex flex-wrap items-center gap-2.5">
        <button onclick="abrirChecklistRGRL('${est.id}')" class="btn-primary text-xs flex items-center gap-2 shadow-sm">
          <i class="fa-solid fa-clipboard-check"></i>
          <span>Abrir Checklist RGRL</span>
        </button>
        <button onclick="abrirModalCarpetasMensuales()" class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition" title="Ver carpetas mensuales en Drive">
          <i class="fa-solid fa-folder-open text-amber-700"></i>
          <span>Carpetas Mensuales</span>
        </button>
        <button onclick="sincronizarConSheets()" class="btn-secondary text-xs flex items-center gap-2" title="Sincronizar historial con Google Sheets">
          <i class="fa-solid fa-arrows-rotate ${AppState.estaSincronizando ? 'fa-spin' : ''}"></i>
          <span>Sincronizar</span>
        </button>
        <a href="https://docs.google.com/spreadsheets/d/1-eQvCHv3LB6C2ydjY_fXwWEY67e5vbE4GNWIBKSrMfE/edit?gid=540097411#gid=540097411" target="_blank" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-1.5 transition" title="Abrir Archivo Base en Google Sheets">
          <i class="fa-solid fa-file-excel text-emerald-700"></i>
          <span>Archivo Base</span>
        </a>
        <button type="button" onclick="deseleccionarEstablecimiento()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-bold border border-slate-300 hover:border-rose-300 flex items-center gap-1.5 transition cursor-pointer" title="Salir de este establecimiento y limpiar la vista">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          <span>Salir</span>
        </button>
      </div>
    </div>

    <!-- Barra de métricas del establecimiento -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-200/80">
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
      <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-center flex flex-col justify-between">
        <div class="text-[10px] font-bold text-purple-900 uppercase flex items-center justify-center gap-1">
          <i class="fa-solid fa-ruler-combined text-purple-600"></i> Superficie
        </div>
        <div class="text-sm font-black text-slate-900 mt-0.5">
          ${est.superficie ? `${est.superficie} m²` : '<span class="text-amber-700 text-xs font-bold">Sin dato</span>'}
        </div>
        <div class="mt-1 flex items-center justify-center gap-1.5">
          <button onclick="abrirModalEditarSuperficie('${est.id}')" class="text-[10px] font-extrabold text-blue-700 hover:text-blue-900 underline" title="Editar superficie de este establecimiento">
            ${est.superficie ? 'Editar m²' : '+ Cargar m²'}
          </button>
          ${Number(est.superficie) >= 1000 ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800" title="Requiere mediciones obligatorias (PAT, Ruido, Ilum)">⚡ >1000 m²</span>' : ''}
        </div>
      </div>
    </div>
    ${(() => {
      const numSup = Number(est.superficie);
      if (numSup >= 1000) {
        const tienePAT = acts.some(a => normalizarTipoActividad(a.tipoActividad) === 'medicion_pat');
        const tieneRuido = acts.some(a => normalizarTipoActividad(a.tipoActividad) === 'medicion_ruido');
        const tieneIlum = acts.some(a => normalizarTipoActividad(a.tipoActividad) === 'medicion_iluminacion');
        const todasCompletas = tienePAT && tieneRuido && tieneIlum;

        return `
          <div class="mt-3 p-3 rounded-xl border ${todasCompletas ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950'} text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
            <div class="flex items-center gap-2">
              <i class="fa-solid ${todasCompletas ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-amber-600'} text-base"></i>
              <div>
                <strong>Establecimiento con ${numSup} m² (&gt;1.000 m²):</strong> Requiere mediciones técnicas de HyS obligatorias por normativa.
              </div>
            </div>
            <div class="flex items-center gap-2 font-bold text-[11px]">
              <span class="px-2 py-0.5 rounded-full ${tienePAT ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}">PAT: ${tienePAT ? '✓ Realizada' : 'Pendiente'}</span>
              <span class="px-2 py-0.5 rounded-full ${tieneRuido ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}">Ruido: ${tieneRuido ? '✓ Realizada' : 'Pendiente'}</span>
              <span class="px-2 py-0.5 rounded-full ${tieneIlum ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}">Ilum: ${tieneIlum ? '✓ Realizada' : 'Pendiente'}</span>
            </div>
          </div>
        `;
      }
      return '';
    })()}
  `;
}

function obtenerUltimaFechaVisita(acts) {
  if (!acts || acts.length === 0) return 'Sin registros';
  const dates = acts.map(a => convertirDdmmaaaAIso(a.fechaActividad) || a.fechaActividad).filter(f => !!f);
  if (dates.length === 0) return 'Sin fecha';
  dates.sort((a, b) => {
    const isoA = convertirDdmmaaaAIso(a) || a;
    const isoB = convertirDdmmaaaAIso(b) || b;
    return (isoB || '').localeCompare(isoA || '');
  });
  return formatearFechaDdmmaaa(dates[0]) || dates[0];
}
window.obtenerUltimaFechaVisita = obtenerUltimaFechaVisita;

function cambiarModoVistaActividades(modo) {
  AppState.vistaActividadesModo = modo;
  try {
    localStorage.setItem('hys_vista_actividades_modo', modo);
  } catch(e) {}
  if (AppState.establecimientoSeleccionado) {
    renderPanelActividades(AppState.establecimientoSeleccionado);
  }
}
window.cambiarModoVistaActividades = cambiarModoVistaActividades;

function buscarActividadDuplicada(estId, tipoActividad, fecha) {
  const est = AppState.establecimientos[estId];
  if (!est) return null;
  const acts = obtenerActividadesDeSede(est);
  const tipoNorm = normalizarTipoActividad(tipoActividad);
  const fechaIso = fecha ? (convertirDdmmaaaAIso(fecha).split('T')[0]) : '';
  if (!fechaIso) return null;

  return acts.find(a => {
    const aTipoNorm = normalizarTipoActividad(a.tipoActividad);
    const aFecha = a.fechaActividad ? (convertirDdmmaaaAIso(a.fechaActividad).split('T')[0]) : '';
    return aTipoNorm === tipoNorm && aFecha === fechaIso;
  });
}
window.buscarActividadDuplicada = buscarActividadDuplicada;

function renderPanelActividades(est) {
  const contActividades = document.getElementById('contenedor-actividades-sede');
  if (contActividades) contActividades.classList.remove('hidden');

  const controls = document.getElementById('actividades-header-controls');
  if (controls) controls.classList.remove('hidden');

  const btnCards = document.getElementById('btn-vista-cards');
  const btnGrilla = document.getElementById('btn-vista-grilla');
  const modo = AppState.vistaActividadesModo || 'cards';

  if (modo === 'grilla') {
    if (btnGrilla) btnGrilla.className = 'px-2.5 py-1 font-bold rounded-md transition flex items-center gap-1 bg-white text-blue-900 shadow-2xs';
    if (btnCards) btnCards.className = 'px-2.5 py-1 font-semibold rounded-md transition flex items-center gap-1 text-slate-600 hover:text-slate-900';
  } else {
    if (btnCards) btnCards.className = 'px-2.5 py-1 font-bold rounded-md transition flex items-center gap-1 bg-white text-blue-900 shadow-2xs';
    if (btnGrilla) btnGrilla.className = 'px-2.5 py-1 font-semibold rounded-md transition flex items-center gap-1 text-slate-600 hover:text-slate-900';
  }

  const actsEst = obtenerActividadesDeSede(est);
  const gridContainer = document.getElementById('grid-actividades');
  const tablaContainer = document.getElementById('tabla-actividades-grilla-container');

  if (modo === 'grilla') {
    if (gridContainer) gridContainer.classList.add('hidden');
    if (tablaContainer) {
      tablaContainer.classList.remove('hidden');
      renderGrillaActividades(est, actsEst, tablaContainer);
    }
  } else {
    if (tablaContainer) tablaContainer.classList.add('hidden');
    if (gridContainer) {
      gridContainer.classList.remove('hidden');
      renderCardsActividades(est, actsEst, gridContainer);
    }
  }
}

function renderCardsActividades(est, actsEst, grid) {
  grid.innerHTML = '';

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

  // Tarjeta: Subida Rápida General por Establecimiento (con OCR)
  const quickUploadCard = document.createElement('div');
  quickUploadCard.className = 'activity-card-quick-upload flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-400 bg-amber-50/40 hover:bg-amber-100/70 hover:border-amber-600 rounded-xl cursor-pointer transition text-center text-amber-900 shadow-xs group';
  quickUploadCard.onclick = () => abrirModalSubidaRapida(est.id);
  quickUploadCard.innerHTML = `
    <div class="w-11 h-11 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition shadow-2xs">
      <i class="fa-solid fa-cloud-arrow-up"></i>
    </div>
    <div class="font-extrabold text-xs text-amber-950">Subida Rápida (OCR)</div>
    <div class="text-[11px] text-amber-800/90 mt-0.5">Elegí el archivo y detecta fecha y tipo</div>
  `;
  grid.appendChild(quickUploadCard);

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

function renderGrillaActividades(est, actsEst, container) {
  if (!container) return;
  container.innerHTML = '';

  const categorias = [
    ...Object.values(CATALOGO_ACTIVIDADES),
    ...AppState.customActivities.map(custom => ({
      id: custom.id,
      codigo: sanitizeText(custom.nombre).toUpperCase(),
      nombre: custom.nombre,
      subtitulo: custom.subtitulo || 'Actividad adicional personalizada',
      icono: '📌',
      color: '#475569',
      permiteMultiples: true
    }))
  ];

  let tbodyRowsHtml = '';

  categorias.forEach(cat => {
    const registros = actsEst.filter(a => {
      const actNorm = normalizarTipoActividad(a.tipoActividad);
      return actNorm === cat.id || a.tipoActividad === cat.id;
    });

    const tieneRegistros = registros.length > 0;
    const ultimoRegistro = tieneRegistros ? registros[registros.length - 1] : null;
    const tieneArchivo = Boolean(ultimoRegistro && (ultimoRegistro.fileUrl || ultimoRegistro.fileName));
    const fileUrlFinal = ultimoRegistro ? (ultimoRegistro.fileUrl || ultimoRegistro.monthFolderUrl || '') : '';

    let estadoTexto = 'Pendiente';
    let estadoBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><i class="fa-regular fa-clock"></i> Pendiente</span>';

    if (tieneRegistros) {
      if (cat.id === 'muestra_agua') {
        const tieneAnalisis = actsEst.some(a => normalizarTipoActividad(a.tipoActividad) === 'analisis_agua');
        if (tieneAnalisis) {
          estadoTexto = 'Muestra + Lab. Completo';
          estadoBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-circle-check"></i> Completo</span>';
        } else {
          estadoTexto = 'Muestra tomada (Espera Lab.)';
          estadoBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300"><i class="fa-solid fa-hourglass-half"></i> En Análisis</span>';
        }
      } else if (ultimoRegistro.estadoActividad === 'No Apto' || ultimoRegistro.estadoActividad === 'Vencido') {
        estadoTexto = ultimoRegistro.estadoActividad;
        estadoBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(estadoTexto)}</span>`;
      } else {
        estadoTexto = ultimoRegistro.estadoActividad || 'Completado';
        estadoBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(estadoTexto)}</span>`;
      }
    }

    const fechaFmt = (ultimoRegistro && ultimoRegistro.fechaActividad) ? formatearFechaDdmmaaa(ultimoRegistro.fechaActividad) : '<span class="text-slate-400 italic">Sin fecha</span>';

    let archivoHtml = '<span class="text-xs text-slate-400 flex items-center gap-1"><i class="fa-regular fa-file"></i> Sin archivo</span>';
    if (tieneArchivo) {
      const nomArchivo = ultimoRegistro.fileName || 'documento.pdf';
      if (fileUrlFinal) {
        archivoHtml = `
          <a href="${fileUrlFinal}" target="_blank" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition max-w-[220px] truncate" title="Abrir en Google Drive: ${escapeHtml(nomArchivo)}">
            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
            <span class="truncate">${escapeHtml(nomArchivo)}</span>
          </a>
        `;
      } else {
        archivoHtml = `
          <span class="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 max-w-[200px] truncate" title="${escapeHtml(nomArchivo)}">
            <i class="fa-regular fa-file-pdf text-red-500"></i>
            <span class="truncate">${escapeHtml(nomArchivo)}</span>
          </span>
        `;
      }
    }

    tbodyRowsHtml += `
      <tr class="hover:bg-blue-50/40 transition border-b border-slate-100">
        <td class="p-3 pl-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-2xs shrink-0" style="background-color: ${cat.color}18; color: ${cat.color};">
              ${cat.icono}
            </div>
            <div>
              <div class="font-bold text-xs text-slate-900">${escapeHtml(cat.nombre)}</div>
              <div class="text-[10px] text-slate-500">${escapeHtml(cat.subtitulo)}</div>
            </div>
          </div>
        </td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
            ${cat.codigo}
          </span>
        </td>
        <td class="p-3 text-center">
          ${estadoBadgeHtml}
        </td>
        <td class="p-3 text-center text-xs font-semibold text-slate-700">
          ${fechaFmt}
        </td>
        <td class="p-3">
          ${archivoHtml}
        </td>
        <td class="p-3 pr-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button type="button" onclick="abrirModalRegistrarActividad('${cat.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer" title="Subir o actualizar documento para esta actividad">
              <i class="fa-solid fa-cloud-arrow-up"></i>
              <span>Subir</span>
            </button>
            ${tieneRegistros ? `
              <button type="button" onclick="abrirModalDocumentosActividad('${cat.id}')" class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer" title="Ver historial de documentos (${registros.length})">
                <i class="fa-solid fa-folder-open"></i> (${registros.length})
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          <th class="p-3 pl-4">Tipo de Actividad / Documento</th>
          <th class="p-3 text-center w-24">Código</th>
          <th class="p-3 text-center w-36">Estado</th>
          <th class="p-3 text-center w-32">Última Fecha</th>
          <th class="p-3 min-w-[200px]">Documento Guardado</th>
          <th class="p-3 pr-4 text-right w-44">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${tbodyRowsHtml}
      </tbody>
    </table>
  `;
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
            <strong class="text-slate-900">${formatearFechaDdmmaaa(ultimoRegistro.fechaActividad)}</strong>
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

  const catNorm = normalizarTipoActividad(catId);
  const acts = obtenerActividadesDeSede(est).filter(a => a.tipoActividad === catId || normalizarTipoActividad(a.tipoActividad) === catNorm);

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
              <i class="fa-regular fa-calendar text-slate-400 mr-1"></i>${formatearFechaDdmmaaa(fAct)}
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
  AppState.actividadesRegistradas[targetEstId] = (AppState.actividadesRegistradas[targetEstId] || []).filter(a => 
    a !== targetItem && a.id !== regId && (!targetItem.id || a.id !== targetItem.id)
  );
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

function actualizarSelectorMesesMatriz() {
  const selectMes = document.getElementById('matriz-filtro-mes');
  if (!selectMes) return;

  const anio = (document.getElementById('matriz-filtro-anio')?.value || AppState.matrizAnio || '2026').trim();
  const currentVal = (document.getElementById('matriz-filtro-mes')?.value || AppState.matrizMes || 'todos').trim();

  // Contar sedes únicas con actividades para cada mes en el año evaluado
  const sedesPorMes = {
    '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
    '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0
  };
  let sedesConActAnio = 0;

  Object.values(AppState.establecimientos).forEach(e => {
    const acts = obtenerActividadesDeSede(e);
    const actsAnio = acts.filter(a => {
      if (anio === 'todos') return true;
      return extraerAnioDeFecha(a.fechaActividad) === anio;
    });

    if (actsAnio.length > 0) {
      sedesConActAnio++;
    }

    const mesesVistosParaSede = new Set();
    actsAnio.forEach(a => {
      const mInfo = parsearAnioMesCliente(a.fechaActividad);
      if (mInfo && mInfo.mes) {
        const mCod = (mInfo.mes < 10 ? '0' : '') + mInfo.mes;
        mesesVistosParaSede.add(mCod);
      }
    });

    mesesVistosParaSede.forEach(mCod => {
      if (sedesPorMes[mCod] !== undefined) {
        sedesPorMes[mCod]++;
      }
    });
  });

  selectMes.innerHTML = '';

  const optTodos = document.createElement('option');
  optTodos.value = 'todos';
  optTodos.textContent = `🗓️ Todo el Año (Anual) - ${sedesConActAnio} sedes`;
  if (currentVal === 'todos') optTodos.selected = true;
  selectMes.appendChild(optTodos);

  for (let m = 1; m <= 12; m++) {
    const mCod = (m < 10 ? '0' : '') + m;
    const count = sedesPorMes[mCod] || 0;
    const opt = document.createElement('option');
    opt.value = mCod;
    opt.textContent = `${mCod} - ${MESES_NOMBRES[m - 1]} (${count} ${count === 1 ? 'sede' : 'sedes'})`;
    if (mCod === currentVal) opt.selected = true;
    selectMes.appendChild(opt);
  }
}
window.actualizarSelectorMesesMatriz = actualizarSelectorMesesMatriz;

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

  actualizarSelectorMesesMatriz();
}

function cambiarFiltroAnioMatriz(val) {
  AppState.matrizAnio = val;
  actualizarSelectorMesesMatriz();
  renderMatrizAnual();
}
window.cambiarFiltroAnioMatriz = cambiarFiltroAnioMatriz;

function cambiarFiltroOrgMatriz(val) {
  AppState.matrizFiltroOrg = val;
  renderMatrizAnual();
}
window.cambiarFiltroOrgMatriz = cambiarFiltroOrgMatriz;

function cambiarFiltroLocMatriz(val) {
  AppState.matrizFiltroLoc = val;
  renderMatrizAnual();
}
window.cambiarFiltroLocMatriz = cambiarFiltroLocMatriz;

function cambiarFiltroMesMatriz(val) {
  AppState.matrizMes = val || 'todos';
  renderMatrizAnual();
}
window.cambiarFiltroMesMatriz = cambiarFiltroMesMatriz;

function cambiarModoVistaMatriz(modo) {
  AppState.matrizModoVista = modo;
  const btnAct = document.getElementById('btn-modo-matriz-act');
  const btnMes = document.getElementById('btn-modo-matriz-mes');
  if (btnAct && btnMes) {
    if (modo === 'meses') {
      btnMes.className = 'px-3 py-1 rounded-md text-xs font-bold transition bg-white text-blue-900 shadow-2xs flex items-center gap-1.5';
      btnAct.className = 'px-3 py-1 rounded-md text-xs font-bold transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
    } else {
      btnAct.className = 'px-3 py-1 rounded-md text-xs font-bold transition bg-white text-blue-900 shadow-2xs flex items-center gap-1.5';
      btnMes.className = 'px-3 py-1 rounded-md text-xs font-bold transition text-slate-600 hover:text-slate-900 flex items-center gap-1.5';
    }
  }
  renderMatrizAnual();
}
window.cambiarModoVistaMatriz = cambiarModoVistaMatriz;

function cambiarFiltroDocsMatriz(val) {
  AppState.matrizFiltroDocs = val;
  renderMatrizAnual();
}
window.cambiarFiltroDocsMatriz = cambiarFiltroDocsMatriz;

function cambiarFiltroTextoMatriz(val) {
  AppState.matrizFiltroTexto = val;
  renderMatrizAnual();
}
window.cambiarFiltroTextoMatriz = cambiarFiltroTextoMatriz;

function renderMatrizAnual() {
  const tbody = document.getElementById('matriz-tabla-body');
  const thead = document.getElementById('matriz-tabla-head');
  const tfoot = document.getElementById('matriz-tabla-foot');
  const counterSpan = document.getElementById('matriz-contador');
  if (!tbody) return;

  const anio = (document.getElementById('matriz-filtro-anio')?.value || AppState.matrizAnio || '2026').trim();
  const mesFiltro = (document.getElementById('matriz-filtro-mes')?.value || AppState.matrizMes || 'todos').trim();
  const modoVista = AppState.matrizModoVista || 'actividades';
  const orgFiltro = (document.getElementById('matriz-filtro-org')?.value || AppState.matrizFiltroOrg || '').trim();
  const locFiltro = (document.getElementById('matriz-filtro-loc')?.value || AppState.matrizFiltroLoc || '').trim();
  const textFiltro = (document.getElementById('matriz-buscar-texto')?.value || AppState.matrizFiltroTexto || '').toLowerCase().trim();
  const docsFiltro = (document.getElementById('matriz-filtro-docs')?.value || AppState.matrizFiltroDocs || '').trim();

  const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // 1. Renderizar cabecera según el modo (Por Actividades Técnicas vs Por Meses Ene-Dic)
  if (thead) {
    if (modoVista === 'meses') {
      let thMesesHtml = '';
      MESES_ABR.forEach((mNombre, idx) => {
        const mCod = (idx + 1 < 10 ? '0' : '') + (idx + 1);
        const esMesActivo = (mesFiltro === mCod);
        thMesesHtml += `<th class="text-center px-2 min-w-[52px] ${esMesActivo ? 'bg-amber-600 text-white font-extrabold' : ''}" title="${MESES_NOMBRES[idx]}">${mNombre}</th>`;
      });

      const thTotalTitle = (mesFiltro !== 'todos')
        ? `Total de actividades en ${MESES_NOMBRES[parseInt(mesFiltro, 10) - 1]}`
        : 'Total de actividades en el año';
      const thTotalLabel = (mesFiltro !== 'todos')
        ? `Total ${MESES_ABR[parseInt(mesFiltro, 10) - 1]}`
        : 'Total';

      thead.innerHTML = `
        <tr>
          <th class="sticky left-0 z-30 bg-[#07253d] w-14">N° Est</th>
          <th class="text-left px-3 min-w-[200px]">Establecimiento</th>
          <th class="text-left px-3 min-w-[160px]">Organismo</th>
          <th class="px-3 min-w-[120px]">Localidad</th>
          <th class="px-2 min-w-[70px] text-center" title="Superficie cubierta en m². Sedes con más de 1.000 m² requieren mediciones técnicas obligatorias">Sup. m²</th>
          ${thMesesHtml}
          <th class="bg-[#07253d] font-black text-center px-3 min-w-[65px]" title="${thTotalTitle}">${thTotalLabel}</th>
          <th class="bg-[#07253d] text-right px-3 min-w-[70px]">Acción</th>
        </tr>
      `;
    } else {
      const thTotalTitle = (mesFiltro !== 'todos')
        ? `Total de actividades en ${MESES_NOMBRES[parseInt(mesFiltro, 10) - 1]}`
        : 'Total del período';
      const thTotalLabel = (mesFiltro !== 'todos')
        ? `Total ${MESES_ABR[parseInt(mesFiltro, 10) - 1]}`
        : 'Total';

      thead.innerHTML = `
        <tr>
          <th class="sticky left-0 z-30 bg-[#07253d] w-14">N° Est</th>
          <th class="text-left px-3 min-w-[200px]">Establecimiento</th>
          <th class="text-left px-3 min-w-[160px]">Organismo</th>
          <th class="px-3 min-w-[120px]">Localidad</th>
          <th class="px-2 min-w-[70px] text-center" title="Superficie cubierta en m². Sedes con más de 1.000 m² requieren mediciones técnicas obligatorias">Sup. m²</th>
          <th title="Constancia de Visita Oficial (CV firmado in situ)">CV</th>
          <th title="Informe Técnico de Relevamiento / Visita">Informe</th>
          <th title="Confección de RGRL (Dec. 351/79)">RGRL</th>
          <th title="Confección de RAR (Nómina expuestos SRT)">RAR</th>
          <th title="Muestra de Agua (Toma in situ)">Agua Toma</th>
          <th title="Análisis de Agua (Protocolo Laboratorio)">Agua Lab</th>
          <th title="Medición de Puesta a Tierra (Res. SRT 900/15)">PAT</th>
          <th title="Medición de Ruido (Res. SRT 85/12)">Ruido</th>
          <th title="Medición de Iluminación (Res. SRT 84/12)">Ilum</th>
          <th title="Ergonomía Res. 886/15 SRT">Res 886</th>
          <th title="Capacitaciones HyS dictadas">Capacit.</th>
          <th title="Evaluación de Carga de Fuego">Carga Fuego</th>
          <th title="Simulacros de Evacuación">Simulacro</th>
          <th class="bg-[#07253d] font-black text-center px-3" title="${thTotalTitle}">${thTotalLabel}</th>
          <th class="bg-[#07253d] text-right px-3">Acción</th>
        </tr>
      `;
    }
  }

  // 2. Filtrar establecimientos por texto, organismo y localidad
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

  // Métricas del resumen en cabecera y acumuladores del pie de tabla (tfoot)
  let totalActividadesPeriodo = 0;
  let sedesMostradas = 0;
  const totalesPorColumna = {};
  Object.keys(CATALOGO_ACTIVIDADES).forEach(k => totalesPorColumna[k] = 0);
  const totalesPorMesColumna = {
    '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
    '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0
  };

  tbody.innerHTML = '';
  if (tfoot) tfoot.innerHTML = '';

  const totalCols = (modoVista === 'meses') ? 19 : 20;

  if (establecimientosFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${totalCols}" class="text-center py-10 text-slate-400 text-xs font-semibold">
          No se encontraron sedes que coincidan con los filtros aplicados.
        </td>
      </tr>
    `;
    if (counterSpan) {
      counterSpan.textContent = `Mostrando 0 de ${Object.keys(AppState.establecimientos).length} sedes (${anio === 'todos' ? 'Histórico' : 'Año ' + anio})`;
    }
    actualizarKPIsMatriz(0, 0, 0, mesFiltro, anio);
    return;
  }

  establecimientosFiltrados.forEach(e => {
    const acts = obtenerActividadesDeSede(e);
    
    // Filtrar actividades correspondientes al año seleccionado
    const actsDelAnio = acts.filter(a => {
      if (anio === 'todos') return true;
      const anioAct = extraerAnioDeFecha(a.fechaActividad);
      return anioAct === anio;
    });

    // Actividades específicas del período / mes seleccionado
    const actsPeriodo = actsDelAnio.filter(a => {
      if (mesFiltro === 'todos') return true;
      const mInfo = parsearAnioMesCliente(a.fechaActividad);
      if (!mInfo || !mInfo.mes) return false;
      const mKey = (mInfo.mes < 10 ? '0' : '') + mInfo.mes;
      return mKey === mesFiltro;
    });

    // REGLA FUNDAMENTAL DE PERÍODO:
    // Si se filtra por un mes específico, descartar INMEDIATAMENTE toda sede que no tenga actividades en ese mes
    if (mesFiltro !== 'todos') {
      if (docsFiltro === 'sin_docs') {
        if (actsPeriodo.length > 0) return;
      } else {
        if (actsPeriodo.length === 0) return;
      }
    }
    // Si se evalúa el año consolidado con 'con_docs', descartar si no tiene actividades en el año
    if (mesFiltro === 'todos' && docsFiltro === 'con_docs' && actsDelAnio.length === 0) {
      return;
    }

    // Conteo por cada actividad técnica en el período evaluado
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

    // Conteo por cada mes del año (para la vista mensual Ene-Dic)
    const conteoMesSede = {
      '01': [], '02': [], '03': [], '04': [], '05': [], '06': [],
      '07': [], '08': [], '09': [], '10': [], '11': [], '12': []
    };
    actsDelAnio.forEach(a => {
      const mInfo = parsearAnioMesCliente(a.fechaActividad);
      if (mInfo && mInfo.mes) {
        const mCod = (mInfo.mes < 10 ? '0' : '') + mInfo.mes;
        if (conteoMesSede[mCod]) {
          conteoMesSede[mCod].push(a);
        }
      }
    });

    // Total de actividades de la sede en el período
    let totalSedePeriodo = (modoVista === 'meses' && mesFiltro === 'todos')
      ? actsDelAnio.length
      : actsPeriodo.length;

    let sumaActividadesCatalogo = 0;
    Object.keys(CATALOGO_ACTIVIDADES).forEach(k => {
      sumaActividadesCatalogo += (conteoSede[k] || 0);
    });
    if (modoVista === 'actividades' && sumaActividadesCatalogo > totalSedePeriodo) {
      totalSedePeriodo = sumaActividadesCatalogo;
    }

    // REGLA 2: Filtro por Estado / Documentos específicos y Superficie
    if (docsFiltro === 'sup_mayor_1000') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup < 1000) return;
    } else if (docsFiltro === 'sup_menor_1000') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup >= 1000) return;
    } else if (docsFiltro === 'sup_sin_dato') {
      const sup = Number(e.superficie);
      if (sup && !isNaN(sup) && sup > 0) return;
    } else if (docsFiltro === 'sup_mayor_1000_sin_med') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup < 1000) return;
      const tieneMedicion = acts.some(a => {
        const actNorm = normalizarTipoActividad(a.tipoActividad);
        return actNorm === 'medicion_pat' || actNorm === 'medicion_ruido' || actNorm === 'medicion_iluminacion';
      });
      if (tieneMedicion) return;
    } else if (docsFiltro === 'sup_mayor_1000_con_med') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup < 1000) return;
      const tieneMedicion = acts.some(a => {
        const actNorm = normalizarTipoActividad(a.tipoActividad);
        return actNorm === 'medicion_pat' || actNorm === 'medicion_ruido' || actNorm === 'medicion_iluminacion';
      });
      if (!tieneMedicion) return;
    } else if (docsFiltro === 'con_docs') {
      if (totalSedePeriodo <= 0) return;
    } else if (docsFiltro === 'sin_docs') {
      if (totalSedePeriodo > 0) return;
    } else if (docsFiltro.startsWith('con_')) {
      const actTarget = docsFiltro.replace('con_', '');
      const countPeriodo = conteoSede[actTarget] || 0;
      if (countPeriodo <= 0) return;
    } else if (docsFiltro.startsWith('sin_')) {
      const actTarget = docsFiltro.replace('sin_', '');
      const countPeriodo = conteoSede[actTarget] || 0;
      if (countPeriodo > 0) return;
    }

    sedesMostradas++;
    totalActividadesPeriodo += totalSedePeriodo;

    // Acumular columnas para el pie de tabla (tfoot)
    Object.keys(CATALOGO_ACTIVIDADES).forEach(k => {
      totalesPorColumna[k] += (conteoSede[k] || 0);
    });
    for (let m = 1; m <= 12; m++) {
      const mCod = (m < 10 ? '0' : '') + m;
      totalesPorMesColumna[mCod] += (conteoMesSede[mCod] || []).length;
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-blue-50/40 border-b border-slate-100 text-xs transition cursor-pointer';
    tr.onclick = (event) => {
      if (event.target.tagName !== 'BUTTON' && event.target.tagName !== 'A' && !event.target.closest('button') && !event.target.closest('a')) {
        irAFichaEstablecimiento(e.id);
      }
    };

    let supBadge = '';
    const numSup = Number(e.superficie);
    if (!numSup || isNaN(numSup) || numSup <= 0) {
      supBadge = `<button onclick="abrirModalEditarSuperficie('${e.id}'); event.stopPropagation();" class="text-[10px] text-slate-400 hover:text-blue-700 hover:bg-blue-50 px-1.5 py-0.5 rounded border border-dashed border-slate-300 font-mono transition" title="Sin dato de m². Click para ingresar">+ m²</button>`;
    } else if (numSup >= 1000) {
      supBadge = `<button onclick="abrirModalEditarSuperficie('${e.id}'); event.stopPropagation();" class="text-[11px] text-purple-900 bg-purple-100 hover:bg-purple-200 px-1.5 py-0.5 rounded font-black border border-purple-300 flex items-center justify-center gap-1 mx-auto transition" title="Superficie: ${numSup} m² (Requiere Mediciones Obligatorias: PAT, Ruido, Ilum). Click para editar"><i class="fa-solid fa-bolt text-[9px] text-purple-600"></i> ${numSup}</button>`;
    } else {
      supBadge = `<button onclick="abrirModalEditarSuperficie('${e.id}'); event.stopPropagation();" class="text-[11px] text-slate-700 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded font-bold border border-slate-200 mx-auto transition" title="Superficie: ${numSup} m² (<1000 m²). Click para editar">${numSup}</button>`;
    }

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
      <td class="py-2.5 px-2 text-center whitespace-nowrap">
        ${supBadge}
      </td>
    `;

    if (modoVista === 'meses') {
      // Columnas mensuales de Enero a Diciembre
      for (let m = 1; m <= 12; m++) {
        const mCod = (m < 10 ? '0' : '') + m;
        const actsMes = conteoMesSede[mCod] || [];
        const count = actsMes.length;
        const esMesActivo = (mesFiltro === mCod);
        let badgeHtml = '';

        if (count === 0) {
          badgeHtml = `<span class="text-slate-300 font-mono text-[11px]">-</span>`;
        } else {
          const titulosActs = actsMes.map(a => {
            const cat = CATALOGO_ACTIVIDADES[normalizarTipoActividad(a.tipoActividad)] || { nombre: a.tipoActividad };
            return `${cat.nombre} (${formatearFechaDdmmaaa(a.fechaActividad)})`;
          }).join('\n• ');

          if (count === 1) {
            badgeHtml = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs shadow-xs hover:scale-110 transition cursor-help" title="• ${escapeHtml(titulosActs)}">1</span>`;
          } else {
            badgeHtml = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-900 font-extrabold text-xs shadow-xs hover:scale-110 transition cursor-help" title="• ${escapeHtml(titulosActs)}">${count}</span>`;
          }
        }

        cellsHtml += `<td class="py-2.5 px-2 text-center whitespace-nowrap ${esMesActivo ? 'bg-amber-50/70 border-x border-amber-200' : ''}">${badgeHtml}</td>`;
      }

      // Columna Total (Total del mes seleccionado si hay mesFiltro, o Total Anual si es 'todos')
      cellsHtml += `
        <td class="py-2.5 px-3 text-center font-black whitespace-nowrap ${totalSedePeriodo > 0 ? 'text-blue-900 bg-blue-50/50' : 'text-slate-300'}">
          ${totalSedePeriodo}
        </td>
      `;
    } else {
      // Columnas por actividades técnicas
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

      // Columna Total del período
      cellsHtml += `
        <td class="py-2.5 px-3 text-center font-black whitespace-nowrap ${totalSedePeriodo > 0 ? 'text-blue-900 bg-blue-50/50' : 'text-slate-300'}">
          ${totalSedePeriodo}
        </td>
      `;
    }

    // Columna de Acciones rápidas
    cellsHtml += `
      <td class="py-2.5 px-3 text-right whitespace-nowrap">
        <button onclick="abrirModalSubidaRapida('${e.id}'); event.stopPropagation();" class="text-xs text-amber-600 hover:text-amber-800 font-semibold p-1 hover:bg-amber-100 rounded mr-1" title="Subida rápida (OCR) para esta sede">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </button>
        <button onclick="irAFichaEstablecimiento('${e.id}')" class="text-xs text-blue-700 hover:text-blue-900 font-semibold p-1 hover:bg-blue-100 rounded" title="Abrir Ficha de la sede">
          <i class="fa-solid fa-arrow-right"></i>
        </button>
      </td>
    `;

    tr.innerHTML = cellsHtml;
    tbody.appendChild(tr);
  });

  // Renderizar Pie de Tabla con Totales Acumulados
  if (tfoot) {
    if (sedesMostradas === 0) {
      tfoot.innerHTML = '';
    } else if (modoVista === 'meses') {
      let tdMesesHtml = '';
      for (let m = 1; m <= 12; m++) {
        const mCod = (m < 10 ? '0' : '') + m;
        const esMesActivo = (mesFiltro === mCod);
        const cVal = totalesPorMesColumna[mCod] || 0;
        tdMesesHtml += `<td class="py-2.5 px-2 text-center font-bold whitespace-nowrap ${esMesActivo ? 'bg-amber-600 text-white font-extrabold' : ''}">${cVal}</td>`;
      }
      const txtSedesFilas = (sedesMostradas === 1) ? '1 sede (1 fila)' : `${sedesMostradas} sedes (${sedesMostradas} filas)`;
      tfoot.innerHTML = `
        <tr class="bg-[#07253d] text-white font-extrabold border-t-2 border-slate-700 shadow-md">
          <td class="sticky left-0 z-30 bg-[#07253d] text-center font-black py-2.5 px-3">TOTAL</td>
          <td class="py-2.5 px-3 text-amber-300 font-black truncate" colspan="4">${txtSedesFilas}</td>
          ${tdMesesHtml}
          <td class="text-center py-2.5 px-3 bg-[#051c2e] text-amber-300 font-black text-sm whitespace-nowrap">${totalActividadesPeriodo}</td>
          <td class="text-right py-2.5 px-3">-</td>
        </tr>
      `;
    } else {
      let tdActsHtml = '';
      Object.keys(CATALOGO_ACTIVIDADES).forEach(k => {
        const cVal = totalesPorColumna[k] || 0;
        tdActsHtml += `<td class="py-2.5 px-2 text-center font-bold whitespace-nowrap ${cVal > 0 ? 'text-emerald-300' : 'text-slate-400'}">${cVal}</td>`;
      });
      const txtSedesFilas = (sedesMostradas === 1) ? '1 sede (1 fila)' : `${sedesMostradas} sedes (${sedesMostradas} filas)`;
      tfoot.innerHTML = `
        <tr class="bg-[#07253d] text-white font-extrabold border-t-2 border-slate-700 shadow-md">
          <td class="sticky left-0 z-30 bg-[#07253d] text-center font-black py-2.5 px-3">TOTAL</td>
          <td class="py-2.5 px-3 text-amber-300 font-black truncate" colspan="4">${txtSedesFilas}</td>
          ${tdActsHtml}
          <td class="text-center py-2.5 px-3 bg-[#051c2e] text-amber-300 font-black text-sm whitespace-nowrap">${totalActividadesPeriodo}</td>
          <td class="text-right py-2.5 px-3">-</td>
        </tr>
      `;
    }
  }

  const modoTxt = (modoVista === 'meses') ? ' (Evolución Mensual Ene-Dic)' : ' (Por Actividades Técnicas)';

  if (counterSpan) {
    if (mesFiltro !== 'todos') {
      const mesNombre = MESES_NOMBRES[parseInt(mesFiltro, 10) - 1];
      const txtCont = (sedesMostradas === 1) ? '1 de 1 sede (1 fila)' : `${sedesMostradas} de ${sedesMostradas} sedes (${sedesMostradas} filas)`;
      counterSpan.textContent = `Mostrando ${txtCont} • Mes ${mesNombre} ${anio === 'todos' ? '' : anio}${modoTxt}`;
    } else {
      counterSpan.textContent = `Mostrando ${sedesMostradas} de ${establecimientosFiltrados.length} sedes (${anio === 'todos' ? 'Histórico Completo' : 'Año ' + anio} • Consolidado Anual)${modoTxt}`;
    }
  }

  if (sedesMostradas === 0) {
    const mesTxtEmpty = (mesFiltro !== 'todos')
      ? ` en el mes de ${MESES_NOMBRES[parseInt(mesFiltro, 10) - 1]}`
      : '';
    tbody.innerHTML = `
      <tr>
        <td colspan="${totalCols}" class="text-center py-12 text-slate-400 text-xs font-semibold">
          <i class="fa-regular fa-calendar-xmark text-3xl mb-2 block text-slate-300"></i>
          No se encontraron sedes con actividades registradas${mesTxtEmpty} para los filtros aplicados.
        </td>
      </tr>
    `;
  }

  actualizarKPIsMatriz(totalActividadesPeriodo, sedesMostradas, establecimientosFiltrados.length, mesFiltro, anio, docsFiltro);
}

function calcularMetricasPlanHyS(anio = '2026', mesFiltro = 'todos') {
  const totalSedesProvincia = Object.keys(AppState.establecimientos).length || 452;
  
  let sedesVisitadasTotal = 0;
  let sedesVisitadasAnio = 0;
  const sedesConVisitaAnioSet = new Set();
  const sedesConVisitaTotalSet = new Set();
  
  const visitasPorMes = {
    '01': new Set(), '02': new Set(), '03': new Set(), '04': new Set(),
    '05': new Set(), '06': new Set(), '07': new Set(), '08': new Set(),
    '09': new Set(), '10': new Set(), '11': new Set(), '12': new Set()
  };

  let sedesMayor1000 = 0;
  let sedesMenor1000 = 0;
  let sedesSinDatoM2 = 0;
  let sedesMayor1000ConMediciones = 0;
  let sedesMayor1000SinMediciones = 0;

  Object.values(AppState.establecimientos).forEach(est => {
    const acts = obtenerActividadesDeSede(est);
    if (acts.length > 0) {
      sedesConVisitaTotalSet.add(est.id);
    }
    
    // Actividades del año
    const actsAnio = acts.filter(a => {
      if (anio === 'todos') return true;
      return extraerAnioDeFecha(a.fechaActividad) === anio;
    });

    if (actsAnio.length > 0) {
      sedesConVisitaAnioSet.add(est.id);
      actsAnio.forEach(a => {
        const mInfo = parsearAnioMesCliente(a.fechaActividad);
        if (mInfo && mInfo.mes) {
          const mCod = (mInfo.mes < 10 ? '0' : '') + mInfo.mes;
          if (visitasPorMes[mCod]) {
            visitasPorMes[mCod].add(est.id);
          }
        }
      });
    }

    // Superficie
    const supVal = Number(est.superficie);
    if (!supVal || isNaN(supVal) || supVal <= 0) {
      sedesSinDatoM2++;
    } else if (supVal >= 1000) {
      sedesMayor1000++;
      const tieneMedicion = acts.some(a => {
        const actNorm = normalizarTipoActividad(a.tipoActividad);
        return actNorm === 'medicion_pat' || actNorm === 'medicion_ruido' || actNorm === 'medicion_iluminacion';
      });
      if (tieneMedicion) {
        sedesMayor1000ConMediciones++;
      } else {
        sedesMayor1000SinMediciones++;
      }
    } else {
      sedesMenor1000++;
    }
  });

  sedesVisitadasTotal = sedesConVisitaTotalSet.size;
  sedesVisitadasAnio = sedesConVisitaAnioSet.size;

  return {
    totalSedesProvincia,
    sedesVisitadasTotal,
    sedesVisitadasAnio,
    visitasPorMes,
    sedesMayor1000,
    sedesMenor1000,
    sedesSinDatoM2,
    sedesMayor1000ConMediciones,
    sedesMayor1000SinMediciones
  };
}
window.calcularMetricasPlanHyS = calcularMetricasPlanHyS;

function actualizarKPIsMatriz(totalActs, sedesConAct, totalSedesBase, mesFiltro, anio, docsFiltro = '') {
  const metricas = calcularMetricasPlanHyS(anio, mesFiltro);
  const totalProvincial = metricas.totalSedesProvincia;
  const sedesVisitadasAnio = metricas.sedesVisitadasAnio;

  // 1. CARD 1: STOCK TOTAL PROVINCIAL (Plan 100%)
  const elStockVis = document.getElementById('kpi-stock-visitadas');
  const elStockPct = document.getElementById('kpi-stock-pct');
  const elStockPend = document.getElementById('kpi-stock-pendientes');
  const elStockBar = document.getElementById('kpi-stock-bar');
  if (elStockVis) elStockVis.textContent = sedesVisitadasAnio;
  const pctStock = totalProvincial > 0 ? ((sedesVisitadasAnio / totalProvincial) * 100).toFixed(1) : '0';
  if (elStockPct) elStockPct.textContent = `${pctStock}% cubierto`;
  const pendStock = Math.max(0, totalProvincial - sedesVisitadasAnio);
  if (elStockPend) elStockPend.textContent = `${pendStock} pendientes`;
  if (elStockBar) elStockBar.style.width = `${Math.min(100, parseFloat(pctStock))}%`;

  // 2. CARD 2: AVANCE MENSUAL (Meta 25-30 sedes/mes)
  const elMesTitulo = document.getElementById('kpi-mes-titulo');
  const elMesBadge = document.getElementById('kpi-mes-badge-status');
  const elMesVis = document.getElementById('kpi-mes-visitadas');
  const elMesPct = document.getElementById('kpi-mes-pct');
  const elMesBar = document.getElementById('kpi-mes-bar');

  let visitasMes = 0;
  let labelMes = 'Avance Mensual';
  if (mesFiltro && mesFiltro !== 'todos') {
    const idx = parseInt(mesFiltro, 10) - 1;
    labelMes = `Avance ${MESES_NOMBRES[idx] || 'Mes'}`;
    const mCod = (idx + 1 < 10 ? '0' : '') + (idx + 1);
    visitasMes = (metricas.visitasPorMes[mCod] ? metricas.visitasPorMes[mCod].size : 0);
  } else {
    // Si es todos, tomar el último mes activo del año
    let ultimoMesActivo = 0;
    for (let m = 12; m >= 1; m--) {
      const mCod = (m < 10 ? '0' : '') + m;
      if (metricas.visitasPorMes[mCod] && metricas.visitasPorMes[mCod].size > 0) {
        ultimoMesActivo = m;
        break;
      }
    }
    if (ultimoMesActivo > 0) {
      const mCod = (ultimoMesActivo < 10 ? '0' : '') + ultimoMesActivo;
      visitasMes = metricas.visitasPorMes[mCod].size;
      labelMes = `Últ. Mes (${MESES_NOMBRES[ultimoMesActivo - 1]})`;
    } else {
      visitasMes = 0;
      labelMes = 'Avance Mensual';
    }
  }

  if (elMesTitulo) elMesTitulo.textContent = labelMes;
  if (elMesVis) elMesVis.textContent = visitasMes;
  const pctMes = Math.min(100, Math.round((visitasMes / 25) * 100));
  if (elMesPct) elMesPct.textContent = `${pctMes}% de meta (25-30)`;
  if (elMesBar) elMesBar.style.width = `${pctMes}%`;

  if (elMesBadge) {
    if (visitasMes >= 25) {
      elMesBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
      elMesBadge.textContent = '✓ Meta Cumplida';
    } else if (visitasMes > 0) {
      elMesBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800';
      elMesBadge.textContent = 'Meta: 25-30';
    } else {
      elMesBadge.className = 'text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600';
      elMesBadge.textContent = 'Meta: 25-30';
    }
  }

  // 3. CARD 3: AVANCE ACUMULADO DEL PLAN
  const elAcumVis = document.getElementById('kpi-acum-visitadas');
  const elAcumSub = document.getElementById('kpi-acum-subtitulo');
  const elAcumMeta = document.getElementById('kpi-acum-meta-val');
  const elAcumBadge = document.getElementById('kpi-acum-desvio-badge');
  const elAcumBar = document.getElementById('kpi-acum-bar');

  let mesNumParaAcum = 12;
  if (mesFiltro && mesFiltro !== 'todos') {
    mesNumParaAcum = parseInt(mesFiltro, 10);
  } else {
    const hoy = new Date();
    if (anio === hoy.getFullYear().toString()) {
      mesNumParaAcum = hoy.getMonth() + 1;
    }
  }

  let sedesAcumuladasPeriodo = new Set();
  for (let m = 1; m <= mesNumParaAcum; m++) {
    const mCod = (m < 10 ? '0' : '') + m;
    if (metricas.visitasPorMes[mCod]) {
      metricas.visitasPorMes[mCod].forEach(id => sedesAcumuladasPeriodo.add(id));
    }
  }
  const cantAcum = sedesAcumuladasPeriodo.size;
  const metaMinAcum = mesNumParaAcum * 25;
  const metaMaxAcum = mesNumParaAcum * 30;

  if (elAcumVis) elAcumVis.textContent = cantAcum;
  if (elAcumSub) elAcumSub.textContent = `Meta a Mes ${mesNumParaAcum}`;
  if (elAcumMeta) elAcumMeta.textContent = `${metaMinAcum} - ${metaMaxAcum} sedes`;
  
  const pctAcum = metaMinAcum > 0 ? Math.min(100, Math.round((cantAcum / metaMinAcum) * 100)) : 0;
  if (elAcumBar) elAcumBar.style.width = `${pctAcum}%`;

  if (elAcumBadge) {
    if (cantAcum >= metaMinAcum) {
      elAcumBadge.className = 'text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
      elAcumBadge.textContent = '✓ Al día';
    } else if (cantAcum > 0) {
      const desvio = metaMinAcum - cantAcum;
      elAcumBadge.className = 'text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800';
      elAcumBadge.textContent = `-${desvio} sedes`;
    } else {
      elAcumBadge.className = 'text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600';
      elAcumBadge.textContent = 'Sin visitas';
    }
  }

  // 4. CARD 4: SEDES > 1000 m² (MEDICIONES OBLIGATORIAS)
  const elSupConMed = document.getElementById('kpi-sup-con-med');
  const elSupTotal = document.getElementById('kpi-sup-total');
  const elSupSinDato = document.getElementById('kpi-sup-sin-dato');
  const elSupBar = document.getElementById('kpi-sup-bar');

  if (elSupConMed) elSupConMed.textContent = metricas.sedesMayor1000ConMediciones;
  if (elSupTotal) elSupTotal.textContent = metricas.sedesMayor1000;
  if (elSupSinDato) {
    if (metricas.sedesSinDatoM2 > 0) {
      elSupSinDato.textContent = `${metricas.sedesSinDatoM2} sin dato de m²`;
      elSupSinDato.className = 'text-amber-700 font-bold';
    } else {
      elSupSinDato.textContent = `${metricas.sedesMayor1000SinMediciones} pendientes de med.`;
      elSupSinDato.className = 'text-purple-700 font-bold';
    }
  }
  const pctSup = metricas.sedesMayor1000 > 0 ? Math.round((metricas.sedesMayor1000ConMediciones / metricas.sedesMayor1000) * 100) : 0;
  if (elSupBar) elSupBar.style.width = `${pctSup}%`;
}

function irAFichaEstablecimiento(estId) {
  cambiarModulo('ficha');
  seleccionarEstablecimiento(estId);
}

// Exportación a Excel / CSV con BOM adaptada a modo Actividades o Mensual
function exportarMatrizCSV() {
  const anio = (document.getElementById('matriz-filtro-anio')?.value || AppState.matrizAnio || '2026').trim();
  const mesFiltro = (document.getElementById('matriz-filtro-mes')?.value || AppState.matrizMes || 'todos').trim();
  const modoVista = AppState.matrizModoVista || 'actividades';
  const orgFiltro = (document.getElementById('matriz-filtro-org')?.value || AppState.matrizFiltroOrg || '').trim();
  const locFiltro = (document.getElementById('matriz-filtro-loc')?.value || AppState.matrizFiltroLoc || '').trim();
  const textFiltro = (document.getElementById('matriz-buscar-texto')?.value || AppState.matrizFiltroTexto || '').toLowerCase().trim();
  const docsFiltro = (document.getElementById('matriz-filtro-docs')?.value || AppState.matrizFiltroDocs || '').trim();

  const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const establecimientos = Object.values(AppState.establecimientos).filter(e => {
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

  let filas = [];
  establecimientos.forEach(e => {
    const acts = obtenerActividadesDeSede(e);
    const actsDelAnio = acts.filter(a => {
      if (anio === 'todos') return true;
      return extraerAnioDeFecha(a.fechaActividad) === anio;
    });

    const actsPeriodo = actsDelAnio.filter(a => {
      if (mesFiltro === 'todos') return true;
      const mInfo = parsearAnioMesCliente(a.fechaActividad);
      if (!mInfo || !mInfo.mes) return false;
      const mKey = (mInfo.mes < 10 ? '0' : '') + mInfo.mes;
      return mKey === mesFiltro;
    });

    // Filtro estricto inmediato por mes
    if (mesFiltro !== 'todos') {
      if (docsFiltro === 'sin_docs') {
        if (actsPeriodo.length > 0) return;
      } else {
        if (actsPeriodo.length === 0) return;
      }
    }
    if (mesFiltro === 'todos' && docsFiltro === 'con_docs' && actsDelAnio.length === 0) {
      return;
    }

    // Total de actividades de la sede en el período
    let totalSedePeriodo = actsPeriodo.length;
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
    let sumaActividadesCatalogo = 0;
    Object.keys(CATALOGO_ACTIVIDADES).forEach(k => {
      sumaActividadesCatalogo += (conteoSede[k] || 0);
    });
    if (modoVista === 'actividades' && sumaActividadesCatalogo > totalSedePeriodo) {
      totalSedePeriodo = sumaActividadesCatalogo;
    }

    // Filtro estricto por mes
    if (mesFiltro !== 'todos') {
      if (docsFiltro === 'sin_docs') {
        if (totalSedePeriodo > 0) return;
      } else {
        if (totalSedePeriodo === 0) return;
      }
    }

    // Filtros de Superficie y Mediciones Requeridas
    if (docsFiltro === 'sup_mayor_1000') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup < 1000) return;
    } else if (docsFiltro === 'sup_menor_1000') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup >= 1000) return;
    } else if (docsFiltro === 'sup_sin_dato') {
      const sup = Number(e.superficie);
      if (sup && !isNaN(sup) && sup > 0) return;
    } else if (docsFiltro === 'sup_mayor_1000_sin_med') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup < 1000) return;
      const tieneMedicion = acts.some(a => {
        const actNorm = normalizarTipoActividad(a.tipoActividad);
        return actNorm === 'medicion_pat' || actNorm === 'medicion_ruido' || actNorm === 'medicion_iluminacion';
      });
      if (tieneMedicion) return;
    } else if (docsFiltro === 'sup_mayor_1000_con_med') {
      const sup = Number(e.superficie);
      if (!sup || isNaN(sup) || sup < 1000) return;
      const tieneMedicion = acts.some(a => {
        const actNorm = normalizarTipoActividad(a.tipoActividad);
        return actNorm === 'medicion_pat' || actNorm === 'medicion_ruido' || actNorm === 'medicion_iluminacion';
      });
      if (!tieneMedicion) return;
    } else if (docsFiltro === 'con_docs') {
      if (totalSedePeriodo <= 0) return;
    } else if (docsFiltro === 'sin_docs') {
      if (totalSedePeriodo > 0) return;
    } else if (docsFiltro.startsWith('con_')) {
      const actTarget = docsFiltro.replace('con_', '');
      const countTarget = conteoSede[actTarget] || 0;
      if (countTarget <= 0) return;
    } else if (docsFiltro.startsWith('sin_')) {
      const actTarget = docsFiltro.replace('sin_', '');
      const countTarget = conteoSede[actTarget] || 0;
      if (countTarget > 0) return;
    }

    filas.push({ e, actsDelAnio, actsPeriodo });
  });

  let headers = [];
  if (modoVista === 'meses') {
    headers = [
      'N° Estab',
      'Organismo',
      'Nombre Establecimiento',
      'Localidad',
      'Superficie (m²)',
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
      mesFiltro !== 'todos' ? `Total ${MESES_ABR[parseInt(mesFiltro, 10) - 1]}` : 'Total Anual Realizado'
    ];
  } else {
    const activityHeaders = Object.values(CATALOGO_ACTIVIDADES).map(cat => cat.nombre);
    headers = [
      'N° Estab',
      'Organismo',
      'Nombre Establecimiento',
      'Localidad',
      'Superficie (m²)',
      ...activityHeaders,
      mesFiltro !== 'todos' ? `Total ${MESES_ABR[parseInt(mesFiltro, 10) - 1]}` : 'Total Período'
    ];
  }

  let csvContent = '\uFEFF';
  csvContent += headers.map(h => `"${h}"`).join(';') + '\r\n';

  let totalGeneralActs = 0;

  filas.forEach(({ e, actsDelAnio, actsPeriodo }) => {
    if (modoVista === 'meses') {
      const conteoMesSede = {
        '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
        '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0
      };
      actsDelAnio.forEach(a => {
        const mInfo = parsearAnioMesCliente(a.fechaActividad);
        if (mInfo && mInfo.mes) {
          const mCod = (mInfo.mes < 10 ? '0' : '') + mInfo.mes;
          if (conteoMesSede[mCod] !== undefined) {
            conteoMesSede[mCod]++;
          }
        }
      });

      const totalFila = (mesFiltro !== 'todos') ? actsPeriodo.length : actsDelAnio.length;
      totalGeneralActs += totalFila;

      const row = [
        e.nroEstab || '',
        e.organismo || '',
        e.nombreEstablecimiento || '',
        e.localidad || '',
        e.superficie || '',
        conteoMesSede['01'], conteoMesSede['02'], conteoMesSede['03'], conteoMesSede['04'],
        conteoMesSede['05'], conteoMesSede['06'], conteoMesSede['07'], conteoMesSede['08'],
        conteoMesSede['09'], conteoMesSede['10'], conteoMesSede['11'], conteoMesSede['12'],
        totalFila
      ];
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\r\n';
    } else {
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

      const totalFila = actsPeriodo.length;
      totalGeneralActs += totalFila;

      const row = [
        e.nroEstab || '',
        e.organismo || '',
        e.nombreEstablecimiento || '',
        e.localidad || '',
        e.superficie || '',
        ...Object.keys(CATALOGO_ACTIVIDADES).map(k => conteoSede[k] || 0),
        totalFila
      ];
      csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\r\n';
    }
  });

  // Fila de resumen de totales al final del CSV
  const resumenRow = [
    'TOTAL',
    `${filas.length} sedes / filas`,
    '-',
    '-',
    '-'
  ];
  if (modoVista === 'meses') {
    for (let i = 0; i < 12; i++) resumenRow.push('');
  } else {
    Object.keys(CATALOGO_ACTIVIDADES).forEach(() => resumenRow.push(''));
  }
  resumenRow.push(totalGeneralActs);
  csvContent += resumenRow.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\r\n';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const sufijoModo = modoVista === 'meses' ? 'Mensual_Ene_Dic' : (mesFiltro !== 'todos' ? `Mes_${mesFiltro}` : 'Anual');
  link.setAttribute('download', `Matriz_Cumplimiento_HyS_${anio}_${sufijoModo}_IAPSER.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  mostrarToast(`Matriz exportada (${filas.length} filas / sedes).`);
}
window.exportarMatrizCSV = exportarMatrizCSV;

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
        ${formatearFechaDdmmaaa(r.fechaActividad)}
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
      actualizarSelectorMesesMatriz();
      renderMatrizAnual();
    });
  }

  const matrizMesSelect = document.getElementById('matriz-filtro-mes');
  if (matrizMesSelect) {
    matrizMesSelect.addEventListener('change', (e) => {
      AppState.matrizMes = e.target.value || 'todos';
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

  const matrizDocsSelect = document.getElementById('matriz-filtro-docs');
  if (matrizDocsSelect) {
    matrizDocsSelect.addEventListener('change', (e) => {
      AppState.matrizFiltroDocs = e.target.value;
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
  if (modalId === 'modal-registro-actividad') {
    resetUploaderUI();
    archivoSeleccionadoBase64 = null;
    archivoSeleccionadoMeta = null;
  }
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

  // Normalizar caracteres comunes en OCR de casilleros y formularios
  let clean = fullText
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/[—_]/g, '-');

  // Separadores comunes entre casilleros: barra /, guión -, punto ., barra vertical |, o espacios
  const sep = '(?:[\\/\\-\\.\\|\\s]+)';

  // 1. Patrón con contexto (fecha, visita, relevamiento, acta, servicio, etc.)
  // Detecta años de 4 dígitos (2020-2030) o 2 dígitos (24-30 -> 202X)
  const regexConContexto = new RegExp(
    '(?:fecha|visita|relevamiento|acta|emisi[oó]n|d[ií]a|servicio|recorrida|inspecci[oó]n)[^\\d]{0,35}' +
    '([0-2]?[0-9]|3[01])' + sep + '(0?[1-9]|1[0-2])' + sep + '(202[0-9]|2[4-9])\\b',
    'i'
  );
  let match = clean.match(regexConContexto);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    let y = match[3];
    if (y.length === 2) y = '20' + y;
    if (parseInt(d, 10) >= 1 && parseInt(d, 10) <= 31 && parseInt(m, 10) >= 1 && parseInt(m, 10) <= 12) {
      return `${y}-${m}-${d}`;
    }
  }

  // 2. Patrón en letras: "15 de septiembre de 2026" o "15 de setiembre de 2026"
  const regexLetras = /([0-2]?[0-9]|3[01])\s+(?:d[ií]as\s+del\s+mes\s+de|de)\s+([a-zA-Z]+)\s+(?:del?\s+)?(?:a[ñn]o\s+)?(202[0-9]|2[4-9])/i;
  match = clean.match(regexLetras);
  if (match && meses[match[2].toLowerCase()]) {
    const d = match[1].padStart(2, '0');
    const m = meses[match[2].toLowerCase()];
    let y = match[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  // 3. Patrón numérico general DD/MM/AAAA en cualquier parte del texto
  const regexNum = new RegExp(
    '\\b([0-2]?[0-9]|3[01])' + sep + '(0?[1-9]|1[0-2])' + sep + '(202[0-9]|2[4-9])\\b',
    'i'
  );
  match = clean.match(regexNum);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    let y = match[3];
    if (y.length === 2) y = '20' + y;
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
          const viewport = page1.getViewport({ scale: 2.0 });
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

  const duplicadoExistente = buscarActividadDuplicada(est.id, currentActividadModal, fecha);
  let permitirReemplazo = false;

  if (duplicadoExistente) {
    const catNom = (CATALOGO_ACTIVIDADES[currentActividadModal] && CATALOGO_ACTIVIDADES[currentActividadModal].nombre) || currentActividadModal;
    const fFmt = formatearFechaDdmmaaa(fecha);
    const mensajeDup = `⚠️ ATENCIÓN - DOCUMENTO DUPLICADO DETECTADO:\n\nYa existe registrado un documento de "${catNom}" para la fecha ${fFmt} en esta sede.\n\nArchivo actual: ${duplicadoExistente.fileName || 'Documento existente'}\n\n¿Deseás REEMPLAZAR y actualizar el archivo existente?\n\n• Presioná 'Aceptar' para REEMPLAZAR.\n• Presioná 'Cancelar' para cancelar la subida y modificar la fecha o tipo.`;
    const confirmaReemplazo = confirm(mensajeDup);
    if (!confirmaReemplazo) {
      return;
    }
    permitirReemplazo = true;
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
    permitirReemplazo: permitirReemplazo,
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
    } else if (result && result.status === 'duplicate_warning') {
      alert(`⚠️ Aviso de Duplicado:\n\n${result.message}`);
      if (progressBox) progressBox.classList.add('hidden');
      if (btnSubmit) btnSubmit.disabled = false;
      return;
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

  if (permitirReemplazo && duplicadoExistente) {
    const idx = AppState.actividadesRegistradas[est.id].findIndex(a => a.id === duplicadoExistente.id || (a.fileName && duplicadoExistente.fileName && a.fileName === duplicadoExistente.fileName));
    if (idx >= 0) {
      AppState.actividadesRegistradas[est.id][idx] = nuevoRegistro;
    } else {
      AppState.actividadesRegistradas[est.id].push(nuevoRegistro);
    }
  } else {
    AppState.actividadesRegistradas[est.id].push(nuevoRegistro);
  }
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

// ==================== SUBIDA RÁPIDA GENERAL POR ESTABLECIMIENTO ====================

function detectarTipoActividadDeTexto(texto) {
  if (!texto) return null;
  const t = texto.toLowerCase();

  // 1. Constancia de visita (prioridad alta para formularios de inspección y visita a sedes)
  if (t.includes('constancia de visita') || t.includes('visita - seguridad e higiene') || t.includes('visita seguridad e higiene') || (t.includes('visita') && (t.includes('servicio') || t.includes('informacion del servicio') || t.includes('notificado'))) || t.includes('formulario de visita')) {
    return { id: 'constancia_visita', nombre: 'Constancia de Visita (CV)' };
  }
  // 2. RAR (Relevamiento de Agentes de Riesgo - Prioridad antes de RGRL para no confundir por Res. 463)
  if (/\b(?:confeccion_)?rar\b/i.test(texto) ||
      t.includes('relevamiento de agentes de riesgo') ||
      t.includes('agentes de riesgo') ||
      t.includes('nómina de expuestos') ||
      t.includes('nomina de expuestos') ||
      t.includes('planilla de expuestos') ||
      t.includes('formulario rar') ||
      t.includes('relevamiento rar')) {
    return { id: 'confeccion_rar', nombre: 'Confección de RAR (Nómina de expuestos)' };
  }
  // 3. RGRL (Relevamiento General de Riesgos Laborales)
  if (/\b(?:confeccion_)?rgrl\b/i.test(texto) ||
      t.includes('relevamiento general de riesgos') ||
      t.includes('relevamiento general') ||
      (t.includes('decreto 351') && t.includes('anexo i')) ||
      (t.includes('463') && (t.includes('general') || t.includes('anexo i')))) {
    return { id: 'confeccion_rgrl', nombre: 'Confección de RGRL (Dec. 351/79)' };
  }
  // 4. Agua Bacteriológico o Fisicoquímico / Protocolo
  if (t.includes('bacteriol') || t.includes('aerobios mesofilos') || t.includes('escherichia coli') || t.includes('pseudomonas') || t.includes('turbiedad') || t.includes('cloro residual') || (t.includes('agua') && t.includes('protocolo')) || t.includes('analisis de agua')) {
    return { id: 'analisis_agua', nombre: 'Análisis de Agua (Protocolo de Laboratorio)' };
  }
  // 5. Muestra de agua
  if ((t.includes('agua') || t.includes('muestreo')) && (t.includes('toma de muestra') || t.includes('cadena de custodia') || t.includes('remision') || t.includes('remisión'))) {
    return { id: 'muestra_agua', nombre: 'Muestra de Agua (Toma in situ)' };
  }
  // 6. Puesta a tierra
  if (t.includes('puesta a tierra') || t.includes('900/15') || t.includes('jabalina') || t.includes('telurimetro') || t.includes('telurímetro') || t.includes('continuidad de masas')) {
    return { id: 'medicion_pat', nombre: 'Puesta a Tierra (PAT - Res. 900/15)' };
  }
  // 7. Ruido
  if (t.includes('nivel sonoro') || t.includes('85/12') || t.includes('decibeles') || t.includes('db(a)') || t.includes('dosimetr') || (t.includes('ruido') && t.includes('protocolo'))) {
    return { id: 'medicion_ruido', nombre: 'Medición de Ruido (Res. 85/12)' };
  }
  // 8. Iluminación
  if (t.includes('lux') || t.includes('84/12') || t.includes('luxometro') || t.includes('luxómetro') || (t.includes('iluminaci') && t.includes('protocolo'))) {
    return { id: 'medicion_iluminacion', nombre: 'Medición de Iluminación (Res. 84/12)' };
  }
  // 9. Ergonomía
  if (t.includes('886/15') || t.includes('ergonom') || t.includes('levantamiento manual') || t.includes('trastornos musculoesqueleticos')) {
    return { id: 'res_886', nombre: 'Ergonomía Res. 886/15 SRT' };
  }
  // 10. Capacitaciones
  if (t.includes('capacita') || t.includes('temario') || (t.includes('asistentes') && t.includes('firma')) || t.includes('entrenamiento')) {
    return { id: 'capacitaciones', nombre: 'Capacitaciones' };
  }
  // 11. Informe técnico
  if (t.includes('informe tecnico') || t.includes('informe técnico') || t.includes('desvios detectados') || t.includes('desvíos')) {
    return { id: 'informe_tecnico', nombre: 'Informe Técnico' };
  }

  return null;
}

// ==================== SUBIDA RÁPIDA POR LOTE CON OCR ====================

let fastBatchItems = [];
let fastEstIdActual = null;
let fastIsUploading = false;

function abrirModalSubidaRapida(estId) {
  const modal = document.getElementById('modal-subida-rapida-general');
  if (!modal) return;

  // Determinar sede destino inicial
  let targetId = estId || (AppState.establecimientoSeleccionado ? AppState.establecimientoSeleccionado.id : null);
  if (!targetId || !AppState.establecimientos[targetId]) {
    targetId = Object.keys(AppState.establecimientos)[0];
  }
  fastEstIdActual = targetId;

  // Limpiar buscador y poblar selector de sedes
  const inputBuscar = document.getElementById('fast-buscar-estab');
  if (inputBuscar) inputBuscar.value = '';
  poblarSelectEstablecimientosFast(targetId, '');

  // Resetear input de archivo
  const fileInput = document.getElementById('fast-file-input');
  if (fileInput) fileInput.value = '';

  // Preventor responsable por defecto
  const inputPrev = document.getElementById('fast-preventor-batch');
  if (inputPrev) inputPrev.value = localStorage.getItem('hys_ultimo_preventor') || '';

  const inputObs = document.getElementById('fast-obs-batch');
  if (inputObs) inputObs.value = '';

  const progBox = document.getElementById('fast-upload-progress-box');
  if (progBox) progBox.classList.add('hidden');

  // Configurar zona drag & drop
  configurarDragAndDropFast();

  // Renderizar la lista de documentos en lote
  renderFastBatchList();

  modal.classList.remove('hidden');
}
window.abrirModalSubidaRapida = abrirModalSubidaRapida;

function configurarDragAndDropFast() {
  const dropzone = document.getElementById('fast-dropzone');
  if (!dropzone || dropzone.dataset.dndInit) return;
  dropzone.dataset.dndInit = 'true';

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('border-blue-500', 'bg-blue-100/60');
    }, false);
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('border-blue-500', 'bg-blue-100/60');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt ? dt.files : null;
    if (files && files.length > 0) {
      manejarArchivosSubidaRapida(files);
    }
  }, false);
}

function filtrarSelectEstablecimientosFast(query) {
  poblarSelectEstablecimientosFast(fastEstIdActual, query);
}
window.filtrarSelectEstablecimientosFast = filtrarSelectEstablecimientosFast;

function poblarSelectEstablecimientosFast(selectedId, query = '') {
  const sel = document.getElementById('fast-select-estab');
  const countBadge = document.getElementById('fast-estab-count-badge');
  if (!sel) return;
  sel.innerHTML = '';

  const q = (query || '').toLowerCase().trim();
  const allEsts = Object.values(AppState.establecimientos);
  const filtrados = allEsts.filter(e => {
    if (!q) return true;
    const matchName = e.nombreEstablecimiento && e.nombreEstablecimiento.toLowerCase().includes(q);
    const matchOrg = e.organismo && e.organismo.toLowerCase().includes(q);
    const matchLoc = e.localidad && e.localidad.toLowerCase().includes(q);
    const matchNro = e.nroEstab && e.nroEstab.toString().includes(q);
    const matchDom = e.domicilio && e.domicilio.toLowerCase().includes(q);
    return matchName || matchOrg || matchLoc || matchNro || matchDom;
  });

  if (countBadge) {
    countBadge.textContent = `${filtrados.length} sedes`;
  }

  if (filtrados.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No se encontraron sedes coincidentes';
    sel.appendChild(opt);
    actualizarSedeHeaderFast();
    return;
  }

  let idEncontrado = false;
  filtrados.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.nroEstab ? '#' + e.nroEstab + ' - ' : ''}${e.nombreEstablecimiento} (${e.organismo} | ${e.localidad})`;
    if (e.id === selectedId) {
      opt.selected = true;
      idEncontrado = true;
    }
    sel.appendChild(opt);
  });

  if (!idEncontrado && filtrados.length > 0) {
    fastEstIdActual = filtrados[0].id;
    sel.value = fastEstIdActual;
  }

  actualizarSedeHeaderFast();

  // Actualizar previews de nombres codificados en todos los items del lote
  if (fastBatchItems && fastBatchItems.length > 0) {
    fastBatchItems.forEach(it => actualizarPreviewItemLote(it));
  }
}

function cambiarSedeEnSubidaRapida(newEstId) {
  if (!AppState.establecimientos[newEstId]) return;
  fastEstIdActual = newEstId;
  actualizarSedeHeaderFast();
  if (fastBatchItems && fastBatchItems.length > 0) {
    fastBatchItems.forEach(it => actualizarPreviewItemLote(it));
  }
}
window.cambiarSedeEnSubidaRapida = cambiarSedeEnSubidaRapida;

function actualizarSedeHeaderFast() {
  const est = AppState.establecimientos[fastEstIdActual];
  const infoNom = document.getElementById('fast-info-nombre');
  const infoCuit = document.getElementById('fast-info-cuit');
  const infoLoc = document.getElementById('fast-info-loc');

  if (!est) {
    if (infoNom) infoNom.textContent = 'Seleccioná un establecimiento';
    if (infoCuit) infoCuit.textContent = 'CUIT: -';
    if (infoLoc) infoLoc.textContent = 'Localidad: -';
    return;
  }

  if (infoNom) {
    infoNom.textContent = `${est.nroEstab ? '#' + est.nroEstab + ' - ' : ''}${est.nombreEstablecimiento} (${est.organismo})`;
  }
  if (infoCuit) infoCuit.textContent = `CUIT: ${est.cuit || 'S/D'}`;
  if (infoLoc) infoLoc.textContent = `Localidad: ${est.localidad || 'S/D'}`;
}

function generarOpcionesActividades(selectedId) {
  let opts = '';
  Object.values(CATALOGO_ACTIVIDADES).forEach(cat => {
    const isSel = (cat.id === selectedId) ? 'selected' : '';
    opts += `<option value="${cat.id}" ${isSel}>${cat.icono} ${cat.nombre} (${cat.codigo})</option>`;
  });
  if (AppState.customActivities && AppState.customActivities.length > 0) {
    AppState.customActivities.forEach(custom => {
      const isSel = (custom.id === selectedId) ? 'selected' : '';
      opts += `<option value="${custom.id}" ${isSel}>📌 ${custom.nombre}</option>`;
    });
  }
  return opts;
}

async function manejarArchivosSubidaRapida(files) {
  if (!files || files.length === 0) return;
  const fileArray = Array.from(files);

  const nuevosItems = [];

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const ext = file.name ? file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase() : 'pdf';
    
    // Intento preliminar de fecha en nombre
    const fechaPreliminar = extraerFechaDeArchivo(file, null);
    const hoyIso = new Date().toISOString().slice(0, 10);
    const fechaIso = (fechaPreliminar && fechaPreliminar.fecha) ? fechaPreliminar.fecha : hoyIso;
    const fechaDdmmaaa = formatearFechaDdmmaaa(fechaIso);

    // Intento preliminar de tipo en nombre
    const tipoPreliminar = detectarTipoActividadDeTexto(file.name);

    const item = {
      id: 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      file: file,
      originalName: file.name,
      size: file.size,
      ext: ext,
      type: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      base64: null,
      fecha: fechaIso,
      fechaDdmmaaa: fechaDdmmaaa,
      fechaDetectada: (fechaPreliminar && fechaPreliminar.fecha) ? fechaDdmmaaa : null,
      origenFecha: (fechaPreliminar && fechaPreliminar.origen) ? fechaPreliminar.origen : null,
      actTipo: tipoPreliminar ? tipoPreliminar.id : 'confeccion_rgrl',
      actDetectada: tipoPreliminar ? tipoPreliminar.nombre : null,
      detalle: '',
      preventor: '',
      observaciones: '',
      ocrStatus: 'processing', // 'processing' | 'done' | 'error'
      uploadStatus: 'pending' // 'pending' | 'uploading' | 'success' | 'error'
    };

    fastBatchItems.push(item);
    nuevosItems.push(item);
  }

  // Renderizar la cola inmediatamente
  renderFastBatchList();

  // Resetear el input file para permitir seleccionar los mismos archivos o más
  const fileInput = document.getElementById('fast-file-input');
  if (fileInput) fileInput.value = '';

  // Iniciar procesamiento OCR en segundo plano para cada archivo añadido
  for (let j = 0; j < nuevosItems.length; j++) {
    procesarOcrItemLote(nuevosItems[j]);
  }
}
window.manejarArchivosSubidaRapida = manejarArchivosSubidaRapida;

async function procesarOcrItemLote(item) {
  try {
    // 1. Leer Base64
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target.result;
      const commaIndex = result.indexOf(',');
      item.base64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;

      let extractedText = '';
      let fechaEncontrada = null;
      let origenFecha = '';

      try {
        const isPdf = (item.type === 'application/pdf') || (item.ext === 'pdf') || (item.originalName && item.originalName.toLowerCase().endsWith('.pdf'));

        if (isPdf && typeof item.file.arrayBuffer === 'function' && window.pdfjsLib) {
          const arrayBuffer = await item.file.arrayBuffer();
          const typedArray = new Uint8Array(arrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const maxPags = Math.min(pdf.numPages, 3);

          for (let p = 1; p <= maxPags; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();
            extractedText += textContent.items.map(it => it.str).join(' ') + ' ';
          }

          if (extractedText.trim().length > 30) {
            fechaEncontrada = buscarFechasEnTexto(extractedText);
            if (fechaEncontrada) origenFecha = 'interior del PDF';
          }

          // Si no hay texto digital o no se halló fecha, probar OCR sobre página 1 escaneada
          if ((!fechaEncontrada || extractedText.trim().length < 20) && window.Tesseract) {
            const page1 = await pdf.getPage(1);
            const viewport = page1.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page1.render({ canvasContext: context, viewport: viewport }).promise;

            const ocrRes = await Tesseract.recognize(canvas, 'spa');
            if (ocrRes && ocrRes.data && ocrRes.data.text) {
              extractedText += ' ' + ocrRes.data.text;
              const fOcr = buscarFechasEnTexto(ocrRes.data.text);
              if (fOcr) {
                fechaEncontrada = fOcr;
                origenFecha = 'OCR en escaneo';
              }
            }
          }
        } else if (window.Tesseract) {
          // Imagen directa JPG / PNG
          const ocrResImg = await Tesseract.recognize(item.file, 'spa');
          if (ocrResImg && ocrResImg.data && ocrResImg.data.text) {
            extractedText = ocrResImg.data.text;
            fechaEncontrada = buscarFechasEnTexto(extractedText);
            if (fechaEncontrada) origenFecha = 'OCR en imagen';
          }
        }
      } catch(errOcr) {
        console.warn('Aviso en OCR para', item.originalName, errOcr);
      }

      // Si se halló fecha en el interior, actualizar item con formato DD/MM/AAAA
      if (fechaEncontrada) {
        item.fecha = convertirDdmmaaaAIso(fechaEncontrada);
        item.fechaDdmmaaa = formatearFechaDdmmaaa(fechaEncontrada);
        item.fechaDetectada = item.fechaDdmmaaa;
        item.origenFecha = origenFecha;
      }

      // Analizar tipo de actividad por texto interior o por nombre
      const textoAnalisis = (extractedText && extractedText.trim().length > 10) ? extractedText : item.originalName;
      const detectada = detectarTipoActividadDeTexto(textoAnalisis);
      if (detectada) {
        item.actTipo = detectada.id;
        item.actDetectada = detectada.nombre;
      }

      item.ocrStatus = 'done';

      // Actualizar tarjeta del item
      actualizarCardItemLote(item);
    };
    reader.readAsDataURL(item.file);
  } catch(err) {
    console.error('Error general en procesamiento de item:', err);
    item.ocrStatus = 'error';
    actualizarCardItemLote(item);
  }
}

function renderFastBatchList() {
  const container = document.getElementById('fast-batch-list');
  const countBadge = document.getElementById('fast-batch-count');
  const btnTxt = document.getElementById('btn-fast-guardar-lote-txt');
  if (!container) return;

  const count = fastBatchItems.length;
  if (countBadge) countBadge.textContent = count;
  if (btnTxt) btnTxt.textContent = `Guardar y Subir Bloque (${count})`;

  if (count === 0) {
    container.innerHTML = `
      <div id="fast-batch-empty-placeholder" class="p-8 text-center text-slate-400 bg-slate-50/80 border border-dashed border-slate-200 rounded-xl">
        <i class="fa-solid fa-folder-open text-3xl mb-2 text-slate-300"></i>
        <p class="text-xs font-medium">Aún no agregaste documentos a este bloque.</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Arrastrá archivos en la zona superior o hacé clic en "Agregar más archivos".</p>
      </div>
    `;
    return;
  }

  const est = AppState.establecimientos[fastEstIdActual];

  let html = '';
  fastBatchItems.forEach((item) => {
    const isPdf = (item.ext === 'pdf');
    const iconClass = isPdf ? 'fa-solid fa-file-pdf text-red-600' : 'fa-solid fa-file-image text-emerald-600';
    const sizeKb = Math.round(item.size / 1024);

    const codedName = est ? generarCodigoArchivo(est.organismo, est.nroEstab, item.actTipo, item.fecha, 'Informe', item.ext) : 'Seleccioná establecimiento';

    let ocrBadgeHtml = '';
    if (item.ocrStatus === 'processing') {
      ocrBadgeHtml = `<span id="ocr-badge-${item.id}" class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><i class="fa-solid fa-spinner fa-spin text-amber-600"></i> Analizando OCR...</span>`;
    } else if (item.actDetectada || item.fechaDetectada) {
      let desc = [];
      if (item.actDetectada) desc.push(`${item.actDetectada}`);
      if (item.fechaDetectada) {
        desc.push(`${formatearFechaDdmmaaa(item.fechaDetectada)}`);
      }
      ocrBadgeHtml = `<span id="ocr-badge-${item.id}" class="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full" title="Detectado por OCR"><i class="fa-solid fa-wand-magic-sparkles text-purple-600"></i> ${escapeHtml(desc.join(' • '))}</span>`;
    } else {
      ocrBadgeHtml = `<span id="ocr-badge-${item.id}" class="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Manual</span>`;
    }

    let uploadStatusHtml = '';
    if (item.uploadStatus === 'uploading') {
      uploadStatusHtml = `<span class="text-xs font-bold text-blue-600 flex items-center gap-1"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo...</span>`;
    } else if (item.uploadStatus === 'success') {
      uploadStatusHtml = `<span class="text-xs font-bold text-emerald-600 flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Subido a Drive</span>`;
    } else if (item.uploadStatus === 'error') {
      uploadStatusHtml = `<span class="text-xs font-bold text-rose-600 flex items-center gap-1"><i class="fa-solid fa-circle-xmark"></i> Error</span>`;
    }

    const esDup = Boolean(est && buscarActividadDuplicada(est.id, item.actTipo, item.fecha));
    const dupBadgeHtml = esDup 
      ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full" title="Ya existe este tipo de documento en esta fecha para esta sede"><i class="fa-solid fa-triangle-exclamation"></i> Duplicado</span>`
      : '';

    const fechaValor = item.fechaDdmmaaa || formatearFechaDdmmaaa(item.fecha);

    html += `
      <div id="item-card-${item.id}" class="p-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl space-y-2 shadow-2xs transition">
        <!-- Fila 1: Cabecera del archivo con nombre, peso, estado OCR y botón eliminar -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 truncate flex-1 min-w-0">
            <span class="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm shrink-0">
              <i class="${iconClass}"></i>
            </span>
            <div class="truncate">
              <span class="text-xs font-bold text-slate-800 truncate" title="${escapeHtml(item.originalName)}">${escapeHtml(item.originalName)}</span>
              <span class="text-[10px] text-slate-400 ml-1">(${sizeKb} KB)</span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div id="container-dup-badge-${item.id}">${dupBadgeHtml}</div>
            <div id="container-ocr-badge-${item.id}">${ocrBadgeHtml}</div>
            <div id="container-upload-status-${item.id}">${uploadStatusHtml}</div>
            <button type="button" onclick="eliminarItemLote('${item.id}')" title="Quitar este archivo de la cola" class="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>

        <!-- Fila 2: Formulario limpio sin campos extras: Tipo de Documento + Fecha (DD/MM/AAAA) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
          <div>
            <label class="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">Tipo de Documento *</label>
            <select id="select-tipo-${item.id}" class="input-select text-xs font-semibold text-slate-800 py-1.5 w-full" onchange="cambiarTipoItemLote('${item.id}', this.value)">
              ${generarOpcionesActividades(item.actTipo)}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-600 uppercase mb-0.5 tracking-wider">Fecha (DD/MM/AAAA) *</label>
            <div class="relative">
              <input type="text" id="input-fecha-${item.id}" class="input-text text-xs py-1.5 w-full font-mono font-bold tracking-wide text-slate-900 pr-8" placeholder="DD/MM/AAAA" maxlength="10" value="${fechaValor}" oninput="formatearFechaInputLote('${item.id}', this)" onblur="validarFechaInputLote('${item.id}', this)">
              <span class="absolute right-2.5 top-2 text-xs text-slate-400 pointer-events-none"><i class="fa-regular fa-calendar"></i></span>
            </div>
          </div>
        </div>

        <!-- Fila 3: Preview de codificación oficial Drive -->
        <div class="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
          <div class="flex items-center gap-1.5 text-slate-500 truncate">
            <i class="fa-solid fa-tag text-[10px] text-blue-500"></i>
            <span class="font-mono text-[11px] font-semibold text-blue-900 truncate" id="preview-item-${item.id}">
              ${escapeHtml(codedName)}
            </span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function actualizarCardItemLote(item) {
  const selectTipo = document.getElementById(`select-tipo-${item.id}`);
  const inputFecha = document.getElementById(`input-fecha-${item.id}`);
  const containerBadge = document.getElementById(`container-ocr-badge-${item.id}`);

  if (selectTipo && item.actTipo) {
    selectTipo.value = item.actTipo;
  }
  if (inputFecha) {
    inputFecha.value = item.fechaDdmmaaa || formatearFechaDdmmaaa(item.fecha);
  }

  if (containerBadge) {
    let ocrBadgeHtml = '';
    if (item.ocrStatus === 'processing') {
      ocrBadgeHtml = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><i class="fa-solid fa-spinner fa-spin text-amber-600"></i> Analizando OCR...</span>`;
    } else if (item.actDetectada || item.fechaDetectada) {
      let desc = [];
      if (item.actDetectada) desc.push(`${item.actDetectada}`);
      if (item.fechaDetectada) {
        desc.push(`${formatearFechaDdmmaaa(item.fechaDetectada)}`);
      }
      ocrBadgeHtml = `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full" title="Detectado por OCR"><i class="fa-solid fa-wand-magic-sparkles text-purple-600"></i> ${escapeHtml(desc.join(' • '))}</span>`;
    } else {
      ocrBadgeHtml = `<span class="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Manual</span>`;
    }
    containerBadge.innerHTML = ocrBadgeHtml;
  }

  actualizarPreviewItemLote(item);
}

function formatearFechaInputLote(itemId, input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 8) val = val.substring(0, 8);
  let formatted = '';
  if (val.length > 4) {
    formatted = `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4)}`;
  } else if (val.length > 2) {
    formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
  } else {
    formatted = val;
  }
  input.value = formatted;

  const item = fastBatchItems.find(it => it.id === itemId);
  if (item) {
    item.fechaDdmmaaa = formatted;
    if (formatted.length === 10) {
      item.fecha = convertirDdmmaaaAIso(formatted);
      actualizarPreviewItemLote(item);
    }
  }
}
window.formatearFechaInputLote = formatearFechaInputLote;

function validarFechaInputLote(itemId, input) {
  const item = fastBatchItems.find(it => it.id === itemId);
  if (!item) return;
  const val = input.value.trim();
  const iso = convertirDdmmaaaAIso(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    item.fecha = iso;
    item.fechaDdmmaaa = formatearFechaDdmmaaa(iso);
    input.value = item.fechaDdmmaaa;
    actualizarPreviewItemLote(item);
  } else if (val.length > 0) {
    mostrarToast('⚠️ Formato de fecha esperado: DD/MM/AAAA (ej. 15/09/2026)');
  }
}
window.validarFechaInputLote = validarFechaInputLote;

function cambiarTipoItemLote(itemId, newTipo) {
  const item = fastBatchItems.find(it => it.id === itemId);
  if (!item) return;
  item.actTipo = newTipo;
  actualizarPreviewItemLote(item);
}
window.cambiarTipoItemLote = cambiarTipoItemLote;

function cambiarFechaItemLote(itemId, newFecha) {
  const item = fastBatchItems.find(it => it.id === itemId);
  if (!item) return;
  item.fecha = newFecha;
  item.fechaDdmmaaa = formatearFechaDdmmaaa(newFecha);
  actualizarPreviewItemLote(item);
}
window.cambiarFechaItemLote = cambiarFechaItemLote;

function actualizarPreviewItemLote(item) {
  const est = AppState.establecimientos[fastEstIdActual];
  const span = document.getElementById(`preview-item-${item.id}`);
  if (!span) return;
  if (!est) {
    span.textContent = 'Seleccioná un establecimiento';
    return;
  }
  const coded = generarCodigoArchivo(est.organismo, est.nroEstab, item.actTipo, item.fecha, item.detalle || 'Informe', item.ext);
  span.textContent = coded;
}

function eliminarItemLote(itemId) {
  fastBatchItems = fastBatchItems.filter(it => it.id !== itemId);
  renderFastBatchList();
}
window.eliminarItemLote = eliminarItemLote;

function limpiarLoteSubidaRapida() {
  if (fastBatchItems.length === 0) return;
  if (confirm('¿Deseás vaciar todos los archivos agregados a esta cola?')) {
    fastBatchItems = [];
    renderFastBatchList();
  }
}
window.limpiarLoteSubidaRapida = limpiarLoteSubidaRapida;

async function guardarLoteSubidaRapida() {
  if (fastIsUploading) return;

  const est = AppState.establecimientos[fastEstIdActual];
  if (!est) {
    alert('Por favor seleccioná un establecimiento de destino.');
    return;
  }

  if (fastBatchItems.length === 0) {
    alert('La cola está vacía. Por favor agregá al menos un archivo para subir.');
    return;
  }

  // Validar que todos tengan fecha válida
  for (let i = 0; i < fastBatchItems.length; i++) {
    const it = fastBatchItems[i];
    let iso = it.fecha;
    if (it.fechaDdmmaaa) {
      iso = convertirDdmmaaaAIso(it.fechaDdmmaaa);
    }
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      alert(`El archivo "${it.originalName}" no tiene una fecha válida (formato requerido: DD/MM/AAAA, ej: 15/09/2026).`);
      return;
    }
    it.fecha = iso;
    it.fechaDdmmaaa = formatearFechaDdmmaaa(iso);
  }

  // Detección previa de duplicados en la cola para esta sede
  const duplicadosEncontrados = [];
  fastBatchItems.forEach(it => {
    const dup = buscarActividadDuplicada(est.id, it.actTipo, it.fecha);
    if (dup) {
      duplicadosEncontrados.push({ item: it, dup: dup });
    }
  });

  let permitirReemplazoLote = false;
  if (duplicadosEncontrados.length > 0) {
    const listaTxt = duplicadosEncontrados.map(d => `• ${d.item.originalName} (${d.item.actTipo} - ${d.item.fechaDdmmaaa})`).join('\n');
    const confirma = confirm(`⚠️ SE DETECTARON ${duplicadosEncontrados.length} DOCUMENTO(S) REPETIDOS:\n\n${listaTxt}\n\n¿Deseás REEMPLAZAR los archivos existentes con las nuevas versiones?\n\n• Presioná 'Aceptar' para sobreescribir y actualizar los existentes.\n• Presioná 'Cancelar' para cancelar la subida y revisar los archivos.`);
    if (!confirma) {
      return;
    }
    permitirReemplazoLote = true;
  }

  const preventorGlobal = localStorage.getItem('hys_ultimo_preventor') || '';

  fastIsUploading = true;
  const btnGuardar = document.getElementById('btn-fast-guardar-lote');
  const progBox = document.getElementById('fast-upload-progress-box');
  const progBar = document.getElementById('fast-upload-progress-bar');
  const progLabel = document.getElementById('fast-upload-progress-label');
  const progPct = document.getElementById('fast-upload-progress-pct');
  const progSublabel = document.getElementById('fast-upload-progress-sublabel');

  if (btnGuardar) btnGuardar.disabled = true;
  if (progBox) progBox.classList.remove('hidden');

  const total = fastBatchItems.length;
  let exitosos = 0;

  if (!AppState.actividadesRegistradas[est.id]) {
    AppState.actividadesRegistradas[est.id] = [];
  }

  for (let i = 0; i < total; i++) {
    const item = fastBatchItems[i];
    const pct = Math.round((i / total) * 100);

    if (progBar) progBar.style.width = `${pct}%`;
    if (progPct) progPct.textContent = `${pct}%`;
    if (progLabel) progLabel.textContent = `Subiendo documento ${i + 1} de ${total}...`;
    if (progSublabel) progSublabel.textContent = `${item.originalName} (${item.actTipo})`;

    item.uploadStatus = 'uploading';
    const containerStatus = document.getElementById(`container-upload-status-${item.id}`);
    if (containerStatus) {
      containerStatus.innerHTML = `<span class="text-xs font-bold text-blue-600 flex items-center gap-1"><i class="fa-solid fa-spinner fa-spin"></i> Subiendo...</span>`;
    }

    // Asegurar base64
    if (!item.base64) {
      try {
        const b64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = e => resolve(e.target.result);
          r.onerror = reject;
          r.readAsDataURL(item.file);
        });
        const commaIdx = b64.indexOf(',');
        item.base64 = commaIdx !== -1 ? b64.substring(commaIdx + 1) : b64;
      } catch(errB64) {
        console.error('Error al leer base64:', errB64);
      }
    }

    let cleanB64 = (item.base64 || '').replace(/^data:.*base64,/, '').replace(/\s+/g, '');
    const detalleFinal = (item.detalle || '').trim() || 'Informe';
    const codedFileName = generarCodigoArchivo(est.organismo, est.nroEstab, item.actTipo, item.fecha, detalleFinal, item.ext);
    const preventorFinal = item.preventor || preventorGlobal;
    const obsFinal = item.observaciones || '';

    const payload = {
      tipoOperacion: 'upload_actividad_documento',
      tipoActividad: item.actTipo,
      fechaActividad: item.fecha,
      estadoActividad: 'Completado',
      detalle: detalleFinal,
      preventor: preventorFinal,
      observaciones: obsFinal,
      permitirReemplazo: permitirReemplazoLote,
      fileBase64: cleanB64,
      originalFileName: item.originalName,
      mimeType: item.type,
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

    let driveUrl = '';
    let driveFileId = '';
    let monthFolderUrl = '';
    let monthFolderId = '';
    let monthKey = '';
    let monthLabel = '';
    let registroId = 'ACT_' + Date.now() + '_' + i;

    try {
      const webhookUrl = getWebhookUrl();
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

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
        console.warn('Aviso servidor Google Apps Script en lote:', result);
      }
    } catch(errNet) {
      console.warn('Error de red al subir item de lote a Drive:', errNet);
    }

    item.uploadStatus = 'success';
    exitosos++;
    if (containerStatus) {
      containerStatus.innerHTML = `<span class="text-xs font-bold text-emerald-600 flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Subido a Drive</span>`;
    }

    const mInfo = parsearAnioMesCliente(item.fecha);
    const mFUrl = monthFolderUrl || (AppState.carpetasMensuales[mInfo.key] ? AppState.carpetasMensuales[mInfo.key].url : '');

    const nuevoRegistro = {
      id: registroId,
      tipoActividad: item.actTipo,
      fechaActividad: item.fecha,
      estadoActividad: 'Completado',
      detalle: detalleFinal,
      preventor: preventorFinal,
      observaciones: obsFinal,
      fileName: codedFileName,
      fileUrl: driveUrl,
      fileId: driveFileId,
      monthFolderUrl: mFUrl,
      monthKey: monthKey || mInfo.key,
      monthLabel: monthLabel || mInfo.label,
      timestamp: new Date().toISOString()
    };

    if (permitirReemplazoLote) {
      const idx = AppState.actividadesRegistradas[est.id].findIndex(a => {
        const aTipo = normalizarTipoActividad(a.tipoActividad);
        const iTipo = normalizarTipoActividad(item.actTipo);
        const aFecha = a.fechaActividad ? a.fechaActividad.split('T')[0] : '';
        const iFecha = item.fecha ? item.fecha.split('T')[0] : '';
        return aTipo === iTipo && aFecha === iFecha;
      });
      if (idx >= 0) {
        AppState.actividadesRegistradas[est.id][idx] = nuevoRegistro;
      } else {
        AppState.actividadesRegistradas[est.id].push(nuevoRegistro);
      }
    } else {
      AppState.actividadesRegistradas[est.id].push(nuevoRegistro);
    }
  }

  // Finalizar progreso
  if (progBar) progBar.style.width = '100%';
  if (progPct) progPct.textContent = '100%';
  if (progLabel) progLabel.textContent = `¡Bloque completado! (${exitosos} de ${total} subidos)`;
  if (progSublabel) progSublabel.textContent = 'Todos los documentos fueron registrados y codificados en Google Drive.';

  // Guardar en almacenamiento local
  guardarLegajoLocal();

  // Actualizar todas las vistas
  renderMatrizAnual();
  if (AppState.establecimientoSeleccionado && AppState.establecimientoSeleccionado.id === est.id) {
    renderFichaEstablecimiento(est);
    renderPanelActividades(est);
  }
  renderRepositorioGlobal(true);
  renderDashboard();

  fastIsUploading = false;
  if (btnGuardar) btnGuardar.disabled = false;

  mostrarToast(`🎉 ¡Bloque de ${exitosos} documento(s) subido con éxito a la sede ${est.nroEstab ? '#' + est.nroEstab : ''}!`);

  setTimeout(() => {
    fastBatchItems = [];
    if (progBox) progBox.classList.add('hidden');
    cerrarModal('modal-subida-rapida-general');
  }, 1600);
}
window.guardarLoteSubidaRapida = guardarLoteSubidaRapida;
window.guardarSubidaRapidaYSubir = guardarLoteSubidaRapida; // alias de compatibilidad

// ==================== SINCRONIZACIÓN CON GOOGLE SHEETS ====================

function mapearFilaActividad(row) {
  if (!row) return null;
  const rawDate = row['Fecha Actividad'] ? String(row['Fecha Actividad']).split('T')[0].split(' ')[0].trim() : '';
  const fAct = convertirDdmmaaaAIso(rawDate) || rawDate;
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
  const allEsts = Object.values(AppState.establecimientos || {});
  const sNro = nro ? String(nro).trim().toLowerCase() : '';
  const sNom = nom ? String(nom).trim().toLowerCase() : '';
  const sOrg = org ? String(org).trim().toLowerCase() : '';

  // 1. Filtrar primero por coincidencia de organismo si fue provisto
  let pool = allEsts;
  if (sOrg) {
    const orgPool = allEsts.filter(e => sonOrganismosCoincidentes(e.organismo || e.razonSocial || '', sOrg));
    if (orgPool.length > 0) {
      pool = orgPool;
    }
  }

  // 2. Coincidencia por N° de establecimiento dentro del organismo
  if (sNro) {
    const foundByNro = pool.find(e => e.nroEstab && String(e.nroEstab).trim().toLowerCase() === sNro);
    if (foundByNro) return foundByNro;
  }

  // 3. Coincidencia por nombre dentro del organismo
  if (sNom) {
    const foundByNom = pool.find(e => {
      const eNom = String(e.nombreEstablecimiento || '').trim().toLowerCase();
      return eNom === sNom || (sNom.length > 5 && (eNom.includes(sNom) || sNom.includes(eNom)));
    });
    if (foundByNom) return foundByNom;
  }

  // 4. Coincidencia por domicilio dentro del organismo
  if (sNom) {
    const foundByDom = pool.find(e => {
      const eDom = String(e.domicilio || '').trim().toLowerCase();
      return eDom && (eDom === sNom || (sNom.length > 5 && (eDom.includes(sNom) || sNom.includes(eDom))));
    });
    if (foundByDom) return foundByDom;
  }

  return null;
}

async function sincronizarConSheets(forceGlobal = false) {
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
    if (!forceGlobal) {
      mostrarToast('⏳ Sincronizando con Google Sheets y Google Drive...');
    }

    // Si forceGlobal es true o estamos en Matriz, Repositorio o Dashboard, sincronizamos TODOS los legajos
    const isGlobal = (forceGlobal === true) || (AppState.moduloActivo === 'matriz') || (AppState.moduloActivo === 'repositorio') || (AppState.moduloActivo === 'dashboard') || !est;
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

            mappedItem.estId = estKey;
            mappedItem.establecimiento = targetEst || {
              id: estKey,
              nroEstab: row['N° Estab'] || row['Nro Estab'] || '',
              nombreEstablecimiento: row['Nombre Establecimiento'] || '',
              organismo: row['Organismo'] || '',
              localidad: row['Localidad'] || ''
            };
            mappedItem.nroEstab = row['N° Estab'] || row['Nro Estab'] || (targetEst ? targetEst.nroEstab : '');
            mappedItem.nombreEstablecimiento = row['Nombre Establecimiento'] || (targetEst ? targetEst.nombreEstablecimiento : '');
            mappedItem.organismo = row['Organismo'] || (targetEst ? targetEst.organismo : '');
            mappedItem.localidad = row['Localidad'] || (targetEst ? targetEst.localidad : '');

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
          actualizarSelectorMesesMatriz();
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
          actualizarSelectorMesesMatriz();
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

    // 3. Procesar superficies de establecimientos si vienen en la respuesta
    if (json && json.superficies && typeof json.superficies === 'object') {
      AppState.superficies = json.superficies;
      try {
        localStorage.setItem(STORAGE_KEYS.SUPERFICIES_DB, JSON.stringify(json.superficies));
      } catch (e) {}

      Object.keys(AppState.establecimientos).forEach(id => {
        const itemEst = AppState.establecimientos[id];
        const supData = json.superficies[id] || (itemEst.nroEstab ? json.superficies[itemEst.nroEstab] : null);
        if (supData && supData.superficie) {
          itemEst.superficie = supData.superficie;
          itemEst.requiereMediciones = (Number(itemEst.superficie) >= 1000);
        }
      });
      renderMatrizAnual();
    }

    if (json && json.sheetSuperficiesUrl) {
      AppState.sheetSuperficiesUrl = json.sheetSuperficiesUrl;
      try {
        localStorage.setItem(STORAGE_KEYS.SHEET_SUPERFICIES_URL, json.sheetSuperficiesUrl);
      } catch (e) {}
      const btnLink = document.getElementById('btn-link-sheet-kpi');
      if (btnLink) btnLink.href = json.sheetSuperficiesUrl;
      const btnTableroLink = document.getElementById('tablero-btn-abrir-sheet');
      if (btnTableroLink) btnTableroLink.href = json.sheetSuperficiesUrl;
    }

    // Sincronizar también carpetas mensuales desde Drive
    try {
      await consultarCarpetasMensualesDrive();
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
  if (!str) return '';
  const s = String(str).toLowerCase().trim();
  // 1. RAR (Evaluar antes de RGRL)
  if (s === 'rar' || s === 'confeccion_rar' || /\b(?:confeccion_)?rar\b/i.test(s) || s.includes('agentes de riesgo') || s.includes('expuestos') || s.includes('relevamiento de agentes')) {
    return 'confeccion_rar';
  }
  // 2. RGRL
  if (s === 'rgrl' || s === 'confeccion_rgrl' || /\b(?:confeccion_)?rgrl\b/i.test(s) || s.includes('relevamiento general')) {
    return 'confeccion_rgrl';
  }
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

  const anio = AppState.matrizAnio || '2026';
  const mesFiltro = AppState.matrizMes || 'todos';
  const metricas = calcularMetricasPlanHyS(anio, mesFiltro);
  const totalProvincial = metricas.totalSedesProvincia || 452;

  // 1. Pilares Estratégicos del Tablero
  // Card 1: Stock Total
  const elStockVis = document.getElementById('tablero-kpi-stock-visitadas');
  const elStockPct = document.getElementById('tablero-kpi-stock-pct');
  const elStockBar = document.getElementById('tablero-kpi-stock-bar');
  if (elStockVis) elStockVis.textContent = metricas.sedesVisitadasAnio;
  const pctStock = ((metricas.sedesVisitadasAnio / totalProvincial) * 100).toFixed(1);
  if (elStockPct) elStockPct.textContent = `${pctStock}% del Plan Cubierto (${totalProvincial - metricas.sedesVisitadasAnio} pendientes)`;
  if (elStockBar) elStockBar.style.width = `${Math.min(100, parseFloat(pctStock))}%`;

  // Card 2: Avance Mensual
  const elMesVis = document.getElementById('tablero-kpi-mes-visitadas');
  const elMesEst = document.getElementById('tablero-kpi-mes-estado');
  const elMesBar = document.getElementById('tablero-kpi-mes-bar');
  let visitasMesActivo = 0;
  if (mesFiltro !== 'todos') {
    const mCod = (parseInt(mesFiltro, 10) < 10 ? '0' : '') + parseInt(mesFiltro, 10);
    visitasMesActivo = metricas.visitasPorMes[mCod] ? metricas.visitasPorMes[mCod].size : 0;
  } else {
    // Tomar el último mes con actividad
    for (let m = 12; m >= 1; m--) {
      const mCod = (m < 10 ? '0' : '') + m;
      if (metricas.visitasPorMes[mCod] && metricas.visitasPorMes[mCod].size > 0) {
        visitasMesActivo = metricas.visitasPorMes[mCod].size;
        break;
      }
    }
  }
  if (elMesVis) elMesVis.textContent = visitasMesActivo;
  const pctMes = Math.min(100, Math.round((visitasMesActivo / 25) * 100));
  if (elMesEst) {
    elMesEst.textContent = visitasMesActivo >= 25 ? `✓ Meta cumplida (${visitasMesActivo} sedes)` : `${visitasMesActivo} de 25-30 sedes (${pctMes}%)`;
  }
  if (elMesBar) elMesBar.style.width = `${pctMes}%`;

  // Card 3: Acumulado
  const elAcumVis = document.getElementById('tablero-kpi-acum-visitadas');
  const elAcumDes = document.getElementById('tablero-kpi-acum-desvio');
  const elAcumBar = document.getElementById('tablero-kpi-acum-bar');
  let mesEvaluado = 12;
  const hoy = new Date();
  if (anio === hoy.getFullYear().toString()) {
    mesEvaluado = hoy.getMonth() + 1;
  }
  let sedesAcumuladasSet = new Set();
  for (let m = 1; m <= mesEvaluado; m++) {
    const mCod = (m < 10 ? '0' : '') + m;
    if (metricas.visitasPorMes[mCod]) {
      metricas.visitasPorMes[mCod].forEach(id => sedesAcumuladasSet.add(id));
    }
  }
  const cantAcum = sedesAcumuladasSet.size;
  const metaMinAcum = mesEvaluado * 25;
  if (elAcumVis) elAcumVis.textContent = cantAcum;
  if (elAcumDes) {
    elAcumDes.textContent = cantAcum >= metaMinAcum ? `✓ Al día (Meta a Mes ${mesEvaluado}: ${metaMinAcum})` : `Meta a Mes ${mesEvaluado}: ${metaMinAcum} (-${metaMinAcum - cantAcum})`;
  }
  const pctAcum = metaMinAcum > 0 ? Math.min(100, Math.round((cantAcum / metaMinAcum) * 100)) : 0;
  if (elAcumBar) elAcumBar.style.width = `${pctAcum}%`;

  // Card 4: Superficie > 1000 m²
  const elSupCon = document.getElementById('tablero-kpi-sup-con-med');
  const elSupTot = document.getElementById('tablero-kpi-sup-total');
  const elSupSin = document.getElementById('tablero-kpi-sup-sin-dato');
  const elSupBar = document.getElementById('tablero-kpi-sup-bar');
  if (elSupCon) elSupCon.textContent = metricas.sedesMayor1000ConMediciones;
  if (elSupTot) elSupTot.textContent = metricas.sedesMayor1000;
  if (elSupSin) {
    elSupSin.textContent = metricas.sedesSinDatoM2 > 0 ? `${metricas.sedesSinDatoM2} sedes sin dato de m²` : `${metricas.sedesMayor1000SinMediciones} pendientes de medición`;
  }
  const pctSup = metricas.sedesMayor1000 > 0 ? Math.round((metricas.sedesMayor1000ConMediciones / metricas.sedesMayor1000) * 100) : 0;
  if (elSupBar) elSupBar.style.width = `${pctSup}%`;

  // 2. Tabla de Evolución Mensual (Enero a Diciembre)
  const tablaBody = document.getElementById('tablero-tabla-meses-body');
  if (tablaBody) {
    let htmlFilas = '';
    let acumSedesSet = new Set();
    for (let m = 1; m <= 12; m++) {
      const mCod = (m < 10 ? '0' : '') + m;
      const sedesMesSet = metricas.visitasPorMes[mCod] || new Set();
      const cantMes = sedesMesSet.size;
      sedesMesSet.forEach(id => acumSedesSet.add(id));
      const acumReal = acumSedesSet.size;
      const metaMin = m * 25;
      const metaMax = m * 30;
      const pctPlan = ((acumReal / totalProvincial) * 100).toFixed(1);

      let badgeMes = '';
      if (cantMes >= 25) {
        badgeMes = `<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">✓ Cumplido (${cantMes})</span>`;
      } else if (cantMes > 0) {
        badgeMes = `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">${cantMes}/25 (${Math.round((cantMes/25)*100)}%)</span>`;
      } else {
        badgeMes = `<span class="text-slate-400 font-mono text-[11px]">-</span>`;
      }

      htmlFilas += `
        <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
          <td class="py-2 px-3 font-bold text-slate-800">${MESES_NOMBRES[m-1]}</td>
          <td class="py-2 px-3 text-center font-bold ${cantMes > 0 ? 'text-blue-900 bg-blue-50/50' : 'text-slate-400'}">${cantMes}</td>
          <td class="py-2 px-3 text-center text-slate-600 font-semibold">25 - 30</td>
          <td class="py-2 px-3 text-center">${badgeMes}</td>
          <td class="py-2 px-3 text-center font-black text-emerald-800">${acumReal}</td>
          <td class="py-2 px-3 text-center text-slate-500 font-medium">${metaMin} - ${metaMax}</td>
          <td class="py-2 px-3 text-center font-bold text-slate-700">${pctPlan}%</td>
        </tr>
      `;
    }
    tablaBody.innerHTML = htmlFilas;
  }

  // 3. Distribución de actividades y conteo general
  let totalActs = 0;
  const conteoPorActividad = {};
  Object.values(AppState.actividadesRegistradas).forEach(acts => {
    acts.forEach(a => {
      totalActs++;
      const cat = CATALOGO_ACTIVIDADES[normalizarTipoActividad(a.tipoActividad)] || { nombre: a.tipoActividad };
      const nom = cat.nombre;
      conteoPorActividad[nom] = (conteoPorActividad[nom] || 0) + 1;
    });
  });

  const totalActsEl = document.getElementById('metric-total-acts');
  if (totalActsEl) totalActsEl.textContent = totalActs;

  const listContainer = document.getElementById('metric-lista-actividades');
  if (listContainer) {
    listContainer.innerHTML = '';
    const sorted = Object.entries(conteoPorActividad).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      listContainer.innerHTML = '<div class="text-xs text-slate-400 py-3 text-center">Aún no hay actividades registradas en el sistema.</div>';
    } else {
      sorted.forEach(([nombre, count]) => {
        const pct = Math.min(100, Math.round((count / totalProvincial) * 100));
        const div = document.createElement('div');
        div.className = 'space-y-1';
        div.innerHTML = `
          <div class="flex justify-between text-xs">
            <span class="font-semibold text-slate-700">${escapeHtml(nombre)}</span>
            <span class="font-bold text-blue-900">${count} (${pct}% cobertura)</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${pct}%"></div>
          </div>
        `;
        listContainer.appendChild(div);
      });
    }
  }

  // Actualizar enlace directo a Google Sheets
  if (AppState.sheetSuperficiesUrl) {
    const btnLink = document.getElementById('tablero-btn-abrir-sheet');
    if (btnLink) btnLink.href = AppState.sheetSuperficiesUrl;
  }

  modal.classList.remove('hidden');
}
window.abrirModalTableroGeneral = abrirModalTableroGeneral;

// ==================== ESTADÍSTICA MENSUAL (SEDES & PARTICIPACIÓN DE TAREAS) ====================

function abrirModalEstadisticaMensual(mesDeseado = null, anioDeseado = null) {
  const modal = document.getElementById('modal-estadistica-mensual');
  if (!modal) return;

  const anioActual = anioDeseado || AppState.matrizAnio || '2026';
  const anioSelect = document.getElementById('stat-mes-anio');
  if (anioSelect) anioSelect.value = anioActual;

  // Llenar selector de meses si no tiene opciones completas
  const mesSelect = document.getElementById('stat-mes-selector');
  if (mesSelect) {
    let mesSeleccionado = mesDeseado || (AppState.matrizMes !== 'todos' ? AppState.matrizMes : null);
    
    // Si no hay mes seleccionado, buscar el mes más reciente con actividades
    if (!mesSeleccionado) {
      const metricas = calcularMetricasPlanHyS(anioActual, 'todos');
      for (let m = 12; m >= 1; m--) {
        const mCod = (m < 10 ? '0' : '') + m;
        if (metricas.visitasPorMes[mCod] && metricas.visitasPorMes[mCod].size > 0) {
          mesSeleccionado = mCod;
          break;
        }
      }
      if (!mesSeleccionado) mesSeleccionado = '09'; // Default a Septiembre si no hay nada
    }

    mesSelect.innerHTML = MESES_NOMBRES.map((nombre, idx) => {
      const cod = (idx + 1 < 10 ? '0' : '') + (idx + 1);
      return `<option value="${cod}" ${cod === mesSeleccionado ? 'selected' : ''}>${cod} - ${nombre}</option>`;
    }).join('');
  }

  renderEstadisticaMensualModal();
  modal.classList.remove('hidden');
}
window.abrirModalEstadisticaMensual = abrirModalEstadisticaMensual;

function renderEstadisticaMensualModal() {
  const anio = (document.getElementById('stat-mes-anio')?.value || AppState.matrizAnio || '2026').trim();
  const mes = (document.getElementById('stat-mes-selector')?.value || '09').trim();
  const mesIdx = parseInt(mes, 10) - 1;
  const mesNombre = MESES_NOMBRES[mesIdx] || `Mes ${mes}`;

  const lblMes = document.getElementById('stat-lbl-mes-actual');
  if (lblMes) lblMes.textContent = `${mesNombre} ${anio === 'todos' ? '' : anio}`;

  // 1. Recopilar actividades y establecimientos visitados en ese año y mes
  const sedesVisitadasMap = new Map(); // idEst -> { est, actsMes: [] }
  const conteoTareas = {};
  const sedesPorTarea = {};
  let totalTareasMes = 0;
  let sedesMayor1000Visitadas = 0;
  let sedesMayor1000ConMed = 0;

  Object.values(AppState.establecimientos).forEach(est => {
    const acts = obtenerActividadesDeSede(est);
    const actsMes = acts.filter(a => {
      if (anio !== 'todos') {
        const aAnio = extraerAnioDeFecha(a.fechaActividad);
        if (aAnio !== anio) return false;
      }
      const mInfo = parsearAnioMesCliente(a.fechaActividad);
      if (!mInfo || !mInfo.mes) return false;
      const mCod = (mInfo.mes < 10 ? '0' : '') + mInfo.mes;
      return mCod === mes;
    });

    if (actsMes.length > 0) {
      sedesVisitadasMap.set(est.id, { est, actsMes });
      const numSup = Number(est.superficie);
      if (numSup >= 1000) {
        sedesMayor1000Visitadas++;
        const tieneMed = acts.some(a => {
          const norm = normalizarTipoActividad(a.tipoActividad);
          return norm === 'medicion_pat' || norm === 'medicion_ruido' || norm === 'medicion_iluminacion';
        });
        if (tieneMed) sedesMayor1000ConMed++;
      }

      actsMes.forEach(a => {
        totalTareasMes++;
        const tipoNorm = normalizarTipoActividad(a.tipoActividad);
        conteoTareas[tipoNorm] = (conteoTareas[tipoNorm] || 0) + 1;
        if (!sedesPorTarea[tipoNorm]) sedesPorTarea[tipoNorm] = new Set();
        sedesPorTarea[tipoNorm].add(est.id);
      });
    }
  });

  const cantSedesVisitadas = sedesVisitadasMap.size;

  // 2. Actualizar KPIs del encabezado
  const elVis = document.getElementById('stat-kpi-sedes-visitadas');
  const elVisPct = document.getElementById('stat-kpi-sedes-pct');
  const elVisBar = document.getElementById('stat-kpi-sedes-bar');
  const elBadgeCumplimiento = document.getElementById('stat-mes-badge-cumplimiento');
  if (elVis) elVis.textContent = cantSedesVisitadas;
  const pctMeta = Math.min(100, Math.round((cantSedesVisitadas / 25) * 100));
  if (elVisPct) elVisPct.textContent = `${pctMeta}% de meta (25-30)`;
  if (elVisBar) elVisBar.style.width = `${pctMeta}%`;

  if (elBadgeCumplimiento) {
    if (cantSedesVisitadas >= 25) {
      elBadgeCumplimiento.className = 'text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300';
      elBadgeCumplimiento.textContent = `✓ Meta Mensual Cumplida (${cantSedesVisitadas} sedes visitadas)`;
    } else if (cantSedesVisitadas > 0) {
      elBadgeCumplimiento.className = 'text-xs font-extrabold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300';
      elBadgeCumplimiento.textContent = `⏳ En curso: ${cantSedesVisitadas} de 25-30 sedes (${pctMeta}%)`;
    } else {
      elBadgeCumplimiento.className = 'text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300';
      elBadgeCumplimiento.textContent = 'Sin visitas registradas en este mes';
    }
  }

  const elTotTareas = document.getElementById('stat-kpi-total-tareas');
  const elPromTareas = document.getElementById('stat-kpi-promedio-tareas');
  if (elTotTareas) elTotTareas.textContent = totalTareasMes;
  const promTareas = cantSedesVisitadas > 0 ? (totalTareasMes / cantSedesVisitadas).toFixed(1) : '0';
  if (elPromTareas) elPromTareas.textContent = promTareas;

  // Tarea de mayor participación
  let topTareaKey = null;
  let topTareaCount = 0;
  Object.entries(conteoTareas).forEach(([tKey, tCount]) => {
    if (tCount > topTareaCount) {
      topTareaCount = tCount;
      topTareaKey = tKey;
    }
  });

  const elTopNom = document.getElementById('stat-kpi-tarea-top-nombre');
  const elTopCant = document.getElementById('stat-kpi-tarea-top-cant');
  const elTopPct = document.getElementById('stat-kpi-tarea-top-pct');
  const elTopBar = document.getElementById('stat-kpi-tarea-top-bar');

  if (topTareaKey && totalTareasMes > 0) {
    const cat = CATALOGO_ACTIVIDADES[topTareaKey] || { nombre: topTareaKey, icono: '📋' };
    if (elTopNom) elTopNom.innerHTML = `${cat.icono || '📋'} ${escapeHtml(cat.nombre)}`;
    if (elTopCant) elTopCant.textContent = `${topTareaCount} tareas`;
    const topPct = ((topTareaCount / totalTareasMes) * 100).toFixed(1);
    if (elTopPct) elTopPct.textContent = `${topPct}% de participación`;
    if (elTopBar) elTopBar.style.width = `${Math.min(100, parseFloat(topPct))}%`;
  } else {
    if (elTopNom) elTopNom.textContent = 'Sin actividades';
    if (elTopCant) elTopCant.textContent = '0 tareas';
    if (elTopPct) elTopPct.textContent = '0%';
    if (elTopBar) elTopBar.style.width = '0%';
  }

  // Sedes >1000m² visitadas
  const elSupVis = document.getElementById('stat-kpi-sup-visitadas');
  const elSupMed = document.getElementById('stat-kpi-sup-con-med');
  const elSupBar = document.getElementById('stat-kpi-sup-bar');
  if (elSupVis) elSupVis.textContent = sedesMayor1000Visitadas;
  if (elSupMed) elSupMed.textContent = `${sedesMayor1000ConMed} con mediciones`;
  const pctSup = sedesMayor1000Visitadas > 0 ? Math.round((sedesMayor1000ConMed / sedesMayor1000Visitadas) * 100) : 0;
  if (elSupBar) elSupBar.style.width = `${pctSup}%`;

  // 3. Renderizar Tabla de Participación de Tareas
  const tbodyTareas = document.getElementById('stat-tabla-tareas-body');
  const tfootTareas = document.getElementById('stat-tabla-tareas-foot');

  if (tbodyTareas) {
    if (totalTareasMes === 0) {
      tbodyTareas.innerHTML = `
        <tr>
          <td colspan="5" class="py-10 text-center text-slate-400 text-xs font-semibold">
            <i class="fa-regular fa-calendar-xmark text-3xl mb-2 block text-slate-300"></i>
            No se registraron tareas ni visitas para el mes de ${mesNombre} (${anio}).
          </td>
        </tr>
      `;
      if (tfootTareas) tfootTareas.innerHTML = '';
    } else {
      // Ordenar tareas de mayor a menor cantidad
      const sortedTareas = Object.entries(conteoTareas).sort((a, b) => b[1] - a[1]);
      let htmlFilasTareas = '';

      sortedTareas.forEach(([tKey, count]) => {
        const cat = CATALOGO_ACTIVIDADES[tKey] || { nombre: tKey, icono: '📋', codigo: tKey, color: '#4f46e5' };
        const sharePct = ((count / totalTareasMes) * 100).toFixed(1);
        const sedesRecibieron = sedesPorTarea[tKey] ? sedesPorTarea[tKey].size : 0;
        const pctSedes = cantSedesVisitadas > 0 ? Math.round((sedesRecibieron / cantSedesVisitadas) * 100) : 0;
        const colorBarra = cat.color || '#4f46e5';

        htmlFilasTareas += `
          <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition">
            <td class="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-2.5">
              <span class="text-base">${cat.icono || '📋'}</span>
              <div>
                <div class="font-bold text-slate-900">${escapeHtml(cat.nombre)}</div>
                <div class="text-[10px] text-slate-500 font-mono">Código: ${cat.codigo || tKey}</div>
              </div>
            </td>
            <td class="py-2.5 px-3 text-center font-extrabold text-blue-900 text-sm whitespace-nowrap">
              ${count}
            </td>
            <td class="py-2.5 px-4">
              <div class="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                <span>${sharePct}%</span>
                <span class="text-[10px] text-slate-400 font-normal">${count} de ${totalTareasMes} tareas</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-2xs">
                <div class="h-2 rounded-full transition-all duration-500" style="width: ${sharePct}%; background-color: ${colorBarra};"></div>
              </div>
            </td>
            <td class="py-2.5 px-3 text-center font-bold text-slate-700 whitespace-nowrap">
              ${sedesRecibieron} sedes
            </td>
            <td class="py-2.5 px-3 text-center whitespace-nowrap">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${pctSedes >= 80 ? 'bg-emerald-100 text-emerald-800' : (pctSedes >= 40 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700')}">
                ${pctSedes}%
              </span>
            </td>
          </tr>
        `;
      });

      tbodyTareas.innerHTML = htmlFilasTareas;

      if (tfootTareas) {
        tfootTareas.innerHTML = `
          <tr>
            <td class="py-2.5 px-4 font-black">TOTAL TAREAS DEL MES</td>
            <td class="py-2.5 px-3 text-center font-black text-blue-900 text-sm">${totalTareasMes}</td>
            <td class="py-2.5 px-4 font-black">100.0% de participación</td>
            <td class="py-2.5 px-3 text-center font-black">${cantSedesVisitadas} sedes visitadas</td>
            <td class="py-2.5 px-3 text-center font-black">-</td>
          </tr>
        `;
      }
    }
  }

  // 4. Renderizar Listado de Establecimientos Visitados en el Mes
  const tbodySedes = document.getElementById('stat-tabla-sedes-visitadas-body');
  const lblCantSedes = document.getElementById('stat-lbl-cant-sedes-lista');
  if (lblCantSedes) lblCantSedes.textContent = cantSedesVisitadas;

  if (tbodySedes) {
    if (cantSedesVisitadas === 0) {
      tbodySedes.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-slate-400 text-xs font-semibold">
            No hay establecimientos visitados en este mes.
          </td>
        </tr>
      `;
    } else {
      let htmlFilasSedes = '';
      const arrayVisitadas = Array.from(sedesVisitadasMap.values());
      
      arrayVisitadas.forEach(({ est, actsMes }) => {
        const numSup = Number(est.superficie);
        let supBadge = '';
        if (numSup >= 1000) {
          supBadge = `<span class="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-extrabold text-[10px] border border-purple-300">⚡ ${numSup} m²</span>`;
        } else if (numSup > 0) {
          supBadge = `<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">${numSup} m²</span>`;
        } else {
          supBadge = `<span class="text-slate-400 text-[10px] font-mono">-</span>`;
        }

        // Badges de tareas que tuvo esta sede en el mes
        const tareasSedeHtml = actsMes.map(a => {
          const cat = CATALOGO_ACTIVIDADES[normalizarTipoActividad(a.tipoActividad)] || { nombre: a.tipoActividad, codigo: a.tipoActividad };
          return `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold" title="${escapeHtml(cat.nombre)} (${formatearFechaDdmmaaa(a.fechaActividad)})">${cat.codigo || cat.nombre}</span>`;
        }).join(' ');

        htmlFilasSedes += `
          <tr class="hover:bg-blue-50/40 border-b border-slate-100 text-xs transition cursor-pointer" onclick="cerrarModal('modal-estadistica-mensual'); irAFichaEstablecimiento('${est.id}');">
            <td class="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap bg-white">
              ${est.nroEstab ? '#' + est.nroEstab : '-'}
            </td>
            <td class="py-2.5 px-3 font-semibold text-slate-900 max-w-[200px] truncate" title="${escapeHtml(est.nombreEstablecimiento)}">
              ${escapeHtml(est.nombreEstablecimiento)}
            </td>
            <td class="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title="${escapeHtml(est.organismo)}">
              ${escapeHtml(est.organismo)}
            </td>
            <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap">
              ${escapeHtml(est.localidad)}
            </td>
            <td class="py-2.5 px-2 text-center whitespace-nowrap">
              ${supBadge}
            </td>
            <td class="py-2.5 px-3">
              <div class="flex flex-wrap gap-1">
                ${tareasSedeHtml}
              </div>
            </td>
            <td class="py-2.5 px-3 text-right whitespace-nowrap">
              <button onclick="cerrarModal('modal-estadistica-mensual'); irAFichaEstablecimiento('${est.id}'); event.stopPropagation();" class="text-xs text-blue-700 hover:text-blue-900 font-bold p-1 hover:bg-blue-100 rounded flex items-center gap-1 ml-auto">
                <span>Ficha</span>
                <i class="fa-solid fa-arrow-right"></i>
              </button>
            </td>
          </tr>
        `;
      });

      tbodySedes.innerHTML = htmlFilasSedes;
    }
  }
}
window.renderEstadisticaMensualModal = renderEstadisticaMensualModal;

// ==================== GESTIÓN DE SUPERFICIE (m²) ====================

function abrirModalEditarSuperficie(estId) {
  const est = AppState.establecimientos[estId];
  if (!est) return;

  const modal = document.getElementById('modal-editar-superficie');
  if (!modal) return;

  const idInput = document.getElementById('edit-sup-id-est');
  if (idInput) idInput.value = est.id;

  const elNom = document.getElementById('edit-sup-nombre');
  if (elNom) elNom.textContent = `${est.nombreEstablecimiento} ${est.nroEstab ? '(N° ' + est.nroEstab + ')' : ''}`;

  const elOrg = document.getElementById('edit-sup-organismo');
  if (elOrg) elOrg.textContent = `Organismo: ${est.organismo}`;

  const elLoc = document.getElementById('edit-sup-localidad');
  if (elLoc) elLoc.textContent = `Localidad: ${est.localidad} • ${est.domicilio}`;

  const m2Input = document.getElementById('edit-sup-m2-input');
  if (m2Input) {
    m2Input.value = est.superficie || '';
    actualizarBadgePreviewSuperficie(est.superficie);
    setTimeout(() => m2Input.focus(), 100);
  }

  modal.classList.remove('hidden');
}
window.abrirModalEditarSuperficie = abrirModalEditarSuperficie;

function actualizarBadgePreviewSuperficie(val) {
  const preview = document.getElementById('edit-sup-badge-preview');
  if (!preview) return;
  const num = Number(val);
  if (!val || isNaN(num) || num <= 0) {
    preview.className = 'p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 bg-slate-100 border-slate-200 text-slate-600';
    preview.innerHTML = '<i class="fa-solid fa-info-circle"></i><span>Ingrese los m² para verificar requerimientos</span>';
  } else if (num >= 1000) {
    preview.className = 'p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 bg-purple-50 border-purple-300 text-purple-900';
    preview.innerHTML = '<i class="fa-solid fa-bolt text-purple-600"></i><span><strong>Superficie ≥ 1.000 m²</strong>: Requiere mediciones técnicas obligatorias (PAT, Ruido, Iluminación).</span>';
  } else {
    preview.className = 'p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 bg-emerald-50 border-emerald-300 text-emerald-900';
    preview.innerHTML = '<i class="fa-solid fa-check-circle text-emerald-600"></i><span><strong>Superficie &lt; 1.000 m²</strong>: No requiere mediciones de gran superficie.</span>';
  }
}
window.actualizarBadgePreviewSuperficie = actualizarBadgePreviewSuperficie;

async function confirmarGuardadoSuperficieModal(event) {
  if (event) event.preventDefault();
  const idEst = document.getElementById('edit-sup-id-est')?.value;
  const m2Val = document.getElementById('edit-sup-m2-input')?.value;
  if (!idEst) return;

  await guardarSuperficieEstablecimiento(idEst, m2Val);
  cerrarModal('modal-editar-superficie');
}
window.confirmarGuardadoSuperficieModal = confirmarGuardadoSuperficieModal;

async function guardarSuperficieEstablecimiento(idEst, m2) {
  const est = AppState.establecimientos[idEst];
  if (!est) return;

  const numM2 = Number(m2);
  const m2Limpio = (!isNaN(numM2) && numM2 > 0) ? numM2 : '';
  est.superficie = m2Limpio;
  est.requiereMediciones = (numM2 >= 1000);

  if (!AppState.superficies) AppState.superficies = {};
  AppState.superficies[idEst] = {
    idSede: idEst,
    nroEstab: est.nroEstab,
    superficie: est.superficie,
    requiereMediciones: est.requiereMediciones
  };

  try {
    localStorage.setItem(STORAGE_KEYS.SUPERFICIES_DB, JSON.stringify(AppState.superficies));
  } catch (e) {}

  mostrarToast(`Guardando ${est.superficie || 0} m² para ${est.nombreEstablecimiento}...`);

  // Actualizar vistas inmediatas
  if (AppState.establecimientoSeleccionado && AppState.establecimientoSeleccionado.id === idEst) {
    renderFichaEstablecimiento(est);
  }
  renderMatrizAnual();

  // Enviar a Google Apps Script en segundo plano
  try {
    const url = `${getWebhookUrl()}?action=guardar_superficie&idSede=${encodeURIComponent(idEst)}&nroEstab=${encodeURIComponent(est.nroEstab || '')}&superficie=${encodeURIComponent(est.superficie)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.status === 'success') {
      mostrarToast(`✅ Superficie guardada en Google Sheets: ${est.superficie} m²`);
    } else {
      mostrarToast(`⚠️ Superficie guardada localmente (${est.superficie} m²). Se sincronizará con Sheets.`);
    }
  } catch (err) {
    console.warn('Error enviando superficie a Google Sheets:', err);
    mostrarToast(`⚠️ Guardado localmente (${est.superficie} m²). Se sincronizará en la próxima conexión.`);
  }
}
window.guardarSuperficieEstablecimiento = guardarSuperficieEstablecimiento;

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
