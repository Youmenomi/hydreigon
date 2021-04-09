import { Branch, Hydreigon, Node } from '../src';
import { IndexType } from '../src/helper';

export function unprotect<IItem extends { [key in IndexType]: any } = any>(
  hydreigon: Hydreigon<IItem>
) {
  return hydreigon as Hydreigon & {
    _items: Set<IItem>;
    _branch: Branch<IItem>;
    _branchMap?: Map<IndexType, (IndexType | Node)[]>;
  };
}

export function expectedSearch<IItem extends { [key in IndexType]: any } = any>(
  hydreigon: Hydreigon<IItem>,
  conditions: [IndexType, any][],
  match: IItem[]
) {
  expect(hydreigon.search(false, ...conditions)).toEqual(new Set(match));
  expect(hydreigon.search(true, ...conditions)).toEqual(match);
}

export function expectedItems<IItem extends { [key in IndexType]: any } = any>(
  hydreigon: Hydreigon<IItem>,
  match: IItem[]
) {
  expect(hydreigon.items()).toEqual(new Set(match));
  expect(hydreigon.items(true)).toEqual(match);
}
