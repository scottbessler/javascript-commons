import { SplitsCacheInMemory } from './SplitsCacheInMemory';
import { SegmentsCacheInMemory } from './SegmentsCacheInMemory';
import { ImpressionsCacheInMemory } from './ImpressionsCacheInMemory';
import { EventsCacheInMemory } from './EventsCacheInMemory';
import { IStorageFactoryParams, IStorageSync } from '../types';
import { ImpressionCountsCacheInMemory } from './ImpressionCountsCacheInMemory';
import { DEBUG, NONE, STORAGE_MEMORY } from '../../utils/constants';
import { shouldRecordTelemetry, TelemetryCacheInMemory } from './TelemetryCacheInMemory';
import { UniqueKeysCacheInMemory } from './UniqueKeysCacheInMemory';

/**
 * InMemory storage factory for standalone server-side SplitFactory
 *
 * @param params parameters required by EventsCacheSync
 */
export function InMemoryStorageFactory(params: IStorageFactoryParams): IStorageSync {

  return {
    splits: new SplitsCacheInMemory(),
    segments: new SegmentsCacheInMemory(),
    impressions: new ImpressionsCacheInMemory(params.impressionsQueueSize),
    impressionCounts: params.impressionsMode !== DEBUG ? new ImpressionCountsCacheInMemory() : undefined,
    events: new EventsCacheInMemory(params.eventsQueueSize),
    telemetry: shouldRecordTelemetry(params) ? new TelemetryCacheInMemory() : undefined,
    uniqueKeys: params.impressionsMode === NONE ? new UniqueKeysCacheInMemory() : undefined,

    // When using MEMORY we should clean all the caches to leave them empty
    destroy() {
      this.splits.clear();
      this.segments.clear();
      this.impressions.clear();
      this.impressionCounts && this.impressionCounts.clear();
      this.events.clear();
      this.uniqueKeys?.clear();
    }
  };
}

InMemoryStorageFactory.type = STORAGE_MEMORY;
