import { type Branch, Hydreigon, type Node } from './index';

// ─── fixtures ──────────────────────────────────────────────────────────────
// Fresh objects per test: several tests mutate `no`, so they must not be shared.
type Item = { no: number; event: string; listener: string; group: string };

function makeItems() {
  const item1: Item = { no: 1, event: 'E1', listener: 'L1', group: 'G1' };
  const item2: Item = { no: 2, event: 'E1', listener: 'L2', group: 'G2' };
  const item3: Item = { no: 3, event: 'E3', listener: 'L3', group: 'G3' };
  const item4: Item = { no: 4, event: 'E4', listener: 'L2', group: 'G3' };
  return { item1, item2, item3, item4 };
}

// The standard indexer: 'event' and 'listener' are plain heads; 'group' is a
// branch head that nests its items by 'event'.
function makeIndexer() {
  return new Hydreigon<Item>('event', 'listener', {
    index: 'group',
    branch: ['event'],
  });
}

// ─── assertion helpers ───────────────────────────────────────────────────────
// Deliberate white-box channel: exposes protected fields so a small number of
// tests can assert internal invariants that the public API cannot observe
// (e.g. an emptied value bucket is removed, not left dangling). Behaviour is
// otherwise verified through the public API.
function unprotect<IItem extends { [key in PropertyKey]: any } = any>(
  hydreigon: Hydreigon<IItem>,
) {
  return hydreigon as Hydreigon & {
    _items: Set<IItem>;
    _branch: Branch<IItem>;
    _branchMap?: Map<PropertyKey, (PropertyKey | Node)[]>;
  };
}

function expectedItems<IItem extends { [key in PropertyKey]: any }>(
  hydreigon: Hydreigon<IItem>,
  match: IItem[],
) {
  expect(hydreigon.items()).toEqual(new Set(match));
  expect(hydreigon.items(true)).toEqual(match);
}

// Asserts every public read path (Set form, array form, count) for one query.
function expectedSearch<IItem extends { [key in PropertyKey]: any }>(
  hydreigon: Hydreigon<IItem>,
  conditions: [PropertyKey, any][],
  match: IItem[],
) {
  expect(hydreigon.search(false, ...conditions)).toEqual(new Set(match));
  expect(hydreigon.search(true, ...conditions)).toEqual(match);
  expect(hydreigon.searchSize(...conditions)).toBe(match.length);
}

// Full observable state when all four standard items are present, asserted
// purely through the public API. Used to prove that different mutation
// sequences converge to the same state without depending on internals.
function expectPopulated(
  indexer: Hydreigon<Item>,
  items: ReturnType<typeof makeItems>,
) {
  const { item1, item2, item3, item4 } = items;
  expect(indexer.size).toBe(4);
  expectedItems(indexer, [item1, item2, item3, item4]);

  expectedSearch(indexer, [['event', 'E1']], [item1, item2]);
  expectedSearch(indexer, [['event', 'E3']], [item3]);
  expectedSearch(indexer, [['event', 'E4']], [item4]);
  expectedSearch(indexer, [['listener', 'L1']], [item1]);
  expectedSearch(indexer, [['listener', 'L2']], [item2, item4]);
  expectedSearch(indexer, [['listener', 'L3']], [item3]);
  expectedSearch(indexer, [['group', 'G1']], [item1]);
  expectedSearch(indexer, [['group', 'G2']], [item2]);
  expectedSearch(indexer, [['group', 'G3']], [item3, item4]);

  // nested: group → event
  expectedSearch(
    indexer,
    [
      ['group', 'G1'],
      ['event', 'E1'],
    ],
    [item1],
  );
  expectedSearch(
    indexer,
    [
      ['group', 'G3'],
      ['event', 'E3'],
    ],
    [item3],
  );
  expectedSearch(
    indexer,
    [
      ['group', 'G3'],
      ['event', 'E4'],
    ],
    [item4],
  );
}

