declare module '@ioc:Adonis/Addons/Redis' {
  export interface RedisConnectionsList {
    primary: RedisConnectionConfig
    cluster: RedisClusterConfig,
  }
}
