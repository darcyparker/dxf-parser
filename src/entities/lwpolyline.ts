import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import type { IGroup, GroupValue } from '../DxfArrayScanner';
import {
  checkCommonEntityProperties,
  serializeCommonEntityProperty,
  serializePoint,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

export type IVertex = IPoint & {
  startWidth: number;
  endWidth: number;
  bulge: number;
};

export type ILwpolylineEntity = IEntity & {
  type: EntityName.Lwpolyline;
  vertices: IVertex[];
  expectedVerticesCount: number;
  elevation: number;
  depth: number;
  shape: boolean;
  hasContinuousLinetypePattern: boolean;
  width: number;
  extrusionDirectionX: number;
  extrusionDirectionY: number;
  extrusionDirectionZ: number;
};

const parseLWPolylineVertices = (
  n: number,
  scanner: DxfArrayScanner,
): IVertex[] => {
  if (!n || n <= 0) throw Error('n must be greater than 0 verticies');
  const vertices = [] as IVertex[];
  let vertexIsStarted = false;
  let vertexIsFinished = false;
  let curr = scanner.lastReadGroup as IGroup<GroupValue>;

  for (let i = 0; i < n; i++) {
    const vertex = {} as IVertex;
    while (!scanner.isEOF()) {
      if (curr.code === 0 || vertexIsFinished) break;

      switch (curr.code) {
        case 10: // X
          if (vertexIsStarted) {
            vertexIsFinished = true;
            continue;
          }
          vertex.x = curr.value as number;
          vertexIsStarted = true;
          break;
        case 20: // Y
          vertex.y = curr.value as number;
          break;
        case 30: // Z
          vertex.z = curr.value as number;
          break;
        case 40: // start width
          vertex.startWidth = curr.value as number;
          break;
        case 41: // end width
          vertex.endWidth = curr.value as number;
          break;
        case 42: // bulge
          if (curr.value != 0) vertex.bulge = curr.value as number;
          break;
        default:
          // if we do not hit known code return vertices.  Code might belong to entity
          scanner.rewind();
          if (vertexIsStarted) {
            vertices.push(vertex);
          }
          scanner.rewind();
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

const serializeLWPolylineVertices = function* (
  vertices: IVertex[],
  code: number,
): IterableIterator<string> {
  for (const vertex of vertices) {
    for (const [property, value] of Object.entries(vertex) as [
      keyof IVertex,
      IVertex[keyof IVertex],
    ][])
      switch (property) {
        case 'x':
          yield* serializePoint(vertex, code);
          break;
        case 'y':
        case 'z':
          break; //already handled by serializePoint()
        case 'startWidth':
          yield* serializeGroupValue(40, value as string | number | boolean);
          break;
        case 'endWidth':
          yield* serializeGroupValue(41, value as string | number | boolean);
          break;
        case 'bulge':
          //Note: bulge is optional and default is 0, so if undefined, no need to yield
          yield* serializeGroupValue(42, value as string | number | boolean);
          break;
      }
  }
};

const lwpolylinePropertyFromCode = new Map<number, keyof ILwpolylineEntity>([
  [38, 'elevation'],
  [39, 'depth'],
  [70, 'standardFlags'],
  [210, 'extrusionDirectionX'],
  [220, 'extrusionDirectionY'],
  [230, 'extrusionDirectionZ'],
]);

const codeFromLwpolylineProperty = new Map<keyof ILwpolylineEntity, number>(
  Array.from(lwpolylinePropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);
//delete special cases that are are handled differently when serializing and parsing
lwpolylinePropertyFromCode.delete(70);

export default class Lwpolyline implements IGeometry<ILwpolylineEntity> {
  public ForEntityName = EntityName.Lwpolyline;
  public parseEntity(scanner: DxfArrayScanner): ILwpolylineEntity {
    const entity = { type: this.ForEntityName } as ILwpolylineEntity;
    let numberOfVertices = 0;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      const property = lwpolylinePropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as number) = curr.value as number;
      } else {
        //special cases
        switch (curr.code) {
          case 70: // 1 = Closed shape, 128 = plinegen?, 0 = default
            entity.standardFlags = curr.value as number;
            entity.shape = ((curr.value as number) & 1) === 1;
            entity.hasContinuousLinetypePattern =
              ((curr.value as number) & 128) === 128;
            break;
          case 90:
            entity.expectedVerticesCount = numberOfVertices =
              curr.value as number;
            break;
          case 10: // X coordinate of point
            entity.vertices = parseLWPolylineVertices(
              numberOfVertices,
              scanner,
            );
            break;
          case 43:
            entity.width = curr.value as number;
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

  public *serializeEntity(entity: ILwpolylineEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof ILwpolylineEntity,
      ILwpolylineEntity[keyof ILwpolylineEntity],
    ][]) {
      const code = codeFromLwpolylineProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number | boolean);
      } else {
        //special cases
        switch (property) {
          case 'expectedVerticesCount':
            yield '90';
            yield `${value}`;
            break;
          case 'vertices':
            yield* serializeLWPolylineVertices(value as IVertex[], 10);
            break;
          case 'width':
            yield* serializeGroupValue(43, value as string | number | boolean);
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
