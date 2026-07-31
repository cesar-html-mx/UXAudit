import { writeFileSync } from 'node:fs';

import { Heading as ExternalHeading } from '@acme/ui';
import MissingWidget from './missing/MissingWidget';

writeFileSync(new URL('../TARGET_CODE_EXECUTED', import.meta.url), 'executed');

export const UnresolvedPanel = () => (
  <>
    <MissingWidget />
    <ExternalHeading />
  </>
);
