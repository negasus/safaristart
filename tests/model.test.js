import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyBoard, createGroup, updateItem, removeItem, addBreak,
  addLink, updateLink, removeLink, moveItem, moveLink, toggleCollapsed,
  filterLinks, normalizeUrl, hostOf, migrate, findLink, addSeparator, isSeparator, linkCount,
} from '../extension/js/model.js';

function board() {
  let s = emptyBoard();
  s = createGroup(s, { id: 'g1', title: 'Work' });
  s = createGroup(s, { id: 'g2', title: 'Dev', color: 'blue', width: 'l' });
  s = addBreak(s, { id: 'b1', label: 'Personal' });
  s = addLink(s, 'g1', { id: 'l1', title: 'Gmail', url: 'https://mail.google.com' });
  s = addLink(s, 'g1', { id: 'l2', title: 'Jira', url: 'https://jira.example.com' });
  s = addLink(s, 'g2', { id: 'l3', title: 'GitHub', url: 'https://github.com' });
  return s;
}

const ids = (s) => s.items.map((i) => i.id);
const linkIds = (s, gid) => s.items.find((i) => i.id === gid).links.map((l) => l.id);

test('createGroup appends group with defaults', () => {
  const s = createGroup(emptyBoard(), { title: 'A' });
  assert.equal(s.items.length, 1);
  const g = s.items[0];
  assert.equal(g.type, 'group');
  assert.equal(g.title, 'A');
  assert.equal(g.width, 'm');
  assert.equal(g.color, 'gray');
  assert.equal(g.view, 'chips');
  assert.equal(g.collapsed, false);
  assert.deepEqual(g.links, []);
  assert.ok(g.id);
});

test('functions do not mutate input', () => {
  const s = board();
  const snapshot = JSON.stringify(s);
  createGroup(s, { title: 'X' });
  addLink(s, 'g1', { title: 'x', url: 'https://x.com' });
  moveItem(s, 'g1', 2);
  moveLink(s, 'l1', 'g2', 0);
  removeLink(s, 'l1');
  toggleCollapsed(s, 'g1');
  updateItem(s, 'g1', { title: 'Y' });
  assert.equal(JSON.stringify(s), snapshot);
});

test('addBreak appends break, optional index', () => {
  let s = board();
  s = addBreak(s, { id: 'b2', label: '' }, 0);
  assert.deepEqual(ids(s), ['b2', 'g1', 'g2', 'b1']);
  assert.equal(s.items[0].type, 'break');
});

test('createGroup supports insertion index', () => {
  const s = createGroup(board(), { id: 'g3', title: 'N' }, 1);
  assert.deepEqual(ids(s), ['g1', 'g3', 'g2', 'b1']);
});

test('updateItem patches group and break', () => {
  let s = updateItem(board(), 'g1', { title: 'Job', width: 'full', color: 'red' });
  assert.equal(s.items[0].title, 'Job');
  assert.equal(s.items[0].width, 'full');
  s = updateItem(s, 'b1', { label: 'Home' });
  assert.equal(s.items[2].label, 'Home');
});

test('removeItem removes group or break', () => {
  const s = removeItem(removeItem(board(), 'g1'), 'b1');
  assert.deepEqual(ids(s), ['g2']);
});

test('addLink / updateLink / removeLink', () => {
  let s = board();
  s = updateLink(s, 'l2', { title: 'JIRA' });
  assert.equal(findLink(s, 'l2').link.title, 'JIRA');
  s = removeLink(s, 'l1');
  assert.deepEqual(linkIds(s, 'g1'), ['l2']);
  assert.equal(findLink(s, 'l1'), null);
});

test('addLink normalizes url and defaults title to host', () => {
  const s = addLink(emptyBoardWithGroup(), 'g', { url: 'news.ycombinator.com' });
  const link = s.items[0].links[0];
  assert.equal(link.url, 'https://news.ycombinator.com');
  assert.equal(link.title, 'news.ycombinator.com');
});

function emptyBoardWithGroup() {
  return createGroup(emptyBoard(), { id: 'g', title: 'G' });
}

test('moveItem moves to index in list without the item', () => {
  assert.deepEqual(ids(moveItem(board(), 'g1', 2)), ['g2', 'b1', 'g1']);
  assert.deepEqual(ids(moveItem(board(), 'b1', 0)), ['b1', 'g1', 'g2']);
  assert.deepEqual(ids(moveItem(board(), 'g2', 1)), ['g1', 'g2', 'b1']);
  assert.deepEqual(ids(moveItem(board(), 'g1', 99)), ['g2', 'b1', 'g1']);
});

test('moveLink within group', () => {
  const s = moveLink(board(), 'l2', 'g1', 0);
  assert.deepEqual(linkIds(s, 'g1'), ['l2', 'l1']);
});

