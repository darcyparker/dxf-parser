import type DxfArrayScanner from '../DxfArrayScanner';
import {
  checkCommonEntityProperties,
  parsePoint,
  serializeCommonEntityProperty,
  serializePoint,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export type ILineEntity = IEntity & {
  type: EntityName.Line;
  vertices: [IPoint, IPoint];
  extrusionDirection: IPoint;
};

export default class Line implements IGeometry<ILineEntity> {
  public ForEntityName = EntityName.Line;
  public parseEntity(scanner: DxfArrayScanner): ILineEntity {
    const entity = { type: this.ForEntityName } as ILineEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      switch (curr.code) {
        case 10: // X coordinate of point
          if (!entity.vertices)
            entity.vertices = [] as unknown as [IPoint, IPoint];
          entity.vertices.unshift(parsePoint(scanner));
          break;
        case 11:
          if (!entity.vertices)
            entity.vertices = [] as unknown as [IPoint, IPoint];
          entity.vertices.push(parsePoint(scanner));
          break;
        case 210:
          entity.extrusionDirection = parsePoint(scanner);
          break;
        case 100:
          break;
        case 70:
          entity.standardFlags = curr.value as number;
          break;
        default:
          checkCommonEntityProperties(entity, curr, scanner);
          break;
      }

      curr = scanner.next();
    }
    return entity;
  }

  public *serializeEntity(entity: ILineEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof ILineEntity,
      ILineEntity[keyof ILineEntity],
    ][]) {
      switch (property) {
        case 'vertices':
          yield* serializePoint((value as IPoint[])[0], 10); //start point
          yield* serializePoint((value as IPoint[])[1], 11); //end point
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
