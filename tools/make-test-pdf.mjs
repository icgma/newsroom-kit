// 生成一个含可提取文本的最小测试 PDF（供 scipdf 手动/自动测试用）
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const lines = [
  "Journal of Communication Research",
  "Vol. 12, No. 3",
  "Platform Labor and Worker Autonomy:",
  "Evidence from Food Delivery Riders",
  "Wei Zhang, Juan Li and Marco Rossi",
  "1 Peking University, 2 Fudan University",
  "Received 12 March 2023; published 15 July 2023",
  "Abstract: This study examines how algorithmic management",
  "shapes worker autonomy among food delivery riders.",
  "Keywords: platform labor; autonomy",
  "https://doi.org/10.1093/jcr/12.3.45-59",
];

let text = "BT /F1 20 Tf 72 760 Td 44 TL\n";
for (const s of lines) {
  const esc = s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  text += `(${esc}) Tj T*\n`;
}
text += "ET";

const objs = [];
objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objs[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
objs[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>";
objs[4] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
objs[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

let out = "%PDF-1.4\n";
const offsets = [];
for (let i = 1; i <= 5; i++) {
  offsets[i] = out.length;
  out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
}
const xref = out.length;
out += "xref\n0 6\n0000000000 65535 f \n";
for (let i = 1; i <= 5; i++) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
out += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

const file = process.argv[2] || join(tmpdir(), "test-paper.pdf");
writeFileSync(file, Buffer.from(out, "binary"));
console.log("PDF written:", file, out.length, "bytes");
