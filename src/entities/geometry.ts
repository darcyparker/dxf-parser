import type DxfArrayScanner from '../DxfArrayScanner';

export type IPoint = {
  x: number;
  y: number;
  z?: number; //if undefined, it is a 2D point
};

export type IEntity = {
  lineType: string;
  layer: string;
  lineTypeScale: number;
  visible: boolean;
  colorIndex: number;
  color: number;
  entityFollows: number;
  inPaperSpace: boolean;
  ownerHandle: string;
  materialObjectHandle: number;
  //From https://www.woutware.com/Forum/Topic/955/lineweight?returnUrl=%2FForum%2FUserPosts%3FuserId%3D478262319
  // An integer representing 100th of mm, must be one of the following values:
  // 0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211.
  // -3 = STANDARD, -2 = BYLAYER, -1 = BYBLOCK
  lineweight:
    | 0
    | 5
    | 9
    | 13
    | 15
    | 18
    | 20
    | 25
    | 30
    | 35
    | 40
    | 50
    | 53
    | 60
    | 70
    | 80
    | 90
    | 100
    | 106
    | 120
    | 140
    | 158
    | 200
    | 211
    | -3
    | -2
    | -1;
  type: EntityName;
  handle: number;
  standardFlags: number;
};

export const enum EntityName {
  Point = 'POINT',
  ThreeDFace = '3DFACE',
  Arc = 'ARC',
  Attdef = 'ATTDEF',
  Circle = 'CIRCLE',
  Dimension = 'DIMENSION',
  Multileader = 'MULTILEADER',
  Ellipse = 'ELLIPSE',
  Insert = 'INSERT',
  Line = 'LINE',
  Lwpolyline = 'LWPOLYLINE',
  Mtext = 'MTEXT',
  Polyline = 'POLYLINE',
  Solid = 'SOLID',
  Spline = 'SPLINE',
  Text = 'TEXT',
  Vertex = 'VERTEX',
}

export default interface IGeometry<T extends IEntity> {
  ForEntityName: EntityName;
  parseEntity(scanner: DxfArrayScanner): T;
  serializeEntity(entity: T): IterableIterator<string>;
}
