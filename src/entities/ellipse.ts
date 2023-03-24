import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import {
  checkCommonEntityProperties,
  parsePoint,
  serializeCommonEntityProperty,
  serializePoint,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export interface IEllipseEntity extends IEntity {
  type: EntityName.Ellipse;
  center: IPoint;
  majorAxisEndPoint: IPoint;
  axisRatio: number;
  startAngle: number;
  endAngle: number;
  name: string;
}

const ellipsePropertyFromCode = new Map<number, keyof IEllipseEntity>([
  [40, 'axisRatio'],
  [41, 'startAngle'],
  [42, 'endAngle'],
  [70, 'standardFlags'],
  [2, 'name'],
]);

const codeFromEllipseProperty = new Map<keyof IEllipseEntity, number>(
  Array.from(ellipsePropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

export default class Ellipse implements IGeometry<IEllipseEntity> {
  public ForEntityName = EntityName.Ellipse;
  public parseEntity(scanner: DxfArrayScanner): IEllipseEntity {
    const entity = { type: this.ForEntityName } as IEllipseEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      const property = ellipsePropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as string | number) = curr.value as string | number;
      } else {
        //special cases
        switch (curr.code) {
          case 10:
            entity.center = parsePoint(scanner);
            break;
          case 11:
            entity.majorAxisEndPoint = parsePoint(scanner);
            break;
          default:
            // check common entity attributes
            checkCommonEntityProperties(entity, curr, scanner);
            break;
        }
      }

      curr = scanner.next();
    }

    return entity;
  }

  public *serializeEntity(entity: IEllipseEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IEllipseEntity,
      IEllipseEntity[keyof IEllipseEntity],
    ][]) {
      const code = codeFromEllipseProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number | boolean);
      } else {
        switch (property) {
          case 'center':
            yield* serializePoint(value as IPoint, 10);
            break;
          case 'majorAxisEndPoint':
            yield* serializePoint(value as IPoint, 11);
            break;
          default:
            yield* serializeCommonEntityProperty(
              property,
              value as string | number | boolean,
              entity,
            );
            break;
        }
      }
    }
  }
}