function expectEmpty(indexer: Hydreigon<Item>) {
  expect(indexer.size).toBe(0);
  expectedItems(indexer, []);
  expectedSearch(indexer, [['event', 'E1']], []);
  expectedSearch(indexer, [['listener', 'L2']], []);
  expectedSearch(indexer, [['group', 'G3']], []);
  expectedSearch(
    indexer,
    [
      ['group', 'G3'],
      ['event', 'E3'],
    ],
    [],
  );
}

// Runs `fn` with NODE_ENV temporarily set to 'development', then restores it,
// so the development-only warnings can be exercised in isolation.
function withDevEnv(fn: () => void) {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    fn();
  } finally {
    process.env.NODE_ENV = prev;
  }
}

describe('Hydreigon', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beforeEach(() => {
    warn.mockClear();
  });

  afterAll(() => {
    warn.mockRestore();
  });

  describe('types', () => {
    it('constrains search conditions to the declared TCondition union', () => {
      // Compile-time only: never executed, the assertions live in the types and
      // are verified by `tsc` (see the ts:check script).
      const _checks = (
        indexer: Hydreigon<
          Item,
          ['event', string] | ['listener', (e: string) => void] | ['group', any]
        >,
      ) => {
        indexer.search(true, ['event', 'E1']);
        indexer.search(true, ['listener', (e) => void e]);
        indexer.search(true, ['group', {}]);

        // @ts-expect-error 'event' values must be strings
        indexer.search(true, ['event', 123]);
        // @ts-expect-error 'listener' values must be functions
        indexer.search(true, ['listener', 'L1']);
        // @ts-expect-error unknown heads are rejected
        indexer.search(true, ['nope', 1]);
      };
      expect(_checks).toBeInstanceOf(Function);
    });

    it('infers items() return type from the returnArray flag', () => {
      const indexer = new Hydreigon<Item>('event');
      expectTypeOf(indexer.items(true)).toEqualTypeOf<Item[]>();
      expectTypeOf(indexer.items()).toEqualTypeOf<Set<Item>>();
      expectTypeOf(indexer.items(false)).toEqualTypeOf<Set<Item>>();
    });
  });

  describe('constructor', () => {
    it('registers plain heads and branch heads', () => {
      const indexer = makeIndexer();
      expect(indexer.size).toBe(0);
      const branch = unprotect(indexer)._branch;
      expect(branch.has('event')).toBe(true);
      expect(branch.has('listener')).toBe(true);
      expect(branch.has('group')).toBe(true);
      expect(unprotect(indexer)._branchMap).toEqual(
        new Map([['group', ['event']]]),
      );
    });

    it('treats a branch-less head as plain: it cannot be drilled into', () => {
      const indexer = new Hydreigon('event', 'listener', { index: 'group' });
      expect(unprotect(indexer)._branchMap).toBeUndefined();
      // Observable consequence: 'group' has no nested branch to search through.
      expect(() =>
        indexer.search(false, ['group', 'G1'], ['event', 'E1']),
      ).toThrow(
        '[Hydreigon] The searched branch "event" does not exist in the branch "group".',
      );
    });

    it('warns about a duplicate head index only in development', () => {
      new Hydreigon('event', 'listener', { index: 'group' }, 'group', {
        index: 'event',
      });
      expect(warn).not.toHaveBeenCalled();

      withDevEnv(() => {
        new Hydreigon('event', 'listener', { index: 'group' }, 'group', {
          index: 'event',
        });
      });
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledWith(
        '[Hydreigon] Duplicate index of head. The previous one will be overwritten.',
      );
    });

    it('clears a stale branch mapping when a branch head is overwritten by a plain head', () => {
      // Without the cleanup, _branchMap would keep a stale ['event'] entry for
      // 'group' while _branch['group'] stores plain Sets, corrupting search.
      const indexer = new Hydreigon(
        { index: 'group', branch: ['event'] },
        'group',
      );
      expect(unprotect(indexer)._branchMap).toBeUndefined();

      const item = { event: 'E1', group: 'G1' };
      indexer.add(item);
      // 'group' now behaves as a plain head: there is no nested branch to drill into.
      expectedSearch(indexer, [['group', 'G1']], [item]);
      expect(() =>
        indexer.search(false, ['group', 'G1'], ['event', 'E1']),
      ).toThrow(
        '[Hydreigon] The searched branch "event" does not exist in the branch "group".',
      );
    });
  });

  describe('add', () => {
    it('stores items and exposes them through every read path', () => {
      const items = makeItems();
      const indexer = makeIndexer();
      indexer.add(items.item1, items.item2, items.item3, items.item4);
      expectPopulated(indexer, items);
    });

    it('is a no-op without arguments', () => {
      const indexer = makeIndexer();
      expect(() => indexer.add()).not.toThrow();
      expect(indexer.size).toBe(0);
    });

    it('ignores an item that already exists, warning only in development', () => {
      const { item1 } = makeItems();
      const indexer = makeIndexer();
      indexer.add(item1);

      indexer.add(item1);
      expect(warn).not.toHaveBeenCalled();
      expect(indexer.size).toBe(1);

      withDevEnv(() => indexer.add(item1));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[Hydreigon] The added item already exists.',
      );
      expect(indexer.size).toBe(1);
    });
  });

  describe('delete', () => {
    it('removes items', () => {
      const items = makeItems();
      const indexer = makeIndexer();
      indexer.add(items.item1, items.item2, items.item3, items.item4);
      indexer.delete(items.item1, items.item2, items.item3, items.item4);
      expectEmpty(indexer);
    });

    it('is a no-op without arguments', () => {
      const indexer = makeIndexer();
      expect(() => indexer.delete()).not.toThrow();
    });

    it('ignores an unknown item, warning only in development', () => {
      const { item1 } = makeItems();
      const indexer = makeIndexer();
      indexer.add(item1);

      const ghost: Item = { no: 9, event: 'E1', listener: 'L1', group: 'G1' };
      indexer.delete(ghost);
      expect(warn).not.toHaveBeenCalled();
      expectedItems(indexer, [item1]);

      withDevEnv(() => indexer.delete(ghost));
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        '[Hydreigon] The removed item does not exist.',
      );
    });

    it('converges to the same populated/empty state regardless of the mutation path', () => {
      const items = makeItems();
      const { item1, item2, item3, item4 } = items;
      const indexer = makeIndexer();

      indexer.add(item1, item2, item3, item4);
      expectPopulated(indexer, items);

      indexer.clear();
      expectEmpty(indexer);

      // re-populate in two chunks
      indexer.add(item1, item2);
      indexer.add(item3, item4);
      expectPopulated(indexer, items);

      // tear down in two chunks
      indexer.delete(item3, item4);
      indexer.delete(item1, item2);
      expectEmpty(indexer);

      // single then bulk
      indexer.add(item1);
      indexer.add(item2, item3, item4);
      expectPopulated(indexer, items);
    });
  });

  describe('search / searchSize / searchHas', () => {
    // Rich indexer to exercise both branch shapes: 'event' nests by a Node
    // ({ index: 'listener' }), 'group' nests by a plain key ('event').
    function makeRich() {
      return new Hydreigon<Item>(
        { index: 'event', branch: [{ index: 'listener' }] },
        'listener',
        { index: 'group', branch: ['event'] },
      );
    }

    it('finds items by a single head', () => {
      const { item1, item2, item3, item4 } = makeItems();
      const indexer = makeRich();
      indexer.add(item1, item2, item3, item4);

      expectedSearch(indexer, [['event', 'E1']], [item1, item2]);
      expectedSearch(indexer, [['event', 'E2']], []);
      expectedSearch(indexer, [['listener', 'L2']], [item2, item4]);
      expectedSearch(indexer, [['group', 'G3']], [item3, item4]);
    });

    it('drills into nested branches (plain-key and Node branches)', () => {
      const { item1, item2, item3, item4 } = makeItems();
      const indexer = makeRich();
      indexer.add(item1, item2, item3, item4);

      // group → event (plain-key branch)
      expectedSearch(
        indexer,
        [
          ['group', 'G3'],
          ['event', 'E3'],
        ],
        [item3],
      );
      expectedSearch(
        indexer,
        [
          ['group', 'G1'],
          ['event', 'E2'],
        ],
        [],
      );
      // event → listener (Node branch)
      expectedSearch(
        indexer,
        [
          ['event', 'E1'],
          ['listener', 'L1'],
        ],
        [item1],
      );
    });

    it('answers membership with searchHas', () => {
      const { item1, item2, item3 } = makeItems();
      const indexer = makeRich();
      indexer.add(item1, item2, item3);

      expect(indexer.searchHas(item2, ['event', 'E1'])).toBe(true);
      expect(indexer.searchHas(item1, ['listener', 'L4'])).toBe(false);
      expect(indexer.searchHas(item3, ['group', 'G3'], ['event', 'E3'])).toBe(
        true,
      );
      expect(indexer.searchHas(item1, ['group', 'G3'], ['event', 'E3'])).toBe(
        false,
      );
    });

    it('treats absent values as empty results', () => {
      const indexer = makeRich();
      expectedSearch(indexer, [['event', 'E1']], []);
      expectedSearch(
        indexer,
        [
          ['group', 'G3'],
          ['event', 'E3'],
        ],
        [],
      );
    });

    it('throws when no conditions are provided', () => {
      const indexer = makeRich();
      expect(() => indexer.search(false)).toThrow(
        '[Hydreigon] No search conditions are provided.',
      );
      expect(() => indexer.searchSize()).toThrow(
        '[Hydreigon] No search conditions are provided.',
      );
      expect(() => indexer.searchHas({} as Item)).toThrow(
        '[Hydreigon] No search conditions are provided.',
      );
    });

    it('throws for a head that was not registered in the constructor', () => {
      const indexer = makeRich();
      expect(() => indexer.search(false, ['no', 1])).toThrow(
        '[Hydreigon] The searched property "no" does not exist in the constructor heads parameter.',
      );
    });

    it('throws when drilling into a head that is not a matching branch', () => {
      const { item1 } = makeItems();
      const indexer = makeRich();
      indexer.add(item1);

      // 'listener' is a plain head with no branch.
      expect(() =>
        indexer.search(false, ['listener', 'L1'], ['event', 'E1']),
      ).toThrow(
        '[Hydreigon] The searched branch "event" does not exist in the branch "listener".',
      );
      // 'group' branches by 'event', not 'listener'.
      expect(() =>
        indexer.search(false, ['group', 'G1'], ['listener', 'L1']),
      ).toThrow(
        '[Hydreigon] The searched branch "listener" does not exist in the branch "group".',
      );
    });

    it('supports branch nesting deeper than two levels', () => {
      const a1 = { a: 'A1', b: 'B1', c: 'C1' };
      const a2 = { a: 'A1', b: 'B1', c: 'C2' };
      const a3 = { a: 'A1', b: 'B2', c: 'C1' };
      const indexer = new Hydreigon({
        index: 'a',
        branch: [{ index: 'b', branch: ['c'] }],
      });
      indexer.add(a1, a2, a3);

      expectedSearch(indexer, [['a', 'A1']], [a1, a2, a3]);
      expectedSearch(
        indexer,
        [
          ['a', 'A1'],
          ['b', 'B1'],
        ],
        [a1, a2],
      );
      expectedSearch(
        indexer,
        [
          ['a', 'A1'],
          ['b', 'B1'],
          ['c', 'C2'],
        ],
        [a2],
      );
    });
  });

  describe('sort / readd / refresh', () => {
    it('orders items and every nested bucket by the compare fn', () => {
      const { item1, item2, item3, item4 } = makeItems();
      const indexer = makeIndexer();
      indexer.sort = (a, b) => b.no - a.no; // set before adding: refresh on empty
      indexer.add(item1, item2, item3, item4);

      expectedItems(indexer, [item4, item3, item2, item1]);
      expectedSearch(indexer, [['event', 'E1']], [item2, item1]);
      expectedSearch(indexer, [['listener', 'L2']], [item4, item2]);
      expectedSearch(indexer, [['group', 'G3']], [item4, item3]);
    });

    it('re-sorts everything when the compare fn changes', () => {
      const { item1, item2, item3, item4 } = makeItems();
      const indexer = makeIndexer();
      indexer.sort = (a, b) => b.no - a.no;
      indexer.add(item1, item2, item3, item4);

      indexer.sort = (a, b) => a.no - b.no;
      expectedItems(indexer, [item1, item2, item3, item4]);
      expectedSearch(indexer, [['group', 'G3']], [item3, item4]);
      expect(indexer.sort).toBeTypeOf('function');
    });

    it('does nothing when the compare fn is set to the same reference', () => {
      const { item1, item2 } = makeItems();
      const indexer = makeIndexer();
      const fn = (a: Item, b: Item) => a.no - b.no;
      indexer.sort = fn;
      indexer.add(item1, item2);
      // biome-ignore lint/correctness/noSelfAssign: exercises the identity early-return in the setter
      indexer.sort = indexer.sort;
      expectedItems(indexer, [item1, item2]);
    });

    it('repositions mutated items via readd', () => {
      const { item1, item2, item3, item4 } = makeItems();
      const indexer = makeIndexer();
      indexer.sort = (a, b) => a.no - b.no;
      indexer.add(item1, item2, item3, item4);

      item2.no = 6;
      item4.no = 5;
      indexer.readd(item2, item4);
      expectedItems(indexer, [item1, item3, item4, item2]);
    });

    it('moves re-added items to the end when no compare fn is set', () => {
      const item1 = { no: 1, event: 'E1' };
      const item2 = { no: 2, event: 'E2' };
      const item3 = { no: 3, event: 'E3' };
      const indexer = new Hydreigon('event');
      indexer.add(item1, item2, item3);
      expectedItems(indexer, [item1, item2, item3]);

      indexer.readd(item1);
      expectedItems(indexer, [item2, item3, item1]);
    });

    it('re-sorts after external mutation via refresh', () => {
      const { item1, item2, item3, item4 } = makeItems();
      const indexer = makeIndexer();
      indexer.sort = (a, b) => a.no - b.no;
      indexer.add(item1, item2, item3, item4);

      item1.no = 8;
      item3.no = 7;
      indexer.refresh();
      expectedItems(indexer, [item2, item4, item3, item1]);
    });
  });

  describe('clear / dispose', () => {
    it('clear empties the indexer but keeps it reusable', () => {
      const items = makeItems();
      const indexer = makeIndexer();
      indexer.add(items.item1, items.item2, items.item3, items.item4);

      indexer.clear();
      expectEmpty(indexer);

      indexer.add(items.item1, items.item2, items.item3, items.item4);
      expectPopulated(indexer, items);
    });

    it('dispose tears the indexer down and releases its injected config', () => {
      const items = makeItems();
      const indexer = makeIndexer();
      indexer.add(items.item1, items.item2, items.item3, items.item4);

      indexer.dispose();

      // Observable teardown: the indexer is emptied and its heads are gone, so
      // any further search reports the head as unknown.
      expect(indexer.size).toBe(0);
      expectedItems(indexer, []);
      expect(() => indexer.search(false, ['event', 'E1'])).toThrow(
        '[Hydreigon] The searched property "event" does not exist in the constructor heads parameter.',
      );
      // The injected branch config is the one thing not GC-reachable via the
      // object alone, so dispose must release it explicitly.
      expect(unprotect(indexer)._branchMap).toBeUndefined();
    });
  });

  describe('internal invariants', () => {
    // White-box by necessity: this memory invariant is not observable through
    // the public API (searchSize already returns 0 either way).
    it('removes a value bucket once its last item is deleted', () => {
      const { item1 } = makeItems();
      const indexer = makeIndexer();
      indexer.add(item1);
      indexer.delete(item1);

      // The 'E1' key must be gone, not left pointing at an empty Set.
      expect(unprotect(indexer)._branch.get('event')).toEqual(new Map());
      expect(unprotect(indexer)._branch.get('group')).toEqual(new Map());
      expect(indexer.searchSize(['event', 'E1'])).toBe(0);
    });
  });
});
