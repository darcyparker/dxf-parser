import log from 'loglevel';

import type DxfArrayScanner from '../DxfArrayScanner';
import type { IGroup, GroupValue } from '../DxfArrayScanner';
import { serializeGroupValue } from '../DxfArrayScanner.js';
import type { ParseState } from '../DxfParser';
import { DXFSymbol } from '../DxfParser.js';
import {
  groupIs,
  ensureHandle,
  logUnhandledGroup,
  parsePoint,
  serializePoint,
} from '../ParseHelpers.js';
import type { EntityName, IEntity, IPoint } from '../entities/geometry';
import type IGeometry from '../entities/geometry';
import type { DxfEntity } from '../index';
import { parseEntities, serializeEntities } from './entities.js';

type IEndBlock = {
  handle?: string;
  ownerHandler?: string;
  layer?: string;
  paperSpace?: boolean;
};

export type IBlock = {
  entities: DxfEntity[];
  type: number;
  noBlockType?: boolean;
  ownerHandle: string;
  xrefPath: string;
  name: string;
  name2: string;
  handle: string | number; //number if string not defined
  layer: string;
  position: IPoint;
  paperSpace: boolean;
  endBlock?: IEndBlock;
};

export type Blocks = Record<string, IBlock>;

const parseEndBlock = (scanner: DxfArrayScanner): IEndBlock | undefined => {
  const endBlock = {} as IEndBlock;
  let curr = scanner.lastReadGroup as IGroup<GroupValue>;
  while (curr.value !== DXFSymbol.EOF && curr.code != 0) {
    switch (curr.code) {
      case 5:
        endBlock.handle = curr.value as string;
        break;
      case 67:
        endBlock.paperSpace = curr.value === 1;
        break;
      case 8:
        endBlock.layer = curr.value as string;
        break;
      case 330:
        endBlock.ownerHandler = curr.value as string;
        break;
      default:
        logUnhandledGroup(curr);
    }
    curr = scanner.next();
  }

  return Object.keys(endBlock).length ? endBlock : undefined;
};

export const serializeEndBlock = function* (
  endBlock: IEndBlock | undefined,
): IterableIterator<string> {
  if (endBlock) {
    for (const [property, value] of Object.entries(endBlock) as [
      keyof IEndBlock,
      IEndBlock[keyof IEndBlock],
    ][]) {
      switch (property) {
        case 'handle':
          yield '5';
          yield value as string;
          break;
        case 'layer':
          yield '8';
          yield value as string;
          break;
        case 'paperSpace':
          yield '67';
          yield endBlock.paperSpace ? '1' : '0';
          break;
        case 'ownerHandler':
          yield '330';
          yield value as string;
          break;
      }
    }
  }
};

const blockPropertyFromCode = new Map<number, keyof IBlock>([
  [1, 'xrefPath'],
  [2, 'name'],
  [3, 'name2'],
  [5, 'handle'],
  [8, 'layer'],
  [330, 'ownerHandle'],
]);

const codeFromBlockProperty = new Map<keyof IBlock, number>(
  Array.from(blockPropertyFromCode.entries()).map(([code, property]) => [
    property,
    code,
  ]),
);
//delete special cases that are are handled differently when serializing and parsing
codeFromBlockProperty.delete('handle');

