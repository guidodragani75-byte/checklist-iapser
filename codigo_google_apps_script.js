/**
 * SERVICIO WEBHOOK - GOOGLE APPS SCRIPT PARA INFORMES IAPSER
 * Planilla: https://docs.google.com/spreadsheets/d/1-eQvCHv3LB6C2ydjY_fXwWEY67e5vbE4GNWIBKSrMfE/edit?gid=0#gid=0
 * 
 * Estructura de Hojas:
 * 1. 'Establecimientos': Directorio general con datos de cabecera.
 * 2. 'Matriz_Control_Gestion': Tablero maestro por establecimiento (15 variables de control, Plan Teórico vs Realidad, SVCC).
 * 3. 'Datos': Historial cronológico de relevamientos de HyS guardados por fecha.
 * 4. 'Extintores_Detalle': Registro pormenorizado del parque de extintores relevado in situ.
 */

var SPREADSHEET_ID = "1-eQvCHv3LB6C2ydjY_fXwWEY67e5vbE4GNWIBKSrMfE";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

    // Retornar Matriz de Control si se solicita
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
          obj[mHeaders[c]] = mData[r][c];
        }
        mRows.push(obj);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", matriz: mRows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Por defecto, retornar listado de Establecimientos
    var sheet = ss.getSheetByName("Establecimientos");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", establecimientos: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    var list = [];
    
    // Fila 0 son encabezados (Organismo, Nombre_establecimiento, DOMICILIO, CP, LOCALIDAD, PROVINCIA, NRO.ESTAB.)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var org = row[0] ? String(row[0]).trim() : "";
      var nom = row[1] ? String(row[1]).trim() : "";
      var dom = row[2] ? String(row[2]).trim() : "";
      var cp = row[3] ? String(row[3]).trim() : "";
      var loc = row[4] ? String(row[4]).trim() : "";
      var prov = row[5] ? String(row[5]).trim() : "";
      var nro = row[6] ? String(row[6]).trim() : "";

      if (org || dom || nro) {
        list.push({
          id: "sheet_row_" + (i + 1),
          rowIndex: i + 1,
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

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet();

    // ========================================================
    // CASO A: OPERACIÓN CONTROL DE EXTINTORES (Móvil Offline)
    // ========================================================
    if (data.tipoOperacion === "control_extintores") {
      var estNombre = String(data.establecimiento || "").trim();
      var localidad = String(data.localidad || "").trim();
      var auditor = String(data.auditor || "").trim();
      var totalExt = data.total || (data.extintores ? data.extintores.length : 0);
      var extList = data.extintores || [];

      // Guardar detalle en 'Extintores_Detalle'
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

      var now = new Date();
      extList.forEach(function(x) {
        sheetExt.appendRow([
          now,
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

      // Actualizar columna CONTROL_DE_EXTINTORES en 'Matriz_Control_Gestion'
      actualizarColumnaMatriz(ss, estNombre, "CONTROL_DE_EXTINTORES", "Relevado (" + totalExt + " extintores)");

      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Control de " + totalExt + " extintores registrado exitosamente." 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ========================================================
    // CASO B: RELEVAMIENTO COMPLETO HyS (Checklist Interactivo)
    // ========================================================
    var est = data.establecimiento || {};
    var prof = data.profesionales || {};
    var control = data.controlGestion || {};
    var planTeorico = data.planTeorico || {};

    var orgVal = String(est.organismo || est.razonSocial || "").trim();
    var nombreEstabVal = String(est.nombreEstablecimiento || "").trim();
    var domVal = String(est.domicilio || est.direccion || "").trim();
    var cpVal = String(est.cp || "").trim();
    var locVal = String(est.localidad || "").trim();
    var provVal = String(est.provincia || "Entre Ríos").trim();
    var nroVal = String(est.nroEstab || "").trim();
    var fechaRel = String(est.fecha || "").trim();

    // 1. ACTUALIZAR 'Establecimientos'
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
        sheetEst.appendRow([orgVal, nombreEstabVal, domVal, cpVal, locVal, provVal, nroVal]);
      }
    }

    // 2. ACTUALIZAR O INSERTAR EN 'Matriz_Control_Gestion' (15 VARIABLES)
    upsertMatrizControl(ss, {
      nroEstab: nroVal,
      nombreEstablecimiento: nombreEstabVal || orgVal,
      localidad: locVal,
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

    // 3. GUARDAR EL HISTORIAL DETALLADO EN 'Datos'
    guardarEnHojaDatos(ss, data, orgVal, nombreEstabVal, nroVal, domVal, locVal, provVal, cpVal, fechaRel, prof, est);

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

/**
 * Función para actualizar o crear la fila del establecimiento en Matriz_Control_Gestion
 */
function upsertMatrizControl(ss, m) {
  var headers = [
    "NRO.ESTAB.", "NOMBRE_ESTABLECIMIENTO", "LOCALIDAD",
    "RGRL", "RAR", "SVCC", "RES_886", "RIESGOS_GRAVES_INMINENTE",
    "CAPACITACION_EN_OCASION_DE_VISITA", "CONTROL_DE_EXTINTORES", "CAPACITACION_PLANIFICADA",
    "TOMA_DE_AGUA", "MEDICION_DE_ILUMINACION", "MEDICION_DE_RUIDO", "MEDICION_DE_PUESTA_A_TIERRA",
    "OTRAS_MEDICIONES", "SIMULACRO", "CARGA_DE_FUEGO",
    "ESTADO_PLAN_TEORICO", "ULTIMA_ACTUALIZACION"
  ];

  var sheet = ss.getSheetByName("Matriz_Control_Gestion");
  if (!sheet) {
    sheet = ss.insertSheet("Matriz_Control_Gestion");
    sheet.appendRow(headers);
    var hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setBackground("#0b3d63");
    hr.setFontColor("#ffffff");
    hr.setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  // Lógica de cálculo cruzado SVCC
  var svccCalculado = m.svcc;
  var rgrlHasCancer = String(m.rgrl || "").toLowerCase().indexOf("cancer") !== -1;
  var rarHasCancer = String(m.rar || "").toLowerCase().indexOf("cancer") !== -1;

  if (rgrlHasCancer && !rarHasCancer) {
    svccCalculado = "⚠️ INCONSISTENCIA (RGRL con cancerígenos y RAR sin declarar)";
  } else if (!rgrlHasCancer && rarHasCancer) {
    svccCalculado = "⚠️ INCONSISTENCIA (RAR declara cancerígenos pero no está en RGRL)";
  } else if (rgrlHasCancer && rarHasCancer) {
    if (svccCalculado !== "Cargada") {
      svccCalculado = "Pendiente carga (Corresponde SVCC)";
    }
  } else {
    svccCalculado = "N/A";
  }

  var rowData = [
    m.nroEstab || "",
    m.nombreEstablecimiento || "",
    m.localidad || "",
    m.rgrl || "No realizado",
    m.rar || "Sin nómina",
    svccCalculado,
    m.res886 || "",
    m.rgi || "No",
    m.capVisita || "",
    m.extintores || "Pendiente",
    m.capPlanificada || "",
    m.tomaAgua || 0,
    m.medIlum || 0,
    m.medRuido || 0,
    m.medPat || 0,
    m.otrasMed || 0,
    m.simulacro || "No",
    m.cargaFuego || "No",
    m.planTeoricoEstado || "Ajustado a Realidad",
    new Date()
  ];

  var data = sheet.getDataRange().getValues();
  var foundRow = -1;

  for (var i = 1; i < data.length; i++) {
    var curNro = String(data[i][0] || "").trim();
    var curNom = String(data[i][1] || "").trim().toLowerCase();
    if (m.nroEstab && curNro === String(m.nroEstab).trim()) {
      foundRow = i + 1;
      break;
    } else if (!m.nroEstab && m.nombreEstablecimiento && curNom === m.nombreEstablecimiento.toLowerCase()) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 1) {
    sheet.getRange(foundRow, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

/**
 * Actualiza una celda específica en la hoja Matriz_Control_Gestion
 */
function actualizarColumnaMatriz(ss, nombreEstab, nombreCol, valor) {
  var sheet = ss.getSheetByName("Matriz_Control_Gestion");
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var headers = data[0] || [];
  var colIdx = headers.indexOf(nombreCol);
  if (colIdx === -1) return;

  var targetRow = -1;
  var buscado = nombreEstab.toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var nom = String(data[i][1] || "").toLowerCase();
    if (nom && (nom === buscado || nom.indexOf(buscado) !== -1 || buscado.indexOf(nom) !== -1)) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow > 1) {
    sheet.getRange(targetRow, colIdx + 1).setValue(valor);
    sheet.getRange(targetRow, headers.indexOf("ULTIMA_ACTUALIZACION") + 1).setValue(new Date());
  }
}

/**
 * Historial detallado por relevamiento en la hoja Datos
 */
function guardarEnHojaDatos(ss, data, orgVal, nombreEstabVal, nroVal, domVal, locVal, provVal, cpVal, fechaRel, prof, est) {
  var headersDatos = [
    "Timestamp", "Fecha Relevamiento", "Organismo", "Nombre Establecimiento", "NRO.ESTAB.", "Domicilio", "Localidad", "Provincia", "CP",
    "CUIT", "ART", "Relevado por", "Actividad Principal",
    "Inmueble", "Condición Contrato", "Sup. Total m²", "Sup. Cubierta m²", "Plantas",
    "Dotación Total", "Administrativos", "Producción", "Otros",
    "Condiciones Generales",
    "HyS Nombre", "HyS Matrícula", "HyS Teléfono", "HyS Modalidad", "HyS Email",
    "Médico Nombre", "Médico Matrícula", "Médico Teléfono", "Comité Mixto",
    "Cant. Desvíos (NO)", "Desvíos y Causas",
    "Mediciones Programadas", "Ergonomía Programada", "Visitas Programadas", "Capacitaciones Programadas",
    "Observaciones", "Datos_JSON"
  ];

  var sheetDatos = ss.getSheetByName("Datos");
  if (!sheetDatos) {
    sheetDatos = ss.insertSheet("Datos");
    sheetDatos.appendRow(headersDatos);
    var hr = sheetDatos.getRange(1, 1, 1, headersDatos.length);
    hr.setBackground("#0b3d63");
    hr.setFontColor("#ffffff");
    hr.setFontWeight("bold");
    sheetDatos.setFrozenRows(1);
  }

  var respuestas = data.respuestas || [];
  var noItems = [];
  respuestas.forEach(function(r) {
    if (r.valor === "N") {
      var causasStr = (r.causas && r.causas.length) ? " [Causas: " + r.causas.join(", ") + "]" : "";
      noItems.push("[" + (r.eje || "") + "] " + (r.label || "") + causasStr);
    }
  });

  var prog = data.programacion || {};
  var strMed = (prog.mediciones || []).map(function(m) {
    return (m.label || "") + (m.sector ? " (" + m.sector + ")" : "") + (m.month ? " - Mes: " + m.month : "");
  }).join(" | ");

  var strErg = (prog.ergonomia || []).map(function(e) {
    return (e.puesto || "Puesto") + (e.sector ? " (" + e.sector + ")" : "") + (e.month ? " - Mes: " + e.month : "");
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
