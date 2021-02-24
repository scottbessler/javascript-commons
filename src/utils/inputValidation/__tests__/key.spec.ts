import { loggerMock, mockClear } from '../../../logger/__tests__/sdkLogger.mock';

import { validateKey } from '../key';

const errorMsgs = {
  EMPTY_KEY: (keyType: string) => `you passed an empty string, ${keyType} must be a non-empty string.`,
  LONG_KEY: (keyType: string) => `${keyType} too long, ${keyType} must be 250 characters or less.`,
  NULL_KEY: (keyType: string) => `you passed a null or undefined ${keyType}, ${keyType} must be a non-empty string.`,
  WRONG_TYPE_KEY: (keyType: string) => `you passed an invalid ${keyType} type, ${keyType} must be a non-empty string.`,
  NUMERIC_KEY: (keyType: string, value: any) => `${keyType} "${value}" is not of type string, converting.`,
  WRONG_KEY_PROPS: 'Key must be an object with bucketingKey and matchingKey with valid string properties.'
};

const invalidKeys = [
  { key: '', msg: errorMsgs.EMPTY_KEY },
  { key: 'a'.repeat(251), msg: errorMsgs.LONG_KEY },
  { key: null, msg: errorMsgs.NULL_KEY },
  { key: undefined, msg: errorMsgs.NULL_KEY },
  { key: () => { }, msg: errorMsgs.WRONG_TYPE_KEY },
  { key: new Promise(r => r()), msg: errorMsgs.WRONG_TYPE_KEY },
  { key: Symbol('asd'), msg: errorMsgs.WRONG_TYPE_KEY },
  { key: [], msg: errorMsgs.WRONG_TYPE_KEY },
  { key: true, msg: errorMsgs.WRONG_TYPE_KEY },
  { key: NaN, msg: errorMsgs.WRONG_TYPE_KEY },
  { key: Infinity, msg: errorMsgs.WRONG_TYPE_KEY },
  { key: -Infinity, msg: errorMsgs.WRONG_TYPE_KEY },
];

const stringifyableKeys = [
  { key: 200, msg: errorMsgs.NUMERIC_KEY },
  { key: 1235891238571295, msg: errorMsgs.NUMERIC_KEY },
  { key: 0, msg: errorMsgs.NUMERIC_KEY }
];

const invalidKeyObjects = [
  {},
  { matchingKey: 'asd' },
  { bucketingKey: 'asd' },
  { key: 'asd', bucketingKey: 'asdf' },
  { random: 'asd' }
];

