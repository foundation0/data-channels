// import {
//   Model,
//   BasicModel,
//   ObjectModel,
//   ArrayModel,
//   FunctionModel,
//   MapModel,
//   SetModel,
//   Any
// } from 'objectmodel'
const {
  Model,
  BasicModel,
  ObjectModel,
  ArrayModel,
  FunctionModel,
  MapModel,
  SetModel,
  Any
} = require('./objectmodel')

export default (core) => {
  // TODO: Extend base model with core reference
  return (model) => {
    return ObjectModel(model)
  }
}
export {
  Model,
  BasicModel,
  ObjectModel,
  ArrayModel,
  FunctionModel,
  MapModel,
  SetModel,
  Any
}
