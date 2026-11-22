import { Document, Font, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import regularUrl from '@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf?url';
import italicUrl from '@expo-google-fonts/ibm-plex-sans/400Regular_Italic/IBMPlexSans_400Regular_Italic.ttf?url';
import boldUrl from '@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf?url';
import {
  EMPLOYMENT_LABELS,
  EXAM_LABELS,
  LEVEL_LABELS,
  RESULT_LABELS,
  SCALE,
  YES_NO_LABELS,
  competencyName,
  formatAverage,
  formatPL,
  previewResult,
  today,
  type Employee,
  type Evaluation,
  type OverallLevel,
} from '@kompas/domain';

/*
 * PDF following the official form templates (knowledge/sources/forms/, docs/04 § 2) — NOT the app style guide.
 * Polish labels come only from labels.pl; averages with 2 decimals. Before completion the sheet is marked PROJEKT.
 */

Font.register({
  family: 'Plex',
  fonts: [{ src: regularUrl }, { src: italicUrl, fontStyle: 'italic' }, { src: boldUrl, fontWeight: 600 }],
});
Font.registerHyphenationCallback((w) => [w]);

const OFFICE = 'Ministerstwo Cyfryzacji';
const LEVELS: [OverallLevel, string][] = [
  ['FAR_ABOVE_EXPECTATIONS', '8,01 – 9,00'],
  ['ABOVE_EXPECTATIONS', '6,01 – 8,00'],
  ['MEETS_EXPECTATIONS', '4,01 – 6,00'],
  ['BELOW_EXPECTATIONS', '2,01 – 4,00'],
  ['FAR_BELOW_EXPECTATIONS', '1,00 – 2,00'],
];

const s = StyleSheet.create({
  page: { fontFamily: 'Plex', fontSize: 9, padding: 36, paddingBottom: 48, lineHeight: 1.35, color: '#000' },
  annex: { fontSize: 7.5, textAlign: 'right', marginBottom: 10, color: '#333' },
  title: { fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 2 },
  subtitle: { fontSize: 9, textAlign: 'center', marginBottom: 12 },
  part: { fontSize: 10, fontWeight: 600, backgroundColor: '#e6e6e6', padding: 4, marginTop: 10, marginBottom: 6, textAlign: 'center' },
  h: { fontWeight: 600, marginTop: 6, marginBottom: 3 },
  table: { borderWidth: 0.75, borderColor: '#000', marginBottom: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.75, borderColor: '#000' },
  trLast: { flexDirection: 'row' },
  th: { fontWeight: 600, backgroundColor: '#f2f2f2' },
  td: { padding: 3, borderRightWidth: 0.75, borderColor: '#000' },
  tdLast: { padding: 3 },
  box: { borderWidth: 0.75, borderColor: '#000', padding: 5, minHeight: 40, marginBottom: 4 },
  sigRow: { flexDirection: 'row', marginTop: 14, gap: 20 },
  sig: { flex: 1, borderTopWidth: 0.5, borderColor: '#000', paddingTop: 2, fontSize: 7.5, textAlign: 'center', marginTop: 18 },
  small: { fontSize: 7.5, color: '#333' },
  watermark: { position: 'absolute', top: 360, left: 60, fontSize: 90, color: '#000', opacity: 0.07, transform: 'rotate(-35deg)', fontWeight: 600 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, fontSize: 7, color: '#555', flexDirection: 'row', justifyContent: 'space-between' },
});

type Col = { w: number; text: ReactNode; bold?: boolean; center?: boolean };

function Table({ rows, header }: { header?: Col[]; rows: Col[][] }) {
  const all = header ? [header, ...rows] : rows;
  return (
    <View style={s.table} wrap={false}>
      {all.map((r, i) => (
        <View key={i} style={[i === all.length - 1 ? s.trLast : s.tr, header && i === 0 ? s.th : {}]}>
          {r.map((c, j) => (
            <View key={j} style={[j === r.length - 1 ? s.tdLast : s.td, { width: `${c.w}%` }]}>
              <Text style={[c.bold || (header && i === 0) ? { fontWeight: 600 } : {}, c.center ? { textAlign: 'center' } : {}]}>{c.text}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const KV = ({ items }: { items: [string, ReactNode][] }) => <Table rows={items.map(([k, v]) => [{ w: 38, text: k, bold: true }, { w: 62, text: v }])} />;
const Signatures = ({ labels }: { labels: string[] }) => (
  <View style={s.sigRow} wrap={false}>
    {labels.map((l) => (
      <Text key={l} style={s.sig}>
        {l}
      </Text>
    ))}
  </View>
);
const choice = (opts: string[], selected: string | null | undefined) => opts.map((o) => `${o === selected ? '[X]' : '[  ]'} ${o}`).join('    ');
const split = (name: string) => {
  const [first, ...rest] = name.split(' ');
  return { first, last: rest.join(' ') };
};

function Shell({ children, ev, draft, annex }: { children: ReactNode; ev: Evaluation; draft: boolean; annex: string }) {
  return (
    <Page size="A4" style={s.page}>
      {draft && (
        <Text style={s.watermark} fixed>
          PROJEKT
        </Text>
      )}
      <Text style={s.annex}>{annex}</Text>
      {children}
      <View style={s.footer} fixed>
        <Text>
          Kompas Kompetencji · {ev.employeeName} · wygenerowano {formatPL(today())}
          {draft ? ' · PROJEKT — ocena nie została zatwierdzona' : ''}
        </Text>
        <Text render={({ pageNumber, totalPages }) => `str. ${pageNumber}/${totalPages}`} />
      </View>
    </Page>
  );
}

export type PdfPart = 'START' | 'ALL';

function PeriodicSheet({ ev, employee, draft, part }: { ev: Evaluation; employee: Employee; draft: boolean; part: PdfPart }) {
  const isB = ev.formType === 'FORM_B';
  const mandatory = ev.criteriaAssessments.filter((a) => a.isMandatory);
  const additional = ev.criteriaAssessments.filter((a) => !a.isMandatory);
  const isOfficial = employee.employmentType === 'CIVIL_SERVANT';
  const result = ev.summary ?? previewResult(ev);
  const pr = ev.promotionRequest;
  const prev = employee.lastPeriodicEvaluation;
  const emp = split(ev.employeeName);
  const sup = split(ev.supervisorName);
  return (
    <Shell ev={ev} draft={draft} annex={`Załącznik nr ${isB ? 3 : 4} do rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. (Dz. U. poz. 470) — WZÓR`}>
      <Text style={s.title}>ARKUSZ {isB ? 'B' : 'C'} — OCENA OKRESOWA</Text>
      <Text style={s.subtitle}>{EMPLOYMENT_LABELS[employee.employmentType].toUpperCase()}</Text>

      <Text style={s.part}>CZĘŚĆ I</Text>
      <KV items={[['NAZWA URZĘDU', OFFICE]]} />
      <Text style={s.h}>DANE OCENIANEGO</Text>
      <KV items={[['Imię', emp.first], ['Nazwisko', emp.last], ['Komórka organizacyjna', [employee.osp.department, employee.osp.unit].filter((x, i, a) => x && a.indexOf(x) === i).join(', ')], ['Stanowisko pracy', employee.osp.positionName]]} />
      <Text style={s.h}>DANE OCENIAJĄCEGO</Text>
      <KV items={[['Imię', sup.first], ['Nazwisko', sup.last], ['Komórka organizacyjna', employee.osp.unit], ['Stanowisko pracy', employee.osp.directSupervisorPosition]]} />
      <Text style={s.h}>KRYTERIA OCENY I TERMIN SPORZĄDZENIA OCENY</Text>
      <Table
        header={[{ w: 50, text: 'Kryteria obowiązkowe' }, { w: 50, text: 'Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3)' }]}
        rows={Array.from({ length: Math.max(mandatory.length, 3) }, (_, i) => [
          { w: 50, text: mandatory[i] ? competencyName(mandatory[i].competencyId) : '' },
          { w: 50, text: additional[i] ? competencyName(additional[i].competencyId) : '' },
        ])}
      />
      <KV items={[['Termin sporządzenia oceny', formatPL(ev.deadlines.evaluationDueDate)]]} />
      <Text style={s.small}>
        Potwierdzamy: przeprowadzenie rozmowy, o której mowa w § 5 ust. 1 rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r., oraz zapoznanie ocenianego
        z kryteriami oceny oraz terminem sporządzenia oceny. Data: {formatPL(ev.deadlines.initialTalkDate)}
      </Text>
      <Signatures labels={['miejscowość, data, podpis oceniającego', 'miejscowość, data, podpis ocenianego']} />

      {part === 'ALL' && (
        <>
          <Text style={s.part} break>
            CZĘŚĆ II
          </Text>
          <KV
            items={[
              ['DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ', formatPL(ev.deadlines.finalTalkDate)],
              ['OKRES, W KTÓRYM OCENIANY PODLEGAŁ OCENIE', `od ${formatPL(ev.deadlines.periodFrom)} do ${formatPL(ev.deadlines.periodTo)}`],
            ]}
          />
          <Text style={s.h}>OCENY CZĄSTKOWE</Text>
          <Table
            header={[{ w: 6, text: 'Lp.' }, { w: 49, text: 'Kryterium' }, ...SCALE[ev.formType].map((v) => ({ w: 9, text: `${v}`, center: true }))]}
            rows={ev.criteriaAssessments.map((a, i) => [
              { w: 6, text: `${i + 1}.`, center: true },
              { w: 49, text: `${competencyName(a.competencyId)}${a.isMandatory ? '' : ' (dodatkowe)'}` },
              ...SCALE[ev.formType].map((v) => ({ w: 9, text: a.finalScore === v ? 'X' : '', center: true, bold: true })),
            ])}
          />
          <Text style={s.small}>1 — znacznie poniżej oczekiwań · 3 — poniżej oczekiwań · 5 — na poziomie oczekiwań · 7 — powyżej oczekiwań · 9 — znacznie powyżej oczekiwań</Text>
          <KV items={[['ŚREDNIA ARYTMETYCZNA OCEN CZĄSTKOWYCH', formatAverage(result?.averageScore)]]} />
          <Text style={s.h}>OGÓLNY POZIOM SPEŁNIANIA KRYTERIÓW OCENY</Text>
          <Table
            rows={LEVELS.map(([l, range]) => [
              { w: 60, text: LEVEL_LABELS[l] },
              { w: 30, text: range, center: true },
              { w: 10, text: result?.overallLevel === l ? 'X' : '', center: true, bold: true },
            ])}
          />
          <KV items={[['OCENA OKRESOWA', choice(['POZYTYWNA', 'NEGATYWNA'], result ? RESULT_LABELS[result.finalResult] : null)]]} />
          <Text style={s.h}>UZASADNIENIE PRZYZNANEJ OCENY OKRESOWEJ{result?.finalResult === 'NEGATIVE' ? ' (obowiązkowe przy ocenie negatywnej)' : ''}</Text>
          <View style={s.box}>
            <Text>{ev.texts.justification || '—'}</Text>
          </View>
          <Text style={s.h}>WNIOSKI DOTYCZĄCE INDYWIDUALNEGO PROGRAMU ROZWOJU ZAWODOWEGO</Text>
          <View style={s.box}>
            <Text>{ev.texts.developmentPlan || '—'}</Text>
          </View>
          <Text style={s.h}>DANE DOTYCZĄCE POPRZEDNIEJ OCENY OKRESOWEJ URZĘDNIKA SŁUŻBY CYWILNEJ</Text>
          <KV
            items={[
              ['Ocena / poziom / data', isOfficial && prev ? `${RESULT_LABELS[prev.result].toLowerCase()} / ${prev.level ? LEVEL_LABELS[prev.level] : '—'} / ${formatPL(prev.date)}` : 'nie dotyczy'],
              ['Dołączono wniosek o przyznanie kolejnego stopnia służbowego', choice(['TAK', 'NIE', 'NIE DOTYCZY'], !isOfficial ? 'NIE DOTYCZY' : pr.included ? 'TAK' : 'NIE')],
            ]}
          />
          <Signatures labels={['data, podpis oceniającego', 'data zapoznania się z oceną, podpis ocenianego']} />
          <View style={[s.box, { marginTop: 12, minHeight: 0 }]} wrap={false}>
            <Text style={{ fontWeight: 600 }}>POUCZENIE</Text>
            <Text>
              Od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do dyrektora generalnego urzędu (art. 83 ust. 1 ustawy z dnia 21
              listopada 2008 r. o służbie cywilnej).
              {ev.deadlines.acknowledgedAt ? ` Data zapoznania: ${formatPL(ev.deadlines.acknowledgedAt)}; sprzeciw do: ${formatPL(ev.deadlines.objectionDeadline)}.` : ''}
            </Text>
          </View>

          {isOfficial && pr.included && result?.finalResult === 'POSITIVE' && (
            <>
              <Text style={s.part} break>
                CZĘŚĆ III — WNIOSEK O PRZYZNANIE KOLEJNEGO STOPNIA SŁUŻBOWEGO
              </Text>
              <KV
                items={[
                  ['Imię i nazwisko urzędnika', ev.employeeName],
                  ['Rok mianowania', String(pr.appointmentYear ?? '')],
                  ['Posiadany stopień służbowy', pr.currentRank ?? ''],
                  ['Data przyznania posiadanego stopnia', formatPL(pr.currentRankGrantedAt)],
                  ['Wnioskowany stopień służbowy', pr.requestedRank ?? ''],
                ]}
              />
              <Text style={s.h}>Umotywowanie wniosku</Text>
              <View style={s.box}>
                <Text>{pr.motivation}</Text>
              </View>
              <Signatures labels={['data, podpis oceniającego']} />
            </>
          )}
        </>
      )}
    </Shell>
  );
}

function FirstSheet({ ev, employee, draft, part }: { ev: Evaluation; employee: Employee; draft: boolean; part: PdfPart }) {
  const req = ev.firstEvalRequirements;
  const result = ev.summary ?? previewResult(ev);
  const positive = result?.finalResult === 'POSITIVE';
  const emp = split(ev.employeeName);
  const sup = split(ev.supervisorName);
  // documents seeded before these fields existed have no head data — the form then keeps empty lines to fill in by hand
  const head = split(employee.departmentHeadName ?? '');
  const d = ev.deadlines;
  return (
    <Shell ev={ev} draft={draft} annex="Załącznik nr 2 do rozporządzenia Prezesa Rady Ministrów z dnia 23 lipca 2015 r. (Dz. U. poz. 1144) — WZÓR">
      <Text style={s.title}>ARKUSZ PIERWSZEJ OCENY W SŁUŻBIE CYWILNEJ</Text>
      <Text style={s.subtitle}> </Text>

      <Text style={s.part}>I. CZĘŚĆ OGÓLNA</Text>
      <KV items={[['NAZWA URZĘDU', OFFICE]]} />
      <Text style={s.h}>DANE OCENIANEGO</Text>
      <KV items={[['Imię', emp.first], ['Nazwisko', emp.last], ['Komórka organizacyjna', employee.osp.unit], ['Stanowisko pracy', employee.osp.positionName], ['Data nawiązania stosunku pracy', formatPL(employee.hireDate)]]} />
      <Text style={s.h}>DANE BEZPOŚREDNIEGO PRZEŁOŻONEGO</Text>
      <KV items={[['Imię', sup.first], ['Nazwisko', sup.last], ['Komórka organizacyjna', employee.osp.unit], ['Stanowisko pracy', employee.osp.directSupervisorPosition]]} />
      <Text style={s.h}>DANE KIERUJĄCEGO KOMÓRKĄ ORGANIZACYJNĄ</Text>
      <KV items={[['Imię', head.first], ['Nazwisko', head.last], ['Komórka organizacyjna', employee.osp.department], ['Stanowisko pracy', employee.departmentHeadPosition ?? '']]} />

      <Text style={s.part}>II. ROZMOWA WSTĘPNA</Text>
      <KV
        items={[
          ['Data przeprowadzenia rozmowy wstępnej', formatPL(d.initialTalkDate)],
          ['Termin wyznaczony na złożenie sprawozdania', `od ${formatPL(d.reportDueFrom)} – do ${formatPL(d.reportDueTo)}`],
          ['Okres, w którym powinna zostać dokonana pierwsza ocena', `od ${formatPL(d.evaluationWindowFrom)} – do ${formatPL(d.evaluationWindowTo)}`],
        ]}
      />
      <Text style={s.small}>Potwierdzamy przeprowadzenie rozmowy wstępnej oraz wyznaczenie terminu na złożenie sprawozdania i zapoznanie z nim ocenianego.</Text>
      <Signatures labels={['miejscowość, data, podpis bezpośredniego przełożonego', 'miejscowość, data, podpis ocenianego']} />

      {part === 'ALL' && (
        <>
          <Text style={s.part} break>
            III. ROZMOWA OCENIAJĄCA
          </Text>
          <KV items={[['Data przeprowadzenia rozmowy oceniającej', formatPL(d.finalTalkDate)]]} />
          <Signatures labels={['podpis bezpośredniego przełożonego', 'podpis ocenianego']} />

          <Text style={s.part}>IV. OCENA ELEMENTÓW</Text>
          <Table
            header={[{ w: 6, text: 'Lp.' }, { w: 58, text: 'Element oceny' }, ...[3, 5, 7].map((v) => ({ w: 12, text: `${v} pkt`, center: true }))]}
            rows={ev.criteriaAssessments.map((a, i) => [
              { w: 6, text: `${i + 1}.`, center: true },
              { w: 58, text: competencyName(a.competencyId) },
              ...[3, 5, 7].map((v) => ({ w: 12, text: a.finalScore === v ? 'X' : '', center: true, bold: true })),
            ])}
          />
          <Text style={s.small}>3 pkt — poniżej oczekiwań · 5 pkt — na poziomie oczekiwań · 7 pkt — powyżej oczekiwań</Text>
          <KV items={[['OCENA ŁĄCZNA (średnia arytmetyczna)', formatAverage(result?.averageScore)]]} />

          <Text style={s.part}>V. PIERWSZA OCENA</Text>
          <KV
            items={[
              ['Zaliczenie egzaminu ze służby przygotowawczej', choice(['TAK', 'NIE', 'NIE DOTYCZY'], req?.examPassed ? EXAM_LABELS[req.examPassed] : null)],
              ['Sprawozdanie złożone w terminie', choice(['TAK', 'NIE'], req?.reportSubmittedOnTime ? YES_NO_LABELS[req.reportSubmittedOnTime] : null)],
              ['PIERWSZA OCENA', choice(['POZYTYWNA', 'NEGATYWNA'], result ? RESULT_LABELS[result.finalResult] : null)],
            ]}
          />
          <Text style={s.h}>Uzasadnienie przyznanej oceny{result?.finalResult === 'NEGATIVE' ? ' (obowiązkowe)' : ''}</Text>
          <View style={s.box}>
            <Text>{ev.texts.justification || '—'}</Text>
          </View>

          {positive && (
            <>
              <Text style={s.part}>VI. WNIOSKI DOTYCZĄCE ROZWOJU ZAWODOWEGO</Text>
              <View style={s.box}>
                <Text>{ev.texts.developmentPlan || '—'}</Text>
              </View>
            </>
          )}
          <Text style={s.h}>Potwierdzenie dokonania pierwszej oceny</Text>
          <Signatures labels={['data, podpis bezpośredniego przełożonego', 'data, podpis kierującego komórką organizacyjną']} />
          {ev.departmentHeadApprovedAt && <Text style={s.small}>Zatwierdzono w systemie przez kierującego komórką: {new Date(ev.departmentHeadApprovedAt).toLocaleDateString('pl-PL')}</Text>}
          <Signatures labels={['data zapoznania się z oceną, podpis ocenianego']} />
        </>
      )}
    </Shell>
  );
}

export function evaluationDocument(ev: Evaluation, employee: Employee, opts: { draft: boolean; part?: PdfPart }) {
  const part = opts.part ?? 'ALL';
  return (
    <Document title={`${ev.type === 'FIRST_EVALUATION' ? 'Arkusz pierwszej oceny' : 'Arkusz oceny okresowej'} — ${ev.employeeName}`} author="Kompas Kompetencji" language="pl">
      {ev.type === 'FIRST_EVALUATION' ? (
        <FirstSheet ev={ev} employee={employee} draft={opts.draft} part={part} />
      ) : (
        <PeriodicSheet ev={ev} employee={employee} draft={opts.draft} part={part} />
      )}
    </Document>
  );
}

export async function downloadEvaluationPdf(ev: Evaluation, employee: Employee, opts: { draft: boolean; part?: PdfPart }) {
  const blob = await pdf(evaluationDocument(ev, employee, opts)).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const kind = ev.type === 'FIRST_EVALUATION' ? 'pierwsza-ocena' : `ocena-okresowa-${ev.formType === 'FORM_B' ? 'B' : 'C'}`;
  a.href = url;
  a.download = `${kind}_${ev.employeeName.replace(/\s+/g, '_')}${opts.draft ? '_PROJEKT' : ''}${opts.part === 'START' ? '_rozpoczecie' : ''}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
