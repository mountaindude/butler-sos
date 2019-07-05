// Add dependencies
var restify = require('restify');

// Load code from sub modules
const globals = require('./globals');
const mainMetrics = require('./lib/mainmetrics');

// Load certificates to use when connecting to healthcheck API
// var fs = require("fs"):
var path = require('path'),
  certFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCert')),
  keyFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertKey')),
  caFile = path.resolve(__dirname, globals.config.get('Butler-SOS.cert.clientCertCA'));

// ---------------------------------------------------
// Create restServer object
var restServer = restify.createServer({
  name: 'Docker healthcheck for Butler-SOS',
  version: globals.appVersion,
});

// Enable parsing of http parameters
restServer.use(restify.plugins.queryParser());

// Set up endpoint for REST server
restServer.get(
  {
    path: '/',
    flags: 'i',
  },
  (req, res, next) => {
    globals.logger.verbose(`Docker healthcheck API endpoint called.`);

    res.send(0);
    next();
  },
);

// Set specific log level (if/when needed to override the config file setting)
// Possible values are { error: 0, warn: 1, info: 2, verbose: 3, debug: 4, silly: 5 }
// Default is to use log level defined in config file
globals.logger.info('--------------------------------------');
globals.logger.info('Starting Butler SOS');
globals.logger.info(`Log level is: ${globals.getLoggingLevel()}`);
globals.logger.info(`App version is: ${globals.appVersion}`);
globals.logger.info('--------------------------------------');

// Log info about what Qlik Sense certificates are being used
globals.logger.debug(`Client cert: ${certFile}`);
globals.logger.debug(`Client cert key: ${keyFile}`);
globals.logger.debug(`CA cert: ${caFile}`);

// ---------------------------------------------------
// Start Docker healthcheck REST server on port 12398
restServer.listen(12398, function() {
  globals.logger.info('Docker healthcheck server now listening');
});

// // Set up extraction of data from log db
// if (globals.config.get("Butler-SOS.logdb.enableLogDb") == true) {
//   setupLogDbTimer();
// }

// // Set up extraction of sessions data
// if (globals.config.get("Butler-SOS.userSessions.enableSessionExtract") == true) {
//   setupSessionsTimer();
// }

// Set up extraction on main metrics data (i.e. the Sense healthcheck API)
mainMetrics.setupMainMetricsTimer();