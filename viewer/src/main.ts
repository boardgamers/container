import launchSelfContained from './self-contained';
import { launchTutorial } from './wrapper';

const chapter = new URLSearchParams(location.search).get('chapter');
if (chapter) void launchTutorial('#app', { chapter });
else launchSelfContained();
