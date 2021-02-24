/* eslint-disable no-undef */
import { logFactory } from '../../logger/sdkLogger';
import { uniq } from '../../utils/lang';
import { SPLIT_IMPRESSION, SPLIT_EVENT } from '../../utils/constants';
import { SplitIO } from '../../types';
import { IIntegration } from '../types';
import { SplitToGoogleAnalyticsOptions } from './types';
const log = logFactory('splitio-split-to-ga');

const noGaWarning = '`ga` command queue not found.';

export default class SplitToGa implements IIntegration {

  // A falsy object represents the default tracker
  static defaultTrackerNames = [''];

  private trackerNames: string[];
  private filter?: (data: SplitIO.IntegrationData) => boolean;
  private mapper?: (data: SplitIO.IntegrationData, defaultMapping: UniversalAnalytics.FieldsObject) => UniversalAnalytics.FieldsObject;
  private impressions: boolean | undefined;
  private events: boolean | undefined;

  // Default mapper function.
  static defaultMapper({ type, payload }: SplitIO.IntegrationData): UniversalAnalytics.FieldsObject {
    switch (type) {
      case SPLIT_IMPRESSION:
        return {
          hitType: 'event',
          eventCategory: 'split-impression',
          eventAction: 'Evaluate ' + (payload as SplitIO.ImpressionData).impression.feature,
          eventLabel: 'Treatment: ' + (payload as SplitIO.ImpressionData).impression.treatment + '. Targeting rule: ' + (payload as SplitIO.ImpressionData).impression.label + '.',
          nonInteraction: true,
        };
      case SPLIT_EVENT:
        return {
          hitType: 'event',
          eventCategory: 'split-event',
          eventAction: (payload as SplitIO.EventData).eventTypeId,
          eventValue: (payload as SplitIO.EventData).value,
          nonInteraction: true,
        };
    }
  }

  // Util to access ga command queue, accounting for the possibility that it has been renamed.
  static getGa(): UniversalAnalytics.ga | undefined { // @ts-expect-error
    return typeof window !== 'undefined' ? window[window['GoogleAnalyticsObject'] || 'ga'] : undefined;
  }

  /**
   * Validates if a given object is a UniversalAnalytics.FieldsObject instance, and logs a warning if not.
   * It checks that the object contains a `hitType`, since it is the minimal field required to send the hit
   * and avoid the GA error `No hit type specified. Aborting hit.`.
   * Other validations (e.g., an `event` hitType must have a `eventCategory` and `eventAction`) are handled
   * and logged (as warnings or errors depending the case) by GA debugger, but the hit is sent anyway.
   *
   * @param {UniversalAnalytics.FieldsObject} fieldsObject object to validate.
   * @returns {boolean} Whether the data instance is a valid FieldsObject or not.
   */
  static validateFieldsObject(fieldsObject: any): fieldsObject is UniversalAnalytics.FieldsObject {
    if (fieldsObject && fieldsObject.hitType) return true;

    log.w('your custom mapper returned an invalid FieldsObject instance. It must be an object with at least a `hitType` field.');
    return false;
  }

  /**
   * constructor description
   * @param {object} options options passed at the SDK integrations settings (isomorphic SDK) or the SplitToGoogleAnalytics plugin (pluggable browser SDK)
   */
  constructor(options?: SplitToGoogleAnalyticsOptions) {

    this.trackerNames = SplitToGa.defaultTrackerNames;

    if (options) {
      if (typeof options.filter === 'function') this.filter = options.filter;
      if (typeof options.mapper === 'function') this.mapper = options.mapper;
      // We strip off duplicated values if we received a `trackerNames` param.
      // We don't warn if a tracker does not exist, since the user might create it after the SDK is initialized.
      // Note: GA allows to create and get trackers using a string or number as tracker name, and does nothing if other types are used.
      if (Array.isArray(options.trackerNames)) this.trackerNames = uniq(options.trackerNames);

      // No need to validate `impressions` and `events` flags. Any other value than `false` is ignored (considered true by default).
      this.impressions = options.impressions;
      this.events = options.events;
    }

    log.i('Started Split-to-GA integration');
    if (typeof SplitToGa.getGa() !== 'function') log.w(noGaWarning + ' No hits will be sent until it is available.');
  }

  queue(data: SplitIO.IntegrationData) {
    // access ga command queue via `getGa` method, accounting for the possibility that
    // the global `ga` reference was not yet mutated by analytics.js.
    const ga = SplitToGa.getGa();
    if (ga) {

      if (this.impressions === false && data.type === SPLIT_IMPRESSION) return;
      if (this.events === false && data.type === SPLIT_EVENT) return;

      let fieldsObject: UniversalAnalytics.FieldsObject & { splitHit?: boolean };
      try { // only try/catch filter and mapper, which might be defined by the user
        // filter
        if (this.filter && !this.filter(data)) return;

        // map data into a FieldsObject instance
        fieldsObject = SplitToGa.defaultMapper(data);
        if (this.mapper) {
          fieldsObject = this.mapper(data, fieldsObject);
          // don't send the hit if it is falsy or invalid
          if (!fieldsObject || !SplitToGa.validateFieldsObject(fieldsObject)) return;
        }
      } catch (err) {
        log.w(`SplitToGa queue method threw: ${err}. No hit was sent.`);
        return;
      }

      // send the hit
      this.trackerNames.forEach(trackerName => {
        const sendCommand = trackerName ? `${trackerName}.send` : 'send';
        // mark the hit as a Split one to avoid the loop.
        fieldsObject.splitHit = true;
        // Send to GA using our reference to the GA object.
        ga(sendCommand, fieldsObject);
      });
    } else {
      log.w(noGaWarning + ' No hit was sent.');
    }
  }

}
