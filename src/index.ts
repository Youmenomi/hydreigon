import { report } from './helper';

const pkgName = 'hydreigon';

export type Node = {
  index: PropertyKey;
  branch?: (PropertyKey | Node)[];
};

export type Branch<TItem extends { [key in PropertyKey]: any } = any> = Map<
  PropertyKey,
  Map<PropertyKey, Set<TItem> | Hydreigon<TItem>>
>;

export class Hydreigon<
  TItem extends { [key in PropertyKey]: any } = any,
  TCondition extends [PropertyKey, any] = [PropertyKey, any],
> {
  protected _items = new Set<TItem>();
  protected _branch: Branch<TItem> = new Map();
  protected _branchMap?: Map<PropertyKey, (PropertyKey | Node)[]>;
  protected _compareFn?: (a: TItem, b: TItem) => number;

  constructor(...heads: (PropertyKey | Node)[]) {
    heads.forEach((head) => {
      const index = typeof head === 'object' ? head.index : head;
      const branch = typeof head === 'object' ? head.branch : undefined;

      if (process.env.NODE_ENV === 'development' && this._branch.has(index)) {
        console.warn(
          '[Hydreigon] Duplicate index of head. The previous one will be overwritten.',
        );
      }

      if (branch) {
        if (!this._branchMap) this._branchMap = new Map();
        this._branchMap.set(index, branch);
      } else if (this._branchMap?.delete(index) && this._branchMap.size === 0) {
        // Overwriting with a branch-less head: drop any stale branch mapping
        // so _branch and _branchMap stay consistent for this index, and keep
        // _branchMap undefined when no branch heads remain.
        this._branchMap = undefined;
      }
      this._branch.set(index, new Map());
    });
  }

  items(returnArray: true): TItem[];
  items(returnArray?: false): Set<TItem>;
  items(returnArray = false) {
    return returnArray ? [...this._items] : new Set(this._items);
  }

  get size() {
    return this._items.size;
  }

  add(...items: TItem[]) {
    items.forEach((item) => {
      this.internalAdd(item);
    });
    // Sort once after the whole batch instead of on every insertion.
    if (this._compareFn) this.refresh();
  }

  protected internalAdd(item: TItem) {
    if (this._items.has(item)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Hydreigon] The added item already exists.');
      }
      return;
    }

    this._items.add(item);

    this._branch.forEach((map, index) => {
      const value = item[index];
      const items = map.get(value);
      if (!items) {
        const heads = this._branchMap?.get(index);
        if (heads) {
          const indexer = new Hydreigon(...heads);
          indexer.sort = this._compareFn;
          indexer.internalAdd(item);
          map.set(value, indexer);
        } else {
          map.set(value, new Set([item]));
        }
      } else if (items instanceof Set) {
        items.add(item);
      } else {
        items.internalAdd(item);
      }
    });
  }

  delete(...items: TItem[]) {
    items.forEach((item) => {
      this.internalDelete(item);
    });
  }

  protected internalDelete(item: TItem) {
    if (!this._items.has(item)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Hydreigon] The removed item does not exist.');
      }
      return;
    }

    this._items.delete(item);

    this._branch.forEach((map, index) => {
      const value = item[index];
      const items = map.get(value);
      /* v8 ignore next */
      if (!items) throw report(pkgName);
      items.delete(item);
      if (items.size === 0) {
        map.delete(value);
      }
    });
  }

  search(returnArray: true, ...conditions: TCondition[]): TItem[];
  search(returnArray: false, ...conditions: TCondition[]): Set<TItem>;
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
    size: boolean,
  ): Set<TItem> | undefined;
  protected internalSearch(
    conditions: TCondition[],
    size: boolean,
  ): number | Set<TItem> | undefined {
    const condition = conditions.shift();
    if (!condition)
      throw new Error('[Hydreigon] No search conditions are provided.');
    const [index, value] = condition;

    const map = this._branch.get(index);
    if (!map) {
      throw new Error(
        `[Hydreigon] The searched property "${String(
          index,
        )}" does not exist in the constructor heads parameter.`,
      );
    }

    const indexerOrSet = map.get(value);
    if (conditions.length === 0) {
      if (!indexerOrSet) {
        return size ? 0 : undefined;
      } else if (indexerOrSet instanceof Hydreigon) {
        return size ? indexerOrSet._items.size : indexerOrSet._items;
      } else {
        return size ? indexerOrSet.size : indexerOrSet;
      }
    } else {
      const [nextIndex] = conditions[0];
      const branch = this._branchMap?.get(index);
      if (
        branch &&
        !(indexerOrSet instanceof Set) &&
        branch.some((indexOrNode) => {
          if (typeof indexOrNode === 'object') {
            return indexOrNode.index === nextIndex;
          } else {
            return indexOrNode === nextIndex;
          }
        })
      ) {
        if (!indexerOrSet) {
          return size ? 0 : undefined;
        } else {
          return indexerOrSet.internalSearch(conditions, size);
        }
      } else {
        throw new Error(
          `[Hydreigon] The searched branch "${String(
            nextIndex,
          )}" does not exist in the branch "${String(index)}".`,
        );
      }
    }
  }

  searchSize(...conditions: TCondition[]): number {
    return this.internalSearch(conditions, true);
  }

  searchHas(item: TItem, ...conditions: TCondition[]) {
    const items = this.internalSearch(conditions, false);
    return items ? items.has(item) : false;
  }

  get sort() {
    return this._compareFn;
  }
  set sort(compareFn: ((a: TItem, b: TItem) => number) | undefined) {
    if (this._compareFn === compareFn) return;
    this._compareFn = compareFn;

    this.refresh();
  }

  readd(...items: TItem[]) {
    items.forEach((item) => {
      this.internalDelete(item);
      this.internalAdd(item);
    });
    if (this._compareFn) this.refresh();
  }

  refresh() {
    if (this._items.size > 1) {
      const arr = [...this._items].sort(this._compareFn);
      this.clear();
      arr.forEach((item) => {
        this.internalAdd(item);
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
    if (this._branchMap) {
      this._branchMap.clear();
      this._branchMap = undefined;
    }
    this._compareFn = undefined;
  }
}
