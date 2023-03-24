import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import type { GroupValue } from '../DxfArrayScanner';
import {
  checkCommonEntityProperties,
  parsePoint,
  serializePoint,
  serializeCommonEntityProperty,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export interface ITextEntity extends IEntity {
  type: EntityName.Text;
  startPoint: IPoint;
  endPoint: IPoint;
  textHeight: number;
  xScale: number;
  rotation: number;
  text: string;
  halign: number;
  valign: number;
}

const textPropertyFromCode = new Map<number, keyof ITextEntity>([
  [40, 'textHeight'],
  [41, 'xScale'],
  [70, 'standardFlags'],
  [50, 'rotation'],
  [1, 'text'],
  // NOTE: 72 and 73 are meaningless without 11 (second alignment point)
  [72, 'halign'],
  [73, 'valign'],
]);

const codeFromTextProperty = new Map<keyof ITextEntity, number>(
  Array.from(textPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

export default class Text implements IGeometry<ITextEntity> {
  public ForEntityName = EntityName.Text;
  public parseEntity(scanner: DxfArrayScanner): ITextEntity {
    const entity = { type: this.ForEntityName } as ITextEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      const property = textPropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as GroupValue) = curr.value;
      } else {
        //special cases
        switch (curr.code) {
          case 10: // X coordinate of 'first alignment point'
            entity.startPoint = parsePoint(scanner);
            break;
          case 11: // X coordinate of 'second alignment point'
            entity.endPoint = parsePoint(scanner);
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

  public *serializeEntity(entity: ITextEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof ITextEntity,
      ITextEntity[keyof ITextEntity],
    ][]) {
      const code = codeFromTextProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number);
      } else {
        //special cases
        switch (property) {
          case 'startPoint':
            yield* serializePoint(entity.startPoint, 10);
            break;
          case 'endPoint':
            yield* serializePoint(entity.endPoint, 11);
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
