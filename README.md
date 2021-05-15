# gaia-engine

Typescript engine for Take6, a game similar to 6nimmt.

## Setup

### Requirements

Recent version of node / yarn.

### Dependencies

In the project's folder:

```
yarn
```

### Build

To compile Typescript into javascript:

```
yarn build
```

### Test

```
yarn test
```

### Usage as a dependency from another module

If you want to use your local copy of this module instead of the npm version, as a dependency of
another module, do this:

```
## In this folder
yarn link

## In the other project's folder
yarn link take6-engine
```
