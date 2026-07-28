import crypto from "crypto";

export const MAX_SALES_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_SALES_IMPORT_ROWS = 25_000;
const aliases: Record<string, string> = {
  "global ultimate account name": "globalUltimateAccountName", "highest level account id (uaid)": "highestLevelAccountId",
  "account name": "accountName", "account id (uaid)": "accountId", "account type": "accountType", "market category": "marketCategory",
  "market segment": "marketSegment", "rate program code": "rateProgramCode", "rate program": "rateProgram", "booking office": "bookingOffice",
  "current room nights": "roomNights", "current room revenue": "roomRevenue", "current room adr": "roomAdr", "total current revenue": "totalRevenue",
  "total current adr": "totalAdr", "average los (ty)": "averageLos", fees: "fees", taxes: "taxes", "add ons": "addOns",
};
export function normalizeHeader(value: string) { return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); }
function clean(value: unknown) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function identifier(value: unknown) { const v = clean(value); return /^(?:0|-|n\/?a|null|undefined)?$/i.test(v) ? "" : v; }
function numberValue(value: unknown) { const v = clean(value).replace(/[$,%]/g, "").replace(/,/g, ""); if (!v) return 0; const n = Number(v); return Number.isFinite(n) ? n : null; }
function accountKey(row: any) {
  const highest = identifier(row.highestLevelAccountId); if (highest) return `highest:${highest.toLowerCase()}`;
  const account = identifier(row.accountId); if (account) return `account:${account.toLowerCase()}`;
  const global = clean(row.globalUltimateAccountName); if (global) return `global:${global.toLowerCase()}`;
  const name = clean(row.accountName); if (name) return `name:${name.toLowerCase()}`;
  return `fallback:${crypto.createHash("sha256").update([row.accountType,row.marketCategory,row.marketSegment,row.rateProgramCode].map(clean).join("|")).digest("hex")}`;
}
function parseDelimitedLine(line: string, delimiter: string) { const cells:string[]=[]; let cell="", quoted=false; for(let i=0;i<line.length;i++){const c=line[i]; if(c==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){cells.push(cell);cell="";}else cell+=c;} cells.push(cell); return cells; }
export function parseSalesImport(buffer: Buffer) {
  if (!buffer.length) throw new Error("The selected file is empty.");
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf || buffer[0] === 0x50 && buffer[1] === 0x4b) throw new Error("This is a binary Excel workbook. Export Analytical Account Tracking as tab-delimited text, CSV, TSV, or TXT.");
  if (buffer.includes(0)) throw new Error("This file appears to be binary and cannot be imported.");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, ""); const lines=text.split(/\r?\n/).filter((line)=>line.trim().length);
  if (lines.length < 2) throw new Error("The report has headers but no data rows.");
  const delimiter = (lines[0].match(/\t/g)||[]).length >= (lines[0].match(/,/g)||[]).length ? "\t" : ",";
  const rawHeaders=parseDelimitedLine(lines[0], delimiter).map((h)=>h.trim()); const mapped=rawHeaders.map((h)=>aliases[normalizeHeader(h)] || null);
  const found=new Set(mapped.filter(Boolean)); if ((!found.has("globalUltimateAccountName")&&!found.has("accountName"))||!found.has("roomNights")||!found.has("roomRevenue")) throw new Error("Required columns are missing. Include an account name, Current Room Nights, and Current Room Revenue.");
  if (lines.length-1 > MAX_SALES_IMPORT_ROWS) throw new Error(`The report exceeds the ${MAX_SALES_IMPORT_ROWS.toLocaleString()} row limit.`);
  const accepted:any[]=[], rejected:any[]=[], seen=new Set<string>(); let duplicateRowCount=0;
  lines.slice(1).forEach((line,index)=>{const cells=parseDelimitedLine(line,delimiter); const raw:Record<string,string>={}; const row:any={}; rawHeaders.forEach((h,i)=>{raw[h]=cells[i]??""; if(mapped[i]) row[mapped[i]!]=clean(cells[i]);}); const roomNights=numberValue(row.roomNights), roomRevenue=numberValue(row.roomRevenue); if(roomNights===null||roomRevenue===null){rejected.push({row:index+2,reason:"Invalid room nights or room revenue"});return;} if(!clean(row.globalUltimateAccountName)&&!clean(row.accountName)){rejected.push({row:index+2,reason:"Account name is blank"});return;} const normalizedRowHash=crypto.createHash("sha256").update(JSON.stringify(rawHeaders.map((h)=>raw[h]))).digest("hex"); if(seen.has(normalizedRowHash)){duplicateRowCount++;return;} seen.add(normalizedRowHash); const key=accountKey(row); accepted.push({...row,roomNights,roomRevenue,roomAdr:numberValue(row.roomAdr) ?? (roomNights>0?roomRevenue/roomNights:0),totalRevenue:numberValue(row.totalRevenue),totalAdr:numberValue(row.totalAdr),averageLos:numberValue(row.averageLos),fees:numberValue(row.fees),taxes:numberValue(row.taxes),addOns:numberValue(row.addOns),raw,sourceRowNumber:index+2,normalizedRowHash,normalizedAccountKey:key});});
  return { delimiter: delimiter==="\t"?"tab":"comma", rawHeaders, rowsFound:lines.length-1, accepted, rejected, duplicateRowCount, warnings:Object.keys(aliases).filter((h)=>!rawHeaders.some((r)=>normalizeHeader(r)===h)) };
}
export function recoveryPriority(revenue:number,nights:number,monthsSince:number,monthsProduced:number){ return Math.round(Math.log10(1+Math.max(0,revenue))*25 + Math.log10(1+Math.max(0,nights))*15 + Math.min(monthsSince,24)*2 + Math.min(monthsProduced,24)*3); }
