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

export type ICircleEntity = IEntity & {
  type: EntityName.Circle;
  center: IPoint;
  radius: number;
  startAngle: number;
  endAngle: number;
  angleLength: number;
  extrusionDirectionX: number;
  extrusionDirectionY: number;
  extrusionDirectionZ: number;
};

const circlePropertyFromCode = new Map<number, keyof ICircleEntity>([
  [40, 'radius'],
  [70, 'standardFlags'],
  [210, 'extrusionDirectionX'],
  [220, 'extrusionDirectionY'],
  [230, 'extrusionDirectionZ'],
]);

const codeFromCircleProperty = new Map<keyof ICircleEntity, number>(
  Array.from(circlePropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

const radToDeg = Math.PI / 180;
const degToRad = 180 / Math.PI;

export default class Circle implements IGeometry<ICircleEntity> {
  public ForEntityName = EntityName.Circle;
  public parseEntity(scanner: DxfArrayScanner): ICircleEntity {
    const entity = { type: this.ForEntityName } as ICircleEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      const property = circlePropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as number) = curr.value as number;
      } else {
        switch (curr.code) {
          case 10: // X coordinate of point
            entity.center = parsePoint(scanner);
            break;
          case 50: // start angle
            entity.startAngle = radToDeg * (curr.value as number);
            break;
          case 51: // end angle
            //eslint-disable-next-line no-case-declarations
            const endAngle = (entity.endAngle =
              radToDeg * (curr.value as number));
            if (endAngle < entity.startAngle)
              entity.angleLength = endAngle + 2 * Math.PI - entity.startAngle;
            else entity.angleLength = endAngle - entity.startAngle;
            break;
          default:
            // ignored attribute
            checkCommonEntityProperties(entity, curr, scanner);
            break;
        }
      }
      curr = scanner.next();
    }
    return entity;
  }
  public *serializeEntity(entity: ICircleEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof ICircleEntity,
      ICircleEntity[keyof ICircleEntity],
    ][]) {
      const code = codeFromCircleProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number | boolean);
      } else {
        switch (property) {
          case 'center':
            yield* serializePoint(value as IPoint, 10);
            break;
          case 'startAngle':
            yield* serializeGroupValue(50, (value as number) * degToRad);
            break;
          case 'endAngle':
            yield* serializeGroupValue(51, (value as number) * degToRad);
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
