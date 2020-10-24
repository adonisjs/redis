The package has been configured successfully. The redis configuration stored inside `config/redis.ts` file relies on the following environment variables and hence we recommend validating them.

Open the `env.ts` file and paste the following code inside the `Env.rules` object.

```ts
REDIS_CONNECTION: Env.schema.enum(['local'] as const),
REDIS_HOST: Env.schema.string({ format: 'host' }),
REDIS_PORT: Env.schema.number(),
REDIS_PASSWORD: Env.schema.string.optional(),
```

- We expect the `REDIS_CONNECTION` to be one of the whitelisted connections defined inside the `contracts/redis.ts` file.
- The `REDIS_HOST` should always be present and formatted as a valid `host`.
- The `REDIS_PORT` should always be present and a valid number.
- Finally the `REDIS_PASSWORD` is optional but when present should be a valid string.
