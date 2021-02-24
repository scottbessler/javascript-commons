/* eslint-disable no-undef */
// @TODO eventually migrate to JS-Browser-SDK package.
import { ISignalListener } from './types';
import { logFactory } from '../logger/sdkLogger';
import { IRecorderCacheConsumerSync, IStorageSync } from '../storages/types';
import { fromImpressionsCollector } from '../sync/submitters/impressionsSyncTask';
import { fromImpressionCountsCollector } from '../sync/submitters/impressionCountsSyncTask';
import { ISplitApi } from '../services/types';
import { ImpressionDTO, ISettings } from '../types';
import { ImpressionsPayload } from '../sync/submitters/types';
import { MaybeThenable } from '../dtos/types';
import { OPTIMIZED, DEBUG } from '../utils/constants';
import objectAssign from 'object-assign';

const log = logFactory('splitio-client:cleanup');

// 'unload' event is used instead of 'beforeunload', since 'unload' is not a cancelable event, so no other listeners can stop the event from occurring.
const UNLOAD_DOM_EVENT = 'unload';

/**
 * We'll listen for 'unload' event over the window object, since it's the standard way to listen page reload and close.
 */
export default class BrowserSignalListener implements ISignalListener {

  private fromImpressionsCollector: (data: ImpressionDTO[]) => ImpressionsPayload;

  constructor(
    handler: (() => MaybeThenable<void>) | undefined, // Not used, but passed by sdkFactory for NodeSignalListener
    private settings: ISettings,
    private storage: IStorageSync,
    private serviceApi: ISplitApi,
  ) {
    this.flushData = this.flushData.bind(this);
    this.fromImpressionsCollector = fromImpressionsCollector.bind(undefined, settings.core.labelsEnabled);
  }

  /**
   * start method.
   * Called when SplitFactory is initialized.
   * We add a handler on unload events. The handler flushes remaining impressions and events to the backend.
   */
  start() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      log.d('Registering flush handler when unload page event is triggered.');
      window.addEventListener(UNLOAD_DOM_EVENT, this.flushData);
    }
  }

  /**
   * stop method.
   * Called when client is destroyed.
   * We need to remove the handler for unload events, since it can break if called when Split context was destroyed.
   */
  stop() {
    if (typeof window !== 'undefined' && window.removeEventListener) {
      log.d('Deregistering flush handler when unload page event is triggered.');
      window.removeEventListener(UNLOAD_DOM_EVENT, this.flushData);
    }
  }

  /**
   * flushData method.
   * Called when unload event is triggered. It flushed remaining impressions and events to the backend,
   * using beacon API if possible, or falling back to regular post transport.
   */
  flushData() {
    const eventsUrl = this.settings.urls.events;
    const extraMetadata = {
      // sim stands for Sync/Split Impressions Mode
      sim: this.settings.sync.impressionsMode === OPTIMIZED ? OPTIMIZED : DEBUG
    };

    this._flushData(eventsUrl + '/testImpressions/beacon', this.storage.impressions, this.serviceApi.postTestImpressionsBulk, this.fromImpressionsCollector, extraMetadata);
    this._flushData(eventsUrl + '/events/beacon', this.storage.events, this.serviceApi.postEventsBulk);
    if (this.storage.impressionCounts) this._flushData(eventsUrl + '/testImpressions/count/beacon', this.storage.impressionCounts, this.serviceApi.postTestImpressionsCount, fromImpressionCountsCollector);
  }

  private _flushData<TState>(url: string, cache: IRecorderCacheConsumerSync<TState>, postService: (body: string) => Promise<Response>, fromCacheToPayload?: (cacheData: TState) => any, extraMetadata?: {}) {
    // if there is data in cache, send it to backend
    if (!cache.isEmpty()) {
      const dataPayload = fromCacheToPayload ? fromCacheToPayload(cache.state()) : cache.state();
      if (!this._sendBeacon(url, dataPayload, extraMetadata)) {
        postService(JSON.stringify(dataPayload)).catch(() => { }); // no-op just to catch a possible exceptions
      }
      cache.clear();
    }
  }

  /**
   * _sendBeacon method.
   * Util method that check if beacon API is available, build the payload and send it.
   */
  private _sendBeacon(url: string, data: any, extraMetadata?: {}) {
    // eslint-disable-next-line compat/compat
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const json = {
        entries: data,
        token: this.settings.core.authorizationKey,
        sdk: this.settings.version
      };

      // Extend with endpoint specific metadata where needed
      if (extraMetadata) objectAssign(json, extraMetadata);

      // Stringify the payload
      const payload = JSON.stringify(json);

      // eslint-disable-next-line compat/compat
      return navigator.sendBeacon(url, payload);
    }
    return false;
  }
}
