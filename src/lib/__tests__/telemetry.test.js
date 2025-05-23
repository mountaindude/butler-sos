import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock the dependencies
jest.unstable_mockModule('posthog-node', () => ({
    PostHog: jest.fn().mockImplementation(() => ({
        capture: jest.fn(),
    })),
}));
const { PostHog } = await import('posthog-node');

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
        },
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
        hostInfo: {
            id: 'mock-host-id',
            isRunningInDocker: false,
            si: {
                os: {
                    arch: 'x64',
                    platform: 'linux',
                    release: '20.04',
                    distro: 'Ubuntu',
                    codename: 'focal',
                },
                system: {
                    virtual: false,
                },
            },
            node: {
                nodeVersion: '16.15.0',
            },
        },
        appVersion: '11.0.3',
    },
}));
const globals = (await import('../../globals.js')).default;

// Import the module under test
const { setupAnonUsageReportTimer, callRemoteURL } = await import('../telemetry.js');

describe('telemetry', () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup default config values
        globals.config.get.mockImplementation((path) => {
            // Default returns for general settings
            if (path === 'Butler-SOS.heartbeat.enable') return true;
            if (path === 'Butler-SOS.dockerHealthCheck.enable') return false;
            if (path === 'Butler-SOS.uptimeMonitor.enable') return true;
            if (path === 'Butler-SOS.uptimeMonitor.storeNewRelic.enable') return false;
            if (path === 'Butler-SOS.qlikSenseEvents.eventCount.enable') return true;
            if (path === 'Butler-SOS.qlikSenseEvents.rejectedEventCount.enable') return false;
            if (path === 'Butler-SOS.userEvents.enable') return true;
            if (path === 'Butler-SOS.userEvents.sendToMQTT.enable') return true;
            if (path === 'Butler-SOS.userEvents.sendToInfluxdb.enable') return false;
            if (path === 'Butler-SOS.userEvents.sendToNewRelic.enable') return false;
            if (path === 'Butler-SOS.logEvents.source.proxy.enable') return true;
            if (path === 'Butler-SOS.logEvents.source.scheduler.enable') return true;
            if (path === 'Butler-SOS.logEvents.source.repository.enable') return false;
            if (path === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
            if (path === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
            if (path === 'Butler-SOS.logEvents.sendToNewRelic.enable') return false;
            if (path === 'Butler-SOS.logEvents.categorise.enable') return true;
            if (path === 'Butler-SOS.logEvents.categorise.ruleDefault.enable') return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.enable') return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.appNameLookup.enable')
                return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable')
                return false;
            if (path === 'Butler-SOS.mqttConfig.enable') return true;
            if (path === 'Butler-SOS.newRelic.enable') return false;
            if (path === 'Butler-SOS.prometheus.enable') return false;
            if (path === 'Butler-SOS.influxdbConfig.enable') return true;
            if (path === 'Butler-SOS.influxdbConfig.version') return 'v2';
            if (path === 'Butler-SOS.appNames.enableAppNameExtract') return true;
            if (path === 'Butler-SOS.userSessions.enableSessionExtract') return true;

            return undefined;
        });

        globals.config.has.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') return true;
        });

        // Store the original mock implementation
        const originalGetMock = globals.config.get.getMockImplementation();

        // Mock the rules array
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') {
                return [{}, {}, {}]; // Array with 3 mock rules
            }
            return originalGetMock(path);
        });

        // Mock setInterval to execute the callback immediately
        jest.spyOn(global, 'setInterval').mockImplementation((cb) => {
            cb();
            return 123; // Mock timer ID
        });
    });

    afterEach(() => {
        // Restore original implementation of setInterval
        global.setInterval.mockRestore();
    });

    test('should initialize PostHog client and send initial telemetry', () => {
        // Setup mock logger and hostInfo
        const mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
        };

        const mockHostInfo = {
            id: 'test-host',
            si: {
                os: {
                    arch: 'x64',
                    platform: 'darwin',
                    release: '20.1.0',
                    distro: 'macOS',
                    codename: 'Big Sur',
                },
                system: {
                    virtual: false,
                },
            },
            isRunningInDocker: false,
            node: {
                nodeVersion: '16.14.0',
            },
        };

        // Call the function being tested
        setupAnonUsageReportTimer(mockLogger, mockHostInfo);

        // Verify PostHog constructor was called with correct parameters
        expect(PostHog).toHaveBeenCalledWith(
            'phc_5cmKiX9OubQjsSfOZuaolWaxo2z7WXqd295eB0uOtTb',
            expect.objectContaining({
                host: 'https://eu.posthog.com',
                flushAt: 1,
                flushInterval: 60 * 1000,
                requestTimeout: 30 * 1000,
                disableGeoip: false,
            })
        );

        // Verify setInterval was called with correct interval
        expect(global.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000 * 60 * 60 * 12);
    });

    test('should handle errors during telemetry setup', () => {
        // Force PostHog constructor to throw an error
        PostHog.mockImplementationOnce(() => {
            throw new Error('PostHog initialization failed');
        });

        // Setup mock logger
        const mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
        };

        // Call the function being tested
        setupAnonUsageReportTimer(mockLogger, {});

        // Verify error was logged
        expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('TELEMETRY'));
    });

    test('should handle errors during telemetry sending', () => {
        // Reset the original implementation to test error handling
        jest.resetModules();

        // Mock the PostHog capture method to throw an error
        const mockPostHogInstance = {
            capture: jest.fn().mockImplementation(() => {
                throw new Error('Capture failed');
            }),
        };

        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        // Call the function being tested
        setupAnonUsageReportTimer(globals.logger, globals.hostInfo);

        // Since the error is caught in callRemoteURL which is called inside setupAnonUsageReportTimer,
        // we won't see the error here. Instead, we're verifying that the function completes without crashing.
        expect(PostHog).toHaveBeenCalled();
    });

    test('should directly call callRemoteURL and send telemetry', () => {
        // Create a fresh mock instance for the test
        const mockPostHogInstance = {
            capture: jest.fn(),
        };
        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        // Setup PostHog client by calling setupAnonUsageReportTimer first
        setupAnonUsageReportTimer(globals.logger, globals.hostInfo);

        // Reset the mock to track only the calls from our direct callRemoteURL invocation
        mockPostHogInstance.capture.mockClear();

        // Now call callRemoteURL directly
        callRemoteURL();

        // Verify that capture was called
        expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(1);

        // Verify the structure of the telemetry data
        const captureData = mockPostHogInstance.capture.mock.calls[0][0];

        // Check top-level properties
        expect(captureData).toHaveProperty('distinctId', 'mock-host-id');
        expect(captureData).toHaveProperty('event', 'telemetry sent');
        expect(captureData).toHaveProperty('properties');

        // Check properties object
        const properties = captureData.properties;
        expect(properties).toHaveProperty('service', 'butler-sos');
        expect(properties).toHaveProperty('serviceVersion', '11.0.3');

        // System info
        expect(properties).toHaveProperty('system_id', 'mock-host-id');
        expect(properties).toHaveProperty('system_arch', 'x64');
        expect(properties).toHaveProperty('system_platform', 'linux');
        expect(properties).toHaveProperty('system_release', '20.04');
        expect(properties).toHaveProperty('system_distro', 'Ubuntu');
        expect(properties).toHaveProperty('system_codename', 'focal');

        // Feature flags - check a few based on our mock setup
        expect(properties).toHaveProperty('feature_heartbeat', true);
        expect(properties).toHaveProperty('feature_dockerHealthCheck', false);
        expect(properties).toHaveProperty('feature_uptimeMonitor', true);
        expect(properties).toHaveProperty('feature_logEventsMQTT', true);
        expect(properties).toHaveProperty('feature_logEventsInfluxdb', true);

        // Telemetry JSON
        expect(properties).toHaveProperty('telemetry_json');
        expect(properties.telemetry_json).toHaveProperty('system');
        expect(properties.telemetry_json).toHaveProperty('enabledFeatures');
    });

    test('should handle configuration with all features enabled', () => {
        // Setup mock config where all relevant features are enabled
        globals.config.get.mockImplementation((path) => {
            // Return true for all feature paths to simulate all features being enabled
            if (path.includes('.enable')) return true;
            if (path === 'Butler-SOS.influxdbConfig.version') return 'v2';

            // Handle the rules array
            if (path === 'Butler-SOS.logEvents.categorise.rules') {
                return [{}, {}, {}, {}, {}]; // Array with 5 mock rules
            }

            return 'mock-value';
        });

        // Create a fresh mock instance
        const mockPostHogInstance = {
            capture: jest.fn(),
        };
        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        // Setup PostHog client
        setupAnonUsageReportTimer(globals.logger, globals.hostInfo);

        // Verify that capture was called with all features enabled
        const captureData = mockPostHogInstance.capture.mock.calls[0][0];
        const properties = captureData.properties;

        // Verify that key features are enabled
        expect(properties.feature_heartbeat).toBe(true);
        expect(properties.feature_dockerHealthCheck).toBe(true);
        expect(properties.feature_uptimeMonitor).toBe(true);
        expect(properties.feature_uptimeMonitor_storeNewRelic).toBe(true);
        expect(properties.feature_eventCount).toBe(true);
        expect(properties.feature_rejectedEventCount).toBe(true);
        expect(properties.feature_userEvents).toBe(true);
        expect(properties.feature_userEventsMQTT).toBe(true);
        expect(properties.feature_userEventsInfluxdb).toBe(true);
        expect(properties.feature_userEventsNewRelic).toBe(true);
        expect(properties.feature_mqtt).toBe(true);
        expect(properties.feature_newRelic).toBe(true);
        expect(properties.feature_prometheus).toBe(true);
        expect(properties.feature_influxdb).toBe(true);

        // Verify rule count
        expect(properties.feature_logEventCategoriseRuleCount).toBe(5);
    });

    test('should handle configuration with all features disabled', () => {
        // Setup mock config where all relevant features are disabled
        globals.config.get.mockImplementation((path) => {
            // Return false for all feature paths to simulate all features being disabled
            if (path.includes('.enable')) return false;
            if (path === 'Butler-SOS.influxdbConfig.version') return 'v2';

            // Handle the rules array
            if (path === 'Butler-SOS.logEvents.categorise.rules') {
                return []; // Empty array, no rules
            }

            return 'mock-value';
        });

        // Create a fresh mock instance
        const mockPostHogInstance = {
            capture: jest.fn(),
        };
        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        // Setup PostHog client
        setupAnonUsageReportTimer(globals.logger, globals.hostInfo);

        // Verify that capture was called with all features disabled
        const captureData = mockPostHogInstance.capture.mock.calls[0][0];
        const properties = captureData.properties;

        // Verify that key features are disabled
        expect(properties.feature_heartbeat).toBe(false);
        expect(properties.feature_dockerHealthCheck).toBe(false);
        expect(properties.feature_uptimeMonitor).toBe(false);
        expect(properties.feature_uptimeMonitor_storeNewRelic).toBe(false);
        expect(properties.feature_eventCount).toBe(false);
        expect(properties.feature_rejectedEventCount).toBe(false);
        expect(properties.feature_userEvents).toBe(false);
        expect(properties.feature_userEventsMQTT).toBe(false);
        expect(properties.feature_userEventsInfluxdb).toBe(false);
        expect(properties.feature_userEventsNewRelic).toBe(false);
        expect(properties.feature_mqtt).toBe(false);
        expect(properties.feature_newRelic).toBe(false);
        expect(properties.feature_prometheus).toBe(false);
        expect(properties.feature_influxdb).toBe(false);

        // Verify rule count
        expect(properties.feature_logEventCategoriseRuleCount).toBe(0);
    });

    test('should handle configuration where rules do not exist', () => {
        // Setup mock config where the rules path does not exist
        globals.config.has.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.categorise.rules') return false;
            return true;
        });

        // Create a fresh mock instance
        const mockPostHogInstance = {
            capture: jest.fn(),
        };
        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        // Setup PostHog client
        setupAnonUsageReportTimer(globals.logger, globals.hostInfo);

        // Verify that capture was called with rules not existing
        const captureData = mockPostHogInstance.capture.mock.calls[0][0];
        const properties = captureData.properties;

        // Verify rule count is zero
        expect(properties.feature_logEventCategoriseRuleCount).toBe(0);
    });

    test('should handle errors with missing hostInfo properties', () => {
        // Save the original hostInfo
        const originalHostInfo = globals.hostInfo;

        // Replace the globals.hostInfo with an incomplete one
        globals.hostInfo = {
            id: 'test-host',
            // Missing si property
            isRunningInDocker: false,
            node: {
                nodeVersion: '16.14.0',
            },
        };

        // Mock logger to capture errors
        const mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
        };

        // Create a fresh mock instance
        const mockPostHogInstance = {
            capture: jest.fn(),
        };
        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        try {
            // Setup with incomplete hostInfo in globals
            // setupAnonUsageReportTimer(mockLogger, globals.hostInfo);

            // Now call callRemoteURL directly to trigger the error
            callRemoteURL();

            // posthogClient.capture should NOT be called due to the error
            expect(mockPostHogInstance.capture).not.toHaveBeenCalled();

            // Verify error logging in case of property access errors
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('TELEMETRY: Could not send anonymous telemetry.')
            );
        } finally {
            // Restore the original hostInfo
            globals.hostInfo = originalHostInfo;
        }
    });

    test('should log an appropriate message when telemetry is successfully sent', () => {
        // Mock logger with spy functions
        const mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
        };

        // Create a fresh mock instance that succeeds
        const mockPostHogInstance = {
            capture: jest.fn().mockImplementation(() => Promise.resolve()),
        };
        PostHog.mockImplementationOnce(() => mockPostHogInstance);

        // Setup with our mock logger
        setupAnonUsageReportTimer(mockLogger, globals.hostInfo);

        // Verify success message was logged
        expect(globals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('TELEMETRY: Sent anonymous telemetry. ')
        );
    });
});
