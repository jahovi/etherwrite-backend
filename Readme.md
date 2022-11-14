# EVA – The EtherWrite Data Processing Service

## Developing

To start the development server, execute `npm run dev`.

## Building

To produce a build, execute `npm run build`.

## Environment

Create a `.env` file in the project's root directory with the following content (change values accordingly):

```
PORT=8083
COUCH_DB_USER=somename
COUCH_DB_PWD=password
COUCH_DB_HOST=localhost
COUCH_DB_PORT=5984
```

## Structure

Routers are created as classes implementing the `Router` interface. They should add all their routes in the `init` method by using `app.get`
, `app.put` etc.

Don't forget to register your router in `src/routers.ts`!

## Test connection to CouchDB

Execute request `GET localhost:8083/dbtest?dbname=<your db name>` to test database connection.

## Get Author Info

Execute request `GET localhost:8083/getAuthorInfo` to receive an object containing author information:  
{ [epid: string]: { epalias:string, color:string, mapper2author:string } }  
epid -- etherpad id  
epalias -- the alias name, that the author may or may not have entered in the etherpad text editor  
color: -- the color that is associated with this author according to the database  
mapper2author -- delivers the 'XX' from the mapper2author:XX files in couchdb that is assigned to the etherpad id of this author, IF there is such a file in the couchdb for this etherpad id. 

## Get Block Info

Execute request `GET localhost:8083/getBlockInfo?padName=<your pad name>` to receive a sequence of data representing the blocks of text that originate from author each. Each object of the sequence has this form:  
{  
    author: string,  
    blockLength: number,  
    lineBreakIndices: [number?]  
}  

author -- the etherpad id of the author auf this text block   
blockLength -- the number of characters in this text block (linebreaks count as characters too)  
lineBreakIndices: -- enumerates (if there are any ...) this relative indices in this block, where there is a linebreak. May be empty or otherwise contains number in the range of 0 to (blockLength-1) in ascending order. 

The order in which the elements in this list are placed is identical to the order of corresponding blocks in the etherpad text.  


