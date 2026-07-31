import Button from './components/Button';
import { Hero as LandingHero, SiteHeader } from './components/Headings';
import { CycleA } from './cycles/CycleA';
import { UnresolvedPanel } from './UnresolvedPanel';

export const App = () => (
  <main>
    <SiteHeader />
    <LandingHero />
    <Button />
    <Button />
    <CycleA />
    <UnresolvedPanel />
  </main>
);
