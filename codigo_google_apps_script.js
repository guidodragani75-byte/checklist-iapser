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
var DRIVE_ROOT_FOLDER_ID = ""; // Dejar vacío para usar/crear la carpeta raíz por nombre automáticamente

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
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(cleanName);
}

var MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parsearAnioMes(fecha) {
  var now = new Date();
  var anio = now.getFullYear();
  var mes = now.getMonth() + 1; // 1-12
  
  if (fecha) {
    var s = String(fecha).trim();
    if (s.includes("-")) {
      var p = s.split("-");
      if (p.length >= 2) {
        var y = parseInt(p[0], 10);
        var m = parseInt(p[1], 10);
        if (!isNaN(y) && y > 2000 && !isNaN(m) && m >= 1 && m <= 12) {
          anio = y; mes = m;
        }
      }
    } else if (s.includes("/")) {
      var p2 = s.split("/");
      if (p2.length >= 3) {
        var y2 = parseInt(p2[2], 10);
        var m2 = parseInt(p2[1], 10);
        if (!isNaN(y2) && y2 > 2000 && !isNaN(m2) && m2 >= 1 && m2 <= 12) {
          anio = y2; mes = m2;
        }
      }
    }
  }
  var mesStr = (mes < 10 ? "0" : "") + mes;
  var mesNombre = MESES_NOMBRES[mes - 1] || "Mes";
  return {
    anio: anio,
    mes: mes,
    mesStr: mesStr,
    key: anio + "-" + mesStr,
    label: anio + "-" + mesStr + " (" + mesNombre + ")"
  };
}

