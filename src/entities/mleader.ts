import log from 'loglevel';
import type { IGroup, GroupValue } from '../DxfArrayScanner';
import type DxfArrayScanner from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import {
  Matrix4,
  serializeCommonEntityProperty,
  serializePoint,
  serializeMatrix,
} from '../ParseHelpers.js';
import {
  checkCommonEntityProperties,
  parsePoint,
  parseMatrix,
} from '../ParseHelpers.js';
import type IGeometry from './geometry';
import type { IEntity, IPoint } from './geometry';
import { EntityName } from './geometry.js';

// Helpful doc at https://atlight.github.io/formats/dxf-leader.html
// Codes at https://images.autodesk.com/adsk/files/autocad_2012_pdf_dxf-reference_enu.pdf

export type ILeaderEntity = IEntity & {
  type: EntityName.Multileader;
  arrowHeadId: number; // 342 & 345
  arrowHeadIndex: number; // 94
  arrowHeadSize: number; // 42
  blockAttributeId: number; // 330
  blockAttributeIndex: number; // 177
  blockAttributeTextString: string; // 302
  blockAttributeWidth: number; // 44
  blockContentColor: number; // 93
  blockContentConnectionType: number; // 176
  blockContentId: number; // 344
  blockContentRotation: number; // 43
  blockContentScale: IPoint; // 10
  contentType: number; // 172
  doglegLength: number; // 41
  enableAnotationScale: boolean; // 293
  enableDogLeg: boolean; // 291
  enableFrameText: boolean; // 292
  enableLanding: boolean; // 290
  leaderLineColor: number; // 91
  leaderLineType: number; // 170
  leaderLineTypeId: number; // 341
  leaderLineWeight: number; // 171
  leaderStyleId: number; // 340
  propertyOverrideFlag: number; // 90
  textAlignInIPE: number; // 178
  textAlignmentType: number; // 175
  textAngleType: number; // 174
  textAttachmentDirectionBottom: number; // 272
  textAttachmentDirectionMText: number; // 271
  textAttachmentDirectionTop: number; // 273
  textAttachmentPoint: number; // 179
  textColor: number; // 92
  textDirectionNegative: boolean; // 294
  textLeftAttachmentType: number; // 173
  textLineSpacingStyleFactor: number; //45
  textRightAttachmentType: number; // 95
  textStyleId: number; // 343

  contextData: IMLeaderContextData; // 300
};

type IMLeaderContextData = {
  //textColor: (typo in spec doc, which says 90. 90 is breakPointIndex above. textBackgroundTransparency (like other textColor) is 92)
  arrowHeadSize: number; // 140
  blockAttributeIndex: number; // 177
  blockContentColor: number; // 93
  blockContentConnectionType: number; // 176
  blockContentId: number; // 341
  blockContentNormalDirection: IPoint; // 14,24,34
  blockContentPosition: IPoint; // 15,25,35
  blockContentRotation: number; // 46
  blockContentScale: number; // 16
  blockTransformationMatrix: Matrix4; // 47
  breakPointIndex: number; //90
  contentBasePosition: IPoint; // 10,20,30
  contentScale: number; // 40
  defaultTextContents: string; // 304
  hasBlock: boolean; // 296
  hasMText: boolean; // 290
  landingGap: number; // 145
  planeNormalReversed: boolean; // 297
  planeOriginPoint: IPoint; // 110 (120,130)
  planeXAxisDirection: IPoint; // 111 (121,131)
  planeYAxisDirection: IPoint; // 112 (122,132)
  textAlignmentType: number; // 175
  textAngleType: number; // 174
  textAttachment: number; // 171
  textBackgroundColor: number; // 91
  textBackgroundColorOn: boolean; // 291
  textBackgroundFillOn: boolean; // 292
  textBackgroundScaleFactor: number; // 141
  textBackgroundTransparency: number; // 92
  textColumnFlowReversed: boolean; // 294
  textColumnGutterWidth: number; // 143
  textColumnHeight: number; // 144
  textColumnType: number; // 173
  textColumnWidth: number; // 142
  textDirection: IPoint; // 13,23,33
  textFlowDirection: number; // 172
  textHeight2: number; // 44
  textHeight: number; // 41
  textLineSpacingFactor: number; // 45
  textLineSpacingStyle: number; // 170
  textLocation: IPoint; // 12,22,32
  textNormalDirection: IPoint; // 11,21,31
  textRotation: number; // 42
  textStyleId: number; //340
  textUseAutoHeight: boolean; // 293
  textUseWordBreak: boolean; // 295
  textWidth: number; // 43

  leaders: IMLeaderLeader[]; // 302
};

