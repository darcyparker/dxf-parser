import { DXFSymbol } from './DxfParser.js';
import type { EntityName } from './entities/geometry';

export type GroupValue =
  | number
  | string //ie layer names
  | DXFSymbol
  | EntityName
  | boolean;

export type IGroup<T extends GroupValue> = {
  code: number;
  value: T;
};

//ltrim: Trims leading whitespace only
//Don't use trim() because trailing whitespace in some strings such as ltype patterns may be intended
export const ltrim = (str: string): string =>
  !str ? str : str.replace(/^\s+/g, '');

/**
 * Parse a value to its proper type.
 * See pages 3 - 10 of the AutoCad DXF 2012 reference given at the top of this file
 */
const parseGroupValue = (code: number, value: string): GroupValue => {
  if (
    code <= 9 ||
    (code >= 100 && code <= 109) ||
    (code >= 300 && code <= 369) ||
    (code >= 390 && code <= 399) ||
    (code >= 410 && code <= 419) ||
    (code >= 430 && code <= 439) ||
    (code >= 470 && code <= 481) ||
    code === 999 ||
    (code >= 1000 && code <= 1009)
  ) {
    return value;
  } else if (
    (code >= 10 && code <= 59) ||
    (code >= 110 && code <= 149) ||
    (code >= 210 && code <= 239) ||
    (code >= 460 && code <= 469) ||
    (code >= 1010 && code <= 1059)
  ) {
    return parseFloat(value);
  } else if (
    (code >= 60 && code <= 99) ||
    (code >= 160 && code <= 179) ||
    (code >= 270 && code <= 289) ||
    (code >= 370 && code <= 389) ||
    (code >= 400 && code <= 409) ||
    (code >= 420 && code <= 429) ||
    (code >= 440 && code <= 459) ||
    (code >= 1060 && code <= 1071)
  ) {
    return parseInt(value, 10);
  } else if (code >= 290 && code <= 299) {
    if (value === '0') return false;
    if (value === '1') return true;
    throw TypeError(
      `Code ${code}: String '${value}' cannot be cast to Boolean type`,
    );
  }

  console.warn(
    `WARNING: Group code does not have a defined type: code: ${code}, value: ${value}`,
  );
  return value;
};

//serializeFloat()
//@remarks integers such as `0`, `1`, ... are serialized as `0.0`, `1.0`, ...
export const serializeFloat = (value: number): string =>
  Number.isInteger(value) ? (value as number).toFixed(1) : `${value}`;

export const serializeGroupValue = function* (
  code: number,
  value: GroupValue,
): IterableIterator<string> {
  yield `${code}`;
  if (
    code <= 9 ||
    (code >= 100 && code <= 109) ||
    (code >= 300 && code <= 369) ||
    (code >= 390 && code <= 399) ||
    (code >= 410 && code <= 419) ||
    (code >= 430 && code <= 439) ||
    (code >= 470 && code <= 481) ||
    code === 999 ||
    (code >= 1000 && code <= 1009)
  ) {
    //Strings
    yield value as string;
  } else if (
    (code >= 10 && code <= 59) ||
    (code >= 110 && code <= 149) ||
    (code >= 210 && code <= 239) ||
    (code >= 460 && code <= 469) ||
    (code >= 1010 && code <= 1059)
  ) {
    //Floats
    //(integers such as `0`, `1`, ... should be `0.0`, `1.0`, ...)
    yield serializeFloat(value as number);
  } else if (code >= 290 && code <= 299) {
    //boolean
    yield value ? '1' : '0';
  } else if (
    (code >= 60 && code <= 99) ||
    (code >= 160 && code <= 179) ||
    (code >= 270 && code <= 289) ||
    (code >= 370 && code <= 389) ||
    (code >= 400 && code <= 409) ||
    (code >= 420 && code <= 429) ||
    (code >= 440 && code <= 459) ||
    (code >= 1060 && code <= 1071)
  ) {
    //integer (16, 32 or 64 bit)
    //(sometimes boolean are stored as integer)
    yield typeof value === 'boolean'
      ? value
        ? '1'
        : '0'
      : `${Number.isInteger(value) ? value : Math.round(value as number)}`;
  } else {
    console.warn(
      `WARNING: Group code does not have a defined type: code: ${code}, value: ${value}`,
    );
    yield `${value}`;
  }
};

/**
 * DxfArrayScanner
 *
 * Based off the AutoCad 2012 DXF Reference
 * http://images.autodesk.com/adsk/files/autocad_2012_pdf_dxf-reference_enu.pdf
 *
 * Reads through an array representing lines of a dxf file. Takes an array and
 * provides an easy interface to extract group code and value pairs.
 * @param data - an array where each element represents a line in the dxf file
 * @constructor
 */
export default class DxfArrayScanner {
  private _pointer = 0;
  private _eof = false;
  public lastReadGroup?: IGroup<GroupValue>;
  private _data: string[];
  constructor(data: string[]) {
    this._data = data;
  }

  /**
   * Gets the next group (code, value) from the array. A group is two consecutive elements
   * in the array. The first is the code, the second is the value.
   */
  public next<T extends GroupValue>(): IGroup<T> {
    if (!this.hasNext()) {
      if (!this._eof)
        throw new Error(
          `Unexpected end of input: ${DXFSymbol.EOF} group not read before end of file. Ended on code ` +
            this._data[this._pointer],
        );
      else
        throw new Error(
          `Cannot call 'next' after ${DXFSymbol.EOF} group has been read`,
        );
    }

    const code = parseInt(this._data[this._pointer]);
    this._pointer++;
    const value = parseGroupValue(code, ltrim(this._data[this._pointer])) as T;

    const group: IGroup<T> = { code, value };

    this._pointer++;

    if (code === 0 && value === DXFSymbol.EOF) this._eof = true;

    return (this.lastReadGroup = group);
  }

  public peek<T extends GroupValue>(): IGroup<T> {
    if (!this.hasNext()) {
      if (!this._eof)
        throw new Error(
          `Unexpected end of input: ${DXFSymbol.EOF} group not read before end of file. Ended on code ` +
            this._data[this._pointer],
        );
      else
        throw new Error(
          `Cannot call 'peek' after ${DXFSymbol.EOF} group has been read`,
        );
    }

    const code = parseInt(this._data[this._pointer]);
    const value = parseGroupValue(
      code,
      ltrim(this._data[this._pointer + 1]),
    ) as T;

    return { code, value };
  }

  public rewind(numberOfGroups = 1): void {
    this._pointer = this._pointer - numberOfGroups * 2;
  }

  /**
   * Returns true if there is another code/value pair (2 elements in the array).
   */
  public hasNext(): boolean {
    // Check if we have read EOF group code
    if (this._eof) {
      return false;
    }

    // We need to be sure there are two lines available
    if (this._pointer > this._data.length - 2) {
      return false;
    }
    return true;
  }

  /**
   * Returns true if the scanner is at the end of the array
   */
  public isEOF(): boolean {
    return this._eof;
  }
}
