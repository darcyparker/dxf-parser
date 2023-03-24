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

export type IInsertEntity = IEntity & {
  type: EntityName.Insert;
  name: string;
  xScale: number;
  yScale: number;
  zScale: number;
  position: IPoint;
  rotation: number;
  columnCount: number;
  rowCount: number;
  columnSpacing: number;
  rowSpacing: number;
  extrusionDirection: IPoint;
};

const insertPropertyFromCode = new Map<number, keyof IInsertEntity>([
  [2, 'name'],
  [41, 'xScale'],
  [42, 'yScale'],
  [43, 'zScale'],
  [50, 'rotation'],
  [70, 'columnCount'],
  [71, 'rowCount'],
  [44, 'columnSpacing'],
  [45, 'rowSpacing'],
]);

const codeFromInsertProperty = new Map<keyof IInsertEntity, number>(
  Array.from(insertPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

export default class Insert implements IGeometry<IInsertEntity> {
  public ForEntityName = EntityName.Insert;
  public parseEntity(scanner: DxfArrayScanner): IInsertEntity {
    const entity = { type: this.ForEntityName } as IInsertEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      const property = insertPropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as string | number) = curr.value as string | number;
      } else {
        //special cases
        switch (curr.code) {
          case 10:
            entity.position = parsePoint(scanner);
            break;
          case 210:
            entity.extrusionDirection = parsePoint(scanner);
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

  public *serializeEntity(entity: IInsertEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IInsertEntity,
      IInsertEntity[keyof IInsertEntity],
    ][]) {
      const code = codeFromInsertProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number | boolean);
      } else {
        switch (property) {
          case 'position':
            yield* serializePoint(value as IPoint, 10);
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