type IMLeaderLeader = {
  breakEndPoint: IPoint; // 13,23,33
  breakStartPoint: IPoint; // 12,22,32
  doglegLength: number; // 40
  doglegVector: IPoint; // 11,21,31
  hasSetDoglegVector: boolean; // 291
  hasSetLastLeaderLinePoint: boolean; // 290
  lastLeaderLinePoint: IPoint; // 10,20,30
  leaderBranchIndex: number; // 90

  leaderLines: IMLeaderLine[]; // 303
};

type IMLeaderLine = {
  breakEndPoint: IPoint; // 12,22,32
  breakPointIndex: number; // 90,
  breakStartPoint: IPoint; // 11,21,33
  leaderLineIndex: number; // 91
  vertices: IPoint[]; // 10,20,30
};

const parseLeaderLineData = (
  scanner: DxfArrayScanner,
  leader: IMLeaderLeader,
): void => {
  let curr = scanner.lastReadGroup as IGroup<GroupValue>;

  const line = {} as IMLeaderLine;
  if (!leader.leaderLines) leader.leaderLines = [];
  leader.leaderLines.push(line);

  while (!scanner.isEOF()) {
    switch (curr.code) {
      case 10:
        if (!line.vertices) {
          line.vertices = [];
        }
        line.vertices.push(parsePoint(scanner));
        break;
      case 11:
        line.breakStartPoint = parsePoint(scanner);
        break;
      case 12:
        line.breakEndPoint = parsePoint(scanner);
        break;
      case 90:
        line.breakPointIndex = curr.value as number;
        break;
      case 91:
        line.leaderLineIndex = curr.value as number;
        break;
      case 305: // END LEADER_LINE
        return;
      default:
        break;
    }

    curr = scanner.next();
  }
};

const serializeLeaderLineData = function* (
  line: IMLeaderLine,
): IterableIterator<string> {
  // START LEADER_LINE
  yield '304';
  yield 'LEADER_LINE{';
  for (const [property, value] of Object.entries(line)) {
    switch (property) {
      case 'vertices':
        for (const vertex of value as IPoint[]) {
          yield* serializePoint(vertex, 10);
        }
        break;
      case 'breakStartPoint':
        yield* serializePoint(value as IPoint, 11);
        break;
      case 'breakEndPoint':
        yield* serializePoint(value as IPoint, 12);
        break;
      case 'breakPointIndex':
        yield* serializeGroupValue(90, value as number);
        break;
      case 'leaderLineIndex':
        yield* serializeGroupValue(91, value as number);
        break;
    }
  }

  // END LEADER_LINE
  yield '305';
  yield '}';
};

const leaderPropertyFromCode = new Map<number, keyof IMLeaderLeader>([
  [40, 'doglegLength'],
  [90, 'leaderBranchIndex'],
  [290, 'hasSetLastLeaderLinePoint'],
  [291, 'hasSetDoglegVector'],
]);

