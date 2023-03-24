import log from 'loglevel';

import AUTO_CAD_COLOR_INDEX from './AutoCadColorIndex.js';
import type DxfArrayScanner from './DxfArrayScanner';
import type { IGroup, GroupValue } from './DxfArrayScanner';
import { serializeFloat, serializeGroupValue } from './DxfArrayScanner.js';
import type { ParseState } from './DxfParser';
import type { IEntity, IPoint } from './entities/geometry';
import type { IBlock } from './sections/blocks';

/**
 * Returns the truecolor value of the given AutoCad color index value
 * @return truecolor value as a number
 */
export const getAcadColor = (index: number): number =>
  AUTO_CAD_COLOR_INDEX[index];

export const groupIs = <T extends GroupValue>(
  group: IGroup<T>,
  code: number,
  value: T,
): boolean => group.code === code && group.value === value;

export const debugCode = ({ code, value }: IGroup<GroupValue>): string =>
  `${code}:${value}`;

export const logUnhandledGroup = (curr: IGroup<GroupValue>): void => {
  log.debug(`unhandled group ${debugCode(curr)}`);
};

export const ensureHandle = (
  parseState: ParseState,
  entity: IEntity | IBlock,
): void => {
  if (!entity) throw new TypeError('entity cannot be undefined or null');

  if (!entity.handle) entity.handle = parseState.lastHandle++;
};

/**
 * Parses the 2D or 3D coordinate, vector, or point. When complete,
 * the scanner remains on the last group of the coordinate.
 * @remarks this is different implementation than parsePoint in './sections/blocks.ts'
 */
export const parsePoint = (scanner: DxfArrayScanner): IPoint => {
  let curr = scanner.lastReadGroup as IGroup<number>;
  const point = {} as IPoint;
  let code = curr.code;

  point.x = curr.value as number;

  code += 10;
  curr = scanner.next();
  if (curr.code != code)
    throw new Error(
      'Expected code for point value to be ' +
        code +
        ' but got ' +
        curr.code +
        '.',
    );
  point.y = curr.value as number;

  code += 10;
  curr = scanner.next();
  if (curr.code != code) {
    // Only the x and y are specified. Don't read z.
    scanner.rewind(); // Let the calling code advance off the point
    return point;
  }
  point.z = curr.value as number;

  return point;
};

export const serializePoint = function* (
  { x, y, z }: IPoint,
  code: number,
): IterableIterator<string> {
  yield `${code}`;
  yield serializeFloat(x);

  yield `${code + 10}`;
  yield serializeFloat(y);

  if (z != null) {
    yield `${code + 20}`;
    yield serializeFloat(z);
  }
};

//Matrix4: A 4x4 matrix
export type Matrix4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * Parses 16 numbers as an array. When complete,
 * the scanner remains on the last group of the value.
 */
export const parseMatrix = (
  scanner: DxfArrayScanner,
  groupCode: number,
): Matrix4 => {
  // Reread group for the first coordinate
  scanner.rewind();
  const matrix = new Array(16) as Matrix4;

  for (let i = 0; i < 16; i++) {
    const curr = scanner.next();
    if (curr.code !== groupCode) {
      throw new Error(
        'Expected code for matrix value to be ' +
          groupCode +
          ' but got ' +
          curr.code +
          '.',
      );
    }

    matrix[i] = curr.value as number;
  }
  return matrix;
};

export const serializeMatrix = function* (
  matrix: Matrix4,
  code = 47,
): IterableIterator<string> {
  for (const n of matrix) {
    yield `${code}`;
    yield serializeFloat(n);
  }
};

//ValueType is how it is encoded in IEntityType or elsewhere in IDxf
//Some values are parsed as numbers, but encoded as a boolean or invertedBoolean
const enum ValueType {
  boolean = 1, //zero is false, non-zero is true
  invertBoolean = 2, //zero is true, non-zero is false
}

