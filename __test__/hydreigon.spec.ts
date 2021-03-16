import { Hydreigon } from '../src';

const env = process.env;

describe('hydreigon', () => {
  const warn = jest
    .spyOn(global.console, 'warn')
    .mockImplementation(() => true);

  beforeEach(() => {
    process.env = { ...env };
    warn.mockClear();
  });

  afterAll(() => {
    process.env = env;
  });

  it('general', () => {
    const item1 = { no: 1, name: 'Poly', speed: 120, power: 60, nickname: 'P' };
    const item2 = { no: 2, name: 'Roy', speed: 80, power: 80, nickname: 'R' };
    const item3 = { no: 3, name: 'Amber', speed: 80, power: 60, nickname: 'A' };
    const item4 = {
      no: 4,
      name: 'Helly',
      speed: 100,
      power: 60,
      nickname: 'H',
    };
    const indexer = new Hydreigon('no', 'name', 'speed', 'power').knock<
      typeof item1
    >();
    expect(() => indexer.search('name', 'Poly')).not.toThrow();

    indexer.add(item1, item2, item3, item4);

    indexer.add(item1);
    expect(warn).not.toBeCalled();
    process.env.NODE_ENV = 'development';
    indexer.add(item1);
    expect(warn).toBeCalledWith('[Hydreigon] The added item already exists.');
    expect(warn).toBeCalledTimes(1);
    process.env = env;

    //@ts-expect-error
    expect(() => indexer.search('nickname', 'Spooky')).toThrowError(
      '[Hydreigon] The searched property does not exist in the constructor props parameter.'
    );
    //@ts-expect-error
    expect(() => indexer.searchSize('nickname', 'jin')).toThrowError(
      '[Hydreigon] The searched property does not exist in the constructor props parameter.'
    );

    expect(indexer.search('name', 'Spooky')).toEqual(new Set());
    expect(indexer.search('name', 'Spooky', true)).toEqual([]);
    expect(indexer.searchSize('name', 'Spooky')).toBe(0);

    expect(indexer.search('no', 1).values().next().value).toBe(item1);
    expect(indexer.search('no', 2, true)[0]).toBe(item2);
    expect(indexer.search('name', 'Amber')).toEqual(new Set([item3]));
    expect([...indexer.search('name', 'Helly')][0]).toBe(item4);
    expect(indexer.search('speed', 80, true)).toEqual([item2, item3]);
    expect(indexer.search('power', 60)).toEqual(new Set([item1, item3, item4]));

    expect(indexer.searchSize('no', 4)).toBe(1);
    expect(indexer.searchSize('name', 'Poly')).toBe(1);
    expect(indexer.searchSize('speed', 80)).toBe(2);
    expect(indexer.searchSize('power', 60)).toBe(3);

    expect(indexer.items()).toEqual(new Set([item1, item2, item3, item4]));
    expect(indexer.items(true)).toEqual([item1, item2, item3, item4]);
    expect(indexer.itemsSize).toBe(4);

    indexer.remove(item3);
    expect(indexer.search('name', 'Amber')).toEqual(new Set());
    expect(indexer.search('speed', 80, true)).toEqual([item2]);
    expect(indexer.search('power', 60)).toEqual(new Set([item1, item4]));
    expect(indexer.items()).toEqual(new Set([item1, item2, item4]));
    expect(indexer.itemsSize).toBe(3);

    indexer.clear();
    expect(indexer.search('name', 'Poli', true)).toEqual([]);
    expect(indexer.searchSize('name', 'Poly')).toBe(0);
    expect(indexer.items()).toEqual(new Set());
    expect(indexer.itemsSize).toBe(0);

    warn.mockClear();
    indexer.remove(item1);
    expect(warn).not.toBeCalled();
    process.env.NODE_ENV = 'development';
    indexer.remove(item1);
    expect(warn).toBeCalledWith('[Hydreigon] The removed item does not exist.');
    expect(warn).toBeCalledTimes(1);
    process.env = env;

    expect(() => indexer.search('name', 'Poly')).not.toThrow();

    indexer.dispose();
  });

  it('tie', () => {
    const item1 = { no: 1, name: 'Poly', speed: 120, power: 60 };
    const item2 = { no: 2, name: 'Roy', speed: 80, power: 60 };
    const item3 = { no: 3, name: 'Amber', speed: 80, power: 60 };
    const item4 = { no: 4, name: 'Helly', speed: 100, power: 60 };
    const indexer = new Hydreigon('no', 'name', 'speed', 'power');

    indexer.add(item1, item2, item3, item4);
    expect(indexer.items()).toEqual(new Set([item1, item2, item3, item4]));
    {
      const items = indexer.search('power', 60);
      expect(items).toEqual(new Set([item1, item2, item3, item4]));
      indexer.tie(items);
      indexer.remove(item3);
      expect(items).toEqual(new Set([item1, item2, item4]));
      indexer.untie(items);
      indexer.remove(item1);
      expect(items).toEqual(new Set([item1, item2, item4]));
    }
    expect(indexer.items()).toEqual(new Set([item2, item4]));
    {
      const items = indexer.search('power', 60);
      expect(items).toEqual(new Set([item2, item4]));
      indexer.tie(items);
      indexer.add(item3);
      indexer.add(item1);
      expect(items).toEqual(new Set([item2, item4]));
      indexer.untie(items);
    }
    expect(indexer.items()).toEqual(new Set([item2, item4, item3, item1]));
    {
      const items = indexer.search('power', 60);
      expect(items).toEqual(new Set([item1, item2, item3, item4]));
      indexer.tie(items);
      indexer.clear();
      expect(items).toEqual(new Set([]));
      indexer.untie(items);
    }
    expect(indexer.items()).toEqual(new Set());

    indexer.add(item1, item2, item3, item4);
    expect(indexer.items(true)).toEqual([item1, item2, item3, item4]);
    {
      const items = indexer.search('power', 60, true);
      expect(items).toEqual([item1, item2, item3, item4]);
      indexer.tie(items);
      indexer.remove(item4);
      expect(items).toEqual([item1, item2, item3, undefined]);
      indexer.untie(items);
      indexer.remove(item2);
      expect(items).toEqual([item1, item2, item3, undefined]);
    }
    expect(indexer.items(true)).toEqual([item1, item3]);
    {
      const items = indexer.search('power', 60, true);
      expect(items).toEqual([item1, item3]);
      indexer.tie(items);
      indexer.add(item4);
      indexer.add(item2);
      expect(items).toEqual([item1, item3]);
      indexer.untie(items);
    }
    expect(indexer.items(true)).toEqual([item1, item3, item4, item2]);
    {
      const items = indexer.search('power', 60, true);
      expect(items).toEqual([item1, item3, item4, item2]);
      indexer.tie(items);
      indexer.clear();
      expect(items).toEqual([]);
      indexer.untie(items);
    }
    expect(indexer.items(true)).toEqual([]);
  });

  it('sort', () => {
    const item1 = { no: 1, name: 'Poly', speed: 120, power: 60 };
    const item2 = { no: 2, name: 'Roy', speed: 80, power: 60 };
    const item3 = { no: 3, name: 'Amber', speed: 80, power: 60 };
    const item4 = { no: 4, name: 'Helly', speed: 100, power: 60 };
    const indexer = new Hydreigon('no', 'name', 'speed', 'power');

    indexer.sort((a, b) => {
      return a.no - b.no;
    });
    indexer.add(item4, item1, item3, item2);
    expect(indexer.items()).toEqual(new Set([item1, item2, item3, item4]));
    expect(indexer.search('power', 60)).toEqual(
      new Set([item1, item2, item3, item4])
    );
    expect(indexer.search('speed', 80)).toEqual(new Set([item2, item3]));

    indexer.sort((a, b) => {
      return b.no - a.no;
    });
    expect(indexer.items(true)).toEqual([item4, item3, item2, item1]);
    expect(indexer.search('power', 60, true)).toEqual([
      item4,
      item3,
      item2,
      item1,
    ]);
    expect(indexer.search('speed', 80, true)).toEqual([item3, item2]);
  });

  it('bind this', () => {
    const item1 = { no: 1, name: 'Poly', speed: 120, power: 60 };
    const item2 = { no: 2, name: 'Roy', speed: 80, power: 60 };
    const item3 = { no: 3, name: 'Amber', speed: 80, power: 60 };
    const item4 = { no: 4, name: 'Helly', speed: 100, power: 60 };
    const indexer = new Hydreigon('no', 'name', 'speed', 'power');

    expect(() => {
      indexer.add.call(undefined, item4, item1, item3, item2);
    }).not.toThrowError();
  });
});
