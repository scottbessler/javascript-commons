import { MySegmentsCacheInLocal } from '../MySegmentsCacheInLocal';
import { KeyBuilderCS } from '../../KeyBuilderCS';
import { loggerMock } from '../../../logger/__tests__/sdkLogger.mock';

test('SEGMENT CACHE / in LocalStorage', () => {
  const keys = new KeyBuilderCS('SPLITIO', 'user');
  const cache = new MySegmentsCacheInLocal(loggerMock, keys);

  cache.clear();

  cache.addToSegment('mocked-segment');

  expect(cache.isInSegment('mocked-segment') === true).toBe(true);

  cache.removeFromSegment('mocked-segment');

  expect(cache.isInSegment('mocked-segment') === false).toBe(true);

});
