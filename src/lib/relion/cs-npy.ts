/**
 * CryoFlow — numpy .npy structured-array reader (t336), PURE.
 *
 * CryoSPARC's `.cs` dataset files are `numpy.save`d structured arrays: a
 * plain-text Python-literal header (`{'descr': [('uid', '<i8'),
 * ('blob/path', '<U6'), …], 'fortran_order': False, 'shape': (N,), }`)
 * followed by N packed binary records. pyem reads them with numpy; this
 * module reads them without a Python anywhere — the conversion job then
 * runs inside the app (the cluster only needs to serve the bytes over
 * SSH, and the selective-link census runs before a single link is made).
 *
 * Supported descr entries (the CryoSPARC dialect):
 *   ('name', '<f8')            — scalar float64 / int / uint, LE or BE
 *   ('name', '<f4', (2,))      — subarray field (alignments3D/shift …),
 *                                 read flat, C order, shape rides along
 *   ('name', 'S80')            — null-padded bytes → utf8 string
 *   ('name', '<U80')           — utf32-le fixed width → string
 * Nested structured dtypes are refused (CryoSPARC never emits them; a
 * refusal is honest, a guess is not).
 */

/** One parsed descr entry. */
export interface NpyField {
  name: string;
  /** byte width of the WHOLE field (base × prod(shape)). */
  size: number;
  /** 'f' float, 'i' signed int, 'u' unsigned int, 'b' bool, 'S' bytes, 'U' unicode. */
  dtype: "f" | "i" | "u" | "b" | "S" | "U";
  /** element count: byte width for numbers, char count for strings. */
  elem: number;
  /** subarray shape ([] = scalar). */
  shape: number[];
  /** little-endian? (byte-order flag '<' vs '>'). */
  little: boolean;
  /** offset of the field inside one record. */
  offset: number;
}

/** A parsed .npy header + row geometry. */
export interface NpyTable {
  fields: NpyField[];
  rows: number;
  /** record width in bytes. */
  itemSize: number;
  /** offset of the first record inside the buffer. */
  dataOffset: number;
}

/*
 * Python-literal tokenizer for the header dict. The grammar numpy emits
 * is tiny: dict / list / tuple / int / float / True / False / None /
 * single-quoted strings (with backslash escapes).
 */

type PyVal = string | number | boolean | null | PyVal[] | { [k: string]: PyVal };

function parsePyLiteral(text: string): PyVal {
  let i = 0;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  const value = (): PyVal => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const out: { [k: string]: PyVal } = {};
      ws();
      if (text[i] === "}") {
        i++;
        return out;
      }
      for (;;) {
        const k = value();
        if (typeof k !== "string") throw new Error("npy header: non-string dict key");
        ws();
        if (text[i] !== ":") throw new Error("npy header: expected ':'");
        i++;
        out[k] = value();
        ws();
        if (text[i] === ",") {
          i++;
          ws();
          if (text[i] === "}") {
            i++;
            return out;
          }
          continue;
        }
        if (text[i] === "}") {
          i++;
          return out;
        }
        throw new Error("npy header: expected ',' or '}'");
      }
    }
    if (c === "(" || c === "[") {
      const close = c === "(" ? ")" : "]";
      i++;
      const out: PyVal[] = [];
      ws();
      if (text[i] === close) {
        i++;
        return out;
      }
      for (;;) {
        out.push(value());
        ws();
        if (text[i] === ",") {
          i++;
          ws();
          if (text[i] === close) {
            i++;
            return out;
          }
          continue;
        }
        if (text[i] === close) {
          i++;
          return out;
        }
        throw new Error("npy header: expected ',' or ')'");
      }
    }
    if (c === "'") {
      i++;
      let s = "";
      for (;;) {
        if (i >= text.length) throw new Error("npy header: unterminated string");
        const ch = text[i];
        if (ch === "\\") {
          i++;
          const esc = text[i];
          i++;
          s += esc === "n" ? "\n" : esc === "t" ? "\t" : esc === "'" ? "'" : esc === "\\" ? "\\" : esc;
          continue;
        }
        if (ch === "'") {
          i++;
          return s;
        }
        s += ch;
        i++;
      }
    }
    const m = /^(?:-?\d+\.?\d*(?:[eE][-+]?\d+)?|True|False|None)/.exec(text.slice(i));
    if (!m) throw new Error(`npy header: unexpected token at offset ${i}`);
    i += m[0].length;
    const tok = m[0];
    if (tok === "True") return true;
    if (tok === "False") return false;
    if (tok === "None") return null;
    return Number(tok);
  };
  const v = value();
  ws();
  if (i !== text.length) throw new Error("npy header: trailing garbage");
  return v;
}