describe('INPUT VALIDATION for Key', () => {

  test('String and Object keys / Should return the key with no errors logged if the key is correct', () => {
    const validKey = 'validKey';
    const validObjKey = {
      matchingKey: 'valid', bucketingKey: 'alsoValid'
    };

    expect(validateKey(validKey, 'some_method_keys')).toEqual(validKey); // It will return the valid key.
    expect(loggerMock.e.mock.calls.length).toBe(0); // No errors should be logged.

    expect(validateKey(validObjKey, 'some_method_keys')).toEqual(validObjKey); // It will return the valid key.
    expect(loggerMock.e.mock.calls.length).toBe(0); // No errors should be logged.

    expect(loggerMock.w.mock.calls.length).toBe(0); // It should have not logged any warnings.

    mockClear();
  });

  test('String key / Should return false and log error if key is invalid', () => {
    for (let i = 0; i < invalidKeys.length; i++) {
      const invalidKey = invalidKeys[i]['key'];
      const expectedLog = invalidKeys[i]['msg']('key');

      expect(validateKey(invalidKey, 'test_method')).toBe(false); // Invalid keys should return false.
      expect(loggerMock.e.mock.calls[0][0]).toEqual(`test_method: ${expectedLog}`); // The error should be logged for the invalid key.

      loggerMock.e.mockClear();
    }

    expect(loggerMock.w.mock.calls.length).toBe(0); // It should have not logged any warnings.

    mockClear();
  });

  test('String key / Should return stringified version of the key if it is convertible to one and log a warning.', () => {
    for (let i = 0; i < stringifyableKeys.length; i++) {
      const invalidKey = stringifyableKeys[i]['key'];
      const expectedLog = stringifyableKeys[i]['msg']('key', invalidKey);

      validateKey(invalidKey, 'test_method');
      expect(loggerMock.w.mock.calls[0][0]).toEqual(`test_method: ${expectedLog}`); // But if the logger allows for warnings, it should be logged.

      loggerMock.w.mockClear();
    }

    expect(loggerMock.e.mock.calls.length).toBe(0); // It should have not logged any errors.

    mockClear();
  });

  test('Object key / Should return false and log error if a part of the key is invalid', () => {
    // Test invalid object format
    for (let i = 0; i < invalidKeyObjects.length; i++) {
      expect(validateKey(invalidKeyObjects[i], 'test_method')).toBe(false); // Invalid key objects should return false.
      expect(loggerMock.e.mock.calls[loggerMock.e.mock.calls.length - 1][0]).toEqual(`test_method: ${errorMsgs.WRONG_KEY_PROPS}`); // The error should be logged for the invalid key.

      loggerMock.e.mockClear();
    }

    expect(loggerMock.w.mock.calls.length).toBe(0); // It should have not logged any warnings.

    mockClear();
    // Test invalid matchingKey
    for (let i = 0; i < invalidKeys.length; i++) {
      const invalidKey = {
        matchingKey: invalidKeys[i]['key'],
        bucketingKey: 'thisIsValid'
      };
      const expectedLog = invalidKeys[i]['msg']('matchingKey');

      expect(validateKey(invalidKey, 'test_method')).toBe(false); // Invalid keys should return false.
      expect(loggerMock.e.mock.calls[0][0]).toEqual(`test_method: ${expectedLog}`); // The error should be logged for the invalid key.

      loggerMock.e.mockClear();
    }

    expect(loggerMock.w.mock.calls.length).toBe(0); // It should have not logged any warnings.

    mockClear();

    // Test invalid bucketingKey
    for (let i = 0; i < invalidKeys.length; i++) {
      const invalidKey = {
        matchingKey: 'thisIsValidToo',
        bucketingKey: invalidKeys[i]['key']
      };
      const expectedLog = invalidKeys[i]['msg']('bucketingKey');

      expect(validateKey(invalidKey, 'test_method')).toBe(false); // Invalid keys should return false.
      expect(loggerMock.e.mock.calls[0][0]).toEqual(`test_method: ${expectedLog}`); // The error should be logged for the invalid key.

      loggerMock.e.mockClear();
    }

    expect(loggerMock.w.mock.calls.length).toBe(0); // It should have not logged any warnings.

    mockClear();

    // Just one test that if both are invalid we get the log for both.
    let invalidKey = {
      matchingKey: invalidKeys[0]['key'],
      bucketingKey: invalidKeys[1]['key']
    };
    let expectedLogMK = invalidKeys[0]['msg']('matchingKey');
    let expectedLogBK = invalidKeys[1]['msg']('bucketingKey');

    expect(validateKey(invalidKey, 'test_method')).toBe(false); // Invalid keys should return false.
    expect(loggerMock.e.mock.calls[0][0]).toEqual(`test_method: ${expectedLogMK}`); // The error should be logged for the invalid key property.
    expect(loggerMock.e.mock.calls[1][0]).toEqual(`test_method: ${expectedLogBK}`); // The error should be logged for the invalid key property.

    expect(loggerMock.w.mock.calls.length).toBe(0); // It should have not logged any warnings.

    mockClear();
  });

  test('Object key / Should return stringified version of the key props if those are convertible and log the corresponding warnings', () => {
    let invalidKey = {
      matchingKey: stringifyableKeys[0]['key'],
      bucketingKey: stringifyableKeys[1]['key']
    };
    let expectedKey = {
      matchingKey: String(invalidKey.matchingKey),
      bucketingKey: String(invalidKey.bucketingKey),
    };
    let expectedLogMK = stringifyableKeys[0]['msg']('matchingKey', invalidKey.matchingKey);
    let expectedLogBK = stringifyableKeys[1]['msg']('bucketingKey', invalidKey.bucketingKey);

    expect(validateKey(invalidKey, 'test_method')).toEqual(expectedKey); // If a key object had stringifyable values, those will be stringified and Key returned.
    expect(loggerMock.w.mock.calls[0][0]).toEqual(`test_method: ${expectedLogMK}`); // The warning should be logged for the stringified prop if warnings are enabled.
    expect(loggerMock.w.mock.calls[1][0]).toEqual(`test_method: ${expectedLogBK}`); // The warning should be logged for the stringified prop if warnings are enabled.

    expect(loggerMock.e.mock.calls.length).toBe(0); // It should have not logged any errors.

    mockClear();
  });
});
