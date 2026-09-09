import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { posix } from "node:path";

export type XlsxValue = string | number;
export interface XlsxSheet {
  name: string;
  rows: Map<number, Map<number, XlsxValue>>;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false,
  isArray: (name) => ["sheet", "Relationship", "si", "r", "row", "c"].includes(name),
});

function textValue(value: any): string {
  if (typeof value === "string") return value;
  if (value?.["#text"] !== undefined) return String(value["#text"]);
  if (value?.t !== undefined) return textValue(value.t);
  if (Array.isArray(value?.r)) return value.r.map(textValue).join("");
  return "";
}

function columnIndex(address: string): number {
  const match = /^([A-Z]+)[1-9]\d*$/.exec(address);
  if (!match) throw new Error(`Invalid XLSX cell address: ${address}`);
  return [...match[1]].reduce((column, char) => column * 26 + char.charCodeAt(0) - 64, 0);
}

/** Read cached operator-published values, never evaluate workbook formulas. */
export function readXlsxValues(bytes: Uint8Array): XlsxSheet[] {
  const archive = unzipSync(bytes, {
    filter: (entry) => {
      const needed = /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(entry.name);
      if (needed && entry.originalSize > 20 * 1024 * 1024) throw new Error("XLSX entry exceeds size limit");
      return needed;
    },
  });
  const read = (name: string) => {
    if (!archive[name]) throw new Error(`XLSX is missing ${name}`);
    return xml.parse(new TextDecoder().decode(archive[name]));
  };
  const workbook = read("xl/workbook.xml").workbook;
  if (workbook?.workbookPr?.["@_date1904"] === "1") throw new Error("Unsupported XLSX date system");
  const relationships = read("xl/_rels/workbook.xml.rels").Relationships?.Relationship ?? [];
  const shared = archive["xl/sharedStrings.xml"]
    ? (read("xl/sharedStrings.xml").sst?.si ?? []).map(textValue)
    : [];
  const sheets = (workbook?.sheets?.sheet ?? []).map((sheet: any): XlsxSheet => {
    const relation = relationships.find((entry: any) => entry["@_Id"] === sheet["@_r:id"]);
    const target = relation?.["@_Target"];
    if (typeof target !== "string" || relation?.["@_TargetMode"] === "External") {
      throw new Error("XLSX has an invalid worksheet relationship");
    }
    const path = target.startsWith("/") ? target.slice(1) : posix.normalize(`xl/${target}`);
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path)) throw new Error("Unsupported XLSX worksheet path");
    const rows = new Map<number, Map<number, XlsxValue>>();
    for (const row of read(path).worksheet?.sheetData?.row ?? []) {
      const values = new Map<number, XlsxValue>();
      for (const cell of row.c ?? []) {
        const column = columnIndex(cell["@_r"]);
        if (cell["@_t"] === "inlineStr") {
          values.set(column, textValue(cell.is));
        } else if (cell.v !== undefined && cell.v !== "") {
          if (cell["@_t"] === "s") {
            const value = shared[Number(cell.v)];
            if (value === undefined) throw new Error("Invalid XLSX shared string reference");
            values.set(column, value);
          } else if (cell["@_t"] === "str") {
            values.set(column, String(cell.v));
          } else if (cell["@_t"] === "e" || !Number.isFinite(Number(cell.v))) {
            throw new Error(`Invalid XLSX value at ${sheet["@_name"]}!${cell["@_r"]}`);
          } else {
            values.set(column, Number(cell.v));
          }
        } else if (cell.f !== undefined) {
          throw new Error(`Uncached XLSX formula at ${sheet["@_name"]}!${cell["@_r"]}`);
        }
      }
      rows.set(Number(row["@_r"]), values);
    }
    return { name: String(sheet["@_name"]), rows };
  });
  if (sheets.length === 0) throw new Error("XLSX contains no worksheets");
  return sheets;
}
