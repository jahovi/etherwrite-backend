import * as dotenv from "dotenv";
import express, {Application} from "express";
import "./documents";
import designDocumentService from "./core/couch/design-document.service";
import logService from "./core/log/log.service";
import routerService from "./core/router/router.service";
import PadRegistry from "./pads";
import AuthorRegistry from "./author-registry";
import TrackingService from "./core/tracking-service/tracking-service";


dotenv.config();

const app: Application = express();

const port = process.env.PORT || 8083;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require("cors");

app.use(cors());

routerService.init(app);

// Update or create necessary documents.
designDocumentService.registerAllDocuments()
	// Initialise the author registry to get all global authors.
	.then(() => AuthorRegistry.init())
	// prepare ChangesetProcessors for all known pads.
	.then(() => PadRegistry.initAndUpdate())
	// start TrackingService
	.then(()=> TrackingService.initAndUpdate())
	// initialise the server.
	.then(() => app.listen(port, () => {
		logService.info("EVA", `Listening on port ${port}!`);
	}));





