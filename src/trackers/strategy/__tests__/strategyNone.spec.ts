import { ImpressionCountsCacheInMemory } from '../../../storages/inMemory/ImpressionCountsCacheInMemory';
import { strategyNoneFactory } from '../strategyNone';
import { uniqueKeysTrackerFactory } from '../../uniqueKeysTracker';
import { impression1, impression2, processStrategy } from './testUtils';
import { loggerMock } from '../../../logger/__tests__/sdkLogger.mock';
import { LOG_PREFIX_UNIQUE_KEYS_TRACKER } from '../../../logger/constants';

const fakeFilter = {
  add: jest.fn(() => { return true; }),
  contains: jest.fn(() => { return true; }),
  clear: jest.fn(),
};

test('strategyNone', () => {
  const impressionCountsCache = new ImpressionCountsCacheInMemory();
  const uniqueKeysTracker = uniqueKeysTrackerFactory(loggerMock, fakeFilter, 4);
  
  let impressions = [
    impression1, 
    impression2, 
    {...impression1, keyName: 'emma@split.io'}, 
    {...impression1, keyName: 'nico@split.io'}, 
    {...impression1, keyName: 'emi@split.io'}, 
    {...impression1, keyName: 'emi@split.io'}
  ];
  
  const strategyNone = strategyNoneFactory(impressionCountsCache, uniqueKeysTracker);
  
  const { impressionsToStore, impressionsToListener, deduped } = processStrategy(strategyNone, impressions);
  
  expect(impressionsToStore).toStrictEqual([]);
  expect(impressionsToListener).toStrictEqual(impressions);
  expect(deduped).toStrictEqual(0);
  
  expect(loggerMock.warn).toBeCalledWith(`${LOG_PREFIX_UNIQUE_KEYS_TRACKER}The UniqueKeysTracker size reached the maximum limit`);
    
  
});
