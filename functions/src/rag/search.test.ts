import { describe, expect, it } from 'vitest';
import testset from './testset.json';
import { CHUNKS, retrieve, search } from './search';

describe('RAG index', () => {
  it('every chunk carries {source, unit, page} metadata and text', () => {
    expect(CHUNKS.length).toBeGreaterThan(500);
    for (const c of CHUNKS) {
      expect(c.source).toBeTruthy();
      expect(c.text.length).toBeGreaterThan(20);
      expect(c.unit !== null || c.page !== null).toBe(true);
    }
  });
});

describe('retrieval — assistant test set', () => {
  for (const tc of testset.cases.filter((c) => !c.refuse)) {
    it(`${tc.id}: expected source retrieved`, () => {
      const hits = retrieve(tc.question, { path: tc.path as 'A' | 'B' | null });
      expect(hits.length).toBeLessThanOrEqual(14);
      const found = hits.some((h) =>
        (tc.units as [string, string | null][]).some(([s, u]) => h.chunk.source === s && (u === null || h.chunk.unit?.startsWith(u))),
      );
      if (!found) console.log(tc.id, hits.map((h) => `${h.chunk.source} ${h.chunk.unit} p${h.chunk.page}`));
      expect(found).toBe(true);
    });
  }
  it('query without content terms returns nothing', () => {
    expect(search('czy to jest')).toEqual([]);
  });
});
