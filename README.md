# secrets-manager-to-config

Assume that in AWS secret manages we have defined a secret `abc` with `a.b.c = "123"`, then create a file `pull-env.ts` and write

```ts
// pull-env.ts

import { downloadConfig, SecretConfig } from "secrets-manager-to-config";

const secretConfig: SecretConfig = {
    awsRegion: "ap-southeast-2"
}

downloadConfig(secretConfig);
```

now you can pull your secret into nested `json` or `yml` or `flat_env` by

```js
// yml can be replaced by json
// npx tsm can be replaced by ts-node, whatever way you can execute a ts file

npx tsm pull-env.ts --secret_name abc --format yml --save_at test.yml
```

which results in

- In `yml` format:
  ```yml
  # test.yml

  a:
    b:
      c: "123"
  ```
  This is suitable for spring boot project where we use `application.yml`.

- In `json` format:
  ```json
  {
    "a": {
      "b": {
        "c": "123"
      }
    }
  }
  ```
  This is suitable for `nodejs` project where we use `env-cmd -f .env.json` to load `env` config.

- In `flat_env` format:
  ```env
  a.b.c="123"
  ```
  This is suitable for ordinary `.env` files or application.properties for spring boot project.