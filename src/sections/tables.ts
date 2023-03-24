import log from 'loglevel';

import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import type { IGroup, GroupValue } from '../DxfArrayScanner';
import { DXFSymbol } from '../DxfParser.js';
import {
  groupIs,
  getAcadColor,
  logUnhandledGroup,
  parsePoint,
  serializePoint,
} from '../ParseHelpers.js';
import type { IPoint } from '../entities/geometry';

export type DXFTableSymbol =
  | DXFSymbol.VPort
  | DXFSymbol.LType
  | DXFSymbol.Layer;

export const enum TableKey {
  ViewPorts = 'viewPorts',
  LineTypes = 'lineTypes',
  Layers = 'layers',
}

export const enum TableName {
  ViewPort = 'viewPort',
  LineType = 'lineType',
  Layer = 'layer',
}

type ApplicationDefinedGroups = Record<string, Record<string, GroupValue>>;

const parseApplicationGroup = (
  scanner: DxfArrayScanner,
): Record<string, GroupValue> => {
  const groups: Record<string, GroupValue> = {};
  let curr = scanner.next();
  while (curr.code != 102) {
    groups[curr.code] = curr.value;
    curr = scanner.next();
  }
  return groups;
};

const serializeApplicationDefinedGroups = function* (
  groups: ApplicationDefinedGroups,
): IterableIterator<string> {
  for (const [name, group] of Object.entries(groups)) {
    yield '102';
    yield `{${name}`;
    for (const [code, value] of Object.entries(group)) {
      yield code;
      yield `${value}`;
    }
    yield '102';
    yield '}';
  }
};

export type IViewPort = {
  name: string;
  handle: string;
  lowerLeftCorner: IPoint;
  upperRightCorner: IPoint;
  center: IPoint;
  snapBasePoint: IPoint;
  snapSpacing: IPoint;
  gridSpacing: IPoint;
  viewDirectionFromTarget: IPoint;
  viewTarget: IPoint;
  height: number;
  width: number;
  lensLength: number;
  frontClippingPlane: string | number | boolean;
  backClippingPlane: string | number | boolean;
  viewHeight: number;
  snapRotationAngle: number;
  viewTwistAngle: number;
  orthographicType: string;
  ucsOrigin: IPoint;
  ucsXAxis: IPoint;
  ucsYAxis: IPoint;
  renderMode: string;
  defaultLightingType: boolean;
  defaultLightingOn: string;
  ownerHandle: string;
  ambientColorIndex: number;
  ambientColor: number;
  ambientColorGroupCodes: number[]; //421 or 431 or both
  standardFlags: number;
  viewMode: number;
  circleSides: number;
  plotable: number;
  UCSIcon: number;
  elevation: number;
  visualStyleHardPointer: number;
  majorGridLines: number;
  brightness: number;
  contrast: number;
  applicationGroups: ApplicationDefinedGroups;
  sunId: string;

  //undocumented in autocad 2012 dxf reference, but exists. Required for serialization
  groupCode60: number;
  groupCode65: number;
  groupCode75: number;
  groupCode76: number;
  groupCode77: number;
  groupCode78: number;
};

type TableKeyFromDXFSymbol<T extends DXFTableSymbol> = T extends DXFSymbol.VPort
  ? TableKey.ViewPorts
  : T extends DXFSymbol.LType
  ? TableKey.LineTypes
  : T extends DXFSymbol.Layer
  ? TableKey.Layers
  : never;

type TableNameFromDXFSymbol<T extends DXFTableSymbol> =
  T extends DXFSymbol.VPort
    ? TableName.ViewPort
    : T extends DXFSymbol.LType
    ? TableName.LineType
    : T extends DXFSymbol.Layer
    ? TableName.Layer
    : never;

type TableValueFromDXFSymbol<T extends DXFTableSymbol> =
  T extends DXFSymbol.VPort
    ? IViewPort[]
    : T extends DXFSymbol.LType
    ? Record<string, ILineType>
    : T extends DXFSymbol.Layer
    ? Record<string, ILayer>
    : never;