const parseBlock = (parseState: ParseState): IBlock => {
  const { scanner } = parseState;
  const block = {} as IBlock;
  let curr = scanner.next();
  while (curr.value !== DXFSymbol.EOF) {
    const property = blockPropertyFromCode.get(curr.code);
    if (property != null) {
      (block[property] as GroupValue) = curr.value;
    } else {
      //Special cases of setting properties
      switch (curr.code) {
        case 10:
          block.position = parsePoint(scanner);
          break;
        case 67:
          block.paperSpace = curr.value === 1;
          break;
        case 70:
          if (curr.value === 0) {
            block.noBlockType = true;
          } else {
            //if(curr.value & BLOCK_ANONYMOUS_FLAG) console.log('  Anonymous block');
            //if(curr.value & BLOCK_NON_CONSTANT_FLAG) console.log('  Non-constant attributes');
            //if(curr.value & BLOCK_XREF_FLAG) console.log('  Is xref');
            //if(curr.value & BLOCK_XREF_OVERLAY_FLAG) console.log('  Is xref overlay');
            //if(curr.value & BLOCK_EXTERNALLY_DEPENDENT_FLAG) console.log('  Is externally dependent');
            //if(curr.value & BLOCK_RESOLVED_OR_DEPENDENT_FLAG) console.log('  Is resolved xref or dependent of an xref');
            //if(curr.value & BLOCK_REFERENCED_XREF) console.log('  This definition is a referenced xref');
            block.type = curr.value as number;
          }
          break;
        //case 100:
        //  // ignore class markers
        //  break;
        case 0:
          if (curr.value !== DXFSymbol.EndBlk) {
            block.entities = parseEntities(parseState, true);
            curr = scanner.lastReadGroup as IGroup<GroupValue>;
          }
          //All property cases need to call scanner.next(), except when `entities` is created, so rewind to make the following scanner.next()
          //to put scanner's pointer in correct position.
          scanner.rewind();
          break;
        default:
          logUnhandledGroup(curr);
      }
    }
    curr = scanner.next();
    if (groupIs(curr, 0, DXFSymbol.EndBlk)) {
      curr = scanner.next();
      if (
        !groupIs(curr, 0, DXFSymbol.Block) &&
        !groupIs(curr, 0, DXFSymbol.EndSec) &&
        curr.value !== DXFSymbol.EOF
      ) {
        const endBlock = parseEndBlock(scanner);
        if (endBlock) {
          block.endBlock = endBlock;
        }
      }
      break;
    }
  }
  ensureHandle(parseState, block);
  return block;
};

export const serializeBlock = function* (
  block: IBlock,
  entityHandlers: Partial<Record<EntityName, IGeometry<IEntity>>>,
): IterableIterator<string> {
  //start of block
  yield '0';
  yield DXFSymbol.Block;
  for (const [property, value] of Object.entries(block) as [
    keyof IBlock,
    IBlock[keyof IBlock],
  ][]) {
    const code = codeFromBlockProperty.get(property);
    if (code != null) {
      yield* serializeGroupValue(code, value as GroupValue);
    } else {
      //Special cases
      switch (property) {
        case 'handle':
          if (typeof value === 'string') {
            yield '5';
            yield value;
          }
          //otherwise 'handle' was not in original DXF and was added by `ensureHandle()` which created a number
          break;
        case 'position':
          yield* serializePoint(block.position, 10);
          break;
        case 'paperSpace':
          yield '67';
          yield block.paperSpace ? '1' : '0';
          break;
        case 'noBlockType':
          yield '70';
          yield '0';
          break;
        case 'type':
          yield '70';
          yield `${block.type}`;
          break;
        case 'entities':
          yield* serializeEntities(block.entities, entityHandlers, false);
          break;
      }
    }
  }

  //end of block
  yield '0';
  yield DXFSymbol.EndBlk;
  yield* serializeEndBlock(block.endBlock);
};

export const parseBlocks = (parseState: ParseState): Blocks => {
  const { scanner } = parseState;
  const blocks: Blocks = {};

  let curr = scanner.next();

  while (curr.value !== DXFSymbol.EOF) {
    if (groupIs(curr, 0, DXFSymbol.EndSec)) {
      break;
    }

    if (groupIs(curr, 0, DXFSymbol.Block)) {
      log.debug('block {');
      const block = parseBlock(parseState);
      curr = scanner.lastReadGroup as IGroup<GroupValue>;
      log.debug('}');
      if (!block.name)
        log.error(`block with handle "${block.handle}" is missing a name.`);
      else blocks[block.name] = block;
    } else {
      logUnhandledGroup(curr);
      curr = scanner.next();
    }
  }
  return blocks;
};

export const serializeBlocks = function* (
  blocks: Blocks,
  entityHandlers: Partial<Record<EntityName, IGeometry<IEntity>>>,
): IterableIterator<string> {
  //section name
  yield '2';
  yield DXFSymbol.Blocks;

  for (const block of Object.values(blocks)) {
    yield* serializeBlock(block, entityHandlers);
  }
};
