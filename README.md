# @adonisjs/redis

<br />

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url]

## Introduction
Redis provider for AdonisJS with support for multiple Redis connections, cluster, pub/sub and much more

## Official Documentation
The documentation is available on the [AdonisJS website](https://docs.adonisjs.com/guides/database/redis)

## Contributing
One of the primary goals of AdonisJS is to have a vibrant community of users and contributors who believes in the principles of the framework.

We encourage you to read the [contribution guide](https://github.com/adonisjs/.github/blob/main/docs/CONTRIBUTING.md) before contributing to the framework.

### Run tests locally
Easiest way to run tests is to launch the redis cluster using docker-compose and `docker-compose.yml` file.

```sh
docker-compose up
npm run test
```

We also have a `docker-compose.ci.yml` file that will dockerize the library and run tests inside the container. This is what we use on Github actions.

## Code of Conduct
In order to ensure that the AdonisJS community is welcoming to all, please review and abide by the [Code of Conduct](https://github.com/adonisjs/.github/blob/main/docs/CODE_OF_CONDUCT.md).

## License
AdonisJS Redis is open-sourced software licensed under the [MIT license](LICENSE.md).

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/adonisjs/redis/test.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/adonisjs/redis/actions/workflows/test.yml "Github action"

[npm-image]: https://img.shields.io/npm/v/@adonisjs/redis/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@adonisjs/redis/v/latest "npm"

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[license-url]: LICENSE.md
[license-image]: https://img.shields.io/github/license/adonisjs/redis?style=for-the-badge
