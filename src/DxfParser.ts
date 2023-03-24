import log from 'loglevel';
import type { Readable } from 'stream';

import DxfArrayScanner from './DxfArrayScanner.js';
import type { IGroup, GroupValue } from './DxfArrayScanner';
import { debugCode } from './ParseHelpers.js';
import Face from './entities/3dface.js';
import Arc from './entities/arc.js';
import AttDef from './entities/attdef.js';
import Circle from './entities/circle.js';
import Dimension from './entities/dimension.js';
import Ellipse from './entities/ellipse.js';
import type IGeometry from './entities/geometry';
import type { EntityName, IEntity } from './entities/geometry';
import Insert from './entities/insert.js';
import Line from './entities/line.js';
import LWPolyline from './entities/lwpolyline.js';
import MLeader from './entities/mleader.js';
import MText from './entities/mtext.js';
import Point from './entities/point.js';
import Polyline from './entities/polyline.js';
import Solid from './entities/solid.js';
import Spline from './entities/spline.js';
import Text from './entities/text.js';
import type { DxfEntity } from './index';
import { parseBlocks, serializeBlocks } from './sections/blocks.js';
import type { Blocks } from './sections/blocks';
import { parseClasses, serializeClasses } from './sections/classes.js';
import type { IClasses } from './sections/classes.js';
import { parseEntities, serializeEntities } from './sections/entities.js';
import { parseHeader, serializeHeader } from './sections/header.js';
import type { Header } from './sections/header';
import { parseTables, serializeTables } from './sections/tables.js';
import type { ITables } from './sections/tables';

//log.setLevel('trace');
//log.setLevel('debug');
//log.setLevel('info');
//log.setLevel('warn');
log.setLevel('error');
//log.setLevel('silent');

export const enum DXFSymbol {
  Section = 'SECTION',
  EOF = 'EOF',

  //Start markers
  Block = 'BLOCK', //start of block
  Table = 'TABLE', //start of table
  Class = 'CLASS', //start of class

  //End markers
  EndSec = 'ENDSEC', //end of section
  EndBlk = 'ENDBLK', //end of block
  EndTable = 'ENDTAB', //end of table
  SeqEnd = 'SEQEND', //end of sequence

  //SECTION types:
  Header = 'HEADER',
  Tables = 'TABLES',
  Blocks = 'BLOCKS',
  Entities = 'ENTITIES', //Also see EntityName enum defined in './entities/geometry'
  Classes = 'CLASSES',

  //Symbol table types:
  LType = 'LTYPE',
  Layer = 'LAYER',
  VPort = 'VPORT',

  //currently unhandled Symbol table types
  AppId = 'APPID',
  BlockRecord = 'BLOCK_RECORD',
  DimStyle = 'DIMSTYLE',
  Style = 'STYLE',
  UCS = 'UCS',
  View = 'VIEW',

  //currently unhandled SECTION type
  Objects = 'OBJECTS',
  ThumbnailImage = 'THUMBNAILIMAGE',
}

export type IDxf = {
  header?: Header;
  entities?: DxfEntity[];
  blocks?: Blocks;
  tables?: ITables;
  classes?: IClasses;
};

function registerDefaultEntityHandlers(dxfParser: DxfParser) {
  // Supported entities here (some entity code is still being refactored into this flow)
  dxfParser.registerEntityHandler(Face);
  dxfParser.registerEntityHandler(Arc);
  dxfParser.registerEntityHandler(AttDef);
  dxfParser.registerEntityHandler(Circle);
  dxfParser.registerEntityHandler(Dimension);
  dxfParser.registerEntityHandler(MLeader);
  dxfParser.registerEntityHandler(Ellipse);
  dxfParser.registerEntityHandler(Insert);
  dxfParser.registerEntityHandler(Line);
  dxfParser.registerEntityHandler(LWPolyline);
  dxfParser.registerEntityHandler(MText);
  dxfParser.registerEntityHandler(Point);
  dxfParser.registerEntityHandler(Polyline);
  dxfParser.registerEntityHandler(Solid);
  dxfParser.registerEntityHandler(Spline);
  dxfParser.registerEntityHandler(Text);
  //dxfParser.registerEntityHandler(require('./entities/vertex'));
}

export type ParseState = {
  readonly scanner: DxfArrayScanner;
  readonly dxf: IDxf;
  readonly entityHandlers: Partial<Record<EntityName, IGeometry<IEntity>>>;
  lastHandle: number;
};

