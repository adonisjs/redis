<div align="center">
  <img src="https://res.cloudinary.com/adonisjs/image/upload/q_100/v1558612869/adonis-readme_zscycu.jpg" width="600px">
</div>

# Adonis Redis
> Redis provider for AdonisJs with support for multiple redis connections, cluster, pub/sub and much more.

[![circleci-image]][circleci-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url]

This is a first party addon to add support for using Redis server with AdonisJs. In a nutshell:

1. It allows having multiple redis connections by defining them inside `config/redis(.js|.ts)` file.
2. Eases the API for pub/sub.
3. Support for cluster and sentinel.
4. Ships with health checker that you can access using the `HealthCheck` service of AdonisJs.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of contents

- [Testing](#testing)
- [Maintainers](#maintainers)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Testing
The tests are executed inside a Docker container, since setting up a redis cluster can be painful. Just make sure to have the Docker client running on your OS.

Run the following commands to build and run tests.

```sh
docker-compose build
docker-compose run --rm tests
```

## Maintainers
[Harminder virk](https://github.com/thetutlage)

[circleci-image]: https://img.shields.io/circleci/project/github/adonisjs/adonis-redis/master.svg?style=for-the-badge&logo=appveyor
[circleci-url]: https://circleci.com/gh/adonisjs/adonis-redis "circleci"

[npm-image]: https://img.shields.io/npm/v/@adonisjs/redis.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@adonisjs/redis "npm"

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[license-url]: LICENSE.md
[license-image]: https://img.shields.io/aur/license/pac.svg?style=for-the-badge
