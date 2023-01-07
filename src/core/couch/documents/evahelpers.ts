import {DesignDocumentService} from "../design-document.service";

declare const emit: any;

/**
 * Contains views to support eva in issues of general concern.
 */
DesignDocumentService.register({
	_id: "_design/evahelpers",
	views: {
		detectpadnames: {
			map: function (doc) {
				if (doc._id.substring(0, 13) === "pad2readonly:") {
					emit(doc._id.substring(13, doc._id.length), 0);

				}
			},
		},
		fetchmapper2authordata: {
			map: function (doc) {
				if (doc._id.substring(0, 14) === "mapper2author:") {
					emit(doc.value, doc._id.substring(14, doc._id.length));
				}
			}
		},
		fetchglobalauthors: {
			map: function (doc) {
				if (doc._id.substring(0, 13) === "globalAuthor:") {
					let color = "" + doc.value.colorId;
					if (!color || !color.startsWith("#")) {
						// This is a bug in etherpad: The initially added color is an index for the color palette array of etherpad.
						const colorPalette = [
							"#ffc7c7",
							"#fff1c7",
							"#e3ffc7",
							"#c7ffd5",
							"#c7ffff",
							"#c7d5ff",
							"#e3c7ff",
							"#ffc7f1",
							"#ffa8a8",
							"#ffe699",
							"#cfff9e",
							"#99ffb3",
							"#a3ffff",
							"#99b3ff",
							"#cc99ff",
							"#ff99e5",
							"#e7b1b1",
							"#e9dcAf",
							"#cde9af",
							"#bfedcc",
							"#b1e7e7",
							"#c3cdee",
							"#d2b8ea",
							"#eec3e6",
							"#e9cece",
							"#e7e0ca",
							"#d3e5c7",
							"#bce1c5",
							"#c1e2e2",
							"#c1c9e2",
							"#cfc1e2",
							"#e0bdd9",
							"#baded3",
							"#a0f8eb",
							"#b1e7e0",
							"#c3c8e4",
							"#cec5e2",
							"#b1d5e7",
							"#cda8f0",
							"#f0f0a8",
							"#f2f2a6",
							"#f5a8eb",
							"#c5f9a9",
							"#ececbb",
							"#e7c4bc",
							"#daf0b2",
							"#b0a0fd",
							"#bce2e7",
							"#cce2bb",
							"#ec9afe",
							"#edabbd",
							"#aeaeea",
							"#c4e7b1",
							"#d722bb",
							"#f3a5e7",
							"#ffa8a8",
							"#d8c0c5",
							"#eaaedd",
							"#adc6eb",
							"#bedad1",
							"#dee9af",
							"#e9afc2",
							"#f8d2a0",
							"#b3b3e6",
						];
						color = colorPalette[parseInt(color)];
					}
					emit(doc._id.substring(13, doc._id.length), Object.assign({}, doc.value, {
						colorId: color,
					}));
				}
			}
		},
		author2Token: {
			map: function (doc) {
				if (doc._id.startsWith("token2author:")) {
					emit(doc.value, doc._id.substring(13, doc._id.length));
				}
			}
		},
		fetchtrackingdata: {
			map: function (doc) {
				if (doc._id.substring(0, 9) == "tracking:") {
					const [_tracking, userId, timestamp, sessionMsgId] = doc._id.split(":");
					emit(`tracking:${timestamp}:${userId}:${sessionMsgId}`, doc.value);
				}
			}
		},
	},
});
