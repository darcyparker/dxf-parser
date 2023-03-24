import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import type { IGroup, GroupValue } from '../DxfArrayScanner';
import { DXFSymbol } from '../DxfParser.js';
import {
  checkCommonEntityProperties,
  parsePoint,
  serializeCommonEntityProperty,
  serializePoint,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';
import VertexParser from './vertex.js';
import type { IVertexEntity } from './vertex';

export type IPolylineEntity = IEntity & {
  type: EntityName.Polyline;
  vertices: IVertexEntity[];
  thickness: number;
  shape: boolean;
  includesCurveFitVertices: boolean;
  includesSplineFitVertices: boolean;
  is3dPolyline: boolean;
  is3dPolygonMesh: boolean;
  is3dPolygonMeshClosed: boolean;
  isPolyfaceMesh: boolean;
  hasContinuousLinetypePattern: boolean;
  extrusionDirection: IPoint;
  zeroPoint: IPoint; //Always {x: 0, y: 0, z: 0} but useful for serialization
};

const vertexParser = new VertexParser();

const parsePolylineVertices = (scanner: DxfArrayScanner): IVertexEntity[] => {
  const vertices: IVertexEntity[] = [];
  let curr = scanner.lastReadGroup as IGroup<GroupValue>;
  while (!scanner.isEOF()) {
    if (curr.code === 0) {
      if (curr.value === EntityName.Vertex) {
        vertices.push(vertexParser.parseEntity(scanner));
        curr = scanner.lastReadGroup as IGroup<GroupValue>;
      } else if (curr.value === DXFSymbol.SeqEnd) {
        while (!scanner.isEOF() && curr.code !== 0) {
          curr = scanner.next();
        }
        break;
      }
    }
  }
  return vertices;
};

const serializePolylineVertices = function* (
  vertices: IVertexEntity[],
): IterableIterator<string> {
  for (const vertex of vertices) {
    yield* vertexParser.serializeEntity(vertex);
  }
  yield '0';
  yield DXFSymbol.SeqEnd;
};

export default class Polyline implements IGeometry<IPolylineEntity> {
  public ForEntityName = EntityName.Polyline;
  public parseEntity(scanner: DxfArrayScanner): IPolylineEntity {
    const entity = { type: this.ForEntityName } as IPolylineEntity;
    let curr = scanner.next();
    while (!scanner.isEOF()) {
      if (curr.code === 0) break;

      switch (curr.code) {
        case 10: // always 0
          entity.zeroPoint = parsePoint(scanner); //Always {x: 0, y: 0, z: 0} but useful for serialization
          break;
        case 20: // always 0
          break;
        case 30: // elevation
          break;
        case 39: // thickness
          entity.thickness = curr.value as number;
          break;
        case 40: // start width
          break;
        case 41: // end width
          break;
        case 70:
          entity.standardFlags = curr.value as number;
          entity.shape = ((curr.value as number) & 1) !== 0;
          entity.includesCurveFitVertices = ((curr.value as number) & 2) !== 0;
          entity.includesSplineFitVertices = ((curr.value as number) & 4) !== 0;
          entity.is3dPolyline = ((curr.value as number) & 8) !== 0;
          entity.is3dPolygonMesh = ((curr.value as number) & 16) !== 0;
          entity.is3dPolygonMeshClosed = ((curr.value as number) & 32) !== 0; // 32 = The polygon mesh is closed in the N direction
          entity.isPolyfaceMesh = ((curr.value as number) & 64) !== 0;
          entity.hasContinuousLinetypePattern =
            ((curr.value as number) & 128) !== 0;
          break;
        case 71: // Polygon mesh M vertex count
          break;
        case 72: // Polygon mesh N vertex count
          break;
        case 73: // Smooth surface M density
          break;
        case 74: // Smooth surface N density
          break;
        case 75: // Curves and smooth surface type
          break;
        case 210:
          entity.extrusionDirection = parsePoint(scanner);
          break;
        default:
          checkCommonEntityProperties(entity, curr, scanner);
          break;
      }
      curr = scanner.next();
    }

    entity.vertices = parsePolylineVertices(scanner);

    return entity;
  }

  public *serializeEntity(entity: IPolylineEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof IPolylineEntity,
      IPolylineEntity[keyof IPolylineEntity],
    ][]) {
      switch (property) {
        case 'zeroPoint':
          yield* serializePoint(value as IPoint, 10);
          break;
        case 'thickness':
          yield* serializeGroupValue(39, value as number);
          break;
        case 'standardFlags':
          yield '70';
          yield `${value}`;
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
    //vertices (last because they are parsed last)
    yield* serializePolylineVertices(entity.vertices);
  }
}