test('moveLink across groups', () => {
  const s = moveLink(board(), 'l1', 'g2', 1);
  assert.deepEqual(linkIds(s, 'g1'), ['l2']);
  assert.deepEqual(linkIds(s, 'g2'), ['l3', 'l1']);
});

test('moveLink to unknown group is a no-op', () => {
  const s = board();
  assert.equal(moveLink(s, 'l1', 'nope', 0), s);
});

test('toggleCollapsed flips flag', () => {
  let s = toggleCollapsed(board(), 'g1');
  assert.equal(s.items[0].collapsed, true);
  s = toggleCollapsed(s, 'g1');
  assert.equal(s.items[0].collapsed, false);
});

test('filterLinks matches all tokens over title and url, case-insensitive', () => {
  const s = board();
  assert.deepEqual(filterLinks(s, 'git').map((l) => l.id), ['l3']);
  assert.deepEqual(filterLinks(s, 'GOOGLE').map((l) => l.id), ['l1']);
  assert.deepEqual(filterLinks(s, 'jira example').map((l) => l.id), ['l2']);
  assert.deepEqual(filterLinks(s, 'jira github').map((l) => l.id), []);
  assert.deepEqual(filterLinks(s, '  ').map((l) => l.id), ['l1', 'l2', 'l3']);
});

test('normalizeUrl', () => {
  assert.equal(normalizeUrl('  example.com '), 'https://example.com');
  assert.equal(normalizeUrl('http://a.b'), 'http://a.b');
  assert.equal(normalizeUrl('localhost:3000'), 'https://localhost:3000');
  assert.equal(normalizeUrl('mailto:a@b.c'), 'mailto:a@b.c');
  assert.equal(normalizeUrl('javascript:alert(1)'), 'https://javascript:alert(1)');
  assert.equal(normalizeUrl(''), '');
});

test('hostOf', () => {
  assert.equal(hostOf('https://www.github.com/x'), 'github.com');
  assert.equal(hostOf('garbage'), '');
});

test('migrate returns empty board for garbage', () => {
  assert.deepEqual(migrate(null), emptyBoard());
  assert.deepEqual(migrate({ version: 99, items: [] }), emptyBoard());
  assert.deepEqual(migrate({ version: 1, items: 'x' }), emptyBoard());
});

test('migrate sanitizes items', () => {
  const s = migrate({
    version: 1,
    items: [
      { type: 'group', id: 'g', title: 'G', width: 'huge', view: 'grid', links: [{ id: 'l', url: 'https://a.com' }, 5] },
      { type: 'break', id: 'b' },
      { type: 'weird' },
    ],
  });
  assert.equal(s.items.length, 2);
  assert.equal(s.items[0].width, 'm');
  assert.equal(s.items[0].color, 'gray');
  assert.equal(s.items[0].view, 'chips');
  assert.equal(s.items[0].links.length, 1);
  assert.equal(s.items[0].links[0].title, 'a.com');
  assert.equal(s.items[1].label, '');
});

test('createGroup keeps tiles view', () => {
  const s = createGroup(emptyBoard(), { title: 'T', view: 'tiles' });
  assert.equal(s.items[0].view, 'tiles');
});

test('migrate keeps valid view', () => {
  const s = migrate({ version: 1, items: [{ type: 'group', id: 'g', view: 'tiles', links: [] }] });
  assert.equal(s.items[0].view, 'tiles');
});

test('addSeparator inserts separator into group links', () => {
  let s = addSeparator(board(), 'g1', { id: 's1' }, 1);
  assert.deepEqual(linkIds(s, 'g1'), ['l1', 's1', 'l2']);
  assert.ok(isSeparator(s.items[0].links[1]));
  assert.equal(linkCount(s.items[0]), 2);
  s = addSeparator(s, 'g1', { id: 's2' });
  assert.deepEqual(linkIds(s, 'g1'), ['l1', 's1', 'l2', 's2']);
});

test('separators move and are removed like links', () => {
  let s = addSeparator(board(), 'g1', { id: 's1' });
  s = moveLink(s, 's1', 'g2', 0);
  assert.deepEqual(linkIds(s, 'g1'), ['l1', 'l2']);
  assert.deepEqual(linkIds(s, 'g2'), ['s1', 'l3']);
  s = removeLink(s, 's1');
  assert.deepEqual(linkIds(s, 'g2'), ['l3']);
});

test('filterLinks skips separators', () => {
  const s = addSeparator(board(), 'g1', { id: 's1' });
  assert.deepEqual(filterLinks(s, '').map((l) => l.id), ['l1', 'l2', 'l3']);
});

test('migrate keeps separators', () => {
  const s = migrate({
    version: 1,
    items: [{ type: 'group', id: 'g', links: [{ id: 'l', url: 'https://a.com' }, { type: 'separator', id: 's' }] }],
  });
  assert.deepEqual(s.items[0].links, [{ id: 'l', title: 'a.com', url: 'https://a.com' }, { type: 'separator', id: 's' }]);
});