const parseAll = (parseState: ParseState): void => {
  const { dxf, scanner } = parseState;
  let curr = scanner.next();
  while (!scanner.isEOF()) {
    if (curr.code === 0 && curr.value === DXFSymbol.Section) {
      curr = scanner.next();

      // Be sure we are reading a section code
      if (curr.code !== 2) {
        console.error(
          `Unexpected code ${debugCode(curr)} after 0:${DXFSymbol.Section}`,
        );
        curr = scanner.next();
        continue;
      }

      //Handle section names (HEADER, BLOCKS, ENTITIES, TABLES)
      switch (curr.value) {
        case DXFSymbol.Header:
          log.debug(`> ${curr.value}`);
          dxf.header = parseHeader(scanner);
          log.debug('<');
          break;
        case DXFSymbol.Blocks:
          log.debug(`> ${curr.value}`);
          dxf.blocks = parseBlocks(parseState);
          log.debug('<');
          break;
        case DXFSymbol.Entities:
          log.debug(`> ${curr.value}`);
          dxf.entities = parseEntities(parseState, false);
          log.debug('<');
          break;
        case DXFSymbol.Tables:
          log.debug(`> ${curr.value}`);
          dxf.tables = parseTables(scanner);
          log.debug('<');
          break;
        case DXFSymbol.Classes:
          log.debug(`> ${curr.value}`);
          dxf.classes = parseClasses(scanner);
          log.debug('<');
          break;
        case DXFSymbol.EOF:
          log.debug(DXFSymbol.EOF);
          break;
        default:
          //TODO: Consider caching the content of this skipped section for serialization
          log.warn(`Skipping section '${curr.value}'`);
      }
      curr = scanner.lastReadGroup as IGroup<GroupValue>;
    } else {
      curr = scanner.next();
    }
    // If is a new section
  }
};

const addNewlines = function* (
  lines: IterableIterator<string>,
): IterableIterator<string> {
  //Yield lines seperated by new lines. Does not include trailing new line
  const firstLine = lines.next();
  if (!firstLine.done) {
    yield firstLine.value; //first line
    for (const line of lines) {
      yield '\n'; //new line after preceeding line if !done
      yield line;
    }
  }
};

export default class DxfParser {
  private _entityHandlers: Partial<Record<EntityName, IGeometry<IEntity>>> = {};
  constructor() {
    registerDefaultEntityHandlers(this);
  }

  public parse(source: string): IDxf | null {
    if (typeof source === 'string') {
      return this._parse(source);
    } else {
      console.error('Cannot read dxf source of type `' + typeof source);
      return null;
    }
  }

  public registerEntityHandler<T extends IEntity>(
    handlerType: new () => IGeometry<T>,
  ): void {
    const instance = new handlerType();
    this._entityHandlers[instance.ForEntityName] = instance;
  }

  public parseSync(source: string): IDxf | null {
    return this.parse(source);
  }

  public parseStream(stream: Readable): Promise<IDxf> {
    let dxfString = '';
    //eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return new Promise<IDxf>((res, rej) => {
      stream.on('data', (chunk) => {
        dxfString += chunk;
      });
      stream.on('end', () => {
        try {
          res(self._parse(dxfString));
        } catch (err) {
          rej(err);
        }
      });
      stream.on('error', (err) => {
        rej(err);
      });
    });
  }

  //TODO
  //public parseBinary(source: Blob | ArrayBuffer): IDxf {
  //}

  //TODO
  //public parseBinaryStream(stream: Readable): Promise<IDxf> {
  //}

  public *serialize(dxf: IDxf): IterableIterator<string> {
    for (const section of Object.keys(dxf) as (keyof IDxf)[]) {
      //Start of section
      yield '0';
      yield DXFSymbol.Section;
      switch (section) {
        case 'header':
          yield* serializeHeader(dxf.header!);
          break;
        case 'entities':
          yield* serializeEntities(dxf.entities!, this._entityHandlers);
          break;
        case 'blocks':
          yield* serializeBlocks(dxf.blocks!, this._entityHandlers);
          break;
        case 'classes':
          yield* serializeClasses(dxf.classes!);
          break;
        case 'tables':
          yield* serializeTables(dxf.tables!);
          break;
      }
      //End of section
      yield '0';
      yield DXFSymbol.EndSec;
    }
    yield '0';
    yield DXFSymbol.EOF;
  }

  public serializeToString(dxf: IDxf): string {
    let acc = '';
    for (const line of addNewlines(this.serialize(dxf))) {
      acc += line;
    }
    return acc;
  }

  public serializeToBlob(dxf: IDxf): Blob {
    //For NodeJS < 18, Blob is defined on buffer.Blob. For NodeJS, >=18, Blob is a global
    //Blob constructor support Iterator as argument, but typescript is wrong, so case `as unknown as string[]`
    return new Blob(addNewlines(this.serialize(dxf)) as unknown as string[]);
  }

  //public serializeBinaryStream(dxf: IDxf): stream {
  //}

  private _parse(dxfString: string): IDxf {
    const dxfLinesArray = dxfString.split(/\r\n|\r|\n/g);
    const scanner = new DxfArrayScanner(dxfLinesArray);
    if (!scanner.hasNext()) throw Error('Empty file');
    const dxf = {} as IDxf;
    parseAll({
      scanner,
      dxf,
      entityHandlers: this._entityHandlers,
      lastHandle: 0,
    });
    return dxf;
  }
}

// const BLOCK_ANONYMOUS_FLAG = 1;
// const BLOCK_NON_CONSTANT_FLAG = 2;
// const BLOCK_XREF_FLAG = 4;
// const BLOCK_XREF_OVERLAY_FLAG = 8;
// const BLOCK_EXTERNALLY_DEPENDENT_FLAG = 16;
// const BLOCK_RESOLVED_OR_DEPENDENT_FLAG = 32;
// const BLOCK_REFERENCED_XREF = 64;

/* Notes */
// Code 6 of an entity indicates inheritance of properties (eg. color).
//   BYBLOCK means inherits from block
//   BYLAYER (default) mean inherits from layer
