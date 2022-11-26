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

## Endpoints

### /getAuthorInfo

Execute request `GET localhost:8083/getAuthorInfo` to receive an object containing author information:

```js
{
  [epid: string]: {
    epalias:string;
    color: string;
    mapper2author: string
  }
}
````

epid -- etherpad id  
epalias -- the alias name, that the author may or may not have entered in the etherpad text editor  
color: -- the color that is associated with this author according to the database  
mapper2author -- delivers the 'XX' from the mapper2author:XX files in couchdb that is assigned to the etherpad id of this author, IF there
is such a file in the couchdb for this etherpad id.

### /getBlockInfo

Execute request `GET localhost:8083/getBlockInfo?padName=<your pad name>` to receive a sequence of data representing the blocks of text that
originate from author each. Each object of the sequence has this form:

````js
{
  author: string, 
  blockLength: number,
  lineBreakIndices ? : number[]
}
````

author -- the etherpad id of the author auf this text block   
blockLength -- the number of characters in this text block (linebreaks count as characters too)  
lineBreakIndices: -- enumerates (if there are any ...) this relative indices in this block, where there is a linebreak. May be empty or
otherwise contains number in the range of 0 to (blockLength-1) in ascending order.

The order in which the elements in this list are placed is identical to the order of corresponding blocks in the etherpad text.

### /authoring_ratios

Returns as json an object containing corresponding authors, moodle IDs, authoring ratios and colors for each pad. The ratios are given 
as percentages rounded to two decimal places. Without arguments data for all pads is returned. 
If the current user is not a moderator calls without a pad argument will be denied.

Example:

```js
{
  nameOfFirstPad: { 
    authors: [nameAuthor1, nameAuthor2, ...],
    moodleIDs: [moodleIDAuthor1, moodleIDAuthor2, ...],
    ratios: [anteilAutor1, anteilAutor2, ...],
    colors: [farbeAutor1, farbeAutor2, ...]
  }
  nameOfSecondPad: {
    authors: [nameAuthor1, nameAuthor2, ...],
    moodleIDs: [moodleIDAuthor1, moodleIDAuthor2, ...],
    ratios: [ratioAutor1, ratioAutor2, ...],
    colors: [colorAutor1, colorAutor2, ...]
  }
  ...
}
```

With an argument of `pad=PADNAME`, only data for the specified pad will be returned. If the current user is a moderator, individual users' values will be returned. Example:

```js
{
  authors: [nameAuthor1, nameAuthor2, ...],
  moodleIDs: [moodleIDAuthor1, moodleIDAuthor2, ...],
  ratios: [anteilAutor1, anteilAutor2, ...],
  colors: [farbeAutor1, farbeAutor2, ...]
}
```

If the current user is not a moderator, other users' values will be aggregated like so:

```js
{
  authors: [nameAuthor1, "Andere"],
  moodleIDs: [moodleIDAuthor1, null],
  ratios: [anteilAutor1, summierterAnteilDerAnderen],
  colors: [farbeAutor1, "#808080"]
}
```

The functionality is implemented in the following files:

- src/authoring-ratios.router.ts
- src/authoring-ratios-service/authoring-ratios-calculator.ts
- src/core/couch/documents/authoring-ratios-view.ts


