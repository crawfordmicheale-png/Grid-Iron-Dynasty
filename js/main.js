// Entry point. Registers every screen, then boots the shell.

import { bootstrap } from './ui/app.js';
import './ui/screens/setup.js';
import './ui/screens/hub.js';
import './ui/screens/gameday.js';
import './ui/screens/roster.js';
import './ui/screens/gameplan.js';
import './ui/screens/frontoffice.js';
import './ui/screens/staff.js';
import './ui/screens/league.js';

bootstrap(document.getElementById('app'));
