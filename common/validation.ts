import SDOAdapter from 'schema-org-adapter'
import { Url } from 'url'
import { flatten, unique } from '../common'

const sdo = new SDOAdapter({ schemaHttps: true })
let voc_fetched = false

class Validator {
  boolean(s: string) {
    return s === 'true' || s === 'false'
  }
  text(s: string) {
    return typeof s === 'string'
  }
  number(s: string) {
    return typeof parseFloat(s) === 'number'
  }
  integer(s: string) {
    return typeof parseInt(s) === 'number'
  }
  float(s: string) {
    return this.number(s)
  }
  url(s: string) {
    return /^(ftp|http|https|backbone|ipfs):\/\/[^ "]+$/.test(s)
  }
  datetime(s: string) {
    ;/^(?![+-]?\d{4,5}-?(?:\d{2}|W\d{2})T)(?:|(\d{4}|[+-]\d{5})-?(?:|(0\d|1[0-2])(?:|-?([0-2]\d|3[0-1]))|([0-2]\d{2}|3[0-5]\d|36[0-6])|W([0-4]\d|5[0-3])(?:|-?([1-7])))(?:(?!\d)|T(?=\d)))(?:|([01]\d|2[0-4])(?:|:?([0-5]\d)(?:|:?([0-5]\d)(?:|\.(\d{3})))(?:|[zZ]|([+-](?:[01]\d|2[0-4]))(?:|:?([0-5]\d)))))$/.test(
      s
    )
  }
  time(s: string) {
    return this.datetime(s)
  }
  date(s: string) {
    return this.datetime(s)
  }
  xpathtype(s: string) {
    return this.text(s)
  }
  pronounceabletext(s: string) {
    return this.text(s) // TODO: needs a proper validator
  }
  cssselectortype(s: string) {
    return this.text(s) // TODO: needs a proper validator
  }
  distance(s: string) {
    return this.text(s) // TODO: needs a proper validator
  }
  duration(s: string) {
    return this.text(s) // TODO: needs a proper validator
  }
  energy(s: string) {
    return this.text(s) // TODO: needs a proper validator
  }
  mass(s: string) {
    return this.text(s) // TODO: needs a proper validator
  }
}

const validator = new Validator()

const QUANTITIES = ['distance', 'duration', 'energy', 'mass']

export async function validateObject(object) {
  if (!voc_fetched) {
    await sdo.addVocabularies(await sdo.constructSDOVocabularyURL('latest'))
    voc_fetched = true
  }

  if (!object?.schema_id) throw new Error('schema_id required')
  const schema = sdo.getClass(`schema:${object?.schema_id}`)
  const properties = await getAllProperties(schema)
  // check all variables to see if there are extra variables
  const unknown_variables = Object.keys(object).filter((key) => {
    if (Object.keys(properties).indexOf(key) === -1 && key !== 'schema_id') {
      return true
    }
  })
  if (unknown_variables.length > 0)
    throw new Error(
      `Unknown variables in ${object.schema_id} object: ${unknown_variables.join(', ')}`
    )

  // go through each field
  let valid_variables: string[] = []
  let invalid_variables: string[] = []
  let promises = Object.keys(object).map(async (key) => {
    if (key === 'schema_id') return
    if (typeof object[key] === 'string') {
      let datatype_tests: boolean[] = []
      properties[key].forEach((property_type) => {
        const schema = property_type.schema.replace('schema:', '').toLowerCase()

        // if type is datatype OR if schema is actually a quantity validate value.
        // Why schema.org chose to do quantities like this?
        if (property_type.type === 'datatype' || QUANTITIES.indexOf(schema) !== -1) {
          let pass = false
          if (typeof validator[schema] === 'function' && validator[schema](object[key])) pass = true
          datatype_tests.push(pass)
        }
      })
      if (datatype_tests.indexOf(true) !== -1) valid_variables.push(key)
      else invalid_variables.push(key)
    } else if (typeof object[key] === 'object') {
      const valid = await validateObject(object[key])
      if (valid) valid_variables.push(key)
      else invalid_variables.push(key)
    } else {
      throw new Error('unknown variable type')
    }
  })
  await Promise.all(promises)
  if (valid_variables.length !== Object.keys(object).length - 1) {
    throw new Error(
      `Invalid variables in ${object.schema_id} object: ${invalid_variables.join(', ')}`
    )
  }
  return true
}

async function getAllProperties(schema) {
  let properties = unique([
    ...schema.getProperties(),
  ])
  const properties_with_ranges = {}
  properties.forEach((p) => {
    const props = sdo.getProperty(p)
    const range_props = props.getRanges(true)

    properties_with_ranges[p.replace('schema:', '')] = range_props.map((p) => {
      if (['subjectOf'].indexOf(p) !== -1) return
      let type
      try {
        type = sdo.getDataType(p)
        if (type)
          return {
            type: 'datatype',
            schema: p,
          }
      } catch (e) {}
      return {
        type: 'class',
        schema: p,
      }
    })
  })
  return properties_with_ranges
}
