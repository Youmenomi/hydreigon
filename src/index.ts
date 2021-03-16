import autoBind from 'auto-bind';
import { report } from './helper';

export class Hydreigon<IItem = any> {
  protected _compareFn?: (a: IItem, b: IItem) => number;
  protected _tied = new Set<Set<IItem> | (IItem | undefined)[]>();
  protected _props: (keyof IItem)[];
  protected _propMap = new Map<keyof IItem, Map<any, Set<IItem>>>();

  protected _items = new Set<IItem>();
  items(returnArray: true): IItem[];
  items(returnArray?: false): Set<IItem>;
  items(returnArray = false) {
    return returnArray ? [...this._items] : new Set(this._items);
  }

  get itemsSize() {
    return this._items.size;
  }

  constructor(...props: (keyof IItem)[]) {
    this._props = props;
    autoBind(this);
  }

  add(...items: IItem[]) {
    items.forEach((item) => {
      this.internalAdd(item);
    });
  }

  protected internalAdd(item: IItem) {
    if (this._items.has(item)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Hydreigon] The added item already exists.');
      }
      return;
    }
    this._items.add(item);
    if (this._compareFn) {
      const arr = [...this._items].sort(this._compareFn);
      this._items.clear();
      this._items = new Set(arr);
    }

    this._props.forEach((prop) => {
      const value = item[prop];
      let valueMap = this._propMap.get(prop);
      if (!valueMap) {
        valueMap = new Map();
        this._propMap.set(prop, valueMap);
        valueMap.set(value, new Set([item]));
        return;
      }
      let items = valueMap.get(value);
      if (!items) {
        items = new Set([item]);
        valueMap.set(value, items);
      }
      items.add(item);
      if (this._compareFn) {
        const arr = [...items].sort(this._compareFn);
        items.clear();
        valueMap.set(value, new Set(arr));
      }
    });
  }

  remove(...items: IItem[]) {
    items.forEach((item) => {
      this.internalRemove(item);
    });
  }

  protected internalRemove(item: IItem) {
    if (!this._items.has(item)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Hydreigon] The removed item does not exist.');
      }
      return;
    }
    this._items.delete(item);

    this._props.forEach((prop) => {
      const value = item[prop];
      const valueMap = this._propMap.get(prop);
      /* istanbul ignore next */
      if (!valueMap) throw report('hydreigon');
      const items = valueMap.get(value);
      /* istanbul ignore next */
      if (!items) throw report('hydreigon');
      items.delete(item);
      if (items.size === 0) valueMap.delete(value);
    });

    this._tied.forEach((items) => {
      if (items instanceof Set) {
        items.delete(item);
      } else {
        items[items.indexOf(item)] = undefined;
      }
    });
  }

  protected internalSearch(prop: keyof IItem, value: any) {
    const valueMap = this._propMap.get(prop);
    if (!valueMap) {
      throw new Error(
        '[Hydreigon] The searched property does not exist in the constructor props parameter.'
      );
    }
    return valueMap.get(value);
  }

  search(prop: keyof IItem, value: any, returnArray: true): IItem[];
  search(prop: keyof IItem, value: any, returnArray?: false): Set<IItem>;
  search(prop: keyof IItem, value: any, returnArray = false) {
    const items = this.internalSearch(prop, value);
    if (returnArray) {
      return items ? [...items] : [];
    } else {
      return new Set(items);
    }
  }

  searchSize(prop: keyof IItem, value: any) {
    const valueMap = this._propMap.get(prop);
    if (!valueMap) {
      throw new Error(
        '[Hydreigon] The searched property does not exist in the constructor props parameter.'
      );
    }
    const items = valueMap.get(value);
    return items ? items.size : 0;
  }

  sort(compareFn: (a: IItem, b: IItem) => number) {
    this._compareFn = compareFn;

    if (this._items.size > 1) {
      const arr = [...this._items].sort(this._compareFn);
      this.internalClear(false);
      this.add(...arr);
    }
  }

  tie(items: Set<IItem> | IItem[]) {
    this._tied.add(items);
  }

  untie(items: Set<IItem> | IItem[]) {
    this._tied.delete(items);
  }

  clear() {
    this.internalClear(true);
  }

  protected internalClear(clearTied: boolean) {
    this._propMap.forEach((valueMap) => {
      valueMap.forEach((items) => {
        items.clear();
      });
      valueMap.clear();
    });

    this._items.clear();

    if (clearTied) {
      this._tied.forEach((items) => {
        if (items instanceof Set) {
          items.clear();
        } else {
          items.length = 0;
        }
      });
    }
  }

  dispose() {
    this.clear();
    this._propMap.clear();
    this._tied.clear();

    //@ts-expect-error
    this._propMap = undefined;
    //@ts-expect-error
    this._items = undefined;
    //@ts-expect-error
    this._tied = undefined;
    this._compareFn = undefined;
    this._props.length = 0;
    //@ts-expect-error
    this._props = undefined;
  }
}