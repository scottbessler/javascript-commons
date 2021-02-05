import { SplitError } from '../../../utils/lang/errors';
import { _Set, setToArray, ISet } from '../../../utils/lang/sets';
import { ISegmentsCacheSync, ISplitsCacheSync, IStorageSync } from '../../../storages/types';
import { ISplitChangesFetcher } from '../fetchers/types';
import { ISplit, ISplitChangesResponse } from '../../../dtos/types';
import { IReadinessManager, ISplitsEventEmitter } from '../../../readiness/types';
import timeout from '../../../utils/promise/timeout';
import syncTaskFactory from '../../syncTask';
import { ISplitsSyncTask } from '../types';
import { logFactory } from '../../../logger/sdkLogger';
import splitChangesFetcherFactory from '../fetchers/splitChangesFetcher';
import { IFetchSplitChanges } from '../../../services/types';
import thenable from '../../../utils/promise/thenable';
import { ISettings } from '../../../types';
const log = logFactory('splitio-sync:split-changes');

type ISplitChangesUpdater = () => Promise<boolean>

/**
 * Collect segments from a raw split definition.
 * Exported for testing purposes.
 */
export function parseSegments({ conditions }: ISplit): ISet<string> {

  let segments = new _Set<string>();

  for (let i = 0; i < conditions.length; i++) {
    const matchers = conditions[i].matcherGroup.matchers;

    matchers.forEach(matcher => {
      if (matcher.matcherType === 'IN_SEGMENT') segments.add(matcher.userDefinedSegmentMatcherData.segmentName);
    });
  }

  return segments;
}

interface ISplitMutations {
  added: [string, string][],
  removed: string[],
  segments: string[]
}

/**
 * Given the list of splits from /splitChanges endpoint, it returns the mutations,
 * i.e., an object with added splits, removed splits and used segments.
 * Exported for testing purposes.
 */
export function computeSplitsMutation(entries: ISplit[]): ISplitMutations {
  const segments = new _Set<string>();
  const computed = entries.reduce((accum, split) => {
    if (split.status === 'ACTIVE') {
      accum.added.push([split.name, JSON.stringify(split)]);

      parseSegments(split).forEach((segmentName: string) => {
        segments.add(segmentName);
      });
    } else {
      accum.removed.push(split.name);
    }

    return accum;
  }, { added: [], removed: [], segments: [] } as ISplitMutations);

  computed.segments = setToArray(segments);

  return computed;
}

/**
 * factory of SplitChanges updater (a.k.a, SplitsSyncTask), a task that:
 *  - fetches split changes using `splitChangesFetcher`
 *  - updates `splitsCache`
 *  - uses `splitsEventEmitter` to emit events related to split data updates
 * Exported for testing purposes.
 */
export function splitChangesUpdaterFactory(
  splitChangesFetcher: ISplitChangesFetcher,
  splitsCache: ISplitsCacheSync,
  segmentsCache: ISegmentsCacheSync,
  splitsEventEmitter: ISplitsEventEmitter,
  requestTimeoutBeforeReady?: number,
  retriesOnFailureBeforeReady?: number
): ISplitChangesUpdater {

  let startingUp = true;
  let readyOnAlreadyExistentState = true;

  /** timeout and telemetry decorator for `splitChangesFetcher` promise  */
  function _promiseDecorator(promise: Promise<Response>) {
    if (startingUp && requestTimeoutBeforeReady) promise = timeout(requestTimeoutBeforeReady, promise);
    return promise;

    // @TODO telemetry
    // const collectMetrics = startingUp || isNode; // If we are on the browser, only collect this metric for first fetch. On node do it always.
    // splitsPromise = tracker.start(tracker.TaskNames.SPLITS_FETCH, collectMetrics ? metricCollectors : false, splitsPromise);
  }

  /**
   * @param {number} since current changeNumber at splitsCache
   * @param {number} retry current number of retry attemps
   */
  function _splitChangesUpdater(since: number, retry = 0): Promise<boolean> {
    log.debug(`Spin up split update using since = ${since}`);

    const fetcherPromise = splitChangesFetcher(since, _promiseDecorator)
      .then((splitChanges: ISplitChangesResponse) => {
        startingUp = false;

        const mutation = computeSplitsMutation(splitChanges.splits);

        log.debug(`New splits ${mutation.added.length}`);
        log.debug(`Removed splits ${mutation.removed.length}`);
        log.debug(`Segment names collected ${mutation.segments.length}`);

        // Write into storage
        // @TODO if allowing custom storages, wrap errors as SplitErrors to distinguish from user callback errors
        return Promise.all([
          // calling first `setChangenumber` method, to perform cache flush if split filter queryString changed
          splitsCache.setChangeNumber(splitChanges.till),
          splitsCache.addSplits(mutation.added),
          splitsCache.removeSplits(mutation.removed),
          segmentsCache.registerSegments(mutation.segments)
        ]).then(() => {
          if (since !== splitChanges.till || readyOnAlreadyExistentState) {
            readyOnAlreadyExistentState = false;
            splitsEventEmitter.emit('SDK_SPLITS_ARRIVED');
          }
          return true;
        });
      })
      .catch(error => {
        // handle user callback errors
        if (!(error instanceof SplitError)) {
          setTimeout(() => { throw error; }, 0);
          startingUp = false; // Stop retrying.
        }

        log.warn(`Error while doing fetch of Splits. ${error}`);

        if (startingUp && retriesOnFailureBeforeReady && retriesOnFailureBeforeReady > retry) {
          retry += 1;
          log.info(`Retrying download of splits #${retry}. Reason: ${error}`);
          return _splitChangesUpdater(since, retry);
        } else {
          startingUp = false;
        }
        return false;
      });

    // After triggering the requests, if we have cached splits information let's notify that.
    if (startingUp && splitsCache.checkCache()) splitsEventEmitter.emit('SDK_SPLITS_CACHE_LOADED');

    return fetcherPromise;
  }

  /**
   * SplitChanges updater returns a promise that resolves with a `false` boolean value if it fails to fetch splits or synchronize them with the storage.
   */
  return function splitChangesUpdater() {
    const since = splitsCache.getChangeNumber();
    // Adding an extra promise to keep the fetch call asynchronous
    const sincePromise: Promise<number> = thenable(since) ? since : Promise.resolve(since);
    return sincePromise.then(_splitChangesUpdater);
  };
}

export default function splitsSyncTaskFactory(
  fetchSplitChanges: IFetchSplitChanges,
  storage: IStorageSync,
  readiness: IReadinessManager,
  settings: ISettings,
): ISplitsSyncTask {
  return syncTaskFactory(
    splitChangesUpdaterFactory(
      splitChangesFetcherFactory(fetchSplitChanges),
      storage.splits,
      storage.segments,
      readiness.splits,
      settings.startup.requestTimeoutBeforeReady,
      settings.startup.retriesOnFailureBeforeReady
    ),
    settings.scheduler.featuresRefreshRate,
    'splitChangesUpdater'
  );
}
