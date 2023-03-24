import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import type { GroupValue } from '../DxfArrayScanner';
import {
  checkCommonEntityProperties,
  parsePoint,
  serializeCommonEntityProperty,
  serializePoint,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export type IMtextEntity = IEntity & {
  type: EntityName.Mtext;
  text: string;
  position: IPoint;
  directionVector: IPoint;
  height: number;
  width: number;
  rotation: number;
  attachmentPoint: number;
  drawingDirection: number;
};

const mTextPropertyFromCode = new Map<number, keyof IMtextEntity>([
  [40, 'height'],
  [41, 'width'],
  [50, 'rotation'],
  [70, 'standardFlags'],
  [71, 'attachmentPoint'],
  [72, 'drawingDirection'],
]);

const codeFromMTextProperty = new Map<keyof IMtextEntity, number>(
  Array.from(mTextPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

export default class Mtext implements IGeometry<IMtextEntity> {
  public ForEntityName = EntityName.Mtext;
  public parseEntity(scanner: DxfArrayScanner): IMtextEntity {
    const entity = { type: this.ForEntityName } as IMtextEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      const property = mTextPropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as GroupValue) = curr.value;
      } else {
        //special cases
        switch (curr.code) {
          case 3:
            //additional text (received in 250 character chunks)
            entity.text
              ? (entity.text += curr.value)
              : (entity.text = curr.value as string);
            break;
          case 1:
            //If the text string is less than 250 characters, all chars arrive in group code 1
            //otherwise the string is in 250 character chunks which arrive in one or more group code 3
            entity.text
              ? (entity.text += curr.value)
              : (entity.text = curr.value as string);
            break;
          case 10:
            entity.position = parsePoint(scanner);
            break;
          case 11:
            entity.directionVector = parsePoint(scanner);
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

  public *serializeEntity(entity: IMtextEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IMtextEntity,
      IMtextEntity[keyof IMtextEntity],
    ][]) {
      const code = codeFromMTextProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number);
      } else {
        //special cases
        let chunks: string[];
        switch (property) {
          case 'text':
            //Break up string into 250 char chunks
            chunks = (value as string).match(/(.|[\r\n]){1,250}/g) ?? [];
            if (chunks.length === 1) {
              yield '1';
              yield value as string;
            } else {
              for (const chunk of chunks) {
                yield '3';
                yield chunk;
              }
            }
            break;
          case 'position':
            yield* serializePoint(value as IPoint, 10);
            break;
          case 'directionVector':
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
