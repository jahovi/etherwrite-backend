"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routers_1 = __importDefault(require("./routers"));
const app = (0, express_1.default)();
const port = 8083;
routers_1.default.forEach(router => {
    console.info("Registering router: ", router.name);
    new router().init(app);
});
app.listen(port, () => {
    console.log(`EVA is listening on port ${port} !`);
});
