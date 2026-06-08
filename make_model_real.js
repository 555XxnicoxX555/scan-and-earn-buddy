const ExcelJS = require('exceljs');
const path = require('path');

const out = path.join(process.cwd(), 'Sumi_Modelo_Financiero_Realista_ARS.xlsx');

const ARS_PER_USD = 1460;

const inputs = {
  implementationFee: 1200000,
  monthlyFee: 150000,
  extraQrFee: 45000,
  qrUnitsIncluded: 10,
  qrUnitCost: 32600,
  domainAnnual: 8500,
  hostingMonthly: 2700,
  salesCommissionRate: 0.15,
  developerMonthly: 1200000,
  designerMonthly: 500000,
  marketingAdminMonthly: 250000,
  toolsMonthly: 85000,
};

const sources = [
  ['Concepto', 'Valor usado', 'Fuente / criterio', 'URL'],
  ['Dolar BNA vendedor', ARS_PER_USD, 'Referencia usada para convertir ARS/USD al 7 de junio de 2026', 'https://dolarhistorico.com/dolar-banco-nacion/mes/junio-2026'],
  ['Dominio .com.ar', inputs.domainAnnual, 'NIC Argentina: alta y renovacion anual .com.ar', 'https://nic.ar/index.php/es/dominios/aranceles'],
  ['Cartel QR acrilico', inputs.qrUnitCost, 'PIAD Grafico: cartel QR acrilico 15x21 cm, precio final transferencia/efectivo', 'https://www.piadgrafico.com.ar/emprendimientos/cartel-qr-acrilico'],
  ['Hosting mensual', inputs.hostingMonthly, 'DonWeb: alojamiento web en Argentina desde $2.700/mes', 'https://donweb.com/es-ar/web-hosting'],
  ['Landing profesional', '200000 a 500000', 'Manivela: landing profesional a medida en Argentina 2026', 'https://manivela.com.ar/blog/cuanto-cuesta-landing-page-argentina-2026'],
  ['Desarrollo web / sistema', '500000 a 1500000+', 'Manivela: sitio con integraciones y desarrollos a medida superan una landing simple', 'https://manivela.com.ar/blog/cuanto-cuesta-landing-page-argentina-2026'],
];

const offerings = [
  ['Cobro al cliente', 'Incluye', 'Importe ARS', 'Importe USD ref.', 'Comentario comercial'],
  ['Implementacion inicial', 'Configuracion del local, menu digital, panel, sistema de puntos, 10 QR fisicos', inputs.implementationFee, inputs.implementationFee / ARS_PER_USD, 'Pago unico al iniciar'],
  ['Abono mensual', 'Hosting, soporte base, mantenimiento, estadisticas y continuidad del sistema', inputs.monthlyFee, inputs.monthlyFee / ARS_PER_USD, 'Ingreso recurrente por local activo'],
  ['QR adicional', 'Cartel QR extra para mesa, mostrador o sucursal', inputs.extraQrFee, inputs.extraQrFee / ARS_PER_USD, 'Upsell opcional'],
  ['Campania especial', 'Configuracion de promo, cumpleanos, referidos o accion puntual', 60000, 60000 / ARS_PER_USD, 'Servicio opcional'],
];

const costs = [
  ['Tipo', 'Concepto', 'ARS', 'USD ref.', 'Frecuencia', 'Tratamiento'],
  ['Variable inicial', 'QR acrilicos incluidos', inputs.qrUnitsIncluded * inputs.qrUnitCost, inputs.qrUnitsIncluded * inputs.qrUnitCost / ARS_PER_USD, 'Por local', 'Resta al margen de implementacion'],
  ['Variable inicial', 'Comision comercial 15%', inputs.implementationFee * inputs.salesCommissionRate, inputs.implementationFee * inputs.salesCommissionRate / ARS_PER_USD, 'Por local', 'Resta al margen de implementacion'],
  ['Variable recurrente', 'Dominio .com.ar anual', inputs.domainAnnual, inputs.domainAnnual / ARS_PER_USD, 'Anual por local', 'Se mensualiza'],
  ['Variable recurrente', 'Hosting mensual asignado', inputs.hostingMonthly, inputs.hostingMonthly / ARS_PER_USD, 'Mensual por local', 'Resta al margen mensual'],
  ['Fijo mensual', 'Desarrollo / soporte tecnico', inputs.developerMonthly, inputs.developerMonthly / ARS_PER_USD, 'Mensual', 'Costo fijo operativo'],
  ['Fijo mensual', 'Diseno / contenidos', inputs.designerMonthly, inputs.designerMonthly / ARS_PER_USD, 'Mensual', 'Costo fijo operativo'],
  ['Fijo mensual', 'Marketing / administracion', inputs.marketingAdminMonthly, inputs.marketingAdminMonthly / ARS_PER_USD, 'Mensual', 'Costo fijo operativo'],
  ['Fijo mensual', 'Herramientas software', inputs.toolsMonthly, inputs.toolsMonthly / ARS_PER_USD, 'Mensual', 'Costo fijo operativo'],
];

