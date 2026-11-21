import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOspDocx, recommendForm, resolveForm } from './osp';

const docx = (f: string) => new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../demo-data/osp', f)));

describe('OSP — form rule (docs/02 § 1.2)', () => {
  it('„brak podległych” → C; any „kieruje lub koordynuje” → B with confirmation', () => {
    expect(recommendForm('NONE')).toBe('FORM_C');
    expect(recommendForm('UP_TO_4')).toBe('FORM_B');
    expect(resolveForm({ subordinates: 'FROM_5_TO_9', managementConfirmed: null })).toBeNull();
    expect(resolveForm({ subordinates: 'FROM_5_TO_9', managementConfirmed: true })).toBe('FORM_B');
    expect(resolveForm({ subordinates: 'UP_TO_4', managementConfirmed: false })).toBe('FORM_C');
  });
});

describe('OSP — DOCX parser on the 3 MC files (docs/04 § 1)', () => {
  it('scenario 1: senior specialist → C, soft competencies', () => {
    const p = parseOspDocx(docx('osp-dc-wzksoic-6-starszy-specjalista.docx'));
    expect(p).toMatchObject({ symbol: 'DC WZKSOiC 6', positionName: 'starszy specjalista', subordinates: 'NONE', directSupervisorPosition: 'naczelnik wydziału' });
    expect(p.department).toBe('Departament Cyberbezpieczeństwa');
    expect(p.softCompetencies).toEqual(['ORGANIZACJA_PRACY', 'WSPOLPRACA', 'MYSLENIE_ANALITYCZNE', 'WYKORZYSTYWANIE_WIEDZY']);
    expect(p.mainTasks.length).toBeGreaterThanOrEqual(3);
    expect(p.difficultyFactors).toContain('nietypowe godziny pracy (w tym dyżury)');
  });
  it('scenario 2: radca → C', () => {
    const p = parseOspDocx(docx('osp-dsi-wwi-5-radca.docx'));
    expect(p).toMatchObject({ symbol: 'DSI WWI 5', subordinates: 'NONE' });
    expect(p.softCompetencies).toEqual(['ORGANIZACJA_PRACY', 'WYKORZYSTYWANIE_WIEDZY', 'WSPOLPRACA']);
  });
  it('scenario 3: head of unit → B (5–9 subordinates)', () => {
    const p = parseOspDocx(docx('osp-dwm-wkam-1-naczelnik-wydzialu.docx'));
    expect(p).toMatchObject({ symbol: 'DWM WKAM 1', subordinates: 'FROM_5_TO_9', directSupervisorPosition: 'zastępca dyrektora' });
    expect(recommendForm(p.subordinates)).toBe('FORM_B');
    expect(p.softCompetencies).toContain('ZARZADZANIE_LUDZMI');
    expect(p.difficultyFactors).toContain('zagrożenie korupcją');
  });
  it('rejects non-DOCX input', () => {
    expect(() => parseOspDocx(new Uint8Array([1, 2, 3]))).toThrow(/DOCX/);
  });
});
