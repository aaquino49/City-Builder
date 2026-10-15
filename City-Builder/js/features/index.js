// Feature modules register themselves via onHook(). Import each feature file here.
// Order matters: scoutmarkers draws on top of the minimap canvas each frame,
// so minimap must register its frame hook first.
import './minimap.js';
import './scoutmarkers.js';
import './eventlog.js';
import './rates.js';
