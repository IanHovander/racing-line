import { QRLIB } from '../vendor/qrlib';
export function qrSvg(text) {
  const q = new QRLIB.QRCode(-1, QRLIB.Level.M);
  q.addData(text);
  q.make();
  const n = q.getModuleCount(),
    m = 2;
  let p = '';
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (q.isDark(r, c)) p += `M${c + m},${r + m}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 2 * m} ${n + 2 * m}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${p}" fill="#000"/></svg>`;
}
