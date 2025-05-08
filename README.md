# secrets-manager-to-config
## Table of Contents

- [secrets-manager-to-config](#secrets-manager-to-config)
  - [Upload a ts-file as a Secret](#upload-a-ts-file-as-a-secret)
    - [ts-node upload.ts --secret\_name \<secret-name\> --ts\_path \<ts-filepath\>](#ts-node-uploadts---secret_name-secret-name---ts_path-ts-filepath)
  - [Sample Result](#sample-result)
  - [Download Secrets](#download-secrets)
    - [ts-node download.ts --secret\_name \<secret-name\> --format \<format\> --save\_at \<filepath\>](#ts-node-downloadts---secret_name-secret-name---format-format---save_at-filepath)


## Upload a ts-file as a Secret

### ts-node upload.ts --secret_name \<secret-name\> --ts_path \<ts-filepath\>

This package aims at managing secrets saved in `ts` format, so that `UAT`, `PROD` etc environments can infer their type from `DEV` config.

Assume that we have the following env config written in `ts` file:

```ts
// config/test.ts

const someConfig: {
  hihi: string;
  ohMy: {
    value: string;
    someArray: string[];
  };
} = {
  hihi: "bye",
  ohMy: {
    value: "gosh",
    someArray: ["hihi", "hjaaaaaaa"],
  },
};

export default someConfig;
```
Then this ***default export*** can be uploaded to secrets manager via

```bash
ts-node upload.ts --secret_name some-test-config --ts_path config/test.ts
```
where `upload.ts` is defined by `uploadConfig`:

```ts
// upload.ts

import { SecretConfig, uploadConfig } from "secrets-manager-to-config";

const secretConfig: SecretConfig = {
  awsRegion: "ap-southeast-2",
};

uploadConfig(secretConfig);
```
## Sample Result

We have the following in secret manager:

<a href="src/images/secrets.png"><img src="src/images/secrets.png"/><a>

## Download Secrets

### ts-node download.ts --secret_name \<secret-name\> --format \<format\> --save_at \<filepath\>

Assume that in AWS secret manages we have defined a secret `abc` with `a.b.c = "123"`, then create a file `download.ts` and write

```ts
// download.ts

import { downloadConfig, SecretConfig } from "secrets-manager-to-config";

const secretConfig: SecretConfig = {
  awsRegion: "ap-southeast-2",
};

downloadConfig(secretConfig);
```

now you can pull your secret by

```bash
ts-node download.ts --secret_name abc --format yml --save_at test.yml
```

Here the `format` is of type `json | yml | flat_env`. The above results in

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
