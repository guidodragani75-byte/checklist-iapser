const fs = require('fs');
const path = require('path');

// Asegurar carpeta de distribución
if (!fs.existsSync('dist')) fs.mkdirSync('dist', { recursive: true });

// Leer componentes modulares desde src/
const srcDir = 'src';
const partialFiles = [
  '01_topbar_y_modales.html',
  '01b_directorio_sedes.html',
  '02_panel_lateral_tareas.html',
  '03_checklist_pags_1_a_5.html',
  '04_soporte_extintores.html',
  '05_plan_y_gantt_pags_6_a_10.html',
  '06_footer_scripts.html'
];

const parts = partialFiles.map(file => fs.readFileSync(path.join(srcDir, file), 'utf8'));

// 1. Compilar checklist_interactivo_v1.html (versión modular estándar)
const standardHtml = parts.join('\n');
fs.writeFileSync('checklist_interactivo_v1.html', standardHtml, 'utf8');
console.log('✅ Compilación exitosa: checklist_interactivo_v1.html');

// 2. Compilar versión autónoma e independiente para compartir (Single-File)
const css = fs.readFileSync('styles.css', 'utf8');
const preloaded = fs.readFileSync('datos_precargados.js', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');

let logoBase64 = '';
if (fs.existsSync('logo_header.png')) {
  logoBase64 = 'data:image/png;base64,' + fs.readFileSync('logo_header.png').toString('base64');
}

let standalone = parts.slice(0, -1).join('\n');

// Incrustar CSS directamente para que no dependa de styles.css
standalone = standalone.replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`);

// Incrustar logo en Base64 para que no dependa de la imagen externa
if (logoBase64) {
  standalone = standalone.split('src="logo_header.png"').join(`src="${logoBase64}"`);
}

// Incrustar datos precargados y lógica JS completa
standalone += `\n<datalist id="dl-sectores">\n</datalist>\n\n<script>\n${preloaded}\n\n${appJs}\n</script>\n</body>\n</html>\n`;

const distPath = path.join('dist', 'Checklist_IAPSER_HyS_Compartible.html');
fs.writeFileSync(distPath, standalone, 'utf8');
fs.writeFileSync('index.html', standalone, 'utf8');
const distStats = fs.statSync(distPath);
console.log(`✅ Archivo único para compartir generado: ${distPath} (${Math.round(distStats.size / 1024)} KB)`);
console.log(`✅ Archivo index.html generado en raíz para GitHub Pages`);
