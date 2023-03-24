import type DxfArrayScanner from '../DxfArrayScanner';
import type { IGroup, GroupValue } from '../DxfArrayScanner';
import {
  checkCommonEntityProperties,
  serializeCommonEntityProperty,
  serializePoint,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export type I3DfaceEntity = IEntity & {
  type: EntityName.ThreeDFace;
  shape: boolean;
  hasContinuousLinetypePattern: boolean;
  vertices: IPoint[];
};

const verticesPer3dFace = 4; // there can be up to four vertices per face, although 3 is most used for TIN

const parse3dFaceVertices = (
  scanner: DxfArrayScanner,
): I3DfaceEntity['vertices'] => {
  let curr = scanner.lastReadGroup as IGroup<GroupValue>;

  const vertices: I3DfaceEntity['vertices'] = [];
  let vertexIsStarted = false;
  let vertexIsFinished = false;

  for (let i = 0; i <= verticesPer3dFace; i++) {
    const vertex = {} as IPoint;
    while (!scanner.isEOF()) {
      if (curr.code === 0 || vertexIsFinished) break;

      switch (curr.code) {
        case 10: // X0
        case 11: // X1
        case 12: // X2
        case 13: // X3
          if (vertexIsStarted) {
            vertexIsFinished = true;
            continue;
          }
          vertex.x = curr.value as number;
          vertexIsStarted = true;
          break;
        case 20: // Y
        case 21:
        case 22:
        case 23:
          vertex.y = curr.value as number;
          break;
        case 30: // Z
        case 31:
        case 32:
        case 33:
          vertex.z = curr.value as number;
          break;
        default:
          // it is possible to have entity codes after the vertices.
          // So if code is not accounted for return to entity parser where it might be accounted for
          return vertices;
      }
      curr = scanner.next();
    }
    // See https://groups.google.com/forum/#!topic/comp.cad.autocad/9gn8s5O_w6E
    vertices.push(vertex);
    vertexIsStarted = false;
    vertexIsFinished = false;
  }
  scanner.rewind();
  return vertices;
};

export default class ThreeDface implements IGeometry<I3DfaceEntity> {
  public ForEntityName = EntityName.ThreeDFace;
  public parseEntity(scanner: DxfArrayScanner): I3DfaceEntity {
    const entity = { type: this.ForEntityName } as I3DfaceEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;
      switch (curr.code) {
        case 70: // 1 = Closed shape, 128 = plinegen?, 0 = default
          entity.standardFlags = curr.value as number;
          entity.shape = ((curr.value as number) & 1) === 1;
          entity.hasContinuousLinetypePattern =
            ((curr.value as number) & 128) === 128;
          break;
        case 10: // X coordinate of point
          entity.vertices = parse3dFaceVertices(scanner);
          curr = scanner.lastReadGroup as IGroup<GroupValue>;
          break;
        default:
          checkCommonEntityProperties(entity, curr, scanner);
          break;
      }
      curr = scanner.next();
    }
    return entity;
  }

  public *serializeEntity(entity: I3DfaceEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof I3DfaceEntity,
      I3DfaceEntity[keyof I3DfaceEntity],
    ][]) {
      switch (property) {
        case 'standardFlags':
          yield '70';
          yield `${value}`;
          break;
        case 'vertices':
          for (const [index, vertex] of (value as IPoint[]).entries()) {
            yield* serializePoint(vertex, index + 10);
          }
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
