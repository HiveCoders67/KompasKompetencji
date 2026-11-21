import { useState } from 'react';
import { FormalChat } from '../components/AssistantPanel';
import { Card, PageHeader } from '../components/ui';

export function AssistantPage() {
  const [path, setPath] = useState<'' | 'A' | 'B'>('');
  return (
    <>
      <PageHeader
        title="Asystent formalny"
        lead="Pytania o przepisy, terminy, dobór arkusza, nieobecności, zmianę stanowiska czy sprzeciw. Każda odpowiedź wskazuje źródło; gdy baza wiedzy nie zawiera odpowiedzi — asystent odmawia zamiast zgadywać."
        actions={
          <select className="select text-sm" value={path} onChange={(e) => setPath(e.target.value as '' | 'A' | 'B')} aria-label="Zawęź do ścieżki">
            <option value="">Obie ścieżki</option>
            <option value="A">Pierwsza ocena</option>
            <option value="B">Ocena okresowa</option>
          </select>
        }
      />
      <Card className="h-[calc(100vh-260px)] min-h-[480px]">
        <FormalChat key={path} path={path || undefined} examples />
      </Card>
    </>
  );
}
