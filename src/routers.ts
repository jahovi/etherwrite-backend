import DBTestRouter from "./routers/db-test.router";
import AuthoringRatiosRouter from "./routers/authoring-ratios.router";
import EtherpadRouter from "./routers/etherpad.router";
import EtherVizRouter from "./routers/etherviz-router";
import {ActivityRouter} from "./routers/activity.router";
import CohesionDiagramRouter from "./routers/coh-diagram-router";

export default [
	DBTestRouter,
	AuthoringRatiosRouter,
	EtherpadRouter,
	EtherVizRouter,
	ActivityRouter,
	CohesionDiagramRouter,
];