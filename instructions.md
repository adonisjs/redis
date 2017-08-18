## Registering provider

Make sure you register the provider inside `start/app.js` file before making use redis.

```js
const providers = [
  '@adonisjs/redis/providers/RedisProvider'
]
```

Once that done you can make use of Redis anywhere by importing the redis provider.

```js
const Redis = use('Redis')
await Redis.get()
```

## Pub Sub
In order to make use of pub/sub you can subscribe to channels inside `start/redis.js` file.

```js
const Redis = use('Redis')
Redis.subscribe('news', async () => {
})

// or bind listeners from `app/Listeners` directory
Redis.subcribe('news', 'News.onMessage')
```

## Config
The config file `config/redis.js` contains all the configuration. Feel free to tweak it as per your needs.

## Environment variables
The configuration file makes use of **Environment variables**, make sure to define them for development and in production too

```
REDIS_CONNECTION=local
```
