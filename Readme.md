# EVA – The EtherWrite Data Processing Service

## In a nutshell

This software provides the backend services for the EtherWrite Moodle plugin. It contains several services that evaluate user data from the CouchDB in order to generate structured information on the process of collaborative writing.  

## Legal considerations

If you or your organisation want to use this software, it is your responsibility to inform yourself about the data protection laws of your country and under which circumstances this software can be legally applied. In order to avoid legal troubles for yourself, please obtain professional legal advice before using this software outside of your private testing enivironment.  

It´s very likely that you have to make sure that all users are informed and consenting that all of their actions within the Etherpad editor will be recorded for a longer perdiod of time. This includes not only interactions with the user interface of the editor but also, for example events like logging into the editor, exiting the editor etc. All these actions and events of the users will be subject to all kinds of analytics while you use this software. You should clarify with your legal advisor how you are to inform your users about these topics in detail and how you are to obtain their consent.


## Getting started

In the following steps, it is assumed that you have downloaded your copy of the EVA project via git clone from a repository via command line. Please navigate your command line to the folder named `eva`.

First of all, you must create an .env file in your eva folder. Here you should enter 
* the URL, port number and login credentials of your CouchDB server (COUCH_DB_USER, COUCH_DB_PWD, COUCH_DB_HOST, COUCH_DB_PORT)
* the URL and port number of your Moodle server (ALLOW_ORIGIN)
* your secret key for encrypting communications with the Moodle frontend (MOODLE_SECRET_KEY)  

Please see the section `Environment` below for more details. 

Before launching EVA, you have to start your instance of the EtherpadLite server including the ep_tracking plugin as well as the associated CouchDB server. Both can be found in the Etherpad Serverside project folder. 

To produce a build, execute `npm run build`. If you have globally installed Typescript on your computer, you may want to use `npm run build2` alternatively. Then you can start your EVA server from the command line by executing `node dist/app.js` from your eva folder.  

For testing and development purposes you may want to execute `npm run dev` instead of running a build.  

Once your EVA server is properly set up and running, you should start your Moodle server instance and its associated database. Then make sure the EtherWrite plugin is installed and configured to connect to your EtherpadLite server and EVA server. See the EtherWrite documentation for more details. 


## Environment

Create a `.env` file in the project's root directory with the following content (change values accordingly):

```
PORT=8083
ALLOW_ORIGIN=
COUCH_DB_USER=somename
COUCH_DB_PWD=password
COUCH_DB_HOST=localhost
COUCH_DB_PORT=5984

MOODLE_SECRET_KEY=0c26bee8-f114-4a59-ad65-15092de45df9

ETHERVIZ_DEBUG=true

COH_FORMAT_EDITING_VALUE=5
COH_DELETE_VALUE=0.2
COH_PERCEPTION_DATA_WEIGHT=0.5

PADS_IGNORE= 
```
PADS_IGNORE can be filled with one or more names of pads, separated by commas. These will be ignored by EVA Services that are launched by the pad registry. This can be useful e.g. for debugging or if there are some older pads in the CouchDB and you want to reduce the workload on EVA. 

ALLOW_ORIGIN must be set to the address of your MoodleServer, for example http://localhost:8081

MOODLE_SECRET_KEY must be filled with a symmetric secret key. This key also must be entered in the settings of the Etherwrite Moodle plugin. If no secret key is defined here, a default key will be used: 0c26bee8-f114-4a59-ad65-15092de45df9

## Development

If you are interested in extending or improving this software, that´s great.  

HTTP-Routers are created as classes implementing the `Router` interface. They should add all their routes in the `init` method by using `app.get`
, `app.put` etc. Don't forget to register your router in `src/routers.ts`. Websocket-Routers are classes that inherit from `AbstractWsRouter`. These should be registered in the `src/websocket/wsroutes.ts` file.  

If you would like to create a new service that you want to base on the evaluation of Etherpad´s changesets, you may want to make of use the ChangesetService class and the AbstractChangesetSubscriber class. The EthervizService class or the MinimapService class may give you an idea how such services can be structured.  

If you are interested in evaluating data from Etherpad´s ep_tracking plugin, you may want to take a look at the TrackingService class. 


## Endpoints

### /authoring_ratios

Returns as json an object containing corresponding authors, moodle IDs, authoring ratios and colors for the pad provided as an argument (`pad=PADNAME`). The ratios are given 
as percentages rounded to two decimal places. If the current user is a moderator, individual users' values will be returned. Example:

Example:

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


### /getEtherVizData

Execute request `GET <EVAURL>:<EVAPORT>/getEtherVizData?pad=<your pad name>` to receive the data for
generating an EtherViz chart for the specified pad.  
The data is structured as follows: 

```js
{
	dateTime:string,
	/**A rectangle describes a status block */
	rectangles: EtherVizColumnItem[], 
	/**A parallelogram describes the transitions from
	 * the characters that are part of the rectangles
	 * block to the status block after the cuurent one. 
	 */
	parallelograms?: EtherVizColumnItem[] 
}
```

The structure of an EtherVizColumnItem:  
```js
{
	authorId:string,
	upperLeft: number,
	upperRight?:number,
	lowerLeft:number,
	lowerRight?:number,
}
```

### /activity/activities