const codeFromLeaderProperty = new Map<keyof IMLeaderLeader, number>(
  Array.from(leaderPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

const parseLeaderData = (
  scanner: DxfArrayScanner,
  leaders: IMLeaderLeader[],
): void => {
  let curr = scanner.lastReadGroup as IGroup<GroupValue>;
  const leader = {} as IMLeaderLeader;

  leaders.push(leader);

  while (!scanner.isEOF()) {
    const property = leaderPropertyFromCode.get(curr.code);
    if (property != null) {
      (leader[property] as number | boolean) = curr.value as number | boolean;
    } else {
      //special cases
      switch (curr.code) {
        case 10:
          leader.lastLeaderLinePoint = parsePoint(scanner);
          break;
        case 11:
          leader.doglegVector = parsePoint(scanner);
          break;
        case 12:
          leader.breakStartPoint = parsePoint(scanner);
          break;
        case 13:
          leader.breakEndPoint = parsePoint(scanner);
          break;
        case 303: // END LEADER
          return;
        case 304: // START LEADER_LINE
          parseLeaderLineData(scanner, leader);
          break;
        default:
          break;
      }
    }
    curr = scanner.next();
  }
};

const serializeLeaderData = function* (
  leader: IMLeaderLeader,
): IterableIterator<string> {
  // START LEADER
  yield '302';
  yield 'LEADER{';

  for (const [property, value] of Object.entries(leader) as [
    keyof IMLeaderLeader,
    IMLeaderLeader[keyof IMLeaderLeader],
  ][]) {
    const code = codeFromLeaderProperty.get(property);
    if (code != null) {
      yield* serializeGroupValue(code, value as string | number | boolean);
    } else {
      //special cases
      switch (property) {
        case 'lastLeaderLinePoint':
          yield* serializePoint(value as IPoint, 10);
          break;
        case 'doglegVector':
          yield* serializePoint(value as IPoint, 11);
          break;
        case 'leaderLines':
          for (const leaderLine of leader.leaderLines) {
            yield* serializeLeaderLineData(leaderLine);
          }
          break;
      }
    }
  }

  // END LEADER
  yield '303';
  yield '}';
};

const contextDataPropertyFromCode = new Map<
  number,
  [keyof IMLeaderContextData, boolean?]
>([
  [10, ['contentBasePosition', true]],
  [11, ['textNormalDirection', true]],
  [12, ['textLocation', true]],
  [13, ['textDirection', true]],
  [14, ['blockContentNormalDirection', true]],
  [15, ['blockContentPosition', true]],
  [16, ['blockContentScale']],
  [40, ['contentScale']],
  [41, ['textHeight']],
  [42, ['textRotation']],
  [43, ['textWidth']],
  [44, ['textHeight2']],
  [45, ['textLineSpacingFactor']],
  [46, ['blockContentRotation']],
  [90, ['breakPointIndex']],
  [91, ['textBackgroundColor']],
  [92, ['textBackgroundTransparency']],
  [93, ['blockContentColor']],
  [110, ['planeOriginPoint', true]],
  [111, ['planeXAxisDirection', true]],
  [112, ['planeYAxisDirection', true]],
  [140, ['arrowHeadSize']],
  [141, ['textBackgroundScaleFactor']],
  [142, ['textColumnWidth']],
  [143, ['textColumnGutterWidth']],
  [144, ['textColumnHeight']],
  [145, ['landingGap']],
  [170, ['textLineSpacingStyle']],
  [171, ['textAttachment']],
  [172, ['textFlowDirection']],
  [173, ['textColumnType']],
  [174, ['textAngleType']],
  [175, ['textAlignmentType']],
  [176, ['blockContentConnectionType']],
  [177, ['blockAttributeIndex']],
  [290, ['hasMText']],
  [291, ['textBackgroundColorOn']],
  [292, ['textBackgroundFillOn']],
  [293, ['textUseAutoHeight']],
  [294, ['textColumnFlowReversed']],
  [295, ['textUseWordBreak']],
  [296, ['hasBlock']],
  [297, ['planeNormalReversed']],
  [304, ['defaultTextContents']],
  [340, ['textStyleId']],
  [341, ['blockContentId']],
]);

const codeFromContextDataProperty = new Map<
  keyof IMLeaderContextData,
  [number, boolean?]
>(
  Array.from(contextDataPropertyFromCode.entries()).map(
    ([code, [property, isPoint]]) => [
      property,
      [code, ...(isPoint ? [isPoint] : [])] as [number, boolean?],
    ],
  ),
);

const parseContextData = (
  scanner: DxfArrayScanner,
  contextData: IMLeaderContextData,
): void => {
  let curr = scanner.lastReadGroup as IGroup<GroupValue>;
  while (!scanner.isEOF()) {
    const propertyAndIsPoint = contextDataPropertyFromCode.get(curr.code);
    if (propertyAndIsPoint != null) {
      const [property, isPoint] = propertyAndIsPoint;
      (contextData[property] as IPoint | string | boolean | number) = isPoint
        ? parsePoint(scanner)
        : (curr.value as string | number | boolean);
    } else {
      switch (curr.code) {
        case 47:
          contextData.blockTransformationMatrix = parseMatrix(scanner, 47);
          break;
        case 301: // END CONTEXT_DATA
          if (
            contextData.blockTransformationMatrix &&
            contextData.blockTransformationMatrix.length != 16
          ) {
            log.error(
              `blockTransformationMatrix.length=${contextData.blockTransformationMatrix.length}. Expected 16.`,
            );
          }
          return;
        case 302: // START LEADER
          if (!contextData.leaders) {
            contextData.leaders = [];
          }
          parseLeaderData(scanner, contextData.leaders);
          break;
        default:
          break;
      }
    }

    curr = scanner.next();
  }
};

const serializeContextData = function* (
  contextData: IMLeaderContextData,
): IterableIterator<string> {
  // START CONTEXT_DATA
  yield '300';
  yield 'CONTEXT_DATA{';

  for (const [property, value] of Object.entries(contextData) as [
    keyof IMLeaderContextData,
    IMLeaderContextData[keyof IMLeaderContextData],
  ][]) {
    const codeAndType = codeFromContextDataProperty.get(property);
    if (codeAndType != null) {
      const [code, isPoint] = codeAndType;
      if (isPoint) {
        yield* serializePoint(value as IPoint, code);
      } else {
        yield* serializeGroupValue(code, value as string | number | boolean);
      }
    } else {
      //special cases
      switch (property) {
        case 'blockTransformationMatrix':
          yield* serializeMatrix(value as Matrix4, 47);
          break;
        case 'leaders':
          for (const leader of value as IMLeaderLeader[]) {
            yield* serializeLeaderData(leader);
          }
          break;
      }
    }
  }

  // END CONTEXT_DATA
  yield '301';
  yield '}';
};

const mleaderPropertyFromCode = new Map<number, keyof ILeaderEntity>([
  [41, 'doglegLength'],
  [42, 'arrowHeadSize'],
  [43, 'blockContentRotation'],
  [44, 'blockAttributeWidth'],
  [45, 'textLineSpacingStyleFactor'],
  [90, 'propertyOverrideFlag'],
  [91, 'leaderLineColor'],
  [92, 'textColor'],
  [93, 'blockContentColor'],
  [94, 'arrowHeadIndex'],
  [95, 'textRightAttachmentType'],
  [170, 'leaderLineType'],
  [171, 'leaderLineWeight'],
  [172, 'contentType'],
  [173, 'textLeftAttachmentType'],
  [174, 'textAngleType'],
  [175, 'textAlignmentType'],
  [176, 'blockContentConnectionType'],
  [177, 'blockAttributeIndex'],
  [178, 'textAlignInIPE'],
  [179, 'textAttachmentPoint'],
  [271, 'textAttachmentDirectionMText'],
  [272, 'textAttachmentDirectionBottom'],
  [273, 'textAttachmentDirectionTop'],
  [290, 'enableLanding'],
  [291, 'enableDogLeg'],
  [292, 'enableFrameText'],
  [293, 'enableAnotationScale'],
  [294, 'textDirectionNegative'],
  [302, 'blockAttributeTextString'],
  [330, 'blockAttributeId'],
  [340, 'leaderStyleId'],
  [341, 'leaderLineTypeId'],
  [342, 'arrowHeadId'],
  [343, 'textStyleId'],
  [344, 'blockContentId'],
]);

const codeFromMLeaderProperty = new Map<keyof ILeaderEntity, number>(
  Array.from(mleaderPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);

export default class MLeader implements IGeometry<ILeaderEntity> {
  public ForEntityName = EntityName.Multileader;

  public parseEntity(scanner: DxfArrayScanner): ILeaderEntity {
    const entity = { type: this.ForEntityName } as ILeaderEntity;
    scanner.next();

    let curr = scanner.lastReadGroup as IGroup<GroupValue>;
    while (!scanner.isEOF()) {
      if (curr.code === 0) {
        break;
      }
      const property = mleaderPropertyFromCode.get(curr.code);
      if (property != null) {
        (entity[property] as number | boolean) = curr.value as number | boolean;
      } else {
        switch (curr.code) {
          case 10:
            entity.blockContentScale = parsePoint(scanner);
            break;

          case 300: // START CONTEXT_DATA
            if (!entity.contextData) {
              entity.contextData = {} as IMLeaderContextData;
            }
            parseContextData(scanner, entity.contextData);
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

  public *serializeEntity(entity: ILeaderEntity): IterableIterator<string> {
    for (const [property, value] of Object.entries(entity) as [
      keyof ILeaderEntity,
      ILeaderEntity[keyof ILeaderEntity],
    ][]) {
      const code = codeFromMLeaderProperty.get(property);
      if (code != null) {
        yield* serializeGroupValue(code, value as string | number | boolean);
      } else {
        //special cases
        switch (property) {
          case 'blockContentScale':
            yield* serializePoint(value as IPoint, 10);
            break;
          case 'contextData':
            yield* serializeContextData(value as IMLeaderContextData);
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
