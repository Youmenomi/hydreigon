import { IndexType, report } from './helper';

const pkgName = 'hydreigon';

export type Node = {
  index: IndexType;
  branch?: (IndexType | Node)[];
};

export type Branch<IItem extends { [key in IndexType]: any } = any> = Map<
  IndexType,
  Map<IndexType, Set<IItem> | Hydreigon<IItem>>
>;

export class Hydreigon<
  IItem extends { [key in IndexType]: any } = any,
  TCondition extends [IndexType, any] = any
> {
  protected _items = new Set<IItem>();
  protected _branch: Branch<IItem> = new Map();
  protected _branchMap?: Map<IndexType, (IndexType | Node)[]>;
  protected _compareFn?: (a: IItem, b: IItem) => number;

  constructor(...heads: (IndexType | Node)[]) {
    heads.forEach((head) => {
      if (typeof head === 'object') {
        const { branch } = head;
        if (branch) {
          this._branchMap = new Map();
          this._branchMap.set(head.index, branch);
        }
        this._branch.set(head.index, new Map());
      } else {
        this._branch.set(head, new Map());
      }
    });
  }

  items(returnArray: true): IItem[];
  items(returnArray?: false): Set<IItem>;
  items(returnArray = false) {
    return returnArray ? [...this._items] : new Set(this._items);
  }

  get size() {
    return this._items.size;
  }

  add(...items: IItem[]) {
    items.forEach((item) => {
      this.internalAdd(item);
    });
  }

  protected internalAdd(item: IItem, sort = true) {
    if (this._items.has(item)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Hydreigon] The added item already exists.');
      }
      return;
    }

    this._items.add(item);
    if (sort && this._compareFn && this._items.size > 1) {
      const arr = [...this._items].sort(this._compareFn);
      this._items.clear();
      this._items = new Set(arr);
    }

    this._branch.forEach((map, index) => {
      //@ts-expect-error https://github.com/microsoft/TypeScript/issues/1863
      const value = item[index];
      const items = map.get(value);
      if (!items) {
        const heads = this._branchMap && this._branchMap.get(index);
        if (heads) {
          const indexer = new Hydreigon(...heads);
          indexer.sort = this._compareFn;
          indexer.internalAdd(item, false);
          map.set(value, indexer);
        } else {
          map.set(value, new Set([item]));
        }
      } else {
        if (items instanceof Set) {
          items.add(item);
          if (sort && this._compareFn && items.size > 1) {
            const arr = [...items].sort(this._compareFn);
            items.clear();
            map.set(value, new Set(arr));
          }
        } else {
          items.internalAdd(item, sort);
        }
      }
    });
  }

  delete(...items: IItem[]) {
    items.forEach((item) => {
      this.internalDelete(item);
    });
  }

  protected internalDelete(item: IItem) {
    if (!this._items.has(item)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Hydreigon] The removed item does not exist.');
      }
      return;
    }

    this._items.delete(item);

    this._branch.forEach((map, index) => {
      //@ts-expect-error https://github.com/microsoft/TypeScript/issues/1863
      const value = item[index];
      const items = map.get(value);
      /* istanbul ignore next */
      if (!items) throw report(pkgName);
      items.delete(item);
      if (items.size === 0) {
        map.delete(value);
      }
    });
  }

  search(returnArray: true, ...conditions: TCondition[]): IItem[];
  search(returnArray: false, ...conditions: TCondition[]): Set<IItem>;
  search(returnArray: boolean, ...conditions: TCondition[]) {
    const items = this.internalSearch(conditions.concat(), false);
    if (returnArray) {
      return items ? [...items] : [];
    } else {
      return new Set(items);
    }
  }

  protected internalSearch(conditions: TCondition[], size: true): number;
  protected internalSearch(
    conditions: TCondition[],
    size: boolean
  ): Set<IItem> | undefined;
  protected internalSearch(
    conditions: TCondition[],
    size: boolean
  ): number | Set<IItem> | undefined {
    const condition = conditions.shift();
    if (!condition)
      throw new Error('[Hydreigon] No search conditions are provided.');
    const [index, value] = condition;

    const map = this._branch.get(index);
    if (!map) {
      throw new Error(
        `[Hydreigon] The searched property "${String(
          index
        )}" does not exist in the constructor heads parameter.`
      );
    }

    const indexerOrSet = map.get(value);
    if (!indexerOrSet) return size ? 0 : undefined;

    if (indexerOrSet instanceof Hydreigon) {
      if (conditions.length === 0)
        return size ? indexerOrSet._items.size : indexerOrSet._items;
      else {
        const [nextIndex] = conditions[0];
        const branch = this._branchMap && this._branchMap.get(index);
        if (branch && branch.includes(nextIndex)) {
          return indexerOrSet.internalSearch(conditions, size);
        } else {
          throw new Error(
            `[Hydreigon] The searched branch "${String(
              nextIndex
            )}" does not exist in the branch "${String(index)}".`
          );
        }
      }
    } else {
      if (conditions.length > 0) {
        const [nextIndex] = conditions[0];
        throw new Error(
          `[Hydreigon] The searched branch "${String(
            nextIndex
          )}" does not exist in the branch "${String(index)}".`
        );
      }
      return size ? indexerOrSet.size : indexerOrSet;
    }
  }

  searchSize(...conditions: TCondition[]): number {
    return this.internalSearch(conditions, true);
  }

  get sort() {
    return this._compareFn;
  }
  set sort(compareFn: ((a: IItem, b: IItem) => number) | undefined) {
    if (this._compareFn === compareFn) return;
    this._compareFn = compareFn;

    this.refresh();
  }

  readd(...items: IItem[]) {
    items.forEach((item) => {
      this.internalDelete(item);
      this.internalAdd(item);
    });
  }

  refresh() {
    if (this._items.size > 1) {
      const arr = [...this._items].sort(this._compareFn);
      this.clear();
      arr.forEach((item) => {
        this.internalAdd(item, false);
      });
    }
  }

  clear() {
    this._branch.forEach((map) => {
      map.forEach((indexerOrSet) => {
        if (indexerOrSet instanceof Set) {
          indexerOrSet.clear();
        } else {
          indexerOrSet.dispose();
        }
      });
      map.clear();
    });
    this._items.clear();
  }

  dispose() {
    this.clear();

    this._branch.clear();
    //@ts-expect-error
    this._branch = undefined;
    //@ts-expect-error
    this._items = undefined;
    if (this._branchMap) {
      this._branchMap.clear();
      this._branchMap = undefined;
    }
    this._compareFn = undefined;
  }
}
