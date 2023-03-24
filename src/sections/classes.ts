import log from 'loglevel';
import type DxfArrayScanner from '../DxfArrayScanner';
import type { IGroup, GroupValue } from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import { DXFSymbol } from '../DxfParser.js';
import { groupIs, logUnhandledGroup } from '../ParseHelpers.js';

type IClass = {
  recordName: string;
  name: string;
  applicationName: string;
  proxyFlags: number;
  instanceCount: number;
  wasAProxyFlag: boolean;
  isAnEntityFlag: boolean;
};
export type IClasses = Record<string, IClass>;

const classPropertyFromCode = new Map<number, keyof IClass>([
  [1, 'recordName'],
  [2, 'name'],
  [3, 'applicationName'],
  [90, 'proxyFlags'],
  [91, 'instanceCount'],
  [280, 'wasAProxyFlag'],
  [281, 'isAnEntityFlag'],
]);

const codeFromClassProperty = new Map<keyof IClass, number>(
  Array.from(classPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);
//delete special cases that are are handled differently when serializing and parsing

const parseClass = (scanner: DxfArrayScanner): IClass => {
  const c = {} as IClass;
  let curr = scanner.next();
  while (curr.value !== DXFSymbol.EOF) {
    const property = classPropertyFromCode.get(curr.code);
    if (property != null) {
      (c[property] as number | string | boolean) = curr.value;
    }
    curr = scanner.next();
    if (
      groupIs(curr, 0, DXFSymbol.Class) ||
      groupIs(curr, 0, DXFSymbol.EndSec)
    ) {
      break;
    }
  }
  return c;
};

export const serializeClass = function* (c: IClass): IterableIterator<string> {
  //start of class
  yield '0';
  yield DXFSymbol.Class;
  for (const [property, value] of Object.entries(c) as [
    keyof IClass,
    IClass[keyof IClass],
  ][]) {
    const code = codeFromClassProperty.get(property);
    if (code != null) {
      yield* serializeGroupValue(code, value as GroupValue);
    }
  }

  //end of class
};

export const parseClasses = (scanner: DxfArrayScanner): IClasses => {
  const classes: IClasses = {};

  let curr = scanner.next();

  while (curr.value !== DXFSymbol.EOF) {
    if (groupIs(curr, 0, DXFSymbol.EndSec)) {
      break;
    }

    if (groupIs(curr, 0, DXFSymbol.Class)) {
      log.debug('class {');
      const c = parseClass(scanner);
      curr = scanner.lastReadGroup as IGroup<GroupValue>;
      log.debug('}');
      if (!c.recordName) log.error(`class is missing record name`);
      else classes[c.recordName] = c;
    } else {
      logUnhandledGroup(curr);
      curr = scanner.next();
    }
  }
  return classes;
};

export const serializeClasses = function* (
  classes: IClasses,
): IterableIterator<string> {
  //section name
  yield '2';
  yield DXFSymbol.Classes;

  for (const [, value] of Object.entries(classes) as [string, IClass][]) {
    yield* serializeClass(value);
  }
};
