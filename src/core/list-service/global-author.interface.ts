/**
 * Mirrors the structure of the objects in the 
 * database that contain central author information. 
 */
export default interface AuthorData{
    _id: string;
    _rev: string;
    value: {
        colorId:string,
		name: string,
		timestamp:number;
    }
}