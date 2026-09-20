const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manual de Uso: Carga de Checklist Técnico de Higiene y Seguridad - IAPSER ART</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0f172a;
      --primary-light: #1e293b;
      --accent: #0284c7;
      --accent-hover: #0369a1;
      --success: #059669;
      --warning: #d97706;
      --danger: #dc2626;
      --text: #1e293b;
      --text-muted: #64748b;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --border-focus: #38bdf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 0 0 60px 0;
    }
    
    /* Header principal */
    .hero {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0369a1 100%);
      color: #ffffff;
      padding: 45px 20px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .hero-badge {
      display: inline-block;
      background: rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.4);
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .hero h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }
    .hero p {
      font-size: 15px;
      color: #cbd5e1;
      max-width: 720px;
      margin: 0 auto 22px auto;
    }
    .hero-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .btn-hero {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #0284c7;
      color: white;
      text-decoration: none;
      padding: 10px 22px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
      transition: all 0.2s ease;
    }
    .btn-hero:hover {
      background: #0369a1;
      transform: translateY(-1px);
    }
    .btn-hero-secondary {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.25);
    }
    .btn-hero-secondary:hover {
      background: rgba(255,255,255,0.2);
    }

    /* Contenedor central */
    .container {
      max-width: 960px;
      margin: 30px auto 0 auto;
      padding: 0 20px;
    }

    /* Indice rapido */
    .index-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .index-card h3 {
      font-size: 15px;
      color: var(--primary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .index-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 10px;
    }
    .index-item {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: #334155;
      font-size: 13px;
      font-weight: 500;
      padding: 8px 12px;
      border-radius: 6px;
      background: #f1f5f9;
      transition: all 0.2s ease;
    }
    .index-item:hover {
      background: #e2e8f0;
      color: var(--accent);
    }

    /* Pasos */
    .step-section {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      margin-bottom: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.03);
    }
    .step-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 14px;
    }
    .step-number {
      background: linear-gradient(135deg, #0284c7, #0f172a);
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);
    }
    .step-title {
      font-size: 19px;
      font-weight: 700;
      color: var(--primary);
    }
    .step-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* Cajas de alerta y notas */
    .alert-box {
      padding: 14px 18px;
      border-radius: 8px;
      font-size: 13px;
      margin: 16px 0;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      line-height: 1.5;
    }
    .alert-info {
      background: #f0f9ff;
      border-left: 4px solid #0284c7;
      color: #0369a1;
    }
    .alert-success {
      background: #ecfdf5;
      border-left: 4px solid #10b981;
      color: #047857;
    }
    .alert-warning {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      color: #b45309;
    }

    /* Mocks visuales de interfaz */
    .ui-mockup {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      overflow: hidden;
      margin: 20px 0;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }
    .ui-mockup-header {
      background: #1e293b;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid #334155;
    }
    .ui-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot-red { background: #ef4444; }
    .dot-yellow { background: #f59e0b; }
    .dot-green { background: #10b981; }
    .ui-mockup-title {
      font-size: 11px;
      color: #94a3b8;
      font-family: monospace;
      margin-left: 6px;
    }
    .ui-mockup-body {
      padding: 16px;
      color: #f8fafc;
    }

    /* Elementos simulados */
    .mock-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .mock-field {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
    }
    .mock-field-label {
      font-size: 9px;
      color: #94a3b8;
      display: block;
      margin-bottom: 3px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .mock-field-value {
      font-size: 11px;
      color: #f8fafc;
      font-weight: 600;
    }

    /* Tabla simulada */
    .mock-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      background: #ffffff;
      color: #1e293b;
      border-radius: 6px;
      overflow: hidden;
    }
    .mock-table th {
      background: #0f172a;
      color: #f8fafc;
      padding: 8px 10px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
    }
    .mock-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .mock-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge-blue { background: #e0f2fe; color: #0369a1; }
    .badge-amber { background: #fef3c7; color: #b45309; }
    .badge-green { background: #d1fae5; color: #047857; }
    
    .btn-mock-view {
      background: #0284c7;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .btn-mock-charge {
      background: #059669;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-mock-visita {
      background: #0f172a;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      border: 1px solid #334155;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Listas de pasos */
    .substeps-list {
      list-style: none;
      margin: 14px 0;
    }
    .substeps-list li {
      position: relative;
      padding-left: 28px;
      margin-bottom: 12px;
      font-size: 13.5px;
      line-height: 1.5;
    }
    .substeps-list li::before {
      content: "✓";
      position: absolute;
      left: 0;
      top: 0;
      background: #e0f2fe;
      color: #0284c7;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
    }

    /* Mobile guide */
    .mobile-guide-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
    }
    @media (max-width: 700px) {
      .mobile-guide-grid { grid-template-columns: 1fr; }
    }
    .mobile-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .mobile-card h4 {
      font-size: 14px;
      color: var(--primary);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 12px;
    }

    @media print {
      body { background: white; padding: 0; }
      .hero { padding: 20px; }
      .hero-actions, .index-card { display: none; }
      .step-section { border: 1px solid #ccc; box-shadow: none; page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- HERO BANNER -->
  <header class="hero">
    <span class="hero-badge">IAPSER ART • Guía Operativa de Campo</span>
    <h1>Manual de Usuario: Carga de Checklist Técnico</h1>
    <p>Paso a paso para preventores y técnicos de Higiene y Seguridad: selección de sedes, llenado de relevamientos, registro de visitas y sincronización oficial.</p>
    <div class="hero-actions">
      <a href="https://guidodragani75-byte.github.io/checklist-iapser/" class="btn-hero" target="_blank">
        🚀 Abrir Aplicación Web Oficial
      </a>
      <a href="#paso-3" class="btn-hero btn-hero-secondary">
        📝 Cómo Cargar un Formulario
      </a>
    </div>
  </header>

  <div class="container">

    <!-- ÍNDICE DE CONTENIDOS -->
    <div class="index-card">
      <h3>📌 Contenido del Manual</h3>
      <div class="index-grid">
        <a href="#paso-1" class="index-item">1. Acceso y Uso Móvil</a>
        <a href="#paso-2" class="index-item">2. Búsqueda y Filtros</a>
        <a href="#paso-3" class="index-item">3. Iniciar la Carga (2 Casos)</a>
        <a href="#paso-4" class="index-item">4. Llenado del Formulario</a>
        <a href="#paso-5" class="index-item">5. Guardado e Impacto Sheets</a>
        <a href="#faq" class="index-item">6. Preguntas Frecuentes</a>
      </div>
    </div>

    <!-- PASO 1 -->
    <section id="paso-1" class="step-section">
      <div class="step-header">
        <div class="step-number">1</div>
        <div>
          <h2 class="step-title">Acceso a la Aplicación (PC y Teléfono Móvil)</h2>
          <p class="step-subtitle">Sin instalaciones complicadas: funciona directo en el navegador de cualquier teléfono o computadora.</p>
        </div>
      </div>

      <p style="font-size: 14px; margin-bottom: 12px;">
        Ingresá al enlace web permanente y oficial:
        <br>
        <strong style="color: #0284c7; font-size: 15px;">https://guidodragani75-byte.github.io/checklist-iapser/</strong>
      </p>

      <div class="mobile-guide-grid">
        <div class="mobile-card">
          <h4>📱 En Teléfonos Android (Google Chrome)</h4>
          <ol style="padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
            <li>Abrí el enlace en <strong>Google Chrome</strong>.</li>
            <li>Tocá los <strong>tres puntos ⋮</strong> en la esquina superior derecha.</li>
            <li>Seleccioná <strong>"Agregar a la pantalla principal"</strong> (o <em>"Instalar app"</em>).</li>
            <li>Te quedará un icono en el escritorio del celular para entrar con un solo toque.</li>
          </ol>
        </div>

        <div class="mobile-card">
          <h4>🍏 En iPhone / iPad (Safari)</h4>
          <ol style="padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
            <li>Abrí el enlace en <strong>Safari</strong>.</li>
            <li>Tocá el botón <strong>Compartir ⎋</strong> (abajo en el centro).</li>
            <li>Buscá y tocá <strong>"Agregar al inicio" ⊞</strong>.</li>
            <li>Tocá <strong>"Agregar"</strong> para abrirla a pantalla completa como una app.</li>
          </ol>
        </div>
      </div>

      <div class="alert-box alert-info">
        <div>💡</div>
        <div><strong>Funcionamiento Offline:</strong> La aplicación contiene en memoria los 452 establecimientos provinciales. Si perdés señal o conexión a internet en el establecimiento, podés continuar completando el formulario normalmente.</div>
      </div>
    </section>

    <!-- PASO 2 -->
    <section id="paso-2" class="step-section">
      <div class="step-header">
        <div class="step-number">2</div>
        <div>
          <h2 class="step-title">Búsqueda y Selección en el Directorio de Sedes</h2>
          <p class="step-subtitle">Al ingresar, la aplicación abre automáticamente en la pestaña "🏢 Sedes por CUIT".</p>
        </div>
      </div>

      <p style="font-size: 14px;">
        La barra de controles te permite filtrar instantáneamente por cualquiera de estos criterios combinados:
      </p>

      <!-- SIMULACIÓN VISUAL DE LA BARRA DE FILTROS -->
      <div class="ui-mockup">
        <div class="ui-mockup-header">
          <span class="ui-dot dot-red"></span>
          <span class="ui-dot dot-yellow"></span>
          <span class="ui-dot dot-green"></span>
          <span class="ui-mockup-title">🏢 Directorio de Sedes por Organismo • Filtros Multicriterio</span>
        </div>
        <div class="ui-mockup-body">
          <div class="mock-grid">
            <div class="mock-field">
              <span class="mock-field-label">1. CUIT / Organismo</span>
              <span class="mock-field-value">JEFATURA DE POLICIA (102)</span>
            </div>
            <div class="mock-field">
              <span class="mock-field-label">2. Provincia</span>
              <span class="mock-field-value">Entre Ríos (448)</span>
            </div>
            <div class="mock-field">
              <span class="mock-field-label">3. Localidad</span>
              <span class="mock-field-value">Paraná (185)</span>
            </div>
            <div class="mock-field">
              <span class="mock-field-label">4. Estado Checklist</span>
              <span class="mock-field-value">⏳ Pendientes</span>
            </div>
            <div class="mock-field">
              <span class="mock-field-label">5. Buscar</span>
              <span class="mock-field-value">🔍 Calle, N°...</span>
            </div>
          </div>
        </div>
      </div>

      <ul class="substeps-list">
        <li><strong>Filtro 1 (CUIT / Organismo):</strong> Elegí el organismo cliente (ej. <em>Policía, Salud, ATER, UADER, etc.</em>) o dejá <em>Todos</em>.</li>
        <li><strong>Filtro 2 (Provincia) y Filtro 3 (Localidad):</strong> El menú de localidades se auto-condiciona según el organismo elegido y te indica cuántas dependencias hay en cada ciudad.</li>
        <li><strong>Filtro 4 (Estado del Checklist):</strong>
          <br>• <code>✅ Con checklist realizado:</code> Muestra las sedes que ya tienen inspecciones cargadas.
          <br>• <code>⏳ Pendientes (sin checklist):</code> Muestra las sedes pendientes de relevamiento técnico.
        </li>
        <li><strong>Botón 🔄 Limpiar:</strong> Restablece todos los filtros para volver a ver el catálogo completo.</li>
      </ul>
    </section>

    <!-- PASO 3 -->
    <section id="paso-3" class="step-section">
      <div class="step-header">
        <div class="step-number">3</div>
        <div>
          <h2 class="step-title">Iniciar la Carga del Checklist (Dos Caminos)</h2>
          <p class="step-subtitle">Diferenciación automática entre relevar una sede pendiente o registrar una nueva visita.</p>
        </div>
      </div>

      <!-- SIMULACIÓN DE LA TABLA DE SEDES -->
      <div class="ui-mockup">
        <div class="ui-mockup-header">
          <span class="ui-dot dot-red"></span>
          <span class="ui-dot dot-yellow"></span>
          <span class="ui-dot dot-green"></span>
          <span class="ui-mockup-title">Tabla de Establecimientos • Acciones Diferenciadas</span>
        </div>
        <div class="ui-mockup-body" style="padding: 8px;">
          <table class="mock-table">
            <thead>
              <tr>
                <th style="width:45px;">N°</th>
                <th>Nombre del Establecimiento / Dependencia</th>
                <th>Localidad</th>
                <th>Relevamientos</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              <!-- CASO A: SEDE PENDIENTE -->
              <tr style="background:#fdfefe;">
                <td><span class="mock-badge badge-blue">N° 1</span></td>
                <td>
                  <strong>CORDOBA - 351 (PARANA)</strong>
                  <div style="font-size:9px;color:#64748b;">Dirección oficial del catálogo (sin checklist aún)</div>
                </td>
                <td>📍 Paraná</td>
                <td><span class="mock-badge badge-amber">⏳ Sin checklist</span></td>
                <td>
                  <button class="btn-mock-charge">📝 Cargar Checklist</button>
                </td>
              </tr>
              <!-- CASO B: SEDE CON CHECKLIST YA REALIZADO -->
              <tr>
                <td><span class="mock-badge badge-blue">N° 56</span></td>
                <td>
                  <strong style="color:#0369a1;">Comisaría 3ra - Div. Montada y Canes</strong>
                  <div style="font-size:9px;color:#64748b;">Nombre oficial relevado por el preventor</div>
                </td>
                <td>📍 Paraná</td>
                <td>
                  <button class="btn-mock-view">👁️ ⭐ 15/05/2026</button>
                </td>
                <td>
                  <button class="btn-mock-visita">💾 + Nueva Visita</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px;">
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:16px;">
          <h3 style="color:#166534; font-size:14px; margin-bottom:8px;">🌱 Caso A: Sede Pendiente (Primer relevamiento)</h3>
          <p style="font-size:13px; color:#14532d; line-height:1.5;">
            Hacé clic en el botón verde <strong>"📝 Cargar Checklist"</strong>.
            <br><br>
            El sistema abre el formulario, precarga la dirección, CUIT y número de establecimiento, y asigna automáticamente la <strong>fecha de hoy</strong>.
          </p>
        </div>

        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px;">
          <h3 style="color:#0f172a; font-size:14px; margin-bottom:8px;">📅 Caso B: Sede ya Relevada (Segunda visita)</h3>
          <p style="font-size:13px; color:#334155; line-height:1.5;">
            • Podés tocar el botón con el <strong>ojo 👁️</strong> para ver el informe técnico anterior.
            <br><br>
            • Si vas a realizar una nueva visita de inspección, tocá <strong>"💾 + Nueva Visita"</strong>. Se generará un formulario limpio para ingresar la nueva fecha sin borrar ni pisar el historial anterior.
          </p>
        </div>
      </div>
    </section>

    <!-- PASO 4 -->
    <section id="paso-4" class="step-section">
      <div class="step-header">
        <div class="step-number">4</div>
        <div>
          <h2 class="step-title">Completar el Formulario Técnico</h2>
          <p class="step-subtitle">Capítulos normativos, dotación, desvíos, causas y medidas correctivas.</p>
        </div>
      </div>

      <ul class="substeps-list">
        <li>
          <strong>Nombre Real del Establecimiento:</strong>
          <br>En el campo <em>"Nombre del Establecimiento / Dependencia"</em>, escribí el nombre real que relevás en el lugar (ej: <em>"Comisaría 4ta - Sección Judiciales"</em> o <em>"Hospital San Roque - Pabellón Niños"</em>).
          <br><span style="color:#0284c7; font-size:12px; font-weight:600;">⭐ Este nombre es el que quedará visible en el sistema y en la tabla del directorio.</span>
        </li>
        <li>
          <strong>Datos del Relevador y Actividad:</strong> Indicá tu nombre, matrícula profesional (colegio HySER) y describí brevemente las tareas desarrolladas.
        </li>
        <li>
          <strong>Evaluación Normativa (S / N / NA):</strong>
          <br>En cada ítem del checklist marcá si Cumple (<strong>S</strong>), No Cumple (<strong>N</strong>) o No Aplica (<strong>NA</strong>).
          <br>Cuando marques <strong>"N"</strong>, seleccioná las casillas de causales asociadas (ej. <em>falta señalización, sin antideslizante, cableado expuesto</em>).
        </li>
        <li>
          <strong>Panel Lateral de Tareas por Visita:</strong>
          <br>A medida que marques desvíos, el panel lateral derecho acumula automáticamente las tareas prioritarias para programar la visita y las recomendaciones al organismo.
        </li>
        <li>
          <strong>Soporte de Extintores y Carga de Fuego:</strong>
          <br>Disponés de las pestañas técnicas dedicadas para inventariar matafuegos y calcular la carga de fuego por sector.
        </li>
      </ul>
    </section>

    <!-- PASO 5 -->
    <section id="paso-5" class="step-section">
      <div class="step-header">
        <div class="step-number">5</div>
        <div>
          <h2 class="step-title">Guardado Local, Exportación a PDF e Impacto en Sheets</h2>
          <p class="step-subtitle">Seguridad de datos en tu dispositivo y sincronización con la nube de IAPSER ART.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
        <div style="border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: #fafafa;">
          <h4 style="font-size: 13px; color: var(--primary); margin-bottom: 6px;">💾 1. Guardado Automático</h4>
          <p style="font-size: 12.5px; color: var(--text-muted);">Todo cambio se guarda al instante en la memoria local de tu celular o PC. Podés cerrar el navegador y nada se pierde.</p>
        </div>

        <div style="border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: #fafafa;">
          <h4 style="font-size: 13px; color: var(--primary); margin-bottom: 6px;">🖨️ 2. Exportar a PDF</h4>
          <p style="font-size: 12.5px; color: var(--text-muted);">El botón <em>"Imprimir Informe (PDF)"</em> genera el reporte oficial diagramado en <strong>10 páginas A4 exactas</strong> listo para firmar o entregar al organismo.</p>
        </div>

        <div style="border: 1px solid var(--border); border-radius: 8px; padding: 14px; background: #fafafa;">
          <h4 style="font-size: 13px; color: #0284c7; margin-bottom: 6px;">☁️ 3. Impactar en Sheets</h4>
          <p style="font-size: 12.5px; color: var(--text-muted);">Al tener conexión, tocá <strong>"Sincronizar a Google Sheets"</strong> para impactar el relevamiento en la base central institucional.</p>
        </div>
      </div>

      <div class="alert-box alert-warning" style="margin-top:16px;">
        <div>⚠️</div>
        <div>
          <strong>Aviso de Sobrescritura de Seguridad:</strong> Si intentás impactar un relevamiento sobre una fecha que ya existía en Google Sheets, la aplicación te consultará si querés modificar el documento guardado previamente para evitar pisados accidentales.
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="step-section">
      <div class="step-header">
        <div class="step-number">?</div>
        <div>
          <h2 class="step-title">Preguntas Frecuentes</h2>
          <p class="step-subtitle">Respuestas a dudas operativas en campo.</p>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap: 14px;">
        <div>
          <strong style="font-size: 13.5px; color: var(--primary);">¿Puedo cargar un establecimiento que figura sin número (S/N)?</strong>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">Sí. En el catálogo figuran identificados con el tag <code>S/N</code> y su domicilio real. Podés seleccionarlo y cargar el checklist normalmente.</p>
        </div>

        <div>
          <strong style="font-size: 13.5px; color: var(--primary);">¿Qué pasa si visito dos veces la misma sede en meses diferentes?</strong>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">Hacés clic en <strong>"💾 + Nueva Visita"</strong>. La clave que diferencia un informe de otro es la <strong>fecha</strong>. Así conservás el historial completo de cada visita técnica.</p>
        </div>

        <div>
          <strong style="font-size: 13.5px; color: var(--primary);">¿Cómo sé si estoy usando la última versión?</strong>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 3px;">Al entrar siempre mediante el link oficial de GitHub Pages, tu navegador carga de forma automática la última versión oficial sin reenviar archivos.</p>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      <p>IAPSER ART • Sistema Integral de Relevamiento de Higiene y Seguridad Laboral</p>
      <p style="margin-top: 4px;">Dirección de Prevención de Riesgos • Provincia de Entre Ríos • Versión 2.0</p>
    </footer>

  </div>

</body>
</html>
`;

fs.writeFileSync('manual_de_uso.html', html, 'utf8');
fs.writeFileSync('dist/manual_de_uso.html', html, 'utf8');
console.log('✅ Manual de uso generado exitosamente en manual_de_uso.html y dist/manual_de_uso.html');
