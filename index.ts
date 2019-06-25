import { RedisContract } from '@ioc:Adonis/Addons/Redis'

const config = {
  local: {
    // cluster: true,
    // clusters: [{ host: '127.0.0.1', port: 3333 }],
  },
}

const foo: RedisContract<typeof config> = {}

const a = foo.connection('local')
