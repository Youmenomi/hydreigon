import autoBind from 'auto-bind';
import { report } from './helper';

const pkgName = 'hydreigon';
export class Hydreigon<IProps = any> {
  protected _compareFn?: (a: IProps, b: IProps) => number;
  protected _tied = new Set<Set<IProps> | (IProps | undefined)[]>();
  protected _props: (keyof IProps)[];
  protected _propMap = new Map<keyof IProps, Map<any, Set<IProps>>>();

  protected _items = new Set<IProps>();
  items(returnArray: true): IProps[];
  items(returnArray?: false): Set<IProps>;
  items(returnArray = false) {
    return returnArray ? [...this._items] : new Set(this._items);
  }

  get itemsSize() {
    return this._items.size;
  }

  constructor(...props: (keyof IProps)[]) {
    this._props = props;
    props.forEach((prop) => {
      this._propMap.set(prop, new Map());
    });
    autoBind(this);
  }

  add(...items: IProps[]) {
    items.forEach((item) => {
      this.internalAdd(item);
    });
  }

  protected internalAdd(item: IProps) {
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
      const valueMap = this._propMap.get(prop);
      /* istanbul ignore next */
      if (!valueMap) throw report(pkgName);
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

  remove(...items: IProps[]) {
    items.forEach((item) => {
      this.internalRemove(item);
    });
  }

  protected internalRemove(item: IProps) {
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
      if (!valueMap) throw report(pkgName);
      const items = valueMap.get(value);
      /* istanbul ignore next */
      if (!items) throw report(pkgName);
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

  protected internalSearch(prop: keyof IProps, value: any) {
    const valueMap = this._propMap.get(prop);
    if (!valueMap) {
      throw new Error(
        '[Hydreigon] The searched property does not exist in the constructor props parameter.'
      );
    }
    return valueMap.get(value);
  }

  search(prop: keyof IProps, value: any, returnArray: true): IProps[];
  search(prop: keyof IProps, value: any, returnArray?: false): Set<IProps>;
  search(prop: keyof IProps, value: any, returnArray = false) {
    const items = this.internalSearch(prop, value);
    if (returnArray) {
      return items ? [...items] : [];
    } else {
      return new Set(items);
    }
  }

  searchSize(prop: keyof IProps, value: any) {
    const valueMap = this._propMap.get(prop);
    if (!valueMap) {
      throw new Error(
        '[Hydreigon] The searched property does not exist in the constructor props parameter.'
      );
    }
    const items = valueMap.get(value);
    return items ? items.size : 0;
  }

  sort(compareFn: (a: IProps, b: IProps) => number) {
    this._compareFn = compareFn;

    if (this._items.size > 1) {
      const arr = [...this._items].sort(this._compareFn);
      this.internalClear(false);
      this.add(...arr);
    }
  }

  tie(items: Set<IProps> | IProps[]) {
    this._tied.add(items);
  }

  untie(items: Set<IProps> | IProps[]) {
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
