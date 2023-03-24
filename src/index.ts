export { default, default as DxfParser, DXFSymbol } from './DxfParser.js';
export type { IDxf } from './DxfParser';
export type { IBlock } from './sections/blocks';
export type {
  IBaseTable,
  ILayer,
  ILayerTableDefinition,
  ILineTypesTable,
  ILayersTable,
  ILineType,
  ILineTypeTableDefinition,
  ITable,
  ITableDefinitions,
  ITables,
  IViewPort,
  IViewPortTable,
  IViewPortTableDefinition,
} from './sections/tables';

import type { I3DfaceEntity } from './entities/3dface';
import type { IArcEntity } from './entities/arc';
import type { IAttdefEntity } from './entities/attdef';
import type { ICircleEntity } from './entities/circle';
import type { IDimensionEntity } from './entities/dimension';
import type { ILeaderEntity } from './entities/mleader';
import type { IEllipseEntity } from './entities/ellipse';
import type { IInsertEntity } from './entities/insert';
import type { ILineEntity } from './entities/line';
import type { ILwpolylineEntity } from './entities/lwpolyline';
import type { IMtextEntity } from './entities/mtext';
import type { IPointEntity } from './entities/point';
import type { IPolylineEntity } from './entities/polyline';
import type { ISolidEntity } from './entities/solid';
import type { ISplineEntity } from './entities/spline';
import type { ITextEntity } from './entities/text';
import type { IVertexEntity } from './entities/vertex';

export type { IEntity, IPoint } from './entities/geometry';
export type { I3DfaceEntity } from './entities/3dface';
export type { IArcEntity } from './entities/arc';
export type { IAttdefEntity } from './entities/attdef';
export type { ICircleEntity } from './entities/circle';
export type { IDimensionEntity } from './entities/dimension';
export type { ILeaderEntity } from './entities/mleader';
export type { IEllipseEntity } from './entities/ellipse';
export type { IInsertEntity } from './entities/insert';
export type { ILineEntity } from './entities/line';
export type { ILwpolylineEntity } from './entities/lwpolyline';
export type { IMtextEntity } from './entities/mtext';
export type { IPointEntity } from './entities/point';
export type { IPolylineEntity } from './entities/polyline';
export type { ISolidEntity } from './entities/solid';
export type { ISplineEntity } from './entities/spline';
export type { ITextEntity } from './entities/text';
export type { IVertexEntity } from './entities/vertex';

export type DxfEntity =
  I3DfaceEntity |
  IArcEntity |
  IAttdefEntity |
  ICircleEntity |
  IDimensionEntity |
  ILeaderEntity |
  IEllipseEntity |
  IInsertEntity |
  ILineEntity |
  ILwpolylineEntity |
  IMtextEntity |
  IPointEntity |
  IPolylineEntity |
  ISolidEntity |
  ISplineEntity |
  ITextEntity |
  IVertexEntity;
