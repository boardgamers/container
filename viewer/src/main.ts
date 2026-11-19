import launchSelfContained from './self-contained';
import { launchTutorial } from './wrapper';

const params = new URLSearchParams(location.search);
const chapter = params.get('chapter');
if (chapter) void launchTutorial('#app', { chapter, locale: params.get('locale') || undefined });
else launchSelfContained();
