import routers from "../../routers";
import {ConstructorOf} from "../../constructor-of.interface";
import Router from "./router.interface";
import logService from "../log/log.service";
import {Application} from "express";

class RouterService {

	/**
	 * Registers all routes of all routers that are exported in "src/routers.ts".
	 * Basically calls all {@link Router.init} functions.
	 * @param app The express application to register routes in.
	 */
	public init(app: Application): void {
		(routers as ConstructorOf<Router>[]).forEach(router => {
			logService.debug(RouterService.name, "Registering router: " + router.name);
			new router().init(app);
		});
		logService.info(RouterService.name, "All routers registered!");
	}
}

export default new RouterService();