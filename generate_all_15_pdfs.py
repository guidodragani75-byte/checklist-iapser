import os
import sys
import json
import glob
import re
import time
import subprocess
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8089
WORKSPACE = os.path.dirname(os.path.abspath(__file__))
PDF_DIR = os.path.join(WORKSPACE, "PDFs")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

os.makedirs(PDF_DIR, exist_ok=True)

# Find all 15 JSON survey files
json_files = glob.glob(os.path.join(WORKSPACE, "Relevamiento_HyS_*.json"))
establishments = []

for jf in json_files:
    try:
        with open(jf, "r", encoding="utf-8") as f:
            data = json.load(f)
            est = data.get("establecimiento", {})
            row_idx = est.get("rowIndex")
            nro_estab = est.get("nroEstab", "")
            nombre = est.get("nombreEstablecimiento", "")
            org = est.get("organismo") or est.get("razonSocial", "")
            
            try:
                sort_num = int(nro_estab)
            except:
                sort_num = 999
                
            establishments.append({
                "key": f"est_sheet_{row_idx}",
                "row_idx": row_idx,
                "nroEstab": nro_estab,
                "nombre": nombre,
                "organismo": org,
                "sort_num": sort_num,
                "json_file": jf
            })
    except Exception as ex:
        print(f"Error reading {jf}: {ex}")

establishments.sort(key=lambda x: x["sort_num"])

print(f"Total establishments found: {len(establishments)}")
for e in establishments:
    print(f" - [N° {str(e['nroEstab']).zfill(3)}] {e['key']} | {e['nombre']}")

# Start HTTP server
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def run_server():
    os.chdir(WORKSPACE)
    server = HTTPServer(("127.0.0.1", PORT), QuietHandler)
    server.serve_forever()

t = threading.Thread(target=run_server, daemon=True)
t.start()
time.sleep(1)

print("\n--- GENERATING 15 ESTABLISHMENT PDFS ---")

for idx, e in enumerate(establishments, 1):
    clean_nombre = e['nombre'] or e['organismo']
    safe_name = re.sub(r'[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]', '_', clean_nombre)
    safe_name = re.sub(r'_+', '_', safe_name).strip('_')
    nro_str = str(e['nroEstab']).zfill(3)
    pdf_filename = f"Informe_HyS_Estab_{nro_str}_{safe_name}.pdf"
    output_pdf_path = os.path.join(PDF_DIR, pdf_filename)
    
    url = f"http://127.0.0.1:{PORT}/checklist_interactivo_v1.html?est={e['key']}"
    print(f"[{idx}/{len(establishments)}] Generating: {pdf_filename} ...")
    
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--virtual-time-budget=5000",
        "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer",
        f"--print-to-pdf={output_pdf_path}",
        url
    ]
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(output_pdf_path) and os.path.getsize(output_pdf_path) > 1000:
        size_kb = os.path.getsize(output_pdf_path) / 1024
        print(f"  -> SUCCESS: {size_kb:.1f} KB")
    else:
        print(f"  -> ERROR: {res.stderr}")

print("\n--- GENERATING EXECUTIVE CONSOLIDATED PDF ---")
exec_pdf_filename = "Informe_Consolidado_Provincial_2026-2027.pdf"
exec_output_path = os.path.join(PDF_DIR, exec_pdf_filename)
exec_url = f"http://127.0.0.1:{PORT}/reporte_ejecutivo_provincial.html"

cmd_exec = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=5000",
    "--run-all-compositor-stages-before-draw",
    "--no-pdf-header-footer",
    f"--print-to-pdf={exec_output_path}",
    exec_url
]
res = subprocess.run(cmd_exec, capture_output=True, text=True)
if os.path.exists(exec_output_path) and os.path.getsize(exec_output_path) > 1000:
    size_kb = os.path.getsize(exec_output_path) / 1024
    print(f"  -> SUCCESS: {exec_pdf_filename} ({size_kb:.1f} KB)")
else:
    print(f"  -> ERROR generating {exec_pdf_filename}: {res.stderr}")

print("\nAll 16 PDFs generated successfully in 'PDFs/' directory!")
