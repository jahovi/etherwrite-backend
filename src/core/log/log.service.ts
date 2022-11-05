import * as winston from "winston";
import {Logger} from "winston";
import {LogLevel} from "./log-level.enum";
import chalk from "chalk";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Service for logging purposes. Use whenever you want to log stuff to the console which is
 * not for ad-hoc debugging, but should stay in the code.
 * @see {@link LogLevel} for the explanation of different log levels.
 */
class LogService {

	private log: Logger;

	constructor() {
		const logLevel: LogLevel = (process.env.LOG_LEVEL ?? LogLevel.INFO) as LogLevel;
		this.log = winston.createLogger({
			level: logLevel.toLowerCase(),
			transports: [
				new winston.transports.Console(),
			],
			format: LogService.logFormat,
		});
	}

	/**
	 * Logs a message which is only visible in "DEBUG" logging level.
	 * @param component The name of the component which produces the message.
	 * @param message The message.
	 */
	public debug(component: string, message: any): void {
		this.logInternal(this.log.debug, component, message);
	}

	/**
	 * Logs a message which is only visible in "INFO" logging level.
	 * @param component The name of the component which produces the message.
	 * @param message The message.
	 */
	public info(component: string, message: any): void {
		this.logInternal(this.log.info, component, message);
	}

	/**
	 * Logs a message which is only visible in "WARN" logging level.
	 * @param component The name of the component which produces the message.
	 * @param message The message.
	 */
	public warn(component: string, message: any): void {
		this.logInternal(this.log.warn, component, message);
	}

	/**
	 * Logs a message which is only visible in "ERROR" logging level.
	 * @param component The name of the component which produces the message.
	 * @param message The message.
	 */
	public error(component: string, message: any): void {
		this.logInternal(this.log.error, component, message);
	}

	/**
	 * Logs a message which is only visible in "ERROR" logging level. Additionally, the given raw error
	 * will be logged to the default console if LOG_ERRORS is set in the environment.
	 * @param component The name of the component which produces the message.
	 * @param message The message.
	 * @param rawError The raw error to log.
	 */
	public exception(component: string, message: string, rawError: any): void {
		this.logInternal(this.log.error, component, message);
		if (process.env.LOG_ERRORS) {
			console.error(rawError);
		}
	}

	private static padRight = 30;

	private static logFormat = winston.format.combine(
		winston.format.timestamp({
			format: "YYYY-MM-DD HH:mm:ss",
		}),
		winston.format.printf(({level, message, label, timestamp}) => {
			const levelPadded = level.toUpperCase().padEnd(6);
			const text = `${timestamp}${label ? ": " + label : ""} ${levelPadded}| ${message}`;
			switch (level.toLowerCase()) {
			case LogLevel.WARN:
				return chalk.yellow(text);
			case LogLevel.ERROR:
				return chalk.red(text);
			case LogLevel.INFO:
				return chalk.green(text);
			default:
				return chalk.grey(text);
			}
		}),
	);

	/**
	 * Calls the given method to log the given message.
	 * @param method The logging method of the {@link Logger} to use.
	 * @param component The name of the component which produces the message.
	 * @param message The message.
	 */
	private logInternal(method: Function, component: string, message: any): void {
		method(`[${component}]`.padEnd(LogService.padRight) + message);
	}
}

export default new LogService();