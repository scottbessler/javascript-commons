import { forOwn } from '../../../utils/lang';
import { logFactory } from '../../../logger/sdkLogger';
import { IReadinessManager } from '../../../readiness/types';
import { ISplitsCacheSync } from '../../../storages/types';
import { ISplitsParser } from '../splitsParser/types';
import { ISplitPartial } from '../../../dtos/types';
import syncTaskFactory from '../../syncTask';
import { ISyncTask } from '../../types';
import { ISettings } from '../../../types';
import { CONTROL } from '../../../utils/constants';
const log = logFactory('splitio-producer:offline');

/**
 * Offline equivalent of `splitChangesUpdaterFactory`
 */
export function fromObjectUpdaterFactory(
  splitsParser: ISplitsParser,
  storage: { splits: ISplitsCacheSync },
  readiness: IReadinessManager,
  settings: ISettings,
): () => Promise<boolean> {

  return function objectUpdater() {
    const splits: [string, string][] = [];
    let loadError = null;
    let splitsMock: false | Record<string, ISplitPartial> = {};
    try {
      splitsMock = splitsParser(settings);
    } catch (err) {
      loadError = err;
      log.e(`There was an issue loading the mock Splits data, no changes will be applied to the current cache. ${err}`);
    }

    if (!loadError && splitsMock) {
      log.d('Splits data: ');
      log.d(JSON.stringify(splitsMock));

      forOwn(splitsMock, function (val, name) {
        splits.push([
          name,
          JSON.stringify({
            name,
            status: 'ACTIVE',
            killed: false,
            trafficAllocation: 100,
            defaultTreatment: CONTROL,
            conditions: val.conditions || [],
            configurations: val.configurations,
            trafficTypeName: val.trafficTypeName
          })
        ]);
      });

      return Promise.all([
        storage.splits.clear(),
        storage.splits.addSplits(splits)
      ]).then(() => {
        readiness.splits.emit('SDK_SPLITS_ARRIVED');
        readiness.segments.emit('SDK_SEGMENTS_ARRIVED');
        return true;
      });
    } else {
      return Promise.resolve(true);
    }
  };
}

/**
 * PollingManager in Offline mode
 */
export default function fromObjectSyncTaskFactory(
  splitsParser: ISplitsParser,
  storage: { splits: ISplitsCacheSync },
  readiness: IReadinessManager,
  settings: ISettings
): ISyncTask<[], boolean> {
  return syncTaskFactory(
    fromObjectUpdaterFactory(
      splitsParser,
      storage,
      readiness,
      settings,
    ),
    settings.scheduler.offlineRefreshRate,
    'offlineUpdater'
  );
}
