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
					emit(doc._id.substring(13, doc._id.length), doc.value);
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
