import { ISdkFactoryParams } from './types';
import sdkReadinessManagerFactory from '../readiness/sdkReadinessManager';
import { logFactory, API } from '../logger/sdkLogger';
import buildMetadata from '../utils/settingsValidation/buildMetadata';
import impressionsTrackerFactory from '../trackers/impressionsTracker';
import eventTrackerFactory from '../trackers/eventTracker';
import { IStorageSync } from '../storages/types';
import { SplitIO } from '../types';
import { ISplitApi } from '../services/types';
import { getMatching } from '../utils/key';
import { shouldBeOptimized } from '../trackers/impressionObserver/utils';
import { validateAndTrackApiKey } from '../utils/inputValidation/apiKey';

const log = logFactory('splitio');

/**
 * Modular SDK factory
 */
export function sdkFactory(params: ISdkFactoryParams): SplitIO.ICsSDK | SplitIO.ISDK | SplitIO.IAsyncSDK {

  const { settings, platform, storageFactory, splitApiFactory,
    syncManagerFactory, SignalListener, impressionsObserverFactory, impressionListener,
    integrationsManagerFactory, sdkManagerFactory, sdkClientMethodFactory } = params;

  // @TODO handle non-recoverable errors: not start sync, mark the SDK as destroyed, etc.
  // We will just log and allow for the SDK to end up throwing an SDK_TIMEOUT event for devs to handle.
  validateAndTrackApiKey(settings.core.authorizationKey);

  const metadata = buildMetadata(settings);

  // @TODO handle non-recoverable error, such as, `fetch` api not available, invalid API Key, etc.
  const sdkReadinessManager = sdkReadinessManagerFactory(platform.EventEmitter, settings.startup.readyTimeout);

  const storageFactoryParams = {
    eventsQueueSize: settings.scheduler.eventsQueueSize,
    // @TODO consider removing next prop and creating impressionsCounts cache somewhere else to simplify custom storages
    optimize: shouldBeOptimized(settings),
    // @TODO add support for dataloader. consider calling outside the storageFactory to simplify custom storages
    dataLoader: undefined,

    // ATM, only used by InLocalStorage
    matchingKey: getMatching(settings.core.key),
    splitFiltersValidation: settings.sync.__splitFiltersValidation,

    // ATM, only used by InRedisStorage. @TODO pass a callback to simplify custom storages.
    readinessManager: sdkReadinessManager.readinessManager,
    metadata
  };

  const storage = storageFactory(storageFactoryParams);

  // splitApi is used by SyncManager and Browser signal listener
  const splitApi = splitApiFactory && splitApiFactory(settings, platform);

  const syncManager = syncManagerFactory && syncManagerFactory({
    settings,
    splitApi: splitApi as ISplitApi,
    storage: storage as IStorageSync,
    readiness: sdkReadinessManager.readinessManager,
    platform
  });

  const integrationsManager = integrationsManagerFactory && integrationsManagerFactory({ settings, storage });

  // trackers
  const observer = impressionsObserverFactory && impressionsObserverFactory();
  const impressionsTracker = impressionsTrackerFactory(storage.impressions, metadata, impressionListener, integrationsManager, observer, storage.impressionCounts);
  const eventTracker = eventTrackerFactory(storage.events, integrationsManager);

  // signal listener
  const signalListener = SignalListener && new SignalListener(syncManager && syncManager.flush, settings, storage, splitApi);

  // Sdk client and manager
  const clientMethod = sdkClientMethodFactory({ eventTracker, impressionsTracker, sdkReadinessManager, settings, storage, syncManager, signalListener });
  const managerInstance = sdkManagerFactory && sdkManagerFactory(storage.splits, sdkReadinessManager);

  syncManager && syncManager.start();
  signalListener && signalListener.start();

  log.i('New Split SDK instance created.');

  return {
    // Split evaluation and event tracking engine
    client: clientMethod,

    // Manager API to explore available information
    // @ts-ignore
    manager() {
      if (managerInstance) log.i('Manager instance retrieved.');
      else log.e('Manager instance is not available. Provide the manager module on settings.');
      return managerInstance;
    },

    // Logger wrapper API
    Logger: API,

    settings,
  };
}
