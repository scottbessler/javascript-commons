import andCombiner from '../and';
import { loggerMock } from '../../../logger/__tests__/sdkLogger.mock';

test('COMBINER AND / should always return true', async function () {

  let AND = andCombiner([() => true, () => true, () => true], loggerMock);

  expect(await AND('always true')).toBe(true); // should always return true
});

test('COMBINER AND / should always return false', async function () {

  let AND = andCombiner([() => true, () => true, () => false], loggerMock);

  expect(await AND('always false')).toBe(false); // should always return false
});
