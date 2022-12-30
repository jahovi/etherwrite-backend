import { Server } from "socket.io";
import { socketIOmoodleUserMiddleware } from "../ws-moodle-user.middleware";
import AbstractWsRoute from "./abstract-wsroute";
import wsRoutes from "./wsroutes";

/**
 * Automatically registers each websocket route listed in wsroutes.ts and its 
 * connection and disconnection handler methods with the server.
 */
class WsRouteService {

	public innitWsRoutes(server: Server): void {
		wsRoutes.forEach(route => {
			this.innitWsRoute(route, server);
		})
	}

	private innitWsRoute<T extends AbstractWsRoute>(wsRouteType: { new(): T }, server: Server): void {
		// instantiates and registers the route with the server (routes are called namespaces in socketIO parlance), 
		// registers middleware and callbacks on the route
		const wsRoute = new wsRouteType();
		const namespace = server.of(wsRoute.ROUTE);
		namespace.use(socketIOmoodleUserMiddleware);

		namespace.on("connection", (socket) => {
			socket.on("disconnect", (reason) => {
				wsRoute.disconnectionHandler(socket, reason);
			})
			wsRoute.connectionHandler(socket);
		});
	}
}

export default new WsRouteService();