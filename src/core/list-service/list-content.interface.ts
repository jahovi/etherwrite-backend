/**
 * Represents the structure of the 'payload'
 * elements that each list node carries. 
 * More attributes can be added within 'meta'
 * if need arises. 
 */
export default interface ListContent {
    content:string;
    meta:{
        author:string,
        ignoreColor:boolean,
        headingStart?:string,
    }
}