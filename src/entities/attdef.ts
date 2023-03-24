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

export type IAttdefEntity = IEntity & {
  type: EntityName.Attdef;
  scale: number;
  serializeScale?: boolean;
  textStyle: 'STANDARD' | string;
  serializeTextStyle?: boolean;
  text: string;
  tag: string;
  prompt: string;
  startPoint: IPoint;
  endPoint: IPoint;
  thickness: number;
  textHeight: number;
  rotation: number; //degrees
  obliqueAngle: number;
  invisible: boolean;
  constant: boolean;
  verificationRequired: boolean;
  preset: boolean;
  backwards: boolean;
  mirrored: boolean;
  horizontalJustification: number;
  fieldLength: number;
  verticalJustification: number;
  extrusionDirectionX: number;
  extrusionDirectionY: number;
  extrusionDirectionZ: number;
  flags71: number;
};

const attdefPropertyFromCode = new Map<number, keyof IAttdefEntity>([
  [1, 'text'],
  [2, 'tag'],
  [3, 'prompt'],
  [7, 'textStyle'],
  [39, 'thickness'],
  [40, 'textHeight'],
  [41, 'scale'],
  [50, 'rotation'],
  [51, 'obliqueAngle'],
  [70, 'standardFlags'],
  [71, 'flags71'],
  [72, 'horizontalJustification'], // TODO: enum values?
  [73, 'fieldLength'],
  [74, 'verticalJustification'], // TODO: enum values?
  [210, 'extrusionDirectionX'],
  [220, 'extrusionDirectionY'],
  [230, 'extrusionDirectionZ'],
]);

const codeFromAttdefProperty = new Map<keyof IAttdefEntity, number>(
  Array.from(attdefPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);
//delete special cases that are are handled differently when serializing and parsing
codeFromAttdefProperty.delete('scale');
codeFromAttdefProperty.delete('textStyle');
attdefPropertyFromCode.delete(70);
attdefPropertyFromCode.delete(71);

export default class Attdef implements IGeometry<IAttdefEntity> {
  public ForEntityName = EntityName.Attdef;
  public parseEntity(scanner: DxfArrayScanner): IAttdefEntity {
    const entity = { type: this.ForEntityName } as IAttdefEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) {
        break;
      }
      const property = attdefPropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as string | number) = curr.value as string | number;
      } else {
        switch (curr.code) {
          case 10: // X coordinate of 'first alignment point'
            entity.startPoint = parsePoint(scanner);
            break;
          case 11: // X coordinate of 'second alignment point'
            entity.endPoint = parsePoint(scanner);
            break;
          case 70:
            entity.standardFlags = curr.value as number;
            entity.invisible = !!((curr.value as number) & 0x01);
            entity.constant = !!((curr.value as number) & 0x02);
            entity.verificationRequired = !!((curr.value as number) & 0x04);
            entity.preset = !!((curr.value as number) & 0x08);
            break;
          case 71:
            entity.flags71 = curr.value as number;
            entity.backwards = !!((curr.value as number) & 0x02);
            entity.mirrored = !!((curr.value as number) & 0x04);
            break;
          case 100:
            break;
          default:
            checkCommonEntityProperties(entity, curr, scanner);
            break;
        }
      }
      curr = scanner.next();
    }
    if (entity.scale == null) {
      entity.scale = 1;
    } else {
      entity.serializeScale = true;
    }
    if (entity.textStyle == null) {
      entity.textStyle = 'STANDARD';
    } else {
      entity.serializeTextStyle = true;
    }

    return entity;
  }

  public *serializeEntity(entity: IAttdefEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IAttdefEntity,
      IAttdefEntity[keyof IAttdefEntity],
    ][]) {
      const code = codeFromAttdefProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number | boolean);
      } else {
        switch (property) {
          case 'scale':
            if (entity.serializeScale) {
              yield* serializeGroupValue(
                41,
                value as string | number | boolean,
              );
            }
            break;
          case 'textStyle':
            if (entity.serializeTextStyle) {
              yield* serializeGroupValue(7, value as string | number | boolean);
            }
            break;
          case 'startPoint':
            yield* serializePoint(value as IPoint, 10);
            break;
          case 'endPoint':
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
