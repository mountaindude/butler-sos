/**
 * Handler for qseow-qix-perf log events
 */

import globals from '../../../../globals.js';
import { uuidRegex, formatUserFields } from '../utils/common-utils.js';
import { processAppSpecificFilters, processAllAppsFilters } from '../filters/qix-perf-filters.js';

/**
 * Process QIX performance log events
 *
 * Message parts for log messages with Qix performance information:
 * 0:  Message type. Always /qseow-qix-perf/
 * 1:  Row number. Ex: 14
 * 2:  ISO8601 formatted timestamp. Example: 20211109T193744.331+0100
 * 3:  Local timezone timestamp. Example: 2021-11-09 19:37:44,331
 * 4:  Log level. Possible values are: WARN, ERROR, FATAL
 * 5:  Hostname where the log event occured
 * 6:  QSEoW subsystem where log event occured. Example: System.Scheduler.Scheduler.Slave.Tasks.ReloadTask
 * 7:  Windows username running the originating QSEoW service. Ex: COMPANYNAME\qlikservice
 * 8:  Proxy session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
 * 9:  User directory of the user associated with the event. Ex: LAB
 * 10: User ID of the user associated with the event. Ex: goran
 * 11: Engine timestamp. Example: 2021-11-09T19:37:44.331+01:00
 * 12: Session ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
 * 13: Document ID (=app ID). Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
 * 14: Request ID. Ex: 3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b
 * 15: Method. Ex: Global::OpenApp, Doc::GetAppLayout, GenericObject::GetLayout
 * 16: Process time in milliseconds. Ex: 123
 * 17: Work time in milliseconds. Ex: 123
 * 18: Lock time in milliseconds. Ex: 123
 * 19: Validate time in milliseconds. Ex: 123
 * 20: Traverse time in milliseconds. Ex: 123
 * 21: Handle. Ex: -1, 123
 * 22: Object ID. Ex: df68e14d-1ed0-47c9-bcb6-b37a900441d8, <Unknown>, rwPjBk
 * 23: Net RAM. Ex: 123456 bytes
 * 24: Peak RAM. Ex: 123456 byets
 * 25: Object type. Ex: <Unknown>, AppPropsList, SheetList, StoryList, VariableList, linechart, barchart, map, listbox, CurrentSelection
 *
 * @param {Array} msg - The message parts
 * @returns {object | null} Processed message object or null if event should be skipped
 */
