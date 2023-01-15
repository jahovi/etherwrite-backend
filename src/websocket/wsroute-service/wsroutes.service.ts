import {Server} from "socket.io";
import {socketIOmoodleUserMiddleware} from "../ws-moodle-user.middleware";
import AbstractWsRoute from "./abstract-wsroute";
import wsRoutes from "./wsroutes";
import {ConstructorOf} from "../../constructor-of.interface";
import logService from "../../core/log/log.service";

/**
 * Automatically registers each websocket route listed in wsroutes.ts and its
 * connection and disconnection handler methods with the server.
 */
class WsRouteService {

	public initWsRoutes(server: Server): void {
		wsRoutes.forEach(route => {
			logService.debug(WsRouteService.name, "Registering websocket endpoint: " + route.name);
			this.initWsRoute(route, server);
		});
		logService.info(WsRouteService.name, "All websocket endpoints registered!");
	}

	private initWsRoute(wsRouteType: ConstructorOf<AbstractWsRoute>, server: Server): void {
		// instantiates and registers the route with the server (routes are called namespaces in socketIO parlance),
		// registers middleware and callbacks on the route
		const wsRoute = new wsRouteType();
		const namespace = server.of(wsRoute.ROUTE);
		namespace.use(socketIOmoodleUserMiddleware);

		namespace.on("connection", async (socket) => {
			socket.on("disconnect", (reason) => {
				wsRoute.disconnectionHandler(socket, reason);
			})

			try {
				await wsRoute.connectionHandler(socket);
			} catch (e: any) {
				socket.emit("error", e.message);
			}
		});
	}
}

export default new WsRouteService();