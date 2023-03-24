import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import {
  checkCommonEntityProperties,
  parsePoint,
  serializePoint,
  serializeCommonEntityProperty,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

type IPointAndWeight = IPoint & {
  weight?: number;
};

export type ISplineEntity = IEntity & {
  type: EntityName.Spline;
  controlPoints?: IPointAndWeight[];
  fitPoints?: IPoint[];
  startTangent: IPoint;
  endTangent: IPoint;
  knotValues: number[];
  closed: boolean;
  periodic: boolean;
  rational: boolean;
  planar: boolean;
  linear: boolean;
  degreeOfSplineCurve: number;
  numberOfKnots: number;
  numberOfControlPoints: number;
  numberOfFitPoints: number;
  normalVector: IPoint;
  knotTolerance: number;
  controlPointTolerance: number;
  fitTolerance: number;
};

const enum ValueType {
  point = 1,
  points = 2,
  number = 3,
  numbers = 4,
}

const splinePropertyAndTypeFromCode = new Map<
  number,
  [keyof ISplineEntity, ValueType]
>([
  [10, ['controlPoints', ValueType.points]],
  [11, ['fitPoints', ValueType.points]],
  [12, ['startTangent', ValueType.point]],
  [13, ['endTangent', ValueType.point]],
  [40, ['knotValues', ValueType.numbers]],
  [42, ['knotTolerance', ValueType.number]],
  [43, ['controlPointTolerance', ValueType.number]],
  [44, ['fitTolerance', ValueType.number]],
  [70, ['standardFlags', ValueType.number]],
  [71, ['degreeOfSplineCurve', ValueType.number]],
  [72, ['numberOfKnots', ValueType.number]],
  [73, ['numberOfControlPoints', ValueType.number]],
  [74, ['numberOfFitPoints', ValueType.number]],
  [210, ['normalVector', ValueType.point]],
]);

const codeAndTypeFromSplineProperty = new Map<
  keyof ISplineEntity,
  [number, ValueType]
>(
  Array.from(splinePropertyAndTypeFromCode.entries()).map(
    ([code, [property, valueType]]) => [property, [code, valueType]],
  ),
);
//delete special cases that are are handled differently when serializing and parsing
splinePropertyAndTypeFromCode.delete(70);

export default class Spline implements IGeometry<ISplineEntity> {
  public ForEntityName = EntityName.Spline;
  public parseEntity(scanner: DxfArrayScanner): ISplineEntity {
    const entity = { type: this.ForEntityName } as ISplineEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      const propertyAndType = splinePropertyAndTypeFromCode.get(curr.code);
      let point: IPointAndWeight;
      if (propertyAndType != null) {
        const [property, t] = propertyAndType;
        switch (t) {
          case ValueType.points:
            if (!entity[property]) {
              (entity[property] as IPoint[]) = [];
            }
            point = parsePoint(scanner);
            curr = scanner.next();
            if (curr.code === 41) {
              point.weight = curr.value as number;
            } else {
              //weight not specified
              scanner.rewind();
            }
            (entity[property] as IPoint[]).push(point);
            break;
          case ValueType.point:
            (entity[property] as IPoint) = parsePoint(scanner);
            break;
          case ValueType.number:
            (entity[property] as number) = curr.value as number;
            break;
          case ValueType.numbers:
            if (!entity[property]) {
              (entity[property] as number[]) = [];
            }
            (entity[property] as number[]).push(curr.value as number);
            break;
        }
      } else {
        switch (curr.code) {
          case 70:
            entity.standardFlags = curr.value as number;
            entity.closed = ((curr.value as number) & 1) !== 0;
            entity.periodic = ((curr.value as number) & 2) !== 0;
            entity.rational = ((curr.value as number) & 4) !== 0;
            entity.planar =
              ((curr.value as number) & 8) !== 0 ||
              ((curr.value as number) & 16) !== 0;
            entity.linear = ((curr.value as number) & 16) !== 0;
            break;
          default:
            checkCommonEntityProperties(entity, curr, scanner);
            break;
        }
      }
      curr = scanner.next();
    }

    return entity;
  }

  public *serializeEntity(entity: ISplineEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof ISplineEntity,
      ISplineEntity[keyof ISplineEntity],
    ][]) {
      const codeAndType = codeAndTypeFromSplineProperty.get(property);
      if (codeAndType != null) {
        const [code, t] = codeAndType;
        switch (t) {
          case ValueType.points:
            for (const point of value as IPointAndWeight[]) {
              yield* serializePoint(point, code);
              if (point.weight != null) {
                yield '41';
                yield `${point.weight}`;
              }
            }
            break;
          case ValueType.point:
            yield* serializePoint(value as IPoint, code);
            break;
          case ValueType.number:
            yield* serializeGroupValue(code, value as number);
            break;
          case ValueType.numbers:
            for (const num of value as number[]) {
              yield* serializeGroupValue(code, num as number);
            }
        }
      } else {
        yield* serializeCommonEntityProperty(
          property,
          value as string | number | boolean,
          entity,
        );
      }
    }
  }
}
