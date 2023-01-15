import {Socket} from "socket.io";
import logService from "../../core/log/log.service";

/**
 * Implementations of websocket routes should inherit from this class to automatically have their
 * route and handler methods registered on the server. Remember to add the classname of your implementation
 * to the list in wsroutes.ts.
 * As almost all routes handle sockets based on a pad name, this class includes methods to organize these.
 */
export default abstract class AbstractWsRoute {
	public abstract readonly ROUTE: string;

	private padNameToSockets: Record<string, Socket[]> = {};

	/**
	 * Override this to handle the connection of a new socket.
	 * @param socket The socket to connect.
	 */
	public abstract connectionHandler(socket: Socket): Promise<void>;

	/**
	 * Handles the disconnection of a socket by removing it from {@link padNameToSockets}.
	 * @param socket The socket that disconnects.
	 * @param reason The disconnection reason.
	 */
	public disconnectionHandler(socket: Socket, reason: string): void {
		logService.debug(this.constructor.name, `Socket removed: ${reason}`);
		// Remove the socket from the lists.
		for (const padName in this.padNameToSockets) {
			this.padNameToSockets[padName] = this.padNameToSockets[padName]
				.filter(s => s !== socket);
		}
	}

	/**
	 * Adds a new socket to {@link padNameToSockets}.
	 * @param padName The pad name for which the socket should be registered.
	 * @param socket The socket to register.
	 */
	protected addSocket(padName: string, socket: Socket) {
		logService.debug(this.constructor.name, `New socket for pad "${padName}".`);
		this.padNameToSockets[padName] = this.padNameToSockets[padName] || [];
		this.padNameToSockets[padName].push(socket);
	}

	/**
	 * Emits the given data to all sockets for the given pad.
	 * @param padName The name of the pad.
	 * @param data The data to emit.
	 */
	protected emitToAllSockets(padName: string, data: any): void {
		const sockets = this.padNameToSockets[padName] || [];
		if (sockets.length) {
			logService.debug(this.constructor.name, `Delivering data for pad "${padName}" to ${sockets.length} socket(s)`);
			sockets.forEach(socket => socket.emit("update", data));
		}
	}
}