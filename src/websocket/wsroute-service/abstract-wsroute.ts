import { Socket } from "socket.io";

/**
 * Implementations of websocket routes should inherit from this class to automatically have their 
 * route and handler methods registered on the server. Remember to add the classname of your implementation
 * to the list in wsroutes.ts.
 */
export default abstract class AbstractWsRoute {
	public abstract readonly ROUTE: string;

	public abstract connectionHandler(socket: Socket): void;

	public abstract disconnectionHandler(socket: Socket, reason: String): void;
}