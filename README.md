# AdonisJS Framework

[![Gitter](https://img.shields.io/badge/+%20GITTER-JOIN%20CHAT%20%E2%86%92-1DCE73.svg?style=flat-square)](https://gitter.im/adonisjs/adonis-framework)
[![Trello](https://img.shields.io/badge/TRELLO-%E2%86%92-89609E.svg?style=flat-square)](https://trello.com/b/yzpqCgdl/adonis-for-humans)
[![Version](https://img.shields.io/npm/v/adonis-redis.svg?style=flat-square)](https://www.npmjs.com/package/adonis-redis)
[![Build Status](https://img.shields.io/travis/adonisjs/adonis-redis/master.svg?style=flat-square)](https://travis-ci.org/adonisjs/adonis-redis)
[![Coverage Status](https://img.shields.io/coveralls/adonisjs/adonis-redis/master.svg?style=flat-square)](https://coveralls.io/github/adonisjs/adonis-redis?branch=master)
[![Downloads](https://img.shields.io/npm/dt/adonis-redis.svg?style=flat-square)](https://www.npmjs.com/package/adonis-redis)
[![License](https://img.shields.io/npm/l/adonis-redis.svg?style=flat-square)](https://opensource.org/licenses/MIT)

> :pray: This is an official AdonisJs redis provider to make your life easier when working with Redis.

Redis provider makes it easier for you to work with redis and has out of the box support for Pub/Sub.

- [Installation](#installation)
- [Setup](#setup)

## Installation

```bash
npm i --save adonis-redis
```


## Setup

Once you have installed the provider from the [npm](https://npmjs.org/packages/adonis-redis), make sure to follow the below steps to setup the provider.

##### bootstrap/app.js

```javascript
const providers = [
  ...,
  'adonis-redis/providers/RedisFactoryProvider',
  'adonis-redis/providers/RedisProvider'
]
```

**Redis Factory** is a layer on top of [IoRedis](https://github.com/luin/ioredis) and **Redis** provider is something you are going to make use of. So setup an alias for that.

##### bootstrap/app.js

```javascript
const aliases = {
  ...,
  Redis: 'Adonis/Addons/Redis'
}
```

Now you are free to make use of Redis anywhere in your application. Make sure to check official docs for same [Redis Documentation.](http://adonisjs.com/docs/redis)

## Redis Config

You have to save the configuration for redis inside `config/redis.js` file. You can define multiple connections inside this file and specify the main connection under the `connection` property.

```javascript
module.exports = {
  connection: 'redis',
  
  redis: {
    port: 6379,          // Redis port
    host: '127.0.0.1',   // Redis host
    family: 4,           // 4 (IPv4) or 6 (IPv6)
    password: 'auth',
    db: 0
  },
  
  redisAlternate: {
    port: 6380,          // Redis port
    host: '127.0.0.1',   // Redis host
    family: 4,           // 4 (IPv4) or 6 (IPv6)
    password: 'auth',
    db: 0
  }

}
```


## Cluster Config

```javascript
module.exports = {
  connection: 'redis',

  redis: {
    clusters: [
      {
        port: 6380,
        host: '127.0.0.1'
      },
      {
        port: 6381,
        host: '127.0.0.1'      
      }
    ],
    redisOptions: {}
  }
}
```

