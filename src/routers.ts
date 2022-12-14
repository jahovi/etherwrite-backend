import DBTestRouter from "./routers/db-test.router";
import AuthoringRatiosRouter from "./routers/authoring-ratios.router";
import EtherpadRouter from "./routers/etherpad.router";
import MinimapRouter from "./routers/minimap.router";
import EtherVizRouter from "./routers/etherviz-router";

export default [
	DBTestRouter,
	MinimapRouter,
	AuthoringRatiosRouter,
	EtherpadRouter,
	EtherVizRouter,
];