const fixedMonthly = inputs.developerMonthly + inputs.designerMonthly + inputs.marketingAdminMonthly + inputs.toolsMonthly;
const implementationVariable = inputs.qrUnitsIncluded * inputs.qrUnitCost + inputs.implementationFee * inputs.salesCommissionRate;
const implementationMargin = inputs.implementationFee - implementationVariable;
const monthlyVariable = inputs.hostingMonthly + inputs.domainAnnual / 12;
const monthlyMargin = inputs.monthlyFee - monthlyVariable;
const breakEvenClients = Math.ceil(fixedMonthly / monthlyMargin);

const scenarios = [
  { name: 'Conservador', newClients: [1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], description: 'Venta lenta, util para medir resistencia' },
  { name: 'Base', newClients: [2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4], description: 'Crecimiento razonable para prospeccion B2B local' },
  { name: 'Optimista', newClients: [4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6], description: 'Mayor traccion comercial y referidos' },
];

const loyaltyRows = [
  ['Variable', 'Supuesto', 'Impacto economico'],
  ['Regla de puntos', '10 puntos cada $1.000 consumidos', 'Facil de explicar al consumidor'],
  ['Recompensa base', 'Cafe chico gratis a 100 puntos', 'Costo bajo y valor percibido alto'],
  ['Costo recompensa estimado', '$900 a $1.500 por canje simple', 'Debe cubrirse con compra incremental'],
  ['Breakage', '25% de puntos no canjeados', 'Reduce costo efectivo del programa'],
  ['Uplift esperado', '+1 visita mensual en clientes frecuentes', 'Argumento de venta para el local'],
  ['Dato que se vende', 'Frecuencia, ticket, canjes, clientes activos', 'Convierte Sumi en herramienta de gestion'],
];

function money(num) {
  return Number(num.toFixed(2));
}

function styleSheet(ws, options = {}) {
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.getRow(1).height = 24;
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.header || 'FF0F766E' } };
  ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      cell.alignment = { vertical: 'top', wrapText: true };
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });
}

function setWidths(ws, widths) {
  widths.forEach((width, i) => {
    ws.getColumn(i + 1).width = width;
  });
}

function addRows(ws, rows) {
  rows.forEach((row) => ws.addRow(row));
}

function formatMoneyColumns(ws, cols) {
  cols.forEach((col) => {
    ws.getColumn(col).numFmt = '$#,##0';
  });
}

function formatUsdColumns(ws, cols) {
  cols.forEach((col) => {
    ws.getColumn(col).numFmt = 'US$ #,##0.00';
  });
}

