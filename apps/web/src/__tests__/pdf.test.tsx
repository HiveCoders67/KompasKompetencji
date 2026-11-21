// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const font = vi.hoisted(() => (p: string) => ({ default: `${process.cwd()}/../../node_modules/@expo-google-fonts/ibm-plex-sans/${p}` }));
vi.mock('@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf?url', () => font('400Regular/IBMPlexSans_400Regular.ttf'));
vi.mock('@expo-google-fonts/ibm-plex-sans/400Regular_Italic/IBMPlexSans_400Regular_Italic.ttf?url', () => font('400Regular_Italic/IBMPlexSans_400Regular_Italic.ttf'));
vi.mock('@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf?url', () => font('600SemiBold/IBMPlexSans_600SemiBold.ttf'));

import { pdf } from '@react-pdf/renderer';
import { DEMO_EMPLOYEES, buildDemoEvaluations, recalc, type Score } from '@kompas/domain';
import { evaluationDocument } from '../pdf/generate';

describe('PDF export (official form layout)', () => {
  it('renders the completed form B and a draft first-evaluation form', async () => {
    const evs = buildDemoEvaluations();
    for (const id of ['ev_szymanski_2025', 'ev_mazur_first', 'ev_wojcik_2026']) {
      let ev = evs.find((e) => e.id === id)!;
      if (id === 'ev_mazur_first') {
        ev = recalc({
          ...ev,
          criteriaAssessments: ev.criteriaAssessments.map((a, i) => ({ ...a, finalScore: ([3, 5, 5, 5, 7] as Score[])[i] })),
          firstEvalRequirements: { examPassed: 'YES', reportSubmittedOnTime: 'YES' },
        });
      }
      const emp = DEMO_EMPLOYEES.find((e) => e.id === ev.employeeId)!;
      const stream = await pdf(evaluationDocument(ev, emp, { draft: ev.summary === null, part: id === 'ev_wojcik_2026' ? 'START' : 'ALL' })).toBuffer();
      const chunks: Buffer[] = [];
      for await (const c of stream as unknown as AsyncIterable<Buffer>) chunks.push(c);
      const buf = Buffer.concat(chunks);
      expect(buf.subarray(0, 4).toString()).toBe('%PDF');
      if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/${id}.pdf`, buf);
    }
  }, 60000);
});
