const XLSX = require('xlsx');
const path = require('path');

const out = path.join(process.cwd(), 'Sumi_Modelo_Financiero_Revisado.xlsx');
const wb = XLSX.utils.book_new();

const assumptions = [
  ['Supuesto', 'Valor', 'Unidad', 'Nota'],
  ['Tipo de cambio', 1437, 'ARS/USD', 'Usado en archivo original'],
  ['Precio implementacion', 800, 'USD/local', 'Pago unico por local'],
  ['Mantenimiento mensual', 100, 'USD/local/mes', 'Ingreso recurrente'],
  ['Acrilicos QR', 139.18, 'USD/local', 'Costo inicial'],
  ['Comision vendedor', 120, 'USD/local', 'Costo inicial de venta'],
  ['Dominio anual', 4, 'USD/local/año', 'Se mensualiza en margen recurrente'],
  ['Hosting mensual', 0.06, 'USD/local/mes', 'Costo recurrente'],
  ['Desarrollador', 800, 'USD/mes', 'Costo fijo'],
  ['Disenador', 500, 'USD/mes', 'Costo fijo'],
  ['Marketing / administracion', 150, 'USD/mes', 'Costo fijo'],
  ['Herramientas software', 45, 'USD/mes', 'Costo fijo'],
];
const wsAss = XLSX.utils.aoa_to_sheet(assumptions);
wsAss['!cols'] = [{wch:28},{wch:14},{wch:16},{wch:45}];
XLSX.utils.book_append_sheet(wb, wsAss, 'Supuestos');

const summary = [
  ['Metrica', 'Formula / criterio', 'USD', 'ARS'],
  ['Margen implementacion', 'Precio implementacion - acrilicos - comision', {f:'Supuestos!B3-Supuestos!B5-Supuestos!B6', v:540.82}, {f:'C2*Supuestos!B2', v:777160.34}],
  ['Margen recurrente mensual', 'Mantenimiento - hosting - dominio/12', {f:'Supuestos!B4-Supuestos!B8-Supuestos!B7/12', v:99.6066666667}, {f:'C3*Supuestos!B2', v:143134.78}],
  ['Costos fijos mensuales', 'Suma costos fijos', {f:'SUM(Supuestos!B9:B12)', v:1495}, {f:'C4*Supuestos!B2', v:2148315}],
  ['Punto equilibrio recurrente', 'Clientes activos necesarios sin contar nuevas implementaciones', {f:'ROUNDUP(C4/C3,0)', v:16}, 'clientes'],
  ['Ganancia acumulada base 12 meses', 'Escenario base', {f:"'Proyeccion Base'!G13", v:37360.54}, {f:'C6*Supuestos!B2', v:53682971.79}],
];
const wsSummary = XLSX.utils.aoa_to_sheet(summary);
wsSummary['!cols'] = [{wch:30},{wch:55},{wch:16},{wch:18}];
XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

const costs = [
  ['Tipo', 'Concepto', 'USD', 'Frecuencia', 'Tratamiento'],
  ['Variable inicial', 'Acrilicos QR', 139.18, 'Por local', 'Resta al margen de implementacion'],
  ['Variable inicial', 'Comision vendedor', 120, 'Por local', 'Resta al margen de implementacion'],
  ['Variable recurrente', 'Dominio anual', 4, 'Anual por local', 'Mensualizado en margen recurrente'],
  ['Variable recurrente', 'Hosting mensual', 0.06, 'Mensual por local', 'Resta al margen recurrente'],
  ['Fijo mensual', 'Desarrollador', 800, 'Mensual', 'Costo fijo'],
  ['Fijo mensual', 'Disenador', 500, 'Mensual', 'Costo fijo'],
  ['Fijo mensual', 'Marketing / administracion', 150, 'Mensual', 'Costo fijo'],
  ['Fijo mensual', 'Herramientas software', 45, 'Mensual', 'Costo fijo'],
];
const wsCosts = XLSX.utils.aoa_to_sheet(costs);
wsCosts['!cols'] = [{wch:20},{wch:28},{wch:12},{wch:18},{wch:38}];
XLSX.utils.book_append_sheet(wb, wsCosts, 'Costos');

function addProjectionSheet(name, newClients) {
  const rows = [['Mes','Nuevos clientes','Clientes totales','Margen implementacion','Margen recurrente','Ganancia mensual','Ganancia acumulada']];
  let total = 0, accum = 0;
  for (let i=0;i<12;i++) {
    const month = i+1;
    total += newClients[i];
    const impl = newClients[i] * 540.82;
    const recurring = total * 99.6066666667;
    const profit = impl + recurring - 1495;
    accum += profit;
    const r = i+2;
    rows.push([
      month,
      newClients[i],
      {f: r===2 ? `B${r}` : `C${r-1}+B${r}`, v: total},
      {f:`B${r}*Resumen!C2`, v: impl},
      {f:`C${r}*Resumen!C3`, v: recurring},
      {f:`D${r}+E${r}-Resumen!C4`, v: profit},
      {f: r===2 ? `F${r}` : `G${r-1}+F${r}`, v: accum},
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:8},{wch:18},{wch:18},{wch:22},{wch:20},{wch:18},{wch:22}];
  XLSX.utils.book_append_sheet(wb, ws, name);
  return {finalClients: total, accum};
}
const conservative = addProjectionSheet('Proyeccion Conservadora', [2,2,2,2,2,2,2,2,2,2,2,2]);
const base = addProjectionSheet('Proyeccion Base', [3,4,4,4,4,4,4,4,4,4,4,4]);
const optimistic = addProjectionSheet('Proyeccion Optimista', [5,6,6,6,6,6,6,6,6,6,6,6]);

const scenarios = [
  ['Escenario','Nuevos clientes/mes','Clientes al mes 12','Ganancia acumulada USD','Lectura'],
  ['Conservador','2 constantes', conservative.finalClients, conservative.accum, 'Valida si el proyecto resiste menor captacion'],
  ['Base','3 primer mes, luego 4', base.finalClients, base.accum, 'Replica el archivo original con punto de equilibrio aclarado'],
  ['Optimista','5 primer mes, luego 6', optimistic.finalClients, optimistic.accum, 'Muestra escalabilidad comercial'],
];
const wsSc = XLSX.utils.aoa_to_sheet(scenarios);
wsSc['!cols'] = [{wch:18},{wch:24},{wch:18},{wch:24},{wch:50}];
XLSX.utils.book_append_sheet(wb, wsSc, 'Escenarios');

const loyalty = [
  ['Variable fidelizacion', 'Supuesto sugerido', 'Uso en defensa oral'],
  ['Objetivo del sistema', 'Aumentar frecuencia de compra y recompra', 'Sumi no regala productos al azar: incentiva retorno medible'],
  ['Costo de recompensa', 'Debe ser menor al margen incremental generado', 'Evita que el programa destruya rentabilidad'],
  ['Datos clave', 'Frecuencia, ticket promedio, clientes activos, canjes', 'Permite vender valor al local'],
  ['Canjes recomendados', 'Beneficios de bajo costo percibido alto', 'Cafe, descuentos controlados, combos en horarios valle'],
];
const wsL = XLSX.utils.aoa_to_sheet(loyalty);
wsL['!cols'] = [{wch:24},{wch:42},{wch:55}];
XLSX.utils.book_append_sheet(wb, wsL, 'Fidelizacion');

XLSX.writeFile(wb, out, { bookType:'xlsx', cellStyles:true });
console.log(out);
