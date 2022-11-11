import {MaybeRevisionedDocument, ViewDocument} from "nano";

/**
 * Combination type for the design documents we are handling:
 * They contain views, and maybe they are already revisioned.
 */
export type MaybeRevisionedViewDocument<D> = ViewDocument<D> & MaybeRevisionedDocument;