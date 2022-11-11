import {DesignDocumentService} from "../design-document.service";

declare const emit: any;

/**
 * Example document to show how documents should look like.
 * The {@code declare const emit} up there is mandatory, since typescript wouldn't shut up
 * about the "emit" function which CouchDB uses.
 */
DesignDocumentService.register({
	_id: "_design/example",
	views: {
		changesets: {
			map: function (doc) {
				if (doc.value.meta.author) {
					const index = doc._id.indexOf(":revs:");
					emit([doc._id.substring(0, index), doc.value.meta.author], doc.value.changeset, doc.value.timestamp);
				}
			},
			reduce: "_count",
		},
	},
});
