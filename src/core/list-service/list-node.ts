import ListContent from "./list-content.interface";
/**
 * Helper class for the double linked list. 
 * Each instance represents one node in a 
 * linked list. 
 */
export default class ListNode {

	public next?: ListNode;
	public prev?: ListNode;
	public value: ListContent;

	public constructor(content: string, author: string) {
		this.value = {content: content, meta:{author:author, ignoreColor:false}}
	}

}