`GET <EVAURL>:<EVAPORT>/activity/activities?padName=<your pad name>` will return the activities that took place in the requested pad, i.e. 
the number of changesets. They will be aggregated by hour, or, if the entire project already lasted longer than 3 days, by day.

The returned data is structured as follows:
```js
[
	{
		timeStamp: string, // Readable date/datetime string
		authorToActivities: {
			[authorMoodleId: string]: number,
        }, 
	}
]
```

### /activity/operations

`GET <EVAURL>:<EVAPORT>/activity/activities?padName=<your pad name>` will return the operations that took place in the requested pad, i.e. 
the number of changesets distinguished by the type of operation. Possible operations are: 
- WRITE (adding text)
- EDIT (formatting already written text)
- DELETE (removing text)
- PASTE (pasting a number of characters)
They will be aggregated by hour, or, if the entire project already lasted longer than 3 days, by day.

The returned data is structured as follows:
```js
[
	{
		timeStamp: string, // Readable date/datetime string
		authorToOperations: {
			[authorMoodleId: string]: {
				WRITE?: number,
				EDIT?: number,
				DELETE?: number,
				PASTE?: number,
            },
        }, 
	}
]
```

### /getCohDiagData
`GET <EVAURL>:<EVAPORT>/getCohDiagData?padName=<your pad name>` will return the data needed for drawing the cohesion diagram. 

The returned data is structured as follows: 
```js
{
	nodes: Node[],
	distances: NodeDistance[],
	connections: NodeConnection[]
}
```
The auxiliary data structures: 
```js
Node { 
	id: string, 
}

NodeDistance { 
	source: string, 
	target: string, 
	dist: number 
}

NodeConnection { 
	source: string, 
	target: string, 
	intensity: number 
}
```

The node distance value (i.e. the dist property in NodeDistance) is guaranteed to be a decimal in the range between 0.2 and 1.  

The intensity property in NodeConnection is always a decimal between 0 and 1. 

### /etherpad/authorize

`GET <EVAURL>:<EVAPORT>/etherpad/authorize` will return a token for an Etherpad user in the Moodle frontend. 

## Websockets

### /minimap

Open a Websocket connection to "minimap" with a parameter padName to the receive the data needed for the EtherWrite Minimap. The data object will either contain text block data or a scroll position. In the first case, the object sent will contain a property named "blocks". In the latter case there will be a property named "scrollPos".  

The data in "blocks" contains an array of blocks. The beginning of a new block indicates that the author and/or the ignoreColor-flag has changed compared to the previous block. Each object of the sequence has this form:

```js
{
  author: string, 
  blockLength: number,
  lineBreakIndices ?: number[],
  ignoreColor?:boolean,
  headingStartIndices?:number[],
  headingTypes?:{[key:number]:string},
}
```

author -- the etherpad id of the author of this text block   
blockLength -- the number of characters in this text block (linebreaks count as characters too)  
lineBreakIndices -- enumerates the relative indices in this block, where a linebreak is located. May be empty or
otherwise contains number in the range of 0 to (blockLength-1) in ascending order. The order in which the elements in this list are placed is identical to the order of the corresponding text structure in the etherpad text.  
ignoreColor -- if true, this indicates that all the text in this block has been set to remove the author colors in the etherpad editor.   
headingStartIndices -- may contain zero or more relative indices in ascending order. Each of these indices means, that all following  characters are to be printed as headline. Every headline ends at the next following linebreak. Be aware that this linebreak may occur in one of the later blocks. IMPORTANT: Each heading start index is associated with a *-character that is invisible in the editor and accordingly should NOT be represented by a character in the minimap.  
headingTypes -- For each index in headingStartIndices this contains the information about its size ("h1","h2","h3","h4"). The startIndex serves as key to the corresponding heading type in this object.  

The data in "scrollPos" will be structured as follows: 

```js
{
	[key: string]:
	{
		timeStamp: number,
		topIndex: number,
		bottomIndex?: number,
	}
}
```

Please note that updates will only be sent regarding authors that can be assumed to currently have openend that pad. I.e. users, for which ep-tracking has a disconnect event that is newer than the latest connect event or the latest scroll event, will be excluded.  

### /authoring_ratios_ws

Open a socket.io connection to "authoring_ratios_ws" with a parameter `padName` to the receive the same data as provided by the endpoint `authoring_ratios` as it comes in.

### /authors

Open a socket.io connection to "wsauthors" to receive an object containing information about all authors EVA currently 
knows. Any updates, for example when an authors changes his color or when a new authors enters an Etherpad for the first time, will be 
pushed in an "update" event by this websocket.  

```js
{
  [epid: string]: {
    epalias: string,
    color: string,
    mapper2author: string
  }
}
```

epid -- etherpad id  
epalias -- the alias name, that the author may or may not have entered in the etherpad text editor. This information should only be used for debugging purposes. If you are looking for the real names of authors, use the frontend´s VuexStore instead. 
color: -- the color that is associated with this author according to the database  
mapper2author -- delivers the 'XX' from the mapper2author:XX files in couchdb that is assigned to the etherpad id of this author, IF there
is such a file in the couchdb for this etherpad id.

### /documentmetrics

Open a socket.io connection to "documentmetrics" with a parameter `padName` to receive an object containing the number of words and the number of characters currently in the specified pad. 

```js
[
  0: number,
  1: number,
]
```

The value under index 0 is the number of chars, the value under index 1 is the number of words. 