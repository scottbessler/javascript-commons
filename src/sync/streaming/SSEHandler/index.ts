import { errorParser, messageParser } from './NotificationParser';
import notificationKeeperFactory from './NotificationKeeper';
import { OCCUPANCY, CONTROL, MY_SEGMENTS_UPDATE, SEGMENT_UPDATE, SPLIT_KILL, SPLIT_UPDATE, SSE_ERROR } from '../constants';
import { IPushEventEmitter } from '../types';
import { ISseEventHandler } from '../SSEClient/types';
import { INotificationError } from './types';
import { ILogger } from '../../../logger/types';
// import { logFactory } from '../../../logger/sdkLogger';
// const log = logFactory('splitio-sync:sse-handler');

/**
 * Factory for SSEHandler, which processes SSEClient messages and emits the corresponding push events.
 *
 * @param pushEmitter emitter for events related to streaming support
 */
export default function SSEHandlerFactory(pushEmitter: IPushEventEmitter, log: ILogger): ISseEventHandler {

  const notificationKeeper = notificationKeeperFactory(pushEmitter);

  return {
    handleOpen() {
      notificationKeeper.handleOpen();
    },

    /* HTTP & Network errors */
    handleError(error) {
      let errorWithParsedData: INotificationError = error;
      try {
        errorWithParsedData = errorParser(error);
      } catch (err) {
        log.w(`Error parsing SSE error notification: ${err}`);
      }

      pushEmitter.emit(SSE_ERROR, errorWithParsedData);
    },

    /* NotificationProcessor */
    handleMessage(message) {
      let messageWithParsedData;
      try {
        messageWithParsedData = messageParser(message);
      } catch (err) {
        log.w(`Error parsing new SSE message notification: ${err}`);
        return;
      }

      const { parsedData, data, channel, timestamp } = messageWithParsedData;
      log.d(`New SSE message received, with data: ${data}.`);

      // we only handle update events if streaming is up.
      if (!notificationKeeper.isStreamingUp() && parsedData.type !== OCCUPANCY && parsedData.type !== CONTROL)
        return;

      switch (parsedData.type) {
        /* update events */
        case SPLIT_UPDATE:
          pushEmitter.emit(SPLIT_UPDATE,
            parsedData.changeNumber);
          break;
        case SEGMENT_UPDATE:
          pushEmitter.emit(SEGMENT_UPDATE,
            parsedData.changeNumber,
            parsedData.segmentName);
          break;
        case MY_SEGMENTS_UPDATE:
          pushEmitter.emit(MY_SEGMENTS_UPDATE,
            parsedData,
            channel);
          break;
        case SPLIT_KILL:
          pushEmitter.emit(SPLIT_KILL,
            parsedData.changeNumber,
            parsedData.splitName,
            parsedData.defaultTreatment);
          break;

        /* occupancy & control events, handled by NotificationManagerKeeper */
        case OCCUPANCY:
          notificationKeeper.handleOccupancyEvent(parsedData.metrics.publishers, channel, timestamp);
          break;
        case CONTROL:
          notificationKeeper.handleControlEvent(parsedData.controlType, channel, timestamp);
          break;
        default:
          break;
      }
    },

  };
}
