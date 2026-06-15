# hydreigon

[![license](https://img.shields.io/github/license/Youmenomi/hydreigon)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/hydreigon)](https://www.npmjs.com/package/hydreigon)
[![build & test](https://img.shields.io/github/actions/workflow/status/Youmenomi/hydreigon/ci.yml?branch=main&label=build%20%26%20test)](https://github.com/Youmenomi/hydreigon/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/Youmenomi/hydreigon/pulls)

> Are you looking for a Hydreigon to classify items for you? Come and catch it!

A tiny, type-safe **multi-index** for in-memory objects. Index a collection by
several properties at once, optionally **nest** one index inside another, keep
everything **sorted**, and query any slice in O(1)\* lookups — without scanning
the whole list every time.

Think of a GitLab-style issue board: cards grouped into status columns, each
column further filterable by assignee or label, and the whole board ordered by
priority. Hydreigon is the data structure behind that kind of view.

<sub>\* O(1) to locate a bucket; returning a slice is O(k) in the size of that slice.</sub>

## Features

- **Multi-index** — query by any indexed property without iterating.
- **Nested branches** — drill down, e.g. `status → assignee → …`, to any depth.
- **Sorted** — attach a compare function; items and every bucket stay ordered.
- **Reference-based** — stores your existing objects; no copies, no surprises.
- **Type-safe** — search conditions are constrained by your item shape.
- **Zero dependencies**, ESM + CJS + IIFE builds, ships its own types.

## Install

```bash
npm install hydreigon
# pnpm add hydreigon · yarn add hydreigon
```

## Quick start — an issue board

```ts
import { Hydreigon } from 'hydreigon';

type Issue = {
  id: number;
  status: 'open' | 'in_progress' | 'closed';
  assignee: string;
  label: string;
  priority: number; // higher = more urgent
};

// 'assignee' and 'label' are plain indexes.
// 'status' is a branch index: within each status we can further narrow by assignee.
const board = new Hydreigon<Issue>('assignee', 'label', {
  index: 'status',
  branch: ['assignee'],
});

// Keep every column ordered by priority (highest first).
board.sort = (a, b) => b.priority - a.priority;

board.add(
  { id: 1, status: 'open', assignee: 'alice', label: 'bug', priority: 3 },
  { id: 2, status: 'in_progress', assignee: 'bob', label: 'feat', priority: 5 },
  { id: 3, status: 'in_progress', assignee: 'alice', label: 'bug', priority: 8 },
  { id: 4, status: 'closed', assignee: 'alice', label: 'docs', priority: 1 },
);

// A Kanban column — every "in_progress" card, sorted by priority:
board.search(true, ['status', 'in_progress']);
// → [issue#3 (p8), issue#2 (p5)]

// Narrow a column to one assignee (drilling the branch):
board.search(true, ['status', 'in_progress'], ['assignee', 'alice']);
// → [issue#3]

// One person's work across every column:
board.search(true, ['assignee', 'alice']);
// → [issue#3 (p8), issue#1 (p3), issue#4 (p1)]

// Column count badges, without materializing the list:
board.searchSize(['status', 'open']); // → 1
```

When a card changes an indexed value (moved column, reassigned) or its sort key
(re-prioritized), re-index it with [`readd`](#readditems):

```ts
const [card] = board.search(true, ['status', 'in_progress'], ['assignee', 'alice']);
card.status = 'closed';
card.priority = 2;
board.readd(card); // moves it to the right bucket and re-sorts
```

## Concepts

### Heads — the indexes

Each argument to the constructor declares one index ("head"):

- **Plain head** — a property key (`'assignee'`). Hydreigon groups items by that
  property's value; searching it returns a flat slice.
- **Branch head** — `{ index, branch }`. Same grouping, but it also keeps
  sub-indexes so you can keep narrowing. `branch` lists the inner indexes, and
  may itself contain branch heads for deeper nesting:

  ```ts
  new Hydreigon<Issue>({
    index: 'status',
    branch: [{ index: 'assignee', branch: ['label'] }], // status → assignee → label
  });
  ```

### Search — conditions drill through branches

`search`, `searchSize` and `searchHas` take a list of `[index, value]`
conditions. The first condition selects a bucket; each further condition drills
one level deeper and **must** be declared in the previous head's `branch`,
otherwise Hydreigon throws (a misuse error, not an empty result):

```ts
board.search(true, ['status', 'open'], ['assignee', 'alice']); // ok
board.search(true, ['assignee', 'alice'], ['status', 'open']); // throws: 'assignee' has no branch
```

### Sorting

Assign a compare function to [`sort`](#sort). Items — and every nested bucket —
are kept in that order, so search results come back sorted. Setting `sort`
re-orders the existing contents immediately.

### Mutation requires re-indexing

Hydreigon indexes by value at insertion time. If you mutate an **indexed
property** or a **sort key** on an item already inside, call
[`readd`](#readditems) for that item (or [`refresh`](#refresh) to re-sort the
whole collection after a batch of sort-key changes). Until then, that item's
position is stale.

## API

### `new Hydreigon<TItem, TCondition?>(...heads)`

`heads: (PropertyKey | { index: PropertyKey; branch?: (PropertyKey | Node)[] })[]`

Optional generics: `TItem` is your item shape; `TCondition` constrains the
allowed `[index, value]` tuples for stricter `search` typing.

### `add(...items): void`

Adds items, indexing each under all heads. Items are tracked by reference;
re-adding an item already present is ignored. The batch is sorted once at the
end when a compare function is set.

### `delete(...items): void`

Removes items from every index. Deleting an item not present is ignored.

### `readd(...items): void`

`delete` followed by `add` for each item — use after mutating an indexed
property or sort key to move the item into its correct bucket and order.

### `search(returnArray, ...conditions)`

Returns the items matching the (possibly nested) conditions.
`search(true, …)` returns an `Array`; `search(false, …)` returns a `Set`.
Throws if no conditions are given, an index is not a registered head, or a
condition tries to drill through a non-matching branch.

### `searchSize(...conditions): number`

The count of matching items, without building the result collection.

### `searchHas(item, ...conditions): boolean`

Whether `item` is in the matched slice.

### `items(returnArray?): TItem[] | Set<TItem>`

All items, in sort order. `items(true)` returns an `Array`, `items()` /
`items(false)` returns a `Set`. Both are fresh copies; mutating them does not
affect the index.

### `size: number`

The number of stored items.

### `sort`

Get or set the compare function `(a, b) => number`. Setting it (or `undefined`
to clear) re-sorts the entire collection.

### `refresh(): void`

Re-sorts all items and buckets using the current compare function. Use it after
mutating sort keys on many items in place.

### `clear(): void`

Removes all items; the indexer stays configured and reusable.

### `dispose(): void`

Tears the indexer down and releases its configuration. The instance should not
be used afterwards.

## Development warnings

In `process.env.NODE_ENV === 'development'`, Hydreigon logs `console.warn`
hints for likely mistakes — duplicate head indexes, re-adding an existing item,
or removing one that isn't there. These are stripped from production behavior,
so they never affect the result, only the diagnostics.

## License

[MIT](./LICENSE) © Dean Yao
