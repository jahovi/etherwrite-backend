import {DesignDocumentService} from "../design-document.service";

declare const emit: any;

DesignDocumentService.register({
	/**
	 * Design document containing views to retrieve data to calculate authoring ratios.
	 * 
	 * {@view chars_per_author_and_pad} can be queried via /etherpad/_design/authoring_ratios/_view/chars_per_author_and_pad?group_level=2
	 * With a group_level=2 argument, the reduce function sums (for each pad) the number of character by each author currently existing and returns a list of dictionaries containing
	 * the padname and the authorname as key and the number of chars as the value.
	 * 
	 * {@view total_chars_per_pad} can be queried via /etherpad/_design/authoring_ratios/_view/total_chars_per_pad
	 * and returns a list of dictionaries containing th padname as key and the total number of chars currently existing in it as the value.
	 * 
	 * {@view author_colors} can be queried via /etherpad/_design/authoring_ratios/_view/author_colors and returns a list of dicts with the author as the key
	 * and the color as the value
	 */
	_id: "_design/authoring_ratios",
	views: {
		chars_per_author_and_pad: {
			map: function (doc) {
				// use regex to find documents with titles of type "pad:PADNAME:revs:XX".
				const regexRevisionDoc = /^pad:\w+:revs:\d+$/;		
				if (regexRevisionDoc.test(doc._id) && doc.value.meta.author) {				
					const index = doc._id.indexOf(":revs:");

					// Calculate the number of characters that were added or removed in the revision
					const regexChange = /([><])([0-9a-z]+)/;
					const match = doc.value.changeset.match(regexChange);
					let change = 0;
					if (match[1] === ">") { // chars added
						change = parseInt(match[2], 36);
					} else if (match[1] === "<") { // chars removed
						change = -(parseInt(match[2], 36));
					}

					emit([doc._id.substring(4, index), doc.value.meta.author], change); 
				}
			},
			reduce: "_sum"
		},
		total_chars_per_pad: {
			map: function(doc) {
				// use regex to find documents with titles of type "pad:PADNAME",
				// these contain the text currently in the pad.
				const regexPadDoc = /^pad:\w+$/;
				if (regexPadDoc.test(doc._id)) {
					// It seems that documents always contain an extra newline at the end,
					// even empty ones. That's why I'm subtracting 1 from the length.
					const numChars = doc.value.atext.text.length - 1;

					emit(doc._id.substring(4), numChars)
				}
			}
		},
		author_colors: {
			map: function(doc) {
				const regexGlobalAuthorDoc = /^globalAuthor:/;
				if (regexGlobalAuthorDoc.test(doc._id)) {
					emit(doc._id.substring(13), doc.value.colorId.toString());
				}
			}
		},
	},
});