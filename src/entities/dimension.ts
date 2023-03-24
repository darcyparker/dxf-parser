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

export type IDimensionEntity = IEntity & {
  type: EntityName.Dimension;
  block: string;
  anchorPoint: IPoint;
  middleOfText: IPoint;
  insertionPoint: IPoint;
  linearOrAngularPoint1: IPoint;
  linearOrAngularPoint2: IPoint;
  diameterOrRadiusPoint: IPoint;
  arcPoint: IPoint;
  dimensionType: number;
  attachmentPoint: number;
  actualMeasurement: number;
  text: string;
  angle: number;
  extrusionDirection: IPoint;
};

const dimensionPropertyFromCode = new Map<
  number,
  [keyof IDimensionEntity, boolean?]
>([
  [2, ['block']], // Referenced block name
  [10, ['anchorPoint', true]], // X coordinate of 'first alignment point'
  [11, ['middleOfText', true]],
  [12, ['insertionPoint', true]], // Insertion point for clones of a dimension
  [13, ['linearOrAngularPoint1', true]], // Definition point for linear and angular dimensions
  [14, ['linearOrAngularPoint2', true]], // Definition point for linear and angular dimensions
  [15, ['diameterOrRadiusPoint', true]], // Definition point for diameter, radius, and angular dimensions
  [16, ['arcPoint', true]], // Point defining dimension arc for angular dimensions
  [70, ['dimensionType']], // Dimension type
  [71, ['attachmentPoint']], // 5 = Middle center
  [42, ['actualMeasurement']], // Actual measurement
  [1, ['text']], // Text entered by user explicitly
  [50, ['angle']], //rotation angle
]);

const codeFromDimensionProperty = new Map<
  keyof IDimensionEntity,
  [number, boolean?]
>(
  Array.from(dimensionPropertyFromCode.entries()).map(
    ([code, [property, isPoint]]) => [
      property,
      [code, ...(isPoint ? [isPoint] : [])] as [number, boolean?],
    ],
  ),
);

export default class Dimension implements IGeometry<IDimensionEntity> {
  public ForEntityName = EntityName.Dimension;
  public parseEntity(scanner: DxfArrayScanner): IDimensionEntity {
    const entity = { type: this.ForEntityName } as IDimensionEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      const propertyAndIsPoint = dimensionPropertyFromCode.get(curr.code);
      if (propertyAndIsPoint != null) {
        const [property, isPoint] = propertyAndIsPoint;
        (entity[property] as string | number | IPoint) = isPoint
          ? parsePoint(scanner)
          : (curr.value as string | number);
      } else {
        switch (curr.code) {
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
  public *serializeEntity(entity: IDimensionEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IDimensionEntity,
      IDimensionEntity[keyof IDimensionEntity],
    ][]) {
      const codeAndIsPoint = codeFromDimensionProperty.get(property);
      if (codeAndIsPoint != null) {
        const [code, isPoint] = codeAndIsPoint;
        if (isPoint) {
          yield* serializePoint(value as IPoint, code);
        } else {
          yield* serializeGroupValue(code, value as string | number | boolean);
        }
      } else {
        yield* serializeCommonEntityProperty(property, value, entity);
      }
    }
  }
}
