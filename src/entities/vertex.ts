import type DxfArrayScanner from '../DxfArrayScanner';
import type { GroupValue } from '../DxfArrayScanner';
import {
  checkCommonEntityProperties,
  serializePoint,
  serializeCommonEntityProperty,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export type IVertexEntity = IEntity &
  IPoint & {
    type: EntityName.Vertex;
    bulge: number;
    curveFittingVertex: boolean;
    curveFitTangent: boolean;
    splineVertex: boolean;
    splineControlPoint: boolean;
    threeDPolylineVertex: boolean;
    threeDPolylineMesh: boolean;
    polyfaceMeshVertex: boolean;
    faceA: number;
    faceB: number;
    faceC: number;
    faceD: number;
  };

const vertexPropertyFromCode = new Map<number, keyof IVertexEntity>([
  [70, 'standardFlags'],
  [71, 'faceA'],
  [72, 'faceB'],
  [73, 'faceC'],
  [74, 'faceD'],
]);

const codeFromVertexProperty = new Map<keyof IVertexEntity, string>(
  Array.from(vertexPropertyFromCode.entries()).map(([code, property]) => [
    property,
    `${code}`,
  ]),
);
//delete special cases that are are handled differently when serializing and parsing
vertexPropertyFromCode.delete(70);

export default class Vertex implements IGeometry<IVertexEntity> {
  public ForEntityName = EntityName.Vertex;
  public parseEntity(scanner: DxfArrayScanner): IVertexEntity {
    const entity = { type: this.ForEntityName } as IVertexEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      const property = vertexPropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as GroupValue) = curr.value;
      } else {
        //special cases
        switch (curr.code) {
          case 10: // X
            entity.x = curr.value as number;
            break;
          case 20: // Y
            entity.y = curr.value as number;
            break;
          case 30: // Z
            entity.z = curr.value as number;
            break;
          case 40: // start width
            break;
          case 41: // end width
            break;
          case 42: // bulge
            //Note: bulge is optional and default is 0. So no need to add if it is 0
            if (curr.value != 0) entity.bulge = curr.value as number;
            break;
          case 70: // flags
            entity.standardFlags = curr.value as number;
            entity.curveFittingVertex = ((curr.value as number) & 1) !== 0;
            entity.curveFitTangent = ((curr.value as number) & 2) !== 0;
            entity.splineVertex = ((curr.value as number) & 8) !== 0;
            entity.splineControlPoint = ((curr.value as number) & 16) !== 0;
            entity.threeDPolylineVertex = ((curr.value as number) & 32) !== 0;
            entity.threeDPolylineMesh = ((curr.value as number) & 64) !== 0;
            entity.polyfaceMeshVertex = ((curr.value as number) & 128) !== 0;
            break;
          case 50: // curve fit tangent direction
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

  public *serializeEntity(entity: IVertexEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IVertexEntity,
      IVertexEntity[keyof IVertexEntity],
    ][]) {
      const code = codeFromVertexProperty.get(property);
      if (code != null) {
        yield code;
        yield `${value}`;
      } else {
        switch (property) {
          case 'x':
            yield* serializePoint(entity, 10);
            break;
          case 'y':
          case 'z':
            break; //already handled by serializePoint()
          case 'bulge':
            //Note: bulge is optional and default is 0, so if undefined, no need to yield
            yield '42';
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
}
