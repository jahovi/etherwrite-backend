import * as dotenv from "dotenv";
import express, {Application} from "express";
import "./documents";
import designDocumentService from "./core/couch/design-document.service";
import logService from "./core/log/log.service";
import routerService from "./core/router/router.service";

dotenv.config();

const app: Application = express();

const port = process.env.PORT || 8083;

routerService.init(app);

designDocumentService.registerAllDocuments().then(() => {
	app.listen(port, () => {
		logService.info("EVA", `Listening on port ${port}!`);
	});
})