function addProjection(workbook, scenario) {
  const ws = workbook.addWorksheet(`Proyeccion ${scenario.name}`);
  ws.addRow(['Mes', 'Nuevos locales', 'Locales activos', 'Margen implementacion', 'Margen mensual', 'Costos fijos', 'Ganancia mensual', 'Ganancia acumulada']);
  let total = 0;
  let accum = 0;
  scenario.newClients.forEach((newCount, i) => {
    total += newCount;
    const impl = newCount * implementationMargin;
    const rec = total * monthlyMargin;
    const profit = impl + rec - fixedMonthly;
    accum += profit;
    ws.addRow([i + 1, newCount, total, money(impl), money(rec), fixedMonthly, money(profit), money(accum)]);
  });
  setWidths(ws, [8, 16, 16, 22, 18, 16, 18, 22]);
  formatMoneyColumns(ws, [4, 5, 6, 7, 8]);
  styleSheet(ws, { header: 'FF155E75' });
  ws.getColumn(7).eachCell((cell, rowNumber) => {
    if (rowNumber > 1 && cell.value < 0) cell.font = { color: { argb: 'FFB91C1C' }, bold: true };
    if (rowNumber > 1 && cell.value >= 0) cell.font = { color: { argb: 'FF166534' }, bold: true };
  });
  return { name: scenario.name, finalClients: total, accum: money(accum), month12Profit: ws.getCell('G13').value };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sumi';
  workbook.created = new Date();
  workbook.modified = new Date();

  const dashboard = workbook.addWorksheet('Dashboard');
  dashboard.addRows([
    ['Sumi - Modelo financiero actualizado con precios reales'],
    ['Fecha de actualizacion', '2026-06-07'],
    ['Moneda principal', 'ARS'],
    ['Tipo de cambio ref.', ARS_PER_USD],
    [],
    ['Indicador', 'ARS', 'USD ref.', 'Lectura'],
    ['Cobro implementacion', inputs.implementationFee, inputs.implementationFee / ARS_PER_USD, 'Pago unico por local'],
    ['Abono mensual', inputs.monthlyFee, inputs.monthlyFee / ARS_PER_USD, 'Ingreso recurrente por local'],
    ['Margen implementacion', implementationMargin, implementationMargin / ARS_PER_USD, 'Despues de QR incluidos y comision'],
    ['Margen mensual por local', monthlyMargin, monthlyMargin / ARS_PER_USD, 'Despues de hosting y dominio mensualizado'],
    ['Costos fijos mensuales', fixedMonthly, fixedMonthly / ARS_PER_USD, 'Equipo, marketing y herramientas'],
    ['Punto de equilibrio recurrente', breakEvenClients, '', 'Locales activos necesarios sin nuevas implementaciones'],
  ]);
  dashboard.mergeCells('A1:D1');
  dashboard.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  dashboard.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  dashboard.getCell('A1').alignment = { horizontal: 'center' };
  setWidths(dashboard, [30, 18, 16, 55]);
  formatMoneyColumns(dashboard, [2]);
  formatUsdColumns(dashboard, [3]);
  styleSheet(dashboard, { header: 'FF0F766E' });

  const pricing = workbook.addWorksheet('Cobros al cliente');
  addRows(pricing, offerings);
  setWidths(pricing, [24, 62, 16, 16, 42]);
  formatMoneyColumns(pricing, [3]);
  formatUsdColumns(pricing, [4]);
  styleSheet(pricing, { header: 'FF7C2D12' });

  const wsCosts = workbook.addWorksheet('Costos reales');
  addRows(wsCosts, costs);
  setWidths(wsCosts, [20, 30, 16, 16, 18, 42]);
  formatMoneyColumns(wsCosts, [3]);
  formatUsdColumns(wsCosts, [4]);
  styleSheet(wsCosts, { header: 'FF334155' });

  const projectionResults = scenarios.map((scenario) => addProjection(workbook, scenario));

  const wsScenarios = workbook.addWorksheet('Escenarios');
  wsScenarios.addRow(['Escenario', 'Clientes al mes 12', 'Ganancia acumulada ARS', 'Ganancia acumulada USD ref.', 'Lectura']);
  projectionResults.forEach((result, i) => {
    wsScenarios.addRow([
      result.name,
      result.finalClients,
      result.accum,
      result.accum / ARS_PER_USD,
      scenarios[i].description,
    ]);
  });
  setWidths(wsScenarios, [18, 18, 24, 24, 55]);
  formatMoneyColumns(wsScenarios, [3]);
  formatUsdColumns(wsScenarios, [4]);
  styleSheet(wsScenarios, { header: 'FF7E22CE' });

  const wsLoyalty = workbook.addWorksheet('Fidelizacion');
  addRows(wsLoyalty, loyaltyRows);
  setWidths(wsLoyalty, [26, 38, 62]);
  styleSheet(wsLoyalty, { header: 'FF2563EB' });

  const wsSources = workbook.addWorksheet('Fuentes');
  addRows(wsSources, sources);
  setWidths(wsSources, [26, 18, 70, 80]);
  styleSheet(wsSources, { header: 'FF1F2937' });

  workbook.eachSheet((ws) => {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columnCount },
    };
  });

  await workbook.xlsx.writeFile(out);
  console.log(out);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
