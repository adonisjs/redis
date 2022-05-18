The package has been configured successfully. The redis configuration stored inside `config/redis.ts` file relies on the following environment variables and hence we recommend validating them.

Open the `env.ts` file and paste the following code inside the `Env.rules` object.

```ts
REDIS_CONNECTION: Env.schema.enum(['local'] as const),
REDIS_HOST: Env.schema.string({ format: 'host' }),
REDIS_PORT: Env.schema.number(),
REDIS_PASSWORD: Env.schema.string.optional(),
```
