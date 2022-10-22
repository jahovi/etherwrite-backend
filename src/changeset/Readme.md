# Changeset Library

[Quelle](https://github.com/ether/etherpad-lite/blob/develop/doc/api/changeset_library.md)

The changeset library provides tools to create, read, and apply changesets.

## Changeset

```javascript
const Changeset = require('./Changeset');
const steps = Changeset.unpack(cs);
```

A changeset describes the difference between two revisions of a document. When a
user edits a pad, the browser generates and sends a changeset to the server,
which relays it to the other users and saves a copy (so that every past revision
is accessible).

A transmitted changeset looks like this:

```
'Z:z>1|2=m=b*0|1+1$\n'
```

## Attribute Pool

```javascript
const AttributePool = require('./AttributePool');
```

Changesets do not include any attribute key–value pairs. Instead, they use
numeric identifiers that reference attributes kept in an attribute
pool. This attribute interning reduces the transmission overhead of attributes that
are used many times.

There is one attribute pool per pad, and it includes every current and
historical attribute used in the pad.