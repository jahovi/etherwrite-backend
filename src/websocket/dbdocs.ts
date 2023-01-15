/**
 * A set of regular expressions to ascertain the nature of a db doc from its id.
 */
const DbDocs = {
	revisionDoc: /^pad:\w+:revs:\d+$/, 	// pad:PADNAME:revs:XX
	padDoc: /^pad:\w+$/,				// pad:PADNAME
	globalAuthorDoc: /^globalAuthor:/,	// globalAuthor:ID
	tracking: /^tracking:.*$/,
} as const;

export default DbDocs;