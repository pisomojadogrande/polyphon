import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, generatedName, nameIdentity } from '../src/names.ts';
test('clip names normalize case, width, and repeated whitespace without using file paths', () => {
  assert.equal(cleanName('  My   Song  '), 'My Song');
  assert.equal(nameIdentity('ＭＹ Song'), nameIdentity('my song'));
  for (const value of ['', '  ', '../clip', 'a\\b', 'a\0b', 'a'.repeat(81), 42]) assert.throws(() => cleanName(value));
});
test('generated names are recognizable word pairs and skip occupied suggestions', () => {
  const used = new Set<string>();
  for (let i = 0; i < 100; i++) { const name = generatedName(n => !used.has(n)); assert.match(name, /^[a-z]+-[a-z]+$/); assert.ok(!used.has(name)); used.add(name); }
  assert.throws(() => generatedName(() => false), /enter your own/);
});