export type ILineType = {
  name: string;
  handle: string;
  ownerHandle: string;
  description: string;
  pattern: string[]; //dash dot or space length per element
  patternTypes: number[];
  shapeNumbers: number[];
  patternLength: number;
  elementCount: number;
  standardFlags: number;
  alignmentCode: number; //alwys 65 for ascii letter A
  applicationGroups: ApplicationDefinedGroups;
};

export type ILayer = {
  name: string;
  handle: string;
  ownerHandle: string;
  visible: boolean;
  colorIndex: number;
  color: number;
  frozen: boolean;
  standardFlags: number;
  applicationGroups: ApplicationDefinedGroups;
  lineType: string;
  lineWeight: number;
  plotStyleName: string;
  materialObject: string;
  visualStyle: string;
};

export type TableDefinition<T extends DXFTableSymbol> = {
  tableRecordsProperty: TableKeyFromDXFSymbol<T>;
  tableName: TableNameFromDXFSymbol<T>;
  dxfSymbolName: T;
  parseTableRecords(scanner: DxfArrayScanner): TableValueFromDXFSymbol<T>;
  serializeTable(items: TableValueFromDXFSymbol<T>): IterableIterator<string>;
};

export type IViewPortTableDefinition = TableDefinition<DXFSymbol.VPort>;
export type ILineTypeTableDefinition = TableDefinition<DXFSymbol.LType>;
export type ILayerTableDefinition = TableDefinition<DXFSymbol.Layer>;

export type ITableDefinitions = {
  [T in DXFTableSymbol]: TableDefinition<T>;
};

export type IBaseTable = {
  handle: string;
  ownerHandle: string;
  maxEntities: number; //The table's length or number of keys should equal maxEntities, but this is not always the case
  applicationGroups: ApplicationDefinedGroups;
};

export type ITable<T extends DXFTableSymbol> = IBaseTable & {
  [TABLEKEY in TableKeyFromDXFSymbol<T>]: TableValueFromDXFSymbol<T>;
};

export type IViewPortTable = ITable<DXFSymbol.VPort>;
export type ILineTypesTable = ITable<DXFSymbol.LType>;
export type ILayersTable = ITable<DXFSymbol.Layer>;

export type ITables = {
  [TableName.ViewPort]?: IViewPortTable;
  [TableName.LineType]?: ILineTypesTable;
  [TableName.Layer]?: ILayersTable;
};

const viewPortPropertyFromCode = new Map<number, [keyof IViewPort, boolean]>([
  [2, ['name', false]],
  [5, ['handle', false]],
  [10, ['lowerLeftCorner', true]],
  [11, ['upperRightCorner', true]],
  [12, ['center', true]],
  [13, ['snapBasePoint', true]],
  [14, ['snapSpacing', true]],
  [15, ['gridSpacing', true]],
  [16, ['viewDirectionFromTarget', true]],
  [17, ['viewTarget', true]],
  [40, ['height', false]],
  [41, ['width', false]],
  [42, ['lensLength', false]],
  [43, ['frontClippingPlane', false]],
  [44, ['backClippingPlane', false]],
  [45, ['viewHeight', false]],
  [50, ['snapRotationAngle', false]],
  [51, ['viewTwistAngle', false]],
  [61, ['majorGridLines', false]],
  [70, ['standardFlags', false]],
  [71, ['viewMode', false]],
  [72, ['circleSides', false]],
  [73, ['plotable', false]],
  [74, ['UCSIcon', false]],
  [79, ['orthographicType', false]],
  [110, ['ucsOrigin', true]],
  [111, ['ucsXAxis', true]],
  [112, ['ucsYAxis', true]],
  [141, ['brightness', false]],
  [142, ['contrast', false]],
  [146, ['elevation', false]],
  [281, ['renderMode', false]],
  [292, ['defaultLightingOn', false]],
  [330, ['ownerHandle', false]],
  [348, ['visualStyleHardPointer', false]],
  [361, ['sunId', false]],

  [63, ['ambientColorIndex', false]],
  [282, ['defaultLightingType', false]],

  [60, ['groupCode60', false]],
  [65, ['groupCode65', false]],
  [75, ['groupCode75', false]],
  [76, ['groupCode76', false]],
  [77, ['groupCode77', false]],
  [78, ['groupCode78', false]],
]);

