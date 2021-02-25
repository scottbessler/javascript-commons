import splitsSyncTaskFactory from './syncTasks/splitsSyncTask';
import segmentsSyncTaskFactory from './syncTasks/segmentsSyncTask';
import { IStorageSync } from '../../storages/types';
import { IReadinessManager } from '../../readiness/types';
import { ISplitApi } from '../../services/types';
import { ISettings } from '../../types';
import { IPollingManager, ISegmentsSyncTask, ISplitsSyncTask } from './types';
import thenable from '../../utils/promise/thenable';
// import { logFactory } from '../../logger/sdkLogger';
// const log = logFactory('splitio-sync:polling-manager');

/**
 * Expose start / stop mechanism for pulling data from services.
 */
export default function pollingManagerSSFactory(
  splitApi: ISplitApi,
  storage: IStorageSync,
  readiness: IReadinessManager,
  settings: ISettings
): IPollingManager {

  const log = settings.log;

  const splitsSyncTask: ISplitsSyncTask = splitsSyncTaskFactory(splitApi.fetchSplitChanges, storage, readiness, settings);
  const segmentsSyncTask: ISegmentsSyncTask = segmentsSyncTaskFactory(splitApi.fetchSegmentChanges, storage, readiness, settings);

  return {
    splitsSyncTask,
    segmentsSyncTask,

    // Start periodic fetching (polling)
    start() {
      log.i('Starting polling');
      log.d(`Splits will be refreshed each ${settings.scheduler.featuresRefreshRate} millis`);
      log.d(`Segments will be refreshed each ${settings.scheduler.segmentsRefreshRate} millis`);

      const startingUp = splitsSyncTask.start();
      if (thenable(startingUp)) {
        startingUp.then(() => {
          segmentsSyncTask.start();
        });
      }
    },

    // Stop periodic fetching (polling)
    stop() {
      log.i('Stopping polling');

      if (splitsSyncTask.isRunning()) splitsSyncTask.stop();
      if (segmentsSyncTask.isRunning()) segmentsSyncTask.stop();
    },

    // Used by SyncManager to know if running in polling mode.
    isRunning: splitsSyncTask.isRunning,

    syncAll() {
      // fetch splits and segments. There is no need to catch this promise (`SplitChangesUpdater` is always resolved with a boolean value)
      return splitsSyncTask.execute().then(() => {
        return segmentsSyncTask.execute();
      });
    }
  };
}
