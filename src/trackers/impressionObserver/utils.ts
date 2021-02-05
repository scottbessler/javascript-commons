import { OPTIMIZED, PRODUCER_MODE, STANDALONE_MODE } from '../../utils/constants';
import { ISettings } from '../../types';

/**
 * Checks if impressions previous time should be added or not.
 */
export function shouldAddPt(settings: ISettings) {
  return [PRODUCER_MODE, STANDALONE_MODE].indexOf(settings.mode) > -1 ? true : false;
}

/**
 * Checks if it should dedupe impressions or not.
 */
export function shouldBeOptimized(settings: ISettings) {
  if (!shouldAddPt(settings)) return false;
  return settings.sync.impressionsMode === OPTIMIZED ? true : false;
}