const codeFromViewPortProperty = new Map<keyof IViewPort, number>(
  Array.from(viewPortPropertyFromCode.entries()).map(([code, [property]]) => [
    property,
    code,
  ]),
);

//delete special cases that are are handled differently when serializing and parsing
viewPortPropertyFromCode.delete(282);

const parseViewPortRecords = (scanner: DxfArrayScanner): IViewPort[] => {
  const viewPorts: IViewPort[] = []; // Multiple table entries may have the same name indicating a multiple viewport configuration
  let viewPort = {} as IViewPort;

  log.debug('ViewPort {');
  let curr = scanner.next<string | number | boolean>();
  while (!groupIs(curr, 0, DXFSymbol.EndTable)) {
    const propertyAndIsPoint = viewPortPropertyFromCode.get(curr.code);
    if (propertyAndIsPoint != null) {
      const [property, isPoint] = propertyAndIsPoint;
      if (isPoint) {
        (viewPort[property] as IPoint) = parsePoint(scanner);
      } else {
        (viewPort[property] as GroupValue) = curr.value;
      }
      curr = scanner.next();
    } else {
      //Special cases of setting properties
      switch (curr.code) {
        case 0:
          // New ViewPort
          if (curr.value === DXFSymbol.VPort) {
            log.debug('}');
            viewPorts.push(viewPort);
            log.debug('ViewPort {');
            viewPort = {} as IViewPort;
          }
          curr = scanner.next();
          break;
        case 102:
          if (
            typeof curr.value === 'string' &&
            curr.value.startsWith('{') &&
            curr.value.length > 0
          ) {
            const name = curr.value.substring(1);
            if (!viewPort.applicationGroups) viewPort.applicationGroups = {};
            viewPort.applicationGroups[name] = parseApplicationGroup(scanner);
          }
          curr = scanner.next();
          break;
        case 421:
          if (!viewPort.ambientColorGroupCodes) {
            viewPort.ambientColorGroupCodes = [];
          }
          viewPort.ambientColorGroupCodes.push(curr.code);
          viewPort.ambientColor = curr.value as number;
          curr = scanner.next();
          break;
        case 431:
          if (!viewPort.ambientColorGroupCodes) {
            viewPort.ambientColorGroupCodes = [];
          }
          viewPort.ambientColorGroupCodes.push(curr.code);
          viewPort.ambientColor = curr.value as number;
          curr = scanner.next();
          break;
        case 282:
          viewPort.defaultLightingType = curr.value === 1;
          curr = scanner.next();
          break;
        default:
          logUnhandledGroup(curr);
          curr = scanner.next();
      }
    }
  }
  // Note: do not call scanner.next() here,
  //  parseTable() needs the current group
  log.debug('}');
  viewPorts.push(viewPort);

  return viewPorts;
};

const serializeViewPorts = function* (
  viewPorts: IViewPort[],
): IterableIterator<string> {
  for (const viewPort of viewPorts) {
    yield '0';
    yield DXFSymbol.VPort;
    for (const [property, value] of Object.entries(viewPort)) {
      const code = codeFromViewPortProperty.get(property as keyof IViewPort);
      if (code != null) {
        if (typeof value === 'object') {
          yield* serializePoint(value as IPoint, code);
        } else {
          yield* serializeGroupValue(code, value);
        }
      } else {
        switch (property) {
          case 'ambientColor':
            for (const c of viewPort.ambientColorGroupCodes ?? [431]) {
              yield `${c}`;
              yield `${value}`;
            }
            break;
          case 'applicationGroups':
            yield* serializeApplicationDefinedGroups(
              value as ApplicationDefinedGroups,
            );
            break;
        }
      }
    }
  }
};

