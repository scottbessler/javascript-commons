import { matcherTypes } from '../matcherTypes';
import matcherFactory from '..';
import { IMatcher, IMatcherDto } from '../../types';

test('MATCHER LESS THAN OR EQUAL / should return true ONLY when the value is less than or equal to 10', function () {
  // @ts-ignore
  let matcher = matcherFactory({
    negate: false,
    type: matcherTypes.LESS_THAN_OR_EQUAL_TO,
    value: 10
  } as IMatcherDto) as IMatcher;

  expect(matcher(10)).toBe(true); // 10 <= 10
  expect(matcher(9)).toBe(true); // 9 <= 10
  expect(matcher(11)).toBe(false); // 11 ! <= 10
});
