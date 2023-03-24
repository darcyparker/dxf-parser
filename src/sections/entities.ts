import log from 'loglevel';

import type { IGroup, GroupValue } from '../DxfArrayScanner';
import type { ParseState } from '../DxfParser';
import { DXFSymbol } from '../DxfParser.js';
import { ensureHandle } from '../ParseHelpers.js';
import type { IEntity, EntityName } from '../entities/geometry';
import type IGeometry from '../entities/geometry';

/**
 * Is called after the parser first reads the 0:ENTITIES group. The scanner
 * should be on the start of the first entity already.
 * @return the resulting entities
 */
export const parseEntities = (
  parseState: ParseState,
  forBlock: boolean,
): IEntity[] => {
  const { scanner, entityHandlers } = parseState;
  const entities: IEntity[] = [];

  const endingOnValue: DXFSymbol.EndBlk | DXFSymbol.EndSec = forBlock
    ? DXFSymbol.EndBlk
    : DXFSymbol.EndSec;

  let curr = forBlock
    ? scanner.lastReadGroup ?? scanner.next()
    : scanner.next();

  //eslint-disable-next-line no-constant-condition
  while (true) {
    if (curr.code === 0) {
      if (curr.value === endingOnValue) {
        break;
      }

      const handler = entityHandlers[curr.value as EntityName];
      if (handler != null) {
        log.debug(curr.value + ' {');
        const entity = handler.parseEntity(scanner);
        curr = scanner.lastReadGroup as IGroup<GroupValue>;
        log.debug('}');
        ensureHandle(parseState, entity);
        entities.push(entity);
      } else {
        log.warn('Unhandled entity ' + curr.value);
        curr = scanner.next();
        continue;
      }
    } else {
      // ignored lines from unsupported entity
      curr = scanner.next();
    }
  }
  if (endingOnValue === DXFSymbol.EndSec) curr = scanner.next(); // swallow up ENDSEC, but not ENDBLK
  return entities;
};

export const serializeEntities = function* (
  entities: IEntity[],
  entityHandlers: Partial<Record<EntityName, IGeometry<IEntity>>>,
  includeSection = true,
): IterableIterator<string> {
  //section name
  if (includeSection) {
    yield '2';
    yield DXFSymbol.Entities;
  }

  //Note: Each `entity.handle` was created by `ensureHandle()` and will be a number
  //Currently there are no `entity.handle` that are string. If entity.handle was optionally
  //created and assigned a string by `handler.parseEntity()`, then the corresponding `handler.serializeEntity()`
  //implementation must consider whether the value is a string, and if so, serialize it. See `parseBlock()` and
  //`serializeBlock()` for example.

  for (const entity of entities) {
    const { type } = entity;
    const handler = entityHandlers[type];
    if (handler != null && handler.serializeEntity) {
      yield* handler.serializeEntity(entity);
    }
  }
};
