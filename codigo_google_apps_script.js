/**
 * SERVICIO WEBHOOK - GOOGLE APPS SCRIPT PARA INFORMES IAPSER & LEGAJO DIGITAL
 * Planilla: https://docs.google.com/spreadsheets/d/1-eQvCHv3LB6C2ydjY_fXwWEY67e5vbE4GNWIBKSrMfE/edit?gid=0#gid=0
 * 
 * Estructura de Hojas:
 * 1. 'Establecimientos': Directorio general con datos de cabecera de los 450+ establecimientos.
 * 2. 'Legajo_Actividades_Archivos': Registro cronológico de actividades técnicas y documentos guardados en Google Drive.
 * 3. 'Matriz_Control_Gestion': Tablero maestro por establecimiento (15 variables de control, Plan Teórico vs Realidad, SVCC).
 * 4. 'Datos': Historial detallado de relevamientos de HyS (Checklist Dec 351/79) guardados por fecha.
 * 5. 'Extintores_Detalle': Registro pormenorizado del parque de extintores relevado in situ.
 */

var SPREADSHEET_ID = "1-eQvCHv3LB6C2ydjY_fXwWEY67e5vbE4GNWIBKSrMfE";
var DRIVE_ROOT_FOLDER_NAME = "Informes_HyS_IAPSER_Oficial";
var DRIVE_ROOT_FOLDER_ID = "1s7pZpgkPJKlFdJMnpdWjnY2Tm0Rxv3HR"; // Carpeta raíz oficial fijada en Google Drive

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

// ========================================================
// SERVICIO DE GOOGLE DRIVE (JERARQUÍA Y GUARDADO CODIFICADO)
// ========================================================

function getOrCreateRootFolder() {
  if (DRIVE_ROOT_FOLDER_ID && DRIVE_ROOT_FOLDER_ID.trim() !== "") {
    try {
      return DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID.trim());
    } catch(e) {
      Logger.log("Error al abrir carpeta por ID (" + DRIVE_ROOT_FOLDER_ID + "): " + e.toString());
    }
  }
  var folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_ROOT_FOLDER_NAME);
}

function getOrCreateSubfolder(parentFolder, name) {
  var cleanName = (name || "Sin_Nombre").toString().replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!cleanName) cleanName = "General";
  
  var folders = parentFolder.getFoldersByName(cleanName);
  var activeFolders = [];
  while (folders.hasNext()) {
    var f = folders.next();
    try {
      if (!f.isTrashed()) {
        activeFolders.push(f);
      }
    } catch(e) {
      activeFolders.push(f);
    }
  }

  if (activeFolders.length > 0) {
    var primary = activeFolders[0];
    // Consolidar automáticamente si existieran carpetas duplicadas con el mismo nombre en este padre
    if (activeFolders.length > 1) {
      for (var i = 1; i < activeFolders.length; i++) {
        var dup = activeFolders[i];
        try {
          var dupFiles = dup.getFiles();
          while (dupFiles.hasNext()) {
            var file = dupFiles.next();
            try {
              file.moveTo(primary);
            } catch(eMove) {
              try { file.makeCopy(file.getName(), primary); file.setTrashed(true); } catch(eC) {}
            }
          }
          dup.setTrashed(true);
        } catch(eDup) {
          Logger.log("Aviso al consolidar carpeta duplicada (" + cleanName + "): " + eDup.toString());
        }
      }
    }
    return primary;
  }

  var newFolder = parentFolder.createFolder(cleanName);
  try {
    newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(eShare) {}
  return newFolder;
}

var MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parsearAnioMes(fecha) {
  var now = new Date();
  var anio = now.getFullYear();
  var mes = now.getMonth() + 1; // 1-12
  
  if (fecha) {
    var s = String(fecha).trim().split("T")[0].split(" ")[0].trim();
    if (s.includes("-")) {
      var p = s.split("-");
      if (p.length >= 2) {
        var y = parseInt(p[0], 10);
        var m = parseInt(p[1], 10);
        if (!isNaN(y) && y > 2000) {
          if (!isNaN(m) && m >= 1 && m <= 12) {
            anio = y; mes = m;
          } else if (p.length >= 3) {
            // Caso YYYY-DD-MM (ej: 2026-30-09)
            var d = parseInt(p[2], 10);
            if (!isNaN(d) && d >= 1 && d <= 12) {
              anio = y; mes = d;
            }
          }
        }
      }
    } else if (s.includes("/")) {
      var p2 = s.split("/");
      if (p2.length >= 3) {
        var y2 = parseInt(p2[2], 10);
        var m2 = parseInt(p2[1], 10);
        if (!isNaN(y2) && y2 > 2000) {
          if (!isNaN(m2) && m2 >= 1 && m2 <= 12) {
            anio = y2; mes = m2;
          } else {
            var mAlt = parseInt(p2[0], 10);
            if (!isNaN(mAlt) && mAlt >= 1 && mAlt <= 12) {
              anio = y2; mes = mAlt;
            }
          }
        }
      }
    }
  }
  var mesStr = (mes < 10 ? "0" : "") + mes;
  var mesNombre = MESES_NOMBRES[mes - 1] || "Mes";
  var codigoAAAAMM = String(anio) + String(mesStr);
  return {
    anio: anio,
    mes: mes,
    mesStr: mesStr,
    key: codigoAAAAMM,
    label: codigoAAAAMM,
    displayLabel: codigoAAAAMM + " (" + mesNombre + ")",
    legacyKey: anio + "-" + mesStr
  };
}

