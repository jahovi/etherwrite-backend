/**
 * Defines the log level for the LogService.
 * The levels are inclusive from top to bottom, which means:
 * LogLevel.DEBUG = only messages of type DEBUG, INFO, WARN and ERROR are logged.
 * LogLevel.INFO  = only messages of type INFO, WARN and ERROR are logged.
 * LogLevel.WARN  = only messages of type WARN and ERROR are logged.
 * LogLevel.ERROR = only messages of type ERROR are logged.
 */
export enum LogLevel {
	DEBUG = "debug",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
}