function getOrCreateMonthlyFolder(rootFolder, fecha) {
  var mInfo = parsearAnioMes(fecha);
  var parentMensual = getOrCreateSubfolder(rootFolder, "Carpetas_Mensuales");
  try {
    parentMensual.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {}
  
  var monthFolder = getOrCreateSubfolder(parentMensual, mInfo.label);
  try {
    monthFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e2) {}

  return {
    folder: monthFolder,
    url: monthFolder.getUrl(),
    id: monthFolder.getId(),
    key: mInfo.key,
    label: mInfo.label,
    parentUrl: parentMensual.getUrl(),
    parentId: parentMensual.getId()
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
            }
            item[lHeaders[col]] = val;
          }
          results.push(item);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", actividades: results }))
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
      var parentM = getOrCreateSubfolder(rootF, "Carpetas_Mensuales");
      try {
        parentM.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(eShare) {}
      var subs = parentM.getFolders();
      var listCarpetas = [];
      while (subs.hasNext()) {
        var sub = subs.next();
        listCarpetas.push({
          name: sub.getName(),
          id: sub.getId(),
          url: sub.getUrl()
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        parentMensualUrl: parentM.getUrl(), 
        carpetas: listCarpetas 
      })).setMimeType(ContentService.MimeType.JSON);
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
      var estadoAct = String(data.estadoActividad || "Completado").trim();
      var detalle = String(data.detalle || "").trim();
      var preventor = String(data.preventor || "").trim();
      var observaciones = String(data.observaciones || "").trim();

      var fileBase64 = data.fileBase64 || "";
      var originalFileName = data.originalFileName || "";
      var mimeType = data.mimeType || "application/pdf";

      var driveUrl = "";
      var driveFileId = "";
      var codedFileName = "";

      // 1. Guardar archivo en Google Drive si se adjuntó contenido Base64
      if (fileBase64) {
        var rootFolder = getOrCreateRootFolder();
        var orgFolder = getOrCreateSubfolder(rootFolder, orgNom);
        var estabFolderName = (nroEstabVal ? ("Estab_" + nroEstabVal + " - ") : "") + estabNom;
        var estabFolder = getOrCreateSubfolder(orgFolder, estabFolderName);

        var ext = "pdf";
        if (originalFileName.lastIndexOf(".") !== -1) {
          ext = originalFileName.substring(originalFileName.lastIndexOf(".") + 1);
        }

        codedFileName = generarNombreArchivoCodificado(orgNom, nroEstabVal, actTipo, fechaAct, detalle, ext);

        var cleanBase64 = String(fileBase64 || "").replace(/^data:.*base64,/, "").replace(/\s+/g, "");
        var fileBytes = Utilities.base64Decode(cleanBase64);
        var blob = Utilities.newBlob(fileBytes, mimeType, codedFileName);
        var createdFile = estabFolder.createFile(blob);
        
        // Configurar archivo como visualizable por quien tenga el link
        try {
          createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(shareErr) {
          Logger.log("No se pudo configurar sharing público: " + shareErr.toString());
        }

        driveUrl = createdFile.getUrl();
        driveFileId = createdFile.getId();

        // 1.b. Guardar además en la Carpeta Mensual correspondiente (SIN SUBCARPETAS)
        try {
          var mFolderData = getOrCreateMonthlyFolder(rootFolder, fechaAct);
          var monthFolderUrl = mFolderData.url;
          var monthFolderId = mFolderData.id;

          try {
            mFolderData.folder.addFile(createdFile);
          } catch(addErr) {
            try {
              mFolderData.folder.createShortcut(createdFile.getId());
            } catch(scErr) {
              createdFile.makeCopy(codedFileName, mFolderData.folder);
            }
          }
        } catch(monthErr) {
          Logger.log("Error al guardar en carpeta mensual: " + monthErr.toString());
        }
      }

      // 2. Registrar en la hoja 'Legajo_Actividades_Archivos'
      var sheetLegajo = ss.getSheetByName("Legajo_Actividades_Archivos");
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
        // Asegurar que exista la cabecera de URL Carpeta Mensual si la hoja es previa
        var curHeaders = sheetLegajo.getRange(1, 1, 1, Math.max(16, sheetLegajo.getLastColumn())).getValues()[0];
        if (!curHeaders[15] || curHeaders[15] === "") {
          sheetLegajo.getRange(1, 16).setValue("URL Carpeta Mensual").setBackground("#0b3d63").setFontColor("#ffffff").setFontWeight("bold");
        }
      }

      var regId = "ACT_" + new Date().getTime();
      sheetLegajo.appendRow([
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
      ]);

      // 3. Sincronizar en la 'Matriz_Control_Gestion'
      actualizarMatrizPorActividad(ss, estabNom, nroEstabVal, actTipo, estadoAct, fechaAct, driveUrl);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Actividad y documento registrados exitosamente (en sede y en carpeta mensual sin subcarpetas).",
        registroId: regId,
        fileName: codedFileName,
        fileUrl: driveUrl,
        fileId: driveFileId,
        monthFolderUrl: monthFolderUrl || "",
        monthFolderId: monthFolderId || "",
        monthKey: mFolderData ? mFolderData.key : "",
        monthLabel: mFolderData ? mFolderData.label : "",
        parentMensualUrl: mFolderData ? mFolderData.parentUrl : ""
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
          "confeccion_rgrl": "RGRL",
          "confeccion_rar": "RAR",
          "capacitaciones": "CAPACITACION_EN_OCASION_DE_VISITA",
          "mediciones_ruido": "MEDICION_DE_RUIDO",
          "mediciones_iluminacion": "MEDICION_DE_ILUMINACION",
          "mediciones_puesta_a_tierra": "MEDICION_PUESTA_A_TIERRA",
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
          actualizarColumnaMatriz(ss, targetEstab, colTarget, remainingValue);
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

function actualizarMatrizPorActividad(ss, nombreEstab, nroEstab, actTipo, estado, fecha, driveUrl) {
  var sheetMatriz = ss.getSheetByName("Matriz_Control_Gestion");
  if (!sheetMatriz) return;

  var colNameMap = {
    "constancia_visita": "CONSTANCIA_VISITA",
    "cv": "CONSTANCIA_VISITA",
    "informe_tecnico": "INFORME_TECNICO",
    "informe": "INFORME_TECNICO",
    "confeccion_rgrl": "RGRL",
    "confeccion_rar": "RAR",
    "capacitaciones": "CAPACITACION_EN_OCASION_DE_VISITA",
    "mediciones_ruido": "MEDICION_DE_RUIDO",
    "mediciones_iluminacion": "MEDICION_DE_ILUMINACION",
    "mediciones_puesta_a_tierra": "MEDICION_PUESTA_A_TIERRA",
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
  actualizarColumnaMatriz(ss, nombreEstab, colTarget, valor);
}

function actualizarColumnaMatriz(ss, estNombre, nombreColumna, nuevoValor) {
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
  var buscado = String(estNombre).toLowerCase().trim();

  for (var r = 1; r < data.length; r++) {
    var valEstab = String(data[r][1] || "").toLowerCase().trim();
    if (valEstab === buscado || (valEstab && buscado && (valEstab.includes(buscado) || buscado.includes(valEstab)))) {
      targetRow = r + 1;
      break;
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