const lineTypePropertyFromCode = new Map<number, keyof ILineType>([
  [2, 'name'],
  [3, 'description'],
  [5, 'handle'],
  [40, 'patternLength'],
  [70, 'standardFlags'],
  [72, 'alignmentCode'],
  [330, 'ownerHandle'],
]);

const codeFromLineTypeProperty = new Map<keyof ILineType, number>(
  Array.from(lineTypePropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

//delete special cases that are are handled differently when serializing and parsing
lineTypePropertyFromCode.delete(2);
codeFromLineTypeProperty.delete('patternLength');

const parseLineTypes = (
  scanner: DxfArrayScanner,
): Record<string, ILineType> => {
  const ltypes = {} as Record<string, ILineType>;
  let ltype = {} as ILineType;
  let length = 0;
  let ltypeName: string | undefined;

  log.debug('LType {');
  let curr = scanner.next();
  while (!groupIs(curr, 0, DXFSymbol.EndTable)) {
    const property = lineTypePropertyFromCode.get(curr.code);
    if (property != null) {
      (ltype[property] as string | number) = curr.value as string | number;
      curr = scanner.next();
    } else {
      switch (curr.code) {
        case 2:
          ltype.name = curr.value as string;
          ltypeName = curr.value as string;
          curr = scanner.next();
          break;
        case 49:
          ltype.pattern.push(curr.value as string);
          curr = scanner.next();
          break;
        case 73: // Number of elements for this line type (dots, dashes, spaces);
          length = ltype.elementCount = curr.value as number;
          if (length > 0) ltype.pattern = [];
          curr = scanner.next();
          break;
        case 74:
          if (!ltype.patternTypes) ltype.patternTypes = [];
          ltype.patternTypes.push(curr.value as number);
          curr = scanner.next();
          break;
        case 75:
          if (!ltype.shapeNumbers) ltype.shapeNumbers = [];
          ltype.shapeNumbers.push(curr.value as number);
          curr = scanner.next();
          break;
        case 102:
          if (
            typeof curr.value === 'string' &&
            curr.value.startsWith('{') &&
            curr.value.length > 0
          ) {
            const name = curr.value.substring(1);
            if (!ltype.applicationGroups) ltype.applicationGroups = {};
            ltype.applicationGroups[name] = parseApplicationGroup(scanner);
          }
          curr = scanner.next();
          break;
        case 0:
          log.debug('}');
          if (length > 0 && length !== ltype.pattern.length)
            log.warn('lengths do not match on LTYPE pattern');
          if (typeof ltypeName === 'string') {
            ltypes[ltypeName] = ltype; //save last ltype
          }
          ltype = {} as ILineType;
          log.debug('LType {');
          curr = scanner.next();
          break;
        default:
          curr = scanner.next();
      }
    }
  }

  log.debug('}');
  //ltypeName should be defined in while loop above
  if (typeof ltypeName === 'string') {
    ltypes[ltypeName] = ltype; //save last ltype
  }
  return ltypes;
};

const serializeLineTypes = function* (
  ltypes: Record<string, ILineType>,
): IterableIterator<string> {
  for (const lineType of Object.values(ltypes) as ILineType[]) {
    yield '0';
    yield DXFSymbol.LType;
    for (const [property, value] of Object.entries(lineType) as [
      keyof ILineType,
      ILineType[keyof ILineType],
    ][]) {
      const code = codeFromLineTypeProperty.get(property);
      if (code != null) {
        yield `${code}`;
        yield `${value}`;
      } else {
        switch (property) {
          case 'patternLength':
            if (!lineType.pattern) {
              yield '40';
              yield `${value}`;
            }
            break;
          case 'elementCount':
            yield '73';
            yield `${value}`;
            if (lineType.pattern?.length !== value) {
              log.warn(
                `elementCount ${value} does not match pattern length ${lineType.pattern?.length}`,
              );
            }
            break;
          case 'pattern':
            if (lineType.patternLength) {
              yield '40';
              yield `${lineType.patternLength}`;
            }
            for (const [i, p] of (value as string[]).entries()) {
              yield '49';
              yield p;
              if (lineType.patternTypes && lineType.patternTypes[i] != null) {
                yield '74';
                yield `${lineType.patternTypes[i]}`;
              }
              if (lineType.shapeNumbers && lineType.shapeNumbers[i] != null) {
                yield '75';
                yield `${lineType.shapeNumbers[i]}`;
              }
            }
            break;
          case 'applicationGroups':
            yield* serializeApplicationDefinedGroups(
              value as ApplicationDefinedGroups,
            );
            break;
        }
      }
    }
  }
};

const layerPropertyFromCode = new Map<number, keyof ILayer>([
  [2, 'name'],
  [5, 'handle'],
  [6, 'lineType'],
  [62, 'colorIndex'],
  [70, 'standardFlags'],
  [330, 'ownerHandle'],
  [347, 'materialObject'],
  [370, 'lineWeight'],
  [390, 'plotStyleName'],
  [348, 'visualStyle'],
]);

const codeFromLayerProperty = new Map<keyof ILayer, number>(
  Array.from(layerPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

//delete special cases that are are handled differently when serializing and parsing
layerPropertyFromCode.delete(2);
layerPropertyFromCode.delete(62);
layerPropertyFromCode.delete(70);

const parseLayers = (scanner: DxfArrayScanner): Record<string, ILayer> => {
  const layers: Record<string, ILayer> = {};
  let layer = {} as ILayer;
  let layerName: string | undefined;

  log.debug('Layer {');
  let curr = scanner.next();
  while (!groupIs(curr, 0, DXFSymbol.EndTable)) {
    const property = layerPropertyFromCode.get(curr.code);
    if (property != null) {
      (layer[property] as string | number) = curr.value as string | number;
      curr = scanner.next();
    } else {
      switch (curr.code) {
        case 2: // layer name
          layerName = layer.name = curr.value as string;
          curr = scanner.next();
          break;
        case 62: // color, visibility
          layer.visible = (curr.value as number) >= 0;
          // TODO 0 and 256 are BYBLOCK and BYLAYER respectively. Need to handle these values for layers?.
          layer.colorIndex = Math.abs(curr.value as number);
          layer.color = getAcadColor(layer.colorIndex);
          curr = scanner.next();
          break;
        case 70: // frozen layer
          layer.frozen =
            ((curr.value as number) & 1) != 0 ||
            ((curr.value as number) & 2) != 0;
          layer.standardFlags = curr.value as number;
          curr = scanner.next();
          break;
        case 102:
          if (
            typeof curr.value === 'string' &&
            curr.value.startsWith('{') &&
            curr.value.length > 0
          ) {
            const name = curr.value.substring(1);
            if (!layer.applicationGroups) layer.applicationGroups = {};
            layer.applicationGroups[name] = parseApplicationGroup(scanner);
          }
          curr = scanner.next();
          break;
        case 420: // TrueColor
          layer.color = Math.abs(curr.value as number);
          curr = scanner.next();
          break;
        case 0:
          // New Layer
          if (curr.value === DXFSymbol.Layer) {
            log.debug('}');
            if (typeof layerName === 'string') {
              layers[layerName] = layer; //save last layer
            }
            log.debug('Layer {');
            layer = {} as ILayer;
            layerName = undefined;
            curr = scanner.next();
          }
          break;
        default:
          logUnhandledGroup(curr);
          curr = scanner.next();
      }
    }
  }
  // Note: do not call scanner.next() here,
  //  parseLayerTable() needs the current group
  log.debug('}');

  if (typeof layerName === 'string') {
    layers[layerName] = layer; //last last layer
  }

  return layers;
};

const serializeLayers = function* (
  layers: Record<string, ILayer>,
): IterableIterator<string> {
  for (const layer of Object.values(layers) as ILayer[]) {
    yield '0';
    yield DXFSymbol.Layer;

    for (const [property, value] of Object.entries(layer) as [
      keyof ILayer,
      ILayer[keyof ILayer],
    ][]) {
      const code = codeFromLayerProperty.get(property);
      if (code != null) {
        yield `${code}`;
        yield `${value}`;
      } else {
        switch (property) {
          case 'color':
            if (typeof layer.colorIndex !== 'number') {
              //true color (if not colorIndex, but there is a color)
              yield '420';
              yield `${value}`;
            }
            break;
          case 'applicationGroups':
            yield* serializeApplicationDefinedGroups(
              value as ApplicationDefinedGroups,
            );
            break;
        }
      }
    }
  }
};

const tableDefinitions: ITableDefinitions = {
  [DXFSymbol.VPort]: {
    tableRecordsProperty: TableKey.ViewPorts,
    tableName: TableName.ViewPort,
    dxfSymbolName: DXFSymbol.VPort,
    parseTableRecords: parseViewPortRecords,
    serializeTable: serializeViewPorts,
  },
  [DXFSymbol.LType]: {
    tableRecordsProperty: TableKey.LineTypes,
    tableName: TableName.LineType,
    dxfSymbolName: DXFSymbol.LType,
    parseTableRecords: parseLineTypes,
    serializeTable: serializeLineTypes,
  },
  [DXFSymbol.Layer]: {
    tableRecordsProperty: TableKey.Layers,
    tableName: TableName.Layer,
    dxfSymbolName: DXFSymbol.Layer,
    parseTableRecords: parseLayers,
    serializeTable: serializeLayers,
  },
};

const tableDefinitionValues = Object.values(tableDefinitions);

const tablePropertyFromCode = new Map<number, keyof IBaseTable>([
  [5, 'handle'],
  [330, 'ownerHandle'],
  [70, 'maxEntities'],
]);

const codeFromTableProperty = new Map<keyof IBaseTable, string>(
  Array.from(tablePropertyFromCode.entries()).map(([code, property]) => [
    property,
    `${code}`,
  ]),
);
//delete special cases that are are handled differently when serializing and parsing
tablePropertyFromCode.delete(70);

const parseTable = <T extends DXFTableSymbol>(
  scanner: DxfArrayScanner,
  tableType: DXFTableSymbol,
): ITable<T> => {
  const table = {} as ITable<T>;
  const { tableRecordsProperty, parseTableRecords } = tableDefinitions[
    tableType
  ] as TableDefinition<T>;
  let expectedCount = 0;

  let curr = scanner.next();
  while (!groupIs(curr, 0, DXFSymbol.EndTable)) {
    const property = tablePropertyFromCode.get(curr.code);
    if (property != null) {
      (table[property] as GroupValue) = curr.value;
    } else {
      //Special cases of setting properties
      switch (curr.code) {
        case 100:
          if (curr.value !== 'AcDbSymbolTable') {
            logUnhandledGroup(curr);
          }
          // otherwise ignore
          break;
        case 70:
          table.maxEntities = expectedCount = curr.value as number;
          break;
        case 102:
          if (
            typeof curr.value === 'string' &&
            curr.value.startsWith('{') &&
            curr.value.length > 0
          ) {
            const name = curr.value.substring(1);
            if (!table.applicationGroups) table.applicationGroups = {};
            table.applicationGroups[name] = parseApplicationGroup(scanner);
          }
          break;
        case 0:
          if (curr.value === tableType) {
            (table[tableRecordsProperty] as TableValueFromDXFSymbol<T>) =
              parseTableRecords(scanner);
            scanner.rewind();
            curr = scanner.lastReadGroup as IGroup<GroupValue>;
            //All property cases need to call scanner.next(), except when `parseTablesRecords` is called, so rewind to make the following scanner.next()
            //to put scanner's pointer in correct position.
          } else {
            logUnhandledGroup(curr);
          }
          break;
        default:
          logUnhandledGroup(curr);
      }
    }
    curr = scanner.next();
  }
  const tableRecords = table[tableRecordsProperty];
  if (tableRecords) {
    const actualCount = Array.isArray(tableRecords)
      ? tableRecords.length
      : typeof tableRecords === 'object'
      ? Object.keys(tableRecords).length
      : undefined;
    if (expectedCount !== actualCount)
      log.warn(
        `Parsed ${actualCount} ${tableType}'s but expected ${expectedCount}`,
      );
  }
  scanner.next();
  return table;
};

export const serializeTable = function* <T extends DXFTableSymbol>(
  tableName: TableNameFromDXFSymbol<T>,
  table: ITable<T>,
): IterableIterator<string> {
  const tableDefinition = tableDefinitionValues.find(
    (td) => td.tableName === tableName,
  );
  if (!tableDefinition) {
    return;
  }

  //start of table
  yield '0';
  yield DXFSymbol.Table;

  //Table Name
  yield '2';
  yield tableDefinition.dxfSymbolName;

  for (const [property, value] of Object.entries(table) as [
    keyof IBaseTable,
    IBaseTable[keyof IBaseTable],
  ][]) {
    const code = codeFromTableProperty.get(property);
    if (code != null) {
      yield code;
      yield value as string;
    } else {
      if (property === 'applicationGroups') {
        yield* serializeApplicationDefinedGroups(
          value as ApplicationDefinedGroups,
        );
      }
    }
  }
  const { tableRecordsProperty, serializeTable } =
    tableDefinition as TableDefinition<T>;
  const tableRecords = table[
    tableRecordsProperty as TableKeyFromDXFSymbol<T>
  ] as TableValueFromDXFSymbol<T>;
  const entityCount = Array.isArray(tableRecords)
    ? tableRecords.length
    : typeof tableRecords === 'object'
    ? Object.keys(tableRecords).length
    : undefined;
  if (
    table.maxEntities != null &&
    entityCount &&
    table.maxEntities < entityCount
  ) {
    log.warn(
      `${tableRecordsProperty}'s has ${entityCount} but max entities declared was ${table.maxEntities}`,
    );
  }
  if (entityCount != null) {
    yield* serializeTable(tableRecords);
  }

  //end of table
  yield '0';
  yield DXFSymbol.EndTable;
};

export const parseTables = (scanner: DxfArrayScanner): ITables => {
  const tables: ITables = {};
  let curr = scanner.next();
  while (curr.value !== DXFSymbol.EOF) {
    if (groupIs(curr, 0, DXFSymbol.EndSec)) break;

    if (groupIs(curr, 0, DXFSymbol.Table)) {
      curr = scanner.next();
      const tableDefinition = tableDefinitions[curr.value as DXFTableSymbol];
      if (tableDefinition) {
        const { tableName } = tableDefinition;
        log.debug(curr.value + ' Table {');
        (tables[tableName] as ITable<DXFTableSymbol>) = parseTable(
          scanner,
          curr.value as DXFTableSymbol,
        );
        curr = scanner.lastReadGroup as IGroup<GroupValue>;
        log.debug('}');
      } else {
        log.debug('Unhandled Table ' + curr.value);
      }
    } else {
      // else ignored
      curr = scanner.next();
    }
  }

  scanner.next();
  return tables;
};

export const serializeTables = function* (
  tables: ITables,
): IterableIterator<string> {
  //section name
  yield '2';
  yield DXFSymbol.Tables;

  for (const [tableName, table] of Object.entries(tables) as [
    TableNameFromDXFSymbol<DXFTableSymbol>,
    ITable<DXFTableSymbol>,
  ][]) {
    yield* serializeTable(tableName, table);
  }
};
