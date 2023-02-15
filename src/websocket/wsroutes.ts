import DocumentMetricsRouter from "../routers/documentmetrics-router";
import MinimapRouter from "../routers/minimap.router";
import AuthoringRatiosWsRoute from "../routers/authoring-ratios.wsroute";
import AuthorsRouter from "../routers/authorws.router";

/**
 * The list of websocket routes to be created. Add the classname of your route implementation here.
 */
export default [
	DocumentMetricsRouter,
	MinimapRouter,
	AuthoringRatiosWsRoute,
	AuthorsRouter,
];