/** Parse the .npy header; throws with a speaking message on anything else. */
export function parseNpyHeader(buf: Buffer): NpyTable {
  if (buf.length < 10) throw new Error("not an .npy file (shorter than the magic)");
  if (buf[0] !== 0x93 || buf.toString("latin1", 1, 6) !== "NUMPY") {
    throw new Error("not an .npy file (magic mismatch) — is this a CryoSPARC .cs?");
  }
  const major = buf[6];
  let headerLen: number;
  let headerAt: number;
  if (major <= 1) {
    headerLen = buf.readUInt16LE(8);
    headerAt = 10;
  } else {
    headerLen = buf.readUInt32LE(8);
    headerAt = 12;
  }
  if (headerAt + headerLen > buf.length) {
    throw new Error(`npy header truncated (need ${headerLen} bytes, have ${buf.length - headerAt})`);
  }
  // strip the trailing space/newline padding numpy aligns to 64 bytes
  let headerText = buf.toString("latin1", headerAt, headerAt + headerLen);
  headerText = headerText.replace(/[\s\x00]+$/, "");
  const header = parsePyLiteral(headerText);
  if (typeof header !== "object" || Array.isArray(header) || header === null) {
    throw new Error("npy header: not a dict");
  }
  const descr = header["descr"];
  const fortran = header["fortran_order"];
  const shape = header["shape"];
  if (!Array.isArray(descr)) throw new Error("npy header: descr is not a list");
  if (fortran === true) throw new Error("npy header: fortran-order records are not supported");
  if (!Array.isArray(shape) || shape.length !== 1 || typeof shape[0] !== "number") {
    throw new Error(`npy header: expected a 1-D record array, shape=${JSON.stringify(shape)}`);
  }

  const fields: NpyField[] = [];
  let offset = 0;
  for (const entry of descr) {
    if (!Array.isArray(entry) || (entry.length !== 2 && entry.length !== 3)) {
      throw new Error(`npy header: descr entry is not a (name, type[, shape]) tuple: ${JSON.stringify(entry)}`);
    }
    const name = entry[0];
    const typestr = entry[1];
    if (typeof name !== "string" || typeof typestr !== "string") {
      throw new Error("npy header: descr name/type not strings");
    }
    let shapeT: number[] = [];
    if (entry.length === 3) {
      const s = entry[2];
      if (!Array.isArray(s) || s.some((x) => typeof x !== "number")) {
        throw new Error(`npy header: bad subarray shape for '${name}'`);
      }
      shapeT = s as number[];
    }
    // typestr: [order]kind+size — 'S80'/'U80' carry no order char
    const m = /^([<>|=])?([biufSUV])(\d+)$/.exec(typestr);
    if (!m) throw new Error(`npy header: unsupported dtype '${typestr}' (field '${name}')`);
    const orderCh = m[1] ?? "|";
    const kindCh = m[2] as NpyField["dtype"];
    const n = Number(m[3]);
    let elem: number;
    if (kindCh === "f" || kindCh === "i" || kindCh === "u" || kindCh === "b") {
      // numbers carry BYTE width in the typestr ('f8' = 8 bytes)
      if (n !== 1 && n !== 2 && n !== 4 && n !== 8) {
        throw new Error(`npy header: unsupported numeric width ${n} (field '${name}')`);
      }
      elem = n;
    } else if (kindCh === "S" || kindCh === "U") {
      // strings carry CHARACTER count ('U80' = 80 chars)
      elem = n;
    } else {
      throw new Error(`npy header: unsupported dtype kind '${kindCh}' (field '${name}')`);
    }
    const little = orderCh !== ">";
    const prod = shapeT.reduce((a, b) => a * b, 1);
    const size =
      kindCh === "U" ? 4 * elem * prod : kindCh === "S" ? elem * prod : elem * prod;
    fields.push({ name, size, dtype: kindCh, elem, shape: shapeT, little, offset });
    offset += size;
  }
  return { fields, rows: shape[0] as number, itemSize: offset, dataOffset: headerAt + headerLen };
}

