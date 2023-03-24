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

export type IPointEntity = IEntity & {
  type: EntityName.Point;
  position: IPoint;
  thickness: number;
  extrusionDirection: IPoint;
};

export default class Point implements IGeometry<IPointEntity> {
  public ForEntityName = EntityName.Point;
  public parseEntity(scanner: DxfArrayScanner): IPointEntity {
    const entity = { type: this.ForEntityName } as IPointEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      switch (curr.code) {
        case 10:
          entity.position = parsePoint(scanner);
          break;
        case 39:
          entity.thickness = curr.value as number;
          break;
        case 70:
          entity.standardFlags = curr.value as number;
          break;
        case 210:
          entity.extrusionDirection = parsePoint(scanner);
          break;
        case 100:
          break;
        default:
          // check common entity attributes
          checkCommonEntityProperties(entity, curr, scanner);
          break;
      }
      curr = scanner.next();
    }

    return entity;
  }
  public *serializeEntity(entity: IPointEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IPointEntity,
      IPointEntity[keyof IPointEntity],
    ][]) {
      switch (property) {
        case 'position':
          yield* serializePoint(value as IPoint, 10);
          break;
        case 'thickness':
          yield* serializeGroupValue(39, value as number);
          break;
        case 'extrusionDirection':
          yield* serializePoint(value as IPoint, 210);
          break;
        case 'standardFlags':
          yield '70';
          yield `${value}`;
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
