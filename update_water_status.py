import json, re

with open('all_months_final_clean.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for r in data:
    ag = r['agua']
    ag_lower = ag.lower()
    
    # If it says no se incluye sección, or remitido without conclusion
    if "no se incluye sección" in ag_lower or "no se incluye seccion" in ag_lower:
        r['agua'] = "PENDIENTE (No se adjunta protocolo ni sección de análisis de agua en este informe)."
    elif "remitid" in ag_lower or "se lleva a analizar" in ag_lower or "enviada a laboratorio" in ag_lower:
        if "no apta" not in ag_lower and "apta para consumo" not in ag_lower:
            r['agua'] = "PENDIENTE DE RESULTADO (Muestra extraída y remitida a laboratorio homologado; resultado pendiente de informe)."
    elif "pendiente" in ag_lower or "en proceso" in ag_lower:
        if "no apta" not in ag_lower and "apta para consumo" not in ag_lower:
            r['agua'] = "PENDIENTE (Análisis de agua en trámite / pendiente de incorporación)."

with open('all_months_final_clean.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated all_months_final_clean.json successfully.")
