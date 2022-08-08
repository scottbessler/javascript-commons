import { SUBMITTERS_PUSH_FULL_QUEUE } from '../../logger/constants';
import { ISdkFactoryContextSync } from '../../sdkFactory/types';
import { submitterFactory } from './submitter';

const DATA_NAME = 'uniqueKeys';

/**
 * Submitter that periodically posts impression counts
 */
export function uniqueKeysSubmitterFactory(params: ISdkFactoryContextSync) {

  const {
    settings: { log, scheduler: { uniqueKeysRefreshRate }, core: {key}},
    splitApi: { postUniqueKeysBulkCs, postUniqueKeysBulkSs },
    storage: { uniqueKeys }
  } = params;
  
  const isClientSide = key !== undefined;
  const postUniqueKeysBulk = isClientSide ? postUniqueKeysBulkCs : postUniqueKeysBulkSs;

  const syncTask = submitterFactory(log, postUniqueKeysBulk, uniqueKeys!, uniqueKeysRefreshRate, 'unique keys');

  // register unique keys submitter to be executed when uniqueKeys cache is full
  uniqueKeys!.setOnFullQueueCb(() => {
    if (syncTask.isRunning()) {
      log.info(SUBMITTERS_PUSH_FULL_QUEUE, [DATA_NAME]);
      syncTask.execute();
    }
    // If submitter is stopped (e.g., user consent declined or unknown, or app state offline), we don't send the data.
    // Data will be sent when submitter is resumed.
  });
  
  return syncTask;
}

