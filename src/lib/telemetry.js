const { PostHog } = require('posthog-node');

const globals = require('../globals');

// Define variable to hold the PostHog client
let posthogClient;

const callRemoteURL = async function reportTelemetry() {
    try {
        let heartbeat = false;
        let dockerHealthCheck = false;
        let uptimeMonitor = false;
        let uptimeMonitorNewRelic = false;
        let userEventsEnable = false;
        let userEventsMQTTEnable = false;
        let userEventsInfluxDBEnable = false;
        let userEventsNewRelicEnable = false;
        let logEventsProxyEnable = false;
        let logEventsSchedulerEnable = false;
        let logEventsRepositoryEnable = false;
        let logEventsMQTTEnable = false;
        let logEventsInfluxDBEnable = false;
        let logEventsNewRelicEnable = false;
        let logdbEnable = false;
        let mqttEnable = false;
        let newRelicEnable = false;
        let prometheusEnable = false;
        let influxdbEnable = false;
        let appNamesExtractEnable = false;
        let userSessionsEnable = false;

        // Gather info on what features are enabled/disabled
        if (globals.config.get('Butler-SOS.heartbeat.enable') === true) {
            heartbeat = true;
        }

        if (globals.config.get('Butler-SOS.dockerHealthCheck.enable') === true) {
            dockerHealthCheck = true;
        }

        if (globals.config.get('Butler-SOS.uptimeMonitor.enable') === true) {
            uptimeMonitor = true;
        }

        if (globals.config.get('Butler-SOS.uptimeMonitor.storeNewRelic.enable') === true) {
            uptimeMonitorNewRelic = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.enable') === true) {
            userEventsEnable = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.sendToMQTT.enable') === true) {
            userEventsMQTTEnable = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.sendToInfluxdb.enable') === true) {
            userEventsInfluxDBEnable = true;
        }

        if (globals.config.get('Butler-SOS.userEvents.sendToNewRelic.enable') === true) {
            userEventsNewRelicEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.source.proxy.enable') === true) {
            logEventsProxyEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.source.scheduler.enable') === true) {
            logEventsSchedulerEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.source.repository.enable') === true) {
            logEventsRepositoryEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.sendToMQTT.enable') === true) {
            logEventsMQTTEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.sendToInfluxdb.enable') === true) {
            logEventsInfluxDBEnable = true;
        }

        if (globals.config.get('Butler-SOS.logEvents.sendToNewRelic.enable') === true) {
            logEventsNewRelicEnable = true;
        }

        if (globals.config.get('Butler-SOS.logdb.enable') === true) {
            logdbEnable = true;
        }

        if (globals.config.get('Butler-SOS.mqttConfig.enable') === true) {
            mqttEnable = true;
        }

        // Is New Relic enabled?
        if (globals.config.get('Butler-SOS.newRelic.enable') === true) {
            newRelicEnable = true;
        }

        if (globals.config.get('Butler-SOS.prometheus.enable') === true) {
            prometheusEnable = true;
        }

        if (globals.config.get('Butler-SOS.influxdbConfig.enable') === true) {
            influxdbEnable = true;
        }

        if (globals.config.get('Butler-SOS.appNames.enableAppNameExtract') === true) {
            appNamesExtractEnable = true;
        }

        if (globals.config.get('Butler-SOS.userSessions.enableSessionExtract') === true) {
            userSessionsEnable = true;
        }

        // Build body that can be sent to PostHog
        const body = {
            distinctId: globals.hostInfo.id,
            event: 'telemetry sent',

            properties: {
                service: 'butler-sos',
                serviceVersion: globals.appVersion,

                system_id: globals.hostInfo.id,
                system_arch: globals.hostInfo.si.os.arch,
                system_platform: globals.hostInfo.si.os.platform,
                system_release: globals.hostInfo.si.os.release,
                system_distro: globals.hostInfo.si.os.distro,
                system_codename: globals.hostInfo.si.os.codename,
                system_virtual: globals.hostInfo.si.system.virtual,
                system_hypervisor: globals.hostInfo.si.os.hypervizor,
                system_nodeVersion: globals.hostInfo.node.nodeVersion,

                feature_heartbeat: heartbeat,
                feature_dockerHealthCheck: dockerHealthCheck,
                feature_uptimeMonitor: uptimeMonitor,
                feature_uptimeMonitor_storeNewRelic: uptimeMonitorNewRelic,
                feature_udpServer: globals.config.get('Butler-SOS.userEvents.enable'),
                feature_userEvents: userEventsEnable,
                feature_userEventsMQTT: userEventsMQTTEnable,
                feature_userEventsInfluxdb: userEventsInfluxDBEnable,
                feature_userEventsNewRelic: userEventsNewRelicEnable,
                feature_logEventsProxy: logEventsProxyEnable,
                feature_logEventsScheduler: logEventsSchedulerEnable,
                feature_logEventsRepository: logEventsRepositoryEnable,
                feature_logEventsMQTT: logEventsMQTTEnable,
                feature_logEventsInfluxdb: logEventsInfluxDBEnable,
                feature_logEventsNewRelic: logEventsNewRelicEnable,
                feature_logdb: logdbEnable,
                feature_mqtt: mqttEnable,
                feature_newRelic: newRelicEnable,
                feature_prometheus: prometheusEnable,
                feature_influxdb: influxdbEnable,
                feature_influxdb_version: globals.config.get('Butler-SOS.influxdbConfig.version'),
                feature_appNames: appNamesExtractEnable,
                feature_userSessions: userSessionsEnable,

                telemetry_json: {
                    system: {
                        id: globals.hostInfo.id,
                        arch: globals.hostInfo.si.os.arch,
                        platform: globals.hostInfo.si.os.platform,
                        release: globals.hostInfo.si.os.release,
                        distro: globals.hostInfo.si.os.distro,
                        codename: globals.hostInfo.si.os.codename,
                        virtual: globals.hostInfo.si.system.virtual,
                        hypervisor: globals.hostInfo.si.os.hypervizor,
                        nodeVersion: globals.hostInfo.node.nodeVersion,
                    },
                    enabledFeatures: {
                        feature: {
                            heartbeat,
                            dockerHealthCheck,
                            uptimeMonitor,
                            uptimeMonitorNewRelic,
                            udpServer: globals.config.get('Butler-SOS.userEvents.enable'),
                            userEvents: userEventsEnable,
                            userEventsMQTT: userEventsMQTTEnable,
                            userEventsInfluxdb: userEventsInfluxDBEnable,
                            userEventsNewRelic: userEventsNewRelicEnable,
                            logEventsProxy: logEventsProxyEnable,
                            logEventsScheduler: logEventsSchedulerEnable,
                            logEventsRepository: logEventsRepositoryEnable,
                            logEventsMQTT: logEventsMQTTEnable,
                            logEventsInfluxdb: logEventsInfluxDBEnable,
                            logEventsNewRelic: logEventsNewRelicEnable,
                            logdb: logdbEnable,
                            mqtt: mqttEnable,
                            newRelic: newRelicEnable,
                            prometheus: prometheusEnable,
                            influxdb: influxdbEnable,
                            influxdbVersion: globals.config.get(
                                'Butler-SOS.influxdbConfig.version'
                            ),
                            appNames: appNamesExtractEnable,
                            userSessions: userSessionsEnable,
                        },
                    },
                },
            },
        };

        // Send the telemetry to PostHog
        posthogClient.capture(body);

        globals.logger.debug(
            'TELEMETRY: Sent anonymous telemetry. Thanks for contributing to making Butler SOS better!'
        );
    } catch (err) {
        globals.logger.error('TELEMETRY: Could not send anonymous telemetry.');
        globals.logger.error(
            '     While not mandatory the telemetry data greatly helps the Butler SOS developers.'
        );
        globals.logger.error(
            '     It provides insights into which features are used most and what hardware/OSs are most used out there.'
        );
        globals.logger.error(
            '     This information makes it possible to focus development efforts where they will make most impact and be most valuable.'
        );
        globals.logger.error('❤️  Thank you for supporting Butler SOS by allowing telemetry! ❤️');
        globals.logger.error('');
        globals.logger.error(JSON.stringify(err, null, 2));
    }
};

function setupAnonUsageReportTimer(logger, hostInfo) {
    try {
        // Setup PostHog client
        posthogClient = new PostHog('phc_5cmKiX9OubQjsSfOZuaolWaxo2z7WXqd295eB0uOtTb', {
            host: 'https://eu.posthog.com',
            flushAt: 1, // Flush events to PostHog as soon as they are captured
            flushInterval: 60 * 1000, // Flush every 60 seconds
            requestTimeout: 30 * 1000, // 30 secpnds timeout
            disableGeoip: false, // Enable geoip lookups
        });

        setInterval(
            () => {
                callRemoteURL(logger, hostInfo);
            },
            1000 * 60 * 60 * 12
        ); // Report anon usage every 12 hours
        // }, 1000 * 60 * 15); // Report anon usage every 15 monutes for testing

        // Do an initial telemetry report
        callRemoteURL(logger, hostInfo);
    } catch (err) {
        logger.error(`TELEMETRY: ${err}`);
    }
}

module.exports = {
    setupAnonUsageReportTimer,
};
