import json, re, os, sys

sys.stdout.reconfigure(encoding='utf-8')

# Load the consolidated JSON
with open('all_months_final_clean.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

# Normalize RS for dropdown while preserving exact RS
def normalize_rs(rs_str, fname=""):
    u = (rs_str + " " + fname).upper()
    if any(k in u for k in ['POLICIA', 'POLICÍA', 'JEFATURA', 'TRATA', 'SASTRERIA', 'ROCAMORA']):
        return "JEFATURA DE POLICÍA DE ENTRE RÍOS"
    elif any(k in u for k in ['SALUD', 'HOSPITAL']):
        return "MINISTERIO DE SALUD DE ENTRE RÍOS"
    elif any(k in u for k in ['UADER', 'UNIVERSIDAD', 'FACULTAD', 'FCYT', 'FCVYS']):
        return "UNIVERSIDAD AUTÓNOMA DE ENTRE RÍOS (UADER)"
    elif any(k in u for k in ['ATER', 'TRIBUTARIA', 'ADMINISTRAD']):
        return "ADMINISTRADORA TRIBUTARIA DE ENTRE RÍOS (ATER)"
    elif any(k in u for k in ['ICAB', 'ICAMB', 'BROMATOLOG']):
        return "INSTITUTO DE CONTROL DE ALIMENTACIÓN Y BROMATOLOGÍA (ICAB)"
    elif any(k in u for k in ['CAJA', 'JUBILACION']):
        return "CAJA DE JUBILACIONES Y PENSIONES DE ENTRE RÍOS"
    elif any(k in u for k in ['MINISTERIO DE GOBIERNO', 'MIN GOB', 'MIN TRAB', 'TRABAJO']):
        return "MINISTERIO DE GOBIERNO Y TRABAJO DE ENTRE RÍOS"
    return rs_str.strip()

processed_records = []
for idx, r in enumerate(raw_data):
    norm_rs = normalize_rs(r['rs'], r['filename'])
    
    # Clean estab string
    est_str = str(r['estab']).strip()
    if est_str.isdigit():
        est_num = int(est_str)
    else:
        m = re.search(r'\d+', est_str)
        est_num = int(m.group(0)) if m else 9999
        
    # Water status is already cleanly set to 'apta', 'no_apta', 'muestra_tomada', or 'sin_muestra'
    agua_status = r.get('agua_status', 'sin_muestra')
    has_arsenico = "arsénico" in r['agua'].lower() or "arsenico" in r['agua'].lower()
    
    # Classify PAT
    pat_status = "conforme"
    pat_lower = r['pat'].lower()
    if "no se pudo" in pat_lower or "no fue posible" in pat_lower or "no se realizó" in pat_lower or "no se realizo" in pat_lower or "imposibilidad" in pat_lower:
        pat_status = "no_medido"
    elif "adecuad" in pat_lower or "conforme" in pat_lower or "cumple" in pat_lower:
        pat_status = "conforme"
        
    # Classify Ruido
    has_ruido_protocol = "res. 85/12" in r['otras'].lower() or "decibelímetro" in r['otras'].lower() or "decibelimetro" in r['otras'].lower()

    processed_records.append({
        'id': idx + 1,
        'mes': r['mes'],
        'cuit': r['cuit'],
        'rs_norm': norm_rs,
        'rs_display': r['rs'],
        'estab': est_str,
        'estab_num': est_num,
        'domicilio': r['domicilio'],
        'agua': r['agua'],
        'agua_status': agua_status,
        'has_arsenico': has_arsenico,
        'pat': r['pat'],
        'pat_status': pat_status,
        'iluminacion': r['iluminacion'],
        'otras': r['otras'],
        'has_ruido_protocol': has_ruido_protocol,
        'filename': r['filename']
    })

data_json_str = json.dumps(processed_records, ensure_ascii=False)

html_template = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IAPSER ART - Tablero de Relevamientos y Mediciones de Higiene y Seguridad</title>
  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    :root {{
      --primary: #1e3a8a;
      --primary-light: #2563eb;
      --primary-dark: #172554;
      --accent: #0284c7;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --success: #15803d;
      --success-bg: #dcfce7;
      --danger: #b91c1c;
      --danger-bg: #fee2e2;
      --warning: #b45309;
      --warning-bg: #fef3c7;
      --purple: #6b21a8;
      --purple-bg: #f3e8ff;
      --info: #0369a1;
      --info-bg: #e0f2fe;
      --neutral: #475569;
      --neutral-bg: #f1f5f9;
      --radius: 10px;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      line-height: 1.5;
      padding: 0;
      margin: 0;
    }}

    /* Header */
    header {{
      background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 60%, var(--accent) 100%);
      color: white;
      padding: 1.75rem 2rem;
      box-shadow: var(--shadow-md);
      position: sticky;
      top: 0;
      z-index: 100;
    }}

    .header-container {{
      max-width: 1750px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1.5rem;
    }}

    .brand-title h1 {{
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }}

    .brand-title p {{
      font-size: 0.88rem;
      opacity: 0.88;
      font-weight: 400;
      margin-top: 0.2rem;
    }}

    .badge-iapser {{
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.4);
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}

    .header-actions {{
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }}

    .btn {{
      padding: 0.55rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.15s ease-in-out;
      border: 1px solid transparent;
      text-decoration: none;
    }}

    .btn-light {{
      background-color: white;
      color: var(--primary);
    }}
    .btn-light:hover {{
      background-color: #f1f5f9;
      transform: translateY(-1px);
    }}

    .btn-outline {{
      background-color: transparent;
      color: white;
      border-color: rgba(255, 255, 255, 0.6);
    }}
    .btn-outline:hover {{
      background-color: rgba(255, 255, 255, 0.15);
    }}

    /* Main Container */
    main {{
      max-width: 1750px;
      margin: 1.5rem auto;
      padding: 0 1.5rem 3rem 1.5rem;
    }}

    /* KPI Cards */
    .kpi-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }}

    .kpi-card {{
      background: var(--card-bg);
      border-radius: var(--radius);
      padding: 1.15rem 1.25rem;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, box-shadow 0.2s;
    }}

    .kpi-card:hover {{
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }}

    .kpi-title {{
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}

    .kpi-value {{
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1;
      margin-bottom: 0.35rem;
    }}

    .kpi-subtext {{
      font-size: 0.78rem;
      color: var(--text-muted);
    }}

    /* Filter Panel */
    .filter-panel {{
      background: var(--card-bg);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.5rem;
    }}

    .filter-panel-header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }}

    .filter-panel-title {{
      font-size: 1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--primary-dark);
    }}

    .filter-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }}

    .filter-group {{
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }}

    .filter-group label {{
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }}

    .filter-input, .filter-select {{
      padding: 0.6rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      font-family: inherit;
      font-size: 0.88rem;
      color: var(--text-main);
      background-color: #fff;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }}

    .filter-input:focus, .filter-select:focus {{
      border-color: var(--primary-light);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }}

    /* Quick Filter Chips */
    .quick-filters {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      padding-top: 0.75rem;
      border-top: 1px dashed var(--border);
    }}

    .chip-label {{
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
      margin-right: 0.3rem;
      text-transform: uppercase;
    }}

    .filter-chip {{
      padding: 0.3rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.78rem;
      font-weight: 600;
      border: 1px solid var(--border);
      background-color: #f1f5f9;
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.15s;
      user-select: none;
    }}

    .filter-chip:hover {{
      background-color: #e2e8f0;
    }}

    .filter-chip.active {{
      background-color: var(--primary);
      color: white;
      border-color: var(--primary);
    }}

    .btn-reset {{
      margin-left: auto;
      background-color: #f1f5f9;
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 0.35rem 0.85rem;
      font-size: 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }}
    .btn-reset:hover {{
      background-color: #e2e8f0;
      color: var(--text-main);
    }}

    /* Results Header & Counter */
    .table-controls {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.85rem;
      flex-wrap: wrap;
      gap: 0.75rem;
    }}

    .results-count {{
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-muted);
    }}

    .results-count span {{
      color: var(--primary);
      font-weight: 800;
    }}

    /* Table Container */
    .table-container {{
      background: var(--card-bg);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      overflow-x: auto;
    }}

    table {{
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }}

    thead th {{
      background-color: #f8fafc;
      color: #334155;
      font-weight: 700;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.9rem 1rem;
      border-bottom: 2px solid var(--border);
      white-space: nowrap;
      position: sticky;
      top: 0;
      user-select: none;
      cursor: pointer;
    }}

    thead th:hover {{
      background-color: #f1f5f9;
      color: var(--primary);
    }}

    tbody tr {{
      border-bottom: 1px solid var(--border);
      transition: background-color 0.1s;
    }}

    tbody tr:hover {{
      background-color: #f8fafc;
    }}

    tbody td {{
      padding: 0.85rem 1rem;
      vertical-align: top;
      color: #1e293b;
    }}

    /* Badges */
    .badge {{
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.55rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.2;
    }}

    .badge-month {{
      background-color: #e2e8f0;
      color: #334155;
      font-weight: 700;
      border-radius: 9999px;
      padding: 0.2rem 0.55rem;
    }}

    .badge-cuit {{
      font-family: monospace;
      font-size: 0.78rem;
      color: #475569;
      background: #f1f5f9;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      white-space: nowrap;
    }}

    .badge-est {{
      font-weight: 800;
      color: var(--primary);
      background: var(--info-bg);
      border: 1px solid #bae6fd;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.85rem;
      text-align: center;
      display: inline-block;
      min-width: 2.2rem;
    }}

    .badge-success {{
      background-color: var(--success-bg);
      color: var(--success);
      border: 1px solid #bbf7d0;
    }}

    .badge-danger {{
      background-color: var(--danger-bg);
      color: var(--danger);
      border: 1px solid #fecaca;
    }}

    .badge-warning {{
      background-color: var(--warning-bg);
      color: var(--warning);
      border: 1px solid #fde68a;
    }}

    .badge-secondary {{
      background-color: var(--neutral-bg);
      color: var(--neutral);
      border: 1px solid #cbd5e1;
    }}

    .badge-purple {{
      background-color: var(--purple-bg);
      color: var(--purple);
      border: 1px solid #e9d5ff;
    }}

    .badge-info {{
      background-color: var(--info-bg);
      color: var(--info);
      border: 1px solid #bae6fd;
    }}

    .cell-title {{
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 0.2rem;
    }}

    .cell-sub {{
      font-size: 0.78rem;
      color: var(--text-muted);
    }}

    /* Details button */
    .btn-detail {{
      background: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.35rem 0.6rem;
      cursor: pointer;
      color: var(--primary);
      font-weight: 600;
      font-size: 0.78rem;
      transition: all 0.15s;
    }}
    .btn-detail:hover {{
      background-color: var(--primary);
      color: white;
      border-color: var(--primary);
    }}

    /* Modal */
    .modal-overlay {{
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }}

    .modal-overlay.active {{
      display: flex;
    }}

    .modal-content {{
      background: white;
      border-radius: var(--radius);
      box-shadow: var(--shadow-lg);
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }}

    .modal-header {{
      background: var(--primary-dark);
      color: white;
      padding: 1.25rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}

    .modal-title {{
      font-size: 1.15rem;
      font-weight: 700;
    }}

    .modal-close {{
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      opacity: 0.8;
    }}
    .modal-close:hover {{
      opacity: 1;
    }}

    .modal-body {{
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }}

    .modal-field {{
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      background: #f8fafc;
      padding: 0.85rem 1rem;
      border-radius: 6px;
      border: 1px solid var(--border);
    }}

    .modal-field-label {{
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.04em;
    }}

    .modal-field-value {{
      font-size: 0.9rem;
      color: var(--text-main);
      white-space: pre-line;
      line-height: 1.45;
    }}
  </style>
</head>
<body>

  <!-- Header -->
  <header>
    <div class="header-container">
      <div class="brand-title">
        <h1>
          <span>🛡️</span> Tablero de Higiene y Seguridad Laboral
          <span class="badge-iapser">IAPSER ART</span>
        </h1>
        <p>Relevamiento de Informes Técnicos, Análisis de Agua, P.A.T., Iluminación y Ruido (Semestre Enero - Junio 2026)</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-light" onclick="exportToCSV()">
          <span>📥</span> Exportar CSV
        </button>
        <button class="btn btn-outline" onclick="window.print()">
          <span>🖨️</span> Imprimir
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">
          <span>Establecimientos</span>
          <span>🏢</span>
        </div>
        <div class="kpi-value" id="kpi-total">76</div>
        <div class="kpi-subtext">Total informes analizados</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>Agua Potable Apta</span>
          <span>💧</span>
        </div>
        <div class="kpi-value" style="color: var(--success);" id="kpi-agua-apta">0</div>
        <div class="kpi-subtext">Cumplen Código Alimentario</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>Agua No Apta</span>
          <span>🚫</span>
        </div>
        <div class="kpi-value" style="color: var(--danger);" id="kpi-agua-no-apta">0</div>
        <div class="kpi-subtext">Contaminación o Arsénico</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>Muestra Tomada</span>
          <span>⏳</span>
        </div>
        <div class="kpi-value" style="color: var(--warning);" id="kpi-agua-muestra">0</div>
        <div class="kpi-subtext">Esperando informe laboratorio</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>Sin Toma de Muestra</span>
          <span>⚪</span>
        </div>
        <div class="kpi-value" style="color: var(--neutral);" id="kpi-agua-sin-muestra">0</div>
        <div class="kpi-subtext">No se tomó muestra en visita</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-title">
          <span>P.A.T. Conforme</span>
          <span>⚡</span>
        </div>
        <div class="kpi-value" style="color: var(--accent);" id="kpi-pat-conforme">0</div>
        <div class="kpi-subtext">Res. SRT 900/15 (< 40 Ω)</div>
      </div>
    </div>

    <!-- Filter Panel -->
    <div class="filter-panel">
      <div class="filter-panel-header">
        <div class="filter-panel-title">
          <span>🔍</span> Filtros Independientes de Búsqueda
        </div>
        <button class="btn-reset" onclick="resetFilters()">
          ↺ Restablecer Todos los Filtros
        </button>
      </div>

      <div class="filter-grid">
        <!-- 1. RS Filter -->
        <div class="filter-group">
          <label for="filter-rs">Razón Social / Organismo</label>
          <select id="filter-rs" class="filter-select" onchange="applyFilters()">
            <option value="">Todas las Razones Sociales</option>
          </select>
        </div>

        <!-- 2. Nro Estab Filter -->
        <div class="filter-group">
          <label for="filter-est">N° de Establecimiento</label>
          <select id="filter-est" class="filter-select" onchange="applyFilters()">
            <option value="">Todos los Establecimientos</option>
          </select>
        </div>

        <!-- 3. Domicilio Filter (Text search) -->
        <div class="filter-group">
          <label for="filter-dom">Domicilio / Localidad / Calle</label>
          <input type="text" id="filter-dom" class="filter-input" placeholder="Ej: Federal, Crespo, Paraná, Suipacha..." oninput="applyFilters()">
        </div>

        <!-- 4. Month Filter -->
        <div class="filter-group">
          <label for="filter-mes">Carpeta Mes</label>
          <select id="filter-mes" class="filter-select" onchange="applyFilters()">
            <option value="">Todos los Meses</option>
            <option value="Enero">Enero</option>
            <option value="Febrero">Febrero</option>
            <option value="Marzo">Marzo</option>
            <option value="Abril">Abril</option>
            <option value="Mayo">Mayo</option>
            <option value="Junio">Junio</option>
          </select>
        </div>
      </div>

      <!-- Quick Chips Filter -->
      <div class="quick-filters">
        <span class="chip-label">Filtros Rápidos de Agua:</span>
        <div class="filter-chip active" data-filter="all" onclick="setQuickFilter('all')">Todos</div>
        <div class="filter-chip" data-filter="agua_apta" onclick="setQuickFilter('agua_apta')">💧 Agua Apta (21)</div>
        <div class="filter-chip" data-filter="agua_no_apta" onclick="setQuickFilter('agua_no_apta')">🚫 Agua No Apta (14)</div>
        <div class="filter-chip" data-filter="muestra_tomada" onclick="setQuickFilter('muestra_tomada')">⏳ Muestra Tomada / En Espera (20)</div>
        <div class="filter-chip" data-filter="sin_muestra" onclick="setQuickFilter('sin_muestra')">⚪ Sin Toma de Muestra (21)</div>
        <div class="filter-chip" data-filter="arsenico" onclick="setQuickFilter('arsenico')">⚠️ Alerta Arsénico</div>
        <div class="filter-chip" data-filter="pat_conforme" onclick="setQuickFilter('pat_conforme')">⚡ PAT Conforme</div>
        <div class="filter-chip" data-filter="pat_no_medido" onclick="setQuickFilter('pat_no_medido')">⚠️ PAT No Medido</div>
        <div class="filter-chip" data-filter="ruido" onclick="setQuickFilter('ruido')">🔊 Protocolo Ruido</div>
      </div>
    </div>

    <!-- Table Controls & Counter -->
    <div class="table-controls">
      <div class="results-count">
        Mostrando <span id="filtered-count">0</span> de <span id="total-count">0</span> registros encontrados
      </div>
      <div>
        <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-right: 0.5rem;">Búsqueda Global:</label>
        <input type="text" id="global-search" class="filter-input" placeholder="Buscar cualquier término..." style="width: 260px;" oninput="applyFilters()">
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-container">
      <table id="mediciones-table">
        <thead>
          <tr>
            <th onclick="sortTable('mes')">Mes ↕</th>
            <th onclick="sortTable('cuit')">CUIT ↕</th>
            <th onclick="sortTable('rs')">Razón Social ↕</th>
            <th onclick="sortTable('estab')">N° Est. ↕</th>
            <th onclick="sortTable('domicilio')">Domicilio ↕</th>
            <th>Análisis de Agua (Detalle & Estado)</th>
            <th>P.A.T. (Puesta a Tierra)</th>
            <th>Iluminación</th>
            <th>Otras Mediciones</th>
            <th style="text-align: center;">Acción</th>
          </tr>
        </thead>
        <tbody id="table-body">
          <!-- Rows will be injected dynamically -->
        </tbody>
      </table>
    </div>

  </main>

  <!-- Modal Detail -->
  <div class="modal-overlay" id="detail-modal" onclick="closeModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title" id="modal-title">Ficha Técnica del Establecimiento</div>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modal-body">
        <!-- Injected dynamically -->
      </div>
    </div>
  </div>

  <script>
    // Data injected from python engine
    const RAW_DATA = {data_json_str};

    let activeQuickFilter = 'all';
    let currentSortField = 'id';
    let currentSortAsc = true;

    // Initialize Dropdowns
    function initDropdowns() {{
      const rsSelect = document.getElementById('filter-rs');
      const estSelect = document.getElementById('filter-est');

      // Unique Normalized RS
      const rsSet = new Set();
      RAW_DATA.forEach(d => {{ if (d.rs_norm) rsSet.add(d.rs_norm); }});
      Array.from(rsSet).sort().forEach(rs => {{
        const opt = document.createElement('option');
        opt.value = rs;
        opt.textContent = rs;
        rsSelect.appendChild(opt);
      }});

      // Unique Estabs
      const estMap = new Map();
      RAW_DATA.forEach(d => {{
        if (d.estab) {{
          estMap.set(d.estab, d.estab_num);
        }}
      }});
      Array.from(estMap.entries())
        .sort((a, b) => a[1] - b[1])
        .forEach(([estabStr, num]) => {{
          const opt = document.createElement('option');
          opt.value = estabStr;
          opt.textContent = 'Est. ' + estabStr;
          estSelect.appendChild(opt);
        }});

      updateKPIs(RAW_DATA);
      renderTable(RAW_DATA);
    }}

    // Update KPI counters
    function updateKPIs(data) {{
      document.getElementById('kpi-total').textContent = data.length;
      document.getElementById('filtered-count').textContent = data.length;
      document.getElementById('total-count').textContent = RAW_DATA.length;

      const aguaApta = data.filter(d => d.agua_status === 'apta').length;
      const aguaNoApta = data.filter(d => d.agua_status === 'no_apta').length;
      const aguaMuestra = data.filter(d => d.agua_status === 'muestra_tomada').length;
      const aguaSinMuestra = data.filter(d => d.agua_status === 'sin_muestra').length;
      const patConf = data.filter(d => d.pat_status === 'conforme').length;

      document.getElementById('kpi-agua-apta').textContent = aguaApta;
      document.getElementById('kpi-agua-no-apta').textContent = aguaNoApta;
      document.getElementById('kpi-agua-muestra').textContent = aguaMuestra;
      document.getElementById('kpi-agua-sin-muestra').textContent = aguaSinMuestra;
      document.getElementById('kpi-pat-conforme').textContent = patConf;
    }}

    // Apply Independent Filters
    function applyFilters() {{
      const rsFilter = document.getElementById('filter-rs').value.toLowerCase();
      const estFilter = document.getElementById('filter-est').value.toLowerCase();
      const domFilter = document.getElementById('filter-dom').value.toLowerCase().trim();
      const mesFilter = document.getElementById('filter-mes').value;
      const searchGlobal = document.getElementById('global-search').value.toLowerCase().trim();

      const filtered = RAW_DATA.filter(item => {{
        // RS filter (independent)
        if (rsFilter && item.rs_norm.toLowerCase() !== rsFilter) {{
          return false;
        }}

        // Estab filter (independent)
        if (estFilter && item.estab.toLowerCase() !== estFilter) {{
          return false;
        }}

        // Domicilio filter (independent - search substring in address)
        if (domFilter && !item.domicilio.toLowerCase().includes(domFilter)) {{
          return false;
        }}

        // Mes filter (independent)
        if (mesFilter && item.mes !== mesFilter) {{
          return false;
        }}

        // Quick filter chips: Clearly differentiated
        if (activeQuickFilter === 'agua_apta' && item.agua_status !== 'apta') return false;
        if (activeQuickFilter === 'agua_no_apta' && item.agua_status !== 'no_apta') return false;
        if (activeQuickFilter === 'muestra_tomada' && item.agua_status !== 'muestra_tomada') return false;
        if (activeQuickFilter === 'sin_muestra' && item.agua_status !== 'sin_muestra') return false;
        if (activeQuickFilter === 'arsenico' && !item.has_arsenico) return false;
        if (activeQuickFilter === 'pat_conforme' && item.pat_status !== 'conforme') return false;
        if (activeQuickFilter === 'pat_no_medido' && item.pat_status !== 'no_medido') return false;
        if (activeQuickFilter === 'ruido' && !item.has_ruido_protocol) return false;

        // Global search across all fields
        if (searchGlobal) {{
          const fullBlob = (item.mes + ' ' + item.cuit + ' ' + item.rs_display + ' ' + item.estab + ' ' + item.domicilio + ' ' + item.agua + ' ' + item.pat + ' ' + item.iluminacion + ' ' + item.otras).toLowerCase();
          if (!fullBlob.includes(searchGlobal)) return false;
        }}

        return true;
      }});

      // Sort
      filtered.sort((a, b) => {{
        let valA = a[currentSortField] || '';
        let valB = b[currentSortField] || '';
        if (currentSortField === 'estab') {{
          valA = a.estab_num;
          valB = b.estab_num;
        }}
        if (valA < valB) return currentSortAsc ? -1 : 1;
        if (valA > valB) return currentSortAsc ? 1 : -1;
        return 0;
      }});

      updateKPIs(filtered);
      renderTable(filtered);
    }}

    // Quick filter chip selection
    function setQuickFilter(type) {{
      activeQuickFilter = type;
      document.querySelectorAll('.filter-chip').forEach(el => {{
        el.classList.toggle('active', el.getAttribute('data-filter') === type);
      }});
      applyFilters();
    }}

    // Reset All Filters
    function resetFilters() {{
      document.getElementById('filter-rs').value = '';
      document.getElementById('filter-est').value = '';
      document.getElementById('filter-dom').value = '';
      document.getElementById('filter-mes').value = '';
      document.getElementById('global-search').value = '';
      activeQuickFilter = 'all';
      document.querySelectorAll('.filter-chip').forEach(el => {{
        el.classList.toggle('active', el.getAttribute('data-filter') === 'all');
      }});
      applyFilters();
    }}

    // Render Table Rows
    function renderTable(data) {{
      const tbody = document.getElementById('table-body');
      tbody.innerHTML = '';

      if (data.length === 0) {{
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 1rem;">
          🔍 No se encontraron establecimientos que coincidan con los filtros seleccionados.
        </td></tr>`;
        return;
      }}

      data.forEach(r => {{
        const tr = document.createElement('tr');

        // Badges for Agua: Differentiated clearly
        let aguaBadge = '';
        if (r.agua_status === 'apta') {{
          aguaBadge = '<span class="badge badge-success">💧 APTA</span>';
        }} else if (r.agua_status === 'no_apta') {{
          aguaBadge = '<span class="badge badge-danger">🚫 NO APTA</span>';
        }} else if (r.agua_status === 'muestra_tomada') {{
          aguaBadge = '<span class="badge badge-warning">⏳ Muestra Tomada (Esperando Resultado)</span>';
        }} else {{
          aguaBadge = '<span class="badge badge-secondary">⚪ Sin Toma de Muestra</span>';
        }}

        if (r.has_arsenico) {{
          aguaBadge += ' <span class="badge badge-purple">⚠️ Arsénico</span>';
        }}

        // Badges for PAT
        let patBadge = '';
        if (r.pat_status === 'conforme') {{
          patBadge = '<span class="badge badge-success">⚡ Conforme</span>';
        }} else {{
          patBadge = '<span class="badge badge-warning">⚠️ Inaccesible</span>';
        }}

        // Badges for Ruido
        let ruidoBadge = '';
        if (r.has_ruido_protocol) {{
          ruidoBadge = '<span class="badge badge-purple">🔊 Res. 85/12</span> ';
        }}

        tr.innerHTML = `
          <td><span class="badge badge-month">${{r.mes}}</span></td>
          <td><span class="badge-cuit">${{r.cuit || 'S/D'}}</span></td>
          <td>
            <div class="cell-title">${{r.rs_norm}}</div>
            <div class="cell-sub">${{r.rs_display}}</div>
          </td>
          <td style="text-align: center;"><span class="badge-est">${{r.estab}}</span></td>
          <td>
            <div style="font-weight: 500; font-size: 0.85rem;">${{r.domicilio}}</div>
          </td>
          <td style="max-width: 290px;">
            <div style="margin-bottom: 0.35rem;">${{aguaBadge}}</div>
            <div style="font-size: 0.78rem; line-height: 1.35; color: #334155;">${{r.agua}}</div>
          </td>
          <td style="max-width: 210px;">
            <div style="margin-bottom: 0.25rem;">${{patBadge}}</div>
            <div style="font-size: 0.78rem; line-height: 1.35; color: #334155;">${{r.pat}}</div>
          </td>
          <td style="max-width: 210px;">
            <div style="font-size: 0.78rem; line-height: 1.35; color: #334155;">${{r.iluminacion}}</div>
          </td>
          <td style="max-width: 210px;">
            <div>${{ruidoBadge}}</div>
            <div style="font-size: 0.78rem; line-height: 1.35; color: #334155;">${{r.otras}}</div>
          </td>
          <td style="text-align: center; vertical-align: middle;">
            <button class="btn-detail" onclick="openModal(${{r.id}})">Ver Ficha</button>
          </td>
        `;

        tbody.appendChild(tr);
      }});
    }}

    // Sort Table
    function sortTable(field) {{
      if (currentSortField === field) {{
        currentSortAsc = !currentSortAsc;
      }} else {{
        currentSortField = field;
        currentSortAsc = true;
      }}
      applyFilters();
    }}

    // Modal Details
    function openModal(id) {{
      const item = RAW_DATA.find(d => d.id === id);
      if (!item) return;

      document.getElementById('modal-title').textContent = `${{item.rs_norm}} - Establecimiento N° ${{item.estab}} (${{item.mes}})`;
      
      const body = document.getElementById('modal-body');
      body.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div class="modal-field">
            <span class="modal-field-label">Mes / Carpeta</span>
            <span class="modal-field-value" style="font-weight: 700; color: var(--primary);">${{item.mes}}</span>
          </div>
          <div class="modal-field">
            <span class="modal-field-label">CUIT</span>
            <span class="modal-field-value" style="font-family: monospace;">${{item.cuit || 'S/D'}}</span>
          </div>
        </div>

        <div class="modal-field">
          <span class="modal-field-label">Razón Social Completa</span>
          <span class="modal-field-value" style="font-weight: 600;">${{item.rs_display}}</span>
        </div>

        <div class="modal-field">
          <span class="modal-field-label">Domicilio del Establecimiento</span>
          <span class="modal-field-value" style="font-weight: 600;">${{item.domicilio}}</span>
        </div>

        <div class="modal-field" style="border-left: 4px solid var(--accent);">
          <span class="modal-field-label">💧 Análisis de Calidad de Agua</span>
          <span class="modal-field-value">${{item.agua}}</span>
        </div>

        <div class="modal-field" style="border-left: 4px solid #f59e0b;">
          <span class="modal-field-label">⚡ Medición de Puesta a Tierra (P.A.T. - Res. 900/15)</span>
          <span class="modal-field-value">${{item.pat}}</span>
        </div>

        <div class="modal-field" style="border-left: 4px solid #10b981;">
          <span class="modal-field-label">💡 Medición de Niveles de Iluminación (Res. 84/12)</span>
          <span class="modal-field-value">${{item.iluminacion}}</span>
        </div>

        <div class="modal-field" style="border-left: 4px solid #8b5cf6;">
          <span class="modal-field-label">🔊 Otras Mediciones (Ruido, Carga Térmica, etc.)</span>
          <span class="modal-field-value">${{item.otras}}</span>
        </div>

        <div class="modal-field">
          <span class="modal-field-label">Documento Fuente</span>
          <span class="modal-field-value" style="font-size: 0.8rem; font-family: monospace; color: var(--text-muted);">${{item.filename}}</span>
        </div>
      `;

      document.getElementById('detail-modal').classList.add('active');
    }}

    function closeModal() {{
      document.getElementById('detail-modal').classList.remove('active');
    }}

    // Export to CSV
    function exportToCSV() {{
      const headers = ['Mes', 'CUIT', 'Razon Social', 'Nro Estab', 'Domicilio', 'Analisis de Agua', 'P.A.T.', 'Iluminacion', 'Otras Mediciones', 'Archivo'];
      const rows = [headers];

      const rsFilter = document.getElementById('filter-rs').value.toLowerCase();
      const estFilter = document.getElementById('filter-est').value.toLowerCase();
      const domFilter = document.getElementById('filter-dom').value.toLowerCase().trim();
      const mesFilter = document.getElementById('filter-mes').value;
      const searchGlobal = document.getElementById('global-search').value.toLowerCase().trim();

      const exportData = RAW_DATA.filter(item => {{
        if (rsFilter && item.rs_norm.toLowerCase() !== rsFilter) return false;
        if (estFilter && item.estab.toLowerCase() !== estFilter) return false;
        if (domFilter && !item.domicilio.toLowerCase().includes(domFilter)) return false;
        if (mesFilter && item.mes !== mesFilter) return false;
        if (activeQuickFilter === 'agua_apta' && item.agua_status !== 'apta') return false;
        if (activeQuickFilter === 'agua_no_apta' && item.agua_status !== 'no_apta') return false;
        if (activeQuickFilter === 'muestra_tomada' && item.agua_status !== 'muestra_tomada') return false;
        if (activeQuickFilter === 'sin_muestra' && item.agua_status !== 'sin_muestra') return false;
        if (activeQuickFilter === 'arsenico' && !item.has_arsenico) return false;
        if (activeQuickFilter === 'pat_conforme' && item.pat_status !== 'conforme') return false;
        if (activeQuickFilter === 'pat_no_medido' && item.pat_status !== 'no_medido') return false;
        if (activeQuickFilter === 'ruido' && !item.has_ruido_protocol) return false;
        if (searchGlobal) {{
          const fullBlob = (item.mes + ' ' + item.cuit + ' ' + item.rs_display + ' ' + item.estab + ' ' + item.domicilio + ' ' + item.agua + ' ' + item.pat + ' ' + item.iluminacion + ' ' + item.otras).toLowerCase();
          if (!fullBlob.includes(searchGlobal)) return false;
        }}
        return true;
      }});

      exportData.forEach(r => {{
        rows.push([
          `"${{r.mes}}"`,
          `"${{r.cuit}}"`,
          `"${{r.rs_norm.replace(/"/g, '""')}}"`,
          `"${{r.estab}}"`,
          `"${{r.domicilio.replace(/"/g, '""')}}"`,
          `"${{r.agua.replace(/"/g, '""').replace(/\\n/g, ' ')}}"`,
          `"${{r.pat.replace(/"/g, '""').replace(/\\n/g, ' ')}}"`,
          `"${{r.iluminacion.replace(/"/g, '""').replace(/\\n/g, ' ')}}"`,
          `"${{r.otras.replace(/"/g, '""').replace(/\\n/g, ' ')}}"`,
          `"${{r.filename}}"`
        ]);
      }});

      const csvContent = "\\uFEFF" + rows.map(e => e.join(';')).join('\\n');
      const blob = new Blob([csvContent], {{ type: 'text/csv;charset=utf-8;' }});
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Relevamiento_Mediciones_IAPSER_${{new Date().toISOString().slice(0,10)}}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }}

    // Run on startup
    window.addEventListener('DOMContentLoaded', initDropdowns);
  </script>
</body>
</html>
"""

output_path = r'c:\Users\cript\OneDrive\Escritorio\Antigravity\Informes IAPSER\tablero_mediciones_iapser.html'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html_template)

print(f"HTML dashboard updated with distinct water categories at: {output_path}")
