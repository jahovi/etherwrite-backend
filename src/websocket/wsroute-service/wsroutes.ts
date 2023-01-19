import WsTestRoute from "../websocket-test/wstest-route";
import MinimapRouter from "../../routers/minimap.router";
import AuthoringRatiosWsRoute from "../../routers/authoring-ratios.wsroute";

/**
 * The list of websocket routes to be created. Add the classname of your route implementation here.
 */
export default [
	WsTestRoute,
	MinimapRouter,
	AuthoringRatiosWsRoute,
];