export function processQixPerfEvent(msg) {
    globals.logger.verbose(
        `LOG EVENT: ${msg[0]}:${msg[5]}:${msg[4]}, ${msg[6]}, ${msg[9]}\\${msg[10]}, ${msg[13]}, ${msg[15]}, Object type: ${msg[25]}`
    );

    // Determine if the message should be handled, based on settings in the config file
    if (globals.config.get('Butler-SOS.logEvents.enginePerformanceMonitor.enable') === false) {
        globals.logger.debug(
            'LOG EVENT: Qix performance monitoring is disabled in the configuration. Skipping event.'
        );
        return null;
    }

    // Get source of event activity.
    //
    // The source is either user activity of some kind (e.g. opening an app, making a selection), or
    // the result of some automated process (e.g. a scheduled app reload).
    //
    // The proxy session ID is used to determine the source of the event.
    // If the proxy session ID is '0', the event is considered to be non-user activity, for example a scheduled reload.
    // Otherwise, the event is considered to be the result of an action by a user, for example opening an app, making a selection, etc.
    let eventActivitySource;
    if (msg[8] === '0') {
        // Event is the result of an automated process
        globals.logger.debug('LOG EVENT: Qix performance event is non-user activity.');
        eventActivitySource = 'non-user';
    } else {
        // Event is user activity
        globals.logger.debug('LOG EVENT: Qix performance event is user activity.');
        eventActivitySource = 'user';
    }

    // Extract fields needed for filtering
    const eventAppId = msg[13];
    let eventAppName = '';
    const eventObjectId = msg[22];
    const eventObjectType = msg[25];
    const eventMethod = msg[15];

    // Should we get app name from the app ID?
    if (
        globals.config.get('Butler-SOS.logEvents.enginePerformanceMonitor.appNameLookup.enable') ===
        true
    ) {
        // Get app name from app ID
        const eventApp = globals.appNames.find((app) => app.id === eventAppId);

        if (eventApp?.name) {
            eventAppName = eventApp.name;
        } else {
            eventAppName = '';
        }
    }

    // Get the app performance monitor filter configuration from the config file
    const monitorFilterConfig = globals.config.get(
        'Butler-SOS.logEvents.enginePerformanceMonitor.monitorFilter'
    );

    // Prepare event data for filtering
    const eventData = {
        eventAppId,
        eventAppName,
        eventObjectId,
        eventObjectType,
        eventMethod,
    };

    // Apply app-specific filters
    const acceptEventAppSpecific = processAppSpecificFilters(
        eventData,
        monitorFilterConfig.appSpecific
    );

    // Apply all-apps filters (only if app-specific filters didn't match)
    const acceptEventAllApps = acceptEventAppSpecific
        ? false
        : processAllAppsFilters(eventData, monitorFilterConfig.allApps);

    // Was event accepted?
    if (acceptEventAppSpecific === false && acceptEventAllApps === false) {
        globals.logger.debug(
            'LOG EVENT: Qix performance event does not match filters in the configuration. Skipping event.'
        );

        // Is logging of rejected performance log events enabled?
        if (
            globals.config.get('Butler-SOS.logEvents.enginePerformanceMonitor.enable') === true &&
            globals.config.get(
                'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable'
            ) === true
        ) {
            // Increase counter for rejected performance log events
            (async () => {
                await globals.rejectedEvents.addRejectedLogEvent({
                    source: 'qseow-qix-perf',
                    appId: eventAppId,
                    appName: eventAppName,
                    method: eventMethod,
                    objectType: eventObjectType,
                    processTime: parseFloat(msg[16]),
                });
            })();
        }

        return null;
    }

    // Event matches filters in the configuration. Continue.
    // Build the event object
    const msgObj = {
        source: msg[0],
        log_row: Number.isInteger(parseInt(msg[1], 10)) ? parseInt(msg[1], 10) : -1,
        ts_iso: msg[2],
        ts_local: msg[3],
        level: msg[4],
        host: msg[5],
        subsystem: msg[6],
        windows_user: msg[7],
        proxy_session_id: uuidRegex.test(msg[8]) ? msg[8] : '',
        user_directory: msg[9],
        user_id: msg[10],
        engine_ts: msg[11],
        session_id: uuidRegex.test(msg[12]) ? msg[12] : '',
        app_id: uuidRegex.test(msg[13]) ? msg[13] : '',
        app_name: eventAppName,
        request_id: msg[14], // Request ID is an integer >= 0, set to -99 otherwise
        method: msg[15],
        // Processtime in float milliseconds
        process_time: parseFloat(msg[16]),
        work_time: parseFloat(msg[17]),
        lock_time: parseFloat(msg[18]),
        validate_time: parseFloat(msg[19]),
        traverse_time: parseFloat(msg[20]),
        // Handle is either -1 or a number. Set to -99 if not a number
        handle: Number.isInteger(parseInt(msg[21], 10)) ? parseInt(msg[21], 10) : -99,
        object_id: msg[22],
        // Positive integer, set to -1 if not am integer >= 0
        net_ram:
            Number.isInteger(parseInt(msg[23], 10)) && parseInt(msg[23], 10) >= 0
                ? parseInt(msg[23], 10)
                : -1,
        peak_ram:
            Number.isInteger(parseInt(msg[24], 10)) && parseInt(msg[24], 10) >= 0
                ? parseInt(msg[24], 10)
                : -1,
        object_type: msg[25],
        event_activity_source: eventActivitySource,
    };

    formatUserFields(msgObj);

    return msgObj;
}
