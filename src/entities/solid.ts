import type DxfArrayScanner from '../DxfArrayScanner';
import {
  checkCommonEntityProperties,
  parsePoint,
  serializePoint,
  serializeCommonEntityProperty,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export type ISolidEntity = IEntity & {
  type: EntityName.Solid;
  points: IPoint[];
  extrusionDirection: IPoint;
};

export default class Solid implements IGeometry<ISolidEntity> {
  public ForEntityName = EntityName.Solid;
  public parseEntity(scanner: DxfArrayScanner): ISolidEntity {
    const entity = { type: this.ForEntityName } as ISolidEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      switch (curr.code) {
        case 10:
          if (!entity.points) entity.points = [];
          entity.points[0] = parsePoint(scanner);
          break;
        case 11:
          if (!entity.points) entity.points = [];
          entity.points[1] = parsePoint(scanner);
          break;
        case 12:
          if (!entity.points) entity.points = [];
          entity.points[2] = parsePoint(scanner);
          break;
        case 13:
          if (!entity.points) entity.points = [];
          entity.points[3] = parsePoint(scanner);
          break;
        case 210:
          entity.extrusionDirection = parsePoint(scanner);
          break;
        case 70:
          entity.standardFlags = curr.value as number;
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

  public *serializeEntity(entity: ISolidEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof ISolidEntity,
      ISolidEntity[keyof ISolidEntity],
    ][]) {
      switch (property) {
        case 'points':
          //Note: It is unlikely, but the parser could parse points[n] for only some of 0, 1, 2, 3 indices
          for (const [indexString, point] of Object.entries(
            value as IPoint[],
          )) {
            const index = parseInt(indexString, 10);
            yield* serializePoint(point, 10 + index);
          }
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