const encodeValue = (
  v: string | number | boolean,
  t?: ValueType,
): string | number | boolean =>
  typeof v === 'number'
    ? t === ValueType.boolean
      ? //zero is false, non-zero is true
        v !== 0
      : t === ValueType.invertBoolean
      ? //zero is true, non-zero is false
        v === 0
      : //number is unchanged
        v
    : //otherwise unchanged (string | boolean)
      v;

const commonEntityPropertyFromCode = new Map<
  number,
  [keyof IEntity, ValueType?]
>([
  [0, ['type']],
  [5, ['handle']],
  [6, ['lineType']],
  [8, ['layer']],
  [48, ['lineTypeScale']],
  [60, ['visible', ValueType.invertBoolean]],
  [62, ['colorIndex']],
  [66, ['entityFollows']],
  [67, ['inPaperSpace', ValueType.boolean]],
  [330, ['ownerHandle']],
  [347, ['materialObjectHandle']],
  [370, ['lineweight']],
  [420, ['color']],
]);

const codeAndTypeFromCommonEntityProperty = new Map<
  keyof IEntity,
  [number, ValueType?]
>(
  Array.from(commonEntityPropertyFromCode.entries()).map(
    ([code, [property, valueType]]) => [
      property,
      valueType ? [code, valueType] : [code],
    ],
  ),
);

//delete special cases that are are handled differently when serializing and parsing
codeAndTypeFromCommonEntityProperty.delete('color'); //420
commonEntityPropertyFromCode.delete(62); //colorIndex
codeAndTypeFromCommonEntityProperty.delete('handle');

/**
 * Attempts to parse codes common to all entities. Returns true if the group
 * was handled by this function.
 */
export const checkCommonEntityProperties = <T extends GroupValue>(
  entity: IEntity,
  { code, value }: IGroup<T>,
  scanner: DxfArrayScanner,
): void => {
  const commonEntityProperty = commonEntityPropertyFromCode.get(code);
  if (commonEntityProperty != null) {
    const [property, t] = commonEntityProperty;
    (entity[property] as GroupValue) = encodeValue(value, t);
  } else {
    //Special cases of setting properties
    switch (code) {
      case 62: // Acad Index Color. 0 inherits ByBlock. 256 inherits ByLayer. Default is bylayer
        entity.colorIndex = value as number;
        entity.color = getAcadColor(Math.abs(value as number));
        break;
      case 101: // Embedded Object in ACAD 2018.
        // See https://ezdxf.readthedocs.io/en/master/dxfinternals/dxftags.html#embedded-objects
        while (code != 0) {
          //eslint-disable-next-line no-param-reassign
          code = scanner.next().code;
        }
        scanner.rewind();
        break;
    }
  }
};

export const serializeCommonEntityProperty = function* <
  T extends IEntity,
  P extends keyof T,
>(property: P, value: T[P], entity: T): IterableIterator<string> {
  const codeAndType = codeAndTypeFromCommonEntityProperty.get(
    property as keyof IEntity,
  );
  if (codeAndType != null) {
    const [c, t] = codeAndType;
    if (t === ValueType.boolean) {
      yield `${c}`;
      //true is '1', and false is '0'
      yield value ? '1' : '0';
    } else if (t === ValueType.invertBoolean) {
      yield `${c}`;
      //true is '0', and false is '1'
      yield value ? '0' : '1';
    } else {
      yield* serializeGroupValue(c, value as string | boolean | number);
    }
  } else {
    //Special cases
    switch (property) {
      case 'handle':
        if (typeof value === 'string') {
          yield '5';
          yield value;
        }
        //otherwise 'handle' was not in original DXF and was added by `ensureHandle()` which created a number
        break;
      case 'color': // Acad Index Color. 0 inherits ByBlock. 256 inherits ByLayer. Default is bylayer
        if (entity.colorIndex == null) {
          yield '420';
          yield `${value}`; //integer
        }
        break;
    }
  }
};
