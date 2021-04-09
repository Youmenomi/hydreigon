import { Hydreigon } from '../src';
import { expectedItems, expectedSearch, unprotect } from './helper';

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

  it('types', () => {
    const item1 = {
      no: 1,
      event: 'E1',
      listener: 'L1',
      group: 'G1',
    };
    const item2 = {
      no: 2,
      event: 'E1',
      listener: 'L2',
      group: 'G2',
    };
    const item3 = {
      no: 3,
      event: 'E3',
      listener: 'L3',
      group: 'G3',
    };
    const item4 = {
      no: 4,
      listener: 'L2',
      group: 'G3',
    };

    const indexer = new Hydreigon<{
      event: string;
      listener: string;
      group: string;
    }>('event', 'listener', {
      index: 'group',
      branch: ['event'],
    });

    indexer.add(item1, item2, item3, item4 as any);
  });

  it('sort & readd & refresh', () => {
    const item1 = {
      no: 1,
      event: 'E1',
      listener: 'L1',
      group: 'G1',
    };
    const item2 = {
      no: 2,
      event: 'E1',
      listener: 'L2',
      group: 'G2',
    };
    const item3 = {
      no: 3,
      event: 'E3',
      listener: 'L3',
      group: 'G3',
    };
    const item4 = {
      no: 4,
      event: 'E4',
      listener: 'L2',
      group: 'G3',
    };

    const indexer = new Hydreigon('event', 'listener', {
      index: 'group',
      branch: ['event'],
    });
    indexer.sort = (a, b) => {
      return b.no - a.no;
    };
    indexer.add(item1, item2, item3, item4);

    expectedItems(indexer, [item4, item3, item2, item1]);
    expectedSearch(indexer, [['event', 'E1']], [item2, item1]);
    expectedSearch(indexer, [['listener', 'L2']], [item4, item2]);
    expectedSearch(indexer, [['group', 'G3']], [item4, item3]);

    indexer.sort = (a, b) => {
      return a.no - b.no;
    };
    expectedItems(indexer, [item1, item2, item3, item4]);
    expectedSearch(indexer, [['event', 'E1']], [item1, item2]);
    expectedSearch(indexer, [['listener', 'L2']], [item2, item4]);
    expectedSearch(indexer, [['group', 'G3']], [item3, item4]);

    item2.no = 6;
    item4.no = 5;
    indexer.readd(item2, item4);
    expectedItems(indexer, [item1, item3, item4, item2]);

    item1.no = 7;
    item3.no = 8;
    indexer.refresh();
    expectedItems(indexer, [item4, item2, item1, item3]);

    indexer.sort = indexer.sort;
  });

  it('constructor', () => {
    {
      const indexer = new Hydreigon('event', 'listener');
      expect(indexer.size).toBe(0);
      expect(unprotect(indexer)._branch).toEqual(
        new Map([
          ['event', new Map()],
          ['listener', new Map()],
        ])
      );
      expect(unprotect(indexer)._branchMap).toBeUndefined();
      expectedItems(indexer, []);
      expect(unprotect(indexer)._items).toEqual(new Set());
    }
    {
      const indexer = new Hydreigon('event', 'listener', {
        index: 'group',
        branch: ['event'],
      });
      expect(indexer.size).toBe(0);
      expect(unprotect(indexer)._branch).toEqual(
        new Map([
          ['event', new Map()],
          ['listener', new Map()],
          ['group', new Map()],
        ])
      );
      expect(unprotect(indexer)._branchMap).toEqual(
        new Map([['group', ['event']]])
      );
      expectedItems(indexer, []);
      expect(unprotect(indexer)._items).toEqual(new Set());
    }
    {
      const indexer = new Hydreigon('event', 'listener', {
        index: 'group',
      });
      expect(indexer.size).toBe(0);
      expect(unprotect(indexer)._branch).toEqual(
        new Map([
          ['event', new Map()],
          ['listener', new Map()],
          ['group', new Map()],
        ])
      );
      expect(unprotect(indexer)._branchMap).toBeUndefined();
      expectedItems(indexer, []);
      expect(unprotect(indexer)._items).toEqual(new Set());
    }
  });

  it('search & searchSize', () => {
    const item1 = {
      no: 1,
      event: 'E1',
      listener: 'L1',
      group: 'G1',
    };
    const item2 = {
      no: 2,
      event: 'E1',
      listener: 'L2',
      group: 'G2',
    };
    const item3 = {
      no: 3,
      event: 'E3',
      listener: 'L3',
      group: 'G3',
    };
    const item4 = {
      no: 4,
      event: 'E4',
      listener: 'L2',
      group: 'G3',
    };

    const indexer = new Hydreigon('event', 'listener', {
      index: 'group',
      branch: ['event'],
    });

    expect(() => indexer.search(false)).toThrowError(
      '[Hydreigon] No search conditions are provided.'
    );
    expect(() => indexer.search(false, ['no', '1'])).toThrowError(
      '[Hydreigon] The searched property "no" does not exist in the constructor heads parameter.'
    );
    expect(indexer.search(false, ['event', 'E1'])).toEqual(new Set());

    expect(() => indexer.searchSize()).toThrowError(
      '[Hydreigon] No search conditions are provided.'
    );
    expect(() => indexer.searchSize(['no', '1'])).toThrowError(
      '[Hydreigon] The searched property "no" does not exist in the constructor heads parameter.'
    );
    expect(indexer.searchSize(['event', 'E1'])).toBe(0);

    indexer.add(item1, item2, item3, item4);
    expectedSearch(indexer, [['event', 'E1']], [item1, item2]);
    expectedSearch(indexer, [['event', 'E2']], []);
    expectedSearch(indexer, [['event', 'E3']], [item3]);
    expectedSearch(indexer, [['event', 'E4']], [item4]);
    expectedSearch(indexer, [['listener', 'L1']], [item1]);
    expectedSearch(indexer, [['listener', 'L2']], [item2, item4]);
    expectedSearch(indexer, [['listener', 'L3']], [item3]);
    expectedSearch(indexer, [['listener', 'L4']], []);
    expectedSearch(indexer, [['group', 'G1']], [item1]);
    expectedSearch(indexer, [['group', 'G2']], [item2]);
    expectedSearch(indexer, [['group', 'G3']], [item3, item4]);
    expectedSearch(indexer, [['group', 'G4']], []);

    expect(indexer.searchSize(['event', 'E1'])).toBe(2);
    expect(indexer.searchSize(['listener', 'L4'])).toBe(0);
    expect(indexer.searchSize(['group', 'G2'])).toBe(1);

    expectedSearch(
      indexer,
      [
        ['group', 'G1'],
        ['event', 'E1'],
      ],
      [item1]
    );
    expectedSearch(
      indexer,
      [
        ['group', 'G1'],
        ['event', 'E2'],
      ],
      []
    );
    expectedSearch(
      indexer,
      [
        ['group', 'G3'],
        ['event', 'E3'],
      ],
      [item3]
    );
    expectedSearch(
      indexer,
      [
        ['group', 'G3'],
        ['event', 'E4'],
      ],
      [item4]
    );
    expect(() =>
      indexer.search(false, ['group', 'G1'], ['listener', 'L1'])
    ).toThrowError(
      '[Hydreigon] The searched branch "listener" does not exist in the branch "group".'
    );
    expect(() =>
      indexer.search(false, ['event', 'E1'], ['listener', 'L1'])
    ).toThrowError(
      '[Hydreigon] The searched branch "listener" does not exist in the branch "event".'
    );

    expect(indexer.searchSize(['group', 'G1'], ['event', 'E1'])).toBe(1);
    expect(indexer.searchSize(['group', 'G2'], ['event', 'E2'])).toBe(0);
    expect(indexer.searchSize(['group', 'G3'], ['event', 'E3'])).toBe(1);
  });

  it('add & delete & clear & size & dispose', () => {
    const item1 = {
      no: 1,
      event: 'E1',
      listener: 'L1',
      group: 'G1',
    };
    const item2 = {
      no: 2,
      event: 'E1',
      listener: 'L2',
      group: 'G2',
    };
    const item3 = {
      no: 3,
      event: 'E3',
      listener: 'L3',
      group: 'G3',
    };
    const item4 = {
      no: 4,
      event: 'E4',
      listener: 'L2',
      group: 'G3',
    };

    const indexer = new Hydreigon('event', 'listener', {
      index: 'group',
      branch: ['event'],
    });
    function f0() {
      expect(indexer.size).toBe(0);
      expect(unprotect(indexer)._branch).toEqual(
        new Map([
          ['event', new Map()],
          ['listener', new Map()],
          ['group', new Map()],
        ])
      );
      expect(unprotect(indexer)._branchMap).toEqual(
        new Map([['group', ['event']]])
      );
      expectedItems(indexer, []);
      expect(unprotect(indexer)._items).toEqual(new Set());
    }
    f0();

    indexer.add(item1);
    function f1() {
      expect(indexer.size).toBe(1);
      expectedItems(indexer, [item1]);
      expect(unprotect(indexer)._items).toEqual(new Set([item1]));
      expect(unprotect(indexer)._branch.get('event')).toEqual(
        new Map([['E1', new Set([item1])]])
      );
      expect(unprotect(indexer)._branch.get('listener')).toEqual(
        new Map([['L1', new Set([item1])]])
      );
      const map = unprotect(indexer)._branch.get('group');
      expect(map instanceof Map).toBeTruthy();
      if (map) {
        expect(Array.from(map.keys())).toEqual(['G1']);
        const indexer = map.get('G1');
        expect(indexer instanceof Hydreigon).toBeTruthy();
        if (indexer instanceof Hydreigon) {
          expectedItems(indexer, [item1]);
          expect(unprotect(indexer)._items).toEqual(new Set([item1]));
          expect(unprotect(indexer)._branchMap).toBeUndefined();
          expect(unprotect(indexer)._branch).toEqual(
            new Map([['event', new Map([['E1', new Set([item1])]])]])
          );
        }
      }
    }
    f1();

    indexer.add(item2);
    function f2() {
      expect(indexer.size).toBe(2);
      expectedItems(indexer, [item1, item2]);
      expect(unprotect(indexer)._items).toEqual(new Set([item1, item2]));
      expect(unprotect(indexer)._branch.get('event')).toEqual(
        new Map([['E1', new Set([item1, item2])]])
      );
      expect(unprotect(indexer)._branch.get('listener')).toEqual(
        new Map([
          ['L1', new Set([item1])],
          ['L2', new Set([item2])],
        ])
      );
      const map = unprotect(indexer)._branch.get('group');
      expect(map instanceof Map).toBeTruthy();
      if (map) {
        expect(Array.from(map.keys())).toEqual(['G1', 'G2']);
        {
          const indexer = map.get('G1');
          expect(indexer instanceof Hydreigon).toBeTruthy();
          if (indexer instanceof Hydreigon) {
            expectedItems(indexer, [item1]);
            expect(unprotect(indexer)._items).toEqual(new Set([item1]));
            expect(unprotect(indexer)._branchMap).toBeUndefined();
            expect(unprotect(indexer)._branch).toEqual(
              new Map([['event', new Map([['E1', new Set([item1])]])]])
            );
          }
        }
        {
          const indexer = map.get('G2');
          expect(indexer instanceof Hydreigon).toBeTruthy();
          if (indexer instanceof Hydreigon) {
            expectedItems(indexer, [item2]);
            expect(unprotect(indexer)._items).toEqual(new Set([item2]));
            expect(unprotect(indexer)._branchMap).toBeUndefined();
            expect(unprotect(indexer)._branch).toEqual(
              new Map([['event', new Map([['E1', new Set([item2])]])]])
            );
          }
        }
      }
    }
    f2();

    indexer.add(item3);
    function f3() {
      expect(indexer.size).toBe(3);
      expectedItems(indexer, [item1, item2, item3]);
      expect(unprotect(indexer)._items).toEqual(new Set([item1, item2, item3]));
      expect(unprotect(indexer)._branch.get('event')).toEqual(
        new Map([
          ['E1', new Set([item1, item2])],
          ['E3', new Set([item3])],
        ])
      );
      expect(unprotect(indexer)._branch.get('listener')).toEqual(
        new Map([
          ['L1', new Set([item1])],
          ['L2', new Set([item2])],
          ['L3', new Set([item3])],
        ])
      );
      const map = unprotect(indexer)._branch.get('group');
      expect(map instanceof Map).toBeTruthy();
      if (map) {
        expect(Array.from(map.keys())).toEqual(['G1', 'G2', 'G3']);
        {
          const indexer = map.get('G1');
          expect(indexer instanceof Hydreigon).toBeTruthy();
          if (indexer instanceof Hydreigon) {
            expectedItems(indexer, [item1]);
            expect(unprotect(indexer)._items).toEqual(new Set([item1]));
            expect(unprotect(indexer)._branchMap).toBeUndefined();
            expect(unprotect(indexer)._branch).toEqual(
              new Map([['event', new Map([['E1', new Set([item1])]])]])
            );
          }
        }
        {
          const indexer = map.get('G2');
          expect(indexer instanceof Hydreigon).toBeTruthy();
          if (indexer instanceof Hydreigon) {
            expectedItems(indexer, [item2]);
            expect(unprotect(indexer)._items).toEqual(new Set([item2]));
            expect(unprotect(indexer)._branchMap).toBeUndefined();
            expect(unprotect(indexer)._branch).toEqual(
              new Map([['event', new Map([['E1', new Set([item2])]])]])
            );
          }
        }
        {
          const indexer = map.get('G3');
          expect(indexer instanceof Hydreigon).toBeTruthy();
          if (indexer instanceof Hydreigon) {
            expectedItems(indexer, [item3]);
            expect(unprotect(indexer)._items).toEqual(new Set([item3]));
            expect(unprotect(indexer)._branchMap).toBeUndefined();
            expect(unprotect(indexer)._branch).toEqual(
              new Map([['event', new Map([['E3', new Set([item3])]])]])
            );
          }
        }
      }
    }
    f3();

    indexer.add(item4);
    function f4() {
      expect(indexer.size).toBe(4);
      expectedItems(indexer, [item1, item2, item3, item4]);
      expect(unprotect(indexer)._items).toEqual(
        new Set([item1, item2, item3, item4])
      );
      expect(unprotect(indexer)._branch.get('event')).toEqual(
        new Map([
          ['E1', new Set([item1, item2])],
          ['E3', new Set([item3])],
          ['E4', new Set([item4])],
        ])
      );
      expect(unprotect(indexer)._branch.get('listener')).toEqual(
        new Map([
          ['L1', new Set([item1])],
          ['L2', new Set([item2, item4])],
          ['L3', new Set([item3])],
        ])
      );
      const map = unprotect(indexer)._branch.get('group');
      expect(map instanceof Map).toBeTruthy();
      if (map) {
        expect(Array.from(map.keys())).toEqual(['G1', 'G2', 'G3']);
        {
          const indexer = map.get('G1');
          expect(indexer instanceof Hydreigon).toBeTruthy();
          if (indexer instanceof Hydreigon) {
            expectedItems(indexer, [item1]);
            expect(unprotect(indexer)._items).toEqual(new Set([item1]));
            expect(unprotect(indexer)._branchMap).toBeUndefined();
            expect(unprotect(indexer)._branch).toEqual(
              new Map([['event', new Map([['E1', new Set([item1])]])]])
            );
          }
        }
        {
          const region = map.get('G2');
          expect(region instanceof Hydreigon).toBeTruthy();
          if (region instanceof Hydreigon) {
            expectedItems(region, [item2]);
            expect(unprotect(region)._items).toEqual(new Set([item2]));
            expect(unprotect(region)._branchMap).toBeUndefined();
            expect(unprotect(region)._branch).toEqual(
              new Map([['event', new Map([['E1', new Set([item2])]])]])
            );
          }
        }
        {
          const indexer = map.get('G3');
          expect(indexer instanceof Hydreigon).toBeTruthy();
          if (indexer instanceof Hydreigon) {
            expectedItems(indexer, [item3, item4]);
            expect(unprotect(indexer)._items).toEqual(new Set([item3, item4]));
            expect(unprotect(indexer)._branchMap).toBeUndefined();
            expect(unprotect(indexer)._branch).toEqual(
              new Map([
                [
                  'event',
                  new Map([
                    ['E3', new Set([item3])],
                    ['E4', new Set([item4])],
                  ]),
                ],
              ])
            );
          }
        }
      }
    }
    f4();

    warn.mockClear();
    indexer.add(item1);
    expect(warn).not.toBeCalled();
    process.env.NODE_ENV = 'development';
    indexer.add(item1);
    expect(warn).toBeCalledWith('[Hydreigon] The added item already exists.');
    expect(warn).toBeCalledTimes(1);
    process.env = env;

    indexer.clear();
    f0();
    indexer.add(item1, item2, item3, item4);
    f4();
    indexer.delete(item1, item2, item3, item4);
    f0();
    indexer.add(item1, item2);
    f2();
    indexer.add(item3, item4);
    f4();
    indexer.delete(item3, item4);
    f2();
    indexer.delete(item1, item2);
    f0();
    indexer.add(item1);
    f1();
    indexer.add(item2, item3, item4);
    f4();
    indexer.delete(item2, item3, item4);
    f1();
    indexer.delete(item1);
    f0();

    warn.mockClear();
    indexer.delete(item1);
    expect(warn).not.toBeCalled();
    process.env.NODE_ENV = 'development';
    indexer.delete(item1);
    expect(warn).toBeCalledWith('[Hydreigon] The removed item does not exist.');
    expect(warn).toBeCalledTimes(1);
    process.env = env;

    indexer.dispose();
    expect(unprotect(indexer)._branch).toBeUndefined();
    expect(unprotect(indexer)._branchMap).toBeUndefined();
    expect(unprotect(indexer)._items).toBeUndefined();
  });
});
