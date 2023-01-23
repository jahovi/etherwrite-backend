import * as dotenv from "dotenv";
import express from "express";
import "./documents";
import designDocumentService from "./core/couch/design-document.service";
import logService from "./core/log/log.service";
import routerService from "./core/router/router.service";
import PadRegistry from "./pads";
import AuthorRegistry from "./core/authors/author-registry";
import TrackingService from "./core/tracking-service/tracking-service";
import http from "http";
import {Server} from "socket.io";
import wsRouteService from "./websocket/wsroute-service/wsroutes.service";

dotenv.config();

const app = express();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require("cors");
app.use(cors());

const port = process.env.PORT || 8083;

routerService.init(app);

// Init SocketIO on server and register websocket routes
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		// allow cors requests from the frontend
		origin: process.env.ALLOW_ORIGIN,
	},
});
wsRouteService.initWsRoutes(io);

// Update or create necessary documents.
designDocumentService.registerAllDocuments()
	// Initialise the author registry to get all global authors.
	.then(() => AuthorRegistry.init())
	// prepare ChangesetProcessors for all known pads.
	.then(() => PadRegistry.initAndUpdate())
	// start TrackingService
	.then(() => TrackingService.initAndUpdate())
	// initialise the server.
	.then(() => server.listen(port, () => {
		logService.info("EVA", `Listening on port ${port}!`);
	}));