/* ------------------------------------------------------------------ */
/* Record reading                                                       */
/* ------------------------------------------------------------------ */

export type NpyValue = number | string | number[];

function readScalar(buf: Buffer, off: number, f: NpyField): number {
  switch (f.dtype) {
    case "f":
      return f.elem === 4
        ? f.little
          ? buf.readFloatLE(off)
          : buf.readFloatBE(off)
        : f.little
          ? buf.readDoubleLE(off)
          : buf.readDoubleBE(off);
    case "i":
      switch (f.elem) {
        case 1: return buf.readInt8(off);
        case 2: return f.little ? buf.readInt16LE(off) : buf.readInt16BE(off);
        case 4: return f.little ? buf.readInt32LE(off) : buf.readInt32BE(off);
        case 8: return f.little ? Number(buf.readBigInt64LE(off)) : Number(buf.readBigInt64BE(off));
      }
      break;
    case "u":
      switch (f.elem) {
        case 1: return buf.readUInt8(off);
        case 2: return f.little ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
        case 4: return f.little ? buf.readUInt32LE(off) : buf.readUInt32BE(off);
        case 8: return f.little ? Number(buf.readBigUInt64LE(off)) : Number(buf.readBigUInt64BE(off));
      }
      break;
    case "b":
      return buf[off] === 0 ? 0 : 1;
    case "S":
    case "U":
      break;
  }
  throw new Error(`npy reader: bad numeric field '${f.name}'`);
}

function readUtf32(buf: Buffer, off: number, chars: number): string {
  let s = "";
  for (let k = 0; k < chars; k++) {
    const cp = buf.readUInt32LE(off + 4 * k);
    if (cp === 0) break; // numpy null-pads short strings
    s += String.fromCodePoint(cp);
  }
  return s;
}

function readString(buf: Buffer, off: number, f: NpyField): string {
  if (f.dtype === "U") return readUtf32(buf, off, f.elem);
  return buf.toString("utf8", off, off + f.elem).replace(/\0+$/, "");
}

/**
 * Read row `i` as a name→value map. String fields are trimmed of their
 * NUL padding; subarray fields come back as flat number arrays (C order).
 */
export function npyRow(buf: Buffer, table: NpyTable, i: number): Record<string, NpyValue> {
  if (i < 0 || i >= table.rows) throw new Error(`npy row index ${i} out of 0..${table.rows - 1}`);
  const base = table.dataOffset + i * table.itemSize;
  const out: Record<string, NpyValue> = {};
  for (const f of table.fields) {
    const off = base + f.offset;
    if (f.dtype === "S" || f.dtype === "U") {
      if (f.shape.length !== 0) {
        throw new Error(`npy reader: string subarrays are not supported (field '${f.name}')`);
      }
      out[f.name] = readString(buf, off, f);
    } else if (f.shape.length === 0) {
      out[f.name] = readScalar(buf, off, f);
    } else {
      const count = f.shape.reduce((a, b) => a * b, 1);
      const arr: number[] = [];
      for (let k = 0; k < count; k++) arr.push(readScalar(buf, off + k * f.elem, f));
      out[f.name] = arr;
    }
  }
  return out;
}

/** All rows as maps (small .cs files; big ones stay behind the caller's cap). */
export function npyRows(buf: Buffer, table: NpyTable): Record<string, NpyValue>[] {
  const out: Record<string, NpyValue>[] = [];
  for (let i = 0; i < table.rows; i++) out.push(npyRow(buf, table, i));
  return out;
}
