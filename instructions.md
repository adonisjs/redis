## Registering provider
Make sure to register the provider inside `start/app(.ts|.js)` file.

```ts
export const providers = [
  '@adonisjs/redis',
]
```

## Boilerplate setup
In order to make use of the Redis provider, you will need a config file `config/redis.ts` and environment variables inside `.env` file.

When this package is installed using `adonis install` command, then the CLI will ensure to create the required boilerplate for you. However, you can run the following command anytime to create the neccessary files.

```sh
adonis run:instructions @adonisjs/redis
```