function getOrCreateMonthlyFolder(rootFolder, fecha) {
  var mInfo = parsearAnioMes(fecha);
  var monthlyParent = getOrCreateSubfolder(rootFolder, "Carpetas_Mensuales");
  try {
    monthlyParent.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {}

  var stdName = mInfo.anio + "-" + mInfo.mesStr + "_" + (MESES_NOMBRES[mInfo.mes - 1] || "MES").toUpperCase();
  var prefixDash = mInfo.anio + "-" + mInfo.mesStr;
  var prefix6 = mInfo.key;

  // Buscar si ya existe una carpeta para este mes en Carpetas_Mensuales
  var subFolders = monthlyParent.getFolders();
  var monthFolder = null;
  while (subFolders.hasNext()) {
    var sf = subFolders.next();
    try {
      if (!sf.isTrashed()) {
        var sfNom = sf.getName().trim().toUpperCase();
        if (sfNom === stdName.toUpperCase() || sfNom.indexOf(prefixDash) === 0 || sfNom.indexOf(prefix6) === 0) {
          monthFolder = sf;
          break;
        }
      }
    } catch(eSf) {}
  }

  // Si no existe, crearla con el nombre canónico oficial (ej: 2026-11_NOVIEMBRE)
  if (!monthFolder) {
    monthFolder = monthlyParent.createFolder(stdName);
  }

  try {
    monthFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(eShare) {}

  return {
    folder: monthFolder,
    url: monthFolder.getUrl(),
    id: monthFolder.getId(),
    key: mInfo.key,
    label: monthFolder.getName(),
    parentUrl: monthlyParent.getUrl(),
    parentId: monthlyParent.getId()
  };
}


function sanitizeText(text) {
  if (!text) return "";
  return text.toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Sin tildes
    .replace(/[^a-zA-Z0-9_\-\.]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function obtenerAbreviaturaOrganismo(org) {
  var s = (org || "").toUpperCase();
  if (s.includes("POLICIA") || s.includes("JEFATURA")) return "POL";
  if (s.includes("SALUD")) return "SALUD";
  if (s.includes("GOBIERNO")) return "GOB";
  if (s.includes("ATER") || s.includes("TRIBUTARIA")) return "ATER";
  if (s.includes("UADER") || s.includes("UNIVERSIDAD")) return "UADER";
  if (s.includes("JUBILACION")) return "CJPER";
  if (s.includes("TRIBUNAL")) return "TCER";
  if (s.includes("ALIMENTACION") || s.includes("ICAB")) return "ICAB";
  if (s.includes("ENERGIA")) return "ENERGIA";
  if (s.includes("PRODUCCION") || s.includes("URDINARRAIN")) return "EPPE";
  return sanitizeText(s.substring(0, 8)).toUpperCase() || "ORG";
}

function obtenerNombreOrganismoCanonico(org) {
  var s = (org || "").toString().trim().toUpperCase();
  if (s.includes("POLICIA") || s.includes("JEFATURA")) return "POLICIA";
  if (s.includes("SALUD") || s.includes("HOSPITAL")) return "SALUD";
  if (s.includes("GOBIERNO")) return "GOBIERNO";
  if (s.includes("ATER") || s.includes("TRIBUTARIA")) return "ATER";
  if (s.includes("UADER") || s.includes("UNIVERSIDAD")) return "UADER";
  if (s.includes("JUBILACION") || s.includes("CJPER")) return "CJPER";
  if (s.includes("TRIBUNAL") || s.includes("CUENTAS") || s.includes("TCER")) return "TCER";
  if (s.includes("ALIMENTACION") || s.includes("ICAB")) return "ICAB";
  if (s.includes("ENERGIA")) return "ENERGIA";
  if (s.includes("PRODUCCION") || s.includes("URDINARRAIN") || s.includes("EPPE")) return "EPPE";
  return sanitizeText(s).toUpperCase() || "GENERAL";
}

function normalizarCodigoActividad(act) {
  var s = (act || "").toLowerCase().trim();
  var map = {
    "constancia_visita": "CV",
    "constancia": "CV",
    "cv": "CV",
    "visita": "CV",
    "informe_tecnico": "INFORME",
    "informe": "INFORME",
    "informe_visita": "INFORME",
    "informe_fotografico": "INFORME",
    "fotografico": "INFORME",
    "confeccion_rgrl": "RGRL",
    "rgrl": "RGRL",
    "confeccion_rar": "RAR",
    "rar": "RAR",
    "capacitaciones": "CAPACITACION",
    "capacitacion": "CAPACITACION",
    "mediciones_ruido": "RUIDO",
    "medicion_ruido": "RUIDO",
    "ruido": "RUIDO",
    "mediciones_iluminacion": "ILUM",
    "medicion_iluminacion": "ILUM",
    "iluminacion": "ILUM",
    "mediciones_puesta_a_tierra": "PAT",
    "medicion_pat": "PAT",
    "puesta_a_tierra": "PAT",
    "pat": "PAT",
    "muestra_agua": "AGUA_TOMA",
    "analisis_agua": "AGUA_PROTOCOLO",
    "agua_laboratorio": "AGUA_PROTOCOLO",
    "res_886": "RES886",
    "ergonomia_res886": "RES886",
    "carga_fuego": "CARGA_FUEGO",
    "evaluacion_carga_fuego": "CARGA_FUEGO",
    "simulacro": "SIMULACRO",
    "simulacros_evacuacion": "SIMULACRO",
    "control_extintores": "EXTINTORES"
  };
  return map[s] || sanitizeText(s).toUpperCase() || "DOC";
}

function generarNombreArchivoCodificado(org, nroEstab, actividad, fecha, detalle, extension) {
  var orgAbbr = obtenerAbreviaturaOrganismo(org);
  var cleanNro = sanitizeText(nroEstab || "000");
  while (cleanNro.length < 3 && !isNaN(cleanNro)) cleanNro = "0" + cleanNro;

  var actCode = normalizarCodigoActividad(actividad);

  var fechaStr = "";
  if (fecha) {
    fechaStr = String(fecha).replace(/[^0-9]/g, "");
  }
  if (!fechaStr || fechaStr.length < 8) {
    var now = new Date();
    fechaStr = Utilities.formatDate(now, "GMT-3", "yyyyMMdd");
  } else if (fechaStr.length === 8 && fecha.includes("/")) {
    // Si viene como DD/MM/YYYY, convertir a YYYYMMDD
    var parts = fecha.split("/");
    if (parts.length === 3) {
      fechaStr = parts[2] + parts[1] + parts[0];
    }
  }

  var cleanDetalle = sanitizeText(detalle || "Informe");
  var ext = extension ? "." + extension.replace(/^\./, "") : ".pdf";

  return orgAbbr + "_" + cleanNro + "_" + actCode + "_" + fechaStr + "_" + cleanDetalle + ext;
}

// ========================================================
// GET REQUESTS
// ========================================================

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

    // 1. Obtener Matriz de Control de Gestión
    if (action === "get_matriz") {
      var sheetMatriz = ss.getSheetByName("Matriz_Control_Gestion");
      if (!sheetMatriz) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", matriz: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var mData = sheetMatriz.getDataRange().getValues();
      var mHeaders = mData[0] || [];
      var mRows = [];
      for (var r = 1; r < mData.length; r++) {
        var obj = {};
        for (var c = 0; c < mHeaders.length; c++) {
          var mVal = mData[r][c];
          if (mVal instanceof Date) {
            try { mVal = Utilities.formatDate(mVal, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd"); } catch(eD) { mVal = mVal.toISOString(); }
          }
          obj[mHeaders[c]] = mVal;
        }
        mRows.push(obj);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", matriz: mRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Obtener Historial de Actividades / Documentos del Legajo (Individual o Global)
    if (action === "get_legajo_establecimiento" || action === "get_todos_legajos") {
      var sheetLegajo = ss.getSheetByName("Legajo_Actividades_Archivos");
      if (!sheetLegajo) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", actividades: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var lData = sheetLegajo.getDataRange().getValues();
      var lHeaders = lData[0] || [];
      var targetNro = (e.parameter.nroEstab || "").toString().trim().toLowerCase();
      var targetNom = (e.parameter.nombreEstab || "").toString().trim().toLowerCase();
      var targetOrg = (e.parameter.organismo || "").toString().trim().toLowerCase();
      var isGlobal = (action === "get_todos_legajos") || (!targetNro && !targetNom && !targetOrg);

      var colNroIdx = lHeaders.indexOf("N° Estab");
      if (colNroIdx === -1) colNroIdx = lHeaders.indexOf("Nro Estab");
      if (colNroIdx === -1) colNroIdx = 4;

      var colNomIdx = lHeaders.indexOf("Nombre Establecimiento");
      if (colNomIdx === -1) colNomIdx = 5;

      var colOrgIdx = lHeaders.indexOf("Organismo");
      if (colOrgIdx === -1) colOrgIdx = 3;

      var colFechaIdx = lHeaders.indexOf("Fecha Actividad");
      if (colFechaIdx === -1) colFechaIdx = 2;

      var results = [];
      for (var i = 1; i < lData.length; i++) {
        var row = lData[i];
        var rNro = String(row[colNroIdx] || "").trim().toLowerCase();
        var rNom = String(row[colNomIdx] || "").trim().toLowerCase();
        var rOrg = String(row[colOrgIdx] || "").trim().toLowerCase();

        var match = false;
        if (isGlobal) {
          match = true;
        } else if (targetNro && rNro && targetNro === rNro) {
          match = true;
        } else if (targetNom && rNom && (rNom.includes(targetNom) || targetNom.includes(rNom))) {
          match = true;
        } else if (!targetNro && !targetNom && targetOrg && rOrg.includes(targetOrg)) {
          match = true;
        }

        if (match) {
          var item = {};
          for (var col = 0; col < lHeaders.length; col++) {
            var val = row[col];
            if (val instanceof Date) {
              try {
                val = Utilities.formatDate(val, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd");
              } catch(eDate) {
                val = val.toISOString().substring(0, 10);
              }
            } else if (col === colFechaIdx && typeof val === "string") {
              // Auto-corregir formato YYYY-DD-MM a YYYY-MM-DD
              var mInvert = val.trim().match(/^(\d{4})[-_\/](\d{1,2})[-_\/](\d{1,2})/);
              if (mInvert) {
                var yI = mInvert[1];
                var p1I = parseInt(mInvert[2], 10);
                var p2I = parseInt(mInvert[3], 10);
                if (p1I > 12 && p2I <= 12) {
                  val = yI + "-" + (p2I < 10 ? "0" : "") + p2I + "-" + (p1I < 10 ? "0" : "") + p1I;
                  // Auto-sanar la celda física en la hoja de cálculo
                  try {
                    sheetLegajo.getRange(i + 1, colFechaIdx + 1).setValue(val);
                  } catch(eFixCell) {}
                }
              }
            }
            item[lHeaders[col]] = val;
          }
          results.push(item);
        }
      }

      // Obtener superficies de establecimientos si la hoja existe
      var sSup = ss.getSheetByName("Superficie_Establecimientos");
      var superficies = {};
      var sheetSuperficiesUrl = "";
      if (sSup) {
        try { sheetSuperficiesUrl = ss.getUrl() + "#gid=" + sSup.getSheetId(); } catch(eSId) {}
        if (sSup.getLastRow() > 1) {
          var dSup = sSup.getDataRange().getValues();
          for (var rowI = 1; rowI < dSup.length; rowI++) {
            var rId = String(dSup[rowI][0] || "").trim();
            var rNro = String(dSup[rowI][1] || "").trim();
            var rNom = String(dSup[rowI][2] || "").trim().toLowerCase();
            var rM2 = parseFloat(dSup[rowI][6]);
            if (!isNaN(rM2) && rM2 > 0) {
              var itemM2 = { m2: rM2, requiereMediciones: rM2 >= 1000 };
              if (rId) superficies[rId] = itemM2;
              if (rNro) superficies["nro_" + rNro] = itemM2;
              if (rNom) superficies["nom_" + rNom] = itemM2;
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        actividades: results,
        superficies: superficies,
        sheetSuperficiesUrl: sheetSuperficiesUrl || ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2b. Obtener Superficies de Establecimientos
    if (action === "get_superficies") {
      var sSupOnly = ss.getSheetByName("Superficie_Establecimientos");
      var supMap = {};
      var sUrl = "";
      if (sSupOnly) {
        try { sUrl = ss.getUrl() + "#gid=" + sSupOnly.getSheetId(); } catch(eU) { sUrl = ss.getUrl(); }
        if (sSupOnly.getLastRow() > 1) {
          var dS = sSupOnly.getDataRange().getValues();
          for (var rS = 1; rS < dS.length; rS++) {
            var idS = String(dS[rS][0] || "").trim();
            var nroS = String(dS[rS][1] || "").trim();
            var nomS = String(dS[rS][2] || "").trim().toLowerCase();
            var m2S = parseFloat(dS[rS][6]);
            if (!isNaN(m2S) && m2S > 0) {
              var itemS = { m2: m2S, requiereMediciones: m2S >= 1000 };
              if (idS) supMap[idS] = itemS;
              if (nroS) supMap["nro_" + nroS] = itemS;
              if (nomS) supMap["nom_" + nomS] = itemS;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        superficies: supMap,
        sheetUrl: sUrl || ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2c. Guardar Superficie vía GET
    if (action === "guardar_superficie") {
      var idGet = e.parameter.idSede || e.parameter.id;
      var nroGet = e.parameter.nroEstab || "";
      var m2Get = e.parameter.superficie || e.parameter.m2;
      var resM2Get = guardarSuperficieSede(ss, idGet, nroGet, "", m2Get);
      return ContentService.createTextOutput(JSON.stringify(resM2Get))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Obtener Resumen Métrico de Actividades
    if (action === "get_resumen_actividades") {
      var sL = ss.getSheetByName("Legajo_Actividades_Archivos");
      var stats = { totalActividades: 0, porActividad: {}, porEstado: {}, totalArchivos: 0 };
      if (sL) {
        var d = sL.getDataRange().getValues();
        stats.totalActividades = Math.max(0, d.length - 1);
        for (var k = 1; k < d.length; k++) {
          var act = String(d[k][7] || "Otro");
          var est = String(d[k][8] || "Completado");
          var url = String(d[k][11] || "");
          stats.porActividad[act] = (stats.porActividad[act] || 0) + 1;
          stats.porEstado[est] = (stats.porEstado[est] || 0) + 1;
          if (url && url.startsWith("http")) stats.totalArchivos++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", stats: stats }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3b. Obtener Listado de Carpetas Mensuales en Google Drive
    if (action === "get_carpetas_mensuales") {
      var rootF = getOrCreateRootFolder();
      var monthlyParent = getOrCreateSubfolder(rootF, "Carpetas_Mensuales");
      var listCarpetas = [];
      var seenIds = {};

      // 1. Carpetas dentro del contenedor oficial 'Carpetas_Mensuales'
      var legSubs = monthlyParent.getFolders();
      while (legSubs.hasNext()) {
        var legSub = legSubs.next();
        try {
          if (!legSub.isTrashed() && !seenIds[legSub.getId()]) {
            seenIds[legSub.getId()] = true;
            listCarpetas.push({
              name: legSub.getName().trim(),
              id: legSub.getId(),
              url: legSub.getUrl()
            });
          }
        } catch(eLeg) {}
      }

      // 2. Compatibilidad si hubiera alguna carpeta directa en la raíz
      var rootSubs = rootF.getFolders();
      while (rootSubs.hasNext()) {
        var sub = rootSubs.next();
        try {
          if (!sub.isTrashed() && !seenIds[sub.getId()]) {
            var subName = sub.getName().trim();
            if (/^\d{6}$/.test(subName) || /^\d{4}-\d{2}/.test(subName)) {
              seenIds[sub.getId()] = true;
              listCarpetas.push({
                name: subName,
                id: sub.getId(),
                url: sub.getUrl()
              });
            }
          }
        } catch(eSub) {}
      }

      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        parentMensualUrl: monthlyParent.getUrl(), 
        carpetas: listCarpetas 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3c. Obtener o crear carpeta institucional del establecimiento (dentro de Organismo canónico, general no mensual)
    if (action === "get_carpeta_establecimiento" || action === "obtener_carpeta_establecimiento") {
      var orgNomGet = (e.parameter.organismo || "").toString().trim() || "General";
      var canonOrgGet = obtenerNombreOrganismoCanonico(orgNomGet);
      var estabNomGet = (e.parameter.nombreEstab || e.parameter.establecimiento || "").toString().trim() || "Establecimiento";
      var nroEstabValGet = (e.parameter.nroEstab || "").toString().trim();

      var rootFolderGet = getOrCreateRootFolder();
      try { rootFolderGet.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eRootS) {}

      var orgFolderGet = getOrCreateSubfolder(rootFolderGet, canonOrgGet);
      try { orgFolderGet.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eOrgS) {}

      var cleanNroTagGet = nroEstabValGet ? ("Estab_" + nroEstabValGet) : "Estab_General";
      var estabFolderNameGet = cleanNroTagGet + " - " + estabNomGet;
      var estabFolderGet = getOrCreateSubfolder(orgFolderGet, estabFolderNameGet);
      try { estabFolderGet.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eEstS) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        folderUrl: estabFolderGet.getUrl(),
        folderId: estabFolderGet.getId(),
        folderName: estabFolderNameGet,
        orgFolderUrl: orgFolderGet.getUrl(),
        orgFolderName: canonOrgGet
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3d. Consolidar carpetas duplicadas en Google Drive (Mantenimiento)
    if (action === "consolidar_carpetas_drive") {
      var rootConsol = getOrCreateRootFolder();
      var statsConsol = consolidarCarpetasDuplicadasDrive(rootConsol);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Consolidación de carpetas duplicadas completada exitosamente.",
        stats: statsConsol
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3f. Reparar archivos y matriz de Establecimiento 45
    if (action === "reparar_estab_45") {
      var resRep = repararArchivosEstablecimiento45();
      return ContentService.createTextOutput(JSON.stringify(resRep))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3g. Limpiar y desduplicar archivos con el mismo nombre en todas las carpetas
    if (action === "desduplicar_archivos_drive" || action === "limpiar_archivos_duplicados") {
      var rootClean = getOrCreateRootFolder();
      var statsClean = desduplicarArchivosDrive(rootClean);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Limpieza y desduplicación de archivos completada exitosamente.",
        stats: statsClean
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3h. Auditoría y consolidación masiva de TODOS los establecimientos en Drive
    if (action === "consolidar_todos_los_establecimientos" || action === "corregir_todas_las_carpetas") {
      var rootMasivo = getOrCreateRootFolder();
      var resMasivo = consolidarTodosLosEstablecimientosDrive(rootMasivo);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Consolidación de todos los establecimientos completada exitosamente.",
        stats: resMasivo
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3i. Sincronizar y poblar réplicas de Septiembre 2026 en Google Drive
    if (action === "sincronizar_septiembre" || action === "reparar_septiembre") {
      var resSept = sincronizarCarpetaSeptiembreDrive();
      return ContentService.createTextOutput(JSON.stringify(resSept))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3j. Sincronizar y poblar réplicas de Octubre 2026 en Google Drive
    if (action === "sincronizar_octubre" || action === "reparar_octubre") {
      var resOct = sincronizarCarpetaOctubreDrive();
      return ContentService.createTextOutput(JSON.stringify(resOct))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3e. Diagnóstico de carpetas por nombre en todo Drive
    if (action === "buscar_carpetas_sede") {
      var queryName = (e.parameter.nombre || "Estab_1 - CORDOBA - 351 (PARANA)").toString().trim();
      var fIter = DriveApp.getFoldersByName(queryName);
      var resultados = [];
      while (fIter.hasNext()) {
        var f = fIter.next();
        var padres = [];
        try {
          var pIter = f.getParents();
          while (pIter.hasNext()) {
            var p = pIter.next();
            padres.push({ id: p.getId(), name: p.getName() });
          }
        } catch(eP) {}
        resultados.push({
          id: f.getId(),
          name: f.getName(),
          isTrashed: f.isTrashed(),
          url: f.getUrl(),
          dateCreated: f.getDateCreated(),
          parents: padres
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: resultados.length, carpetas: resultados }))
        .setMimeType(ContentService.MimeType.JSON);
    }


    // 4. Por defecto: Listado maestro de Establecimientos
    var sheet = ss.getSheetByName("Establecimientos");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", establecimientos: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    var list = [];
    
    for (var j = 1; j < data.length; j++) {
      var rowEst = data[j];
      var org = rowEst[0] ? String(rowEst[0]).trim() : "";
      var nom = rowEst[1] ? String(rowEst[1]).trim() : "";
      var dom = rowEst[2] ? String(rowEst[2]).trim() : "";
      var cp = rowEst[3] ? String(rowEst[3]).trim() : "";
      var loc = rowEst[4] ? String(rowEst[4]).trim() : "";
      var prov = rowEst[5] ? String(rowEst[5]).trim() : "";
      var nro = rowEst[6] ? String(rowEst[6]).trim() : "";

      if (org || dom || nro) {
        list.push({
          id: "sheet_row_" + (j + 1),
          rowIndex: j + 1,
          organismo: org,
          razonSocial: org,
          nombreEstablecimiento: nom,
          domicilio: dom,
          direccion: dom,
          cp: cp,
          localidad: loc,
          provincia: prov || "Entre Ríos",
          nroEstab: nro
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", establecimientos: list }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================================
// POST REQUESTS
// ========================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet();

    // ========================================================
    // CASO 1: CARGA DE ACTIVIDAD Y DOCUMENTO AL LEGAJO (DRIVE)
    // ========================================================
    if (data.tipoOperacion === "upload_actividad_documento") {
      var estObj = data.establecimiento || {};
      var orgNom = String(estObj.organismo || estObj.razonSocial || "ORGANISMO_GENERAL").trim();
      var estabNom = String(estObj.nombreEstablecimiento || estObj.domicilio || "Establecimiento").trim();
      var nroEstabVal = String(estObj.nroEstab || "").trim();
      var locVal = String(estObj.localidad || "Entre Ríos").trim();

      var actTipo = String(data.tipoActividad || "General").trim();
      var fechaAct = String(data.fechaActividad || "").trim();
      if (fechaAct) {
        var mInvertPost = fechaAct.match(/^(\d{4})[-_\/](\d{1,2})[-_\/](\d{1,2})/);
        if (mInvertPost) {
          var yPost = mInvertPost[1];
          var p1Post = parseInt(mInvertPost[2], 10);
          var p2Post = parseInt(mInvertPost[3], 10);
          if (p1Post > 12 && p2Post <= 12) {
            fechaAct = yPost + "-" + (p2Post < 10 ? "0" : "") + p2Post + "-" + (p1Post < 10 ? "0" : "") + p1Post;
          }
        }
      }
      var estadoAct = String(data.estadoActividad || "Completado").trim();
      var detalle = String(data.detalle || "").trim();
      var preventor = String(data.preventor || "").trim();
      var observaciones = String(data.observaciones || "").trim();

      var fileBase64 = data.fileBase64 || "";
      var originalFileName = data.originalFileName || "";
      var mimeType = data.mimeType || "application/pdf";

      var driveUrl = "";
      var fileBase64 = data.fileBase64 || "";
      var originalFileName = data.originalFileName || "";
      var mimeType = data.mimeType || "application/pdf";
      var permitirReemplazo = (data.permitirReemplazo === true || data.permitirReemplazo === "true");

      var driveUrl = "";
      var driveFileId = "";
      var codedFileName = "";

      // 0. Control de Duplicados en 'Legajo_Actividades_Archivos':
      // Mismo Organismo + Mismo Nro Estab + Mismo Tipo de Actividad + Misma Fecha
      var sheetLegajo = ss.getSheetByName("Legajo_Actividades_Archivos");
      var existingRowIndex = -1;
      var existingFileId = "";

      if (sheetLegajo && sheetLegajo.getLastRow() > 1) {
        var legData = sheetLegajo.getDataRange().getValues();
        var colFechaIdx = 2;   // Fecha Actividad
        var colOrgIdx = 3;     // Organismo
        var colNroIdx = 4;     // N° Estab
        var colTipoIdx = 7;    // Tipo Actividad
        var colFileIdIdx = 12; // ID Drive

        var cleanFechaBuscada = String(fechaAct).split("T")[0].trim();
        var cleanOrgBuscado = String(orgNom).toLowerCase().trim();
        var cleanNroBuscado = String(nroEstabVal).toLowerCase().trim();
        var cleanTipoBuscado = normalizarCodigoActividad(actTipo);

        for (var l = 1; l < legData.length; l++) {
          var rowL = legData[l];
          var rFecha = rowL[colFechaIdx];
          if (rFecha instanceof Date) {
            try { rFecha = Utilities.formatDate(rFecha, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd"); } catch(eDate) { rFecha = rFecha.toISOString().substring(0, 10); }
          } else {
            rFecha = String(rFecha || "").split("T")[0].trim();
          }
          var rOrg = String(rowL[colOrgIdx] || "").toLowerCase().trim();
          var rNro = String(rowL[colNroIdx] || "").toLowerCase().trim();
          var rTipo = normalizarCodigoActividad(String(rowL[colTipoIdx] || ""));

          if (rFecha === cleanFechaBuscada && rOrg === cleanOrgBuscado && rNro === cleanNroBuscado && rTipo === cleanTipoBuscado) {
            existingRowIndex = l + 1; // Fila en Sheets (1-indexada)
            existingFileId = String(rowL[colFileIdIdx] || "").trim();
            break;
          }
        }
      }

      // Si es duplicado y el usuario no autorizó explícitamente el reemplazo, rechazar
      if (existingRowIndex > 1 && !permitirReemplazo) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "duplicate_warning",
          message: "Ya existe un documento de tipo '" + actTipo + "' registrado con fecha " + fechaAct + " para " + orgNom + " (Sede N° " + (nroEstabVal || "S/N") + ").",
          existingRowIndex: existingRowIndex
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Si se autorizó reemplazo y había un archivo previo, mover el anterior a la papelera
      if (existingRowIndex > 1 && permitirReemplazo && existingFileId) {
        try {
          DriveApp.getFileById(existingFileId).setTrashed(true);
        } catch(eTrash) {
          Logger.log("Aviso al mover archivo duplicado previo a papelera: " + eTrash.toString());
        }
      }

      // 1. Guardar archivo en Google Drive si se adjuntó contenido Base64
      var mFolderData = null;
      var monthFolderUrl = "";
      var monthFolderId = "";

      if (fileBase64) {
        var rootFolder = getOrCreateRootFolder();
        try { rootFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eRootS) {}

        var canonOrg = obtenerNombreOrganismoCanonico(orgNom);
        var orgFolder = getOrCreateSubfolder(rootFolder, canonOrg);
        try { orgFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eOrgS) {}

        var cleanNroTag = nroEstabVal ? ("Estab_" + nroEstabVal) : "Estab_General";
        var estabFolderName = cleanNroTag + " - " + estabNom;
        var estabFolder = getOrCreateSubfolder(orgFolder, estabFolderName);
        try { estabFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eEstS) {}

        var ext = "pdf";
        if (originalFileName.lastIndexOf(".") !== -1) {
          ext = originalFileName.substring(originalFileName.lastIndexOf(".") + 1);
        }

        codedFileName = generarNombreArchivoCodificado(canonOrg, nroEstabVal, actTipo, fechaAct, detalle, ext);

        var cleanBase64 = String(fileBase64 || "").replace(/^data:.*base64,/, "").replace(/\s+/g, "");
        var fileBytes = Utilities.base64Decode(cleanBase64);
        var blob = Utilities.newBlob(fileBytes, mimeType, codedFileName);
        
        // 1.a. Guardar archivo físico en la carpeta institucional: Organismo > Sede
        var createdFile = estabFolder.createFile(blob);
        try {
          createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(shareErr) {
          Logger.log("No se pudo configurar sharing público: " + shareErr.toString());
        }

        driveUrl = createdFile.getUrl();
        driveFileId = createdFile.getId();

        // 1.b. Guardar además archivo físico real en la Carpeta Mensual anidada:
        // Carpetas_Mensuales > [Mes/Año] > [Organismo] > [Estab_XXX - Nombre]
        try {
          mFolderData = getOrCreateMonthlyFolder(rootFolder, fechaAct);
          monthFolderUrl = mFolderData.url;
          monthFolderId = mFolderData.id;

          var monthOrgFolder = getOrCreateSubfolder(mFolderData.folder, canonOrg);
          try { monthOrgFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(mOrgS) {}

          var monthEstabFolder = getOrCreateSubfolder(monthOrgFolder, estabFolderName);
          try { monthEstabFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(mEstS) {}

          // Crear copia física real en la carpeta mensual (no solo shortcut)
          var monthCopy = createdFile.makeCopy(codedFileName, monthEstabFolder);
          try {
            monthCopy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch(mCopyS) {}

        } catch(monthErr) {
          Logger.log("Error al guardar en carpeta mensual (anidado): " + monthErr.toString());
        }
      }

      // 2. Registrar o Actualizar en la hoja 'Legajo_Actividades_Archivos'
      if (!sheetLegajo) {
        sheetLegajo = ss.insertSheet("Legajo_Actividades_Archivos");
        var headersLeg = [
          "ID Registro", "Timestamp", "Fecha Actividad", "Organismo", "N° Estab",
          "Nombre Establecimiento", "Localidad", "Tipo Actividad", "Estado",
          "Detalle / Puesto / Tema", "Nombre Archivo", "URL Google Drive",
          "ID Drive", "Preventor Responsable", "Observaciones", "URL Carpeta Mensual"
        ];
        sheetLegajo.appendRow(headersLeg);
        var rHead = sheetLegajo.getRange(1, 1, 1, headersLeg.length);
        rHead.setBackground("#0b3d63");
        rHead.setFontColor("#ffffff");
        rHead.setFontWeight("bold");
        sheetLegajo.setFrozenRows(1);
      } else {
        var curHeaders = sheetLegajo.getRange(1, 1, 1, Math.max(16, sheetLegajo.getLastColumn())).getValues()[0];
        if (!curHeaders[15] || curHeaders[15] === "") {
          sheetLegajo.getRange(1, 16).setValue("URL Carpeta Mensual").setBackground("#0b3d63").setFontColor("#ffffff").setFontWeight("bold");
        }
      }

      var regId = (existingRowIndex > 1 && permitirReemplazo) ? ("ACT_" + new Date().getTime()) : ("ACT_" + new Date().getTime());
      var rowPayload = [
        regId,
        new Date(),
        fechaAct,
        orgNom,
        nroEstabVal,
        estabNom,
        locVal,
        actTipo,
        estadoAct,
        detalle,
        codedFileName || originalFileName,
        driveUrl,
        driveFileId,
        preventor,
        observaciones,
        monthFolderUrl || ""
      ];

      if (existingRowIndex > 1 && permitirReemplazo) {
        sheetLegajo.getRange(existingRowIndex, 1, 1, rowPayload.length).setValues([rowPayload]);
      } else {
        sheetLegajo.appendRow(rowPayload);
      }

      // 3. Sincronizar en la 'Matriz_Control_Gestion'
      actualizarMatrizPorActividad(ss, orgNom, estabNom, nroEstabVal, actTipo, estadoAct, fechaAct, driveUrl);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: (existingRowIndex > 1 && permitirReemplazo) 
          ? "Documento y actividad actualizados exitosamente en Drive y Sheets." 
          : "Actividad y documento registrados exitosamente (en Organismo > Sede y en Mes/Año > Organismo > Sede).",
        registroId: regId,
        esReemplazo: (existingRowIndex > 1 && permitirReemplazo),
        fileName: codedFileName,
        fileUrl: driveUrl,
        fileId: driveFileId,
        monthFolderUrl: monthFolderUrl || "",
        monthFolderId: monthFolderId || "",
        monthKey: mFolderData ? mFolderData.key : "",
        monthLabel: mFolderData ? mFolderData.label : "",
        parentMensualUrl: mFolderData ? mFolderData.parentUrl : "",
        estabFolderUrl: (estabFolder && typeof estabFolder.getUrl === "function") ? estabFolder.getUrl() : "",
        estabFolderId: (estabFolder && typeof estabFolder.getId === "function") ? estabFolder.getId() : "",
        orgFolderUrl: (orgFolder && typeof orgFolder.getUrl === "function") ? orgFolder.getUrl() : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }


    // ========================================================
    // CASO 1.5: ELIMINAR DOCUMENTO / ACTIVIDAD Y LIMPIAR REGISTRO
    // ========================================================
    if (data.tipoOperacion === "eliminar_actividad_documento") {
      var targetRegId = String(data.registroId || "").trim();
      var targetFileId = String(data.fileId || "").trim();
      var targetFileName = String(data.fileName || "").trim();
      var targetEstab = String(data.establecimiento || "").trim();
      var targetNroEstab = String(data.nroEstab || "").trim();
      var targetTipoAct = String(data.tipoActividad || "").trim();

      var fileDeleted = false;
      var rowDeleted = false;

      // 1. Enviar archivo a papelera de Drive si se tiene el ID
      if (targetFileId) {
        try {
          var driveFile = DriveApp.getFileById(targetFileId);
          driveFile.setTrashed(true);
          fileDeleted = true;
        } catch (eDrive) {
          Logger.log("Aviso al mover archivo a papelera en Drive: " + eDrive);
        }
      }

      // 2. Eliminar fila en Legajo_Actividades_Archivos
      var sheetLegajo = ss.getSheetByName("Legajo_Actividades_Archivos");
      if (sheetLegajo && sheetLegajo.getLastRow() > 1) {
        var dataLeg = sheetLegajo.getDataRange().getValues();
        for (var r = dataLeg.length - 1; r >= 1; r--) {
          var row = dataLeg[r];
          var rowRegId = String(row[0] || "").trim();
          var rowEstab = String(row[5] || "").trim();
          var rowTipo = String(row[7] || "").trim();
          var rowFileName = String(row[10] || "").trim();
          var rowFileId = String(row[12] || "").trim();

          var match = false;
          if (targetRegId && rowRegId && targetRegId === rowRegId) {
            match = true;
          } else if (targetFileId && rowFileId && targetFileId === rowFileId) {
            match = true;
          } else if (targetFileName && rowFileName && targetFileName === rowFileName) {
            match = true;
          }

          if (match) {
            if (!fileDeleted && rowFileId) {
              try {
                DriveApp.getFileById(rowFileId).setTrashed(true);
                fileDeleted = true;
              } catch (eF) {}
            }
            if (!targetEstab && rowEstab) targetEstab = rowEstab;
            if (!targetTipoAct && rowTipo) targetTipoAct = rowTipo;

            sheetLegajo.deleteRow(r + 1);
            rowDeleted = true;
            break;
          }
        }
      }

      // 3. Actualizar celda en 'Matriz_Control_Gestion'
      if (targetEstab && targetTipoAct) {
        var colNameMap = {
          "constancia_visita": "CONSTANCIA_VISITA",
          "cv": "CONSTANCIA_VISITA",
          "informe_tecnico": "INFORME_TECNICO",
          "informe": "INFORME_TECNICO",
          "informe_fotografico": "INFORME_TECNICO",
          "confeccion_rgrl": "RGRL",
          "confeccion_rar": "RAR",
          "capacitaciones": "CAPACITACION_EN_OCASION_DE_VISITA",
          "medicion_ruido": "MEDICION_DE_RUIDO",
          "mediciones_ruido": "MEDICION_DE_RUIDO",
          "ruido": "MEDICION_DE_RUIDO",
          "medicion_iluminacion": "MEDICION_DE_ILUMINACION",
          "mediciones_iluminacion": "MEDICION_DE_ILUMINACION",
          "iluminacion": "MEDICION_DE_ILUMINACION",
          "ilum": "MEDICION_DE_ILUMINACION",
          "medicion_pat": "MEDICION_PUESTA_A_TIERRA",
          "mediciones_puesta_a_tierra": "MEDICION_PUESTA_A_TIERRA",
          "puesta_a_tierra": "MEDICION_PUESTA_A_TIERRA",
          "pat": "MEDICION_PUESTA_A_TIERRA",
          "muestra_agua": "ANALISIS_DE_AGUA",
          "analisis_agua": "ANALISIS_DE_AGUA",
          "res_886": "RES_886",
          "carga_fuego": "ESTUDIO_CARGA_DE_FUEGO",
          "simulacro": "SIMULACRO_EVACUACION",
          "control_extintores": "CONTROL_DE_EXTINTORES"
        };
        var colTarget = colNameMap[targetTipoAct.toLowerCase()] || colNameMap[normalizarCodigoActividad(targetTipoAct).toLowerCase()];
        if (colTarget) {
          // Buscar si queda algún otro registro para esta sede y actividad
          var remainingValue = "";
          if (sheetLegajo && sheetLegajo.getLastRow() > 1) {
            var freshData = sheetLegajo.getDataRange().getValues();
            for (var f = freshData.length - 1; f >= 1; f--) {
              var fEstab = String(freshData[f][5] || "").toLowerCase().trim();
              var fTipo = String(freshData[f][7] || "").toLowerCase().trim();
              if (fEstab.includes(targetEstab.toLowerCase()) || targetEstab.toLowerCase().includes(fEstab)) {
                if (fTipo === targetTipoAct.toLowerCase() || normalizarCodigoActividad(fTipo) === normalizarCodigoActividad(targetTipoAct)) {
                  var fEstado = freshData[f][8] || "Completado";
                  var fFecha = freshData[f][2] ? String(freshData[f][2]).split("T")[0] : "";
                  remainingValue = fEstado + (fFecha ? " (" + fFecha + ")" : "");
                  break;
                }
              }
            }
          }
          actualizarColumnaMatriz(ss, "", targetEstab, targetNroEstab, colTarget, remainingValue);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Registro eliminado y archivo enviado a papelera correctamente.",
        fileDeleted: fileDeleted,
        rowDeleted: rowDeleted
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ========================================================
    // CASO 1.8: SETUP / POBLAR HOJA SUPERFICIES (M2)
    // ========================================================
    if (data.tipoOperacion === "setup_superficies") {
      var resSetup = setupSuperficiesSheet(ss, data.establecimientos || []);
      return ContentService.createTextOutput(JSON.stringify(resSetup))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ========================================================
    // CASO 1.9: GUARDAR / ACTUALIZAR SUPERFICIE (M2) DE SEDE
    // ========================================================
    if (data.tipoOperacion === "guardar_superficie") {
      var resM2 = guardarSuperficieSede(ss, data.id, data.nroEstab, data.nombreEstablecimiento, data.m2);
      return ContentService.createTextOutput(JSON.stringify(resM2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // CASO 1.8: OBTENER O CREAR CARPETA DEL ESTABLECIMIENTO (ORGANISMO > SEDE GENERAL)
    if (data.tipoOperacion === "get_carpeta_establecimiento" || data.tipoOperacion === "obtener_carpeta_establecimiento") {
      var orgNomPost = (data.organismo || "").toString().trim() || "General";
      var estabNomPost = (data.nombreEstab || data.establecimiento || "").toString().trim() || "Establecimiento";
      var nroEstabValPost = (data.nroEstab || "").toString().trim();

      var rootFolderPost = getOrCreateRootFolder();
      try { rootFolderPost.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eRootS) {}

      var canonOrgPost = obtenerNombreOrganismoCanonico(orgNomPost);
      var orgFolderPost = getOrCreateSubfolder(rootFolderPost, canonOrgPost);
      try { orgFolderPost.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eOrgS) {}

      var cleanNroTagPost = nroEstabValPost ? ("Estab_" + nroEstabValPost) : "Estab_General";
      var estabFolderNamePost = cleanNroTagPost + " - " + estabNomPost;
      var estabFolderPost = getOrCreateSubfolder(orgFolderPost, estabFolderNamePost);
      try { estabFolderPost.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eEstS) {}

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        folderUrl: estabFolderPost.getUrl(),
        folderId: estabFolderPost.getId(),
        folderName: estabFolderNamePost,
        orgFolderUrl: orgFolderPost.getUrl(),
        orgFolderName: canonOrgPost
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // CASO 1.10: CONSOLIDAR CARPETAS DUPLICADAS EN GOOGLE DRIVE
    if (data.tipoOperacion === "consolidar_carpetas_drive") {
      var rootConsolPost = getOrCreateRootFolder();
      var statsPost = consolidarCarpetasDuplicadasDrive(rootConsolPost);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Consolidación de carpetas duplicadas completada exitosamente.",
        stats: statsPost
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // CASO 1.11: DESDUPLICAR ARCHIVOS CON EL MISMO NOMBRE
    if (data.tipoOperacion === "desduplicar_archivos_drive" || data.tipoOperacion === "limpiar_archivos_duplicados") {
      var rootCleanPost = getOrCreateRootFolder();
      var statsCleanPost = desduplicarArchivosDrive(rootCleanPost);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Limpieza y desduplicación de archivos completada exitosamente.",
        stats: statsCleanPost
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // CASO 1.12: CORREGIR Y CONSOLIDAR TODAS LAS CARPETAS DE ESTABLECIMIENTOS
    if (data.tipoOperacion === "consolidar_todos_los_establecimientos" || data.tipoOperacion === "corregir_todas_las_carpetas") {
      var rootMasivoPost = getOrCreateRootFolder();
      var statsMasivoPost = consolidarTodosLosEstablecimientosDrive(rootMasivoPost);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Consolidación de todos los establecimientos completada exitosamente.",
        stats: statsMasivoPost
      })).setMimeType(ContentService.MimeType.JSON);
    }


    // ========================================================
    // CASO 2: CONTROL DE EXTINTORES (Móvil Offline)
    // ========================================================
    if (data.tipoOperacion === "control_extintores") {
      var estNombre = String(data.establecimiento || "").trim();
      var localidad = String(data.localidad || "").trim();
      var auditor = String(data.auditor || "").trim();
      var totalExt = data.total || (data.extintores ? data.extintores.length : 0);
      var extList = data.extintores || [];

      var sheetExt = ss.getSheetByName("Extintores_Detalle");
      if (!sheetExt) {
        sheetExt = ss.insertSheet("Extintores_Detalle");
        var hExt = ["Timestamp", "Establecimiento", "Localidad", "Auditor", "Nro Extintor", "Sector", "Tipo", "Capacidad", "Vto Carga", "Vto PH", "Estado", "Fallas/Desvíos", "Observaciones"];
        sheetExt.appendRow(hExt);
        var rExt = sheetExt.getRange(1, 1, 1, hExt.length);
        rExt.setBackground("#0b3d63");
        rExt.setFontColor("#ffffff");
        rExt.setFontWeight("bold");
        sheetExt.setFrozenRows(1);
      }

      var nowExt = new Date();
      extList.forEach(function(x) {
        sheetExt.appendRow([
          nowExt,
          estNombre,
          localidad,
          auditor,
          x.num || "",
          x.sector || "",
          x.tipo || "",
          x.cap || "",
          x.vtoCarga || "",
          x.vtoPH || "",
          (x.status || "OK").toUpperCase(),
          (x.razones || []).join(", "),
          x.obs || ""
        ]);
      });

      actualizarColumnaMatriz(ss, estNombre, "CONTROL_DE_EXTINTORES", "Relevado (" + totalExt + " extintores)");

      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Control de " + totalExt + " extintores registrado exitosamente." 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ========================================================
    // CASO 3: RELEVAMIENTO COMPLETO HyS (Checklist Interactivo)
    // ========================================================
    var est = data.establecimiento || {};
    var prof = data.profesionales || {};
    var control = data.controlGestion || {};
    var planTeorico = data.planTeorico || {};

    var orgVal = String(est.organismo || est.razonSocial || "").trim();
    var nombreEstabVal = String(est.nombreEstablecimiento || "").trim();
    var domVal = String(est.domicilio || est.direccion || "").trim();
    var cpVal = String(est.cp || "").trim();
    var locVal1 = String(est.localidad || "").trim();
    var provVal = String(est.provincia || "Entre Ríos").trim();
    var nroVal = String(est.nroEstab || "").trim();
    var fechaRel = String(est.fecha || "").trim();

    // Actualizar 'Establecimientos'
    var sheetEst = ss.getSheetByName("Establecimientos");
    if (sheetEst) {
      var values = sheetEst.getDataRange().getValues();
      var targetRow = -1;

      var rIdx = parseInt(est.rowIndex, 10);
      if (!isNaN(rIdx) && rIdx >= 2 && rIdx <= values.length) {
        targetRow = rIdx;
      } else {
        var nroBuscado = nroVal.toLowerCase();
        var domBuscado = domVal.toLowerCase();
        var orgBuscado = orgVal.toLowerCase();

        for (var i = 1; i < values.length; i++) {
          var rowNro = String(values[i][6] || "").trim().toLowerCase();
          var rowDom = String(values[i][2] || "").trim().toLowerCase();
          var rowOrg = String(values[i][0] || "").trim().toLowerCase();

          if (nroBuscado && rowNro && nroBuscado === rowNro) {
            targetRow = i + 1;
            break;
          } else if (domBuscado && rowDom && domBuscado === rowDom && (!orgBuscado || rowOrg === orgBuscado)) {
            targetRow = i + 1;
            break;
          }
        }
      }

      if (targetRow > 1) {
        if (nombreEstabVal) {
          sheetEst.getRange(targetRow, 2).setValue(nombreEstabVal);
        }
      } else if (orgVal || domVal) {
        sheetEst.appendRow([orgVal, nombreEstabVal, domVal, cpVal, locVal1, provVal, nroVal]);
      }
    }

    // Actualizar 'Matriz_Control_Gestion'
    upsertMatrizControl(ss, {
      nroEstab: nroVal,
      nombreEstablecimiento: nombreEstabVal || orgVal,
      localidad: locVal1,
      rgrl: control.rgrl || "No realizado",
      rar: control.rar || "Sin nómina",
      svcc: control.svcc || "N/A",
      res886: control.res886 || "",
      rgi: control.rgi || "No",
      capVisita: control.capVisita || "",
      extintores: control.extintores || "Pendiente",
      capPlanificada: control.capPlanificada || "",
      tomaAgua: control.tomaAgua || 0,
      medIlum: control.medIlum || 0,
      medRuido: control.medRuido || 0,
      medPat: control.medPat || 0,
      otrasMed: control.otrasMed || 0,
      simulacro: control.simulacro || "No",
      cargaFuego: control.cargaFuego || "No",
      planTeoricoEstado: planTeorico.estado || "Asignado"
    });

    // Guardar el historial detallado en 'Datos'
    guardarEnHojaDatos(ss, data, orgVal, nombreEstabVal, nroVal, domVal, locVal1, provVal, cpVal, fechaRel, prof, est);

    return ContentService
      .createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Relevamiento guardado en 'Datos', Matriz de Control actualizada y sincronizada." 
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ========================================================
// FUNCIONES AUXILIARES DE ACTUALIZACIÓN DE MATRIZ
// ========================================================

function actualizarMatrizPorActividad(ss, orgNom, nombreEstab, nroEstab, actTipo, estado, fecha, driveUrl) {
  var sheetMatriz = ss.getSheetByName("Matriz_Control_Gestion");
  if (!sheetMatriz) return;

  var colNameMap = {
    "constancia_visita": "CONSTANCIA_VISITA",
    "cv": "CONSTANCIA_VISITA",
    "informe_tecnico": "INFORME_TECNICO",
    "informe": "INFORME_TECNICO",
    "informe_fotografico": "INFORME_TECNICO",
    "confeccion_rgrl": "RGRL",
    "confeccion_rar": "RAR",
    "capacitaciones": "CAPACITACION_EN_OCASION_DE_VISITA",
    "medicion_ruido": "MEDICION_DE_RUIDO",
    "mediciones_ruido": "MEDICION_DE_RUIDO",
    "ruido": "MEDICION_DE_RUIDO",
    "medicion_iluminacion": "MEDICION_DE_ILUMINACION",
    "mediciones_iluminacion": "MEDICION_DE_ILUMINACION",
    "iluminacion": "MEDICION_DE_ILUMINACION",
    "ilum": "MEDICION_DE_ILUMINACION",
    "medicion_pat": "MEDICION_PUESTA_A_TIERRA",
    "mediciones_puesta_a_tierra": "MEDICION_PUESTA_A_TIERRA",
    "puesta_a_tierra": "MEDICION_PUESTA_A_TIERRA",
    "pat": "MEDICION_PUESTA_A_TIERRA",
    "muestra_agua": "ANALISIS_DE_AGUA",
    "analisis_agua": "ANALISIS_DE_AGUA",
    "res_886": "RES_886",
    "carga_fuego": "ESTUDIO_CARGA_DE_FUEGO",
    "simulacro": "SIMULACRO_EVACUACION",
    "control_extintores": "CONTROL_DE_EXTINTORES"
  };

  var colTarget = colNameMap[actTipo.toLowerCase()] || colNameMap[normalizarCodigoActividad(actTipo).toLowerCase()];
  if (!colTarget) return;

  var valor = estado + (fecha ? " (" + fecha + ")" : "");
  actualizarColumnaMatriz(ss, orgNom, nombreEstab, nroEstab, colTarget, valor);
}

function actualizarColumnaMatriz(ss, orgNom, estNombre, nroEstab, nombreColumna, nuevoValor) {
  var sheetMatriz = ss.getSheetByName("Matriz_Control_Gestion");
  if (!sheetMatriz) return;

  var data = sheetMatriz.getDataRange().getValues();
  if (data.length <= 1) return;

  var headers = data[0];
  var colIndex = -1;
  for (var c = 0; c < headers.length; c++) {
    if (String(headers[c]).toUpperCase().trim() === nombreColumna.toUpperCase().trim()) {
      colIndex = c;
      break;
    }
  }
  if (colIndex === -1) return;

  var targetRow = -1;
  var buscadoNom = String(estNombre || "").toLowerCase().trim();
  var buscadoNro = String(nroEstab || "").toLowerCase().trim();

  for (var r = 1; r < data.length; r++) {
    var valNro = String(data[r][0] || "").toLowerCase().trim();
    var valEstab = String(data[r][1] || "").toLowerCase().trim();

    // 1. Si ambos tienen N° de establecimiento, exigir coincidencia estricta de N°
    if (buscadoNro && valNro && buscadoNro === valNro) {
      if (!buscadoNom || valEstab === buscadoNom || valEstab.includes(buscadoNom) || buscadoNom.includes(valEstab)) {
        targetRow = r + 1;
        break;
      }
    } else if (!buscadoNro && buscadoNom && valEstab === buscadoNom) {
      targetRow = r + 1;
      break;
    }
  }

  // Si no se encontró por N°, intentar por coincidencia exacta de nombre
  if (targetRow === -1 && buscadoNom) {
    for (var r2 = 1; r2 < data.length; r2++) {
      var valNom2 = String(data[r2][1] || "").toLowerCase().trim();
      if (valNom2 === buscadoNom) {
        targetRow = r2 + 1;
        break;
      }
    }
  }

  if (targetRow > 1) {
    sheetMatriz.getRange(targetRow, colIndex + 1).setValue(nuevoValor);
  }
}

function upsertMatrizControl(ss, m) {
  var headers = [
    "NRO.ESTAB.", "NOMBRE_ESTABLECIMIENTO", "LOCALIDAD",
    "RGRL", "RAR", "SVCC", "RES_886", "RIESGOS_GRAVES_INMINENTE",
    "CAPACITACION_EN_OCASION_DE_VISITA", "CONTROL_DE_EXTINTORES", "CAPACITACION_PLANIFICADA",
    "ANALISIS_DE_AGUA", "MEDICION_DE_ILUMINACION", "MEDICION_DE_RUIDO", "MEDICION_PUESTA_A_TIERRA",
    "OTRAS_MEDICIONES", "SIMULACRO_EVACUACION", "ESTUDIO_CARGA_DE_FUEGO", "ESTADO_PLAN_TEORICO", "ULTIMA_ACTUALIZACION"
  ];

  var sheetMatriz = ss.getSheetByName("Matriz_Control_Gestion");
  if (!sheetMatriz) {
    sheetMatriz = ss.insertSheet("Matriz_Control_Gestion");
    sheetMatriz.appendRow(headers);
    var headerRange = sheetMatriz.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0b3d63");
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    sheetMatriz.setFrozenRows(1);
  }

  var data = sheetMatriz.getDataRange().getValues();
  var targetRow = -1;
  var nroBuscado = String(m.nroEstab || "").trim().toLowerCase();
  var nombreBuscado = String(m.nombreEstablecimiento || "").trim().toLowerCase();

  for (var i = 1; i < data.length; i++) {
    var rowNro = String(data[i][0] || "").trim().toLowerCase();
    var rowNom = String(data[i][1] || "").trim().toLowerCase();

    if (nroBuscado && rowNro && nroBuscado === rowNro) {
      targetRow = i + 1;
      break;
    } else if (nombreBuscado && rowNom && (rowNom === nombreBuscado || rowNom.includes(nombreBuscado))) {
      targetRow = i + 1;
      break;
    }
  }

  var rowValues = [
    m.nroEstab || "",
    m.nombreEstablecimiento || "",
    m.localidad || "",
    m.rgrl || "No realizado",
    m.rar || "Sin nómina",
    m.svcc || "N/A",
    m.res886 || "N/A",
    m.rgi || "No",
    m.capVisita || "N/A",
    m.extintores || "Pendiente",
    m.capPlanificada || "N/A",
    m.tomaAgua ? "Sí (" + m.tomaAgua + ")" : "0",
    m.medIlum ? "Sí (" + m.medIlum + ")" : "0",
    m.medRuido ? "Sí (" + m.medRuido + ")" : "0",
    m.medPat ? "Sí (" + m.medPat + ")" : "0",
    m.otrasMed ? "Sí (" + m.otrasMed + ")" : "0",
    m.simulacro || "No",
    m.cargaFuego || "No",
    m.planTeoricoEstado || "Asignado",
    new Date()
  ];

  if (targetRow > 1) {
    sheetMatriz.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);
  } else {
    sheetMatriz.appendRow(rowValues);
  }
}

function guardarEnHojaDatos(ss, data, orgVal, nombreEstabVal, nroVal, domVal, locVal, provVal, cpVal, fechaRel, prof, est) {
  var sheetDatos = ss.getSheetByName("Datos");
  if (!sheetDatos) {
    sheetDatos = ss.insertSheet("Datos");
    var headers = [
      "Timestamp", "Fecha_Relevamiento", "Organismo", "Nombre_Establecimiento", "Nro_Estab",
      "Domicilio", "Localidad", "Provincia", "CP", "CUIT", "ART", "Relevador",
      "Actividad_Principal", "Inmueble_Tipo", "Inmueble_Condicion", "Sup_Total",
      "Sup_Cubierta", "Plantas", "Dot_Total", "Dot_Adm", "Dot_Prod", "Dot_Otros",
      "Condiciones_Generales", "HyS_Responsable", "HyS_Matricula", "HyS_Telefono",
      "HyS_Modalidad", "HyS_Email", "Med_Responsable", "Med_Matricula", "Med_Telefono",
      "Comite_Mixto", "Cantidad_Desvios_NO", "Listado_Desvios_Detectados",
      "Resumen_Mediciones_Sugeridas", "Resumen_Ergonomia", "Resumen_Visitas",
      "Resumen_Capacitaciones", "Observaciones_Generales", "JSON_Completo_Auditoria"
    ];
    sheetDatos.appendRow(headers);
    var hRange = sheetDatos.getRange(1, 1, 1, headers.length);
    hRange.setBackground("#0b3d63");
    hRange.setFontColor("#ffffff");
    hRange.setFontWeight("bold");
    sheetDatos.setFrozenRows(1);
  }

  var checklist = data.checklist || {};
  var noItems = [];
  Object.keys(checklist).forEach(function(key) {
    var item = checklist[key];
    if (item && item.val === "NO") {
      var desc = (item.text || key) + (item.obs ? " [Obs: " + item.obs + "]" : "");
      noItems.push(desc);
    }
  });

  var prog = data.programa || {};
  var strMed = (prog.mediciones || []).map(function(m) {
    return (m.label || "") + (m.puntos ? " (" + m.puntos + " pts)" : "") + (m.month ? " - Mes: " + m.month : "");
  }).join(" | ");

  var strErg = (prog.ergonomia || []).map(function(e) {
    return (e.puesto || "") + (e.metodo ? " (" + e.metodo + ")" : "") + (e.month ? " - Mes: " + e.month : "");
  }).join(" | ");

  var strVis = (prog.visitas || []).map(function(v) {
    return (v.label || "") + (v.sector ? " (" + v.sector + ")" : "") + (v.month ? " - Mes: " + v.month : "");
  }).join(" | ");

  var strCap = (prog.capacitacion || []).map(function(c) {
    return (c.tema || "") + (c.dest ? " (" + c.dest + ")" : "") + (c.month ? " - Mes: " + c.month : "");
  }).join(" | ");

  sheetDatos.appendRow([
    new Date(),
    fechaRel,
    orgVal,
    nombreEstabVal,
    nroVal,
    domVal,
    locVal,
    provVal,
    cpVal,
    est.cuit || "",
    est.art || "",
    est.relevadoPor || "",
    est.actividad || "",
    est.inmueble || "",
    est.inmuebleCondicion || "",
    est.supTotal || "",
    est.supCubierta || "",
    est.plantas || "",
    est.dotTotal || "",
    est.dotAdm || "",
    est.dotProd || "",
    est.dotOtros || "",
    est.condicionesGenerales || "",
    prof.hysNombre || "",
    prof.hysMatricula || "",
    prof.hysTelefono || "",
    prof.hysModalidad || "",
    prof.hysEmail || "",
    prof.medNombre || "",
    prof.medMatricula || "",
    prof.medTelefono || "",
    prof.comiteMixto || "",
    noItems.length,
    noItems.join("\n"),
    strMed,
    strErg,
    strVis,
    strCap,
    data.observaciones || "",
    JSON.stringify(data)
  ]);
}

// ========================================================
// FUNCIONES DE CONTROL DE SUPERFICIES (M2) Y MEDICIONES OBLIGATORIAS
// ========================================================

function setupSuperficiesSheet(ss, estsList) {
  var sheet = ss.getSheetByName("Superficie_Establecimientos");
  if (!sheet) {
    sheet = ss.insertSheet("Superficie_Establecimientos");
  }

  var headers = [
    "ID Sede",
    "N° Estab",
    "Nombre Establecimiento",
    "Organismo",
    "Localidad",
    "Domicilio",
    "Superficie Cubierta (m²)",
    "Requiere Mediciones (>1000 m²)",
    "Estado Mediciones Realizadas"
  ];

  var existingMap = {};
  if (sheet.getLastRow() > 1) {
    var existingData = sheet.getDataRange().getValues();
    for (var r = 1; r < existingData.length; r++) {
      var row = existingData[r];
      var idKey = String(row[0] || "").trim();
      var nroKey = String(row[1] || "").trim();
      var m2Val = row[6];
      if (idKey && m2Val !== "" && m2Val !== null && m2Val !== undefined) existingMap[idKey] = m2Val;
      if (nroKey && m2Val !== "" && m2Val !== null && m2Val !== undefined) existingMap["nro_" + nroKey] = m2Val;
    }
  }

  sheet.clear();
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#0b3d63").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);

  if (estsList && estsList.length > 0) {
    var rowsToInsert = [];
    for (var i = 0; i < estsList.length; i++) {
      var e = estsList[i];
      var id = e.id || ("est_" + (e.nroEstab || i));
      var nro = e.nroEstab || "";
      var m2Existente = existingMap[id] !== undefined ? existingMap[id] : (existingMap["nro_" + nro] !== undefined ? existingMap["nro_" + nro] : "");
      
      var rowIdx = i + 2;
      var formulaReq = '=IF(ISBLANK(G' + rowIdx + '); "⏳ Pendiente dato m²"; IF(G' + rowIdx + '>=1000; "⚡ SÍ (Requiere Mediciones)"; "✓ NO (<1000 m²)"))';
      
      rowsToInsert.push([
        id,
        nro,
        e.nombreEstablecimiento || "",
        e.organismo || "",
        e.localidad || "",
        e.domicilio || "",
        m2Existente,
        formulaReq,
        ""
      ]);
    }
    if (rowsToInsert.length > 0) {
      sheet.getRange(2, 1, rowsToInsert.length, headers.length).setValues(rowsToInsert);
    }
  }

  // Estilo visual: Columna G con fondo verde suave destacado para invitar a la edición
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 7, sheet.getLastRow() - 1, 1)
      .setBackground("#f0fdf4")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
      
    sheet.getRange(2, 8, sheet.getLastRow() - 1, 1)
      .setHorizontalAlignment("center");
  }

  var sheetUrl = "";
  try { sheetUrl = ss.getUrl() + "#gid=" + sheet.getSheetId(); } catch(eU) { sheetUrl = ss.getUrl(); }

  return { 
    status: "success", 
    count: estsList ? estsList.length : 0,
    sheetUrl: sheetUrl
  };
}

function guardarSuperficieSede(ss, id, nroEstab, nombreEstab, m2) {
  var sheet = ss.getSheetByName("Superficie_Establecimientos");
  if (!sheet || sheet.getLastRow() <= 1) return { status: "error", message: "Hoja no inicializada" };
  
  var data = sheet.getDataRange().getValues();
  var targetRow = -1;
  var sId = String(id || "").trim();
  var sNro = String(nroEstab || "").trim().toLowerCase();
  var sNom = String(nombreEstab || "").trim().toLowerCase();
  
  for (var r = 1; r < data.length; r++) {
    var rId = String(data[r][0] || "").trim();
    var rNro = String(data[r][1] || "").trim().toLowerCase();
    var rNom = String(data[r][2] || "").trim().toLowerCase();
    
    if (sId && rId && sId === rId) {
      targetRow = r + 1;
      break;
    } else if (sNro && rNro && sNro === rNro) {
      targetRow = r + 1;
      break;
    } else if (sNom && rNom && (sNom === rNom || sNom.includes(rNom) || rNom.includes(sNom))) {
      targetRow = r + 1;
      break;
    }
  }
  
  if (targetRow !== -1) {
    sheet.getRange(targetRow, 7).setValue(m2);
    return { status: "success", row: targetRow, m2: m2 };
  }
  return { status: "not_found" };
}

// ========================================================
// MANTENIMIENTO: CONSOLIDAR CARPETAS DUPLICADAS EN DRIVE
// ========================================================

function consolidarCarpetasDuplicadasDrive(rootFolder) {
  if (!rootFolder) rootFolder = getOrCreateRootFolder();
  var stats = {
    organismosAnalizados: 0,
    carpetasRevisadas: 0,
    duplicadosUnificados: 0,
    archivosMovidos: 0,
    carpetasPapelera: 0
  };

  // 0. Si existen carpetas de organismo con nombres largos o variantes en rootFolder, consolidarlas hacia el canónico
  var aliasOrganismos = {
    "JEFATURA DE POLICIA DE LA PROVINCIA DE ENTRE RIOS": "POLICIA",
    "JEFATURA DE POLICIA": "POLICIA",
    "POLICIA DE ENTRE RIOS": "POLICIA"
  };

  try {
    var rootIter = rootFolder.getFolders();
    while (rootIter.hasNext()) {
      var rf = rootIter.next();
      try {
        if (!rf.isTrashed()) {
          var rfName = rf.getName().trim().toUpperCase();
          var canon = aliasOrganismos[rfName];
          if (canon && canon !== rfName) {
            var canonF = getOrCreateSubfolder(rootFolder, canon);
            var subSed = rf.getFolders();
            while (subSed.hasNext()) {
              var sed = subSed.next();
              try {
                if (!sed.isTrashed()) {
                  var targetSed = getOrCreateSubfolder(canonF, sed.getName());
                  var sFiles = sed.getFiles();
                  while (sFiles.hasNext()) {
                    var sf = sFiles.next();
                    try { 
                      sf.moveTo(targetSed); 
                      stats.archivosMovidos++; 
                    } catch(eMv) {
                      try { 
                        sf.makeCopy(sf.getName(), targetSed); 
                        sf.setTrashed(true); 
                        stats.archivosMovidos++; 
                      } catch(eCp) {}
                    }
                  }
                  sed.setTrashed(true);
                  stats.duplicadosUnificados++;
                }
              } catch(eSed) {}
            }
            var rFiles = rf.getFiles();
            while (rFiles.hasNext()) {
              var rfF = rFiles.next();
              try { rfF.moveTo(canonF); stats.archivosMovidos++; } catch(eMv2) {}
            }
            rf.setTrashed(true);
            stats.carpetasPapelera++;
          }
        }
      } catch(eRf) {}
    }
  } catch(eAliases) {}

  function consolidarEnContenedor(parentF) {
    if (!parentF) return;
    var subIter = parentF.getFolders();
    var carpetasPorNombre = {};

    while (subIter.hasNext()) {
      var f = subIter.next();
      try {
        if (!f.isTrashed()) {
          var fNom = f.getName().trim();
          if (!carpetasPorNombre[fNom]) {
            carpetasPorNombre[fNom] = [];
          }
          carpetasPorNombre[fNom].push(f);
          stats.carpetasRevisadas++;
        }
      } catch(e) {}
    }

    for (var nom in carpetasPorNombre) {
      var lista = carpetasPorNombre[nom];
      if (lista.length > 1) {
        var targetF = lista[0]; // La primera activa es la principal
        for (var i = 1; i < lista.length; i++) {
          var dupF = lista[i];
          try {
            var files = dupF.getFiles();
            while (files.hasNext()) {
              var fl = files.next();
              try {
                fl.moveTo(targetF);
                stats.archivosMovidos++;
              } catch(eMove) {
                try {
                  fl.makeCopy(fl.getName(), targetF);
                  fl.setTrashed(true);
                  stats.archivosMovidos++;
                } catch(eC) {}
              }
            }
            // Enviar la carpeta duplicada a papelera una vez vacía
            dupF.setTrashed(true);
            stats.carpetasPapelera++;
            stats.duplicadosUnificados++;
          } catch(eDup) {
            Logger.log("Error al consolidar carpeta duplicada " + nom + ": " + eDup.toString());
          }
        }
      }
    }
  }

  // Recorrer todas las subcarpetas del root (organismos y meses)
  var rootSubs = rootFolder.getFolders();
  while (rootSubs.hasNext()) {
    var orgOrMonth = rootSubs.next();
    try {
      if (!orgOrMonth.isTrashed()) {
        stats.organismosAnalizados++;
        consolidarEnContenedor(orgOrMonth);

        var deepSubs = orgOrMonth.getFolders();
        while (deepSubs.hasNext()) {
          var deep = deepSubs.next();
          try {
            if (!deep.isTrashed()) {
              consolidarEnContenedor(deep);
            }
          } catch(eD) {}
        }
      }
    } catch(eM) {}
  }

  return stats;
}

function repararArchivosEstablecimiento45() {
  var root = getOrCreateRootFolder();
  var polF = getOrCreateSubfolder(root, "POLICIA");
  var estab45F = getOrCreateSubfolder(polF, "Estab_45 - VILLAGUAY - 243 (PARANA)");
  var log = [];

  // 1. Mover todos los archivos de cualquier carpeta homónima de Estab 45 hacia la carpeta oficial
  var fIter = DriveApp.getFoldersByName("Estab_45 - VILLAGUAY - 243 (PARANA)");
  while (fIter.hasNext()) {
    var fold = fIter.next();
    if (fold.getId() !== estab45F.getId()) {
      var files = fold.getFiles();
      while (files.hasNext()) {
        var fl = files.next();
        log.push("Trasladado a POLICIA: " + fl.getName());
        try {
          fl.moveTo(estab45F);
        } catch(e2) {
          try { fl.makeCopy(fl.getName(), estab45F); fl.setTrashed(true); } catch(eCp) {}
        }
      }
      // Si la carpeta duplicada quedó vacía, enviarla a papelera
      try {
        var remaining = fold.getFiles();
        if (!remaining.hasNext()) {
          fold.setTrashed(true);
          log.push("Carpeta vacía enviada a papelera: " + fold.getId());
        }
      } catch(eTrash) {}
    }
  }

  // 2. Buscar archivos con prefijo POL_045 en todo Drive y asegurar presencia en estab45F
  var allFiles = DriveApp.searchFiles("title contains '045' and trashed = false");
  while (allFiles.hasNext()) {
    var af = allFiles.next();
    var aName = af.getName();
    if (aName.includes("045") || aName.includes("VILLAGUAY")) {
      log.push("Archivo detectado: " + aName);
      var inTarget = false;
      var pars = af.getParents();
      while (pars.hasNext()) {
        if (pars.next().getId() === estab45F.getId()) inTarget = true;
      }
      if (!inTarget) {
        try {
          af.moveTo(estab45F);
          log.push("Movido a carpeta oficial: " + aName);
        } catch(eM) {
          try { af.makeCopy(aName, estab45F); log.push("Copiado a carpeta oficial: " + aName); } catch(eCp2) {}
        }
      }
    }
  }

  // 3. Actualizar celda de Iluminación en 'Matriz_Control_Gestion' para Sede 45
  var ss = getSpreadsheet();
  actualizarMatrizPorActividad(ss, "POLICIA", "VILLAGUAY - 243 (PARANA)", "45", "medicion_iluminacion", "Completado", "09/09/2028", estab45F.getUrl());

  return {
    status: "success",
    message: "Establecimiento 45 consolidado con éxito.",
    targetFolderUrl: estab45F.getUrl(),
    targetFolderId: estab45F.getId(),
    log: log
  };
}

// ========================================================
// MANTENIMIENTO: DESDUPLICAR ARCHIVOS CON EL MISMO NOMBRE
// ========================================================

function desduplicarArchivosDrive(rootFolder) {
  if (!rootFolder) rootFolder = getOrCreateRootFolder();
  var ss = getSpreadsheet();
  var activeFileIds = {};

  // 1. Obtener todos los IDs de archivos referenciados en Legajo_Actividades_Archivos
  var sheetLegajo = ss.getSheetByName("Legajo_Actividades_Archivos");
  if (sheetLegajo && sheetLegajo.getLastRow() > 1) {
    var lData = sheetLegajo.getDataRange().getValues();
    var headers = lData[0] || [];
    var idColIdx = headers.indexOf("ID Drive");
    if (idColIdx === -1) idColIdx = 12;
    for (var r = 1; r < lData.length; r++) {
      var fid = String(lData[r][idColIdx] || "").trim();
      if (fid) activeFileIds[fid] = true;
    }
  }

  var stats = {
    carpetasRevisadas: 0,
    archivosAnalizados: 0,
    archivosDuplicadosEliminados: 0,
    detalles: []
  };

  function desduplicarEnCarpeta(folder) {
    if (!folder) return;
    stats.carpetasRevisadas++;
    var fileIter = folder.getFiles();
    var porNombre = {};

    while (fileIter.hasNext()) {
      var fl = fileIter.next();
      stats.archivosAnalizados++;
      var fNom = fl.getName().trim();
      if (!porNombre[fNom]) {
        porNombre[fNom] = [];
      }
      porNombre[fNom].push(fl);
    }

    for (var fName in porNombre) {
      var lista = porNombre[fName];
      if (lista.length > 1) {
        // Preservar preferentemente el ID registrado en el Legajo
        var bestIndex = -1;
        for (var k = 0; k < lista.length; k++) {
          if (activeFileIds[lista[k].getId()]) {
            bestIndex = k;
            break;
          }
        }
        // Si ninguno está en el legajo, preferir el más reciente
        if (bestIndex === -1) {
          bestIndex = 0;
          for (var k = 1; k < lista.length; k++) {
            if (lista[k].getDateCreated() > lista[bestIndex].getDateCreated()) {
              bestIndex = k;
            }
          }
        }

        var keepFile = lista[bestIndex];
        for (var d = 0; d < lista.length; d++) {
          if (d !== bestIndex) {
            var dupFile = lista[d];
            try {
              dupFile.setTrashed(true);
              stats.archivosDuplicadosEliminados++;
              stats.detalles.push({
                nombre: fName,
                carpeta: folder.getName(),
                idEliminado: dupFile.getId(),
                idConservado: keepFile.getId()
              });
            } catch(eTr) {
              Logger.log("Error al enviar archivo duplicado a papelera: " + eTr.toString());
            }
          }
        }
      }
    }

    // Recorrer subcarpetas
    var subFolds = folder.getFolders();
    while (subFolds.hasNext()) {
      var sf = subFolds.next();
      try {
        if (!sf.isTrashed()) {
          desduplicarEnCarpeta(sf);
        }
      } catch(eSf) {}
    }
  }

  desduplicarEnCarpeta(rootFolder);
  return stats;
}

// ========================================================
// MANTENIMIENTO: CONSOLIDAR TODOS LOS ESTABLECIMIENTOS EN DRIVE
// ========================================================

function consolidarTodosLosEstablecimientosDrive(rootFolder) {
  if (!rootFolder) rootFolder = getOrCreateRootFolder();

  var stats = {
    organismosProcesados: 0,
    carpetasOrganismosUnificadas: 0,
    sedesConsolidadas: 0,
    archivosTrasladados: 0,
    carpetasPapelera: 0
  };

  // 1. Recorrer todas las carpetas que estén en la raíz oficial
  var rootSubs = rootFolder.getFolders();
  var listaCarpetasOrg = [];
  var listaCarpetasMes = [];

  while (rootSubs.hasNext()) {
    var sub = rootSubs.next();
    try {
      if (!sub.isTrashed()) {
        var sNom = sub.getName().trim();
        if (/^\d{6}$/.test(sNom) || /^\d{4}-\d{2}/.test(sNom) || sNom === "Carpetas_Mensuales") {
          listaCarpetasMes.push(sub);
        } else {
          listaCarpetasOrg.push(sub);
        }
      }
    } catch(eSub) {}
  }

  // 2. Procesar y unificar carpetas de organismos hacia sus nombres canónicos
  for (var o = 0; o < listaCarpetasOrg.length; o++) {
    var orgF = listaCarpetasOrg[o];
    var orgOriginal = orgF.getName().trim();
    var canonOrgName = obtenerNombreOrganismoCanonico(orgOriginal);
    var targetOrgF = getOrCreateSubfolder(rootFolder, canonOrgName);
    stats.organismosProcesados++;

    var subSedIter = orgF.getFolders();
    while (subSedIter.hasNext()) {
      var sedeFolder = subSedIter.next();
      try {
        if (!sedeFolder.isTrashed()) {
          var sedeNom = sedeFolder.getName().trim();
          var targetSedeF = getOrCreateSubfolder(targetOrgF, sedeNom);

          // Si la carpeta de la sede no era la oficial o estaba en una carpeta de organismo con nombre variante
          if (sedeFolder.getId() !== targetSedeF.getId()) {
            var files = sedeFolder.getFiles();
            while (files.hasNext()) {
              var fl = files.next();
              try {
                fl.moveTo(targetSedeF);
                stats.archivosTrasladados++;
              } catch(eMove) {
                try { fl.makeCopy(fl.getName(), targetSedeF); fl.setTrashed(true); stats.archivosTrasladados++; } catch(eC) {}
              }
            }
            // Mover subcarpetas si hubiera
            var deepSubs = sedeFolder.getFolders();
            while (deepSubs.hasNext()) {
              var ds = deepSubs.next();
              try { ds.moveTo(targetSedeF); } catch(eDs) {}
            }
            sedeFolder.setTrashed(true);
            stats.carpetasPapelera++;
            stats.sedesConsolidadas++;
          }
        }
      } catch(eSede) {
        Logger.log("Error al consolidar sede " + sedeFolder.getName() + ": " + eSede.toString());
      }
    }

    // Mover cualquier archivo suelto en la carpeta del organismo hacia la canónica
    if (orgF.getId() !== targetOrgF.getId()) {
      var filesOrg = orgF.getFiles();
      while (filesOrg.hasNext()) {
        var fo = filesOrg.next();
        try { fo.moveTo(targetOrgF); stats.archivosTrasladados++; } catch(eFo) {}
      }
      orgF.setTrashed(true);
      stats.carpetasPapelera++;
      stats.carpetasOrganismosUnificadas++;
    }
  }

  // 3. Procesar carpetas mensuales para que también usen el organismo canónico y no tengan sedes duplicadas
  for (var m = 0; m < listaCarpetasMes.length; m++) {
    var mesF = listaCarpetasMes[m];
    try {
      var orgInMesIter = mesF.getFolders();
      while (orgInMesIter.hasNext()) {
        var orgInMes = orgInMesIter.next();
        try {
          if (!orgInMes.isTrashed()) {
            var orgInMesName = orgInMes.getName().trim();
            var canonInMes = obtenerNombreOrganismoCanonico(orgInMesName);
            var targetOrgInMes = getOrCreateSubfolder(mesF, canonInMes);

            var sIter = orgInMes.getFolders();
            while (sIter.hasNext()) {
              var sF = sIter.next();
              try {
                if (!sF.isTrashed()) {
                  var targetSF = getOrCreateSubfolder(targetOrgInMes, sF.getName());
                  if (sF.getId() !== targetSF.getId()) {
                    var sfFiles = sF.getFiles();
                    while (sfFiles.hasNext()) {
                      var sff = sfFiles.next();
                      try { sff.moveTo(targetSF); stats.archivosTrasladados++; } catch(eSff) {
                        try { sff.makeCopy(sff.getName(), targetSF); sff.setTrashed(true); stats.archivosTrasladados++; } catch(eSff2) {}
                      }
                    }
                    sF.setTrashed(true);
                    stats.carpetasPapelera++;
                  }
                }
              } catch(eS) {}
            }

            if (orgInMes.getId() !== targetOrgInMes.getId()) {
              orgInMes.setTrashed(true);
              stats.carpetasPapelera++;
            }
          }
        } catch(eOIM) {}
      }
    } catch(eMes) {}
  }

  // 4. Ejecutar desduplicación de archivos homónimos en toda la estructura
  var statsArchivos = desduplicarArchivosDrive(rootFolder);
  stats.archivosDuplicadosEliminados = statsArchivos.archivosDuplicadosEliminados;

  return stats;
}

// ========================================================
// MANTENIMIENTO: SINCRONIZAR Y POBLAR RÉPLICAS DE SEPTIEMBRE 2026
// ========================================================

function sincronizarCarpetaSeptiembreDrive() {
  var ss = getSpreadsheet();
  var sheetLegajo = ss.getSheetByName("Legajo_Actividades_Archivos");
  if (!sheetLegajo) {
    return { status: "error", message: "No se encontró la hoja Legajo_Actividades_Archivos" };
  }

  var rootFolder = getOrCreateRootFolder();
  var monthlyParent = getOrCreateSubfolder(rootFolder, "Carpetas_Mensuales");
  var septFolder = getOrCreateSubfolder(monthlyParent, "2026-09_SEPTIEMBRE");
  try { septFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}

  var data = sheetLegajo.getDataRange().getValues();
  if (data.length <= 1) {
    return { status: "success", message: "No hay registros en el legajo.", count: 0 };
  }

  var stats = {
    totalFilas: data.length - 1,
    filasSeptiembre: 0,
    archivosCopiados: 0,
    archivosYaExistentes: 0,
    urlsActualizadas: 0,
    errores: [],
    monthFolderUrl: septFolder.getUrl(),
    monthFolderId: septFolder.getId()
  };

  var colFecha = 2;       // Col C (0-indexed)
  var colOrg = 3;         // Col D
  var colNro = 4;         // Col E
  var colNom = 5;         // Col F
  var colNomArchivo = 10; // Col K
  var colDriveId = 12;    // Col M (ID Drive)
  var colUrlMensual = 15; // Col P (URL Carpeta Mensual)

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rFecha = row[colFecha];
    var sFecha = "";
    if (rFecha instanceof Date) {
      try {
        sFecha = Utilities.formatDate(rFecha, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd");
      } catch(e) {
        sFecha = rFecha.toISOString().substring(0, 10);
      }
    } else {
      sFecha = String(rFecha || "").trim();
    }

    // Verificar si es de Septiembre 2026
    var esSept2026 = false;
    if (sFecha.indexOf("2026-09") !== -1 || sFecha.indexOf("2026/09") !== -1 || sFecha.indexOf("09/2026") !== -1) {
      esSept2026 = true;
    } else {
      var mInfo = parsearAnioMes(sFecha);
      if (mInfo && mInfo.key === "202609") {
        esSept2026 = true;
      }
    }

    if (esSept2026) {
      stats.filasSeptiembre++;
      var orgNom = String(row[colOrg] || "POLICIA").trim();
      var canonOrg = obtenerNombreOrganismoCanonico(orgNom);
      var nroEstab = String(row[colNro] || "").trim();
      var estabNom = String(row[colNom] || "Establecimiento").trim();
      var fileId = String(row[colDriveId] || "").trim();
      var fileName = String(row[colNomArchivo] || "").trim();

      // 1. Crear subcarpeta del organismo dentro de 2026-09_SEPTIEMBRE
      var orgSeptFolder = getOrCreateSubfolder(septFolder, canonOrg);
      try { orgSeptFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eOrg) {}

      // 2. Crear subcarpeta del establecimiento dentro del organismo
      var cleanNroTag = nroEstab ? ("Estab_" + nroEstab) : "Estab_General";
      var estabFolderName = cleanNroTag + " - " + estabNom;
      var estabSeptFolder = getOrCreateSubfolder(orgSeptFolder, estabFolderName);
      try { estabSeptFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eEst) {}

      // 3. Copiar archivo físico a la carpeta de la sede dentro del mes si existe fileId
      if (fileId) {
        try {
          var originalFile = DriveApp.getFileById(fileId);
          var actualName = originalFile.getName();
          if (!fileName) fileName = actualName;

          // Verificar si ya existe en estabSeptFolder
          var existingFiles = estabSeptFolder.getFilesByName(fileName);
          var yaExiste = false;
          while (existingFiles.hasNext()) {
            var ef = existingFiles.next();
            if (!ef.isTrashed()) {
              yaExiste = true;
              break;
            }
          }

          if (yaExiste) {
            stats.archivosYaExistentes++;
          } else {
            var copy = originalFile.makeCopy(fileName, estabSeptFolder);
            try { copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eCp) {}
            stats.archivosCopiados++;
          }
        } catch(eFile) {
          stats.errores.push("Fila " + (i + 1) + " (" + fileName + "): " + eFile.toString());
        }
      }

      // 4. Actualizar la celda URL Carpeta Mensual en Sheets con la URL activa de Septiembre
      sheetLegajo.getRange(i + 1, colUrlMensual + 1).setValue(septFolder.getUrl());
      stats.urlsActualizadas++;
    }
  }

  return {
    status: "success",
    message: "Sincronización de Septiembre 2026 completada exitosamente.",
    stats: stats
  };
}

// ========================================================
// MANTENIMIENTO: SINCRONIZAR Y POBLAR RÉPLICAS DE OCTUBRE 2026
// ========================================================

function sincronizarCarpetaOctubreDrive() {
  var ss = getSpreadsheet();
  var sheetLegajo = ss.getSheetByName("Legajo_Actividades_Archivos");
  if (!sheetLegajo) {
    return { status: "error", message: "No se encontró la hoja Legajo_Actividades_Archivos" };
  }

  var rootFolder = getOrCreateRootFolder();
  var monthlyParent = getOrCreateSubfolder(rootFolder, "Carpetas_Mensuales");
  var octFolder = getOrCreateSubfolder(monthlyParent, "2026-10_OCTUBRE");
  try { octFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}

  var data = sheetLegajo.getDataRange().getValues();
  if (data.length <= 1) {
    return { status: "success", message: "No hay registros en el legajo.", count: 0 };
  }

  var stats = {
    totalFilas: data.length - 1,
    filasOctubre: 0,
    archivosCopiados: 0,
    archivosYaExistentes: 0,
    urlsActualizadas: 0,
    errores: [],
    monthFolderUrl: octFolder.getUrl(),
    monthFolderId: octFolder.getId()
  };

  var colFecha = 2;       // Col C (0-indexed)
  var colOrg = 3;         // Col D
  var colNro = 4;         // Col E
  var colNom = 5;         // Col F
  var colNomArchivo = 10; // Col K
  var colDriveId = 12;    // Col M (ID Drive)
  var colUrlMensual = 15; // Col P (URL Carpeta Mensual)

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rFecha = row[colFecha];
    var sFecha = "";
    if (rFecha instanceof Date) {
      try {
        sFecha = Utilities.formatDate(rFecha, Session.getScriptTimeZone() || "GMT-3", "yyyy-MM-dd");
      } catch(e) {
        sFecha = rFecha.toISOString().substring(0, 10);
      }
    } else {
      sFecha = String(rFecha || "").trim();
    }

    // Verificar si es de Octubre 2026
    var esOct2026 = false;
    if (sFecha.indexOf("2026-10") !== -1 || sFecha.indexOf("2026/10") !== -1 || sFecha.indexOf("10/2026") !== -1) {
      esOct2026 = true;
    } else {
      var mInfo = parsearAnioMes(sFecha);
      if (mInfo && mInfo.key === "202610") {
        esOct2026 = true;
      }
    }

    if (esOct2026) {
      stats.filasOctubre++;
      var orgNom = String(row[colOrg] || "POLICIA").trim();
      var canonOrg = obtenerNombreOrganismoCanonico(orgNom);
      var nroEstab = String(row[colNro] || "").trim();
      var estabNom = String(row[colNom] || "Establecimiento").trim();
      var fileId = String(row[colDriveId] || "").trim();
      var fileName = String(row[colNomArchivo] || "").trim();

      // 1. Crear subcarpeta del organismo dentro de 2026-10_OCTUBRE
      var orgOctFolder = getOrCreateSubfolder(octFolder, canonOrg);
      try { orgOctFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eOrg) {}

      // 2. Crear subcarpeta del establecimiento dentro del organismo
      var cleanNroTag = nroEstab ? ("Estab_" + nroEstab) : "Estab_General";
      var estabFolderName = cleanNroTag + " - " + estabNom;
      var estabOctFolder = getOrCreateSubfolder(orgOctFolder, estabFolderName);
      try { estabOctFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eEst) {}

      // 3. Copiar archivo físico a la carpeta de la sede dentro del mes si existe fileId
      if (fileId) {
        try {
          var originalFile = DriveApp.getFileById(fileId);
          var actualName = originalFile.getName();
          if (!fileName) fileName = actualName;

          // Verificar si ya existe en estabOctFolder
          var existingFiles = estabOctFolder.getFilesByName(fileName);
          var yaExiste = false;
          while (existingFiles.hasNext()) {
            var ef = existingFiles.next();
            if (!ef.isTrashed()) {
              yaExiste = true;
              break;
            }
          }

          if (yaExiste) {
            stats.archivosYaExistentes++;
          } else {
            var copy = originalFile.makeCopy(fileName, estabOctFolder);
            try { copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(eCp) {}
            stats.archivosCopiados++;
          }
        } catch(eFile) {
          stats.errores.push("Fila " + (i + 1) + " (" + fileName + "): " + eFile.toString());
        }
      }

      // 4. Actualizar la celda URL Carpeta Mensual en Sheets con la URL activa de Octubre
      sheetLegajo.getRange(i + 1, colUrlMensual + 1).setValue(octFolder.getUrl());
      stats.urlsActualizadas++;
    }
  }

  return {
    status: "success",
    message: "Sincronización de Octubre 2026 completada exitosamente.",
    stats: stats
  };
}
