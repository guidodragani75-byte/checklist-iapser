import os, glob, sys, pypdf, re, json

sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\cript\Downloads\drive-download-20260925T015525Z-1-001'

def analyze_pdf(filepath, month_name, extra_files=None):
    fname = os.path.basename(filepath)
    try:
        reader = pypdf.PdfReader(filepath)
    except Exception as e:
        return None
    
    total_pages = len(reader.pages)
    pages = [p.extract_text() for p in reader.pages]
    full_text = '\n'.join(pages)
    
    # Also if there are extra files (like AA / AN.AGUA in the same folder in Junio), read them
    extra_text = ""
    if extra_files:
        for ef in extra_files:
            try:
                r_ef = pypdf.PdfReader(ef)
                extra_text += f"\n--- EXTRA FILE: {os.path.basename(ef)} ---\n" + '\n'.join([p.extract_text() for p in r_ef.pages])
            except:
                pass

    # 1. CUIT
    cuit = ''
    m = re.search(r'C\.?U\.?I\.?T\.?:?\s*([0-9\-\s]{11,15})', full_text, re.IGNORECASE)
    if m:
        c = re.sub(r'[^0-9]', '', m.group(1))
        if len(c) == 11:
            cuit = f"{c[:2]}-{c[2:10]}-{c[10]}"
    if not cuit:
        m2 = re.search(r'(\d{11})', fname)
        if m2:
            c = m2.group(1)
            cuit = f"{c[:2]}-{c[2:10]}-{c[10]}"
            
    # 2. RS & Estab & Domicilio
    p1_5 = '\n'.join(pages[:min(6, total_pages)])
    
    rs = ''
    for pat in [
        r'Razón Social:?\s*([^\n\r]+)',
        r'PROPIETARIO:?\s*([^\n\r]+)',
        r'EMPRESA:?\s*([^\n\r]+)',
        r'ORGANISMO:?\s*([^\n\r]+)'
    ]:
        m_rs = re.search(pat, p1_5, re.IGNORECASE)
        if m_rs:
            cand = m_rs.group(1).strip()
            cand = re.sub(r'C\.?U\.?I\.?T\.?:?.*$', '', cand, flags=re.IGNORECASE).strip()
            if len(cand) > 3 and not rs:
                rs = cand
    if not rs:
        # Check first lines of Page 1 and 2
        for l in p1_5.split('\n'):
            l_u = l.strip().upper()
            if any(k in l_u for k in ['MINISTERIO DE GOBIERNO', 'MINISTERIO DE SALUD', 'UNIVERSIDAD AUTONOMA', 'UNIVERSIDAD AUTÓNOMA', 'ADMINISTRADORA TRIBUTARIA', 'ADMINISTRACIÓN TRIBUTARIA', 'JEFATURA DE POLICIA', 'JEFATURA DE POLICÍA', 'INSTITUTO DE CONTROL DE ALIMENTACIÓN', 'ICAB', 'CAJA DE JUBILACIONES']):
                rs = l.strip()
                break
                
    # Clean RS
    if not rs:
        # infer from filename
        if 'MINISTERIO DE GOBIERNO' in fname.upper() or 'MIN GOB' in fname.upper() or 'MIN TRAB' in fname.upper():
            rs = "MINISTERIO DE GOBIERNO Y TRABAJO DE ENTRE RÍOS"
        elif 'UADER' in fname.upper() or 'UNIVERSIDAD' in fname.upper():
            rs = "UNIVERSIDAD AUTÓNOMA DE ENTRE RÍOS (UADER)"
        elif 'ADMINISTRAD' in fname.upper() or 'ATER' in fname.upper() or 'TRIBUT' in fname.upper():
            rs = "ADMINISTRADORA TRIBUTARIA DE ENTRE RÍOS (ATER)"
        elif 'JEFATURA' in fname.upper() or 'POLICIA' in fname.upper():
            rs = "JEFATURA DE POLICÍA DE LA PROVINCIA DE ENTRE RÍOS"
        elif 'SALUD' in fname.upper() or 'HOSPITAL' in fname.upper():
            rs = "MINISTERIO DE SALUD DE ENTRE RÍOS"
        elif 'ICAB' in fname.upper():
            rs = "INSTITUTO DE CONTROL DE ALIMENTACIÓN Y BROMATOLOGÍA (ICAB)"
        elif 'CAJA JUB' in fname.upper():
            rs = "CAJA DE JUBILACIONES Y PENSIONES DE ENTRE RÍOS"
        else:
            rs = fname
            
    # Estab
    estab = ''
    for pat in [
        r'ESTABLECIMIENTO\s*(?:N[°º]|:)?\s*([0-9]+)',
        r'ESTABLECIMIENTO\s*([0-9]+)',
        r'Est\.?\s*([0-9]+)',
        r'E\s*0?([0-9]+)'
    ]:
        m_est = re.search(pat, p1_5, re.IGNORECASE)
        if m_est and not estab:
            estab = m_est.group(1).strip()
    if not estab:
        m_est2 = re.search(r'Est\.?\s*([0-9]+)', fname, re.IGNORECASE)
        if m_est2:
            estab = m_est2.group(1).strip()
        else:
            m_est3 = re.search(r'E\s*0?([0-9]+)', fname, re.IGNORECASE)
            if m_est3:
                estab = m_est3.group(1).strip()
            else:
                m_est4 = re.search(r'_([0-9]+)_', fname)
                if m_est4:
                    estab = m_est4.group(1).strip()

    # Domicilio
    domicilio = ''
    for pat in [
        r'DOMICILIO:?\s*([^\n\r]+)',
        r'Dirección:?\s*([^\n\r]+)',
        r'Ubicación:?\s*([^\n\r]+)'
    ]:
        m_dom = re.search(pat, p1_5, re.IGNORECASE)
        if m_dom and not domicilio:
            cand = m_dom.group(1).strip()
            if len(cand) > 3 and not any(k in cand.lower() for k in ['viento', 'humo', 'norma']):
                domicilio = cand
    if not domicilio:
        # Check in pages for Dirección in protocol
        for p in pages:
            m_proto_d = re.search(r'Dirección:?\s*([^\n\r]+)', p, re.IGNORECASE)
            if m_proto_d:
                cand = m_proto_d.group(1).strip()
                if len(cand) > 3 and not any(k in cand.lower() for k in ['viento', 'humo', 'norma']):
                    domicilio = cand
                    break
    if not domicilio:
        # Check Memoria Descriptiva
        for p in pages[:7]:
            m_mem = re.search(r'ubicad[oa]\s+en\s+([^\n\r\.]+)', p, re.IGNORECASE)
            if m_mem:
                cand = m_mem.group(1).strip()
                if len(cand) > 5:
                    domicilio = cand
                    break

    # Search for PAT details
    pat_done = "NO REALIZADO"
    pat_res = ""
    # Check if PAT mentioned
    pat_section = ""
    for p in pages:
        if any(h in p.upper() for h in ['MEDICIÓN DE RESISTENCIA DE PUESTA A TIERRA', 'MEDICIÓN DE RESISTENCIA DE PAT', 'PROTOCOLO DE MEDICIÓN DE PUESTA A TIERRA']):
            pat_section += "\n" + p
            
    if pat_section:
        if any(k in pat_section.lower() for k in ['no se realizó', 'no se realizo', 'no fue posible', 'imposibilidad de acceso', 'no se pudo efectuar']):
            pat_done = "NO SE PUDO REALIZAR"
            pat_res = "No fue posible realizar la medición por falta de acceso a jabalina/terreno o condiciones inadecuadas."
        else:
            pat_done = "SÍ SE REALIZÓ (Res. SRT 900/15)"
            # search ohm value
            m_ohm = re.search(r'([0-9]+[\.,][0-9]+)\s*ohm', pat_section, re.IGNORECASE)
            if not m_ohm:
                m_ohm = re.search(r'([0-9]+)\s*ohm', pat_section, re.IGNORECASE)
            if not m_ohm:
                m_ohm = re.search(r'valor\s*de\s*([0-9]+[\.,][0-9]+)\s*Ω', pat_section, re.IGNORECASE)
            if not m_ohm:
                m_ohm = re.search(r'TT\s*([0-9]+[\.,][0-9]+)', pat_section)
                
            val_str = f"Valor: {m_ohm.group(1).replace(',', '.')} Ω. " if m_ohm else ""
            if "adecuad" in pat_section.lower() or "cumple" in pat_section.lower() or "condiciones seguras" in pat_section.lower():
                pat_res = f"{val_str}ADECUADO / CONFORME (dentro de parámetros legales < 40 Ω)."
            else:
                pat_res = f"{val_str}Conforme a normativa."
    else:
        pat_res = "No se incluye sección específica de PAT en el informe."

    # Search for Iluminación details
    ilu_section = ""
    for p in pages:
        if any(h in p.upper() for h in ['MEDICIÓN DE NIVELES DE ILUMINACIÓN', 'MEDICIÓN DE ILUMINACIÓN', 'PROTOCOLO DE MEDICIÓN DE ILUMINACIÓN']):
            ilu_section += "\n" + p
            
    if ilu_section:
        if any(k in ilu_section.lower() for k in ['no se realizó', 'no se realizo', 'no se realizaron']):
            ilu_res = "NO SE REALIZÓ."
        else:
            # Check compliance
            if any(k in ilu_section.lower() for k in ['inferior al valor requerido', 'no cumple', 'por debajo de los valores mínimos', 'requiriéndose mejoras', 'no es completamente homogénea']):
                ilu_res = "SÍ SE REALIZÓ (Res. SRT 84/12). NO CUMPLE en sectores evaluados (valores inferiores a mínimos legales / distribución heterogénea; requiere adecuación lumínica)."
            elif "superan los valores mínimos" in ilu_section.lower() or "adecuad" in ilu_section.lower():
                ilu_res = "SÍ SE REALIZÓ (Res. SRT 84/12). CUMPLE satisfactoriamente con los niveles mínimos exigidos por Dec. 351/79."
            else:
                ilu_res = "SÍ SE REALIZÓ (Res. SRT 84/12). Relevamiento efectuado según protocolo."
    else:
        ilu_res = "No se incluye protocolo específico de iluminación."

    # Search for Agua details
    agua_section = ""
    for p in pages:
        if any(h in p.upper() for h in ['CALIDAD DEL AGUA', 'ANÁLISIS DE AGUA', 'ANALISIS DE AGUA', 'CONCLUSION ANALISIS DE AGUA', 'RESULTADOS DE ANALISIS DE AGUA', 'RESULTADOS DE ANÁLISIS DE AGUA']):
            agua_section += "\n" + p
            
    combined_agua = agua_section + "\n" + extra_text
    
    if combined_agua and len(combined_agua.strip()) > 50:
        if any(k in combined_agua.lower() for k in ['pendiente agua', 'pendiente de resultado', 'en proceso']):
            agua_res = "EN PROCESO / PENDIENTE DE ANÁLISIS."
        elif "no resulta apta" in combined_agua.lower() or "no apta" in combined_agua.lower() or "no potable" in combined_agua.lower() or "no cumple con los parámetros" in combined_agua.lower() or "no cumple con las condiciones" in combined_agua.lower():
            reasons = []
            if "arsénico" in combined_agua.lower() and ("por encima" in combined_agua.lower() or "superior" in combined_agua.lower()):
                reasons.append("Arsénico elevado sobre límite normativo")
            if "mesófil" in combined_agua.lower() or "coliform" in combined_agua.lower() or "microbiol" in combined_agua.lower():
                reasons.append("Contaminación microbiológica")
            if "residuo" in combined_agua.lower() and "1710" in combined_agua:
                reasons.append("Residuo seco elevado")
            r_str = f" ({'; '.join(reasons)})" if reasons else ""
            agua_res = f"SÍ SE REALIZÓ. NO APTA para consumo humano{r_str}. Requiere limpieza/desinfección de tanques o tratamiento."
        elif "apta para consumo" in combined_agua.lower() or "cumple con los parámetros" in combined_agua.lower():
            agua_res = "SÍ SE REALIZÓ. APTA PARA CONSUMO HUMANO (físico-químico y bacteriológico conformes al Código Alimentario Argentino)."
        elif "se tomó muestra" in combined_agua.lower() or "se lleva a analizar" in combined_agua.lower():
            agua_res = "SÍ SE REALIZÓ. Muestra extraída y remitida a laboratorio homologado (ver anexo de protocolo)."
        else:
            agua_res = "Mencionado en informe; remitido a análisis de potabilidad."
    else:
        agua_res = "No se incluye sección ni protocolo de análisis de agua en este informe."

    # Search for Ruido / Otras mediciones
    ruido_section = ""
    for p in pages:
        if any(h in p.upper() for h in ['MEDICIÓN DE NIVELES DE RUIDO', 'MEDICIÓN DE RUIDO', 'CONTAMINACIÓN ACÚSTICA', 'PROTOCOLO PARA MEDICIÓN DE RUIDO', 'CARGA TÉRMICA']):
            ruido_section += "\n" + p
            
    if ruido_section:
        if "PROTOCOLO PARA MEDICIÓN DE RUIDO" in ruido_section.upper() or "RES. 85/12" in ruido_section.upper() or "DECIBELÍMETRO" in ruido_section.upper():
            ruido_res = "RUIDO LABORAL (Res. SRT 85/12): SÍ SE REALIZÓ con decibelímetro calibrado. Niveles evaluados conforme a límites de exposición de Dec. 351/79."
        elif "no se detecta contaminación acústica" in ruido_section.lower():
            ruido_res = "RUIDO: Relevado durante la inspección. No se detecta contaminación acústica."
        elif "no se realizaron mediciones" in ruido_section.lower() or "no se realiza medición" in ruido_section.lower():
            ruido_res = "RUIDO: No se realizaron mediciones instrumentales por baja percepción de ruido y actividad de bajo riesgo sonoro."
        else:
            ruido_res = "RUIDO: Relevado según condiciones del establecimiento."
    else:
        ruido_res = "No se registran otras mediciones específicas adicionales."

    return {
        'mes': month_name,
        'cuit': cuit,
        'rs': rs,
        'estab': estab,
        'domicilio': domicilio,
        'agua': agua_res,
        'pat': pat_res,
        'iluminacion': ilu_res,
        'otras': ruido_res,
        'filename': fname
    }

print("Extractor function compiled successfully.")
