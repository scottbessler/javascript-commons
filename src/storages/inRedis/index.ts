import RedisAdapter from './RedisAdapter';
import { IStorageAsync, IStorageFactoryParams } from '../types';
import { IMetadata, IRedisMetadata } from '../../dtos/types';
import KeyBuilderSS from '../KeyBuilderSS';
import SplitsCacheInRedis from './SplitsCacheInRedis';
import SegmentsCacheInRedis from './SegmentsCacheInRedis';
import ImpressionsCacheInRedis from './ImpressionsCacheInRedis';
import EventsCacheInRedis from './EventsCacheInRedis';
import LatenciesCacheInRedis from './LatenciesCacheInRedis';
import CountsCacheInRedis from './CountsCacheInRedis';
import { UNKNOWN } from '../../utils/constants';

export interface InRedisStorageOptions {
  prefix?: string
  options?: Record<string, any>
}

// exported for testing purposes
export function metadataBuilder(metadata: IMetadata): IRedisMetadata {
  return {
    s: metadata.version,
    i: metadata.ip || UNKNOWN,
    n: metadata.hostname || UNKNOWN,
  };
}

/**
 * InRedis storage factory for consumer server-side SplitFactory, that uses `Ioredis` Redis client for Node.
 * @see {@link https://www.npmjs.com/package/ioredis}
 */
export function InRedisStorage(options: InRedisStorageOptions = {}) {

  const prefix = options.prefix ? options.prefix + '.SPLITIO' : 'SPLITIO';

  return function InRedisStorageFactory(params: IStorageFactoryParams): IStorageAsync {

    const metadata = metadataBuilder(params.metadata);
    const keys = new KeyBuilderSS(prefix, { version: metadata.s, ip: metadata.i, hostname: metadata.n });
    const redisClient = new RedisAdapter(options.options || {});

    // subscription to Redis connect event in order to emit SDK_READY event
    // @TODO pass a callback to simplify custom storages
    redisClient.on('connect', () => {
      params.readinessManager.splits.emit('SDK_SPLITS_ARRIVED');
      params.readinessManager.segments.emit('SDK_SEGMENTS_ARRIVED');
    });

    return {
      splits: new SplitsCacheInRedis(keys, redisClient),
      segments: new SegmentsCacheInRedis(keys, redisClient),
      impressions: new ImpressionsCacheInRedis(keys, redisClient, metadata),
      events: new EventsCacheInRedis(keys, redisClient, metadata),
      latencies: new LatenciesCacheInRedis(keys, redisClient),
      counts: new CountsCacheInRedis(keys, redisClient),

      // When using REDIS we should:
      // 1- Disconnect from the storage
      destroy() {
        redisClient.disconnect();
        // @TODO check that caches works as expected when redisClient is disconnected
      }
    };
  };
}
