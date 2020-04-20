import Redis from '@ioc:Adonis/Addons/Redis'
Redis.connection().get('foo')
