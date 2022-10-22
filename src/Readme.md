# EVA – The EtherWrite Data Processing Service

## Developing

To start the development server, execute `npm run dev`.

## Building

To produce a build, execute `npm run build`.

## Structure

Routers are created as classes implementing the `Router` interface. They should add all their routes in the `init` method by using `app.get`, `app.put` etc.

Don't forget to register your router in `src/routers.ts`!