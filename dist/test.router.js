"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TestRouter {
    constructor() {
        this.ROUTE = "/test";
    }
    init(app) {
        app.get(this.ROUTE, this.getTest);
    }
    getTest(_req, res) {
        res.status(200)
            .send(true);
    }
}
exports.default = TestRouter;
