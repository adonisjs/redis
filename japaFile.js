require('ts-node/register')

const { configure } = require('japa')
configure({
  files: ['test/**/redis-factory.spec.ts']
})
