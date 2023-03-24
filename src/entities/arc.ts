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

export type IArcEntity = IEntity & {
  type: EntityName.Arc;
  center: IPoint;
  radius: number;
  startAngle: number; //degrees
  endAngle: number; //degrees
  angleLength: number; //degrees
  extrusionDirection: IPoint;
};

const arcPropertyFromCode = new Map<number, keyof IArcEntity>([
  [40, 'radius'],
  [70, 'standardFlags'],
]);

const codeFromArcProperty = new Map<keyof IArcEntity, number>(
  Array.from(arcPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

export default class Arc implements IGeometry<IArcEntity> {
  public ForEntityName = EntityName.Arc;
  public parseEntity(scanner: DxfArrayScanner): IArcEntity {
    const entity = { type: this.ForEntityName } as IArcEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      const property = arcPropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as number) = curr.value as number;
      } else {
        switch (curr.code) {
          case 10: // X coordinate of point
            entity.center = parsePoint(scanner);
            break;
          case 50: // start angle
            entity.startAngle = curr.value as number;
            break;
          case 51: // end angle
            entity.endAngle = curr.value as number;
            entity.angleLength = entity.endAngle - entity.startAngle; // angleLength is deprecated
            break;
          case 210:
            entity.extrusionDirection = parsePoint(scanner);
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

  public *serializeEntity(entity: IArcEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IArcEntity,
      IArcEntity[keyof IArcEntity],
    ][]) {
      const code = codeFromArcProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number | boolean);
      } else {
        switch (property) {
          case 'center':
            yield* serializePoint(value as IPoint, 10);
            break;
          case 'startAngle':
            yield* serializeGroupValue(50, value as number);
            break;
          case 'endAngle':
            yield* serializeGroupValue(51, value as number);
            break;
          case 'extrusionDirection':
            yield* serializePoint(value as IPoint, 210);
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
