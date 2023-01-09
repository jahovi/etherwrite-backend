import EtherVizService from "../../etherviz-service/etherviz-service";
import MinimapService from "../../minimap-service/minimap-service";
import ActivityProcessor from "../../activity/activity-processor";
import CohesionDiagramService from "../../coh-service/coh-service";

/** Enter names of subclasses of {@link AbstractChangesetSubscriber} here */
export default [
	MinimapService,
	ActivityProcessor,
	EtherVizService,
	CohesionDiagramService,
]

