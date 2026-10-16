import json, re, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('extracted_data.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

table_rows = []

for item in items:
    print(f"\n{'='*70}\n[{item['idx']}] FILE: {item['filename']}")
    
    # Text across all sections
    sections_text = '\n'.join([f"--- P.{s['page']} ({s['header']}) ---\n" + s['text'] for s in item['sections']])
    
    # 1. Clean RS
    rs = item['rs']
    rs = re.sub(r'^(?:de la empresa:\s*|PROPIETARIO:\s*)', '', rs, flags=re.IGNORECASE).strip()
    rs = re.sub(r'C\.?U\.?I\.?T\.?:.*$', '', rs, flags=re.IGNORECASE).strip()
    
    # 2. Clean Domicilio
    dom = item['domicilio']
    dom = re.sub(r'^(?:DOMICILIO:\s*|Dirección:\s*)', '', dom, flags=re.IGNORECASE).strip()
    
    # 3. PAT details
    pat_done = "Sí"
    pat_val = ""
    pat_conclusion = ""
    # Find ohm
    ohm_match = re.search(r'([0-9]+[,\.][0-9]+)\s*ohm', sections_text, re.IGNORECASE)
    if not ohm_match:
        ohm_match = re.search(r'([0-9]+)\s*ohm', sections_text, re.IGNORECASE)
    if ohm_match:
        pat_val = ohm_match.group(1).replace(',', '.') + " Ω"
    
    # PAT conclusion
    if "se considera adecuado" in sections_text or "parámetros adecuados" in sections_text or "condiciones seguras" in sections_text:
        pat_conclusion = "Adecuado / Conforme (condiciones seguras)"
    elif "no cumple" in sections_text.lower() or "inadecuado" in sections_text.lower():
        pat_conclusion = "No conforme"
    else:
        pat_conclusion = "Realizado (ver protocolo Res. SRT 900/15)"
        
    # 4. Iluminacion details
    ilu_done = "Sí"
    ilu_conclusion = ""
    # Check text around iluminacion
    if "por debajo de los valores mínimos" in sections_text or "no es completamente homogénea" in sections_text or "requiriéndose mejoras" in sections_text:
        ilu_conclusion = "Realizada (Res. SRT 84/12). Requiere mejoras / Sectores con valores por debajo del mínimo legal"
    elif "adecuad" in sections_text.lower():
        ilu_conclusion = "Realizada (Res. SRT 84/12). Valores adecuados"
    else:
        ilu_conclusion = "Realizada (Res. SRT 84/12)"
        
    # 5. Agua details
    agua_done = "Sí"
    agua_conclusion = ""
    # Check aptitud
    if "no resulta apta" in sections_text or "no cumple con las condiciones de potabilidad" in sections_text:
        # Check reasons
        reasons = []
        if "mesófilos" in sections_text:
            reasons.append("recuentos elevados de bacterias aerobias mesófilas")
        if "fisicoquímico no presenta valores fuera" in sections_text or "apta en términos fisicoquímicos" in sections_text:
            reasons.append("Fisicoquímico APTO")
        agua_conclusion = f"NO APTA para consumo humano ({'; '.join(reasons) if reasons else 'Bacteriológico no cumple'}). Requiere limpieza/desinfección de tanques"
    elif "apta para consumo" in sections_text:
        agua_conclusion = "APTA para consumo humano"
    elif "red de distribución" in sections_text or "proveída por red" in sections_text:
        agua_conclusion = "Agua de red / En proceso o apta"
    else:
        agua_conclusion = "Realizado análisis (ver protocolo Anexo 9)"
        
    # 6. Ruido / Otras mediciones
    otras_mediciones = ""
    if "No se detecta contaminación acústica" in sections_text:
        otras_mediciones = "Ruido: Relevado / No se detecta contaminación acústica"
    elif "medición de niveles de ruido" in sections_text.lower():
        otras_mediciones = "Ruido: Medición efectuada según Res. SRT 85/12"
    else:
        otras_mediciones = "No se registran otras mediciones específicas adicionales"
        
    row = {
        'mes': item['mes_carpeta'],
        'cuit': item['cuit'],
        'rs': rs,
        'estab': item['establecimiento'],
        'domicilio': dom,
        'pat_done': pat_done,
        'pat_val': pat_val,
        'pat_conclusion': pat_conclusion,
        'ilu_done': ilu_done,
        'ilu_conclusion': ilu_conclusion,
        'agua_done': agua_done,
        'agua_conclusion': agua_conclusion,
        'otras_mediciones': otras_mediciones,
        'filename': item['filename']
    }
    table_rows.append(row)
    
    print(f"RS: {rs}")
    print(f"Estab: {item['establecimiento']} | CUIT: {item['cuit']}")
    print(f"Domicilio: {dom}")
    print(f"PAT: {pat_val} - {pat_conclusion}")
    print(f"Iluminación: {ilu_conclusion}")
    print(f"Agua: {agua_conclusion}")
    print(f"Otras: {otras_mediciones}")

with open('table_data.json', 'w', encoding='utf-8') as f_out:
    json.dump(table_rows, f_out, ensure_ascii=False, indent=2)
