import {DesignDocumentService} from "../design-document.service";

declare const emit: any;

DesignDocumentService.register({
	/**
	 * Design document containing views to retrieve data to calculate authoring ratios.
	 * 
	 * {@view author_colors} can be queried via /etherpad/_design/authoring_ratios/_view/author_colors and returns a list of dicts with the author as the key
	 * and the color as the value
	 */
	_id: "_design/authoring_ratios",
	views: {
		text_per_pad: {
			map: function(doc) {
				const regexPadDoc = /^pad:\w+$/;
				if (regexPadDoc.test(doc._id)) {
					const text = doc.value.atext.text;
					emit(doc._id.substring(4), text);
				}
			}
		},
		chars_and_words_per_pad: {
			// Returns a row for each pad, with the pad name as the key and a [numChars, numWords] array as the value
			map: function(doc) {
				const regexPadDoc = /^pad:\w+$/;
				if (regexPadDoc.test(doc._id)) {
					const numChars = doc.value.atext.text.length - 1;
					let numWords;
					if (numChars === 0) {
						// Without this conditional, empty texts count as one word for reasons
						// seemingly unrelated to the ever present trailing newline
						numWords = 0;
					} else {
						numWords = doc.value.atext.text.split(/\s+\b/).length;
					}
					emit(doc._id.substring(4), [numChars, numWords]);
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